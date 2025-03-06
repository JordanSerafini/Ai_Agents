import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('PG_HOST');
    const port = this.configService.get<string>('PG_PORT');
    const user = this.configService.get<string>('PG_USERNAME');
    const password = this.configService.get<string>('PG_PASSWORD');
    const database = this.configService.get<string>('PG_DATABASE');

    if (!host || !port || !user || !password || !database) {
      this.logger.error('Configuration de la base de données manquante');
      throw new Error('Configuration de la base de données incomplète');
    }

    this.logger.log(`Connexion à la base de données PostgreSQL sur ${host}:${port}`);

    this.pool = new Pool({
      host,
      port: parseInt(port),
      user,
      password,
      database,
    });
  }

  async executeQuery<T>(sql: string, params: any[] = []): Promise<T[]> {
    this.logger.log(`Exécution de la requête SQL: ${sql}`);
    this.logger.debug(`Paramètres: ${JSON.stringify(params)}`);

    try {
      const startTime = Date.now();
      const result = await this.pool.query(sql, params);
      const executionTime = Date.now() - startTime;

      this.logger.log(
        `Requête exécutée en ${executionTime}ms, ${result.rowCount} lignes retournées`,
      );

      return result.rows as T[];
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'exécution de la requête: ${error.message}`,
      );
      throw new Error(`Erreur d'exécution SQL: ${error.message}`);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      client.release();
      return true;
    } catch (error) {
      this.logger.error(
        `Erreur de connexion à la base de données: ${error.message}`,
      );
      return false;
    }
  }
}
