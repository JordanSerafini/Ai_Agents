import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { QueryBuilderService } from '../services/query-builder.service';
import {
  QueryBuilderResult,
  QueryBuilderOptions,
  SearchConfig,
  ElasticsearchQuery,
} from '../interfaces/query-builder.interface';

@Controller('querybuilder')
export class QueryBuilderController {
  constructor(private readonly queryBuilderService: QueryBuilderService) {}

  @Post('build')
  async buildQuery(
    @Body('question') question: string,
    @Body('options') options?: QueryBuilderOptions,
  ): Promise<QueryBuilderResult> {
    return this.queryBuilderService.buildQuery(question, options);
  }

  @Post('elasticsearch')
  buildElasticsearchQuery(
    @Body() searchConfig: SearchConfig,
  ): ElasticsearchQuery {
    return this.queryBuilderService.buildElasticsearchQuery(searchConfig);
  }

  @Get('health')
  healthCheck(): { status: string } {
    return { status: 'ok' };
  }
}
