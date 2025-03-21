import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ChromaClient } from 'chromadb';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { HuggingFaceService } from '../huggingface/huggingface.service';

// Interfaces pour le service RAG
export interface RagDocument {
  id: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface RagRating {
  relevance: number;
  quality: number;
  completeness: number;
  overall: number;
  feedback: string;
  timestamp: string;
  detailedEvaluation?: {
    relevance: number;
    relevance_feedback: string;
    accuracy: number;
    accuracy_feedback: string;
    completeness: number;
    completeness_feedback: string;
    clarity: number;
    clarity_feedback: string;
    improvement_suggestions: string[] | string;
  };
}

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

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => HuggingFaceService))
    private readonly huggingFaceService: HuggingFaceService,
  ) {
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

  /**
   * Récupère un document spécifique depuis une collection
   * @param collectionName Nom de la collection
   * @param documentId ID du document
   * @returns Le document s'il existe, null sinon
   */
  async getDocument(
    collectionName: string,
    documentId: string,
  ): Promise<{
    id: string;
    content: string;
    metadata: any;
  } | null> {
    try {
      this.logger.log(
        `Récupération du document ${documentId} dans la collection ${collectionName}`,
      );

      // Vérifier que la collection existe
      const collections = await this.client.listCollections();
      if (!collections.includes(collectionName)) {
        this.logger.warn(`Collection ${collectionName} introuvable`);
        return null;
      }

      // Accéder à la collection
      const collection = await this.getCollection(collectionName);

      // Rechercher le document par ID
      const result = await collection.get({
        ids: [documentId],
        include: ['metadatas', 'documents'] as any,
      });

      // Vérifier si le document a été trouvé
      if (!result.ids.length) {
        this.logger.warn(
          `Document ${documentId} non trouvé dans la collection ${collectionName}`,
        );
        return null;
      }

      // Retourner le document trouvé
      this.logger.log(`Document ${documentId} récupéré avec succès`);
      return {
        id: result.ids[0],
        content: result.documents[0] as string,
        metadata: result.metadatas?.[0],
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération du document ${documentId}: ${error.message}`,
      );
      throw new Error(`Impossible de récupérer le document: ${error.message}`);
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
      qui: 2.0,
      personne: 2.0,
      personnel: 2.0,
      staff: 2.0,
      employe: 2.0,
      travaille: 1.5,
      projet: 1.5,
      quels: 1.5,
      quelles: 1.5,
      chantier: 1.5,
      mois: 1.0,
      semaine: 1.0,
      prochain: 1.0,
      prochaine: 1.0,
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
    const weightedScore =
      totalWeight > 0 ? weightedCommonWords / totalWeight : 0;

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

  // Méthode pour trouver une question similaire dans le stockage
  private async findSimilarStoredQuestion(
    question: string,
    reformulatedQuestion: string,
  ): Promise<{
    found: boolean;
    queryId?: string;
    sql?: string;
    description?: string;
    similarity?: number;
    parameters?: any[];
  }> {
    try {
      // Vérifier si nous avons des requêtes stockées
      const result = await this.findSimilarPrompt('queries', question, 0.7);

      if (result && result.found && result.metadata) {
        return {
          found: true,
          queryId: result.metadata.id || '',
          sql: result.metadata.finalQuery || '',
          description: result.metadata.questionReformulated || '',
          similarity: result.similarity || 0,
          parameters: result.metadata.parameters || [],
        };
      }

      // Si rien n'a été trouvé avec la question originale, essayer avec la reformulation
      if (reformulatedQuestion && reformulatedQuestion !== question) {
        const reformulatedResult = await this.findSimilarPrompt(
          'queries',
          reformulatedQuestion,
          0.7,
        );

        if (
          reformulatedResult &&
          reformulatedResult.found &&
          reformulatedResult.metadata
        ) {
          return {
            found: true,
            queryId: reformulatedResult.metadata.id || '',
            sql: reformulatedResult.metadata.finalQuery || '',
            description: reformulatedResult.metadata.questionReformulated || '',
            similarity: reformulatedResult.similarity || 0,
            parameters: reformulatedResult.metadata.parameters || [],
          };
        }
      }

      // Aucune correspondance trouvée
      this.logger.log(
        'Aucune question similaire trouvée avec un seuil de similarité suffisant',
      );
      return { found: false };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la recherche de questions similaires: ${error.message}`,
      );
      return { found: false };
    }
  }

  // Nettoyer le texte pour une meilleure comparaison
  private cleanText(text: string): string {
    if (!text) return '';

    return text
      .toLowerCase()
      .replace(/[.,/#!$%&*;:{}=\-_`~()]/g, '')
      .replace(/\s{2,}/g, ' ') // Réduire les espaces multiples
      .trim();
  }

  // Calculer la similarité entre deux textes (méthode simple basée sur les mots communs)
  private calculateSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;

    const words1 = new Set(text1.split(' ').filter((word) => word.length > 2));
    const words2 = new Set(text2.split(' ').filter((word) => word.length > 2));

    if (words1.size === 0 || words2.size === 0) return 0;

    // Compter les mots communs
    let commonWords = 0;
    for (const word of words1) {
      if (words2.has(word)) {
        commonWords++;
      }
    }

    // Calculer le score de Jaccard (intersection/union)
    const union = words1.size + words2.size - commonWords;
    return commonWords / union;
  }

  // Fonction utilitaire pour calculer la similarité cosinus
  private cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    if (norm1 === 0 || norm2 === 0) return 0;

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Évalue un document RAG par rapport à une requête
   * @param document Contenu du document
   * @param query Requête utilisateur
   */
  async evaluateRagDocument(
    document: string,
    query: string,
  ): Promise<RagRating> {
    try {
      this.logger.log(
        `Évaluation du document: ${document.substring(0, 100)}...`,
      );

      // Construction du prompt d'évaluation amélioré
      const prompt = `
Tu es un expert en évaluation de la qualité des données RAG (Retrieval-Augmented Generation).

REQUÊTE UTILISATEUR:
"""
${query}
"""

DOCUMENT À ÉVALUER:
"""
${document}
"""

Analyse le document en détail selon ces critères spécifiques et attribue une note de 1 à 5 pour chacun:

1. PERTINENCE (1-5):
   - La pertinence du document par rapport à la requête
   - 1: Totalement hors sujet, 3: Partiellement pertinent, 5: Parfaitement adapté à la requête
   
2. EXACTITUDE (1-5):
   - L'exactitude factuelle des informations
   - 1: Contient des erreurs graves, 3: Quelques imprécisions mineures, 5: Informations totalement exactes
   
3. COMPLÉTUDE (1-5):
   - Le niveau de complétude des informations
   - 1: Très incomplet, 3: Couvre les bases mais manque de détails, 5: Information exhaustive
   
4. CLARTÉ (1-5):
   - La clarté et la cohérence de la présentation
   - 1: Confus/incohérent, 3: Compréhensible avec effort, 5: Parfaitement structuré et clair

Pour chaque critère, fournis une justification spécifique en te référant explicitement au contenu du document et à la requête. 
NE PAS utiliser des phrases génériques ou des modèles - chaque évaluation doit être unique et basée sur le contenu réel.

Ensuite:
- Calcule un score GLOBAL qui est la moyenne des quatre notes ci-dessus
- Propose 2-3 suggestions concrètes et spécifiques pour améliorer ce document

IMPORTANT: Fournis UNIQUEMENT un objet JSON valide avec cette structure EXACTE:

{
  "relevance": 4,
  "relevance_feedback": "Le document [ANALYSE SPÉCIFIQUE basée sur le texte réel]",
  "accuracy": 5,
  "accuracy_feedback": "Les informations [ANALYSE SPÉCIFIQUE basée sur le texte réel]",
  "completeness": 3,
  "completeness_feedback": "Le document [ANALYSE SPÉCIFIQUE basée sur le texte réel]",
  "clarity": 4,
  "clarity_feedback": "L'information [ANALYSE SPÉCIFIQUE basée sur le texte réel]",
  "overall": 4,
  "improvement_suggestions": [
    "[SUGGESTION SPÉCIFIQUE #1 basée sur le contenu réel]",
    "[SUGGESTION SPÉCIFIQUE #2 basée sur le contenu réel]",
    "[SUGGESTION SPÉCIFIQUE #3 basée sur le contenu réel]"
  ]
}

Inclus UNIQUEMENT le JSON dans ta réponse, sans texte additionnel.
`;

      const response = await this.huggingFaceService.generateText(prompt, {
        temperature: 0.2,
        max_new_tokens: 800,
      });

      // Parser la réponse et l'enrichir si nécessaire
      const rating = this.parseEnhancedRatingFromResponse(response);

      // Enrichir les feedbacks si nécessaires
      if (rating.detailedEvaluation) {
        if (rating.detailedEvaluation.relevance_feedback.includes('...')) {
          rating.detailedEvaluation.relevance_feedback = `Le document traite de "${document.substring(0, 50)}..." 
            ce qui est ${rating.relevance >= 4 ? 'très pertinent' : rating.relevance >= 3 ? 'assez pertinent' : 'peu pertinent'} 
            par rapport à la requête "${query.substring(0, 50)}..."`;
        }

        if (rating.detailedEvaluation.accuracy_feedback.includes('...')) {
          rating.detailedEvaluation.accuracy_feedback = `Les informations présentées dans le document sont ${rating.quality >= 4 ? 'très précises' : 'de qualité moyenne'} 
            concernant ${document.substring(0, 30)}...`;
        }

        if (rating.detailedEvaluation.completeness_feedback.includes('...')) {
          rating.detailedEvaluation.completeness_feedback = `Le document couvre ${rating.completeness >= 4 ? 'de manière exhaustive' : 'partiellement'} 
            le sujet "${document.split('.')[0]}"`;
        }

        if (rating.detailedEvaluation.clarity_feedback.includes('...')) {
          rating.detailedEvaluation.clarity_feedback = `La structure et la présentation du document sont ${rating.overall >= 4 ? 'très claires' : 'à améliorer'}`;
        }

        // Vérifier si les suggestions sont génériques
        if (Array.isArray(rating.detailedEvaluation.improvement_suggestions)) {
          const hasGenericSuggestions =
            rating.detailedEvaluation.improvement_suggestions.some(
              (suggestion) =>
                suggestion.includes('X') ||
                suggestion.includes('Y') ||
                suggestion.includes('Z'),
            );

          if (hasGenericSuggestions) {
            rating.detailedEvaluation.improvement_suggestions = [
              `Ajouter plus de contexte sur ${document.split(' ').slice(0, 3).join(' ')}...`,
              `Améliorer la structure de la section sur ${document.split('.')[0]}`,
              `Inclure des exemples concrets pour illustrer ${document.substring(0, 40)}...`,
            ];
          }
        }
      }

      return rating;
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'évaluation du document: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Analyse la réponse pour extraire l'évaluation améliorée au format JSON
   * @param response Réponse du modèle
   * @returns Évaluation structurée
   */
  private parseEnhancedRatingFromResponse(response: string): RagRating {
    try {
      this.logger.log(
        `Tentative de parsing de la réponse : ${response.substring(0, 100)}...`,
      );

      // Extraire seulement la partie JSON de la réponse
      let jsonStr = '';

      // Rechercher un objet JSON complet
      const jsonRegex = /(\{[\s\S]*?\})/g;
      const matches = response.match(jsonRegex);

      if (matches && matches.length > 0) {
        // Essayer chaque match jusqu'à trouver un JSON valide
        for (const match of matches) {
          try {
            const parsed = JSON.parse(match);
            if (
              parsed.relevance &&
              parsed.accuracy &&
              parsed.completeness &&
              parsed.clarity
            ) {
              jsonStr = match;
              break;
            }
          } catch {
            // Continuer avec le prochain match
          }
        }
      }

      // Si un JSON valide a été trouvé
      if (jsonStr) {
        this.logger.log(`JSON extrait : ${jsonStr}`);

        try {
          const enhancedRating = JSON.parse(jsonStr);

          // S'assurer que toutes les propriétés nécessaires sont présentes et sont des nombres
          const hasRelevance = typeof enhancedRating.relevance === 'number';
          const hasAccuracy = typeof enhancedRating.accuracy === 'number';
          const hasCompleteness =
            typeof enhancedRating.completeness === 'number';
          const hasClarity = typeof enhancedRating.clarity === 'number';

          if (
            !hasRelevance ||
            !hasAccuracy ||
            !hasCompleteness ||
            !hasClarity
          ) {
            this.logger.warn(
              `JSON incomplet - critères manquants ou non numériques: ${JSON.stringify(enhancedRating)}`,
            );

            // Convertir les valeurs non numériques en nombres
            if (
              enhancedRating.relevance &&
              typeof enhancedRating.relevance !== 'number'
            ) {
              enhancedRating.relevance =
                parseFloat(enhancedRating.relevance) || 3;
            }
            if (
              enhancedRating.accuracy &&
              typeof enhancedRating.accuracy !== 'number'
            ) {
              enhancedRating.accuracy =
                parseFloat(enhancedRating.accuracy) || 3;
            }
            if (
              enhancedRating.completeness &&
              typeof enhancedRating.completeness !== 'number'
            ) {
              enhancedRating.completeness =
                parseFloat(enhancedRating.completeness) || 3;
            }
            if (
              enhancedRating.clarity &&
              typeof enhancedRating.clarity !== 'number'
            ) {
              enhancedRating.clarity = parseFloat(enhancedRating.clarity) || 3;
            }
          }

          // Calculer le score global si nécessaire
          if (
            !enhancedRating.overall ||
            typeof enhancedRating.overall !== 'number'
          ) {
            enhancedRating.overall = Math.round(
              ((enhancedRating.relevance || 3) +
                (enhancedRating.accuracy || 3) +
                (enhancedRating.completeness || 3) +
                (enhancedRating.clarity || 3)) /
                4,
            );
          }

          // Combiner les feedbacks en un seul texte détaillé
          const detailedFeedback = [
            `PERTINENCE (${enhancedRating.relevance}/5): ${enhancedRating.relevance_feedback || 'Non évalué'}`,
            `EXACTITUDE (${enhancedRating.accuracy}/5): ${enhancedRating.accuracy_feedback || 'Non évalué'}`,
            `COMPLÉTUDE (${enhancedRating.completeness}/5): ${enhancedRating.completeness_feedback || 'Non évalué'}`,
            `CLARTÉ (${enhancedRating.clarity}/5): ${enhancedRating.clarity_feedback || 'Non évalué'}`,
            '',
            "SUGGESTIONS D'AMÉLIORATION:",
          ].join('\n');

          // Ajouter les suggestions d'amélioration si disponibles
          let suggestions = '';
          if (
            enhancedRating.improvement_suggestions &&
            Array.isArray(enhancedRating.improvement_suggestions)
          ) {
            suggestions = enhancedRating.improvement_suggestions
              .map((suggestion, index) => `${index + 1}. ${suggestion}`)
              .join('\n');
          } else if (
            typeof enhancedRating.improvement_suggestions === 'string'
          ) {
            suggestions = enhancedRating.improvement_suggestions;
          }

          const feedback = `${detailedFeedback}\n${suggestions || 'Aucune suggestion disponible.'}`;

          this.logger.log(
            `Évaluation améliorée réussie - Score global: ${enhancedRating.overall}/5`,
          );

          // Convertir au format standard RagRating
          return {
            relevance: enhancedRating.relevance || 3,
            quality: enhancedRating.accuracy || 3,
            completeness: enhancedRating.completeness || 3,
            overall: enhancedRating.overall,
            feedback: feedback,
            timestamp: new Date().toISOString(),
            detailedEvaluation: {
              relevance: enhancedRating.relevance || 3,
              relevance_feedback: enhancedRating.relevance_feedback || '',
              accuracy: enhancedRating.accuracy || 3,
              accuracy_feedback: enhancedRating.accuracy_feedback || '',
              completeness: enhancedRating.completeness || 3,
              completeness_feedback: enhancedRating.completeness_feedback || '',
              clarity: enhancedRating.clarity || 3,
              clarity_feedback: enhancedRating.clarity_feedback || '',
              improvement_suggestions:
                enhancedRating.improvement_suggestions || [],
            },
          };
        } catch (parseError) {
          this.logger.error(
            `Erreur JSON.parse: ${parseError.message}, JSON string: ${jsonStr}`,
          );
          throw parseError;
        }
      } else {
        this.logger.warn(
          `Aucun JSON valide trouvé dans la réponse: ${response.substring(0, 100)}...`,
        );
      }

      // Fallback si le JSON n'est pas trouvé
      this.logger.log("Utilisation de l'évaluation par défaut");
      return {
        relevance: 3,
        quality: 3,
        completeness: 3,
        overall: 3,
        feedback:
          "Impossible d'analyser la réponse du modèle. Une évaluation par défaut a été utilisée.",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors du parsing de la réponse: ${error.message}, Réponse: ${response.substring(0, 100)}...`,
      );
      return {
        relevance: 3,
        quality: 3,
        completeness: 3,
        overall: 3,
        feedback: `Erreur de parsing: ${error.message}. Une évaluation par défaut a été utilisée.`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Évalue et met à jour un document dans la collection RAG
   * @param collectionName Nom de la collection
   * @param documentId ID du document
   * @param query Requête utilisateur
   * @returns Document mis à jour
   */
  async evaluateAndUpdateDocument(
    collectionName: string,
    documentId: string,
    query: string,
  ): Promise<RagDocument> {
    try {
      // 1. Récupérer le document
      const document = await this.getDocument(collectionName, documentId);

      if (!document) {
        throw new Error(
          `Document avec l'ID ${documentId} non trouvé dans la collection ${collectionName}`,
        );
      }

      // 2. Évaluer le document
      const rating = await this.evaluateRagDocument(document.content, query);

      // 3. Mettre à jour le document avec la note
      const updatedMetadata = {
        ...document.metadata,
        rating,
      };

      // 4. Persister la mise à jour
      await this.updateDocument(
        collectionName,
        documentId,
        document.content,
        updatedMetadata,
      );

      return {
        id: documentId,
        content: document.content,
        metadata: updatedMetadata,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'évaluation et mise à jour du document: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Met à jour un document dans la collection
   * @param collectionName Nom de la collection
   * @param id ID du document
   * @param content Contenu du document
   * @param metadata Métadonnées du document
   * @returns Document mis à jour
   */
  async updateDocument(
    collectionName: string,
    id: string,
    content: string,
    metadata?: Record<string, any>,
  ): Promise<RagDocument> {
    try {
      const collection = await this.getCollection(collectionName);

      await collection.update({
        ids: [id],
        documents: [content],
        metadatas: metadata ? [metadata] : undefined,
      });

      return {
        id,
        content,
        metadata,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la mise à jour du document: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Valide tous les documents d'une collection
   * @param collectionName Nom de la collection
   * @returns Résultat de la validation
   */
  async validateCollection(collectionName: string): Promise<{
    totalDocuments: number;
    evaluatedDocuments: number;
    averageRating: number;
    documentRatings: Array<{ id: string; rating: RagRating }>;
  }> {
    try {
      this.logger.log(
        `Début de la validation de la collection ${collectionName}`,
      );

      // 1. Récupérer tous les documents de la collection
      const documents = await this.getAllDocuments(collectionName);
      this.logger.log(
        `${documents.length} documents trouvés dans la collection ${collectionName}`,
      );

      if (!documents.length) {
        this.logger.warn(
          `Collection ${collectionName} vide - aucun document à valider`,
        );
        return {
          totalDocuments: 0,
          evaluatedDocuments: 0,
          averageRating: 0,
          documentRatings: [],
        };
      }

      let totalRating = 0;
      let evaluatedCount = 0;
      const documentRatings: Array<{ id: string; rating: RagRating }> = [];

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        this.logger.log(
          `Validation du document ${i + 1}/${documents.length} (ID: ${doc.id})`,
        );

        try {
          // Générer une requête représentative
          this.logger.log(
            `Génération d'une requête pour le document ${doc.id}`,
          );
          const query = await this.generateQueryForDocument(doc.content);
          this.logger.log(`Requête générée: "${query.substring(0, 50)}..."`);

          // Évaluer le document
          this.logger.log(
            `Évaluation du document ${doc.id} avec la requête générée`,
          );
          const rating = await this.evaluateRagDocument(doc.content, query);
          this.logger.log(
            `Document ${doc.id} évalué avec un score global de ${rating.overall}/5`,
          );

          // Mettre à jour le document avec la note
          this.logger.log(`Mise à jour des métadonnées du document ${doc.id}`);
          await this.updateDocument(collectionName, doc.id, doc.content, {
            ...doc.metadata,
            rating,
          });

          totalRating += rating.overall;
          evaluatedCount++;
          documentRatings.push({ id: doc.id, rating });

          this.logger.log(
            `Document ${doc.id} validé avec succès (${i + 1}/${documents.length} terminés)`,
          );
        } catch (error) {
          this.logger.warn(
            `Impossible d'évaluer le document ${doc.id}: ${error.message}`,
          );
        }
      }

      const averageRating =
        evaluatedCount > 0 ? totalRating / evaluatedCount : 0;
      this.logger.log(
        `Validation de la collection ${collectionName} terminée: ${evaluatedCount}/${documents.length} documents évalués, note moyenne: ${averageRating.toFixed(2)}/5`,
      );

      return {
        totalDocuments: documents.length,
        evaluatedDocuments: evaluatedCount,
        averageRating,
        documentRatings,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la validation de la collection: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Récupère tous les documents d'une collection
   * @param collectionName Nom de la collection
   * @returns Liste des documents
   */
  async getAllDocuments(collectionName: string): Promise<RagDocument[]> {
    try {
      const collection = await this.getCollection(collectionName);
      const result = await collection.get({});

      if (!result.ids || result.ids.length === 0) {
        return [];
      }

      return result.ids.map((id, index) => ({
        id,
        content: result.documents[index],
        metadata: result.metadatas?.[index],
      }));
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des documents: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Génère une requête représentative pour un document
   * @param documentContent Contenu du document
   * @returns Requête générée
   */
  private async generateQueryForDocument(
    documentContent: string,
  ): Promise<string> {
    try {
      if (!this.huggingFaceService) {
        throw new Error('HuggingFaceService non disponible');
      }

      const prompt = `
Tu es un assistant expert en génération de requêtes.
Voici un document:
"""
${documentContent}
"""

Génère une requête utilisateur qui pourrait aboutir à ce document comme résultat pertinent.
Réponds uniquement avec la requête, sans autre explication.
`;

      const response = await this.huggingFaceService.generateText(prompt, {
        max_new_tokens: 256,
        temperature: 0.7,
      });

      return response.trim();
    } catch (error) {
      this.logger.error(
        `Erreur lors de la génération de requête: ${error.message}`,
      );
      return 'Quelle est la pertinence de ce document?';
    }
  }
}
