export enum AnalysisStatus {
  Pending = 'PENDING',
  Analyzing = 'ANALYZING',
  Completed = 'COMPLETED',
  InsufficientEvidence = 'INSUFFICIENT_EVIDENCE',
  Failed = 'FAILED',
}

export type AnalysisDecision = 'APPROVE' | 'REJECT' | 'REVIEW';
