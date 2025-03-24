import {
  Controller,
  Post,
  Body,
  Get,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ResponseAgentService } from './response_agent.service';
import { AnalyseAgentService } from '../analyse_agent/analyse_agent.service';
import { QueryBuilderService } from '../querybuilder/querybuilder.service';

interface FormattedResponse {
  data: any;
  type: 'list' | 'detail';
  humanResponse: string;
}

@Controller('response')
export class ResponseAgentController {
  constructor(
    private readonly responseAgentService: ResponseAgentService,
    private readonly analyseAgentService: AnalyseAgentService,
    private readonly queryBuilderService: QueryBuilderService,
  ) {}

  @Post('question')
  async handleQuestion(
    @Body('question') question: string,
  ): Promise<FormattedResponse> {
    try {
      // Analyser la question
      const analysisResult =
        await this.analyseAgentService.analyzeQuestion(question);

      // Si c'est une requête SQL, l'exécuter
      if (
        analysisResult.agent === 'querybuilder' &&
        analysisResult.finalQuery
      ) {
        const queryResult = await this.queryBuilderService.executeQuery(
          analysisResult.finalQuery,
        );
        analysisResult.data = queryResult.rows;
      }

      // Formater la réponse avec le ResponseAgentService
      const formattedResponse = await this.responseAgentService.formatResponse(
        question,
        analysisResult,
      );

      return formattedResponse;
    } catch (error) {
      throw new HttpException(
        'Erreur lors du traitement de la question',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  healthCheck() {
    return { status: 'ok' };
  }
}
