export enum ApprovalStatus {
  Pending = 'PENDING',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
  EditedAndApproved = 'EDITED_AND_APPROVED',
  Cancelled = 'CANCELLED',
}

export type HumanDecision = 'APPROVE' | 'REJECT';

export enum ApprovalAuditAction {
  Created = 'CREATED',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
  EditedAndApproved = 'EDITED_AND_APPROVED',
}

export type OriginalRecommendation = {
  decision: string;
  payout: string | null;
  reasoning: string | null;
  analysisId: string;
};

export type EditedFields = {
  finalDecision?: HumanDecision;
  finalPayout?: string;
};
