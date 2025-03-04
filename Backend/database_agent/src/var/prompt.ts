import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Variables pour les prompts de l'agent de base de données
 */
export const DATABASE_STRUCTURE = {
  // Structure des tables principales
  PROJECTS: 'Les chantiers se trouvent dans la table "projects"',
  TASKS:
    'Les tâches se trouvent dans la table "tasks" et sont liées aux chantiers via project_id',
  USERS: 'Les utilisateurs se trouvent dans la table "users"',
  CLIENTS:
    'Les clients se trouvent dans la table "clients" et sont liés aux chantiers via client_id',

  // Relations entre les tables
  RELATIONSHIPS: `
    - Un chantier (projects) appartient à un client (clients)
    - Un chantier (projects) peut avoir plusieurs tâches (tasks)
    - Un utilisateur (users) peut être assigné à plusieurs tâches (tasks)
    - Une tâche (tasks) peut avoir plusieurs utilisateurs assignés via la table de jointure "task_assignments"
  `,

  // Informations sur les dates
  DATE_FORMAT: 'Les dates sont stockées au format ISO 8601 (YYYY-MM-DD)',
};

/**
 * Fonctions utilitaires pour la gestion des dates
 */
export const DATE_UTILS = {
  /**
   * Formate une date pour l'affichage en français
   * @param date Date à formater
   * @returns Date formatée en français
   */
  formatDateFr: (date: Date): string => {
    return format(date, 'dd MMMM yyyy', { locale: fr });
  },

  /**
   * Formate une date pour une requête SQL
   * @param date Date à formater
   * @returns Date formatée pour SQL
   */
  formatDateForSql: (date: Date): string => {
    return format(date, 'yyyy-MM-dd');
  },

  /**
   * Obtient la date du jour au format SQL
   * @returns Date du jour au format SQL
   */
  getTodayForSql: (): string => {
    return format(new Date(), 'yyyy-MM-dd');
  },

  /**
   * Obtient le premier jour du mois courant au format SQL
   * @returns Premier jour du mois au format SQL
   */
  getFirstDayOfCurrentMonth: (): string => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return format(firstDay, 'yyyy-MM-dd');
  },

  /**
   * Obtient le dernier jour du mois courant au format SQL
   * @returns Dernier jour du mois au format SQL
   */
  getLastDayOfCurrentMonth: (): string => {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return format(lastDay, 'yyyy-MM-dd');
  },
};

/**
 * Exemples de prompts pour l'agent de base de données
 */
export const PROMPT_EXAMPLES = {
  FIND_PROJECT: 'Trouve tous les chantiers pour le client "Dupont"',
  TASKS_THIS_MONTH: 'Liste toutes les tâches prévues ce mois-ci',
  OVERDUE_TASKS: 'Quelles sont les tâches en retard?',
  USER_ASSIGNMENTS:
    'Montre-moi toutes les tâches assignées à l\'utilisateur "Jean Martin"',
  PROJECT_PROGRESS:
    'Quel est l\'état d\'avancement du chantier "Rénovation Appartement 123"?',
};

/**
 * Messages d'aide pour l'utilisateur
 */
export const HELP_MESSAGES = {
  GENERAL: `
    Je suis votre assistant de base de données. Je peux vous aider à:
    - Rechercher des informations dans la base de données
    - Exécuter des requêtes SQL
    - Analyser les données des chantiers et des tâches
    - Générer des rapports sur l'avancement des projets
  `,
  SEARCH_SYNTAX: `
    Pour rechercher des informations, vous pouvez utiliser des phrases comme:
    - "Trouve tous les chantiers pour le client X"
    - "Liste les tâches prévues entre le [date1] et [date2]"
    - "Combien de tâches sont assignées à l'utilisateur X?"
  `,
};
