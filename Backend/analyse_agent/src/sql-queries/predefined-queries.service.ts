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

        // Vérifier et corriger la requête si nécessaire
        let finalQuery = exactResult.metadata.finalQuery;
        finalQuery = this.correctStatusReferencesInQuery(finalQuery);

        return {
          found: true,
          query: finalQuery,
          description: exactResult.metadata.questionReformulated,
          parameters: this.detectRequiredParameters(finalQuery),
          predefinedParameters: exactResult.metadata.parameters || [],
          id: exactResult.metadata.id,
          similarity: exactResult.similarity,
        };
      }

      // Récupérer les 3 correspondances les plus proches pour la désambiguïsation
      const topResults = await this.findTopSimilarPrompts(question, 3);

      // Si nous avons des résultats proches, analyser pour désambiguïsation
      if (topResults.length > 0) {
        // Si le meilleur résultat a une similarité supérieure à 0.8, l'utiliser
        if (topResults[0].similarity >= 0.8) {
          this.logger.log(
            `Requête prédéfinie trouvée (seuil amélioré): ${topResults[0].metadata.id} (similarité: ${topResults[0].similarity})`,
          );

          // Vérifier et corriger la requête si nécessaire
          let finalQuery = topResults[0].metadata.finalQuery;
          finalQuery = this.correctStatusReferencesInQuery(finalQuery);

          return {
            found: true,
            query: finalQuery,
            description: topResults[0].metadata.questionReformulated,
            parameters: this.detectRequiredParameters(finalQuery),
            predefinedParameters: topResults[0].metadata.parameters || [],
            id: topResults[0].metadata.id,
            similarity: topResults[0].similarity,
          };
        }

        // Si nous avons deux résultats proches (différence < 0.1), désambiguïsation
        else if (
          topResults.length >= 2 &&
          topResults[0].similarity - topResults[1].similarity < 0.1 &&
          topResults[0].similarity >= 0.75
        ) {
          // Analyse avancée pour désambiguïsation
          const bestMatch = this.disambiguateQueries(question, topResults);

          this.logger.log(
            `Désambiguïsation effectuée: choix de ${bestMatch.metadata.id} (similarité: ${bestMatch.similarity})`,
          );

          // Vérifier et corriger la requête si nécessaire
          let finalQuery = bestMatch.metadata.finalQuery;
          finalQuery = this.correctStatusReferencesInQuery(finalQuery);

          return {
            found: true,
            query: finalQuery,
            description: bestMatch.metadata.questionReformulated,
            parameters: this.detectRequiredParameters(finalQuery),
            predefinedParameters: bestMatch.metadata.parameters || [],
            id: bestMatch.metadata.id,
            similarity: bestMatch.similarity,
          };
        }
      }

      // Si toujours rien, essayer de chercher parmi les variations de questions
      const similarQueriesResult = await this.findSimilarQueries(question);
      if (similarQueriesResult.found) {
        this.logger.log(
          `Requête prédéfinie trouvée via variation de question: ${similarQueriesResult.id} (similarité: ${similarQueriesResult.similarity})`,
        );

        // Vérifier et corriger la requête si nécessaire
        if (similarQueriesResult.query) {
          similarQueriesResult.query = this.correctStatusReferencesInQuery(
            similarQueriesResult.query,
          );
        }

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
        Contraintes temporelles détectées: ${hasMoisEnCours ? 'mois en cours, ' : ''}${hasSemaineEnCours ? 'semaine en cours, ' : ''}${hasAnneeEnCours ? 'année en cours, ' : ''}${hasProchain ? 'prochain, ' : ''}${hasDernier ? 'dernier/passé' : ''}`,
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
            const variantHasAnneeEnCours =
              /annee.*(en)?.*cours|cette annee|annee.*(actuel|courant)/i.test(
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
            // Si la question mentionne "année en cours" mais pas la variante, c'est une grosse incohérence
            if (hasAnneeEnCours && !variantHasAnneeEnCours)
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

  /**
   * Corrige les références aux statuts dans une requête SQL
   */
  private correctStatusReferencesInQuery(query: string): string {
    if (!query) return query;

    // Correction pour quotations.status comparé directement à des valeurs de texte
    if (
      query.match(
        /status\s+IN\s*\(\s*(['"]en_attente['"]|['"]accepté['"]|['"]refusé['"])/i,
      )
    ) {
      this.logger.log(
        'Correction de référence directe aux statuts détectée (IN)',
      );

      return query.replace(
        /(\w+\.)?status\s+IN\s*\(\s*((['"][^'"]+['"](\s*,\s*['"][^'"]+['"])*)\s*)\)/gi,
        (match, table, statusList) => {
          const tablePrefix = table || '';
          return `${tablePrefix}status IN (SELECT id FROM ref_quotation_status WHERE code IN (${statusList}))`;
        },
      );
    }

    // Correction pour le cas d'égalité (status = 'en_attente')
    if (
      query.match(
        /status\s*=\s*(['"]en_attente['"]|['"]accepté['"]|['"]refusé['"])/i,
      )
    ) {
      this.logger.log(
        'Correction de référence directe aux statuts détectée (=)',
      );

      return query.replace(
        /(\w+\.)?status\s*=\s*(['"][^'"]+['"])/gi,
        (match, table, statusValue) => {
          const tablePrefix = table || '';
          return `${tablePrefix}status = (SELECT id FROM ref_quotation_status WHERE code = ${statusValue})`;
        },
      );
    }

    // Ajout automatique de la condition sur le statut si la requête contient "accepté"
    if (
      query.toLowerCase().includes('accepté') &&
      !query.toLowerCase().includes('status')
    ) {
      this.logger.log(
        'Ajout automatique de la condition sur le statut accepté',
      );
      const whereClause = query.toLowerCase().includes('where')
        ? 'AND'
        : 'WHERE';
      return query.replace(
        /(SELECT.*?FROM.*?)(WHERE|$)/i,
        `$1 ${whereClause} status = (SELECT id FROM ref_quotation_status WHERE code = 'accepté') $2`,
      );
    }

    return query;
  }

  /**
   * Récupère les N requêtes les plus similaires à la question
   */
  private async findTopSimilarPrompts(
    question: string,
    limit: number = 5,
  ): Promise<any[]> {
    try {
      // Récupérer les résultats similaires
      const results = await this.ragService.findSimilarDocuments(
        this.sqlQueryCacheName,
        question,
        limit,
      );

      if (!results.ids || !results.ids[0] || results.ids[0].length === 0) {
        return [];
      }

      // Définir un type pour les correspondances
      interface QueryMatch {
        id: string;
        similarity: number;
        metadata: any;
        score?: number;
      }

      // Convertir les résultats en tableau d'objets
      const topMatches: QueryMatch[] = [];
      for (let i = 0; i < results.ids[0].length; i++) {
        const id = results.ids[0][i];
        const distance = results.distances[0][i];
        // Convertir la distance en similarité (1 - distance)
        const similarity = 1 - distance;
        const metadata = results.metadatas[0][i];

        topMatches.push({
          id,
          similarity,
          metadata,
        });
      }

      return topMatches;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la recherche des top ${limit} requêtes similaires: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Désambiguïsation entre plusieurs requêtes similaires
   * Cette méthode analyse plus en détail la question pour choisir la meilleure correspondance
   */
  private disambiguateQueries(question: string, candidates: any[]): any {
    // Initialiser les compteurs pour désambiguïsation
    const counts = {
      total: 0,
      individual: 0,
      list: 0,
      each: 0,
      sum: 0,
      all: 0,
    };

    // Extraire la date éventuelle dans la question
    const dateInfo = this.extractDateInfo(question);

    // Mots-clés qui indiquent une liste de résultats individuels
    if (/individuel|chaque|liste|detail|tous les/i.test(question)) {
      counts.individual += 2;
      counts.list += 2;
      counts.each += 2;
    }

    // Mots-clés qui indiquent un total ou une somme
    if (/total|somme|cumul|montant global|tout/i.test(question)) {
      counts.total += 2;
      counts.sum += 2;
      counts.all += 2;
    }

    // Mot "cumulé" a un poids TRÈS important
    if (/cumulé|cumulés|cumul/i.test(question)) {
      counts.total += 5; // Augmentation significative
      counts.sum += 5;
      this.logger.log(
        `Mot "cumulé" détecté dans la question, forte priorité pour requêtes de somme`,
      );
    }

    // Analyser plus précisément le type de requête pour chaque candidat
    for (const candidate of candidates) {
      // La requête contient SUM et la question parle de cumul => forte priorité
      if (
        /SUM\(/i.test(candidate.metadata.finalQuery) &&
        /cumulé|cumul/i.test(question)
      ) {
        candidate.score = candidate.similarity * 0.5 + 0.5; // Bonus très important
        this.logger.log(
          `Candidate ${candidate.metadata.id} fortement bonifié pour SUM avec cumul: ${candidate.score}`,
        );
      }
      // La requête contient GROUP BY => probablement une liste
      else if (/GROUP BY/i.test(candidate.metadata.finalQuery)) {
        candidate.score = candidate.similarity * 0.7 + 0.3;
        this.logger.log(
          `Candidate ${candidate.metadata.id} bonifié pour GROUP BY: ${candidate.score}`,
        );
      }
      // La requête contient SUM => probablement un total
      else if (/SUM\(/i.test(candidate.metadata.finalQuery)) {
        // Donner plus de priorité aux requêtes SUM
        candidate.score = candidate.similarity * 0.6 + 0.4;
        this.logger.log(
          `Candidate ${candidate.metadata.id} bonifié pour SUM: ${candidate.score}`,
        );
      }
      // La requête ne contient pas de GROUP BY => probablement une liste
      else if (
        !/GROUP BY/i.test(candidate.metadata.finalQuery) &&
        !/SUM\(/i.test(candidate.metadata.finalQuery) &&
        counts.individual > counts.total
      ) {
        candidate.score = candidate.similarity * 0.8 + 0.2;
        this.logger.log(
          `Candidate ${candidate.metadata.id} légèrement bonifié pour liste: ${candidate.score}`,
        );
      } else {
        candidate.score = candidate.similarity;
      }

      // Score supplémentaire basé sur la description
      if (candidate.metadata.description) {
        const desc = candidate.metadata.description.toLowerCase();
        if (
          (counts.individual > counts.total &&
            /individuel|chaque|liste|detail/i.test(desc)) ||
          (counts.total > counts.individual && /total|somme|cumul/i.test(desc))
        ) {
          candidate.score += 0.05;
          this.logger.log(
            `Candidate ${candidate.metadata.id} bonifié pour description: ${candidate.score}`,
          );
        }

        // Bonus spécial pour les descriptions contenant "cumulé" si la question le contient aussi
        if (
          /cumulé|cumul/i.test(question) &&
          /cumulé|cumul|total/i.test(desc)
        ) {
          candidate.score += 0.1;
          this.logger.log(
            `Candidate ${candidate.metadata.id} bonus spécial pour description avec cumul: ${candidate.score}`,
          );
        }
      }

      // Vérifier l'ID de la requête - si elle contient "total", c'est probablement une requête de total
      if (
        candidate.metadata.id &&
        /total/i.test(candidate.metadata.id) &&
        counts.total > 0
      ) {
        candidate.score += 0.1;
        this.logger.log(
          `Candidate ${candidate.metadata.id} bonifié pour ID contenant "total": ${candidate.score}`,
        );
      }
    }

    // Trier par score et retourner le meilleur
    candidates.sort((a, b) => b.score - a.score);
    const bestMatch = candidates[0];

    // Appliquer les modifications de date si nécessaire
    if (dateInfo && bestMatch) {
      bestMatch.metadata.finalQuery = this.applyDateFilters(
        bestMatch.metadata.finalQuery,
        dateInfo,
      );
    }

    return bestMatch;
  }

  /**
   * Extrait les informations de date à partir de la question
   */
  private extractDateInfo(question: string): any {
    const result = {
      hasSpecificMonth: false,
      month: null as number | null,
      year: null as number | null,
    };

    // Détecter les mois
    const monthsMap: Record<string, number> = {
      janvier: 1,
      février: 2,
      mars: 3,
      avril: 4,
      mai: 5,
      juin: 6,
      juillet: 7,
      août: 8,
      septembre: 9,
      octobre: 10,
      novembre: 11,
      décembre: 12,
    };

    // Rechercher le mois dans la question
    for (const [monthName, monthNum] of Object.entries(monthsMap)) {
      if (question.toLowerCase().includes(monthName)) {
        result.hasSpecificMonth = true;
        result.month = monthNum;
        break;
      }
    }

    // Rechercher l'année dans la question (4 chiffres)
    const yearMatch = question.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      result.year = parseInt(yearMatch[1]);
    }

    // Si nous avons trouvé des informations de date
    if (result.hasSpecificMonth || result.year) {
      this.logger.log(
        `Informations de date extraites: mois=${result.month}, année=${result.year}`,
      );
    }

    return result;
  }

  /**
   * Applique les filtres de date à la requête
   */
  private applyDateFilters(query: string, dateInfo: any): string {
    // Si la requête ne contient pas déjà des conditions de date spécifiques
    if (!/EXTRACT\(MONTH FROM.*?\)\s*=\s*\d+/i.test(query)) {
      let modifiedQuery = query;

      // Remplacer les conditions de date liées au mois courant
      if (dateInfo.month) {
        modifiedQuery = modifiedQuery.replace(
          /EXTRACT\(MONTH FROM\s+(\w+\.\w+|\w+)\)\s*=\s*EXTRACT\(MONTH FROM CURRENT_DATE\)/gi,
          `EXTRACT(MONTH FROM $1) = ${dateInfo.month}`,
        );
      }

      // Remplacer les conditions de date liées à l'année courante
      if (dateInfo.year) {
        modifiedQuery = modifiedQuery.replace(
          /EXTRACT\(YEAR FROM\s+(\w+\.\w+|\w+)\)\s*=\s*EXTRACT\(YEAR FROM CURRENT_DATE\)/gi,
          `EXTRACT(YEAR FROM $1) = ${dateInfo.year}`,
        );
      }

      this.logger.log(
        `Requête modifiée avec filtres de date: ${modifiedQuery}`,
      );
      return modifiedQuery;
    }

    return query;
  }
}
