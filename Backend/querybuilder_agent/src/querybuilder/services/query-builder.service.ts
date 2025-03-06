import { Injectable, Logger } from '@nestjs/common';
import { QueryValidatorService } from './query-validator.service';
import { QueryConfigService } from './query-config.service';
import { QueryExecutorService } from './query-executor.service';
import {
  AnalyseQueryData,
  QueryBuilderResult,
} from '../interfaces/query-builder.types';

@Injectable()
export class QueryBuilderService {
  private readonly logger = new Logger(QueryBuilderService.name);

  constructor(
    private readonly validatorService: QueryValidatorService,
    private readonly configService: QueryConfigService,
    private readonly executorService: QueryExecutorService,
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

      // Configurer la requête
      this.logger.debug('Configuration de la requête...');
      const queryBuilder = await this.configService.configureQuery(data);
      this.logger.debug(`Requête SQL générée: ${queryBuilder.getSql()}`);

      // Exécuter la requête
      this.logger.debug('Exécution de la requête...');
      const result = await this.executorService.executeQuery(queryBuilder, options);
      this.logger.debug(`Nombre de résultats: ${result.length}`);

      const response = {
        success: true,
        sql: queryBuilder.getSql(),
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
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(`Erreur lors de la génération de la requête SQL: ${message}`);
      return {
        success: false,
        error: `Erreur lors de la génération de la requête SQL: ${message}`,
      };
    }
  }
}
