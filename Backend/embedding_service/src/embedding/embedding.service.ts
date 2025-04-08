import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ChromaService,
  ChromaDocument,
  ChromaCollection,
} from '../chroma/chroma.service';
import axios from 'axios';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private modelUrl: string;
  private chromaUrl: string;

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => ChromaService))
    private chromaService: ChromaService,
  ) {
    this.modelUrl =
      this.configService.get<string>('MODEL_URL') ||
      'http://model_service:3001';
    this.chromaUrl =
      this.configService.get<string>('CHROMA_URL') || 'http://ChromaDB:8000';

    this.logger.log(
      `[EmbeddingService] Configuration: Model URL=${this.modelUrl}, ChromaDB URL=${this.chromaUrl}`,
    );
  }

  /**
   * Crée un embedding pour un texte donné en utilisant le service de modèle
   */
  async createEmbedding(text: string): Promise<number[]> {
    try {
      // Faire une requête au service de modèle pour obtenir l'embedding
      const response = await axios.post(`${this.modelUrl}/embedding`, {
        text,
      });

      if (response.status !== 200) {
        throw new Error(`Erreur du service de modèle: ${response.status}`);
      }

      return response.data.embedding;
    } catch (error) {
      this.logger.error(
        `[EmbeddingService] Erreur lors de la création de l'embedding: ${error.message}`,
      );
      throw new Error(
        `Erreur lors de la création de l'embedding: ${error.message}`,
      );
    }
  }

  /**
   * Ajoute un document avec son embedding à une collection ChromaDB
   */
  async addDocument(
    content: string,
    metadata: Record<string, any> = {},
    id?: string,
    collectionName: string = 'default',
  ): Promise<ChromaDocument> {
    try {
      // 1. Vérifier que la collection existe ou la créer
      await this.createCollectionIfNotExists(collectionName);

      // 2. Ajouter des métadonnées supplémentaires
      const enrichedMetadata = {
        ...metadata,
        timestamp: new Date().toISOString(),
      };

      // 3. Ajouter le document à ChromaDB (le service s'occupera de générer l'embedding)
      return this.chromaService.addDocument(
        content,
        enrichedMetadata,
        id,
        collectionName,
      );
    } catch (error) {
      this.logger.error(
        "[EmbeddingService] Erreur lors de l'ajout du document à ChromaDB:",
        error,
      );
      throw error;
    }
  }

  /**
   * Recherche les documents similaires dans ChromaDB en utilisant un embedding
   */
  async queryChromaDB(
    query: string,
    collectionName: string = 'default',
    limit: number = 5,
  ) {
    try {
      // 1. Vérifier que la collection existe
      const collections = await this.listCollections();
      const collectionExists = collections.some(
        (col) => col.name === collectionName,
      );

      if (!collectionExists) {
        this.logger.warn(`Collection "${collectionName}" non trouvée`);
        return {
          documents: [],
          distances: [],
        };
      }

      // 2. Rechercher directement dans ChromaDB (le service s'occupera de générer l'embedding)
      return this.chromaService.queryCollection(query, collectionName, limit);
    } catch (error) {
      this.logger.error(
        '[EmbeddingService] Erreur lors de la recherche dans ChromaDB:',
        error,
      );
      return {
        documents: [],
        distances: [],
      };
    }
  }

  /**
   * Récupère les informations d'une collection ChromaDB
   */
  async getCollection(name: string): Promise<ChromaCollection> {
    return this.chromaService.getCollection(name);
  }

  /**
   * Récupère la liste des collections dans ChromaDB
   */
  async listCollections(): Promise<ChromaCollection[]> {
    return this.chromaService.listCollections();
  }

  /**
   * Crée une nouvelle collection dans ChromaDB
   */
  async createCollection(name: string): Promise<ChromaCollection> {
    return this.chromaService.createCollection(name);
  }

  /**
   * Crée une collection si elle n'existe pas déjà
   */
  private async createCollectionIfNotExists(name: string): Promise<void> {
    try {
      await this.createCollection(name);
    } catch (error) {
      // Ignorer l'erreur si la collection existe déjà
      this.logger.debug(
        `Collection "${name}" existe déjà ou erreur: ${error.message}`,
      );
    }
  }
}
