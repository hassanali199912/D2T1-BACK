import { ApprovalAuditAction, ApprovalStatus, EditedFields, HumanDecision, OriginalRecommendation } from './approval-status.js';
import { ClaimStatus } from './claim-status.js';
import { Approval } from './entity/approval.entity.js';
import { ApprovalAudit } from './entity/approval-audit.entity.js';

export type NewApproval = {
  claimId: string;
  analysisId: string;
  status: ApprovalStatus;
  originalRecommendation: OriginalRecommendation;
};

export type ApprovalPageQuery = {
  page: number;
  limit: number;
  status?: ApprovalStatus;
};

export type ApprovalPage = {
  items: Approval[];
  total: number;
};

export type ApplyDecisionInput = {
  approvalId: string;
  expectedVersion: number;
  status: ApprovalStatus;
  decision: HumanDecision;
  finalDecision: HumanDecision;
  finalPayout: string;
  comment: string | null;
  editedFields: EditedFields | null;
  reviewedBy: string;
  claimId: string;
  claimStatus: ClaimStatus;
  audit: {
    action: ApprovalAuditAction;
    previousStatus: ApprovalStatus;
    previousDecision: HumanDecision | null;
    previousPayout: string | null;
    newPayout: string;
    comment: string | null;
  };
};

export abstract class ApprovalsRepository {
  abstract create(approval: NewApproval): Promise<Approval>;
  abstract findById(id: string): Promise<Approval | null>;
  abstract findLatestByClaimId(claimId: string): Promise<Approval | null>;
  abstract findPage(query: ApprovalPageQuery): Promise<ApprovalPage>;
  abstract listAudits(approvalId: string): Promise<ApprovalAudit[]>;
  abstract applyDecision(input: ApplyDecisionInput): Promise<Approval>;
}
