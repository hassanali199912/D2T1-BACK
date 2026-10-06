import { PolicyLanguage } from './policy-language.js';

export type VectorChunk = {
  id: string;
  policyId: string;
  embedding: number[];
};

export type VectorSearchQuery = {
  embedding: number[];
  policyId: string | null;
  language: PolicyLanguage | null;
  limit: number;
};

export type VectorSearchHit = {
  chunkId: string;
  policyId: string;
  content: string;
  chunkIndex: number;
  pageNumber: number;
  section: string | null;
  language: PolicyLanguage;
  documentName: string;
  version: string;
  score: number;
};

export abstract class VectorStore {
  abstract upsert(chunks: VectorChunk[]): Promise<void>;
  abstract deleteByPolicyId(policyId: string): Promise<void>;
  abstract search(query: VectorSearchQuery): Promise<VectorSearchHit[]>;
}
