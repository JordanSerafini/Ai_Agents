import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
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

  async analyserQuestion(question: string): Promise<AnalyseResult> {
    this.logger.log(`Analyse de la question: ${question}`);

    try {
      const structureBDD = `
Tables principales:
- staff: Informations sur le personnel (id, name, email, role, is_available)
- projects: Projets en cours (id, name, description, client_id, start_date, end_date, status)
- clients: Clients de l'entreprise (id, name, email, phone, address)
- timesheet_entries: Heures travaillées (id, staff_id, project_id, date, hours, description)
- calendar_events: Événements du calendrier (id, staff_id, title, start_date, end_date, type)
- project_staff: Affectation du personnel aux projets (project_id, staff_id, role, start_date, end_date)
- tasks: Tâches à réaliser (id, project_id, title, description, status, priority, assigned_to, due_date)
- documents: Documents liés aux projets (id, project_id, title, file_path, upload_date, type)
- invoices: Factures (id, client_id, project_id, amount, issue_date, due_date, status)
- payments: Paiements reçus (id, invoice_id, amount, payment_date, method)
- quotations: Devis (id, client_id, project_id, amount, issue_date, valid_until, status)
- materials: Matériaux utilisés (id, name, unit, unit_price, stock_quantity)
- project_materials: Matériaux utilisés par projet (project_id, material_id, quantity, cost)
`;

      const prompt = [
        "En tant qu'assistant spécialisé pour Technidalle, une entreprise de bâtiment, analyse la question suivante en tenant compte de la structure de notre base de données :",
        '',
        `Question : "${question}"`,
        '',
        'Structure de la base de données :',
        structureBDD,
        '',
        'Analyse la question et détermine :',
        '1. Si elle nécessite une requête SQL (DATABASE)',
        '2. Si elle nécessite une recherche textuelle (SEARCH)',
        '3. Si elle nécessite des connaissances générales (KNOWLEDGE)',
        '4. Si elle concerne un processus métier (WORKFLOW)',
        "5. Si c'est une question générale (GENERAL)",
        '',
        'Pour les questions de type DATABASE, identifie précisément :',
        '- Les tables principales concernées',
        '- Les jointures nécessaires',
        '- Les conditions de filtrage (notamment temporelles)',
        '- Les champs à sélectionner',
        '- Si la question concerne une période spécifique (semaine prochaine, mois prochain, etc.)',
        '',
        'IMPORTANT pour les périodes temporelles :',
        '- Si la question mentionne "semaine prochaine" ou "semaine pro", calcule les dates réelles',
        "- Aujourd'hui nous sommes le " +
          new Date().toISOString().split('T')[0],
        '- La semaine prochaine commence le ' +
          (() => {
            const today = new Date();
            const nextMonday = new Date(today);
            nextMonday.setDate(today.getDate() + ((8 - today.getDay()) % 7));
            return nextMonday.toISOString().split('T')[0];
          })(),
        '- La semaine prochaine se termine le ' +
          (() => {
            const today = new Date();
            const nextMonday = new Date(today);
            nextMonday.setDate(today.getDate() + ((8 - today.getDay()) % 7));
            const nextSunday = new Date(nextMonday);
            nextSunday.setDate(nextMonday.getDate() + 6);
            return nextSunday.toISOString().split('T')[0];
          })(),
        '',
        'IMPORTANT pour les questions sur le personnel et la disponibilité :',
        '- Inclure toujours les tables "staff", "project_staff" et "calendar_events"',
        '- La disponibilité est indiquée par le champ "is_available" dans la table "staff"',
        '- Les affectations aux projets sont dans la table "project_staff"',
        '- Les événements du calendrier sont dans la table "calendar_events"',
        '',
        'IMPORTANT: Réponds UNIQUEMENT avec un objet JSON valide, sans formatage supplémentaire (pas de backticks, pas de "```json", etc.) :',
        '{',
        '  "categorie": "DATABASE|SEARCH|KNOWLEDGE|WORKFLOW|GENERAL",',
        '  "explication": "Explique pourquoi cette catégorie",',
        '  "tables_concernees": ["nom_table1", "nom_table2"],',
        '  "intention": "Description de l\'intention",',
        '  "entites": ["entité1", "entité2"],',
        '  "periode_temporelle": {',
        '    "debut": "YYYY-MM-DD",',
        '    "fin": "YYYY-MM-DD",',
        '    "precision": "JOUR|SEMAINE|MOIS"',
        '  }',
        '}',
      ].join('\n');

      const response = await axios.post<OpenAIResponse>(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content:
                "Tu es un assistant spécialisé dans l'analyse de questions pour une entreprise de bâtiment. Tu réponds UNIQUEMENT avec un objet JSON valide, sans formatage supplémentaire.",
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.2,
          max_tokens: 1000,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.openaiApiKey}`,
          },
          timeout: 15000,
        },
      );

      if (!response.data?.choices?.[0]?.message?.content) {
        throw new Error('Format de réponse OpenAI invalide');
      }

      const analysedResponse = JSON.parse(
        response.data.choices[0].message.content,
      ) as AnalyseAIResponse;

      return {
        questionCorrigee: question,
        intention: analysedResponse.intention,
        categorie: analysedResponse.categorie,
        agentCible: this.determinerAgent(analysedResponse.categorie),
        priorite: PrioriteType.NORMAL,
        entites: analysedResponse.entites,
        contexte: analysedResponse.explication,
        metadonnees: {
          tablesConcernees: analysedResponse.tables_concernees,
          tablesIdentifiees: {
            principales: analysedResponse.tables_concernees.map((table) => ({
              nom: table,
            })),
            jointures: [],
            conditions: [],
          },
          champsRequis: {
            selection: [],
            filtres: [],
            groupement: [],
          },
          filtres: {
            temporels: [],
            logiques: [],
          },
          periodeTemporelle: analysedResponse.periode_temporelle || {},
          parametresRequete: {
            tri: [],
            limite: 100,
          },
        },
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
