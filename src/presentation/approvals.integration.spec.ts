import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ApprovalsService } from '../application/approvals.service.js';
import { AppModule } from '../app.module.js';
import { AnalysisStatus } from '../domain/analysis-status.js';
import { ClaimStatus } from '../domain/claim-status.js';
import { ClaimType } from '../domain/claim-type.js';
import { ClaimAnalysis } from '../domain/entity/claim-analysis.entity.js';
import { Claim } from '../domain/entity/claim.entity.js';
import { Policy } from '../domain/entity/policy.entity.js';
import { User, UserRole } from '../domain/entity/user.entity.js';
import { PolicyIndexStatus } from '../domain/policy-index-status.js';
import { PolicyLanguage } from '../domain/policy-language.js';
import { PolicyType } from '../domain/policy-type.js';

const databaseUrl = process.env.ONLINE_DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

describeDb('approvals HTTP', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let approvals: ApprovalsService;
  let policyId = '';
  let adminId = '';
  const adminEmail = `approvals-admin-${randomUUID()}@example.com`;
  const employeeEmail = `approvals-employee-${randomUUID()}@example.com`;
  const claimIds: string[] = [];
  const analysisIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    dataSource = app.get(DataSource);
    approvals = app.get(ApprovalsService);
    policyId = randomUUID();
    await dataSource.getRepository(Policy).save({
      id: policyId,
      name: `approvals-it-${policyId}`,
      type: PolicyType.MOTOR,
      description: null,
      version: '1.0',
      language: PolicyLanguage.EN,
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      documentUrl: '/uploads/approvals-it.pdf',
      status: PolicyIndexStatus.Indexed,
      currentStage: null,
      errorCode: null,
      errorMessage: null,
    });
  }, 60000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.query('DELETE FROM approval_audits WHERE approval_id IN (SELECT id FROM approvals WHERE claim_id = ANY($1))', [
        claimIds,
      ]);
      await dataSource.query('DELETE FROM approvals WHERE claim_id = ANY($1)', [claimIds]);
      if (analysisIds.length) {
        await dataSource.query('DELETE FROM claim_analyses WHERE id = ANY($1)', [analysisIds]);
      }
      if (claimIds.length) {
        await dataSource.query('DELETE FROM claims WHERE id = ANY($1)', [claimIds]);
      }
      await dataSource.query('DELETE FROM policies WHERE id = $1', [policyId]);
      await dataSource.query('DELETE FROM auth_users WHERE email = ANY($1)', [[adminEmail, employeeEmail]]);
    }
    await app?.close();
  });

  it('approves once, rejects a second approve, and supports reject and edit-and-approve', async () => {
    const server = app.getHttpServer();
    const adminToken = await accessToken(server, adminEmail, UserRole.Admin);
    const employeeToken = await accessToken(server, employeeEmail, UserRole.Employee);
    adminId = (
      await dataSource.getRepository(User).findOneByOrFail({ email: adminEmail })
    ).id;

    const approveCase = await seedPending(`A${randomUUID().replace(/-/g, '').slice(0, 10)}`);
    const rejectCase = await seedPending(`R${randomUUID().replace(/-/g, '').slice(0, 10)}`);
    const editCase = await seedPending(`E${randomUUID().replace(/-/g, '').slice(0, 10)}`);

    await request(server).get('/approvals').set('Authorization', `Bearer ${employeeToken}`).expect(403);

    const listed = await request(server)
      .get('/approvals')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(listed.body.total).toBeGreaterThanOrEqual(3);

    const approved = await request(server)
      .post(`/approvals/${approveCase.approvalId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(approved.body.status).toBe('APPROVED');
    expect(approved.body.finalPayout).toBe('50000.00');
    expect(approved.body.reviewer.id).toBe(adminId);

    await request(server)
      .post(`/approvals/${approveCase.approvalId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);

    const claim = await dataSource.getRepository(Claim).findOneByOrFail({ id: approveCase.claimId });
    expect(claim.status).toBe(ClaimStatus.Approved);

    const rejected = await request(server)
      .post(`/approvals/${rejectCase.approvalId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ comment: 'Incident does not match the policy.' })
      .expect(200);
    expect(rejected.body.status).toBe('REJECTED');
    expect(rejected.body.finalPayout).toBe('0.00');

    const edited = await request(server)
      .post(`/approvals/${editCase.approvalId}/edit-and-approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ finalDecision: 'APPROVE', finalPayout: 45000, comment: 'Adjusted after review.' })
      .expect(200);
    expect(edited.body.status).toBe('EDITED_AND_APPROVED');
    expect(edited.body.originalRecommendation.payout).toBe('50000.00');
    expect(edited.body.finalPayout).toBe('45000.00');

    const audits = await dataSource.query<{ action: string }[]>(
      'SELECT action FROM approval_audits WHERE approval_id = $1 ORDER BY created_at',
      [editCase.approvalId],
    );
    expect(audits.map((row) => row.action)).toEqual(['CREATED', 'EDITED_AND_APPROVED']);
  }, 60000);

  async function seedPending(claimNumber: string): Promise<{ claimId: string; approvalId: string }> {
    const claimId = randomUUID();
    const analysisId = randomUUID();
    claimIds.push(claimId);
    analysisIds.push(analysisId);
    const admin = await dataSource.getRepository(User).findOneByOrFail({ email: adminEmail });
    await dataSource.getRepository(Claim).save({
      id: claimId,
      claimNumber,
      policyId,
      policy: { id: policyId } as Policy,
      incidentDate: '2026-01-02',
      claimType: ClaimType.Collision,
      claimedAmount: '80000.00',
      description: 'Collision at an intersection.',
      status: ClaimStatus.Submitted,
      createdBy: admin.id,
      creator: { id: admin.id } as User,
    });
    const analysis = await dataSource.getRepository(ClaimAnalysis).save({
      id: analysisId,
      claimId,
      claim: { id: claimId } as Claim,
      policyVersionId: policyId,
      policyVersion: { id: policyId } as Policy,
      status: AnalysisStatus.Completed,
      errorCode: null,
      coverageResult: { covered: true, reasoning: 'Covered.' },
      exclusions: { applicable: false, items: [] },
      anomalies: { detected: false, items: [] },
      coverageLimit: '60000.00',
      deductible: '10000.00',
      claimedAmount: '80000.00',
      calculatedPayout: '50000.00',
      recommendation: { decision: 'APPROVE', reasoning: 'Covered collision.' },
      aiReasoning: 'Covered.',
      citations: [],
      promptVersion: 'claim-analysis.v1',
    });
    const claim = await dataSource.getRepository(Claim).findOneOrFail({
      where: { id: claimId },
      relations: { policy: true },
    });
    const approval = await approvals.createFromAnalysis(analysis, claim);
    return { claimId, approvalId: approval.id };
  }
});

async function accessToken(
  server: Parameters<typeof request>[0],
  email: string,
  role: UserRole,
): Promise<string> {
  await request(server).post('/users').send({ name: email, email, password: 'password1', role });
  const login = await request(server).post('/auth/login').send({ email, password: 'password1' }).expect(200);
  return login.body.accessToken as string;
}
