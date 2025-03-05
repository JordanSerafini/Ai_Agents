import {
  ValidateString,
  ValidateArray,
  ValidateObject,
  ValidateNested,
} from './decorators';
import { IsBoolean, IsOptional, IsNumber, ValidateIf } from 'class-validator';
import { ElasticsearchQuery, QueryMetadata } from '../interfaces/query-builder.interface';
import { Type } from 'class-transformer';

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
  @IsOptional()
  error?: string;

  @ValidateString()
  @IsOptional()
  countSql?: string;

  @ValidateObject()
  @IsOptional()
  searchConfig?: any;

  @ValidateObject()
  @IsOptional()
  elasticsearchQuery?: ElasticsearchQuery;

  @ValidateObject()
  @IsOptional()
  metadata?: QueryMetadata;

  @ValidateNested()
  @Type(() => ElasticsearchResponseDto)
  @IsOptional()
  elasticsearchResponse?: ElasticsearchResponseDto;

  @ValidateArray()
  @IsOptional()
  aggregations?: AggregationResultDto[];
}

export class ElasticsearchResponseDto {
  @IsNumber()
  took!: number;

  @IsBoolean()
  timed_out!: boolean;

  @ValidateObject()
  hits!: {
    total: {
      value: number;
      relation: string;
    };
    max_score: number;
    hits: ElasticsearchHitDto[];
  };

  @ValidateObject()
  @IsOptional()
  aggregations?: Record<string, any>;
}

export class ElasticsearchHitDto {
  @ValidateString()
  _index!: string;

  @ValidateString()
  _id!: string;

  @IsNumber()
  _score!: number;

  @ValidateObject()
  _source!: Record<string, any>;

  @ValidateObject()
  @IsOptional()
  highlight?: Record<string, string[]>;
}

export class AggregationResultDto {
  @ValidateString()
  name!: string;

  @ValidateString()
  type!: string;

  @ValidateString()
  field!: string;

  @ValidateArray()
  buckets?: AggregationBucketDto[];

  @IsNumber()
  @IsOptional()
  value?: number;
}

export class AggregationBucketDto {
  @ValidateString()
  key!: string;

  @IsNumber()
  doc_count!: number;

  @ValidateObject()
  @IsOptional()
  nested?: Record<string, any>;
}

export class SearchResultDto {
  @IsNumber()
  total!: number;

  @IsNumber()
  page!: number;

  @IsNumber()
  pageSize!: number;

  @IsNumber()
  pageCount!: number;

  @ValidateArray()
  results!: any[];

  @ValidateArray()
  @IsOptional()
  facets?: FacetResultDto[];

  @ValidateObject()
  @IsOptional()
  metadata?: {
    executionTime: number;
    query: string;
    filters?: Record<string, any>;
  };
}

export class FacetResultDto {
  @ValidateString()
  field!: string;

  @ValidateArray()
  values!: {
    key: string;
    count: number;
  }[];
} 