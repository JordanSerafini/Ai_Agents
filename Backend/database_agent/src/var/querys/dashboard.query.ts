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

  // Récupérer les statistiques des projets pour le tableau de bord
  PROJECT_STATS: `
    SELECT 
      COUNT(*) as total_projects,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_projects,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_projects,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_projects,
      COUNT(CASE WHEN end_date < CURRENT_DATE AND status != 'completed' THEN 1 END) as overdue_projects
    FROM projects;
  `,

  // Résumé global pour le tableau de bord
  DASHBOARD_SUMMARY: `
    SELECT 
      (SELECT COUNT(*) FROM projects WHERE status = 'active') as active_projects,
      (SELECT COUNT(*) FROM projects WHERE status = 'completed') as completed_projects,
      (SELECT COUNT(*) FROM projects WHERE end_date < CURRENT_DATE AND status != 'completed') as overdue_projects,
      (SELECT COUNT(*) FROM tasks WHERE status = 'pending') as pending_tasks,
      (SELECT COUNT(*) FROM tasks WHERE status = 'in_progress') as in_progress_tasks,
      (SELECT COUNT(*) FROM tasks WHERE due_date < CURRENT_DATE AND status != 'completed') as overdue_tasks,
      (SELECT COUNT(*) FROM invoices WHERE status = 'pending') as pending_invoices,
      (SELECT COUNT(*) FROM invoices WHERE status = 'overdue') as overdue_invoices,
      (SELECT SUM(total_ht) FROM invoices WHERE status = 'paid') as total_revenue,
      (SELECT SUM(amount) FROM expenses) as total_expenses,
      (SELECT COUNT(*) FROM clients) as total_clients,
      (SELECT COUNT(*) FROM staff) as total_staff
  `,

  // Récupérer les statistiques des tâches pour le tableau de bord
  TASK_STATS: `
    SELECT 
      COUNT(*) as total_tasks,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
      COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
      COUNT(CASE WHEN due_date < CURRENT_DATE AND status != 'completed' THEN 1 END) as overdue_tasks
    FROM tasks;
  `,
};
