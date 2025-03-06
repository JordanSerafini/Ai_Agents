export interface SearchRequest {
  query: string;
  index?: string;
  size?: number;
  from?: number;
  fields?: string[];
  highlight?: boolean;
  filters?: Record<string, any>;
  sort?: Record<string, 'asc' | 'desc'>;
}

export interface SearchResponse {
  hits: SearchHit[];
  total: number;
  took: number;
  aggregations?: Record<string, any>;
}

export interface SearchHit {
  id: string;
  index: string;
  score: number;
  _source: Record<string, any>;
  highlight?: Record<string, string[]>;
}

export interface IndexRequest {
  index?: string;
  document: Record<string, any>;
  id?: string;
  refresh?: boolean;
}

export interface IndexResponse {
  id: string;
  index: string;
  version: number;
  result: string;
}

export interface DeleteRequest {
  index?: string;
  id: string;
  refresh?: boolean;
}

export interface DeleteResponse {
  id: string;
  index: string;
  result: string;
}

export interface BulkIndexRequest {
  index?: string;
  documents: Array<Record<string, any> & { id?: string }>;
  refresh?: boolean;
}

export interface BulkIndexResponse {
  took: number;
  errors: boolean;
  items: Array<{
    index: {
      id: string;
      result: string;
    };
  }>;
} 