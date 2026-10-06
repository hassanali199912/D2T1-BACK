import { createHash } from 'crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PoliciesRepository } from '../domain/policies.repository.js';
import { PolicyChunksRepository } from '../domain/policy-chunks.repository.js';
import { PolicyIndexStage, PolicyIndexStatus } from '../domain/policy-index-status.js';
import { DocumentExtractor } from '../domain/document-extractor.js';
import { TextCleaner } from '../domain/text-cleaner.js';
import { DocumentChunker } from '../domain/document-chunker.js';
import { EmbeddingProvider } from '../domain/embedding-provider.js';
import { VectorStore } from '../domain/vector-store.js';
import { files } from '../infrastructure/files.js';
import { chunkingOptionsFromEnv } from '../infrastructure/section-aware-chunker.js';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly policiesRepository: PoliciesRepository,
    private readonly chunksRepository: PolicyChunksRepository,
    private readonly extractor: DocumentExtractor,
    private readonly cleaner: TextCleaner,
    private readonly chunker: DocumentChunker,
    private readonly embeddings: EmbeddingProvider,
    private readonly vectorStore: VectorStore,
  ) {}

  async ingest(policyId: string): Promise<void> {
    let stage = PolicyIndexStage.Extracting;

    try {
      const policy = await this.policiesRepository.findById(policyId);
      if (!policy) {
        throw new NotFoundException('Policy not found');
      }

      await this.mark(policyId, PolicyIndexStatus.Processing, stage);
      const extracted = await this.extractor.extract(files.absolutePathFromUrl(policy.documentUrl));

      stage = PolicyIndexStage.Cleaning;
      await this.mark(policyId, PolicyIndexStatus.Processing, stage);
      const cleaned = this.cleaner.clean(extracted);

      stage = PolicyIndexStage.Chunking;
      await this.mark(policyId, PolicyIndexStatus.Processing, stage);
      const candidates = this.chunker.chunk(cleaned, chunkingOptionsFromEnv(), policy.language);

      stage = PolicyIndexStage.Embedding;
      await this.mark(policyId, PolicyIndexStatus.Processing, stage);
      const vectors = await this.embeddings.embedTexts(candidates.map((candidate) => candidate.content));
      if (vectors.length !== candidates.length) {
        throw new Error('Embedding provider returned an unexpected number of vectors');
      }

      stage = PolicyIndexStage.Indexing;
      await this.mark(policyId, PolicyIndexStatus.Processing, stage);
      await this.vectorStore.deleteByPolicyId(policyId);
      const saved = await this.chunksRepository.replace(
        policyId,
        candidates.map((candidate) => ({
          policyId,
          chunkIndex: candidate.chunkIndex,
          content: candidate.content,
          pageNumber: candidate.pageNumber,
          section: candidate.section,
          language: candidate.language,
          tokenCount: candidate.tokenCount,
          contentHash: createHash('sha256').update(candidate.content).digest('hex'),
        })),
      );
      await this.vectorStore.upsert(
        saved.map((chunk, index) => ({
          id: chunk.id,
          policyId,
          embedding: vectors[index] ?? [],
        })),
      );

      await this.policiesRepository.updateIndexState(policyId, {
        status: PolicyIndexStatus.Indexed,
        currentStage: null,
        errorCode: null,
        errorMessage: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Policy ingestion failed';
      await this.policiesRepository.updateIndexState(policyId, {
        status: PolicyIndexStatus.Failed,
        currentStage: stage,
        errorCode: `${stage}_FAILED`,
        errorMessage: message,
      });
      this.logger.error(message, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async clear(policyId: string): Promise<void> {
    await this.vectorStore.deleteByPolicyId(policyId);
    await this.chunksRepository.deleteByPolicyId(policyId);
  }

  private mark(policyId: string, status: PolicyIndexStatus, stage: PolicyIndexStage): Promise<void> {
    return this.policiesRepository.updateIndexState(policyId, {
      status,
      currentStage: stage,
      errorCode: null,
      errorMessage: null,
    });
  }
}
