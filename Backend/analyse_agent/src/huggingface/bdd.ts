/**
 * Description détaillée de la structure de la base de données BTP
 * Ce fichier contient les informations sur les tables, relations et champs principaux
 * pour aider à la génération de requêtes SQL pertinentes.
 */

export const DATABASE_SCHEMA = {
  description: `Base de données pour une entreprise de BTP gérant des clients, projets, devis, factures et ressources.`,
  tables: [
    {
      name: 'clients',
      description: "Informations sur les clients de l'entreprise",
      fields: [
        {
          name: 'id',
          type: 'uuid',
          description: 'Identifiant unique du client',
          primaryKey: true,
        },
        { name: 'firstname', type: 'varchar', description: 'Prénom du client' },
        {
          name: 'lastname',
          type: 'varchar',
          description: 'Nom de famille du client',
        },
        {
          name: 'email',
          type: 'varchar',
          description: 'Adresse email du client',
          unique: true,
        },
        {
          name: 'phone',
          type: 'varchar',
          description: 'Numéro de téléphone du client',
        },
        {
          name: 'address_id',
          type: 'uuid',
          description: "Référence à l'adresse du client (table addresses)",
        },
      ],
      relations: [
        {
          table: 'addresses',
          field: 'address_id',
          description: 'Adresse du client',
        },
        {
          table: 'projects',
          field: 'client_id',
          description: 'Projets associés à ce client',
        },
      ],
    },
    {
      name: 'projects',
      description: 'Projets de construction ou rénovation',
      fields: [
        {
          name: 'id',
          type: 'uuid',
          description: 'Identifiant unique du projet',
          primaryKey: true,
        },
        {
          name: 'client_id',
          type: 'uuid',
          description: 'Référence au client (owner)',
        },
        { name: 'name', type: 'text', description: 'Nom du projet' },
        {
          name: 'description',
          type: 'text',
          description: 'Description détaillée du projet',
        },
        {
          name: 'start_date',
          type: 'date',
          description: 'Date de début du projet',
        },
        {
          name: 'end_date',
          type: 'date',
          description: 'Date de fin prévue ou effective du projet',
        },
        {
          name: 'status',
          type: 'uuid',
          description: 'Statut actuel du projet (réf. table ref_status)',
        },
        {
          name: 'address_id',
          type: 'uuid',
          description: 'Adresse du chantier',
        },
      ],
      relations: [
        {
          table: 'clients',
          field: 'client_id',
          description: 'Client associé au projet',
        },
        {
          table: 'addresses',
          field: 'address_id',
          description: 'Adresse du projet',
        },
        {
          table: 'ref_status',
          field: 'status',
          description: 'Statut du projet',
        },
        {
          table: 'quotations',
          field: 'project_id',
          description: 'Devis associés au projet',
        },
        {
          table: 'invoices',
          field: 'project_id',
          description: 'Factures associées au projet',
        },
        {
          table: 'stages',
          field: 'project_id',
          description: 'Étapes du projet',
        },
      ],
    },
    {
      name: 'quotations',
      description: 'Devis établis pour les projets',
      fields: [
        {
          name: 'id',
          type: 'uuid',
          description: 'Identifiant unique du devis',
          primaryKey: true,
        },
        {
          name: 'project_id',
          type: 'uuid',
          description: 'Référence au projet concerné',
        },
        {
          name: 'reference',
          type: 'text',
          description: 'Numéro de référence du devis',
          unique: true,
        },
        {
          name: 'issue_date',
          type: 'date',
          description: "Date d'émission du devis",
        },
        {
          name: 'validity_date',
          type: 'date',
          description: 'Date de validité du devis',
        },
        {
          name: 'total_ht',
          type: 'numeric(12,2)',
          description: 'Montant total HT',
        },
        {
          name: 'tva_rate',
          type: 'numeric(5,2)',
          description: 'Taux de TVA appliqué (en %)',
        },
        {
          name: 'total_ttc',
          type: 'numeric(12,2)',
          description: 'Montant total TTC',
        },
        {
          name: 'status',
          type: 'uuid',
          description: 'Statut du devis (réf. table ref_quotation_status)',
        },
      ],
      relations: [
        {
          table: 'projects',
          field: 'project_id',
          description: 'Projet associé au devis',
        },
        {
          table: 'ref_quotation_status',
          field: 'status',
          description: 'Statut du devis',
        },
        {
          table: 'quotation_products',
          field: 'quotation_id',
          description: 'Produits/services du devis',
        },
      ],
    },
    {
      name: 'quotation_products',
      description: 'Éléments individuels des devis (produits, services, etc.)',
      fields: [
        {
          name: 'id',
          type: 'uuid',
          description: "Identifiant unique de l'élément",
          primaryKey: true,
        },
        {
          name: 'quotation_id',
          type: 'uuid',
          description: 'Référence au devis parent',
        },
        {
          name: 'description',
          type: 'text',
          description: "Description de l'élément",
        },
        { name: 'quantity', type: 'decimal(10,2)', description: 'Quantité' },
        {
          name: 'unit_price',
          type: 'decimal(10,2)',
          description: 'Prix unitaire HT',
        },
        {
          name: 'total_price',
          type: 'decimal(10,2)',
          description: 'Prix total HT (quantité × prix unitaire)',
        },
        {
          name: 'category',
          type: 'uuid',
          description: "Catégorie du produit (matériaux, main d'œuvre, etc.)",
        },
      ],
      relations: [
        {
          table: 'quotations',
          field: 'quotation_id',
          description: 'Devis parent',
        },
      ],
    },
    {
      name: 'invoices',
      description: 'Factures émises pour les projets',
      fields: [
        {
          name: 'id',
          type: 'uuid',
          description: 'Identifiant unique de la facture',
          primaryKey: true,
        },
        {
          name: 'project_id',
          type: 'uuid',
          description: 'Référence au projet concerné',
        },
        {
          name: 'reference',
          type: 'text',
          description: 'Numéro de référence de la facture',
          unique: true,
        },
        {
          name: 'issue_date',
          type: 'date',
          description: "Date d'émission de la facture",
        },
        {
          name: 'due_date',
          type: 'date',
          description: "Date d'échéance de la facture",
        },
        {
          name: 'total_ht',
          type: 'numeric(12,2)',
          description: 'Montant total HT',
        },
        {
          name: 'tva_rate',
          type: 'numeric(5,2)',
          description: 'Taux de TVA appliqué (en %)',
        },
        {
          name: 'total_ttc',
          type: 'numeric(12,2)',
          description: 'Montant total TTC',
        },
        {
          name: 'status',
          type: 'uuid',
          description: 'Statut de la facture (réf. table ref_status)',
        },
      ],
      relations: [
        {
          table: 'projects',
          field: 'project_id',
          description: 'Projet associé à la facture',
        },
        {
          table: 'ref_status',
          field: 'status',
          description: 'Statut de la facture',
        },
        {
          table: 'payments',
          field: 'invoice_id',
          description: 'Paiements associés à la facture',
        },
        {
          table: 'invoice_items',
          field: 'invoice_id',
          description: 'Éléments de la facture',
        },
      ],
    },
    {
      name: 'payments',
      description: 'Paiements reçus pour les factures',
      fields: [
        {
          name: 'id',
          type: 'uuid',
          description: 'Identifiant unique du paiement',
          primaryKey: true,
        },
        {
          name: 'invoice_id',
          type: 'uuid',
          description: 'Référence à la facture concernée',
        },
        {
          name: 'amount',
          type: 'numeric(12,2)',
          description: 'Montant du paiement',
        },
        { name: 'payment_date', type: 'date', description: 'Date du paiement' },
        {
          name: 'payment_method',
          type: 'uuid',
          description: 'Méthode de paiement (réf. table ref_payment_methods)',
        },
        {
          name: 'reference',
          type: 'text',
          description: 'Référence du paiement (n° de chèque, etc.)',
        },
      ],
      relations: [
        {
          table: 'invoices',
          field: 'invoice_id',
          description: 'Facture associée au paiement',
        },
        {
          table: 'ref_payment_methods',
          field: 'payment_method',
          description: 'Méthode de paiement',
        },
      ],
    },
    {
      name: 'staff',
      description: "Personnel de l'entreprise",
      fields: [
        {
          name: 'id',
          type: 'uuid',
          description: 'Identifiant unique du membre du personnel',
          primaryKey: true,
        },
        { name: 'firstname', type: 'varchar', description: 'Prénom' },
        { name: 'lastname', type: 'varchar', description: 'Nom de famille' },
        {
          name: 'email',
          type: 'varchar',
          description: 'Adresse email professionnelle',
          unique: true,
        },
        {
          name: 'role',
          type: 'varchar',
          description: "Fonction dans l'entreprise",
        },
        { name: 'phone', type: 'varchar', description: 'Numéro de téléphone' },
        {
          name: 'is_available',
          type: 'boolean',
          description: 'Disponibilité actuelle',
        },
      ],
      relations: [
        {
          table: 'addresses',
          field: 'address_id',
          description: 'Adresse du membre du personnel',
        },
        {
          table: 'project_staff',
          field: 'staff_id',
          description: 'Projets auxquels le membre est affecté',
        },
        {
          table: 'timesheet_entries',
          field: 'staff_id',
          description: 'Feuilles de temps du membre',
        },
      ],
    },
    {
      name: 'timesheet_entries',
      description: 'Feuilles de temps (heures travaillées)',
      fields: [
        {
          name: 'id',
          type: 'uuid',
          description: "Identifiant unique de l'entrée",
          primaryKey: true,
        },
        {
          name: 'project_id',
          type: 'uuid',
          description: 'Référence au projet concerné',
        },
        {
          name: 'staff_id',
          type: 'uuid',
          description: 'Référence au membre du personnel',
        },
        { name: 'date', type: 'date', description: 'Date de la prestation' },
        {
          name: 'hours',
          type: 'decimal(5,2)',
          description: "Nombre d'heures travaillées",
        },
        {
          name: 'hourly_rate',
          type: 'decimal(10,2)',
          description: 'Taux horaire',
        },
        {
          name: 'description',
          type: 'text',
          description: 'Description des travaux effectués',
        },
      ],
      relations: [
        {
          table: 'projects',
          field: 'project_id',
          description: 'Projet associé',
        },
        {
          table: 'staff',
          field: 'staff_id',
          description: 'Membre du personnel concerné',
        },
      ],
    },
    {
      name: 'ref_status',
      description: 'Table de référence pour les différents statuts des entités',
      fields: [
        {
          name: 'id',
          type: 'uuid',
          description: 'Identifiant unique du statut',
          primaryKey: true,
        },
        {
          name: 'code',
          type: 'text',
          description: "Code du statut (ex: 'en_cours')",
        },
        {
          name: 'name',
          type: 'text',
          description: "Nom du statut (ex: 'En cours')",
        },
        {
          name: 'description',
          type: 'text',
          description: 'Description du statut',
        },
        {
          name: 'entity_type',
          type: 'text',
          description: "Type d'entité concernée (ex: 'project', 'invoice')",
        },
      ],
    },
    {
      name: 'ref_quotation_status',
      description: 'Table de référence pour les statuts des devis',
      fields: [
        {
          name: 'id',
          type: 'uuid',
          description: 'Identifiant unique du statut',
          primaryKey: true,
        },
        {
          name: 'code',
          type: 'text',
          description: "Code du statut (ex: 'accepté')",
          unique: true,
        },
        {
          name: 'name',
          type: 'text',
          description: "Nom du statut (ex: 'Accepté')",
        },
        {
          name: 'description',
          type: 'text',
          description: 'Description du statut',
        },
      ],
    },
    {
      name: 'ref_payment_methods',
      description: 'Table de référence pour les méthodes de paiement',
      fields: [
        {
          name: 'id',
          type: 'uuid',
          description: 'Identifiant unique de la méthode',
          primaryKey: true,
        },
        {
          name: 'code',
          type: 'text',
          description: "Code de la méthode (ex: 'carte')",
          unique: true,
        },
        {
          name: 'name',
          type: 'text',
          description: "Nom de la méthode (ex: 'Carte bancaire')",
        },
        {
          name: 'description',
          type: 'text',
          description: 'Description de la méthode',
        },
      ],
    },
    {
      name: 'stages',
      description: 'Étapes des projets',
      fields: [
        {
          name: 'id',
          type: 'uuid',
          description: "Identifiant unique de l'étape",
          primaryKey: true,
        },
        {
          name: 'project_id',
          type: 'uuid',
          description: 'Référence au projet parent',
        },
        { name: 'name', type: 'varchar', description: "Nom de l'étape" },
        {
          name: 'description',
          type: 'text',
          description: "Description détaillée de l'étape",
        },
        {
          name: 'start_date',
          type: 'date',
          description: "Date de début de l'étape",
        },
        {
          name: 'end_date',
          type: 'date',
          description: "Date de fin de l'étape",
        },
        {
          name: 'status',
          type: 'uuid',
          description: "Statut de l'étape (réf. table ref_status)",
        },
        {
          name: 'completion_percentage',
          type: 'integer',
          description: "Pourcentage d'avancement (0-100)",
        },
      ],
      relations: [
        {
          table: 'projects',
          field: 'project_id',
          description: 'Projet parent',
        },
        {
          table: 'ref_status',
          field: 'status',
          description: "Statut de l'étape",
        },
      ],
    },
    {
      name: 'addresses',
      description: 'Adresses (clients, projets, personnel, etc.)',
      fields: [
        {
          name: 'id',
          type: 'uuid',
          description: "Identifiant unique de l'adresse",
          primaryKey: true,
        },
        {
          name: 'street_number',
          type: 'varchar',
          description: 'Numéro de rue',
        },
        { name: 'street_name', type: 'varchar', description: 'Nom de la rue' },
        { name: 'zip_code', type: 'varchar', description: 'Code postal' },
        { name: 'city', type: 'varchar', description: 'Ville' },
        {
          name: 'country',
          type: 'varchar',
          description: "Pays (par défaut: 'France')",
        },
      ],
    },
    {
      name: 'expenses',
      description: 'Dépenses liées aux projets',
      fields: [
        {
          name: 'id',
          type: 'uuid',
          description: 'Identifiant unique de la dépense',
          primaryKey: true,
        },
        {
          name: 'project_id',
          type: 'uuid',
          description: 'Référence au projet concerné',
        },
        {
          name: 'category_id',
          type: 'uuid',
          description: 'Catégorie de dépense',
        },
        {
          name: 'description',
          type: 'text',
          description: 'Description de la dépense',
        },
        {
          name: 'amount',
          type: 'decimal(10,2)',
          description: 'Montant de la dépense',
        },
        {
          name: 'expense_date',
          type: 'date',
          description: 'Date de la dépense',
        },
        {
          name: 'payment_method',
          type: 'uuid',
          description: 'Méthode de paiement (réf. table ref_payment_methods)',
        },
      ],
      relations: [
        {
          table: 'projects',
          field: 'project_id',
          description: 'Projet associé',
        },
        {
          table: 'expense_categories',
          field: 'category_id',
          description: 'Catégorie de la dépense',
        },
        {
          table: 'ref_payment_methods',
          field: 'payment_method',
          description: 'Méthode de paiement',
        },
      ],
    },
  ],
  commonQueries: [
    {
      description: 'Montant total des devis par année',
      query: `SELECT EXTRACT(YEAR FROM issue_date) AS année, 
              SUM(total_ht) AS montant_total_ht, 
              SUM(total_ttc) AS montant_total_ttc 
              FROM quotations 
              GROUP BY EXTRACT(YEAR FROM issue_date) 
              ORDER BY année`,
    },
    {
      description: 'Liste des factures impayées',
      query: `SELECT i.reference, i.issue_date, i.due_date, i.total_ttc, 
              c.firstname || ' ' || c.lastname AS client_name, p.name AS project_name
              FROM invoices i
              JOIN projects p ON i.project_id = p.id
              JOIN clients c ON p.client_id = c.id
              JOIN ref_status s ON i.status = s.id
              WHERE s.code = 'en_retard' OR s.code = 'envoyée'
              ORDER BY i.due_date ASC`,
    },
    {
      description: "Chiffre d'affaires par mois pour une année donnée",
      query: `SELECT EXTRACT(MONTH FROM issue_date) AS mois, SUM(total_ht) AS chiffre_affaires
              FROM invoices
              WHERE EXTRACT(YEAR FROM issue_date) = [ANNÉE]
              GROUP BY EXTRACT(MONTH FROM issue_date)
              ORDER BY mois`,
    },
    {
      description: "Projets en cours avec leur état d'avancement",
      query: `SELECT p.name AS projet, p.start_date, p.end_date,
              rs.name AS statut, 
              AVG(s.completion_percentage) AS avancement_moyen
              FROM projects p
              JOIN ref_status rs ON p.status = rs.id
              LEFT JOIN stages s ON p.id = s.project_id
              WHERE rs.code = 'en_cours'
              GROUP BY p.id, p.name, p.start_date, p.end_date, rs.name
              ORDER BY p.start_date DESC`,
    },
    {
      description: 'Rentabilité des projets terminés',
      query: `SELECT p.name AS projet,
              SUM(i.total_ht) AS recettes,
              SUM(e.amount) AS depenses,
              SUM(i.total_ht) - SUM(e.amount) AS marge,
              CASE WHEN SUM(e.amount) > 0 
                THEN ROUND((SUM(i.total_ht) - SUM(e.amount)) / SUM(e.amount) * 100, 2)
                ELSE 0 
              END AS rentabilite_pct
              FROM projects p
              JOIN ref_status rs ON p.status = rs.id
              LEFT JOIN invoices i ON p.id = i.project_id
              LEFT JOIN expenses e ON p.id = e.project_id
              WHERE rs.code = 'termine'
              GROUP BY p.id, p.name
              ORDER BY rentabilite_pct DESC`,
    },
  ],
  statusCodes: {
    projects: [
      {
        code: 'prospect',
        name: 'Prospect',
        description: 'Projet en phase de prospection',
      },
      { code: 'en_cours', name: 'En cours', description: 'Projet actif' },
      { code: 'termine', name: 'Terminé', description: 'Projet terminé' },
      {
        code: 'en_pause',
        name: 'En pause',
        description: 'Projet temporairement suspendu',
      },
      { code: 'annule', name: 'Annulé', description: 'Projet annulé' },
    ],
    invoices: [
      {
        code: 'brouillon',
        name: 'Brouillon',
        description: 'Facture en cours de rédaction',
      },
      {
        code: 'envoyée',
        name: 'Envoyée',
        description: 'Facture envoyée au client',
      },
      {
        code: 'payée_partiellement',
        name: 'Payée partiellement',
        description: 'Facture partiellement payée',
      },
      {
        code: 'payée',
        name: 'Payée',
        description: 'Facture entièrement payée',
      },
      {
        code: 'en_retard',
        name: 'En retard',
        description: 'Facture en retard de paiement',
      },
      { code: 'annulée', name: 'Annulée', description: 'Facture annulée' },
    ],
    quotations: [
      {
        code: 'en_attente',
        name: 'En attente',
        description: 'Devis en attente de réponse',
      },
      {
        code: 'accepté',
        name: 'Accepté',
        description: 'Devis accepté par le client',
      },
      {
        code: 'refusé',
        name: 'Refusé',
        description: 'Devis refusé par le client',
      },
    ],
  },
};

/**
 * Retourne un schéma JSON de la base de données pour inclusion dans un prompt
 */
export function getSchemaForPrompt(): string {
  return JSON.stringify(DATABASE_SCHEMA, null, 2);
}

/**
 * Retourne une description textuelle simplifiée de la base de données
 */
export function getTextSchemaDescription(): string {
  const tables = DATABASE_SCHEMA.tables
    .map((table) => {
      const fields = table.fields
        .map(
          (field) =>
            `    - ${field.name} (${field.type}): ${field.description}${field.primaryKey ? ' (clé primaire)' : ''}${field.unique ? ' (unique)' : ''}`,
        )
        .join('\n');

      return `- Table ${table.name}: ${table.description}\n${fields}`;
    })
    .join('\n\n');

  return `Description de la base de données BTP:
${tables}`;
}
