import { Controller, Post, Body, Logger } from '@nestjs/common';
import { HuggingFaceService } from './huggingface.service';
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
  private validateAndAnalyzeResponse(result: any): {
    isValid: boolean;
    confidenceScore: number;
  } {
    let confidenceScore = 1.0; // Score de base parfait

    // Vérifier que tous les champs nécessaires sont présents
    if (!result.question || !result.questionReformulated || !result.agent) {
      return { isValid: false, confidenceScore: 0 };
    }

    // Vérifier que la reformulation n'est pas identique à la question originale
    if (result.question.trim() === result.questionReformulated.trim()) {
      confidenceScore -= 0.3; // Pénalité pour non-reformulation
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

    // Considérer comme valide si le score est supérieur à un seuil
    const isValid = confidenceScore >= 0.6;

    return { isValid, confidenceScore };
  }
}
