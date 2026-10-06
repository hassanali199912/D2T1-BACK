import { RetrievalFilter, RetrievalResult } from './retrieval.types.js';

export abstract class DenseRetriever {
  abstract retrieve(query: string, filter: RetrievalFilter, limit: number): Promise<RetrievalResult[]>;
}
