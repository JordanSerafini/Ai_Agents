import { Injectable, Logger } from '@nestjs/common';
import { DatabaseMetadataService } from './database-metadata.service';
import { DatabaseService } from './database.service';
import {
  QueryBuilderResult,
  QueryBuilderOptions,
  QueryMetadata,
  AnalyseQuestion,
  AnalyseMetadata,
} from '../interfaces/query-builder.interface';

@Injectable()
export class QueryBuilderService {
  private readonly logger = new Logger(QueryBuilderService.name);
  private readonly DEFAULT_LIMIT = 100;
  private readonly COMMON_TABLES_RELATIONS: Record<string, string[]> = {
    clients: ['projects', 'invoices', 'quotations', 'appointments'],
    projects: ['clients', 'tasks', 'documents', 'staff'],
    invoices: ['clients', 'payments'],
    quotations: ['clients', 'projects'],
    appointments: ['clients', 'staff'],
    staff: ['appointments', 'tasks', 'projects'],
  };

  constructor(
    private readonly dbMetadataService: DatabaseMetadataService,
    private readonly databaseService: DatabaseService,
  ) {}

  async buildQuery(
    question: string,
    options?: QueryBuilderOptions,
  ): Promise<QueryBuilderResult> {
    this.logger.log(
      `Construction d'une requête SQL pour la question: ${question}`,
    );

    try {
      // Vérifier si la question contient des métadonnées structurées
      let metadata: AnalyseMetadata | undefined;
      try {
        const parsedQuestion = JSON.parse(question) as AnalyseQuestion;
        metadata = parsedQuestion.metadonnees;
        question = parsedQuestion.questionCorrigee;
      } catch (error) {
        this.logger.warn('Question reçue sans métadonnées structurées', error);
      }

      // Résultat par défaut en cas d'échec
      const defaultResult: QueryBuilderResult = {
        sql: '',
        params: [],
        explanation: '',
        tables: [],
        columns: [],
        conditions: [],
        success: false,
        error: 'Impossible de générer une requête SQL pour cette question.',
      };

      // Utiliser les métadonnées si disponibles, sinon analyser la question
      const { tables, columns, conditions } = metadata
        ? {
            tables: [
              ...metadata.tablesIdentifiees.principales,
              ...metadata.tablesIdentifiees.jointures,
            ],
            columns: metadata.champsRequis.selection,
            conditions: [
              ...metadata.tablesIdentifiees.conditions,
              ...metadata.filtres.temporels,
              ...metadata.filtres.logiques,
            ],
          }
        : this.analyzeQuestion(question);

      if (tables.length === 0) {
        return {
          ...defaultResult,
          error: 'Aucune table identifiée dans la question.',
        };
      }

      // Construction de la requête SQL
      const { sql, params, explanation } = this.constructSqlQuery(
        tables,
        columns,
        conditions,
        {
          ...options,
          ...(metadata?.parametresRequete || {}),
        },
      );

      // Exécution de la requête SQL
      const startTime = Date.now();
      const data = await this.databaseService.executeQuery(sql, params);
      const executionTime = Date.now() - startTime;

      // Métadonnées de la requête
      const queryMetadata: QueryMetadata = {
        executionTime,
        estimatedRows: data.length,
        cacheUsed: false,
        indexesUsed: [],
        optimizationHints: [],
        baseQueryQuestion: question,
        suggestedTables: this.suggestRelatedTables(tables),
      };

      return {
        sql,
        params,
        explanation,
        tables,
        columns,
        conditions,
        success: true,
        metadata: queryMetadata,
        data,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Erreur lors de la construction de la requête: ${errorMessage}`,
      );
      return {
        sql: '',
        params: [],
        explanation: `Erreur: ${errorMessage}`,
        tables: [],
        columns: [],
        conditions: [],
        success: false,
        error: errorMessage,
      };
    }
  }

  private analyzeQuestion(question: string): {
    tables: string[];
    columns: string[];
    conditions: string[];
  } {
    const tables: string[] = [];
    const columns: string[] = [];
    const conditions: string[] = [];

    // Récupération de toutes les tables disponibles
    const allTables = this.dbMetadataService.getAllTables();

    // Recherche des tables mentionnées dans la question
    allTables.forEach((table) => {
      if (question.toLowerCase().includes(table.name.toLowerCase())) {
        tables.push(table.name);

        // Ajout des colonnes principales de la table
        table.columns.forEach((column) => {
          if (
            question.toLowerCase().includes(column.name.toLowerCase()) ||
            column.isPrimary ||
            column.name === 'name' ||
            column.name === 'id'
          ) {
            columns.push(`${table.name}.${column.name}`);
          }
        });
      }
    });

    // Si aucune table n'est trouvée, essayer de déduire à partir du contexte
    if (tables.length === 0) {
      if (
        question.toLowerCase().includes('client') ||
        question.toLowerCase().includes('customer')
      ) {
        tables.push('clients');
        columns.push('clients.id', 'clients.name', 'clients.email');
      } else if (
        question.toLowerCase().includes('projet') ||
        question.toLowerCase().includes('project')
      ) {
        tables.push('projects');
        columns.push('projects.id', 'projects.name', 'projects.client_id');
      } else if (
        question.toLowerCase().includes('personnel') ||
        question.toLowerCase().includes('staff') ||
        question.toLowerCase().includes('dispo') ||
        question.toLowerCase().includes('travail')
      ) {
        tables.push('staff');
        tables.push('timesheet_entries');
        tables.push('calendar_events');
        columns.push(
          'staff.id',
          'staff.name',
          'timesheet_entries.date',
          'timesheet_entries.hours',
          'calendar_events.start_date',
          'calendar_events.end_date',
          'calendar_events.type',
        );
      }
    }

    // Extraction de conditions simples
    if (
      question.includes('où') ||
      question.includes('where') ||
      question.includes('dont')
    ) {
      const conditionParts = question.split(/où|where|dont/i);
      if (conditionParts.length > 1) {
        conditions.push(conditionParts[1].trim());
      }
    }

    return { tables, columns, conditions };
  }

  private constructSqlQuery(
    tables: string[],
    columns: string[],
    conditions: string[],
    options?: QueryBuilderOptions,
  ): { sql: string; params: any[]; explanation: string } {
    // Si aucune colonne n'est spécifiée, sélectionner toutes les colonnes
    const selectColumns = columns.length > 0 ? columns.join(', ') : '*';

    // Construction de la clause FROM avec les tables
    const fromClause =
      tables.length === 1 ? tables[0] : this.constructJoinClause(tables);

    // Construction de la clause WHERE avec les conditions
    const whereClause =
      conditions.length > 0 ? `WHERE ${this.parseConditions(conditions)}` : '';

    // Tri et limite
    const orderByClause = options?.tri?.length
      ? `ORDER BY ${options.tri.join(', ')}`
      : '';
    const limit = options?.limite || options?.maxResults || this.DEFAULT_LIMIT;
    const offset = options?.offset ? `OFFSET ${options.offset}` : '';

    // Construction de la requête SQL complète
    const sql = `
      SELECT ${selectColumns}
      FROM ${fromClause}
      ${whereClause}
      ${orderByClause}
      LIMIT ${limit}
      ${offset}
    `.trim().replace(/\s+/g, ' ');

    // Paramètres (vide pour cet exemple simplifié)
    const params: any[] = [];

    // Explication de la requête
    const explanation = this.generateQueryExplanation(
      tables,
      columns,
      conditions,
      options,
    );

    return { sql, params, explanation };
  }

  private constructJoinClause(tables: string[]): string {
    if (tables.length === 0) return '';
    if (tables.length === 1) return tables[0];

    // Table principale (première table)
    const mainTable = tables[0];
    let joinClause = mainTable;

    // Ajout des jointures pour les autres tables
    for (let i = 1; i < tables.length; i++) {
      const secondaryTable = tables[i];

      // Recherche d'une relation entre les tables
      const mainTableMetadata = this.dbMetadataService.getTable(mainTable);
      const secondaryTableMetadata =
        this.dbMetadataService.getTable(secondaryTable);

      if (mainTableMetadata && secondaryTableMetadata) {
        // Vérification des relations directes
        const relation = mainTableMetadata.relationships.find(
          (r) => r.targetTable === secondaryTable,
        );

        if (relation) {
          // Jointure basée sur la relation trouvée
          joinClause += ` LEFT JOIN ${secondaryTable} ON ${mainTable}.${relation.sourceColumn} = ${secondaryTable}.${relation.targetColumn}`;
        } else {
          // Relation inverse
          const inverseRelation = secondaryTableMetadata.relationships.find(
            (r) => r.targetTable === mainTable,
          );

          if (inverseRelation) {
            joinClause += ` LEFT JOIN ${secondaryTable} ON ${mainTable}.${inverseRelation.targetColumn} = ${secondaryTable}.${inverseRelation.sourceColumn}`;
          } else {
            // Pas de relation directe, vérification des relations communes
            const commonRelations = this.COMMON_TABLES_RELATIONS[mainTable] || [];
            if (commonRelations.includes(secondaryTable)) {
              // Jointure basée sur les conventions de nommage
              joinClause += ` LEFT JOIN ${secondaryTable} ON ${mainTable}.id = ${secondaryTable}.${mainTable.slice(0, -1)}_id`;
            } else {
              // Jointure par défaut sur les ID
              joinClause += ` LEFT JOIN ${secondaryTable} ON ${mainTable}.id = ${secondaryTable}.${mainTable}_id`;
            }
          }
        }
      } else {
        // Si les métadonnées ne sont pas disponibles, jointure par défaut
        joinClause += ` LEFT JOIN ${secondaryTable} ON ${mainTable}.id = ${secondaryTable}.${mainTable.slice(0, -1)}_id`;
      }
    }

    return joinClause;
  }

  private parseConditions(conditions: string[]): string {
    return conditions.join(' AND ');
  }

  private generateQueryExplanation(
    tables: string[],
    columns: string[],
    conditions: string[],
    options?: QueryBuilderOptions,
  ): string {
    let explanation = `Cette requête SQL recherche `;

    // Description des colonnes
    if (columns.length === 0 || columns.includes('*')) {
      explanation += `toutes les informations `;
    } else {
      explanation += `les informations suivantes: ${columns.join(', ')} `;
    }

    // Description des tables
    if (tables.length === 1) {
      explanation += `dans la table ${tables[0]} `;
    } else {
      explanation += `dans les tables ${tables.join(', ')} avec des jointures appropriées `;
    }

    // Description des conditions
    if (conditions.length > 0) {
      explanation += `où ${conditions.join(' et ')} `;
    }

    // Description du tri
    if (options?.tri?.length) {
      explanation += `triés par ${options.tri.join(', ')} `;
    }

    // Description de la limite
    explanation += `avec une limite de ${options?.limite || options?.maxResults || this.DEFAULT_LIMIT} résultats`;

    // Description de l'offset
    if (options?.offset) {
      explanation += ` en commençant à partir du ${options.offset + 1}ème résultat`;
    }

    return explanation + '.';
  }

  private suggestRelatedTables(tables: string[]): string[] {
    const suggestions: string[] = [];

    tables.forEach((table) => {
      const relatedTables = this.COMMON_TABLES_RELATIONS[table] || [];
      relatedTables.forEach((related) => {
        if (!tables.includes(related) && !suggestions.includes(related)) {
          suggestions.push(related);
        }
      });
    });

    return suggestions;
  }
}
