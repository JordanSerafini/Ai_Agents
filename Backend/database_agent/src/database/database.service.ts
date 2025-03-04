import { Injectable, Logger, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DatabaseMetadataService } from './services/database-metadata.service';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    @Inject('PG_CONNECTION') private readonly dbPool: Pool,
    private readonly dbMetadataService: DatabaseMetadataService,
  ) {}

  async executeQuery(query: string, params: any[] = []): Promise<any> {
    try {
      this.logger.log(`Exécution de la requête: ${query}`);
      const result = await this.dbPool.query(query, params);
      return result.rows;
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'exécution de la requête: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async getTableData(tableName: string, limit: number = 10): Promise<any[]> {
    try {
      // Vérifier si la table existe dans les métadonnées
      const tableMetadata = this.dbMetadataService.getTable(tableName);
      if (!tableMetadata) {
        throw new Error(
          `Table '${tableName}' non trouvée dans les métadonnées`,
        );
      }

      const query = `SELECT * FROM ${tableName} LIMIT $1`;
      return await this.executeQuery(query, [limit]);
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la récupération des données de la table ${tableName}: ${error.message}`,
      );
      throw error;
    }
  }

  async searchInTable(
    tableName: string,
    column: string,
    searchTerm: string,
    limit: number = 10,
  ): Promise<any[]> {
    try {
      // Vérifier si la table et la colonne existent dans les métadonnées
      const tableMetadata = this.dbMetadataService.getTable(tableName);
      if (!tableMetadata) {
        throw new Error(
          `Table '${tableName}' non trouvée dans les métadonnées`,
        );
      }

      const columnExists = tableMetadata.columns.some(
        (col) => col.name === column,
      );
      if (!columnExists) {
        throw new Error(
          `Colonne '${column}' non trouvée dans la table '${tableName}'`,
        );
      }

      const query = `SELECT * FROM ${tableName} WHERE ${column} ILIKE $1 LIMIT $2`;
      return await this.executeQuery(query, [`%${searchTerm}%`, limit]);
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la recherche dans la table ${tableName}: ${error.message}`,
      );
      throw error;
    }
  }

  async getRelatedData(
    tableName: string,
    id: number,
    relatedTable: string,
  ): Promise<any[]> {
    try {
      // Vérifier si les tables existent dans les métadonnées
      const tableMetadata = this.dbMetadataService.getTable(tableName);
      if (!tableMetadata) {
        this.logger.error(
          `Table '${tableName}' non trouvée dans les métadonnées`,
        );
        throw new Error(
          `Table '${tableName}' non trouvée dans les métadonnées`,
        );
      }

      const relatedTableMetadata =
        this.dbMetadataService.getTable(relatedTable);
      if (!relatedTableMetadata) {
        this.logger.error(
          `Table liée '${relatedTable}' non trouvée dans les métadonnées`,
        );
        throw new Error(
          `Table liée '${relatedTable}' non trouvée dans les métadonnées`,
        );
      }

      // Trouver la relation entre les tables
      const relationships =
        this.dbMetadataService.getTableRelationships(tableName);
      const relationship = relationships.find(
        (rel) => rel.targetTable === relatedTable,
      );

      if (!relationship) {
        this.logger.error(
          `Aucune relation trouvée entre '${tableName}' et '${relatedTable}'`,
        );
        throw new Error(
          `Aucune relation trouvée entre '${tableName}' et '${relatedTable}'`,
        );
      }

      // Construire la requête SQL en fonction de la relation
      let query = '';
      let params: any[] = [];

      // Si la relation est de type "cette table a une clé étrangère vers la table liée"
      if (relationship.sourceColumn && relationship.targetColumn) {
        // Récupérer l'enregistrement de la table principale
        const mainRecord = await this.executeQuery(
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
      return await this.executeQuery(query, params);
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la récupération des données liées: ${error.message}`,
      );
      throw new Error(
        `Erreur lors de la récupération des données liées: ${error.message}`,
      );
    }
  }

  async getTableCount(tableName: string): Promise<number> {
    try {
      const result = await this.executeQuery(
        `SELECT COUNT(*) FROM ${tableName}`,
      );
      return parseInt(result[0].count, 10);
    } catch (error: any) {
      this.logger.error(
        `Erreur lors du comptage des enregistrements dans ${tableName}: ${error.message}`,
      );
      throw error;
    }
  }
}
