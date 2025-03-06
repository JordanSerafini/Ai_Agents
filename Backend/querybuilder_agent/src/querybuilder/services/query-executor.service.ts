import { Injectable, Logger } from '@nestjs/common';
import { Connection, SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { InjectConnection } from '@nestjs/typeorm';
import { QueryBuilderException } from '../exceptions/query-builder.exception';

@Injectable()
export class QueryExecutorService {
  private readonly logger = new Logger(QueryExecutorService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  /**
   * Crée un QueryBuilder de base
   */
  createQueryBuilder(): SelectQueryBuilder<ObjectLiteral> {
    try {
      return this.connection.createQueryBuilder() as SelectQueryBuilder<ObjectLiteral>;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(
        `Erreur lors de la création du QueryBuilder: ${message}`,
      );
      throw new QueryBuilderException(
        `Erreur lors de la création du QueryBuilder: ${message}`,
      );
    }
  }

  /**
   * Exécute la requête et retourne les résultats
   */
  async executeQuery<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    options?: { timeout?: number },
  ): Promise<T[]> {
    try {
      const startTime = Date.now();
      this.logger.debug(`Début de l'exécution de la requête: ${qb.getSql()}`);

      if (!options?.timeout) {
        const results = await qb.getMany();
        const executionTime = Date.now() - startTime;
        this.logger.debug(`Requête exécutée en ${executionTime}ms`);
        return results;
      }

      const timeoutError = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new QueryBuilderException(
                `La requête a dépassé le délai de ${options.timeout}ms`,
              ),
            ),
          options.timeout,
        ),
      );

      const results = await Promise.race([qb.getMany(), timeoutError]);
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
