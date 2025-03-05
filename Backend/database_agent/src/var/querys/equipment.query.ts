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

  // Rechercher des équipements par nom ou référence
  SEARCH: `
    SELECT 
      e.*,
      ec.name as category_name,
      s.name as supplier_name
    FROM equipment e
    LEFT JOIN equipment_categories ec ON e.category_id = ec.id
    LEFT JOIN suppliers s ON e.supplier_id = s.id
    WHERE e.name ILIKE $1 OR e.reference ILIKE $1
    ORDER BY e.name;
  `,

  // Récupérer les équipements par catégorie
  GET_BY_CATEGORY: `
    SELECT 
      e.*,
      ec.name as category_name,
      s.name as supplier_name
    FROM equipment e
    LEFT JOIN equipment_categories ec ON e.category_id = ec.id
    LEFT JOIN suppliers s ON e.supplier_id = s.id
    WHERE e.category_id = $1
    ORDER BY e.name;
  `,

  // Récupérer les équipements disponibles
  GET_AVAILABLE: `
    SELECT 
      e.*,
      ec.name as category_name,
      s.name as supplier_name
    FROM equipment e
    LEFT JOIN equipment_categories ec ON e.category_id = ec.id
    LEFT JOIN suppliers s ON e.supplier_id = s.id
    WHERE e.status = 'disponible'
    ORDER BY e.name;
  `,

  // Créer un nouvel équipement
  CREATE: `
    INSERT INTO equipment (
      name, reference, category_id, supplier_id, purchase_date, 
      purchase_price, status, location, maintenance_interval, 
      last_maintenance_date, next_maintenance_date, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id;
  `,

  // Mettre à jour un équipement
  UPDATE: `
    UPDATE equipment
    SET 
      name = $2,
      reference = $3,
      category_id = $4,
      supplier_id = $5,
      purchase_date = $6,
      purchase_price = $7,
      status = $8,
      location = $9,
      maintenance_interval = $10,
      last_maintenance_date = $11,
      next_maintenance_date = $12,
      notes = $13,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id;
  `,

  // Mettre à jour le statut d'un équipement
  UPDATE_STATUS: `
    UPDATE equipment
    SET status = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id, status;
  `,

  // Récupérer toutes les catégories d'équipement
  GET_ALL_CATEGORIES: `
    SELECT * FROM equipment_categories
    ORDER BY name;
  `,

  // Créer une nouvelle catégorie d'équipement
  CREATE_CATEGORY: `
    INSERT INTO equipment_categories (name, description)
    VALUES ($1, $2)
    RETURNING id;
  `,

  // Récupérer les réservations d'équipement
  GET_RESERVATIONS: `
    SELECT 
      er.*,
      e.name as equipment_name,
      p.name as project_name,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM equipment_reservations er
    JOIN equipment e ON er.equipment_id = e.id
    LEFT JOIN projects p ON er.project_id = p.id
    LEFT JOIN staff s ON er.staff_id = s.id
    ORDER BY er.start_date DESC;
  `,

  // Récupérer les réservations d'un équipement spécifique
  GET_EQUIPMENT_RESERVATIONS: `
    SELECT 
      er.*,
      p.name as project_name,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM equipment_reservations er
    LEFT JOIN projects p ON er.project_id = p.id
    LEFT JOIN staff s ON er.staff_id = s.id
    WHERE er.equipment_id = $1
    ORDER BY er.start_date DESC;
  `,

  // Récupérer les réservations d'équipement pour un projet
  GET_PROJECT_RESERVATIONS: `
    SELECT 
      er.*,
      e.name as equipment_name,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM equipment_reservations er
    JOIN equipment e ON er.equipment_id = e.id
    LEFT JOIN staff s ON er.staff_id = s.id
    WHERE er.project_id = $1
    ORDER BY er.start_date DESC;
  `,

  // Créer une réservation d'équipement
  CREATE_RESERVATION: `
    INSERT INTO equipment_reservations (
      equipment_id, project_id, staff_id, start_date, end_date, 
      status, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id;
  `,

  // Mettre à jour une réservation d'équipement
  UPDATE_RESERVATION: `
    UPDATE equipment_reservations
    SET 
      equipment_id = $2,
      project_id = $3,
      staff_id = $4,
      start_date = $5,
      end_date = $6,
      status = $7,
      notes = $8,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id;
  `,

  // Annuler une réservation d'équipement
  CANCEL_RESERVATION: `
    UPDATE equipment_reservations
    SET status = 'annulée', updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id;
  `,

  // Récupérer les maintenances d'équipement
  GET_MAINTENANCE_RECORDS: `
    SELECT 
      m.*,
      e.name as equipment_name,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM maintenance_records m
    JOIN equipment e ON m.equipment_id = e.id
    LEFT JOIN staff s ON m.performed_by = s.id
    ORDER BY m.maintenance_date DESC;
  `,

  // Récupérer les maintenances d'un équipement spécifique
  GET_EQUIPMENT_MAINTENANCE: `
    SELECT 
      m.*,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM maintenance_records m
    LEFT JOIN staff s ON m.performed_by = s.id
    WHERE m.equipment_id = $1
    ORDER BY m.maintenance_date DESC;
  `,

  // Ajouter un enregistrement de maintenance
  ADD_MAINTENANCE_RECORD: `
    INSERT INTO maintenance_records (
      equipment_id, maintenance_date, maintenance_type, 
      description, cost, performed_by, next_maintenance_date, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id;
  `,

  // Récupérer les équipements nécessitant une maintenance
  GET_EQUIPMENT_NEEDING_MAINTENANCE: `
    SELECT 
      e.*,
      ec.name as category_name,
      s.name as supplier_name,
      CURRENT_DATE - e.next_maintenance_date as days_overdue
    FROM equipment e
    LEFT JOIN equipment_categories ec ON e.category_id = ec.id
    LEFT JOIN suppliers s ON e.supplier_id = s.id
    WHERE e.next_maintenance_date <= CURRENT_DATE + INTERVAL '30 days'
    ORDER BY e.next_maintenance_date ASC;
  `,

  // Récupérer les véhicules
  GET_ALL_VEHICLES: `
    SELECT 
      v.*,
      vc.name as category_name
    FROM vehicles v
    LEFT JOIN vehicle_categories vc ON v.category_id = vc.id
    ORDER BY v.name;
  `,

  // Récupérer un véhicule par son ID
  GET_VEHICLE_BY_ID: `
    SELECT 
      v.*,
      vc.name as category_name
    FROM vehicles v
    LEFT JOIN vehicle_categories vc ON v.category_id = vc.id
    WHERE v.id = $1;
  `,

  // Récupérer les réservations de véhicules
  GET_VEHICLE_RESERVATIONS: `
    SELECT 
      vr.*,
      v.name as vehicle_name,
      v.registration_number,
      p.name as project_name,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM vehicle_reservations vr
    JOIN vehicles v ON vr.vehicle_id = v.id
    LEFT JOIN projects p ON vr.project_id = p.id
    LEFT JOIN staff s ON vr.staff_id = s.id
    ORDER BY vr.start_date DESC;
  `,

  // Créer une réservation de véhicule
  CREATE_VEHICLE_RESERVATION: `
    INSERT INTO vehicle_reservations (
      vehicle_id, project_id, staff_id, start_date, end_date, 
      start_mileage, end_mileage, fuel_level_start, fuel_level_end,
      status, destination, purpose, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING id;
  `,
};
