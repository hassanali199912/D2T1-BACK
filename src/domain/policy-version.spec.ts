import { Policy } from './entity/policy.entity.js';
import { PolicyLanguage } from './policy-language.js';
import { PolicyIndexStatus } from './policy-index-status.js';
import { PolicyType } from './policy-type.js';
import { NoApplicablePolicyVersionError, selectPolicyVersion } from './policy-version.js';

describe('selectPolicyVersion', () => {
  const family = [
    version('v1', '1', '2024-01-01', '2025-01-01'),
    version('v2', '2', '2025-01-01', '2026-01-01'),
    version('v3', '3', '2026-01-01', '2027-01-01'),
  ];

  it('selects the version that covers the incident date', () => {
    expect(selectPolicyVersion(family, '2026-08-15').id).toBe('v3');
  });

  it('refuses a date outside every version', () => {
    expect(() => selectPolicyVersion(family, '2023-06-01')).toThrow(NoApplicablePolicyVersionError);
  });

  it('refuses when more than one version covers the date', () => {
    const overlapping = [
      version('a', '1', '2026-01-01', '2026-12-31'),
      version('b', '2', '2026-06-01', null),
    ];
    expect(() => selectPolicyVersion(overlapping, '2026-08-15')).toThrow(NoApplicablePolicyVersionError);
  });
});

function version(id: string, number: string, effectiveFrom: string, effectiveTo: string | null): Policy {
  return {
    id,
    name: 'Motor',
    type: PolicyType.MOTOR,
    description: null,
    version: number,
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
