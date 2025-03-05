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
// Importer les requêtes SQL
import { QUERIES } from '../var/index.query';
import {
  DatabaseQueries,
  QueryParams,
  ProjectResult,
  TaskResult,
  QuotationResult,
  SearchResponse,
  SearchResult,
  GenericResponse,
} from './models/query-types';

// Importer les services concrets
import { SearchService } from '../search/search.service';
import { SyncService } from '../search/sync.service';

// Interface pour les erreurs
interface ErrorWithMessage {
  message: string;
}

function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

function toErrorWithMessage(maybeError: unknown): ErrorWithMessage {
  if (isErrorWithMessage(maybeError)) return maybeError;

  try {
    return new Error(JSON.stringify(maybeError));
  } catch {
    // En cas d'échec de la sérialisation JSON
    return new Error(String(maybeError));
  }
}

function getErrorMessage(error: unknown): string {
  return toErrorWithMessage(error).message;
}

@Controller('database')
export class DatabaseController {
  private readonly logger = new Logger(DatabaseController.name);
  private QUERIES: DatabaseQueries;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly dbMetadataService: DatabaseMetadataService,
    private readonly searchService: SearchService,
    private readonly syncService: SyncService,
  ) {
    this.initializeQueries();
  }

  private initializeQueries(): void {
    try {
      // Charger les requêtes depuis le fichier index.query.ts
      this.QUERIES = QUERIES;
      this.logger.log('Requêtes SQL initialisées avec succès');
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'initialisation des requêtes SQL: ${getErrorMessage(error)}`,
      );
    }
  }

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
        `Erreur lors de l'exécution de la requête: ${getErrorMessage(error)}`,
      );
      return { error: getErrorMessage(error) };
    }
  }

  @Post('/process')
  async processRequest(
    @Body()
    body: {
      question: string;
      userId: string;
      analysedData: Record<string, unknown>;
    },
  ) {
    this.logger.log(
      `Traitement de la requête de l'agent d'analyse: ${body.question}`,
    );

    try {
      // Importer les variables de prompt
      const PROMPTS = await import('../var/prompt');

      // Récupérer les métadonnées de la base de données
      const dbMetadata = {
        tables: this.dbMetadataService.getAllTables(),
        enums: this.dbMetadataService.getAllEnums(),
      };

      // Analyser la question pour déterminer quelle table ou données sont nécessaires
      const { question } = body;

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
                response += `Le taux d'avancement est de ${result[0]?.progress_percentage || 0}%.\n`;
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
        } catch (error: unknown) {
          response = `J'ai analysé votre question concernant la base de données: "${question}"\n\n`;
          response += `Je n'ai pas pu exécuter la requête: ${error instanceof Error ? error.message : String(error)}\n\n`;
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
            } catch (error: unknown) {
              response += `Je n'ai pas pu récupérer les données de la table ${table.name}: ${error instanceof Error ? error.message : String(error)}\n\n`;
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
        `Erreur lors du traitement de la requête: ${getErrorMessage(error)}`,
      );
      return {
        reponse: `Désolé, une erreur est survenue lors du traitement de votre requête: ${getErrorMessage(error)}`,
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
        `Erreur lors de la récupération des détails de la table ${tableName}: ${getErrorMessage(error)}`,
      );
      return { error: getErrorMessage(error) };
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
        `Erreur lors de la récupération des données de la table ${tableName}: ${getErrorMessage(error)}`,
      );
      return { error: getErrorMessage(error) };
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
      this.logger.error(
        `Erreur lors de la recherche: ${getErrorMessage(error)}`,
      );
      return { error: getErrorMessage(error) };
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
        `Erreur lors de la récupération des données liées: ${getErrorMessage(error)}`,
      );
      return { error: getErrorMessage(error) };
    }
  }

  @Post('search/projects')
  async searchProjects(
    @Body() body: { query: string; filters?: Record<string, unknown> },
  ): Promise<SearchResponse> {
    try {
      const { query, filters = {} } = body;

      if (!query || query.trim() === '') {
        return {
          success: false,
          error: 'Requête de recherche invalide',
          message: 'Veuillez fournir une requête de recherche valide',
        };
      }

      const results = await this.searchService.searchProjects(query, filters);
      return {
        success: true,
        results,
        count: results.length,
        type: 'search',
        entity: 'projects',
      };
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la recherche de projets: ${getErrorMessage(error)}`,
      );
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  @Post('search/similar-projects/:id')
  async findSimilarProjects(@Param('id') id: string): Promise<SearchResponse> {
    try {
      const projectId = parseInt(id, 10);
      if (isNaN(projectId)) {
        return {
          success: false,
          error: 'ID de projet invalide',
        };
      }

      const results = await this.searchService.findSimilarProjects(projectId);
      return {
        success: true,
        results,
        count: results.length,
        type: 'similarity',
        entity: 'projects',
      };
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la recherche de projets similaires: ${getErrorMessage(error)}`,
      );
      return {
        success: false,
        error: getErrorMessage(error),
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
        `Erreur lors de la recherche de documents: ${getErrorMessage(error)}`,
      );
      return {
        success: false,
        error: getErrorMessage(error),
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
        `Erreur lors de la recherche de fournisseurs: ${getErrorMessage(error)}`,
      );
      return {
        success: false,
        error: getErrorMessage(error),
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
        `Erreur lors de la synchronisation Elasticsearch: ${getErrorMessage(error)}`,
      );
      return {
        success: false,
        error: getErrorMessage(error),
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
        `Erreur lors de la synchronisation de l'entité: ${getErrorMessage(error)}`,
      );
      return {
        success: false,
        error: getErrorMessage(error),
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
        `Erreur lors de la suppression de l'entité: ${getErrorMessage(error)}`,
      );
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  @Post('processNaturalLanguageQuery')
  async processNaturalLanguageQuery(
    @Body() body: { query: string },
  ): Promise<GenericResponse> {
    try {
      const { query } = body;
      if (!query) {
        return {
          success: false,
          error: 'Requête en langage naturel manquante',
        };
      }

      // Vérifier si c'est une requête de recherche
      if (this.isSearchQuery(query)) {
        const searchResults = await this.handleSearchQuery(query);
        return {
          success: true,
          data: searchResults,
        };
      }

      // Continuer avec le traitement existant pour les autres types de requêtes
      const intent = this.analyzeQueryIntent(query);
      const result = await this.executeQueryByIntent(intent, query);

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      this.logger.error(
        `Erreur lors du traitement de la requête: ${getErrorMessage(error)}`,
      );
      return {
        success: false,
        error: getErrorMessage(error),
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
      'search',
      'find',
    ];

    const lowerQuery = query.toLowerCase();
    return searchTerms.some((term) => lowerQuery.includes(term));
  }

  private async handleSearchQuery(
    query: string,
  ): Promise<Record<string, unknown>> {
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
    let results: unknown[] = [];
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
      type: 'search',
      entity: entityType,
      results: results || [],
      count: results?.length || 0,
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
      lowerQuery.includes('tous les projets') ||
      lowerQuery.includes('liste des projets')
    ) {
      return 'ALL_PROJECTS';
    } else if (
      lowerQuery.includes('projets demain') ||
      lowerQuery.includes('chantiers de demain')
    ) {
      return 'PROJECTS_TOMORROW';
    } else if (
      lowerQuery.includes("projets aujourd'hui") ||
      lowerQuery.includes('chantiers du jour')
    ) {
      return 'PROJECTS_TODAY';
    } else if (
      lowerQuery.includes('projets du client') ||
      lowerQuery.includes('chantiers du client')
    ) {
      return 'PROJECTS_BY_CLIENT';
    } else if (
      lowerQuery.includes('projets actifs') ||
      lowerQuery.includes('chantiers en cours')
    ) {
      return 'ACTIVE_PROJECTS';
    } else if (
      lowerQuery.includes('projets terminés') ||
      lowerQuery.includes('chantiers terminés')
    ) {
      return 'COMPLETED_PROJECTS';
    } else if (
      lowerQuery.includes('avancement') ||
      lowerQuery.includes('progression')
    ) {
      return 'PROJECT_PROGRESS';
    }

    // Tâches
    if (
      lowerQuery.includes('tâches en retard') ||
      lowerQuery.includes('retards')
    ) {
      return 'OVERDUE_TASKS';
    } else if (
      lowerQuery.includes('tâches ce mois') ||
      lowerQuery.includes('planning mensuel')
    ) {
      return 'TASKS_THIS_MONTH';
    } else if (
      lowerQuery.includes('tâches de') ||
      lowerQuery.includes('travail de')
    ) {
      return 'TASKS_BY_USER';
    } else if (
      lowerQuery.includes('charge de travail') ||
      lowerQuery.includes('planning de')
    ) {
      return 'USER_WORKLOAD';
    } else if (
      lowerQuery.includes('tâches') &&
      (lowerQuery.includes('terminé') ||
        lowerQuery.includes('en cours') ||
        lowerQuery.includes('à faire'))
    ) {
      return 'TASKS_BY_STATUS';
    } else if (lowerQuery.includes('tâche') && /\d+/.test(lowerQuery)) {
      return 'TASK_BY_ID';
    } else if (
      (lowerQuery.includes('cherche') || lowerQuery.includes('trouve')) &&
      lowerQuery.includes('tâche')
    ) {
      return 'SEARCH_TASKS';
    } else if (lowerQuery.includes('liste des tâches')) {
      return 'LIST_TASKS';
    }

    // Utilisateurs
    if (lowerQuery.includes('performance') && lowerQuery.includes('équipe')) {
      return 'USER_PERFORMANCE';
    } else if (lowerQuery.includes('utilisateur') && /\d+/.test(lowerQuery)) {
      return 'USER_BY_ID';
    } else if (lowerQuery.includes('utilisateur') && !/\d+/.test(lowerQuery)) {
      return 'USER_BY_NAME';
    } else if (lowerQuery.includes('rôle') || lowerQuery.includes('poste')) {
      return 'USERS_BY_ROLE';
    } else if (lowerQuery.includes('liste des utilisateurs')) {
      return 'LIST_USERS';
    }

    // Fournisseurs
    if (
      lowerQuery.includes('performance') &&
      lowerQuery.includes('fournisseur')
    ) {
      return 'SUPPLIER_PERFORMANCE';
    } else if (
      lowerQuery.includes('fournisseur') &&
      /\d+/.test(lowerQuery) &&
      (lowerQuery.includes('produit') || lowerQuery.includes('article'))
    ) {
      return 'SUPPLIER_PRODUCTS';
    } else if (
      lowerQuery.includes('fournisseur') &&
      /\d+/.test(lowerQuery) &&
      lowerQuery.includes('commande')
    ) {
      return 'SUPPLIER_ORDERS';
    } else if (lowerQuery.includes('fournisseur') && /\d+/.test(lowerQuery)) {
      return 'SUPPLIER_BY_ID';
    } else if (
      (lowerQuery.includes('cherche') || lowerQuery.includes('trouve')) &&
      lowerQuery.includes('fournisseur')
    ) {
      return 'SEARCH_SUPPLIERS';
    } else if (
      lowerQuery.includes('meilleurs fournisseurs') ||
      lowerQuery.includes('top fournisseurs')
    ) {
      return 'TOP_SUPPLIERS';
    } else if (lowerQuery.includes('liste des fournisseurs')) {
      return 'LIST_SUPPLIERS';
    }

    // Devis
    if (lowerQuery.includes('conversion') && lowerQuery.includes('devis')) {
      return 'QUOTATION_CONVERSION_STATS';
    } else if (lowerQuery.includes('devis acceptés')) {
      return 'ACCEPTED_QUOTATIONS';
    } else if (lowerQuery.includes('devis refusés')) {
      return 'REJECTED_QUOTATIONS';
    } else if (lowerQuery.includes('devis en attente')) {
      return 'PENDING_QUOTATIONS';
    } else if (lowerQuery.includes('devis expirés')) {
      return 'EXPIRED_QUOTATIONS';
    } else if (
      lowerQuery.includes('devis') &&
      lowerQuery.includes('mois prochain') &&
      lowerQuery.includes('accepté')
    ) {
      return 'QUOTATIONS_NEXT_MONTH_ACCEPTED';
    } else if (
      lowerQuery.includes('devis') &&
      lowerQuery.includes('mois prochain') &&
      lowerQuery.includes('refusé')
    ) {
      return 'QUOTATIONS_NEXT_MONTH_REJECTED';
    } else if (
      lowerQuery.includes('devis') &&
      lowerQuery.includes('mois prochain')
    ) {
      return 'QUOTATIONS_NEXT_MONTH_ALL';
    }

    // Intention par défaut si rien n'est reconnu
    return 'UNKNOWN';
  }

  /**
   * Exécute une requête SQL en fonction de l'intention détectée
   */
  private executeQueryByIntent(
    intent: string,
    userQuery: string,
  ): Promise<
    ProjectResult[] | TaskResult[] | QuotationResult[] | Record<string, unknown>
  > {
    // Vérifier si les requêtes sont initialisées
    if (!this.QUERIES || !this.QUERIES.projects || !this.QUERIES.tasks) {
      this.initializeQueries();
      // Vérifier à nouveau après l'initialisation
      if (!this.QUERIES || !this.QUERIES.projects || !this.QUERIES.tasks) {
        return Promise.reject(new Error('Requêtes SQL non initialisées'));
      }
    }

    // Utiliser les paramètres pour construire la requête
    this.extractQueryParams(intent, userQuery);
    // Retourner une promesse résolue pour l'instant
    return Promise.resolve([]);
  }

  /**
   * Extrait les paramètres de la requête utilisateur
   * @param intent Intention identifiée
   * @param userQuery Requête utilisateur
   * @returns Paramètres extraits
   */
  private extractQueryParams(intent: string, userQuery: string): QueryParams {
    // Utiliser les paramètres pour l'extraction
    const params: QueryParams = {};
    if (intent && userQuery) {
      // Logique d'extraction...
    }
    return params;
  }

  /**
   * Récupère le montant total des devis acceptés pour le mois prochain
   * @returns Le montant total des devis acceptés pour le mois prochain
   */
  @Get('quotations/accepted/next-month/total')
  async getAcceptedQuotationsNextMonthTotal(): Promise<{
    success: boolean;
    total_amount: number;
    message?: string;
    error?: string;
  }> {
    try {
      // Vérifier que les requêtes sont initialisées
      if (!this.QUERIES || !this.QUERIES.quotations) {
        this.initializeQueries();
      }

      // Définir les dates pour le mois prochain
      const nextMonthStart = new Date();
      nextMonthStart.setDate(1);
      nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);

      const nextMonthEnd = new Date(nextMonthStart);
      nextMonthEnd.setMonth(nextMonthEnd.getMonth() + 1);
      nextMonthEnd.setDate(0);

      interface QuotationTotal {
        total_amount: number;
      }

      // Exécuter la requête avec le type approprié
      const result = await this.databaseService.executeQuery<QuotationTotal[]>(
        this.QUERIES.quotations.GET_FILTERED_QUOTATIONS_TOTAL,
        [
          'accepté',
          nextMonthStart.toISOString().split('T')[0],
          nextMonthEnd.toISOString().split('T')[0],
        ],
      );

      return {
        success: true,
        total_amount: result && result.length > 0 ? result[0].total_amount : 0,
        message:
          'Montant total des devis acceptés pour le mois prochain récupéré avec succès',
      };
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la récupération du montant total des devis acceptés pour le mois prochain: ${getErrorMessage(error)}`,
      );
      return {
        success: false,
        total_amount: 0,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Traite les requêtes enrichies avec des métadonnées provenant de l'agent d'analyse
   * Cet endpoint est spécialement conçu pour fonctionner avec les métadonnées enrichies
   */
  @Post('query')
  async processEnrichedQuery(
    @Body()
    enrichedRequest: {
      question: string;
      userId?: string;
      metadata?: {
        primaryTable?: string;
        isFinancialQuery?: boolean;
        aggregationType?: string | null;
        filters?: {
          status?: string | null;
          timeframe?: string | null;
        };
        analysis?: {
          intention?: string;
          entites?: string[];
          contexte?: string;
        };
        noTableIdentified?: boolean;
        possibleTables?: string[];
      };
    },
  ) {
    this.logger.log(
      `Traitement de la requête enrichie: ${enrichedRequest.question}`,
    );

    if (enrichedRequest.metadata) {
      this.logger.log(
        `Métadonnées reçues: ${JSON.stringify(enrichedRequest.metadata)}`,
      );
    }

    try {
      // Si la table principale est quotations et c'est une requête financière
      if (
        enrichedRequest.metadata?.primaryTable === 'quotations' &&
        enrichedRequest.metadata?.isFinancialQuery
      ) {
        // Récupérer le statut et la période depuis les métadonnées
        const status = enrichedRequest.metadata.filters?.status || null;
        const timeframe = enrichedRequest.metadata.filters?.timeframe || null;

        this.logger.log(
          `Requête devis identifiée - Status: ${status}, Période: ${timeframe}`,
        );

        // Définir les dates de début et de fin en fonction de la période
        let startDate = new Date();
        let endDate = new Date();

        // Configurer les dates en fonction de la période
        if (timeframe === 'current_month') {
          // Mois actuel
          startDate = new Date(
            startDate.getFullYear(),
            startDate.getMonth(),
            1,
          );
          endDate = new Date(
            startDate.getFullYear(),
            startDate.getMonth() + 1,
            0,
          );
        } else if (timeframe === 'next_month') {
          // Mois prochain
          startDate = new Date(
            startDate.getFullYear(),
            startDate.getMonth() + 1,
            1,
          );
          endDate = new Date(
            startDate.getFullYear(),
            startDate.getMonth() + 1,
            0,
          );
        } else if (timeframe === 'current_year') {
          // Année actuelle
          startDate = new Date(startDate.getFullYear(), 0, 1);
          endDate = new Date(startDate.getFullYear(), 11, 31);
        } else if (timeframe === 'next_year') {
          // Année prochaine
          startDate = new Date(startDate.getFullYear() + 1, 0, 1);
          endDate = new Date(startDate.getFullYear() + 1, 11, 31);
        } else {
          // Par défaut, utiliser le mois actuel
          startDate = new Date(
            startDate.getFullYear(),
            startDate.getMonth(),
            1,
          );
          endDate = new Date(
            startDate.getFullYear(),
            startDate.getMonth() + 1,
            0,
          );
        }

        // Convertir les dates en format ISO pour SQL
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        this.logger.log(`Période calculée: ${startDateStr} à ${endDateStr}`);

        // Exécuter la requête avec le type approprié
        interface QuotationTotal {
          total_amount: number;
        }

        const result = await this.databaseService.executeQuery<
          QuotationTotal[]
        >(this.QUERIES.quotations.GET_FILTERED_QUOTATIONS_TOTAL, [
          status,
          startDateStr,
          endDateStr,
        ]);

        const totalAmount =
          result && result.length > 0 ? result[0].total_amount : 0;

        // Formater un message de réponse selon la période et le statut
        let periodDesc = '';
        if (timeframe === 'current_month') periodDesc = 'du mois actuel';
        else if (timeframe === 'next_month') periodDesc = 'du mois prochain';
        else if (timeframe === 'current_year')
          periodDesc = "de l'année en cours";
        else if (timeframe === 'next_year') periodDesc = "de l'année prochaine";

        const statusDesc = status || 'tous statuts confondus';

        let responseMessage = '';
        if (totalAmount > 0) {
          responseMessage = `Le montant total des devis ${statusDesc} ${periodDesc} est de ${totalAmount.toLocaleString('fr-FR')} €.`;
        } else {
          responseMessage = `Aucun devis ${statusDesc} n'a été trouvé ${periodDesc}.`;
        }

        return {
          reponse: responseMessage,
        };
      }

      // Traiter d'autres types de requêtes ici...

      // Si aucun traitement spécifique n'a été effectué, utiliser le traitement standard
      return this.processRequest({
        question: enrichedRequest.question,
        userId: enrichedRequest.userId || 'anonymous',
        analysedData: enrichedRequest.metadata || {},
      });
    } catch (error) {
      this.logger.error(
        `Erreur lors du traitement de la requête enrichie: ${getErrorMessage(error)}`,
      );
      return {
        reponse: `Désolé, une erreur est survenue lors du traitement de votre demande: ${getErrorMessage(error)}`,
      };
    }
  }
}
