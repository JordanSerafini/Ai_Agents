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
