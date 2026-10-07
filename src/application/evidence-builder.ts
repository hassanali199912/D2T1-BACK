import { Injectable } from '@nestjs/common';
import { AnalysisEvidence } from '../domain/claim-analyzer.js';
import { Claim } from '../domain/entity/claim.entity.js';
import { Policy } from '../domain/entity/policy.entity.js';
import { Citation, RetrievalResponse } from '../domain/retrieval.types.js';
import { RagService } from './rag.service.js';

const TOP_K = 8;
const TOPICS = [
  'Is this incident covered? Include the coverage grant and applicable conditions.',
  'Are there applicable exclusions?',
  'What deductible applies?',
  'What coverage limit applies?',
];

export type CollectedEvidence = {
  chunks: AnalysisEvidence[];
  citations: Citation[];
};

@Injectable()
export class EvidenceBuilder {
  constructor(private readonly rag: RagService) {}

  async collect(claim: Claim, policy: Policy): Promise<CollectedEvidence> {
    const responses = await Promise.all(
      TOPICS.map((topic) =>
        this.rag.retrieve({
          query: queryFor(claim, topic),
          policyId: policy.id,
          policyVersionId: policy.id,
          topK: TOP_K,
        }),
      ),
    );
    return merge(responses);
  }
}

function queryFor(claim: Claim, topic: string): string {
  return [`Claim type: ${claim.claimType}`, `Description: ${claim.description}`, `Topic: ${topic}`].join('\n');
}

function merge(responses: RetrievalResponse[]): CollectedEvidence {
  const chunks: AnalysisEvidence[] = [];
  const citations: Citation[] = [];
  const seen = new Set<string>();
  for (const response of responses) {
    for (const result of response.results) {
      if (seen.has(result.chunkId)) {
        continue;
      }
      seen.add(result.chunkId);
      chunks.push({
        chunkId: result.chunkId,
        content: result.content,
        pageNumber: result.pageNumber,
        section: result.section,
        language: result.language,
        documentId: result.documentId,
        documentName: result.documentName,
        version: result.version,
      });
      citations.push({
        chunkId: result.chunkId,
        documentId: result.documentId,
        documentName: result.documentName,
        version: result.version,
        pageNumber: result.pageNumber,
        section: result.section,
        language: result.language,
      });
    }
  }
  return { chunks, citations };
}
