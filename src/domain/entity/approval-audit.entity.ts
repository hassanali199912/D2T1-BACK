import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ApprovalAuditAction } from '../approval-status.js';
import type { ApprovalStatus, HumanDecision } from '../approval-status.js';
import { Approval } from './approval.entity.js';
import { User } from './user.entity.js';

@Entity('approval_audits')
@Index('approval_audits_approval_id', ['approvalId'])
export class ApprovalAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'approval_id', type: 'uuid' })
  approvalId: string;

  @ManyToOne(() => Approval, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'approval_id' })
  approval: Approval;

  @Column({ type: 'enum', enum: ApprovalAuditAction, enumName: 'approval_audit_action' })
  action: ApprovalAuditAction;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'actor_id' })
  actor: User | null;

  @Column({ name: 'previous_status', type: 'varchar', length: 40, nullable: true })
  previousStatus: ApprovalStatus | null;

  @Column({ name: 'new_status', type: 'varchar', length: 40 })
  newStatus: ApprovalStatus;

  @Column({ name: 'previous_decision', type: 'varchar', length: 20, nullable: true })
  previousDecision: HumanDecision | null;

  @Column({ name: 'new_decision', type: 'varchar', length: 20, nullable: true })
  newDecision: HumanDecision | null;

  @Column({ name: 'previous_payout', type: 'numeric', precision: 14, scale: 2, nullable: true })
  previousPayout: string | null;

  @Column({ name: 'new_payout', type: 'numeric', precision: 14, scale: 2, nullable: true })
  newPayout: string | null;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
