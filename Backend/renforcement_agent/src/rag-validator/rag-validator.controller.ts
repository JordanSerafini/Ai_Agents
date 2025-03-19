import { Controller, Get, Post, Param, Logger } from '@nestjs/common';
import { RagValidatorService } from './rag-validator.service';
import { RagService } from '../RAG/rag.service';
import { HuggingFaceService } from '../huggingface/huggingface.service';

@Controller('rag')
export class RagValidatorController {
  private readonly logger = new Logger(RagValidatorController.name);
  private readonly promptCollectionName = 'user_prompts';
  private readonly sqlQueryCacheName = 'sql_queries';

  constructor(
    private readonly ragValidatorService: RagValidatorService,
    private readonly ragService: RagService,
    private readonly huggingFaceService: HuggingFaceService,
  ) {}

  @Get('prompt/eval')
  async evaluateAllPrompts() {
    this.logger.log(`Évaluation de tous les prompts utilisateurs`);
    try {
      const result = await this.ragValidatorService.validateCollection(
        this.promptCollectionName,
      );
      return {
        success: true,
        message: `${result.evaluatedDocuments} prompts évalués sur ${result.totalDocuments}`,
        ...result,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'évaluation des prompts: ${error.message}`,
      );
      return {
        success: false,
        message: `Erreur: ${error.message}`,
      };
    }
  }

  @Get('sql/eval')
  async evaluateAllSqlQueries() {
    this.logger.log(`Évaluation de toutes les requêtes SQL`);
    try {
      // Compteur pour suivre l'avancement
      let processedCount = 0;
      let totalCount = 0;

      // Suivi du temps
      const startTime = Date.now();
      const getElapsedTime = () => {
        const elapsedMs = Date.now() - startTime;
        const seconds = Math.floor((elapsedMs / 1000) % 60);
        const minutes = Math.floor((elapsedMs / (1000 * 60)) % 60);
        const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      };

      // Récupérer le nombre total de documents pour le suivi
      const documents = await this.ragService.getAllDocuments(
        this.sqlQueryCacheName,
      );
      totalCount = documents.length;
      this.logger.log(`Nombre total de requêtes SQL à évaluer: ${totalCount}`);

      // Fonction de callback pour suivre l'avancement
      const progressCallback = () => {
        processedCount++;
        const percentage = Math.round((processedCount / totalCount) * 100);
        const elapsed = getElapsedTime();
        this.logger.log(
          `Progression: ${processedCount}/${totalCount} (${percentage}%) - Temps écoulé: ${elapsed}`,
        );
      };

      const result = await this.ragValidatorService.validateCollection(
        this.sqlQueryCacheName,
        progressCallback,
      );

      const totalTime = getElapsedTime();
      this.logger.log(`Évaluation terminée en ${totalTime}`);

      return {
        success: true,
        message: `${result.evaluatedDocuments} requêtes SQL évaluées sur ${result.totalDocuments}`,
        processedCount,
        totalCount,
        elapsedTime: totalTime,
        ...result,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'évaluation des requêtes SQL: ${error.message}`,
      );
      return {
        success: false,
        message: `Erreur: ${error.message}`,
      };
    }
  }

  @Get('prompt/eval/:id')
  async evaluatePromptById(@Param('id') id: string) {
    this.logger.log(`Évaluation du prompt avec l'ID: ${id}`);
    try {
      // 1. Récupérer le document depuis Chroma
      const document = await this.ragService.getDocument(
        this.promptCollectionName,
        id,
      );

      if (!document) {
        return {
          success: false,
          message: `Prompt avec l'ID ${id} non trouvé`,
        };
      }

      // 2. Évaluer le prompt avec le service HuggingFace
      const evaluation = await this.huggingFaceService.evaluatePrompt(
        document.content,
      );

      // 3. Mettre à jour le document avec l'évaluation
      const updatedDoc =
        await this.ragValidatorService.evaluateAndUpdateDocument(
          this.promptCollectionName,
          id,
          'Comment évaluer la qualité de ce prompt?',
        );

      return {
        success: true,
        message: `Prompt évalué avec succès`,
        evaluation,
        document: updatedDoc,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'évaluation du prompt ${id}: ${error.message}`,
      );
      return {
        success: false,
        message: `Erreur: ${error.message}`,
      };
    }
  }

  @Get('sql/eval/:id')
  async evaluateSqlById(@Param('id') id: string) {
    this.logger.log(`Évaluation de la requête SQL avec l'ID: ${id}`);
    try {
      // 1. Récupérer le document depuis Chroma
      const document = await this.ragService.getDocument(
        this.sqlQueryCacheName,
        id,
      );

      if (!document) {
        return {
          success: false,
          message: `Requête SQL avec l'ID ${id} non trouvée`,
        };
      }

      // Pour une évaluation plus précise, nous aurions besoin du prompt original
      // Ici, nous utilisons une requête générique
      const originalPrompt =
        document.metadata?.originalPrompt || 'Requête utilisateur inconnue';

      // 2. Évaluer la requête SQL avec le service HuggingFace
      const evaluation = await this.huggingFaceService.evaluateSqlQuery(
        document.content,
        originalPrompt,
      );

      // 3. Mettre à jour le document avec l'évaluation
      const updatedDoc =
        await this.ragValidatorService.evaluateAndUpdateDocument(
          this.sqlQueryCacheName,
          id,
          originalPrompt,
        );

      return {
        success: true,
        message: `Requête SQL évaluée avec succès`,
        evaluation,
        document: updatedDoc,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'évaluation de la requête SQL ${id}: ${error.message}`,
      );
      return {
        success: false,
        message: `Erreur: ${error.message}`,
      };
    }
  }

  @Post('validate/all')
  async validateAllCollections() {
    this.logger.log(`Validation de toutes les collections RAG`);
    try {
      // Valider les deux collections
      const promptsResult = await this.ragValidatorService.validateCollection(
        this.promptCollectionName,
      );
      const sqlResult = await this.ragValidatorService.validateCollection(
        this.sqlQueryCacheName,
      );

      // Générer un rapport d'analyse
      const stats = {
        user_prompts: {
          totalDocuments: promptsResult.totalDocuments,
          averageRating: promptsResult.averageRating,
          lowQualityDocuments: promptsResult.documentRatings.filter(
            (doc) => doc.rating.overall < 3,
          ).length,
          highQualityDocuments: promptsResult.documentRatings.filter(
            (doc) => doc.rating.overall >= 4,
          ).length,
        },
        sql_queries: {
          totalDocuments: sqlResult.totalDocuments,
          averageRating: sqlResult.averageRating,
          lowQualityDocuments: sqlResult.documentRatings.filter(
            (doc) => doc.rating.overall < 3,
          ).length,
          highQualityDocuments: sqlResult.documentRatings.filter(
            (doc) => doc.rating.overall >= 4,
          ).length,
        },
      };

      const analysisReport =
        await this.huggingFaceService.generateRagAnalysisReport(stats);

      return {
        success: true,
        message: `Toutes les collections validées avec succès`,
        prompt_collection: promptsResult,
        sql_collection: sqlResult,
        analysis: analysisReport,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la validation des collections: ${error.message}`,
      );
      return {
        success: false,
        message: `Erreur: ${error.message}`,
      };
    }
  }

  @Get('report')
  async generateReport() {
    this.logger.log(`Génération du rapport de qualité des données RAG`);
    try {
      const report = await this.ragValidatorService.generateQualityReport();

      return {
        success: true,
        message: `Rapport généré avec succès`,
        report,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la génération du rapport: ${error.message}`,
      );
      return {
        success: false,
        message: `Erreur: ${error.message}`,
      };
    }
  }

  @Get('low-quality/:collection')
  async getLowQualityDocuments(@Param('collection') collectionName: string) {
    this.logger.log(
      `Récupération des documents de faible qualité dans la collection ${collectionName}`,
    );
    try {
      const documents =
        await this.ragValidatorService.identifyDocumentsToImprove(
          collectionName,
          3,
        );

      return {
        success: true,
        message: `${documents.length} documents identifiés comme nécessitant des améliorations`,
        documents,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des documents: ${error.message}`,
      );
      return {
        success: false,
        message: `Erreur: ${error.message}`,
      };
    }
  }
}
