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
      // Valider les données d'entrée
      this.validatorService.validateQueryData(data);

      // Configurer la requête
      const queryBuilder = await this.configService.configureQuery(data);

      // Exécuter la requête
      const result = await this.executorService.executeQuery(
        queryBuilder,
        options,
      );

      return {
        success: true,
        sql: queryBuilder.getSql(),
        data: result,
        metadata: {
          executionTime: Date.now(),
          baseQueryQuestion: data.metadata?.description,
        },
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la génération de la requête SQL: ${error.message}`,
      );
      return {
        success: false,
        error: `Erreur lors de la génération de la requête SQL: ${error.message}`,
      };
    }
  }
}
