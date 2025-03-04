import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, Observable } from 'rxjs';
import { GenerateRequestDto } from '../dto/generate-request.dto';
import { AxiosResponse } from 'axios';

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-explicit-any */

interface OllamaResponse {
  response: string;
}

interface OllamaRequest {
  model: string;
  prompt: string;
}

type Config = {
  OLLAMA_SERVICE_URL: string;
  OLLAMA_MODEL: string;
};

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private readonly ollamaUrl: string;
  private readonly model: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService<Config>,
  ) {
    this.ollamaUrl = this.configService.get<string>('OLLAMA_SERVICE_URL') ?? '';
    this.model = this.configService.get<string>('OLLAMA_MODEL') ?? 'mistral';

    if (!this.ollamaUrl) {
      throw new InternalServerErrorException(
        "OLLAMA_SERVICE_URL est requis dans les variables d'environnement",
      );
    }
  }

  private createRequest(prompt: string): OllamaRequest {
    return {
      model: this.model,
      prompt,
    };
  }

  async generate(request: GenerateRequestDto): Promise<{ response: string }> {
    try {
      const requestData = this.createRequest(request.prompt);
      this.logger.log(
        `Envoi de la requête à Ollama: ${JSON.stringify(requestData)}`,
      );

      const observable: Observable<AxiosResponse<OllamaResponse>> =
        this.httpService.post(
          `${this.ollamaUrl}/api/generate`,
          requestData,
          { timeout: 5000 }, // Timeout pour éviter que la requête bloque
        );

      const response = await firstValueFrom(observable);

      if (!response.data || !response.data.response) {
        throw new InternalServerErrorException(
          "Réponse invalide reçue de l'API Ollama.",
        );
      }

      return { response: response.data.response };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Erreur lors de la génération: ${error.message}`,
          error.stack,
        );

        if ('response' in error) {
          this.logger.error(
            `Réponse Ollama: ${JSON.stringify((error as any).response?.data)}`,
          );
        }

        throw new InternalServerErrorException(
          `Erreur lors de la génération: ${error.message}`,
        );
      } else {
        this.logger.error(
          'Erreur inconnue lors de la génération de la réponse',
        );
        throw new InternalServerErrorException(
          'Erreur inconnue lors de la génération de la réponse',
        );
      }
    }
  }
}
