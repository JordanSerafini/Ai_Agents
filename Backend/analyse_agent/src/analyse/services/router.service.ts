import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AnalyseRequestDto } from '../dto/analyse-request.dto';
import { AgentType } from './analyse.service';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

interface RouterResponse {
  reponse: string;
}

/**
 * Interface pour typer correctement la réponse de l'agent de base de données
 */
interface DatabaseResponse {
  reponse: string;
  success?: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class RouterService {
  private readonly logger = new Logger(RouterService.name);

  // URLs des différents agents
  private readonly queryBuilderAgentUrl: string;
  private readonly elasticsearchAgentUrl: string;
  private readonly ragAgentUrl: string;
  private readonly workflowAgentUrl: string;
  private readonly apiAgentUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // Récupérer les URLs des agents depuis la configuration
    this.queryBuilderAgentUrl = this.configService.get<string>(
      'QUERYBUILDER_AGENT_URL',
      'http://querybuilder_agent:3002',
    );
    this.elasticsearchAgentUrl = this.configService.get<string>(
      'ELASTICSEARCH_AGENT_URL',
      'http://elasticsearch_agent:3003',
    );
    this.ragAgentUrl = this.configService.get<string>(
      'RAG_AGENT_URL',
      'http://rag_agent:3004',
    );
    this.workflowAgentUrl = this.configService.get<string>(
      'WORKFLOW_AGENT_URL',
      'http://workflow_agent:3005',
    );
    this.apiAgentUrl = this.configService.get<string>(
      'API_AGENT_URL',
      'http://api_agent:3006',
    );

    this.logger.log(`Service de routage initialisé avec les URLs suivantes:`);
    this.logger.log(`- QueryBuilder Agent: ${this.queryBuilderAgentUrl}`);
    this.logger.log(`- Elasticsearch Agent: ${this.elasticsearchAgentUrl}`);
    this.logger.log(`- RAG Agent: ${this.ragAgentUrl}`);
    this.logger.log(`- Workflow Agent: ${this.workflowAgentUrl}`);
    this.logger.log(`- API Agent: ${this.apiAgentUrl}`);
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
          return await this.routeToQueryBuilder(request, additionalData);
        case AgentType.ELASTICSEARCH:
          return await this.routeToElasticsearch(request, additionalData);
        case AgentType.RAG:
          return await this.routeToRag(request, additionalData);
        case AgentType.WORKFLOW:
          return await this.routeToWorkflow(request, additionalData);
        case AgentType.API:
          return await this.routeToApi(request, additionalData);
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

  /**
   * Route une requête vers l'agent QueryBuilder
   */
  private async routeToQueryBuilder(
    request: AnalyseRequestDto,
    additionalData?: Record<string, unknown>,
  ): Promise<RouterResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.queryBuilderAgentUrl}/querybuilder/build`,
          {
            question: request.question,
            options: {
              includeMetadata: true,
              maxResults: 100,
              ...(additionalData || {}),
            },
          },
        ),
      );

      if (response.data.success) {
        return {
          reponse: `Requête SQL générée: ${response.data.sql}\n\nExplication: ${response.data.explanation}`,
        };
      } else {
        return {
          reponse: `Erreur lors de la génération de la requête SQL: ${response.data.error}`,
        };
      }
    } catch (error) {
      this.logger.error(
        `Erreur lors de la communication avec l'agent QueryBuilder: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Route une requête vers l'agent Elasticsearch
   */
  private async routeToElasticsearch(
    request: AnalyseRequestDto,
    additionalData?: Record<string, unknown>,
  ): Promise<RouterResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.elasticsearchAgentUrl}/search`, {
          query: request.question,
          options: {
            ...(additionalData || {}),
          },
        }),
      );

      if (response.data.hits && response.data.hits.length > 0) {
        const hits = response.data.hits.slice(0, 5); // Limiter à 5 résultats
        let reponse = `Résultats de recherche:\n\n`;

        hits.forEach((hit, index) => {
          const title = hit.title || hit._source.title || 'Document sans titre';
          const snippet =
            hit.highlight?.content?.[0] ||
            hit._source.content?.substring(0, 100) ||
            "Pas d'extrait disponible";
          reponse += `${index + 1}. ${title}\n${snippet}...\n\n`;
        });

        return { reponse };
      } else {
        return {
          reponse: `Aucun résultat trouvé pour votre recherche.`,
        };
      }
    } catch (error) {
      this.logger.error(
        `Erreur lors de la communication avec l'agent Elasticsearch: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Route une requête vers l'agent RAG
   */
  private async routeToRag(
    request: AnalyseRequestDto,
    additionalData?: Record<string, unknown>,
  ): Promise<RouterResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.ragAgentUrl}/generate`, {
          question: request.question,
          options: {
            ...(additionalData || {}),
          },
        }),
      );

      return {
        reponse: response.data.answer || 'Aucune réponse générée.',
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la communication avec l'agent RAG: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Route une requête vers l'agent Workflow
   */
  private async routeToWorkflow(
    request: AnalyseRequestDto,
    additionalData?: Record<string, unknown>,
  ): Promise<RouterResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.workflowAgentUrl}/process`, {
          question: request.question,
          userId: request.userId,
          additionalData,
        }),
      );

      return {
        reponse:
          response.data.reponse || 'Aucune réponse du service de workflow.',
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la communication avec l'agent Workflow: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Route une requête vers l'agent API
   */
  private async routeToApi(
    request: AnalyseRequestDto,
    additionalData?: Record<string, unknown>,
  ): Promise<RouterResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.apiAgentUrl}/query`, {
          question: request.question,
          userId: request.userId,
          additionalData,
        }),
      );

      return {
        reponse: response.data.reponse || 'Aucune réponse du service API.',
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la communication avec l'agent API: ${error.message}`,
      );
      throw error;
    }
  }
}
