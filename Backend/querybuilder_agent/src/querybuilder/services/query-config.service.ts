import { Injectable, Logger } from '@nestjs/common';
import { SelectQueryBuilder, ObjectLiteral, createConnection } from 'typeorm';
import { AnalyseQueryData } from '../interfaces/query-builder.types';
import { QueryBuilderException } from '../exceptions/query-builder.exception';
import { DatabaseService } from './database.service';

@Injectable()
export class QueryConfigService {
  private readonly logger = new Logger(QueryConfigService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Génère un alias unique pour une table
   */
  private generateTableAlias(tableName: string): string {
    return tableName
      .replace(/[^a-zA-Z]/g, '')
      .slice(0, 3)
      .toLowerCase();
  }

  /**
   * Configure la table principale de la requête
   */
  configureMainTable(
    qb: SelectQueryBuilder<ObjectLiteral>,
    data: AnalyseQueryData,
  ): AnalyseQueryData['tables'][0] {
    const mainTable = data.tables.find((t) => t.type === 'PRINCIPALE');

    if (!mainTable) {
      throw new QueryBuilderException('Aucune table principale trouvée');
    }

    try {
      const alias = mainTable.alias || this.generateTableAlias(mainTable.nom);
      qb.from(mainTable.nom, alias);
      const columns = mainTable.colonnes.map((col) => `${alias}.${col}`);
      qb.select(columns);
      return { ...mainTable, alias };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur inconnue';
      throw new QueryBuilderException(
        `Erreur lors de la configuration de la table principale: ${message}`,
      );
    }
  }

  /**
   * Configure les jointures de la requête
   */
  configureJoins(
    qb: SelectQueryBuilder<ObjectLiteral>,
    data: AnalyseQueryData,
  ): void {
    try {
      data.tables
        .filter((table) => table.type === 'JOINTE')
        .forEach((join) => {
          if (join.condition_jointure) {
            const alias = join.alias || this.generateTableAlias(join.nom);
            qb.leftJoin(join.nom, alias, join.condition_jointure);
            const columns = join.colonnes.map((col) => `${alias}.${col}`);
            qb.addSelect(columns);
          }
        });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur inconnue';
      throw new QueryBuilderException(
        `Erreur lors de la configuration des jointures: ${message}`,
      );
    }
  }
  /**
   * Applique un groupe de conditions à la requête
   */
  private applyConditionGroup(
    qb: SelectQueryBuilder<ObjectLiteral>,
    conditions: AnalyseQueryData['conditions'],
    isFirstGroup: boolean,
  ): void {
    conditions?.forEach((condition, index) => {
      const { expression, parametres } = condition;
      const useWhere = isFirstGroup && index === 0;

      // Vérifier si c'est une condition temporelle
      if (condition.type === 'TEMPOREL') {
        this.logger.debug(
          `Application de la condition temporelle: ${expression}`,
        );
        this.logger.debug(
          `Paramètres temporels: ${JSON.stringify(parametres)}`,
        );
      }

      if (useWhere) {
        qb.where(expression, parametres || {});
      } else {
        qb.andWhere(expression, parametres || {});
      }
    });
  }

  /**
   * Applique les conditions à la requête, en séparant les conditions temporelles et logiques
   */
  applyConditions(
    qb: SelectQueryBuilder<ObjectLiteral>,
    data: AnalyseQueryData,
  ): void {
    try {
      // Grouper les conditions par type
      const temporalConditions =
        data.conditions?.filter((c) => c.type === 'TEMPOREL') || [];
      const logicalConditions =
        data.conditions?.filter(
          (c) => c.type === 'LOGIQUE' || c.type === 'FILTRE',
        ) || [];

      // Appliquer les conditions par lots
      this.applyConditionGroup(qb, temporalConditions, true);
      this.applyConditionGroup(
        qb,
        logicalConditions,
        temporalConditions.length === 0,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(
        `Erreur lors de l'application des conditions: ${message}`,
      );
      throw new QueryBuilderException(
        `Erreur lors de l'application des conditions: ${message}`,
      );
    }
  }

  /**
   * Configure l'ordre des résultats
   */
  configureOrdering(
    qb: SelectQueryBuilder<ObjectLiteral>,
    data: AnalyseQueryData,
  ): void {
    try {
      data.orderBy?.forEach((order) => {
        const [column, direction] = this.parseOrderBy(order);
        qb.addOrderBy(column, direction);
      });
    } catch (error) {
      throw new QueryBuilderException(
        `Erreur lors de la configuration du tri: ${
          error instanceof Error ? error.message : 'Erreur inconnue'
        }`,
      );
    }
  }

  /**
   * Parse une expression d'ordre pour extraire la colonne et la direction
   */
  parseOrderBy(orderBy: string): [string, 'ASC' | 'DESC'] {
    const [column, direction = 'ASC'] = orderBy.split(' ');
    return [column, direction.toUpperCase() as 'ASC' | 'DESC'];
  }

  /**
   * Génère une explication textuelle de la requête construite
   */
  generateExplanation(data: AnalyseQueryData): string {
    const mainTable = data.tables.find((t) => t.type === 'PRINCIPALE');
    const joinTables = data.tables.filter((t) => t.type === 'JOINTE');

    let explanation = `Cette requête`;

    if (data.metadata?.intention) {
      explanation += ` ${data.metadata.intention}`;
    }

    explanation += ` les données de ${mainTable?.nom || 'la table principale'}`;

    if (joinTables.length > 0) {
      explanation += ` en joignant avec: ${joinTables.map((t) => t.nom).join(', ')}`;
    }

    if (data.conditions && data.conditions.length > 0) {
      explanation += `. Avec les filtres: ${data.conditions.map((c) => c.expression).join(', ')}`;
    }

    if (data.groupBy && data.groupBy.length > 0) {
      explanation += `. Regroupé par: ${data.groupBy.join(', ')}`;
    }

    if (data.orderBy && data.orderBy.length > 0) {
      explanation += `. Trié par: ${data.orderBy.join(', ')}`;
    }

    return explanation;
  }

  /**
   * Génère une requête SQL brute et ses paramètres à partir des données d'analyse
   */
  generateRawSql(data: AnalyseQueryData): { sql: string; params: any[] } {
    try {
      // Trouver la table principale
      const mainTable = data.tables.find((t) => t.type === 'PRINCIPALE');
      if (!mainTable) {
        throw new QueryBuilderException('Aucune table principale trouvée');
      }

      const mainAlias =
        mainTable.alias || mainTable.nom.charAt(0).toLowerCase();

      // Construire les selections de colonnes
      const selectParts: string[] = [];
      for (const table of data.tables) {
        const alias = table.alias || table.nom.charAt(0).toLowerCase();
        for (const column of table.colonnes) {
          selectParts.push(`${alias}.${column}`);
        }
      }

      // Construire les jointures
      const joinParts: string[] = [];
      for (const table of data.tables) {
        if (table.type === 'JOINTE') {
          const alias = table.alias || table.nom.charAt(0).toLowerCase();
          if (table.condition_jointure) {
            joinParts.push(
              `LEFT JOIN "${table.nom}" "${alias}" ON ${table.condition_jointure}`,
            );
          }
        }
      }

      // Construire les conditions WHERE
      const whereParts: string[] = [];
      const params: any[] = [];

      if (data.conditions) {
        for (const condition of data.conditions) {
          // Convertir les expressions avec :param en expressions avec $1, $2, etc.
          let processedExpr = condition.expression;

          if (condition.parametres) {
            // Remplacer chaque paramètre nommé par un paramètre positionnel
            const paramNames = Object.keys(condition.parametres);
            for (const paramName of paramNames) {
              const paramValue = condition.parametres[paramName];
              params.push(paramValue);
              const paramPosition = params.length;
              const regex = new RegExp(`:${paramName}`, 'g');
              processedExpr = processedExpr.replace(regex, `$${paramPosition}`);
            }
          }

          whereParts.push(processedExpr);
        }
      }

      // Construire la requête SQL
      let sql = `SELECT ${selectParts.join(', ')} FROM "${mainTable.nom}" "${mainAlias}"`;

      if (joinParts.length > 0) {
        sql += ` ${joinParts.join(' ')}`;
      }

      if (whereParts.length > 0) {
        sql += ` WHERE ${whereParts.join(' AND ')}`;
      }

      if (data.groupBy && data.groupBy.length > 0) {
        sql += ` GROUP BY ${data.groupBy.join(', ')}`;
      }

      if (data.orderBy && data.orderBy.length > 0) {
        sql += ` ORDER BY ${data.orderBy.join(', ')}`;
      }

      if (data.metadata?.parametresRequete?.limite) {
        sql += ` LIMIT ${data.metadata.parametresRequete.limite}`;
      } else {
        sql += ` LIMIT 100`; // Limite par défaut
      }

      return { sql, params };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur inconnue';
      throw new QueryBuilderException(
        `Erreur lors de la génération SQL: ${message}`,
      );
    }
  }

  /**
   * Cette méthode n'est plus utilisée mais est conservée pour compatibilité
   * Elle retourne un QueryBuilder manuellement créé
   * Utilisez plutôt generateRawSql() pour les nouvelles fonctionnalités
   */
  async configureQuery(
    data: AnalyseQueryData,
  ): Promise<SelectQueryBuilder<ObjectLiteral>> {
    try {
      // Cette méthode est conservée pour compatibilité
      // mais elle lance une exception car nous utilisons maintenant generateRawSql()
      throw new QueryBuilderException(
        'Cette méthode est obsolète. Utilisez generateRawSql() à la place.',
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur inconnue';
      throw new QueryBuilderException(
        `Erreur lors de la configuration de la requête: ${message}`,
      );
    }
  }

  /**
   * Cette méthode n'est plus utilisée mais est conservée pour compatibilité
   * Elle lance une exception car nous utilisons maintenant DatabaseService directement
   */
  private createQueryBuilder(): SelectQueryBuilder<ObjectLiteral> {
    throw new QueryBuilderException(
      'Cette méthode est obsolète. Utilisez DatabaseService.executeQuery() à la place.',
    );
  }
}
