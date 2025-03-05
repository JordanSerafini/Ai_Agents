/**
 * Index des requêtes SQL pour l'application
 */

// Import des différents modules de requêtes
import { REPORT_QUERIES } from './querys/reports.query';
import { FINANCIAL_QUERIES } from './querys/financial.query';
import { SUPPLIER_QUERIES } from './querys/suppliers.query';
import { EQUIPMENT_QUERIES } from './querys/equipment.query';
import { DASHBOARD_QUERIES } from './querys/dashboard.query';
import { SETTINGS_QUERIES } from './querys/settings.query';
import { AI_QUERIES } from './querys/ai.query';
import { PROJECTS_QUERIES } from './querys/projects.query';
import { CLIENTS_QUERIES } from './querys/clients.query';
import { USERS_QUERIES } from './querys/users.query';
import { TASKS_QUERIES } from './querys/tasks.query';
import { ACTIVITY_QUERIES } from './querys/activity.query';
import { NOTES_QUERIES, TAGS_QUERIES } from './querys/notes.query';
import { DOCUMENTS_QUERIES } from './querys/documents.query';
import { QUOTATIONS_QUERIES } from './querys/quotations.query';

// Export de toutes les requêtes
export {
  REPORT_QUERIES,
  FINANCIAL_QUERIES,
  SUPPLIER_QUERIES,
  EQUIPMENT_QUERIES,
  DASHBOARD_QUERIES,
  SETTINGS_QUERIES,
  AI_QUERIES,
  PROJECTS_QUERIES,
  CLIENTS_QUERIES,
  USERS_QUERIES,
  TASKS_QUERIES,
  ACTIVITY_QUERIES,
  NOTES_QUERIES,
  TAGS_QUERIES,
  DOCUMENTS_QUERIES,
  QUOTATIONS_QUERIES,
};

// Export d'un objet contenant toutes les requêtes pour un accès plus facile
export const QUERIES = {
  reports: REPORT_QUERIES,
  financial: FINANCIAL_QUERIES,
  suppliers: SUPPLIER_QUERIES,
  equipment: EQUIPMENT_QUERIES,
  dashboard: DASHBOARD_QUERIES,
  settings: SETTINGS_QUERIES,
  ai: AI_QUERIES,
  projects: PROJECTS_QUERIES,
  clients: CLIENTS_QUERIES,
  users: USERS_QUERIES,
  tasks: TASKS_QUERIES,
  activity: ACTIVITY_QUERIES,
  notes: NOTES_QUERIES,
  tags: TAGS_QUERIES,
  documents: DOCUMENTS_QUERIES,
  quotations: QUOTATIONS_QUERIES,
};
