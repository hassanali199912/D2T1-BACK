import { calculatePayout } from './payout-calculator.js';

describe('calculatePayout', () => {
  it('pays the covered amount after the deductible', () => {
    expect(calculatePayout({ claimedAmount: 80000, coverageLimit: 60000, deductible: 10000 })).toBe(50000);
  });

  it('caps the claim at the coverage limit', () => {
    expect(calculatePayout({ claimedAmount: 90000, coverageLimit: 60000, deductible: 0 })).toBe(60000);
  });

  it('returns zero when the deductible exceeds the covered amount', () => {
    expect(calculatePayout({ claimedAmount: 1000, coverageLimit: 5000, deductible: 2000 })).toBe(0);
  });

  it('returns zero when the deductible equals the covered amount', () => {
    expect(calculatePayout({ claimedAmount: 100, coverageLimit: 100, deductible: 100 })).toBe(0);
  });
});
