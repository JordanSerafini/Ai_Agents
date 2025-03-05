/**
 * Requêtes liées aux projets (chantiers)
 */
export const PROJECTS_QUERIES = {
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

  // Récupérer les projets qui commencent demain
  GET_TOMORROW: `
      SELECT p.*, CONCAT(c.firstname, ' ', c.lastname) as client_name 
      FROM projects p
      JOIN clients c ON p.client_id = c.id
      WHERE p.start_date = CURRENT_DATE + INTERVAL '1 day'
      ORDER BY p.name;
    `,

  // Récupérer les projets actifs pour aujourd'hui
  GET_TODAY: `
      SELECT p.*, CONCAT(c.firstname, ' ', c.lastname) as client_name 
      FROM projects p
      JOIN clients c ON p.client_id = c.id
      WHERE p.start_date <= CURRENT_DATE AND (p.end_date >= CURRENT_DATE OR p.end_date IS NULL)
      AND p.status = 'en_cours'
      ORDER BY p.name;
    `,

  // Récupérer les projets en cours avec des retards
  GET_PROJECTS_WITH_DELAYS: `
    SELECT 
      p.*,
      CONCAT(c.firstname, ' ', c.lastname) as client_name
    FROM projects p
    JOIN clients c ON p.client_id = c.id
    WHERE p.status = 'en_cours'
    AND p.end_date < CURRENT_DATE
    ORDER BY p.end_date;
  `,
};
