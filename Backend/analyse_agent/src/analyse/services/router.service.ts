import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AnalyseRequestDto } from '../dto/analyse-request.dto';
import { AgentType } from '../interfaces/analyse.interface';
import { AxiosError } from 'axios';
import {
  RouterConfigService,
  QueryBuilderService,
  ElasticsearchService,
  RagService,
  WorkflowService,
  RouterResponse,
} from './router';

@Injectable()
export class RouterService {
  private readonly logger = new Logger(RouterService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly routerConfigService: RouterConfigService,
    private readonly queryBuilderService: QueryBuilderService,
    private readonly elasticsearchService: ElasticsearchService,
    private readonly ragService: RagService,
    private readonly workflowService: WorkflowService,
  ) {
    this.logger.log('Service de routage initialisé');
  }

  /**
   * Route une requête vers l'agent approprié en fonction de sa catégorie
   */
  async routeRequest(
    request: AnalyseRequestDto,
    agentType: AgentType,
    additionalData?: Record<string, unknown>,
  ): Promise<RouterResponse> {
    this.logger.log(`Routage de la requête vers l'agent: ${agentType}`);

    try {
      switch (agentType) {
        case AgentType.QUERYBUILDER:
          return await this.queryBuilderService.processRequest(
            request,
            additionalData,
          );
        case AgentType.ELASTICSEARCH:
          return await this.elasticsearchService.processRequest(
            request,
            additionalData,
          );
        case AgentType.RAG:
          return await this.ragService.processRequest(request, additionalData);
        case AgentType.WORKFLOW:
          return await this.workflowService.processRequest(
            request,
            additionalData,
          );
        default:
          return {
            reponse: `Je ne sais pas comment traiter cette demande. Veuillez reformuler ou contacter l'administrateur.`,
          };
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `Erreur lors du routage vers l'agent ${agentType}: ${axiosError.message}`,
      );
      if (axiosError.response) {
        this.logger.error(
          `Détails: ${JSON.stringify(axiosError.response.data)}`,
        );
      }
      return {
        reponse: `Désolé, une erreur s'est produite lors de la communication avec l'agent ${agentType}. Veuillez réessayer plus tard.`,
      };
    }
  }
}
