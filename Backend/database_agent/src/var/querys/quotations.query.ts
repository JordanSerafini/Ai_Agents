/**
 * Requêtes pour les devis (quotations)
 */
export const QUOTATIONS_QUERIES = {
  // Récupérer tous les devis
  GET_ALL: `
    SELECT q.*, p.name as project_name, c.name as client_name
    FROM quotations q
    JOIN projects p ON q.project_id = p.id
    JOIN clients c ON p.client_id = c.id
    ORDER BY q.created_date DESC;
  `,

  // Récupérer un devis par son ID
  GET_BY_ID: `
    SELECT q.*, p.name as project_name, c.name as client_name
    FROM quotations q
    JOIN projects p ON q.project_id = p.id
    JOIN clients c ON p.client_id = c.id
    WHERE q.id = $1;
  `,

  // Récupérer les devis d'un projet
  GET_BY_PROJECT: `
    SELECT q.*, p.name as project_name
    FROM quotations q
    JOIN projects p ON q.project_id = p.id
    WHERE q.project_id = $1
    ORDER BY q.created_date DESC;
  `,

  // Récupérer les devis d'un client
  GET_BY_CLIENT: `
    SELECT q.*, p.name as project_name, c.name as client_name
    FROM quotations q
    JOIN projects p ON q.project_id = p.id
    JOIN clients c ON p.client_id = c.id
    WHERE c.id = $1
    ORDER BY q.created_date DESC;
  `,

  // Récupérer les devis par statut
  GET_BY_STATUS: `
    SELECT q.*, p.name as project_name, c.name as client_name
    FROM quotations q
    JOIN projects p ON q.project_id = p.id
    JOIN clients c ON p.client_id = c.id
    WHERE q.status = $1
    ORDER BY q.created_date DESC;
  `,

  // Récupérer les devis en attente
  GET_PENDING: `
    SELECT q.*, p.name as project_name, c.name as client_name
    FROM quotations q
    JOIN projects p ON q.project_id = p.id
    JOIN clients c ON p.client_id = c.id
    WHERE q.status = 'en_attente'
    ORDER BY q.created_date DESC;
  `,

  // Récupérer les devis acceptés
  GET_ACCEPTED: `
    SELECT q.*, p.name as project_name, c.name as client_name
    FROM quotations q
    JOIN projects p ON q.project_id = p.id
    JOIN clients c ON p.client_id = c.id
    WHERE q.status = 'accepté'
    ORDER BY q.created_date DESC;
  `,

  // Récupérer les devis refusés
  GET_REJECTED: `
    SELECT q.*, p.name as project_name, c.name as client_name
    FROM quotations q
    JOIN projects p ON q.project_id = p.id
    JOIN clients c ON p.client_id = c.id
    WHERE q.status = 'refusé'
    ORDER BY q.created_date DESC;
  `,

  // Récupérer les devis expirés
  GET_EXPIRED: `
    SELECT q.*, p.name as project_name, c.name as client_name
    FROM quotations q
    JOIN projects p ON q.project_id = p.id
    JOIN clients c ON p.client_id = c.id
    WHERE q.status = 'en_attente' AND q.validity_date < CURRENT_DATE
    ORDER BY q.created_date DESC;
  `,

  // Récupérer les produits d'un devis
  GET_PRODUCTS: `
    SELECT qp.*, q.reference as quotation_reference
    FROM quotation_products qp
    JOIN quotations q ON qp.quotation_id = q.id
    WHERE qp.quotation_id = $1
    ORDER BY qp.id;
  `,

  // Créer un nouveau devis
  CREATE: `
    INSERT INTO quotations (
      project_id, created_date, total, status, validity_date, 
      reference, tva_rate, payment_conditions, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *;
  `,

  // Mettre à jour un devis
  UPDATE: `
    UPDATE quotations
    SET 
      project_id = $2,
      created_date = $3,
      total = $4,
      status = $5,
      validity_date = $6,
      reference = $7,
      tva_rate = $8,
      payment_conditions = $9,
      notes = $10,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *;
  `,

  // Supprimer un devis
  DELETE: `
    DELETE FROM quotations
    WHERE id = $1
    RETURNING id;
  `,

  // Rechercher des devis par référence ou notes
  SEARCH: `
    SELECT q.*, p.name as project_name, c.name as client_name
    FROM quotations q
    JOIN projects p ON q.project_id = p.id
    JOIN clients c ON p.client_id = c.id
    WHERE 
      q.reference ILIKE $1 OR
      q.notes ILIKE $1
    ORDER BY q.created_date DESC;
  `,

  // Statistiques de conversion des devis
  CONVERSION_STATS: `
    SELECT
      COUNT(*) as total_quotations,
      COUNT(CASE WHEN status = 'accepté' THEN 1 END) as accepted_quotations,
      COUNT(CASE WHEN status = 'refusé' THEN 1 END) as rejected_quotations,
      COUNT(CASE WHEN status = 'en_attente' AND validity_date >= CURRENT_DATE THEN 1 END) as pending_quotations,
      COUNT(CASE WHEN status = 'en_attente' AND validity_date < CURRENT_DATE THEN 1 END) as expired_quotations,
      ROUND(
        (COUNT(CASE WHEN status = 'accepté' THEN 1 END)::numeric / 
        NULLIF(COUNT(*), 0)::numeric) * 100, 
        2
      ) as conversion_rate
    FROM quotations
    WHERE created_date >= CURRENT_DATE - INTERVAL '1 year';
  `,

  // Récupérer le montant total des devis acceptés pour le mois prochain
  GET_ACCEPTED_NEXT_MONTH_TOTAL: `
    SELECT SUM(q.total) as total_amount
    FROM quotations q
    WHERE q.status = 'accepté'
    AND q.created_date BETWEEN 
      DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month') 
      AND 
      (DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month') + INTERVAL '1 month - 1 day')
  `,

  // Requête modulable pour filtrer les devis par statut et période
  GET_FILTERED_QUOTATIONS: `
    SELECT q.*, p.name as project_name, c.name as client_name
    FROM quotations q
    JOIN projects p ON q.project_id = p.id
    JOIN clients c ON p.client_id = c.id
    WHERE 
      ($1::text IS NULL OR q.status::text = $1::text)
      AND q.created_date BETWEEN $2::date AND $3::date
    ORDER BY q.created_date DESC
  `,

  // Requête modulable pour obtenir le montant total des devis filtrés par statut et période
  GET_FILTERED_QUOTATIONS_TOTAL: `
    SELECT SUM(q.total) as total_amount
    FROM quotations q
    WHERE 
      ($1::text IS NULL OR q.status::text = $1::text)
      AND q.created_date BETWEEN $2::date AND $3::date
  `,
};
