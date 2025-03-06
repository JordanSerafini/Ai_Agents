import { IsBoolean, IsOptional, IsString, IsObject } from 'class-validator';

export class AnalyseRequestDto {
  @IsString()
  question: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsBoolean()
  @IsOptional()
  useHistory?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
