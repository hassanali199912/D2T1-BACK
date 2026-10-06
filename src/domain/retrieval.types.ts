import { PolicyLanguage } from './policy-language.js';

export type RetrievalMethod = 'dense' | 'keyword' | 'hybrid';

export type RetrievalFilter = {
  policyId: string | null;
  language: PolicyLanguage | null;
};

export type RetrievedChunk = {
  chunkId: string;
  content: string;
  score: number;
  retrievalMethod: RetrievalMethod;
  policyId: string;
  policyVersionId: string;
  documentId: string;
  documentName: string;
  version: string;
  pageNumber: number;
  section: string | null;
  language: PolicyLanguage;
};

export type RetrievalResult = RetrievedChunk & {
  chunkIndex: number;
  denseScore: number | null;
  keywordMatched: boolean;
};

export type PreparedQuery = {
  original: string;
  normalized: string;
  language: PolicyLanguage;
  denseText: string;
  keywordText: string;
};

export type Citation = {
  chunkId: string;
  documentId: string;
  documentName: string;
  version: string;
  pageNumber: number;
  section: string | null;
  language: PolicyLanguage;
};

export type RetrievalResponse = {
  query: string;
  hasSufficientEvidence: boolean;
  results: RetrievedChunk[];
  citations: Citation[];
  message: string | null;
};
