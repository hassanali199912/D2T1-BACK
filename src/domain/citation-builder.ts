import { Citation, RetrievalResult } from './retrieval.types.js';

export function buildCitations(results: RetrievalResult[]): Citation[] {
  return results.map((result) => ({
    chunkId: result.chunkId,
    documentId: result.documentId,
    documentName: result.documentName,
    version: result.version,
    pageNumber: result.pageNumber,
    section: result.section,
    language: result.language,
  }));
}
