import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PolicyLanguage } from '../../domain/policy-language.js';
import { PolicyType } from '../../domain/policy-type.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function emptyToNull(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export class CreatePolicyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @IsEnum(PolicyType)
  type: PolicyType;

  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  description?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  version: string;

  @IsEnum(PolicyLanguage)
  language: PolicyLanguage;

  @Matches(DATE, { message: 'effectiveFrom must be a date in YYYY-MM-DD form' })
  effectiveFrom: string;

  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @Matches(DATE, { message: 'effectiveTo must be a date in YYYY-MM-DD form' })
  effectiveTo?: string | null;
}
