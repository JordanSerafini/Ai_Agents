import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPrimary: boolean;
  isForeign: boolean;
  foreignTable?: string;
  foreignColumn?: string;
  description?: string;
}

export interface TableMetadata {
  name: string;
  description?: string;
  columns: TableColumn[];
}

export interface EnumMetadata {
  name: string;
  values: string[];
  description?: string;
}

@Injectable()
export class DatabaseMetadataService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseMetadataService.name);
  private tables: TableMetadata[] = [];
  private enums: EnumMetadata[] = [];
  private databaseDescription: string = '';

  constructor(private dataSource: DataSource) {}

  onModuleInit() {
    this.logger.log('Initializing DatabaseMetadataService');
    this.loadMetadata();
  }

  private async loadMetadata() {
    try {
      await this.loadTables();
      await this.loadEnums();
      await this.loadDatabaseDescription();
      this.logger.log(
        `Metadata loaded: ${this.tables.length} tables, ${this.enums.length} enums`,
      );
    } catch (error) {
      this.logger.error(`Failed to load database metadata: ${error.message}`);
    }
  }

  private async loadTables() {
    try {
      // Récupérer les tables
      const tablesQuery = `
        SELECT 
          t.table_name, 
          obj_description(pgc.oid, 'pg_class') as table_description
        FROM 
          information_schema.tables t
        JOIN 
          pg_catalog.pg_class pgc ON t.table_name = pgc.relname
        WHERE 
          t.table_schema = 'public' 
          AND t.table_type = 'BASE TABLE'
      `;

      const tables = await this.dataSource.query(tablesQuery);

      for (const table of tables) {
        const tableName = table.table_name;

        // Récupérer les colonnes
        const columnsQuery = `
          SELECT 
            c.column_name, 
            c.data_type, 
            c.is_nullable = 'YES' as is_nullable,
            (
              SELECT 
                count(*) > 0 
              FROM 
                information_schema.table_constraints tc
                JOIN information_schema.constraint_column_usage ccu 
                  ON tc.constraint_name = ccu.constraint_name
              WHERE 
                tc.constraint_type = 'PRIMARY KEY' 
                AND tc.table_name = c.table_name 
                AND ccu.column_name = c.column_name
            ) as is_primary,
            pgd.description as column_description
          FROM 
            information_schema.columns c
          LEFT JOIN 
            pg_catalog.pg_statio_all_tables st ON c.table_name = st.relname
          LEFT JOIN 
            pg_catalog.pg_description pgd ON pgd.objoid = st.relid 
            AND pgd.objsubid = c.ordinal_position
          WHERE 
            c.table_name = $1
            AND c.table_schema = 'public'
        `;

        const columns = await this.dataSource.query(columnsQuery, [tableName]);

        // Récupérer les clés étrangères
        const foreignKeysQuery = `
          SELECT
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM
            information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
          WHERE
            tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = $1
            AND tc.table_schema = 'public'
        `;

        const foreignKeys = await this.dataSource.query(foreignKeysQuery, [
          tableName,
        ]);

        // Créer un mapping des clés étrangères
        const foreignKeyMap = {};
        for (const fk of foreignKeys) {
          foreignKeyMap[fk.column_name] = {
            foreignTable: fk.foreign_table_name,
            foreignColumn: fk.foreign_column_name,
          };
        }

        // Construire les métadonnées de la table
        const tableColumns: TableColumn[] = columns.map((column) => {
          const isForeign = !!foreignKeyMap[column.column_name];

          return {
            name: column.column_name,
            type: column.data_type,
            nullable: column.is_nullable,
            isPrimary: column.is_primary,
            isForeign,
            foreignTable: isForeign
              ? foreignKeyMap[column.column_name].foreignTable
              : undefined,
            foreignColumn: isForeign
              ? foreignKeyMap[column.column_name].foreignColumn
              : undefined,
            description: column.column_description,
          };
        });

        this.tables.push({
          name: tableName,
          description: table.table_description,
          columns: tableColumns,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to load tables: ${error.message}`);
      throw error;
    }
  }

  private async loadEnums() {
    try {
      const enumsQuery = `
        SELECT 
          t.typname as enum_name,
          array_agg(e.enumlabel) as enum_values,
          obj_description(t.oid, 'pg_type') as description
        FROM 
          pg_type t
        JOIN 
          pg_enum e ON t.oid = e.enumtypid
        JOIN 
          pg_catalog.pg_namespace n ON n.oid = t.typnamespace
        WHERE 
          n.nspname = 'public'
        GROUP BY 
          t.typname, t.oid
      `;

      const enums = await this.dataSource.query(enumsQuery);

      this.enums = enums.map((e) => ({
        name: e.enum_name,
        values: e.enum_values,
        description: e.description,
      }));
    } catch (error) {
      this.logger.error(`Failed to load enums: ${error.message}`);
      throw error;
    }
  }

  private async loadDatabaseDescription() {
    try {
      // Tenter de récupérer une description de la base de données depuis une table de métadonnées
      // ou définir une description par défaut
      this.databaseDescription = "Base de données principale de l'application";
    } catch (error) {
      this.logger.error(
        `Failed to load database description: ${error.message}`,
      );
      this.databaseDescription = 'Aucune description disponible';
    }
  }

  getAllTables(): TableMetadata[] {
    return this.tables;
  }

  getTable(tableName: string): TableMetadata | undefined {
    return this.tables.find((t) => t.name === tableName);
  }

  getAllEnums(): EnumMetadata[] {
    return this.enums;
  }

  getEnum(enumName: string): EnumMetadata | undefined {
    return this.enums.find((e) => e.name === enumName);
  }

  getDatabaseDescription(): string {
    return this.databaseDescription;
  }

  getRelationships(tableName: string): { [key: string]: string[] } {
    const relationships: { [key: string]: string[] } = {};

    // Trouver les tables qui ont une clé étrangère vers cette table
    for (const table of this.tables) {
      if (table.name === tableName) continue;

      for (const column of table.columns) {
        if (column.isForeign && column.foreignTable === tableName) {
          if (!relationships[table.name]) {
            relationships[table.name] = [];
          }
          relationships[table.name].push(column.name);
        }
      }
    }

    return relationships;
  }

  refreshMetadata() {
    this.tables = [];
    this.enums = [];
    this.loadMetadata();
  }
}
