import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AnalyseRequestDto {
  @IsString()
  question: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsBoolean()
  @IsOptional()
  useHistory?: boolean;
}
