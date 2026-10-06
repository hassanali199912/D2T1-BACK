import { RetrievalFilter, RetrievalResult } from './retrieval.types.js';

export abstract class KeywordRetriever {
  abstract retrieve(query: string, filter: RetrievalFilter, limit: number): Promise<RetrievalResult[]>;
}
