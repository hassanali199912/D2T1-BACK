import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AdjudicationService } from '../application/adjudication.service.js';
import { ClaimActor } from '../application/claims.service.js';
import { JwtAccessGuard, type AuthenticatedRequest } from '../infrastructure/jwt-access.guard.js';

@Controller('claims')
@UseGuards(JwtAccessGuard)
export class AdjudicationController {
  constructor(private readonly adjudication: AdjudicationService) {}

  @Post(':claimId/analyze')
  @HttpCode(200)
  analyze(@Req() request: AuthenticatedRequest, @Param('claimId', ParseUUIDPipe) claimId: string) {
    return this.adjudication.analyze(claimId, actor(request));
  }

  @Get(':claimId/analysis')
  findLatest(@Req() request: AuthenticatedRequest, @Param('claimId', ParseUUIDPipe) claimId: string) {
    return this.adjudication.findLatest(claimId, actor(request));
  }
}

function actor(request: AuthenticatedRequest): ClaimActor {
  return {
    id: request.user?.sub ?? '',
    role: request.user!.role,
  };
}
