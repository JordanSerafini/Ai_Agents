import {
  Injectable,
  OnModuleInit,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from '../embedding/embedding.service';
import axios from 'axios';

export interface ChromaDocument {
  id: string;
  embedding: number[];
  metadata: Record<string, any>;
  document: string;
}

export interface ChromaCollection {
  name: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class ChromaService implements OnModuleInit {
  private readonly logger = new Logger(ChromaService.name);
  private chromaUrl: string;

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => EmbeddingService))
    private embeddingService: EmbeddingService,
  ) {
    this.chromaUrl =
      this.configService.get<string>('CHROMA_URL') || 'http://ChromaDB:8000';
  }

  onModuleInit() {
    this.logger.log(`Service ChromaDB initialisé avec URL: ${this.chromaUrl}`);
  }

  async addDocument(
    text: string,
    metadata: Record<string, any> = {},
    id?: string,
    collectionName: string = 'default',
  ): Promise<ChromaDocument> {
    try {
      // S'assurer que la collection existe
      await this.createCollectionIfNotExists(collectionName);

      // Obtenir l'embedding pour le document via le service d'embedding
      const embedding = await this.embeddingService.createEmbedding(text);

      // Générer un ID unique si non fourni
      const docId =
        id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Ajouter le document à ChromaDB
      const response = await axios.post(
        `${this.chromaUrl}/api/v1/collections/${collectionName}/add`,
        {
          ids: [docId],
          embeddings: [embedding],
          metadatas: [metadata],
          documents: [text],
        },
      );

      if (response.status !== 200 && response.status !== 201) {
        throw new Error(
          `Erreur lors de l'ajout du document à ChromaDB: ${response.status}`,
        );
      }

      // Construire et retourner le document
      const document: ChromaDocument = {
        id: docId,
        embedding,
        metadata,
        document: text,
      };

      return document;
    } catch (error) {
      this.logger.error(`Erreur lors de l'ajout du document: ${error.message}`);
      throw error;
    }
  }

  async queryCollection(
    queryText: string,
    collectionName: string = 'default',
    limit: number = 5,
  ): Promise<{ documents: ChromaDocument[]; distances: number[] }> {
    try {
      // Vérifier si la collection existe
      const collections = await this.listCollections();
      const collectionExists = collections.some(
        (col) => col.name === collectionName,
      );

      if (!collectionExists) {
        return { documents: [], distances: [] };
      }

      // Obtenir l'embedding pour la requête
      const queryEmbedding =
        await this.embeddingService.createEmbedding(queryText);

      // Requête de similarité à ChromaDB
      const response = await axios.post(
        `${this.chromaUrl}/api/v1/collections/${collectionName}/query`,
        {
          query_embeddings: [queryEmbedding],
          n_results: limit,
          include: ['documents', 'metadatas', 'distances', 'embeddings'],
        },
      );

      if (response.status !== 200) {
        throw new Error(
          `Erreur lors de la requête à ChromaDB: ${response.status}`,
        );
      }

      // Extraire les résultats
      const results = response.data;
      const documents: ChromaDocument[] = [];

      if (
        results &&
        results.ids &&
        results.ids.length > 0 &&
        results.ids[0].length > 0
      ) {
        for (let i = 0; i < results.ids[0].length; i++) {
          documents.push({
            id: results.ids[0][i],
            embedding: results.embeddings[0][i],
            metadata: results.metadatas[0][i],
            document: results.documents[0][i],
          });
        }
      }

      return {
        documents,
        distances: results.distances ? results.distances[0] : [],
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la requête de collection: ${error.message}`,
      );
      return { documents: [], distances: [] };
    }
  }

  async getCollection(
    collectionName: string = 'default',
  ): Promise<ChromaCollection> {
    try {
      const response = await axios.get(
        `${this.chromaUrl}/api/v1/collections/${collectionName}`,
      );

      if (response.status !== 200) {
        throw new Error(
          `Erreur lors de la récupération de la collection: ${response.status}`,
        );
      }

      return {
        name: response.data.name,
        metadata: response.data.metadata,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération de la collection: ${error.message}`,
      );
      throw error;
    }
  }

  async listCollections(): Promise<ChromaCollection[]> {
    try {
      const response = await axios.get(`${this.chromaUrl}/api/v1/collections`);

      if (response.status !== 200) {
        throw new Error(
          `Erreur lors de la récupération des collections: ${response.status}`,
        );
      }

      return response.data.map((collection) => ({
        name: collection.name,
        metadata: collection.metadata,
      }));
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des collections: ${error.message}`,
      );
      return [];
    }
  }

  async createCollection(collectionName: string): Promise<ChromaCollection> {
    try {
      // Vérifier si la collection existe déjà
      const collections = await this.listCollections();
      if (collections.some((col) => col.name === collectionName)) {
        return await this.getCollection(collectionName);
      }

      // Créer la collection
      const response = await axios.post(
        `${this.chromaUrl}/api/v1/collections`,
        {
          name: collectionName,
          metadata: {
            description: `Collection ${collectionName} pour stockage de documents`,
            created_at: new Date().toISOString(),
          },
        },
      );

      if (response.status !== 200 && response.status !== 201) {
        throw new Error(
          `Erreur lors de la création de la collection: ${response.status}`,
        );
      }

      return {
        name: response.data.name,
        metadata: response.data.metadata,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la création de la collection: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Initialise les collections nécessaires pour l'application
   */
  async initializeDefaultCollections(): Promise<void> {
    try {
      // Créer la collection par défaut si elle n'existe pas
      await this.createCollectionIfNotExists('default');

      // Créer la collection spécifique pour les questions-réponses
      await this.createCollectionIfNotExists('questions');

      this.logger.log('Collections par défaut initialisées avec succès');
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'initialisation des collections: ${error.message}`,
      );
    }
  }

  private async createCollectionIfNotExists(
    collectionName: string,
  ): Promise<void> {
    try {
      await this.createCollection(collectionName);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la création automatique de la collection: ${error.message}`,
      );
    }
  }
}
