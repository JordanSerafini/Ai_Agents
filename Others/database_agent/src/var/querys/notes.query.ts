/**
 * Requêtes pour les notes et tags
 */
export const NOTES_QUERIES = {
  // Récupérer toutes les notes
  GET_ALL: `
    SELECT 
      n.*,
      CONCAT(s.firstname, ' ', s.lastname) as created_by_name
    FROM notes n
    LEFT JOIN staff s ON n.created_by = s.id
    ORDER BY n.created_at DESC;
  `,

  // Récupérer une note par son ID
  GET_BY_ID: `
    SELECT 
      n.*,
      CONCAT(s.firstname, ' ', s.lastname) as created_by_name
    FROM notes n
    LEFT JOIN staff s ON n.created_by = s.id
    WHERE n.id = $1;
  `,

  // Récupérer les notes par entité
  GET_BY_ENTITY: `
    SELECT 
      n.*,
      CONCAT(s.firstname, ' ', s.lastname) as created_by_name
    FROM notes n
    LEFT JOIN staff s ON n.created_by = s.id
    WHERE n.entity_type = $1 AND n.entity_id = $2
    ORDER BY n.created_at DESC;
  `,

  // Ajouter une note
  ADD: `
    INSERT INTO notes (
      entity_type, entity_id, content, created_by
    )
    VALUES ($1, $2, $3, $4)
    RETURNING id;
  `,

  // Mettre à jour une note
  UPDATE: `
    UPDATE notes
    SET content = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id;
  `,

  // Supprimer une note
  DELETE: `
    DELETE FROM notes
    WHERE id = $1
    RETURNING id;
  `,
};

/**
 * Requêtes pour les tags
 */
export const TAGS_QUERIES = {
  // Récupérer tous les tags
  GET_ALL: `
    SELECT * FROM tags
    ORDER BY name;
  `,

  // Récupérer un tag par son ID
  GET_BY_ID: `
    SELECT * FROM tags
    WHERE id = $1;
  `,

  // Rechercher des tags par nom
  SEARCH: `
    SELECT * FROM tags
    WHERE name ILIKE $1
    ORDER BY name;
  `,

  // Ajouter un tag
  ADD: `
    INSERT INTO tags (name, color)
    VALUES ($1, $2)
    RETURNING id;
  `,

  // Mettre à jour un tag
  UPDATE: `
    UPDATE tags
    SET name = $2, color = $3
    WHERE id = $1
    RETURNING id;
  `,

  // Supprimer un tag
  DELETE: `
    DELETE FROM tags
    WHERE id = $1
    RETURNING id;
  `,

  // Récupérer les tags d'une entité
  GET_ENTITY_TAGS: `
    SELECT t.* 
    FROM tags t
    JOIN entity_tags et ON t.id = et.tag_id
    WHERE et.entity_type = $1 AND et.entity_id = $2
    ORDER BY t.name;
  `,

  // Ajouter un tag à une entité
  ADD_TAG_TO_ENTITY: `
    INSERT INTO entity_tags (entity_type, entity_id, tag_id)
    VALUES ($1, $2, $3)
    ON CONFLICT (entity_type, entity_id, tag_id) DO NOTHING
    RETURNING entity_type, entity_id, tag_id;
  `,

  // Supprimer un tag d'une entité
  REMOVE_TAG_FROM_ENTITY: `
    DELETE FROM entity_tags
    WHERE entity_type = $1 AND entity_id = $2 AND tag_id = $3
    RETURNING entity_type, entity_id, tag_id;
  `,

  // Récupérer les entités par tag
  GET_ENTITIES_BY_TAG: `
    SELECT entity_type, entity_id
    FROM entity_tags
    WHERE tag_id = $1
    ORDER BY entity_type, entity_id;
  `,
};
