import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { OpenAIService } from './openai.service';
import { RouterService } from './router.service';
import {
  QueryBuilderClientService,
  ElasticsearchClientService,
  RagClientLocalService,
} from './clients';
import { UserQuestionDto } from '../dto/user-question.dto';
import {
  AnalyseResult,
  AnalyseSemantiqueResponse,
  QuestionCategory,
  AgentType,
  RouterResponse,
  OpenAIResponse,
  PrioriteType,
} from '../interfaces/analyse.interface';
import {
  CacheService,
  ConversationService,
  CategorizationService,
  TemporalService,
  FormatterService,
  QueryAnalysisService,
} from './analyse';

@Injectable()
export class AnalyseService {
  private readonly logger = new Logger(AnalyseService.name);
  private readonly openaiApiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly routerService: RouterService,
    private readonly queryBuilderClient: QueryBuilderClientService,
    private readonly elasticsearchClient: ElasticsearchClientService,
    private readonly ragClientService: RagClientLocalService,
    private readonly openaiService: OpenAIService,
    private readonly cacheService: CacheService,
    private readonly conversationService: ConversationService,
    private readonly categorizationService: CategorizationService,
    private readonly temporalService: TemporalService,
    private readonly formatterService: FormatterService,
    private readonly queryAnalysisService: QueryAnalysisService,
  ) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
    if (!this.openaiApiKey) {
      this.logger.error('OPENAI_API_KEY non défini dans la configuration');
    }
  }

  async analyser(request: UserQuestionDto): Promise<{ reponse: string }> {
    const { question, userId, useHistory = false } = request;
    const cacheKey = this.cacheService.getCacheKey(question);

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
          this.conversationService.addToConversationHistory(
            userId,
            'user',
            question,
          );
          this.conversationService.addToConversationHistory(
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
            reponse: this.formatterService.formaterReponseDisponibilite(
              routedResponse.resultats,
            ),
          };
        }

        return routedResponse;
      }

      // Pour les questions générales, utiliser OpenAI
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
      this.cacheService.saveToCache(cacheKey, reponse);

      if (useHistory && userId) {
        this.conversationService.addToConversationHistory(
          userId,
          'user',
          question,
        );
        this.conversationService.addToConversationHistory(
          userId,
          'assistant',
          reponse,
        );
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
      const enhancedAnalysis = await this.ragClientService.indexAndQuery(
        document,
        query,
      );

      return enhancedAnalysis;
    } catch (error) {
      this.logger.error(
        `Error enhancing analysis with RAG: ${(error as Error).message}`,
      );
      return `Impossible d'améliorer l'analyse avec RAG: ${(error as Error).message}`;
    }
  }

  async analyserQuestion(request: UserQuestionDto): Promise<AnalyseResult> {
    try {
      this.logger.log(`Analyse de la question: ${request.question}`);

      // Vérifier d'abord si la question contient des mots-clés de recherche explicites
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
        request.question.toLowerCase().includes(keyword.toLowerCase()),
      );

      // Récupérer l'historique des conversations si disponible
      const userId = request.userId || 'anonymous';
      if (request.useHistory) {
        this.conversationService.addToConversationHistory(
          userId,
          'user',
          request.question,
        );
      }

      // Vérifier si la réponse est dans le cache
      const cachedResponse = this.cacheService.getFromCache(request.question);
      if (cachedResponse) {
        this.logger.log('Réponse trouvée dans le cache');
        return JSON.parse(cachedResponse);
      }

      // Si c'est une recherche explicite, forcer la catégorie SEARCH
      if (isExplicitSearch) {
        this.logger.log(
          'Mots-clés de recherche détectés, forçage de la catégorie SEARCH',
        );

        const analyse: AnalyseResult = {
          questionCorrigee: request.question,
          intention: "recherche d'informations",
          categorie: QuestionCategory.SEARCH,
          agentCible: AgentType.ELASTICSEARCH,
          priorite: PrioriteType.NORMAL,
          entites: [],
          contexte: 'Recherche textuelle',
        };

        // Sauvegarder dans le cache
        this.cacheService.saveToCache(
          request.question,
          JSON.stringify(analyse),
        );

        return analyse;
      }

      // Continuer avec l'analyse normale si ce n'est pas une recherche explicite
      try {
        // Utiliser le nouvel OpenAIService avec le prompt externalisé
        const analysisResult = (await this.openaiService.analyseQuestion(
          request.question,
          'semantic-analysis',
        )) as AnalyseSemantiqueResponse;

        // Valider la structure de la réponse
        if (
          !this.queryAnalysisService.validerStructureAnalyse(analysisResult)
        ) {
          throw new Error('Format de réponse invalide');
        }

        try {
          // Construire la requête structurée
          const structuredQuery =
            this.queryAnalysisService.buildStructuredQuery(analysisResult);

          try {
            // Envoyer la requête au QueryBuilder
            await this.queryBuilderClient.buildQuery(structuredQuery);

            const result: AnalyseResult = {
              intention: analysisResult.analyse_semantique.intention.action,
              categorie: this.categorizationService.determinerCategorie(
                analysisResult.analyse_semantique.intention.action,
                request.question,
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
                  debut: this.temporalService.calculerDatesDynamiques(
                    analysisResult.analyse_semantique.temporalite.periode,
                  ).debut,
                  fin: this.temporalService.calculerDatesDynamiques(
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
            this.cacheService.saveToCache(
              request.question,
              JSON.stringify(result),
            );

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
}
export { AgentType, AnalyseResult };
