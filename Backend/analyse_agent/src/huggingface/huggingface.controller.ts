import {
  Controller,
  Post,
  Body,
  Logger,
  OnModuleInit,
  UsePipes,
  ValidationPipe,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HuggingFaceService, AnalysisResult } from './huggingface.service';
import { RagService } from '../RAG/rag.service';
import { PredefinedQueriesService } from '../sql-queries/predefined-queries.service';
import { QueryBuilderService } from '../querybuilder/querybuilder.service';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { IsNotEmpty, IsString } from 'class-validator';
import * as crypto from 'crypto';

export class AnalyseQuestionDto {
  @IsNotEmpty()
  @IsString()
  question: string;
}

interface FormattedResponse {
  data: any;
  type: 'list' | 'detail';
  humanResponse: string;
}

interface AnalyseQuestionResponse {
  source: string;
  result: AnalysisResult;
  data?: any[];
  rowCount?: number;
  duration?: number;
  error?: any;
  similarity?: number;
  confidence?: number;
  warning?: string;
  parameters?: any;
  predefinedParameters?: any;
  id?: string;
}

interface SqlExecutionResult {
  rows: any[];
  rowCount: number;
  duration: number;
}

class QueryExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueryExecutionError';
  }
}

@Controller('analyse')
export class HuggingFaceController implements OnModuleInit {
  private readonly logger = new Logger(HuggingFaceController.name);
  private readonly promptCollectionName = 'user_prompts';
  private readonly sqlQueryCacheName = 'sql_queries';
  private readonly SIMILARITY_THRESHOLD: number;

  constructor(
    private readonly huggingFaceService: HuggingFaceService,
    private readonly ragService: RagService,
    private readonly predefinedQueriesService: PredefinedQueriesService,
    private readonly queryBuilderService: QueryBuilderService,
    private readonly configService: ConfigService,
  ) {
    this.SIMILARITY_THRESHOLD = Number(
      this.configService.get('SIMILARITY_THRESHOLD', '0.65'),
    );
  }

  async onModuleInit() {
    await this.initCollections();
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
  @UsePipes(new ValidationPipe())
  async analyseQuestion(
    @Body() body: AnalyseQuestionDto,
  ): Promise<FormattedResponse> {
    try {
      // Vérifier d'abord les requêtes prédéfinies
      const predefinedResult = await this.checkPredefinedQueries(body.question);
      if (predefinedResult) {
        return this.formatResponse(predefinedResult);
      }

      // Vérifier les questions similaires
      const similarResult = await this.checkSimilarQuestions(body.question);
      if (similarResult) {
        return this.formatResponse(similarResult);
      }

      // Si aucune correspondance n'est trouvée, traiter avec le modèle
      const result = await this.processAndValidateAnalysis(body.question);
      return this.formatResponse(result);
    } catch (error) {
      this.logger.error("Erreur lors de l'analyse de la question:", error);
      throw new HttpException(
        "Erreur lors de l'analyse de la question",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private formatResponse(result: any): FormattedResponse {
    const responseType = this.determineResponseType(result.data);
    let humanResponse = '';

    if (result.source === 'predefined_query' || result.source === 'model') {
      if (result.result.agent === 'querybuilder') {
        humanResponse = this.formatStaffScheduleResponse(result.data);
      } else {
        humanResponse = this.formatGeneralResponse(result);
      }
    }

    return {
      data: result,
      type: responseType,
      humanResponse: humanResponse,
    };
  }

  private determineResponseType(data: any): 'list' | 'detail' {
    if (Array.isArray(data)) {
      if (data.length === 1) return 'detail';
      return 'list';
    }
    return 'detail';
  }

  private formatStaffScheduleResponse(data: any): string {
    if (!data || !Array.isArray(data)) return 'Aucune donnée disponible';

    const groupedPeople = data.reduce((acc: any, person: any) => {
      const key = `${person.firstname}-${person.lastname}`;
      if (!acc[key]) {
        acc[key] = {
          ...person,
          schedules: [],
        };
      }
      acc[key].schedules.push(person.schedule);
      return acc;
    }, {});

    let response = 'Voici le planning du personnel pour le mois en cours :\n\n';

    Object.values(groupedPeople).forEach((person: any) => {
      response += `${person.firstname} ${person.lastname} (${person.role}) :\n`;
      response += `- Heures programmées : ${person.hours_scheduled}h\n`;

      person.schedules.forEach((schedule: any) => {
        if (schedule.special_instructions) {
          response += `- Note : ${schedule.special_instructions}\n`;
        }
      });
      response += '\n';
    });

    return response;
  }

  private formatGeneralResponse(result: any): string {
    if (!result.data) return 'Aucune donnée disponible';

    let response = '';
    if (result.result.questionReformulated) {
      response += `Question : ${result.result.questionReformulated}\n\n`;
    }

    if (Array.isArray(result.data)) {
      response += `Nombre de résultats : ${result.data.length}\n\n`;
      result.data.forEach((item: any, index: number) => {
        response += `${index + 1}. ${JSON.stringify(item)}\n`;
      });
    } else {
      response += JSON.stringify(result.data);
    }

    return response;
  }

  private async checkPredefinedQueries(
    question: string,
  ): Promise<AnalyseQuestionResponse | null> {
    this.logger.log(`Recherche de requête prédéfinie pour: "${question}"`);

    try {
      const predefinedQuery =
        await this.predefinedQueriesService.findPredefinedQuery(question);

      if (!predefinedQuery.found) {
        return null;
      }

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

      try {
        const queryResult = await this.executeSqlQuery(predefinedQuery.query);
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
        return this.handleError(error, 'predefined_query', {
          result: analysisResult,
        });
      }
    } catch (error) {
      return this.handleError(error, 'check_predefined_queries');
    }
  }

  private async checkReformulatedQuestion(
    originalQuestion: string,
    reformulatedQuestion: string,
  ): Promise<AnalyseQuestionResponse | null> {
    // Éviter de rechercher si la question reformulée est identique à l'originale
    if (originalQuestion === reformulatedQuestion) {
      return null;
    }

    this.logger.log(`Question originale: "${originalQuestion}"`);
    this.logger.log(`Question reformulée: "${reformulatedQuestion}"`);

    try {
      const reformulatedPredefinedQuery =
        await this.predefinedQueriesService.findPredefinedQuery(
          reformulatedQuestion,
        );

      if (!reformulatedPredefinedQuery.found) {
        this.logger.log(
          `Aucune requête prédéfinie trouvée pour la question reformulée: "${reformulatedQuestion}"`,
        );
        return null;
      }

      const similarity = reformulatedPredefinedQuery.similarity || 0;
      this.logger.log(
        `Requête prédéfinie trouvée avec question reformulée: ${reformulatedPredefinedQuery.id} (similarité: ${similarity})`,
      );

      if (reformulatedPredefinedQuery.predefinedParameters?.questions) {
        this.logger.log(
          `Questions associées à cette requête: ${JSON.stringify(
            reformulatedPredefinedQuery.predefinedParameters.questions,
          )}`,
        );
      }

      if (similarity < this.SIMILARITY_THRESHOLD) {
        this.logger.log(
          `Similarité insuffisante: ${similarity} < ${this.SIMILARITY_THRESHOLD}`,
        );
        return null;
      }

      this.logger.log(
        `Similarité suffisante: ${similarity} >= ${this.SIMILARITY_THRESHOLD}`,
      );

      return this.executePredefinedQuery(
        originalQuestion,
        reformulatedPredefinedQuery,
        similarity,
      );
    } catch (error) {
      return this.handleError(error, 'check_reformulated_question');
    }
  }

  private async executePredefinedQuery(
    originalQuestion: string,
    predefinedQuery: any,
    similarity?: number,
  ): Promise<AnalyseQuestionResponse> {
    const analysisResult: AnalysisResult = {
      question: originalQuestion,
      questionReformulated:
        predefinedQuery.description || predefinedQuery.query,
      agent: 'querybuilder',
      finalQuery: predefinedQuery.query,
      tables: [],
      fields: [],
      conditions: '',
    };

    try {
      const queryResult = await this.executeSqlQuery(predefinedQuery.query);
      return {
        source: similarity
          ? 'predefined_query_reformulated'
          : 'predefined_query',
        result: analysisResult,
        parameters: predefinedQuery.parameters,
        predefinedParameters: predefinedQuery.predefinedParameters,
        id: predefinedQuery.id,
        data: queryResult.rows,
        rowCount: queryResult.rowCount,
        duration: queryResult.duration,
        ...(similarity && { similarity }),
      };
    } catch (error) {
      return this.handleError(error, 'execute_predefined_query', {
        result: analysisResult,
        ...(similarity && { similarity }),
      });
    }
  }

  private async checkSqlCache(
    question: string,
  ): Promise<AnalyseQuestionResponse | null> {
    this.logger.log(`Recherche directe dans le cache SQL pour: "${question}"`);

    try {
      const cachedSql = await this.findCachedSqlQuery(question);

      if (!cachedSql || !cachedSql.result.finalQuery) {
        this.logger.warn(
          `Aucune requête SQL trouvée dans le cache pour: "${question}"`,
        );
        return null;
      }

      this.logger.log(
        `Requête SQL trouvée dans le cache. Exécution en cours...`,
      );

      try {
        const queryResult = await this.executeSqlQuery(
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
        return this.handleError(error, 'cache_sql', {
          result: cachedSql.result,
        });
      }
    } catch (error) {
      return this.handleError(error, 'check_sql_cache');
    }
  }

  private async checkSimilarQuestions(
    question: string,
  ): Promise<AnalyseQuestionResponse | null> {
    try {
      const similarResult = await this.ragService.findSimilarPrompt(
        this.promptCollectionName,
        question,
      );

      if (!similarResult.found) {
        return null;
      }

      this.logger.log(
        `Question similaire trouvée avec score: ${similarResult.similarity}`,
      );

      // Rechercher dans le cache SQL avec la question similaire trouvée
      const cachedSql = await this.findCachedSqlQuery(similarResult.prompt);

      if (cachedSql) {
        this.logger.log(
          'Requête SQL pré-construite trouvée pour question similaire',
        );

        if (!cachedSql.result.finalQuery) {
          this.logger.error('Requête SQL finale manquante dans le cache');
          return {
            source: 'cache',
            result: cachedSql.result,
            similarity: similarResult.similarity,
            error: 'Requête SQL finale manquante',
          };
        }

        try {
          const queryResult = await this.executeSqlQuery(
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
          return this.handleError(error, 'cache_sql_similar', {
            result: cachedSql.result,
            similarity: similarResult.similarity,
          });
        }
      }

      // Si on n'a pas trouvé de requête mise en cache pour la question similaire,
      // on réanalyse la question originale
      const result = await this.huggingFaceService.analyseQuestion(question);

      if (result.agent === 'querybuilder' && result.finalQuery) {
        try {
          const queryResult = await this.executeSqlQuery(
            result.finalQuery ?? '',
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
          return this.handleError(error, 'model_similar_query', {
            result,
            similarity: similarResult.similarity,
          });
        }
      }

      return {
        source: 'model',
        result,
        similarity: similarResult.similarity,
      };
    } catch (error) {
      return this.handleError(error, 'check_similar_questions');
    }
  }

  private async processAndValidateAnalysis(
    question: string,
  ): Promise<AnalyseQuestionResponse> {
    try {
      const result = await this.huggingFaceService.analyseQuestion(question);
      const validation = this.validateAndAnalyzeResponse(result);

      if (!validation.isValid) {
        this.logger.warn(
          `❌ Réponse invalide pour "${question}" (Confiance: ${validation.confidenceScore})`,
        );
        return {
          source: 'model',
          result,
          confidence: validation.confidenceScore,
          warning:
            'Réponse potentiellement incorrecte, non enregistrée en cache',
        };
      }

      // Stocker en base uniquement si c'est une requête SQL valide
      const shouldCache = result.agent === 'querybuilder' && result.finalQuery;

      if (shouldCache) {
        // Exécuter les opérations de cache en parallèle pour optimiser le temps
        await Promise.all([
          this.cacheSqlQuery(question, result),
          this.ragService.upsertDocuments(
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
          ),
        ]);

        try {
          const queryResult = await this.executeSqlQuery(
            result.finalQuery ?? '',
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
          return this.handleError(error, 'model_query', {
            result,
            confidence: validation.confidenceScore,
          });
        }
      }

      // Pour les autres types d'agents ou requêtes sans SQL
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
    } catch (error) {
      return this.handleError(error, 'process_validate_analysis');
    }
  }

  /**
   * Gère de manière centralisée les erreurs et uniformise les réponses
   */
  private handleError(
    error: any,
    source: string,
    additionalData: Partial<AnalyseQuestionResponse> = {},
  ): AnalyseQuestionResponse {
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorMessage = `Erreur interne: ${error.message || 'Erreur inconnue'}`;

    if (error instanceof HttpException) {
      status = error.getStatus();
      errorMessage = error.message;
    } else if (error instanceof QueryExecutionError) {
      status = HttpStatus.BAD_REQUEST;
      errorMessage = error.message;
    }

    this.logger.error(`⛔ [${source}] ${errorMessage}`);

    // Évite de logger plusieurs fois la même erreur
    if (!(error instanceof HttpException)) {
      this.logger.error(error.stack);
    }

    throw new HttpException(
      {
        source,
        error: errorMessage,
        ...additionalData,
      },
      status,
    );
  }

  /**
   * Exécute une requête SQL en utilisant des paramètres préparés pour éviter les injections
   */
  private async executeSqlQuery(
    query: string,
    params: any[] = [],
  ): Promise<SqlExecutionResult> {
    try {
      const sanitizedParams = params.map((param) => {
        if (typeof param === 'string') {
          return param.replace(/[;'"\\]/g, '').trim(); // Nettoyage avancé
        }
        return param;
      });

      return await this.queryBuilderService.executeQuery(
        query,
        sanitizedParams,
      );
    } catch (error) {
      this.logger.error(`❌ Erreur SQL: ${error.message}`);
      throw new QueryExecutionError(
        `Erreur SQL: ${this.queryBuilderService.parsePostgresError(error)}`,
      );
    }
  }

  /**
   * Recherche une requête SQL pré-construite dans le cache
   */
  private async findCachedSqlQuery(
    question: string,
  ): Promise<{ result: AnalysisResult } | null> {
    try {
      this.logger.log(
        `🔍 Recherche dans le cache SQL pour la question: "${question}"`,
      );

      // Utiliser le service PredefinedQueriesService pour rechercher une requête prédéfinie
      const predefinedQuery =
        await this.predefinedQueriesService.findPredefinedQuery(question);

      if (!predefinedQuery.found) {
        this.logger.log(
          `⚠️ Aucune requête SQL trouvée en cache pour: "${question}"`,
        );
        return null;
      }

      // Vérification de la validité du cache (ex: vérifier si la table existe toujours)
      const isValidQuery = await this.validateSqlQuery(predefinedQuery.query);
      if (!isValidQuery) {
        this.logger.warn(`⚠️ Requête en cache invalide, suppression du cache.`);
        return null;
      }

      this.logger.log(
        `✅ Requête SQL trouvée et validée dans le cache avec score de similarité: ${predefinedQuery.similarity || 'N/A'}`,
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
          `⚠️ Impossible de mettre en cache une requête SQL invalide pour: "${question}"`,
        );
        return false;
      }

      // Vérifier si la requête est déjà en cache
      const existingCache = await this.findCachedSqlQuery(question);
      if (existingCache) {
        this.logger.log(
          `🔄 La requête SQL est déjà en cache pour: "${question}"`,
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
        `✅ Requête SQL mise en cache avec succès pour: "${question}"`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `❌ Erreur lors de la mise en cache de la requête SQL: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Génère un ID déterministe à partir d'une chaîne de caractères
   */
  private generateDeterministicId(text: string): string {
    return (
      'model_' +
      crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)
    );
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
      confidenceScore = this.applyConfidencePenalty(
        confidenceScore,
        0.6,
        'Aucune reformulation effectuée, forte pénalité appliquée',
      );
    }

    // Vérifier que la reformulation est plus longue pour les questions courtes
    if (
      result.question.length < 15 &&
      result.questionReformulated.length < result.question.length * 2
    ) {
      confidenceScore = this.applyConfidencePenalty(
        confidenceScore,
        0.4,
        'Reformulation insuffisante pour une question courte',
      );
    }

    // Analyser la pertinence des champs spécifiques à l'agent
    if (result.agent === 'querybuilder') {
      confidenceScore = this.evaluateQueryBuilderConfidence(
        result,
        confidenceScore,
      );
    } else if (result.agent === 'workflow') {
      confidenceScore = this.evaluateWorkflowConfidence(
        result,
        confidenceScore,
      );
    }

    // Analyser la longueur de la reformulation
    confidenceScore = this.evaluateReformulationLength(result, confidenceScore);

    // Limiter le score entre 0 et 1
    confidenceScore = Math.max(0, Math.min(1, confidenceScore));

    // Considérer comme valide uniquement si le score est supérieur à un seuil plus élevé
    const isValid = confidenceScore >= 0.7; // Seuil plus strict

    return { isValid, confidenceScore };
  }

  /**
   * Applique une pénalité à un score de confiance avec journalisation
   */
  private applyConfidencePenalty(
    score: number,
    penalty: number,
    reason: string,
  ): number {
    this.logger.warn(reason);
    return Math.max(0, score - penalty);
  }

  private evaluateQueryBuilderConfidence(
    result: AnalysisResult,
    confidenceScore: number,
  ): number {
    // Vérifier les champs spécifiques au querybuilder
    if (!result.tables || result.tables.length === 0) {
      confidenceScore = this.applyConfidencePenalty(
        confidenceScore,
        0.4,
        'Aucune table spécifiée pour une requête querybuilder',
      );
    }

    if (!result.fields || result.fields.length === 0) {
      confidenceScore = this.applyConfidencePenalty(
        confidenceScore,
        0.3,
        'Aucun champ à afficher spécifié',
      );
    }

    if (!result.conditions || result.conditions.trim() === '') {
      confidenceScore = this.applyConfidencePenalty(
        confidenceScore,
        0.3,
        'Aucune condition spécifiée',
      );
    }

    // Vérifier si la requête finale a été générée
    if (!result.finalQuery || result.finalQuery.trim() === '') {
      confidenceScore = this.applyConfidencePenalty(
        confidenceScore,
        0.1,
        'Requête SQL finale non générée',
      );
    }

    return confidenceScore;
  }

  private evaluateWorkflowConfidence(
    result: AnalysisResult,
    confidenceScore: number,
  ): number {
    // Vérifier les champs spécifiques au workflow
    if (!result.action) {
      confidenceScore = this.applyConfidencePenalty(
        confidenceScore,
        0.2,
        'Aucune action spécifiée pour une tâche workflow',
      );
    }

    if (!result.entities || result.entities.length === 0) {
      confidenceScore = this.applyConfidencePenalty(
        confidenceScore,
        0.15,
        'Aucune entité spécifiée pour une tâche workflow',
      );
    }

    if (!result.parameters || result.parameters.length === 0) {
      confidenceScore = this.applyConfidencePenalty(
        confidenceScore,
        0.1,
        'Aucun paramètre spécifié pour une tâche workflow',
      );
    }

    return confidenceScore;
  }

  private evaluateReformulationLength(
    result: AnalysisResult,
    confidenceScore: number,
  ): number {
    const originalLength = result.question.length;
    const reformulatedLength = result.questionReformulated.length;

    // Si la reformulation est beaucoup plus courte, réduire la confiance
    if (reformulatedLength < originalLength * 0.5) {
      confidenceScore = this.applyConfidencePenalty(
        confidenceScore,
        0.2,
        'Reformulation trop courte par rapport à la question originale',
      );
    }

    // Si la reformulation est beaucoup plus longue, augmenter légèrement la confiance
    if (reformulatedLength > originalLength * 1.5) {
      confidenceScore += 0.1;
      this.logger.log('Reformulation détaillée, bonus de confiance appliqué');
    }

    return confidenceScore;
  }

  /**
   * Vérifie si une requête SQL est toujours valide
   */
  private async validateSqlQuery(query: string): Promise<boolean> {
    if (!query) return false;

    try {
      const testQuery = `EXPLAIN ${query}`;
      await this.queryBuilderService.executeQuery(testQuery, []);
      return true;
    } catch (error) {
      this.logger.warn(`⚠️ Requête SQL invalide détectée: ${error.message}`);
      return false;
    }
  }
}
