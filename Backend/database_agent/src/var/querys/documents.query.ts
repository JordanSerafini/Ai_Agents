/**
 * Requêtes pour les documents
 */
export const DOCUMENTS_QUERIES = {
  // Récupérer tous les documents
  GET_ALL: `
    SELECT 
      d.*,
      CONCAT(s.firstname, ' ', s.lastname) as uploaded_by_name
    FROM documents d
    LEFT JOIN staff s ON d.uploaded_by = s.id
    ORDER BY d.upload_date DESC;
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

  // Récupérer les documents par entité
  GET_BY_ENTITY: `
    SELECT 
      d.*,
      CONCAT(s.firstname, ' ', s.lastname) as uploaded_by_name
    FROM documents d
    LEFT JOIN staff s ON d.uploaded_by = s.id
    WHERE d.entity_type = $1 AND d.entity_id = $2
    ORDER BY d.upload_date DESC;
  `,

  // Récupérer les documents par type
  GET_BY_TYPE: `
    SELECT 
      d.*,
      CONCAT(s.firstname, ' ', s.lastname) as uploaded_by_name
    FROM documents d
    LEFT JOIN staff s ON d.uploaded_by = s.id
    WHERE d.document_type = $1
    ORDER BY d.upload_date DESC;
  `,

  // Ajouter un document
  ADD: `
    INSERT INTO documents (
      entity_type, entity_id, document_type, filename, file_path, 
      file_size, mime_type, description, uploaded_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id;
  `,

  // Mettre à jour un document
  UPDATE: `
    UPDATE documents
    SET 
      document_type = $2,
      description = $3,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id;
  `,

  // Supprimer un document
  DELETE: `
    DELETE FROM documents
    WHERE id = $1
    RETURNING id;
  `,

  // Rechercher des documents
  SEARCH: `
    SELECT 
      d.*,
      CONCAT(s.firstname, ' ', s.lastname) as uploaded_by_name
    FROM documents d
    LEFT JOIN staff s ON d.uploaded_by = s.id
    WHERE 
      d.filename ILIKE $1 OR 
      d.description ILIKE $1 OR
      d.document_type ILIKE $1
    ORDER BY d.upload_date DESC;
  `,

  // Récupérer les documents récents
  GET_RECENT: `
    SELECT 
      d.*,
      CONCAT(s.firstname, ' ', s.lastname) as uploaded_by_name
    FROM documents d
    LEFT JOIN staff s ON d.uploaded_by = s.id
    ORDER BY d.upload_date DESC
    LIMIT $1;
  `,

  // Récupérer les documents par utilisateur
  GET_BY_USER: `
    SELECT 
      d.*
    FROM documents d
    WHERE d.uploaded_by = $1
    ORDER BY d.upload_date DESC;
  `,

  // Récupérer les statistiques des documents
  GET_STATS: `
    SELECT 
      COUNT(*) as total_documents,
      SUM(file_size) as total_size,
      COUNT(DISTINCT entity_id) as total_entities,
      COUNT(DISTINCT document_type) as document_types_count
    FROM documents;
  `,

  // Récupérer les statistiques des documents par type
  GET_STATS_BY_TYPE: `
    SELECT 
      document_type,
      COUNT(*) as document_count,
      SUM(file_size) as total_size
    FROM documents
    GROUP BY document_type
    ORDER BY document_count DESC;
  `,
};
