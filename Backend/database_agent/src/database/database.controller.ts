import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from './database.service';
import { DatabaseMetadataService } from './services/database-metadata.service';
import { SearchService } from '../search/search.service';
import { SyncService } from '../search/sync.service';
// Importer les variables de prompt et les requêtes SQL
import * as PROMPTS from '../var/prompt';
import * as QUERIES from '../var/querys/query_ALL';

interface SearchResult {
  id: number;
  title?: string;
  name?: string;
  description?: string;
  score?: number;
  [key: string]: any;
}

interface SearchResponse {
  success: boolean;
  results?: SearchResult[];
  count?: number;
  error?: string;
  message?: string;
  type?: string;
  entity?: string;
  intent?: string;
}

@Controller('database')
export class DatabaseController {
  private readonly logger = new Logger(DatabaseController.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly dbMetadataService: DatabaseMetadataService,
    private readonly searchService: SearchService,
    private readonly syncService: SyncService,
  ) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'database_agent',
    };
  }

  @Post('query')
  async executeQuery(@Body() body: { query: string; params?: any[] }) {
    try {
      if (!body.query) {
        return { error: 'Requête SQL manquante' };
      }

      // Vérification de sécurité basique pour éviter les requêtes dangereuses
      const lowerQuery = body.query.toLowerCase();
      if (
        lowerQuery.includes('drop') ||
        lowerQuery.includes('truncate') ||
        lowerQuery.includes('delete') ||
        lowerQuery.includes('update') ||
        lowerQuery.includes('insert') ||
        lowerQuery.includes('alter')
      ) {
        return {
          error:
            'Requête non autorisée. Seules les requêtes SELECT sont permises.',
        };
      }

      const result = await this.databaseService.executeQuery(
        body.query,
        body.params || [],
      );
      return { result };
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de l'exécution de la requête: ${error.message}`,
      );
      return { error: error.message };
    }
  }

  @Post('/process')
  async processRequest(
    @Body() body: { question: string; userId: string; analysedData: any },
  ) {
    this.logger.log(
      `Traitement de la requête de l'agent d'analyse: ${body.question}`,
    );

    try {
      // Importer les variables de prompt et les requêtes SQL
      const PROMPTS = await import('../var/prompt');
      const QUERIES = await import('../var/querys/query_ALL');

      // Récupérer les métadonnées de la base de données
      const dbMetadata = {
        tables: this.dbMetadataService.getAllTables(),
        enums: this.dbMetadataService.getAllEnums(),
      };

      // Analyser la question pour déterminer quelle table ou données sont nécessaires
      const { question, analysedData } = body;

      // Analyser l'intention de la requête
      const intent = this.analyzeQueryIntent(question);
      let response = '';

      // Si l'intention est reconnue, utiliser les requêtes prédéfinies
      if (intent !== 'UNKNOWN') {
        try {
          const result = await this.executeQueryByIntent(intent, question);

          // Formater la réponse en fonction du type de données
          if (Array.isArray(result) && result.length > 0) {
            response = `J'ai analysé votre question concernant la base de données: "${question}"\n\n`;
            response += `Voici les résultats que j'ai trouvés:\n`;
            response += `${JSON.stringify(result, null, 2)}\n\n`;

            // Ajouter des informations supplémentaires en fonction de l'intention
            switch (intent) {
              case 'PROJECT_PROGRESS':
                response += `Le taux d'avancement est de ${result[0].progress_percentage}%.\n`;
                break;
              case 'OVERDUE_TASKS':
                response += `Il y a ${result.length} tâche(s) en retard.\n`;
                break;
              case 'TASKS_THIS_MONTH':
                response += `Il y a ${result.length} tâche(s) prévue(s) ce mois-ci.\n`;
                break;
            }
          } else if (result && typeof result === 'object') {
            response = `J'ai analysé votre question concernant la base de données: "${question}"\n\n`;
            response += `Voici les résultats que j'ai trouvés:\n`;
            response += `${JSON.stringify(result, null, 2)}\n\n`;
          } else {
            response = `J'ai analysé votre question concernant la base de données: "${question}"\n\n`;
            response += `Je n'ai pas trouvé de résultats correspondant à votre requête.\n`;
            response += `Voici quelques exemples de requêtes que vous pouvez essayer:\n`;
            response += PROMPTS.PROMPT_EXAMPLES.FIND_PROJECT + '\n';
            response += PROMPTS.PROMPT_EXAMPLES.TASKS_THIS_MONTH + '\n';
            response += PROMPTS.PROMPT_EXAMPLES.OVERDUE_TASKS + '\n';
            response += PROMPTS.PROMPT_EXAMPLES.USER_ASSIGNMENTS + '\n';
            response += PROMPTS.PROMPT_EXAMPLES.PROJECT_PROGRESS + '\n';
          }
        } catch (error) {
          response = `J'ai analysé votre question concernant la base de données: "${question}"\n\n`;
          response += `Je n'ai pas pu exécuter la requête: ${error.message}\n\n`;
          response += `Voici quelques exemples de requêtes que vous pouvez essayer:\n`;
          response += PROMPTS.PROMPT_EXAMPLES.FIND_PROJECT + '\n';
          response += PROMPTS.PROMPT_EXAMPLES.TASKS_THIS_MONTH + '\n';
          response += PROMPTS.PROMPT_EXAMPLES.OVERDUE_TASKS + '\n';
          response += PROMPTS.PROMPT_EXAMPLES.USER_ASSIGNMENTS + '\n';
          response += PROMPTS.PROMPT_EXAMPLES.PROJECT_PROGRESS + '\n';
        }
      } else {
        // Comportement existant pour les requêtes non reconnues
        response = `J'ai analysé votre question concernant la base de données: "${question}"\n\n`;

        // Chercher si la question mentionne une table spécifique
        const mentionedTables = dbMetadata.tables.filter((table) =>
          question.toLowerCase().includes(table.name.toLowerCase()),
        );

        if (mentionedTables.length > 0) {
          response += `J'ai identifié que vous vous intéressez à la/aux table(s): ${mentionedTables.map((t) => t.name).join(', ')}.\n\n`;

          // Pour chaque table mentionnée, récupérer quelques données
          for (const table of mentionedTables) {
            try {
              const data = await this.databaseService.getTableData(
                table.name,
                5,
              );
              response += `Voici un aperçu des données de la table ${table.name}:\n`;
              response += `${JSON.stringify(data, null, 2)}\n\n`;
            } catch (error: any) {
              response += `Je n'ai pas pu récupérer les données de la table ${table.name}: ${error.message}\n\n`;
            }
          }
        } else {
          response += `Je n'ai pas identifié de table spécifique dans votre question. Voici la liste des tables disponibles:\n`;
          response += dbMetadata.tables
            .map((t) => `- ${t.name}: ${t.description || 'Pas de description'}`)
            .join('\n');
          response += `\n\nPour obtenir des informations sur une table spécifique, veuillez mentionner son nom dans votre question.`;

          // Ajouter des exemples de requêtes
          response += `\n\nVoici quelques exemples de requêtes que vous pouvez essayer:\n`;
          response += PROMPTS.PROMPT_EXAMPLES.FIND_PROJECT + '\n';
          response += PROMPTS.PROMPT_EXAMPLES.TASKS_THIS_MONTH + '\n';
          response += PROMPTS.PROMPT_EXAMPLES.OVERDUE_TASKS + '\n';
          response += PROMPTS.PROMPT_EXAMPLES.USER_ASSIGNMENTS + '\n';
          response += PROMPTS.PROMPT_EXAMPLES.PROJECT_PROGRESS + '\n';
        }
      }

      return { reponse: response };
    } catch (error: any) {
      this.logger.error(
        `Erreur lors du traitement de la requête: ${error.message}`,
      );
      return {
        reponse: `Désolé, une erreur est survenue lors du traitement de votre requête: ${error.message}`,
      };
    }
  }

  @Get('metadata')
  getDatabaseMetadata() {
    return {
      tables: this.dbMetadataService.getAllTables(),
      enums: this.dbMetadataService.getAllEnums(),
    };
  }

  @Get('tables')
  getAllTables() {
    return {
      tables: this.dbMetadataService.getAllTables().map((table) => ({
        name: table.name,
        description: table.description,
      })),
    };
  }

  @Get('tables/:name')
  async getTableDetails(@Param('name') tableName: string) {
    const tableMetadata = this.dbMetadataService.getTable(tableName);
    if (!tableMetadata) {
      return { error: `Table '${tableName}' non trouvée` };
    }

    try {
      const count = await this.databaseService.getTableCount(tableName);
      return {
        metadata: tableMetadata,
        count,
      };
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la récupération des détails de la table ${tableName}: ${error.message}`,
      );
      return { error: error.message };
    }
  }

  @Get('tables/:name/data')
  async getTableData(
    @Param('name') tableName: string,
    @Query('limit') limit: string = '10',
  ) {
    try {
      const data = await this.databaseService.getTableData(
        tableName,
        parseInt(limit, 10),
      );
      return { data };
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la récupération des données de la table ${tableName}: ${error.message}`,
      );
      return { error: error.message };
    }
  }

  @Post('search')
  async searchInTable(
    @Body()
    body: {
      table: string;
      column: string;
      searchTerm: string;
      limit?: number;
    },
  ) {
    try {
      if (!body.table || !body.column || !body.searchTerm) {
        return {
          error:
            'Paramètres manquants. Table, colonne et terme de recherche sont requis.',
        };
      }

      const result = await this.databaseService.searchInTable(
        body.table,
        body.column,
        body.searchTerm,
        body.limit || 10,
      );
      return { result };
    } catch (error: any) {
      this.logger.error(`Erreur lors de la recherche: ${error.message}`);
      return { error: error.message };
    }
  }

  @Get('tables/:name/related/:id/:relatedTable')
  async getRelatedData(
    @Param('name') tableName: string,
    @Param('id') id: string,
    @Param('relatedTable') relatedTable: string,
  ) {
    try {
      const data = await this.databaseService.getRelatedData(
        tableName,
        parseInt(id, 10),
        relatedTable,
      );
      return { data };
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la récupération des données liées: ${error.message}`,
      );
      return { error: error.message };
    }
  }

  @Post('search/projects')
  async searchProjects(
    @Body() body: { query: string; filters?: Record<string, any> },
  ): Promise<SearchResponse> {
    try {
      const { query, filters } = body;
      if (!query) {
        return { success: false, error: 'Terme de recherche manquant' };
      }

      const results = await this.searchService.searchProjects(query, filters);
      return {
        success: true,
        results,
        count: results.length,
      };
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la recherche de projets: ${error.message}`,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('search/similar-projects/:id')
  async findSimilarProjects(@Param('id') id: string): Promise<SearchResponse> {
    try {
      const projectId = parseInt(id, 10);
      if (isNaN(projectId)) {
        return { success: false, error: 'ID de projet invalide' };
      }

      const results = await this.searchService.findSimilarProjects(projectId);
      return {
        success: true,
        results,
        count: results.length,
      };
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la recherche de projets similaires: ${error.message}`,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('search/documents')
  async searchDocuments(
    @Body() body: { query: string },
  ): Promise<SearchResponse> {
    try {
      const { query } = body;
      if (!query) {
        return { success: false, error: 'Terme de recherche manquant' };
      }

      const results = await this.searchService.searchDocuments(query);
      return {
        success: true,
        results,
        count: results.length,
      };
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la recherche de documents: ${error.message}`,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('search/suppliers')
  async searchSuppliers(
    @Body() body: { query: string },
  ): Promise<SearchResponse> {
    try {
      const { query } = body;
      if (!query) {
        return { success: false, error: 'Terme de recherche manquant' };
      }

      const results = await this.searchService.searchSuppliers(query);
      return {
        success: true,
        results,
        count: results.length,
      };
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la recherche de fournisseurs: ${error.message}`,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('elasticsearch/sync')
  async syncElasticsearch(): Promise<SearchResponse> {
    try {
      await this.syncService.syncAll();
      return {
        success: true,
        message: 'Synchronisation Elasticsearch terminée avec succès',
      };
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la synchronisation Elasticsearch: ${error.message}`,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('elasticsearch/sync/:entity/:id')
  async syncEntity(
    @Param('entity') entity: string,
    @Param('id') id: string,
  ): Promise<SearchResponse> {
    try {
      const entityId = parseInt(id, 10);
      if (isNaN(entityId)) {
        return { success: false, error: "ID d'entité invalide" };
      }

      await this.syncService.syncEntity(entity, entityId);
      return {
        success: true,
        message: `Synchronisation de l'entité ${entity} avec l'ID ${id} terminée avec succès`,
      };
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la synchronisation de l'entité: ${error.message}`,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('elasticsearch/delete/:entity/:id')
  async deleteEntity(
    @Param('entity') entity: string,
    @Param('id') id: string,
  ): Promise<SearchResponse> {
    try {
      const entityId = parseInt(id, 10);
      if (isNaN(entityId)) {
        return { success: false, error: "ID d'entité invalide" };
      }

      await this.syncService.deleteEntity(entity, entityId);
      return {
        success: true,
        message: `Suppression de l'entité ${entity} avec l'ID ${id} terminée avec succès`,
      };
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la suppression de l'entité: ${error.message}`,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('processNaturalLanguageQuery')
  async processNaturalLanguageQuery(@Body() body: { query: string }) {
    try {
      const { query } = body;
      if (!query) {
        return { error: 'Requête en langage naturel manquante' };
      }

      // Vérifier si c'est une requête de recherche
      if (this.isSearchQuery(query)) {
        return this.handleSearchQuery(query);
      }

      // Continuer avec le traitement existant pour les autres types de requêtes
      const intent = this.analyzeQueryIntent(query);
      const result = await this.executeQueryByIntent(intent, query);

      return {
        success: true,
        intent,
        result,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors du traitement de la requête: ${error.message}`,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private isSearchQuery(query: string): boolean {
    const searchTerms = [
      'cherche',
      'trouve',
      'recherche',
      'similaire',
      'comme',
      'ressemble',
      'contenant',
      'concernant',
    ];

    const lowerQuery = query.toLowerCase();
    return searchTerms.some((term) => lowerQuery.includes(term));
  }

  private async handleSearchQuery(query: string): Promise<any> {
    const lowerQuery = query.toLowerCase();

    // Déterminer le type d'entité à rechercher
    let entityType = 'projects'; // Par défaut, rechercher dans les projets

    if (lowerQuery.includes('document') || lowerQuery.includes('fichier')) {
      entityType = 'documents';
    } else if (
      lowerQuery.includes('fournisseur') ||
      lowerQuery.includes('supplier')
    ) {
      entityType = 'suppliers';
    } else if (lowerQuery.includes('client')) {
      entityType = 'clients';
    }

    // Vérifier si c'est une recherche de similarité
    if (lowerQuery.includes('similaire') || lowerQuery.includes('comme')) {
      // Extraire l'ID du projet de référence
      const idMatch = lowerQuery.match(
        /projet\s+#?(\d+)|chantier\s+#?(\d+)|#(\d+)/i,
      );
      if (idMatch) {
        const projectId = parseInt(idMatch[1] || idMatch[2] || idMatch[3], 10);
        if (!isNaN(projectId)) {
          const results =
            await this.searchService.findSimilarProjects(projectId);
          return {
            success: true,
            type: 'similarity',
            entity: 'projects',
            results,
            count: results.length,
          };
        }
      }
    }

    // Recherche standard
    let results;
    switch (entityType) {
      case 'documents':
        results = await this.searchService.searchDocuments(query);
        break;
      case 'suppliers':
        results = await this.searchService.searchSuppliers(query);
        break;
      case 'projects':
      default:
        results = await this.searchService.searchProjects(query);
        break;
    }

    return {
      success: true,
      type: 'search',
      entity: entityType,
      results,
      count: results.length,
    };
  }

  /**
   * Analyse l'intention de la requête utilisateur
   * @param query Requête utilisateur
   * @returns Intention identifiée
   */
  private analyzeQueryIntent(query: string): string {
    const lowerQuery = query.toLowerCase();

    // Projets
    if (
      lowerQuery.includes('projet') ||
      lowerQuery.includes('chantier') ||
      lowerQuery.includes('travaux')
    ) {
      // Projets de demain
      if (lowerQuery.includes('demain') || lowerQuery.includes('lendemain')) {
        return 'PROJECTS_TOMORROW';
      }

      // Projets d'aujourd'hui
      if (
        lowerQuery.includes('aujourd') ||
        lowerQuery.includes('ce jour') ||
        lowerQuery.includes('en cours')
      ) {
        return 'PROJECTS_TODAY';
      }

      // Projets par client
      if (lowerQuery.includes('client')) {
        return 'PROJECTS_BY_CLIENT';
      }

      // Avancement d'un projet
      if (
        lowerQuery.includes('avancement') ||
        lowerQuery.includes('progression') ||
        lowerQuery.includes('état') ||
        lowerQuery.includes('etat') ||
        lowerQuery.includes('statut') ||
        lowerQuery.includes('progrès') ||
        lowerQuery.includes('progres')
      ) {
        return 'PROJECT_PROGRESS';
      }

      // Liste de tous les projets
      return 'ALL_PROJECTS';
    }

    // Recherche de tâches
    if (
      lowerQuery.includes('tâche') ||
      lowerQuery.includes('task') ||
      lowerQuery.includes('taches')
    ) {
      if (lowerQuery.includes('retard') || lowerQuery.includes('en retard')) {
        return 'OVERDUE_TASKS';
      } else if (
        lowerQuery.includes('ce mois') ||
        lowerQuery.includes('mois')
      ) {
        return 'TASKS_THIS_MONTH';
      } else if (
        lowerQuery.includes('utilisateur') ||
        lowerQuery.includes('assigné')
      ) {
        return 'TASKS_BY_USER';
      } else {
        return 'LIST_TASKS';
      }
    }

    // Recherche d'utilisateurs
    if (lowerQuery.includes('utilisateur') || lowerQuery.includes('user')) {
      if (lowerQuery.includes('charge') || lowerQuery.includes('travail')) {
        return 'USER_WORKLOAD';
      } else {
        return 'LIST_USERS';
      }
    }

    // Recherche de clients
    if (lowerQuery.includes('client') || lowerQuery.includes('clients')) {
      if (lowerQuery.includes('projet') || lowerQuery.includes('chantier')) {
        return 'CLIENT_PROJECTS';
      } else {
        return 'LIST_CLIENTS';
      }
    }

    // Rapports
    if (
      lowerQuery.includes('rapport') ||
      lowerQuery.includes('statistique') ||
      lowerQuery.includes('stats')
    ) {
      if (lowerQuery.includes('projet') || lowerQuery.includes('chantier')) {
        return 'PROJECT_PROGRESS_REPORT';
      } else if (lowerQuery.includes('tâche') || lowerQuery.includes('task')) {
        return 'TASKS_BY_STATUS';
      } else if (
        lowerQuery.includes('utilisateur') ||
        lowerQuery.includes('user')
      ) {
        return 'USER_PERFORMANCE';
      } else {
        return 'GENERAL_REPORT';
      }
    }

    // Par défaut
    return 'UNKNOWN';
  }

  /**
   * Exécute une requête SQL en fonction de l'intention détectée
   */
  private async executeQueryByIntent(
    intent: string,
    userQuery: string,
  ): Promise<any> {
    // Extraction des paramètres de la requête utilisateur
    const params = this.extractQueryParams(intent, userQuery);

    // Sélection de la requête SQL appropriée
    let sqlQuery = '';
    let sqlParams: any[] = [];

    switch (intent) {
      case 'ALL_PROJECTS':
        sqlQuery = QUERIES.PROJECT_QUERIES.GET_ALL;
        break;

      case 'PROJECTS_TOMORROW':
        sqlQuery = QUERIES.PROJECT_QUERIES.GET_TOMORROW;
        break;

      case 'PROJECTS_TODAY':
        sqlQuery = QUERIES.PROJECT_QUERIES.GET_TODAY;
        break;

      case 'PROJECTS_BY_CLIENT':
        // Extraction de l'ID du client ou recherche par nom
        if (params.clientId) {
          sqlQuery = QUERIES.PROJECT_QUERIES.GET_BY_CLIENT;
          sqlParams = [params.clientId];
        } else if (params.clientName) {
          // Recherche d'abord le client par son nom
          const clientSearchQuery = QUERIES.CLIENT_QUERIES.SEARCH_BY_NAME;
          const clients = await this.databaseService.executeQuery(
            clientSearchQuery,
            [`%${params.clientName}%`],
          );

          if (clients && clients.length > 0) {
            sqlQuery = QUERIES.PROJECT_QUERIES.GET_BY_CLIENT;
            sqlParams = [clients[0].id];
          } else {
            throw new Error(`Client "${params.clientName}" non trouvé`);
          }
        } else {
          throw new Error('Nom ou ID du client non spécifié');
        }
        break;

      case 'ACTIVE_PROJECTS':
        sqlQuery = QUERIES.PROJECT_QUERIES.GET_ACTIVE;
        break;

      case 'COMPLETED_PROJECTS':
        sqlQuery = QUERIES.PROJECT_QUERIES.GET_COMPLETED;
        break;

      case 'PROJECT_PROGRESS':
        if (params.projectId) {
          sqlQuery = QUERIES.PROJECT_QUERIES.CALCULATE_PROGRESS;
          sqlParams = [params.projectId];
        } else if (params.projectName) {
          // Recherche d'abord le projet par son nom
          const projectSearchQuery = QUERIES.PROJECT_QUERIES.SEARCH_BY_NAME;
          const projects = await this.databaseService.executeQuery(
            projectSearchQuery,
            [`%${params.projectName}%`],
          );

          if (projects && projects.length > 0) {
            sqlQuery = QUERIES.PROJECT_QUERIES.CALCULATE_PROGRESS;
            sqlParams = [projects[0].id];
          } else {
            throw new Error(`Projet "${params.projectName}" non trouvé`);
          }
        } else {
          throw new Error('Nom ou ID du projet non spécifié');
        }
        break;

      case 'OVERDUE_TASKS':
        sqlQuery = QUERIES.TASK_QUERIES.GET_OVERDUE;
        break;

      case 'TASKS_THIS_MONTH':
        sqlQuery = QUERIES.TASK_QUERIES.GET_UPCOMING;
        sqlParams = [
          PROMPTS.DATE_UTILS.getFirstDayOfCurrentMonth(),
          PROMPTS.DATE_UTILS.getLastDayOfCurrentMonth(),
        ];
        break;

      case 'TASKS_BY_USER':
        if (params.userId) {
          sqlQuery = QUERIES.TASK_QUERIES.GET_BY_USER;
          sqlParams = [params.userId];
        } else if (params.userName) {
          // Recherche d'abord l'utilisateur par son nom
          const userSearchQuery = QUERIES.USER_QUERIES.SEARCH_BY_NAME;
          const users = await this.databaseService.executeQuery(
            userSearchQuery,
            [`%${params.userName}%`],
          );

          if (users && users.length > 0) {
            sqlQuery = QUERIES.TASK_QUERIES.GET_BY_USER;
            sqlParams = [users[0].id];
          } else {
            throw new Error(`Utilisateur "${params.userName}" non trouvé`);
          }
        } else {
          throw new Error("Nom ou ID de l'utilisateur non spécifié");
        }
        break;

      case 'USER_WORKLOAD':
        if (params.userId) {
          sqlQuery = QUERIES.USER_QUERIES.GET_WORKLOAD;
          sqlParams = [params.userId];
        } else if (params.userName) {
          // Recherche d'abord l'utilisateur par son nom
          const userSearchQuery = QUERIES.USER_QUERIES.SEARCH_BY_NAME;
          const users = await this.databaseService.executeQuery(
            userSearchQuery,
            [`%${params.userName}%`],
          );

          if (users && users.length > 0) {
            sqlQuery = QUERIES.USER_QUERIES.GET_WORKLOAD;
            sqlParams = [users[0].id];
          } else {
            throw new Error(`Utilisateur "${params.userName}" non trouvé`);
          }
        } else {
          throw new Error("Nom ou ID de l'utilisateur non spécifié");
        }
        break;

      case 'PROJECT_PROGRESS_REPORT':
        sqlQuery = QUERIES.REPORT_QUERIES.PROJECT_PROGRESS_REPORT;
        break;

      case 'TASKS_BY_STATUS':
        sqlQuery = QUERIES.REPORT_QUERIES.TASKS_BY_STATUS;
        break;

      case 'USER_PERFORMANCE':
        sqlQuery = QUERIES.REPORT_QUERIES.USER_PERFORMANCE;
        break;

      default:
        throw new Error(`Intention non reconnue: ${intent}`);
    }

    // Exécution de la requête SQL
    return await this.databaseService.executeQuery(sqlQuery, sqlParams);
  }

  /**
   * Extrait les paramètres de la requête utilisateur
   * @param intent Intention identifiée
   * @param userQuery Requête utilisateur
   * @returns Paramètres extraits
   */
  private extractQueryParams(intent: string, userQuery: string): any {
    const params: any = {};

    // Extraction du nom du client
    if (intent === 'PROJECTS_BY_CLIENT' || intent === 'CLIENT_PROJECTS') {
      const clientRegex = /client\s+["']([^"']+)["']/i;
      const clientMatch = userQuery.match(clientRegex);

      if (clientMatch && clientMatch[1]) {
        params.clientName = clientMatch[1];
      }
    }

    // Extraction du nom du projet
    if (intent === 'PROJECT_PROGRESS') {
      const projectRegex = /(?:projet|chantier)\s+["']([^"']+)["']/i;
      const projectMatch = userQuery.match(projectRegex);

      if (projectMatch && projectMatch[1]) {
        params.projectName = projectMatch[1];
      }
    }

    // Extraction du nom de l'utilisateur
    if (intent === 'TASKS_BY_USER' || intent === 'USER_WORKLOAD') {
      const userRegex = /(?:utilisateur|user)\s+["']([^"']+)["']/i;
      const userMatch = userQuery.match(userRegex);

      if (userMatch && userMatch[1]) {
        params.userName = userMatch[1];
      }
    }

    return params;
  }
}
