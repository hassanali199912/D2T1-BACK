export type VectorChunk = {
  id: string;
  policyId: string;
  embedding: number[];
};

export abstract class VectorStore {
  abstract upsert(chunks: VectorChunk[]): Promise<void>;
  abstract deleteByPolicyId(policyId: string): Promise<void>;
}
