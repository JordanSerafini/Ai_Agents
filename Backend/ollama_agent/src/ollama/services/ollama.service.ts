import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface OllamaResponse {
  response: string;
  done: boolean;
}

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private readonly ollamaUrl: string;
  private readonly model: string;

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('OLLAMA_URL');
    const model = this.configService.get<string>('OLLAMA_MODEL');

    if (!url || !model) {
      throw new Error('OLLAMA_URL et OLLAMA_MODEL doivent être définis');
    }

    this.ollamaUrl = url;
    this.model = model;
  }

  async generateResponse(prompt: string): Promise<string> {
    try {
      const response = await axios.post<OllamaResponse>(
        `${this.ollamaUrl}/api/generate`,
        {
          model: this.model,
          prompt,
          stream: false,
        },
      );

      return response.data.response;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data || error.message;
        this.logger.error(`Erreur Ollama: ${message}`);
        throw new Error(
          `Erreur lors de la génération de la réponse: ${message}`,
        );
      } else if (error instanceof Error) {
        this.logger.error(`Erreur inattendue: ${error.message}`);
        throw new Error(
          `Erreur inattendue lors de la génération de la réponse: ${error.message}`,
        );
      } else {
        this.logger.error(
          'Erreur inconnue lors de la génération de la réponse',
        );
        throw new Error('Erreur inconnue lors de la génération de la réponse');
      }
    }
  }
} 