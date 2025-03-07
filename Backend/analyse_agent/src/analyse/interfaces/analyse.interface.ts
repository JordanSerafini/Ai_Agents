import { PrioriteType } from './priorite.interface';

// Types de classification des questions
export enum QuestionCategory {
  GENERAL = 'GENERAL',
  DATABASE = 'DATABASE',
  SEARCH = 'SEARCH',
  KNOWLEDGE = 'KNOWLEDGE',
  WORKFLOW = 'WORKFLOW',
}

// Types d'agents disponibles
export enum AgentType {
  GENERAL = 'general',
  QUERYBUILDER = 'querybuilder',
  ELASTICSEARCH = 'elasticsearch',
  RAG = 'rag',
  WORKFLOW = 'workflow',
  DATABASE = 'database',
  SEARCH = 'search',
}

// Interface pour la réponse d'analyse
export interface AnalyseResult {
  questionCorrigee: string;
  intention: string;
  categorie: QuestionCategory;
  agentCible: AgentType;
  priorite: PrioriteType;
  entites: string[];
  contexte: string;
  informationsManquantes?: string[];
  questionsComplementaires?: string[];
  reponseAgent?: any;
  metadonnees?: {
    tablesConcernees: string[];
    periodeTemporelle?: PeriodeTemporelle;
    tablesIdentifiees?: {
      principales: Array<{ nom: string; alias?: string; colonnes?: string[] }>;
      jointures: Array<{
        nom: string;
        alias?: string;
        colonnes?: string[];
        condition?: string;
      }>;
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
  };
}

export interface PeriodeTemporelle {
  debut: string;
  fin: string;
  precision: 'JOUR' | 'SEMAINE' | 'MOIS' | 'ANNEE';
  type: 'DYNAMIQUE' | 'FIXE';
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

export interface RouterResponse {
  reponse: string;
  resultats?: StaffEvent[];
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
    type: 'FILTRE' | 'TEMPOREL';
    expression: string;
    parametres?: Record<string, unknown>;
  }>;
  groupBy?: string[];
  orderBy?: string[];
  limit?: number;
  metadata?: {
    intention: string;
    description: string;
  };
}

/**
 * Interface pour la réponse d'analyse sémantique structurée
 */
export interface AnalyseSemantiqueResponse {
  analyse_semantique: {
    intention: {
      action: string;
      objectif: string;
    };
    temporalite: {
      periode: {
        type: 'DYNAMIQUE' | 'FIXE';
        precision: 'JOUR' | 'SEMAINE' | 'MOIS' | 'ANNEE';
        reference: 'PASSÉ' | 'PRESENT' | 'FUTUR';
      };
      dates: {
        debut?: string;
        fin?: string;
      };
    };
    entites: {
      principale: {
        nom: string;
        attributs: string[];
      };
      secondaires: Array<{
        nom: string;
        relation: string;
        attributs: string[];
      }>;
    };
    contraintes: {
      explicites: string[];
      implicites: string[];
    };
    informations_demandees: {
      champs: string[];
      agregations: string[];
      ordre: string[];
    };
  };
  structure_requete: {
    tables: Array<{
      nom: string;
      alias: string;
      type: 'PRINCIPALE' | 'JOINTE';
      colonnes: string[];
      condition_jointure?: string;
    }>;
    conditions: Array<{
      type: 'TEMPOREL' | 'LOGIQUE';
      expression: string;
      parametres?: Record<string, unknown>;
    }>;
    groupements: string[];
    ordre: string[];
  };
  validation: {
    colonnes_verifiees: boolean;
    relations_coherentes: boolean;
    types_compatibles: boolean;
  };
}

export interface CacheEntry {
  reponse: string;
  timestamp: number;
}

export interface ConversationHistory {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
  }>;
  lastInteraction: number;
}

export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// Interface générique pour les intentions spécifiques à une entreprise
export interface IntentionConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  requiredPermissions?: string[];
  defaultPriority: PrioriteType;
  validationRules?: ValidationRule[];
  // Ajout des patterns de reconnaissance
  patterns?: {
    keywords?: string[];
    regex?: string[];
    examples?: string[];
  };
  // Ajout des actions possibles
  possibleActions?: {
    type: 'API' | 'WORKFLOW' | 'DIRECT';
    description: string;
    parameters?: Record<string, any>;
  }[];
  confiance: number;
}

export enum PrioriteType {
  URGENT = 'URGENT',
  NORMAL = 'NORMAL',
  BASSE = 'BASSE',
}

// Configuration de l'entreprise
export interface EntrepriseConfig {
  id: string;
  name: string;
  domain: string;
  version: string;
  language: string;
  timezone: string;
  intentions: IntentionConfig[];
  dataModel: {
    entities: EntityConfig[];
    relationships: RelationshipConfig[];
  };
  businessRules: BusinessRule[];
  permissions: PermissionConfig[];
  // Ajout des configurations spécifiques
  settings: {
    apiEndpoints?: Record<string, string>;
    workflowDefinitions?: Record<string, any>;
    customValidators?: Record<string, any>;
  };
}

// Configuration d'une entité de données
export interface EntityConfig {
  name: string;
  description: string;
  fields: FieldConfig[];
  requiredPermissions?: string[];
  // Ajout des métadonnées
  metadata?: {
    displayName?: string;
    icon?: string;
    color?: string;
    category?: string;
  };
}

// Configuration d'un champ
export interface FieldConfig {
  name: string;
  type: string;
  description: string;
  required?: boolean;
  validation?: ValidationRule[];
  // Ajout des options de formatage
  format?: {
    display?: string;
    input?: string;
    validation?: string;
  };
}

// Configuration d'une relation
export interface RelationshipConfig {
  from: string;
  to: string;
  type: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_MANY';
  description: string;
  // Ajout des options de cascade
  cascade?: {
    create?: boolean;
    update?: boolean;
    delete?: boolean;
  };
}

// Règle de validation
export interface ValidationRule {
  type: string;
  params?: Record<string, any>;
  message: string;
  // Ajout des options de validation
  options?: {
    severity?: 'ERROR' | 'WARNING' | 'INFO';
    customValidator?: string;
  };
}

// Règle métier
export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  action: string;
  priority: PrioriteType;
  // Ajout des options d'exécution
  execution?: {
    async?: boolean;
    timeout?: number;
    retry?: {
      attempts: number;
      delay: number;
    };
  };
}

// Configuration des permissions
export interface PermissionConfig {
  id: string;
  name: string;
  description: string;
  scope: string[];
  // Ajout des options de permission
  options?: {
    inheritsFrom?: string[];
    customValidator?: string;
  };
}

export interface ContexteUtilisateur {
  id: string;
  nom: string;
  role: string;
  permissions: string[];
}

export interface DetailsAnalyse {
  confidence: number;
  score?: number;
  priority: PrioriteType;
  requiredContext: {
    entities?: string[];
    fields?: string[];
    relationships?: string[];
  };
  suggestedActions: string[];
  validationRules?: ValidationRule[];
  businessRules?: BusinessRule[];
  // Ajout des métriques d'analyse
  metrics?: {
    processingTime?: number;
    complexity?: number;
    dependencies?: string[];
  };
}

export interface AnalyseResponse {
  type: AgentType;
  intention: string;
  explication: string;
  details: DetailsAnalyse;
  routing?: {
    targetService?: string;
    endpoint?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    payload?: any;
    // Ajout des options de routage
    options?: {
      timeout?: number;
      retry?: boolean;
      cache?: boolean;
    };
  };
  // Ajout des suggestions d'amélioration
  suggestions?: {
    alternativeIntents?: string[];
    missingContext?: string[];
    potentialIssues?: string[];
  };
}

export interface AnalyseRequest {
  requete: string;
  contexte: ContexteUtilisateur;
  entrepriseId: string;
  metadata?: {
    source?: string;
    format?: string;
    timestamp?: Date;
    sessionId?: string;
    // Ajout des métadonnées techniques
    technical?: {
      clientVersion?: string;
      platform?: string;
      device?: string;
      network?: string;
    };
  };
  // Ajout des options de traitement
  options?: {
    debug?: boolean;
    trace?: boolean;
    timeout?: number;
  };
}
