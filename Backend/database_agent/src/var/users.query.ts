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
