import { Policy } from '../domain/entity/policy.entity.js';
import { PolicyChunk } from '../domain/entity/policy-chunk.entity.js';
import { NewPolicyChunk, PolicyChunksRepository } from '../domain/policy-chunks.repository.js';
import { PoliciesRepository, PolicyIdentity, PolicyIndexUpdate } from '../domain/policies.repository.js';
import { PolicyIndexStage, PolicyIndexStatus } from '../domain/policy-index-status.js';
import { PolicyLanguage } from '../domain/policy-language.js';
import { EmbeddingProvider } from '../domain/embedding-provider.js';
import { DocumentExtractor } from '../domain/document-extractor.js';
import { ExtractedDocument } from '../domain/extracted-document.js';
import { VectorChunk, VectorSearchHit, VectorStore } from '../domain/vector-store.js';
import { SectionAwareChunker } from '../infrastructure/section-aware-chunker.js';
import { WhitespaceTextCleaner } from '../infrastructure/whitespace-text.cleaner.js';
import { IngestionService } from './ingestion.service.js';

class MemoryPolicies extends PoliciesRepository {
  policy: Policy = {
    id: 'policy-1',
    name: 'Health Cover',
    type: 'HEALTH',
    description: null,
    version: '1.0',
    language: PolicyLanguage.EN,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    documentUrl: '/uploads/doc.pdf',
    status: PolicyIndexStatus.Uploaded,
    currentStage: null,
    errorCode: null,
    errorMessage: null,
  } as Policy;

  create(): Promise<Policy> {
    return Promise.resolve(this.policy);
  }

  findAll(): Promise<Policy[]> {
    return Promise.resolve([this.policy]);
  }

  findById(id: string): Promise<Policy | null> {
    return Promise.resolve(this.policy.id === id ? this.policy : null);
  }

  findByIdentity(_identity: PolicyIdentity): Promise<Policy | null> {
    return Promise.resolve(null);
  }

  deleteById(): Promise<void> {
    return Promise.resolve();
  }

  async updateIndexState(id: string, update: PolicyIndexUpdate): Promise<void> {
    if (this.policy.id === id) {
      Object.assign(this.policy, update);
    }
  }
}

class MemoryChunks extends PolicyChunksRepository {
  rows: PolicyChunk[] = [];

  async replace(_policyId: string, chunks: NewPolicyChunk[]): Promise<PolicyChunk[]> {
    this.rows = chunks.map((chunk) => ({ ...chunk, id: `chunk-${chunk.chunkIndex}` }) as PolicyChunk);
    return this.rows;
  }

  async deleteByPolicyId(policyId: string): Promise<void> {
    this.rows = this.rows.filter((row) => row.policyId !== policyId);
  }
}

class FakeExtractor extends DocumentExtractor {
  supports(): boolean {
    return true;
  }

  extract(): Promise<ExtractedDocument> {
    return Promise.resolve({
      pages: [
        {
          pageNumber: 2,
          text: 'Section 1 Collision Coverage\n\nDeductible 500 on 2026-01-01',
        },
      ],
      metadata: { pageCount: 1 },
    });
  }
}

class FakeEmbeddings extends EmbeddingProvider {
  readonly dimensions = 3;
  calls = 0;

  embedTexts(texts: string[]): Promise<number[][]> {
    this.calls += 1;
    return Promise.resolve(texts.map((_, index) => [index, 0.2, 0.3]));
  }
}

class FailingEmbeddings extends EmbeddingProvider {
  readonly dimensions = 3;

  embedTexts(): Promise<number[][]> {
    return Promise.reject(new Error('embedding down'));
  }
}

class MemoryVectors extends VectorStore {
  deleted: string[] = [];
  stored: VectorChunk[] = [];

  async upsert(chunks: VectorChunk[]): Promise<void> {
    this.stored = chunks;
  }

  async deleteByPolicyId(policyId: string): Promise<void> {
    this.deleted.push(policyId);
    this.stored = this.stored.filter((chunk) => chunk.policyId !== policyId);
  }

  search(): Promise<VectorSearchHit[]> {
    return Promise.resolve([]);
  }
}

function service(
  policies: MemoryPolicies,
  chunks: MemoryChunks,
  vectors: MemoryVectors,
  embeddings: EmbeddingProvider,
): IngestionService {
  return new IngestionService(
    policies,
    chunks,
    new FakeExtractor(),
    new WhitespaceTextCleaner(),
    new SectionAwareChunker(),
    embeddings,
    vectors,
  );
}

describe('IngestionService', () => {
  it('indexes a policy once and replaces chunks on a second run', async () => {
    const policies = new MemoryPolicies();
    const chunks = new MemoryChunks();
    const vectors = new MemoryVectors();
    const embeddings = new FakeEmbeddings();
    const ingestion = service(policies, chunks, vectors, embeddings);

    await ingestion.ingest('policy-1');
    await ingestion.ingest('policy-1');

    expect(policies.policy.status).toBe(PolicyIndexStatus.Indexed);
    expect(policies.policy.errorMessage).toBeNull();
    expect(new Set(chunks.rows.map((row) => row.chunkIndex)).size).toBe(chunks.rows.length);
    expect(chunks.rows.every((row) => row.pageNumber === 2)).toBe(true);
    expect(chunks.rows.some((row) => row.content.includes('500'))).toBe(true);
    expect(vectors.stored).toHaveLength(chunks.rows.length);
    expect(embeddings.calls).toBe(2);
  });

  it('stores a failed embedding on the policy', async () => {
    const policies = new MemoryPolicies();
    const ingestion = service(policies, new MemoryChunks(), new MemoryVectors(), new FailingEmbeddings());

    await expect(ingestion.ingest('policy-1')).rejects.toThrow('embedding down');
    expect(policies.policy.status).toBe(PolicyIndexStatus.Failed);
    expect(policies.policy.currentStage).toBe(PolicyIndexStage.Embedding);
    expect(policies.policy.errorCode).toBe('EMBEDDING_FAILED');
    expect(policies.policy.errorMessage).toBe('embedding down');
  });
});
