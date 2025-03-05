import {
  ValidateString,
  ValidateArray,
  ValidateObject,
} from './decorators';
import { IsBoolean } from 'class-validator';

export class QueryBuilderResponseDto {
  @ValidateString()
  sql!: string;

  @ValidateArray()
  params!: any[];

  @ValidateString()
  explanation!: string;

  @ValidateArray()
  @ValidateString({ each: true })
  tables!: string[];

  @ValidateArray()
  @ValidateString({ each: true })
  columns!: string[];

  @ValidateArray()
  @ValidateString({ each: true })
  conditions!: string[];

  @IsBoolean()
  success!: boolean;

  @ValidateString()
  error?: string;
} 