import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PoliciesService } from '../application/policies.service.js';
import { Policy } from '../domain/entity/policy.entity.js';
import { PoliciesRepository } from '../domain/policies.repository.js';
import { PoliciesTypeOrmRepository } from '../infrastructure/policies.typeorm-repository.js';
import { PoliciesController } from './policies.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Policy])],
  controllers: [PoliciesController],
  providers: [
    PoliciesService,
    { provide: PoliciesRepository, useClass: PoliciesTypeOrmRepository },
  ],
})
export class PoliciesModule {}
