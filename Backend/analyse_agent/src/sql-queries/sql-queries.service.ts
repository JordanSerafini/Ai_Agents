import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RagService } from '../RAG/rag.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as fsSync from 'fs';

@Injectable()
export class SqlQueriesService implements OnModuleInit {
  private readonly logger = new Logger(SqlQueriesService.name);
  private readonly sqlQueryCacheName = 'sql_queries';
  private readonly markerFilePath = '/data/sql_queries_initialized.marker';

  constructor(private readonly ragService: RagService) {}

  /**
   * Charge toutes les requêtes prédéfinies au démarrage de l'application
   */
  async onModuleInit() {
    try {
      this.logger.log('Initialisation des requêtes SQL prédéfinies...');

      // Vérifier d'abord si le fichier marqueur existe
      try {
        if (fsSync.existsSync(this.markerFilePath)) {
          this.logger.log(
            `Fichier marqueur trouvé à ${this.markerFilePath}, on considère que l'initialisation a déjà été faite`,
          );
          return;
        } else {
          this.logger.log(`Aucun fichier marqueur trouvé à ${this.markerFilePath}, vérification du compteur ChromaDB`);
        }
      } catch (fsError) {
        this.logger.warn(
          `Erreur lors de la vérification du fichier marqueur: ${fsError.message}, poursuite avec la vérification du compteur`,
        );
      }

      // Vérifier si la collection existe et a déjà des documents
      const existingEntries = await this.checkExistingEntries();
      if (existingEntries > 0) {
        this.logger.log(
          `${existingEntries} requêtes SQL déjà chargées dans ChromaDB, initialisation ignorée`,
        );
        // Créer le fichier marqueur puisque des entrées existent
        try {
          await this.createMarkerFile();
        } catch (markerError) {
          this.logger.warn(
            `Impossible de créer le fichier marqueur: ${markerError.message}, ce n'est pas bloquant mais l'initialisation pourrait se reproduire au prochain redémarrage`,
          );
        }
        return;
      }

      // Créer le répertoire s'il n'existe pas
      const queryDir = path.join(process.cwd(), 'Database', 'Query');
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

      for (const file of files) {
        try {
          await this.loadQueriesFromFile(file);
        } catch (error) {
          this.logger.warn(
            `Fichier ${file} non disponible ou invalide: ${error.message}`,
          );
        }
      }

      // Créer le fichier marqueur après le chargement réussi
      try {
        await this.createMarkerFile();
      } catch (markerError) {
        this.logger.warn(
          `Impossible de créer le fichier marqueur: ${markerError.message}, ce n'est pas bloquant mais l'initialisation pourrait se reproduire au prochain redémarrage`,
        );
      }

      this.logger.log('Initialisation des requêtes SQL prédéfinies terminée');
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'initialisation des requêtes SQL: ${error.message}`,
      );
    }
  }

  /**
   * Crée un fichier marqueur indiquant que l'initialisation a été effectuée
   */
  private async createMarkerFile(): Promise<void> {
    try {
      // Vérifier si le répertoire parent existe
      const dir = path.dirname(this.markerFilePath);
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (mkdirError) {
        this.logger.warn(`Impossible de créer le répertoire parent: ${mkdirError.message}`);
      }

      // Écrire le fichier marqueur avec la date actuelle
      await fs.writeFile(
        this.markerFilePath,
        JSON.stringify({
          initialized: true,
          timestamp: new Date().toISOString(),
          queries: this.sqlQueryCacheName,
        }),
      );
      this.logger.log(`Fichier marqueur créé avec succès à ${this.markerFilePath}`);
    } catch (error) {
      this.logger.error(`Erreur lors de la création du fichier marqueur: ${error.message}`);
      throw error;
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
      const filePath = path.join(process.cwd(), 'Database', 'Query', filename);
      this.logger.log(`Tentative de chargement du fichier: ${filePath}`);

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

          // Utiliser l'ID de la requête pour créer un ID déterministe pour ChromaDB
          // Cela aidera à éviter les doublons lors des rechargements
          const documentId = `${query.id}_${this.createHash(question)}`;

          try {
            // Stocker dans ChromaDB avec l'ID déterministe
            await this.ragService.upsertDocuments(
              this.sqlQueryCacheName,
              [question],
              [documentId],
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

  /**
   * Crée un hash à partir d'une chaîne de caractères
   * Utilisé pour générer des IDs déterministes
   */
  private createHash(text: string): string {
    // Simple hash function pour générer un identifiant déterministe
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }
}
