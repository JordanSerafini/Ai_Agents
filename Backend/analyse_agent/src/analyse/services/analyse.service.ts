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
import {
  QueryBuilderResponse,
  SearchResponse,
  KnowledgeResponse,
  QueryBuilderClientResponse,
  ElasticsearchClientResponse,
  RagClientResponse,
} from '../interfaces/client-responses.interface';

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
  DATABASE = 'DATABASE',
  SEARCH = 'SEARCH',
  KNOWLEDGE = 'KNOWLEDGE',
  WORKFLOW = 'WORKFLOW',
}

// Types d'agents disponibles
export enum AgentType {
  GENERAL = 'general',
  QUERYBUILDER = 'querybuilder',
  ELASTICSEARCH = 'elasticsearch',
  RAG = 'rag',
  WORKFLOW = 'workflow',
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
    let history = this.conversationHistories.get(userId);
    if (!history) {
      history = {
        messages: [],
        lastInteraction: Date.now(),
      };
      this.conversationHistories.set(userId, history);
    }
    history.lastInteraction = Date.now();
    return history;
  }

  private addToConversationHistory(
    userId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
  ): ConversationHistory {
    const history = this.getConversationHistory(userId);
    history.messages.push({
      role,
      content,
      timestamp: Date.now(),
    });
    if (history.messages.length > this.maxHistoryLength) {
      history.messages.shift();
    }
    history.lastInteraction = Date.now();
    return history;
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
    const cacheKey = this.getCacheKey(question);

    try {
      // 1. Analyser d'abord la question
      const analyse = await this.analyserQuestion(question);

      // 2. Vérifier le cache UNIQUEMENT pour les questions générales
      if (analyse.agentCible === AgentType.GENERAL) {
        const cachedResponse = this.getFromCache(cacheKey);
        if (cachedResponse) {
          if (useHistory && userId) {
            this.addToConversationHistory(userId, 'user', question);
            this.addToConversationHistory(userId, 'assistant', cachedResponse);
          }
          return { reponse: cachedResponse };
        }
      }

      // 3. Router vers l'agent approprié si ce n'est pas GENERAL
      if (analyse.agentCible !== AgentType.GENERAL) {
        this.logger.log(
          `Routage de la requête vers l'agent: ${analyse.agentCible}`,
        );

        // Ne pas utiliser le cache pour les requêtes routées
        const routedResponse = await this.routerService.routeRequest(
          request,
          analyse.agentCible,
          analyse as unknown as Record<string, unknown>,
        );

        if (useHistory && userId) {
          this.addToConversationHistory(userId, 'user', question);
          this.addToConversationHistory(
            userId,
            'assistant',
            routedResponse.reponse,
          );
        }

        return routedResponse;
      }

      // 4. Pour les questions générales, utiliser OpenAI avec température plus basse
      const messages = [
        {
          role: 'system',
          content: `Tu es un assistant IA expert pour Technidalle, une entreprise de bâtiment. 
La question a été classifiée comme "${analyse.categorie}" avec l'intention principale: "${analyse.intention}".
Fournis une réponse détaillée et informative en français (3-5 phrases) qui répond précisément à la question.
Si la question concerne des informations générales sur le bâtiment, les matériaux ou les services, donne des explications complètes.
Utilise un ton professionnel et adapté au secteur du bâtiment.`,
        },
        {
          role: 'user',
          content: analyse.questionCorrigee,
        },
      ];

      const response = await axios.post<OpenAICompletionResponse>(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages,
          temperature: 0.2, // Température plus basse pour plus de cohérence
          max_tokens: 500,
        },
        {
          headers: {
            Authorization: `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );

      const reponse = response.data.choices[0].message.content.trim();

      // Mettre en cache UNIQUEMENT les réponses générales
      this.saveToCache(cacheKey, reponse);

      if (useHistory && userId) {
        this.addToConversationHistory(userId, 'user', question);
        this.addToConversationHistory(userId, 'assistant', reponse);
      }

      return { reponse };
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'analyse: ${(error as Error).message}`,
      );
      return {
        reponse:
          "Désolé, une erreur s'est produite lors de l'analyse de votre question.",
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

    try {
      const prompt = this.construirePrompt({ question });
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1500,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.openaiApiKey}`,
          },
          timeout: 15000, // Timeout après 15 secondes
          validateStatus: (status) => status === 200, // Valider uniquement le statut 200
        },
      );

      if (!response.data?.choices?.[0]?.message?.content) {
        throw new Error('Format de réponse OpenAI invalide');
      }

      const openaiResponse = response.data as OpenAICompletionResponse;
      const analysedResponse = this.parserReponse(
        openaiResponse.choices[0].message.content,
      );

      return {
        questionCorrigee: analysedResponse.questionCorrigee || question,
        intention: analysedResponse.intentionPrincipale.nom,
        categorie: this.determinerCategorie(
          analysedResponse.intentionPrincipale.nom,
        ),
        agentCible: this.determinerAgent(
          analysedResponse.intentionPrincipale.nom,
        ),
        priorite: analysedResponse.niveauUrgence,
        entites: analysedResponse.entites,
        contexte: analysedResponse.contexte,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'analyse de la question: ${(error as Error).message}`,
      );
      return {
        questionCorrigee: question,
        intention: 'obtenir_information',
        categorie: QuestionCategory.GENERAL,
        agentCible: AgentType.GENERAL,
        priorite: PrioriteType.NORMAL,
        entites: [],
        contexte: '',
      };
    }
  }

  private determinerCategorie(intention: string): QuestionCategory {
    if (intention.toLowerCase().includes('base') || intention.toLowerCase().includes('sql') || intention.toLowerCase().includes('données')) {
      return QuestionCategory.DATABASE;
    }
    if (intention.toLowerCase().includes('recherche') || intention.toLowerCase().includes('trouver')) {
      return QuestionCategory.SEARCH;
    }
    if (intention.toLowerCase().includes('workflow') || intention.toLowerCase().includes('processus')) {
      return QuestionCategory.WORKFLOW;
    }
    return QuestionCategory.GENERAL;
  }

  private determinerAgent(intention: string): AgentType {
    // Questions liées aux données structurées (chantiers, montants, personnel)
    if (
      intention.toLowerCase().includes('chantier') ||
      intention.toLowerCase().includes('montant') ||
      intention.toLowerCase().includes('projet') ||
      intention.toLowerCase().includes('coût') ||
      intention.toLowerCase().includes('facture') ||
      intention.toLowerCase().includes('personnel') ||
      intention.toLowerCase().includes('planning') ||
      intention.toLowerCase().includes('disponibilite') ||
      intention.toLowerCase().includes('horaire') ||
      intention.toLowerCase().includes('travail') ||
      intention.toLowerCase().includes('base') ||
      intention.toLowerCase().includes('sql') ||
      intention.toLowerCase().includes('données')
    ) {
      return AgentType.QUERYBUILDER;
    }

    // Questions de recherche
    if (
      intention.toLowerCase().includes('recherche') ||
      intention.toLowerCase().includes('trouver') ||
      intention.toLowerCase().includes('chercher')
    ) {
      return AgentType.ELASTICSEARCH;
    }

    // Questions nécessitant des connaissances
    if (
      intention.toLowerCase().includes('comment') ||
      intention.toLowerCase().includes('pourquoi') ||
      intention.toLowerCase().includes('expliquer')
    ) {
      return AgentType.RAG;
    }

    // Questions liées aux processus
    if (
      intention.toLowerCase().includes('workflow') ||
      intention.toLowerCase().includes('processus') ||
      intention.toLowerCase().includes('étape')
    ) {
      return AgentType.WORKFLOW;
    }

    return AgentType.GENERAL;
  }

  private construirePrompt(request: AnalyseRequestDto): string {
    const { question } = request;
    return analysePrompt(question);
  }

  private parserReponse(reponse: string): AnalyseResponseDto {
    try {
      const parsedResponse = JSON.parse(reponse) as {
        demandeId?: string;
        intentionPrincipale?: {
          nom?: string;
          confiance?: number;
          description?: string;
        };
        sousIntentions?: Array<{
          nom?: string;
          description?: string;
          confiance?: number;
        }>;
        entites?: string[];
        niveauUrgence?: PrioriteType;
        contraintes?: string[];
        contexte?: string;
        questionCorrigee?: string;
        question?: string;
      };

      return {
        demandeId: parsedResponse.demandeId || Date.now().toString(),
        intentionPrincipale: {
          nom: parsedResponse.intentionPrincipale?.nom || 'intention_inconnue',
          confiance: parsedResponse.intentionPrincipale?.confiance || 0.5,
          description:
            parsedResponse.intentionPrincipale?.description ||
            'Description non disponible',
        },
        sousIntentions:
          parsedResponse.sousIntentions?.map((si) => ({
            nom: si.nom || 'sous_intention_inconnue',
            description: si.description || 'Description non disponible',
            confiance: si.confiance || 0.5,
          })) || [],
        entites: parsedResponse.entites || [],
        niveauUrgence: parsedResponse.niveauUrgence || PrioriteType.NORMAL,
        contraintes: parsedResponse.contraintes || [],
        contexte: parsedResponse.contexte || '',
        timestamp: new Date(),
        questionCorrigee:
          parsedResponse.questionCorrigee || parsedResponse.question || '',
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors du parsing de la réponse: ${(error as Error).message}`,
      );
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

  private async getStructuredData(
    question: string,
  ): Promise<QueryBuilderResponse> {
    try {
      const response = (await this.queryBuilderClient.buildQuery(
        question,
      )) as QueryBuilderClientResponse;
      return {
        explanation: response.explanation || '',
        sql: response.sql || '',
        data: response.data || null,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des données structurées: ${error}`,
      );
      return {
        error: `Erreur lors de la récupération des données structurées: ${error}`,
      };
    }
  }

  private async getSearchResults(question: string): Promise<SearchResponse> {
    try {
      const response = (await this.elasticsearchClient.search(
        question,
      )) as ElasticsearchClientResponse;
      return {
        hits: {
          hits: response.hits.hits || [],
          total: response.hits.total || 0,
        },
      };
    } catch (error) {
      this.logger.error(`Erreur lors de la recherche: ${error}`);
      return {
        hits: {
          hits: [],
          total: 0,
        },
        error: `Erreur lors de la recherche: ${error}`,
      };
    }
  }

  private async getKnowledgeResults(
    question: string,
  ): Promise<KnowledgeResponse> {
    try {
      const response = (await this.ragClient.getKnowledge(
        question,
      )) as RagClientResponse;
      return {
        answer: response.answer || '',
        confidence: response.confidence || 0,
        knowledge: response.knowledge || [],
        sources: response.sources || [],
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des connaissances: ${error}`,
      );
      return {
        error: `Erreur lors de la récupération des connaissances: ${error}`,
      };
    }
  }
}
