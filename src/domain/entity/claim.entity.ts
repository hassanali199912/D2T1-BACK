import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ClaimStatus } from '../claim-status.js';
import { ClaimType } from '../claim-type.js';
import { User } from './user.entity.js';
import { Policy } from './policy.entity.js';

@Entity('claims')
@Check('ck_claims_claimed_amount_positive', 'claimed_amount > 0')
@Index('claims_status', ['status'])
@Index('claims_incident_date', ['incidentDate'])
export class Claim {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'claim_number', type: 'varchar', length: 20, unique: true })
  claimNumber: string;

  @Index('claims_policy_id')
  @Column({ name: 'policy_id', type: 'uuid' })
  policyId: string;

  @ManyToOne(() => Policy, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'policy_id' })
  policy: Policy;

  @Column({ name: 'incident_date', type: 'date' })
  incidentDate: string;

  @Column({ name: 'claim_type', type: 'enum', enum: ClaimType, enumName: 'claim_type' })
  claimType: ClaimType;

  @Column({ name: 'claimed_amount', type: 'numeric', precision: 14, scale: 2 })
  claimedAmount: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: ClaimStatus, enumName: 'claim_status' })
  status: ClaimStatus;

  @Index('claims_created_by')
  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
