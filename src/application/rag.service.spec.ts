import { BadRequestException } from '@nestjs/common';
import { RagService } from './rag.service.js';
import { DenseRetriever } from '../domain/dense-retriever.js';
import { KeywordRetriever } from '../domain/keyword-retriever.js';
import { PolicyLanguage } from '../domain/policy-language.js';
import { RagSettings } from '../domain/rag-settings.js';
import { Reranker } from '../domain/reranker.js';
import { RetrievalFilter, RetrievalResult } from '../domain/retrieval.types.js';
import { ReciprocalRankFusion } from '../infrastructure/reciprocal-rank.fusion.js';
import { WhitespaceQueryProcessor } from '../infrastructure/whitespace-query.processor.js';

const settings: RagSettings = {
  topK: 5,
  denseTopK: 20,
  keywordTopK: 20,
  finalTopK: 5,
  minScore: 0.35,
  rerankEnabled: false,
};

describe('RagService', () => {
  it('returns the stronger dense chunk first and cites it', async () => {
    const dense = new ListDense([
      chunk({ chunkId: 'near', denseScore: 0.91, score: 0.91, content: 'Deductible 500' }),
      chunk({ chunkId: 'far', denseScore: 0.4, score: 0.4, chunkIndex: 1, content: 'Limit 100000' }),
    ]);
    const result = await service(dense, new ListKeyword([])).retrieve({ query: 'collision deductible' });

    expect(result.hasSufficientEvidence).toBe(true);
    expect(result.results.map((item) => item.chunkId)).toEqual(['near', 'far']);
    expect(result.citations[0]).toMatchObject({
      chunkId: 'near',
      documentId: 'policy-1',
      documentName: 'Motor',
      pageNumber: 1,
      section: 'Collision',
    });
    expect(result.results[0]).not.toHaveProperty('denseScore');
  });

  it('keeps an exact keyword hit when the dense score is weak', async () => {
    const keyword = new ListKeyword([
      chunk({
        chunkId: 'term',
        content: 'Deductible 500',
        retrievalMethod: 'keyword',
        denseScore: null,
        keywordMatched: true,
        score: 0.2,
      }),
    ]);
    const result = await service(new ListDense([]), keyword).retrieve({ query: 'Deductible 500' });

    expect(result.results.map((item) => item.chunkId)).toEqual(['term']);
    expect(result.results[0]?.retrievalMethod).toBe('keyword');
  });

  it('refuses when every candidate is a weak dense neighbor', async () => {
    const dense = new ListDense([chunk({ chunkId: 'weak', denseScore: 0.05, score: 0.05, content: 'unrelated' })]);
    const result = await service(dense, new ListKeyword([])).retrieve({ query: 'quantum banana orbit' });

    expect(result).toMatchObject({
      hasSufficientEvidence: false,
      results: [],
      citations: [],
      message: 'Not enough information in the corpus.',
    });
  });

  it('passes the version id into both retrievers and hides other versions', async () => {
    const rows = [
      chunk({ chunkId: 'v1', policyId: '11111111-1111-4111-8111-111111111111', version: 'v1' }),
      chunk({ chunkId: 'v2', policyId: '22222222-2222-4222-8222-222222222222', version: 'v2' }),
      chunk({ chunkId: 'v3', policyId: '33333333-3333-4333-8333-333333333333', version: 'v3' }),
    ];
    const dense = new ListDense(rows);
    const keyword = new ListKeyword([]);
    const result = await service(dense, keyword).retrieve({
      query: 'collision',
      policyVersionId: '22222222-2222-4222-8222-222222222222',
    });

    expect(dense.filters[0]?.policyId).toBe('22222222-2222-4222-8222-222222222222');
    expect(keyword.filters[0]?.policyId).toBe('22222222-2222-4222-8222-222222222222');
    expect(result.results.map((item) => item.chunkId)).toEqual(['v2']);
  });

  it('filters English chunks only when language is explicit', async () => {
    const rows = [
      chunk({ chunkId: 'en', language: PolicyLanguage.EN, content: 'Deductible 500' }),
      chunk({ chunkId: 'ar', language: PolicyLanguage.AR, content: 'تغطية التصادم', chunkIndex: 1 }),
    ];
    const filtered = new ListDense(rows);
    const english = await service(filtered, new ListKeyword([])).retrieve({ query: 'coverage', language: 'en' });
    const cross = await service(new ListDense(rows), new ListKeyword([])).retrieve({ query: 'تغطية التصادم' });

    expect(filtered.filters[0]?.language).toBe(PolicyLanguage.EN);
    expect(english.results.map((item) => item.chunkId)).toEqual(['en']);
    expect(cross.results.map((item) => item.language).sort()).toEqual(['ar', 'en']);
  });

  it('lets a reranker change the fused order', async () => {
    const dense = new ListDense([
      chunk({ chunkId: 'first', denseScore: 0.9, score: 0.9, chunkIndex: 0 }),
      chunk({ chunkId: 'second', denseScore: 0.8, score: 0.8, chunkIndex: 1 }),
    ]);
    const result = await service(dense, new ListKeyword([]), new ReverseReranker(), {
      ...settings,
      rerankEnabled: true,
    }).retrieve({ query: 'collision' });

    expect(result.results.map((item) => item.chunkId)).toEqual(['second', 'first']);
  });

  it('rejects conflicting policy filters', async () => {
    await expect(
      service(new ListDense([]), new ListKeyword([])).retrieve({
        query: 'collision',
        policyId: '11111111-1111-4111-8111-111111111111',
        documentId: '22222222-2222-4222-8222-222222222222',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

class ListDense extends DenseRetriever {
  filters: RetrievalFilter[] = [];

  constructor(private readonly rows: RetrievalResult[]) {
    super();
  }

  retrieve(_query: string, filter: RetrievalFilter, limit: number): Promise<RetrievalResult[]> {
    this.filters.push(filter);
    return Promise.resolve(applyFilter(this.rows, filter).slice(0, limit));
  }
}

class ListKeyword extends KeywordRetriever {
  filters: RetrievalFilter[] = [];

  constructor(private readonly rows: RetrievalResult[]) {
    super();
  }

  retrieve(_query: string, filter: RetrievalFilter, limit: number): Promise<RetrievalResult[]> {
    this.filters.push(filter);
    return Promise.resolve(applyFilter(this.rows, filter).slice(0, limit));
  }
}

class ReverseReranker extends Reranker {
  rerank(_query: string, candidates: RetrievalResult[]): Promise<RetrievalResult[]> {
    return Promise.resolve([...candidates].reverse());
  }
}

function service(
  dense: DenseRetriever,
  keyword: KeywordRetriever,
  reranker: Reranker = new ReverseReranker(),
  active: RagSettings = settings,
): RagService {
  return new RagService(active, new WhitespaceQueryProcessor(), dense, keyword, new ReciprocalRankFusion(), reranker);
}

function applyFilter(rows: RetrievalResult[], filter: RetrievalFilter): RetrievalResult[] {
  return rows.filter((row) => {
    if (filter.policyId && row.policyId !== filter.policyId) {
      return false;
    }
    if (filter.language && row.language !== filter.language) {
      return false;
    }
    return true;
  });
}

function chunk(overrides: Partial<RetrievalResult> & { chunkId: string }): RetrievalResult {
  const policyId = overrides.policyId ?? 'policy-1';
  return {
    chunkId: overrides.chunkId,
    content: overrides.content ?? 'collision coverage',
    score: overrides.score ?? 0.9,
    retrievalMethod: overrides.retrievalMethod ?? 'dense',
    policyId,
    policyVersionId: overrides.policyVersionId ?? policyId,
    documentId: overrides.documentId ?? policyId,
    documentName: overrides.documentName ?? 'Motor',
    version: overrides.version ?? '1.0',
    pageNumber: overrides.pageNumber ?? 1,
    section: overrides.section === undefined ? 'Collision' : overrides.section,
    language: overrides.language ?? PolicyLanguage.EN,
    chunkIndex: overrides.chunkIndex ?? 0,
    denseScore: overrides.denseScore === undefined ? 0.9 : overrides.denseScore,
    keywordMatched: overrides.keywordMatched ?? false,
  };
}
