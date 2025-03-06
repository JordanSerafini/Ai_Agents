import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  AnalyseService,
  AnalyseResult,
  AgentType,
  QuestionCategory,
} from './analyse.service';
import { ReorientationRequestDto } from '../dto/reorientation-request.dto';
import { PrioriteType } from '../interfaces/analyse.interface';

interface ReorientationResponse {
  questionOriginale: string;
  questionReformulée: string;
  intention: string;
  catégorie: string;
  agentCible: string;
  priorité: string;
  entités: string[];
  contexte: string;
  informationsManquantes?: string[];
  questionsComplémentaires?: string[];
  réponseAgent?: string;
}

@Injectable()
export class ReorientationService {
  private readonly logger = new Logger(ReorientationService.name);
  private readonly openaiApiKey: string;

  constructor(
    private readonly analyseService: AnalyseService,
    private readonly configService: ConfigService,
  ) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
    this.logger.log(
      `Service de réorientation initialisé avec OpenAI${
        this.openaiApiKey ? '' : ' (clé API manquante)'
      }`,
    );
  }

  /**
   * Réoriente une question d'utilisateur en l'analysant en profondeur
   * et en la reformulant pour extraire l'intention réelle.
   */
  async reorienterQuestion(
    request: ReorientationRequestDto,
  ): Promise<{ reponse: string }> {
    try {
      const userId = request.userId || 'anonymous';
      this.logger.log(
        `Réorientation de question pour l'utilisateur ${userId}: "${request.question}"`,
      );

      // Utiliser le service d'analyse pour analyser la question
      const analyseResult = await this.analyseService.analyserQuestion(
        request.question,
      );

      // Améliorer la reformulation de la question avec GPT-3.5/4
      const questionAméliorée = await this.améliorerReformulation(
        request.question,
        analyseResult,
        request.contexteOriginal,
      );

      // Construire une réponse détaillée avec la question reformulée et l'analyse
      const reponse: ReorientationResponse = {
        questionOriginale: request.question,
        questionReformulée: questionAméliorée || analyseResult.questionCorrigee,
        intention: analyseResult.intention,
        catégorie: this.catégorieToString(analyseResult.categorie),
        agentCible: this.agentToString(analyseResult.agentCible),
        priorité: analyseResult.priorite,
        entités: analyseResult.entites,
        contexte: analyseResult.contexte,
        informationsManquantes: analyseResult.informationsManquantes || [],
        questionsComplémentaires: analyseResult.questionsComplementaires || [],
      };

      // Si un contexte original est fourni, l'enrichir dans l'analyse
      if (request.contexteOriginal) {
        this.logger.log(
          `Contexte original fourni pour la réorientation: "${request.contexteOriginal}"`,
        );
        // On pourrait ici faire une analyse supplémentaire du contexte
      }

      const reponseJSON = JSON.stringify(reponse, null, 2);

      return {
        reponse: `Analyse et réorientation de la question:\n${reponseJSON}`,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la réorientation: ${
          error instanceof Error ? error.message : 'Erreur inconnue'
        }`,
      );
      return {
        reponse: `Erreur lors de la réorientation: ${
          error instanceof Error ? error.message : 'Une erreur est survenue'
        }`,
      };
    }
  }

  /**
   * Améliore la reformulation d'une question en utilisant le modèle de langage
   * en tenant compte du contexte original et de l'analyse préliminaire.
   */
  private async améliorerReformulation(
    questionOriginale: string,
    analyse: AnalyseResult,
    contexteOriginal?: string,
  ): Promise<string | null> {
    try {
      if (!this.openaiApiKey) {
        this.logger.warn(
          "Pas de clé API OpenAI - impossible d'améliorer la reformulation",
        );
        return null;
      }

      const prompt = `
Tu es un assistant spécialisé dans l'analyse et la reformulation de questions pour une entreprise de bâtiment (Technidalle).

Question originale: "${questionOriginale}"

Analyse préliminaire:
- Intention détectée: ${analyse.intention}
- Catégorie: ${this.catégorieToString(analyse.categorie)}
- Agent cible: ${this.agentToString(analyse.agentCible)}
- Entités identifiées: ${analyse.entites.join(', ')}
${contexteOriginal ? `\nContexte additionnel fourni:\n${contexteOriginal}` : ''}

Tâche: Reformule cette question pour la rendre plus précise, claire et complète. Extrais l'intention réelle derrière la formulation initiale.
La reformulation doit :
1. Corriger les erreurs grammaticales ou orthographiques
2. Clarifier les ambiguïtés
3. Ajouter le contexte implicite
4. Restructurer la question pour faciliter son traitement automatique

Retourne uniquement la question reformulée, sans commentaires ni explications.
`;

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content:
                'Tu es un assistant spécialisé dans la reformulation précise de questions. Tu réponds uniquement avec la question reformulée, sans ajouts.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 300,
        },
        {
          headers: {
            Authorization: `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );

      const reformulation = response.data.choices[0].message.content.trim();
      this.logger.log(`Question reformulée: "${reformulation}"`);
      return reformulation;
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'amélioration de la reformulation: ${
          error instanceof Error ? error.message : 'Erreur inconnue'
        }`,
      );
      return null;
    }
  }

  /**
   * Convertit l'enum de catégorie en chaîne de caractères
   */
  private catégorieToString(categorie: QuestionCategory): string {
    switch (categorie) {
      case QuestionCategory.GENERAL:
        return 'GENERAL';
      case QuestionCategory.API:
        return 'API';
      case QuestionCategory.WORKFLOW:
        return 'WORKFLOW';
      case QuestionCategory.AUTRE:
        return 'AUTRE';
      default:
        return 'GENERAL';
    }
  }

  /**
   * Convertit l'enum d'agent en chaîne de caractères
   */
  private agentToString(agent: AgentType): string {
    switch (agent) {
      case AgentType.QUERYBUILDER:
        return 'querybuilder';
      case AgentType.ELASTICSEARCH:
        return 'elasticsearch';
      case AgentType.RAG:
        return 'rag';
      case AgentType.GENERAL:
        return 'general';
      default:
        return 'general';
    }
  }
}
