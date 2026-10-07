import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdjudicationService } from '../application/adjudication.service.js';
import { EvidenceBuilder } from '../application/evidence-builder.js';
import { ClaimAnalysesRepository } from '../domain/claim-analyses.repository.js';
import { ClaimAnalyzer } from '../domain/claim-analyzer.js';
import { ClaimAnalysis } from '../domain/entity/claim-analysis.entity.js';
import { ClaimAnalysesTypeOrmRepository } from '../infrastructure/claim-analyses.typeorm-repository.js';
import { JwtAccessGuard } from '../infrastructure/jwt-access.guard.js';
import { OpenAiClaimAnalyzer } from '../infrastructure/openai-claim-analyzer.js';
import { AdjudicationController } from './adjudication.controller.js';
import { ApprovalsModule } from './approvals.module.js';
import { AuthModule } from './auth.module.js';
import { ClaimsModule } from './claims.module.js';
import { PoliciesModule } from './policies.module.js';
import { RagModule } from './rag.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClaimAnalysis]),
    AuthModule,
    ClaimsModule,
    PoliciesModule,
    RagModule,
    ApprovalsModule,
  ],
  controllers: [AdjudicationController],
  providers: [
    AdjudicationService,
    EvidenceBuilder,
    JwtAccessGuard,
    { provide: ClaimAnalysesRepository, useClass: ClaimAnalysesTypeOrmRepository },
    { provide: ClaimAnalyzer, useClass: OpenAiClaimAnalyzer },
  ],
})
export class AdjudicationModule {}
