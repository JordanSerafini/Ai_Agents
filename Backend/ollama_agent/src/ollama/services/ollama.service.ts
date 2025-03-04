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

// Structure simple pour le cache
interface CacheEntry {
  response: string;
  timestamp: number;
}

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private readonly ollamaUrl: string;
  private readonly model: string;
  private readonly responseCache: Map<string, CacheEntry> = new Map();
  private readonly cacheTTL: number = 3600000; // 1 heure en millisecondes
  private modelLoaded: boolean = false;

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

    // Précharger le modèle au démarrage
    this.preloadModel();
  }

  private async preloadModel(): Promise<void> {
    try {
      this.logger.log(`Préchargement du modèle ${this.model}...`);
      await this.generate({ prompt: 'Initialisation du modèle' });
      this.modelLoaded = true;
      this.logger.log(`Modèle ${this.model} préchargé avec succès!`);
    } catch (error) {
      this.logger.error(
        `Erreur lors du préchargement du modèle: ${error.message}`,
      );
    }
  }

  private createRequest(prompt: string): OllamaRequest {
    return {
      model: this.model,
      prompt,
    };
  }

  private getCacheKey(prompt: string): string {
    // Clé de cache simple basée sur le prompt
    return `${this.model}:${prompt}`;
  }

  private getFromCache(prompt: string): string | null {
    const key = this.getCacheKey(prompt);
    const cached = this.responseCache.get(key);

    if (!cached) return null;

    // Vérifier si l'entrée du cache est expirée
    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.responseCache.delete(key);
      return null;
    }

    this.logger.log(
      `Réponse trouvée dans le cache pour: ${prompt.substring(0, 50)}...`,
    );
    return cached.response;
  }

  private saveToCache(prompt: string, response: string): void {
    const key = this.getCacheKey(prompt);
    this.responseCache.set(key, {
      response,
      timestamp: Date.now(),
    });
    this.logger.log(
      `Réponse mise en cache pour: ${prompt.substring(0, 50)}...`,
    );
  }

  async generate(request: GenerateRequestDto): Promise<{ response: string }> {
    try {
      // Vérifier le cache d'abord
      const cachedResponse = this.getFromCache(request.prompt);
      if (cachedResponse) {
        return { response: cachedResponse };
      }

      const requestData = this.createRequest(request.prompt);
      this.logger.log(
        `Envoi de la requête à Ollama: ${JSON.stringify(requestData)}`,
      );

      const observable: Observable<AxiosResponse<OllamaResponse>> =
        this.httpService.post(`${this.ollamaUrl}/api/generate`, requestData, {
          timeout: 60000,
        });

      const response = await firstValueFrom(observable);

      if (!response.data || !response.data.response) {
        throw new InternalServerErrorException(
          "Réponse invalide reçue de l'API Ollama.",
        );
      }

      // Mettre en cache la réponse
      this.saveToCache(request.prompt, response.data.response);

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
