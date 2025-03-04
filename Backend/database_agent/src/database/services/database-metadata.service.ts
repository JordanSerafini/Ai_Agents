import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { Pool } from 'pg';

export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  description?: string;
}

export interface TableRelationship {
  sourceTable: string;
  targetTable: string;
  sourceColumn?: string;
  targetColumn?: string;
  relationType: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
}

export interface TableMetadata {
  name: string;
  columns: TableColumn[];
  description?: string;
}

export interface EnumMetadata {
  name: string;
  values: string[];
  description?: string;
}

export interface DatabaseMetadata {
  tables: TableMetadata[];
  enums: EnumMetadata[];
  descriptions: { [key: string]: string };
}

@Injectable()
export class DatabaseMetadataService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseMetadataService.name);
  private metadata: DatabaseMetadata = {
    tables: [],
    enums: [],
    descriptions: {},
  };

  constructor(@Inject('PG_CONNECTION') private pool: Pool) {}

  async onModuleInit() {
    await this.loadMetadata();
  }

  async loadMetadata() {
    try {
      this.logger.log('Chargement des métadonnées de la base de données...');
      await this.loadTables();
      await this.loadEnums();
      await this.loadDatabaseDescriptions();
      this.logger.log('Métadonnées de la base de données chargées avec succès');
    } catch (error: any) {
      this.logger.error(
        `Erreur lors du chargement des métadonnées: ${error.message}`,
      );
      throw error;
    }
  }

  async loadTables() {
    try {
      // Requête pour obtenir toutes les tables
      const tablesQuery = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `;
      const tablesResult = await this.pool.query(tablesQuery);

      for (const table of tablesResult.rows) {
        const tableName = table.table_name;
        const columns = await this.getTableColumns(tableName);

        this.metadata.tables.push({
          name: tableName,
          columns,
          description: '',
        });
      }

      // Charger les relations entre les tables
      await this.loadTableRelationships();
    } catch (error: any) {
      this.logger.error(
        `Erreur lors du chargement des tables: ${error.message}`,
      );
      throw error;
    }
  }

  async getTableColumns(tableName: string): Promise<TableColumn[]> {
    try {
      // Requête pour obtenir les colonnes d'une table
      const columnsQuery = `
        SELECT 
          c.column_name, 
          c.data_type, 
          c.is_nullable,
          CASE WHEN pk.constraint_type = 'PRIMARY KEY' THEN true ELSE false END as is_primary_key,
          CASE WHEN fk.constraint_name IS NOT NULL THEN true ELSE false END as is_foreign_key
        FROM 
          information_schema.columns c
        LEFT JOIN (
          SELECT 
            tc.constraint_type, 
            kcu.column_name
          FROM 
            information_schema.table_constraints tc
          JOIN 
            information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
          WHERE 
            tc.constraint_type = 'PRIMARY KEY' 
            AND tc.table_name = $1
        ) pk ON c.column_name = pk.column_name
        LEFT JOIN (
          SELECT 
            tc.constraint_name, 
            kcu.column_name
          FROM 
            information_schema.table_constraints tc
          JOIN 
            information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
          WHERE 
            tc.constraint_type = 'FOREIGN KEY' 
            AND tc.table_name = $1
        ) fk ON c.column_name = fk.column_name
        WHERE 
          c.table_name = $1
        ORDER BY 
          c.ordinal_position;
      `;

      const columnsResult = await this.pool.query(columnsQuery, [tableName]);

      return columnsResult.rows.map((row) => ({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 'YES',
        isPrimaryKey: row.is_primary_key,
        isForeignKey: row.is_foreign_key,
        description: '',
      }));
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la récupération des colonnes pour la table ${tableName}: ${error.message}`,
      );
      throw error;
    }
  }

  async loadTableRelationships() {
    try {
      // Requête pour obtenir les relations entre les tables
      const relationshipsQuery = `
        SELECT
          tc.table_name AS source_table,
          kcu.column_name AS source_column,
          ccu.table_name AS target_table,
          ccu.column_name AS target_column
        FROM
          information_schema.table_constraints tc
        JOIN
          information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN
          information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE
          tc.constraint_type = 'FOREIGN KEY';
      `;

      const relationshipsResult = await this.pool.query(relationshipsQuery);

      for (const row of relationshipsResult.rows) {
        const sourceTable = this.getTable(row.source_table);
        const targetTable = this.getTable(row.target_table);

        if (sourceTable && targetTable) {
          // Déterminer le type de relation
          // Par défaut, on suppose une relation many-to-one
          let relationType:
            | 'one-to-one'
            | 'one-to-many'
            | 'many-to-one'
            | 'many-to-many' = 'many-to-one';

          // Si la colonne source est une clé primaire, c'est probablement une relation one-to-one
          const sourceColumn = sourceTable.columns.find(
            (col) => col.name === row.source_column,
          );
          if (sourceColumn && sourceColumn.isPrimaryKey) {
            relationType = 'one-to-one';
          }

          // Ajouter la relation
          const relationship: TableRelationship = {
            sourceTable: row.source_table,
            targetTable: row.target_table,
            sourceColumn: row.source_column,
            targetColumn: row.target_column,
            relationType,
          };

          // Stocker la relation dans les métadonnées
          if (!sourceTable.relationships) {
            sourceTable.relationships = [];
          }
          sourceTable.relationships.push(relationship);
        }
      }
    } catch (error: any) {
      this.logger.error(
        `Erreur lors du chargement des relations entre les tables: ${error.message}`,
      );
      throw error;
    }
  }

  async loadEnums() {
    try {
      // Requête pour obtenir les types enum
      const enumsQuery = `
        SELECT
          t.typname AS enum_name,
          e.enumlabel AS enum_value
        FROM
          pg_type t
        JOIN
          pg_enum e ON t.oid = e.enumtypid
        JOIN
          pg_catalog.pg_namespace n ON n.oid = t.typnamespace
        WHERE
          n.nspname = 'public'
        ORDER BY
          t.typname, e.enumsortorder;
      `;

      const enumsResult = await this.pool.query(enumsQuery);

      // Regrouper les valeurs par nom d'enum
      const enumMap = new Map<string, string[]>();
      for (const row of enumsResult.rows) {
        if (!enumMap.has(row.enum_name)) {
          enumMap.set(row.enum_name, []);
        }
        enumMap.get(row.enum_name)?.push(row.enum_value);
      }

      // Convertir la map en tableau d'EnumMetadata
      for (const [name, values] of enumMap.entries()) {
        this.metadata.enums.push({
          name,
          values,
          description: '',
        });
      }
    } catch (error: any) {
      this.logger.error(
        `Erreur lors du chargement des enums: ${error.message}`,
      );
      throw error;
    }
  }

  async loadDatabaseDescriptions() {
    try {
      // Requête pour obtenir les commentaires sur les tables et les colonnes
      const descriptionsQuery = `
        SELECT
          c.relname AS table_name,
          a.attname AS column_name,
          d.description
        FROM
          pg_description d
        JOIN
          pg_class c ON d.objoid = c.oid
        LEFT JOIN
          pg_attribute a ON d.objoid = a.attrelid AND d.objsubid = a.attnum
        WHERE
          c.relkind = 'r'
          AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        ORDER BY
          c.relname, a.attname;
      `;

      const descriptionsResult = await this.pool.query(descriptionsQuery);

      for (const row of descriptionsResult.rows) {
        const tableName = row.table_name;
        const columnName = row.column_name;
        const description = row.description;

        if (columnName) {
          // Description d'une colonne
          const table = this.getTable(tableName);
          if (table) {
            const column = table.columns.find((col) => col.name === columnName);
            if (column) {
              column.description = description;
            }
          }
        } else {
          // Description d'une table
          const table = this.getTable(tableName);
          if (table) {
            table.description = description;
          }
        }

        // Stocker également dans le dictionnaire de descriptions
        const key = columnName ? `${tableName}.${columnName}` : tableName;
        this.metadata.descriptions[key] = description;
      }
    } catch (error: any) {
      this.logger.error(
        `Erreur lors du chargement des descriptions: ${error.message}`,
      );
      throw error;
    }
  }

  getTable(
    tableName: string,
  ): TableMetadata & { relationships?: TableRelationship[] } {
    return this.metadata.tables.find(
      (table) => table.name === tableName,
    ) as TableMetadata & { relationships?: TableRelationship[] };
  }

  getTableRelationships(tableName: string): TableRelationship[] {
    const table = this.getTable(tableName) as TableMetadata & {
      relationships?: TableRelationship[];
    };
    return table?.relationships || [];
  }

  getAllTables(): TableMetadata[] {
    return this.metadata.tables;
  }

  getAllEnums(): EnumMetadata[] {
    return this.metadata.enums;
  }

  getEnum(enumName: string): EnumMetadata | undefined {
    return this.metadata.enums.find((e) => e.name === enumName);
  }

  getDescription(key: string): string {
    return this.metadata.descriptions[key] || '';
  }
}