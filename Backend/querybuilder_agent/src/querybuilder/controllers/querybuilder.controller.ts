import { Controller, Post, Body, Get } from '@nestjs/common';
import { QueryBuilderService } from '../services/query-builder.service';
import {
  QueryBuilderResult,
  QueryBuilderOptions,
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

  @Get('health')
  async checkHealth() {
    return { status: 'ok' };
  }
}
