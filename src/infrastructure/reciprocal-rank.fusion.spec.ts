import { PolicyLanguage } from '../domain/policy-language.js';
import { RetrievalResult } from '../domain/retrieval.types.js';
import { ReciprocalRankFusion } from './reciprocal-rank.fusion.js';

describe('ReciprocalRankFusion', () => {
  const fusion = new ReciprocalRankFusion();

  it('merges a chunk found by both lists and keeps a single row', () => {
    const shared = chunk({ chunkId: 'a', chunkIndex: 0, denseScore: 0.9 });
    const denseOnly = chunk({ chunkId: 'b', chunkIndex: 1, denseScore: 0.4 });
    const fused = fusion.fuse(
      [shared, denseOnly],
      [chunk({ chunkId: 'a', chunkIndex: 0, keywordMatched: true, denseScore: null, retrievalMethod: 'keyword' })],
    );

    expect(fused.map((item) => item.chunkId)).toEqual(['a', 'b']);
    expect(fused[0]).toMatchObject({
      retrievalMethod: 'hybrid',
      denseScore: 0.9,
      keywordMatched: true,
    });
    expect(fused[0]?.score).toBeCloseTo(1 / 61 + 1 / 61);
    expect(fused[1]?.retrievalMethod).toBe('dense');
    expect(fused.filter((item) => item.chunkId === 'a')).toHaveLength(1);
  });
});

function chunk(overrides: Partial<RetrievalResult> & { chunkId: string }): RetrievalResult {
  return {
    content: 'Deductible 500',
    score: 0,
    retrievalMethod: 'dense',
    policyId: 'policy-1',
    policyVersionId: 'policy-1',
    documentId: 'policy-1',
    documentName: 'Motor',
    version: '1.0',
    pageNumber: 1,
    section: 'Collision',
    language: PolicyLanguage.EN,
    chunkIndex: 0,
    denseScore: 0.8,
    keywordMatched: false,
    ...overrides,
  };
}
