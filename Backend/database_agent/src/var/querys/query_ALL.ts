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
};

/**
 * Requêtes liées aux tâches
 */
export const TASK_QUERIES = {
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

/**
 * Requêtes spécifiques pour l'assistant IA
 */
export const AI_ASSISTANT_QUERIES = {
  // Recherche sémantique dans les projets
  SEMANTIC_SEARCH: `
    SELECT 
      e.document_type,
      e.document_id,
      CASE
        WHEN e.document_type = 'project' THEN (SELECT name FROM projects WHERE id = e.document_id)
        WHEN e.document_type = 'client' THEN (SELECT CONCAT(firstname, ' ', lastname) FROM clients WHERE id = e.document_id)
        WHEN e.document_type = 'quotation' THEN (SELECT reference FROM quotations WHERE id = e.document_id)
        WHEN e.document_type = 'stage' THEN (SELECT name FROM stages WHERE id = e.document_id)
        ELSE 'Unknown'
      END as document_name,
      e.content,
      1 - (e.embedding <=> $1) as similarity
    FROM document_embeddings e
    WHERE 1 - (e.embedding <=> $1) > $2
    ORDER BY similarity DESC
    LIMIT $3;
  `,

  // Récupérer un résumé complet d'un projet pour l'IA
  PROJECT_SUMMARY_FOR_AI: `
    SELECT 
      p.*,
      CONCAT(c.firstname, ' ', c.lastname) as client_name,
      c.email as client_email,
      c.phone as client_phone,
      (
        SELECT json_agg(json_build_object(
          'id', s.id,
          'name', s.name,
          'status', s.status,
          'start_date', s.start_date,
          'end_date', s.end_date,
          'staff_name', CONCAT(st.firstname, ' ', st.lastname)
        ))
        FROM stages s
        LEFT JOIN staff st ON s.staff_id = st.id
        WHERE s.project_id = p.id
      ) as stages,
      (
        SELECT json_agg(json_build_object(
          'id', q.id,
          'reference', q.reference,
          'total', q.total,
          'status', q.status,
          'created_date', q.created_date
        ))
        FROM quotations q
        WHERE q.project_id = p.id
      ) as quotations,
      (
        SELECT json_agg(json_build_object(
          'id', pm.id,
          'material_name', m.name,
          'quantity_used', pm.quantity_used,
          'unit_price', m.price
        ))
        FROM project_materials pm
        JOIN materials m ON pm.material_id = m.id
        WHERE pm.project_id = p.id
      ) as materials,
      (
        SELECT json_agg(json_build_object(
          'id', ps.id,
          'staff_name', CONCAT(s.firstname, ' ', s.lastname),
          'role', s.role
        ))
        FROM project_staff ps
        JOIN staff s ON ps.staff_id = s.id
        WHERE ps.project_id = p.id
      ) as assigned_staff,
      (
        SELECT json_agg(json_build_object(
          'id', ce.id,
          'title', ce.title,
          'event_type', ce.event_type,
          'start_date', ce.start_date,
          'end_date', ce.end_date
        ))
        FROM calendar_events ce
        WHERE ce.project_id = p.id
      ) as events
    FROM projects p
    JOIN clients c ON p.client_id = c.id
    WHERE p.id = $1;
  `,

  // Recherche contextuelle pour l'IA
  CONTEXTUAL_SEARCH: `
    SELECT 
      p.id as project_id,
      p.name as project_name,
      p.description as project_description,
      p.status as project_status,
      p.start_date,
      p.end_date,
      CONCAT(c.firstname, ' ', c.lastname) as client_name,
      c.email as client_email,
      c.phone as client_phone,
      s.id as stage_id,
      s.name as stage_name,
      s.status as stage_status,
      CONCAT(st.firstname, ' ', st.lastname) as staff_name,
      st.role as staff_role,
      q.id as quotation_id,
      q.reference as quotation_reference,
      q.total as quotation_total,
      q.status as quotation_status
    FROM projects p
    JOIN clients c ON p.client_id = c.id
    LEFT JOIN stages s ON p.id = s.project_id
    LEFT JOIN staff st ON s.staff_id = st.id
    LEFT JOIN quotations q ON p.id = q.project_id
    WHERE 
      p.name ILIKE $1 OR
      p.description ILIKE $1 OR
      c.firstname ILIKE $1 OR
      c.lastname ILIKE $1 OR
      s.name ILIKE $1 OR
      s.description ILIKE $1 OR
      q.reference ILIKE $1
    ORDER BY p.start_date DESC;
  `,

  // Statistiques globales pour le tableau de bord IA
  AI_DASHBOARD_STATS: `
    SELECT
      (SELECT COUNT(*) FROM projects WHERE status = 'en_cours') as active_projects,
      (SELECT COUNT(*) FROM projects WHERE status = 'termine') as completed_projects,
      (SELECT COUNT(*) FROM clients) as total_clients,
      (SELECT COUNT(*) FROM stages WHERE status != 'termine' AND end_date < CURRENT_DATE) as overdue_stages,
      (SELECT COUNT(*) FROM calendar_events WHERE start_date::date = CURRENT_DATE) as today_events,
      (SELECT COUNT(*) FROM quotations WHERE status = 'en_attente') as pending_quotations,
      (SELECT COUNT(*) FROM staff WHERE is_available = true) as available_staff
    ;
  `,

  // Prédiction de charge de travail pour la planification
  WORKLOAD_PREDICTION: `
    SELECT
      s.id as staff_id,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name,
      s.role,
      (
        SELECT COUNT(*)
        FROM stages st
        WHERE st.staff_id = s.id AND st.status != 'termine'
      ) as pending_tasks,
      (
        SELECT COUNT(*)
        FROM calendar_events ce
        WHERE ce.staff_id = s.id AND ce.start_date > CURRENT_DATE
      ) as upcoming_events,
      (
        SELECT COUNT(*)
        FROM project_staff ps
        JOIN projects p ON ps.project_id = p.id
        WHERE ps.staff_id = s.id AND p.status = 'en_cours'
      ) as active_projects
    FROM staff s
    ORDER BY pending_tasks DESC;
  `,

  // Recherche de projets similaires pour recommandations
  SIMILAR_PROJECTS: `
    SELECT 
      p2.id,
      p2.name,
      p2.description,
      p2.status,
      p2.start_date,
      p2.end_date,
      CONCAT(c.firstname, ' ', c.lastname) as client_name,
      similarity(p1.name, p2.name) + similarity(p1.description, p2.description) as similarity_score
    FROM projects p1
    JOIN projects p2 ON p1.id != p2.id
    JOIN clients c ON p2.client_id = c.id
    WHERE p1.id = $1
    ORDER BY similarity_score DESC
    LIMIT 5;
  `,
};

/**
 * Requêtes pour les journaux d'activité
 */
export const ACTIVITY_LOG_QUERIES = {
  // Récupérer les dernières activités
  GET_RECENT: `
    SELECT 
      al.id,
      al.entity_type,
      al.entity_id,
      al.activity_type,
      al.description,
      al.created_at,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM activity_logs al
    LEFT JOIN staff s ON al.staff_id = s.id
    ORDER BY al.created_at DESC
    LIMIT $1;
  `,

  // Récupérer les activités par entité
  GET_BY_ENTITY: `
    SELECT 
      al.id,
      al.entity_type,
      al.entity_id,
      al.activity_type,
      al.description,
      al.created_at,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM activity_logs al
    LEFT JOIN staff s ON al.staff_id = s.id
    WHERE al.entity_type = $1 AND al.entity_id = $2
    ORDER BY al.created_at DESC;
  `,

  // Récupérer les activités par utilisateur
  GET_BY_STAFF: `
    SELECT 
      al.id,
      al.entity_type,
      al.entity_id,
      al.activity_type,
      al.description,
      al.created_at
    FROM activity_logs al
    WHERE al.staff_id = $1
    ORDER BY al.created_at DESC
    LIMIT $2;
  `,

  // Ajouter une nouvelle entrée de journal
  ADD_LOG: `
    INSERT INTO activity_logs (
      staff_id,
      entity_type,
      entity_id,
      activity_type,
      description,
      metadata
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id;
  `,
};

/**
 * Requêtes pour les interactions avec l'IA
 */
export const AI_INTERACTION_QUERIES = {
  // Récupérer les dernières interactions
  GET_RECENT: `
    SELECT 
      ai.id,
      ai.query,
      ai.response,
      ai.context,
      ai.feedback,
      ai.created_at,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM ai_interactions ai
    LEFT JOIN staff s ON ai.staff_id = s.id
    ORDER BY ai.created_at DESC
    LIMIT $1;
  `,

  // Récupérer les interactions par utilisateur
  GET_BY_STAFF: `
    SELECT 
      ai.id,
      ai.query,
      ai.response,
      ai.context,
      ai.feedback,
      ai.created_at
    FROM ai_interactions ai
    WHERE ai.staff_id = $1
    ORDER BY ai.created_at DESC
    LIMIT $2;
  `,

  // Ajouter une nouvelle interaction
  ADD_INTERACTION: `
    INSERT INTO ai_interactions (
      staff_id,
      query,
      response,
      context,
      feedback
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING id;
  `,

  // Mettre à jour le feedback d'une interaction
  UPDATE_FEEDBACK: `
    UPDATE ai_interactions
    SET feedback = $2
    WHERE id = $1
    RETURNING id;
  `,

  // Récupérer les requêtes fréquentes pour l'analyse
  GET_FREQUENT_QUERIES: `
    SELECT 
      query,
      COUNT(*) as frequency,
      AVG(CASE WHEN feedback IS NOT NULL THEN feedback ELSE 0 END) as avg_feedback
    FROM ai_interactions
    WHERE created_at > CURRENT_DATE - INTERVAL '30 days'
    GROUP BY query
    ORDER BY frequency DESC
    LIMIT $1;
  `,
};

/**
 * Requêtes pour les suggestions de l'IA
 */
export const AI_SUGGESTION_QUERIES = {
  // Récupérer les suggestions en attente
  GET_PENDING: `
    SELECT 
      s.id,
      s.entity_type,
      s.entity_id,
      s.suggestion_type,
      s.content,
      s.status,
      s.created_at,
      CASE
        WHEN s.entity_type = 'project' THEN (SELECT name FROM projects WHERE id = s.entity_id)
        WHEN s.entity_type = 'client' THEN (SELECT CONCAT(firstname, ' ', lastname) FROM clients WHERE id = s.entity_id)
        WHEN s.entity_type = 'quotation' THEN (SELECT reference FROM quotations WHERE id = s.entity_id)
        ELSE 'Unknown'
      END as entity_name
    FROM ai_suggestions s
    WHERE s.status = 'pending'
    ORDER BY s.created_at DESC;
  `,

  // Récupérer les suggestions par entité
  GET_BY_ENTITY: `
    SELECT 
      s.id,
      s.entity_type,
      s.entity_id,
      s.suggestion_type,
      s.content,
      s.status,
      s.created_at,
      CONCAT(st.firstname, ' ', st.lastname) as staff_name
    FROM ai_suggestions s
    LEFT JOIN staff st ON s.staff_id = st.id
    WHERE s.entity_type = $1 AND s.entity_id = $2
    ORDER BY s.created_at DESC;
  `,

  // Ajouter une nouvelle suggestion
  ADD_SUGGESTION: `
    INSERT INTO ai_suggestions (
      entity_type,
      entity_id,
      suggestion_type,
      content
    ) VALUES ($1, $2, $3, $4)
    RETURNING id;
  `,

  // Mettre à jour le statut d'une suggestion
  UPDATE_STATUS: `
    UPDATE ai_suggestions
    SET status = $2, staff_id = $3, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id;
  `,
};

/**
 * Requêtes pour les documents
 */
export const DOCUMENT_QUERIES = {
  // Récupérer les documents par entité
  GET_BY_ENTITY: `
    SELECT 
      d.*,
      CONCAT(s.firstname, ' ', s.lastname) as uploaded_by_name
    FROM documents d
    LEFT JOIN staff s ON d.uploaded_by = s.id
    WHERE d.entity_type = $1 AND d.entity_id = $2
    ORDER BY d.created_at DESC;
  `,

  // Récupérer un document par son ID
  GET_BY_ID: `
    SELECT 
      d.*,
      CONCAT(s.firstname, ' ', s.lastname) as uploaded_by_name
    FROM documents d
    LEFT JOIN staff s ON d.uploaded_by = s.id
    WHERE d.id = $1;
  `,

  // Récupérer les documents par type
  GET_BY_TYPE: `
    SELECT 
      d.*,
      CONCAT(s.firstname, ' ', s.lastname) as uploaded_by_name,
      CASE
        WHEN d.entity_type = 'project' THEN (SELECT name FROM projects WHERE id = d.entity_id)
        WHEN d.entity_type = 'client' THEN (SELECT CONCAT(firstname, ' ', lastname) FROM clients WHERE id = d.entity_id)
        WHEN d.entity_type = 'quotation' THEN (SELECT reference FROM quotations WHERE id = d.entity_id)
        ELSE 'Unknown'
      END as entity_name
    FROM documents d
    LEFT JOIN staff s ON d.uploaded_by = s.id
    WHERE d.document_type = $1
    ORDER BY d.created_at DESC;
  `,

  // Rechercher des documents
  SEARCH: `
    SELECT 
      d.*,
      CONCAT(s.firstname, ' ', s.lastname) as uploaded_by_name,
      CASE
        WHEN d.entity_type = 'project' THEN (SELECT name FROM projects WHERE id = d.entity_id)
        WHEN d.entity_type = 'client' THEN (SELECT CONCAT(firstname, ' ', lastname) FROM clients WHERE id = d.entity_id)
        WHEN d.entity_type = 'quotation' THEN (SELECT reference FROM quotations WHERE id = d.entity_id)
        ELSE 'Unknown'
      END as entity_name
    FROM documents d
    LEFT JOIN staff s ON d.uploaded_by = s.id
    WHERE 
      d.name ILIKE $1 OR
      d.description ILIKE $1
    ORDER BY d.created_at DESC;
  `,

  // Ajouter un document
  ADD: `
    INSERT INTO documents (
      entity_type,
      entity_id,
      name,
      file_path,
      file_size,
      file_type,
      document_type,
      description,
      uploaded_by,
      is_public
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id;
  `,
};

/**
 * Requêtes pour les notes
 */
export const NOTE_QUERIES = {
  // Récupérer les notes par entité
  GET_BY_ENTITY: `
    SELECT
      n.*,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM notes n
    LEFT JOIN staff s ON n.staff_id = s.id
    WHERE n.entity_type = $1 AND n.entity_id = $2
    ORDER BY n.is_pinned DESC, n.created_at DESC;
  `,

  // Récupérer une note par son ID
  GET_BY_ID: `
    SELECT
      n.*,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM notes n
    LEFT JOIN staff s ON n.staff_id = s.id
    WHERE n.id = $1;
  `,

  // Ajouter une note
  ADD: `
    INSERT INTO notes (
      entity_type,
      entity_id,
      content,
      staff_id,
      is_pinned
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING id;
  `,

  // Mettre à jour une note
  UPDATE: `
    UPDATE notes
    SET 
      content = $2,
      is_pinned = $3,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id;
  `,
};

/**
 * Requêtes pour les tags
 */
export const TAG_QUERIES = {
  // Récupérer tous les tags
  GET_ALL: `
    SELECT * FROM tags
    ORDER BY name;
  `,

  // Récupérer les tags d'une entité
  GET_BY_ENTITY: `
    SELECT
      t.*
    FROM tags t
    JOIN entity_tags et ON t.id = et.tag_id
    WHERE et.entity_type = $1 AND et.entity_id = $2
    ORDER BY t.name;
  `,

  // Ajouter un tag
  ADD: `
    INSERT INTO tags (
      name,
      color
    ) VALUES ($1, $2)
    ON CONFLICT (name) DO UPDATE
    SET color = EXCLUDED.color
    RETURNING id;
  `,

  // Associer un tag à une entité
  ADD_TO_ENTITY: `
    INSERT INTO entity_tags (
      entity_type,
      entity_id,
      tag_id
    ) VALUES ($1, $2, $3)
    ON CONFLICT DO NOTHING
    RETURNING id;
  `,

  // Supprimer un tag d'une entité
  REMOVE_FROM_ENTITY: `
    DELETE FROM entity_tags
    WHERE entity_type = $1 AND entity_id = $2 AND tag_id = $3;
  `,

  // Rechercher des entités par tag
  SEARCH_ENTITIES_BY_TAG: `
    SELECT
      et.entity_type,
      et.entity_id,
      CASE
        WHEN et.entity_type = 'project' THEN (SELECT name FROM projects WHERE id = et.entity_id)
        WHEN et.entity_type = 'client' THEN (SELECT CONCAT(firstname, ' ', lastname) FROM clients WHERE id = et.entity_id)
        WHEN et.entity_type = 'quotation' THEN (SELECT reference FROM quotations WHERE id = et.entity_id)
        ELSE 'Unknown'
      END as entity_name
    FROM entity_tags et
    JOIN tags t ON et.tag_id = t.id
    WHERE t.name = $1
    ORDER BY et.entity_type, et.entity_id;
  `,
};

/**
 * Requêtes pour les factures
 */
export const INVOICE_QUERIES = {
  // Récupérer toutes les factures
  GET_ALL: `
    SELECT
      i.*,
      p.name as project_name,
      CONCAT(c.firstname, ' ', c.lastname) as client_name,
      (
        SELECT SUM(amount) 
        FROM payments 
        WHERE invoice_id = i.id
      ) as amount_paid
    FROM invoices i
    JOIN projects p ON i.project_id = p.id
    JOIN clients c ON p.client_id = c.id
    ORDER BY i.issue_date DESC;
  `,

  // Récupérer une facture par son ID
  GET_BY_ID: `
    SELECT
      i.*,
      p.name as project_name,
      CONCAT(c.firstname, ' ', c.lastname) as client_name,
      (
        SELECT SUM(amount) 
        FROM payments 
        WHERE invoice_id = i.id
      ) as amount_paid,
      (
        SELECT json_agg(json_build_object(
          'id', ii.id,
          'description', ii.description,
          'quantity', ii.quantity,
          'unit_price', ii.unit_price,
          'unit', ii.unit,
          'tva_rate', ii.tva_rate,
          'total_ht', ii.total_ht
        ))
        FROM invoice_items ii
        WHERE ii.invoice_id = i.id
      ) as items,
      (
        SELECT json_agg(json_build_object(
          'id', p.id,
          'amount', p.amount,
          'payment_date', p.payment_date,
          'payment_method', p.payment_method,
          'reference', p.reference
        ))
        FROM payments p
        WHERE p.invoice_id = i.id
      ) as payments
    FROM invoices i
    JOIN projects p ON i.project_id = p.id
    JOIN clients c ON p.client_id = c.id
    WHERE i.id = $1;
  `,

  // Récupérer les factures d'un projet
  GET_BY_PROJECT: `
    SELECT
      i.*,
      (
        SELECT SUM(amount) 
        FROM payments 
        WHERE invoice_id = i.id
      ) as amount_paid
    FROM invoices i
    WHERE i.project_id = $1
    ORDER BY i.issue_date DESC;
  `,

  // Récupérer les factures en retard
  GET_OVERDUE: `
    SELECT
      i.*,
      p.name as project_name,
      CONCAT(c.firstname, ' ', c.lastname) as client_name,
      (
        SELECT SUM(amount) 
        FROM payments 
        WHERE invoice_id = i.id
      ) as amount_paid,
      CURRENT_DATE - i.due_date as days_overdue
    FROM invoices i
    JOIN projects p ON i.project_id = p.id
    JOIN clients c ON p.client_id = c.id
    WHERE i.status NOT IN ('payée', 'annulée') AND i.due_date < CURRENT_DATE
    ORDER BY i.due_date;
  `,

  // Récupérer les statistiques de facturation
  GET_STATS: `
    SELECT
      COUNT(*) as total_invoices,
      COUNT(CASE WHEN status = 'payée' THEN 1 END) as paid_invoices,
      COUNT(CASE WHEN status = 'en_retard' THEN 1 END) as overdue_invoices,
      SUM(total_ttc) as total_amount,
      SUM(CASE WHEN status = 'payée' THEN total_ttc ELSE 0 END) as paid_amount,
      SUM(
        CASE 
          WHEN status NOT IN ('payée', 'annulée') AND due_date < CURRENT_DATE 
          THEN total_ttc - COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = invoices.id), 0)
          ELSE 0 
        END
      ) as overdue_amount
    FROM invoices;
  `,
};

/**
 * Requêtes pour les paiements
 */
export const PAYMENT_QUERIES = {
  // Récupérer tous les paiements
  GET_ALL: `
    SELECT
      p.*,
      i.reference as invoice_reference,
      pr.name as project_name,
      CONCAT(c.firstname, ' ', c.lastname) as client_name
    FROM payments p
    JOIN invoices i ON p.invoice_id = i.id
    JOIN projects pr ON i.project_id = pr.id
    JOIN clients c ON pr.client_id = c.id
    ORDER BY p.payment_date DESC;
  `,

  // Récupérer les paiements d'une facture
  GET_BY_INVOICE: `
    SELECT * FROM payments
    WHERE invoice_id = $1
    ORDER BY payment_date DESC;
  `,

  // Récupérer les paiements par période
  GET_BY_PERIOD: `
    SELECT
      p.*,
      i.reference as invoice_reference,
      pr.name as project_name
    FROM payments p
    JOIN invoices i ON p.invoice_id = i.id
    JOIN projects pr ON i.project_id = pr.id
    WHERE p.payment_date BETWEEN $1 AND $2
    ORDER BY p.payment_date DESC;
  `,

  // Ajouter un paiement
  ADD: `
    INSERT INTO payments (
      invoice_id,
      amount,
      payment_date,
      payment_method,
      reference,
      notes
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id;
  `,

  // Mettre à jour le statut d'une facture après paiement
  UPDATE_INVOICE_STATUS: `
    UPDATE invoices
    SET 
      status = CASE
        WHEN (SELECT SUM(amount) FROM payments WHERE invoice_id = $1) >= total_ttc THEN 'payée'::invoice_status
        WHEN (SELECT SUM(amount) FROM payments WHERE invoice_id = $1) > 0 THEN 'payée_partiellement'::invoice_status
        ELSE status
      END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id, status;
  `,
};

/**
 * Requêtes pour les dépenses
 */
export const EXPENSE_QUERIES = {
  // Récupérer toutes les dépenses
  GET_ALL: `
    SELECT 
      e.*,
      p.name as project_name,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM expenses e
    LEFT JOIN projects p ON e.project_id = p.id
    LEFT JOIN staff s ON e.staff_id = s.id
    ORDER BY e.expense_date DESC;
  `,

  // Récupérer les dépenses d'un projet
  GET_BY_PROJECT: `
    SELECT
      e.*,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM expenses e
    LEFT JOIN staff s ON e.staff_id = s.id
    WHERE e.project_id = $1
    ORDER BY e.expense_date DESC;
  `,

  // Récupérer les dépenses d'un membre du personnel
  GET_BY_STAFF: `
    SELECT 
      e.*,
      p.name as project_name
    FROM expenses e
    LEFT JOIN projects p ON e.project_id = p.id
    WHERE e.staff_id = $1
    ORDER BY e.expense_date DESC;
  `,

  // Récupérer les dépenses par catégorie
  GET_BY_CATEGORY: `
    SELECT
      e.*,
      p.name as project_name,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM expenses e
    LEFT JOIN projects p ON e.project_id = p.id
    LEFT JOIN staff s ON e.staff_id = s.id
    WHERE e.category = $1
    ORDER BY e.expense_date DESC;
  `,

  // Récupérer les dépenses par période
  GET_BY_PERIOD: `
    SELECT
      e.*,
      p.name as project_name,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM expenses e
    LEFT JOIN projects p ON e.project_id = p.id
    LEFT JOIN staff s ON e.staff_id = s.id
    WHERE e.expense_date BETWEEN $1 AND $2
    ORDER BY e.expense_date DESC;
  `,

  // Ajouter une dépense
  ADD: `
    INSERT INTO expenses (
      project_id,
      staff_id,
      amount,
      description,
      expense_date,
      category,
      receipt_path,
      is_reimbursable,
      is_reimbursed
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id;
  `,
};

/**
 * Requêtes pour les budgets de projet
 */
export const BUDGET_QUERIES = {
  // Récupérer le budget d'un projet
  GET_BY_PROJECT: `
    SELECT * FROM project_budgets
    WHERE project_id = $1
    ORDER BY category;
  `,

  // Récupérer le résumé du budget d'un projet
  GET_PROJECT_BUDGET_SUMMARY: `
    SELECT
      p.id as project_id,
      p.name as project_name,
      SUM(pb.amount_budgeted) as total_budgeted,
      SUM(pb.amount_spent) as total_spent,
      SUM(pb.amount_budgeted - pb.amount_spent) as remaining_budget,
      CASE 
        WHEN SUM(pb.amount_budgeted) = 0 THEN 0
        ELSE ROUND((SUM(pb.amount_spent) / SUM(pb.amount_budgeted)) * 100, 2)
      END as budget_usage_percentage
    FROM projects p
    LEFT JOIN project_budgets pb ON p.id = pb.project_id
    WHERE p.id = $1
    GROUP BY p.id, p.name;
  `,

  // Mettre à jour les dépenses du budget
  UPDATE_SPENT_AMOUNT: `
    UPDATE project_budgets
    SET 
      amount_spent = amount_spent + $3,
      updated_at = CURRENT_TIMESTAMP
    WHERE project_id = $1 AND category = $2
    RETURNING id, amount_budgeted, amount_spent;
  `,

  // Ajouter une catégorie de budget
  ADD_CATEGORY: `
    INSERT INTO project_budgets (
      project_id,
      category,
      amount_budgeted,
      amount_spent,
      notes
    ) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (project_id, category) 
    DO UPDATE SET 
      amount_budgeted = EXCLUDED.amount_budgeted,
      notes = EXCLUDED.notes,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id;
  `,
};

/**
 * Requêtes pour les fournisseurs
 */
export const SUPPLIER_QUERIES = {
  // Récupérer tous les fournisseurs
  GET_ALL: `
    SELECT * FROM suppliers
    ORDER BY name;
  `,

  // Récupérer un fournisseur par son ID
  GET_BY_ID: `
    SELECT * FROM suppliers
    WHERE id = $1;
  `,

  // Rechercher des fournisseurs par nom
  SEARCH_BY_NAME: `
    SELECT * FROM suppliers
    WHERE name ILIKE $1 OR contact_name ILIKE $1
    ORDER BY name;
  `,

  // Récupérer les produits d'un fournisseur
  GET_PRODUCTS: `
    SELECT * FROM supplier_products
    WHERE supplier_id = $1
    ORDER BY name;
  `,

  // Récupérer les commandes d'un fournisseur
  GET_ORDERS: `
    SELECT
      so.*,
      p.name as project_name
    FROM supplier_orders so
    LEFT JOIN projects p ON so.project_id = p.id
    WHERE so.supplier_id = $1
    ORDER BY so.order_date DESC;
  `,

  // Récupérer les évaluations d'un fournisseur
  GET_RATINGS: `
    SELECT
      sr.*,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM supplier_ratings sr
    JOIN staff s ON sr.staff_id = s.id
    WHERE sr.supplier_id = $1
    ORDER BY sr.rating_date DESC;
  `,

  // Calculer la note moyenne d'un fournisseur
  GET_AVERAGE_RATING: `
    SELECT 
      supplier_id,
      COUNT(*) as total_ratings,
      ROUND(AVG(rating), 1) as average_rating
    FROM supplier_ratings
    WHERE supplier_id = $1
    GROUP BY supplier_id;
  `,

  // Ajouter un fournisseur
  ADD: `
    INSERT INTO suppliers (
      name,
      contact_name,
      email,
      phone,
      address,
      website,
      notes,
      is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id;
  `,

  // Mettre à jour un fournisseur
  UPDATE: `
    UPDATE suppliers
    SET 
      name = $2,
      contact_name = $3,
      email = $4,
      phone = $5,
      address = $6,
      website = $7,
      notes = $8,
      is_active = $9,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id;
  `,
};

/**
 * Requêtes pour les produits des fournisseurs
 */
export const SUPPLIER_PRODUCT_QUERIES = {
  // Récupérer tous les produits
  GET_ALL: `
    SELECT 
      sp.*,
      s.name as supplier_name
    FROM supplier_products sp
    JOIN suppliers s ON sp.supplier_id = s.id
    ORDER BY sp.name;
  `,

  // Récupérer un produit par son ID
  GET_BY_ID: `
    SELECT 
      sp.*,
      s.name as supplier_name
    FROM supplier_products sp
    JOIN suppliers s ON sp.supplier_id = s.id
    WHERE sp.id = $1;
  `,

  // Rechercher des produits par nom ou référence
  SEARCH: `
    SELECT 
      sp.*,
      s.name as supplier_name
    FROM supplier_products sp
    JOIN suppliers s ON sp.supplier_id = s.id
    WHERE sp.name ILIKE $1 OR sp.reference ILIKE $1
    ORDER BY sp.name;
  `,

  // Récupérer les produits par catégorie
  GET_BY_CATEGORY: `
    SELECT 
      sp.*,
      s.name as supplier_name
    FROM supplier_products sp
    JOIN suppliers s ON sp.supplier_id = s.id
    WHERE sp.category = $1
    ORDER BY sp.name;
  `,

  // Ajouter un produit
  ADD: `
    INSERT INTO supplier_products (
      supplier_id,
      name,
      reference,
      description,
      unit,
      unit_price,
      category,
      lead_time_days
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id;
  `,

  // Mettre à jour un produit
  UPDATE: `
    UPDATE supplier_products
    SET 
      name = $2,
      reference = $3,
      description = $4,
      unit = $5,
      unit_price = $6,
      category = $7,
      lead_time_days = $8,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id;
  `,
};

/**
 * Requêtes pour les commandes fournisseurs
 */
export const SUPPLIER_ORDER_QUERIES = {
  // Récupérer toutes les commandes
  GET_ALL: `
    SELECT 
      so.*,
      s.name as supplier_name,
      p.name as project_name
    FROM supplier_orders so
    JOIN suppliers s ON so.supplier_id = s.id
    LEFT JOIN projects p ON so.project_id = p.id
    ORDER BY so.order_date DESC;
  `,

  // Récupérer une commande par son ID
  GET_BY_ID: `
    SELECT
      so.*,
      s.name as supplier_name,
      p.name as project_name,
      (
        SELECT json_agg(json_build_object(
          'id', oi.id,
          'description', oi.description,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price,
          'unit', oi.unit,
          'total_price', oi.total_price,
          'product_name', sp.name
        ))
        FROM order_items oi
        LEFT JOIN supplier_products sp ON oi.product_id = sp.id
        WHERE oi.order_id = so.id
      ) as items
    FROM supplier_orders so
    JOIN suppliers s ON so.supplier_id = s.id
    LEFT JOIN projects p ON so.project_id = p.id
    WHERE so.id = $1;
  `,

  // Récupérer les commandes par projet
  GET_BY_PROJECT: `
    SELECT
      so.*,
      s.name as supplier_name
    FROM supplier_orders so
    JOIN suppliers s ON so.supplier_id = s.id
    WHERE so.project_id = $1
    ORDER BY so.order_date DESC;
  `,

  // Récupérer les commandes par statut
  GET_BY_STATUS: `
    SELECT 
      so.*,
      s.name as supplier_name,
      p.name as project_name
    FROM supplier_orders so
    JOIN suppliers s ON so.supplier_id = s.id
    LEFT JOIN projects p ON so.project_id = p.id
    WHERE so.status = $1
    ORDER BY so.order_date DESC;
  `,

  // Récupérer les commandes en attente de livraison
  GET_PENDING_DELIVERY: `
    SELECT 
      so.*,
      s.name as supplier_name,
      p.name as project_name,
      so.expected_delivery_date - CURRENT_DATE as days_until_delivery
    FROM supplier_orders so
    JOIN suppliers s ON so.supplier_id = s.id
    LEFT JOIN projects p ON so.project_id = p.id
    WHERE so.status IN ('confirmée', 'expédiée') AND so.expected_delivery_date IS NOT NULL
    ORDER BY so.expected_delivery_date;
  `,

  // Ajouter une commande
  ADD: `
    INSERT INTO supplier_orders (
      supplier_id,
      project_id,
      reference,
      order_date,
      expected_delivery_date,
      status,
      total_amount,
      shipping_cost,
      notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id;
  `,

  // Mettre à jour le statut d'une commande
  UPDATE_STATUS: `
    UPDATE supplier_orders
    SET 
      status = $2,
      actual_delivery_date = CASE WHEN $2 = 'livrée' THEN CURRENT_DATE ELSE actual_delivery_date END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id, status, actual_delivery_date;
  `,
};

/**
 * Requêtes pour les lignes de commande
 */
export const ORDER_ITEM_QUERIES = {
  // Récupérer les lignes d'une commande
  GET_BY_ORDER: `
    SELECT
      oi.*,
      sp.name as product_name,
      sp.reference as product_reference
    FROM order_items oi
    LEFT JOIN supplier_products sp ON oi.product_id = sp.id
    WHERE oi.order_id = $1;
  `,

  // Ajouter une ligne de commande
  ADD: `
    INSERT INTO order_items (
      order_id,
      product_id,
      description,
      quantity,
      unit_price,
      unit,
      total_price
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id;
  `,

  // Mettre à jour le montant total d'une commande
  UPDATE_ORDER_TOTAL: `
    UPDATE supplier_orders
    SET 
      total_amount = (
        SELECT SUM(total_price) 
        FROM order_items 
        WHERE order_id = $1
      ) + shipping_cost,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id, total_amount;
  `,
};

/**
 * Requêtes pour les évaluations des fournisseurs
 */
export const SUPPLIER_RATING_QUERIES = {
  // Récupérer toutes les évaluations
  GET_ALL: `
    SELECT
      sr.*,
      s.name as supplier_name,
      CONCAT(st.firstname, ' ', st.lastname) as staff_name
    FROM supplier_ratings sr
    JOIN suppliers s ON sr.supplier_id = s.id
    JOIN staff st ON sr.staff_id = st.id
    ORDER BY sr.rating_date DESC;
  `,

  // Ajouter une évaluation
  ADD: `
    INSERT INTO supplier_ratings (
      supplier_id,
      staff_id,
      rating,
      comment,
      rating_date
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING id;
  `,

  // Récupérer les meilleurs fournisseurs
  GET_TOP_SUPPLIERS: `
    SELECT 
      s.id,
      s.name,
      COUNT(sr.id) as total_ratings,
      ROUND(AVG(sr.rating), 1) as average_rating
    FROM suppliers s
    JOIN supplier_ratings sr ON s.id = sr.supplier_id
    GROUP BY s.id, s.name
    HAVING COUNT(sr.id) >= 3
    ORDER BY average_rating DESC
    LIMIT $1;
  `,
};

/**
 * Requêtes pour les équipements
 */
export const EQUIPMENT_QUERIES = {
  // Récupérer tous les équipements
  GET_ALL: `
    SELECT
      e.*,
      ec.name as category_name,
      s.name as supplier_name
    FROM equipment e
    LEFT JOIN equipment_categories ec ON e.category_id = ec.id
    LEFT JOIN suppliers s ON e.supplier_id = s.id
    ORDER BY e.name;
  `,

  // Récupérer un équipement par son ID
  GET_BY_ID: `
    SELECT
      e.*,
      ec.name as category_name,
      s.name as supplier_name
    FROM equipment e
    LEFT JOIN equipment_categories ec ON e.category_id = ec.id
    LEFT JOIN suppliers s ON e.supplier_id = s.id
    WHERE e.id = $1;
  `,

  // Récupérer les équipements par catégorie
  GET_BY_CATEGORY: `
    SELECT 
      e.*,
      s.name as supplier_name
    FROM equipment e
    LEFT JOIN suppliers s ON e.supplier_id = s.id
    WHERE e.category_id = $1
    ORDER BY e.name;
  `,

  // Récupérer les équipements par statut
  GET_BY_STATUS: `
    SELECT 
      e.*,
      ec.name as category_name,
      s.name as supplier_name
    FROM equipment e
    LEFT JOIN equipment_categories ec ON e.category_id = ec.id
    LEFT JOIN suppliers s ON e.supplier_id = s.id
    WHERE e.status = $1
    ORDER BY e.name;
  `,

  // Récupérer les équipements nécessitant une maintenance
  GET_MAINTENANCE_DUE: `
    SELECT 
      e.*,
      ec.name as category_name,
      s.name as supplier_name,
      e.next_maintenance_date - CURRENT_DATE as days_until_maintenance
    FROM equipment e
    LEFT JOIN equipment_categories ec ON e.category_id = ec.id
    LEFT JOIN suppliers s ON e.supplier_id = s.id
    WHERE e.next_maintenance_date IS NOT NULL AND e.next_maintenance_date <= CURRENT_DATE + INTERVAL '30 days'
    ORDER BY e.next_maintenance_date;
  `,

  // Récupérer l'historique de maintenance d'un équipement
  GET_MAINTENANCE_HISTORY: `
    SELECT 
      mh.*,
      s.name as supplier_name
    FROM maintenance_history mh
    LEFT JOIN suppliers s ON mh.supplier_id = s.id
    WHERE mh.equipment_id = $1
    ORDER BY mh.maintenance_date DESC;
  `,

  // Récupérer les réservations d'un équipement
  GET_RESERVATIONS: `
    SELECT 
      er.*,
      p.name as project_name,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM equipment_reservations er
    LEFT JOIN projects p ON er.project_id = p.id
    JOIN staff s ON er.staff_id = s.id
    WHERE er.equipment_id = $1
    ORDER BY er.start_date;
  `,

  // Vérifier la disponibilité d'un équipement pour une période donnée
  CHECK_AVAILABILITY: `
    SELECT
      e.id,
      e.name,
      e.status,
      (
        SELECT COUNT(*)
        FROM equipment_reservations er
        WHERE er.equipment_id = e.id
        AND (
          (er.start_date <= $1 AND er.end_date >= $1) OR
          (er.start_date <= $2 AND er.end_date >= $2) OR
          (er.start_date >= $1 AND er.end_date <= $2)
        )
      ) as reservation_count
    FROM equipment e
    WHERE e.id = $3;
  `,

  // Ajouter un équipement
  ADD: `
    INSERT INTO equipment (
      category_id,
      name,
      reference,
      serial_number,
      purchase_date,
      purchase_price,
      supplier_id,
      status,
      location,
      last_maintenance_date,
      next_maintenance_date,
      notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id;
  `,

  // Mettre à jour le statut d'un équipement
  UPDATE_STATUS: `
    UPDATE equipment
    SET 
      status = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id, status;
  `,
};

/**
 * Requêtes pour les catégories d'équipement
 */
export const EQUIPMENT_CATEGORY_QUERIES = {
  // Récupérer toutes les catégories
  GET_ALL: `
    SELECT * FROM equipment_categories
    ORDER BY name;
  `,

  // Ajouter une catégorie
  ADD: `
    INSERT INTO equipment_categories (
      name,
      description
    ) VALUES ($1, $2)
    RETURNING id;
  `,
};

/**
 * Requêtes pour les réservations d'équipement
 */
export const EQUIPMENT_RESERVATION_QUERIES = {
  // Récupérer toutes les réservations
  GET_ALL: `
    SELECT 
      er.*,
      e.name as equipment_name,
      p.name as project_name,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM equipment_reservations er
    JOIN equipment e ON er.equipment_id = e.id
    LEFT JOIN projects p ON er.project_id = p.id
    JOIN staff s ON er.staff_id = s.id
    ORDER BY er.start_date DESC;
  `,

  // Récupérer les réservations par projet
  GET_BY_PROJECT: `
    SELECT
      er.*,
      e.name as equipment_name,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM equipment_reservations er
    JOIN equipment e ON er.equipment_id = e.id
    JOIN staff s ON er.staff_id = s.id
    WHERE er.project_id = $1
    ORDER BY er.start_date;
  `,

  // Récupérer les réservations par membre du personnel
  GET_BY_STAFF: `
    SELECT 
      er.*,
      e.name as equipment_name,
      p.name as project_name
    FROM equipment_reservations er
    JOIN equipment e ON er.equipment_id = e.id
    LEFT JOIN projects p ON er.project_id = p.id
    WHERE er.staff_id = $1
    ORDER BY er.start_date;
  `,

  // Récupérer les réservations pour une période donnée
  GET_BY_PERIOD: `
    SELECT 
      er.*,
      e.name as equipment_name,
      p.name as project_name,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM equipment_reservations er
    JOIN equipment e ON er.equipment_id = e.id
    LEFT JOIN projects p ON er.project_id = p.id
    JOIN staff s ON er.staff_id = s.id
    WHERE 
      (er.start_date BETWEEN $1 AND $2) OR
      (er.end_date BETWEEN $1 AND $2) OR
      (er.start_date <= $1 AND er.end_date >= $2)
    ORDER BY er.start_date;
  `,

  // Ajouter une réservation
  ADD: `
    INSERT INTO equipment_reservations (
      equipment_id,
      project_id,
      staff_id,
      start_date,
      end_date,
      notes
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id;
  `,

  // Mettre à jour le statut de l'équipement lors d'une réservation
  UPDATE_EQUIPMENT_STATUS: `
    UPDATE equipment
    SET 
      status = 'en_utilisation'::equipment_status,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND status = 'disponible'
    RETURNING id, status;
  `,
};

/**
 * Requêtes pour l'historique de maintenance
 */
export const MAINTENANCE_HISTORY_QUERIES = {
  // Ajouter une entrée de maintenance
  ADD: `
    INSERT INTO maintenance_history (
      equipment_id,
      maintenance_date,
      description,
      cost,
      performed_by,
      supplier_id,
      next_maintenance_date
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id;
  `,

  // Mettre à jour les dates de maintenance de l'équipement
  UPDATE_EQUIPMENT_MAINTENANCE_DATES: `
    UPDATE equipment
    SET 
      last_maintenance_date = $2,
      next_maintenance_date = $3,
      status = 'disponible'::equipment_status,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id, last_maintenance_date, next_maintenance_date, status;
  `,
};

/**
 * Requêtes pour les véhicules
 */
export const VEHICLE_QUERIES = {
  // Récupérer tous les véhicules
  GET_ALL: `
    SELECT * FROM vehicles
    ORDER BY type, brand, model;
  `,

  // Récupérer un véhicule par son ID
  GET_BY_ID: `
    SELECT * FROM vehicles
    WHERE id = $1;
  `,

  // Récupérer les véhicules par statut
  GET_BY_STATUS: `
    SELECT * FROM vehicles
    WHERE status = $1
    ORDER BY type, brand, model;
  `,

  // Récupérer les véhicules nécessitant une maintenance
  GET_MAINTENANCE_DUE: `
    SELECT
      *,
      next_maintenance_date - CURRENT_DATE as days_until_maintenance,
      next_maintenance_km - current_km as km_until_maintenance
    FROM vehicles
    WHERE 
      (next_maintenance_date IS NOT NULL AND next_maintenance_date <= CURRENT_DATE + INTERVAL '30 days') OR
      (next_maintenance_km IS NOT NULL AND next_maintenance_km - current_km <= 1000)
    ORDER BY 
      CASE 
        WHEN next_maintenance_date IS NULL THEN '9999-12-31'::date 
        ELSE next_maintenance_date 
      END;
  `,

  // Récupérer les réservations d'un véhicule
  GET_RESERVATIONS: `
    SELECT 
      vr.*,
      p.name as project_name,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM vehicle_reservations vr
    LEFT JOIN projects p ON vr.project_id = p.id
    JOIN staff s ON vr.staff_id = s.id
    WHERE vr.vehicle_id = $1
    ORDER BY vr.start_date;
  `,

  // Vérifier la disponibilité d'un véhicule pour une période donnée
  CHECK_AVAILABILITY: `
    SELECT
      v.id,
      v.brand,
      v.model,
      v.license_plate,
      v.status,
      (
        SELECT COUNT(*)
        FROM vehicle_reservations vr
        WHERE vr.vehicle_id = v.id
        AND (
          (vr.start_date <= $1 AND vr.end_date >= $1) OR
          (vr.start_date <= $2 AND vr.end_date >= $2) OR
          (vr.start_date >= $1 AND vr.end_date <= $2)
        )
      ) as reservation_count
    FROM vehicles v
    WHERE v.id = $3;
  `,

  // Ajouter un véhicule
  ADD: `
    INSERT INTO vehicles (
      type,
      brand,
      model,
      license_plate,
      year,
      purchase_date,
      purchase_price,
      status,
      current_km,
      last_maintenance_km,
      next_maintenance_km,
      last_maintenance_date,
      next_maintenance_date,
      notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING id;
  `,

  // Mettre à jour le kilométrage d'un véhicule
  UPDATE_KM: `
    UPDATE vehicles
    SET 
      current_km = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id, current_km;
  `,
};

/**
 * Requêtes pour les réservations de véhicules
 */
export const VEHICLE_RESERVATION_QUERIES = {
  // Récupérer toutes les réservations
  GET_ALL: `
    SELECT 
      vr.*,
      v.brand as vehicle_brand,
      v.model as vehicle_model,
      v.license_plate,
      p.name as project_name,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM vehicle_reservations vr
    JOIN vehicles v ON vr.vehicle_id = v.id
    LEFT JOIN projects p ON vr.project_id = p.id
    JOIN staff s ON vr.staff_id = s.id
    ORDER BY vr.start_date DESC;
  `,

  // Récupérer les réservations par projet
  GET_BY_PROJECT: `
    SELECT 
      vr.*,
      v.brand as vehicle_brand,
      v.model as vehicle_model,
      v.license_plate,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM vehicle_reservations vr
    JOIN vehicles v ON vr.vehicle_id = v.id
    JOIN staff s ON vr.staff_id = s.id
    WHERE vr.project_id = $1
    ORDER BY vr.start_date;
  `,

  // Récupérer les réservations par membre du personnel
  GET_BY_STAFF: `
    SELECT 
      vr.*,
      v.brand as vehicle_brand,
      v.model as vehicle_model,
      v.license_plate,
      p.name as project_name
    FROM vehicle_reservations vr
    JOIN vehicles v ON vr.vehicle_id = v.id
    LEFT JOIN projects p ON vr.project_id = p.id
    WHERE vr.staff_id = $1
    ORDER BY vr.start_date;
  `,

  // Ajouter une réservation
  ADD: `
    INSERT INTO vehicle_reservations (
      vehicle_id,
      staff_id,
      project_id,
      start_date,
      end_date,
      purpose,
      start_km
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id;
  `,

  // Terminer une réservation
  COMPLETE: `
    UPDATE vehicle_reservations
    SET 
      end_km = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id, vehicle_id, start_km, end_km;
  `,

  // Mettre à jour le statut du véhicule lors d'une réservation
  UPDATE_VEHICLE_STATUS: `
    UPDATE vehicles
    SET 
      status = $2::equipment_status,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id, status;
  `,
};

/**
 * Requêtes pour les paramètres système
 */
export const SYSTEM_SETTINGS_QUERIES = {
  // Récupérer tous les paramètres
  GET_ALL: `
    SELECT * FROM system_settings
    ORDER BY key;
  `,

  // Récupérer un paramètre par sa clé
  GET_BY_KEY: `
    SELECT * FROM system_settings
    WHERE key = $1;
  `,

  // Récupérer plusieurs paramètres par leurs clés
  GET_BY_KEYS: `
    SELECT * FROM system_settings
    WHERE key = ANY($1::varchar[]);
  `,

  // Mettre à jour un paramètre
  UPDATE: `
    UPDATE system_settings
    SET 
      value = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE key = $1 AND is_editable = true
    RETURNING key, value;
  `,

  // Ajouter un nouveau paramètre
  ADD: `
    INSERT INTO system_settings (
      key,
      value,
      description,
      is_editable
    ) VALUES ($1, $2, $3, $4)
    ON CONFLICT (key) 
    DO UPDATE SET 
      value = EXCLUDED.value,
      description = EXCLUDED.description,
      is_editable = EXCLUDED.is_editable,
      updated_at = CURRENT_TIMESTAMP
    RETURNING key, value;
  `,

  // Récupérer les informations de l'entreprise
  GET_COMPANY_INFO: `
    SELECT value FROM system_settings
    WHERE key = 'company_info';
  `,

  // Récupérer les paramètres de l'IA
  GET_AI_SETTINGS: `
    SELECT value FROM system_settings
    WHERE key = 'ai_settings';
  `,

  // Récupérer les paramètres de facturation
  GET_INVOICE_SETTINGS: `
    SELECT value FROM system_settings
    WHERE key = 'invoice_settings';
  `,

  // Récupérer les paramètres de devis
  GET_QUOTATION_SETTINGS: `
    SELECT value FROM system_settings
    WHERE key = 'quotation_settings';
  `,

  // Récupérer les paramètres de notification
  GET_NOTIFICATION_SETTINGS: `
    SELECT value FROM system_settings
    WHERE key = 'notification_settings';
  `,

  // Récupérer les paramètres de sécurité
  GET_SECURITY_SETTINGS: `
    SELECT value FROM system_settings
    WHERE key = 'security_settings';
  `,

  // Récupérer la version du système
  GET_SYSTEM_VERSION: `
    SELECT value FROM system_settings
    WHERE key = 'system_version';
  `,

  // Mettre à jour le numéro de facture suivant
  INCREMENT_INVOICE_NUMBER: `
    UPDATE system_settings
    SET value = jsonb_set(value, '{next_number}', to_jsonb((value->>'next_number')::int + 1))
    WHERE key = 'invoice_settings'
    RETURNING value->'next_number' as next_number;
  `,

  // Mettre à jour le numéro de devis suivant
  INCREMENT_QUOTATION_NUMBER: `
    UPDATE system_settings
    SET value = jsonb_set(value, '{next_number}', to_jsonb((value->>'next_number')::int + 1))
    WHERE key = 'quotation_settings'
    RETURNING value->'next_number' as next_number;
  `,
};

/**
 * Requêtes pour les tableaux de bord et rapports analytiques
 */
export const DASHBOARD_QUERIES = {
  // Récupérer le tableau de bord financier
  GET_FINANCIAL_DASHBOARD: `
    SELECT * FROM financial_dashboard;
  `,

  // Récupérer les factures en retard
  GET_OVERDUE_INVOICES: `
    SELECT * FROM overdue_invoices_report
    ORDER BY days_overdue DESC
    LIMIT $1 OFFSET $2;
  `,

  // Récupérer le nombre total de factures en retard
  COUNT_OVERDUE_INVOICES: `
    SELECT COUNT(*) FROM overdue_invoices_report;
  `,

  // Récupérer la rentabilité des projets
  GET_PROJECT_PROFITABILITY: `
    SELECT * FROM project_profitability_report
    ORDER BY $1 $2
    LIMIT $3 OFFSET $4;
  `,

  // Récupérer la rentabilité d'un projet spécifique
  GET_PROJECT_PROFITABILITY_BY_ID: `
    SELECT * FROM project_profitability_report
    WHERE project_id = $1;
  `,

  // Récupérer les paiements à venir
  GET_UPCOMING_PAYMENTS: `
    SELECT * FROM upcoming_payments_report
    ORDER BY days_until_due ASC
    LIMIT $1 OFFSET $2;
  `,

  // Récupérer le nombre total de paiements à venir
  COUNT_UPCOMING_PAYMENTS: `
    SELECT COUNT(*) FROM upcoming_payments_report;
  `,

  // Récupérer l'analyse des fournisseurs
  GET_SUPPLIER_ANALYSIS: `
    SELECT * FROM supplier_analysis_report
    ORDER BY $1 $2
    LIMIT $3 OFFSET $4;
  `,

  // Récupérer l'analyse d'un fournisseur spécifique
  GET_SUPPLIER_ANALYSIS_BY_ID: `
    SELECT * FROM supplier_analysis_report
    WHERE supplier_id = $1;
  `,

  // Rafraîchir toutes les vues matérialisées
  REFRESH_ALL_VIEWS: `
    SELECT refresh_all_materialized_views();
  `,

  // Récupérer les statistiques de chantier par mois
  GET_PROJECT_STATS_BY_MONTH: `
    SELECT
      TO_CHAR(start_date, 'YYYY-MM') as month,
      COUNT(*) as projects_count,
      COUNT(CASE WHEN status = 'en_cours' THEN 1 END) as active_projects,
      COUNT(CASE WHEN status = 'termine' THEN 1 END) as completed_projects,
      COALESCE(SUM((
        SELECT SUM(total_ht) FROM invoices WHERE project_id = projects.id
      )), 0) as total_invoiced
    FROM projects
    WHERE start_date >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY TO_CHAR(start_date, 'YYYY-MM')
    ORDER BY month DESC;
  `,

  // Récupérer les statistiques de facturation par mois
  GET_INVOICE_STATS_BY_MONTH: `
    SELECT
      TO_CHAR(issue_date, 'YYYY-MM') as month,
      COUNT(*) as invoices_count,
      COUNT(CASE WHEN status = 'payée' THEN 1 END) as paid_invoices,
      COUNT(CASE WHEN status = 'en_retard' THEN 1 END) as overdue_invoices,
      COALESCE(SUM(total_ttc), 0) as total_amount,
      COALESCE(SUM(CASE WHEN status = 'payée' THEN total_ttc ELSE 0 END), 0) as paid_amount
    FROM invoices
    WHERE issue_date >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY TO_CHAR(issue_date, 'YYYY-MM')
    ORDER BY month DESC;
  `,

  // Récupérer les statistiques de commandes fournisseurs par mois
  GET_SUPPLIER_ORDER_STATS_BY_MONTH: `
    SELECT
      TO_CHAR(order_date, 'YYYY-MM') as month,
      COUNT(*) as orders_count,
      COUNT(CASE WHEN status = 'livrée' THEN 1 END) as delivered_orders,
      COUNT(CASE WHEN status = 'en_retard' THEN 1 END) as late_orders,
      COALESCE(SUM(total_amount), 0) as total_amount
    FROM supplier_orders
    WHERE order_date >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY TO_CHAR(order_date, 'YYYY-MM')
    ORDER BY month DESC;
  `,

  // Récupérer les statistiques de trésorerie par mois
  GET_CASH_FLOW_BY_MONTH: `
    WITH payment_data AS (
      SELECT
        TO_CHAR(payment_date, 'YYYY-MM') as month,
        SUM(amount) as income
      FROM payments
      WHERE payment_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY TO_CHAR(payment_date, 'YYYY-MM')
    ),
    expense_data AS (
      SELECT
        TO_CHAR(expense_date, 'YYYY-MM') as month,
        SUM(amount) as expense
      FROM expenses
      WHERE expense_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY TO_CHAR(expense_date, 'YYYY-MM')
    ),
    supplier_payment_data AS (
      SELECT
        TO_CHAR(payment_date, 'YYYY-MM') as month,
        SUM(amount_paid) as supplier_expense
      FROM supplier_order_payments
      WHERE payment_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY TO_CHAR(payment_date, 'YYYY-MM')
    ),
    months AS (
      SELECT TO_CHAR(date_month, 'YYYY-MM') as month
      FROM generate_series(
        date_trunc('month', CURRENT_DATE - INTERVAL '11 months'),
        date_trunc('month', CURRENT_DATE),
        interval '1 month'
      ) as date_month
    )
    SELECT
      m.month,
      COALESCE(p.income, 0) as income,
      COALESCE(e.expense, 0) as internal_expenses,
      COALESCE(s.supplier_expense, 0) as supplier_expenses,
      COALESCE(p.income, 0) - COALESCE(e.expense, 0) - COALESCE(s.supplier_expense, 0) as net_cash_flow
    FROM months m
    LEFT JOIN payment_data p ON m.month = p.month
    LEFT JOIN expense_data e ON m.month = e.month
    LEFT JOIN supplier_payment_data s ON m.month = s.month
    ORDER BY m.month DESC;
  `,

  // Récupérer les projets avec des retards de paiement importants
  GET_PROJECTS_WITH_PAYMENT_ISSUES: `
    SELECT
      p.id as project_id,
      p.name as project_name,
      p.status,
      CONCAT(c.firstname, ' ', c.lastname) as client_name,
      COUNT(i.id) as total_invoices,
      COUNT(CASE WHEN i.status = 'en_retard' THEN 1 END) as overdue_invoices,
      COALESCE(SUM(i.total_ttc), 0) as total_invoiced,
      COALESCE(SUM(CASE WHEN i.status = 'en_retard' THEN i.total_ttc ELSE 0 END), 0) as total_overdue,
      MAX(CURRENT_DATE - i.due_date) as max_days_overdue
    FROM projects p
    JOIN clients c ON p.client_id = c.id
    JOIN invoices i ON p.id = i.project_id
    GROUP BY p.id, p.name, p.status, client_name
    HAVING COUNT(CASE WHEN i.status = 'en_retard' THEN 1 END) > 0
    ORDER BY max_days_overdue DESC;
  `,

  // Récupérer les clients avec historique de paiement
  GET_CLIENTS_PAYMENT_HISTORY: `
    SELECT
      c.id as client_id,
      CONCAT(c.firstname, ' ', c.lastname) as client_name,
      COUNT(DISTINCT p.id) as projects_count,
      COUNT(i.id) as invoices_count,
      COALESCE(SUM(i.total_ttc), 0) as total_invoiced,
      COALESCE(SUM(CASE WHEN i.status = 'payée' THEN i.total_ttc ELSE 0 END), 0) as total_paid,
      COALESCE(SUM(CASE WHEN i.status = 'en_retard' THEN i.total_ttc ELSE 0 END), 0) as total_overdue,
      COUNT(CASE WHEN i.status = 'en_retard' THEN 1 END) as overdue_invoices_count,
      AVG(CASE WHEN i.status = 'payée' THEN payment.payment_date - i.due_date ELSE NULL END) as avg_days_to_payment
    FROM clients c
    JOIN projects p ON c.id = p.client_id
    JOIN invoices i ON p.id = i.project_id
    LEFT JOIN LATERAL (
      SELECT MIN(payment_date) as payment_date
      FROM payments
      WHERE invoice_id = i.id
    ) payment ON i.status = 'payée'
    GROUP BY c.id, client_name
    ORDER BY total_invoiced DESC;
  `,

  // Récupérer les fournisseurs avec des retards de livraison
  GET_SUPPLIERS_WITH_DELIVERY_ISSUES: `
    SELECT
      s.id as supplier_id,
      s.name as supplier_name,
      COUNT(so.id) as total_orders,
      COUNT(CASE WHEN so.status = 'en_retard' THEN 1 END) as late_orders,
      COALESCE(SUM(so.total_amount), 0) as total_ordered,
      COALESCE(SUM(CASE WHEN so.status = 'en_retard' THEN so.total_amount ELSE 0 END), 0) as late_orders_amount,
      MAX(CASE WHEN so.actual_delivery_date IS NOT NULL AND so.expected_delivery_date IS NOT NULL 
          THEN so.actual_delivery_date - so.expected_delivery_date 
          ELSE NULL END) as max_days_late,
      AVG(CASE WHEN so.actual_delivery_date IS NOT NULL AND so.expected_delivery_date IS NOT NULL 
          THEN so.actual_delivery_date - so.expected_delivery_date 
          ELSE NULL END) as avg_days_late
    FROM suppliers s
    JOIN supplier_orders so ON s.id = so.supplier_id
    GROUP BY s.id, s.name
    HAVING COUNT(CASE WHEN so.status = 'en_retard' THEN 1 END) > 0
    ORDER BY max_days_late DESC;
  `,
};
