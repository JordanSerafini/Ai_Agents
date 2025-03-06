export interface QueryBuilderResult {
  sql: string;
  params: any[];
  explanation: string;
  tables: string[];
  columns: string[];
  conditions: string[];
  success: boolean;
  error?: string;
  metadata?: QueryMetadata;
  data?: any[];
}

export interface QueryMetadata {
  executionTime?: number;
  estimatedRows?: number;
  cacheUsed?: boolean;
  indexesUsed?: string[];
  optimizationHints?: string[];
  baseQueryQuestion?: string;
  suggestedTables?: string[];
}

export interface QueryBuilderOptions {
  maxResults?: number;
  includeMetadata?: boolean;
  formatResult?: 'json' | 'table' | 'csv';
  timeout?: number;
  cacheDuration?: number;
  explain?: boolean;
  tri?: string[];
  limite?: number;
  offset?: number;
}

export interface TableInfo {
  name: string;
  description?: string;
  columns: ColumnInfo[];
  relationships: RelationshipInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  description?: string;
  isPrimary?: boolean;
  isForeign?: boolean;
  references?: {
    table: string;
    column: string;
  };
}

export interface RelationshipInfo {
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  targetTable: string;
  sourceColumn: string;
  targetColumn: string;
  description?: string;
}

export interface AnalyseMetadata {
  tablesIdentifiees: {
    principales: string[];
    jointures: string[];
    conditions: string[];
  };
  champsRequis: {
    selection: string[];
    filtres: string[];
    groupement: string[];
  };
  filtres: {
    temporels: string[];
    logiques: string[];
  };
  periodeTemporelle: {
    debut: string;
    fin: string;
    precision: 'JOUR' | 'SEMAINE' | 'MOIS';
  };
  parametresRequete: {
    tri: string[];
    limite?: number;
    offset?: number;
  };
}

export interface AnalyseQuestion {
  questionCorrigee: string;
  metadonnees: AnalyseMetadata;
}
