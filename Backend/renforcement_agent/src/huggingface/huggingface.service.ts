import { Injectable, Logger } from '@nestjs/common';
import { HfInference } from '@huggingface/inference';
import { ConfigService } from '@nestjs/config';
import {
  getPromptEvaluationPrompt,
  getSqlEvaluationPrompt,
  getPromptSqlComparisonPrompt,
  getRagAnalysisPrompt,
} from './prompt';

export interface GenerationOptions {
  max_new_tokens?: number;
  temperature?: number;
  top_p?: number;
  repetition_penalty?: number;
}

@Injectable()
export class HuggingFaceService {
  private model: HfInference;
  private readonly logger = new Logger(HuggingFaceService.name);
  private readonly modelName = 'mistralai/Mistral-7B-Instruct-v0.2';

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('HUGGIN_FACE_TOKEN');
    this.logger.log(
      `Initialisation HuggingFace avec token: ${token ? 'présent' : 'manquant'}`,
    );

    if (!token) {
      throw new Error('HUGGIN_FACE_TOKEN non défini');
    }

    this.model = new HfInference(token);
  }

  /**
   * Génère une réponse textuelle à partir d'un prompt
   * @param prompt Le prompt à envoyer au modèle
   * @param options Options de génération (tokens max, température, etc.)
   * @returns Le texte généré
   */
  async generateText(
    prompt: string,
    options: GenerationOptions = {},
  ): Promise<string> {
    try {
      const response = await this.model.textGeneration({
        model: this.modelName,
        inputs: prompt,
        parameters: {
          max_new_tokens: options.max_new_tokens || 1024,
          temperature: options.temperature || 0.1,
          top_p: options.top_p || 0.95,
          repetition_penalty: options.repetition_penalty || 1.1,
        },
      });

      return response.generated_text || '';
    } catch (error) {
      this.logger.error(
        `Erreur lors de la génération de texte: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Évalue un prompt utilisateur
   * @param question La question à évaluer
   * @returns Évaluation au format JSON
   */
  async evaluatePrompt(question: string): Promise<any> {
    const prompt = getPromptEvaluationPrompt(question);
    const response = await this.generateText(prompt, {
      temperature: 0.1,
      max_new_tokens: 500,
    });

    try {
      // Extraire le JSON de la réponse
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Format de réponse invalide');
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'analyse de la réponse: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Évalue une requête SQL en fonction de la question originale
   * @param sqlQuery La requête SQL à évaluer
   * @param originalQuestion La question originale
   * @returns Évaluation au format JSON
   */
  async evaluateSqlQuery(
    sqlQuery: string,
    originalQuestion: string,
  ): Promise<any> {
    const prompt = getSqlEvaluationPrompt(sqlQuery, originalQuestion);
    const response = await this.generateText(prompt, {
      temperature: 0.1,
      max_new_tokens: 500,
    });

    try {
      // Extraire le JSON de la réponse
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Format de réponse invalide');
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'analyse de la réponse: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Compare un prompt utilisateur et une requête SQL générée
   * @param userPrompt Le prompt utilisateur
   * @param sqlQuery La requête SQL générée
   * @returns Évaluation de la correspondance au format JSON
   */
  async comparePromptAndSql(
    userPrompt: string,
    sqlQuery: string,
  ): Promise<any> {
    const prompt = getPromptSqlComparisonPrompt(userPrompt, sqlQuery);
    const response = await this.generateText(prompt, {
      temperature: 0.1,
      max_new_tokens: 500,
    });

    try {
      // Extraire le JSON de la réponse
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Format de réponse invalide');
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'analyse de la réponse: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Génère un rapport d'analyse sur les collections RAG
   * @param stats Statistiques des collections
   * @returns Rapport d'analyse au format JSON
   */
  async generateRagAnalysisReport(stats: any): Promise<any> {
    const prompt = getRagAnalysisPrompt(stats);
    const response = await this.generateText(prompt, {
      temperature: 0.3,
      max_new_tokens: 1000,
    });

    try {
      // Extraire le JSON de la réponse
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Format de réponse invalide');
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'analyse de la réponse: ${error.message}`,
      );
      throw error;
    }
  }
}
