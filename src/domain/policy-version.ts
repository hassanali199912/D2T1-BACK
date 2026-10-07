import { Policy } from './entity/policy.entity.js';

export class NoApplicablePolicyVersionError extends Error {
  constructor() {
    super('NO_APPLICABLE_POLICY_VERSION');
    this.name = 'NoApplicablePolicyVersionError';
  }
}

export function selectPolicyVersion(policies: Policy[], incidentDate: string): Policy {
  const day = dateOnly(incidentDate);
  const matches = policies.filter((policy) => covers(policy, day));
  if (matches.length !== 1) {
    throw new NoApplicablePolicyVersionError();
  }
  return matches[0];
}

function covers(policy: Policy, incidentDate: string): boolean {
  const from = dateOnly(policy.effectiveFrom);
  const to = policy.effectiveTo ? dateOnly(policy.effectiveTo) : null;
  return from <= incidentDate && (to === null || to >= incidentDate);
}

function dateOnly(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}
