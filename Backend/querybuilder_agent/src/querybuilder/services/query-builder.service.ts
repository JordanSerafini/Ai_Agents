import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export interface AnalyseQueryData {
  tables: Array<{
    nom: string;
    alias: string;
    type: 'PRINCIPALE' | 'JOINTE';
    colonnes: string[];
    condition_jointure?: string;
  }>;
  conditions?: Array<{
    type: 'FILTRE' | 'TEMPOREL';
    expression: string;
  }>;
  groupBy?: string[];
  orderBy?: string[];
  limit?: number;
  metadata?: {
    intention: string;
    description: string;
  };
}

@Injectable()
export class QueryBuilderService {
  private readonly logger = new Logger(QueryBuilderService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async executeQuery(queryData: AnalyseQueryData): Promise<any> {
    const qb = this.connection.createQueryBuilder();

    const mainTable = queryData.tables.find((t) => t.type === 'PRINCIPALE');
    if (!mainTable)
      throw new Error('Aucune table principale définie dans la requête');

    qb.from(mainTable.nom, mainTable.alias).select(
      mainTable.colonnes.map((col) => `${mainTable.alias}.${col}`),
    );

    queryData.tables
      .filter((t) => t.type === 'JOINTE')
      .forEach((join) => {
        if (join.condition_jointure) {
          qb.leftJoin(join.nom, join.alias, join.condition_jointure);
          qb.addSelect(join.colonnes.map((col) => `${join.alias}.${col}`));
        }
      });

    queryData.conditions?.forEach((condition) => {
      qb.andWhere(condition.expression);
    });

    if (queryData.groupBy?.length) {
      qb.groupBy(queryData.groupBy.join(', '));
    }

    queryData.orderBy?.forEach((order) => {
      const [column, direction] = this.orderByAlias(order);
      qb.addOrderBy(this.columnAlias(column), direction);
    });

    if (queryData.limit) qb.limit(queryData.limit);

    const results = await qb.getRawMany();

    return {
      success: true,
      results,
      query: qb.getSql(),
    };
  }

  private orderByAlias(orderBy: string): [string, 'ASC' | 'DESC'] {
    const [col, dir] = orderBy.split(' ');
    return [col.trim(), dir?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'];
  }

  private columnAlias(column: string): string {
    return column.includes('.') ? column : `\`${column}\``;
  }
}
