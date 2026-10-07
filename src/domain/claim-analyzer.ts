export type AnalysisEvidence = {
  chunkId: string;
  content: string;
  pageNumber: number;
  section: string | null;
  language: string;
  documentId: string;
  documentName: string;
  version: string;
};

export type AnalysisRequest = {
  responseLanguage: 'ar' | 'en';
  claim: {
    claimNumber: string;
    incidentDate: string;
    claimType: string;
    claimedAmount: string;
    description: string;
  };
  policy: {
    policyId: string;
    version: string;
    effectiveFrom: string;
    effectiveTo: string | null;
  };
  evidence: AnalysisEvidence[];
};

export abstract class ClaimAnalyzer {
  abstract analyze(systemPrompt: string, request: AnalysisRequest): Promise<unknown>;
}
