import { ClaimStatus } from './claim-status.js';
import { ClaimType } from './claim-type.js';
import { Claim } from './entity/claim.entity.js';

export type NewClaim = {
  claimNumber: string;
  policyId: string;
  incidentDate: string;
  claimType: ClaimType;
  claimedAmount: string;
  description: string;
  status: ClaimStatus;
  createdBy: string;
};

export type ClaimUpdate = {
  claimType?: ClaimType;
  claimedAmount?: string;
  description?: string;
  incidentDate?: string;
};

export type ClaimPageQuery = {
  page: number;
  limit: number;
  search?: string;
  status?: ClaimStatus;
  claimType?: ClaimType;
  policyId?: string;
  dateFrom?: string;
  dateTo?: string;
  createdBy?: string;
};

export type ClaimPage = {
  items: Claim[];
  total: number;
};

export abstract class ClaimsRepository {
  abstract create(claim: NewClaim): Promise<Claim>;
  abstract update(id: string, update: ClaimUpdate): Promise<Claim>;
  abstract findById(id: string): Promise<Claim | null>;
  abstract findPage(query: ClaimPageQuery): Promise<ClaimPage>;
  abstract nextClaimNumber(): Promise<string>;
}
