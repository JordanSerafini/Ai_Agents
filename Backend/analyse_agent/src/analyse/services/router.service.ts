import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AnalyseRequestDto } from '../dto/analyse-request.dto';
import { AnalyseResult, AgentType } from './analyse.service';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

interface RouterResponse {
  reponse: string;
}

interface PeriodeTemporelle {
  debut?: string;
  fin?: string;
  precision?: string;
}

interface TableIdentifiee {
  nom: string;
  alias?: string;
  colonnes?: string[];
}

interface Metadonnees {
  tablesConcernees: string[];
  periodeTemporelle?: PeriodeTemporelle;
  tablesIdentifiees?: {
    principales: TableIdentifiee[];
    jointures: TableIdentifiee[];
    conditions: string[];
  };
  champsRequis?: {
    selection: string[];
    filtres: string[];
    groupement: string[];
  };
  filtres?: {
    temporels: string[];
    logiques: string[];
  };
  parametresRequete?: {
    tri: string[];
    limite: number;
  };
}

interface QueryBuilderResponse {
  success: boolean;
  sql?: string;
  explanation?: string;
  error?: string;
}

interface ElasticsearchHit {
  title?: string;
  _source?: {
    title?: string;
    content?: string;
  };
  highlight?: {
    content?: string[];
  };
}

interface ElasticsearchResponse {
  hits?: ElasticsearchHit[];
}

interface RagResponse {
  answer?: string;
}

interface WorkflowResponse {
  reponse?: string;
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
      const analyseResult = {
        ...additionalData,
        metadonnees: additionalData?.metadonnees as Metadonnees,
      } as AnalyseResult;

      // Formater la question avec les métadonnées d'analyse
      const formattedQuestion = {
        questionCorrigee: request.question,
        metadonnees: {
          tablesIdentifiees: {
            principales:
              analyseResult?.metadonnees?.tablesIdentifiees?.principales || [],
            jointures:
              analyseResult?.metadonnees?.tablesIdentifiees?.jointures || [],
            conditions:
              analyseResult?.metadonnees?.tablesIdentifiees?.conditions || [],
          },
          champsRequis: analyseResult?.metadonnees?.champsRequis || {
            selection: [],
            filtres: [],
            groupement: [],
          },
          filtres: analyseResult?.metadonnees?.filtres || {
            temporels: [],
            logiques: [],
          },
          periodeTemporelle:
            analyseResult?.metadonnees?.periodeTemporelle || {},
          parametresRequete: analyseResult?.metadonnees?.parametresRequete || {
            tri: [],
            limite: 100,
          },
          intention: analyseResult?.intention || '',
          contexte: analyseResult?.contexte || '',
          entites: analyseResult?.entites || [],
        },
      };

      const response = await firstValueFrom(
        this.httpService.post<QueryBuilderResponse>(
          `${this.queryBuilderAgentUrl}/querybuilder/build`,
          {
            question: JSON.stringify(formattedQuestion),
            options: {
              includeMetadata: true,
              maxResults: 100,
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
        `Erreur lors de la communication avec l'agent QueryBuilder: ${(error as Error).message}`,
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
        this.httpService.post<ElasticsearchResponse>(
          `${this.elasticsearchAgentUrl}/search`,
          {
            query: request.question,
            options: {
              ...(additionalData || {}),
            },
          },
        ),
      );

      if (response.data.hits && response.data.hits.length > 0) {
        const hits = response.data.hits.slice(0, 5);
        let reponse = `Résultats de recherche:\n\n`;

        hits.forEach((hit: ElasticsearchHit, index: number) => {
          const title =
            hit.title || hit._source?.title || 'Document sans titre';
          const snippet =
            hit.highlight?.content?.[0] ||
            hit._source?.content?.substring(0, 100) ||
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
        `Erreur lors de la communication avec l'agent Elasticsearch: ${(error as Error).message}`,
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
        this.httpService.post<RagResponse>(`${this.ragAgentUrl}/generate`, {
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
        `Erreur lors de la communication avec l'agent RAG: ${(error as Error).message}`,
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
        this.httpService.post<WorkflowResponse>(
          `${this.workflowAgentUrl}/process`,
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
