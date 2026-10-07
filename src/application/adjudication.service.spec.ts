import { ConflictException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { AdjudicationService } from './adjudication.service.js';
import { CollectedEvidence, EvidenceBuilder } from './evidence-builder.js';
import { AnalysisStatus } from '../domain/analysis-status.js';
import { ClaimAnalysesRepository, NewClaimAnalysis } from '../domain/claim-analyses.repository.js';
import { AnalysisRequest, ClaimAnalyzer } from '../domain/claim-analyzer.js';
import { ClaimPage, ClaimPageQuery, ClaimsRepository, ClaimUpdate, NewClaim } from '../domain/claims.repository.js';
import { ClaimStatus } from '../domain/claim-status.js';
import { ClaimType } from '../domain/claim-type.js';
import { Claim } from '../domain/entity/claim.entity.js';
import { ClaimAnalysis } from '../domain/entity/claim-analysis.entity.js';
import { Policy } from '../domain/entity/policy.entity.js';
import { UserRole } from '../domain/entity/user.entity.js';
import { PolicyIndexStatus } from '../domain/policy-index-status.js';
import { PolicyLanguage } from '../domain/policy-language.js';
import { PolicyType } from '../domain/policy-type.js';
import { PoliciesRepository } from '../domain/policies.repository.js';
import { Citation } from '../domain/retrieval.types.js';
import { ApprovalsService } from './approvals.service.js';

const employee = { id: 'employee-1', role: UserRole.Employee };
const admin = { id: 'admin-1', role: UserRole.Admin };

describe('AdjudicationService', () => {
  let analyses: MemoryAnalyses;
  let analyzer: MemoryAnalyzer;
  let evidence: MemoryEvidence;
  let approvals: FakeApprovals;
  let service: AdjudicationService;

  beforeEach(() => {
    analyses = new MemoryAnalyses();
    analyzer = new MemoryAnalyzer();
    evidence = new MemoryEvidence(sampleEvidence());
    approvals = new FakeApprovals();
    service = new AdjudicationService(
      new MemoryClaims(),
      new MemoryPolicies(),
      analyses,
      evidence as unknown as EvidenceBuilder,
      analyzer,
      approvals as unknown as ApprovalsService,
    );
  });

  it('calculates payout from cited evidence and stores the analysis', async () => {
    const result = await service.analyze('claim-1', employee);

    expect(result.policy.versionNumber).toBe('3');
    expect(result.status).toBe(AnalysisStatus.Completed);
    expect(result.financials.payout).toBe('50000.00');
    expect(result.financials.coverageLimit).toBe('60000.00');
    expect(result.financials.deductible).toBe('10000.00');
    expect(result.evidence[0]?.chunkId).toBe('chunk-1');
    expect(result.recommendation?.decision).toBe('APPROVE');
    expect(analyses.rows).toHaveLength(1);
    expect(analyzer.requests[0]?.policy.policyId).toBe('v3');
    expect(approvals.created).toHaveLength(1);
  });

  it('opens a pending approval when retrieval returns no evidence', async () => {
    evidence.result = { chunks: [], citations: [] };

    const result = await service.analyze('claim-1', employee);

    expect(result.status).toBe(AnalysisStatus.InsufficientEvidence);
    expect(result.message).toBe('Not enough information in the corpus.');
    expect(analyzer.requests).toHaveLength(0);
    expect(approvals.created).toHaveLength(1);
    expect(approvals.created[0]?.recommendation?.decision).toBe('REVIEW');
    expect(approvals.created[0]?.recommendation?.reasoning).toBe('No evidence to support a decision.');
  });

  it('rejects a limit that is not in the cited text and still opens an approval', async () => {
    analyzer.body.financialFacts = { coverageLimit: 100000, deductible: 10000 };

    await expect(service.analyze('claim-1', employee)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(analyses.rows[0]?.errorCode).toBe('AI_FACT_CONFLICT');
    expect(analyses.rows[0]?.calculatedPayout).toBe('0.00');
    expect(approvals.created).toHaveLength(1);
    expect(approvals.created[0]?.recommendation?.reasoning).toBe('No evidence to support a decision.');
  });

  it('rejects the claim when an exclusion applies', async () => {
    analyzer.body.exclusions = {
      applicable: true,
      items: [{ name: 'Racing', reasoning: 'The vehicle was used in a race.' }],
    };
    analyzer.body.recommendation = { decision: 'APPROVE', reasoning: 'Still approved by the model.' };

    const result = await service.analyze('claim-1', employee);

    expect(result.recommendation?.decision).toBe('REJECT');
    expect(result.financials.payout).toBe('0.00');
  });

  it('refuses an incident date outside the policy family', async () => {
    await expect(service.analyze('claim-old', employee)).rejects.toBeInstanceOf(ConflictException);
    expect(analyses.rows).toHaveLength(0);
  });

  it('blocks an employee from analyzing another user claim', async () => {
    await expect(service.analyze('claim-1', { id: 'employee-2', role: UserRole.Employee })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows an admin to analyze any claim', async () => {
    const result = await service.analyze('claim-1', admin);
    expect(result.claim.claimNumber).toBe('CLM-000001');
  });
});

class FakeApprovals {
  created: ClaimAnalysis[] = [];

  createFromAnalysis(analysis: ClaimAnalysis): Promise<void> {
    this.created.push(analysis);
    return Promise.resolve();
  }
}

class MemoryAnalyzer extends ClaimAnalyzer {
  requests: AnalysisRequest[] = [];
  body: Record<string, unknown> = {
    coverage: { covered: true, reasoning: 'Collision is covered.' },
    exclusions: { applicable: false, items: [] },
    anomalies: { detected: false, items: [] },
    financialFacts: { coverageLimit: 60000, deductible: 10000 },
    recommendation: { decision: 'APPROVE', reasoning: 'Covered collision.' },
    citations: [{ chunkId: 'chunk-1' }],
  };

  analyze(_systemPrompt: string, request: AnalysisRequest): Promise<unknown> {
    this.requests.push(request);
    return Promise.resolve(structuredClone(this.body));
  }
}

class MemoryEvidence {
  constructor(public result: CollectedEvidence) {}

  collect(): Promise<CollectedEvidence> {
    return Promise.resolve(this.result);
  }
}

class MemoryAnalyses extends ClaimAnalysesRepository {
  rows: ClaimAnalysis[] = [];

  create(input: NewClaimAnalysis): Promise<ClaimAnalysis> {
    const saved = {
      ...input,
      id: `analysis-${this.rows.length + 1}`,
      createdAt: new Date('2026-08-16T00:00:00.000Z'),
      updatedAt: new Date('2026-08-16T00:00:00.000Z'),
    } as ClaimAnalysis;
    this.rows.push(saved);
    return Promise.resolve(saved);
  }

  findLatestByClaimId(claimId: string): Promise<ClaimAnalysis | null> {
    return Promise.resolve([...this.rows].reverse().find((row) => row.claimId === claimId) ?? null);
  }
}

class MemoryClaims extends ClaimsRepository {
  create(_claim: NewClaim): Promise<Claim> {
    return Promise.reject(new Error('not used'));
  }

  update(_id: string, _update: ClaimUpdate): Promise<Claim> {
    return Promise.reject(new Error('not used'));
  }

  findById(id: string): Promise<Claim | null> {
    if (id === 'claim-1') {
      return Promise.resolve(sampleClaim('2026-08-15', employee.id));
    }
    if (id === 'claim-old') {
      return Promise.resolve(sampleClaim('2023-06-01', employee.id));
    }
    return Promise.resolve(null);
  }

  findPage(_query: ClaimPageQuery): Promise<ClaimPage> {
    return Promise.resolve({ items: [], total: 0 });
  }

  nextClaimNumber(): Promise<string> {
    return Promise.resolve('CLM-000001');
  }
}

class MemoryPolicies extends PoliciesRepository {
  create(): Promise<Policy> {
    return Promise.reject(new Error('not used'));
  }

  findAll(): Promise<Policy[]> {
    return Promise.resolve(family());
  }

  findById(id: string): Promise<Policy | null> {
    return Promise.resolve(family().find((policy) => policy.id === id) ?? null);
  }

  findByIdentity(): Promise<Policy | null> {
    return Promise.resolve(null);
  }

  findFamily(name: string, language: PolicyLanguage): Promise<Policy[]> {
    return Promise.resolve(family().filter((policy) => policy.name === name && policy.language === language));
  }

  deleteById(): Promise<void> {
    return Promise.resolve();
  }

  updateIndexState(): Promise<void> {
    return Promise.resolve();
  }
}

function sampleEvidence(): CollectedEvidence {
  const citation: Citation = {
    chunkId: 'chunk-1',
    documentId: 'v3',
    documentName: 'Motor',
    version: '3',
    pageNumber: 2,
    section: 'Collision Coverage',
    language: PolicyLanguage.EN,
  };
  return {
    citations: [citation],
    chunks: [
      {
        ...citation,
        content: 'Coverage limit 60,000. Deductible 10,000.',
      },
    ],
  };
}

function sampleClaim(incidentDate: string, createdBy: string): Claim {
  return {
    id: incidentDate === '2023-06-01' ? 'claim-old' : 'claim-1',
    claimNumber: 'CLM-000001',
    policyId: 'v1',
    policy: family()[0],
    incidentDate,
    claimType: ClaimType.Collision,
    claimedAmount: '80000.00',
    description: 'The insured vehicle was involved in a road collision.',
    status: ClaimStatus.Submitted,
    createdBy,
    createdAt: new Date('2026-08-16T00:00:00.000Z'),
    updatedAt: new Date('2026-08-16T00:00:00.000Z'),
  } as Claim;
}

function family(): Policy[] {
  return [
    row('v1', '1', '2024-01-01', '2025-01-01'),
    row('v2', '2', '2025-01-01', '2026-01-01'),
    row('v3', '3', '2026-01-01', '2027-01-01'),
  ];
}

function row(id: string, version: string, effectiveFrom: string, effectiveTo: string): Policy {
  return {
    id,
    name: 'Motor',
    type: PolicyType.MOTOR,
    description: null,
    version,
    language: PolicyLanguage.EN,
    effectiveFrom,
    effectiveTo,
    documentUrl: '/uploads/motor.pdf',
    status: PolicyIndexStatus.Indexed,
    currentStage: null,
    errorCode: null,
    errorMessage: null,
  };
}
