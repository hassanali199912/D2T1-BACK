import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PolicyChunk } from '../domain/entity/policy-chunk.entity.js';
import { NewPolicyChunk, PolicyChunksRepository } from '../domain/policy-chunks.repository.js';

@Injectable()
export class PolicyChunksTypeOrmRepository extends PolicyChunksRepository {
  constructor(
    @InjectRepository(PolicyChunk)
    private readonly chunks: Repository<PolicyChunk>,
  ) {
    super();
  }

  async replace(policyId: string, chunks: NewPolicyChunk[]): Promise<PolicyChunk[]> {
    await this.deleteByPolicyId(policyId);
    if (chunks.length === 0) {
      return [];
    }
    return this.chunks.save(chunks.map((chunk) => this.chunks.create(chunk)));
  }

  async deleteByPolicyId(policyId: string): Promise<void> {
    await this.chunks.delete({ policyId });
  }
}
