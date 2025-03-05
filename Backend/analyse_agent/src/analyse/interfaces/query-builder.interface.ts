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
  elasticsearchQuery?: ElasticsearchQuery;
}

export interface QueryMetadata {
  executionTime?: number;
  estimatedRows?: number;
  cacheUsed?: boolean;
  indexesUsed?: string[];
  optimizationHints?: string[];
}

export interface QueryBuilderOptions {
  maxResults?: number;
  includeMetadata?: boolean;
  formatResult?: 'json' | 'table' | 'csv';
  useElasticsearch?: boolean;
  useRag?: boolean;
  timeout?: number;
  cacheDuration?: number;
  explain?: boolean;
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

export interface JoinConfig {
  type: 'inner' | 'left' | 'right' | 'full';
  tables: string[];
  conditions: Array<{
    left: string;
    right: string;
    operator?: string;
  }>;
  additionalFilters?: string[];
}

export interface SearchConfig {
  query: string;
  filters?: Record<string, any>;
  sort?: Record<string, 'asc' | 'desc'>;
  aggregations?: AggregationConfig[];
  highlight?: HighlightConfig;
  facets?: FacetConfig[];
  page?: number;
  pageSize?: number;
  searchType?: 'exact' | 'fuzzy' | 'semantic';
  fuzzyDistance?: number;
}

export interface AggregationConfig {
  name: string;
  type: 'terms' | 'range' | 'date_histogram' | 'sum' | 'avg' | 'min' | 'max' | 'count';
  field: string;
  options?: Record<string, any>;
}

export interface HighlightConfig {
  fields: string[];
  preTag?: string;
  postTag?: string;
  numberOfFragments?: number;
}

export interface FacetConfig {
  field: string;
  size?: number;
  minDocCount?: number;
}

export interface ElasticsearchQuery {
  query: ElasticsearchQueryBody;
  sort?: Array<Record<string, 'asc' | 'desc'>>;
  aggs?: Record<string, ElasticsearchAggregation>;
  highlight?: ElasticsearchHighlight;
  from?: number;
  size?: number;
  _source?: string[] | boolean;
}

export interface ElasticsearchQueryBody {
  bool?: {
    must?: ElasticsearchQueryClause[];
    must_not?: ElasticsearchQueryClause[];
    should?: ElasticsearchQueryClause[];
    filter?: ElasticsearchFilterClause[];
    minimum_should_match?: number;
  };
  match?: Record<string, any>;
  match_phrase?: Record<string, any>;
  multi_match?: {
    query: string;
    fields: string[];
    type?: 'best_fields' | 'most_fields' | 'cross_fields' | 'phrase' | 'phrase_prefix';
    operator?: 'and' | 'or';
    fuzziness?: string | number;
  };
}

export interface ElasticsearchQueryClause {
  match?: Record<string, any>;
  match_phrase?: Record<string, any>;
  multi_match?: {
    query: string;
    fields: string[];
    type?: string;
  };
  term?: Record<string, any>;
  range?: Record<string, any>;
}

export interface ElasticsearchFilterClause {
  term?: Record<string, any>;
  terms?: Record<string, any[]>;
  range?: Record<string, {
    gt?: number | string;
    gte?: number | string;
    lt?: number | string;
    lte?: number | string;
    format?: string;
  }>;
  exists?: {
    field: string;
  };
}

export interface ElasticsearchAggregation {
  terms?: {
    field: string;
    size?: number;
    order?: Record<string, 'asc' | 'desc'>;
  };
  range?: {
    field: string;
    ranges: Array<{
      from?: number;
      to?: number;
      key?: string;
    }>;
  };
  date_histogram?: {
    field: string;
    calendar_interval?: string;
    fixed_interval?: string;
    format?: string;
  };
  sum?: {
    field: string;
  };
  avg?: {
    field: string;
  };
  min?: {
    field: string;
  };
  max?: {
    field: string;
  };
  aggs?: Record<string, ElasticsearchAggregation>;
}

export interface ElasticsearchHighlight {
  fields: Record<string, {
    number_of_fragments?: number;
    fragment_size?: number;
    pre_tags?: string[];
    post_tags?: string[];
  }>;
  pre_tags?: string[];
  post_tags?: string[];
} 