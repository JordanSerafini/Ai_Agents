/**
 * Exemples de requêtes SQL pour l'agent de base de données
 */

/**
 * Requêtes liées aux projets (chantiers)
 */
export const PROJECT_QUERIES = {
  // Récupérer tous les projets
  GET_ALL: `
    SELECT p.*, CONCAT(c.firstname, ' ', c.lastname) as client_name 
    FROM projects p
    JOIN clients c ON p.client_id = c.id
    ORDER BY p.start_date DESC;
  `,

  // Récupérer un projet par son ID
  GET_BY_ID: `
    SELECT p.*, CONCAT(c.firstname, ' ', c.lastname) as client_name 
    FROM projects p
    JOIN clients c ON p.client_id = c.id
    WHERE p.id = $1;
  `,

  // Récupérer les projets d'un client
  GET_BY_CLIENT: `
    SELECT p.* 
    FROM projects p
    WHERE p.client_id = $1
    ORDER BY p.start_date DESC;
  `,

  // Récupérer les projets en cours
  GET_ACTIVE: `
    SELECT p.*, CONCAT(c.firstname, ' ', c.lastname) as client_name 
    FROM projects p
    JOIN clients c ON p.client_id = c.id
    WHERE p.status = 'active'
    ORDER BY p.start_date DESC;
  `,

  // Récupérer les projets terminés
  GET_COMPLETED: `
    SELECT p.*, CONCAT(c.firstname, ' ', c.lastname) as client_name 
    FROM projects p
    JOIN clients c ON p.client_id = c.id
    WHERE p.status = 'completed'
    ORDER BY p.completion_date DESC;
  `,

  // Récupérer les projets par période
  GET_BY_PERIOD: `
    SELECT p.*, CONCAT(c.firstname, ' ', c.lastname) as client_name 
    FROM projects p
    JOIN clients c ON p.client_id = c.id
    WHERE (p.start_date BETWEEN $1 AND $2) OR (p.end_date BETWEEN $1 AND $2)
    ORDER BY p.start_date;
  `,

  // Rechercher des projets par nom
  SEARCH_BY_NAME: `
    SELECT p.*, CONCAT(c.firstname, ' ', c.lastname) as client_name 
    FROM projects p
    JOIN clients c ON p.client_id = c.id
    WHERE p.name ILIKE $1
    ORDER BY p.start_date DESC;
  `,

  // Calculer le taux d'avancement d'un projet
  CALCULATE_PROGRESS: `
    SELECT 
      p.id, 
      p.name,
      COUNT(t.id) as total_tasks,
      SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
      CASE 
        WHEN COUNT(t.id) = 0 THEN 0
        ELSE ROUND((SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END)::numeric / COUNT(t.id)) * 100, 2)
      END as progress_percentage
    FROM projects p
    LEFT JOIN tasks t ON p.id = t.project_id
    WHERE p.id = $1
    GROUP BY p.id, p.name;
  `,
};

/**
 * Requêtes liées aux tâches
 */
export const TASK_QUERIES = {
  // Récupérer toutes les tâches d'un projet
  GET_BY_PROJECT: `
    SELECT t.*, p.name as project_name
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    WHERE t.project_id = $1
    ORDER BY t.due_date;
  `,

  // Récupérer les tâches assignées à un utilisateur
  GET_BY_USER: `
    SELECT t.*, p.name as project_name
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    JOIN task_assignments ta ON t.id = ta.task_id
    WHERE ta.user_id = $1
    ORDER BY t.due_date;
  `,

  // Récupérer les tâches en retard
  GET_OVERDUE: `
    SELECT t.*, p.name as project_name
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    WHERE t.status != 'completed' AND t.due_date < CURRENT_DATE
    ORDER BY t.due_date;
  `,

  // Récupérer les tâches à venir pour une période donnée
  GET_UPCOMING: `
    SELECT t.*, p.name as project_name
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    WHERE t.status != 'completed' AND t.due_date BETWEEN $1 AND $2
    ORDER BY t.due_date;
  `,

  // Récupérer les tâches par priorité
  GET_BY_PRIORITY: `
    SELECT t.*, p.name as project_name
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    WHERE t.priority = $1
    ORDER BY t.due_date;
  `,

  // Récupérer les utilisateurs assignés à une tâche
  GET_ASSIGNED_USERS: `
    SELECT u.id, u.first_name, u.last_name, u.email
    FROM users u
    JOIN task_assignments ta ON u.id = ta.user_id
    WHERE ta.task_id = $1;
  `,
};

/**
 * Requêtes liées aux clients
 */
export const CLIENT_QUERIES = {
  // Récupérer tous les clients
  GET_ALL: `
    SELECT * FROM clients
    ORDER BY lastname, firstname;
  `,

  // Récupérer un client par son ID
  GET_BY_ID: `
    SELECT * FROM clients
    WHERE id = $1;
  `,

  // Rechercher des clients par nom
  SEARCH_BY_NAME: `
    SELECT * FROM clients
    WHERE firstname ILIKE $1 OR lastname ILIKE $1
    ORDER BY lastname, firstname;
  `,

  // Récupérer les projets d'un client avec statistiques
  GET_CLIENT_PROJECTS_STATS: `
    SELECT 
      c.id as client_id,
      CONCAT(c.firstname, ' ', c.lastname) as client_name,
      COUNT(p.id) as total_projects,
      SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) as active_projects,
      SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) as completed_projects,
      SUM(p.budget) as total_budget
    FROM clients c
    LEFT JOIN projects p ON c.id = p.client_id
    WHERE c.id = $1
    GROUP BY c.id, c.firstname, c.lastname;
  `,
};

/**
 * Requêtes liées aux utilisateurs
 */
export const USER_QUERIES = {
  // Récupérer tous les utilisateurs
  GET_ALL: `
    SELECT id, firstname, lastname, email, role, created_at
    FROM staff
    ORDER BY lastname, firstname;
  `,

  // Récupérer un utilisateur par son ID
  GET_BY_ID: `
    SELECT id, firstname, lastname, email, role, created_at
    FROM staff
    WHERE id = $1;
  `,

  // Récupérer les utilisateurs par rôle
  GET_BY_ROLE: `
    SELECT id, firstname, lastname, email, role, created_at
    FROM staff
    WHERE role = $1
    ORDER BY lastname, firstname;
  `,

  // Rechercher des utilisateurs par nom
  SEARCH_BY_NAME: `
    SELECT id, firstname, lastname, email, role, created_at
    FROM staff
    WHERE firstname ILIKE $1 OR lastname ILIKE $1
    ORDER BY lastname, firstname;
  `,

  // Récupérer la charge de travail d'un utilisateur
  GET_WORKLOAD: `
    SELECT 
      s.id,
      s.firstname,
      s.lastname,
      COUNT(ps.id) as assigned_projects,
      COUNT(CASE WHEN p.status = 'termine' THEN 1 END) as completed_projects,
      COUNT(CASE WHEN p.status = 'en_cours' AND p.end_date < CURRENT_DATE THEN 1 END) as overdue_projects
    FROM staff s
    LEFT JOIN project_staff ps ON s.id = ps.staff_id
    LEFT JOIN projects p ON ps.project_id = p.id
    WHERE s.id = $1
    GROUP BY s.id, s.firstname, s.lastname;
  `,
};

/**
 * Requêtes pour les rapports et statistiques
 */
export const REPORT_QUERIES = {
  // Rapport d'avancement global des projets
  PROJECT_PROGRESS_REPORT: `
    SELECT 
      p.id, 
      p.name,
      p.start_date,
      p.end_date,
      p.status,
      c.name as client_name,
      COUNT(t.id) as total_tasks,
      SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
      CASE 
        WHEN COUNT(t.id) = 0 THEN 0
        ELSE ROUND((SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END)::numeric / COUNT(t.id)) * 100, 2)
      END as progress_percentage
    FROM projects p
    JOIN clients c ON p.client_id = c.id
    LEFT JOIN tasks t ON p.id = t.project_id
    WHERE p.status = 'active'
    GROUP BY p.id, p.name, p.start_date, p.end_date, p.status, c.name
    ORDER BY progress_percentage DESC;
  `,

  // Rapport des tâches par statut
  TASKS_BY_STATUS: `
    SELECT 
      t.status,
      COUNT(t.id) as task_count
    FROM tasks t
    GROUP BY t.status
    ORDER BY task_count DESC;
  `,

  // Rapport des projets par mois
  PROJECTS_BY_MONTH: `
    SELECT 
      TO_CHAR(p.start_date, 'YYYY-MM') as month,
      COUNT(p.id) as project_count,
      SUM(p.budget) as total_budget
    FROM projects p
    WHERE p.start_date >= $1 AND p.start_date <= $2
    GROUP BY TO_CHAR(p.start_date, 'YYYY-MM')
    ORDER BY month;
  `,

  // Rapport de performance des utilisateurs
  USER_PERFORMANCE: `
    SELECT 
      u.id,
      u.first_name,
      u.last_name,
      COUNT(ta.task_id) as assigned_tasks,
      COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
      CASE 
        WHEN COUNT(ta.task_id) = 0 THEN 0
        ELSE ROUND((COUNT(CASE WHEN t.status = 'completed' THEN 1 END)::numeric / COUNT(ta.task_id)) * 100, 2)
      END as completion_rate,
      COUNT(CASE WHEN t.status != 'completed' AND t.due_date < CURRENT_DATE THEN 1 END) as overdue_tasks
    FROM users u
    LEFT JOIN task_assignments ta ON u.id = ta.user_id
    LEFT JOIN tasks t ON ta.task_id = t.id
    GROUP BY u.id, u.first_name, u.last_name
    ORDER BY completion_rate DESC;
  `,
};
