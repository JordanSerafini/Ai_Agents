import { AgentType } from '../../interfaces/analyse.interface';

export interface RouterResponse {
  reponse: string;
  resultats?: StaffEvent[];
}

export interface PeriodeTemporelle {
  debut?: string;
  fin?: string;
  precision?: string;
}

export interface TableIdentifiee {
  nom: string;
  alias?: string;
  colonnes?: string[];
  condition?: string;
}

export interface Metadonnees {
  tablesConcernees: string[];
  periodeTemporelle?: PeriodeTemporelle;
  tablesIdentifiees?: {
    principales: TableIdentifiee[];
    jointures: TableIdentifiee[];
    conditions: string[];
  };
  champsRequis?: {
    selection: string[];
    filtres: string[];
    groupement: string[];
  };
  filtres?: {
    temporels: string[];
    logiques: string[];
  };
  parametresRequete?: {
    tri: string[];
    limite: number;
  };
}

export interface QueryBuilderResponse {
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

export interface ElasticsearchHit {
  title?: string;
  _source?: {
    title?: string;
    content?: string;
  };
  highlight?: {
    content?: string[];
  };
}

export interface ElasticsearchResponse {
  hits?: ElasticsearchHit[];
}

export interface RagResponse {
  answer?: string;
}

export interface WorkflowResponse {
  reponse?: string;
}

export interface StaffEvent {
  id: number;
  firstname: string;
  lastname: string;
  title: string;
  start_date: string;
  end_date: string;
  location: string;
} 