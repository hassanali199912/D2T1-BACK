import { PreparedQuery } from './retrieval.types.js';

export abstract class QueryProcessor {
  abstract prepare(query: string): PreparedQuery;
}
