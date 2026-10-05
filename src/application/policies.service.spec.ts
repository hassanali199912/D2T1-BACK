import { ConflictException, NotFoundException } from '@nestjs/common';
import { Policy } from '../domain/entity/policy.entity.js';
import { NewPolicy, PoliciesRepository, PolicyIdentity } from '../domain/policies.repository.js';
import { PolicyLanguage } from '../domain/policy-language.js';
import { PolicyType } from '../domain/policy-type.js';
import { files } from '../infrastructure/files.js';
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

describe('PoliciesService', () => {
  let repository: InMemoryPoliciesRepository;
  let service: PoliciesService;

  beforeEach(() => {
    repository = new InMemoryPoliciesRepository();
    service = new PoliciesService(repository);
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
    const created = await service.create(input, {} as Express.Multer.File);

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
    });
    expect(files.add).toHaveBeenCalledOnce();
  });

  it('rejects a duplicate name, version, and language before saving a file', async () => {
    await service.create(input, {} as Express.Multer.File);

    await expect(service.create(input, {} as Express.Multer.File)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(files.add).toHaveBeenCalledOnce();
  });

  it('removes the saved file when storing the policy fails', async () => {
    vi.spyOn(repository, 'create').mockRejectedValueOnce(new Error('db down'));

    await expect(service.create(input, {} as Express.Multer.File)).rejects.toThrow('db down');
    expect(files.remove).toHaveBeenCalledWith('doc.pdf');
  });

  it('returns policies and throws when an id is missing', async () => {
    await service.create(input, {} as Express.Multer.File);

    await expect(service.findAll()).resolves.toHaveLength(1);
    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes the policy and its document', async () => {
    await service.create(input, {} as Express.Multer.File);

    await service.remove('policy-1');

    expect(repository.policies).toHaveLength(0);
    expect(files.remove).toHaveBeenCalledWith('doc.pdf');
  });
});
