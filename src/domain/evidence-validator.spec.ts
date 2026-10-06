import { PolicyLanguage } from './policy-language.js';
import { RetrievalResult } from './retrieval.types.js';
import { selectEvidence } from './evidence-validator.js';

describe('selectEvidence', () => {
  it('drops weak dense neighbors and keeps a keyword match', () => {
    const kept = selectEvidence(
      [
        chunk({ chunkId: 'weak', denseScore: 0.1, keywordMatched: false }),
        chunk({ chunkId: 'term', denseScore: 0.1, keywordMatched: true }),
        chunk({ chunkId: 'near', denseScore: 0.4, keywordMatched: false }),
      ],
      0.35,
    );

    expect(kept.map((item) => item.chunkId)).toEqual(['term', 'near']);
  });
});

function chunk(overrides: Partial<RetrievalResult> & { chunkId: string }): RetrievalResult {
  return {
    content: 'text',
    score: 0.2,
    retrievalMethod: 'dense',
    policyId: 'policy-1',
    policyVersionId: 'policy-1',
    documentId: 'policy-1',
    documentName: 'Motor',
    version: '1.0',
    pageNumber: 2,
    section: 'Liability',
    language: PolicyLanguage.EN,
    chunkIndex: 0,
    denseScore: null,
    keywordMatched: false,
    ...overrides,
  };
}
