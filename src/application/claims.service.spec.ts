import { BadRequestException, ForbiddenException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { ClaimsService, ClaimActor } from './claims.service.js';
import { ClaimStatus } from '../domain/claim-status.js';
import { ClaimType } from '../domain/claim-type.js';
import { ClaimPage, ClaimPageQuery, ClaimsRepository, ClaimUpdate, NewClaim } from '../domain/claims.repository.js';
import { DuplicateClaimNumberError } from '../domain/duplicate-claim-number.error.js';
import { Claim } from '../domain/entity/claim.entity.js';
import { User, UserRole } from '../domain/entity/user.entity.js';
import { Policy } from '../domain/entity/policy.entity.js';
import { PolicyIndexStatus } from '../domain/policy-index-status.js';
import { PolicyLanguage } from '../domain/policy-language.js';
import { PolicyType } from '../domain/policy-type.js';
import { PoliciesRepository } from '../domain/policies.repository.js';
import { UsersRepository } from '../domain/users.repository.js';
import { CreateClaimDto } from '../presentation/dto/create-claim.dto.js';

const admin: ClaimActor = { id: 'admin-1', role: UserRole.Admin };
const employee: ClaimActor = { id: 'employee-1', role: UserRole.Employee };
const policyId = '11111111-1111-4111-8111-111111111111';

describe('ClaimsService', () => {
  let claims: MemoryClaims;
  let service: ClaimsService;

  beforeEach(() => {
    claims = new MemoryClaims();
    service = new ClaimsService(claims, new MemoryPolicies(), new MemoryUsers());
  });

  it('lists the accident types for a select control', () => {
    expect(service.listTypes().map((option) => option.value)).toEqual([
      ClaimType.Collision,
      ClaimType.Theft,
      ClaimType.Fire,
      ClaimType.Other,
    ]);
  });

  it('creates a submitted claim for the token user', async () => {
    const result = await service.create(validInput(), employee);

    expect(result.claimNumber).toBe('CLM-000001');
    expect(result.status).toBe(ClaimStatus.Submitted);
    expect(result.createdBy.id).toBe(employee.id);
    expect(result.claimedAmount).toBe('80000.00');
    expect(result.policy.id).toBe(policyId);
    expect(claims.created).toBe(1);
  });

  it('does not insert when the policy is missing', async () => {
    await expect(service.create({ ...validInput(), policyId: '22222222-2222-4222-8222-222222222222' }, employee)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(claims.created).toBe(0);
  });

  it('rejects a future incident date and a non-positive amount', async () => {
    await expect(service.create({ ...validInput(), incidentDate: '2099-01-01' }, employee)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.create({ ...validInput(), claimedAmount: 0 }, employee)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create({ ...validInput(), claimedAmount: 1.239 }, employee)).rejects.toBeInstanceOf(BadRequestException);
    expect(claims.created).toBe(0);
  });

  it('retries when the generated claim number collides', async () => {
    claims.failOnce = true;

    const result = await service.create(validInput(), employee);

    expect(result.claimNumber).toBe('CLM-000002');
  });

  it('updates the description and leaves identity fields unchanged', async () => {
    const created = await service.create(validInput(), employee);

    const updated = await service.update(created.id, { description: 'Rear bumper damage' }, employee);

    expect(updated.description).toBe('Rear bumper damage');
    expect(updated.claimNumber).toBe(created.claimNumber);
    expect(updated.status).toBe(ClaimStatus.Submitted);
    expect(updated.policy.id).toBe(policyId);
  });

  it('blocks an employee from updating another user claim and allows an admin', async () => {
    const created = await service.create(validInput(), admin);

    await expect(service.update(created.id, { description: 'nope' }, employee)).rejects.toBeInstanceOf(ForbiddenException);
    const updated = await service.update(created.id, { description: 'admin edit' }, admin);

    expect(updated.description).toBe('admin edit');
  });

  it('rejects every status transition in this phase', () => {
    expect(() => service.assertTransition(ClaimStatus.Submitted, ClaimStatus.Approved)).toThrow(
      'INVALID_CLAIM_STATUS_TRANSITION',
    );
  });

  it('rejects a client-supplied status on create', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

    await expect(
      pipe.transform(
        { ...validInput(), status: 'APPROVED', createdBy: admin.id, claimNumber: 'CLM-999999' },
        { type: 'body', metatype: CreateClaimDto },
      ),
    ).rejects.toThrow();
  });
});

class MemoryClaims extends ClaimsRepository {
  claims: Claim[] = [];
  created = 0;
  failOnce = false;
  private sequence = 0;

  nextClaimNumber(): Promise<string> {
    this.sequence += 1;
    return Promise.resolve(`CLM-${String(this.sequence).padStart(6, '0')}`);
  }

  create(input: NewClaim): Promise<Claim> {
    if (this.failOnce) {
      this.failOnce = false;
      return Promise.reject(new DuplicateClaimNumberError());
    }
    this.created += 1;
    const claim = {
      id: `claim-${this.created}`,
      claimNumber: input.claimNumber,
      policyId: input.policyId,
      policy: samplePolicy(),
      incidentDate: input.incidentDate,
      claimType: input.claimType,
      claimedAmount: input.claimedAmount,
      description: input.description,
      status: input.status,
      createdBy: input.createdBy,
      creator: sampleUser(input.createdBy),
      createdAt: new Date('2026-08-15T00:00:00.000Z'),
      updatedAt: new Date('2026-08-15T00:00:00.000Z'),
    } as Claim;
    this.claims.push(claim);
    return Promise.resolve(claim);
  }

  update(id: string, update: ClaimUpdate): Promise<Claim> {
    const claim = this.claims.find((item) => item.id === id);
    if (!claim) {
      return Promise.reject(new Error('missing'));
    }
    Object.assign(claim, update, { updatedAt: new Date('2026-08-16T00:00:00.000Z') });
    return Promise.resolve(claim);
  }

  findById(id: string): Promise<Claim | null> {
    return Promise.resolve(this.claims.find((item) => item.id === id) ?? null);
  }

  findPage(query: ClaimPageQuery): Promise<ClaimPage> {
    const items = this.claims.filter((item) => !query.createdBy || item.createdBy === query.createdBy);
    return Promise.resolve({ items, total: items.length });
  }
}

class MemoryPolicies extends PoliciesRepository {
  create(): Promise<Policy> {
    return Promise.reject(new Error('not used'));
  }

  findAll(): Promise<Policy[]> {
    return Promise.resolve([samplePolicy()]);
  }

  findById(id: string): Promise<Policy | null> {
    return Promise.resolve(id === policyId ? samplePolicy() : null);
  }

  findByIdentity(): Promise<Policy | null> {
    return Promise.resolve(null);
  }

  findFamily(): Promise<Policy[]> {
    return Promise.resolve([samplePolicy()]);
  }

  deleteById(): Promise<void> {
    return Promise.resolve();
  }

  updateIndexState(): Promise<void> {
    return Promise.resolve();
  }
}

class MemoryUsers extends UsersRepository {
  create(): Promise<User> {
    return Promise.reject(new Error('not used'));
  }

  findAll(): Promise<User[]> {
    return Promise.resolve([]);
  }

  findById(id: string): Promise<User | null> {
    if (id !== admin.id && id !== employee.id) {
      return Promise.resolve(null);
    }
    return Promise.resolve(sampleUser(id));
  }

  findByEmail(): Promise<User | null> {
    return Promise.resolve(null);
  }
}

function validInput() {
  return {
    policyId,
    incidentDate: '2026-01-02',
    claimType: ClaimType.Collision,
    claimedAmount: 80000,
    description: 'The insured vehicle was involved in a collision.',
  };
}

function samplePolicy(): Policy {
  return {
    id: policyId,
    name: 'Motor',
    type: PolicyType.MOTOR,
    description: null,
    version: '1.0',
    language: PolicyLanguage.EN,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    documentUrl: '/uploads/motor.pdf',
    status: PolicyIndexStatus.Indexed,
    currentStage: null,
    errorCode: null,
    errorMessage: null,
  };
}

function sampleUser(id: string): User {
  return {
    id,
    name: id === admin.id ? 'Admin' : 'Employee',
    email: id === admin.id ? 'admin@example.com' : 'employee@example.com',
    password: 'hashed',
    role: id === admin.id ? UserRole.Admin : UserRole.Employee,
  };
}
