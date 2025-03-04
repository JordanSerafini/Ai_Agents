import { IsString } from 'class-validator';

export class GenerateRequestDto {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  @IsString()
  prompt: string;
}
