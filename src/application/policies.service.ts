import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Policy } from '../domain/entity/policy.entity.js';
import { PoliciesRepository } from '../domain/policies.repository.js';
import { PolicyLanguage } from '../domain/policy-language.js';
import { PolicyType } from '../domain/policy-type.js';
import { files } from '../infrastructure/files.js';

export type CreatePolicyInput = {
  name: string;
  type: PolicyType;
  description?: string | null;
  version: string;
  language: PolicyLanguage;
  effectiveFrom: string;
  effectiveTo?: string | null;
};

@Injectable()
export class PoliciesService {
  constructor(private readonly policiesRepository: PoliciesRepository) {}

  async create(input: CreatePolicyInput, document: Express.Multer.File): Promise<Policy> {
    const name = input.name.trim();
    const version = input.version.trim();
    const existing = await this.policiesRepository.findByIdentity({
      name,
      version,
      language: input.language,
    });
    if (existing) {
      throw new ConflictException('A policy with this name, version, and language already exists');
    }

    const stored = await files.add(document);
    try {
      return await this.policiesRepository.create({
        name,
        type: input.type,
        description: blankToNull(input.description),
        version,
        language: input.language,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: blankToNull(input.effectiveTo),
        documentUrl: stored.url,
      });
    } catch (error) {
      await files.remove(stored.name);
      throw error;
    }
  }

  findAll(): Promise<Policy[]> {
    return this.policiesRepository.findAll();
  }

  async findById(id: string): Promise<Policy> {
    const policy = await this.policiesRepository.findById(id);
    if (!policy) {
      throw new NotFoundException('Policy not found');
    }
    return policy;
  }

  async remove(id: string): Promise<void> {
    const policy = await this.findById(id);
    await this.policiesRepository.deleteById(id);
    const documentName = policy.documentUrl.split('/').pop();
    if (documentName) {
      await files.remove(documentName);
    }
  }
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
