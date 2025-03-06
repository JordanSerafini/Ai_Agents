/**
 * Types partagés pour le QueryBuilder
 */

export interface QueryParameters {
  [key: string]: string | number | boolean | null;
}

export interface QueryConditionParameters {
  [key: string]: string | number | boolean | null;
}

/**
 * Représente les données de requête analysées
 */
export interface AnalyseQueryData {
  tables: Array<{
    nom: string;
    alias: string;
    type: 'PRINCIPALE' | 'JOINTE';
    colonnes: string[];
    condition_jointure?: string;
  }>;
  conditions?: Array<{
    type: 'TEMPOREL' | 'FILTRE' | 'LOGIQUE';
    expression: string;
    parametres?: QueryConditionParameters;
  }>;
  groupBy?: string[];
  orderBy?: string[];
  metadata?: {
    intention: string;
    description: string;
    champsRequis?: string[];
    parametresRequete?: {
      tri?: string[];
      limite?: number;
    };
  };
}

/**
 * Options pour la construction d'une requête
 */
export interface QueryBuilderOptions {
  includeMetadata?: boolean;
  maxResults?: number;
  timeout?: number;
  cacheResults?: boolean;
}

/**
 * Résultat de la construction d'une requête
 */
export interface QueryBuilderResult {
  success: boolean;
  sql?: string;
  explanation?: string;
  error?: string;
  data?: any[];
  metadata?: {
    executionTime?: number;
    estimatedRows?: number;
    cacheUsed?: boolean;
    indexesUsed?: string[];
    optimizationHints?: string[];
    baseQueryQuestion?: string;
    suggestedTables?: string[];
  };
}
