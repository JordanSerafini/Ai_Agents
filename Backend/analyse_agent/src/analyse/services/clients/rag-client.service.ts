import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

@Injectable()
export class RagClientService {
  private readonly logger = new Logger(RagClientService.name);
  private readonly ragAgentUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.ragAgentUrl = this.configService.get<string>(
      'RAG_AGENT_URL',
      'http://rag_agent:3004',
    );
    this.logger.log(`RAG Agent URL: ${this.ragAgentUrl}`);
  }

  /**
   * Récupère des connaissances pertinentes pour une question
   */
  async getKnowledge(question: string, options?: any): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.ragAgentUrl}/knowledge`, {
          question,
          options: options || {
            limit: 3,
            threshold: 0.7,
          },
        }),
      );
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `Erreur lors de la récupération des connaissances: ${axiosError.message}`,
      );
      if (axiosError.response) {
        this.logger.error(
          `Détails: ${JSON.stringify(axiosError.response.data)}`,
        );
      }
      throw new Error(
        `Erreur de récupération des connaissances: ${axiosError.message}`,
      );
    }
  }

  /**
   * Ajoute un document à la base de connaissances
   */
  async addDocument(document: any): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.ragAgentUrl}/documents`, document),
      );
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `Erreur lors de l'ajout du document: ${axiosError.message}`,
      );
      if (axiosError.response) {
        this.logger.error(
          `Détails: ${JSON.stringify(axiosError.response.data)}`,
        );
      }
      throw new Error(`Erreur d'ajout du document: ${axiosError.message}`);
    }
  }

  /**
   * Génère une réponse enrichie à partir d'une question et de contexte
   */
  async generateResponse(question: string, context?: any): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.ragAgentUrl}/generate`, {
          question,
          context,
        }),
      );
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `Erreur lors de la génération de la réponse: ${axiosError.message}`,
      );
      if (axiosError.response) {
        this.logger.error(
          `Détails: ${JSON.stringify(axiosError.response.data)}`,
        );
      }
      throw new Error(
        `Erreur de génération de la réponse: ${axiosError.message}`,
      );
    }
  }

  /**
   * Vérifie la santé de l'agent RAG
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.ragAgentUrl}/health`),
      );
      return response.data.status === 'ok';
    } catch (error) {
      this.logger.error(`L'agent RAG n'est pas disponible: ${error.message}`);
      return false;
    }
  }
}
