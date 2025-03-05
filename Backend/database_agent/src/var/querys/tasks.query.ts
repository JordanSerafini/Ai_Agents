/**
 * Requêtes liées aux tâches
 */
export const TASKS_QUERIES = {
  // Récupérer toutes les tâches d'un projet
  GET_BY_PROJECT: `
      SELECT s.*, p.name as project_name
      FROM stages s
      JOIN projects p ON s.project_id = p.id
      WHERE s.project_id = $1
      ORDER BY s.start_date;
    `,

  // Récupérer les tâches assignées à un utilisateur
  GET_BY_USER: `
      SELECT s.*, p.name as project_name
      FROM stages s
      JOIN projects p ON s.project_id = p.id
      WHERE s.staff_id = $1
      ORDER BY s.start_date;
    `,

  // Récupérer les tâches en retard
  GET_OVERDUE: `
      SELECT s.*, p.name as project_name
      FROM stages s
      JOIN projects p ON s.project_id = p.id
      WHERE s.status != 'termine' AND s.end_date < CURRENT_DATE
      ORDER BY s.end_date;
    `,

  // Récupérer les tâches à venir pour une période donnée
  GET_UPCOMING: `
      SELECT s.*, p.name as project_name
      FROM stages s
      JOIN projects p ON s.project_id = p.id
      WHERE s.status != 'termine' AND s.start_date BETWEEN $1 AND $2
      ORDER BY s.start_date;
    `,

  // Récupérer les tâches par priorité
  GET_BY_PRIORITY: `
      SELECT s.*, p.name as project_name
      FROM stages s
      JOIN projects p ON s.project_id = p.id
      WHERE s.order_index = $1
      ORDER BY s.start_date;
    `,

  // Récupérer les utilisateurs assignés à une tâche
  GET_ASSIGNED_USERS: `
      SELECT st.id, st.firstname, st.lastname, st.email
      FROM staff st
      JOIN stages s ON st.id = s.staff_id
      WHERE s.id = $1;
    `,
};
