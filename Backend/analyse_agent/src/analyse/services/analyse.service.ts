import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AnalyseRequestDto } from '../dto/analyse-request.dto';
import { AnalyseResponseDto } from '../dto/analyse-response.dto';
import { PrioriteType } from '../interfaces/analyse.interface';
import { analysePrompt } from '../../var/analyse.prompt';
import { RagService } from './rag.service';
import { RouterService } from './router.service';
import { DatabaseMetadataService } from './database-metadata.service';

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
}

// Types d'agents disponibles
export enum AgentType {
  GENERAL = 'agent_general',
  API = 'agent_api',
  WORKFLOW = 'agent_workflow',
  AUTRE = 'agent_autre',
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
    private readonly ragService: RagService,
    private readonly routerService: RouterService,
    private readonly dbMetadataService: DatabaseMetadataService,
  ) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
    this.logger.log(
      `Service d'analyse initialisé avec OpenAI${
        this.openaiApiKey ? '' : ' (clé API manquante)'
      }`,
    );

    // Nettoyer les historiques expirés toutes les 10 minutes
    setInterval(() => this.cleanupExpiredHistories(), 600000);
  }

  private getCacheKey(question: string): string {
    return question.toLowerCase().trim();
  }

  private getFromCache(question: string): string | null {
    const key = this.getCacheKey(question);
    const cached = this.responseCache.get(key);

    if (!cached) {
      return null;
    }

    const now = Date.now();
    if (now - cached.timestamp > this.cacheTTL) {
      this.responseCache.delete(key);
      return null;
    }

    this.logger.log(
      `Réponse trouvée en cache pour: ${question.substring(0, 50)}...`,
    );
    return cached.reponse;
  }

  private saveToCache(question: string, reponse: string): void {
    const key = this.getCacheKey(question);
    this.responseCache.set(key, {
      reponse,
      timestamp: Date.now(),
    });
    this.logger.log(
      `Réponse mise en cache pour: ${question.substring(0, 50)}...`,
    );
  }

  private getConversationHistory(userId: string): ConversationHistory {
    if (!this.conversationHistories.has(userId)) {
      this.conversationHistories.set(userId, {
        messages: [],
        lastInteraction: Date.now(),
      });
    }

    const history = this.conversationHistories.get(userId);
    history!.lastInteraction = Date.now();
    return history!;
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
      // Garder le premier message (souvent un message système) et les N-1 derniers messages
      const systemMessage =
        history.messages[0].role === 'system' ? [history.messages[0]] : [];
      const recentMessages = history.messages.slice(
        -(this.maxHistoryLength - systemMessage.length),
      );
      history.messages = [...systemMessage, ...recentMessages];
    }

    this.logger.log(
      `Message ajouté à l'historique pour l'utilisateur ${userId}`,
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
    try {
      const userId = request.userId || 'anonymous';

      // Vérifier le cache d'abord (sauf si on veut forcer l'utilisation de l'historique)
      if (!request.useHistory) {
        const cachedResponse = this.getFromCache(request.question);
        if (cachedResponse) {
          // Même si on utilise le cache, on ajoute quand même à l'historique
          this.addToConversationHistory(userId, 'user', request.question);
          this.addToConversationHistory(userId, 'assistant', cachedResponse);
          return { reponse: cachedResponse };
        }
      }

      if (!this.openaiApiKey) {
        return {
          reponse:
            "Désolé, le service OpenAI n'est pas configuré correctement. Veuillez contacter l'administrateur.",
        };
      }

      try {
        // Ajouter la question à l'historique
        this.addToConversationHistory(userId, 'user', request.question);

        // Analyser la question pour obtenir l'intention et la classification
        const analyseResult = await this.analyserQuestion(request.question);

        // Si l'agent cible n'est pas GENERAL, router la requête vers l'agent approprié
        if (analyseResult.agentCible !== AgentType.GENERAL) {
          this.logger.log(
            `Routage de la requête vers l'agent: ${analyseResult.agentCible}`,
          );
          const routedResponse = await this.routerService.routeRequest(
            request,
            analyseResult.agentCible,
            analyseResult as unknown as Record<string, unknown>,
          );

          // Ajouter la réponse routée à l'historique
          this.addToConversationHistory(
            userId,
            'assistant',
            routedResponse.reponse,
          );

          // Ne pas mettre en cache les réponses des autres agents
          return routedResponse;
        }

        // Continuer avec le traitement normal pour l'agent GENERAL
        // Ajuster les paramètres en fonction de l'agent cible
        let temperature = 0.7;
        let maxTokens = 300;
        let systemPrompt = `Tu es un assistant IA pour Technidalle, une entreprise de bâtiment. Réponds en français de manière concise mais informative.
La question a été classifiée comme "${analyseResult.categorie}" avec l'intention principale: "${analyseResult.intention}".
Adapte ta réponse en fonction de cette classification et du contexte de l'entreprise Technidalle.`;

        // Personnaliser les paramètres selon l'agent
        if (analyseResult.agentCible === AgentType.GENERAL) {
          // Pour l'agent général, on veut des réponses plus détaillées
          temperature = 0.7;
          maxTokens = 500;
          systemPrompt = `Tu es un assistant IA expert pour Technidalle, une entreprise de bâtiment. 
La question a été classifiée comme "${analyseResult.categorie}" avec l'intention principale: "${analyseResult.intention}".
Fournis une réponse détaillée et informative en français (3-5 phrases) qui répond précisément à la question.
Si la question concerne des informations générales sur le bâtiment, les matériaux ou les services, donne des explications complètes.
Utilise un ton professionnel et adapté au secteur du bâtiment.`;
        } else if (analyseResult.agentCible === AgentType.API) {
          // Pour l'agent API, on indique qu'il s'agit d'une requête nécessitant des données
          systemPrompt = `Tu es un assistant IA pour Technidalle, une entreprise de bâtiment. 
La question nécessite des données spécifiques de la base de données. Indique clairement quelles informations précises seraient nécessaires pour répondre complètement.
Réponds en français de manière concise mais précise (2-3 phrases).`;
        } else if (analyseResult.agentCible === AgentType.WORKFLOW) {
          // Pour l'agent workflow, on adapte le ton pour les processus
          systemPrompt = `Tu es un assistant IA pour Technidalle, une entreprise de bâtiment, spécialisé dans les processus et workflows.
La question concerne un processus ou une étape de projet. Réponds en français de manière structurée en expliquant les étapes ou le processus concerné (2-4 phrases).`;
        }

        // Récupérer l'historique de conversation
        const history = this.getConversationHistory(userId);

        // Préparer les messages pour l'API OpenAI
        const messages = [
          {
            role: 'system',
            content: systemPrompt,
          },
        ];

        // Rechercher des documents similaires dans la base de connaissances RAG
        const similarDocuments = await this.ragService.searchSimilarDocuments(
          request.question,
          analyseResult.agentCible,
          3, // Récupérer les 3 documents les plus pertinents
        );

        // Si des documents pertinents ont été trouvés, les ajouter au contexte
        if (similarDocuments.length > 0) {
          // Filtrer les documents avec un score de similarité suffisant (> 0.7)
          const relevantDocs = similarDocuments.filter(
            (doc) => doc.score > 0.7,
          );

          if (relevantDocs.length > 0) {
            // Ajouter les documents pertinents au contexte
            const contextMessage = {
              role: 'system' as const,
              content: `Voici des informations pertinentes pour répondre à cette question :\n\n${relevantDocs
                .map(
                  (doc, index) =>
                    `[Document ${index + 1}] Question: "${doc.document.question}"\nRéponse: "${doc.document.answer}"`,
                )
                .join(
                  '\n\n',
                )}\n\nUtilise ces informations pour enrichir ta réponse si elles sont pertinentes.`,
            };

            messages.push(contextMessage);

            this.logger.log(
              `${relevantDocs.length} documents pertinents trouvés dans la base RAG`,
            );
          }
        }

        // Ajouter l'historique récent si demandé
        if (request.useHistory && history.messages.length > 0) {
          // Filtrer pour ne garder que les messages user/assistant (pas les system)
          const conversationMessages = history.messages
            .filter((msg) => msg.role !== 'system')
            .slice(-6) // Limiter à 3 échanges (6 messages)
            .map((msg) => ({
              role: msg.role,
              content: msg.content,
            }));

          // Ajouter les messages de l'historique avant la question actuelle
          messages.push(...conversationMessages.slice(0, -1));
        }

        // Ajouter la question actuelle
        messages.push({
          role: 'user',
          content: analyseResult.questionCorrigee,
        });

        // Générer une réponse basée sur l'analyse
        const response = await axios.post<OpenAICompletionResponse>(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-3.5-turbo',
            messages,
            temperature,
            max_tokens: maxTokens,
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

        // Ajouter la réponse à l'historique
        this.addToConversationHistory(userId, 'assistant', reponse);

        // Ajouter la paire question/réponse à la base de connaissances RAG
        await this.ragService.addDocument(
          request.question,
          reponse,
          analyseResult.agentCible,
          analyseResult.categorie,
          analyseResult.entites,
        );

        // Mettre en cache seulement si on n'utilise pas l'historique
        if (!request.useHistory) {
          this.saveToCache(request.question, reponse);
        }

        return { reponse };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Erreur inconnue';
        this.logger.error(`Erreur avec OpenAI: ${errorMessage}`);
        return {
          reponse:
            'Désolé, je ne peux pas répondre à votre question pour le moment. Veuillez réessayer plus tard.',
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(`Erreur générale: ${errorMessage}`);
      return {
        reponse:
          'Une erreur est survenue lors du traitement de votre demande. Veuillez réessayer plus tard.',
      };
    }
  }

  async analyserQuestion(question: string): Promise<AnalyseResult> {
    try {
      // Utiliser le prompt défini dans le fichier externe
      const prompt = analysePrompt(question);

      // Ajouter les informations sur la structure de la base de données
      const dbDescription = this.dbMetadataService.getDatabaseDescription();
      const enhancedPrompt = `${prompt}\n\nInformations sur la structure de la base de données:\n${dbDescription}`;

      const response = await axios.post<OpenAICompletionResponse>(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content:
                "Tu es un assistant spécialisé dans l'analyse et la classification de questions pour Technidalle, une entreprise de bâtiment. Tu réponds uniquement au format JSON.",
            },
            {
              role: 'user',
              content: enhancedPrompt,
            },
          ],
          temperature: 0.1,
          max_tokens: 500,
        },
        {
          headers: {
            Authorization: `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );

      const jsonResponse = response.data.choices[0].message.content.trim();
      const parsedResponse = JSON.parse(jsonResponse) as {
        questionCorrigee: string;
        intention: string;
        categorie: string;
        agentCible: string;
        priorite: string;
        entites: string[];
        contexte: string;
      };

      // Vérification supplémentaire pour les questions liées aux plannings et chantiers
      const questionLower = question.toLowerCase();
      const planningKeywords = [
        'chantier',
        'chantiers',
        'projet',
        'projets',
        'travaux',
        'demain',
        "aujourd'hui",
        'cette semaine',
        'ce mois',
        'planning',
        'calendrier',
        'programmé',
        'prévu',
        'à venir',
        'en cours',
        'commencent',
        'débutent',
        'planifié',
      ];

      // Vérifier si la question contient des mots-clés liés aux plannings
      const containsPlanningKeywords = planningKeywords.some((keyword) =>
        questionLower.includes(keyword),
      );

      // Si la question contient des mots-clés de planning mais n'a pas été classifiée comme API,
      // forcer la classification vers l'agent API
      if (
        containsPlanningKeywords &&
        parsedResponse.agentCible !== 'agent_api'
      ) {
        this.logger.log(
          `Reclassification: Question contenant des mots-clés de planning "${question}" redirigée vers agent_api`,
        );
        parsedResponse.agentCible = 'agent_api';
        parsedResponse.categorie = 'API';
      }

      // Convertir la chaîne agentCible en enum AgentType
      let agentCible: AgentType;
      switch (parsedResponse.agentCible) {
        case 'agent_general':
          agentCible = AgentType.GENERAL;
          break;
        case 'agent_api':
          agentCible = AgentType.API;
          break;
        case 'agent_workflow':
          agentCible = AgentType.WORKFLOW;
          break;
        default:
          agentCible = AgentType.GENERAL;
      }

      // Convertir la chaîne categorie en enum QuestionCategory
      let categorie: QuestionCategory;
      switch (parsedResponse.categorie) {
        case 'GENERAL':
          categorie = QuestionCategory.GENERAL;
          break;
        case 'API':
          categorie = QuestionCategory.API;
          break;
        case 'WORKFLOW':
          categorie = QuestionCategory.WORKFLOW;
          break;
        default:
          categorie = QuestionCategory.AUTRE;
      }

      return {
        questionCorrigee: parsedResponse.questionCorrigee,
        intention: parsedResponse.intention,
        categorie,
        agentCible,
        priorite: parsedResponse.priorite as PrioriteType,
        entites: parsedResponse.entites,
        contexte: parsedResponse.contexte,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'analyse de la question: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      );
      // Retourner une analyse par défaut en cas d'erreur
      return {
        questionCorrigee: question,
        intention: 'Intention non déterminée',
        categorie: QuestionCategory.GENERAL,
        agentCible: AgentType.GENERAL,
        priorite: 'MEDIUM' as PrioriteType,
        entites: [],
        contexte: 'Contexte non déterminé',
      };
    }
  }

  async analyseDemande(
    request: AnalyseRequestDto,
  ): Promise<AnalyseResponseDto> {
    try {
      // Analyser la question pour obtenir l'intention et la classification
      const analyseResult = await this.analyserQuestion(request.question);

      // Convertir le résultat d'analyse au format AnalyseResponseDto
      return {
        demandeId: Date.now().toString(),
        intentionPrincipale: {
          nom: analyseResult.categorie,
          confiance: 0.9,
          description: analyseResult.intention,
        },
        sousIntentions: [
          {
            nom: 'classification',
            description: `Catégorie: ${analyseResult.categorie}`,
            confiance: 0.95,
          },
          {
            nom: 'agent_cible',
            description: `Agent cible: ${analyseResult.agentCible}`,
            confiance: 0.9,
          },
        ],
        entites: analyseResult.entites,
        niveauUrgence: analyseResult.priorite,
        contraintes: [],
        contexte: analyseResult.contexte,
        timestamp: new Date(),
        questionCorrigee: analyseResult.questionCorrigee,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(
        `Erreur lors de l'analyse de la demande: ${errorMessage}`,
      );
      throw new Error(
        `Erreur lors de l'analyse de la demande: ${errorMessage}`,
      );
    }
  }

  private construirePrompt(request: AnalyseRequestDto): string {
    return `Analyse la demande suivante et fournis une réponse structurée au format JSON:
    
    Demande: "${request.question}"
    
    Réponds avec un objet JSON contenant les champs suivants:
    - mainIntent: { name: string, confidence: number, description: string }
    - subIntents: [{ name: string, description: string, confidence: number }]
    - entities: string[]
    - priorityLevel: "HIGH" | "MEDIUM" | "LOW"
    - constraints: string[]
    - context: string
    
    Assure-toi que la réponse est un JSON valide.`;
  }

  private parserReponse(reponse: string): AnalyseResponseDto {
    try {
      const parsed = JSON.parse(reponse) as {
        mainIntent: {
          name: string;
          confidence: number;
          description: string;
        };
        subIntents: Array<{
          name: string;
          description: string;
          confidence: number;
        }>;
        entities: string[];
        priorityLevel: 'HIGH' | 'MEDIUM' | 'LOW';
        constraints: string[];
        context: string;
      };

      return {
        demandeId: Date.now().toString(),
        intentionPrincipale: {
          nom: parsed.mainIntent.name,
          confiance: parsed.mainIntent.confidence,
          description: parsed.mainIntent.description,
        },
        sousIntentions: parsed.subIntents.map((intent) => ({
          nom: intent.name,
          description: intent.description,
          confiance: intent.confidence,
        })),
        entites: parsed.entities,
        niveauUrgence: parsed.priorityLevel as PrioriteType,
        contraintes: parsed.constraints,
        contexte: parsed.context,
        timestamp: new Date(),
        questionCorrigee: '', // Ajout du champ manquant
      };
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Erreur lors du parsing de la réponse: ${error.message}`,
        );
      }
      throw new Error('Format de réponse invalide');
    }
  }
}
