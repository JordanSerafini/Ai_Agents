import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, Observable } from 'rxjs';
import { AnalyseRequestDto } from '../dto/analyse-request.dto';
import { AnalyseResponseDto } from '../dto/analyse-response.dto';
import { PrioriteType } from '../interfaces/analyse.interface';
import axios, { AxiosResponse } from 'axios';

interface OllamaResponse {
  response: string;
}

@Injectable()
export class AnalyseService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async analyser(request: AnalyseRequestDto): Promise<{ reponse: string }> {
    const ollamaUrl =
      this.configService.get<string>('OLLAMA_SERVICE_URL') ?? '';

    try {
      const prompt = `Analyse la question suivante et fournis une réponse appropriée : ${request.question}`;

      const httpService = this.httpService as unknown as {
        post: <T>(url: string, data: unknown) => Observable<AxiosResponse<T>>;
      };

      const response = await firstValueFrom<AxiosResponse<OllamaResponse>>(
        httpService.post<OllamaResponse>(`${ollamaUrl}/generate`, {
          prompt,
          model: 'mistral',
        }),
      );

      return {
        reponse: response.data.response,
      };
    } catch (error) {
      console.error("Erreur lors de l'analyse:", error);
      throw new Error("Erreur lors de l'analyse");
    }
  }

  async analyseDemande(
    request: AnalyseRequestDto,
  ): Promise<AnalyseResponseDto> {
    const prompt = this.construirePrompt(request);
    const reponse = await this.appelerOllamaService(prompt);
    return this.parserReponse(reponse);
  }

  private async appelerOllamaService(prompt: string): Promise<string> {
    try {
      const response = await axios.post<{ response: string }>(
        `${this.configService.get<string>('OLLAMA_SERVICE_URL')}/ollama/generate`,
        { prompt },
      );
      return response.data.response;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const message =
          typeof error.response?.data === 'string'
            ? error.response.data
            : error.message;
        throw new Error(`Erreur lors de l'analyse: ${message}`);
      }
      throw error;
    }
  }

  private construirePrompt(request: AnalyseRequestDto): string {
    return `Analyze the following question and provide a structured response:
    Question: ${request.question || ''}
    
    Respond in JSON format with the following fields:
    - mainIntent: { name: string, confidence: number, description: string }
    - subIntents: Array<{ name: string, description: string, confidence: number }>
    - entities: string[] (extract key information like dates, locations, numbers, etc.)
    - priorityLevel: "HIGH" | "MEDIUM" | "LOW" (based on urgency and importance)
    - constraints: string[] (any limitations or requirements mentioned)
    - context: string (inferred context from the question)
    
    Example response for "Je voudrais réserver un train pour Paris demain":
    {
      "mainIntent": {
        "name": "reservation",
        "confidence": 0.95,
        "description": "User wants to make a travel reservation"
      },
      "subIntents": [
        {
          "name": "train_booking",
          "description": "Specific request for train ticket booking",
          "confidence": 0.9
        }
      ],
      "entities": ["Paris", "demain"],
      "priorityLevel": "MEDIUM",
      "constraints": ["transport_type", "destination", "date"],
      "context": "User is planning travel and needs transportation"
    }`;
  }

  private parserReponse(reponse: string): AnalyseResponseDto {
    try {
      const parsed = JSON.parse(reponse) as {
        mainIntent: {
          name: string;
          confidence: number;
          description: string;
        };
        subIntents: Array<{
          name: string;
          description: string;
          confidence: number;
        }>;
        entities: string[];
        priorityLevel: 'HIGH' | 'MEDIUM' | 'LOW';
        constraints: string[];
        context: string;
      };

      return {
        demandeId: Date.now().toString(),
        intentionPrincipale: {
          nom: parsed.mainIntent.name,
          confiance: parsed.mainIntent.confidence,
          description: parsed.mainIntent.description,
        },
        sousIntentions: parsed.subIntents.map((intent) => ({
          nom: intent.name,
          description: intent.description,
          confiance: intent.confidence,
        })),
        entites: parsed.entities,
        niveauUrgence: parsed.priorityLevel as PrioriteType,
        contraintes: parsed.constraints,
        contexte: parsed.context,
        timestamp: new Date(),
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Erreur lors de l'analyse: ${errorMessage}`);
    }
  }
}
