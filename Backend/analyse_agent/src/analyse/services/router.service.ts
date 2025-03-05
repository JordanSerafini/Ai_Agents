import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AnalyseRequestDto } from '../dto/analyse-request.dto';
import { AgentType } from './analyse.service';
import axios from 'axios';

interface RouterResponse {
  reponse: string;
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
      // Enrichir la requête avant de la transmettre à l'agent de base de données
      let enrichedRequest = request;
      if (agentType === AgentType.API) {
        enrichedRequest = await this.enrichRequestForDatabaseAgent(
          request,
          analysedData,
        );
      }

      switch (agentType) {
        case AgentType.API:
          return await this.routeToDatabaseAgent(enrichedRequest, analysedData);

        case AgentType.WORKFLOW:
          return await this.routeToWorkflowAgent(enrichedRequest, analysedData);

        case AgentType.AUTRE:
          // Pour l'instant, on renvoie un message indiquant que cet agent n'est pas encore implémenté
          return {
            reponse:
              "Désolé, cet agent n'est pas encore implémenté. Votre demande a été classifiée comme nécessitant un traitement spécial.",
          };

        default:
          // Si le type d'agent n'est pas reconnu, on renvoie un message d'erreur
          this.logger.warn(`Type d'agent non reconnu: ${agentType}`);
          return {
            reponse:
              "Désolé, je ne sais pas comment traiter cette demande. Veuillez reformuler ou contacter l'administrateur.",
          };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(
        `Erreur lors du routage vers l'agent ${agentType}: ${errorMessage}`,
      );
      return {
        reponse: `Désolé, une erreur est survenue lors de la communication avec l'agent spécialisé. Détail: ${errorMessage}`,
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
      this.logger.log(
        `Tentative de routage vers l'agent de base de données: ${this.databaseAgentUrl}`,
      );

      // Vérifier si l'agent de base de données est disponible
      try {
        await axios.get(`${this.databaseAgentUrl}/api/database/health`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Erreur inconnue';
        this.logger.warn(
          `L'agent de base de données n'est pas disponible: ${errorMessage}`,
        );
        return {
          reponse:
            "Désolé, le service de base de données n'est pas disponible actuellement. Votre question nécessite l'accès à des données spécifiques.",
        };
      }

      // Préparer la requête pour l'agent de base de données
      const databaseRequest = {
        question: request.question,
        userId: request.userId,
        analysedData,
      };

      // Envoyer la requête à l'agent de base de données
      const response = await axios.post<RouterResponse>(
        `${this.databaseAgentUrl}/api/database/process`,
        databaseRequest,
        {
          timeout: 30000, // 30 secondes de timeout
        },
      );

      // Retourner la réponse de l'agent de base de données
      return {
        reponse:
          response.data.reponse ||
          "L'agent de base de données a traité votre demande mais n'a pas fourni de réponse.",
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(
        `Erreur lors de la communication avec l'agent de base de données: ${errorMessage}`,
      );
      return {
        reponse:
          "Désolé, une erreur est survenue lors de la communication avec l'agent de base de données. Veuillez réessayer plus tard.",
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

  private async enrichRequestForDatabaseAgent(
    request: AnalyseRequestDto,
    analyseResult: Record<string, unknown>,
  ): Promise<AnalyseRequestDto> {
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
      } else if (
        questionLower.includes('facture') ||
        questionLower.includes('payé')
      ) {
        primaryTable = 'invoices';
      }
    }

    // Si une table principale a été identifiée, enrichir la requête
    if (primaryTable) {
      // Ajouter des informations supplémentaires pour l'agent de base de données
      enrichedRequest.metadata = {
        ...enrichedRequest.metadata,
        primaryTable,
        isFinancialQuery:
          questionLower.includes('montant') || questionLower.includes('total'),
        filters: {
          status: questionLower.includes('accepté')
            ? 'accepté'
            : questionLower.includes('validé')
              ? 'validé'
              : null,
          timeframe: questionLower.includes('mois prochain')
            ? 'next_month'
            : questionLower.includes('mois actuel') ||
                questionLower.includes('mois courant')
              ? 'current_month'
              : null,
        },
      };
    }

    return enrichedRequest;
  }
}
