import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AnalysisDecision, AnalysisStatus } from '../domain/analysis-status.js';
import { AiClaimAnalysis, AiInvalidResponseError, parseAiClaimAnalysis } from '../domain/ai-claim-analysis.js';
import { ClaimAnalysesRepository, NewClaimAnalysis } from '../domain/claim-analyses.repository.js';
import { AnalysisRequest, ClaimAnalyzer } from '../domain/claim-analyzer.js';
import { ClaimsRepository } from '../domain/claims.repository.js';
import { Claim } from '../domain/entity/claim.entity.js';
import { ClaimAnalysis } from '../domain/entity/claim-analysis.entity.js';
import { UserRole } from '../domain/entity/user.entity.js';
import { Policy } from '../domain/entity/policy.entity.js';
import { amountAppearsInText } from '../domain/money-evidence.js';
import { CalculationError, calculatePayout } from '../domain/payout-calculator.js';
import { NoApplicablePolicyVersionError, selectPolicyVersion } from '../domain/policy-version.js';
import { PoliciesRepository } from '../domain/policies.repository.js';
import { INSUFFICIENT_EVIDENCE_MESSAGE } from '../domain/evidence-validator.js';
import { Citation } from '../domain/retrieval.types.js';
import { ClaimActor } from './claims.service.js';
import { CollectedEvidence, EvidenceBuilder } from './evidence-builder.js';
import { CLAIM_ANALYSIS_PROMPT, CLAIM_ANALYSIS_PROMPT_VERSION } from './prompts/claim-analysis.v1.js';

export type AnalysisView = {
  id: string;
  status: AnalysisStatus;
  message: string | null;
  errorCode: string | null;
  claim: {
    id: string;
    claimNumber: string;
    incidentDate: string;
    claimType: string;
    claimedAmount: string;
  };
  policy: {
    id: string;
    versionId: string;
    versionNumber: string;
    effectiveFrom: string;
    effectiveTo: string | null;
  };
  coverage: { covered: boolean; reasoning: string } | null;
  exclusions: { applicable: boolean; items: { name: string; reasoning: string }[] } | null;
  anomalies: { detected: boolean; items: string[] } | null;
  financials: {
    claimedAmount: string;
    coverageLimit: string | null;
    deductible: string | null;
    payout: string | null;
  };
  recommendation: { decision: AnalysisDecision; reasoning: string } | null;
  evidence: Citation[];
};

@Injectable()
export class AdjudicationService {
  constructor(
    private readonly claims: ClaimsRepository,
    private readonly policies: PoliciesRepository,
    private readonly analyses: ClaimAnalysesRepository,
    private readonly evidenceBuilder: EvidenceBuilder,
    private readonly analyzer: ClaimAnalyzer,
  ) {}

  async analyze(claimId: string, actor: ClaimActor): Promise<AnalysisView> {
    try {
      return await this.run(claimId, actor);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('ANALYSIS_FAILED');
    }
  }

  async findLatest(claimId: string, actor: ClaimActor): Promise<AnalysisView> {
    const claim = await this.requireClaim(claimId, actor);
    const analysis = await this.analyses.findLatestByClaimId(claim.id);
    if (!analysis) {
      throw new NotFoundException('ANALYSIS_NOT_FOUND');
    }
    return toView(analysis, claim, analysis.policyVersion);
  }

  private async run(claimId: string, actor: ClaimActor): Promise<AnalysisView> {
    const claim = await this.requireClaim(claimId, actor);
    const linked = await this.policies.findById(claim.policyId);
    if (!linked) {
      throw new NotFoundException('POLICY_NOT_FOUND');
    }

    const family = await this.policies.findFamily(linked.name, linked.language);
    let version: Policy;
    try {
      version = selectPolicyVersion(family, claim.incidentDate);
    } catch (error) {
      if (error instanceof NoApplicablePolicyVersionError) {
        throw new ConflictException('NO_APPLICABLE_POLICY_VERSION');
      }
      throw error;
    }

    const evidence = await this.evidenceBuilder.collect(claim, version);
    if (evidence.chunks.length === 0) {
      const saved = await this.analyses.create(blank(claim, version, AnalysisStatus.InsufficientEvidence, null));
      return toView(saved, claim, version, INSUFFICIENT_EVIDENCE_MESSAGE);
    }

    let raw: unknown;
    try {
      raw = await this.analyzer.analyze(CLAIM_ANALYSIS_PROMPT, requestFor(claim, version, evidence));
    } catch (error) {
      return this.fail(claim, version, error);
    }

    let parsed: AiClaimAnalysis;
    try {
      parsed = parseAiClaimAnalysis(raw, new Set(evidence.chunks.map((chunk) => chunk.chunkId)));
    } catch (error) {
      if (error instanceof AiInvalidResponseError) {
        return this.fail(claim, version, error);
      }
      throw error;
    }

    const cited = evidence.citations.filter((citation) =>
      parsed.citations.some((item) => item.chunkId === citation.chunkId),
    );
    const citedText = evidence.chunks
      .filter((chunk) => parsed.citations.some((item) => item.chunkId === chunk.chunkId))
      .map((chunk) => chunk.content)
      .join('\n');
    const limit = parsed.financialFacts.coverageLimit;
    const deductible = parsed.financialFacts.deductible;
    if (
      (limit !== undefined && !amountAppearsInText(limit, citedText)) ||
      (deductible !== undefined && !amountAppearsInText(deductible, citedText))
    ) {
      await this.analyses.create({
        ...blank(claim, version, AnalysisStatus.Failed, 'AI_FACT_CONFLICT'),
        coverageResult: parsed.coverage,
        exclusions: parsed.exclusions,
        anomalies: parsed.anomalies,
        recommendation: parsed.recommendation,
        aiReasoning: parsed.coverage.reasoning,
        citations: cited,
      });
      throw new UnprocessableEntityException('AI_FACT_CONFLICT');
    }

    const rejected = !parsed.coverage.covered || parsed.exclusions.applicable;
    if (rejected) {
      const saved = await this.analyses.create({
        ...filled(claim, version, parsed, cited, moneyOrNull(limit), moneyOrNull(deductible), '0.00', 'REJECT'),
      });
      return toView(saved, claim, version);
    }

    if (limit === undefined || deductible === undefined) {
      const saved = await this.analyses.create({
        ...blank(claim, version, AnalysisStatus.InsufficientEvidence, null),
        coverageResult: parsed.coverage,
        exclusions: parsed.exclusions,
        anomalies: parsed.anomalies,
        aiReasoning: parsed.coverage.reasoning,
        citations: cited,
      });
      return toView(saved, claim, version, INSUFFICIENT_EVIDENCE_MESSAGE);
    }

    let payout: string;
    try {
      payout = calculatePayout({
        claimedAmount: Number(claim.claimedAmount),
        coverageLimit: limit,
        deductible,
      }).toFixed(2);
    } catch (error) {
      if (error instanceof CalculationError) {
        await this.analyses.create(blank(claim, version, AnalysisStatus.Failed, 'CALCULATION_ERROR'));
        throw new InternalServerErrorException('CALCULATION_ERROR');
      }
      throw error;
    }

    const decision: AnalysisDecision = parsed.anomalies.detected ? 'REVIEW' : parsed.recommendation.decision;
    const saved = await this.analyses.create(
      filled(claim, version, parsed, cited, limit.toFixed(2), deductible.toFixed(2), payout, decision),
    );
    return toView(saved, claim, version);
  }

  private async requireClaim(claimId: string, actor: ClaimActor): Promise<Claim> {
    const claim = await this.claims.findById(claimId);
    if (!claim) {
      throw new NotFoundException('CLAIM_NOT_FOUND');
    }
    if (actor.role !== UserRole.Admin && claim.createdBy !== actor.id) {
      throw new ForbiddenException('UNAUTHORIZED_CLAIM_ACCESS');
    }
    return claim;
  }

  private async fail(claim: Claim, version: Policy, error: unknown): Promise<never> {
    if (error instanceof AiInvalidResponseError) {
      await this.analyses.create(blank(claim, version, AnalysisStatus.Failed, 'AI_INVALID_RESPONSE'));
      throw new BadGatewayException('AI_INVALID_RESPONSE');
    }
    await this.analyses.create(blank(claim, version, AnalysisStatus.Failed, 'AI_PROVIDER_ERROR'));
    throw new BadGatewayException('AI_PROVIDER_ERROR');
  }
}

function requestFor(claim: Claim, version: Policy, evidence: CollectedEvidence): AnalysisRequest {
  return {
    responseLanguage: /[\u0600-\u06FF]/.test(claim.description) ? 'ar' : 'en',
    claim: {
      claimNumber: claim.claimNumber,
      incidentDate: dateOnly(claim.incidentDate),
      claimType: claim.claimType,
      claimedAmount: decimal(claim.claimedAmount),
      description: claim.description,
    },
    policy: {
      policyId: version.id,
      version: version.version,
      effectiveFrom: dateOnly(version.effectiveFrom),
      effectiveTo: version.effectiveTo ? dateOnly(version.effectiveTo) : null,
    },
    evidence: evidence.chunks,
  };
}

function blank(claim: Claim, version: Policy, status: AnalysisStatus, errorCode: string | null): NewClaimAnalysis {
  return {
    claimId: claim.id,
    policyVersionId: version.id,
    status,
    errorCode,
    coverageResult: null,
    exclusions: null,
    anomalies: null,
    coverageLimit: null,
    deductible: null,
    claimedAmount: decimal(claim.claimedAmount),
    calculatedPayout: null,
    recommendation: null,
    aiReasoning: null,
    citations: null,
    promptVersion: CLAIM_ANALYSIS_PROMPT_VERSION,
  };
}

function filled(
  claim: Claim,
  version: Policy,
  parsed: AiClaimAnalysis,
  citations: Citation[],
  coverageLimit: string | null,
  deductible: string | null,
  payout: string,
  decision: AnalysisDecision,
): NewClaimAnalysis {
  return {
    ...blank(claim, version, AnalysisStatus.Completed, null),
    coverageResult: parsed.coverage,
    exclusions: parsed.exclusions,
    anomalies: parsed.anomalies,
    coverageLimit,
    deductible,
    calculatedPayout: payout,
    recommendation: { decision, reasoning: parsed.recommendation.reasoning },
    aiReasoning: parsed.coverage.reasoning,
    citations,
  };
}

function toView(analysis: ClaimAnalysis, claim: Claim, version: Policy, message: string | null = null): AnalysisView {
  return {
    id: analysis.id,
    status: analysis.status,
    message: analysis.status === AnalysisStatus.InsufficientEvidence ? (message ?? INSUFFICIENT_EVIDENCE_MESSAGE) : message,
    errorCode: analysis.errorCode,
    claim: {
      id: claim.id,
      claimNumber: claim.claimNumber,
      incidentDate: dateOnly(claim.incidentDate),
      claimType: claim.claimType,
      claimedAmount: decimal(claim.claimedAmount),
    },
    policy: {
      id: version.id,
      versionId: version.id,
      versionNumber: version.version,
      effectiveFrom: dateOnly(version.effectiveFrom),
      effectiveTo: version.effectiveTo ? dateOnly(version.effectiveTo) : null,
    },
    coverage: analysis.coverageResult,
    exclusions: analysis.exclusions,
    anomalies: analysis.anomalies,
    financials: {
      claimedAmount: decimal(analysis.claimedAmount),
      coverageLimit: analysis.coverageLimit ? decimal(analysis.coverageLimit) : null,
      deductible: analysis.deductible ? decimal(analysis.deductible) : null,
      payout: analysis.calculatedPayout ? decimal(analysis.calculatedPayout) : null,
    },
    recommendation: analysis.recommendation,
    evidence: analysis.citations ?? [],
  };
}

function moneyOrNull(value: number | undefined): string | null {
  return value === undefined ? null : value.toFixed(2);
}

function decimal(value: string | number): string {
  return Number(value).toFixed(2);
}

function dateOnly(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}
