import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AnalyseRequestDto } from '../dto/analyse-request.dto';
import { AnalyseResponseDto } from '../dto/analyse-response.dto';
import { IntentionConfig, PrioriteType } from '../interfaces/analyse.interface';

@Injectable()
export class AnalyseService {
  private readonly logger = new Logger(AnalyseService.name);
  private openai: OpenAI;
  private config: IntentionConfig[];

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
    // TODO: Charger la configuration depuis un fichier
    this.config = [];
  }

  async analyseDemande(
    demande: AnalyseRequestDto,
  ): Promise<AnalyseResponseDto> {
    try {
      const prompt = this.construirePrompt(demande);
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content:
              "Tu es un assistant spécialisé dans l'analyse des demandes de construction.",
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const reponse = completion.choices[0].message.content || '';
      return this.parserReponse(reponse, demande);
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Erreur lors de l'analyse: ${error.message}`);
      } else {
        this.logger.error("Erreur inconnue lors de l'analyse");
      }
      throw error;
    }
  }

  private construirePrompt(demande: AnalyseRequestDto): string {
    return `
      Analyse la demande suivante et identifie:
      1. L'intention principale
      2. Les sous-intentions
      3. Les entités mentionnées
      4. Le niveau d'urgence
      5. Les contraintes spécifiques

      Demande: "${demande.texte}"
      Contexte: ${demande.contexte || 'Aucun contexte fourni'}
    `;
  }

  private parserReponse(
    reponse: string,
    demande: AnalyseRequestDto,
  ): AnalyseResponseDto {
    try {
      const lines = reponse.split('\n');
      let intentionPrincipale = {
        nom: 'Non identifiée',
        confiance: 0,
        description: 'Intention non identifiée',
      };
      const sousIntentions: IntentionConfig[] = [];
      const entites: string[] = [];
      const niveauUrgence: PrioriteType = 'MEDIUM';
      const contraintes: string[] = [];

      for (const line of lines) {
        if (line.includes('Intention principale:')) {
          const match = line.match(/Intention principale: (.*?) \((.*?)\)/);
          if (match) {
            intentionPrincipale = {
              nom: match[1],
              confiance: parseFloat(match[2]),
              description: this.trouverDescriptionIntention(match[1]),
            };
          }
        }
      }

      return {
        demandeId: demande.id,
        intentionPrincipale,
        sousIntentions,
        entites,
        niveauUrgence,
        contraintes,
        contexte: demande.contexte || '',
        timestamp: new Date(),
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Erreur lors du parsing de la réponse: ${error.message}`,
        );
      } else {
        this.logger.error('Erreur inconnue lors du parsing de la réponse');
      }
      throw new Error("Erreur lors de l'analyse de la réponse");
    }
  }

  private trouverDescriptionIntention(nom: string): string {
    const intention = this.config.find((i) => i.name === nom);
    return intention ? intention.description : 'Description non disponible';
  }
}
