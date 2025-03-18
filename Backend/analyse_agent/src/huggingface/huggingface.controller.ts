import { Controller, Post, Body, Logger } from '@nestjs/common';
import { HuggingFaceService, AnalysisResult } from './huggingface.service';
import { RagService } from '../RAG/rag.service';
import { PredefinedQueriesService } from '../sql-queries/predefined-queries.service';
import { QueryBuilderService } from '../querybuilder/querybuilder.service';
import { v4 as uuidv4 } from 'uuid';

@Controller('analyse')
export class HuggingFaceController {
  private readonly logger = new Logger(HuggingFaceController.name);
  private readonly promptCollectionName = 'user_prompts';
  private readonly sqlQueryCacheName = 'sql_queries';

  constructor(
    private readonly huggingFaceService: HuggingFaceService,
    private readonly ragService: RagService,
    private readonly predefinedQueriesService: PredefinedQueriesService,
    private readonly queryBuilderService: QueryBuilderService,
  ) {
    // Créer les collections si elles n'existent pas
    void this.initCollections();
  }

  private async initCollections() {
    try {
      await this.ragService.getOrCreateCollection(this.promptCollectionName);
      await this.ragService.getOrCreateCollection(this.sqlQueryCacheName);
      this.logger.log(`Collections initialisées`);
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'initialisation des collections: ${error.message}`,
      );
    }
  }

  @Post('question')
  async analyseQuestion(@Body() body: { question: string }) {
    const { question } = body;

    // Vérifier d'abord si nous avons une requête prédéfinie correspondante
    this.logger.log(`Recherche de requête prédéfinie pour: "${question}"`);
    const predefinedQuery =
      await this.predefinedQueriesService.findPredefinedQuery(question);

    if (predefinedQuery.found) {
      this.logger.log(`Requête prédéfinie trouvée: ${predefinedQuery.id}`);

      const analysisResult: AnalysisResult = {
        question: question,
        questionReformulated: predefinedQuery.description,
        agent: 'querybuilder',
        finalQuery: predefinedQuery.query,
        tables: [],
        fields: [],
        conditions: '',
      };

      // Exécuter la requête SQL
      try {
        const queryResult = await this.queryBuilderService.executeQuery(
          predefinedQuery.query,
        );
        return {
          source: 'predefined_query',
          result: analysisResult,
          parameters: predefinedQuery.parameters,
          id: predefinedQuery.id,
          data: queryResult.rows,
          rowCount: queryResult.rowCount,
          duration: queryResult.duration,
        };
      } catch (error) {
        this.logger.error(
          `Erreur lors de l'exécution de la requête: ${error.message}`,
        );
        return {
          source: 'predefined_query',
          result: analysisResult,
          error: this.queryBuilderService.parsePostgresError(error),
        };
      }
    }

    // Si pas de requête prédéfinie trouvée avec la question originale, analyser la question avec Hugging Face
    try {
      // Analyser la question avec Hugging Face
      const result = await this.huggingFaceService.analyseQuestion(question);

      // Vérifier si nous avons une requête prédéfinie correspondante avec la question reformulée
      if (
        result.questionReformulated &&
        result.questionReformulated !== question
      ) {
        const reformulatedQuestion = result.questionReformulated;

        this.logger.log(`Question originale: "${question}"`);
        this.logger.log(`Question reformulée: "${reformulatedQuestion}"`);

        // Rechercher avec la question reformulée
        const reformulatedPredefinedQuery =
          await this.predefinedQueriesService.findPredefinedQuery(
            reformulatedQuestion,
          );

        // Créer un log détaillé sur la correspondance trouvée
        if (reformulatedPredefinedQuery.found) {
          const similarity = reformulatedPredefinedQuery.similarity || 0;
          this.logger.log(
            `Requête prédéfinie trouvée avec question reformulée: ${reformulatedPredefinedQuery.id} (similarité: ${similarity})`,
          );

          // Afficher les questions associées à cette requête pour debug
          if (
            reformulatedPredefinedQuery.predefinedParameters &&
            reformulatedPredefinedQuery.predefinedParameters.questions
          ) {
            this.logger.log(
              `Questions associées à cette requête: ${JSON.stringify(reformulatedPredefinedQuery.predefinedParameters.questions)}`,
            );
          }

          // Vérifier si la similarité est suffisante (seuil configurable)
          const SIMILARITY_THRESHOLD = 0.65;
          if (similarity >= SIMILARITY_THRESHOLD) {
            this.logger.log(
              `Similarité suffisante: ${similarity} >= ${SIMILARITY_THRESHOLD}`,
            );

            const analysisResult: AnalysisResult = {
              question: question,
              questionReformulated:
                reformulatedPredefinedQuery.description || reformulatedQuestion,
              agent: 'querybuilder',
              finalQuery: reformulatedPredefinedQuery.query,
              tables: [],
              fields: [],
              conditions: '',
            };

            try {
              const queryResult = await this.queryBuilderService.executeQuery(
                reformulatedPredefinedQuery.query,
              );
              return {
                source: 'predefined_query_reformulated',
                result: analysisResult,
                parameters: reformulatedPredefinedQuery.parameters,
                predefinedParameters:
                  reformulatedPredefinedQuery.predefinedParameters,
                id: reformulatedPredefinedQuery.id,
                data: queryResult.rows,
                rowCount: queryResult.rowCount,
                duration: queryResult.duration,
                similarity: similarity,
              };
            } catch (error) {
              this.logger.error(
                `Erreur lors de l'exécution de la requête (reformulée): ${error.message}`,
              );
              return {
                source: 'predefined_query_reformulated',
                result: analysisResult,
                error: this.queryBuilderService.parsePostgresError(error),
              };
            }
          } else {
            this.logger.log(
              `Similarité insuffisante: ${similarity} < ${SIMILARITY_THRESHOLD}`,
            );
          }
        } else {
          this.logger.log(
            `Aucune requête prédéfinie trouvée pour la question reformulée: "${reformulatedQuestion}"`,
          );
        }
      }

      // Continuer avec le flux normal si aucune requête prédéfinie n'est trouvée
      this.logger.log(
        `Recherche directe dans le cache SQL pour: "${question}"`,
      );
      const cachedSql = await this.findCachedSqlQuery(question);

      if (cachedSql) {
        this.logger.log(
          `Requête SQL pré-construite trouvée directement dans le cache`,
        );

        // Vérifier que finalQuery existe
        if (!cachedSql.result.finalQuery) {
          this.logger.error('Requête SQL finale manquante dans le cache');
          return {
            source: 'cache_sql',
            result: cachedSql.result,
            error: 'Requête SQL finale manquante',
          };
        }

        // Exécuter la requête SQL
        try {
          const queryResult = await this.queryBuilderService.executeQuery(
            cachedSql.result.finalQuery,
          );
          return {
            source: 'cache_sql',
            result: cachedSql.result,
            data: queryResult.rows,
            rowCount: queryResult.rowCount,
            duration: queryResult.duration,
          };
        } catch (error) {
          this.logger.error(
            `Erreur lors de l'exécution de la requête: ${error.message}`,
          );
          return {
            source: 'cache_sql',
            result: cachedSql.result,
            error: this.queryBuilderService.parsePostgresError(error),
          };
        }
      }

      // Si pas de SQL direct, vérifier si une question similaire existe déjà
      const similarResult = await this.ragService.findSimilarPrompt(
        this.promptCollectionName,
        question,
      );

      if (similarResult.found) {
        this.logger.log(
          `Question similaire trouvée avec score: ${similarResult.similarity}`,
        );

        // Vérifier si nous avons une requête SQL pré-construite pour cette question similaire
        const cachedSql = await this.findCachedSqlQuery(similarResult.prompt);

        if (cachedSql) {
          this.logger.log(
            'Requête SQL pré-construite trouvée pour question similaire',
          );

          // Vérifier que finalQuery existe
          if (!cachedSql.result.finalQuery) {
            this.logger.error('Requête SQL finale manquante dans le cache');
            return {
              source: 'cache',
              result: cachedSql.result,
              similarity: similarResult.similarity,
              error: 'Requête SQL finale manquante',
            };
          }

          // Exécuter la requête SQL
          try {
            const queryResult = await this.queryBuilderService.executeQuery(
              cachedSql.result.finalQuery,
            );
            return {
              source: 'cache',
              result: cachedSql.result,
              similarity: similarResult.similarity,
              data: queryResult.rows,
              rowCount: queryResult.rowCount,
              duration: queryResult.duration,
            };
          } catch (error) {
            this.logger.error(
              `Erreur lors de l'exécution de la requête: ${error.message}`,
            );
            return {
              source: 'cache',
              result: cachedSql.result,
              similarity: similarResult.similarity,
              error: this.queryBuilderService.parsePostgresError(error),
            };
          }
        }

        // Sinon, effectuer l'analyse avec la question d'origine
        const result = await this.huggingFaceService.analyseQuestion(question);

        // Si c'est une requête SQL, l'exécuter
        if (result.agent === 'querybuilder' && result.finalQuery) {
          try {
            const queryResult = await this.queryBuilderService.executeQuery(
              result.finalQuery,
            );
            return {
              source: 'model',
              result,
              similarity: similarResult.similarity,
              data: queryResult.rows,
              rowCount: queryResult.rowCount,
              duration: queryResult.duration,
            };
          } catch (error) {
            this.logger.error(
              `Erreur lors de l'exécution de la requête: ${error.message}`,
            );
            return {
              source: 'model',
              result,
              similarity: similarResult.similarity,
              error: this.queryBuilderService.parsePostgresError(error),
            };
          }
        }

        return {
          source: 'model',
          result,
          similarity: similarResult.similarity,
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

          // Si c'est une requête querybuilder valide avec une requête SQL,
          // la sauvegarder dans le cache de requêtes SQL et l'exécuter
          if (result.agent === 'querybuilder' && result.finalQuery) {
            await this.cacheSqlQuery(question, result);

            try {
              const queryResult = await this.queryBuilderService.executeQuery(
                result.finalQuery,
              );
              return {
                source: 'model',
                result,
                confidence: validation.confidenceScore,
                data: queryResult.rows,
                rowCount: queryResult.rowCount,
                duration: queryResult.duration,
              };
            } catch (error) {
              this.logger.error(
                `Erreur lors de l'exécution de la requête: ${error.message}`,
              );
              return {
                source: 'model',
                result,
                confidence: validation.confidenceScore,
                error: this.queryBuilderService.parsePostgresError(error),
              };
            }
          }

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
    } catch (error) {
      this.logger.error(`Erreur lors de l'analyse: ${error.message}`);
      throw error;
    }
  }

  /**
   * Recherche une requête SQL pré-construite dans le cache
   * @param question La question à rechercher
   * @returns La requête SQL ou null si non trouvée
   */
  private async findCachedSqlQuery(
    question: string,
  ): Promise<{ result: AnalysisResult } | null> {
    try {
      this.logger.log(
        `Recherche dans le cache SQL pour la question: "${question}"`,
      );

      // Utiliser le service PredefinedQueriesService pour rechercher une requête prédéfinie
      const predefinedQuery =
        await this.predefinedQueriesService.findPredefinedQuery(question);

      this.logger.log(
        `Résultat de la recherche dans le cache SQL - Trouvé: ${predefinedQuery.found}, Similarité: ${predefinedQuery.found ? predefinedQuery.similarity || 'N/A' : 'N/A'}`,
      );

      if (predefinedQuery.found) {
        this.logger.log(
          `Requête SQL trouvée en cache avec score de similarité: ${predefinedQuery.similarity || 'N/A'}`,
        );

        // Transformer les données du cache en AnalysisResult
        const analysisResult: AnalysisResult = {
          question: question,
          questionReformulated: predefinedQuery.description,
          agent: 'querybuilder',
          finalQuery: predefinedQuery.query,
          // Ajouter des valeurs par défaut pour les autres champs requis par AnalysisResult
          tables: [],
          fields: [],
          conditions: '',
        };

        return { result: analysisResult };
      }

      if (predefinedQuery.error) {
        this.logger.log(
          `Erreur lors de la recherche en cache pour: "${question}" (Erreur: ${predefinedQuery.error})`,
        );
      } else {
        this.logger.log(
          `Aucune requête SQL trouvée en cache pour: "${question}"`,
        );
      }
      return null;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la recherche en cache: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Cache la requête SQL pour la question donnée
   */
  private async cacheSqlQuery(
    question: string,
    sqlResult: any,
  ): Promise<boolean> {
    try {
      if (!sqlResult || !sqlResult.finalQuery) {
        this.logger.warn(
          `Impossible de mettre en cache une requête SQL invalide pour: "${question}"`,
        );
        return false;
      }

      // Ne sauvegarder que les informations essentielles pour le cache
      const cacheData = {
        question: question,
        questionReformulated: sqlResult.questionReformulated || '',
        finalQuery: sqlResult.finalQuery,
        agent: sqlResult.agent || 'querybuilder',
      };

      // Générer un ID déterministe basé sur la question
      const documentId = this.generateDeterministicId(question);

      await this.ragService.upsertDocuments(
        'sql_queries',
        [question],
        [documentId],
        [cacheData],
      );

      this.logger.log(
        `Requête SQL mise en cache avec succès pour: "${question}"`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la mise en cache de la requête SQL: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Génère un ID déterministe à partir d'une chaîne de caractères
   */
  private generateDeterministicId(text: string): string {
    // Préfixe pour identifier la source (le modèle dans ce cas)
    const prefix = 'model';

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return `${prefix}_${Math.abs(hash).toString(16)}`;
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
