import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    this.pool = new Pool({
      host: this.configService.get<string>('PG_HOST', 'localhost'),
      port: parseInt(this.configService.get<string>('PG_PORT', '5432')),
      user: this.configService.get<string>('PG_USERNAME', 'postgres'),
      password: this.configService.get<string>('PG_PASSWORD', 'postgres'),
      database: this.configService.get<string>('PG_DATABASE', 'postgres'),
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
