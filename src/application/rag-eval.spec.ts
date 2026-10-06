import { readFileSync } from 'fs';
import { RagService } from './rag.service.js';
import { DenseRetriever } from '../domain/dense-retriever.js';
import { KeywordRetriever } from '../domain/keyword-retriever.js';
import { PolicyLanguage } from '../domain/policy-language.js';
import { RagSettings } from '../domain/rag-settings.js';
import { Reranker } from '../domain/reranker.js';
import { RetrievalFilter, RetrievalResult } from '../domain/retrieval.types.js';
import { ReciprocalRankFusion } from '../infrastructure/reciprocal-rank.fusion.js';
import { WhitespaceQueryProcessor } from '../infrastructure/whitespace-query.processor.js';

type EvalCase = {
  id: string;
  query: string;
  direction: string;
  expectedContent: string | null;
  expectedLanguage: 'ar' | 'en' | null;
  expectRefusal: boolean;
};

const settings: RagSettings = {
  topK: 5,
  denseTopK: 20,
  keywordTopK: 20,
  finalTopK: 5,
  minScore: 0.35,
  rerankEnabled: false,
};

describe('rag eval set', () => {
  const cases = JSON.parse(readFileSync('fixtures/rag-eval.json', 'utf8')) as EvalCase[];

  it('records hit rate, rank, and refusal on the fake corpus', async () => {
    const measurements = [];
    for (const item of cases) {
      const dense = new CorpusDense(cases, item);
      const response = await build(dense).retrieve({ query: item.query });
      const rank = item.expectedContent
        ? response.results.findIndex((result) => result.content === item.expectedContent) + 1
        : 0;
      measurements.push({
        id: item.id,
        direction: item.direction,
        hit: !item.expectRefusal && rank > 0,
        rank: rank || null,
        refused: !response.hasSufficientEvidence,
        refusalCorrect: response.hasSufficientEvidence !== item.expectRefusal ? false : true,
      });
      expect(dense.filters.at(-1)?.language).toBeNull();
    }

    const answered = measurements.filter((item) => !item.refused);
    const hitRate = answered.length === 0 ? 0 : answered.filter((item) => item.hit).length / cases.filter((item) => !item.expectRefusal).length;

    expect(measurements.filter((item) => item.id !== 'refusal').every((item) => item.hit && item.rank === 1)).toBe(true);
    expect(measurements.find((item) => item.id === 'refusal')?.refused).toBe(true);
    expect(hitRate).toBe(1);
  });
});

class CorpusDense extends DenseRetriever {
  filters: RetrievalFilter[] = [];

  constructor(
    private readonly cases: EvalCase[],
    private readonly current: EvalCase,
  ) {
    super();
  }

  retrieve(_query: string, filter: RetrievalFilter): Promise<RetrievalResult[]> {
    this.filters.push(filter);
    if (this.current.expectRefusal) {
      return Promise.resolve([row('distractor', 'some other clause', PolicyLanguage.EN, 0.05, 9)]);
    }

    const expected = row(
      this.current.id,
      this.current.expectedContent ?? '',
      this.current.expectedLanguage === 'ar' ? PolicyLanguage.AR : PolicyLanguage.EN,
      0.91,
      0,
    );
    const distractors = this.cases
      .filter((item) => item.expectedContent && item.expectedContent !== this.current.expectedContent)
      .map((item, index) =>
        row(
          item.id,
          item.expectedContent ?? '',
          item.expectedLanguage === 'ar' ? PolicyLanguage.AR : PolicyLanguage.EN,
          0.4,
          index + 1,
        ),
      );
    return Promise.resolve([expected, ...distractors]);
  }
}

class EmptyKeyword extends KeywordRetriever {
  retrieve(): Promise<RetrievalResult[]> {
    return Promise.resolve([]);
  }
}

class KeepOrder extends Reranker {
  rerank(_query: string, candidates: RetrievalResult[]): Promise<RetrievalResult[]> {
    return Promise.resolve(candidates);
  }
}

function build(dense: DenseRetriever): RagService {
  return new RagService(settings, new WhitespaceQueryProcessor(), dense, new EmptyKeyword(), new ReciprocalRankFusion(), new KeepOrder());
}

function row(
  chunkId: string,
  content: string,
  language: PolicyLanguage,
  denseScore: number,
  chunkIndex: number,
): RetrievalResult {
  return {
    chunkId,
    content,
    score: denseScore,
    retrievalMethod: 'dense',
    policyId: 'policy-1',
    policyVersionId: 'policy-1',
    documentId: 'policy-1',
    documentName: 'Motor',
    version: '1.0',
    pageNumber: 1,
    section: 'Collision',
    language,
    chunkIndex,
    denseScore,
    keywordMatched: false,
  };
}
