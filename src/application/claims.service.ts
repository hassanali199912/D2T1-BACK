import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PublicUser, toPublicUser } from './public-user.js';
import { ClaimStatus } from '../domain/claim-status.js';
import { ClaimType } from '../domain/claim-type.js';
import { ClaimPageQuery, ClaimsRepository, ClaimUpdate } from '../domain/claims.repository.js';
import { DuplicateClaimNumberError } from '../domain/duplicate-claim-number.error.js';
import { Claim } from '../domain/entity/claim.entity.js';
import { UserRole } from '../domain/entity/user.entity.js';
import { PolicyLanguage } from '../domain/policy-language.js';
import { PolicyType } from '../domain/policy-type.js';
import { PoliciesRepository } from '../domain/policies.repository.js';
import { UsersRepository } from '../domain/users.repository.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER_ATTEMPTS = 3;

export type ClaimTypeOption = {
  value: ClaimType;
  label: string;
};

export type ClaimActor = {
  id: string;
  role: UserRole;
};

export type ClaimPolicySummary = {
  id: string;
  name: string;
  version: string;
  type: PolicyType;
  language: PolicyLanguage;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type ClaimView = {
  id: string;
  claimNumber: string;
  incidentDate: string;
  claimType: ClaimType;
  claimedAmount: string;
  description: string;
  status: ClaimStatus;
  createdAt: string;
  updatedAt: string;
  policy: ClaimPolicySummary;
  createdBy: PublicUser;
};

export type ClaimList = {
  items: ClaimView[];
  page: number;
  limit: number;
  total: number;
};

export type CreateClaimInput = {
  policyId: string;
  incidentDate: string;
  claimType: ClaimType;
  claimedAmount: number;
  description: string;
};

export type UpdateClaimInput = {
  claimType?: ClaimType;
  claimedAmount?: number;
  description?: string;
  incidentDate?: string;
};

@Injectable()
export class ClaimsService {
  constructor(
    private readonly claimsRepository: ClaimsRepository,
    private readonly policiesRepository: PoliciesRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  assertTransition(_from: ClaimStatus, _to: ClaimStatus): void {
    throw new BadRequestException('INVALID_CLAIM_STATUS_TRANSITION');
  }

  async create(input: CreateClaimInput, actor: ClaimActor): Promise<ClaimView> {
    const creator = await this.usersRepository.findById(actor.id);
    if (!creator) {
      throw new UnauthorizedException('Invalid access token');
    }

    const policy = await this.policiesRepository.findById(input.policyId);
    if (!policy) {
      throw new NotFoundException('POLICY_NOT_FOUND');
    }

    const incidentDate = assertIncidentDate(input.incidentDate);
    const claimedAmount = assertAmount(input.claimedAmount);
    const description = assertDescription(input.description);

    for (let attempt = 0; attempt < NUMBER_ATTEMPTS; attempt += 1) {
      const claimNumber = await this.claimsRepository.nextClaimNumber();
      try {
        const saved = await this.claimsRepository.create({
          claimNumber,
          policyId: policy.id,
          incidentDate,
          claimType: input.claimType,
          claimedAmount,
          description,
          status: ClaimStatus.Submitted,
          createdBy: creator.id,
        });
        return toClaimView(saved);
      } catch (error) {
        if (error instanceof DuplicateClaimNumberError && attempt < NUMBER_ATTEMPTS - 1) {
          continue;
        }
        if (error instanceof DuplicateClaimNumberError) {
          throw new ConflictException('DUPLICATE_CLAIM_NUMBER');
        }
        throw error;
      }
    }

    throw new ConflictException('DUPLICATE_CLAIM_NUMBER');
  }

  listTypes(): ClaimTypeOption[] {
    return [
      { value: ClaimType.Collision, label: 'Collision' },
      { value: ClaimType.Theft, label: 'Theft' },
      { value: ClaimType.Fire, label: 'Fire' },
      { value: ClaimType.Other, label: 'Other' },
    ];
  }

  async findPage(query: ClaimPageQuery, actor: ClaimActor): Promise<ClaimList> {
    const page = query.page > 0 ? query.page : 1;
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const result = await this.claimsRepository.findPage({
      ...query,
      page,
      limit,
      search: query.search?.trim() || undefined,
      createdBy: actor.role === UserRole.Admin ? query.createdBy : actor.id,
    });

    return {
      items: result.items.map(toClaimView),
      page,
      limit,
      total: result.total,
    };
  }

  async findById(id: string, actor: ClaimActor): Promise<ClaimView> {
    const claim = await this.requireClaim(id, actor);
    return toClaimView(claim);
  }

  async update(id: string, input: UpdateClaimInput, actor: ClaimActor): Promise<ClaimView> {
    const current = await this.requireClaim(id, actor);
    const update: ClaimUpdate = {};
    if (input.claimType !== undefined) {
      update.claimType = input.claimType;
    }
    if (input.claimedAmount !== undefined) {
      update.claimedAmount = assertAmount(input.claimedAmount);
    }
    if (input.description !== undefined) {
      update.description = assertDescription(input.description);
    }
    if (input.incidentDate !== undefined) {
      update.incidentDate = assertIncidentDate(input.incidentDate);
    }
    if (Object.keys(update).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    const saved = await this.claimsRepository.update(current.id, update);
    return toClaimView(saved);
  }

  private async requireClaim(id: string, actor: ClaimActor): Promise<Claim> {
    const claim = await this.claimsRepository.findById(id);
    if (!claim) {
      throw new NotFoundException('CLAIM_NOT_FOUND');
    }
    if (actor.role !== UserRole.Admin && claim.createdBy !== actor.id) {
      throw new ForbiddenException('UNAUTHORIZED_CLAIM_ACCESS');
    }
    return claim;
  }
}

function assertIncidentDate(value: string): string {
  if (!DATE.test(value)) {
    throw new BadRequestException('INVALID_INCIDENT_DATE');
  }
  const [year, month, day] = value.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const real =
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
  const today = new Date().toISOString().slice(0, 10);
  if (!real || value > today) {
    throw new BadRequestException('INVALID_INCIDENT_DATE');
  }
  return value;
}

function assertAmount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    throw new BadRequestException('INVALID_CLAIM_AMOUNT');
  }
  const text = value.toFixed(2);
  if (Math.abs(Number(text) - value) > 1e-6) {
    throw new BadRequestException('INVALID_CLAIM_AMOUNT');
  }
  return text;
}

function assertDescription(value: string): string {
  const description = value.trim();
  if (!description) {
    throw new BadRequestException('description must not be empty');
  }
  return description;
}

function toClaimView(claim: Claim): ClaimView {
  return {
    id: claim.id,
    claimNumber: claim.claimNumber,
    incidentDate: dateOnly(claim.incidentDate),
    claimType: claim.claimType,
    claimedAmount: Number(claim.claimedAmount).toFixed(2),
    description: claim.description,
    status: claim.status,
    createdAt: new Date(claim.createdAt).toISOString(),
    updatedAt: new Date(claim.updatedAt).toISOString(),
    policy: {
      id: claim.policy?.id ?? claim.policyId,
      name: claim.policy.name,
      version: claim.policy.version,
      type: claim.policy.type,
      language: claim.policy.language,
      effectiveFrom: dateOnly(claim.policy.effectiveFrom),
      effectiveTo: claim.policy.effectiveTo ? dateOnly(claim.policy.effectiveTo) : null,
    },
    createdBy: toPublicUser(claim.creator),
  };
}

function dateOnly(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}
