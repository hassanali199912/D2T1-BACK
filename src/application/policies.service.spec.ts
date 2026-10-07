import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Policy } from '../domain/entity/policy.entity.js';
import { PolicyInUseError } from '../domain/policy-in-use.error.js';
import { NewPolicy, PoliciesRepository, PolicyIdentity, PolicyIndexUpdate } from '../domain/policies.repository.js';
import { PolicyIndexStatus } from '../domain/policy-index-status.js';
import { PolicyLanguage } from '../domain/policy-language.js';
import { PolicyType } from '../domain/policy-type.js';
import { files } from '../infrastructure/files.js';
import { IngestionService } from './ingestion.service.js';
import { PoliciesService } from './policies.service.js';

class InMemoryPoliciesRepository extends PoliciesRepository {
  policies: Policy[] = [];

  create(policy: NewPolicy): Promise<Policy> {
    const saved = { ...policy, id: 'policy-1' } as Policy;
    this.policies.push(saved);
    return Promise.resolve(saved);
  }

  findAll(): Promise<Policy[]> {
    return Promise.resolve(this.policies);
  }

  findById(id: string): Promise<Policy | null> {
    return Promise.resolve(this.policies.find((policy) => policy.id === id) ?? null);
  }

  findFamily(name: string, language: PolicyLanguage): Promise<Policy[]> {
    return Promise.resolve(
      this.policies.filter((policy) => policy.name === name && policy.language === language),
    );
  }

  findByIdentity(identity: PolicyIdentity): Promise<Policy | null> {
    return Promise.resolve(
      this.policies.find(
        (policy) =>
          policy.name === identity.name &&
          policy.version === identity.version &&
          policy.language === identity.language,
      ) ?? null,
    );
  }

  async deleteById(id: string): Promise<void> {
    this.policies = this.policies.filter((policy) => policy.id !== id);
  }

  async updateIndexState(id: string, update: PolicyIndexUpdate): Promise<void> {
    const policy = this.policies.find((item) => item.id === id);
    if (policy) {
      Object.assign(policy, update);
    }
  }
}

const input = {
  name: ' Health Cover ',
  type: PolicyType.HEALTH,
  description: '  ',
  version: ' 1.0 ',
  language: PolicyLanguage.EN,
  effectiveFrom: '2026-01-01',
  effectiveTo: '',
};

function pdfFile(): Express.Multer.File {
  return { originalname: 'policy.pdf', mimetype: 'application/pdf' } as Express.Multer.File;
}

describe('PoliciesService', () => {
  let repository: InMemoryPoliciesRepository;
  let ingestion: FakeIngestion;
  let service: PoliciesService;

  beforeEach(() => {
    repository = new InMemoryPoliciesRepository();
    ingestion = new FakeIngestion();
    service = new PoliciesService(repository, ingestion as unknown as IngestionService);
    vi.spyOn(files, 'add').mockResolvedValue({
      name: 'doc.pdf',
      url: '/uploads/doc.pdf',
    });
    vi.spyOn(files, 'remove').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a policy from the uploaded document and clears blank text', async () => {
    const created = await service.create(input, pdfFile());

    expect(created).toMatchObject({
      id: 'policy-1',
      name: 'Health Cover',
      type: PolicyType.HEALTH,
      description: null,
      version: '1.0',
      language: PolicyLanguage.EN,
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      documentUrl: '/uploads/doc.pdf',
      status: PolicyIndexStatus.Uploaded,
      currentStage: null,
      errorCode: null,
      errorMessage: null,
    });
    expect(files.add).toHaveBeenCalledOnce();
    expect(ingestion.ids).toEqual(['policy-1']);
  });

  it('lists policy names for a select control', async () => {
    await service.create(input, pdfFile());

    await expect(service.listOptions()).resolves.toEqual([
      {
        id: 'policy-1',
        name: 'Health Cover',
        version: '1.0',
        language: PolicyLanguage.EN,
        type: PolicyType.HEALTH,
      },
    ]);
  });

  it('rejects a file that is not a PDF or DOCX before saving it', async () => {
    await expect(
      service.create(input, {
        originalname: 'notes.txt',
        mimetype: 'text/plain',
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(files.add).not.toHaveBeenCalled();
    expect(ingestion.ids).toEqual([]);
  });

  it('rejects a duplicate name, version, and language before saving a file', async () => {
    await service.create(input, pdfFile());

    await expect(service.create(input, {} as Express.Multer.File)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(files.add).toHaveBeenCalledOnce();
    expect(ingestion.ids).toEqual(['policy-1']);
  });

  it('removes the saved file when storing the policy fails', async () => {
    vi.spyOn(repository, 'create').mockRejectedValueOnce(new Error('db down'));

    await expect(service.create(input, pdfFile())).rejects.toThrow('db down');
    expect(files.remove).toHaveBeenCalledWith('doc.pdf');
    expect(ingestion.ids).toEqual([]);
  });

  it('returns policies and throws when an id is missing', async () => {
    await service.create(input, pdfFile());

    await expect(service.findAll()).resolves.toHaveLength(1);
    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes the policy and its document', async () => {
    await service.create(input, pdfFile());

    await service.remove('policy-1');

    expect(repository.policies).toHaveLength(0);
    expect(ingestion.cleared).toEqual(['policy-1']);
    expect(files.remove).toHaveBeenCalledWith('doc.pdf');
  });

  it('keeps the policy when claims still reference it', async () => {
    await service.create(input, pdfFile());
    repository.deleteById = () => Promise.reject(new PolicyInUseError());

    await expect(service.remove('policy-1')).rejects.toBeInstanceOf(ConflictException);
    expect(ingestion.cleared).toEqual([]);
    expect(repository.policies).toHaveLength(1);
  });
});

class FakeIngestion {
  ids: string[] = [];
  cleared: string[] = [];

  ingest(id: string): Promise<void> {
    this.ids.push(id);
    return Promise.resolve();
  }

  clear(id: string): Promise<void> {
    this.cleared.push(id);
    return Promise.resolve();
  }
}
