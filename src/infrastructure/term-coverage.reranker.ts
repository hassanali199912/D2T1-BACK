import { Injectable } from '@nestjs/common';
import { Reranker } from '../domain/reranker.js';
import { RetrievalResult } from '../domain/retrieval.types.js';

@Injectable()
export class TermCoverageReranker extends Reranker {
  rerank(query: string, candidates: RetrievalResult[]): Promise<RetrievalResult[]> {
    const queryTokens = tokens(query);
    const reranked = candidates.map((candidate) => {
      const coverage = queryTokens.length === 0 ? 0 : overlap(queryTokens, tokens(candidate.content)) / queryTokens.length;
      return {
        ...candidate,
        score: 0.7 * candidate.score + 0.3 * coverage,
      };
    });

    return Promise.resolve(reranked.sort(compareResults));
  }
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean);
}

function overlap(queryTokens: string[], contentTokens: string[]): number {
  const content = new Set(contentTokens);
  return queryTokens.filter((token) => content.has(token)).length;
}

function compareResults(left: RetrievalResult, right: RetrievalResult): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }
  if (left.chunkIndex !== right.chunkIndex) {
    return left.chunkIndex - right.chunkIndex;
  }
  return left.chunkId.localeCompare(right.chunkId);
}
