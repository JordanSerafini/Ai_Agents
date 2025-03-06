import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AnalyseResult, AnalyseQueryData } from './analyse.service';

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
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/querybuilder/build`, {
          question: typeof input === 'string' ? input : JSON.stringify(input),
        }),
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
export class RagClientService {
  private readonly logger = new Logger(RagClientService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('RAG_AGENT_URL') ||
      'http://rag_agent:3004';
    this.logger.log(`RAG Agent URL: ${this.baseUrl}`);
  }

  async getKnowledge(question: string, analyse: AnalyseResult): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/rag/knowledge`, {
          question,
          contexte: analyse.contexte,
          entites: analyse.entites,
        }),
      );
      return response.data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(`Erreur lors de la récupération des connaissances: ${errorMessage}`);
      throw new Error(`Erreur lors de la récupération des connaissances: ${errorMessage}`);
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<HealthResponse>(`${this.baseUrl}/rag/health`),
      );
      return response.data?.status === 'ok';
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(`Erreur lors de la vérification de la santé du service RAG: ${errorMessage}`);
      return false;
    }
  }
}
