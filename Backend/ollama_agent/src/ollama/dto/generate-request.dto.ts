import { IsString, IsNotEmpty } from 'class-validator';

export class GenerateRequestDto {
  @IsString()
  @IsNotEmpty()
  prompt!: string;
} 