import { ExtractedDocument } from './extracted-document.js';
import { PolicyLanguage } from './policy-language.js';

export type ChunkCandidate = {
  chunkIndex: number;
  content: string;
  pageNumber: number;
  section: string | null;
  language: PolicyLanguage;
  tokenCount: number;
};

export type ChunkingOptions = {
  maxTokens: number;
  overlapTokens: number;
};

export abstract class DocumentChunker {
  abstract chunk(
    document: ExtractedDocument,
    options: ChunkingOptions,
    language: PolicyLanguage,
  ): ChunkCandidate[];
}

