import { Controller, Post, Body, Logger } from '@nestjs/common';
import { HuggingFaceService, AnalysisResult } from './huggingface.service';
import { RagService } from '../RAG/rag.service';
import { v4 as uuidv4 } from 'uuid';

@Controller('analyse')
export class HuggingFaceController {
  private readonly logger = new Logger(HuggingFaceController.name);
  private readonly promptCollectionName = 'user_prompts';

  constructor(
    private readonly huggingFaceService: HuggingFaceService,
    private readonly ragService: RagService,
  ) {
    // Créer la collection pour les prompts si elle n'existe pas
    void this.initPromptCollection();
  }

  private async initPromptCollection() {
    try {
      await this.ragService.getOrCreateCollection(this.promptCollectionName);
      this.logger.log(`Collection ${this.promptCollectionName} initialisée`);
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'initialisation de la collection: ${error.message}`,
      );
    }
  }

  @Post('question')
  async analyseQuestion(@Body() body: { question: string }) {
    const { question } = body;

    // Vérifier si une question similaire existe déjà
    const similarResult = await this.ragService.findSimilarPrompt(
      this.promptCollectionName,
      question,
    );

    if (similarResult.found) {
      this.logger.log(
        `Question similaire trouvée avec score: ${similarResult.similarity}`,
      );
      return {
        source: 'cache',
        original: similarResult.prompt,
        similarity: similarResult.similarity,
        result: await this.huggingFaceService.analyseQuestion(question),
      };
    }

    try {
      // Analyser la question avec Hugging Face
      const result = await this.huggingFaceService.analyseQuestion(question);

      // Analyser la confiance et valider la réponse
      const validation = this.validateAndAnalyzeResponse(result);

      if (validation.isValid) {
        // Sauvegarder la question avec les métadonnées de confiance
        await this.ragService.upsertDocuments(
          this.promptCollectionName,
          [question],
          [uuidv4()],
          [
            {
              confidenceScore: validation.confidenceScore,
              agent: result.agent,
              timestamp: new Date().toISOString(),
            },
          ],
        );

        return {
          source: 'model',
          result,
          confidence: validation.confidenceScore,
        };
      } else {
        this.logger.warn(
          `Réponse non valide pour la question: ${question}, confiance: ${validation.confidenceScore}`,
        );
        return {
          source: 'model',
          result,
          confidence: validation.confidenceScore,
          warning:
            'Réponse potentiellement incorrecte, non enregistrée en cache',
        };
      }
    } catch (error) {
      this.logger.error(`Erreur lors de l'analyse: ${error.message}`);
      throw error;
    }
  }

  /**
   * Valide la réponse et analyse le niveau de confiance
   */
  private validateAndAnalyzeResponse(result: AnalysisResult): {
    isValid: boolean;
    confidenceScore: number;
  } {
    let confidenceScore = 1.0; // Score de base parfait

    // Vérifier que tous les champs nécessaires sont présents
    if (!result.question || !result.questionReformulated || !result.agent) {
      return { isValid: false, confidenceScore: 0 };
    }

    // Vérifier si la question a été correctement reformulée
    if (result.question.trim() === result.questionReformulated.trim()) {
      confidenceScore -= 0.6; // Pénalité sévère pour non-reformulation
      this.logger.warn(
        'Aucune reformulation effectuée, forte pénalité appliquée',
      );
    }

    // Vérifier que la reformulation est plus longue pour les questions courtes
    if (
      result.question.length < 15 &&
      result.questionReformulated.length < result.question.length * 2
    ) {
      confidenceScore -= 0.4; // Pénalité pour reformulation insuffisante des questions courtes
      this.logger.warn('Reformulation insuffisante pour une question courte');
    }

    // Analyser la pertinence des champs spécifiques à l'agent
    if (result.agent === 'querybuilder') {
      // Vérifier les champs spécifiques au querybuilder
      if (!result.tables || result.tables.length === 0) {
        confidenceScore -= 0.4; // Pénalité sévère pour absence de tables
        this.logger.warn(
          'Aucune table spécifiée pour une requête querybuilder',
        );
      }

      if (!result.fields || result.fields.length === 0) {
        confidenceScore -= 0.3; // Pénalité pour absence de champs à afficher
        this.logger.warn('Aucun champ à afficher spécifié');
      }

      if (!result.conditions || result.conditions.trim() === '') {
        confidenceScore -= 0.3; // Pénalité pour absence de conditions
        this.logger.warn('Aucune condition spécifiée');
      }

      // Vérifier si la requête finale a été générée
      if (!result.finalQuery || result.finalQuery.trim() === '') {
        confidenceScore -= 0.1; // Légère pénalité
        this.logger.warn('Requête SQL finale non générée');
      }
    } else if (result.agent === 'workflow') {
      // Vérifier les champs spécifiques au workflow
      if (!result.action) {
        confidenceScore -= 0.2; // Pénalité pour absence d'action
      }

      if (!result.entities || result.entities.length === 0) {
        confidenceScore -= 0.15; // Pénalité pour absence d'entités
      }

      if (!result.parameters || result.parameters.length === 0) {
        confidenceScore -= 0.1; // Pénalité pour absence de paramètres
      }
    }

    // Analyser la longueur de la reformulation
    const originalLength = result.question.length;
    const reformulatedLength = result.questionReformulated.length;

    // Si la reformulation est beaucoup plus courte, réduire la confiance
    if (reformulatedLength < originalLength * 0.5) {
      confidenceScore -= 0.2;
    }

    // Si la reformulation est beaucoup plus longue, augmenter légèrement la confiance
    if (reformulatedLength > originalLength * 1.5) {
      confidenceScore += 0.1;
    }

    // Limiter le score entre 0 et 1
    confidenceScore = Math.max(0, Math.min(1, confidenceScore));

    // Considérer comme valide uniquement si le score est supérieur à un seuil plus élevé
    const isValid = confidenceScore >= 0.7; // Seuil plus strict

    return { isValid, confidenceScore };
  }
}
