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

      // Détecter si la question contient des contraintes temporelles
      const hasMoisEnCours =
        /mois.*(en)?.*cours|ce mois|mois.*(actuel|courant)/i.test(question);
      const hasSemaineEnCours =
        /semaine.*(en)?.*cours|cette semaine|semaine.*(actuel|courant)/i.test(
          question,
        );
      const hasAnneeEnCours =
        /annee.*(en)?.*cours|cette annee|annee.*(actuel|courant)/i.test(
          question,
        );
      const hasProchain = /prochain|suivant/i.test(question);
      const hasDernier = /dernier|precedent|passe/i.test(question);

      // Journal de débogage
      this.logger.log(
        `Recherche de variations pour: "${question}" (mots-clés: ${questionWords.join(', ')})
        Contraintes temporelles détectées: ${hasMoisEnCours ? 'mois en cours, ' : ''}${hasSemaineEnCours ? 'semaine en cours, ' : ''}${hasProchain ? 'prochain, ' : ''}${hasDernier ? 'dernier/passé' : ''}`,
      );

      let bestMatch: MatchResult = null;
      let bestSimilarity = 0;

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

            // Vérifier la cohérence des contraintes temporelles
            const variantHasMoisEnCours =
              /mois.*(en)?.*cours|ce mois|mois.*(actuel|courant)/i.test(
                variantQuestion,
              );
            const variantHasSemaineEnCours =
              /semaine.*(en)?.*cours|cette semaine|semaine.*(actuel|courant)/i.test(
                variantQuestion,
              );
            const variantHasProchain = /prochain|suivant/i.test(
              variantQuestion,
            );
            const variantHasDernier = /dernier|precedent|passe/i.test(
              variantQuestion,
            );

            // Pénalité pour les incohérences temporelles
            let temporalPenalty = 1.0;

            // Si la question mentionne "mois en cours" mais pas la variante, c'est une grosse incohérence
            if (hasMoisEnCours && !variantHasMoisEnCours)
              temporalPenalty *= 0.7;
            // Si la question mentionne "semaine en cours" mais pas la variante, c'est une grosse incohérence
            if (hasSemaineEnCours && !variantHasSemaineEnCours)
              temporalPenalty *= 0.7;
            // Si la question mentionne "prochain" mais pas la variante ou vice versa
            if (hasProchain !== variantHasProchain) temporalPenalty *= 0.8;
            // Si la question mentionne "dernier" mais pas la variante ou vice versa
            if (hasDernier !== variantHasDernier) temporalPenalty *= 0.8;

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

            // Combiner les deux scores avec une pondération et appliquer la pénalité temporelle
            const combinedSimilarity =
              (wordSimilarity * 0.7 + levenshteinSimilarity * 0.3) *
              temporalPenalty;

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
        // Augmenter le seuil à 0.65 pour être plus strict
        if (entrySimilarity > bestSimilarity && entrySimilarity > 0.65) {
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

    // Mots-clés temporels importants avec leur poids
    const temporalKeywords = {
      mois: true,
      semaine: true,
      annee: true,
      jour: true,
      courant: true,
      cours: true,
      actuel: true,
      current: true,
      prochain: true,
      precedent: true,
      dernier: true,
      passe: true,
    };

    // Compter combien de mots-clés sont présents dans la cible
    let matchCount = 0;
    let temporalMatched = false;
    let temporalInQuestion = false;

    for (const keyword of keywords) {
      // Vérifier si c'est un mot-clé temporel
      if (temporalKeywords[keyword]) {
        temporalInQuestion = true;
      }

      // Vérifier les correspondances exactes
      if (target.includes(keyword)) {
        // Les mots temporels sont plus importants
        if (temporalKeywords[keyword]) {
          matchCount += 1.5;
          temporalMatched = true;
        } else {
          matchCount++;
        }
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
            // Si c'est un mot temporel, donner plus de poids
            if (temporalKeywords[keyword]) {
              matchCount += 1.0; // Plus de poids pour les correspondances partielles de mots temporels
              temporalMatched = true;
            } else {
              matchCount += 0.7; // Correspondance partielle vaut 0.7
            }
            break;
          }
        }
      }
    }

    // Pénalité si la question contient des contraintes temporelles mais pas la cible
    if (temporalInQuestion && !temporalMatched) {
      return (matchCount / keywordCount) * 0.7; // Réduire le score de 30%
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

  /**
   * Recherche une correspondance approximative en utilisant le RAG
   */
  private async findApproximateMatch(userQuestion: string): Promise<any> {
    this.logger.log(
      `Recherche d'une correspondance approximative pour: "${userQuestion}"`,
    );

    // Détecter si la question porte sur des personnes ou des projets
    const isPersonnelQuestion =
      /qui|personne|personnel|staff|employe|travaille/i.test(userQuestion);
    const isProjectQuestion = /projet|quels|quelles|chantier/i.test(
      userQuestion,
    );

    // Ajuster le seuil de similarité en fonction du type de question
    let similarityThreshold = 0.7; // Seuil par défaut

    if (isPersonnelQuestion) {
      similarityThreshold = 0.65; // Plus permissif pour les questions sur le personnel
      this.logger.log(
        'Question détectée comme portant sur le personnel, seuil ajusté à 0.65',
      );
    } else if (isProjectQuestion) {
      similarityThreshold = 0.68; // Seuil pour les questions sur les projets
      this.logger.log(
        'Question détectée comme portant sur les projets, seuil ajusté à 0.68',
      );
    }

    try {
      // Utiliser le RAG pour trouver des similitudes
      const ragResult = await this.ragService.findSimilarPrompt(
        this.sqlQueryCacheName,
        userQuestion,
        similarityThreshold,
      );

      if (ragResult.found && ragResult.metadata) {
        this.logger.log(
          `Correspondance approximative trouvée: "${ragResult.metadata.question || ragResult.prompt}" (score: ${ragResult.similarity})`,
        );

        const question = ragResult.metadata.question || ragResult.prompt;

        // Vérification supplémentaire pour éviter les correspondances incorrectes entre personnel et projets
        if (
          isPersonnelQuestion &&
          question.toLowerCase().includes('projet') &&
          !question.toLowerCase().includes('qui') &&
          !question.toLowerCase().includes('travaille')
        ) {
          this.logger.warn(
            'Correspondance potentiellement incorrecte: question sur le personnel mais réponse sur les projets',
          );
          return {
            found: false,
            reason:
              'Correspondance inadéquate entre question sur le personnel et requête sur les projets',
          };
        }

        if (
          isProjectQuestion &&
          question.toLowerCase().includes('qui travaille')
        ) {
          this.logger.warn(
            'Correspondance potentiellement incorrecte: question sur les projets mais réponse sur le personnel',
          );
          return {
            found: false,
            reason:
              'Correspondance inadéquate entre question sur les projets et requête sur le personnel',
          };
        }

        return {
          found: true,
          query: ragResult.metadata.finalQuery,
          description: ragResult.metadata.questionReformulated || question,
          parameters: this.detectRequiredParameters(
            ragResult.metadata.finalQuery,
          ),
          predefinedParameters: ragResult.metadata.parameters || [],
          id: ragResult.metadata.id || ragResult.id,
          similarity: ragResult.similarity,
        };
      } else {
        this.logger.log(
          `Aucune correspondance approximative trouvée: ${ragResult.reason}`,
        );
        return { found: false, reason: ragResult.reason };
      }
    } catch (error) {
      this.logger.error(
        `Erreur lors de la recherche par RAG: ${error.message}`,
      );
      return { found: false, error: error.message };
    }
  }
}
