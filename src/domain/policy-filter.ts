export class ConflictingPolicyFilterError extends Error {
  constructor() {
    super('policyId, policyVersionId, and documentId must refer to the same policy');
    this.name = 'ConflictingPolicyFilterError';
  }
}

export function resolvePolicyId(ids: Array<string | undefined>): string | null {
  const present = ids.filter((id): id is string => Boolean(id));
  const unique = [...new Set(present)];
  if (unique.length > 1) {
    throw new ConflictingPolicyFilterError();
  }
  return unique[0] ?? null;
}
