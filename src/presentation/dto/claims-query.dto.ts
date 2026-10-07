import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { ClaimStatus } from '../../domain/claim-status.js';
import { ClaimType } from '../../domain/claim-type.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ClaimsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  search?: string;

  @IsOptional()
  @IsEnum(ClaimStatus)
  status?: ClaimStatus;

  @IsOptional()
  @IsEnum(ClaimType)
  claimType?: ClaimType;

  @IsOptional()
  @IsUUID()
  policyId?: string;

  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @IsOptional()
  @Matches(DATE, { message: 'dateFrom must be a date in YYYY-MM-DD form' })
  dateFrom?: string;

  @IsOptional()
  @Matches(DATE, { message: 'dateTo must be a date in YYYY-MM-DD form' })
  dateTo?: string;
}
