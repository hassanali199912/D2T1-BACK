export class DuplicateClaimNumberError extends Error {
  constructor() {
    super('DUPLICATE_CLAIM_NUMBER');
    this.name = 'DuplicateClaimNumberError';
  }
}
