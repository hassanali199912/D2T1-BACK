import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ClaimPage, ClaimPageQuery, ClaimsRepository, ClaimUpdate, NewClaim } from '../domain/claims.repository.js';
import { DuplicateClaimNumberError } from '../domain/duplicate-claim-number.error.js';
import { Claim } from '../domain/entity/claim.entity.js';
import { Policy } from '../domain/entity/policy.entity.js';
import { User } from '../domain/entity/user.entity.js';
import { postgresCode } from './postgres-error.js';

@Injectable()
export class ClaimsTypeOrmRepository extends ClaimsRepository implements OnModuleInit {
  constructor(
    @InjectRepository(Claim)
    private readonly claims: Repository<Claim>,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.claims.query('CREATE SEQUENCE IF NOT EXISTS claim_number_seq');
  }

  async create(claim: NewClaim): Promise<Claim> {
    try {
      const saved = await this.claims.save(
        this.claims.create({
          claimNumber: claim.claimNumber,
          policyId: claim.policyId,
          policy: { id: claim.policyId } as Policy,
          incidentDate: claim.incidentDate,
          claimType: claim.claimType,
          claimedAmount: claim.claimedAmount,
          description: claim.description,
          status: claim.status,
          createdBy: claim.createdBy,
          creator: { id: claim.createdBy } as User,
        }),
      );
      return (await this.findById(saved.id)) ?? saved;
    } catch (error) {
      if (error instanceof QueryFailedError && postgresCode(error) === '23505') {
        throw new DuplicateClaimNumberError();
      }
      throw error;
    }
  }

  async update(id: string, update: ClaimUpdate): Promise<Claim> {
    await this.claims.update(id, update);
    const claim = await this.findById(id);
    if (!claim) {
      throw new Error('Claim disappeared during update');
    }
    return claim;
  }

  findById(id: string): Promise<Claim | null> {
    return this.claims.findOne({
      where: { id },
      relations: { policy: true, creator: true },
    });
  }

  async findPage(query: ClaimPageQuery): Promise<ClaimPage> {
    const builder = this.claims
      .createQueryBuilder('claim')
      .leftJoinAndSelect('claim.policy', 'policy')
      .leftJoinAndSelect('claim.creator', 'creator')
      .orderBy('claim.createdAt', 'DESC')
      .addOrderBy('claim.claimNumber', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (query.search) {
      builder.andWhere(`claim.claimNumber ILIKE :search ESCAPE '\\'`, { search: contains(query.search) });
    }
    if (query.status) {
      builder.andWhere('claim.status = :status', { status: query.status });
    }
    if (query.claimType) {
      builder.andWhere('claim.claimType = :claimType', { claimType: query.claimType });
    }
    if (query.policyId) {
      builder.andWhere('claim.policyId = :policyId', { policyId: query.policyId });
    }
    if (query.dateFrom) {
      builder.andWhere('claim.incidentDate >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      builder.andWhere('claim.incidentDate <= :dateTo', { dateTo: query.dateTo });
    }
    if (query.createdBy) {
      builder.andWhere('claim.createdBy = :createdBy', { createdBy: query.createdBy });
    }

    const [items, total] = await builder.getManyAndCount();
    return { items, total };
  }

  async nextClaimNumber(): Promise<string> {
    const rows: Array<{ value: string }> = await this.claims.query(
      `SELECT nextval('claim_number_seq')::text AS value`,
    );
    return `CLM-${String(rows[0]?.value ?? '0').padStart(6, '0')}`;
  }
}

function contains(value: string): string {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
