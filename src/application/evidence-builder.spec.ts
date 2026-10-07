import { EvidenceBuilder } from './evidence-builder.js';
import { Claim } from '../domain/entity/claim.entity.js';
import { Policy } from '../domain/entity/policy.entity.js';
import { ClaimStatus } from '../domain/claim-status.js';
import { ClaimType } from '../domain/claim-type.js';
import { PolicyIndexStatus } from '../domain/policy-index-status.js';
import { PolicyLanguage } from '../domain/policy-language.js';
import { PolicyType } from '../domain/policy-type.js';
import { RetrievalResponse } from '../domain/retrieval.types.js';
import { RetrieveInput, RagService } from './rag.service.js';

describe('EvidenceBuilder', () => {
  it('searches the selected policy version for each topic and keeps citations', async () => {
    const calls: RetrieveInput[] = [];
    const rag = {
      retrieve(input: RetrieveInput): Promise<RetrievalResponse> {
        calls.push(input);
        return Promise.resolve(hit(input.query));
      },
    } as RagService;
    const builder = new EvidenceBuilder(rag);

    const collected = await builder.collect(claim(), policy('version-3'));

    expect(calls).toHaveLength(4);
    expect(calls.every((call) => call.policyId === 'version-3' && call.policyVersionId === 'version-3')).toBe(true);
    expect(collected.citations.map((citation) => citation.chunkId)).toEqual(['chunk-1']);
    expect(collected.chunks[0]?.content).toContain('60,000');
  });
});

function hit(query: string): RetrievalResponse {
  return {
    query,
    hasSufficientEvidence: true,
    message: null,
    results: [
      {
        chunkId: 'chunk-1',
        content: 'Coverage limit 60,000. Deductible 10,000.',
        score: 0.9,
        retrievalMethod: 'hybrid',
        policyId: 'version-3',
        policyVersionId: 'version-3',
        documentId: 'version-3',
        documentName: 'Motor',
        version: '3',
        pageNumber: 2,
        section: 'Collision Coverage',
        language: PolicyLanguage.EN,
      },
    ],
    citations: [
      {
        chunkId: 'chunk-1',
        documentId: 'version-3',
        documentName: 'Motor',
        version: '3',
        pageNumber: 2,
        section: 'Collision Coverage',
        language: PolicyLanguage.EN,
      },
    ],
  };
}

function claim(): Claim {
  return {
    id: 'claim-1',
    claimNumber: 'CLM-000001',
    policyId: 'version-1',
    incidentDate: '2026-08-15',
    claimType: ClaimType.Collision,
    claimedAmount: '80000.00',
    description: 'The insured vehicle was involved in a road collision.',
    status: ClaimStatus.Submitted,
    createdBy: 'employee-1',
    createdAt: new Date('2026-08-16T00:00:00.000Z'),
    updatedAt: new Date('2026-08-16T00:00:00.000Z'),
  } as Claim;
}

function policy(id: string): Policy {
  return {
    id,
    name: 'Motor',
    type: PolicyType.MOTOR,
    description: null,
    version: '3',
    language: PolicyLanguage.EN,
    effectiveFrom: '2026-01-01',
    effectiveTo: '2027-01-01',
    documentUrl: '/uploads/motor.pdf',
    status: PolicyIndexStatus.Indexed,
    currentStage: null,
    errorCode: null,
    errorMessage: null,
  };
}
