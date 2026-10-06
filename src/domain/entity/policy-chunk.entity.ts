import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { PolicyLanguage } from '../policy-language.js';

@Entity('policy_chunks')
@Unique('uq_policy_chunks_policy_index', ['policyId', 'chunkIndex'])
@Index('policy_chunks_content_hash', ['contentHash'])
export class PolicyChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'policy_id', type: 'uuid' })
  policyId: string;

  @Column({ name: 'chunk_index', type: 'int' })
  chunkIndex: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'page_number', type: 'int' })
  pageNumber: number;

  @Column({ type: 'varchar', length: 160, nullable: true })
  section: string | null;

  @Column({ type: 'enum', enum: PolicyLanguage, enumName: 'policy_language' })
  language: PolicyLanguage;

  @Column({ name: 'token_count', type: 'int' })
  tokenCount: number;

  @Column({ name: 'content_hash', type: 'varchar', length: 64 })
  contentHash: string;
}
