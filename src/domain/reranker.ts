import { RetrievalResult } from './retrieval.types.js';

export abstract class Reranker {
  abstract rerank(query: string, candidates: RetrievalResult[]): Promise<RetrievalResult[]>;
}
