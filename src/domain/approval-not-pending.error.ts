export class ApprovalNotPendingError extends Error {
  constructor() {
    super('APPROVAL_NOT_PENDING');
    this.name = 'ApprovalNotPendingError';
  }
}
