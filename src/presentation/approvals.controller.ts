import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApprovalsService } from '../application/approvals.service.js';
import { ClaimActor } from '../application/claims.service.js';
import { JwtAccessGuard, type AuthenticatedRequest } from '../infrastructure/jwt-access.guard.js';
import { ApprovalsQueryDto } from './dto/approvals-query.dto.js';
import { EditApprovalDto } from './dto/edit-approval.dto.js';
import { RejectApprovalDto } from './dto/reject-approval.dto.js';

@Controller('approvals')
@UseGuards(JwtAccessGuard)
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  findPage(@Req() request: AuthenticatedRequest, @Query() query: ApprovalsQueryDto) {
    return this.approvals.findPage(query, actor(request));
  }

  @Get(':id')
  findById(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.approvals.findById(id, actor(request));
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.approvals.approve(id, actor(request));
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectApprovalDto,
  ) {
    return this.approvals.reject(id, dto.comment, actor(request));
  }

  @Post(':id/edit-and-approve')
  @HttpCode(200)
  editAndApprove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditApprovalDto,
  ) {
    return this.approvals.editAndApprove(id, dto, actor(request));
  }
}

function actor(request: AuthenticatedRequest): ClaimActor {
  return {
    id: request.user?.sub ?? '',
    role: request.user!.role,
  };
}
