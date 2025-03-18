import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RagService } from '../RAG/rag.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SqlQueriesService implements OnModuleInit {
  private readonly logger = new Logger(SqlQueriesService.name);
  private readonly sqlQueryCacheName = 'sql_queries';

  constructor(private readonly ragService: RagService) {}

  /**
   * Charge toutes les requêtes prédéfinies au démarrage de l'application
   */
  async onModuleInit() {
    try {
      this.logger.log('Initialisation des requêtes SQL prédéfinies...');

      // Vérifier si la collection existe et a déjà des documents
      const existingEntries = await this.checkExistingEntries();
      if (existingEntries > 0) {
        this.logger.log(
          `${existingEntries} requêtes SQL déjà chargées dans ChromaDB, initialisation ignorée`,
        );
        return;
      }

      // Créer le répertoire s'il n'existe pas
      const queryDir = path.join(__dirname, '../../../Database/Query');
      try {
        await fs.mkdir(queryDir, { recursive: true });
        this.logger.log(`Répertoire ${queryDir} créé ou existant`);
      } catch (error) {
        this.logger.error(
          `Erreur lors de la création du répertoire: ${error.message}`,
        );
      }

      // Liste des fichiers à charger
      const files = [
        'projects.query.json',
        'quotations.query.json',
        'invoices.query.json',
        'clients.query.json',
        'planning.query.json',
      ];

      // Essayer de charger chaque fichier, ignorer les erreurs pour les fichiers manquants
      for (const file of files) {
        try {
          await this.loadQueriesFromFile(file);
        } catch (error) {
          this.logger.warn(
            `Fichier ${file} non disponible ou invalide: ${error.message}`,
          );
        }
      }

      this.logger.log('Initialisation des requêtes SQL prédéfinies terminée');
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'initialisation des requêtes SQL: ${error.message}`,
      );
    }
  }

  /**
   * Vérifie si la collection contient déjà des entrées
   */
  private async checkExistingEntries(): Promise<number> {
    try {
      const collection = await this.ragService.getOrCreateCollection(
        this.sqlQueryCacheName,
      );
      const count = await collection.count();
      return count;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la vérification des entrées existantes: ${error.message}`,
      );
      return 0;
    }
  }

  /**
   * Charge les requêtes SQL depuis un fichier JSON
   */
  private async loadQueriesFromFile(filename: string): Promise<void> {
    try {
      const filePath = path.join(
        __dirname,
        '../../../Database/Query',
        filename,
      );
      const fileContent = await fs.readFile(filePath, 'utf8');
      const queryData = JSON.parse(fileContent);

      if (!queryData.queries || !Array.isArray(queryData.queries)) {
        this.logger.warn(
          `Format de fichier ${filename} invalide (pas de tableau 'queries')`,
        );
        return;
      }

      this.logger.log(
        `Chargement de ${queryData.queries.length} requêtes depuis ${filename}`,
      );

      let loadedCount = 0;

      for (const query of queryData.queries) {
        // Vérifier que la requête a un ID, des questions et une requête SQL
        if (!query.id || !query.questions || !query.sql) {
          this.logger.warn(`Requête invalide ignorée dans ${filename}`);
          continue;
        }

        // Pour chaque question associée à cette requête
        for (const question of query.questions) {
          const cacheData = {
            question: question,
            questionReformulated: query.description || question,
            finalQuery: query.sql,
            agent: 'querybuilder',
            id: query.id,
            parameters: query.parameters || [],
          };

          try {
            // Stocker dans ChromaDB
            await this.ragService.upsertDocuments(
              this.sqlQueryCacheName,
              [question],
              [uuidv4()],
              [cacheData],
            );

            loadedCount++;
          } catch (error) {
            this.logger.error(
              `Erreur lors du stockage d'une requête: ${error.message}`,
            );
          }
        }
      }

      this.logger.log(
        `${loadedCount} requêtes depuis ${filename} chargées avec succès`,
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors du chargement du fichier ${filename}: ${error.message}`,
      );
      throw error;
    }
  }
}
