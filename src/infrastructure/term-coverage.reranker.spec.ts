import { PolicyLanguage } from '../domain/policy-language.js';
import { RetrievalResult } from '../domain/retrieval.types.js';
import { TermCoverageReranker } from './term-coverage.reranker.js';

describe('TermCoverageReranker', () => {
  const reranker = new TermCoverageReranker();

  it('moves an exact insurance term ahead of a higher fused score', async () => {
    const ranked = await reranker.rerank('deductible 500', [
      chunk({ chunkId: 'weak', chunkIndex: 0, score: 0.5, content: 'liability limit' }),
      chunk({ chunkId: 'term', chunkIndex: 1, score: 0.4, content: 'Deductible 500 on 2026-01-01' }),
    ]);

    expect(ranked.map((item) => item.chunkId)).toEqual(['term', 'weak']);
    expect(ranked[0]?.score).toBeCloseTo(0.7 * 0.4 + 0.3);
  });
});

function chunk(overrides: Partial<RetrievalResult> & { chunkId: string }): RetrievalResult {
  return {
    content: '',
    score: 0,
    retrievalMethod: 'hybrid',
    policyId: 'policy-1',
    policyVersionId: 'policy-1',
    documentId: 'policy-1',
    documentName: 'Motor',
    version: '1.0',
    pageNumber: 1,
    section: null,
    language: PolicyLanguage.EN,
    chunkIndex: 0,
    denseScore: 0.8,
    keywordMatched: false,
    ...overrides,
  };
}
