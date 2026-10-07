import { AnalysisDecision } from './analysis-status.js';

export type AiExclusion = {
  name: string;
  reasoning: string;
};

export type AiCitation = {
  chunkId: string;
};

export type AiClaimAnalysis = {
  coverage: {
    covered: boolean;
    reasoning: string;
  };
  exclusions: {
    applicable: boolean;
    items: AiExclusion[];
  };
  anomalies: {
    detected: boolean;
    items: string[];
  };
  financialFacts: {
    coverageLimit?: number;
    deductible?: number;
  };
  recommendation: {
    decision: AnalysisDecision;
    reasoning: string;
  };
  citations: AiCitation[];
};

export class AiInvalidResponseError extends Error {
  constructor() {
    super('AI_INVALID_RESPONSE');
    this.name = 'AiInvalidResponseError';
  }
}

export class AiProviderError extends Error {
  constructor() {
    super('AI_PROVIDER_ERROR');
    this.name = 'AiProviderError';
  }
}

const DECISIONS = new Set<AnalysisDecision>(['APPROVE', 'REJECT', 'REVIEW']);

export function parseAiClaimAnalysis(value: unknown, allowedChunkIds: ReadonlySet<string>): AiClaimAnalysis {
  if (!isRecord(value)) {
    throw new AiInvalidResponseError();
  }
  const coverage = record(value.coverage);
  const exclusions = record(value.exclusions);
  const anomalies = record(value.anomalies);
  const financialFacts = record(value.financialFacts);
  const recommendation = record(value.recommendation);
  const covered = bool(coverage?.covered);
  const coverageReasoning = text(coverage?.reasoning);
  const applicable = bool(exclusions?.applicable);
  const items = exclusionItems(exclusions?.items);
  const detected = bool(anomalies?.detected);
  const anomalyItems = stringList(anomalies?.items);
  const decision = recommendation?.decision;
  const recommendationReasoning = text(recommendation?.reasoning);
  const citations = citationList(value.citations, allowedChunkIds);
  const coverageLimit = optionalAmount(financialFacts?.coverageLimit);
  const deductible = optionalAmount(financialFacts?.deductible);

  if (
    covered === undefined ||
    !coverageReasoning ||
    applicable === undefined ||
    !items ||
    (applicable && items.length === 0) ||
    detected === undefined ||
    !anomalyItems ||
    (detected && anomalyItems.length === 0) ||
    typeof decision !== 'string' ||
    !DECISIONS.has(decision as AnalysisDecision) ||
    !recommendationReasoning ||
    !citations ||
    citations.length === 0 ||
    !financialFacts ||
    coverageLimit === 'invalid' ||
    deductible === 'invalid'
  ) {
    throw new AiInvalidResponseError();
  }

  return {
    coverage: { covered, reasoning: coverageReasoning },
    exclusions: { applicable, items },
    anomalies: { detected, items: anomalyItems },
    financialFacts: {
      ...(typeof coverageLimit === 'number' ? { coverageLimit } : {}),
      ...(typeof deductible === 'number' ? { deductible } : {}),
    },
    recommendation: { decision: decision as AnalysisDecision, reasoning: recommendationReasoning },
    citations,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function bool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function exclusionItems(value: unknown): AiExclusion[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items: AiExclusion[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return undefined;
    }
    const name = text(item.name);
    const reasoning = text(item.reasoning);
    if (!name || !reasoning) {
      return undefined;
    }
    items.push({ name, reasoning });
  }
  return items;
}

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items: string[] = [];
  for (const item of value) {
    const line = text(item);
    if (!line) {
      return undefined;
    }
    items.push(line);
  }
  return items;
}

function citationList(value: unknown, allowedChunkIds: ReadonlySet<string>): AiCitation[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const citations: AiCitation[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.chunkId !== 'string' || !allowedChunkIds.has(item.chunkId)) {
      return undefined;
    }
    citations.push({ chunkId: item.chunkId });
  }
  return citations;
}

function optionalAmount(value: unknown): number | undefined | 'invalid' {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 'invalid';
  }
  return value;
}
