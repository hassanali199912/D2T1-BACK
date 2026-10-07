import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class EditApprovalDto {
  @IsEnum(['APPROVE', 'REJECT'] as const)
  finalDecision: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  finalPayout?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  comment: string;
}
