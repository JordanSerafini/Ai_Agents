import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AnalyseRequestDto } from '../../dto/analyse-request.dto';
import { RouterConfigService } from './config.service';
import {
  ElasticsearchHit,
  ElasticsearchResponse,
  RouterResponse,
} from './interfaces';

@Injectable()
export class ElasticsearchService {
  private readonly logger = new Logger(ElasticsearchService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: RouterConfigService,
  ) {}

  /**
   * Traite une requête pour l'agent Elasticsearch
   */
  async processRequest(
    request: AnalyseRequestDto,
    additionalData?: Record<string, unknown>,
  ): Promise<RouterResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<ElasticsearchResponse>(
          `${this.configService.elasticsearchAgentUrl}/search`,
          {
            query: request.question,
            options: {
              ...(additionalData || {}),
            },
          },
        ),
      );

      return this.formatResponse(response.data);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la communication avec l'agent Elasticsearch: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Formate la réponse de l'agent Elasticsearch
   */
  private formatResponse(data: ElasticsearchResponse): RouterResponse {
    if (data.hits && data.hits.length > 0) {
      const hits = data.hits.slice(0, 5);
      let reponse = `Résultats de recherche:\n\n`;

      hits.forEach((hit: ElasticsearchHit, index: number) => {
        const title = hit.title || hit._source?.title || 'Document sans titre';
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
  }
}
