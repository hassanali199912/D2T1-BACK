import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { RagService } from '../application/rag.service.js';
import { AppModule } from '../app.module.js';
import { ClaimAnalyzer } from '../domain/claim-analyzer.js';
import { Policy } from '../domain/entity/policy.entity.js';
import { UserRole } from '../domain/entity/user.entity.js';
import { PolicyIndexStatus } from '../domain/policy-index-status.js';
import { PolicyLanguage } from '../domain/policy-language.js';
import { PolicyType } from '../domain/policy-type.js';
import { RetrievalResponse } from '../domain/retrieval.types.js';

const databaseUrl = process.env.ONLINE_DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

describeDb('claim analysis HTTP', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let earlyId = '';
  let currentId = '';
  const adminEmail = `analysis-admin-${randomUUID()}@example.com`;
  const employeeEmail = `analysis-employee-${randomUUID()}@example.com`;
  const policyName = `analysis-it-${randomUUID()}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RagService)
      .useValue({ retrieve: () => Promise.resolve(evidence()) })
      .overrideProvider(ClaimAnalyzer)
      .useValue({ analyze: () => Promise.resolve(modelAnswer()) })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    dataSource = app.get(DataSource);
    earlyId = randomUUID();
    currentId = randomUUID();
    await dataSource.getRepository(Policy).save([
      policy(earlyId, '1', '2024-01-01', '2025-01-01'),
      policy(currentId, '3', '2026-01-01', '2027-01-01'),
    ]);
  }, 60000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.query(
        `DELETE FROM approval_audits WHERE approval_id IN (
           SELECT a.id FROM approvals a
           JOIN claims c ON c.id = a.claim_id
           WHERE c.policy_id = ANY($1)
         )`,
        [[earlyId, currentId]],
      );
      await dataSource.query(
        `DELETE FROM approvals WHERE claim_id IN (SELECT id FROM claims WHERE policy_id = ANY($1))`,
        [[earlyId, currentId]],
      );
      await dataSource.query('DELETE FROM claim_analyses WHERE policy_version_id = ANY($1)', [[earlyId, currentId]]);
      await dataSource.query('DELETE FROM claims WHERE policy_id = ANY($1)', [[earlyId, currentId]]);
      await dataSource.query('DELETE FROM policies WHERE id = ANY($1)', [[earlyId, currentId]]);
      await dataSource.query('DELETE FROM auth_users WHERE email = ANY($1)', [[adminEmail, employeeEmail]]);
    }
    await app?.close();
  });

  it('selects the dated policy version, returns the coded payout, and persists citations', async () => {
    const server = app.getHttpServer();
    const adminToken = await accessToken(server, adminEmail, UserRole.Admin);
    const employeeToken = await accessToken(server, employeeEmail, UserRole.Employee);
    const created = await request(server)
      .post('/claims')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        policyId: earlyId,
        incidentDate: '2026-08-15',
        claimType: 'COLLISION',
        claimedAmount: 80000,
        description: 'The insured vehicle was involved in a road collision.',
      })
      .expect(201);

    const analyzed = await request(server)
      .post(`/claims/${created.body.id}/analyze`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(analyzed.body.policy.versionId).toBe(currentId);
    expect(analyzed.body.policy.versionNumber).toBe('3');
    expect(analyzed.body.status).toBe('COMPLETED');
    expect(analyzed.body.financials.payout).toBe('50000.00');
    expect(analyzed.body.evidence[0].chunkId).toBe('chunk-1');
    expect(analyzed.body.recommendation.decision).toBe('APPROVE');

    const latest = await request(server)
      .get(`/claims/${created.body.id}/analysis`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(latest.body.id).toBe(analyzed.body.id);

    await request(server)
      .get(`/claims/${created.body.id}/analysis`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);

    const stored = await dataSource.query<{ calculated_payout: string }[]>(
      'SELECT calculated_payout FROM claim_analyses WHERE id = $1',
      [analyzed.body.id],
    );
    expect(Number(stored[0]?.calculated_payout)).toBe(50000);

    const outside = await request(server)
      .post('/claims')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        policyId: earlyId,
        incidentDate: '2020-01-02',
        claimType: 'COLLISION',
        claimedAmount: 1000,
        description: 'A claim before every policy version.',
      })
      .expect(201);
    await request(server)
      .post(`/claims/${outside.body.id}/analyze`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
  }, 30000);

  function policy(id: string, version: string, effectiveFrom: string, effectiveTo: string) {
    return {
      id,
      name: policyName,
      type: PolicyType.MOTOR,
      description: null,
      version,
      language: PolicyLanguage.EN,
      effectiveFrom,
      effectiveTo,
      documentUrl: '/uploads/analysis-it.pdf',
      status: PolicyIndexStatus.Indexed,
      currentStage: null,
      errorCode: null,
      errorMessage: null,
    };
  }
});

function evidence(): RetrievalResponse {
  return {
    query: 'coverage',
    hasSufficientEvidence: true,
    message: null,
    results: [
      {
        chunkId: 'chunk-1',
        content: 'Coverage limit 60,000. Deductible 10,000.',
        score: 0.8,
        retrievalMethod: 'hybrid',
        policyId: 'current',
        policyVersionId: 'current',
        documentId: 'current',
        documentName: 'Motor',
        version: '3',
        pageNumber: 2,
        section: 'Collision Coverage',
        language: PolicyLanguage.EN,
      },
    ],
    citations: [
      {
        chunkId: 'chunk-1',
        documentId: 'current',
        documentName: 'Motor',
        version: '3',
        pageNumber: 2,
        section: 'Collision Coverage',
        language: PolicyLanguage.EN,
      },
    ],
  };
}

function modelAnswer() {
  return {
    coverage: { covered: true, reasoning: 'Collision is covered.' },
    exclusions: { applicable: false, items: [] },
    anomalies: { detected: false, items: [] },
    financialFacts: { coverageLimit: 60000, deductible: 10000 },
    recommendation: { decision: 'APPROVE', reasoning: 'Covered collision.' },
    citations: [{ chunkId: 'chunk-1' }],
  };
}

async function accessToken(
  server: Parameters<typeof request>[0],
  email: string,
  role: UserRole,
): Promise<string> {
  await request(server).post('/users').send({ name: email, email, password: 'password1', role });
  const login = await request(server).post('/auth/login').send({ email, password: 'password1' }).expect(200);
  return login.body.accessToken as string;
}
