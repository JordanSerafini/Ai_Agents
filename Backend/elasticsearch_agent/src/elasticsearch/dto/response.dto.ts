import {
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  IsObject,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SearchHitDto {
  @IsString()
  id: string;

  @IsString()
  index: string;

  @IsNumber()
  score: number;

  @IsObject()
  _source: Record<string, any>;

  @IsObject()
  @IsOptional()
  highlight?: Record<string, string[]>;
}

export class SearchResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SearchHitDto)
  hits: SearchHitDto[];

  @IsNumber()
  total: number;

  @IsNumber()
  took: number;

  @IsObject()
  @IsOptional()
  aggregations?: Record<string, any>;

  @IsOptional()
  @IsArray()
  nextPage?: any[];
}

export class IndexResponseDto {
  @IsString()
  id: string;

  @IsString()
  index: string;

  @IsNumber()
  version: number;

  @IsString()
  result: string;
}

export class DeleteResponseDto {
  @IsString()
  id: string;

  @IsString()
  index: string;

  @IsString()
  result: string;
}

export class BulkIndexItemDto {
  @IsString()
  id: string;

  @IsString()
  result: string;
}

export class BulkIndexResponseDto {
  @IsNumber()
  took: number;

  @IsBoolean()
  errors: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkIndexItemDto)
  items: BulkIndexItemDto[];
}
