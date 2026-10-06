import { Injectable } from '@nestjs/common';
import { FusionStrategy } from '../domain/fusion-strategy.js';
import { RetrievalResult } from '../domain/retrieval.types.js';

const RRF_K = 60;

@Injectable()
export class ReciprocalRankFusion extends FusionStrategy {
  fuse(dense: RetrievalResult[], keyword: RetrievalResult[]): RetrievalResult[] {
    const byId = new Map<string, RetrievalResult>();
    addList(byId, dense, 'dense');
    addList(byId, keyword, 'keyword');

    return [...byId.values()].sort(compareResults);
  }
}

function addList(
  byId: Map<string, RetrievalResult>,
  list: RetrievalResult[],
  method: 'dense' | 'keyword',
): void {
  list.forEach((item, index) => {
    const contribution = 1 / (RRF_K + index + 1);
    const existing = byId.get(item.chunkId);
    if (!existing) {
      byId.set(item.chunkId, {
        ...item,
        score: contribution,
        retrievalMethod: method,
        denseScore: method === 'dense' ? item.denseScore : null,
        keywordMatched: method === 'keyword',
      });
      return;
    }

    existing.score += contribution;
    existing.retrievalMethod = 'hybrid';
    if (method === 'dense') {
      existing.denseScore = item.denseScore;
    }
    if (method === 'keyword') {
      existing.keywordMatched = true;
    }
  });
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
