import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Policy } from '../domain/entity/policy.entity.js';
import { NewPolicy, PoliciesRepository, PolicyIdentity, PolicyIndexUpdate } from '../domain/policies.repository.js';
import { PolicyLanguage } from '../domain/policy-language.js';
import { PolicyInUseError } from '../domain/policy-in-use.error.js';
import { postgresCode } from './postgres-error.js';

@Injectable()
export class PoliciesTypeOrmRepository extends PoliciesRepository {
  constructor(
    @InjectRepository(Policy)
    private readonly policies: Repository<Policy>,
  ) {
    super();
  }

  create(policy: NewPolicy): Promise<Policy> {
    return this.policies.save(this.policies.create(policy));
  }

  findAll(): Promise<Policy[]> {
    return this.policies.find({ order: { name: 'ASC', version: 'ASC' } });
  }

  findById(id: string): Promise<Policy | null> {
    return this.policies.findOne({ where: { id } });
  }

  findByIdentity(identity: PolicyIdentity): Promise<Policy | null> {
    return this.policies.findOne({ where: identity });
  }

  findFamily(name: string, language: PolicyLanguage): Promise<Policy[]> {
    return this.policies.find({
      where: { name, language },
      order: { effectiveFrom: 'ASC', version: 'ASC' },
    });
  }

  async deleteById(id: string): Promise<void> {
    try {
      await this.policies.delete(id);
    } catch (error) {
      if (postgresCode(error) === '23503') {
        throw new PolicyInUseError();
      }
      throw error;
    }
  }

  async updateIndexState(id: string, update: PolicyIndexUpdate): Promise<void> {
    await this.policies.update(id, update);
  }
}
