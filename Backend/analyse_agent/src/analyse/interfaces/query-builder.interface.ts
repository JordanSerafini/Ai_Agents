export interface QueryBuilderResult {
  sql: string;
  params: any[];
  explanation: string;
  tables: string[];
  columns: string[];
  conditions: string[];
  success: boolean;
  error?: string;
}

export interface QueryBuilderOptions {
  includeMetadata?: boolean;
  maxResults?: number;
  timeout?: number;
  useCache?: boolean;
  formatResult?: 'json' | 'table' | 'csv';
}

export interface TableInfo {
  name: string;
  description?: string;
  columns: ColumnInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  description?: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  references?: {
    table: string;
    column: string;
  };
}

export interface JoinInfo {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  leftTable: string;
  leftColumn: string;
  rightTable: string;
  rightColumn: string;
}

export interface OrderByInfo {
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface GroupByInfo {
  columns: string[];
  having?: string;
} 