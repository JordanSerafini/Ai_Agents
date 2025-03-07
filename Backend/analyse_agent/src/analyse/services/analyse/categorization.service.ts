import { Injectable, Logger } from '@nestjs/common';
import {
  QuestionCategory,
  AgentType,
} from '../../interfaces/analyse.interface';

@Injectable()
export class CategorizationService {
  private readonly logger = new Logger(CategorizationService.name);

  /**
   * Détermine si une question est une requête spécifique qui nécessite QueryBuilder
   * plutôt qu'une recherche générale qui nécessiterait Elasticsearch
   */
  isSpecificQuery(question: string, intention: string): boolean {
    // Mots-clés indiquant une requête précise
    const specificKeywords = [
      'combien',
      'nombre',
      'total',
      'somme',
      'moyenne',
      'liste',
      'detail',
      'information',
      'donnees',
      'statistique',
      'pourcentage',
      'montant',
      'valeur',
      'date',
      'periode',
      'entre',
      'depuis',
      'jusqua',
    ];

    // Mots-clés indiquant une recherche
    const searchKeywords = [
      'cherche',
      'trouve',
      'recherche',
      'ou est',
      'localise',
      'document',
      'information sur',
      'a propos de',
      'concernant',
      'relatif a',
      'similaire',
      'comme',
      'ressemblant a',
      'pareil a',
    ];

    // Vérifier si la question contient des mots-clés spécifiques
    const hasSpecificKeywords = specificKeywords.some((keyword) =>
      question.toLowerCase().includes(keyword.toLowerCase()),
    );

    // Vérifier si la question contient des mots-clés de recherche
    const hasSearchKeywords = searchKeywords.some((keyword) =>
      question.toLowerCase().includes(keyword.toLowerCase()),
    );

    // Si l'intention contient des termes liés à la recherche
    const isSearchIntention =
      intention.toLowerCase().includes('recherche') ||
      intention.toLowerCase().includes('trouver') ||
      intention.toLowerCase().includes('localiser');

    // Logique de décision:
    // - Si la question contient des mots-clés spécifiques et pas de mots-clés de recherche -> requête spécifique
    // - Si l'intention est clairement une recherche -> pas une requête spécifique
    // - Si la question contient des mots-clés de recherche et pas de mots-clés spécifiques -> pas une requête spécifique

    if (hasSpecificKeywords && !hasSearchKeywords) {
      return true;
    }

    if (isSearchIntention || (hasSearchKeywords && !hasSpecificKeywords)) {
      return false;
    }

    // Par défaut, considérer comme une requête spécifique (QueryBuilder)
    return true;
  }

  /**
   * Détermine la catégorie de la question en fonction du domaine et du contenu
   */
  determinerCategorie(
    domaine: string,
    question: string = '',
    intention: string = '',
  ): QuestionCategory {
    // Vérifier d'abord si c'est une recherche explicite
    const searchKeywords = [
      'cherche',
      'trouve',
      'recherche',
      'ou est',
      'localise',
      'document',
      'information sur',
      'a propos de',
      'concernant',
      'relatif a',
      'similaire',
      'comme',
      'ressemblant a',
      'pareil a',
    ];

    const isExplicitSearch = searchKeywords.some((keyword) =>
      question.toLowerCase().includes(keyword.toLowerCase()),
    );

    if (isExplicitSearch) {
      return QuestionCategory.SEARCH;
    }

    // Vérifier si c'est une recherche générale plutôt qu'une requête spécifique
    if (!this.isSpecificQuery(question, intention)) {
      return QuestionCategory.SEARCH;
    }

    // Sinon, appliquer la logique basée sur le domaine
    switch (domaine.toUpperCase()) {
      case 'CHANTIERS':
      case 'FINANCES':
      case 'CLIENTS':
        return QuestionCategory.DATABASE;
      case 'PERSONNEL':
        return this.requiresKnowledge(question)
          ? QuestionCategory.KNOWLEDGE
          : QuestionCategory.DATABASE;
      default:
        return QuestionCategory.GENERAL;
    }
  }

  /**
   * Détermine l'agent cible en fonction de la catégorie de la question
   */
  determinerAgent(categorie: QuestionCategory): AgentType {
    switch (categorie) {
      case QuestionCategory.DATABASE:
        return AgentType.QUERYBUILDER;
      case QuestionCategory.SEARCH:
        return AgentType.ELASTICSEARCH;
      case QuestionCategory.KNOWLEDGE:
        return AgentType.RAG;
      case QuestionCategory.WORKFLOW:
        return AgentType.WORKFLOW;
      default:
        return AgentType.GENERAL;
    }
  }

  /**
   * Vérifie si la question nécessite des données structurées
   */
  requiresStructuredData(
    question: string,
    categorie: QuestionCategory,
  ): boolean {
    const databaseKeywords = [
      'base de données',
      'sql',
      'requête',
      'table',
      'données',
      'client',
      'projet',
      'facture',
      'paiement',
    ];

    return (
      categorie === QuestionCategory.DATABASE ||
      databaseKeywords.some((keyword) =>
        question.toLowerCase().includes(keyword.toLowerCase()),
      )
    );
  }

  /**
   * Vérifie si la question nécessite une recherche textuelle
   */
  requiresTextSearch(question: string, categorie: QuestionCategory): boolean {
    const searchKeywords = [
      'recherche',
      'chercher',
      'trouver',
      'document',
      'article',
      'texte',
      'contenu',
    ];

    return (
      categorie === QuestionCategory.SEARCH ||
      searchKeywords.some((keyword) =>
        question.toLowerCase().includes(keyword.toLowerCase()),
      )
    );
  }

  /**
   * Vérifie si la question nécessite des connaissances
   */
  requiresKnowledge(question: string): boolean {
    // Vérifier si la question nécessite des connaissances
    const knowledgeKeywords = [
      'comment',
      'pourquoi',
      'expliquer',
      "qu'est-ce que",
      'définir',
      'signification',
      'procédure',
    ];

    return knowledgeKeywords.some((keyword) =>
      question.toLowerCase().includes(keyword.toLowerCase()),
    );
  }
}
