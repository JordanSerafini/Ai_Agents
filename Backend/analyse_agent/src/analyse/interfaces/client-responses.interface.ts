export interface QueryBuilderResponse {
  explanation?: string;
  sql?: string;
  data?: unknown;
  error?: string;
}

export interface SearchHit {
  _source: {
    title?: string;
    content?: string;
    [key: string]: unknown;
  };
  title?: string;
}

export interface SearchResponse {
  hits?: {
    hits: SearchHit[];
    total: number;
  };
  error?: string;
}

export interface KnowledgeResponse {
  answer?: string;
  confidence?: number;
  knowledge?: unknown[];
  sources?: unknown[];
  error?: string;
}
