BEGIN;

-- Création du type ENUM pour le statut des devis
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quotation_status') THEN
        CREATE TYPE quotation_status AS ENUM ('en_attente', 'accepté', 'refusé');
    END IF;
END $$;

-- Création du type ENUM pour la catégorie des produits des devis
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_category') THEN
        CREATE TYPE product_category AS ENUM ('matériaux', 'main_doeuvre', 'transport', 'autres');
    END IF;
END $$;

-- Création du type ENUM pour les types d'événements de calendrier
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type') THEN
        CREATE TYPE event_type AS ENUM (
            'appel_telephonique',
            'reunion_chantier',
            'visite_technique',
            'rendez_vous_client',
            'reunion_interne',
            'formation',
            'livraison_materiaux',
            'intervention_urgente',
            'maintenance',
            'autre'
        );
    END IF;
END $$;

-- Création du type ENUM pour les statuts de projet
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
        CREATE TYPE project_status AS ENUM (
            'prospect',
            'en_cours',
            'termine',
            'en_pause',
            'annule'
        );
    END IF;
END $$;

-- Création du type ENUM pour les types d'activités
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_type') THEN
        CREATE TYPE activity_type AS ENUM (
            'creation',
            'modification',
            'suppression',
            'consultation',
            'validation',
            'refus',
            'commentaire',
            'autre'
        );
    END IF;
END $$;

-- Création du type ENUM pour les types de documents
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type') THEN
        CREATE TYPE document_type AS ENUM (
            'devis',
            'facture',
            'plan',
            'photo',
            'contrat',
            'rapport',
            'autre'
        );
    END IF;
END $$;

-- Création du type ENUM pour les statuts de facture
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
        CREATE TYPE invoice_status AS ENUM (
            'brouillon',
            'envoyée',
            'payée_partiellement',
            'payée',
            'en_retard',
            'annulée'
        );
    END IF;
END $$;

-- Création du type ENUM pour les méthodes de paiement
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
        CREATE TYPE payment_method AS ENUM (
            'virement',
            'cheque',
            'carte',
            'especes',
            'prelevement'
        );
    END IF;
END $$;

-- Création de la table des rôles
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table des utilisateurs (staff)
CREATE TABLE IF NOT EXISTS staff (
    id SERIAL PRIMARY KEY,
    firstname VARCHAR(100) NOT NULL,
    lastname VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table des clients
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    firstname VARCHAR(100) NOT NULL,
    lastname VARCHAR(100) NOT NULL,
    street_number VARCHAR(10),
    street_name VARCHAR(255),
    zip_code VARCHAR(10),
    city VARCHAR(100),
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table des projets
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    street_number VARCHAR(10),
    street_name VARCHAR(255),
    zip_code VARCHAR(10),
    city VARCHAR(100),
    start_date DATE,
    end_date DATE,
    status project_status,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    search_metadata JSONB,
    CONSTRAINT fk_project_client FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Création de la table des matériaux
CREATE TABLE IF NOT EXISTS materials (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    unit VARCHAR(50),
    price DECIMAL(10,2),
    quantity INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table des devis
CREATE TABLE IF NOT EXISTS quotations (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    created_date DATE NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    status quotation_status DEFAULT 'en_attente',
    validity_date DATE,
    reference VARCHAR(50) UNIQUE,
    tva_rate DECIMAL(5,2) DEFAULT 20.00,
    payment_conditions TEXT,
    notes TEXT,
    search_metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_quotation_project FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Création de la table des produits du devis
CREATE TABLE IF NOT EXISTS quotation_products (
    id SERIAL PRIMARY KEY,
    quotation_id INTEGER NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    description TEXT,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    unit VARCHAR(50),
    category product_category,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_quotation_product FOREIGN KEY (quotation_id) REFERENCES quotations(id)
);

-- Création de la table des étapes du projet
CREATE TABLE IF NOT EXISTS stages (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    staff_id INTEGER,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration_days INT,
    start_date DATE,
    end_date DATE,
    status VARCHAR(50),
    order_index INT,
    search_metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_stage_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_stage_staff FOREIGN KEY (staff_id) REFERENCES staff(id)
);

-- Création de la table des matériaux utilisés dans les projets
CREATE TABLE IF NOT EXISTS project_materials (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_project_material_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_project_material_material FOREIGN KEY (material_id) REFERENCES materials(id)
);

-- Création de la table des affectations de personnel aux projets
CREATE TABLE IF NOT EXISTS project_staff (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    staff_id INTEGER NOT NULL,
    role VARCHAR(100),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_project_staff_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_project_staff_staff FOREIGN KEY (staff_id) REFERENCES staff(id)
);

-- Création de la table des événements de calendrier
CREATE TABLE IF NOT EXISTS calendar_events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type event_type,
    start_datetime TIMESTAMP NOT NULL,
    end_datetime TIMESTAMP NOT NULL,
    all_day BOOLEAN DEFAULT false,
    location VARCHAR(255),
    project_id INTEGER,
    staff_id INTEGER,
    client_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_event_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_event_staff FOREIGN KEY (staff_id) REFERENCES staff(id),
    CONSTRAINT fk_event_client FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Insertion des rôles par défaut
INSERT INTO roles (name) VALUES 
    ('ADMIN'),
    ('USER')
ON CONFLICT (name) DO NOTHING;

-- Table pour stocker les embeddings vectoriels des documents
CREATE TABLE IF NOT EXISTS document_embeddings (
    id SERIAL PRIMARY KEY,
    document_type VARCHAR(50) NOT NULL, -- 'project', 'client', 'quotation', etc.
    document_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    -- embedding vector(1536),  -- Dimension pour les embeddings OpenAI
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Création des index pour la recherche
-- CREATE INDEX IF NOT EXISTS document_embeddings_embedding_idx ON document_embeddings USING ivfflat (embedding vector_cosine_ops);

-- Création des index pour la recherche par métadonnées
ALTER TABLE projects ADD COLUMN IF NOT EXISTS search_metadata JSONB;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS search_metadata JSONB;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS search_metadata JSONB;
ALTER TABLE stages ADD COLUMN IF NOT EXISTS search_metadata JSONB;

CREATE INDEX IF NOT EXISTS projects_search_metadata_idx ON projects USING GIN (search_metadata);
CREATE INDEX IF NOT EXISTS clients_search_metadata_idx ON clients USING GIN (search_metadata);
CREATE INDEX IF NOT EXISTS quotations_search_metadata_idx ON quotations USING GIN (search_metadata);
CREATE INDEX IF NOT EXISTS stages_search_metadata_idx ON stages USING GIN (search_metadata);

-- Création de la table des logs d'activité
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL,
    user_id INTEGER,
    action activity_type NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    details JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Création de la première partition pour les logs d'activité
CREATE TABLE IF NOT EXISTS activity_logs_y2023m12 PARTITION OF activity_logs
    FOR VALUES FROM ('2023-12-01') TO ('2024-01-01');

-- Fonction pour créer automatiquement les partitions de logs
CREATE OR REPLACE FUNCTION create_partition_and_insert()
RETURNS TRIGGER AS $$
DECLARE
    partition_date TEXT;
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    -- Format: activity_logs_y2023m12
    partition_date := to_char(NEW.created_at, 'y"y"YYYYm"m"MM');
    partition_name := TG_TABLE_NAME || '_' || partition_date;
    start_date := date_trunc('month', NEW.created_at);
    end_date := start_date + interval '1 month';
    
    -- Vérifier si la partition existe déjà
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = partition_name AND n.nspname = 'public') THEN
        -- Créer la partition si elle n'existe pas
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
            partition_name, TG_TABLE_NAME, start_date, end_date);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour créer automatiquement les partitions de logs
CREATE TRIGGER activity_logs_insert_trigger
BEFORE INSERT ON activity_logs
FOR EACH ROW
EXECUTE FUNCTION create_partition_and_insert();

-- Création de la table des paramètres système
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    is_editable BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fonction pour récupérer un paramètre système
CREATE OR REPLACE FUNCTION get_setting(setting_key VARCHAR)
RETURNS JSONB AS $$
DECLARE
    setting_value JSONB;
BEGIN
    SELECT value INTO setting_value FROM system_settings WHERE key = setting_key;
    RETURN setting_value;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour un paramètre système
CREATE OR REPLACE FUNCTION update_setting(setting_key VARCHAR, new_value JSONB)
RETURNS BOOLEAN AS $$
DECLARE
    is_updated BOOLEAN;
BEGIN
    UPDATE system_settings 
    SET value = new_value, updated_at = CURRENT_TIMESTAMP
    WHERE key = setting_key AND is_editable = true;
    
    GET DIAGNOSTICS is_updated = ROW_COUNT;
    RETURN is_updated > 0;
END;
$$ LANGUAGE plpgsql;

-- Création de la table des factures
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    reference VARCHAR(50) UNIQUE NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    total_ht DECIMAL(10,2) NOT NULL,
    total_tva DECIMAL(10,2) NOT NULL,
    total_ttc DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'brouillon',
    notes TEXT,
    payment_conditions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_invoice_project FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Création de la table des paiements
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    reference VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

-- Création de la table des dépenses
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    project_id INTEGER,
    staff_id INTEGER,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT NOT NULL,
    expense_date DATE NOT NULL,
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_expense_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_expense_staff FOREIGN KEY (staff_id) REFERENCES staff(id)
);

-- Création de la table des feuilles de temps
CREATE TABLE IF NOT EXISTS timesheet_entries (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    staff_id INTEGER NOT NULL,
    date DATE NOT NULL,
    hours DECIMAL(5,2) NOT NULL,
    hourly_rate DECIMAL(10,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_timesheet_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_timesheet_staff FOREIGN KEY (staff_id) REFERENCES staff(id)
);

-- Vue matérialisée pour le tableau de bord financier
CREATE MATERIALIZED VIEW IF NOT EXISTS financial_dashboard AS
SELECT
    -- Statistiques globales
    (SELECT COUNT(*) FROM projects WHERE status = 'en_cours') as active_projects_count,
    (SELECT COUNT(*) FROM projects WHERE status = 'termine') as completed_projects_count,
    
    -- Date de mise à jour
    CURRENT_TIMESTAMP as last_updated;

-- Vue matérialisée pour les factures en retard
CREATE MATERIALIZED VIEW IF NOT EXISTS overdue_invoices_report AS
SELECT
    CURRENT_TIMESTAMP as last_updated;

-- Vue matérialisée pour la rentabilité des projets
CREATE MATERIALIZED VIEW IF NOT EXISTS project_profitability_report AS
SELECT
    p.id as project_id,
    p.name as project_name,
    c.firstname || ' ' || c.lastname as client_name,
    p.status,
    
    -- Date de début et fin
    p.start_date,
    p.end_date,
    
    -- Durée en jours
    CASE 
        WHEN p.end_date IS NULL OR p.start_date IS NULL THEN NULL
        ELSE (p.end_date - p.start_date)
    END as duration_days,
    
    -- Date de mise à jour
    CURRENT_TIMESTAMP as last_updated
FROM 
    projects p
JOIN 
    clients c ON p.client_id = c.id
ORDER BY 
    p.start_date DESC;

-- Vue matérialisée pour les paiements à venir
CREATE MATERIALIZED VIEW IF NOT EXISTS upcoming_payments_report AS
SELECT
    CURRENT_TIMESTAMP as last_updated;

-- Vue matérialisée pour l'analyse des fournisseurs
CREATE MATERIALIZED VIEW IF NOT EXISTS supplier_analysis_report AS
SELECT
    CURRENT_TIMESTAMP as last_updated;

-- Fonction pour rafraîchir toutes les vues matérialisées
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW financial_dashboard;
    REFRESH MATERIALIZED VIEW overdue_invoices_report;
    REFRESH MATERIALIZED VIEW project_profitability_report;
    REFRESH MATERIALIZED VIEW upcoming_payments_report;
    REFRESH MATERIALIZED VIEW supplier_analysis_report;
END;
$$ LANGUAGE plpgsql;

-- Création d'une tâche planifiée pour rafraîchir les vues matérialisées (nécessite pg_cron)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('0 1 * * *', 'SELECT refresh_all_materialized_views()');

COMMIT;
