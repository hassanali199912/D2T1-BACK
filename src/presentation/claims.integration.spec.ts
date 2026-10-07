import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module.js';
import { Policy } from '../domain/entity/policy.entity.js';
import { PolicyIndexStatus } from '../domain/policy-index-status.js';
import { PolicyLanguage } from '../domain/policy-language.js';
import { PolicyType } from '../domain/policy-type.js';
import { UserRole } from '../domain/entity/user.entity.js';

const databaseUrl = process.env.ONLINE_DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

describeDb('claims HTTP', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let policyId = '';
  const adminEmail = `claims-admin-${randomUUID()}@example.com`;
  const employeeEmail = `claims-employee-${randomUUID()}@example.com`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = app.get(DataSource);
    policyId = randomUUID();
    await dataSource.getRepository(Policy).save({
      id: policyId,
      name: `claims-it-${policyId}`,
      type: PolicyType.MOTOR,
      description: null,
      version: '1.0',
      language: PolicyLanguage.EN,
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      documentUrl: '/uploads/claims-it.pdf',
      status: PolicyIndexStatus.Indexed,
      currentStage: null,
      errorCode: null,
      errorMessage: null,
    });
  }, 60000);

  afterAll(async () => {
    if (dataSource?.isInitialized && policyId) {
      await dataSource.query('DELETE FROM claims WHERE policy_id = $1', [policyId]);
      await dataSource.query('DELETE FROM policies WHERE id = $1', [policyId]);
      await dataSource.query('DELETE FROM auth_users WHERE email = ANY($1)', [[adminEmail, employeeEmail]]);
    }
    await app?.close();
  });

  it('creates, lists, reads, and updates a claim, and hides it from another employee', async () => {
    const server = app.getHttpServer();
    const adminToken = await accessToken(server, adminEmail, UserRole.Admin);
    const employeeToken = await accessToken(server, employeeEmail, UserRole.Employee);

    const created = await request(server)
      .post('/claims')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        policyId,
        incidentDate: '2026-01-02',
        claimType: 'COLLISION',
        claimedAmount: 80000,
        description: 'Rear-end collision at an intersection.',
      })
      .expect(201);

    expect(created.body.claimNumber).toMatch(/^CLM-\d{6}$/);
    expect(created.body.status).toBe('SUBMITTED');
    expect(created.body.claimedAmount).toBe('80000.00');
    expect(created.body.policy.id).toBe(policyId);
    expect(created.body.createdBy.email).toBe(adminEmail);

    const listed = await request(server)
      .get('/claims')
      .query({ policyId })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(listed.body.total).toBe(1);

    const detail = await request(server)
      .get(`/claims/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(detail.body.description).toContain('Rear-end');

    const updated = await request(server)
      .patch(`/claims/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'Updated collision note.' })
      .expect(200);
    expect(updated.body.description).toBe('Updated collision note.');
    expect(updated.body.claimNumber).toBe(created.body.claimNumber);
    expect(updated.body.status).toBe('SUBMITTED');

    await request(server)
      .get(`/claims/${created.body.id}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);

    const stored = await dataSource.query<{ claimed_amount: string }[]>(
      'SELECT claimed_amount FROM claims WHERE id = $1',
      [created.body.id],
    );
    expect(Number(stored[0]?.claimed_amount)).toBe(80000);

    await request(server).post('/claims').send({
      policyId,
      incidentDate: '2026-01-02',
      claimType: 'COLLISION',
      claimedAmount: 10,
      description: 'Missing token.',
    }).expect(401);
  }, 30000);
});

async function accessToken(
  server: Parameters<typeof request>[0],
  email: string,
  role: UserRole,
): Promise<string> {
  await request(server).post('/users').send({
    name: email,
    email,
    password: 'password1',
    role,
  });
  const login = await request(server).post('/auth/login').send({ email, password: 'password1' }).expect(200);
  return login.body.accessToken as string;
}
