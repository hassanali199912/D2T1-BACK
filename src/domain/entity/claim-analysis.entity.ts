import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AnalysisDecision, AnalysisStatus } from '../analysis-status.js';
import { Citation } from '../retrieval.types.js';
import { Claim } from './claim.entity.js';
import { Policy } from './policy.entity.js';

export type CoverageResult = {
  covered: boolean;
  reasoning: string;
};

export type ExclusionResult = {
  applicable: boolean;
  items: { name: string; reasoning: string }[];
};

export type AnomalyResult = {
  detected: boolean;
  items: string[];
};

export type RecommendationResult = {
  decision: AnalysisDecision;
  reasoning: string;
};

@Entity('claim_analyses')
@Index('claim_analyses_claim_id_created_at', ['claimId', 'createdAt'])
export class ClaimAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'claim_id', type: 'uuid' })
  claimId: string;

  @ManyToOne(() => Claim, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'claim_id' })
  claim: Claim;

  @Column({ name: 'policy_version_id', type: 'uuid' })
  policyVersionId: string;

  @ManyToOne(() => Policy, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'policy_version_id' })
  policyVersion: Policy;

  @Column({ type: 'enum', enum: AnalysisStatus, enumName: 'claim_analysis_status' })
  status: AnalysisStatus;

  @Column({ name: 'error_code', type: 'varchar', length: 80, nullable: true })
  errorCode: string | null;

  @Column({ name: 'coverage_result', type: 'jsonb', nullable: true })
  coverageResult: CoverageResult | null;

  @Column({ type: 'jsonb', nullable: true })
  exclusions: ExclusionResult | null;

  @Column({ type: 'jsonb', nullable: true })
  anomalies: AnomalyResult | null;

  @Column({ name: 'coverage_limit', type: 'numeric', precision: 14, scale: 2, nullable: true })
  coverageLimit: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  deductible: string | null;

  @Column({ name: 'claimed_amount', type: 'numeric', precision: 14, scale: 2 })
  claimedAmount: string;

  @Column({ name: 'calculated_payout', type: 'numeric', precision: 14, scale: 2, nullable: true })
  calculatedPayout: string | null;

  @Column({ type: 'jsonb', nullable: true })
  recommendation: RecommendationResult | null;

  @Column({ name: 'ai_reasoning', type: 'text', nullable: true })
  aiReasoning: string | null;

  @Column({ type: 'jsonb', nullable: true })
  citations: Citation[] | null;

  @Column({ name: 'prompt_version', type: 'varchar', length: 40 })
  promptVersion: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
