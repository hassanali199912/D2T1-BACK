import { RetrievalResult } from './retrieval.types.js';

export const INSUFFICIENT_EVIDENCE_MESSAGE = 'Not enough information in the corpus.';

export function selectEvidence(candidates: RetrievalResult[], minScore: number): RetrievalResult[] {
  return candidates.filter(
    (candidate) =>
      (candidate.denseScore !== null && candidate.denseScore >= minScore) || candidate.keywordMatched,
  );
}
