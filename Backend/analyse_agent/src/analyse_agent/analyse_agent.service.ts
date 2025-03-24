import { Injectable } from '@nestjs/common';
import { QueryBuilderService } from '../querybuilder/querybuilder.service';
import { HuggingFaceService } from '../huggingface/huggingface.service';

@Injectable()
export class AnalyseAgentService {
  constructor(
    private readonly queryBuilderService: QueryBuilderService,
    private readonly huggingFaceService: HuggingFaceService,
  ) {}

  async analyzeQuestion(question: string) {
    const analysis = await this.huggingFaceService.analyseQuestion(question);

    if (analysis.agent === 'querybuilder' && analysis.finalQuery) {
      const result = await this.queryBuilderService.executeQuery(
        analysis.finalQuery,
      );
      return {
        ...analysis,
        data: result.rows,
      };
    }

    return analysis;
  }
}
