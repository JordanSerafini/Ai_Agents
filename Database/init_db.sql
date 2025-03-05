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
            'absence',
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
            'create',
            'creation',
            'update',
            'modification',
            'view',
            'consultation',
            'suppression',
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
            'carte',
            'cheque',
            'virement',
            'especes',
            'prelevement'
        );
    END IF;
END $$;

-- Table des rôles utilisateurs
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertion des rôles par défaut si la table est vide
INSERT INTO roles (name, description)
SELECT 'admin', 'Administrateur avec tous les droits'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'admin');

INSERT INTO roles (name, description)
SELECT 'user', 'Utilisateur standard'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'user');

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    firstname VARCHAR(50) NOT NULL,
    lastname VARCHAR(50) NOT NULL,
    age INTEGER,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_role FOREIGN KEY (role_id) REFERENCES roles(id)
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

-- Création de la table des fournisseurs
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    contact_name VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    website VARCHAR(255),
    notes TEXT,
    payment_terms VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table des catégories de produits
CREATE TABLE IF NOT EXISTS product_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table des produits
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER REFERENCES suppliers(id),
    category_id INTEGER REFERENCES product_categories(id),
    name VARCHAR(255) NOT NULL,
    reference VARCHAR(50),
    description TEXT,
    unit_price DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    min_order_quantity INTEGER DEFAULT 1,
    lead_time_days INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table des catégories d'équipements
CREATE TABLE IF NOT EXISTS equipment_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table des équipements
CREATE TABLE IF NOT EXISTS equipment (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    reference VARCHAR(50),
    category_id INTEGER REFERENCES equipment_categories(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    purchase_date DATE,
    purchase_price DECIMAL(10, 2),
    status VARCHAR(20) DEFAULT 'disponible',
    location VARCHAR(100),
    maintenance_interval INTEGER, -- en jours
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table des réservations d'équipements
CREATE TABLE IF NOT EXISTS equipment_reservations (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER REFERENCES equipment(id),
    project_id INTEGER REFERENCES projects(id),
    staff_id INTEGER REFERENCES staff(id),
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'confirmé',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table des registres de maintenance
CREATE TABLE IF NOT EXISTS maintenance_records (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER REFERENCES equipment(id),
    maintenance_date DATE NOT NULL,
    maintenance_type VARCHAR(50),
    description TEXT,
    cost DECIMAL(10, 2),
    performed_by VARCHAR(100),
    next_maintenance_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    all_day BOOLEAN DEFAULT false,
    location VARCHAR(255),
    project_id INTEGER,
    staff_id INTEGER,
    client_id INTEGER,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_event_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_event_staff FOREIGN KEY (staff_id) REFERENCES staff(id),
    CONSTRAINT fk_event_client FOREIGN KEY (client_id) REFERENCES clients(id)
);

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

-- Création d'une partition pour le mois de mars 2025 (date actuelle dans l'environnement Docker)
CREATE TABLE IF NOT EXISTS activity_logs_y2025m03 PARTITION OF activity_logs
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

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
    tva_rate DECIMAL(5,2) NOT NULL,
    total_ttc DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'brouillon',
    notes TEXT,
    payment_conditions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_invoice_project FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Création de la table des éléments de facture
CREATE TABLE IF NOT EXISTS invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_invoice_item_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id)
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

-- Création de la table des catégories de dépenses
CREATE TABLE IF NOT EXISTS expense_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table des dépenses
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    category_id INTEGER REFERENCES expense_categories(id),
    description TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    expense_date DATE NOT NULL,
    payment_method VARCHAR(50),
    receipt_file VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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

-- Tables spécifiques pour l'assistant IA chatbot

-- Table de connaissances pour le chatbot
CREATE TABLE IF NOT EXISTS knowledge_base (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category VARCHAR(100),
    tags TEXT[],
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('french', question), 'A') || 
        setweight(to_tsvector('french', answer), 'B')
    ) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour la recherche full-text dans la base de connaissances
CREATE INDEX IF NOT EXISTS knowledge_base_search_idx ON knowledge_base USING GIN (search_vector);

-- Table pour stocker l'historique des conversations
CREATE TABLE IF NOT EXISTS chat_history (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    user_id INTEGER,
    user_message TEXT NOT NULL,
    bot_response TEXT NOT NULL,
    intent VARCHAR(100),
    confidence FLOAT,
    entities JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_chat_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Index sur session_id pour accéder rapidement à l'historique d'une conversation
CREATE INDEX IF NOT EXISTS chat_history_session_idx ON chat_history (session_id);
CREATE INDEX IF NOT EXISTS chat_history_user_idx ON chat_history (user_id);

-- Table pour les témoignages clients (utile pour le chatbot)
CREATE TABLE IF NOT EXISTS testimonials (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_testimonial_client FOREIGN KEY (client_id) REFERENCES clients(id),
    CONSTRAINT fk_testimonial_project FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Table pour un glossaire technique
CREATE TABLE IF NOT EXISTS technical_glossary (
    id SERIAL PRIMARY KEY,
    term VARCHAR(100) NOT NULL,
    definition TEXT NOT NULL,
    category VARCHAR(100),
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('french', term), 'A') || 
        setweight(to_tsvector('french', definition), 'B')
    ) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour la recherche full-text dans le glossaire technique
CREATE INDEX IF NOT EXISTS glossary_search_idx ON technical_glossary USING GIN (search_vector);

-- Table pour des services standards
CREATE TABLE IF NOT EXISTS standard_services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100),
    avg_price_min DECIMAL(10,2),
    avg_price_max DECIMAL(10,2),
    avg_duration_days INTEGER,
    details JSONB,
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('french', name), 'A') || 
        setweight(to_tsvector('french', description), 'B') ||
        setweight(to_tsvector('french', category), 'C')
    ) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour la recherche full-text dans les services standards
CREATE INDEX IF NOT EXISTS services_search_idx ON standard_services USING GIN (search_vector);

-- Table pour stocker les intents fréquents des utilisateurs
CREATE TABLE IF NOT EXISTS user_intents (
    id SERIAL PRIMARY KEY,
    intent_name VARCHAR(100) NOT NULL,
    count INTEGER DEFAULT 1,
    examples TEXT[],
    last_detected TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (intent_name)
);

-- Fonction pour suivre et incrémenter les intents utilisateurs
CREATE OR REPLACE FUNCTION track_user_intent(p_intent_name VARCHAR, p_example TEXT)
RETURNS void AS $$
BEGIN
    INSERT INTO user_intents (intent_name, examples)
    VALUES (p_intent_name, ARRAY[p_example])
    ON CONFLICT (intent_name) 
    DO UPDATE SET 
        count = user_intents.count + 1,
        examples = array_append(user_intents.examples, p_example),
        last_detected = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Création de la table des commandes fournisseurs
CREATE TABLE IF NOT EXISTS supplier_orders (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER REFERENCES suppliers(id),
    project_id INTEGER REFERENCES projects(id),
    reference VARCHAR(50),
    order_date DATE NOT NULL,
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    status VARCHAR(20) DEFAULT 'en_attente',
    total_amount DECIMAL(10, 2),
    shipping_cost DECIMAL(10, 2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table des articles de commande
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES supplier_orders(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table des budgets de projets
CREATE TABLE IF NOT EXISTS project_budgets (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    total_budget DECIMAL(12, 2) NOT NULL,
    materials_budget DECIMAL(10, 2),
    labor_budget DECIMAL(10, 2),
    equipment_budget DECIMAL(10, 2),
    subcontractor_budget DECIMAL(10, 2),
    other_budget DECIMAL(10, 2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
