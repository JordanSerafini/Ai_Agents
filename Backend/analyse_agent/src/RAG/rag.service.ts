import { Injectable, Logger } from '@nestjs/common';
import { ChromaClient } from 'chromadb';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RagService {
  private client: ChromaClient;
  private readonly logger = new Logger(RagService.name);
  private readonly collections = new Map();

  constructor(private configService: ConfigService) {
    this.client = new ChromaClient({
      path:
        this.configService.get<string>('CHROMA_URL') || 'http://localhost:8000',
    });
    this.logger.log('Service RAG initialisé');
  }

  // Méthode pour obtenir une collection (avec mise en cache)
  private async getCollection(name: string) {
    if (this.collections.has(name)) {
      return this.collections.get(name);
    }

    try {
      const collection = await this.client.getOrCreateCollection({
        name,
      });

      this.collections.set(name, collection);
      return collection;
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'accès à la collection: ${error.message}`,
      );
      throw error;
    }
  }

  async createCollection(name: string) {
    try {
      const collection = await this.client.createCollection({
        name,
      });

      this.collections.set(name, collection);
      return collection;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la création de la collection: ${error.message}`,
      );
      throw error;
    }
  }

  async getOrCreateCollection(name: string) {
    return this.getCollection(name);
  }

  async addDocuments(collectionName: string, documents: string[]) {
    try {
      const collection = await this.getCollection(collectionName);

      const ids = documents.map(() => uuidv4());

      await collection.add({
        documents,
        ids,
      });

      return { success: true, count: documents.length, ids };
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'ajout de documents: ${error.message}`,
      );
      throw error;
    }
  }

  async upsertDocuments(
    collectionName: string,
    documents: string[],
    ids?: string[],
    metadatas?: Record<string, any>[],
  ) {
    try {
      const collection = await this.getCollection(collectionName);

      const documentIds = ids || documents.map(() => uuidv4());

      await collection.upsert({
        documents,
        ids: documentIds,
        metadatas,
      });

      return {
        success: true,
        count: documents.length,
        ids: documentIds,
        metadatas,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la mise à jour de documents: ${error.message}`,
      );
      throw error;
    }
  }

  async findSimilarDocuments(
    collectionName: string,
    query: string,
    limit: number = 10,
  ) {
    try {
      const collection = await this.getCollection(collectionName);

      return await collection.query({
        queryTexts: [query],
        nResults: limit,
      });
    } catch (error) {
      this.logger.error(
        `Erreur lors de la recherche de documents similaires: ${error.message}`,
      );
      throw error;
    }
  }

  async findSimilarPrompt(
    collectionName: string,
    prompt: string,
    similarityThreshold: number = 0.85,
  ) {
    try {
      // Créer la collection si elle n'existe pas déjà
      await this.getCollection(collectionName);

      try {
        const results = await this.findSimilarDocuments(
          collectionName,
          prompt,
          1,
        );

        if (
          results.distances &&
          results.distances[0] &&
          results.distances[0][0] &&
          1 - results.distances[0][0] >= similarityThreshold
        ) {
          return {
            found: true,
            prompt: results.documents?.[0]?.[0],
            id: results.ids?.[0]?.[0],
            similarity: 1 - results.distances[0][0],
            metadata: results.metadatas?.[0]?.[0],
          };
        }
      } catch (queryError) {
        // Si la recherche échoue (par exemple, collection vide), simplement continuer
        this.logger.warn(`Recherche similaire échouée: ${queryError.message}`);
      }

      return { found: false };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la recherche de prompt similaire: ${error.message}`,
      );
      return { found: false, error: error.message };
    }
  }

  async deleteOldDocuments(collectionName: string, olderThanDays: number = 30) {
    try {
      const collection = await this.getCollection(collectionName);

      // Calculer la date limite
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      const cutoffTimestamp = cutoffDate.toISOString();

      // Récupérer tous les documents avec leurs métadonnées
      const allDocs = await collection.get();

      // Filtrer les IDs à supprimer
      const idsToDelete: string[] = [];

      if (allDocs.ids && allDocs.metadatas) {
        for (let i = 0; i < allDocs.ids.length; i++) {
          const metadata = allDocs.metadatas[i];
          // Vérifier si ce document a un timestamp et s'il est plus ancien que la date limite
          if (
            metadata &&
            metadata.timestamp &&
            metadata.timestamp < cutoffTimestamp
          ) {
            idsToDelete.push(allDocs.ids[i]);
          }
        }
      }

      // Supprimer les documents si nécessaire
      if (idsToDelete.length > 0) {
        await collection.delete({
          ids: idsToDelete,
        });
        this.logger.log(
          `${idsToDelete.length} documents supprimés car plus anciens que ${olderThanDays} jours`,
        );
      }

      return {
        success: true,
        deletedCount: idsToDelete.length,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la suppression des anciens documents: ${error.message}`,
      );
      throw error;
    }
  }
}
