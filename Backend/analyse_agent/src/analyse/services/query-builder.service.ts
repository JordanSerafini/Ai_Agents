import { Injectable, Logger } from '@nestjs/common';
import { AnalyseResponseDto } from '../dto/analyse-response.dto';
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
  FacetConfig
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
    'clients': ['projects', 'invoices', 'quotations', 'appointments'],
    'projects': ['clients', 'tasks', 'documents', 'staff'],
    'invoices': ['clients', 'payments'],
    'quotations': ['clients', 'projects'],
    'appointments': ['clients', 'staff'],
    'staff': ['appointments', 'tasks', 'projects'],
  };

  constructor(private readonly dbMetadataService: DatabaseMetadataService) {}

  /**
   * Construit une requête SQL à partir de l'analyse d'une question
   * @param analyseResponse La réponse de l'agent d'analyse
   * @param options Options de construction de requête
   * @returns Un objet contenant la requête SQL, les paramètres et des explications
   */
  buildQuery(
    analyseResponse: AnalyseResponseDto, 
    options?: QueryBuilderOptions
  ): QueryBuilderResult {
    try {
      this.logger.log(`Construction d'une requête SQL à partir de l'analyse: ${analyseResponse.demandeId}`);
      
      // Valeurs par défaut
      const result: QueryBuilderResult = {
        sql: '',
        params: [],
        explanation: '',
        tables: [],
        columns: [],
        conditions: [],
        success: false
      };

      // Extraire l'intention principale
      const intention = analyseResponse.intentionPrincipale.nom;
      
      // Extraire les entités mentionnées (tables, colonnes, etc.)
      const entites = analyseResponse.entites || [];
      
      // Identifier les tables concernées
      const tables = this.identifierTables(entites);
      result.tables = tables;
      
      // Identifier les colonnes concernées
      const columns = this.identifierColonnes(entites, tables);
      result.columns = columns;
      
      // Identifier les conditions
      const conditions = this.identifierConditions(analyseResponse.contraintes, entites);
      result.conditions = conditions;

      // Construire la requête SQL en fonction de l'intention
      switch (intention.toLowerCase()) {
        case 'recherche':
        case 'consultation':
        case 'afficher':
        case 'lister':
          result.sql = this.construireRequeteSelect(tables, columns, conditions);
          result.explanation = `Requête de consultation des données dans ${tables.join(', ')}`;
          break;
          
        case 'compter':
        case 'calculer':
        case 'statistiques':
          result.sql = this.construireRequeteAgregation(tables, columns, conditions, intention);
          result.explanation = `Requête d'agrégation sur ${tables.join(', ')}`;
          break;
          
        default:
          result.sql = this.construireRequeteSelect(tables, columns, conditions);
          result.explanation = `Requête générique sur ${tables.join(', ')}`;
      }
      
      // Paramètres pour la requête préparée
      result.params = this.extraireParametres(conditions);
      
      // Appliquer les options
      if (options) {
        if (options.maxResults) {
          result.sql += ` LIMIT ${options.maxResults}`;
        }
      }
      
      result.success = true;
      return result;
    } catch (error) {
      this.logger.error(`Erreur lors de la construction de la requête SQL: ${error.message}`);
      return {
        sql: '',
        params: [],
        explanation: `Erreur: ${error.message}`,
        tables: [],
        columns: [],
        conditions: [],
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Identifie les tables mentionnées dans les entités
   */
  private identifierTables(entites: string[]): string[] {
    const tables: string[] = [];
    const allTables = this.dbMetadataService.getAllTables().map(t => t.name.toLowerCase());
    
    // Première passe : identifier les tables explicitement mentionnées
    for (const entite of entites) {
      // Vérifier si l'entité contient un point (format table.colonne)
      if (entite.includes('.')) {
        const tableName = entite.split('.')[0].toLowerCase();
        if (allTables.includes(tableName) && !tables.includes(tableName)) {
          tables.push(tableName);
        }
      } 
      // Vérifier si l'entité correspond directement à une table
      else if (allTables.includes(entite.toLowerCase())) {
        tables.push(entite.toLowerCase());
      }
    }
    
    // Si aucune table n'est identifiée, utiliser une approche par correspondance partielle
    if (tables.length === 0) {
      for (const table of allTables) {
        for (const entite of entites) {
          const entiteLower = entite.toLowerCase();
          // Éviter de considérer les tables pour les entités qui sont clairement des attributs
          if (!this.isColumnNameOnly(entiteLower) && 
              (entiteLower.includes(table) || table.includes(entiteLower))) {
            tables.push(table);
            break;
          }
        }
      }
    }
    
    return [...new Set(tables)]; // Éliminer les doublons
  }

  /**
   * Identifie les colonnes mentionnées dans les entités
   */
  private identifierColonnes(entites: string[], tables: string[]): string[] {
    const columns: string[] = [];
    
    // Si aucune table n'est spécifiée, on ne peut pas identifier les colonnes
    if (tables.length === 0) {
      return ['*']; // Sélectionner toutes les colonnes par défaut
    }
    
    // Récupérer toutes les colonnes des tables identifiées
    const allColumns: Record<string, string[]> = {};
    for (const table of tables) {
      const tableMetadata = this.dbMetadataService.getTable(table);
      if (tableMetadata) {
        allColumns[table] = tableMetadata.columns.map(c => c.name.toLowerCase());
      }
    }
    
    // Traiter les entités qui spécifient explicitement des colonnes (table.colonne)
    for (const entite of entites) {
      if (entite.includes('.')) {
        const [tableName, columnName] = entite.toLowerCase().split('.');
        
        // Vérifier si la table existe dans nos tables sélectionnées
        if (tables.includes(tableName)) {
          // Vérifier si la colonne existe dans cette table
          if (allColumns[tableName] && allColumns[tableName].includes(columnName)) {
            columns.push(`${tableName}.${columnName}`);
          }
        }
      } else {
        // Pour les entités sans préfixe de table, chercher dans toutes les tables
        const entiteLower = entite.toLowerCase();
        
        // Vérifier si c'est une colonne courante (comme id, name, etc.)
        for (const table of tables) {
          if (allColumns[table] && allColumns[table].includes(entiteLower)) {
            columns.push(`${table}.${entiteLower}`);
          }
        }
      }
    }
    
    // Si la demande concerne un total ou une somme, ajouter une agrégation
    const entitesText = entites.join(' ').toLowerCase();
    if (entitesText.includes('total') || entitesText.includes('sum') || entitesText.includes('somme')) {
      // Chercher une colonne numérique appropriée pour l'agrégation
      for (const table of tables) {
        if (table === 'orders' && allColumns[table] && allColumns[table].includes('total')) {
          columns.push('SUM(orders.total) as total_amount');
          break;
        }
      }
    }
    
    // Si aucune colonne n'est identifiée, sélectionner les colonnes principales de chaque table
    if (columns.length === 0) {
      for (const table of tables) {
        if (allColumns[table]) {
          // Prendre id, name, et quelques colonnes courantes
          const commonColumns = ['id', 'name', 'firstname', 'lastname', 'email', 'created_at'];
          for (const col of commonColumns) {
            if (allColumns[table].includes(col)) {
              columns.push(`${table}.${col}`);
            }
          }
        }
      }
      
      // Si toujours rien, prendre toutes les colonnes
      if (columns.length === 0) {
        return tables.map(t => `${t}.*`);
      }
    }
    
    return [...new Set(columns)]; // Éliminer les doublons
  }

  /**
   * Identifie les conditions à partir des contraintes et entités
   */
  private identifierConditions(contraintes: string[], entites: string[]): string[] {
    const conditions: string[] = [];
    
    // Analyser les contraintes pour extraire des conditions
    for (const contrainte of contraintes) {
      // Exemple simple: rechercher des patterns comme "colonne = valeur"
      const matchEquals = contrainte.match(/(\w+)\s*=\s*(\w+)/);
      if (matchEquals) {
        conditions.push(`${matchEquals[1]} = $${conditions.length + 1}`);
        continue;
      }
      
      // Rechercher des patterns comme "colonne > valeur"
      const matchGreater = contrainte.match(/(\w+)\s*>\s*(\w+)/);
      if (matchGreater) {
        conditions.push(`${matchGreater[1]} > $${conditions.length + 1}`);
        continue;
      }
      
      // Rechercher des patterns comme "colonne < valeur"
      const matchLess = contrainte.match(/(\w+)\s*<\s*(\w+)/);
      if (matchLess) {
        conditions.push(`${matchLess[1]} < $${conditions.length + 1}`);
        continue;
      }
      
      // Rechercher des patterns comme "colonne LIKE valeur"
      const matchLike = contrainte.match(/(\w+)\s*like\s*(\w+)/i);
      if (matchLike) {
        conditions.push(`${matchLike[1]} LIKE $${conditions.length + 1}`);
        continue;
      }
    }
    
    return conditions;
  }

  /**
   * Construit une requête SELECT
   */
  private construireRequeteSelect(tables: string[], columns: string[], conditions: string[]): string {
    // Si aucune table n'est spécifiée, utiliser une table par défaut
    if (tables.length === 0) {
      return '';
    }
    
    // Construire la clause SELECT
    const selectClause = columns.length > 0 ? columns.join(', ') : '*';
    
    // Construire la clause FROM avec la première table
    let fromClause = tables[0];
    
    // Ajouter les jointures si plusieurs tables sont spécifiées
    if (tables.length > 1) {
      // Pour chaque table supplémentaire, ajouter une jointure
      for (let i = 1; i < tables.length; i++) {
        // Déterminer la relation entre les tables et ajouter la jointure
        const joinInfo = this.determineJoinRelation(tables[0], tables[i], 'INNER');
        if (joinInfo) {
          fromClause += ` INNER JOIN ${joinInfo.rightTable} ON ${joinInfo.leftTable}.${joinInfo.leftColumn} = ${joinInfo.rightTable}.${joinInfo.rightColumn}`;
        } else {
          // Si aucune relation n'est trouvée, utiliser une jointure par défaut sur id
          fromClause += ` INNER JOIN ${tables[i]} ON ${tables[0]}.id = ${tables[i]}.${tables[0].slice(0, -1)}_id`;
        }
      }
    }
    
    // Construire la clause WHERE si des conditions sont spécifiées
    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    
    // Vérifier si une agrégation est nécessaire
    const hasAggregation = columns.some(col => col.toLowerCase().includes('sum(') || col.toLowerCase().includes('count(') || col.toLowerCase().includes('avg('));
    
    // Ajouter GROUP BY si une agrégation est présente
    let groupByClause = '';
    if (hasAggregation) {
      // Identifier les colonnes non agrégées pour le GROUP BY
      const nonAggColumns = columns.filter(col => 
        !col.toLowerCase().includes('sum(') && 
        !col.toLowerCase().includes('count(') && 
        !col.toLowerCase().includes('avg(') &&
        !col.toLowerCase().includes('max(') &&
        !col.toLowerCase().includes('min(')
      );
      
      if (nonAggColumns.length > 0) {
        groupByClause = ` GROUP BY ${nonAggColumns.join(', ')}`;
      }
    }
    
    // Ajouter LIMIT par défaut
    const limitClause = ` LIMIT ${this.DEFAULT_LIMIT}`;
    
    // Construire la requête complète
    return `SELECT ${selectClause} FROM ${fromClause}${whereClause}${groupByClause}${limitClause}`;
  }

  /**
   * Construit une requête d'agrégation (COUNT, SUM, AVG, etc.)
   */
  private construireRequeteAgregation(
    tables: string[], 
    columns: string[], 
    conditions: string[],
    intention: string
  ): string {
    // Si aucune table n'est spécifiée, retourner une chaîne vide
    if (tables.length === 0) {
      return '';
    }
    
    // Déterminer le type d'agrégation en fonction de l'intention
    let aggregateFunction = 'SUM';
    if (intention.includes('moyenne') || intention.includes('avg')) {
      aggregateFunction = 'AVG';
    } else if (intention.includes('maximum') || intention.includes('max')) {
      aggregateFunction = 'MAX';
    } else if (intention.includes('minimum') || intention.includes('min')) {
      aggregateFunction = 'MIN';
    } else if (intention.includes('compter') || intention.includes('count')) {
      aggregateFunction = 'COUNT';
    }
    
    // Identifier la colonne à agréger
    let aggregateColumn = '';
    for (const column of columns) {
      if (column.includes('total') || column.includes('montant') || column.includes('prix')) {
        aggregateColumn = column;
        break;
      }
    }
    
    // Si aucune colonne spécifique n'est trouvée, utiliser la colonne la plus probable
    if (!aggregateColumn) {
      if (tables.includes('orders') && this.columnExistsInTable('orders', 'total')) {
        aggregateColumn = 'orders.total';
      } else if (tables.includes('commandes') && this.columnExistsInTable('commandes', 'montant')) {
        aggregateColumn = 'commandes.montant';
      } else {
        // Par défaut, utiliser id pour COUNT ou la première colonne pour d'autres agrégations
        aggregateColumn = aggregateFunction === 'COUNT' ? `${tables[0]}.id` : columns[0];
      }
    }
    
    // Construire la clause SELECT avec l'agrégation
    const selectClause = `${aggregateFunction}(${aggregateColumn}) as ${aggregateColumn.replace('.', '_')}_${aggregateFunction.toLowerCase()}`;
    
    // Ajouter les colonnes de regroupement (GROUP BY)
    const groupByColumns = columns.filter(col => 
      col !== aggregateColumn && !col.includes('(') && col.includes('.')
    );
    
    // Construire la clause SELECT complète
    const fullSelectClause = groupByColumns.length > 0 
      ? `${groupByColumns.join(', ')}, ${selectClause}`
      : selectClause;
    
    // Construire la clause FROM avec jointures si nécessaire
    let fromClause = tables[0];
    if (tables.length > 1) {
      // Pour chaque table supplémentaire, ajouter une jointure
      for (let i = 1; i < tables.length; i++) {
        // Déterminer la relation entre les tables et ajouter la jointure
        const joinInfo = this.determineJoinRelation(tables[0], tables[i], 'INNER');
        if (joinInfo) {
          fromClause += ` INNER JOIN ${joinInfo.rightTable} ON ${joinInfo.leftTable}.${joinInfo.leftColumn} = ${joinInfo.rightTable}.${joinInfo.rightColumn}`;
        } else {
          // Si aucune relation n'est trouvée, utiliser une jointure par défaut sur id
          fromClause += ` INNER JOIN ${tables[i]} ON ${tables[0]}.id = ${tables[i]}.${tables[0].slice(0, -1)}_id`;
        }
      }
    }
    
    // Construire la clause WHERE
    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    
    // Construire la clause GROUP BY
    const groupByClause = groupByColumns.length > 0 ? ` GROUP BY ${groupByColumns.join(', ')}` : '';
    
    // Ajouter LIMIT par défaut
    const limitClause = ` LIMIT ${this.DEFAULT_LIMIT}`;
    
    // Construire la requête complète
    return `SELECT ${fullSelectClause} FROM ${fromClause}${whereClause}${groupByClause}${limitClause}`;
  }
  
  // Méthode utilitaire pour vérifier l'existence d'une colonne dans une table
  private columnExistsInTable(tableName: string, columnName: string): boolean {
    const tableMetadata = this.dbMetadataService.getTable(tableName);
    if (!tableMetadata) return false;
    
    return tableMetadata.columns.some(col => col.name.toLowerCase() === columnName.toLowerCase());
  }

  /**
   * Extrait les paramètres des conditions pour une requête préparée
   */
  private extraireParametres(conditions: string[]): any[] {
    const params: any[] = [];
    
    // Pour l'instant, on utilise des valeurs fictives pour les paramètres
    // Dans une implémentation réelle, ces valeurs seraient extraites des contraintes
    for (let i = 0; i < conditions.length; i++) {
      params.push(`param${i + 1}`);
    }
    
    return params;
  }
  
  /**
   * Construit une requête avec des jointures
   */
  construireRequeteAvecJointures(
    tables: string[], 
    columns: string[], 
    conditions: string[],
    jointures: JoinInfo[]
  ): string {
    if (tables.length === 0 || jointures.length === 0) {
      return this.construireRequeteSelect(tables, columns, conditions);
    }
    
    const columnsStr = columns.length > 0 ? columns.join(', ') : '*';
    const mainTable = tables[0];
    let sql = `SELECT ${columnsStr} FROM ${mainTable}`;
    
    // Ajouter les jointures
    for (const jointure of jointures) {
      sql += ` ${jointure.type} JOIN ${jointure.rightTable} ON ${jointure.leftTable}.${jointure.leftColumn} = ${jointure.rightTable}.${jointure.rightColumn}`;
    }
    
    // Ajouter les conditions
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    return sql;
  }
  
  /**
   * Construit une requête avec tri
   */
  construireRequeteAvecTri(
    baseQuery: string,
    orderBy: OrderByInfo[]
  ): string {
    if (orderBy.length === 0) {
      return baseQuery;
    }
    
    const orderByStr = orderBy.map(o => `${o.column} ${o.direction}`).join(', ');
    return `${baseQuery} ORDER BY ${orderByStr}`;
  }
  
  /**
   * Construit une requête avec regroupement
   */
  construireRequeteAvecRegroupement(
    baseQuery: string,
    groupBy: GroupByInfo
  ): string {
    if (groupBy.columns.length === 0) {
      return baseQuery;
    }
    
    let sql = `${baseQuery} GROUP BY ${groupBy.columns.join(', ')}`;
    
    if (groupBy.having) {
      sql += ` HAVING ${groupBy.having}`;
    }
    
    return sql;
  }

  buildElasticsearchQuery(analyseResponse: AnalyseResponseDto): ElasticsearchQuery {
    const queryText = analyseResponse.questionCorrigee || analyseResponse.contexte;
    
    // Construction de la requête Elasticsearch plus élaborée
    const query: ElasticsearchQuery = {
      query: this.buildElasticsearchQueryBody(analyseResponse),
      sort: this.buildElasticsearchSort(analyseResponse),
      aggs: this.buildElasticsearchAggs(analyseResponse),
      highlight: this.buildElasticsearchHighlight(analyseResponse),
      size: this.DEFAULT_LIMIT
    };

    return query;
  }

  private buildElasticsearchQueryBody(analyseResponse: AnalyseResponseDto): ElasticsearchQueryBody {
    const queryBody: ElasticsearchQueryBody = {
      bool: {
        must: [
          {
            multi_match: {
              query: analyseResponse.questionCorrigee,
              fields: this.getRelevantFields(analyseResponse.entites),
              type: 'best_fields',
              operator: 'and',
              fuzziness: 'AUTO'
            }
          }
        ],
        filter: this.buildElasticsearchFilters(analyseResponse)
      }
    };
    
    return queryBody;
  }

  private getRelevantFields(entities: string[]): string[] {
    // Détermination intelligente des champs pertinents basée sur les entités
    const fieldMapping: Record<string, string[]> = {
      'clients': ['name', 'email', 'phone', 'address', 'contact_person'],
      'projects': ['name', 'description', 'status', 'client_name'],
      'invoices': ['reference', 'description', 'client_name', 'status'],
      'quotations': ['reference', 'description', 'client_name', 'status'],
      'documents': ['title', 'description', 'content', 'tags'],
      'staff': ['firstname', 'lastname', 'email', 'role', 'skills'],
      'appointments': ['title', 'description', 'location']
    };

    const fields: string[] = [];
    
    // Ajouter les champs pertinents pour chaque entité
    entities.forEach(entity => {
      if (fieldMapping[entity]) {
        fields.push(...fieldMapping[entity].map(field => `${entity}.${field}`));
      } else {
        // Champs génériques si l'entité n'est pas reconnue
        fields.push('*.name', '*.description', '*.reference');
      }
    });
    
    return fields.length ? fields : ['*'];
  }

  private buildElasticsearchSort(analyseResponse: AnalyseResponseDto): Array<Record<string, 'asc' | 'desc'>> {
    const sousIntentions = analyseResponse.sousIntentions || [];
    const triIntention = sousIntentions.find(intention => intention.nom === 'trier');
    
    if (triIntention) {
      // Logique pour extraire le champ de tri et la direction
      const matchDateRecent = analyseResponse.questionCorrigee.match(/récent|dernier|nouveau/i);
      const matchDateAncien = analyseResponse.questionCorrigee.match(/ancien|premier|vieux/i);
      const matchAlpha = analyseResponse.questionCorrigee.match(/alphabétique|nom/i);
      
      if (matchDateRecent) {
        return [{ 'created_at': 'desc' }];
      } else if (matchDateAncien) {
        return [{ 'created_at': 'asc' }];
      } else if (matchAlpha) {
        return [{ 'name.keyword': 'asc' }];
      }
    }
    
    // Tri par défaut
    return [{ 'created_at': 'desc' }];
  }

  private buildElasticsearchAggs(analyseResponse: AnalyseResponseDto): Record<string, any> {
    const sousIntentions = analyseResponse.sousIntentions || [];
    const aggsIntention = sousIntentions.find(intention => 
      ['compter', 'agréger', 'grouper', 'statistiques'].includes(intention.nom)
    );
    
    if (!aggsIntention) return {};
    
    const aggConfigs: Record<string, any> = {};
    
    // Déterminer les agrégations pertinentes basées sur la question
    if (analyseResponse.questionCorrigee.match(/par mois|mensuel/i)) {
      aggConfigs['par_mois'] = {
        date_histogram: {
          field: 'created_at',
          calendar_interval: 'month',
          format: 'yyyy-MM'
        }
      };
    }
    
    if (analyseResponse.questionCorrigee.match(/par statut|par état/i)) {
      aggConfigs['par_statut'] = {
        terms: {
          field: 'status.keyword',
          size: 10
        }
      };
    }
    
    if (analyseResponse.questionCorrigee.match(/par client/i)) {
      aggConfigs['par_client'] = {
        terms: {
          field: 'client_name.keyword',
          size: 20
        }
      };
    }
    
    // Agrégations métriques
    if (analyseResponse.questionCorrigee.match(/somme|total|montant/i)) {
      aggConfigs['somme_montant'] = {
        sum: {
          field: 'total_amount'
        }
      };
    }
    
    if (analyseResponse.questionCorrigee.match(/moyenne|moyen/i)) {
      aggConfigs['moyenne'] = {
        avg: {
          field: 'total_amount'
        }
      };
    }
    
    return aggConfigs;
  }

  private buildElasticsearchHighlight(analyseResponse: AnalyseResponseDto): any {
    // Configuration de mise en évidence des résultats
    return {
      fields: {
        '*': {
          number_of_fragments: 3,
          fragment_size: 150
        }
      },
      pre_tags: ['<em class="highlight">'],
      post_tags: ['</em>']
    };
  }

  private buildElasticsearchFilters(analyseResponse: AnalyseResponseDto) {
    const filters: any[] = [];
    
    try {
      analyseResponse.contraintes.forEach(contrainte => {
        if (contrainte.includes('=')) {
          const [field, value] = contrainte.split('=').map(s => s.trim());
          filters.push({
            term: { [`${field}.keyword`]: value }
          });
        } else if (contrainte.includes('>')) {
          const [field, value] = contrainte.split('>').map(s => s.trim());
          filters.push({
            range: { [field]: { gt: value } }
          });
        } else if (contrainte.includes('<')) {
          const [field, value] = contrainte.split('<').map(s => s.trim());
          filters.push({
            range: { [field]: { lt: value } }
          });
        } else if (contrainte.includes('LIKE')) {
          const [field, value] = contrainte.split('LIKE').map(s => s.trim());
          // Utiliser match_phrase_prefix pour les recherches LIKE
          filters.push({
            match_phrase_prefix: { [field]: value.replace(/%/g, '') }
          });
        }
      });
    } catch (error) {
      this.logger.warn(`Impossible de parser la contrainte: ${error.message}`);
    }
    
    return filters;
  }

  buildQueryWithJoins(analyseResponse: AnalyseResponseDto, joinConfig: JoinConfig, maxResults?: number) {
    // Déterminer les tables principales
    const primaryTables = this.identifierTables(analyseResponse.entites);
    
    // Déterminer les colonnes à sélectionner
    const columns = this.determineColumnsForJoin(primaryTables, joinConfig.tables);
    
    // Construire les conditions
    const conditions = this.identifierConditions(analyseResponse.contraintes, analyseResponse.entites);
    
    // Construire les jointures 
    const joinInfos = this.buildJoinInfos(primaryTables, joinConfig);
    
    // Construire la requête avec jointures
    const joinQuery = this.construireRequeteAvecJointures(
      primaryTables,
      columns,
      conditions,
      joinInfos
    );
    
    // Ajouter une limite si nécessaire
    const finalQuery = joinQuery + ` LIMIT ${maxResults || this.DEFAULT_LIMIT}`;
    
    return {
      sql: finalQuery,
      params: this.extraireParametres(conditions),
      tables: [...primaryTables, ...joinConfig.tables],
      columns,
      conditions,
      success: true,
      explanation: `Requête SQL avec jointures entre ${primaryTables.join(', ')} et ${joinConfig.tables.join(', ')}`
    };
  }

  private determineColumnsForJoin(primaryTables: string[], joinTables: string[]): string[] {
    const allTables = [...new Set([...primaryTables, ...joinTables])];
    const columns: string[] = [];
    
    // Mapping des colonnes importantes par table
    const tableColumns: Record<string, string[]> = {
      'clients': ['id', 'firstname', 'lastname', 'email', 'phone', 'created_at'],
      'projects': ['id', 'name', 'status', 'start_date', 'end_date', 'client_id'],
      'invoices': ['id', 'reference', 'total_amount', 'issue_date', 'due_date', 'status', 'client_id'],
      'quotations': ['id', 'reference', 'total_amount', 'created_date', 'valid_until', 'status', 'client_id'],
      'staff': ['id', 'firstname', 'lastname', 'email', 'role'],
      'appointments': ['id', 'title', 'start_date', 'end_date', 'location'],
      'documents': ['id', 'title', 'file_path', 'created_at']
    };
    
    // Ajouter les colonnes pertinentes pour chaque table
    allTables.forEach(table => {
      if (tableColumns[table]) {
        columns.push(...tableColumns[table].map(col => `${table}.${col}`));
      } else {
        // Colonnes par défaut si la table n'est pas reconnue
        columns.push(`${table}.id`, `${table}.name`, `${table}.created_at`);
      }
    });
    
    return columns;
  }

  private buildJoinInfos(primaryTables: string[], joinConfig: JoinConfig): JoinInfo[] {
    const joinInfos: JoinInfo[] = [];
    const primaryTable = primaryTables[0]; // Table principale
    
    joinConfig.tables.forEach(joinTable => {
      if (joinTable !== primaryTable) {
        const joinInfo = this.determineJoinRelation(primaryTable, joinTable, joinConfig.type);
        if (joinInfo) {
          joinInfos.push(joinInfo);
        }
      }
    });
    
    return joinInfos;
  }

  private determineJoinRelation(leftTable: string, rightTable: string, joinType: string): JoinInfo | null {
    // Mapping des relations entre tables
    const relationMapping: Record<string, Record<string, { leftCol: string, rightCol: string }>> = {
      'clients': {
        'projects': { leftCol: 'id', rightCol: 'client_id' },
        'invoices': { leftCol: 'id', rightCol: 'client_id' },
        'quotations': { leftCol: 'id', rightCol: 'client_id' },
        'appointments': { leftCol: 'id', rightCol: 'client_id' }
      },
      'projects': {
        'clients': { leftCol: 'client_id', rightCol: 'id' },
        'tasks': { leftCol: 'id', rightCol: 'project_id' },
        'documents': { leftCol: 'id', rightCol: 'project_id' },
        'staff': { leftCol: 'id', rightCol: 'project_id' }
      },
      'staff': {
        'projects': { leftCol: 'id', rightCol: 'manager_id' },
        'appointments': { leftCol: 'id', rightCol: 'staff_id' },
        'tasks': { leftCol: 'id', rightCol: 'assigned_to' }
      }
      // Autres relations
    };
    
    // Vérifier si une relation directe existe
    if (relationMapping[leftTable]?.[rightTable]) {
      const relation = relationMapping[leftTable][rightTable];
      return {
        type: joinType.toUpperCase() as 'INNER' | 'LEFT' | 'RIGHT' | 'FULL',
        leftTable,
        leftColumn: relation.leftCol,
        rightTable, 
        rightColumn: relation.rightCol
      };
    }
    
    // Vérifier s'il existe une relation inverse
    if (relationMapping[rightTable]?.[leftTable]) {
      const relation = relationMapping[rightTable][leftTable];
      return {
        type: joinType.toUpperCase() as 'INNER' | 'LEFT' | 'RIGHT' | 'FULL',
        leftTable,
        leftColumn: relation.rightCol,
        rightTable,
        rightColumn: relation.leftCol
      };
    }
    
    // Si aucune relation n'est trouvée, on utilise id comme colonne commune par défaut
    this.logger.warn(`Aucune relation trouvée entre ${leftTable} et ${rightTable}, utilisation de relation par défaut`);
    return {
      type: joinType.toUpperCase() as 'INNER' | 'LEFT' | 'RIGHT' | 'FULL',
      leftTable,
      leftColumn: 'id',
      rightTable,
      rightColumn: `${leftTable}_id`
    };
  }

  getAvailableJoinConfigurations() {
    // Récupérer les configurations de jointure basées sur le schéma de la base de données
    const configs: Array<{
      name: string;
      description: string;
      tables: string[];
      conditions: string[];
    }> = [];
    
    for (const [mainTable, relatedTables] of Object.entries(this.COMMON_TABLES_RELATIONS)) {
      relatedTables.forEach(relatedTable => {
        configs.push({
          name: `${mainTable}_${relatedTable}`,
          description: `Jointure entre ${mainTable} et ${relatedTable}`,
          tables: [mainTable, relatedTable],
          conditions: [`${mainTable}.id = ${relatedTable}.${mainTable.slice(0, -1)}_id`]
        });
      });
    }
    
    return configs;
  }

  buildAdvancedSearch(searchConfig: SearchConfig): QueryBuilderResult {
    try {
      // Construire une requête SQL pour une recherche plein texte avancée
      const tables = ['search_view']; // Vue qui combine les données des différentes tables
      const whereClause = this.buildAdvancedWhereClause(searchConfig);
      const orderByClause = this.buildAdvancedOrderBy(searchConfig);
      const limitClause = `LIMIT ${searchConfig.pageSize || 20} OFFSET ${((searchConfig.page || 1) - 1) * (searchConfig.pageSize || 20)}`;
      
      const sql = `
        SELECT 
          entity_type,
          entity_id,
          title,
          description,
          content,
          created_at,
          modified_at,
          metadata
        FROM search_view
        WHERE ${whereClause}
        ${orderByClause}
        ${limitClause}
      `;
      
      const params = this.extractAdvancedSearchParams(searchConfig);
      
      // Construire la requête de comptage
      const countSql = `
        SELECT COUNT(*) as total
        FROM search_view
        WHERE ${whereClause}
      `;
      
      return {
        sql,
        countSql: countSql,
        params,
        tables,
        columns: ['entity_type', 'entity_id', 'title', 'description', 'content', 'created_at', 'modified_at', 'metadata'],
        conditions: [whereClause],
        success: true,
        explanation: `Recherche avancée dans la vue unifiée avec les termes: ${searchConfig.query}`,
        searchConfig: searchConfig
      } as any;
    } catch (error) {
      this.logger.error(`Erreur lors de la construction de la recherche avancée: ${error.message}`);
      return {
        sql: '',
        params: [],
        tables: [],
        columns: [],
        conditions: [],
        success: false,
        error: `Erreur lors de la construction de la requête: ${error.message}`,
        explanation: 'Échec de la construction de la requête de recherche avancée'
      };
    }
  }

  private buildAdvancedWhereClause(searchConfig: SearchConfig): string {
    // Construire une clause WHERE pour la recherche en texte intégral
    let whereClause = `MATCH(title, description, content) AGAINST (? IN BOOLEAN MODE)`;
    
    // Ajouter des filtres supplémentaires
    if (searchConfig.filters && Object.keys(searchConfig.filters).length > 0) {
      Object.entries(searchConfig.filters).forEach(([field, value]) => {
        if (Array.isArray(value)) {
          whereClause += ` AND ${field} IN (${value.map(() => '?').join(',')})`;
        } else {
          whereClause += ` AND ${field} = ?`;
        }
      });
    }
    
    return whereClause;
  }

  private buildAdvancedOrderBy(searchConfig: SearchConfig): string {
    if (!searchConfig.sort || Object.keys(searchConfig.sort).length === 0) {
      return 'ORDER BY created_at DESC';
    }
    
    const orderClauses = Object.entries(searchConfig.sort)
      .map(([field, direction]) => `${field} ${direction.toUpperCase()}`)
      .join(', ');
    
    return `ORDER BY ${orderClauses}`;
  }

  private extractAdvancedSearchParams(searchConfig: SearchConfig): any[] {
    const params = [searchConfig.query];
    
    if (searchConfig.filters) {
      Object.values(searchConfig.filters).forEach(value => {
        if (Array.isArray(value)) {
          params.push(...value);
        } else {
          params.push(value);
        }
      });
    }
    
    return params;
  }

  // Méthode pour générer des métadonnées sur la requête
  generateQueryMetadata(sql: string): QueryMetadata {
    // Dans un environnement réel, ces données seraient dérivées d'EXPLAIN ou d'autres outils
    return {
      executionTime: Math.random() * 100,  // Simuler un temps d'exécution (ms)
      estimatedRows: Math.floor(Math.random() * 1000),
      cacheUsed: Math.random() > 0.5,
      indexesUsed: ['idx_primary', 'idx_created_at'],
      optimizationHints: [
        "Considérer l'ajout d'un index sur la colonne status",
        "La jointure pourrait bénéficier d'un index composite"
      ]
    };
  }

  /**
   * Construire une requête en utilisant les connaissances du RAG
   */
  async buildQueryWithRagKnowledge(
    analyseResponse: AnalyseResponseDto,
    similarDocuments: SearchResult[],
    options?: QueryBuilderOptions
  ): Promise<QueryBuilderResult> {
    this.logger.log(`Construction de requête avec enrichissement RAG: ${similarDocuments.length} documents similaires`);
    
    try {
      // Extraire les requêtes des documents similaires
      const similarQueries = similarDocuments.map(doc => {
        try {
          return JSON.parse(doc.document.answer);
        } catch (e) {
          return null;
        }
      }).filter(q => q !== null);
      
      // Extraire les tables suggérées des requêtes similaires
      const suggestedTables = this.extractTablesFromSimilarQueries(similarQueries);
      
      // Identifier les tables à partir des entités
      const entitiesTables = this.identifierTables(analyseResponse.entites);
      
      // Combiner les tables des entités avec celles suggérées par RAG
      const combinedTables = this.combineTablesFromRag(entitiesTables, suggestedTables);
      
      // Remplacer les tables dans l'analyse
      const enhancedAnalyse = {
        ...analyseResponse,
        entites: [...analyseResponse.entites, ...suggestedTables.filter(t => !analyseResponse.entites.includes(t))]
      };
      
      // Construire la requête avec les tables combinées
      const result = this.buildQuery(enhancedAnalyse, options);
      
      // Ajouter des métadonnées sur l'enrichissement RAG
      if (result.metadata) {
        result.metadata = {
          ...result.metadata,
          ragEnhanced: true,
          similarityScore: similarDocuments.length > 0 ? similarDocuments[0].score : 0,
          baseQueryQuestion: similarDocuments.length > 0 ? similarDocuments[0].document.question : '',
          suggestedTables: suggestedTables
        };
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Erreur lors de l'enrichissement RAG: ${error.message}`);
      // En cas d'erreur, revenir à la construction standard
      return this.buildQuery(analyseResponse, options);
    }
  }
  
  /**
   * Combiner les tables identifiées dans la demande et celles suggérées par RAG
   */
  private combineTablesFromRag(entitiesTables: string[], suggestedTables: string[]): string[] {
    // Si des tables sont déjà identifiées clairement, les utiliser
    if (entitiesTables.length > 0) {
      // Filtrer seulement les noms de tables (pas les noms de colonnes)
      const identifiedTables = entitiesTables.filter(entity => 
        !entity.includes('.') && !this.isColumnNameOnly(entity)
      );
      
      if (identifiedTables.length > 0) {
        return identifiedTables;
      }
    }
    
    // Si aucune table n'est clairement identifiée, utiliser celles suggérées par RAG
    if (suggestedTables.length > 0) {
      return suggestedTables;
    }
    
    // En dernier recours, essayer d'extraire les tables à partir des entités
    return this.identifierTables(entitiesTables);
  }
  
  /**
   * Vérifier si une entité est uniquement un nom de colonne
   */
  private isColumnNameOnly(entity: string): boolean {
    const commonColumns = [
      'id', 'name', 'title', 'description', 'status', 'date', 'prix', 'montant',
      'total', 'reference', 'email', 'phone', 'address', 'created_at', 'updated_at'
    ];
    return commonColumns.includes(entity.toLowerCase());
  }
  
  /**
   * Vérifier si la requête demandée est une agrégation
   */
  private isAggregationQuery(analyseResponse: AnalyseResponseDto): boolean {
    const aggregationIntents = [
      'compter', 'sommer', 'moyenne', 'total', 'min', 'max', 
      'grouper', 'agréger', 'statistiques'
    ];
    
    // Vérifier l'intention principale
    if (aggregationIntents.includes(analyseResponse.intentionPrincipale.nom.toLowerCase())) {
      return true;
    }
    
    // Vérifier les sous-intentions
    if (analyseResponse.sousIntentions && analyseResponse.sousIntentions.length > 0) {
      return analyseResponse.sousIntentions.some(intention => 
        aggregationIntents.includes(intention.nom.toLowerCase())
      );
    }
    
    // Vérifier le texte de la question
    const questionText = analyseResponse.questionCorrigee || analyseResponse.contexte;
    const aggregationKeywords = [
      'combien', 'total', 'somme', 'moyenne', 'minimum', 'maximum',
      'par mois', 'par jour', 'par client', 'par statut', 'statistiques'
    ];
    
    return aggregationKeywords.some(keyword => 
      questionText.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * Extrait les tables des requêtes similaires
   */
  private extractTablesFromSimilarQueries(similarQueries: any[]): string[] {
    const tables = new Set<string>();
    
    similarQueries.forEach(query => {
      if (query && Array.isArray(query.tables)) {
        query.tables.forEach((table: string) => tables.add(table));
      }
    });
    
    return Array.from(tables);
  }
} 