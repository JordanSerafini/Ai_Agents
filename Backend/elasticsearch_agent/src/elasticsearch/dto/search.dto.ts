import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsBoolean,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SearchDto {
  @IsString()
  query: string;

  @IsString()
  index: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  size?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  from?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  fields?: string[];

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  highlight?: boolean;

  @IsObject()
  @IsOptional()
  filters?: Record<string, any>;

  @IsObject()
  @IsOptional()
  sort?: any[];

  @IsArray()
  @IsOptional()
  searchAfter?: any[];
}

export class IndexDto {
  @IsString()
  @IsOptional()
  index?: string;

  @IsObject()
  document: Record<string, any>;

  @IsString()
  @IsOptional()
  id?: string;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  refresh?: boolean;
}

export class DeleteDto {
  @IsString()
  @IsOptional()
  index?: string;

  @IsString()
  id: string;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  refresh?: boolean;
}

export class BulkIndexDto {
  @IsString()
  @IsOptional()
  index?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  documents: Array<Record<string, any> & { id?: string }>;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  refresh?: boolean;
} 