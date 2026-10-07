import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClaimAnalysesRepository, NewClaimAnalysis } from '../domain/claim-analyses.repository.js';
import { Claim } from '../domain/entity/claim.entity.js';
import { ClaimAnalysis } from '../domain/entity/claim-analysis.entity.js';
import { Policy } from '../domain/entity/policy.entity.js';

@Injectable()
export class ClaimAnalysesTypeOrmRepository extends ClaimAnalysesRepository {
  constructor(
    @InjectRepository(ClaimAnalysis)
    private readonly analyses: Repository<ClaimAnalysis>,
  ) {
    super();
  }

  async create(analysis: NewClaimAnalysis): Promise<ClaimAnalysis> {
    const saved = await this.analyses.save(
      this.analyses.create({
        ...analysis,
        claim: { id: analysis.claimId } as Claim,
        policyVersion: { id: analysis.policyVersionId } as Policy,
      }),
    );
    const loaded = await this.findById(saved.id);
    if (!loaded) {
      throw new Error('Claim analysis disappeared after insert');
    }
    return loaded;
  }

  findLatestByClaimId(claimId: string): Promise<ClaimAnalysis | null> {
    return this.analyses.findOne({
      where: { claimId },
      order: { createdAt: 'DESC' },
      relations: { claim: true, policyVersion: true },
    });
  }

  private findById(id: string): Promise<ClaimAnalysis | null> {
    return this.analyses.findOne({
      where: { id },
      relations: { claim: true, policyVersion: true },
    });
  }
}
