import { Controller, Post, Body } from '@nestjs/common';
import { QueryBuilderService } from '../services/query-builder.service';
import { AnalyseQueryData, QueryBuilderResult } from '../interfaces/query-builder.types';

@Controller('querybuilder')
export class QueryBuilderController {
  constructor(private readonly queryBuilderService: QueryBuilderService) {}

  @Post('build')
  async buildQuery(
    @Body() data: AnalyseQueryData,
    @Body('options') options?: { timeout?: number }
  ): Promise<QueryBuilderResult> {
    return this.queryBuilderService.buildQuery(data, options);
  }
}
