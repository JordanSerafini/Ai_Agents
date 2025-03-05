import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AnalyseRequestDto } from '../dto/analyse-request.dto';
import { AgentType } from './analyse.service';
import axios from 'axios';

interface RouterResponse {
  reponse: string;
}

/**
 * Interface pour typer correctement la réponse de l'agent de base de données
 */
interface DatabaseResponse {
  reponse: string;
  success?: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class RouterService {
  private readonly logger = new Logger(RouterService.name);

  // URLs des différents agents
  private readonly databaseAgentUrl: string;
  private readonly workflowAgentUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // Récupérer les URLs des agents depuis la configuration
    this.databaseAgentUrl = this.configService.get<string>(
      'DATABASE_AGENT_URL',
      'http://database_agent:3002',
    );
    this.workflowAgentUrl = this.configService.get<string>(
      'WORKFLOW_AGENT_URL',
      'http://workflow_agent:3003',
    );

    this.logger.log(`Service de routage initialisé avec les URLs suivantes:`);
    this.logger.log(`- Database Agent: ${this.databaseAgentUrl}`);
    this.logger.log(`- Workflow Agent: ${this.workflowAgentUrl}`);
  }

  /**
   * Route une requête vers l'agent approprié en fonction de sa catégorie
   */
  async routeRequest(
    request: AnalyseRequestDto,
    agentType: AgentType,
    analysedData: Record<string, unknown>,
  ): Promise<RouterResponse> {
    this.logger.log(`Routage de la requête vers l'agent: ${agentType}`);

    try {
      // Enrichir la requête si nécessaire
      let enrichedRequest = request;
      if (agentType === AgentType.API) {
        enrichedRequest = this.enrichRequestForDatabaseAgent(
          request,
          analysedData,
        );
      }

      switch (agentType) {
        case AgentType.API:
          return this.routeToDatabaseAgent(enrichedRequest, analysedData);
        case AgentType.WORKFLOW:
          return this.routeToWorkflowAgent(enrichedRequest, analysedData);
        default:
          return {
            reponse: `Agent ${agentType} non supporté. Veuillez utiliser "API" ou "WORKFLOW".`,
          };
      }
    } catch (error) {
      this.logger.error(
        `Erreur lors du routage de la requête: ${
          error instanceof Error ? error.message : 'Erreur inconnue'
        }`,
      );
      return {
        reponse:
          'Désolé, une erreur est survenue lors du routage de votre requête.',
      };
    }
  }

  /**
   * Route une requête vers l'agent de base de données
   */
  private async routeToDatabaseAgent(
    request: AnalyseRequestDto,
    analysedData: Record<string, unknown>,
  ): Promise<RouterResponse> {
    try {
      this.logger.log("Routage vers l'agent de base de données");

      // Créer une requête enrichie avec les métadonnées
      const enrichedRequest = this.enrichRequestForDatabaseAgent(
        request,
        analysedData,
      );

      this.logger.debug(
        `Requête enrichie envoyée à l'agent de base de données: ${JSON.stringify(
          enrichedRequest,
        )}`,
      );

      const endpointUrl = `${this.databaseAgentUrl}/database/query`;

      const response = await this.httpService.axiosRef.post<DatabaseResponse>(
        endpointUrl,
        enrichedRequest,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      // Si le service retourne une réponse valide
      if (response.data && typeof response.data.reponse === 'string') {
        return {
          reponse: response.data.reponse,
        };
      }

      // Si une erreur est remontée par le service
      if (response.data && response.data.error) {
        return {
          reponse: `Désolé, l'agent de base de données a rencontré un problème: ${response.data.error}`,
        };
      }

      return {
        reponse:
          "L'agent de base de données a traité votre demande mais n'a pas fourni de réponse valide.",
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors du routage vers l'agent de base de données: ${
          error instanceof Error ? error.message : 'Erreur inconnue'
        }`,
      );

      // Retourner un message d'erreur convivial
      return {
        reponse: `Désolé, je n'ai pas pu obtenir les informations demandées. L'agent de base de données a rencontré un problème: ${
          error instanceof Error ? error.message : 'Erreur de communication'
        }`,
      };
    }
  }

  /**
   * Route une requête vers l'agent de workflow
   */
  private async routeToWorkflowAgent(
    request: AnalyseRequestDto,
    analysedData: Record<string, unknown>,
  ): Promise<RouterResponse> {
    try {
      this.logger.log(
        `Tentative de routage vers l'agent de workflow: ${this.workflowAgentUrl}`,
      );

      // Vérifier si l'agent de workflow est disponible
      try {
        await axios.get(`${this.workflowAgentUrl}/api/workflow/health`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Erreur inconnue';
        this.logger.warn(
          `L'agent de workflow n'est pas disponible: ${errorMessage}`,
        );
        return {
          reponse:
            "Désolé, le service de workflow n'est pas disponible actuellement. Votre question nécessite le traitement d'un processus spécifique.",
        };
      }

      // Préparer la requête pour l'agent de workflow
      const workflowRequest = {
        question: request.question,
        userId: request.userId,
        analysedData,
      };

      // Envoyer la requête à l'agent de workflow
      const response = await axios.post<RouterResponse>(
        `${this.workflowAgentUrl}/api/workflow/process`,
        workflowRequest,
        {
          timeout: 30000, // 30 secondes de timeout
        },
      );

      // Retourner la réponse de l'agent de workflow
      return {
        reponse:
          response.data.reponse ||
          "L'agent de workflow a traité votre demande mais n'a pas fourni de réponse.",
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(
        `Erreur lors de la communication avec l'agent de workflow: ${errorMessage}`,
      );
      return {
        reponse:
          "Désolé, une erreur est survenue lors de la communication avec l'agent de workflow. Veuillez réessayer plus tard.",
      };
    }
  }

  private enrichRequestForDatabaseAgent(
    request: AnalyseRequestDto,
    analyseResult: Record<string, unknown>,
  ): AnalyseRequestDto {
    // Copier la requête originale
    const enrichedRequest = { ...request };

    // Extraire la question originale
    const questionLower = request.question.toLowerCase();

    // Définir des mappings explicites entre termes courants et tables
    const tablesMappings = {
      devis: 'quotations',
      facture: 'invoices',
      factures: 'invoices',
      client: 'clients',
      clients: 'clients',
      projet: 'projects',
      projets: 'projects',
      matériau: 'materials',
      matériaux: 'materials',
      fournisseur: 'suppliers',
      fournisseurs: 'suppliers',
      paiement: 'payments',
      paiements: 'payments',
      chantier: 'projects',
      chantiers: 'projects',
    };

    // Déterminer la table principale concernée
    let primaryTable = '';

    // Cas spécial pour les requêtes financières sur les devis
    if (
      (questionLower.includes('montant') || questionLower.includes('total')) &&
      (questionLower.includes('devis') || questionLower.includes('accepté'))
    ) {
      primaryTable = 'quotations';

      // Ajout d'un log spécifique pour déboguer
      this.logger.log(
        `Requête financière sur devis détectée: table 'quotations' sélectionnée`,
      );
    }
    // Sinon, utiliser le mapping standard
    else {
      for (const [term, table] of Object.entries(tablesMappings)) {
        if (questionLower.includes(term)) {
          primaryTable = table;
          break;
        }
      }
    }

    // Si aucune table n'a été identifiée mais qu'il s'agit d'une requête financière,
    // essayer de déterminer la table la plus probable
    if (
      !primaryTable &&
      (questionLower.includes('montant') || questionLower.includes('total'))
    ) {
      if (
        questionLower.includes('accepté') ||
        questionLower.includes('validé')
      ) {
        primaryTable = 'quotations'; // Par défaut pour les requêtes de devis acceptés/validés
        this.logger.log(
          `Requête sur montants acceptés/validés détectée: table 'quotations' sélectionnée par défaut`,
        );
      } else if (
        questionLower.includes('facture') ||
        questionLower.includes('payé')
      ) {
        primaryTable = 'invoices';
      }
    }

    // Si une table principale a été identifiée, enrichir la requête
    if (primaryTable) {
      // Déterminer la période concernée
      let timeframe: string | null = null;
      if (questionLower.includes('mois prochain')) {
        timeframe = 'next_month';
      } else if (
        questionLower.includes('mois actuel') ||
        questionLower.includes('mois courant') ||
        questionLower.includes('ce mois')
      ) {
        timeframe = 'current_month';
      } else if (questionLower.includes('semaine prochaine')) {
        timeframe = 'next_week';
      } else if (
        questionLower.includes('cette semaine') ||
        questionLower.includes('semaine actuelle')
      ) {
        timeframe = 'current_week';
      } else if (
        questionLower.includes('année') ||
        questionLower.includes('an')
      ) {
        if (
          questionLower.includes('prochain') ||
          questionLower.includes('prochaine')
        ) {
          timeframe = 'next_year';
        } else {
          timeframe = 'current_year';
        }
      }

      // Déterminer le statut concerné
      let status: string | null = null;
      if (questionLower.includes('accepté')) {
        status = 'accepté';
      } else if (questionLower.includes('validé')) {
        status = 'validé';
      } else if (questionLower.includes('en attente')) {
        status = 'en_attente';
      } else if (questionLower.includes('refusé')) {
        status = 'refusé';
      }

      // Ajouter des informations supplémentaires pour l'agent de base de données
      enrichedRequest.metadata = {
        ...enrichedRequest.metadata,
        primaryTable,
        isFinancialQuery:
          questionLower.includes('montant') ||
          questionLower.includes('total') ||
          questionLower.includes('somme'),
        aggregationType:
          questionLower.includes('total') || questionLower.includes('somme')
            ? 'sum'
            : null,
        filters: {
          status,
          timeframe,
        },
        // Ajouter l'analyse complète dans les métadonnées pour donner plus de contexte
        analysis: {
          intention: analyseResult.intention,
          entites: analyseResult.entites,
          contexte: analyseResult.contexte,
        },
      };

      // Log pour confirmer les métadonnées générées
      this.logger.log(
        `Table identifiée: ${primaryTable}, statut: ${status}, période: ${timeframe}`,
      );
    } else {
      // Aucune table identifiée, on ajoute quand même des métadonnées minimales
      this.logger.warn('Aucune table spécifique identifiée dans la requête');
      enrichedRequest.metadata = {
        ...enrichedRequest.metadata,
        noTableIdentified: true,
        possibleTables: ['quotations', 'invoices', 'projects'],
        rawQuestion: request.question,
      };
    }

    return enrichedRequest;
  }
}
