import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AnalyseRequestDto } from '../../dto/analyse-request.dto';
import { RouterConfigService } from './config.service';
import { RouterResponse, WorkflowResponse } from './interfaces';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: RouterConfigService,
  ) {}

  /**
   * Traite une requête pour l'agent Workflow
   */
  async processRequest(
    request: AnalyseRequestDto,
    additionalData?: Record<string, unknown>,
  ): Promise<RouterResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<WorkflowResponse>(
          `${this.configService.workflowAgentUrl}/process`,
          {
            question: request.question,
            userId: request.userId,
            additionalData,
          },
        ),
      );

      return {
        reponse:
          response.data.reponse || 'Aucune réponse du service de workflow.',
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la communication avec l'agent Workflow: ${(error as Error).message}`,
      );
      throw error;
    }
  }
} 