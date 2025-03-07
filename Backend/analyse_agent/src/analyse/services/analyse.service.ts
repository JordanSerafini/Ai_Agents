import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { OpenAIService } from './openai.service';
import { PrioriteType } from '../interfaces/analyse.interface';
import { RouterService } from './router.service';
import {
  QueryBuilderClientService,
  ElasticsearchClientService,
  RagClientService,
} from './clients';
import { UserQuestionDto } from '../dto/user-question.dto';

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface AnalyseAIResponse {
  tables: string[];
  selects: string[];
  joins?: Array<{
    table: string;
    condition: string;
  }>;
  filters?: string[];
  groupBy?: string[];
  orderBy?: string[];
  limit?: number;
  metadata?: {
    intention: string;
    description: string;
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
  reponseAgent?: any;
  metadonnees?: {
    tablesConcernees: string[];
    periodeTemporelle?: PeriodeTemporelle;
    tablesIdentifiees?: {
      principales: Array<{ nom: string; alias?: string; colonnes?: string[] }>;
      jointures: Array<{
        nom: string;
        alias?: string;
        colonnes?: string[];
        condition?: string;
      }>;
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
    parametresRequete?: {
      tri: string[];
      limite: number;
    };
  };
}

interface PeriodeTemporelle {
  debut: string;
  fin: string;
  precision: 'JOUR' | 'SEMAINE' | 'MOIS' | 'ANNEE';
  type: 'DYNAMIQUE' | 'FIXE';
}

interface StaffEvent {
  id: number;
  firstname: string;
  lastname: string;
  title: string;
  start_date: string;
  end_date: string;
  location: string;
}

interface RouterResponse {
  reponse: string;
  resultats?: StaffEvent[];
}

export interface AnalyseQueryData {
  tables: Array<{
    nom: string;
    alias: string;
    type: 'PRINCIPALE' | 'JOINTE';
    colonnes: string[];
    condition_jointure?: string;
  }>;
  conditions?: Array<{
    type: 'FILTRE' | 'TEMPOREL';
    expression: string;
    parametres?: Record<string, unknown>;
  }>;
  groupBy?: string[];
  orderBy?: string[];
  limit?: number;
  metadata?: {
    intention: string;
    description: string;
  };
}

/**
 * Interface pour la réponse d'analyse sémantique structurée
 */
export interface AnalyseSemantiqueResponse {
  analyse_semantique: {
    intention: {
      action: string;
      objectif: string;
    };
    temporalite: {
      periode: {
        type: 'DYNAMIQUE' | 'FIXE';
        precision: 'JOUR' | 'SEMAINE' | 'MOIS' | 'ANNEE';
        reference: 'PASSÉ' | 'PRESENT' | 'FUTUR';
      };
      dates: {
        debut?: string;
        fin?: string;
      };
    };
    entites: {
      principale: {
        nom: string;
        attributs: string[];
      };
      secondaires: Array<{
        nom: string;
        relation: string;
        attributs: string[];
      }>;
    };
    contraintes: {
      explicites: string[];
      implicites: string[];
    };
    informations_demandees: {
      champs: string[];
      agregations: string[];
      ordre: string[];
    };
  };
  structure_requete: {
    tables: Array<{
      nom: string;
      alias: string;
      type: 'PRINCIPALE' | 'JOINTE';
      colonnes: string[];
      condition_jointure?: string;
    }>;
    conditions: Array<{
      type: 'TEMPOREL' | 'LOGIQUE';
      expression: string;
      parametres?: Record<string, unknown>;
    }>;
    groupements: string[];
    ordre: string[];
  };
  validation: {
    colonnes_verifiees: boolean;
    relations_coherentes: boolean;
    types_compatibles: boolean;
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
    private readonly ragClientService: RagClientService,
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

  private formaterReponseDisponibilite(resultats: StaffEvent[]): string {
    // Regrouper par employé
    const employes = new Map<
      number,
      {
        nom: string;
        evenements: Array<{
          titre: string;
          debut: Date;
          fin: Date;
          lieu: string;
        }>;
      }
    >();

    resultats.forEach((r: StaffEvent) => {
      if (!employes.has(r.id)) {
        employes.set(r.id, {
          nom: `${r.firstname} ${r.lastname}`,
          evenements: [],
        });
      }

      if (r.title) {
        const employe = employes.get(r.id);
        if (employe) {
          employe.evenements.push({
            titre: r.title,
            debut: new Date(r.start_date),
            fin: new Date(r.end_date),
            lieu: r.location,
          });
        }
      }
    });

    // Construire la réponse
    const dateDebut = new Date(resultats[0]?.start_date);
    const dateFin = new Date(resultats[0]?.end_date);
    const semaine = dateDebut
      ? `du ${dateDebut.toLocaleDateString('fr-FR')} au ${dateFin.toLocaleDateString('fr-FR')}`
      : 'la semaine prochaine';

    let reponse = `Pour ${semaine}, voici la situation :\n\n`;

    employes.forEach((employe) => {
      reponse += `${employe.nom} :\n`;
      if (employe.evenements.length > 0) {
        reponse += 'Événements prévus :\n';
        employe.evenements.forEach((evt) => {
          const heureDebut = evt.debut.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          });
          const heureFin = evt.fin.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          });
          const date = evt.debut.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          });
          reponse += `- ${date} de ${heureDebut} à ${heureFin} : ${evt.titre} à ${evt.lieu}\n`;
        });
      } else {
        reponse += 'Entièrement disponible\n';
      }
      reponse += '\n';
    });

    return reponse;
  }

  async analyser(request: UserQuestionDto): Promise<{ reponse: string }> {
    const { question, userId, useHistory = false } = request;
    const cacheKey = this.getCacheKey(question);

    try {
      const analyse = await this.analyserQuestion(request);

      if (analyse.agentCible !== AgentType.GENERAL) {
        this.logger.log(
          `Routage de la requête vers l'agent: ${analyse.agentCible}`,
        );

        const routedResponse = (await this.routerService.routeRequest(
          request,
          analyse.agentCible,
          analyse as unknown as Record<string, unknown>,
        )) as RouterResponse;

        if (useHistory && userId) {
          this.addToConversationHistory(userId, 'user', question);
          this.addToConversationHistory(
            userId,
            'assistant',
            routedResponse.reponse,
          );
        }

        if (
          analyse.intention === 'verifier_disponibilite' &&
          routedResponse.resultats
        ) {
          return {
            reponse: this.formaterReponseDisponibilite(
              routedResponse.resultats,
            ),
          };
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

  private extractPlaceholders(expression: string): string[] {
    const regex = /:(\w+)/g;
    const placeholders: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(expression)) !== null) {
      placeholders.push(match[1]);
    }
    return placeholders;
  }

  private generateTemporalParameters(
    placeholders: string[],
    dates: { debut: string; fin: string },
  ): Record<string, string> {
    return placeholders.reduce(
      (params: Record<string, string>, placeholder) => {
        if (placeholder.includes('debut')) {
          params[placeholder] = dates.debut;
        } else if (placeholder.includes('fin')) {
          params[placeholder] = dates.fin;
        } else {
          this.logger.warn(`Placeholder non reconnu: ${placeholder}`);
          params[placeholder] = dates.debut; // Valeur par défaut
        }
        return params;
      },
      {},
    );
  }

  private calculerDatesDynamiques(periode: {
    type: 'DYNAMIQUE' | 'FIXE';
    precision: 'JOUR' | 'SEMAINE' | 'MOIS' | 'ANNEE';
    reference?: 'PASSÉ' | 'PRESENT' | 'FUTUR';
    debut?: string;
    fin?: string;
  }): { debut: string; fin: string } {
    const aujourdhui = new Date();

    if (periode.type === 'DYNAMIQUE') {
      if (periode.precision === 'SEMAINE') {
        // Calcul pour la semaine prochaine
        const debutSemaine = new Date(aujourdhui);
        debutSemaine.setDate(aujourdhui.getDate() + (8 - aujourdhui.getDay()));

        const finSemaine = new Date(debutSemaine);
        finSemaine.setDate(debutSemaine.getDate() + 6);

        return {
          debut: debutSemaine.toISOString().split('T')[0],
          fin: finSemaine.toISOString().split('T')[0],
        };
      }

      if (periode.precision === 'MOIS') {
        // Calcul pour le mois prochain
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

    // Si période fixe ou autre précision
    return {
      debut: periode.debut || aujourdhui.toISOString().split('T')[0],
      fin: periode.fin || aujourdhui.toISOString().split('T')[0],
    };
  }

  async analyserQuestion(request: UserQuestionDto): Promise<AnalyseResult> {
    try {
      this.logger.log(`Analyse de la question: ${request.question}`);

      // Récupérer l'historique des conversations si disponible
      const userId = request.userId || 'anonymous';
      if (request.useHistory) {
        this.addToConversationHistory(userId, 'user', request.question);
      }

      // Vérifier si la réponse est dans le cache
      const cachedResponse = this.getFromCache(request.question);
      if (cachedResponse) {
        this.logger.log('Réponse trouvée dans le cache');
        return JSON.parse(cachedResponse);
      }

      try {
        // Utiliser le nouvel OpenAIService avec le prompt externalisé
        const analysisResult = (await this.openaiService.analyseQuestion(
          request.question,
          'semantic-analysis',
        )) as AnalyseSemantiqueResponse;

        // Valider la structure de la réponse
        if (!this.validerStructureAnalyse(analysisResult)) {
          throw new Error('Format de réponse invalide');
        }

        try {
          // Construire la requête structurée
          const structuredQuery: AnalyseQueryData = {
            tables: analysisResult.structure_requete.tables.map((table) => ({
              nom: table.nom,
              alias: table.alias || table.nom.toLowerCase(),
              type: table.type || 'PRINCIPALE',
              colonnes: Array.isArray(table.colonnes) ? table.colonnes : ['*'],
              condition_jointure:
                table.type === 'JOINTE'
                  ? table.condition_jointure ||
                    `${table.alias || table.nom.toLowerCase()}.id = principale.${table.nom.toLowerCase()}_id`
                  : undefined,
            })),
            conditions: analysisResult.structure_requete.conditions.map(
              (cond) => {
                if (cond.type === 'TEMPOREL') {
                  return {
                    type: 'TEMPOREL',
                    expression:
                      'EXTRACT(MONTH FROM i.issue_date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM i.issue_date) = EXTRACT(YEAR FROM CURRENT_DATE)',
                    parametres: {},
                  };
                }
                // S'assurer que tous les paramètres sont extraits de l'expression
                const placeholders = this.extractPlaceholders(cond.expression);
                const parametres = cond.parametres || {};

                // Remplir les paramètres manquants avec des valeurs par défaut
                placeholders.forEach((placeholder) => {
                  if (!parametres[placeholder] && placeholder === 'type') {
                    parametres[placeholder] = 'chantier'; // Valeur par défaut pour le type
                  }
                });

                return {
                  type: 'FILTRE' as const,
                  expression: cond.expression,
                  parametres: parametres,
                };
              },
            ),
            groupBy: analysisResult.structure_requete.groupements || [],
            orderBy: analysisResult.structure_requete.ordre || [],
            metadata: {
              intention:
                analysisResult.analyse_semantique.intention.action ||
                'RECHERCHE',
              description:
                analysisResult.analyse_semantique.intention.objectif ||
                'Recherche générale',
            },
          };

          try {
            // Envoyer la requête au QueryBuilder
            const queryResult =
              await this.queryBuilderClient.buildQuery(structuredQuery);

            const result = {
              intention: analysisResult.analyse_semantique.intention.action,
              categorie: this.determinerCategorie(
                analysisResult.analyse_semantique.intention.action,
              ),
              agentCible: AgentType.QUERYBUILDER,
              priorite: PrioriteType.NORMAL,
              entites: [
                analysisResult.analyse_semantique.entites.principale.nom,
              ],
              contexte: analysisResult.analyse_semantique.intention.objectif,
              questionCorrigee: request.question,
              metadonnees: {
                tablesConcernees: structuredQuery.tables.map((t) => t.nom),
                periodeTemporelle: {
                  debut: this.calculerDatesDynamiques(
                    analysisResult.analyse_semantique.temporalite.periode,
                  ).debut,
                  fin: this.calculerDatesDynamiques(
                    analysisResult.analyse_semantique.temporalite.periode,
                  ).fin,
                  precision:
                    analysisResult.analyse_semantique.temporalite.periode
                      .precision,
                  type: analysisResult.analyse_semantique.temporalite.periode
                    .type,
                },
                tablesIdentifiees: {
                  principales: analysisResult.structure_requete.tables
                    .filter((t) => t.type === 'PRINCIPALE')
                    .map((t) => ({
                      nom: t.nom,
                      alias: t.alias,
                      colonnes: t.colonnes,
                    })),
                  jointures: analysisResult.structure_requete.tables
                    .filter((t) => t.type === 'JOINTE')
                    .map((t) => ({
                      nom: t.nom,
                      alias: t.alias,
                      colonnes: t.colonnes,
                      condition: t.condition_jointure,
                    })),
                  conditions: analysisResult.structure_requete.conditions.map(
                    (c) => c.expression,
                  ),
                },
                filtres: {
                  temporels: analysisResult.structure_requete.conditions
                    .filter((c) => c.type === 'TEMPOREL')
                    .map((c) => c.expression),
                  logiques: analysisResult.structure_requete.conditions
                    .filter((c) => c.type === 'LOGIQUE')
                    .map((c) => c.expression),
                },
                champsRequis: {
                  selection:
                    analysisResult.analyse_semantique.informations_demandees
                      .champs || [],
                  filtres:
                    analysisResult.analyse_semantique.informations_demandees
                      .agregations || [],
                  groupement:
                    analysisResult.structure_requete.groupements || [],
                },
                parametresRequete: {
                  tri: analysisResult.structure_requete.ordre || [],
                  limite: 100,
                },
              },
            };

            // Sauvegarder dans le cache
            this.saveToCache(request.question, JSON.stringify(result));

            return result;
          } catch (error) {
            this.logger.error(
              `Erreur lors de la construction de la requête: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
            );
            throw error;
          }
        } catch (error) {
          this.logger.error(
            `Erreur lors de la validation de la réponse: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
          );
          throw error;
        }
      } catch (error) {
        this.logger.error(
          `Erreur lors de l'analyse de la question: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        throw error;
      }
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'analyse de la question: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  private validerStructureAnalyse(analyse: AnalyseSemantiqueResponse): boolean {
    if (
      !analyse?.analyse_semantique?.intention?.action ||
      !analyse?.analyse_semantique?.intention?.objectif ||
      !analyse?.analyse_semantique?.temporalite?.periode ||
      !analyse?.analyse_semantique?.entites?.principale ||
      !analyse?.structure_requete?.tables ||
      !Array.isArray(analyse.structure_requete.tables) ||
      analyse.structure_requete.tables.length === 0
    ) {
      return false;
    }

    // Vérification des tables
    return analyse.structure_requete.tables.every(
      (table) =>
        table.nom &&
        table.alias &&
        table.type &&
        Array.isArray(table.colonnes) &&
        table.colonnes.length > 0,
    );
  }

  private determinerCategorie(domaine: string): QuestionCategory {
    switch (domaine.toUpperCase()) {
      case 'CHANTIERS':
      case 'FINANCES':
      case 'CLIENTS':
        return QuestionCategory.DATABASE;
      case 'PERSONNEL':
        return this.requiresKnowledge({
          questionCorrigee: '',
          categorie: QuestionCategory.DATABASE,
        } as AnalyseResult)
          ? QuestionCategory.KNOWLEDGE
          : QuestionCategory.DATABASE;
      default:
        return QuestionCategory.GENERAL;
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

  async enhanceAnalysisWithRag(query: string, context: any): Promise<string> {
    try {
      this.logger.log(`Enhancing analysis with RAG: ${query}`);
      
      // Convertir le contexte en format approprié pour le RAG
      const document = {
        content: JSON.stringify(context),
        title: `Analysis context for: ${query}`,
        timestamp: new Date().toISOString(),
      };
      
      // Utiliser le service RAG pour améliorer l'analyse
      const enhancedAnalysis = await this.ragClientService.indexAndQuery(document, query);
      
      return enhancedAnalysis;
    } catch (error) {
      this.logger.error(`Error enhancing analysis with RAG: ${error.message}`);
      return `Impossible d'améliorer l'analyse avec RAG: ${error.message}`;
    }
  }
}
