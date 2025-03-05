/**
 * Index des requêtes SQL pour l'application
 */

// Import des différents modules de requêtes
import { REPORT_QUERIES } from './reports.query';
import { FINANCIAL_QUERIES } from './financial.query';
import { SUPPLIER_QUERIES } from './suppliers.query';
import { EQUIPMENT_QUERIES } from './equipment.query';
import { DASHBOARD_QUERIES } from './dashboard.query';
import { SETTINGS_QUERIES } from './settings.query';
import { AI_QUERIES } from './ai.query';
import { PROJECTS_QUERIES } from './projects.query';
import { CLIENTS_QUERIES } from './clients.query';
import { USERS_QUERIES } from './users.query';
import { TASKS_QUERIES } from './tasks.query';
import { ACTIVITY_QUERIES } from './activity.query';
import { NOTES_QUERIES, TAGS_QUERIES } from './notes.query';
import { DOCUMENTS_QUERIES } from './documents.query';

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
};
