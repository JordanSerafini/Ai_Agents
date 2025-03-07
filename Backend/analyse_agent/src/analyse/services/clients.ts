import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AnalyseResult } from '../interfaces/analyse.interface';
import { AnalyseQueryData } from '../../querybuilder/interfaces/query-builder.types';
import { catchError } from 'rxjs/operators';
import { AxiosError } from 'axios';

interface HealthResponse {
  status: string;
  timestamp?: string;
  service?: string;
}

@Injectable()
export class QueryBuilderClientService {
  private readonly logger = new Logger(QueryBuilderClientService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('QUERYBUILDER_AGENT_URL') ||
      'http://querybuilder_agent:3002';
    this.logger.log(`QueryBuilder Agent URL: ${this.baseUrl}`);
  }

  async buildQuery(input: string | AnalyseQueryData): Promise<any> {
    try {
      const data = typeof input === 'string' ? JSON.parse(input) : input;
      
      this.logger.debug(`Envoi de la requête au QueryBuilder: ${JSON.stringify(data)}`);
      
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/querybuilder/build`, data),
      );
      return response.data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(`Erreur lors de la construction de la requête: ${errorMessage}`);
      throw new Error(`Erreur lors de la génération de la requête SQL: ${errorMessage}`);
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<HealthResponse>(`${this.baseUrl}/querybuilder/health`),
      );
      return response.data?.status === 'ok';
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(`Erreur lors de la vérification de la santé du service QueryBuilder: ${errorMessage}`);
      return false;
    }
  }
}

@Injectable()
export class ElasticsearchClientService {
  private readonly logger = new Logger(ElasticsearchClientService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('ELASTICSEARCH_AGENT_URL') ||
      'http://elasticsearch_agent:3003';
    this.logger.log(`Elasticsearch Agent URL: ${this.baseUrl}`);
  }

  async search(question: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/elasticsearch/search`, {
          question,
        }),
      );
      return response.data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(`Erreur lors de la recherche Elasticsearch: ${errorMessage}`);
      throw new Error(`Erreur lors de la recherche textuelle: ${errorMessage}`);
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<HealthResponse>(`${this.baseUrl}/elasticsearch/health`),
      );
      return response.data?.status === 'ok';
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(`Erreur lors de la vérification de la santé du service Elasticsearch: ${errorMessage}`);
      return false;
    }
  }
}

@Injectable()
export class RagClientLocalService {
  private readonly logger = new Logger(RagClientLocalService.name);
  private readonly ragServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.ragServiceUrl = this.configService.get<string>('RAG_SERVICE_URL', 'http://rag-agent:3000');
  }

  async query(query: string): Promise<string> {
    try {
      const { data } = await firstValueFrom(
        this.httpService
          .post(`${this.ragServiceUrl}/rag/query`, { query })
          .pipe(
            catchError((error: AxiosError) => {
              this.logger.error(`Error querying RAG service: ${error.message}`);
              throw error;
            }),
          ),
      );
      return data;
    } catch (error) {
      this.logger.error(`Failed to query RAG service: ${error.message}`);
      throw error;
    }
  }

  async indexAndQuery(document: any, query: string): Promise<string> {
    try {
      const { data } = await firstValueFrom(
        this.httpService
          .post(`${this.ragServiceUrl}/rag/index-and-query`, { document, query })
          .pipe(
            catchError((error: AxiosError) => {
              this.logger.error(`Error in index and query RAG service: ${error.message}`);
              throw error;
            }),
          ),
      );
      return data;
    } catch (error) {
      this.logger.error(`Failed to index and query RAG service: ${error.message}`);
      throw error;
    }
  }
}

    }
  }

  async indexAndQuery(document: any, query: string): Promise<string> {
    try {
      const { data } = await firstValueFrom(
        this.httpService
          .post(`${this.ragServiceUrl}/rag/index-and-query`, {
            document,
            query,
          })
          .pipe(
            catchError((error: AxiosError) => {
              this.logger.error(
                `Error in index and query RAG service: ${error.message}`,
              );
              throw error;
            }),
          ),
      );
      return data;
    } catch (error) {
      this.logger.error(
        `Failed to index and query RAG service: ${error.message}`,
      );
      throw error;
    }
  }
}
