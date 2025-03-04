import { IsString } from 'class-validator';

export class AnalyseRequestDto {
  @IsString()
  question!: string;
}
