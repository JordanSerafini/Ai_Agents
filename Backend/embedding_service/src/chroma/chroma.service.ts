import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from '../embedding/embedding.service';

interface ChromaDocument {
  id: string;
  embedding: number[];
  metadata: Record<string, any>;
  document: string;
}

@Injectable()
export class ChromaService implements OnModuleInit {
  private collections: Map<string, ChromaDocument[]> = new Map();

  constructor(
    private configService: ConfigService,
    private embeddingService: EmbeddingService,
  ) {}

  async onModuleInit() {
    // Initialisation de ChromaDB
    // Note: Dans une implémentation réelle, on connecterait à une instance ChromaDB
    console.log('Service ChromaDB initialisé');

    // Créer une collection par défaut
    this.collections.set('default', []);
  }

  async addDocument(
    text: string,
    metadata: Record<string, any> = {},
    id?: string,
    collectionName: string = 'default',
  ): Promise<ChromaDocument> {
    // Obtenir l'embedding pour le document via le service d'embedding
    const embedding = await this.embeddingService.createEmbedding(text);

    // Créer le document ChromaDB
    const document: ChromaDocument = {
      id: id || crypto.randomUUID(),
      embedding,
      metadata,
      document: text,
    };

    // S'assurer que la collection existe
    if (!this.collections.has(collectionName)) {
      this.collections.set(collectionName, []);
    }

    // Ajouter le document à la collection
    this.collections.get(collectionName).push(document);

    return document;
  }

  async queryCollection(
    queryText: string,
    collectionName: string = 'default',
    limit: number = 5,
  ): Promise<{ documents: ChromaDocument[]; distances: number[] }> {
    // Récupérer la collection
    const collection = this.collections.get(collectionName) || [];

    if (collection.length === 0) {
      return { documents: [], distances: [] };
    }

    // Obtenir l'embedding pour la requête
    const queryEmbedding =
      await this.embeddingService.createEmbedding(queryText);

    // Calculer les distances pour chaque document
    const documentsWithDistance = collection.map((doc) => {
      const distance = this.cosineSimilarity(queryEmbedding, doc.embedding);
      return { document: doc, distance };
    });

    // Trier par similarité (plus grand cosinus = plus similaire)
    documentsWithDistance.sort((a, b) => b.distance - a.distance);

    // Retourner les documents les plus similaires et leurs distances
    const topDocuments = documentsWithDistance.slice(0, limit);

    return {
      documents: topDocuments.map((d) => d.document),
      distances: topDocuments.map((d) => d.distance),
    };
  }

  async getCollection(
    collectionName: string = 'default',
  ): Promise<ChromaDocument[]> {
    return this.collections.get(collectionName) || [];
  }

  async createCollection(collectionName: string): Promise<void> {
    if (!this.collections.has(collectionName)) {
      this.collections.set(collectionName, []);
    }
  }

  // Utilitaire: similarité cosinus entre deux vecteurs
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Les vecteurs doivent avoir la même dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
