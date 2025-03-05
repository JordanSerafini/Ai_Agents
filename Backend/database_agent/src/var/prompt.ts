import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Variables pour les prompts de l'agent de base de données
 */
export const DATABASE_STRUCTURE = {
  // Structure des tables principales
  PROJECTS:
    'Les chantiers se trouvent dans la table "projects" avec leurs détails comme nom, dates, statut, etc.',
  TASKS:
    'Les tâches se trouvent dans la table "tasks" et sont liées aux chantiers via project_id',
  USERS:
    'Les utilisateurs (staff) se trouvent dans la table "staff" avec leurs informations personnelles et rôles',
  CLIENTS:
    'Les clients se trouvent dans la table "clients" et sont liés aux chantiers via client_id',
  INVOICES:
    'Les factures se trouvent dans la table "invoices" et sont liées aux chantiers via project_id',
  PAYMENTS:
    'Les paiements se trouvent dans la table "payments" et sont liés aux factures via invoice_id',
  EXPENSES:
    'Les dépenses se trouvent dans la table "expenses" et peuvent être liées aux chantiers via project_id',
  SUPPLIERS:
    'Les fournisseurs se trouvent dans la table "suppliers" avec leurs coordonnées et évaluations',
  EQUIPMENT:
    'Les équipements se trouvent dans la table "equipment" avec leur statut, localisation et dates de maintenance',
  VEHICLES:
    'Les véhicules se trouvent dans la table "vehicles" avec leur statut, kilométrage et dates de maintenance',
  DOCUMENTS:
    'Les documents se trouvent dans la table "documents" et peuvent être liés à différentes entités',
  SETTINGS:
    'Les paramètres système se trouvent dans la table "system_settings" au format JSONB',
  AI: 'Les interactions avec l\'IA se trouvent dans les tables "ai_interactions" et "ai_suggestions"',

  // Relations entre les tables
  RELATIONSHIPS: `
    - Un chantier (projects) appartient à un client (clients)
    - Un chantier (projects) peut avoir plusieurs tâches (tasks)
    - Un chantier (projects) peut avoir plusieurs factures (invoices)
    - Un chantier (projects) peut avoir plusieurs dépenses (expenses)
    - Un chantier (projects) peut avoir plusieurs documents (documents)
    - Un utilisateur (staff) peut être assigné à plusieurs tâches (tasks)
    - Une tâche (tasks) peut avoir plusieurs utilisateurs assignés via la table de jointure "task_assignments"
    - Une facture (invoices) peut avoir plusieurs paiements (payments)
    - Une facture (invoices) peut avoir plusieurs éléments (invoice_items)
    - Un fournisseur (suppliers) peut avoir plusieurs produits (supplier_products)
    - Un fournisseur (suppliers) peut avoir plusieurs commandes (supplier_orders)
    - Un fournisseur (suppliers) peut avoir plusieurs évaluations (supplier_ratings)
    - Un équipement (equipment) peut avoir plusieurs réservations (equipment_reservations)
    - Un équipement (equipment) peut avoir plusieurs maintenances (maintenance_records)
    - Un véhicule (vehicles) peut avoir plusieurs réservations (vehicle_reservations)
    - Les documents (documents) sont liés à différentes entités via entity_type et entity_id
    - Les tags (tags) sont liés à différentes entités via la table "entity_tags"
  `,

  // Informations sur les dates et les types
  DATE_FORMAT: 'Les dates sont stockées au format ISO 8601 (YYYY-MM-DD)',
  ENUM_TYPES: `
    La base de données utilise plusieurs types ENUM PostgreSQL:
    - project_status: 'en_attente', 'en_cours', 'termine', 'annule'
    - task_status: 'a_faire', 'en_cours', 'terminee', 'bloquee'
    - invoice_status: 'brouillon', 'envoyee', 'payee_partiellement', 'payee', 'en_retard', 'annulee'
    - equipment_status: 'disponible', 'en_utilisation', 'en_maintenance', 'hors_service'
  `,

  // Partitionnement et fonctionnalités avancées
  ADVANCED_FEATURES: `
    - Les tables "activity_logs" et "ai_interactions" sont partitionnées par mois
    - Des triggers automatiques mettent à jour les timestamps et créent de nouvelles partitions
    - Des contraintes de validation garantissent l'intégrité des données (emails, téléphones, dates, montants)
    - La table "system_settings" utilise JSONB pour stocker des configurations flexibles
    - Des fonctions automatiques mettent à jour les statuts des factures et des équipements
  `,
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

  /**
   * Obtient le premier jour du trimestre courant au format SQL
   * @returns Premier jour du trimestre au format SQL
   */
  getFirstDayOfCurrentQuarter: (): string => {
    const today = new Date();
    const quarter = Math.floor(today.getMonth() / 3);
    const firstDay = new Date(today.getFullYear(), quarter * 3, 1);
    return format(firstDay, 'yyyy-MM-dd');
  },

  /**
   * Obtient le dernier jour du trimestre courant au format SQL
   * @returns Dernier jour du trimestre au format SQL
   */
  getLastDayOfCurrentQuarter: (): string => {
    const today = new Date();
    const quarter = Math.floor(today.getMonth() / 3);
    const lastDay = new Date(today.getFullYear(), quarter * 3 + 3, 0);
    return format(lastDay, 'yyyy-MM-dd');
  },
};

/**
 * Exemples de prompts pour l'agent de base de données
 */
export const PROMPT_EXAMPLES = {
  // Exemples pour les projets
  FIND_PROJECT: 'Trouve tous les chantiers pour le client "Dupont"',
  PROJECT_STATUS: 'Combien de chantiers sont actuellement en cours?',
  PROJECT_TIMELINE:
    'Quels chantiers doivent démarrer dans les 30 prochains jours?',
  PROJECT_PROGRESS:
    'Quel est l\'état d\'avancement du chantier "Rénovation Appartement 123"?',

  // Exemples pour les tâches
  TASKS_THIS_MONTH: 'Liste toutes les tâches prévues ce mois-ci',
  OVERDUE_TASKS: 'Quelles sont les tâches en retard?',
  USER_ASSIGNMENTS:
    'Montre-moi toutes les tâches assignées à l\'utilisateur "Jean Martin"',
  TASK_PRIORITY:
    'Quelles sont les tâches prioritaires à traiter cette semaine?',

  // Exemples pour les finances
  INVOICE_STATUS: 'Montre-moi les factures impayées depuis plus de 30 jours',
  PAYMENT_SUMMARY: 'Quel est le total des paiements reçus ce trimestre?',
  PROJECT_PROFITABILITY:
    'Calcule la rentabilité du chantier "Construction Maison Durand"',
  EXPENSE_ANALYSIS: 'Analyse les dépenses par catégorie pour le mois dernier',

  // Exemples pour les fournisseurs et équipements
  SUPPLIER_PERFORMANCE:
    'Quels sont nos meilleurs fournisseurs selon les évaluations?',
  EQUIPMENT_AVAILABILITY:
    'Quels équipements sont disponibles pour la semaine prochaine?',
  MAINTENANCE_SCHEDULE:
    'Quels véhicules nécessitent une maintenance dans les 30 prochains jours?',
  ORDER_STATUS: 'Quel est le statut de la commande fournisseur #12345?',

  // Exemples pour l'IA et l'analyse
  AI_SUGGESTIONS:
    'Montre-moi les suggestions d\'IA en attente pour le chantier "Rénovation Café Central"',
  DATA_ANALYSIS: 'Analyse la tendance des retards de livraison par fournisseur',
  PREDICTIVE_QUERY: 'Prédis la charge de travail pour le mois prochain',
  SIMILAR_PROJECTS:
    'Trouve des chantiers similaires à "Construction Maison Moderne"',

  // Nouveaux exemples pour la recherche avancée
  SEMANTIC_SEARCH:
    'Cherche des projets concernant la rénovation de salle de bain',
  FUZZY_SEARCH: 'Trouve des clients dont le nom ressemble à "Duppont"',
  MULTI_FIELD_SEARCH: 'Recherche des documents contenant "isolation thermique"',
  SIMILAR_SEARCH: 'Trouve des projets similaires au chantier #123',
};

/**
 * Messages d'aide pour l'utilisateur
 */
export const HELP_MESSAGES = {
  GENERAL: `
    Je suis votre assistant de base de données pour la gestion de chantiers. Je peux vous aider à:
    - Rechercher des informations dans la base de données
    - Exécuter des requêtes SQL complexes
    - Analyser les données des chantiers, tâches, factures et fournisseurs
    - Générer des rapports sur l'avancement des projets et la santé financière
    - Identifier les problèmes potentiels (retards, dépassements de budget)
    - Fournir des suggestions basées sur l'analyse des données historiques
  `,
  SEARCH_SYNTAX: `
    Pour rechercher des informations, vous pouvez utiliser des phrases comme:
    - "Trouve tous les chantiers pour le client X"
    - "Liste les tâches prévues entre le [date1] et [date2]"
    - "Combien de factures sont en retard de paiement?"
    - "Quels équipements sont réservés pour le chantier X?"
    - "Montre-moi les fournisseurs avec des évaluations supérieures à 4 étoiles"
    - "Cherche des projets concernant la rénovation de salle de bain"
    - "Trouve des chantiers similaires au projet #123"
  `,
  FINANCIAL_QUERIES: `
    Pour les requêtes financières, vous pouvez demander:
    - "Calcule le chiffre d'affaires du trimestre"
    - "Quel est le taux de recouvrement des factures?"
    - "Montre-moi les chantiers les plus rentables"
    - "Analyse les dépenses par catégorie"
    - "Prépare un rapport de trésorerie pour les 3 derniers mois"
  `,
  AI_FEATURES: `
    Pour utiliser les fonctionnalités d'IA avancées:
    - "Suggère des améliorations pour le chantier X"
    - "Prédis les risques potentiels pour le projet Y"
    - "Trouve des chantiers similaires à Z pour estimer le budget"
    - "Analyse les tendances des retards sur nos chantiers"
    - "Recommande des fournisseurs pour le projet X"
  `,
};

/**
 * Capacités de recherche avancée avec Elasticsearch
 */
export const SEARCH_CAPABILITIES = {
  SEMANTIC_SEARCH: `
    Je peux effectuer des recherches sémantiques avancées dans la base de données:
    - Recherche approximative (tolérante aux fautes de frappe)
    - Recherche par pertinence (les résultats les plus pertinents en premier)
    - Recherche multi-champs (nom, description, ville, client)
    - Filtrage combiné avec la recherche (statut, dates, budget)
  `,
  SIMILARITY_SEARCH: `
    Je peux trouver des projets similaires à un projet existant:
    - Analyse des descriptions et caractéristiques
    - Recommandation de projets comparables
    - Estimation de budget basée sur des projets similaires
    - Identification de risques potentiels basée sur l'historique
  `,
  ADVANCED_QUERIES: `
    Je peux effectuer des analyses avancées:
    - Tendances des retards par type de chantier
    - Corrélation entre fournisseurs et problèmes de qualité
    - Prédiction de la durée des tâches basée sur l'historique
    - Identification des facteurs de dépassement de budget
  `,
  NATURAL_LANGUAGE: `
    Je comprends les requêtes en langage naturel:
    - "Trouve-moi des projets de rénovation à Paris terminés l'année dernière"
    - "Quels sont les fournisseurs qui livrent souvent en retard?"
    - "Montre-moi les chantiers qui ont dépassé leur budget de plus de 10%"
    - "Quels clients ont eu le plus de projets avec nous?"
  `,
};
