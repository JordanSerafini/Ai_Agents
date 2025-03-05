import { Injectable, Logger, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DatabaseMetadataService } from './services/database-metadata.service';

// Interface pour les relations entre tables
interface TableRelationship {
  sourceTable: string;
  targetTable: string;
  sourceColumn: string;
  targetColumn: string;
  relationType: string;
}

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    @Inject('PG_CONNECTION') private readonly dbPool: Pool,
    private readonly dbMetadataService: DatabaseMetadataService,
  ) {}

  async executeQuery<T = any[]>(query: string, params: any[] = []): Promise<T> {
    try {
      this.logger.log(`Exécution de la requête: ${query}`);
      const result = await this.dbPool.query(query, params);
      return result.rows as T;
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'exécution de la requête: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async getTableData<T = Record<string, any>>(
    tableName: string,
    limit: number = 10,
  ): Promise<T[]> {
    try {
      // Vérifier si la table existe dans les métadonnées
      const tableMetadata = this.dbMetadataService.getTable(tableName);
      if (!tableMetadata) {
        throw new Error(
          `Table '${tableName}' non trouvée dans les métadonnées`,
        );
      }

      const query = `SELECT * FROM ${tableName} LIMIT $1`;
      return await this.executeQuery<T[]>(query, [limit]);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des données de la table ${tableName}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async searchInTable<T = Record<string, any>>(
    tableName: string,
    column: string,
    searchTerm: string,
    limit: number = 10,
  ): Promise<T[]> {
    try {
      // Vérifier si la table existe dans les métadonnées
      const tableMetadata = this.dbMetadataService.getTable(tableName);
      if (!tableMetadata) {
        throw new Error(
          `Table '${tableName}' non trouvée dans les métadonnées`,
        );
      }

      // Vérifier si la colonne existe
      const columnExists = tableMetadata.columns.some(
        (col) => col.name === column,
      );
      if (!columnExists) {
        throw new Error(
          `Colonne '${column}' non trouvée dans la table '${tableName}'`,
        );
      }

      const query = `SELECT * FROM ${tableName} WHERE ${column} ILIKE $1 LIMIT $2`;
      return await this.executeQuery<T[]>(query, [`%${searchTerm}%`, limit]);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la recherche dans la table ${tableName}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async getRelatedData<T = Record<string, any>>(
    tableName: string,
    id: number,
    relatedTable: string,
  ): Promise<T[]> {
    try {
      // Vérifier si les tables existent dans les métadonnées
      const tableMetadata = this.dbMetadataService.getTable(tableName);
      const relatedTableMetadata =
        this.dbMetadataService.getTable(relatedTable);

      if (!tableMetadata) {
        throw new Error(
          `Table principale '${tableName}' non trouvée dans les métadonnées`,
        );
      }

      if (!relatedTableMetadata) {
        throw new Error(
          `Table liée '${relatedTable}' non trouvée dans les métadonnées`,
        );
      }

      // Trouver la relation entre les tables
      const relationship = this.dbMetadataService.getRelationship(
        tableName,
        relatedTable,
      );

      if (!relationship) {
        throw new Error(
          `Pas de relation trouvée entre '${tableName}' et '${relatedTable}'`,
        );
      }

      let query = '';
      let params: any[] = [];

      if (relationship.sourceColumn && relationship.targetColumn) {
        // Récupérer l'enregistrement de la table principale
        interface MainRecord {
          [key: string]: any;
        }
        const mainRecord = await this.executeQuery<MainRecord[]>(
          `SELECT * FROM ${tableName} WHERE id = $1`,
          [id],
        );

        if (!mainRecord || mainRecord.length === 0) {
          this.logger.error(
            `Enregistrement avec id=${id} non trouvé dans la table ${tableName}`,
          );
          throw new Error(
            `Enregistrement avec id=${id} non trouvé dans la table ${tableName}`,
          );
        }

        // Récupérer les enregistrements liés
        query = `SELECT * FROM ${relatedTable} WHERE ${relationship.targetColumn} = $1`;
        params = [mainRecord[0][relationship.sourceColumn]];
      } else {
        // Si la relation est de type "la table liée a une clé étrangère vers cette table"
        query = `SELECT * FROM ${relatedTable} WHERE ${relationship.sourceColumn} = $1`;
        params = [id];
      }

      // Exécuter la requête
      return await this.executeQuery<T[]>(query, params);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des données liées: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `Erreur lors de la récupération des données liées: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getTableCount(tableName: string): Promise<number> {
    try {
      interface CountResult {
        count: string;
      }

      const result = await this.executeQuery<CountResult[]>(
        `SELECT COUNT(*) FROM ${tableName}`,
      );
      return parseInt(result[0].count, 10);
    } catch (error) {
      this.logger.error(
        `Erreur lors du comptage des enregistrements dans ${tableName}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
