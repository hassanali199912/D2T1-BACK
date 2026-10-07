import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalAuditAction,
  ApprovalStatus,
  EditedFields,
  HumanDecision,
  OriginalRecommendation,
} from '../domain/approval-status.js';
import { ApprovalsRepository } from '../domain/approvals.repository.js';
import { ClaimStatus } from '../domain/claim-status.js';
import { ClaimsRepository } from '../domain/claims.repository.js';
import { ClaimAnalysis } from '../domain/entity/claim-analysis.entity.js';
import { Approval } from '../domain/entity/approval.entity.js';
import { ApprovalAudit } from '../domain/entity/approval-audit.entity.js';
import { Claim } from '../domain/entity/claim.entity.js';
import { UserRole } from '../domain/entity/user.entity.js';
import { ApprovalNotPendingError } from '../domain/approval-not-pending.error.js';
import { ClaimActor } from './claims.service.js';
import { toPublicUser, PublicUser } from './public-user.js';

export type ApprovalView = {
  id: string;
  status: ApprovalStatus;
  claim: {
    id: string;
    claimNumber: string;
    incidentDate: string;
    claimType: string;
    claimedAmount: string;
    status: ClaimStatus;
    description: string;
  };
  policy: {
    id: string;
    name: string;
    version: string;
    language: string;
    type: string;
  } | null;
  analysis: {
    id: string;
    recommendation: string | null;
    payout: string | null;
    coverage: boolean | null;
    exclusions: unknown;
    anomalies: unknown;
    coverageLimit: string | null;
    deductible: string | null;
    reasoning: string | null;
    evidence: unknown;
  };
  originalRecommendation: OriginalRecommendation;
  reviewer: PublicUser | null;
  reviewedAt: string | null;
  comment: string | null;
  finalDecision: HumanDecision | null;
  finalPayout: string | null;
  editedFields: EditedFields | null;
  audits: ApprovalAuditView[];
  createdAt: string;
  updatedAt: string;
};

export type ApprovalAuditView = {
  id: string;
  action: ApprovalAuditAction;
  actor: PublicUser | null;
  previousStatus: ApprovalStatus | null;
  newStatus: ApprovalStatus;
  previousDecision: HumanDecision | null;
  newDecision: HumanDecision | null;
  previousPayout: string | null;
  newPayout: string | null;
  comment: string | null;
  createdAt: string;
};

export type ApprovalList = {
  items: ApprovalView[];
  page: number;
  limit: number;
  total: number;
};

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly approvals: ApprovalsRepository,
    private readonly claims: ClaimsRepository,
  ) {}

  async createFromAnalysis(analysis: ClaimAnalysis, claim: Claim): Promise<Approval> {
    const existing = await this.approvals.findLatestByClaimId(claim.id);
    if (existing?.status === ApprovalStatus.Pending) {
      return existing;
    }

    const approval = await this.approvals.create({
      claimId: claim.id,
      analysisId: analysis.id,
      status: ApprovalStatus.Pending,
      originalRecommendation: {
        decision: analysis.recommendation?.decision ?? 'REVIEW',
        payout: analysis.calculatedPayout,
        reasoning: analysis.recommendation?.reasoning ?? analysis.aiReasoning,
        analysisId: analysis.id,
      },
    });
    await this.claims.update(claim.id, { status: ClaimStatus.UnderReview });
    return approval;
  }

  async findPage(
    query: { page?: number; limit?: number; status?: ApprovalStatus },
    actor: ClaimActor,
  ): Promise<ApprovalList> {
    this.requireReviewer(actor);
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const result = await this.approvals.findPage({
      page,
      limit,
      status: query.status ?? ApprovalStatus.Pending,
    });
    const items = await Promise.all(
      result.items.map(async (approval) => {
        const audits = await this.approvals.listAudits(approval.id);
        return toView(approval, audits);
      }),
    );
    return { items, page, limit, total: result.total };
  }

  async findById(id: string, actor: ClaimActor): Promise<ApprovalView> {
    this.requireReviewer(actor);
    const approval = await this.approvals.findById(id);
    if (!approval) {
      throw new NotFoundException('APPROVAL_NOT_FOUND');
    }
    const audits = await this.approvals.listAudits(approval.id);
    return toView(approval, audits);
  }

  async approve(id: string, actor: ClaimActor): Promise<ApprovalView> {
    this.requireReviewer(actor);
    const approval = await this.requirePending(id);
    const payout = decimal(approval.originalRecommendation.payout ?? approval.analysis.calculatedPayout ?? '0');
    return this.decide(approval, actor, {
      status: ApprovalStatus.Approved,
      decision: 'APPROVE',
      finalDecision: 'APPROVE',
      finalPayout: payout,
      comment: null,
      editedFields: null,
      auditAction: ApprovalAuditAction.Approved,
      claimStatus: ClaimStatus.Approved,
    });
  }

  async reject(id: string, comment: string, actor: ClaimActor): Promise<ApprovalView> {
    this.requireReviewer(actor);
    const reason = assertComment(comment);
    const approval = await this.requirePending(id);
    return this.decide(approval, actor, {
      status: ApprovalStatus.Rejected,
      decision: 'REJECT',
      finalDecision: 'REJECT',
      finalPayout: '0.00',
      comment: reason,
      editedFields: null,
      auditAction: ApprovalAuditAction.Rejected,
      claimStatus: ClaimStatus.Rejected,
    });
  }

  async editAndApprove(
    id: string,
    input: { finalDecision: HumanDecision; finalPayout?: number; comment: string },
    actor: ClaimActor,
  ): Promise<ApprovalView> {
    this.requireReviewer(actor);
    const reason = assertComment(input.comment);
    const approval = await this.requirePending(id);
    const finalDecision = input.finalDecision;
    if (finalDecision === 'APPROVE' && input.finalPayout === undefined) {
      throw new BadRequestException('INVALID_FINAL_PAYOUT');
    }
    const finalPayout =
      finalDecision === 'REJECT' ? '0.00' : validateFinalPayout(input.finalPayout, approval);

    return this.decide(approval, actor, {
      status: ApprovalStatus.EditedAndApproved,
      decision: finalDecision,
      finalDecision,
      finalPayout,
      comment: reason,
      editedFields: {
        finalDecision,
        finalPayout,
      },
      auditAction: ApprovalAuditAction.EditedAndApproved,
      claimStatus: finalDecision === 'APPROVE' ? ClaimStatus.Approved : ClaimStatus.Rejected,
    });
  }

  private async decide(
    approval: Approval,
    actor: ClaimActor,
    input: {
      status: ApprovalStatus;
      decision: HumanDecision;
      finalDecision: HumanDecision;
      finalPayout: string;
      comment: string | null;
      editedFields: EditedFields | null;
      auditAction: ApprovalAuditAction;
      claimStatus: ClaimStatus;
    },
  ): Promise<ApprovalView> {
    try {
      const saved = await this.approvals.applyDecision({
        approvalId: approval.id,
        expectedVersion: approval.version,
        status: input.status,
        decision: input.decision,
        finalDecision: input.finalDecision,
        finalPayout: input.finalPayout,
        comment: input.comment,
        editedFields: input.editedFields,
        reviewedBy: actor.id,
        claimId: approval.claimId,
        claimStatus: input.claimStatus,
        audit: {
          action: input.auditAction,
          previousStatus: approval.status,
          previousDecision: approval.finalDecision,
          previousPayout: approval.originalRecommendation.payout,
          newPayout: input.finalPayout,
          comment: input.comment,
        },
      });
      const audits = await this.approvals.listAudits(saved.id);
      return toView(saved, audits);
    } catch (error) {
      if (error instanceof ApprovalNotPendingError) {
        throw new ConflictException('APPROVAL_NOT_PENDING');
      }
      throw error;
    }
  }

  private async requirePending(id: string): Promise<Approval> {
    const approval = await this.approvals.findById(id);
    if (!approval) {
      throw new NotFoundException('APPROVAL_NOT_FOUND');
    }
    if (!approval.analysis) {
      throw new NotFoundException('CLAIM_ANALYSIS_NOT_FOUND');
    }
    if (approval.status !== ApprovalStatus.Pending) {
      throw new ConflictException('APPROVAL_NOT_PENDING');
    }
    return approval;
  }

  private requireReviewer(actor: ClaimActor): void {
    if (actor.role !== UserRole.Admin) {
      throw new ForbiddenException('UNAUTHORIZED_REVIEWER');
    }
  }
}

function validateFinalPayout(value: number | undefined, approval: Approval): string {
  if (value === undefined || !Number.isFinite(value)) {
    throw new BadRequestException('INVALID_FINAL_PAYOUT');
  }
  if (value < 0) {
    throw new BadRequestException('INVALID_FINAL_PAYOUT');
  }
  const text = value.toFixed(2);
  if (Math.abs(Number(text) - value) > 1e-6) {
    throw new BadRequestException('INVALID_FINAL_PAYOUT');
  }
  const claimed = Number(approval.claim?.claimedAmount ?? approval.analysis.claimedAmount);
  const limit = approval.analysis.coverageLimit ? Number(approval.analysis.coverageLimit) : claimed;
  const maxCovered = Math.min(claimed, limit);
  if (Number(text) > maxCovered + 1e-6) {
    throw new BadRequestException('INVALID_FINAL_PAYOUT');
  }
  return text;
}

function assertComment(comment: string): string {
  const reason = comment?.trim() ?? '';
  if (!reason) {
    throw new BadRequestException('INVALID_REJECTION_REASON');
  }
  return reason;
}

function toView(approval: Approval, audits: ApprovalAudit[]): ApprovalView {
  const claim = approval.claim;
  const analysis = approval.analysis;
  return {
    id: approval.id,
    status: approval.status,
    claim: {
      id: claim.id,
      claimNumber: claim.claimNumber,
      incidentDate: dateOnly(claim.incidentDate),
      claimType: claim.claimType,
      claimedAmount: decimal(claim.claimedAmount),
      status: claim.status,
      description: claim.description,
    },
    policy: claim.policy
      ? {
          id: claim.policy.id,
          name: claim.policy.name,
          version: claim.policy.version,
          language: claim.policy.language,
          type: claim.policy.type,
        }
      : null,
    analysis: {
      id: analysis.id,
      recommendation: analysis.recommendation?.decision ?? null,
      payout: analysis.calculatedPayout ? decimal(analysis.calculatedPayout) : null,
      coverage: analysis.coverageResult?.covered ?? null,
      exclusions: analysis.exclusions,
      anomalies: analysis.anomalies,
      coverageLimit: analysis.coverageLimit ? decimal(analysis.coverageLimit) : null,
      deductible: analysis.deductible ? decimal(analysis.deductible) : null,
      reasoning: analysis.recommendation?.reasoning ?? analysis.aiReasoning,
      evidence: analysis.citations ?? [],
    },
    originalRecommendation: approval.originalRecommendation,
    reviewer: approval.reviewer ? toPublicUser(approval.reviewer) : null,
    reviewedAt: approval.reviewedAt ? new Date(approval.reviewedAt).toISOString() : null,
    comment: approval.comment,
    finalDecision: approval.finalDecision,
    finalPayout: approval.finalPayout ? decimal(approval.finalPayout) : null,
    editedFields: approval.editedFields,
    audits: audits.map((audit) => ({
      id: audit.id,
      action: audit.action,
      actor: audit.actor ? toPublicUser(audit.actor) : null,
      previousStatus: audit.previousStatus,
      newStatus: audit.newStatus,
      previousDecision: audit.previousDecision,
      newDecision: audit.newDecision,
      previousPayout: audit.previousPayout ? decimal(audit.previousPayout) : null,
      newPayout: audit.newPayout ? decimal(audit.newPayout) : null,
      comment: audit.comment,
      createdAt: new Date(audit.createdAt).toISOString(),
    })),
    createdAt: new Date(approval.createdAt).toISOString(),
    updatedAt: new Date(approval.updatedAt).toISOString(),
  };
}

function decimal(value: string | number): string {
  return Number(value).toFixed(2);
}

function dateOnly(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}
