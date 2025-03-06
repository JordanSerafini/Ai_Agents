import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AnalyseRequestDto } from '../dto/analyse-request.dto';
import { AnalyseResponseDto } from '../dto/analyse-response.dto';
import { PrioriteType } from '../interfaces/analyse.interface';
import { analysePrompt } from '../../var/analyse.prompt';
import { RouterService } from './router.service';
import {
  QueryBuilderClientService,
  ElasticsearchClientService,
  RagClientService,
} from './clients';

interface OpenAICompletionResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

interface CacheEntry {
  reponse: string;
  timestamp: number;
}

// Structure pour stocker l'historique des conversations
interface ConversationHistory {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
  }>;
  lastInteraction: number;
}

// Types de classification des questions
export enum QuestionCategory {
  GENERAL = 'GENERAL',
  API = 'API',
  WORKFLOW = 'WORKFLOW',
  AUTRE = 'AUTRE',
  DATABASE = 'DATABASE',
  SEARCH = 'SEARCH',
}

// Types d'agents disponibles
export enum AgentType {
  GENERAL = 'agent_general',
  API = 'agent_api',
  WORKFLOW = 'agent_workflow',
  AUTRE = 'agent_autre',
  DATABASE = 'database',
  SEARCH = 'search',
  ANALYSE = 'analyse',
  DOCUMENT = 'document',
  QUERYBUILDER = 'querybuilder',
  ELASTICSEARCH = 'elasticsearch',
  RAG = 'rag',
}

// Interface pour la réponse d'analyse
export interface AnalyseResult {
  questionCorrigee: string;
  intention: string;
  categorie: QuestionCategory;
  agentCible: AgentType;
  priorite: PrioriteType;
  entites: string[];
  contexte: string;
  informationsManquantes?: string[];
  questionsComplementaires?: string[];
}

@Injectable()
export class AnalyseService {
  private readonly logger = new Logger(AnalyseService.name);
  private readonly responseCache: Map<string, CacheEntry> = new Map();
  private readonly cacheTTL: number = 3600000; // 1 heure en millisecondes
  private readonly openaiApiKey: string;
  private readonly conversationHistories: Map<string, ConversationHistory> =
    new Map();
  private readonly historyTTL: number = 1800000; // 30 minutes en millisecondes
  private readonly maxHistoryLength: number = 10; // Nombre maximum de messages à conserver

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly routerService: RouterService,
    private readonly queryBuilderClient: QueryBuilderClientService,
    private readonly elasticsearchClient: ElasticsearchClientService,
    private readonly ragClient: RagClientService,
  ) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
    if (!this.openaiApiKey) {
      this.logger.error('OPENAI_API_KEY non défini dans la configuration');
    }

    // Nettoyer les historiques expirés toutes les 15 minutes
    setInterval(() => this.cleanupExpiredHistories(), 900000);
  }

  private getCacheKey(question: string): string {
    return question.trim().toLowerCase();
  }

  private getFromCache(question: string): string | null {
    const key = this.getCacheKey(question);
    const entry = this.responseCache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.cacheTTL) {
      // L'entrée est expirée, la supprimer du cache
      this.responseCache.delete(key);
      return null;
    }

    this.logger.log(
      `Réponse trouvée dans le cache pour la question: ${question}`,
    );
    return entry.reponse;
  }

  private saveToCache(question: string, reponse: string): void {
    const key = this.getCacheKey(question);
    this.responseCache.set(key, {
      reponse,
      timestamp: Date.now(),
    });
    this.logger.log(`Réponse ajoutée au cache pour la question: ${question}`);
  }

  private getConversationHistory(userId: string): ConversationHistory {
    if (!this.conversationHistories.has(userId)) {
      this.conversationHistories.set(userId, {
        messages: [],
        lastInteraction: Date.now(),
      });
    }

    const history = this.conversationHistories.get(userId);
    history.lastInteraction = Date.now(); // Mettre à jour le timestamp
    return history;
  }

  private addToConversationHistory(
    userId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
  ): void {
    const history = this.getConversationHistory(userId);

    // Ajouter le nouveau message
    history.messages.push({
      role,
      content,
      timestamp: Date.now(),
    });

    // Limiter la taille de l'historique
    if (history.messages.length > this.maxHistoryLength) {
      // Garder les messages les plus récents
      history.messages = history.messages.slice(
        history.messages.length - this.maxHistoryLength,
      );
    }

    this.logger.log(
      `Message ajouté à l'historique de l'utilisateur ${userId}. Taille de l'historique: ${history.messages.length}`,
    );
  }

  private cleanupExpiredHistories(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [userId, history] of this.conversationHistories.entries()) {
      if (now - history.lastInteraction > this.historyTTL) {
        this.conversationHistories.delete(userId);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.logger.log(
        `${expiredCount} historiques de conversation expirés ont été supprimés`,
      );
    }
  }

  async analyser(request: AnalyseRequestDto): Promise<{ reponse: string }> {
    const { question, userId, useHistory = false } = request;

    // Vérifier si la réponse est dans le cache
    const cachedResponse = this.getFromCache(question);
    if (cachedResponse) {
      // Si l'historique est activé, ajouter la question et la réponse à l'historique
      if (useHistory && userId) {
        this.addToConversationHistory(userId, 'user', question);
        this.addToConversationHistory(userId, 'assistant', cachedResponse);
      }
      return { reponse: cachedResponse };
    }

    try {
      // Analyser la question pour déterminer l'intention et l'agent cible
      const analyse = await this.analyserQuestion(question);

      // Déterminer quels agents solliciter
      const needsStructuredData = this.requiresStructuredData(analyse);
      const needsTextSearch = this.requiresTextSearch(analyse);
      const needsKnowledge = this.requiresKnowledge(analyse);

      // Résultats de chaque agent
      let structuredResults = null;
      let searchResults = null;
      let knowledgeResults = null;

      // Appels parallèles aux différents agents
      const promises = [];

      if (needsStructuredData) {
        promises.push(
          this.queryBuilderClient
            .buildQuery(question)
            .then((result) => {
              structuredResults = result;
            })
            .catch((error) => {
              this.logger.error(
                `Erreur lors de l'appel à l'agent QueryBuilder: ${error.message}`,
              );
            }),
        );
      }

      if (needsTextSearch) {
        promises.push(
          this.elasticsearchClient
            .search(question)
            .then((result) => {
              searchResults = result;
            })
            .catch((error) => {
              this.logger.error(
                `Erreur lors de l'appel à l'agent Elasticsearch: ${error.message}`,
              );
            }),
        );
      }

      if (needsKnowledge) {
        promises.push(
          this.ragClient
            .getKnowledge(question)
            .then((result) => {
              knowledgeResults = result;
            })
            .catch((error) => {
              this.logger.error(
                `Erreur lors de l'appel à l'agent RAG: ${error.message}`,
              );
            }),
        );
      }

      // Attendre tous les résultats
      await Promise.all(promises);

      // Combiner les résultats
      let reponse = '';

      if (structuredResults && structuredResults.success) {
        reponse += `Données structurées: ${structuredResults.explanation}\n\n`;
        if (structuredResults.sql) {
          reponse += `Requête SQL: ${structuredResults.sql}\n\n`;
        }
      }

      if (
        searchResults &&
        searchResults.hits &&
        searchResults.hits.length > 0
      ) {
        reponse += `Résultats de recherche:\n`;
        searchResults.hits.forEach((hit, index) => {
          reponse += `${index + 1}. ${hit.title || hit._source.title || 'Document sans titre'}\n`;
        });
        reponse += '\n';
      }

      if (knowledgeResults && knowledgeResults.answer) {
        reponse += `Réponse basée sur la connaissance: ${knowledgeResults.answer}\n\n`;
      }

      // Si aucun résultat n'a été obtenu, router vers l'agent approprié
      if (!reponse) {
        const routerResponse = await this.routerService.routeRequest(
          request,
          analyse.agentCible,
        );
        reponse = routerResponse.reponse;
      }

      // Sauvegarder la réponse dans le cache
      this.saveToCache(question, reponse);

      // Si l'historique est activé, ajouter la question et la réponse à l'historique
      if (useHistory && userId) {
        this.addToConversationHistory(userId, 'user', question);
        this.addToConversationHistory(userId, 'assistant', reponse);
      }

      return { reponse };
    } catch (error) {
      this.logger.error(`Erreur lors de l'analyse: ${error.message}`);
      return {
        reponse: `Désolé, une erreur s'est produite lors de l'analyse de votre question. Veuillez réessayer.`,
      };
    }
  }

  private requiresStructuredData(analyse: AnalyseResult): boolean {
    // Vérifier si la question nécessite des données structurées (SQL)
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
      analyse.categorie === QuestionCategory.DATABASE ||
      analyse.agentCible === AgentType.DATABASE ||
      analyse.agentCible === AgentType.QUERYBUILDER ||
      databaseKeywords.some((keyword) =>
        analyse.questionCorrigee.toLowerCase().includes(keyword.toLowerCase()),
      )
    );
  }

  private requiresTextSearch(analyse: AnalyseResult): boolean {
    // Vérifier si la question nécessite une recherche textuelle
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
      analyse.categorie === QuestionCategory.SEARCH ||
      analyse.agentCible === AgentType.SEARCH ||
      analyse.agentCible === AgentType.ELASTICSEARCH ||
      searchKeywords.some((keyword) =>
        analyse.questionCorrigee.toLowerCase().includes(keyword.toLowerCase()),
      )
    );
  }

  private requiresKnowledge(analyse: AnalyseResult): boolean {
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

    return (
      analyse.agentCible === AgentType.RAG ||
      knowledgeKeywords.some((keyword) =>
        analyse.questionCorrigee.toLowerCase().includes(keyword.toLowerCase()),
      )
    );
  }

  async analyserQuestion(question: string): Promise<AnalyseResult> {
    this.logger.log(`Analyse de la question: ${question}`);

    // Mots-clés pour la détection de catégories
    const keywordsDatabase = [
      'base de données',
      'sql',
      'requête',
      'table',
      'données',
      'client',
      'projet',
      'facture',
      'paiement',
      "chiffre d'affaires",
      'ca',
      'trésorerie',
    ];

    const keywordsAPI = [
      'api',
      'endpoint',
      'service web',
      'rest',
      'json',
      'xml',
      'http',
      'post',
      'get',
      'authentification',
    ];

    const keywordsWorkflow = [
      'workflow',
      'processus',
      'étape',
      'validation',
      'approbation',
      'statut',
      'notification',
      'tâche',
      'assignation',
    ];

    const keywordsSearch = [
      'recherche',
      'chercher',
      'trouver',
      'document',
      'article',
      'texte',
      'contenu',
    ];

    // Détection simple basée sur les mots-clés
    let categorie = QuestionCategory.GENERAL;
    let agentCible = AgentType.GENERAL;

    // Vérifier les mots-clés pour la catégorie DATABASE
    if (
      keywordsDatabase.some((keyword) =>
        question.toLowerCase().includes(keyword.toLowerCase()),
      )
    ) {
      categorie = QuestionCategory.DATABASE;
      agentCible = AgentType.QUERYBUILDER;
    }
    // Vérifier les mots-clés pour la catégorie API
    else if (
      keywordsAPI.some((keyword) =>
        question.toLowerCase().includes(keyword.toLowerCase()),
      )
    ) {
      categorie = QuestionCategory.API;
      agentCible = AgentType.API;
    }
    // Vérifier les mots-clés pour la catégorie WORKFLOW
    else if (
      keywordsWorkflow.some((keyword) =>
        question.toLowerCase().includes(keyword.toLowerCase()),
      )
    ) {
      categorie = QuestionCategory.WORKFLOW;
      agentCible = AgentType.WORKFLOW;
    }
    // Vérifier les mots-clés pour la catégorie SEARCH
    else if (
      keywordsSearch.some((keyword) =>
        question.toLowerCase().includes(keyword.toLowerCase()),
      )
    ) {
      categorie = QuestionCategory.SEARCH;
      agentCible = AgentType.ELASTICSEARCH;
    }

    // Extraction simple des entités (à améliorer avec NLP)
    const entites = this.extraireEntites(question);

    // Déterminer la priorité (par défaut NORMAL)
    const priorite = this.determinerPriorite(question);

    return {
      questionCorrigee: question, // Pour l'instant, pas de correction
      intention: 'obtenir_information', // Intention par défaut
      categorie,
      agentCible,
      priorite,
      entites,
      contexte: '',
    };
  }

  private extraireEntites(question: string): string[] {
    // Implémentation simple pour extraire des entités
    // À améliorer avec des techniques NLP plus avancées
    const entites: string[] = [];

    // Liste de mots-clés potentiels à rechercher
    const entitiesPotentielles = [
      'client',
      'projet',
      'facture',
      'paiement',
      'utilisateur',
      'document',
      'tâche',
      'statut',
      'date',
      'montant',
    ];

    // Rechercher les entités potentielles dans la question
    entitiesPotentielles.forEach((entite) => {
      if (question.toLowerCase().includes(entite.toLowerCase())) {
        entites.push(entite);
      }
    });

    return entites;
  }

  private determinerPriorite(question: string): PrioriteType {
    // Mots-clés indiquant une urgence
    const keywordsUrgent = [
      'urgent',
      'immédiatement',
      'critique',
      'rapidement',
      'dès que possible',
      'important',
      'prioritaire',
    ];

    // Mots-clés indiquant une priorité basse
    const keywordsBasse = [
      'quand vous aurez le temps',
      'pas urgent',
      'basse priorité',
      'secondaire',
      'plus tard',
      'éventuellement',
    ];

    // Vérifier si la question contient des mots-clés d'urgence
    if (
      keywordsUrgent.some((keyword) =>
        question.toLowerCase().includes(keyword.toLowerCase()),
      )
    ) {
      return PrioriteType.URGENT;
    }

    // Vérifier si la question contient des mots-clés de priorité basse
    if (
      keywordsBasse.some((keyword) =>
        question.toLowerCase().includes(keyword.toLowerCase()),
      )
    ) {
      return PrioriteType.BASSE;
    }

    // Par défaut, priorité normale
    return PrioriteType.NORMAL;
  }

  async analyseDemande(
    request: AnalyseRequestDto,
  ): Promise<AnalyseResponseDto> {
    const { question } = request;

    try {
      // Construire le prompt pour l'API OpenAI
      const prompt = this.construirePrompt(request);

      // Appeler l'API OpenAI
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.openaiApiKey}`,
          },
        },
      );

      const openaiResponse = response.data as OpenAICompletionResponse;
      const jsonResponse = openaiResponse.choices[0].message.content;

      // Parser la réponse JSON
      return this.parserReponse(jsonResponse);
    } catch (error) {
      this.logger.error(`Erreur lors de l'analyse de la demande: ${error}`);
      // Retourner une réponse par défaut en cas d'erreur
      return {
        demandeId: Date.now().toString(),
        intentionPrincipale: {
          nom: 'erreur_analyse',
          confiance: 1.0,
          description: "Erreur lors de l'analyse de la demande",
        },
        sousIntentions: [],
        entites: [],
        niveauUrgence: PrioriteType.NORMAL,
        contraintes: [],
        contexte: '',
        timestamp: new Date(),
        questionCorrigee: question,
      };
    }
  }

  private construirePrompt(request: AnalyseRequestDto): string {
    const { question, context = '' } = request;

    // Utiliser le prompt prédéfini et remplacer les variables
    const prompt = analysePrompt
      .replace('{{QUESTION}}', question)
      .replace('{{CONTEXT}}', context || 'Aucun contexte fourni');

    return prompt;
  }

  private parserReponse(reponse: string): AnalyseResponseDto {
    try {
      // Essayer de parser la réponse JSON
      const parsedResponse = JSON.parse(reponse);

      // Valider et transformer la réponse
      return {
        demandeId: parsedResponse.demandeId || Date.now().toString(),
        intentionPrincipale: {
          nom: parsedResponse.intentionPrincipale?.nom || 'intention_inconnue',
          confiance: parsedResponse.intentionPrincipale?.confiance || 0.5,
          description:
            parsedResponse.intentionPrincipale?.description ||
            'Description non disponible',
        },
        sousIntentions: Array.isArray(parsedResponse.sousIntentions)
          ? parsedResponse.sousIntentions.map((si) => ({
              nom: si.nom || 'sous_intention_inconnue',
              description: si.description || 'Description non disponible',
              confiance: si.confiance || 0.5,
            }))
          : [],
        entites: Array.isArray(parsedResponse.entites)
          ? parsedResponse.entites
          : [],
        niveauUrgence: parsedResponse.niveauUrgence || PrioriteType.NORMAL,
        contraintes: Array.isArray(parsedResponse.contraintes)
          ? parsedResponse.contraintes
          : [],
        contexte: parsedResponse.contexte || '',
        timestamp: new Date(),
        questionCorrigee:
          parsedResponse.questionCorrigee || parsedResponse.question || '',
      };
    } catch (error) {
      this.logger.error(`Erreur lors du parsing de la réponse: ${error}`);

      // Retourner une réponse par défaut en cas d'erreur
      return {
        demandeId: Date.now().toString(),
        intentionPrincipale: {
          nom: 'erreur_parsing',
          confiance: 1.0,
          description: 'Erreur lors du parsing de la réponse',
        },
        sousIntentions: [],
        entites: [],
        niveauUrgence: PrioriteType.NORMAL,
        contraintes: [],
        contexte: '',
        timestamp: new Date(),
        questionCorrigee: '',
      };
    }
  }
}
