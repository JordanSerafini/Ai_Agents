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
    GROUP BY p.id, p.name, p.start_date, p.end_date, p.status, c.name
    ORDER BY p.end_date ASC;
  `,

  // Rapport d'avancement détaillé d'un projet
  PROJECT_DETAILED_PROGRESS: `
    SELECT 
      s.id as stage_id,
      s.name as stage_name,
      s.start_date,
      s.end_date,
      s.status,
      COUNT(t.id) as total_tasks,
      SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
      CASE 
        WHEN COUNT(t.id) = 0 THEN 0
        ELSE ROUND((SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END)::numeric / COUNT(t.id)) * 100, 2)
      END as progress_percentage
    FROM stages s
    LEFT JOIN tasks t ON s.id = t.stage_id
    WHERE s.project_id = $1
    GROUP BY s.id, s.name, s.start_date, s.end_date, s.status
    ORDER BY s.start_date ASC;
  `,

  // Rapport de charge de travail par employé
  STAFF_WORKLOAD_REPORT: `
    SELECT 
      s.id,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name,
      COUNT(DISTINCT ps.project_id) as assigned_projects,
      COUNT(t.id) as assigned_tasks,
      COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
      COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
      COUNT(CASE WHEN t.due_date < CURRENT_DATE AND t.status != 'completed' THEN 1 END) as overdue_tasks,
      SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks
    FROM staff s
    LEFT JOIN project_staff ps ON s.id = ps.staff_id
    LEFT JOIN tasks t ON s.id = t.assigned_to
    GROUP BY s.id, staff_name
    ORDER BY assigned_tasks DESC;
  `,

  // Rapport de charge de travail détaillé pour un employé
  STAFF_DETAILED_WORKLOAD: `
    SELECT 
      p.id as project_id,
      p.name as project_name,
      p.status as project_status,
      COUNT(t.id) as assigned_tasks,
      COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
      COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
      COUNT(CASE WHEN t.due_date < CURRENT_DATE AND t.status != 'completed' THEN 1 END) as overdue_tasks,
      SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks
    FROM staff s
    JOIN project_staff ps ON s.id = ps.staff_id
    JOIN projects p ON ps.project_id = p.id
    LEFT JOIN tasks t ON s.id = t.assigned_to AND t.project_id = p.id
    WHERE s.id = $1
    GROUP BY p.id, p.name, p.status
    ORDER BY p.end_date ASC;
  `,

  // Rapport de performance des projets
  PROJECT_PERFORMANCE_REPORT: `
    SELECT 
      p.id,
      p.name,
      p.start_date,
      p.end_date,
      p.status,
      c.name as client_name,
      CASE 
        WHEN p.end_date < CURRENT_DATE AND p.status != 'termine' THEN 'En retard'
        WHEN p.end_date >= CURRENT_DATE THEN 'Dans les délais'
        ELSE 'Terminé'
      END as timeline_status,
      CASE 
        WHEN p.end_date < CURRENT_DATE AND p.status != 'termine' 
        THEN CURRENT_DATE - p.end_date
        ELSE 0
      END as days_overdue,
      pb.total_budget,
      COALESCE(SUM(e.amount), 0) as total_expenses,
      COALESCE(SUM(i.total_ht), 0) as total_invoiced,
      COALESCE(SUM(i.total_ht), 0) - COALESCE(SUM(e.amount), 0) as estimated_profit,
      CASE 
        WHEN COALESCE(SUM(i.total_ht), 0) = 0 THEN 0
        ELSE ROUND((COALESCE(SUM(i.total_ht), 0) - COALESCE(SUM(e.amount), 0)) / COALESCE(SUM(i.total_ht), 0) * 100, 2)
      END as profit_margin
    FROM projects p
    JOIN clients c ON p.client_id = c.id
    LEFT JOIN project_budgets pb ON p.id = pb.project_id
    LEFT JOIN expenses e ON p.id = e.project_id
    LEFT JOIN invoices i ON p.id = i.project_id
    GROUP BY p.id, p.name, p.start_date, p.end_date, p.status, c.name, pb.total_budget
    ORDER BY p.end_date DESC;
  `,

  // Rapport de performance des employés
  STAFF_PERFORMANCE_REPORT: `
    SELECT 
      s.id,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name,
      COUNT(t.id) as total_tasks,
      SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
      CASE 
        WHEN COUNT(t.id) = 0 THEN 0
        ELSE ROUND((SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END)::numeric / COUNT(t.id)) * 100, 2)
      END as completion_rate,
      COUNT(CASE WHEN t.due_date < t.completion_date THEN 1 END) as late_tasks,
      CASE 
        WHEN SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) = 0 THEN 0
        ELSE ROUND((COUNT(CASE WHEN t.due_date < t.completion_date THEN 1 END)::numeric / 
              SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END)) * 100, 2)
      END as late_completion_rate,
      AVG(CASE WHEN t.status = 'completed' THEN t.completion_date - t.start_date ELSE NULL END) as avg_task_duration
    FROM staff s
    LEFT JOIN tasks t ON s.id = t.assigned_to
    GROUP BY s.id, staff_name
    ORDER BY completion_rate DESC;
  `,

  // Rapport de rentabilité des clients
  CLIENT_PROFITABILITY_REPORT: `
    SELECT 
      c.id,
      c.name as client_name,
      COUNT(DISTINCT p.id) as total_projects,
      COUNT(DISTINCT CASE WHEN p.status = 'termine' THEN p.id END) as completed_projects,
      COALESCE(SUM(i.total_ht), 0) as total_invoiced,
      COALESCE(SUM(e.amount), 0) as total_expenses,
      COALESCE(SUM(i.total_ht), 0) - COALESCE(SUM(e.amount), 0) as total_profit,
      CASE 
        WHEN COALESCE(SUM(i.total_ht), 0) = 0 THEN 0
        ELSE ROUND((COALESCE(SUM(i.total_ht), 0) - COALESCE(SUM(e.amount), 0)) / COALESCE(SUM(i.total_ht), 0) * 100, 2)
      END as profit_margin
    FROM clients c
    LEFT JOIN projects p ON c.id = p.client_id
    LEFT JOIN invoices i ON p.id = i.project_id
    LEFT JOIN expenses e ON p.id = e.project_id
    GROUP BY c.id, c.name
    ORDER BY total_profit DESC;
  `,

  // Rapport de performance des devis
  QUOTATION_PERFORMANCE_REPORT: `
    SELECT 
      q.id,
      q.reference,
      q.issue_date,
      q.valid_until,
      q.total_ht,
      q.status,
      p.name as project_name,
      c.name as client_name,
      CASE 
        WHEN q.status = 'accepté' THEN 'Gagné'
        WHEN q.status = 'refusé' THEN 'Perdu'
        WHEN q.valid_until < CURRENT_DATE THEN 'Expiré'
        ELSE 'En attente'
      END as outcome,
      CASE 
        WHEN q.status = 'accepté' THEN q.acceptance_date - q.issue_date
        ELSE NULL
      END as days_to_acceptance
    FROM quotations q
    JOIN projects p ON q.project_id = p.id
    JOIN clients c ON p.client_id = c.id
    ORDER BY q.issue_date DESC;
  `,

  // Statistiques de conversion des devis
  QUOTATION_CONVERSION_STATS: `
    SELECT 
      COUNT(*) as total_quotations,
      COUNT(CASE WHEN status = 'accepté' THEN 1 END) as accepted_quotations,
      COUNT(CASE WHEN status = 'refusé' THEN 1 END) as rejected_quotations,
      COUNT(CASE WHEN status = 'en_attente' AND valid_until >= CURRENT_DATE THEN 1 END) as pending_quotations,
      COUNT(CASE WHEN status = 'en_attente' AND valid_until < CURRENT_DATE THEN 1 END) as expired_quotations,
      CASE 
        WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND((COUNT(CASE WHEN status = 'accepté' THEN 1 END)::numeric / 
              COUNT(*)) * 100, 2)
      END as conversion_rate,
      COALESCE(SUM(CASE WHEN status = 'accepté' THEN total_ht ELSE 0 END), 0) as total_accepted_amount,
      COALESCE(SUM(total_ht), 0) as total_quoted_amount,
      COALESCE(AVG(CASE WHEN status = 'accepté' THEN acceptance_date - issue_date END), 0) as avg_days_to_acceptance
    FROM quotations
    WHERE issue_date >= CURRENT_DATE - INTERVAL '12 months';
  `,

  // Rapport d'activité de l'IA
  AI_ACTIVITY_REPORT: `
    SELECT 
      DATE_TRUNC('day', created_at) as date,
      COUNT(*) as total_interactions,
      COUNT(DISTINCT staff_id) as unique_users,
      AVG(LENGTH(query)) as avg_query_length,
      AVG(LENGTH(response)) as avg_response_length,
      AVG(CASE WHEN feedback IS NOT NULL THEN feedback ELSE NULL END) as avg_feedback
    FROM ai_interactions
    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY DATE_TRUNC('day', created_at)
    ORDER BY date DESC;
  `,

  // Rapport des requêtes les plus fréquentes à l'IA
  AI_TOP_QUERIES_REPORT: `
    WITH query_categories AS (
      SELECT 
        CASE
          WHEN query ILIKE '%facture%' OR query ILIKE '%paiement%' THEN 'Facturation'
          WHEN query ILIKE '%devis%' OR query ILIKE '%quotation%' THEN 'Devis'
          WHEN query ILIKE '%client%' THEN 'Clients'
          WHEN query ILIKE '%projet%' OR query ILIKE '%chantier%' THEN 'Projets'
          WHEN query ILIKE '%tâche%' OR query ILIKE '%task%' THEN 'Tâches'
          WHEN query ILIKE '%équipement%' OR query ILIKE '%matériel%' THEN 'Équipement'
          WHEN query ILIKE '%fournisseur%' OR query ILIKE '%commande%' THEN 'Fournisseurs'
          ELSE 'Autres'
        END as category,
        COUNT(*) as query_count
      FROM ai_interactions
      WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
      GROUP BY category
    )
    SELECT 
      category,
      query_count,
      ROUND((query_count::numeric / (SELECT SUM(query_count) FROM query_categories)) * 100, 2) as percentage
    FROM query_categories
    ORDER BY query_count DESC;
  `,

  // Rapport d'activité du système
  SYSTEM_ACTIVITY_REPORT: `
    SELECT 
      DATE_TRUNC('day', created_at) as date,
      action_type,
      COUNT(*) as action_count
    FROM activity_logs
    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY DATE_TRUNC('day', created_at), action_type
    ORDER BY date DESC, action_count DESC;
  `,

  // Rapport d'activité par utilisateur
  USER_ACTIVITY_REPORT: `
    SELECT 
      s.id,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name,
      COUNT(al.id) as total_actions,
      COUNT(DISTINCT DATE_TRUNC('day', al.created_at)) as active_days,
      STRING_AGG(DISTINCT al.action_type, ', ') as action_types,
      MAX(al.created_at) as last_activity
    FROM staff s
    LEFT JOIN activity_logs al ON s.id = al.staff_id
    WHERE al.created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY s.id, staff_name
    ORDER BY total_actions DESC;
  `,
};
