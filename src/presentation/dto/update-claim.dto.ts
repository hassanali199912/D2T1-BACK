import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Matches, MaxLength } from 'class-validator';
import { ClaimType } from '../../domain/claim-type.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class UpdateClaimDto {
  @IsOptional()
  @IsEnum(ClaimType)
  claimType?: ClaimType;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  claimedAmount?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @Matches(DATE, { message: 'incidentDate must be a date in YYYY-MM-DD form' })
  incidentDate?: string;
}
