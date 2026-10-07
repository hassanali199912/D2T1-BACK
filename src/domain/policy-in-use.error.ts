export class PolicyInUseError extends Error {
  constructor() {
    super('POLICY_HAS_CLAIMS');
    this.name = 'PolicyInUseError';
  }
}
