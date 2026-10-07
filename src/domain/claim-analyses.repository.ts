import { AnalysisStatus } from './analysis-status.js';
import {
  AnomalyResult,
  ClaimAnalysis,
  CoverageResult,
  ExclusionResult,
  RecommendationResult,
} from './entity/claim-analysis.entity.js';
import { Citation } from './retrieval.types.js';

export type NewClaimAnalysis = {
  claimId: string;
  policyVersionId: string;
  status: AnalysisStatus;
  errorCode: string | null;
  coverageResult: CoverageResult | null;
  exclusions: ExclusionResult | null;
  anomalies: AnomalyResult | null;
  coverageLimit: string | null;
  deductible: string | null;
  claimedAmount: string;
  calculatedPayout: string | null;
  recommendation: RecommendationResult | null;
  aiReasoning: string | null;
  citations: Citation[] | null;
  promptVersion: string;
};

export abstract class ClaimAnalysesRepository {
  abstract create(analysis: NewClaimAnalysis): Promise<ClaimAnalysis>;
  abstract findLatestByClaimId(claimId: string): Promise<ClaimAnalysis | null>;
}
