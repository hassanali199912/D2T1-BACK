import { Injectable } from '@nestjs/common';
import { DenseRetriever } from '../domain/dense-retriever.js';
import { EmbeddingProvider } from '../domain/embedding-provider.js';
import { RetrievalFilter, RetrievalResult } from '../domain/retrieval.types.js';
import { VectorStore } from '../domain/vector-store.js';

@Injectable()
export class PgVectorDenseRetriever extends DenseRetriever {
  constructor(
    private readonly embeddings: EmbeddingProvider,
    private readonly vectors: VectorStore,
  ) {
    super();
  }

  async retrieve(query: string, filter: RetrievalFilter, limit: number): Promise<RetrievalResult[]> {
    if (!query.trim() || limit <= 0) {
      return [];
    }

    const [embedding] = await this.embeddings.embedTexts([query]);
    if (!embedding) {
      return [];
    }

    const hits = await this.vectors.search({
      embedding,
      policyId: filter.policyId,
      language: filter.language,
      limit,
    });

    return hits.map((hit) => ({
      chunkId: hit.chunkId,
      content: hit.content,
      score: hit.score,
      retrievalMethod: 'dense',
      policyId: hit.policyId,
      policyVersionId: hit.policyId,
      documentId: hit.policyId,
      documentName: hit.documentName,
      version: hit.version,
      pageNumber: hit.pageNumber,
      section: hit.section,
      language: hit.language,
      chunkIndex: hit.chunkIndex,
      denseScore: hit.score,
      keywordMatched: false,
    }));
  }
}
