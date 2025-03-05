/**
 * Requêtes pour l'assistant IA
 */
export const AI_QUERIES = {
  // Enregistrer une interaction avec l'IA
  LOG_INTERACTION: `
    INSERT INTO ai_interactions (
      staff_id, query, response, context
    )
    VALUES ($1, $2, $3, $4)
    RETURNING id;
  `,

  // Récupérer l'activité récente de l'IA
  GET_ACTIVITY: `
    SELECT 
      ai.id,
      ai.query,
      ai.response,
      ai.created_at,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM ai_interactions ai
    LEFT JOIN staff s ON ai.staff_id = s.id
    ORDER BY ai.created_at DESC
    LIMIT $1;
  `,

  // Mettre à jour le feedback d'une interaction
  UPDATE_FEEDBACK: `
    UPDATE ai_interactions
    SET feedback = $2
    WHERE id = $1
    RETURNING id, feedback;
  `,

  // Récupérer les interactions récentes d'un utilisateur
  GET_USER_RECENT_INTERACTIONS: `
    SELECT * FROM ai_interactions
    WHERE staff_id = $1
    ORDER BY created_at DESC
    LIMIT $2;
  `,

  // Récupérer une interaction spécifique
  GET_INTERACTION_BY_ID: `
    SELECT * FROM ai_interactions
    WHERE id = $1;
  `,

  // Rechercher dans les interactions par texte
  SEARCH_INTERACTIONS: `
    SELECT * FROM ai_interactions
    WHERE query ILIKE $1 OR response ILIKE $1
    ORDER BY created_at DESC
    LIMIT $2;
  `,

  // Ajouter une suggestion de l'IA
  ADD_SUGGESTION: `
    INSERT INTO ai_suggestions (
      entity_type, entity_id, suggestion, context, is_applied
    )
    VALUES ($1, $2, $3, $4, false)
    RETURNING id;
  `,

  // Marquer une suggestion comme appliquée
  MARK_SUGGESTION_APPLIED: `
    UPDATE ai_suggestions
    SET is_applied = true, applied_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id;
  `,

  // Récupérer les suggestions pour une entité
  GET_ENTITY_SUGGESTIONS: `
    SELECT * FROM ai_suggestions
    WHERE entity_type = $1 AND entity_id = $2
    ORDER BY created_at DESC;
  `,

  // Récupérer les suggestions non appliquées
  GET_PENDING_SUGGESTIONS: `
    SELECT * FROM ai_suggestions
    WHERE is_applied = false
    ORDER BY created_at DESC;
  `,

  // Ajouter un document pour l'embedding
  ADD_DOCUMENT_EMBEDDING: `
    INSERT INTO document_embeddings (
      document_type, document_id, content, metadata, embedding
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id;
  `,

  // Mettre à jour un document embedding
  UPDATE_DOCUMENT_EMBEDDING: `
    UPDATE document_embeddings
    SET 
      content = $3,
      metadata = $4,
      embedding = $5,
      updated_at = CURRENT_TIMESTAMP
    WHERE document_type = $1 AND document_id = $2
    RETURNING id;
  `,

  // Supprimer un document embedding
  DELETE_DOCUMENT_EMBEDDING: `
    DELETE FROM document_embeddings
    WHERE document_type = $1 AND document_id = $2
    RETURNING id;
  `,

  // Recherche sémantique dans les documents
  SEMANTIC_SEARCH: `
    SELECT 
      id,
      document_type,
      document_id,
      content,
      metadata,
      1 - (embedding <=> $1) as similarity
    FROM document_embeddings
    WHERE 1 - (embedding <=> $1) > $2
    ORDER BY similarity DESC
    LIMIT $3;
  `,

  // Recherche sémantique filtrée par type de document
  SEMANTIC_SEARCH_BY_TYPE: `
    SELECT 
      id,
      document_type,
      document_id,
      content,
      metadata,
      1 - (embedding <=> $1) as similarity
    FROM document_embeddings
    WHERE document_type = $2 AND 1 - (embedding <=> $1) > $3
    ORDER BY similarity DESC
    LIMIT $4;
  `,

  // Récupérer les statistiques d'utilisation de l'IA
  GET_AI_USAGE_STATS: `
    SELECT 
      COUNT(*) as total_interactions,
      COUNT(DISTINCT staff_id) as unique_users,
      AVG(CASE WHEN feedback IS NOT NULL THEN feedback ELSE NULL END) as avg_feedback,
      COUNT(CASE WHEN feedback > 0 THEN 1 END) as positive_feedback_count,
      COUNT(CASE WHEN feedback < 0 THEN 1 END) as negative_feedback_count,
      COUNT(CASE WHEN feedback = 0 THEN 1 END) as neutral_feedback_count
    FROM ai_interactions
    WHERE created_at >= CURRENT_DATE - INTERVAL $1;
  `,

  // Récupérer les statistiques d'utilisation par jour
  GET_AI_USAGE_BY_DAY: `
    SELECT 
      DATE_TRUNC('day', created_at) as date,
      COUNT(*) as interactions_count,
      COUNT(DISTINCT staff_id) as unique_users,
      AVG(CASE WHEN feedback IS NOT NULL THEN feedback ELSE NULL END) as avg_feedback
    FROM ai_interactions
    WHERE created_at >= CURRENT_DATE - INTERVAL $1
    GROUP BY DATE_TRUNC('day', created_at)
    ORDER BY date DESC;
  `,

  // Récupérer les utilisateurs les plus actifs
  GET_MOST_ACTIVE_USERS: `
    SELECT 
      s.id,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name,
      COUNT(ai.id) as interactions_count,
      AVG(CASE WHEN ai.feedback IS NOT NULL THEN ai.feedback ELSE NULL END) as avg_feedback
    FROM ai_interactions ai
    JOIN staff s ON ai.staff_id = s.id
    WHERE ai.created_at >= CURRENT_DATE - INTERVAL $1
    GROUP BY s.id, staff_name
    ORDER BY interactions_count DESC
    LIMIT $2;
  `,

  // Nettoyer les anciens embeddings
  CLEAN_OLD_EMBEDDINGS: `
    SELECT clean_old_embeddings();
  `,

  // Recherche sémantique dans les projets (de AI_ASSISTANT_QUERIES)
  SEMANTIC_SEARCH_PROJECTS: `
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

  // Récupérer un résumé complet d'un projet pour l'IA (de AI_ASSISTANT_QUERIES)
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

  // Recherche contextuelle pour l'IA (de AI_ASSISTANT_QUERIES)
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

  // Statistiques globales pour le tableau de bord IA (de AI_ASSISTANT_QUERIES)
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

  // Prédiction de charge de travail pour la planification (de AI_ASSISTANT_QUERIES)
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

  // Recherche de projets similaires pour recommandations (de AI_ASSISTANT_QUERIES)
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

  // Récupérer les dernières interactions (de AI_INTERACTION_QUERIES)
  GET_RECENT_INTERACTIONS: `
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

  // Récupérer les interactions par utilisateur (de AI_INTERACTION_QUERIES)
  GET_INTERACTIONS_BY_STAFF: `
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

  // Récupérer les requêtes fréquentes pour l'analyse (de AI_INTERACTION_QUERIES)
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

  // Récupérer les suggestions en attente (de AI_SUGGESTION_QUERIES)
  GET_PENDING_AI_SUGGESTIONS: `
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

  // Récupérer les suggestions par entité (de AI_SUGGESTION_QUERIES)
  GET_AI_SUGGESTIONS_BY_ENTITY: `
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

  // Mettre à jour le statut d'une suggestion (de AI_SUGGESTION_QUERIES)
  UPDATE_AI_SUGGESTION_STATUS: `
    UPDATE ai_suggestions
    SET status = $2, staff_id = $3, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id;
  `,
};
