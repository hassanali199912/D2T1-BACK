import { PolicyLanguage } from './policy-language.js';
import { RetrievalResult } from './retrieval.types.js';
import { buildCitations } from './citation-builder.js';

describe('buildCitations', () => {
  it('copies the chunk, document, page, and section', () => {
    const citations = buildCitations([
      {
        chunkId: 'chunk-1',
        content: 'Deductible 500',
        score: 0.8,
        retrievalMethod: 'hybrid',
        policyId: 'policy-1',
        policyVersionId: 'policy-1',
        documentId: 'policy-1',
        documentName: 'Motor Policy',
        version: 'v2',
        pageNumber: 14,
        section: 'Collision Coverage',
        language: PolicyLanguage.EN,
        chunkIndex: 3,
        denseScore: 0.8,
        keywordMatched: true,
      } satisfies RetrievalResult,
    ]);

    expect(citations).toEqual([
      {
        chunkId: 'chunk-1',
        documentId: 'policy-1',
        documentName: 'Motor Policy',
        version: 'v2',
        pageNumber: 14,
        section: 'Collision Coverage',
        language: PolicyLanguage.EN,
      },
    ]);
  });
});
