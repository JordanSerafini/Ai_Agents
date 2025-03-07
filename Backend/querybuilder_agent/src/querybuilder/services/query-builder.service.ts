import { Injectable, Logger } from '@nestjs/common';
import { QueryValidatorService } from './query-validator.service';
import { QueryConfigService } from './query-config.service';
import { DatabaseService } from './database.service';
import {
  AnalyseQueryData,
  QueryBuilderResult,
} from '../interfaces/query-builder.types';
import { RagClientService } from '../../services/rag.service';

@Injectable()
export class QueryBuilderService {
  private readonly logger = new Logger(QueryBuilderService.name);

  constructor(
    private readonly validatorService: QueryValidatorService,
    private readonly configService: QueryConfigService,
    private readonly databaseService: DatabaseService,
    private readonly ragClientService: RagClientService,
  ) {}

  async buildQuery(
    data: AnalyseQueryData,
    options?: { timeout?: number },
  ): Promise<QueryBuilderResult> {
    try {
      this.logger.debug('Début de la construction de la requête');
      this.logger.debug(`Données reçues: ${JSON.stringify(data, null, 2)}`);

      // Valider les données d'entrée
      this.logger.debug('Validation des données...');
      this.validatorService.validateQueryData(data);
      this.logger.debug('Validation réussie');

      // Générer la requête SQL brute
      this.logger.debug('Génération de la requête SQL...');
      const { sql, params } = this.configService.generateRawSql(data);
      this.logger.debug(`Requête SQL générée: ${sql}`);
      this.logger.debug(`Paramètres: ${JSON.stringify(params)}`);

      // Exécuter la requête
      this.logger.debug('Exécution de la requête...');
      const result = await this.databaseService.executeQuery(sql, params);
      this.logger.debug(`Nombre de résultats: ${result.length}`);

      const response = {
        success: true,
        sql: sql,
        data: result,
        explanation: this.configService.generateExplanation(data),
        metadata: {
          executionTime: Date.now(),
          baseQueryQuestion: data.metadata?.description,
        },
      };

      this.logger.debug('Construction de la requête terminée avec succès');
      return response;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(
        `Erreur lors de la génération de la requête SQL: ${message}`,
      );
      return {
        success: false,
        error: `Erreur lors de la génération de la requête SQL: ${message}`,
      };
    }
  }

  async enhanceQueryWithRag(query: string): Promise<string> {
    try {
      this.logger.log(`Enhancing query with RAG: ${query}`);
      const enhancedQuery = await this.ragClientService.query(query);
      return enhancedQuery;
    } catch (error) {
      this.logger.error(`Error enhancing query with RAG: ${error.message}`);
      return query;
    }
  }
}
