import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { OpenAIService } from './openai.service';
import { AnalyseRequestDto } from '../dto/analyse-request.dto';
import { PrioriteType } from '../interfaces/analyse.interface';
import { RouterService } from './router.service';
import {
  QueryBuilderClientService,
  ElasticsearchClientService,
  RagClientService,
} from './clients';

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface AnalyseAIResponse {
  categorie: QuestionCategory;
  explication: string;
  tables_concernees: string[];
  intention: string;
  entites: string[];
  periode_temporelle?: {
    debut?: string;
    fin?: string;
    precision?: string;
  };
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
  DATABASE = 'database',
  SEARCH = 'search',
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
  metadonnees?: {
    tablesConcernees: string[];
    tablesIdentifiees?: {
      principales: Array<{ nom: string; alias?: string; colonnes?: string[] }>;
      jointures: Array<{ nom: string; alias?: string; colonnes?: string[] }>;
      conditions: string[];
    };
    champsRequis?: {
      selection: string[];
      filtres: string[];
      groupement: string[];
    };
    filtres?: {
      temporels: string[];
      logiques: string[];
    };
    periodeTemporelle?: {
      debut?: string;
      fin?: string;
      precision?: string;
    };
    parametresRequete?: {
      tri: string[];
      limite: number;
    };
  };
}

interface PeriodeTemporelle {
  debut: string;
  fin: string;
  precision: 'JOUR' | 'SEMAINE' | 'MOIS';
  type: 'DYNAMIQUE' | 'FIXE';
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
    private readonly openaiService: OpenAIService,
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

      // 4. Pour les questions générales, utiliser OpenAI
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

      const response = await axios.post<OpenAIResponse>(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages,
          temperature: 0.2,
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
      analyse.agentCible === AgentType.QUERYBUILDER ||
      databaseKeywords.some((keyword) =>
        analyse.questionCorrigee.toLowerCase().includes(keyword.toLowerCase()),
      )
    );
  }

  private requiresTextSearch(analyse: AnalyseResult): boolean {
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

  private calculerDatesDynamiques(periodeTemporelle: PeriodeTemporelle): {
    debut: string;
    fin: string;
  } {
    const aujourdhui = new Date();

    if (periodeTemporelle.type === 'DYNAMIQUE') {
      if (periodeTemporelle.precision === 'SEMAINE') {
        const debutSemaine = new Date(aujourdhui);
        debutSemaine.setDate(
          aujourdhui.getDate() + 7 - aujourdhui.getDay() + 1,
        );

        const finSemaine = new Date(debutSemaine);
        finSemaine.setDate(debutSemaine.getDate() + 6);

        return {
          debut: debutSemaine.toISOString().split('T')[0],
          fin: finSemaine.toISOString().split('T')[0],
        };
      }

      if (periodeTemporelle.precision === 'MOIS') {
        const debutMois = new Date(
          aujourdhui.getFullYear(),
          aujourdhui.getMonth() + 1,
          1,
        );
        const finMois = new Date(
          aujourdhui.getFullYear(),
          aujourdhui.getMonth() + 2,
          0,
        );

        return {
          debut: debutMois.toISOString().split('T')[0],
          fin: finMois.toISOString().split('T')[0],
        };
      }
    }

    return {
      debut: periodeTemporelle.debut,
      fin: periodeTemporelle.fin,
    };
  }

  async analyserQuestion(question: string): Promise<AnalyseResult> {
    this.logger.log(`Analyse de la question: ${question}`);

    try {
      const prompt = [
        "En tant qu'assistant spécialisé pour Technidalle, analyse la question suivante :",
        '',
        `Question : "${question}"`,
        '',
        'INSTRUCTIONS IMPORTANTES :',
        '1. Détecter les expressions temporelles comme :',
        '   - "semaine pro/prochaine" -> calculer les dates exactes à partir de la date actuelle',
        '   - "mois prochain" -> calculer les dates exactes à partir de la date actuelle',
        '   - "entre [date1] et [date2]" -> extraire les dates',
        '   - "du [date1] au [date2]" -> extraire les dates',
        '   - "à partir du [date]" -> extraire la date de début',
        '   - "jusqu\'au [date]" -> extraire la date de fin',
        '',
        '2. Pour les questions sur le personnel :',
        '   - Inclure les tables : staff, project_staff, calendar_events',
        '   - Ajouter la condition : staff.is_available = true',
        '   - Calculer les dates dynamiquement (ex: semaine prochaine = date_actuelle + 7 jours)',
        '',
        'Format de réponse JSON attendu :',
        '{',
        '  "questionCorrigee": "...",',
        '  "intention": "verifier_disponibilite|consulter_planning|...",',
        '  "categorie": "DATABASE",',
        '  "metadonnees": {',
        '    "tablesIdentifiees": {',
        '      "principales": [{"nom": "staff"}],',
        '      "jointures": [{"nom": "project_staff"}, {"nom": "calendar_events"}],',
        '      "conditions": ["staff.is_available = true"]',
        '    },',
        '    "periodeTemporelle": {',
        '      "debut": "YYYY-MM-DD",',
        '      "fin": "YYYY-MM-DD",',
        '      "precision": "JOUR|SEMAINE|MOIS",',
        '      "type": "DYNAMIQUE|FIXE"',
        '    }',
        '  }',
        '}',
      ].join('\n');

      const completion = await this.openaiService.createCompletion({
        model:
          this.configService.get<string>('OPENAI_MODEL') ||
          'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: prompt,
          },
          {
            role: 'user',
            content: question,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      if (!completion?.choices?.[0]?.message?.content) {
        throw new Error('Format de réponse OpenAI invalide');
      }

      const analysedResponse = JSON.parse(
        completion.choices[0].message.content,
      ) as {
        questionCorrigee: string;
        intention: string;
        categorie: QuestionCategory;
        metadonnees: {
          tablesIdentifiees: {
            principales: Array<{ nom: string }>;
            jointures: Array<{ nom: string }>;
            conditions: string[];
          };
          periodeTemporelle?: {
            debut: string;
            fin: string;
            precision: string;
          };
        };
      };

      // Calculer les dates dynamiques si nécessaire
      if (analysedResponse.metadonnees.periodeTemporelle) {
        const periodeAvecType = {
          ...analysedResponse.metadonnees.periodeTemporelle,
          type: 'DYNAMIQUE' as const,
          precision: analysedResponse.metadonnees.periodeTemporelle.precision as 'JOUR' | 'SEMAINE' | 'MOIS',
        };
        const dates = this.calculerDatesDynamiques(periodeAvecType);
        analysedResponse.metadonnees.periodeTemporelle.debut = dates.debut;
        analysedResponse.metadonnees.periodeTemporelle.fin = dates.fin;
      }

      return {
        questionCorrigee: question,
        intention: analysedResponse.intention,
        categorie: analysedResponse.categorie,
        agentCible: this.determinerAgent(analysedResponse.categorie),
        priorite: PrioriteType.NORMAL,
        entites: [],
        contexte: '',
        metadonnees: {
          tablesConcernees:
            analysedResponse.metadonnees.tablesIdentifiees.principales.map(
              (t) => t.nom,
            ),
          tablesIdentifiees: analysedResponse.metadonnees.tablesIdentifiees,
          champsRequis: {
            selection: [],
            filtres: [],
            groupement: [],
          },
          filtres: {
            temporels: [],
            logiques: [],
          },
          periodeTemporelle: analysedResponse.metadonnees.periodeTemporelle,
          parametresRequete: {
            tri: [],
            limite: 100,
          },
        },
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'analyse de la question: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  private determinerAgent(categorie: QuestionCategory): AgentType {
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
}
