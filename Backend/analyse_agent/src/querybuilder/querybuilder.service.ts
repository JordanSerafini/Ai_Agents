import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Injectable()
export class QueryBuilderService implements OnModuleInit {
  private readonly logger = new Logger(QueryBuilderService.name);
  private pool: Pool;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initDatabaseConnection();
  }

  private async initDatabaseConnection() {
    try {
      this.pool = new Pool({
        user: this.configService.get<string>('POSTGRES_USER'),
        host: 'postgres',
        database: this.configService.get<string>('POSTGRES_DB'),
        password: this.configService.get<string>('POSTGRES_PASSWORD'),
        port: parseInt(
          this.configService.get<string>('POSTGRES_PORT') || '5432',
        ),
      });

      // Vérifier la connexion
      const client = await this.pool.connect();
      client.release();
      this.logger.log(
        'Connexion à la base de données PostgreSQL établie avec succès',
      );
    } catch (error) {
      this.logger.error(
        `Erreur de connexion à PostgreSQL: ${error.message}`,
        error.stack,
      );
      // En production, vous pourriez vouloir réessayer la connexion au lieu de lancer une exception
      throw new Error(
        `Impossible de se connecter à la base de données: ${error.message}`,
      );
    }
  }

  /**
   * Exécute une requête SQL et retourne les résultats
   * @param query La requête SQL à exécuter
   * @param params Paramètres optionnels pour la requête
   * @returns Les résultats de la requête
   */
  async executeQuery(
    query: string,
    params: any[] = [],
  ): Promise<{
    rows: any[];
    rowCount: number;
    duration: number;
  }> {
    const client = await this.pool.connect();

    try {
      this.logger.debug(`Exécution de la requête SQL: ${query}`);

      const start = Date.now();
      const result = await client.query(query, params);
      const duration = Date.now() - start;

      this.logger.debug(
        `Requête exécutée en ${duration}ms, ${result.rowCount || 0} lignes retournées`,
      );
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
        duration: duration,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'exécution de la requête: ${error.message}`,
        error.stack,
      );
      throw new Error(`Erreur d'exécution de la requête SQL: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Analyse les erreurs SQL courantes et retourne un message plus convivial
   * @param error L'erreur SQL d'origine
   * @returns Un message d'erreur convivial
   */
  parsePostgresError(error: any): string {
    if (!error) return 'Erreur inconnue';

    // Messages d'erreur courants de PostgreSQL
    if (error.code === '42P01') {
      return `Table non trouvée: ${error.message}`;
    } else if (error.code === '42703') {
      return `Colonne non trouvée: ${error.message}`;
    } else if (error.code === '22P02') {
      return `Erreur de type: ${error.message}`;
    } else if (error.code === '23505') {
      return `Violation de contrainte d'unicité: ${error.message}`;
    } else if (error.code === '23503') {
      return `Violation de contrainte de clé étrangère: ${error.message}`;
    }

    return `Erreur SQL: ${error.message || 'Erreur inconnue'}`;
  }

  /**
   * Vérifie si une requête SQL est sécurisée (protection de base contre les injections SQL)
   * @param query La requête SQL à vérifier
   * @returns true si la requête est sécurisée, false sinon
   */
  isSafeSqlQuery(query: string): boolean {
    const dangerousKeywords = [
      'DROP',
      'DELETE',
      'TRUNCATE',
      'ALTER',
      'CREATE',
      'INSERT',
      'UPDATE',
      'GRANT',
      'REVOKE',
    ];

    // Convertir en majuscules pour la comparaison
    const upperQuery = query.toUpperCase();

    // Vérifier la présence de mots-clés dangereux
    for (const keyword of dangerousKeywords) {
      // Rechercher le mot-clé suivi d'un espace, d'une tabulation ou d'un retour à la ligne
      if (upperQuery.match(new RegExp(`\\b${keyword}\\b`))) {
        this.logger.warn(
          `Requête non sécurisée détectée (contient ${keyword}): ${query}`,
        );
        return false;
      }
    }

    // Vérifier l'utilisation des commentaires (pourraient être utilisés pour des injections)
    if (upperQuery.includes('--') || upperQuery.includes('/*')) {
      this.logger.warn(
        `Requête non sécurisée détectée (contient des commentaires): ${query}`,
      );
      return false;
    }

    return true;
  }
}
