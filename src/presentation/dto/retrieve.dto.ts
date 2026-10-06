import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { PolicyLanguage } from '../../domain/policy-language.js';

export class RetrieveDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  query: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;

  @IsOptional()
  @IsIn([PolicyLanguage.AR, PolicyLanguage.EN, 'AUTO'])
  language?: PolicyLanguage | 'AUTO';

  @IsOptional()
  @IsUUID()
  policyId?: string;

  @IsOptional()
  @IsUUID()
  policyVersionId?: string;

  @IsOptional()
  @IsUUID()
  documentId?: string;
}
