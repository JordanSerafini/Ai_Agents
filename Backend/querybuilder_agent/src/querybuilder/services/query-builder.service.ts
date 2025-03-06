import { Injectable, Logger } from '@nestjs/common';
import { DatabaseMetadataService } from './database-metadata.service';
import {
  QueryBuilderResult,
  QueryBuilderOptions,
  JoinInfo,
  OrderByInfo,
  GroupByInfo,
  JoinConfig,
  SearchConfig,
  ElasticsearchQuery,
  ElasticsearchQueryBody,
  AggregationConfig,
  QueryMetadata,
  HighlightConfig,
  FacetConfig,
} from '../interfaces/query-builder.interface';

interface SearchResult {
  document: {
    id: string;
    question: string;
    answer: string;
    agentType: string;
    embedding: number[];
    metadata: {
      timestamp: number;
      category: string;
      tags: string[];
    };
  };
  score: number;
}

@Injectable()
export class QueryBuilderService {
  private readonly logger = new Logger(QueryBuilderService.name);
  private readonly DEFAULT_LIMIT = 100;
  private readonly COMMON_TABLES_RELATIONS = {
    clients: ['projects', 'invoices', 'quotations', 'appointments'],
    projects: ['clients', 'tasks', 'documents', 'staff'],
    invoices: ['clients', 'payments'],
    quotations: ['clients', 'projects'],
    appointments: ['clients', 'staff'],
    staff: ['appointments', 'tasks', 'projects'],
  };

  constructor(private readonly dbMetadataService: DatabaseMetadataService) {}

  async buildQuery(
    question: string,
    options?: QueryBuilderOptions,
  ): Promise<QueryBuilderResult> {
    this.logger.log(
      `Construction d'une requête SQL pour la question: ${question}`,
    );

    try {
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

      // Analyse de la question pour déterminer les tables et colonnes concernées
      const { tables, columns, conditions } = this.analyzeQuestion(question);

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
        options,
      );

      // Métadonnées de la requête
      const metadata: QueryMetadata = {
        executionTime: 0,
        estimatedRows: 0,
        cacheUsed: false,
        indexesUsed: [],
        optimizationHints: [],
        ragEnhanced: false,
        similarityScore: 0,
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
        metadata,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la construction de la requête: ${error.message}`,
      );
      return {
        sql: '',
        params: [],
        explanation: `Erreur: ${error.message}`,
        tables: [],
        columns: [],
        conditions: [],
        success: false,
        error: error.message,
      };
    }
  }

  private analyzeQuestion(question: string): {
    tables: string[];
    columns: string[];
    conditions: string[];
  } {
    // Analyse simplifiée pour l'exemple
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

    // Limite de résultats
    const limit = options?.maxResults || this.DEFAULT_LIMIT;

    // Construction de la requête SQL complète
    const sql = `SELECT ${selectColumns} FROM ${fromClause} ${whereClause} LIMIT ${limit}`;

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
            const commonRelations = this.COMMON_TABLES_RELATIONS[mainTable];
            if (commonRelations && commonRelations.includes(secondaryTable)) {
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
    // Implémentation simplifiée pour l'exemple
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

    // Description de la limite
    explanation += `avec une limite de ${options?.maxResults || this.DEFAULT_LIMIT} résultats.`;

    return explanation;
  }

  private suggestRelatedTables(tables: string[]): string[] {
    const suggestions: string[] = [];

    tables.forEach((table) => {
      const relatedTables = this.COMMON_TABLES_RELATIONS[table];
      if (relatedTables) {
        relatedTables.forEach((related) => {
          if (!tables.includes(related) && !suggestions.includes(related)) {
            suggestions.push(related);
          }
        });
      }
    });

    return suggestions;
  }

  // Méthodes pour la construction de requêtes Elasticsearch
  buildElasticsearchQuery(searchConfig: SearchConfig): ElasticsearchQuery {
    const {
      query,
      filters,
      sort,
      aggregations,
      highlight,
      page = 1,
      pageSize = 10,
    } = searchConfig;

    const esQuery: ElasticsearchQuery = {
      query: this.buildElasticsearchQueryBody(query, filters, searchConfig),
      from: (page - 1) * pageSize,
      size: pageSize,
    };

    // Ajout du tri
    if (sort && Object.keys(sort).length > 0) {
      esQuery.sort = Object.entries(sort).map(([field, direction]) => ({
        [field]: direction,
      }));
    }

    // Ajout des agrégations
    if (aggregations && aggregations.length > 0) {
      esQuery.aggs = {};
      aggregations.forEach((agg) => {
        esQuery.aggs![agg.name] = this.buildAggregation(agg);
      });
    }

    // Ajout du highlighting
    if (highlight && highlight.fields.length > 0) {
      esQuery.highlight = {
        fields: {},
        pre_tags: highlight.preTag ? [highlight.preTag] : ['<em>'],
        post_tags: highlight.postTag ? [highlight.postTag] : ['</em>'],
      };

      highlight.fields.forEach((field) => {
        esQuery.highlight!.fields[field] = {
          number_of_fragments: highlight.numberOfFragments || 3,
        };
      });
    }

    return esQuery;
  }

  private buildElasticsearchQueryBody(
    query: string,
    filters?: Record<string, any>,
    config?: SearchConfig,
  ): ElasticsearchQueryBody {
    const searchType = config?.searchType || 'exact';
    const fuzzyDistance = config?.fuzzyDistance || 2;

    const queryBody: ElasticsearchQueryBody = {
      bool: {
        must: [],
        filter: [],
      },
    };

    // Construction de la clause de recherche principale
    if (query) {
      switch (searchType) {
        case 'fuzzy':
          queryBody.bool!.must!.push({
            multi_match: {
              query,
              fields: ['*'],
              fuzziness: fuzzyDistance,
            },
          });
          break;
        case 'semantic':
          queryBody.bool!.must!.push({
            multi_match: {
              query,
              fields: ['*'],
              type: 'phrase',
            },
          });
          break;
        case 'exact':
        default:
          queryBody.bool!.must!.push({
            multi_match: {
              query,
              fields: ['*'],
              operator: 'and',
            },
          });
          break;
      }
    }

    // Ajout des filtres
    if (filters && Object.keys(filters).length > 0) {
      Object.entries(filters).forEach(([field, value]) => {
        if (Array.isArray(value)) {
          // Filtre sur plusieurs valeurs (OR)
          queryBody.bool!.filter!.push({
            terms: { [field]: value },
          });
        } else if (typeof value === 'object') {
          // Filtre de plage (range)
          queryBody.bool!.filter!.push({
            range: { [field]: value },
          });
        } else {
          // Filtre exact
          queryBody.bool!.filter!.push({
            term: { [field]: value },
          });
        }
      });
    }

    return queryBody;
  }

  private buildAggregation(
    config: AggregationConfig,
  ): ElasticsearchAggregation {
    const { type, field, options } = config;

    switch (type) {
      case 'terms':
        return {
          terms: {
            field,
            size: options?.size || 10,
            ...(options?.order && { order: options.order }),
          },
        };
      case 'range':
        return {
          range: {
            field,
            ranges: options?.ranges || [
              { to: 50 },
              { from: 50, to: 100 },
              { from: 100 },
            ],
          },
        };
      case 'date_histogram':
        return {
          date_histogram: {
            field,
            calendar_interval: options?.interval || 'month',
            format: options?.format || 'yyyy-MM-dd',
          },
        };
      case 'sum':
        return { sum: { field } };
      case 'avg':
        return { avg: { field } };
      case 'min':
        return { min: { field } };
      case 'max':
        return { max: { field } };
      case 'count':
      default:
        return { terms: { field, size: options?.size || 10 } };
    }
  }
}
