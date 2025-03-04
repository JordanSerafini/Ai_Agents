import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AgentType } from './analyse.service';

// Structure pour stocker un document dans la base de connaissances
interface KnowledgeDocument {
  id: string;
  question: string;
  answer: string;
  agentType: AgentType;
  embedding: number[];
  metadata: {
    timestamp: number;
    category: string;
    tags: string[];
  };
}

// Structure pour stocker les résultats de recherche
interface SearchResult {
  document: KnowledgeDocument;
  score: number;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly openaiApiKey: string;
  private readonly knowledgeBase: Map<string, KnowledgeDocument> = new Map();
  private readonly embeddingDimension = 1536; // Dimension des embeddings d'OpenAI

  constructor(private readonly configService: ConfigService) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
    if (!this.openaiApiKey) {
      this.logger.error('OPENAI_API_KEY non défini dans la configuration');
    }
  }

  /**
   * Ajoute un document à la base de connaissances
   */
  async addDocument(
    question: string,
    answer: string,
    agentType: AgentType,
    category: string = '',
    tags: string[] = [],
  ): Promise<string> {
    try {
      // Générer un embedding pour la question
      const embedding = await this.generateEmbedding(question);

      // Créer un ID unique
      const id = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Créer le document
      const document: KnowledgeDocument = {
        id,
        question,
        answer,
        agentType,
        embedding,
        metadata: {
          timestamp: Date.now(),
          category,
          tags,
        },
      };

      // Ajouter à la base de connaissances
      this.knowledgeBase.set(id, document);

      this.logger.log(`Document ajouté à la base de connaissances: ${id}`);
      return id;
    } catch (error) {
      this.logger.error(`Erreur lors de l'ajout du document: ${error.message}`);
      throw new Error(`Erreur lors de l'ajout du document: ${error.message}`);
    }
  }

  /**
   * Recherche les documents les plus pertinents pour une question donnée
   */
  async searchSimilarDocuments(
    question: string,
    agentType: AgentType,
    limit: number = 3,
  ): Promise<SearchResult[]> {
    try {
      // Générer un embedding pour la question
      const queryEmbedding = await this.generateEmbedding(question);

      // Calculer la similarité avec tous les documents de l'agent spécifié
      const results: SearchResult[] = [];

      for (const document of this.knowledgeBase.values()) {
        // Filtrer par type d'agent
        if (document.agentType !== agentType) {
          continue;
        }

        // Calculer la similarité cosinus
        const similarity = this.cosineSimilarity(
          queryEmbedding,
          document.embedding,
        );

        results.push({
          document,
          score: similarity,
        });
      }

      // Trier par score de similarité (du plus élevé au plus bas)
      results.sort((a, b) => b.score - a.score);

      // Retourner les N documents les plus pertinents
      return results.slice(0, limit);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la recherche de documents: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Génère un embedding pour un texte donné en utilisant l'API OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          input: text,
          model: 'text-embedding-ada-002',
        },
        {
          headers: {
            Authorization: `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data.data[0].embedding;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la génération de l'embedding: ${error.message}`,
      );

      // En cas d'erreur, retourner un embedding aléatoire (pour ne pas bloquer le système)
      return Array(this.embeddingDimension)
        .fill(0)
        .map(() => Math.random() * 2 - 1);
    }
  }

  /**
   * Calcule la similarité cosinus entre deux vecteurs
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Les vecteurs doivent avoir la même dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Supprime un document de la base de connaissances
   */
  deleteDocument(id: string): boolean {
    if (this.knowledgeBase.has(id)) {
      this.knowledgeBase.delete(id);
      this.logger.log(`Document supprimé: ${id}`);
      return true;
    }
    return false;
  }

  /**
   * Retourne tous les documents pour un agent spécifique
   */
  getDocumentsByAgent(agentType: AgentType): KnowledgeDocument[] {
    const documents: KnowledgeDocument[] = [];

    for (const document of this.knowledgeBase.values()) {
      if (document.agentType === agentType) {
        documents.push(document);
      }
    }

    return documents;
  }

  /**
   * Retourne le nombre de documents dans la base de connaissances
   */
  getDocumentCount(): number {
    return this.knowledgeBase.size;
  }
}
