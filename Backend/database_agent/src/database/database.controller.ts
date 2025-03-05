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

// Interfaces pour typer les résultats des méthodes de recherche
interface ProjectSearchResult {
  id: number;
  name: string;
  client_name?: string;
  description?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  [key: string]: any;
}

interface DocumentSearchResult {
  id: number;
  title: string;
  description?: string;
  file_path?: string;
  file_type?: string;
  created_at?: string;
  [key: string]: any;
}

interface SupplierSearchResult {
  id: number;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  category?: string;
  [key: string]: any;
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

      const results = (await this.searchService.searchProjects(
        query,
        filters,
      )) as ProjectSearchResult[];
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

      const results = (await this.searchService.findSimilarProjects(
        projectId,
      )) as ProjectSearchResult[];
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

      const results = (await this.searchService.searchDocuments(
        query,
      )) as DocumentSearchResult[];
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

      const results = (await this.searchService.searchSuppliers(
        query,
      )) as SupplierSearchResult[];
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
    let entityType = 'projects';

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
          const results = (await this.searchService.findSimilarProjects(
            projectId,
          )) as ProjectSearchResult[];
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
        results = (await this.searchService.searchDocuments(
          query,
        )) as DocumentSearchResult[];
        break;
      case 'suppliers':
        results = (await this.searchService.searchSuppliers(
          query,
        )) as SupplierSearchResult[];
        break;
      case 'projects':
      default:
        results = (await this.searchService.searchProjects(
          query,
        )) as ProjectSearchResult[];
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
  @Post('enriched-query')
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
  ): Promise<{ reponse: string; success?: boolean; error?: string }> {
    this.logger.log(
      `Traitement de la requête enrichie: ${enrichedRequest.question}`,
    );

    if (enrichedRequest.metadata) {
      this.logger.log(
        `Métadonnées reçues: ${JSON.stringify(enrichedRequest.metadata)}`,
      );
    }

    try {
      // Si aucune métadonnée n'est fournie
      if (!enrichedRequest.metadata) {
        this.logger.warn('Aucune métadonnée reçue pour la requête enrichie');
        return {
          reponse:
            "Je n'ai pas assez d'informations pour traiter votre demande. Pourriez-vous la reformuler avec plus de détails ?",
          success: false,
        };
      }

      // -------- GESTION DES REQUÊTES FINANCIÈRES SUR LES DEVIS --------
      if (
        enrichedRequest.metadata.primaryTable === 'quotations' &&
        enrichedRequest.metadata.isFinancialQuery
      ) {
        return await this.handleQuotationsFinancialQuery(enrichedRequest);
      }

      // -------- GESTION DES REQUÊTES FINANCIÈRES SUR LES FACTURES --------
      if (
        enrichedRequest.metadata.primaryTable === 'invoices' &&
        enrichedRequest.metadata.isFinancialQuery
      ) {
        return await this.handleInvoicesFinancialQuery(enrichedRequest);
      }

      // -------- GESTION DES REQUÊTES SUR LES CLIENTS --------
      if (enrichedRequest.metadata.primaryTable === 'clients') {
        return await this.handleClientsQuery(enrichedRequest);
      }

      // -------- GESTION DES REQUÊTES SUR LES PROJETS --------
      if (enrichedRequest.metadata.primaryTable === 'projects') {
        return await this.handleProjectsQuery(enrichedRequest);
      }

      // -------- GESTION DES REQUÊTES SANS TABLE IDENTIFIÉE --------
      if (
        enrichedRequest.metadata.noTableIdentified &&
        enrichedRequest.metadata.possibleTables &&
        enrichedRequest.metadata.possibleTables.length > 0
      ) {
        const tablesList = enrichedRequest.metadata.possibleTables.join(', ');
        return {
          reponse: `Je n'ai pas pu identifier clairement la table de données à interroger. Votre question concerne-t-elle l'une de ces tables : ${tablesList} ? Pourriez-vous reformuler votre question en précisant le type de données que vous recherchez ?`,
          success: false,
        };
      }

      // Si aucun traitement spécifique n'a été effectué, essayer la méthode générique
      const processResult = await this.processRequest({
        question: enrichedRequest.question,
        userId: enrichedRequest.userId || 'anonymous',
        analysedData: enrichedRequest.metadata || {},
      });

      // Si le traitement générique renvoie un résultat vide, proposer des alternatives
      if (processResult.reponse.includes("Je n'ai pas trouvé de résultats")) {
        return {
          reponse: `${processResult.reponse}\n\nVeuillez noter que je suis spécialisé dans les données de gestion de chantier, notamment :\n- Les devis et factures\n- Les clients et projets\n- Les matériaux et fournisseurs\n\nEssayez de poser une question plus spécifique sur l'un de ces domaines.`,
          success: true,
        };
      }

      return {
        reponse: processResult.reponse,
        success: true,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors du traitement de la requête enrichie: ${getErrorMessage(error)}`,
      );
      return {
        reponse: `Désolé, une erreur est survenue lors du traitement de votre demande: ${getErrorMessage(error)}`,
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Gère les requêtes financières sur les devis
   */
  private async handleQuotationsFinancialQuery(enrichedRequest: {
    question: string;
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
      };
    };
  }): Promise<{ reponse: string; success: boolean; error?: string }> {
    // Récupérer le statut et la période depuis les métadonnées
    const status = enrichedRequest.metadata?.filters?.status || null;
    const timeframe = enrichedRequest.metadata?.filters?.timeframe || null;

    this.logger.log(
      `Requête devis identifiée - Status: ${status}, Période: ${timeframe}`,
    );

    // Définir les dates de début et de fin en fonction de la période
    let startDate = new Date();
    let endDate = new Date();

    // Configurer les dates en fonction de la période
    if (timeframe === 'current_month') {
      // Mois actuel
      startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    } else if (timeframe === 'next_month') {
      // Mois prochain
      startDate = new Date(
        startDate.getFullYear(),
        startDate.getMonth() + 1,
        1,
      );
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 2, 0);
    } else if (timeframe === 'current_week') {
      // Semaine actuelle
      const day = startDate.getDay();
      const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // Ajuster si c'est dimanche
      startDate = new Date(startDate.setDate(diff));
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
    } else if (timeframe === 'next_week') {
      // Semaine prochaine
      const day = startDate.getDay();
      const diff = startDate.getDate() - day + (day === 0 ? -6 : 1) + 7; // +7 pour la semaine prochaine
      startDate = new Date(startDate.setDate(diff));
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
    } else if (timeframe === 'current_year') {
      // Année actuelle
      startDate = new Date(startDate.getFullYear(), 0, 1);
      endDate = new Date(startDate.getFullYear(), 11, 31);
    } else if (timeframe === 'next_year') {
      // Année prochaine
      startDate = new Date(startDate.getFullYear() + 1, 0, 1);
      endDate = new Date(startDate.getFullYear(), 11, 31);
    } else {
      // Par défaut, utiliser le mois actuel
      startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    }

    // Convertir les dates en format ISO pour SQL
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    this.logger.log(`Période calculée: ${startDateStr} à ${endDateStr}`);

    interface QuotationTotal {
      total_amount: number | null;
      count?: number;
    }

    interface QuotationDetail {
      id: number;
      reference: string;
      total: number;
      created_date: string;
      client_name?: string;
    }

    try {
      // D'abord, obtenir le montant total
      const totalResult = await this.databaseService.executeQuery<
        QuotationTotal[]
      >(this.QUERIES.quotations.GET_FILTERED_QUOTATIONS_TOTAL, [
        status,
        startDateStr,
        endDateStr,
      ]);

      const totalAmount =
        totalResult && totalResult.length > 0
          ? totalResult[0].total_amount || 0
          : 0;

      // Ensuite, obtenir le nombre de devis concernés
      const countQuery = `
        SELECT COUNT(*) as count
        FROM quotations q
        WHERE 
          ($1::text IS NULL OR q.status = $1)
          AND q.created_date BETWEEN $2::date AND $3::date
      `;

      const countResult = await this.databaseService.executeQuery<
        QuotationTotal[]
      >(countQuery, [status, startDateStr, endDateStr]);

      const count =
        countResult && countResult.length > 0 ? countResult[0].count || 0 : 0;

      // Si demandé, récupérer également les détails des devis
      let detailsInfo = '';
      if (count > 0 && count <= 5) {
        const detailsQuery = `
          SELECT q.id, q.reference, q.total, q.created_date, c.name as client_name
          FROM quotations q
          JOIN projects p ON q.project_id = p.id
          JOIN clients c ON p.client_id = c.id
          WHERE 
            ($1::text IS NULL OR q.status = $1)
            AND q.created_date BETWEEN $2::date AND $3::date
          ORDER BY q.created_date DESC
          LIMIT 5
        `;

        const details = await this.databaseService.executeQuery<
          QuotationDetail[]
        >(detailsQuery, [status, startDateStr, endDateStr]);

        if (details && details.length > 0) {
          detailsInfo = '\n\nVoici les détails des devis concernés:\n';
          details.forEach((d) => {
            detailsInfo += `- Devis ${d.reference} pour ${d.client_name || 'client'}: ${d.total.toLocaleString('fr-FR')} € (${new Date(d.created_date).toLocaleDateString('fr-FR')})\n`;
          });
        }
      }

      // Formater un message de réponse selon la période et le statut
      let periodDesc = '';
      if (timeframe === 'current_month') periodDesc = 'du mois actuel';
      else if (timeframe === 'next_month') periodDesc = 'du mois prochain';
      else if (timeframe === 'current_week')
        periodDesc = 'de la semaine actuelle';
      else if (timeframe === 'next_week')
        periodDesc = 'de la semaine prochaine';
      else if (timeframe === 'current_year') periodDesc = "de l'année en cours";
      else if (timeframe === 'next_year') periodDesc = "de l'année prochaine";
      else periodDesc = 'de la période spécifiée';

      let statusDesc = '';
      if (status === 'accepté') statusDesc = 'acceptés';
      else if (status === 'validé') statusDesc = 'validés';
      else if (status === 'en_attente') statusDesc = 'en attente';
      else if (status === 'refusé') statusDesc = 'refusés';
      else statusDesc = 'tous statuts confondus';

      let responseMessage = '';
      if (totalAmount > 0) {
        responseMessage = `Le montant total des devis ${statusDesc} ${periodDesc} est de ${Number(totalAmount).toLocaleString('fr-FR')} €.\n`;
        responseMessage += `Ce montant correspond à ${count} devis.${detailsInfo}`;
      } else {
        responseMessage = `Aucun devis ${statusDesc} n'a été trouvé ${periodDesc}.`;
      }

      return {
        reponse: responseMessage,
        success: true,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors du traitement de la requête sur les devis: ${getErrorMessage(error)}`,
      );
      return {
        reponse: `Désolé, une erreur est survenue lors de la récupération des informations sur les devis: ${getErrorMessage(error)}`,
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Gère les requêtes financières sur les factures
   */
  private async handleInvoicesFinancialQuery(enrichedRequest: {
    question: string;
    metadata?: {
      primaryTable?: string;
      isFinancialQuery?: boolean;
      aggregationType?: string | null;
      filters?: {
        status?: string | null;
        timeframe?: string | null;
      };
    };
  }): Promise<{
    reponse: string;
    success: boolean;
    error?: string;
    data?: any;
  }> {
    try {
      // Extraction des métadonnées pour le filtrage
      const status = enrichedRequest.metadata?.filters?.status || null;
      const timeframe = enrichedRequest.metadata?.filters?.timeframe || null;

      // Définir la période en fonction du timeframe
      let periodStart = '';
      let periodEnd = '';
      let periodDescription = '';

      switch (timeframe) {
        case 'current_month':
          periodStart = "DATE_TRUNC('month', CURRENT_DATE)";
          periodEnd =
            "DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'";
          periodDescription = 'du mois actuel';
          break;
        case 'next_month':
          periodStart =
            "DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'";
          periodEnd =
            "DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '2 month' - INTERVAL '1 day'";
          periodDescription = 'du mois prochain';
          break;
        case 'current_year':
          periodStart = "DATE_TRUNC('year', CURRENT_DATE)";
          periodEnd =
            "DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day'";
          periodDescription = "de l'année courante";
          break;
        default:
          // Par défaut, on prend les 3 derniers mois
          periodStart = "CURRENT_DATE - INTERVAL '3 month'";
          periodEnd = 'CURRENT_DATE';
          periodDescription = 'des 3 derniers mois';
      }

      // Construire la condition de filtrage par statut
      let statusCondition = '';
      if (status) {
        statusCondition = `AND status = '${status}'`;
      }

      // Requête pour obtenir la somme des factures selon les critères
      const sumQuery = `
        SELECT 
          COALESCE(SUM(total_amount), 0) as total,
          COUNT(*) as count 
        FROM invoices 
        WHERE issue_date BETWEEN ${periodStart} AND ${periodEnd}
        ${statusCondition}
      `;

      interface InvoiceTotal {
        total: string;
        count: string;
      }

      // Exécuter la requête avec cache si pas de statut spécifique
      const useCache = !status && timeframe === 'current_month';
      const result = await this.databaseService.executeQuery<InvoiceTotal[]>(
        sumQuery,
        [],
        useCache,
      );

      let responseMessage = '';

      if (result && result.length > 0) {
        const total = parseFloat(result[0].total).toLocaleString('fr-FR', {
          style: 'currency',
          currency: 'EUR',
        });
        const count = parseInt(result[0].count);

        const statusText = status ? `avec le statut "${status}"` : '';

        if (count > 0) {
          responseMessage = `Le montant total des factures ${statusText} ${periodDescription} est de ${total} (${count} facture${count > 1 ? 's' : ''}).`;

          // Si on a un petit nombre de factures, récupérer les détails
          if (count <= 10) {
            const detailsQuery = `
              SELECT 
                id, 
                reference,
                total_amount as total,
                issue_date,
                due_date,
                status,
                (SELECT name FROM clients WHERE id = invoices.client_id) as client_name
              FROM invoices 
              WHERE issue_date BETWEEN ${periodStart} AND ${periodEnd}
              ${statusCondition}
              ORDER BY issue_date DESC
            `;

            interface InvoiceDetail {
              id: number;
              reference: string;
              total: number;
              issue_date: string;
              due_date: string;
              status: string;
              client_name: string;
            }

            const details = await this.databaseService.executeQuery<
              InvoiceDetail[]
            >(detailsQuery, []);

            if (details && details.length > 0) {
              responseMessage += '\n\nVoici le détail :\n';

              details.forEach((invoice, index) => {
                const issueDate = new Date(
                  invoice.issue_date,
                ).toLocaleDateString('fr-FR');
                const dueDate = new Date(invoice.due_date).toLocaleDateString(
                  'fr-FR',
                );
                const amount = parseFloat(
                  invoice.total.toString(),
                ).toLocaleString('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                });

                responseMessage += `\n${index + 1}. Facture ${invoice.reference} - ${amount}`;
                responseMessage += `\n   Client: ${invoice.client_name}`;
                responseMessage += `\n   Émise le: ${issueDate}`;
                responseMessage += `\n   Échéance: ${dueDate}`;
                responseMessage += `\n   Statut: ${invoice.status}`;
                responseMessage += '\n';
              });
            }
          }
        } else {
          responseMessage = `Aucune facture ${statusText} trouvée ${periodDescription}.`;
        }
      } else {
        responseMessage =
          'Aucune donnée de facture disponible pour la période demandée.';
      }

      return {
        success: true,
        reponse: responseMessage,
        data: {
          total: result[0]?.total || 0,
          count: result[0]?.count || 0,
          period: {
            timeframe,
            description: periodDescription,
          },
        },
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(
        `Erreur lors de la récupération des factures: ${errorMessage}`,
      );

      return {
        success: false,
        reponse: `Désolé, une erreur est survenue lors de la récupération des données de factures: ${errorMessage}`,
        error: errorMessage,
      };
    }
  }

  /**
   * Gère les requêtes sur les clients avec filtrage avancé
   */
  private async handleClientsQuery(enrichedRequest: {
    question: string;
    metadata?: {
      primaryTable?: string;
      filters?: {
        status?: string | null;
        timeframe?: string | null;
      };
      analysis?: {
        intention?: string;
        entites?: string[];
      };
    };
  }): Promise<{
    reponse: string;
    success: boolean;
    error?: string;
    data?: any;
  }> {
    try {
      // Extraction des métadonnées pour le filtrage
      const intention = enrichedRequest.metadata?.analysis?.intention || '';

      // Structure pour stocker les résultats
      interface ClientResult {
        id: number;
        name: string;
        email?: string;
        phone?: string;
        contact_person?: string;
        created_at?: string;
        total_projects?: number;
        total_quotations?: number;
        total_invoices?: number;
      }

      let clients: ClientResult[] = [];
      let query = '';
      let params: any[] = [];
      let responseMessage = '';

      // Déterminer le type de requête basé sur l'intention
      if (
        intention.includes('liste') ||
        intention.includes('tous') ||
        intention.includes('récent')
      ) {
        // Requête pour lister tous les clients, potentiellement avec une limite sur les plus récents
        const limit = intention.includes('récent') ? 10 : 100;

        query = `
          SELECT c.id, c.name, c.email, c.phone, c.contact_person, c.created_at,
            COUNT(DISTINCT p.id) as total_projects,
            COUNT(DISTINCT q.id) as total_quotations,
            COUNT(DISTINCT i.id) as total_invoices
          FROM clients c
          LEFT JOIN projects p ON c.id = p.client_id
          LEFT JOIN quotations q ON c.id = q.client_id
          LEFT JOIN invoices i ON c.id = i.client_id
          GROUP BY c.id
          ORDER BY c.created_at DESC
          LIMIT $1
        `;

        params = [limit];

        // Utiliser le cache pour cette requête fréquente
        clients = await this.databaseService.executeQuery<ClientResult[]>(
          query,
          params,
          true,
        );

        responseMessage =
          clients.length > 0
            ? `Voici la liste des ${clients.length} clients ${intention.includes('récent') ? 'les plus récents' : ''}.`
            : 'Aucun client trouvé dans la base de données.';
      } else if (
        intention.includes('statistique') ||
        intention.includes('nombre')
      ) {
        // Requête pour obtenir des statistiques sur les clients
        query = `
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as last_month,
            COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as last_week
          FROM clients
        `;

        interface ClientStats {
          total: string;
          last_month: string;
          last_week: string;
        }

        // Cette requête est moins fréquente, ne pas utiliser le cache
        const stats =
          await this.databaseService.executeQuery<ClientStats[]>(query);

        if (stats.length > 0) {
          responseMessage = `Statistiques des clients :\n`;
          responseMessage += `- Nombre total de clients : ${stats[0].total}\n`;
          responseMessage += `- Nouveaux clients (30 derniers jours) : ${stats[0].last_month}\n`;
          responseMessage += `- Nouveaux clients (7 derniers jours) : ${stats[0].last_week}`;
        } else {
          responseMessage =
            'Impossible de récupérer les statistiques des clients.';
        }
      } else if (
        intention.includes('recherche') ||
        intention.includes('trouver')
      ) {
        // Recherche de clients par nom ou email
        const entities = enrichedRequest.metadata?.analysis?.entites || [];
        let searchTerm = '';

        // Extraire le terme de recherche des entités
        for (const entity of entities) {
          if (entity && entity.length > 2) {
            searchTerm = entity;
            break;
          }
        }

        if (!searchTerm) {
          return {
            success: false,
            reponse:
              "Je n'ai pas pu identifier de terme de recherche pour les clients. Pourriez-vous préciser le nom ou l'email du client que vous recherchez?",
          };
        }

        query = `
          SELECT c.id, c.name, c.email, c.phone, c.contact_person, c.created_at,
            COUNT(DISTINCT p.id) as total_projects,
            COUNT(DISTINCT q.id) as total_quotations,
            COUNT(DISTINCT i.id) as total_invoices
          FROM clients c
          LEFT JOIN projects p ON c.id = p.client_id
          LEFT JOIN quotations q ON c.id = q.client_id
          LEFT JOIN invoices i ON c.id = i.client_id
          WHERE c.name ILIKE $1 OR c.email ILIKE $1 OR c.contact_person ILIKE $1
          GROUP BY c.id
          ORDER BY c.name
          LIMIT 10
        `;

        params = [`%${searchTerm}%`];

        clients = await this.databaseService.executeQuery<ClientResult[]>(
          query,
          params,
        );

        responseMessage =
          clients.length > 0
            ? `J'ai trouvé ${clients.length} client(s) correspondant à "${searchTerm}".`
            : `Aucun client ne correspond à "${searchTerm}" dans notre base de données.`;
      }

      // Formater la réponse avec les résultats
      if (clients.length > 0) {
        responseMessage += '\n\nVoici les détails :\n';
        clients.forEach((client, index) => {
          responseMessage += `\n${index + 1}. ${client.name}`;
          if (client.email) responseMessage += `\n   Email: ${client.email}`;
          if (client.phone)
            responseMessage += `\n   Téléphone: ${client.phone}`;
          if (client.contact_person)
            responseMessage += `\n   Contact: ${client.contact_person}`;
          if (client.total_projects)
            responseMessage += `\n   Projets: ${client.total_projects}`;
          if (client.total_quotations)
            responseMessage += `\n   Devis: ${client.total_quotations}`;
          if (client.total_invoices)
            responseMessage += `\n   Factures: ${client.total_invoices}`;
          responseMessage += '\n';
        });
      }

      return {
        success: true,
        reponse: responseMessage,
        data: { clients },
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(
        `Erreur lors de la récupération des clients: ${errorMessage}`,
      );

      return {
        success: false,
        reponse: `Désolé, une erreur est survenue lors de la récupération des données clients: ${errorMessage}`,
        error: errorMessage,
      };
    }
  }

  /**
   * Gère les requêtes sur les projets avec filtrage avancé
   */
  private async handleProjectsQuery(enrichedRequest: {
    question: string;
    metadata?: {
      primaryTable?: string;
      filters?: {
        status?: string | null;
        timeframe?: string | null;
      };
      analysis?: {
        intention?: string;
        entites?: string[];
      };
    };
  }): Promise<{
    reponse: string;
    success: boolean;
    error?: string;
    data?: any;
  }> {
    try {
      // Extraction des métadonnées pour le filtrage
      const intention = enrichedRequest.metadata?.analysis?.intention || '';
      const status = enrichedRequest.metadata?.filters?.status || null;
      const timeframe = enrichedRequest.metadata?.filters?.timeframe || null;
      const entities = enrichedRequest.metadata?.analysis?.entites || [];

      // Structure pour stocker les résultats
      interface ProjectResult {
        id: number;
        name: string;
        client_name: string;
        status: string;
        start_date?: string;
        end_date?: string;
        progress?: number;
        total_tasks?: number;
        completed_tasks?: number;
      }

      let projects: ProjectResult[] = [];
      let query = '';
      const params: any[] = [];
      const whereConditions: string[] = [];
      let responseMessage = '';

      // Construction des conditions de filtrage
      if (status) {
        whereConditions.push('p.status = $1');
        params.push(status);
      }

      // Filtrage par période
      if (timeframe) {
        let dateCondition = '';

        switch (timeframe) {
          case 'current_month':
            dateCondition = `DATE_TRUNC('month', p.start_date) = DATE_TRUNC('month', CURRENT_DATE)`;
            break;
          case 'next_month':
            dateCondition = `DATE_TRUNC('month', p.start_date) = DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month')`;
            break;
          case 'current_year':
            dateCondition = `EXTRACT(YEAR FROM p.start_date) = EXTRACT(YEAR FROM CURRENT_DATE)`;
            break;
          case 'last_month':
            dateCondition = `DATE_TRUNC('month', p.start_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`;
            break;
        }

        if (dateCondition) {
          whereConditions.push(dateCondition);
        }
      }

      // Recherche par entité (client ou nom de projet)
      let searchTerm = '';
      for (const entity of entities) {
        if (entity && entity.length > 2) {
          searchTerm = entity;
          break;
        }
      }

      if (searchTerm) {
        whereConditions.push(
          `(p.name ILIKE $${params.length + 1} OR c.name ILIKE $${params.length + 1})`,
        );
        params.push(`%${searchTerm}%`);
      }

      // Création de la clause WHERE
      const whereClause =
        whereConditions.length > 0
          ? 'WHERE ' + whereConditions.join(' AND ')
          : '';

      // Déterminer le type de requête basé sur l'intention
      if (
        intention.includes('liste') ||
        intention.includes('tous') ||
        intention.includes('en cours')
      ) {
        // Requête pour lister les projets
        const orderClause = intention.includes('récent')
          ? 'ORDER BY p.start_date DESC'
          : 'ORDER BY p.status, p.name';
        const limitClause = 'LIMIT 20';

        query = `
          SELECT p.id, p.name, c.name as client_name, p.status, 
                 p.start_date, p.end_date,
                 COALESCE(COUNT(t.id), 0) as total_tasks,
                 COALESCE(SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END), 0) as completed_tasks,
                 CASE
                   WHEN COALESCE(COUNT(t.id), 0) = 0 THEN 0
                   ELSE ROUND((COALESCE(SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END), 0)::float / COUNT(t.id)) * 100)
                 END as progress
          FROM projects p
          LEFT JOIN clients c ON p.client_id = c.id
          LEFT JOIN tasks t ON p.id = t.project_id
          ${whereClause}
          GROUP BY p.id, p.name, c.name, p.status, p.start_date, p.end_date
          ${orderClause}
          ${limitClause}
        `;

        // Utiliser le cache si aucun filtre spécifique n'est appliqué
        const useCache = whereConditions.length === 0;
        projects = await this.databaseService.executeQuery<ProjectResult[]>(
          query,
          params,
          useCache,
        );

        const statusFilter = status ? `avec le statut "${status}"` : '';
        const timeFrameText = this.getTimeframeText(timeframe);
        const searchFilter = searchTerm
          ? `correspondant à "${searchTerm}"`
          : '';

        responseMessage =
          projects.length > 0
            ? `Voici la liste des ${projects.length} projets ${statusFilter} ${timeFrameText} ${searchFilter}.`
            : `Aucun projet ${statusFilter} ${timeFrameText} ${searchFilter} n'a été trouvé.`;
      } else if (
        intention.includes('statistique') ||
        intention.includes('nombre')
      ) {
        // Requête pour obtenir des statistiques sur les projets
        query = `
          SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
            COUNT(CASE WHEN status = 'on_hold' THEN 1 END) as on_hold,
            COUNT(CASE WHEN end_date < CURRENT_DATE AND status != 'completed' THEN 1 END) as late
          FROM projects p
          ${whereClause}
        `;

        interface ProjectStats {
          total: string;
          in_progress: string;
          completed: string;
          on_hold: string;
          late: string;
        }

        const stats = await this.databaseService.executeQuery<ProjectStats[]>(
          query,
          params,
        );

        if (stats.length > 0) {
          responseMessage = `Statistiques des projets :\n`;
          responseMessage += `- Nombre total de projets : ${stats[0].total}\n`;
          responseMessage += `- Projets en cours : ${stats[0].in_progress}\n`;
          responseMessage += `- Projets terminés : ${stats[0].completed}\n`;
          responseMessage += `- Projets en attente : ${stats[0].on_hold}\n`;
          responseMessage += `- Projets en retard : ${stats[0].late}`;
        } else {
          responseMessage =
            'Impossible de récupérer les statistiques des projets.';
        }
      }

      // Formater la réponse avec les résultats
      if (projects.length > 0) {
        responseMessage += '\n\nVoici les détails :\n';
        projects.forEach((project, index) => {
          responseMessage += `\n${index + 1}. ${project.name} (${project.status})`;
          responseMessage += `\n   Client: ${project.client_name}`;
          if (project.start_date)
            responseMessage += `\n   Date de début: ${new Date(project.start_date).toLocaleDateString('fr-FR')}`;
          if (project.end_date)
            responseMessage += `\n   Date de fin: ${new Date(project.end_date).toLocaleDateString('fr-FR')}`;
          if (project.progress !== undefined)
            responseMessage += `\n   Progression: ${project.progress}%`;
          if (project.total_tasks)
            responseMessage += `\n   Tâches: ${project.completed_tasks}/${project.total_tasks} complétées`;
          responseMessage += '\n';
        });
      }

      return {
        success: true,
        reponse: responseMessage,
        data: { projects },
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(
        `Erreur lors de la récupération des projets: ${errorMessage}`,
      );

      return {
        success: false,
        reponse: `Désolé, une erreur est survenue lors de la récupération des données des projets: ${errorMessage}`,
        error: errorMessage,
      };
    }
  }

  /**
   * Convertit le paramètre timeframe en texte descriptif
   */
  private getTimeframeText(timeframe: string | null): string {
    if (!timeframe) return '';

    switch (timeframe) {
      case 'current_month':
        return 'du mois actuel';
      case 'next_month':
        return 'du mois prochain';
      case 'current_year':
        return "de l'année en cours";
      case 'last_month':
        return 'du mois dernier';
      default:
        return '';
    }
  }
}
