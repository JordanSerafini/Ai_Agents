import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalyseRequestDto } from '../dto/analyse-request.dto';
import { AnalyseResponseDto } from '../dto/analyse-response.dto';
import { OllamaService } from './ollama.service';
import { PrioriteType } from '../interfaces/analyse.interface';

@Injectable()
export class AnalyseService {
  private readonly logger = new Logger(AnalyseService.name);

  constructor(
    private configService: ConfigService,
    private ollamaService: OllamaService,
  ) {}

  async analyseDemande(
    request: AnalyseRequestDto,
  ): Promise<AnalyseResponseDto> {
    const prompt = this.construirePrompt(request);
    const reponse = await this.ollamaService.generateResponse(prompt);
    return this.parserReponse(reponse);
  }

  private construirePrompt(request: AnalyseRequestDto): string {
    return `Analyse la demande suivante et fournis une réponse structurée:
    Demande: ${request.texte || ''}
    Contexte: ${request.contexte || ''}
    
    Réponds au format JSON avec les champs suivants:
    - intentionPrincipale: { nom: string, confiance: number, description: string }
    - sousIntentions: Array<{ nom: string, description: string, confiance: number }>
    - entites: string[]
    - niveauUrgence: "HAUTE" | "MOYENNE" | "BASSE"
    - contraintes: string[]
    - contexte: string`;
  }

  private parserReponse(reponse: string): AnalyseResponseDto {
    try {
      const parsed = JSON.parse(reponse) as {
        intentionPrincipale: {
          nom: string;
          confiance: number;
          description: string;
        };
        sousIntentions: Array<{
          nom: string;
          description: string;
          confiance: number;
        }>;
        entites: string[];
        niveauUrgence: 'HAUTE' | 'MOYENNE' | 'BASSE';
        contraintes: string[];
        contexte: string;
      };

      // Conversion du niveau d'urgence français vers l'anglais
      let priorite: PrioriteType = 'MEDIUM';
      if (parsed.niveauUrgence === 'HAUTE') {
        priorite = 'HIGH';
      } else if (parsed.niveauUrgence === 'MOYENNE') {
        priorite = 'MEDIUM';
      } else if (parsed.niveauUrgence === 'BASSE') {
        priorite = 'LOW';
      }

      return {
        demandeId: Date.now().toString(),
        intentionPrincipale: parsed.intentionPrincipale,
        sousIntentions: parsed.sousIntentions,
        entites: parsed.entites,
        niveauUrgence: priorite,
        contraintes: parsed.contraintes,
        contexte: parsed.contexte,
        timestamp: new Date(),
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      throw new Error(`Erreur lors du parsing de la réponse: ${errorMessage}`);
    }
  }
}
