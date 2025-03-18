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
        0.75, // Seuil de similarité élevé
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
        0.5, // Seuil de similarité plus bas pour les correspondances approximatives
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
      } | null;

      // Normaliser la question pour la comparaison
      const normalizedQuestion = this.normalizeTextForComparison(question);
      let bestMatch: MatchResult = null;
      let bestSimilarity = 0;

      // Parcourir toutes les entrées et leurs questions associées
      for (let i = 0; i < allEntries.metadatas.length; i++) {
        const metadata = allEntries.metadatas[i];

        // Vérifier si l'entrée a un ID (elle devrait en avoir un)
        if (!metadata || !metadata.id) continue;

        // Extraire les mots clés de la question
        const questionWords = this.extractKeywords(normalizedQuestion);

        // Si l'entrée a des questions associées (dans le cas des requêtes prédéfinies importées)
        if (metadata.questions && Array.isArray(metadata.questions)) {
          for (const variantQuestion of metadata.questions) {
            const normalizedVariant =
              this.normalizeTextForComparison(variantQuestion);
            const similarity = this.calculateKeywordSimilarity(
              questionWords,
              normalizedVariant,
            );

            if (similarity > bestSimilarity && similarity > 0.6) {
              bestSimilarity = similarity;
              bestMatch = {
                found: true,
                query: metadata.finalQuery,
                description: metadata.questionReformulated || variantQuestion,
                parameters: this.detectRequiredParameters(metadata.finalQuery),
                predefinedParameters: metadata.parameters || [],
                id: metadata.id,
                similarity: similarity,
              };
            }
          }
        } else {
          // Sinon, comparer avec le document lui-même (qui est généralement la question)
          const documentText = allEntries.documents[i];
          if (!documentText) continue;

          const normalizedDocument =
            this.normalizeTextForComparison(documentText);
          const similarity = this.calculateKeywordSimilarity(
            questionWords,
            normalizedDocument,
          );

          if (similarity > bestSimilarity && similarity > 0.6) {
            bestSimilarity = similarity;
            bestMatch = {
              found: true,
              query: metadata.finalQuery,
              description: metadata.questionReformulated || documentText,
              parameters: this.detectRequiredParameters(metadata.finalQuery),
              predefinedParameters: metadata.parameters || [],
              id: metadata.id,
              similarity: similarity,
            };
          }
        }
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
}
