import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ApprovalsService } from './approvals.service.js';
import { ApprovalAuditAction, ApprovalStatus } from '../domain/approval-status.js';
import { ApprovalNotPendingError } from '../domain/approval-not-pending.error.js';
import {
  ApplyDecisionInput,
  ApprovalPage,
  ApprovalPageQuery,
  ApprovalsRepository,
  NewApproval,
} from '../domain/approvals.repository.js';
import { ClaimStatus } from '../domain/claim-status.js';
import { ClaimType } from '../domain/claim-type.js';
import { ClaimPage, ClaimPageQuery, ClaimsRepository, ClaimUpdate, NewClaim } from '../domain/claims.repository.js';
import { Approval } from '../domain/entity/approval.entity.js';
import { ApprovalAudit } from '../domain/entity/approval-audit.entity.js';
import { ClaimAnalysis } from '../domain/entity/claim-analysis.entity.js';
import { Claim } from '../domain/entity/claim.entity.js';
import { Policy } from '../domain/entity/policy.entity.js';
import { User, UserRole } from '../domain/entity/user.entity.js';
import { AnalysisStatus } from '../domain/analysis-status.js';
import { PolicyIndexStatus } from '../domain/policy-index-status.js';
import { PolicyLanguage } from '../domain/policy-language.js';
import { PolicyType } from '../domain/policy-type.js';

const admin = { id: 'admin-1', role: UserRole.Admin };
const employee = { id: 'employee-1', role: UserRole.Employee };

describe('ApprovalsService', () => {
  let approvals: MemoryApprovals;
  let claims: MemoryClaims;
  let service: ApprovalsService;

  beforeEach(() => {
    claims = new MemoryClaims();
    approvals = new MemoryApprovals(claims);
    service = new ApprovalsService(approvals, claims);
  });

  it('opens a pending approval and moves the claim to under review', async () => {
    const claim = sampleClaim();
    const analysis = sampleAnalysis();

    const created = await service.createFromAnalysis(analysis, claim);

    expect(created.status).toBe(ApprovalStatus.Pending);
    expect(created.originalRecommendation.payout).toBe('50000.00');
    expect(claims.statuses.get(claim.id)).toBe(ClaimStatus.UnderReview);
    expect(approvals.audits).toHaveLength(1);
    expect(approvals.audits[0]?.action).toBe(ApprovalAuditAction.Created);
  });

  it('reuses an existing pending approval', async () => {
    const claim = sampleClaim();
    const analysis = sampleAnalysis();
    const first = await service.createFromAnalysis(analysis, claim);
    const second = await service.createFromAnalysis(analysis, claim);

    expect(second.id).toBe(first.id);
    expect(approvals.rows).toHaveLength(1);
  });

  it('approves a pending request and records an audit', async () => {
    const pending = await openPending();
    const result = await service.approve(pending.id, admin);

    expect(result.status).toBe(ApprovalStatus.Approved);
    expect(result.finalDecision).toBe('APPROVE');
    expect(result.finalPayout).toBe('50000.00');
    expect(result.reviewer?.id).toBe(admin.id);
    expect(claims.statuses.get(pending.claimId)).toBe(ClaimStatus.Approved);
    expect(result.audits.some((audit) => audit.action === ApprovalAuditAction.Approved)).toBe(true);
  });

  it('rejects with a required reason', async () => {
    const pending = await openPending();
    await expect(service.reject(pending.id, '   ', admin)).rejects.toBeInstanceOf(BadRequestException);

    const result = await service.reject(pending.id, 'Description does not match.', admin);
    expect(result.status).toBe(ApprovalStatus.Rejected);
    expect(result.finalPayout).toBe('0.00');
    expect(result.comment).toBe('Description does not match.');
    expect(claims.statuses.get(pending.claimId)).toBe(ClaimStatus.Rejected);
  });

  it('edit-and-approve preserves the AI snapshot and stores the human payout', async () => {
    const pending = await openPending();
    const original = { ...pending.originalRecommendation };

    const result = await service.editAndApprove(
      pending.id,
      { finalDecision: 'APPROVE', finalPayout: 45000, comment: 'Adjusted after review.' },
      admin,
    );

    expect(result.status).toBe(ApprovalStatus.EditedAndApproved);
    expect(result.originalRecommendation).toEqual(original);
    expect(result.finalPayout).toBe('45000.00');
    expect(result.editedFields?.finalPayout).toBe('45000.00');
  });

  it('rejects a human payout above the covered amount', async () => {
    const pending = await openPending();
    await expect(
      service.editAndApprove(
        pending.id,
        { finalDecision: 'APPROVE', finalPayout: 100000, comment: 'Too high.' },
        admin,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks employees from the approval queue', async () => {
    await expect(service.findPage({}, employee)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a second decision on the same approval', async () => {
    const pending = await openPending();
    await service.approve(pending.id, admin);
    await expect(service.approve(pending.id, admin)).rejects.toBeInstanceOf(ConflictException);
  });

  async function openPending(): Promise<Approval> {
    return service.createFromAnalysis(sampleAnalysis(), sampleClaim());
  }
});

class MemoryApprovals extends ApprovalsRepository {
  rows: Approval[] = [];
  audits: ApprovalAudit[] = [];

  constructor(private readonly claims: MemoryClaims) {
    super();
  }

  create(input: NewApproval): Promise<Approval> {
    const approval = {
      id: `approval-${this.rows.length + 1}`,
      claimId: input.claimId,
      analysisId: input.analysisId,
      status: input.status,
      originalRecommendation: input.originalRecommendation,
      reviewedBy: null,
      reviewedAt: null,
      decision: null,
      comment: null,
      finalDecision: null,
      finalPayout: null,
      editedFields: null,
      version: 1,
      createdAt: new Date('2026-08-16T00:00:00.000Z'),
      updatedAt: new Date('2026-08-16T00:00:00.000Z'),
      claim: sampleClaim(),
      analysis: sampleAnalysis(),
      reviewer: null,
    } as Approval;
    this.rows.push(approval);
    this.audits.push({
      id: `audit-${this.audits.length + 1}`,
      approvalId: approval.id,
      action: ApprovalAuditAction.Created,
      actorId: null,
      previousStatus: null,
      newStatus: input.status,
      previousDecision: null,
      newDecision: null,
      previousPayout: null,
      newPayout: input.originalRecommendation.payout,
      comment: null,
      createdAt: new Date('2026-08-16T00:00:00.000Z'),
      actor: null,
    } as ApprovalAudit);
    return Promise.resolve(approval);
  }

  findById(id: string): Promise<Approval | null> {
    return Promise.resolve(this.rows.find((row) => row.id === id) ?? null);
  }

  findLatestByClaimId(claimId: string): Promise<Approval | null> {
    return Promise.resolve([...this.rows].reverse().find((row) => row.claimId === claimId) ?? null);
  }

  findPage(query: ApprovalPageQuery): Promise<ApprovalPage> {
    const items = this.rows.filter((row) => !query.status || row.status === query.status);
    return Promise.resolve({ items, total: items.length });
  }

  listAudits(approvalId: string): Promise<ApprovalAudit[]> {
    return Promise.resolve(this.audits.filter((audit) => audit.approvalId === approvalId));
  }

  applyDecision(input: ApplyDecisionInput): Promise<Approval> {
    const approval = this.rows.find((row) => row.id === input.approvalId);
    if (!approval || approval.status !== ApprovalStatus.Pending || approval.version !== input.expectedVersion) {
      return Promise.reject(new ApprovalNotPendingError());
    }
    approval.status = input.status;
    approval.decision = input.decision;
    approval.finalDecision = input.finalDecision;
    approval.finalPayout = input.finalPayout;
    approval.comment = input.comment;
    approval.editedFields = input.editedFields;
    approval.reviewedBy = input.reviewedBy;
    approval.reviewedAt = new Date('2026-08-16T01:00:00.000Z');
    approval.reviewer = sampleUser(input.reviewedBy);
    approval.version += 1;
    approval.claim.status = input.claimStatus;
    this.claims.statuses.set(input.claimId, input.claimStatus);
    this.audits.push({
      id: `audit-${this.audits.length + 1}`,
      approvalId: approval.id,
      action: input.audit.action,
      actorId: input.reviewedBy,
      previousStatus: input.audit.previousStatus,
      newStatus: input.status,
      previousDecision: input.audit.previousDecision,
      newDecision: input.finalDecision,
      previousPayout: input.audit.previousPayout,
      newPayout: input.audit.newPayout,
      comment: input.audit.comment,
      createdAt: new Date('2026-08-16T01:00:00.000Z'),
      actor: sampleUser(input.reviewedBy),
    } as ApprovalAudit);
    return Promise.resolve(approval);
  }
}

class MemoryClaims extends ClaimsRepository {
  statuses = new Map<string, ClaimStatus>();

  create(_claim: NewClaim): Promise<Claim> {
    return Promise.reject(new Error('not used'));
  }

  update(id: string, update: ClaimUpdate): Promise<Claim> {
    if (update.status) {
      this.statuses.set(id, update.status);
    }
    return Promise.resolve(sampleClaim(update.status));
  }

  findById(id: string): Promise<Claim | null> {
    return Promise.resolve(id === 'claim-1' ? sampleClaim(this.statuses.get(id)) : null);
  }

  findPage(_query: ClaimPageQuery): Promise<ClaimPage> {
    return Promise.resolve({ items: [], total: 0 });
  }

  nextClaimNumber(): Promise<string> {
    return Promise.resolve('CLM-000001');
  }
}

function sampleClaim(status: ClaimStatus = ClaimStatus.Submitted): Claim {
  return {
    id: 'claim-1',
    claimNumber: 'CLM-000001',
    policyId: 'policy-1',
    policy: samplePolicy(),
    incidentDate: '2026-08-15',
    claimType: ClaimType.Collision,
    claimedAmount: '80000.00',
    description: 'Collision at an intersection.',
    status,
    createdBy: 'employee-1',
    createdAt: new Date('2026-08-15T00:00:00.000Z'),
    updatedAt: new Date('2026-08-15T00:00:00.000Z'),
  } as Claim;
}

function sampleAnalysis(): ClaimAnalysis {
  return {
    id: 'analysis-1',
    claimId: 'claim-1',
    policyVersionId: 'policy-1',
    status: AnalysisStatus.Completed,
    errorCode: null,
    coverageResult: { covered: true, reasoning: 'Covered.' },
    exclusions: { applicable: false, items: [] },
    anomalies: { detected: false, items: [] },
    coverageLimit: '60000.00',
    deductible: '10000.00',
    claimedAmount: '80000.00',
    calculatedPayout: '50000.00',
    recommendation: { decision: 'APPROVE', reasoning: 'Covered collision.' },
    aiReasoning: 'Covered.',
    citations: [],
    promptVersion: 'claim-analysis.v1',
    createdAt: new Date('2026-08-15T00:00:00.000Z'),
    updatedAt: new Date('2026-08-15T00:00:00.000Z'),
  } as ClaimAnalysis;
}

function samplePolicy(): Policy {
  return {
    id: 'policy-1',
    name: 'Motor',
    type: PolicyType.MOTOR,
    description: null,
    version: '3',
    language: PolicyLanguage.EN,
    effectiveFrom: '2026-01-01',
    effectiveTo: '2027-01-01',
    documentUrl: '/uploads/motor.pdf',
    status: PolicyIndexStatus.Indexed,
    currentStage: null,
    errorCode: null,
    errorMessage: null,
  };
}

function sampleUser(id: string): User {
  return {
    id,
    name: 'Admin',
    email: 'admin@example.com',
    password: 'hashed',
    role: UserRole.Admin,
  };
}
