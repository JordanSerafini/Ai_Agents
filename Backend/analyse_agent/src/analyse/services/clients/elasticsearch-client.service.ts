import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

@Injectable()
export class ElasticsearchClientService {
  private readonly logger = new Logger(ElasticsearchClientService.name);
  private readonly elasticsearchAgentUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.elasticsearchAgentUrl = this.configService.get<string>(
      'ELASTICSEARCH_AGENT_URL',
      'http://elasticsearch_agent:3003',
    );
    this.logger.log(`Elasticsearch Agent URL: ${this.elasticsearchAgentUrl}`);
  }

  /**
   * Effectue une recherche dans Elasticsearch
   */
  async search(query: string, options?: any): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.elasticsearchAgentUrl}/search`, {
          query,
          options: options || {
            index: 'default',
            size: 10,
          },
        }),
      );
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `Erreur lors de la recherche Elasticsearch: ${axiosError.message}`,
      );
      if (axiosError.response) {
        this.logger.error(
          `Détails: ${JSON.stringify(axiosError.response.data)}`,
        );
      }
      throw new Error(
        `Erreur de recherche Elasticsearch: ${axiosError.message}`,
      );
    }
  }

  /**
   * Indexe un document dans Elasticsearch
   */
  async indexDocument(index: string, document: any): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.elasticsearchAgentUrl}/index`, {
          index,
          document,
        }),
      );
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `Erreur lors de l'indexation du document: ${axiosError.message}`,
      );
      if (axiosError.response) {
        this.logger.error(
          `Détails: ${JSON.stringify(axiosError.response.data)}`,
        );
      }
      throw new Error(`Erreur d'indexation du document: ${axiosError.message}`);
    }
  }

  /**
   * Vérifie la santé de l'agent Elasticsearch
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.elasticsearchAgentUrl}/health`),
      );
      return response.data.status === 'ok';
    } catch (error) {
      this.logger.error(
        `L'agent Elasticsearch n'est pas disponible: ${error.message}`,
      );
      return false;
    }
  }
}
