import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HuggingFaceService } from '../huggingface/huggingface.service';
import { RagService, RagDocument, RagRating } from '../RAG/rag.service';

@Injectable()
export class RagValidatorService {
  private readonly logger = new Logger(RagValidatorService.name);
  private readonly promptCollectionName = 'user_prompts';
  private readonly sqlQueryCacheName = 'sql_queries';

  constructor(
    private readonly configService: ConfigService,
    private readonly huggingFaceService: HuggingFaceService,
    private readonly ragService: RagService,
  ) {
    this.logger.log('RagValidatorService initialisé');
  }

  /**
   * Évalue la pertinence d'un document RAG par rapport à une requête
   */
  async evaluateRagDocument(
    document: string,
    query: string,
  ): Promise<RagRating> {
    return this.ragService.evaluateRagDocument(document, query);
  }

  /**
   * Évalue et met à jour un document dans la collection RAG
   */
  async evaluateAndUpdateDocument(
    collectionName: string,
    documentId: string,
    query: string,
  ): Promise<RagDocument> {
    return this.ragService.evaluateAndUpdateDocument(
      collectionName,
      documentId,
      query,
    );
  }

  /**
   * Valide tous les documents d'une collection
   */
  async validateCollection(collectionName: string): Promise<{
    totalDocuments: number;
    evaluatedDocuments: number;
    averageRating: number;
    documentRatings: Array<{ id: string; rating: RagRating }>;
  }> {
    return this.ragService.validateCollection(collectionName);
  }

  /**
   * Générer un rapport sur la qualité des données RAG
   */
  async generateQualityReport(): Promise<{
    userPrompts: {
      totalDocuments: number;
      averageRating: number;
      lowQualityDocuments: number;
      highQualityDocuments: number;
    };
    sqlQueries: {
      totalDocuments: number;
      averageRating: number;
      lowQualityDocuments: number;
      highQualityDocuments: number;
    };
  }> {
    const userPromptResults = await this.validateCollection(
      this.promptCollectionName,
    );
    const sqlQueryResults = await this.validateCollection(
      this.sqlQueryCacheName,
    );

    // Analyser les résultats pour les prompts utilisateurs
    const lowQualityUserPrompts = userPromptResults.documentRatings.filter(
      (doc) => doc.rating.overall < 3,
    ).length;

    const highQualityUserPrompts = userPromptResults.documentRatings.filter(
      (doc) => doc.rating.overall >= 4,
    ).length;

    // Analyser les résultats pour les requêtes SQL
    const lowQualitySqlQueries = sqlQueryResults.documentRatings.filter(
      (doc) => doc.rating.overall < 3,
    ).length;

    const highQualitySqlQueries = sqlQueryResults.documentRatings.filter(
      (doc) => doc.rating.overall >= 4,
    ).length;

    return {
      userPrompts: {
        totalDocuments: userPromptResults.totalDocuments,
        averageRating: userPromptResults.averageRating,
        lowQualityDocuments: lowQualityUserPrompts,
        highQualityDocuments: highQualityUserPrompts,
      },
      sqlQueries: {
        totalDocuments: sqlQueryResults.totalDocuments,
        averageRating: sqlQueryResults.averageRating,
        lowQualityDocuments: lowQualitySqlQueries,
        highQualityDocuments: highQualitySqlQueries,
      },
    };
  }

  /**
   * Identifie les documents à améliorer dans une collection
   */
  async identifyDocumentsToImprove(
    collectionName: string,
    threshold: number = 3,
  ): Promise<
    Array<{
      id: string;
      content: string;
      rating: RagRating;
      improvementSuggestions: string;
    }>
  > {
    try {
      // Valider la collection pour obtenir les évaluations
      const validationResults = await this.validateCollection(collectionName);

      // Filtrer les documents avec une note inférieure au seuil
      const lowQualityDocs = validationResults.documentRatings.filter(
        (doc) => doc.rating.overall < threshold,
      );

      const documentsToImprove: Array<{
        id: string;
        content: string;
        rating: RagRating;
        improvementSuggestions: string;
      }> = [];

      // Pour chaque document de faible qualité, générer des suggestions d'amélioration
      for (const doc of lowQualityDocs) {
        try {
          // Récupérer le document complet
          const fullDoc = await this.ragService.getDocument(
            collectionName,
            doc.id,
          );

          if (fullDoc) {
            // Générer des suggestions d'amélioration
            const suggestions = await this.generateImprovementSuggestions(
              fullDoc.content,
              doc.rating,
            );

            documentsToImprove.push({
              id: doc.id,
              content: fullDoc.content,
              rating: doc.rating,
              improvementSuggestions: suggestions,
            });
          }
        } catch (error) {
          this.logger.warn(
            `Erreur lors de l'analyse du document ${doc.id}: ${error.message}`,
          );
        }
      }

      return documentsToImprove;
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'identification des documents à améliorer: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Génère des suggestions d'amélioration pour un document
   */
  private async generateImprovementSuggestions(
    documentContent: string,
    rating: RagRating,
  ): Promise<string> {
    const prompt = `
Tu es un expert en qualité des données pour un système RAG (Retrieval-Augmented Generation).
Voici un document qui a été évalué comme suit:
- Pertinence: ${rating.relevance}/5
- Qualité: ${rating.quality}/5
- Complétude: ${rating.completeness}/5
- Note globale: ${rating.overall}/5
- Commentaire: "${rating.feedback}"

Document à améliorer:
"""
${documentContent}
"""

Analyse les problèmes du document en fonction de son évaluation et propose des améliorations concrètes.
Concentre-toi sur:
1. Comment améliorer la pertinence des informations
2. Comment augmenter la qualité et la précision
3. Comment rendre le document plus complet

Fournit des suggestions détaillées et pratiques.
`;

    try {
      const response = await this.huggingFaceService.generateText(prompt, {
        max_new_tokens: 512,
        temperature: 0.3,
      });

      return response.trim();
    } catch (error) {
      this.logger.error(
        `Erreur lors de la génération de suggestions: ${error.message}`,
      );
      return "Impossible de générer des suggestions d'amélioration.";
    }
  }
}
