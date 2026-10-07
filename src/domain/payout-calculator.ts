export type PayoutCalculationInput = {
  claimedAmount: number;
  coverageLimit: number;
  deductible: number;
};

export class CalculationError extends Error {
  constructor() {
    super('CALCULATION_ERROR');
    this.name = 'CalculationError';
  }
}

export function calculatePayout(input: PayoutCalculationInput): number {
  const claimed = cents(input.claimedAmount);
  const limit = cents(input.coverageLimit);
  const deductible = cents(input.deductible);
  const covered = Math.min(claimed, limit);
  return Math.max(covered - deductible, 0) / 100;
}

function cents(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new CalculationError();
  }
  return Math.round(value * 100);
}
