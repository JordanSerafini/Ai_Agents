import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient } from 'pg';

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

    this.logger.log(
      `Connexion à la base de données PostgreSQL sur ${host}:${port}`,
    );

    this.pool = new Pool({
      host,
      port: parseInt(port),
      user,
      password,
      database,
    });
  }

  async executeQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    let client: PoolClient | null = null;
    try {
      client = await this.pool.connect();
      const result = await client.query(sql, params);
      return result.rows as T[];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(
        `Erreur lors de l'exécution de la requête: ${errorMessage}`,
      );
      throw new Error(`Erreur d'exécution SQL: ${errorMessage}`);
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      client.release();
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(
        `Erreur de connexion à la base de données: ${errorMessage}`,
      );
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.pool.end();
      this.logger.log('Connexion à la base de données fermée');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(
        `Erreur lors de la fermeture du pool: ${errorMessage}`,
      );
    }
  }
}
