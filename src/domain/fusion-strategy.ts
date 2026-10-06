import { RetrievalResult } from './retrieval.types.js';

export abstract class FusionStrategy {
  abstract fuse(dense: RetrievalResult[], keyword: RetrievalResult[]): RetrievalResult[];
}
