import { AiInvalidResponseError, parseAiClaimAnalysis } from './ai-claim-analysis.js';
import { amountAppearsInText } from './money-evidence.js';

const chunkId = 'chunk-1';

describe('parseAiClaimAnalysis', () => {
  it('accepts a covered analysis that cites a supplied chunk', () => {
    const parsed = parseAiClaimAnalysis(validAnalysis(), new Set([chunkId]));
    expect(parsed.coverage.covered).toBe(true);
    expect(parsed.financialFacts.coverageLimit).toBe(60000);
  });

  it('rejects an unknown recommendation', () => {
    const body = validAnalysis();
    body.recommendation = { decision: 'MAYBE', reasoning: 'Unsure.' };
    expect(() => parseAiClaimAnalysis(body, new Set([chunkId]))).toThrow(AiInvalidResponseError);
  });

  it('rejects a citation that was not retrieved', () => {
    const body = validAnalysis();
    body.citations = [{ chunkId: 'other-chunk' }];
    expect(() => parseAiClaimAnalysis(body, new Set([chunkId]))).toThrow(AiInvalidResponseError);
  });
});

describe('amountAppearsInText', () => {
  const evidence = 'Coverage limit 60,000. Deductible 10,000.';

  it('matches a formatted amount and a reversed digit run', () => {
    expect(amountAppearsInText(60000, evidence)).toBe(true);
    expect(amountAppearsInText(500, 'Deductible 005')).toBe(true);
  });

  it('rejects a limit that is not in the cited text', () => {
    expect(amountAppearsInText(100000, evidence)).toBe(false);
  });
});

function validAnalysis(): Record<string, unknown> {
  return {
    coverage: { covered: true, reasoning: 'Collision is covered.' },
    exclusions: { applicable: false, items: [] },
    anomalies: { detected: false, items: [] },
    financialFacts: { coverageLimit: 60000, deductible: 10000 },
    recommendation: { decision: 'APPROVE', reasoning: 'Covered collision with no exclusion.' },
    citations: [{ chunkId }],
  };
}
