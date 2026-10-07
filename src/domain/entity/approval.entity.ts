import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { ApprovalStatus } from '../approval-status.js';
import type { EditedFields, HumanDecision, OriginalRecommendation } from '../approval-status.js';
import { ClaimAnalysis } from './claim-analysis.entity.js';
import { Claim } from './claim.entity.js';
import { User } from './user.entity.js';

@Entity('approvals')
@Index('approvals_claim_id', ['claimId'])
@Index('approvals_status', ['status'])
export class Approval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'claim_id', type: 'uuid' })
  claimId: string;

  @ManyToOne(() => Claim, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'claim_id' })
  claim: Claim;

  @Column({ name: 'analysis_id', type: 'uuid' })
  analysisId: string;

  @ManyToOne(() => ClaimAnalysis, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'analysis_id' })
  analysis: ClaimAnalysis;

  @Column({ type: 'enum', enum: ApprovalStatus, enumName: 'approval_status' })
  status: ApprovalStatus;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer: User | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  decision: HumanDecision | null;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ name: 'original_recommendation', type: 'jsonb' })
  originalRecommendation: OriginalRecommendation;

  @Column({ name: 'final_decision', type: 'varchar', length: 20, nullable: true })
  finalDecision: HumanDecision | null;

  @Column({ name: 'final_payout', type: 'numeric', precision: 14, scale: 2, nullable: true })
  finalPayout: string | null;

  @Column({ name: 'edited_fields', type: 'jsonb', nullable: true })
  editedFields: EditedFields | null;

  @VersionColumn()
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
