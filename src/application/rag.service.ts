import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { buildCitations } from '../domain/citation-builder.js';
import { DenseRetriever } from '../domain/dense-retriever.js';
import { INSUFFICIENT_EVIDENCE_MESSAGE, selectEvidence } from '../domain/evidence-validator.js';
import { FusionStrategy } from '../domain/fusion-strategy.js';
import { KeywordRetriever } from '../domain/keyword-retriever.js';
import { ConflictingPolicyFilterError, resolvePolicyId } from '../domain/policy-filter.js';
import { PolicyLanguage } from '../domain/policy-language.js';
import { QueryProcessor } from '../domain/query-processor.js';
import { RAG_SETTINGS, type RagSettings } from '../domain/rag-settings.js';
import { Reranker } from '../domain/reranker.js';
import { RetrievalResponse, RetrievalResult, RetrievedChunk } from '../domain/retrieval.types.js';

const MAX_TOP_K = 20;

export type RetrieveInput = {
  query: string;
  topK?: number;
  language?: PolicyLanguage | 'AUTO';
  policyId?: string;
  policyVersionId?: string;
  documentId?: string;
};

@Injectable()
export class RagService {
  constructor(
    @Inject(RAG_SETTINGS) private readonly settings: RagSettings,
    private readonly queryProcessor: QueryProcessor,
    private readonly denseRetriever: DenseRetriever,
    private readonly keywordRetriever: KeywordRetriever,
    private readonly fusion: FusionStrategy,
    private readonly reranker: Reranker,
  ) {}

  async retrieve(input: RetrieveInput): Promise<RetrievalResponse> {
    const prepared = this.queryProcessor.prepare(input.query);
    if (!prepared.normalized) {
      return refusal(input.query);
    }

    let policyId: string | null;
    try {
      policyId = resolvePolicyId([input.policyId, input.policyVersionId, input.documentId]);
    } catch (error) {
      if (error instanceof ConflictingPolicyFilterError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const filter = {
      policyId,
      language: input.language === PolicyLanguage.AR || input.language === PolicyLanguage.EN ? input.language : null,
    };
    const limit = Math.min(input.topK ?? this.settings.finalTopK, MAX_TOP_K);

    const [dense, keyword] = await Promise.all([
      this.denseRetriever.retrieve(prepared.denseText, filter, this.settings.denseTopK),
      this.keywordRetriever.retrieve(prepared.keywordText, filter, this.settings.keywordTopK),
    ]);

    let ranked = this.fusion.fuse(dense, keyword);
    if (this.settings.rerankEnabled) {
      ranked = await this.reranker.rerank(prepared.normalized, ranked);
    }

    const kept = selectEvidence(ranked.slice(0, limit), this.settings.minScore);
    if (kept.length === 0) {
      return refusal(input.query);
    }

    return {
      query: input.query,
      hasSufficientEvidence: true,
      results: kept.map(toPublic),
      citations: buildCitations(kept),
      message: null,
    };
  }
}

function refusal(query: string): RetrievalResponse {
  return {
    query,
    hasSufficientEvidence: false,
    results: [],
    citations: [],
    message: INSUFFICIENT_EVIDENCE_MESSAGE,
  };
}

function toPublic(result: RetrievalResult): RetrievedChunk {
  return {
    chunkId: result.chunkId,
    content: result.content,
    score: result.score,
    retrievalMethod: result.retrievalMethod,
    policyId: result.policyId,
    policyVersionId: result.policyVersionId,
    documentId: result.documentId,
    documentName: result.documentName,
    version: result.version,
    pageNumber: result.pageNumber,
    section: result.section,
    language: result.language,
  };
}
