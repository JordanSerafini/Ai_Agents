import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AnalyseRequestDto } from '../../dto/analyse-request.dto';
import { RouterConfigService } from './config.service';
import { RagResponse, RouterResponse } from './interfaces';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: RouterConfigService,
  ) {}

  /**
   * Traite une requête pour l'agent RAG
   */
  async processRequest(
    request: AnalyseRequestDto,
    additionalData?: Record<string, unknown>,
  ): Promise<RouterResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<RagResponse>(
          `${this.configService.ragAgentUrl}/generate`,
          {
            question: request.question,
            options: {
              ...(additionalData || {}),
            },
          },
        ),
      );

      return {
        reponse: response.data.answer || 'Aucune réponse générée.',
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la communication avec l'agent RAG: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
