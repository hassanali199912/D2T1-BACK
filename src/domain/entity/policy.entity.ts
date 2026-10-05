import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { PolicyLanguage } from '../policy-language.js';
import { PolicyType } from '../policy-type.js';

@Entity('policies')
@Unique('uq_policies_name_version_language', ['name', 'version', 'language'])
export class Policy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'enum', enum: PolicyType, enumName: 'policy_type' })
  type: PolicyType;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 20 })
  version: string;

  @Column({ type: 'enum', enum: PolicyLanguage, enumName: 'policy_language' })
  language: PolicyLanguage;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: string;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo: string | null;

  @Column({ name: 'document_url', type: 'text' })
  documentUrl: string;
}
