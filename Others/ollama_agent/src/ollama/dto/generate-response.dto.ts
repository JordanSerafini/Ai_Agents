import { IsString } from 'class-validator';

export class GenerateResponseDto {
  @IsString()
  response!: string;
} 