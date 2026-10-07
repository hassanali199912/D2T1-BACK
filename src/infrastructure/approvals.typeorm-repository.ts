import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ApprovalAuditAction, ApprovalStatus } from '../domain/approval-status.js';
import { ApprovalNotPendingError } from '../domain/approval-not-pending.error.js';
import {
  ApplyDecisionInput,
  ApprovalPage,
  ApprovalPageQuery,
  ApprovalsRepository,
  NewApproval,
} from '../domain/approvals.repository.js';
import { ClaimAnalysis } from '../domain/entity/claim-analysis.entity.js';
import { Approval } from '../domain/entity/approval.entity.js';
import { ApprovalAudit } from '../domain/entity/approval-audit.entity.js';
import { Claim } from '../domain/entity/claim.entity.js';
import { User } from '../domain/entity/user.entity.js';

@Injectable()
export class ApprovalsTypeOrmRepository extends ApprovalsRepository {
  constructor(
    @InjectRepository(Approval)
    private readonly approvals: Repository<Approval>,
    @InjectRepository(ApprovalAudit)
    private readonly audits: Repository<ApprovalAudit>,
    private readonly dataSource: DataSource,
  ) {
    super();
  }

  async create(input: NewApproval): Promise<Approval> {
    return this.dataSource.transaction(async (manager) => {
      const saved = await manager.getRepository(Approval).save(
        manager.getRepository(Approval).create({
          claimId: input.claimId,
          claim: { id: input.claimId } as Claim,
          analysisId: input.analysisId,
          analysis: { id: input.analysisId } as ClaimAnalysis,
          status: input.status,
          originalRecommendation: input.originalRecommendation,
          reviewedBy: null,
          reviewedAt: null,
          decision: null,
          comment: null,
          finalDecision: null,
          finalPayout: null,
          editedFields: null,
        }),
      );
      await manager.getRepository(ApprovalAudit).save(
        manager.getRepository(ApprovalAudit).create({
          approvalId: saved.id,
          approval: { id: saved.id } as Approval,
          action: ApprovalAuditAction.Created,
          actorId: null,
          previousStatus: null,
          newStatus: input.status,
          previousDecision: null,
          newDecision: null,
          previousPayout: null,
          newPayout: input.originalRecommendation.payout,
          comment: null,
        }),
      );
      const loaded = await manager.getRepository(Approval).findOne({
        where: { id: saved.id },
        relations: {
          claim: { policy: true, creator: true },
          analysis: true,
          reviewer: true,
        },
      });
      if (!loaded) {
        throw new Error('Approval disappeared after create');
      }
      return loaded;
    });
  }

  findById(id: string): Promise<Approval | null> {
    return this.approvals.findOne({
      where: { id },
      relations: {
        claim: { policy: true, creator: true },
        analysis: true,
        reviewer: true,
      },
    });
  }

  findLatestByClaimId(claimId: string): Promise<Approval | null> {
    return this.approvals.findOne({
      where: { claimId },
      order: { createdAt: 'DESC' },
      relations: {
        claim: { policy: true, creator: true },
        analysis: true,
        reviewer: true,
      },
    });
  }

  async findPage(query: ApprovalPageQuery): Promise<ApprovalPage> {
    const where = query.status ? { status: query.status } : {};
    const [items, total] = await this.approvals.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      relations: {
        claim: { policy: true, creator: true },
        analysis: true,
        reviewer: true,
      },
    });
    return { items, total };
  }

  listAudits(approvalId: string): Promise<ApprovalAudit[]> {
    return this.audits.find({
      where: { approvalId },
      order: { createdAt: 'ASC' },
      relations: { actor: true },
    });
  }

  async applyDecision(input: ApplyDecisionInput): Promise<Approval> {
    return this.dataSource.transaction(async (manager) => {
      const result = await manager
        .getRepository(Approval)
        .createQueryBuilder()
        .update(Approval)
        .set({
          status: input.status,
          decision: input.decision,
          finalDecision: input.finalDecision,
          finalPayout: input.finalPayout,
          comment: input.comment,
          editedFields: input.editedFields,
          reviewedBy: input.reviewedBy,
          reviewedAt: new Date(),
          version: input.expectedVersion + 1,
        })
        .where('id = :id', { id: input.approvalId })
        .andWhere('status = :pending', { pending: ApprovalStatus.Pending })
        .andWhere('version = :version', { version: input.expectedVersion })
        .execute();

      if (!result.affected) {
        throw new ApprovalNotPendingError();
      }

      await manager.getRepository(Claim).update(input.claimId, { status: input.claimStatus });
      await manager.getRepository(ApprovalAudit).save(
        manager.getRepository(ApprovalAudit).create({
          approvalId: input.approvalId,
          approval: { id: input.approvalId } as Approval,
          action: input.audit.action,
          actorId: input.reviewedBy,
          actor: { id: input.reviewedBy } as User,
          previousStatus: input.audit.previousStatus,
          newStatus: input.status,
          previousDecision: input.audit.previousDecision,
          newDecision: input.finalDecision,
          previousPayout: input.audit.previousPayout,
          newPayout: input.audit.newPayout,
          comment: input.audit.comment,
        }),
      );

      const loaded = await manager.getRepository(Approval).findOne({
        where: { id: input.approvalId },
        relations: {
          claim: { policy: true, creator: true },
          analysis: true,
          reviewer: true,
        },
      });
      if (!loaded) {
        throw new Error('Approval disappeared during decision');
      }
      return loaded;
    });
  }
}
