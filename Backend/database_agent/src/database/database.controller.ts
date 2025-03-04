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
// Importer les variables de prompt et les requêtes SQL
import * as PROMPTS from '../var/prompt';
import * as QUERIES from '../var/query';

@Controller('database')
export class DatabaseController {
  private readonly logger = new Logger(DatabaseController.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly dbMetadataService: DatabaseMetadataService,
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
      // Récupérer les métadonnées de la base de données
      const dbMetadata = {
        tables: this.dbMetadataService.getAllTables(),
        enums: this.dbMetadataService.getAllEnums(),
      };

      // Analyser la question pour déterminer quelle table ou données sont nécessaires
      const { question, analysedData } = body;

      // Exemple simple: si la question contient le nom d'une table, récupérer ses données
      let response = `J'ai analysé votre question concernant la base de données: "${question}"\n\n`;

      // Chercher si la question mentionne une table spécifique
      const mentionedTables = dbMetadata.tables.filter((table) =>
        question.toLowerCase().includes(table.name.toLowerCase()),
      );

      if (mentionedTables.length > 0) {
        response += `J'ai identifié que vous vous intéressez à la/aux table(s): ${mentionedTables.map((t) => t.name).join(', ')}.\n\n`;

        // Pour chaque table mentionnée, récupérer quelques données
        for (const table of mentionedTables) {
          try {
            const data = await this.databaseService.getTableData(table.name, 5);
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

  @Post('natural-query')
  async processNaturalLanguageQuery(@Body() body: { query: string }) {
    try {
      if (!body.query) {
        return { error: 'Requête en langage naturel manquante' };
      }

      const userQuery = body.query;
      this.logger.log(
        `Traitement de la requête en langage naturel: ${userQuery}`,
      );

      // Analyse de la requête pour déterminer l'intention
      const intent = this.analyzeQueryIntent(userQuery);

      // Exécution de la requête SQL appropriée en fonction de l'intention
      const result = await this.executeQueryByIntent(intent, userQuery);

      return {
        success: true,
        data: result,
        metadata: {
          intent,
          query: userQuery,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors du traitement de la requête: ${error.message}`,
      );
      return {
        success: false,
        error: error.message,
        metadata: {
          query: body.query,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  @Get('help')
  getHelpMessage() {
    return {
      help: PROMPTS.HELP_MESSAGES.GENERAL,
      syntax: PROMPTS.HELP_MESSAGES.SEARCH_SYNTAX,
      examples: [
        PROMPTS.PROMPT_EXAMPLES.FIND_PROJECT,
        PROMPTS.PROMPT_EXAMPLES.TASKS_THIS_MONTH,
        PROMPTS.PROMPT_EXAMPLES.OVERDUE_TASKS,
        PROMPTS.PROMPT_EXAMPLES.USER_ASSIGNMENTS,
        PROMPTS.PROMPT_EXAMPLES.PROJECT_PROGRESS,
      ],
    };
  }

  /**
   * Analyse l'intention de la requête utilisateur
   * @param query Requête utilisateur
   * @returns Intention identifiée
   */
  private analyzeQueryIntent(query: string): string {
    const lowerQuery = query.toLowerCase();

    // Recherche de projets/chantiers
    if (
      lowerQuery.includes('chantier') ||
      lowerQuery.includes('projet') ||
      lowerQuery.includes('projects')
    ) {
      if (lowerQuery.includes('client')) {
        return 'PROJECTS_BY_CLIENT';
      } else if (
        lowerQuery.includes('en cours') ||
        lowerQuery.includes('actif')
      ) {
        return 'ACTIVE_PROJECTS';
      } else if (
        lowerQuery.includes('terminé') ||
        lowerQuery.includes('complété')
      ) {
        return 'COMPLETED_PROJECTS';
      } else if (
        lowerQuery.includes('avancement') ||
        lowerQuery.includes('progression')
      ) {
        return 'PROJECT_PROGRESS';
      } else {
        return 'LIST_PROJECTS';
      }
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
   * Exécute une requête SQL en fonction de l'intention identifiée
   * @param intent Intention identifiée
   * @param userQuery Requête utilisateur originale
   * @returns Résultat de la requête SQL
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
      case 'LIST_PROJECTS':
        sqlQuery = QUERIES.PROJECT_QUERIES.GET_ALL;
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
