import { Injectable, Logger } from '@nestjs/common';
import { AnalyseResponseDto } from '../dto/analyse-response.dto';
import { DatabaseMetadataService } from './database-metadata.service';
import { 
  QueryBuilderResult, 
  QueryBuilderOptions,
  JoinInfo,
  OrderByInfo,
  GroupByInfo
} from '../interfaces/query-builder.interface';

@Injectable()
export class QueryBuilderService {
  private readonly logger = new Logger(QueryBuilderService.name);

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
    
    for (const entite of entites) {
      const entiteLower = entite.toLowerCase();
      // Vérifier si l'entité correspond à une table
      if (allTables.includes(entiteLower)) {
        tables.push(entiteLower);
      }
    }
    
    // Si aucune table n'est identifiée, utiliser une table par défaut
    if (tables.length === 0) {
      // Essayer de déduire la table à partir des entités
      // Pour l'instant, on utilise une approche simple
      for (const table of allTables) {
        for (const entite of entites) {
          if (entite.toLowerCase().includes(table) || table.includes(entite.toLowerCase())) {
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
    
    // Identifier les colonnes mentionnées
    for (const entite of entites) {
      const entiteLower = entite.toLowerCase();
      
      for (const table of tables) {
        if (allColumns[table]) {
          for (const column of allColumns[table]) {
            if (column === entiteLower || 
                entiteLower.includes(column) || 
                column.includes(entiteLower)) {
              columns.push(`${table}.${column}`);
            }
          }
        }
      }
    }
    
    // Si aucune colonne n'est identifiée, sélectionner toutes les colonnes
    if (columns.length === 0) {
      return tables.map(t => `${t}.*`);
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
    if (tables.length === 0) {
      return '';
    }
    
    const columnsStr = columns.length > 0 ? columns.join(', ') : '*';
    const tablesStr = tables.join(', ');
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    return `SELECT ${columnsStr} FROM ${tablesStr} ${whereClause}`;
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
    if (tables.length === 0) {
      return '';
    }
    
    let aggregation = 'COUNT(*)';
    
    // Déterminer la fonction d'agrégation en fonction de l'intention
    if (intention.toLowerCase().includes('somme') || intention.toLowerCase().includes('total')) {
      aggregation = columns.length > 0 ? `SUM(${columns[0]})` : 'SUM(*)';
    } else if (intention.toLowerCase().includes('moyenne')) {
      aggregation = columns.length > 0 ? `AVG(${columns[0]})` : 'AVG(*)';
    } else if (intention.toLowerCase().includes('maximum') || intention.toLowerCase().includes('max')) {
      aggregation = columns.length > 0 ? `MAX(${columns[0]})` : 'MAX(*)';
    } else if (intention.toLowerCase().includes('minimum') || intention.toLowerCase().includes('min')) {
      aggregation = columns.length > 0 ? `MIN(${columns[0]})` : 'MIN(*)';
    }
    
    const tablesStr = tables.join(', ');
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    return `SELECT ${aggregation} FROM ${tablesStr} ${whereClause}`;
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
} 