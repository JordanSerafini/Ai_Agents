import { Injectable, Logger } from '@nestjs/common';
import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { AnalyseQueryData } from '../interfaces/query-builder.types';
import { QueryBuilderException } from '../exceptions/query-builder.exception';
import { QueryExecutorService } from './query-executor.service';

@Injectable()
export class QueryConfigService {
  private readonly logger = new Logger(QueryConfigService.name);

  constructor(private readonly executorService: QueryExecutorService) {}

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
    // La table principale
    const mainTable = data.tables.find((t) => t.type === 'PRINCIPALE');
    let explanation = `Requête sur la table principale ${mainTable?.nom}`;

    // Les jointures
    const joinTables = data.tables.filter((t) => t.type === 'JOINTE');
    if (joinTables.length > 0) {
      explanation += ` avec jointures sur ${joinTables
        .map((t) => t.nom)
        .join(', ')}`;
    }

    // Les conditions
    if (data.conditions?.length) {
      explanation += '. Filtres appliqués : ';
      explanation += data.conditions.map((c) => c.expression).join(' ET ');
    }

    // Tri et limite
    if (data.orderBy?.length) {
      explanation += `. Tri par ${data.orderBy.join(', ')}`;
    }

    if (data.metadata?.parametresRequete?.limite) {
      explanation += `. Limité à ${data.metadata.parametresRequete.limite} résultats`;
    }

    // Métadonnées
    if (data.metadata?.intention) {
      explanation += `\n\nIntention : ${data.metadata.intention}`;
    }

    if (data.metadata?.description) {
      explanation += `\nContexte : ${data.metadata.description}`;
    }

    return explanation;
  }

  async configureQuery(
    data: AnalyseQueryData,
  ): Promise<SelectQueryBuilder<ObjectLiteral>> {
    const qb = this.createQueryBuilder();

    // Configuration de la table principale
    this.configureMainTable(qb, data);

    // Configuration des jointures
    if (data.tables.some((t) => t.type === 'JOINTE')) {
      this.configureJoins(qb, data);
    }

    // Application des conditions
    if (data.conditions?.length) {
      this.applyConditions(qb, data);
    }

    // Configuration du groupement
    if (data.groupBy?.length) {
      qb.groupBy(data.groupBy.join(', '));
    }

    // Configuration du tri
    if (data.orderBy?.length) {
      this.configureOrdering(qb, data);
    }

    // Configuration de la limite
    if (data.metadata?.parametresRequete?.limite) {
      qb.limit(data.metadata.parametresRequete.limite);
    }

    return qb;
  }

  private createQueryBuilder(): SelectQueryBuilder<ObjectLiteral> {
    return this.executorService.createQueryBuilder();
  }
}
