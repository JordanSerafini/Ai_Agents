import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

@Injectable()
export class QueryBuilderClientService {
  private readonly logger = new Logger(QueryBuilderClientService.name);
  private readonly queryBuilderUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.queryBuilderUrl = this.configService.get<string>(
      'QUERYBUILDER_AGENT_URL',
      'http://querybuilder_agent:3002',
    );
    this.logger.log(`QueryBuilder Agent URL: ${this.queryBuilderUrl}`);
  }

  /**
   * Construit une requête SQL à partir d'une question en langage naturel
   */
  async buildQuery(question: string, options?: any): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.queryBuilderUrl}/querybuilder/build`, {
          question,
          options: options || {
            includeMetadata: true,
            maxResults: 100,
          },
        }),
      );
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `Erreur lors de la communication avec l'agent QueryBuilder: ${axiosError.message}`,
      );
      if (axiosError.response) {
        this.logger.error(
          `Détails: ${JSON.stringify(axiosError.response.data)}`,
        );
      }
      throw new Error(
        `Erreur de communication avec l'agent QueryBuilder: ${axiosError.message}`,
      );
    }
  }

  /**
   * Construit une requête Elasticsearch à partir d'une configuration de recherche
   */
  async buildElasticsearchQuery(searchConfig: any): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.queryBuilderUrl}/querybuilder/elasticsearch`,
          searchConfig,
        ),
      );
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `Erreur lors de la construction de la requête Elasticsearch: ${axiosError.message}`,
      );
      if (axiosError.response) {
        this.logger.error(
          `Détails: ${JSON.stringify(axiosError.response.data)}`,
        );
      }
      throw new Error(
        `Erreur de construction de la requête Elasticsearch: ${axiosError.message}`,
      );
    }
  }

  /**
   * Vérifie la santé de l'agent QueryBuilder
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.queryBuilderUrl}/querybuilder/health`),
      );
      return response.data.status === 'ok';
    } catch (error) {
      this.logger.error(
        `L'agent QueryBuilder n'est pas disponible: ${error.message}`,
      );
      return false;
    }
  }
}
