import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ClaimActor, ClaimsService } from '../application/claims.service.js';
import { JwtAccessGuard, type AuthenticatedRequest } from '../infrastructure/jwt-access.guard.js';
import { ClaimsQueryDto } from './dto/claims-query.dto.js';
import { CreateClaimDto } from './dto/create-claim.dto.js';
import { UpdateClaimDto } from './dto/update-claim.dto.js';

@Controller('claims')
@UseGuards(JwtAccessGuard)
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateClaimDto) {
    return this.claimsService.create(dto, actor(request));
  }

  @Get('types')
  listTypes() {
    return this.claimsService.listTypes();
  }

  @Get()
  findPage(@Req() request: AuthenticatedRequest, @Query() query: ClaimsQueryDto) {
    return this.claimsService.findPage(
      {
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        search: query.search,
        status: query.status,
        claimType: query.claimType,
        policyId: query.policyId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        createdBy: query.createdBy,
      },
      actor(request),
    );
  }

  @Get(':id')
  findById(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.claimsService.findById(id, actor(request));
  }

  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClaimDto,
  ) {
    return this.claimsService.update(id, dto, actor(request));
  }
}

function actor(request: AuthenticatedRequest): ClaimActor {
  return {
    id: request.user?.sub ?? '',
    role: request.user!.role,
  };
}
