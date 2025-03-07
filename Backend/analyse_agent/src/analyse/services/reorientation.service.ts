import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AnalyseRequestDto } from '../dto/analyse-request.dto';
import {
  AgentType,
  QuestionCategory,
  AnalyseResult,
  PrioriteType,
} from '../interfaces/analyse.interface';
import { OpenAIService } from './openai.service';

interface ReorientationResponse {
  newCategory: QuestionCategory;
  newAgent: AgentType;
  explanation: string;
  confidence: number;
}

@Injectable()
export class ReorientationService {
  private readonly logger = new Logger(ReorientationService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly openaiService: OpenAIService,
  ) {}

  /**
   * Réoriente une analyse vers un agent plus approprié si nécessaire
   */
  async reorient(
    request: AnalyseRequestDto,
    analyse: AnalyseResult,
  ): Promise<AnalyseResult> {
    try {
      this.logger.log(
        `Vérification de la réorientation pour la question: ${request.question}`,
      );

      // Si la confiance est élevée, pas besoin de réorienter
      if (analyse.priorite === PrioriteType.HAUTE) {
        this.logger.log(
          `Confiance élevée, pas de réorientation nécessaire pour l'agent ${analyse.agentCible}`,
        );
        return analyse;
      }

      // Construire le prompt pour la réorientation
      const prompt = `
Tu es un expert en analyse et classification de requêtes utilisateur. 
Ta tâche est d'évaluer si l'agent actuellement sélectionné est le plus approprié pour traiter cette requête.

Question de l'utilisateur: "${request.question}"

Analyse actuelle:
- Catégorie: ${analyse.categorie}
- Agent cible: ${analyse.agentCible}
- Intention détectée: ${analyse.intention}
- Contexte: ${analyse.contexte}

Les agents disponibles sont:
- QUERYBUILDER: Pour les requêtes nécessitant des données structurées de la base de données (SQL)
- ELASTICSEARCH: Pour les recherches textuelles dans les documents
- RAG: Pour les questions nécessitant des connaissances spécifiques
- WORKFLOW: Pour les demandes de processus métier
- GENERAL: Pour les questions générales

Détermine si l'agent actuellement sélectionné est le plus approprié. Si non, indique quel agent serait plus adapté.
Réponds au format JSON avec les champs suivants:
{
  "newCategory": "DATABASE|SEARCH|KNOWLEDGE|WORKFLOW|GENERAL",
  "newAgent": "querybuilder|elasticsearch|rag|workflow|general",
  "explanation": "Explication de ton choix",
  "confidence": 0.X (entre 0 et 1)
}
`;

      // Appeler OpenAI pour la réorientation
      const reorientationResponse = await this.openaiService.sendMessage(
        prompt,
        {
          temperature: 0.2,
          max_tokens: 500,
        },
      );

      try {
        const reorientation = JSON.parse(
          reorientationResponse,
        ) as ReorientationResponse;

        // Si la confiance est suffisante et l'agent est différent, réorienter
        if (
          reorientation.confidence > 0.7 &&
          reorientation.newAgent !== analyse.agentCible
        ) {
          this.logger.log(
            `Réorientation de ${analyse.agentCible} vers ${reorientation.newAgent} (confiance: ${reorientation.confidence})`,
          );

          // Mettre à jour l'analyse
          return {
            ...analyse,
            categorie: reorientation.newCategory,
            agentCible: reorientation.newAgent,
            contexte: `${analyse.contexte} | Réorienté: ${reorientation.explanation}`,
          };
        }
      } catch (parseError) {
        this.logger.error(
          `Erreur lors du parsing de la réponse de réorientation: ${
            parseError instanceof Error ? parseError.message : 'Erreur inconnue'
          }`,
        );
      }

      // Par défaut, retourner l'analyse originale
      return analyse;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la réorientation: ${
          error instanceof Error ? error.message : 'Erreur inconnue'
        }`,
      );
      return analyse;
    }
  }
}
