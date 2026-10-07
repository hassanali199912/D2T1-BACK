import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalsService } from '../application/approvals.service.js';
import { ApprovalsRepository } from '../domain/approvals.repository.js';
import { Approval } from '../domain/entity/approval.entity.js';
import { ApprovalAudit } from '../domain/entity/approval-audit.entity.js';
import { ApprovalsTypeOrmRepository } from '../infrastructure/approvals.typeorm-repository.js';
import { JwtAccessGuard } from '../infrastructure/jwt-access.guard.js';
import { ApprovalsController } from './approvals.controller.js';
import { AuthModule } from './auth.module.js';
import { ClaimsModule } from './claims.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Approval, ApprovalAudit]), AuthModule, ClaimsModule],
  controllers: [ApprovalsController],
  providers: [
    ApprovalsService,
    JwtAccessGuard,
    { provide: ApprovalsRepository, useClass: ApprovalsTypeOrmRepository },
  ],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
