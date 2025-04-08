import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

interface Document {
  id: string;
  document: string;
  metadata: Record<string, any>;
}

@Injectable()
export class RagService {
  private readonly embeddingServiceUrl: string;
  private readonly modelServiceUrl: string;
  private readonly similarityThreshold: number = 0.85; // Seuil de similarité pour considérer une question comme similaire

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.embeddingServiceUrl =
      this.configService.get<string>('EMBEDDING_SERVICE_URL') ||
      'http://localhost:3002';
    this.modelServiceUrl =
      this.configService.get<string>('MODEL_SERVICE_URL') ||
      'http://localhost:3001';

    // Configurer le seuil de similarité depuis les variables d'environnement
    const configThreshold = this.configService.get<number>(
      'SIMILARITY_THRESHOLD',
    );
    if (configThreshold && !isNaN(configThreshold)) {
      this.similarityThreshold = configThreshold;
    }
  }

  /**
   * Vérifie si une question similaire existe déjà dans la base de connaissances
   * @param query Question de l'utilisateur
   * @returns La question similaire et sa réponse si elle existe, null sinon
   */
  async findSimilarQuestion(
    query: string,
  ): Promise<{ question: string; answer: string; similarity: number } | null> {
    try {
      console.log(`[RAG] Recherche de questions similaires pour: "${query}"`);

      // Récupérer les questions déjà posées depuis une collection spécifique de questions-réponses
      const response = await firstValueFrom(
        this.httpService.post(`${this.embeddingServiceUrl}/chroma/query`, {
          text: query,
          limit: 5,
          collection_name: 'questions', // Collection spécifique pour les questions-réponses
        }),
      );

      const documents = response.data.documents || [];
      console.log(
        `[RAG] ${documents.length} documents trouvés dans la collection 'questions'`,
      );

      // Vérifier si l'un des documents a une similarité supérieure au seuil
      for (const doc of documents) {
        // La distance est convertie en similarité (1 - distance)
        const similarity = 1 - doc.metadata.distance;
        console.log(
          `[RAG] Question trouvée: "${doc.document}" (similarité: ${similarity.toFixed(2)})`,
        );

        if (
          similarity >= this.similarityThreshold &&
          doc.metadata.type === 'question'
        ) {
          console.log(
            `[RAG] Question similaire trouvée: "${doc.document}" (similarité: ${similarity.toFixed(2)})`,
          );
          return {
            question: doc.document,
            answer: doc.metadata.answer || 'Pas de réponse enregistrée',
            similarity,
          };
        }
      }

      console.log(
        `[RAG] Aucune question similaire trouvée avec un seuil de ${this.similarityThreshold}`,
      );
      return null;
    } catch (error) {
      console.error(
        'Erreur lors de la recherche de questions similaires:',
        error,
      );
      return null;
    }
  }

  /**
   * Stocke une question et sa réponse pour référence future
   * @param question Question de l'utilisateur
   * @param answer Réponse générée
   */
  async storeQuestionAnswer(question: string, answer: string): Promise<void> {
    try {
      await this.storeDocument(question, {
        type: 'question',
        answer,
        timestamp: new Date().toISOString(),
        collection_name: 'questions',
      });
    } catch (error) {
      console.error(
        'Erreur lors du stockage de la paire question-réponse:',
        error,
      );
    }
  }

  async storeDocument(
    text: string,
    metadata: Record<string, any> = {},
  ): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.embeddingServiceUrl}/chroma/document`, {
          text,
          metadata,
        }),
      );
      return response.data;
    } catch (error) {
      console.error('Erreur lors du stockage du document:', error);
      throw error;
    }
  }

  async retrieveDocuments(
    query: string,
    limit: number = 5,
  ): Promise<Document[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.embeddingServiceUrl}/chroma/query`, {
          text: query,
          limit,
        }),
      );
      return response.data.documents;
    } catch (error) {
      console.error('Erreur lors de la récupération des documents:', error);
      throw error;
    }
  }

  /**
   * Génère une réponse à une question de l'utilisateur, en vérifiant d'abord si une question similaire existe
   */
  async generateResponse(
    query: string,
    includeContext: boolean = true,
  ): Promise<string> {
    try {
      // 1. Vérifier si une question similaire existe déjà
      const similarQuestion = await this.findSimilarQuestion(query);

      if (similarQuestion) {
        console.log(
          `Question similaire trouvée (${similarQuestion.similarity.toFixed(2)}): ${similarQuestion.question}`,
        );
        return similarQuestion.answer;
      }

      // 2. Si aucune question similaire n'est trouvée, continuer avec le processus RAG standard
      let context = '';

      if (includeContext) {
        const documents = await this.retrieveDocuments(query);

        if (documents.length > 0) {
          context =
            'Contexte:\n' + documents.map((doc) => doc.document).join('\n\n');
        }
      }

      // 3. Préparer la requête pour le modèle avec ou sans contexte
      let prompt = '';

      if (context) {
        prompt = `${context}\n\nEn te basant sur les informations du contexte ci-dessus, réponds à la question suivante:\n${query}`;
      } else {
        prompt = query;
      }

      // 4. Envoyer la requête au service de modèle
      const response = await firstValueFrom(
        this.httpService.post(`${this.modelServiceUrl}/v1/chat/completions`, {
          messages: [{ role: 'user', content: prompt }],
          max_tokens: -1,
          temperature: 0.2,
        }),
      );

      // 5. Récupérer la réponse générée
      let answer = "Je n'ai pas pu générer de réponse.";

      if (response.data.choices && response.data.choices.length > 0) {
        answer = response.data.choices[0].message.content;
      }

      // 6. Stocker la question et la réponse pour référence future
      await this.storeQuestionAnswer(query, answer);

      return answer;
    } catch (error) {
      console.error('Erreur lors de la génération de la réponse:', error);
      throw error;
    }
  }

  /**
   * Trouve plusieurs questions similaires dans la base de connaissances
   * @param query Question de l'utilisateur
   * @param limit Nombre maximum de questions à retourner
   * @param threshold Seuil de similarité minimum (0-1)
   * @returns Liste de questions similaires avec leurs réponses et scores de similarité
   */
  async findMultipleSimilarQuestions(
    query: string,
    limit: number = 5,
    threshold: number = 0.5,
  ): Promise<{
    questions: { question: string; answer: string; similarity: number }[];
  }> {
    try {
      console.log(
        `[RAG] Recherche de ${limit} questions similaires pour: "${query}" (seuil: ${threshold})`,
      );

      // Récupérer les questions déjà posées depuis la collection spécifique
      const response = await firstValueFrom(
        this.httpService.post(`${this.embeddingServiceUrl}/chroma/query`, {
          text: query,
          limit: Math.max(limit, 10), // Demander plus de résultats pour filtrer ensuite
          collection_name: 'questions',
        }),
      );

      const documents = response.data.documents || [];
      console.log(
        `[RAG] ${documents.length} documents trouvés dans la collection 'questions'`,
      );

      // Filtrer et formater les résultats
      const similarQuestions = documents
        .filter((doc) => doc.metadata && doc.metadata.type === 'question')
        .map((doc) => {
          // Convertir la distance en similarité (1 - distance)
          const similarity = 1 - doc.metadata.distance;
          return {
            question: doc.document,
            answer: doc.metadata.answer || 'Pas de réponse enregistrée',
            similarity,
          };
        })
        .filter((item) => item.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      console.log(
        `[RAG] ${similarQuestions.length} questions similaires trouvées avec un seuil de ${threshold}`,
      );

      return {
        questions: similarQuestions,
      };
    } catch (error) {
      console.error(
        'Erreur lors de la recherche de questions similaires:',
        error,
      );
      return { questions: [] };
    }
  }
}
