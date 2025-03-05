/**
 * Requêtes pour la gestion financière
 */
export const FINANCIAL_QUERIES = {
  // Récupérer toutes les factures
  GET_ALL_INVOICES: `
    SELECT 
      i.*,
      p.name as project_name,
      CONCAT(c.firstname, ' ', c.lastname) as client_name
    FROM invoices i
    JOIN projects p ON i.project_id = p.id
    JOIN clients c ON p.client_id = c.id
    ORDER BY i.issue_date DESC;
  `,

  // Récupérer une facture par son ID
  GET_INVOICE_BY_ID: `
    SELECT 
      i.*,
      p.name as project_name,
      CONCAT(c.firstname, ' ', c.lastname) as client_name
    FROM invoices i
    JOIN projects p ON i.project_id = p.id
    JOIN clients c ON p.client_id = c.id
    WHERE i.id = $1;
  `,

  // Récupérer les éléments d'une facture
  GET_INVOICE_ITEMS: `
    SELECT * FROM invoice_items
    WHERE invoice_id = $1
    ORDER BY id;
  `,

  // Récupérer les factures d'un projet
  GET_PROJECT_INVOICES: `
    SELECT 
      i.*,
      p.name as project_name,
      CONCAT(c.firstname, ' ', c.lastname) as client_name
    FROM invoices i
    JOIN projects p ON i.project_id = p.id
    JOIN clients c ON p.client_id = c.id
    WHERE i.project_id = $1
    ORDER BY i.issue_date DESC;
  `,

  // Récupérer les factures en retard
  GET_OVERDUE_INVOICES: `
    SELECT 
      i.*,
      p.name as project_name,
      CONCAT(c.firstname, ' ', c.lastname) as client_name,
      CURRENT_DATE - i.due_date as days_overdue
    FROM invoices i
    JOIN projects p ON i.project_id = p.id
    JOIN clients c ON p.client_id = c.id
    WHERE i.status NOT IN ('payée', 'annulée') 
      AND i.due_date < CURRENT_DATE
    ORDER BY days_overdue DESC;
  `,

  // Créer une nouvelle facture
  CREATE_INVOICE: `
    INSERT INTO invoices (
      project_id, reference, issue_date, due_date, 
      total_ht, tva_rate, total_ttc, status, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id;
  `,

  // Ajouter un élément à une facture
  ADD_INVOICE_ITEM: `
    INSERT INTO invoice_items (
      invoice_id, description, quantity, unit_price, total_price
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id;
  `,

  // Mettre à jour le statut d'une facture
  UPDATE_INVOICE_STATUS: `
    UPDATE invoices
    SET status = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id, status;
  `,

  // Récupérer tous les paiements
  GET_ALL_PAYMENTS: `
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
  GET_INVOICE_PAYMENTS: `
    SELECT * FROM payments
    WHERE invoice_id = $1
    ORDER BY payment_date DESC;
  `,

  // Ajouter un paiement
  ADD_PAYMENT: `
    INSERT INTO payments (
      invoice_id, amount, payment_date, payment_method, reference, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id;
  `,

  // Récupérer toutes les dépenses
  GET_ALL_EXPENSES: `
    SELECT 
      e.*,
      p.name as project_name,
      c.name as category_name
    FROM expenses e
    LEFT JOIN projects p ON e.project_id = p.id
    LEFT JOIN expense_categories c ON e.category_id = c.id
    ORDER BY e.expense_date DESC;
  `,

  // Récupérer les dépenses d'un projet
  GET_PROJECT_EXPENSES: `
    SELECT 
      e.*,
      c.name as category_name
    FROM expenses e
    LEFT JOIN expense_categories c ON e.category_id = c.id
    WHERE e.project_id = $1
    ORDER BY e.expense_date DESC;
  `,

  // Ajouter une dépense
  ADD_EXPENSE: `
    INSERT INTO expenses (
      project_id, category_id, description, amount, expense_date, 
      payment_method, receipt_file, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id;
  `,

  // Récupérer les catégories de dépenses
  GET_EXPENSE_CATEGORIES: `
    SELECT * FROM expense_categories
    ORDER BY name;
  `,

  // Récupérer les budgets de projet
  GET_PROJECT_BUDGETS: `
    SELECT 
      pb.*,
      p.name as project_name
    FROM project_budgets pb
    JOIN projects p ON pb.project_id = p.id
    ORDER BY p.name;
  `,

  // Récupérer le budget d'un projet spécifique
  GET_PROJECT_BUDGET_BY_ID: `
    SELECT 
      pb.*,
      p.name as project_name
    FROM project_budgets pb
    JOIN projects p ON pb.project_id = p.id
    WHERE pb.project_id = $1;
  `,

  // Créer ou mettre à jour un budget de projet
  UPSERT_PROJECT_BUDGET: `
    INSERT INTO project_budgets (
      project_id, total_budget, materials_budget, labor_budget, 
      equipment_budget, subcontractor_budget, other_budget, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (project_id) 
    DO UPDATE SET
      total_budget = $2,
      materials_budget = $3,
      labor_budget = $4,
      equipment_budget = $5,
      subcontractor_budget = $6,
      other_budget = $7,
      notes = $8,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id;
  `,
};
