/**
 * Requêtes pour les logs d'activité
 */
export const ACTIVITY_QUERIES = {
  // Récupérer tous les logs d'activité
  GET_ALL: `
    SELECT 
      al.*,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM activity_logs al
    LEFT JOIN staff s ON al.staff_id = s.id
    ORDER BY al.created_at DESC
    LIMIT $1 OFFSET $2;
  `,

  // Récupérer les logs d'activité d'un utilisateur
  GET_BY_USER: `
    SELECT * FROM activity_logs
    WHERE staff_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3;
  `,

  // Récupérer les logs d'activité par type d'action
  GET_BY_ACTION_TYPE: `
    SELECT 
      al.*,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM activity_logs al
    LEFT JOIN staff s ON al.staff_id = s.id
    WHERE al.action_type = $1
    ORDER BY al.created_at DESC
    LIMIT $2 OFFSET $3;
  `,

  // Récupérer les logs d'activité par entité
  GET_BY_ENTITY: `
    SELECT 
      al.*,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM activity_logs al
    LEFT JOIN staff s ON al.staff_id = s.id
    WHERE al.entity_type = $1 AND al.entity_id = $2
    ORDER BY al.created_at DESC
    LIMIT $3 OFFSET $4;
  `,

  // Récupérer les logs d'activité par période
  GET_BY_PERIOD: `
    SELECT 
      al.*,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM activity_logs al
    LEFT JOIN staff s ON al.staff_id = s.id
    WHERE al.created_at BETWEEN $1 AND $2
    ORDER BY al.created_at DESC
    LIMIT $3 OFFSET $4;
  `,

  // Ajouter un log d'activité
  ADD: `
    INSERT INTO activity_logs (
      staff_id, action_type, entity_type, entity_id, details
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id;
  `,

  // Récupérer le nombre total de logs d'activité
  COUNT_ALL: `
    SELECT COUNT(*) FROM activity_logs;
  `,

  // Récupérer le nombre de logs d'activité par type d'action
  COUNT_BY_ACTION_TYPE: `
    SELECT COUNT(*) FROM activity_logs
    WHERE action_type = $1;
  `,

  // Récupérer le nombre de logs d'activité par utilisateur
  COUNT_BY_USER: `
    SELECT COUNT(*) FROM activity_logs
    WHERE staff_id = $1;
  `,
};
