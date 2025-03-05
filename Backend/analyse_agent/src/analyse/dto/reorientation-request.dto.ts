import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ReorientationRequestDto {
  @IsString()
  question: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  contexteOriginal?: string;

  @IsBoolean()
  @IsOptional()
  forcerReanalyse?: boolean;
} 