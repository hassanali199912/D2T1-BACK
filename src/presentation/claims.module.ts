import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClaimsService } from '../application/claims.service.js';
import { ClaimsRepository } from '../domain/claims.repository.js';
import { Claim } from '../domain/entity/claim.entity.js';
import { ClaimsTypeOrmRepository } from '../infrastructure/claims.typeorm-repository.js';
import { JwtAccessGuard } from '../infrastructure/jwt-access.guard.js';
import { AuthModule } from './auth.module.js';
import { ClaimsController } from './claims.controller.js';
import { PoliciesModule } from './policies.module.js';
import { UsersModule } from './users.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Claim]), AuthModule, UsersModule, PoliciesModule],
  controllers: [ClaimsController],
  providers: [
    ClaimsService,
    JwtAccessGuard,
    { provide: ClaimsRepository, useClass: ClaimsTypeOrmRepository },
  ],
  exports: [ClaimsRepository],
})
export class ClaimsModule {}
