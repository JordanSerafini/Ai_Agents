// Types pour les requêtes SQL

export interface ProjectQueries {
  GET_ALL: string;
  GET_TODAY: string;
  GET_TOMORROW: string;
  GET_BY_CLIENT: string;
  GET_ACTIVE: string;
  GET_COMPLETED: string;
  CALCULATE_PROGRESS: string;
  SEARCH_BY_NAME: string;
}

export interface TaskQueries {
  GET_ALL: string;
  GET_OVERDUE: string;
  GET_UPCOMING: string;
  GET_BY_USER: string;
  GET_BY_STATUS: string;
  GET_RECENT: string;
  GET_BY_ID: string;
  SEARCH_BY_KEYWORD: string;
}

export interface UserQueries {
  GET_ALL: string;
  GET_BY_ID: string;
  SEARCH_BY_NAME: string;
  GET_BY_ROLE: string;
  GET_WORKLOAD: string;
}

export interface QuotationQueries {
  GET_ALL: string;
  GET_BY_PROJECT: string;
  GET_BY_CLIENT: string;
  GET_ACCEPTED: string;
  GET_REJECTED: string;
  GET_PENDING: string;
  GET_EXPIRED: string;
  GET_FILTERED_QUOTATIONS: string;
  GET_FILTERED_QUOTATIONS_TOTAL: string;
  CONVERSION_STATS: string;
}

export interface ClientQueries {
  GET_ALL: string;
  GET_BY_ID: string;
  SEARCH_BY_NAME: string;
}

export interface SupplierQueries {
  GET_ALL: string;
  GET_BY_ID: string;
  SEARCH: string;
  GET_SUPPLIER_PRODUCTS: string;
  GET_SUPPLIER_ORDERS: string;
  GET_TOP_SUPPLIERS: string;
  SUPPLIER_PERFORMANCE_REPORT: string;
}

export interface ReportQueries {
  PROJECT_PROGRESS_REPORT: string;
  STAFF_PERFORMANCE_REPORT: string;
  CLIENT_PROFITABILITY_REPORT: string;
  QUOTATION_PERFORMANCE_REPORT: string;
}

export interface OtherQueries {
  [key: string]: string;
}

export interface DatabaseQueries {
  projects: ProjectQueries;
  tasks: TaskQueries;
  users: UserQueries;
  quotations: QuotationQueries;
  clients: ClientQueries;
  suppliers: SupplierQueries;
  reports: ReportQueries;
  ai: OtherQueries;
  financial: OtherQueries;
  equipment: OtherQueries;
  dashboard: OtherQueries;
  notes: OtherQueries;
  tags: OtherQueries;
  documents: OtherQueries;
  activity: OtherQueries;
  settings: OtherQueries;
}

// Interface pour les paramètres extraits des requêtes utilisateur
export interface QueryParams {
  clientId?: number;
  clientName?: string;
  projectId?: number;
  projectName?: string;
  userId?: number;
  userName?: string;
  role?: string;
  status?: string;
  taskId?: number;
  keyword?: string;
  supplierId?: number;
  supplierName?: string;
  quotationId?: number;
  category?: string;
  period?: string;
  [key: string]: any;
}

// Types de retour pour les requêtes
export interface ProjectResult {
  id: number;
  name: string;
  client_id: number;
  client_name?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  progress_percentage?: number;
  [key: string]: any;
}

export interface TaskResult {
  id: number;
  title: string;
  description?: string;
  status?: string;
  due_date?: string;
  assigned_to?: number;
  project_id?: number;
  [key: string]: any;
}

export interface QuotationResult {
  id: number;
  reference: string;
  client_id: number;
  client_name?: string;
  project_id?: number;
  project_name?: string;
  date?: string;
  total_amount?: number;
  status?: string;
  [key: string]: any;
}

// Interface pour les résultats de recherche
export interface SearchResult {
  id: number;
  title?: string;
  name?: string;
  description?: string;
  score?: number;
  [key: string]: any;
}

export interface SearchResponse {
  success: boolean;
  results?: SearchResult[];
  count?: number;
  error?: string;
  message?: string;
  type?: string;
  entity?: string;
  intent?: string;
}

// Types de réponses génériques

export interface GenericResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  statusCode?: number;
}

export interface ErrorResponse {
  success: boolean;
  error: string;
  message?: string;
  statusCode?: number;
}
