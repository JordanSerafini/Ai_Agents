import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

interface Document {
  id: string;
  document: string;
  metadata: Record<string, any>;
}

@Injectable()
export class RagService {
  private readonly embeddingServiceUrl: string;
  private readonly modelServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.embeddingServiceUrl =
      this.configService.get<string>('EMBEDDING_SERVICE_URL') ||
      'http://localhost:3002';
    this.modelServiceUrl =
      this.configService.get<string>('MODEL_SERVICE_URL') ||
      'http://localhost:3001';
  }

  async storeDocument(
    text: string,
    metadata: Record<string, any> = {},
  ): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.embeddingServiceUrl}/chroma/document`, {
          text,
          metadata,
        }),
      );
      return response.data;
    } catch (error) {
      console.error('Erreur lors du stockage du document:', error);
      throw error;
    }
  }

  async retrieveDocuments(
    query: string,
    limit: number = 5,
  ): Promise<Document[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.embeddingServiceUrl}/chroma/query`, {
          text: query,
          limit,
        }),
      );
      return response.data.documents;
    } catch (error) {
      console.error('Erreur lors de la récupération des documents:', error);
      throw error;
    }
  }

  async generateResponse(
    query: string,
    includeContext: boolean = true,
  ): Promise<string> {
    try {
      // 1. Récupérer les documents pertinents
      let context = '';

      if (includeContext) {
        const documents = await this.retrieveDocuments(query);

        if (documents.length > 0) {
          context =
            'Contexte:\n' + documents.map((doc) => doc.document).join('\n\n');
        }
      }

      // 2. Préparer la requête pour le modèle avec ou sans contexte
      let prompt = '';

      if (context) {
        prompt = `${context}\n\nEn te basant sur les informations du contexte ci-dessus, réponds à la question suivante:\n${query}`;
      } else {
        prompt = query;
      }

      // 3. Envoyer la requête au service de modèle
      const response = await firstValueFrom(
        this.httpService.post(`${this.modelServiceUrl}/v1/chat/completions`, {
          messages: [{ role: 'user', content: prompt }],
          max_tokens: -1,
          temperature: 0.2,
        }),
      );

      // 4. Retourner la réponse générée
      if (response.data.choices && response.data.choices.length > 0) {
        return response.data.choices[0].message.content;
      }

      return "Je n'ai pas pu générer de réponse.";
    } catch (error) {
      console.error('Erreur lors de la génération de la réponse:', error);
      throw error;
    }
  }
}
