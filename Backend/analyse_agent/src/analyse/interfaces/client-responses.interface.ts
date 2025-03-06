export interface QueryBuilderResponse {
  explanation?: string;
  sql?: string;
  data?: unknown;
  error?: string;
}

export interface SearchResponse {
  hits: {
    hits: unknown[];
    total: number;
  };
  error?: string;
}

export interface KnowledgeResponse {
  answer?: string;
  confidence?: number;
  knowledge?: unknown[];
  sources?: string[];
  error?: string;
}

// Interfaces pour le typage des réponses des clients
export interface QueryBuilderClientResponse {
  explanation: string;
  sql: string;
  data: unknown;
}

export interface ElasticsearchClientResponse {
  hits: {
    hits: unknown[];
    total: number;
  };
}

export interface RagClientResponse {
  answer: string;
  confidence: number;
  knowledge: unknown[];
  sources: string[];
}
