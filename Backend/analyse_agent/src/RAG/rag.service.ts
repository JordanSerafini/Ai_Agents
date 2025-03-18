import { Injectable, Logger } from '@nestjs/common';
import { ChromaClient } from 'chromadb';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';

interface BestMatch {
  prompt: string;
  id: string;
  similarity: number;
  metadata?: Record<string, any>;
}

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
      const collection = await this.getCollection(collectionName);
      const collectionInfo = await collection.count();

      if (collectionInfo === 0) {
        this.logger.log(
          `Collection ${collectionName} est vide, aucune recherche possible`,
        );
        return { found: false, reason: 'collection_empty' };
      }

      this.logger.log(
        `Recherche de similarité dans ${collectionName} avec seuil: ${similarityThreshold}`,
      );

      try {
        const results = await this.findSimilarDocuments(
          collectionName,
          prompt,
          5, // Récupérer 5 résultats pour augmenter les chances de trouver une correspondance
        );

        // Vérifier si des résultats ont été trouvés
        if (
          !results.distances ||
          !results.distances[0] ||
          !results.distances[0][0]
        ) {
          this.logger.warn(
            `Aucun résultat de similarité trouvé dans ${collectionName}, tentative de récupération directe`,
          );

          // Tenter de récupérer tous les documents de la collection
          try {
            const allDocuments = await collection.get({});

            if (allDocuments.documents && allDocuments.documents.length > 0) {
              // Vérifier si une correspondance exacte existe
              for (let i = 0; i < allDocuments.documents.length; i++) {
                const doc = allDocuments.documents[i];
                const similarity = this.calculateExactMatchScore(prompt, doc);

                // Si correspondance exacte ou très proche
                if (similarity >= 0.9) {
                  this.logger.log(
                    `Correspondance exacte trouvée via récupération directe: ${similarity}`,
                  );
                  return {
                    found: true,
                    prompt: doc,
                    id: allDocuments.ids[i],
                    similarity: similarity,
                    metadata: allDocuments.metadatas?.[i],
                  };
                }
              }

              // Vérifier si une correspondance approximative existe
              let bestMatch: BestMatch | null = null;
              let bestSimilarity = 0;

              for (let i = 0; i < allDocuments.documents.length; i++) {
                const doc = allDocuments.documents[i];
                const similarity = this.calculateSimilarityScore(prompt, doc);

                if (similarity > bestSimilarity) {
                  bestSimilarity = similarity;
                  bestMatch = {
                    prompt: doc,
                    id: allDocuments.ids[i],
                    similarity,
                    metadata: allDocuments.metadatas?.[i],
                  };
                }
              }

              if (bestMatch && bestSimilarity >= similarityThreshold) {
                this.logger.log(
                  `Meilleure correspondance trouvée via comparaison directe: ${bestSimilarity}`,
                );
                return {
                  found: true,
                  ...bestMatch,
                };
              } else if (bestMatch) {
                this.logger.log(
                  `Meilleure correspondance trouvée mais en dessous du seuil: ${bestSimilarity}`,
                );
                return {
                  found: false,
                  reason: 'below_threshold',
                  bestMatch: bestMatch.prompt,
                  similarity: bestSimilarity,
                };
              }
            }

            this.logger.warn(
              `Aucune correspondance trouvée parmi ${allDocuments.documents?.length || 0} documents`,
            );
            return { found: false, reason: 'no_match_in_collection' };
          } catch (listError) {
            this.logger.error(
              `Erreur lors de la récupération des documents: ${listError.message}`,
            );
            return {
              found: false,
              reason: 'list_error',
              error: listError.message,
            };
          }
        }

        const similarity = 1 - results.distances[0][0];
        this.logger.log(
          `Prompt trouvé avec similarité: ${similarity} (seuil: ${similarityThreshold})`,
        );

        if (similarity >= similarityThreshold) {
          return {
            found: true,
            prompt: results.documents?.[0]?.[0],
            id: results.ids?.[0]?.[0],
            similarity: similarity,
            metadata: results.metadatas?.[0]?.[0],
          };
        } else {
          this.logger.log(
            `Similarité ${similarity} inférieure au seuil ${similarityThreshold}`,
          );
          return {
            found: false,
            reason: 'below_threshold',
            similarity: similarity,
            bestMatch: results.documents?.[0]?.[0],
          };
        }
      } catch (queryError) {
        // Si la recherche échoue, tenter une approche différente
        this.logger.warn(`Recherche similaire échouée: ${queryError.message}`);
        return {
          found: false,
          reason: 'query_error',
          error: queryError.message,
        };
      }
    } catch (error) {
      this.logger.error(
        `Erreur lors de la recherche de prompt similaire: ${error.message}`,
      );
      return { found: false, reason: 'general_error', error: error.message };
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

  /**
   * Calcule un score de similarité entre deux chaînes
   * Méthode simple pour la correspondance approximative
   */
  private calculateSimilarityScore(str1: string, str2: string): number {
    // Convertir en minuscules et supprimer la ponctuation
    const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '');

    const s1 = normalize(str1);
    const s2 = normalize(str2);

    // Compter les mots communs
    const words1 = s1.split(/\s+/).filter((w) => w.length > 2); // Ignorer les mots très courts
    const words2 = s2.split(/\s+/).filter((w) => w.length > 2);

    if (words1.length === 0 || words2.length === 0) return 0;

    // Mots-clés discriminants avec leur poids
    const keywordWeights = {
      'qui': 2.0,
      'personne': 2.0,
      'personnel': 2.0,
      'staff': 2.0, 
      'employe': 2.0,
      'travaille': 1.5,
      'projet': 1.5, 
      'quels': 1.5,
      'quelles': 1.5,
      'chantier': 1.5,
      'mois': 1.0,
      'semaine': 1.0,
      'prochain': 1.0,
      'prochaine': 1.0
    };

    let commonWords = 0;
    let weightedCommonWords = 0;
    let totalWeight = 0;

    // Calculer les mots communs avec poids
    for (const word of words1) {
      const wordWeight = keywordWeights[word] || 1.0;
      totalWeight += wordWeight;
      
      if (words2.includes(word)) {
        commonWords++;
        weightedCommonWords += wordWeight;
      }
    }

    // Calculer le score Jaccard standard (intersection/union)
    const uniqueWords = new Set([...words1, ...words2]);
    const jaccardScore = commonWords / uniqueWords.size;
    
    // Calculer le score pondéré
    const weightedScore = totalWeight > 0 ? weightedCommonWords / totalWeight : 0;
    
    // Combiner les deux scores (70% poids sur le score pondéré, 30% sur Jaccard)
    return weightedScore * 0.7 + jaccardScore * 0.3;
  }

  /**
   * Vérifie si deux chaînes sont identiques ou très similaires
   */
  private calculateExactMatchScore(str1: string, str2: string): number {
    // Normaliser les chaînes pour la comparaison
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const s1 = normalize(str1);
    const s2 = normalize(str2);

    // Vérifier si les chaînes sont identiques
    if (s1 === s2) return 1.0;

    // Vérifier si l'une contient l'autre
    if (s1.includes(s2) || s2.includes(s1)) {
      const ratio =
        Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
      // Si le ratio de longueur est élevé, c'est probablement la même question
      return ratio >= 0.8 ? 0.95 : 0.85;
    }

    return 0;
  }
}
