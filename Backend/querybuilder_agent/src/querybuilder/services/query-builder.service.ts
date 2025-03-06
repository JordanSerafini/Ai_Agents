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
      let questionText = question;

      try {
        const parsedQuestion = JSON.parse(question) as AnalyseQuestion;
        metadata = parsedQuestion.metadonnees;
        questionText = parsedQuestion.questionCorrigee;
        this.logger.log('Métadonnées structurées détectées dans la question');
      } catch (error) {
        this.logger.warn(
          `Question reçue sans métadonnées structurées: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
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
      let tables: string[] = [];
      let columns: string[] = [];
      let conditions: string[] = [];
      let temporalConditions: string[] = [];

      if (metadata) {
        // Extraire les noms des tables
        tables = [
          ...metadata.tablesIdentifiees.principales.map((t) => t.nom),
          ...metadata.tablesIdentifiees.jointures.map((t) => t.nom),
        ];

        // Ajouter automatiquement project_staff si on parle de staff et qu'elle n'est pas déjà incluse
        if (
          tables.includes('staff') &&
          !tables.includes('project_staff') &&
          (questionText.toLowerCase().includes('dispo') ||
            questionText.toLowerCase().includes('travail'))
        ) {
          tables.push('project_staff');
          this.logger.log(
            'Ajout automatique de la table project_staff pour les questions de disponibilité',
          );
        }

        // Extraire les colonnes
        columns = metadata.champsRequis.selection;

        // Extraire les conditions
        conditions = [
          ...metadata.tablesIdentifiees.conditions,
          ...metadata.filtres.logiques,
        ];

        // Ajouter une condition sur is_available si on parle de disponibilité
        if (
          tables.includes('staff') &&
          questionText.toLowerCase().includes('dispo') &&
          !conditions.some((c) => c.includes('is_available'))
        ) {
          conditions.push('staff.is_available = true');
          this.logger.log('Ajout automatique de la condition sur is_available');
        }

        // Ignorer complètement les périodes temporelles avec des valeurs par défaut
        if (
          metadata.periodeTemporelle &&
          metadata.periodeTemporelle.debut === 'YYYY-MM-DD' &&
          metadata.periodeTemporelle.fin === 'YYYY-MM-DD'
        ) {
          this.logger.log('Période temporelle ignorée car valeurs par défaut');
          // Ne pas utiliser metadata.periodeTemporelle
        } else {
          // Traiter les filtres temporels
          temporalConditions = this.processTemporalFilters(
            metadata.filtres.temporels,
            metadata.periodeTemporelle,
          );
        }

        // Suppression de la duplication des conditions temporelles ici
        conditions = [...conditions, ...temporalConditions];

        this.logger.log(`Tables identifiées: ${tables.join(', ')}`);
        this.logger.log(`Colonnes identifiées: ${columns.join(', ')}`);
        this.logger.log(`Conditions identifiées: ${conditions.join(', ')}`);
      } else {
        const analysisResult = this.analyzeQuestion(questionText);
        tables = analysisResult.tables;
        columns = analysisResult.columns;
        conditions = analysisResult.conditions;
      }

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
        baseQueryQuestion: questionText,
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
        columns.push('staff.id', 'staff.name', 'staff.is_available');

        // Ajouter les tables liées au personnel et à la disponibilité
        tables.push('project_staff');
        columns.push(
          'project_staff.staff_id',
          'project_staff.project_id',
          'project_staff.start_date',
          'project_staff.end_date',
        );

        tables.push('calendar_events');
        columns.push(
          'calendar_events.staff_id',
          'calendar_events.start_date',
          'calendar_events.end_date',
          'calendar_events.type',
        );

        // Ajouter une condition pour la disponibilité si mentionnée
        if (question.toLowerCase().includes('dispo')) {
          conditions.push('staff.is_available = true');
        }
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
    let whereClause = '';
    if (conditions.length > 0) {
      this.logger.log(
        `Conditions avant filtrage: ${JSON.stringify(conditions)}`,
      );

      // Filtrer les conditions qui contiennent des références à des tables non incluses
      const validConditions = conditions.filter((condition) => {
        // Exclure explicitement les conditions problématiques
        if (
          condition.includes('date BETWEEN') &&
          condition.startsWith('date ')
        ) {
          this.logger.log(
            `Condition exclue (date BETWEEN générique): ${condition}`,
          );
          return false;
        }

        if (condition.includes('timesheet_entries.date')) {
          this.logger.log(
            `Condition exclue (timesheet_entries.date): ${condition}`,
          );
          return false;
        }

        // Vérifier que toutes les tables référencées dans la condition sont incluses
        const hasValidTableReference = tables.some((table) =>
          condition.includes(`${table}.`),
        );

        // Si la condition contient un point (référence à une table.colonne)
        // mais qu'aucune des tables n'est trouvée, l'exclure
        if (condition.includes('.') && !hasValidTableReference) {
          this.logger.log(`Condition exclue (table non incluse): ${condition}`);
          return false;
        }

        return true;
      });

      this.logger.log(
        `Conditions après filtrage: ${JSON.stringify(validConditions)}`,
      );

      if (validConditions.length > 0) {
        whereClause = `WHERE ${this.parseConditions(validConditions)}`;
      }
    }

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
    `
      .trim()
      .replace(/\s+/g, ' ');

    this.logger.log(`Requête SQL générée: ${sql}`);

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
            const commonRelations =
              this.COMMON_TABLES_RELATIONS[mainTable] || [];
            if (commonRelations.includes(secondaryTable)) {
              // Jointure basée sur les conventions de nommage
              const singularMainTable = mainTable.endsWith('s')
                ? mainTable.slice(0, -1)
                : mainTable;
              joinClause += ` LEFT JOIN ${secondaryTable} ON ${mainTable}.id = ${secondaryTable}.${singularMainTable}_id`;
            } else {
              // Jointure par défaut sur les ID
              joinClause += ` LEFT JOIN ${secondaryTable} ON ${mainTable}.id = ${secondaryTable}.${mainTable}_id`;
            }
          }
        }
      } else {
        // Si les métadonnées ne sont pas disponibles, jointure par défaut
        const singularMainTable = mainTable.endsWith('s')
          ? mainTable.slice(0, -1)
          : mainTable;
        joinClause += ` LEFT JOIN ${secondaryTable} ON ${mainTable}.id = ${secondaryTable}.${singularMainTable}_id`;
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

  /**
   * Traite les filtres temporels et la période temporelle pour générer des conditions SQL
   */
  private processTemporalFilters(
    temporalFilters: string[],
    periodInfo?: {
      debut?: string;
      fin?: string;
      precision?: string;
    },
  ): string[] {
    const conditions: string[] = [];

    // Ajouter les filtres temporels explicites fournis par l'agent d'analyse
    if (temporalFilters && temporalFilters.length > 0) {
      const validFilters = temporalFilters.filter(
        (filter) =>
          !(filter.includes('date BETWEEN') && filter.startsWith('date ')),
      );
      conditions.push(...validFilters);
    }

    // Utiliser la période temporelle fournie par l'agent d'analyse
    if (periodInfo && periodInfo.debut && periodInfo.fin) {
      // Ne pas ajouter de condition si les dates sont au format YYYY-MM-DD (valeurs par défaut)
      if (
        periodInfo.debut !== 'YYYY-MM-DD' &&
        periodInfo.fin !== 'YYYY-MM-DD'
      ) {
        conditions.push(`(
          calendar_events.start_date BETWEEN '${periodInfo.debut}' AND '${periodInfo.fin}' OR 
          calendar_events.end_date BETWEEN '${periodInfo.debut}' AND '${periodInfo.fin}' OR
          project_staff.start_date BETWEEN '${periodInfo.debut}' AND '${periodInfo.fin}' OR
          project_staff.end_date BETWEEN '${periodInfo.debut}' AND '${periodInfo.fin}'
        )`);
      }
    }

    return conditions;
  }
}
