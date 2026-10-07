import { IsEnum, IsNotEmpty, IsNumber, IsPositive, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ClaimType } from '../../domain/claim-type.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateClaimDto {
  @IsUUID()
  policyId: string;

  @Matches(DATE, { message: 'incidentDate must be a date in YYYY-MM-DD form' })
  incidentDate: string;

  @IsEnum(ClaimType)
  claimType: ClaimType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  claimedAmount: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  description: string;
}
