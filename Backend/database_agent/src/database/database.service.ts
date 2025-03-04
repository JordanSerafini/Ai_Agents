import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DatabaseMetadataService } from './services/database-metadata.service';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private readonly dbMetadataService: DatabaseMetadataService,
  ) {}

  async executeQuery(query: string, params: any[] = []): Promise<any> {
    try {
      this.logger.log(`Exécution de la requête: ${query}`);
      const result = await this.dataSource.query(query, params);
      return result;
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'exécution de la requête: ${error.message}`,
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
    } catch (error) {
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
    } catch (error) {
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
        throw new Error(
          `Table '${tableName}' non trouvée dans les métadonnées`,
        );
      }

      const relatedTableMetadata =
        this.dbMetadataService.getTable(relatedTable);
      if (!relatedTableMetadata) {
        throw new Error(
          `Table liée '${relatedTable}' non trouvée dans les métadonnées`,
        );
      }

      // Trouver la relation entre les tables
      const relationship = tableMetadata.relationships.find(
        (rel) => rel.targetTable === relatedTable,
      );
      if (!relationship) {
        throw new Error(
          `Aucune relation trouvée entre '${tableName}' et '${relatedTable}'`,
        );
      }

      let query = '';
      if (relationship.type === 'one-to-many') {
        // Si la table source a une relation one-to-many avec la table cible
        query = `SELECT * FROM ${relatedTable} WHERE ${relationship.targetColumn} = $1`;
      } else if (relationship.type === 'many-to-one') {
        // Si la table source a une relation many-to-one avec la table cible
        query = `SELECT * FROM ${relatedTable} WHERE id = (SELECT ${relationship.sourceColumn} FROM ${tableName} WHERE id = $1)`;
      } else if (relationship.type === 'many-to-many') {
        // Pour les relations many-to-many, il faudrait connaître la table de jointure
        throw new Error(
          `Les relations many-to-many ne sont pas encore supportées`,
        );
      } else {
        throw new Error(`Type de relation non supporté: ${relationship.type}`);
      }

      return await this.executeQuery(query, [id]);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des données liées: ${error.message}`,
      );
      throw error;
    }
  }

  async getTableCount(tableName: string): Promise<number> {
    try {
      const result = await this.executeQuery(
        `SELECT COUNT(*) FROM ${tableName}`,
      );
      return parseInt(result[0].count, 10);
    } catch (error) {
      this.logger.error(
        `Erreur lors du comptage des enregistrements dans ${tableName}: ${error.message}`,
      );
      throw error;
    }
  }
}
