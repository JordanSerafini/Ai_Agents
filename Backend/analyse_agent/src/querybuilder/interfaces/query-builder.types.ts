/**
 * Types partagés pour le QueryBuilder
 */

export interface QueryConditionParameters {
  temporal?: {
    start_date: string;
    end_date: string;
  };
  [key: string]: unknown;
}

export interface AnalyseQueryData {
  tables: Array<{
    nom: string;
    alias: string;
    type: 'PRINCIPALE' | 'JOINTE';
    colonnes: string[];
    condition_jointure?: string;
  }>;
  conditions?: Array<{
    type: 'TEMPOREL' | 'FILTRE';
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
