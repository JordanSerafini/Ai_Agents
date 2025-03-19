import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { RagService } from '../RAG/rag.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as fsSync from 'fs';

@Injectable()
export class SqlQueriesService implements OnModuleInit {
  private readonly logger = new Logger(SqlQueriesService.name);
  private readonly sqlQueryCacheName = 'sql_queries';
  private readonly markerFilePath =
    '/app/data/persistence/sql_queries_initialized.marker';
  private readonly loadedQueriesMetaPath =
    '/app/data/persistence/loaded_queries.json';

  constructor(
    @Inject(forwardRef(() => RagService))
    private readonly ragService: RagService,
  ) {}

  /**
   * Charge toutes les requêtes prédéfinies au démarrage de l'application
   */
  async onModuleInit() {
    try {
      this.logger.log('Initialisation des requêtes SQL prédéfinies...');

      // Liste des fichiers à charger
      const files = [
        'projects.query.json',
        'quotations.query.json',
        'invoices.query.json',
        'clients.query.json',
        'planning.query.json',
      ];

      // Vérifier si ChromaDB a déjà des entrées
      const existingEntries = await this.checkExistingEntries();
      this.logger.log(`${existingEntries} requêtes SQL trouvées dans ChromaDB`);

      // Charger les métadonnées des fichiers déjà traités si elles existent
      const loadedFilesMeta = await this.loadFileMetadata();

      // Parcourir tous les fichiers de requêtes
      let newQueriesAdded = false;
      for (const file of files) {
        try {
          // Vérifier si le fichier a été modifié depuis le dernier chargement
          const filePath = path.join(process.cwd(), 'Database', 'Query', file);
          const stats = await fs.stat(filePath);
          const lastModified = stats.mtime.getTime();

          // Si le fichier n'a jamais été chargé ou a été modifié depuis le dernier chargement
          if (
            !loadedFilesMeta[file] ||
            loadedFilesMeta[file].lastModified < lastModified
          ) {
            this.logger.log(
              `Chargement/mise à jour des requêtes depuis ${file} (modifié depuis la dernière fois)`,
            );
            const addedCount = await this.loadQueriesFromFile(file);

            // Mettre à jour les métadonnées pour ce fichier
            loadedFilesMeta[file] = {
              lastModified: lastModified,
              lastLoaded: Date.now(),
              queriesCount: addedCount,
            };

            newQueriesAdded = true;
          } else {
            this.logger.log(
              `Fichier ${file} inchangé depuis le dernier chargement, ignoré`,
            );
          }
        } catch (error) {
          this.logger.warn(
            `Fichier ${file} non disponible ou invalide: ${error.message}`,
          );
        }
      }

      // Sauvegarder les métadonnées mises à jour
      if (newQueriesAdded) {
        await this.saveFileMetadata(loadedFilesMeta);
      }

      // Créer le fichier marqueur si nécessaire
      if (!fsSync.existsSync(this.markerFilePath)) {
        try {
          await this.createMarkerFile();
        } catch (markerError) {
          this.logger.warn(
            `Impossible de créer le fichier marqueur: ${markerError.message}, ce n'est pas bloquant`,
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
   * Charge les métadonnées des fichiers déjà traités
   */
  private async loadFileMetadata(): Promise<Record<string, any>> {
    try {
      if (fsSync.existsSync(this.loadedQueriesMetaPath)) {
        const content = await fs.readFile(this.loadedQueriesMetaPath, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      this.logger.warn(
        `Erreur lors du chargement des métadonnées: ${error.message}`,
      );
    }
    return {};
  }

  /**
   * Sauvegarde les métadonnées des fichiers traités
   */
  private async saveFileMetadata(metadata: Record<string, any>): Promise<void> {
    try {
      const dir = path.dirname(this.loadedQueriesMetaPath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(
        this.loadedQueriesMetaPath,
        JSON.stringify(metadata, null, 2),
      );
      this.logger.log(`Métadonnées des fichiers sauvegardées avec succès`);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la sauvegarde des métadonnées: ${error.message}`,
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
        this.logger.warn(
          `Impossible de créer le répertoire parent: ${mkdirError.message}`,
        );
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
      this.logger.log(
        `Fichier marqueur créé avec succès à ${this.markerFilePath}`,
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors de la création du fichier marqueur: ${error.message}`,
      );
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
   * @returns Le nombre de requêtes chargées
   */
  private async loadQueriesFromFile(filename: string): Promise<number> {
    try {
      const filePath = path.join(process.cwd(), 'Database', 'Query', filename);
      this.logger.log(`Tentative de chargement du fichier: ${filePath}`);

      const fileContent = await fs.readFile(filePath, 'utf8');
      const queryData = JSON.parse(fileContent);

      if (!queryData.queries || !Array.isArray(queryData.queries)) {
        this.logger.warn(
          `Format de fichier ${filename} invalide (pas de tableau 'queries')`,
        );
        return 0;
      }

      this.logger.log(
        `Chargement de ${queryData.queries.length} requêtes depuis ${filename}`,
      );

      let loadedCount = 0;

      // Récupérer les IDs existants pour éviter de recharger les requêtes inchangées
      const collection = await this.ragService.getOrCreateCollection(
        this.sqlQueryCacheName,
      );
      let existingIds: string[] = [];
      try {
        const existingEntries = await collection.get();
        existingIds = existingEntries.ids || [];
      } catch (error) {
        this.logger.warn(
          `Impossible de récupérer les IDs existants: ${error.message}`,
        );
      }

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
          const documentId = `${query.id}_${this.createHash(question)}`;

          // Vérifier si cette entrée existe déjà
          if (existingIds.includes(documentId)) {
            // La requête existe déjà, vérifier si elle a changé
            // Pour simplifier, nous supposerons que si l'ID existe, la requête est déjà à jour
            continue;
          }

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
        `${loadedCount} nouvelles requêtes depuis ${filename} chargées avec succès`,
      );
      return loadedCount;
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

  // Ajouter cette méthode au service ChromaDB ou SQL Queries
  async getAllQueries(): Promise<any[]> {
    try {
      // Récupérer toutes les requêtes de ChromaDB
      const collection = await this.ragService.getOrCreateCollection(
        this.sqlQueryCacheName,
      );
      const response = await collection.get();

      if (!response || !response.metadatas || response.metadatas.length === 0) {
        return [];
      }

      // Formatter les résultats pour qu'ils soient plus faciles à utiliser
      const queries = response.metadatas.map((metadata, index) => {
        return {
          id: response.ids ? response.ids[index] : undefined,
          metadata: metadata,
          document: response.documents ? response.documents[index] : undefined,
          embedding: response.embeddings
            ? response.embeddings[index]
            : undefined,
        };
      });

      return queries;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des requêtes: ${error.message}`,
      );
      return [];
    }
  }
}
