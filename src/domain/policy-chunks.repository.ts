import { PolicyChunk } from './entity/policy-chunk.entity.js';
import { PolicyLanguage } from './policy-language.js';

export type NewPolicyChunk = {
  policyId: string;
  chunkIndex: number;
  content: string;
  pageNumber: number;
  section: string | null;
  language: PolicyLanguage;
  tokenCount: number;
  contentHash: string;
};

export abstract class PolicyChunksRepository {
  abstract replace(policyId: string, chunks: NewPolicyChunk[]): Promise<PolicyChunk[]>;
  abstract deleteByPolicyId(policyId: string): Promise<void>;
}
