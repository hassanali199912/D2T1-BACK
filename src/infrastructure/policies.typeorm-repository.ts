import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Policy } from '../domain/entity/policy.entity.js';
import { NewPolicy, PoliciesRepository, PolicyIdentity, PolicyIndexUpdate } from '../domain/policies.repository.js';

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

  async deleteById(id: string): Promise<void> {
    await this.policies.delete(id);
  }

  async updateIndexState(id: string, update: PolicyIndexUpdate): Promise<void> {
    await this.policies.update(id, update);
  }
}
