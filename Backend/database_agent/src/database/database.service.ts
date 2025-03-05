import { Injectable, Logger, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DatabaseMetadataService } from './services/database-metadata.service';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  private queryCache: Map<
    string,
    { data: any; timestamp: number; ttl?: number }
  > = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes par défaut

  constructor(
    @Inject('PG_CONNECTION') private readonly dbPool: Pool,
    private readonly dbMetadataService: DatabaseMetadataService,
  ) {}

  /**
   * Récupère la connexion à la base de données
   * @returns Une instance de Pool de la base de données
   */
  getDataSource(): Pool {
    return this.dbPool;
  }

  /**
   * Exécute une requête SQL avec gestion de cache optionnelle
   * @param query Requête SQL à exécuter
   * @param params Paramètres de la requête
   * @param useCache Si true, utilise le cache
   * @param cacheTTL Durée de vie du cache en millisecondes
   * @returns Résultat de la requête
   */
  async executeQuery<T = any[]>(
    query: string,
    params: any[] = [],
    useCache: boolean = false,
    cacheTTL: number = this.CACHE_TTL_MS,
  ): Promise<T> {
    try {
      // Si le cache est activé, essayer de récupérer depuis le cache
      if (useCache) {
        const cacheKey = this.getCacheKey(query, params);
        const cachedResult = this.getFromCache<T>(cacheKey);

        if (cachedResult) {
          this.logger.log(`Résultat récupéré depuis le cache pour: ${query}`);
          return cachedResult;
        }
      }

      this.logger.log(`Exécution de la requête: ${query}`);
      this.logger.debug(`Paramètres: ${JSON.stringify(params)}`);

      const client = await this.dbPool.connect();
      try {
        const result = await client.query(query, params);

        // Mettre en cache le résultat si demandé
        if (useCache) {
          const cacheKey = this.getCacheKey(query, params);
          this.saveToCache(cacheKey, result.rows, cacheTTL);
        }

        return result.rows as unknown as T;
      } finally {
        client.release();
      }
    } catch (error) {
      this.logger.error(`Erreur d'exécution de requête SQL: ${error}`);
      throw error;
    }
  }

  /**
   * Génère une clé de cache unique pour une requête et ses paramètres
   */
  private getCacheKey(query: string, params: any[]): string {
    return `${query}_${JSON.stringify(params)}`;
  }

  /**
   * Récupère une valeur du cache si elle existe et n'est pas expirée
   */
  private getFromCache<T>(key: string): T | null {
    const cachedItem = this.queryCache.get(key);

    if (!cachedItem) {
      return null;
    }

    // Vérifier si la valeur en cache a expiré
    const now = Date.now();
    if (now - cachedItem.timestamp > this.CACHE_TTL_MS) {
      this.queryCache.delete(key);
      return null;
    }

    return cachedItem.data as T;
  }

  /**
   * Sauvegarde une valeur dans le cache avec un timestamp
   */
  private saveToCache(
    key: string,
    data: any,
    ttl: number = this.CACHE_TTL_MS,
  ): void {
    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Invalide une entrée spécifique du cache
   */
  invalidateCache(key: string): void {
    this.queryCache.delete(key);
  }

  /**
   * Vide entièrement le cache
   */
  clearCache(): void {
    this.queryCache.clear();
    this.logger.log('Cache vidé');
  }

  async getTableData<T = Record<string, any>>(
    tableName: string,
    limit: number = 10,
  ): Promise<T[]> {
    try {
      const query = `
        SELECT * FROM ${tableName}
        LIMIT $1
      `;
      return await this.executeQuery<T[]>(query, [limit]);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des données de la table ${tableName}: ${error}`,
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
      this.logger.log(
        `Recherche dans ${tableName}.${column} pour le terme "${searchTerm}"`,
      );

      const columnType = await this.getColumnType(tableName, column);
      let query: string;

      // Ajuster la recherche en fonction du type de colonne
      if (columnType && columnType.toLowerCase().includes('text')) {
        query = `
          SELECT * FROM ${tableName}
          WHERE ${column} ILIKE $1
          LIMIT $2
        `;
        return await this.executeQuery<T[]>(query, [`%${searchTerm}%`, limit]);
      } else {
        // Pour les types non-texte, essayer une correspondance exacte convertie en texte
        query = `
          SELECT * FROM ${tableName}
          WHERE ${column}::text = $1
          LIMIT $2
        `;
        return await this.executeQuery<T[]>(query, [searchTerm, limit]);
      }
    } catch (error) {
      this.logger.error(`Erreur lors de la recherche: ${error}`);
      throw error;
    }
  }

  async getRelatedData<T = Record<string, any>>(
    tableName: string,
    id: number,
    relatedTable: string,
  ): Promise<T[]> {
    try {
      this.logger.log(
        `Récupération des données de ${relatedTable} liées à ${tableName} (id: ${id})`,
      );

      // Trouver les relations entre les tables
      const relationships =
        this.dbMetadataService.getTableRelationships(tableName);

      // Filtrer pour trouver la relation spécifique avec la table cible
      const relationship = relationships.find(
        (rel) =>
          rel.targetTable === relatedTable || rel.sourceTable === relatedTable,
      );

      if (!relationship) {
        throw new Error(
          `Aucune relation trouvée entre ${tableName} et ${relatedTable}`,
        );
      }

      let query = '';
      let params: any[] = [];

      if (relationship.sourceColumn && relationship.targetColumn) {
        // Récupérer l'enregistrement de la table principale
        interface MainRecord {
          [key: string]: any;
        }

        const mainRecordQuery = `SELECT * FROM ${tableName} WHERE id = $1`;
        const mainRecordResult = await this.executeQuery<MainRecord[]>(
          mainRecordQuery,
          [id],
        );

        if (!mainRecordResult || mainRecordResult.length === 0) {
          throw new Error(
            `Aucun enregistrement trouvé dans ${tableName} avec id = ${id}`,
          );
        }

        const mainRecord = mainRecordResult;

        // Récupérer les enregistrements liés
        query = `SELECT * FROM ${relatedTable} WHERE ${relationship.targetColumn} = $1`;
        params = [mainRecord[0][relationship.sourceColumn]];
      } else {
        // Si la relation est de type "la table liée a une clé étrangère vers cette table"
        query = `SELECT * FROM ${relatedTable} WHERE ${
          relationship.sourceTable === tableName
            ? relationship.sourceColumn
            : relationship.targetColumn
        } = $1`;
        params = [id];
      }

      return this.executeQuery<T[]>(query, params);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des données liées: ${error}`,
      );
      throw error;
    }
  }

  async getTableCount(tableName: string): Promise<number> {
    try {
      interface CountResult {
        count: string;
      }

      const query = `SELECT COUNT(*) as count FROM ${tableName}`;
      const result = await this.executeQuery<CountResult[]>(query);
      return parseInt(result[0].count, 10);
    } catch (error) {
      this.logger.error(
        `Erreur lors du comptage des lignes dans ${tableName}: ${error}`,
      );
      throw error;
    }
  }

  private async getColumnType(
    tableName: string,
    columnName: string,
  ): Promise<string | null> {
    try {
      const query = `
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = $1
        AND column_name = $2
      `;

      interface ColumnTypeResult {
        data_type: string;
      }

      const result = await this.executeQuery<ColumnTypeResult[]>(query, [
        tableName,
        columnName,
      ]);

      return result.length > 0 ? result[0].data_type : null;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération du type de colonne: ${error}`,
      );
      return null;
    }
  }
}
