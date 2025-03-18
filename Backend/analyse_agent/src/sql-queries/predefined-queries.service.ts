import { Injectable, Logger } from '@nestjs/common';
import { RagService } from '../RAG/rag.service';

@Injectable()
export class PredefinedQueriesService {
  private readonly logger = new Logger(PredefinedQueriesService.name);
  private readonly sqlQueryCacheName = 'sql_queries';

  constructor(private readonly ragService: RagService) {}

  /**
   * Recherche une requête prédéfinie correspondant à la question
   */
  async findPredefinedQuery(question: string): Promise<any> {
    try {
      // D'abord essayer avec un seuil élevé pour une correspondance exacte
      const exactResult = await this.ragService.findSimilarPrompt(
        this.sqlQueryCacheName,
        question,
        0.85,
      );

      if (exactResult.found && exactResult.metadata) {
        this.logger.log(
          `Requête prédéfinie trouvée (exacte): ${exactResult.metadata.id} (similarité: ${exactResult.similarity})`,
        );
        return {
          found: true,
          query: exactResult.metadata.finalQuery,
          description: exactResult.metadata.questionReformulated,
          parameters: this.detectRequiredParameters(
            exactResult.metadata.finalQuery,
          ),
          predefinedParameters: exactResult.metadata.parameters || [],
          id: exactResult.metadata.id,
          similarity: exactResult.similarity,
        };
      }

      // Si aucune correspondance exacte n'est trouvée, essayer avec un seuil plus bas
      const approximateResult = await this.ragService.findSimilarPrompt(
        this.sqlQueryCacheName,
        question,
        0.7,
      );

      if (approximateResult.found && approximateResult.metadata) {
        this.logger.log(
          `Requête prédéfinie trouvée (approximative): ${approximateResult.metadata.id} (similarité: ${approximateResult.similarity})`,
        );
        return {
          found: true,
          query: approximateResult.metadata.finalQuery,
          description: approximateResult.metadata.questionReformulated,
          parameters: this.detectRequiredParameters(
            approximateResult.metadata.finalQuery,
          ),
          predefinedParameters: approximateResult.metadata.parameters || [],
          id: approximateResult.metadata.id,
          similarity: approximateResult.similarity,
        };
      }

      // Si toujours rien, essayer de chercher parmi les variations de questions
      const similarQueriesResult = await this.findSimilarQueries(question);
      if (similarQueriesResult.found) {
        this.logger.log(
          `Requête prédéfinie trouvée via variation de question: ${similarQueriesResult.id} (similarité: ${similarQueriesResult.similarity})`,
        );
        return similarQueriesResult;
      }

      return { found: false };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la recherche de requête prédéfinie: ${error.message}`,
      );
      return { found: false, error: error.message };
    }
  }

  /**
   * Recherche des variations de questions similaires dans les requêtes prédéfinies
   * Cette méthode aide à trouver des correspondances comme "quel chantier dem?" pour "quel chantier commence demain?"
   */
  private async findSimilarQueries(question: string): Promise<any> {
    try {
      // Obtenir toutes les entrées de la collection
      const collection = await this.ragService.getOrCreateCollection(
        this.sqlQueryCacheName,
      );
      const allEntries = await collection.get();

      if (!allEntries.metadatas || allEntries.metadatas.length === 0) {
        return { found: false };
      }

      // Définir le type pour bestMatch
      type MatchResult = {
        found: boolean;
        query: string;
        description: string;
        parameters: string[];
        predefinedParameters: any[];
        id: string;
        similarity: number;
        matchedQuestion?: string;
      } | null;

      // Normaliser la question pour la comparaison
      const normalizedQuestion = this.normalizeTextForComparison(question);
      const questionWords = this.extractKeywords(normalizedQuestion);
      let bestMatch: MatchResult = null;
      let bestSimilarity = 0;

      this.logger.log(
        `Recherche de variations pour: "${question}" (mots-clés: ${questionWords.join(', ')})`,
      );

      // Parcourir toutes les entrées et leurs questions associées
      for (let i = 0; i < allEntries.metadatas.length; i++) {
        const metadata = allEntries.metadatas[i];

        // Vérifier si l'entrée a un ID
        if (!metadata || !metadata.id) continue;

        let bestMatchingQuestion = '';
        let entrySimilarity = 0;

        // Si l'entrée a des questions associées (dans le cas des requêtes prédéfinies importées)
        if (metadata.questions && Array.isArray(metadata.questions)) {
          for (const variantQuestion of metadata.questions) {
            const normalizedVariant =
              this.normalizeTextForComparison(variantQuestion);

            // Calcul de similarité amélioré
            const wordSimilarity = this.calculateKeywordSimilarity(
              questionWords,
              normalizedVariant,
            );

            // Distance de Levenshtein normalisée pour les petites phrases
            const levenshteinSimilarity = this.calculateLevenshteinSimilarity(
              normalizedQuestion,
              normalizedVariant,
            );

            // Combiner les deux scores avec une pondération
            const combinedSimilarity =
              wordSimilarity * 0.7 + levenshteinSimilarity * 0.3;

            if (combinedSimilarity > entrySimilarity) {
              entrySimilarity = combinedSimilarity;
              bestMatchingQuestion = variantQuestion;
            }
          }
        }

        // Comparer avec le document lui-même (qui est généralement la question)
        const documentText = allEntries.documents[i];
        if (documentText) {
          const normalizedDocument =
            this.normalizeTextForComparison(documentText);
          const documentSimilarity = this.calculateKeywordSimilarity(
            questionWords,
            normalizedDocument,
          );

          if (documentSimilarity > entrySimilarity) {
            entrySimilarity = documentSimilarity;
            bestMatchingQuestion = documentText;
          }
        }

        // Vérifier si cette entrée est meilleure que la précédente
        if (entrySimilarity > bestSimilarity && entrySimilarity > 0.6) {
          bestSimilarity = entrySimilarity;
          bestMatch = {
            found: true,
            query: metadata.finalQuery,
            description: metadata.questionReformulated || bestMatchingQuestion,
            parameters: this.detectRequiredParameters(metadata.finalQuery),
            predefinedParameters: metadata.parameters || [],
            id: metadata.id,
            similarity: entrySimilarity,
            matchedQuestion: bestMatchingQuestion,
          };
        }
      }

      if (bestMatch) {
        this.logger.log(
          `Meilleure correspondance trouvée: ID=${bestMatch.id}, similarité=${bestMatch.similarity.toFixed(2)}, question=${bestMatch.matchedQuestion}`,
        );
      } else {
        this.logger.log(`Aucune correspondance trouvée pour: "${question}"`);
      }

      return bestMatch || { found: false };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la recherche de variations de questions: ${error.message}`,
      );
      return { found: false, error: error.message };
    }
  }

  /**
   * Normalise un texte pour la comparaison (minuscules, sans accents, sans ponctuation)
   */
  private normalizeTextForComparison(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
      .replace(/[^\w\s]/g, '') // Supprimer la ponctuation
      .replace(/\s+/g, ' ') // Normaliser les espaces
      .trim();
  }

  /**
   * Extrait les mots-clés importants d'une question
   */
  private extractKeywords(text: string): string[] {
    // Liste de mots à ignorer (stopwords)
    const stopwords = [
      'le',
      'la',
      'les',
      'un',
      'une',
      'des',
      'et',
      'ou',
      'qui',
      'que',
      'quoi',
      'dont',
      'est',
      'sont',
    ];

    // Extraire les mots
    const words = text.split(/\s+/);

    // Filtrer les stopwords et les mots courts
    return words.filter((word) => word.length > 2 && !stopwords.includes(word));
  }

  /**
   * Calcule un score de similarité basé sur les mots-clés
   */
  private calculateKeywordSimilarity(
    keywords: string[],
    target: string,
  ): number {
    const keywordCount = keywords.length;
    if (keywordCount === 0) return 0;

    // Compter combien de mots-clés sont présents dans la cible
    let matchCount = 0;
    for (const keyword of keywords) {
      // Vérifier les correspondances exactes
      if (target.includes(keyword)) {
        matchCount++;
        continue;
      }

      // Vérifier les abréviations (ex: "dem" pour "demain")
      if (keyword.length >= 3) {
        const targetWords = target.split(/\s+/);
        for (const targetWord of targetWords) {
          if (
            (targetWord.startsWith(keyword) &&
              targetWord.length > keyword.length) ||
            (keyword.startsWith(targetWord) &&
              keyword.length > targetWord.length)
          ) {
            matchCount += 0.7; // Correspondance partielle vaut 0.7
            break;
          }
        }
      }
    }

    return matchCount / keywordCount;
  }

  /**
   * Détecte les paramètres requis dans une requête SQL
   */
  private detectRequiredParameters(query: string): string[] {
    const paramRegex = /\[([A-Z_]+)\]/g;
    const matches = [...query.matchAll(paramRegex)];
    return [...new Set(matches.map((match) => match[1]))];
  }

  /**
   * Remplace les paramètres dans une requête SQL
   */
  replaceQueryParameters(
    query: string,
    parameters: Record<string, string>,
  ): string {
    let processedQuery = query;

    // Remplacer chaque paramètre
    for (const [key, value] of Object.entries(parameters)) {
      const regex = new RegExp(`\\[${key}\\]`, 'g');
      processedQuery = processedQuery.replace(regex, value);
    }

    return processedQuery;
  }

  /**
   * Calcule la similarité basée sur la distance de Levenshtein normalisée
   */
  private calculateLevenshteinSimilarity(str1: string, str2: string): number {
    // Fonction pour calculer la distance de Levenshtein
    function levenshteinDistance(a: string, b: string): number {
      if (a.length === 0) return b.length;
      if (b.length === 0) return a.length;

      const matrix: number[][] = [];

      // Initialiser la matrice
      for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
      }
      for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
      }

      // Remplir la matrice
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          const cost = a[j - 1] === b[i - 1] ? 0 : 1;
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1, // suppression
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j - 1] + cost, // substitution
          );
        }
      }

      return matrix[b.length][a.length];
    }

    // Calculer la distance
    const distance = levenshteinDistance(str1, str2);

    // Normaliser la distance en similarité (1 - distance/longueur_max)
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1; // Si les deux chaînes sont vides, elles sont identiques

    return 1 - distance / maxLength;
  }
}
