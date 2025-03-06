import { Injectable, Logger } from '@nestjs/common';
import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { DatabaseService } from './database.service';
import { QueryBuilderException } from '../exceptions/query-builder.exception';

@Injectable()
export class QueryExecutorService {
  private readonly logger = new Logger(QueryExecutorService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Exécute la requête SQL brute et retourne les résultats
   */
  async executeQuery<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    options?: { timeout?: number },
  ): Promise<T[]> {
    try {
      const startTime = Date.now();
      const sql = qb.getSql();
      this.logger.debug(`Début de l'exécution de la requête: ${sql}`);
      
      // Récupération des paramètres depuis le query builder
      const params = qb.getParameters();
      const paramValues = Object.values(params);

      // Exécution via le DatabaseService qui utilise directement pg
      const results = await this.databaseService.executeQuery<T>(sql, paramValues);
      
      const executionTime = Date.now() - startTime;
      this.logger.debug(`Requête exécutée en ${executionTime}ms`);
      return results;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(`Erreur lors de l'exécution de la requête: ${message}`);
      throw new QueryBuilderException(message);
    }
  }
}
