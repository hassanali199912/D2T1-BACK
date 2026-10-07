import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Policy } from '../domain/entity/policy.entity.js';
import { PoliciesRepository } from '../domain/policies.repository.js';
import { PolicyInUseError } from '../domain/policy-in-use.error.js';
import { PolicyIndexStatus } from '../domain/policy-index-status.js';
import { PolicyLanguage } from '../domain/policy-language.js';
import { PolicyType } from '../domain/policy-type.js';
import { files } from '../infrastructure/files.js';
import { IngestionService } from './ingestion.service.js';

export type PolicyOption = {
  id: string;
  name: string;
  version: string;
  language: PolicyLanguage;
  type: PolicyType;
};

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
  private readonly logger = new Logger(PoliciesService.name);

  constructor(
    private readonly policiesRepository: PoliciesRepository,
    private readonly ingestion: IngestionService,
  ) {}

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

    assertSupportedDocument(document);
    const stored = await files.add(document);
    try {
      const policy = await this.policiesRepository.create({
        name,
        type: input.type,
        description: blankToNull(input.description),
        version,
        language: input.language,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: blankToNull(input.effectiveTo),
        documentUrl: stored.url,
        status: PolicyIndexStatus.Uploaded,
        currentStage: null,
        errorCode: null,
        errorMessage: null,
      });
      void this.ingestion.ingest(policy.id).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Policy ingestion failed';
        this.logger.error(message, error instanceof Error ? error.stack : undefined);
      });
      return policy;
    } catch (error) {
      await files.remove(stored.name);
      throw error;
    }
  }

  findAll(): Promise<Policy[]> {
    return this.policiesRepository.findAll();
  }

  async listOptions(): Promise<PolicyOption[]> {
    const policies = await this.policiesRepository.findAll();
    return policies.map((policy) => ({
      id: policy.id,
      name: policy.name,
      version: policy.version,
      language: policy.language,
      type: policy.type,
    }));
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
    try {
      await this.policiesRepository.deleteById(id);
    } catch (error) {
      if (error instanceof PolicyInUseError) {
        throw new ConflictException('POLICY_HAS_CLAIMS');
      }
      throw error;
    }
    await this.ingestion.clear(id);
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

const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function assertSupportedDocument(file: Express.Multer.File): void {
  const name = file.originalname?.toLowerCase() ?? '';
  const mime = file.mimetype?.toLowerCase() ?? '';
  const pdf = name.endsWith('.pdf') && (mime === '' || mime === PDF_MIME || mime === 'application/octet-stream');
  const docx =
    name.endsWith('.docx') && (mime === '' || mime === DOCX_MIME || mime === 'application/octet-stream');
  if (!pdf && !docx) {
    throw new BadRequestException('Only PDF and DOCX documents are accepted');
  }
}
