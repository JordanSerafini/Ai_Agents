import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface EmbeddingResponse {
  embedding: number[];
  original_size?: number;
  warning?: string;
  error?: string;
}

interface ChromaCollection {
  id: string;
  name: string;
  metadata: Record<string, any>;
}

interface ChromaDocument {
  id: string;
  embedding: number[];
  metadata: Record<string, any>;
  document: string;
}

@Injectable()
export class EmbeddingService {
  private modelUrl: string;
  private chromaUrl: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.modelUrl =
      this.configService.get<string>('MODEL_SERVICE_URL') ||
      'http://model_service:3001';
    this.chromaUrl =
      this.configService.get<string>('CHROMA_URL') || 'http://ChromaDB:8000';
    console.log(
      `[EmbeddingService] Configuration: Model URL=${this.modelUrl}, ChromaDB URL=${this.chromaUrl}`,
    );
  }

  async createEmbedding(text: string): Promise<number[]> {
    try {
      console.log(
        `[EmbeddingService] Génération d'embedding pour ${text.length} caractères`,
      );

      const response = await firstValueFrom(
        this.httpService.post(`${this.modelUrl}/embedding`, {
          text,
        }),
      );

      if (response.status !== 200) {
        throw new Error(
          `Échec de la génération d'embedding: ${response.status}`,
        );
      }

      const data = response.data as EmbeddingResponse;

      if (data.error) {
        throw new Error(`Erreur d'embedding: ${data.error}`);
      }

      if (data.warning) {
        console.warn(`[EmbeddingService] Avertissement: ${data.warning}`);
      }

      if (data.original_size) {
        console.log(
          `[EmbeddingService] L'embedding a été redimensionné de ${data.original_size} à ${data.embedding.length}`,
        );
      }

      return data.embedding;
    } catch (error) {
      console.error(
        "[EmbeddingService] Erreur lors de la création de l'embedding:",
        error,
      );
      throw error;
    }
  }

  async listCollections(): Promise<ChromaCollection[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.chromaUrl}/api/v1/collections`),
      );

      return response.data;
    } catch (error) {
      console.error(
        '[EmbeddingService] Erreur lors de la récupération des collections:',
        error,
      );
      throw error;
    }
  }

  async createCollection(
    collectionName: string,
    metadata: Record<string, any> = {},
  ): Promise<ChromaCollection> {
    try {
      console.log(
        `[EmbeddingService] Création de collection: ${collectionName}`,
      );

      const defaultMetadata = {
        description: `Collection pour ${collectionName}`,
        created_at: new Date().toISOString(),
      };

      const fullMetadata = { ...defaultMetadata, ...metadata };

      const response = await firstValueFrom(
        this.httpService.post(`${this.chromaUrl}/api/v1/collections`, {
          name: collectionName,
          metadata: fullMetadata,
        }),
      );

      console.log(`[EmbeddingService] Collection créée: ${collectionName}`);
      return response.data;
    } catch (error) {
      console.error(
        `[EmbeddingService] Erreur lors de la création de la collection ${collectionName}:`,
        error,
      );
      throw error;
    }
  }

  async getCollection(collectionName: string): Promise<ChromaCollection> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.chromaUrl}/api/v1/collections/${collectionName}`,
        ),
      );

      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log(
          `[EmbeddingService] Collection ${collectionName} non trouvée, création...`,
        );
        return this.createCollection(collectionName);
      }
      console.error(
        `[EmbeddingService] Erreur lors de la récupération de la collection ${collectionName}:`,
        error,
      );
      throw error;
    }
  }

  async addDocumentToChroma(
    text: string,
    metadata: Record<string, any> = {},
    id?: string,
    collectionName: string = 'default',
  ): Promise<ChromaDocument> {
    try {
      console.log(
        `[EmbeddingService] Ajout de document à ${collectionName}, ${text.length} caractères`,
      );

      // 1. Récupérer ou créer la collection
      await this.getCollection(collectionName);

      // 2. Générer un embedding pour le document
      const embedding = await this.createEmbedding(text);

      // 3. Préparer les métadonnées
      const enhancedMetadata = {
        ...metadata,
        text_length: text.length,
        embedding_dimension: embedding.length,
        added_at: new Date().toISOString(),
      };

      // 4. Ajouter le document à ChromaDB
      const documentId = id || crypto.randomUUID();

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.chromaUrl}/api/v1/collections/${collectionName}/add`,
          {
            ids: [documentId],
            embeddings: [embedding],
            metadatas: [enhancedMetadata],
            documents: [text],
          },
        ),
      );

      console.log(
        `[EmbeddingService] Document ajouté avec succès, ID: ${documentId}`,
      );

      return {
        id: documentId,
        embedding,
        metadata: enhancedMetadata,
        document: text,
      };
    } catch (error) {
      console.error(
        "[EmbeddingService] Erreur lors de l'ajout du document à ChromaDB:",
        error,
      );
      throw error;
    }
  }

  async queryChromaDB(
    queryText: string,
    collectionName: string = 'default',
    limit: number = 5,
    includeMetadata: boolean = true,
    includeEmbeddings: boolean = false,
  ): Promise<any> {
    try {
      console.log(
        `[EmbeddingService] Recherche dans ${collectionName} pour "${queryText.substring(0, 50)}..."`,
      );

      // 1. Vérifier que la collection existe
      await this.getCollection(collectionName);

      // 2. Générer un embedding pour la requête
      const queryEmbedding = await this.createEmbedding(queryText);

      // 3. Configurer les options d'inclusion
      const include = ['documents', 'distances'];
      if (includeMetadata) include.push('metadatas');
      if (includeEmbeddings) include.push('embeddings');

      // 4. Faire une recherche par similarité dans ChromaDB
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.chromaUrl}/api/v1/collections/${collectionName}/query`,
          {
            query_embeddings: [queryEmbedding],
            n_results: limit,
            include,
          },
        ),
      );

      const results = response.data;
      console.log(
        `[EmbeddingService] ${results.documents[0].length} résultats trouvés`,
      );

      // 5. Reformater les résultats pour une meilleure lisibilité
      return {
        query: queryText,
        collection: collectionName,
        count: results.documents[0].length,
        results: results.documents[0].map((doc, index) => ({
          document: doc,
          distance: results.distances[0][index],
          id: results.ids[0][index],
          metadata: includeMetadata ? results.metadatas[0][index] : undefined,
          embedding: includeEmbeddings
            ? results.embeddings[0][index]
            : undefined,
        })),
      };
    } catch (error) {
      console.error(
        '[EmbeddingService] Erreur lors de la recherche dans ChromaDB:',
        error,
      );
      throw error;
    }
  }
}
