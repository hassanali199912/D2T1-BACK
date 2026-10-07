import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectApprovalDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  comment: string;
}
