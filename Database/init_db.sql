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
            'chèque',
            'carte_bancaire',
            'espèces',
            'prélèvement',
            'autre'
        );
    END IF;
END $$;

-- Création du type ENUM pour les statuts de commande
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE order_status AS ENUM (
            'en_attente',
            'confirmée',
            'expédiée',
            'livrée',
            'annulée'
        );
    END IF;
END $$;

-- Création du type ENUM pour les statuts d'équipement
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equipment_status') THEN
        CREATE TYPE equipment_status AS ENUM (
            'disponible',
            'en_utilisation',
            'en_maintenance',
            'hors_service'
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_stage_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_stage_staff FOREIGN KEY (staff_id) REFERENCES staff(id)
);

-- Création de la table de liaison projet-matériaux
CREATE TABLE IF NOT EXISTS project_materials (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL,
    quantity_used INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_project_material FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_material_project FOREIGN KEY (material_id) REFERENCES materials(id)
);

-- Création de la table de liaison projet-staff
CREATE TABLE IF NOT EXISTS project_staff (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    staff_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_project_staff FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_staff_project FOREIGN KEY (staff_id) REFERENCES staff(id)
);

-- Création de la table des événements de calendrier
CREATE TABLE IF NOT EXISTS calendar_events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type event_type NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    all_day BOOLEAN DEFAULT false,
    location VARCHAR(255),
    project_id INTEGER,
    staff_id INTEGER,
    client_id INTEGER,
    status VARCHAR(50) DEFAULT 'planifié',
    color VARCHAR(50),
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

-- Création de l'extension pour les vecteurs (pour la recherche sémantique)
CREATE EXTENSION IF NOT EXISTS vector;

-- Table pour stocker les embeddings vectoriels des documents
CREATE TABLE IF NOT EXISTS document_embeddings (
    id SERIAL PRIMARY KEY,
    document_type VARCHAR(50) NOT NULL, -- 'project', 'client', 'quotation', etc.
    document_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),  -- Dimension pour les embeddings OpenAI
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ajout d'index pour la recherche vectorielle
CREATE INDEX IF NOT EXISTS document_embeddings_embedding_idx ON document_embeddings USING ivfflat (embedding vector_cosine_ops);

-- Ajout de colonnes pour les métadonnées et la recherche plein texte
ALTER TABLE projects ADD COLUMN IF NOT EXISTS search_metadata JSONB;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS search_metadata JSONB;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS search_metadata JSONB;
ALTER TABLE stages ADD COLUMN IF NOT EXISTS search_metadata JSONB;

-- Création d'index GIN pour la recherche JSONB
CREATE INDEX IF NOT EXISTS projects_search_metadata_idx ON projects USING GIN (search_metadata);
CREATE INDEX IF NOT EXISTS clients_search_metadata_idx ON clients USING GIN (search_metadata);
CREATE INDEX IF NOT EXISTS quotations_search_metadata_idx ON quotations USING GIN (search_metadata);
CREATE INDEX IF NOT EXISTS stages_search_metadata_idx ON stages USING GIN (search_metadata);

-- Table pour les journaux d'activité (partitionnée par mois)
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER,
    entity_type VARCHAR(50) NOT NULL, -- 'project', 'client', 'quotation', etc.
    entity_id INTEGER NOT NULL,
    activity_type activity_type NOT NULL,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_activity_staff FOREIGN KEY (staff_id) REFERENCES staff(id)
) PARTITION BY RANGE (created_at);

-- Création des partitions initiales pour activity_logs
CREATE TABLE IF NOT EXISTS activity_logs_y2023m12 PARTITION OF activity_logs
    FOR VALUES FROM ('2023-12-01') TO ('2024-01-01');
CREATE TABLE IF NOT EXISTS activity_logs_y2024m01 PARTITION OF activity_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE IF NOT EXISTS activity_logs_y2024m02 PARTITION OF activity_logs
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
CREATE TABLE IF NOT EXISTS activity_logs_y2024m03 PARTITION OF activity_logs
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
CREATE TABLE IF NOT EXISTS activity_logs_y2024m04 PARTITION OF activity_logs
    FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');
CREATE TABLE IF NOT EXISTS activity_logs_y2024m05 PARTITION OF activity_logs
    FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');

-- Table pour les interactions avec l'IA (partitionnée par mois)
CREATE TABLE IF NOT EXISTS ai_interactions (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER,
    query TEXT NOT NULL,
    response TEXT NOT NULL,
    context JSONB,
    feedback INTEGER, -- Score de satisfaction de -1 à 1
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_interaction_staff FOREIGN KEY (staff_id) REFERENCES staff(id)
) PARTITION BY RANGE (created_at);

-- Création des partitions initiales pour ai_interactions
CREATE TABLE IF NOT EXISTS ai_interactions_y2023m12 PARTITION OF ai_interactions
    FOR VALUES FROM ('2023-12-01') TO ('2024-01-01');
CREATE TABLE IF NOT EXISTS ai_interactions_y2024m01 PARTITION OF ai_interactions
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE IF NOT EXISTS ai_interactions_y2024m02 PARTITION OF ai_interactions
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
CREATE TABLE IF NOT EXISTS ai_interactions_y2024m03 PARTITION OF ai_interactions
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
CREATE TABLE IF NOT EXISTS ai_interactions_y2024m04 PARTITION OF ai_interactions
    FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');
CREATE TABLE IF NOT EXISTS ai_interactions_y2024m05 PARTITION OF ai_interactions
    FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');

-- Table pour les suggestions de l'IA
CREATE TABLE IF NOT EXISTS ai_suggestions (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- 'project', 'client', 'quotation', etc.
    entity_id INTEGER NOT NULL,
    suggestion_type VARCHAR(50) NOT NULL, -- 'optimization', 'risk', 'planning', etc.
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
    staff_id INTEGER, -- Utilisateur qui a traité la suggestion
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_suggestion_staff FOREIGN KEY (staff_id) REFERENCES staff(id)
);

-- Index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS activity_logs_entity_idx ON activity_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS activity_logs_staff_idx ON activity_logs (staff_id);
CREATE INDEX IF NOT EXISTS ai_interactions_staff_idx ON ai_interactions (staff_id);
CREATE INDEX IF NOT EXISTS ai_suggestions_entity_idx ON ai_suggestions (entity_type, entity_id);

-- Table pour les documents
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- 'project', 'client', 'quotation', etc.
    entity_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    file_size INTEGER,
    file_type VARCHAR(100),
    document_type document_type,
    description TEXT,
    uploaded_by INTEGER,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_document_staff FOREIGN KEY (uploaded_by) REFERENCES staff(id)
);

-- Table pour les notes et commentaires
CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- 'project', 'client', 'quotation', etc.
    entity_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    staff_id INTEGER,
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_note_staff FOREIGN KEY (staff_id) REFERENCES staff(id)
);

-- Table pour les tags
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table de liaison entité-tag
CREATE TABLE IF NOT EXISTS entity_tags (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- 'project', 'client', 'quotation', etc.
    entity_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_entity_tag FOREIGN KEY (tag_id) REFERENCES tags(id)
);

-- Index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS documents_entity_idx ON documents (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS documents_type_idx ON documents (document_type);
CREATE INDEX IF NOT EXISTS notes_entity_idx ON notes (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS entity_tags_entity_idx ON entity_tags (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS entity_tags_tag_idx ON entity_tags (tag_id);

-- Table pour les factures
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    reference VARCHAR(50) UNIQUE NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    total_ht DECIMAL(10,2) NOT NULL,
    total_tva DECIMAL(10,2) NOT NULL,
    total_ttc DECIMAL(10,2) NOT NULL,
    status invoice_status DEFAULT 'brouillon',
    notes TEXT,
    payment_conditions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_invoice_project FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Table pour les lignes de facture
CREATE TABLE IF NOT EXISTS invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    unit VARCHAR(50),
    tva_rate DECIMAL(5,2) DEFAULT 20.00,
    total_ht DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_invoice_item FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

-- Table pour les paiements
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method payment_method NOT NULL,
    reference VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

-- Table pour les dépenses
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    project_id INTEGER,
    staff_id INTEGER,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT NOT NULL,
    expense_date DATE NOT NULL,
    category VARCHAR(100),
    receipt_path VARCHAR(512),
    is_reimbursable BOOLEAN DEFAULT false,
    is_reimbursed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_expense_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_expense_staff FOREIGN KEY (staff_id) REFERENCES staff(id)
);

-- Table pour le budget des projets
CREATE TABLE IF NOT EXISTS project_budgets (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    category VARCHAR(100) NOT NULL,
    amount_budgeted DECIMAL(10,2) NOT NULL,
    amount_spent DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_budget_project FOREIGN KEY (project_id) REFERENCES projects(id),
    UNIQUE(project_id, category)
);

-- Index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS invoices_project_idx ON invoices (project_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices (status);
CREATE INDEX IF NOT EXISTS payments_invoice_idx ON payments (invoice_id);
CREATE INDEX IF NOT EXISTS expenses_project_idx ON expenses (project_id);
CREATE INDEX IF NOT EXISTS expenses_staff_idx ON expenses (staff_id);
CREATE INDEX IF NOT EXISTS project_budgets_project_idx ON project_budgets (project_id);

-- Table pour les fournisseurs
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    website VARCHAR(255),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table pour les produits des fournisseurs
CREATE TABLE IF NOT EXISTS supplier_products (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    reference VARCHAR(100),
    description TEXT,
    unit VARCHAR(50),
    unit_price DECIMAL(10,2),
    category VARCHAR(100),
    lead_time_days INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- Table pour les commandes fournisseurs
CREATE TABLE IF NOT EXISTS supplier_orders (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER NOT NULL,
    project_id INTEGER,
    reference VARCHAR(100) NOT NULL,
    order_date DATE NOT NULL,
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    status order_status DEFAULT 'en_attente',
    total_amount DECIMAL(10,2),
    shipping_cost DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    CONSTRAINT fk_order_project FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Table pour les lignes de commande
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    product_id INTEGER,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    unit VARCHAR(50),
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_item_order FOREIGN KEY (order_id) REFERENCES supplier_orders(id),
    CONSTRAINT fk_item_product FOREIGN KEY (product_id) REFERENCES supplier_products(id)
);

-- Table pour les évaluations des fournisseurs
CREATE TABLE IF NOT EXISTS supplier_ratings (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER NOT NULL,
    staff_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    rating_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rating_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    CONSTRAINT fk_rating_staff FOREIGN KEY (staff_id) REFERENCES staff(id)
);

-- Index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS suppliers_name_idx ON suppliers (name);
CREATE INDEX IF NOT EXISTS supplier_products_supplier_idx ON supplier_products (supplier_id);
CREATE INDEX IF NOT EXISTS supplier_products_category_idx ON supplier_products (category);
CREATE INDEX IF NOT EXISTS supplier_orders_supplier_idx ON supplier_orders (supplier_id);
CREATE INDEX IF NOT EXISTS supplier_orders_project_idx ON supplier_orders (project_id);
CREATE INDEX IF NOT EXISTS supplier_orders_status_idx ON supplier_orders (status);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);
CREATE INDEX IF NOT EXISTS supplier_ratings_supplier_idx ON supplier_ratings (supplier_id);

-- Table pour les catégories d'équipement
CREATE TABLE IF NOT EXISTS equipment_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table pour les équipements
CREATE TABLE IF NOT EXISTS equipment (
    id SERIAL PRIMARY KEY,
    category_id INTEGER,
    name VARCHAR(255) NOT NULL,
    reference VARCHAR(100),
    serial_number VARCHAR(100),
    purchase_date DATE,
    purchase_price DECIMAL(10,2),
    supplier_id INTEGER,
    status equipment_status DEFAULT 'disponible',
    location VARCHAR(255),
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_equipment_category FOREIGN KEY (category_id) REFERENCES equipment_categories(id),
    CONSTRAINT fk_equipment_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- Table pour les réservations d'équipement
CREATE TABLE IF NOT EXISTS equipment_reservations (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER NOT NULL,
    project_id INTEGER,
    staff_id INTEGER NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reservation_equipment FOREIGN KEY (equipment_id) REFERENCES equipment(id),
    CONSTRAINT fk_reservation_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_reservation_staff FOREIGN KEY (staff_id) REFERENCES staff(id)
);

-- Table pour l'historique de maintenance
CREATE TABLE IF NOT EXISTS maintenance_history (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER NOT NULL,
    maintenance_date DATE NOT NULL,
    description TEXT NOT NULL,
    cost DECIMAL(10,2),
    performed_by VARCHAR(255),
    supplier_id INTEGER,
    next_maintenance_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_maintenance_equipment FOREIGN KEY (equipment_id) REFERENCES equipment(id),
    CONSTRAINT fk_maintenance_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- Table pour les véhicules
CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    license_plate VARCHAR(20) UNIQUE,
    year INTEGER,
    purchase_date DATE,
    purchase_price DECIMAL(10,2),
    status equipment_status DEFAULT 'disponible',
    current_km INTEGER DEFAULT 0,
    last_maintenance_km INTEGER DEFAULT 0,
    next_maintenance_km INTEGER,
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table pour les réservations de véhicules
CREATE TABLE IF NOT EXISTS vehicle_reservations (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL,
    staff_id INTEGER NOT NULL,
    project_id INTEGER,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    purpose TEXT,
    start_km INTEGER,
    end_km INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_vehicle_reservation_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
    CONSTRAINT fk_vehicle_reservation_staff FOREIGN KEY (staff_id) REFERENCES staff(id),
    CONSTRAINT fk_vehicle_reservation_project FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS equipment_category_idx ON equipment (category_id);
CREATE INDEX IF NOT EXISTS equipment_status_idx ON equipment (status);
CREATE INDEX IF NOT EXISTS equipment_supplier_idx ON equipment (supplier_id);
CREATE INDEX IF NOT EXISTS equipment_reservations_equipment_idx ON equipment_reservations (equipment_id);
CREATE INDEX IF NOT EXISTS equipment_reservations_project_idx ON equipment_reservations (project_id);
CREATE INDEX IF NOT EXISTS equipment_reservations_staff_idx ON equipment_reservations (staff_id);
CREATE INDEX IF NOT EXISTS equipment_reservations_date_idx ON equipment_reservations (start_date, end_date);
CREATE INDEX IF NOT EXISTS maintenance_history_equipment_idx ON maintenance_history (equipment_id);
CREATE INDEX IF NOT EXISTS vehicles_status_idx ON vehicles (status);
CREATE INDEX IF NOT EXISTS vehicle_reservations_vehicle_idx ON vehicle_reservations (vehicle_id);
CREATE INDEX IF NOT EXISTS vehicle_reservations_staff_idx ON vehicle_reservations (staff_id);
CREATE INDEX IF NOT EXISTS vehicle_reservations_project_idx ON vehicle_reservations (project_id);
CREATE INDEX IF NOT EXISTS vehicle_reservations_date_idx ON vehicle_reservations (start_date, end_date);

-- Ajout de contraintes de validation pour les emails
ALTER TABLE staff ADD CONSTRAINT valid_staff_email 
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE clients ADD CONSTRAINT valid_client_email 
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE suppliers ADD CONSTRAINT valid_supplier_email 
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Ajout de contraintes de validation pour les numéros de téléphone
ALTER TABLE staff ADD CONSTRAINT valid_staff_phone 
    CHECK (phone ~* '^[0-9+() -]{8,20}$');

ALTER TABLE clients ADD CONSTRAINT valid_client_phone 
    CHECK (phone ~* '^[0-9+() -]{8,20}$');

ALTER TABLE suppliers ADD CONSTRAINT valid_supplier_phone 
    CHECK (phone ~* '^[0-9+() -]{8,20}$');

-- Ajout de contraintes de validation pour les dates
ALTER TABLE projects ADD CONSTRAINT valid_project_dates 
    CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date);

ALTER TABLE stages ADD CONSTRAINT valid_stage_dates 
    CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date);

ALTER TABLE quotations ADD CONSTRAINT valid_quotation_dates 
    CHECK (created_date <= validity_date);

ALTER TABLE invoices ADD CONSTRAINT valid_invoice_dates 
    CHECK (issue_date <= due_date);

ALTER TABLE equipment_reservations ADD CONSTRAINT valid_equipment_reservation_dates 
    CHECK (start_date < end_date);

ALTER TABLE vehicle_reservations ADD CONSTRAINT valid_vehicle_reservation_dates 
    CHECK (start_date < end_date);

-- Ajout de contraintes de validation pour les montants
ALTER TABLE invoices ADD CONSTRAINT valid_invoice_amounts 
    CHECK (total_ht >= 0 AND total_tva >= 0 AND total_ttc >= 0);

ALTER TABLE invoice_items ADD CONSTRAINT valid_invoice_item_amounts 
    CHECK (quantity > 0 AND unit_price >= 0 AND total_ht >= 0);

ALTER TABLE payments ADD CONSTRAINT valid_payment_amount 
    CHECK (amount > 0);

ALTER TABLE expenses ADD CONSTRAINT valid_expense_amount 
    CHECK (amount > 0);

ALTER TABLE project_budgets ADD CONSTRAINT valid_budget_amounts 
    CHECK (amount_budgeted >= 0 AND amount_spent >= 0);

-- Ajout de contraintes de validation pour les notes et évaluations
ALTER TABLE supplier_ratings ADD CONSTRAINT valid_supplier_rating 
    CHECK (rating BETWEEN 1 AND 5);

-- Fonction pour mettre à jour le timestamp updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour créer automatiquement les partitions mensuelles
CREATE OR REPLACE FUNCTION create_partition_and_insert()
RETURNS TRIGGER AS $$
DECLARE
    partition_date TEXT;
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    start_date := date_trunc('month', NEW.created_at)::date;
    end_date := (start_date + interval '1 month')::date;
    partition_date := to_char(NEW.created_at, 'y"y"YYYY"m"MM');
    partition_name := TG_TABLE_NAME || '_' || partition_date;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = partition_name) THEN
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I
                        FOR VALUES FROM (%L) TO (%L)',
                        partition_name, TG_TABLE_NAME, start_date, end_date);
                        
        -- Création d'index sur la partition
        IF TG_TABLE_NAME = 'activity_logs' THEN
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (entity_type, entity_id)',
                          partition_name || '_entity_idx', partition_name);
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (staff_id)',
                          partition_name || '_staff_idx', partition_name);
        ELSIF TG_TABLE_NAME = 'ai_interactions' THEN
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (staff_id)',
                          partition_name || '_staff_idx', partition_name);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour nettoyer les anciennes données d'embeddings
CREATE OR REPLACE FUNCTION clean_old_embeddings()
RETURNS void AS $$
BEGIN
    -- Supprimer les embeddings de plus de 6 mois qui ne sont plus référencés
    DELETE FROM document_embeddings
    WHERE created_at < (CURRENT_DATE - INTERVAL '6 months')
    AND NOT EXISTS (
        SELECT 1 FROM ai_interactions
        WHERE context::jsonb ? ('document_id_' || document_embeddings.id)
    );
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour automatiquement le statut des factures
CREATE OR REPLACE FUNCTION update_invoice_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Mettre à jour le statut de la facture en fonction des paiements
    UPDATE invoices
    SET status = CASE
        WHEN (SELECT SUM(amount) FROM payments WHERE invoice_id = NEW.invoice_id) >= total_ttc 
            THEN 'payée'::invoice_status
        WHEN (SELECT SUM(amount) FROM payments WHERE invoice_id = NEW.invoice_id) > 0 
            THEN 'payée_partiellement'::invoice_status
        ELSE status
    END,
    updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.invoice_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour automatiquement le statut des équipements
CREATE OR REPLACE FUNCTION update_equipment_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Vérifier s'il y a des réservations actives pour cet équipement
    IF EXISTS (
        SELECT 1 FROM equipment_reservations
        WHERE equipment_id = NEW.equipment_id
        AND start_date <= CURRENT_TIMESTAMP
        AND end_date >= CURRENT_TIMESTAMP
    ) THEN
        UPDATE equipment
        SET status = 'en_utilisation'::equipment_status,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.equipment_id
        AND status = 'disponible';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Création des triggers pour updated_at
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE '%_y20%'  -- Exclure les tables de partition
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_updated_at_trigger ON %I;
            CREATE TRIGGER update_updated_at_trigger
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        ', t, t);
    END LOOP;
END;
$$;

-- Création des triggers pour les partitions automatiques
CREATE TRIGGER activity_logs_insert_trigger
BEFORE INSERT ON activity_logs
FOR EACH ROW
EXECUTE FUNCTION create_partition_and_insert();

CREATE TRIGGER ai_interactions_insert_trigger
BEFORE INSERT ON ai_interactions
FOR EACH ROW
EXECUTE FUNCTION create_partition_and_insert();

-- Création du trigger pour la mise à jour du statut des factures
CREATE TRIGGER payment_insert_trigger
AFTER INSERT OR UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_invoice_status();

-- Création du trigger pour la mise à jour du statut des équipements
CREATE TRIGGER equipment_reservation_trigger
AFTER INSERT OR UPDATE ON equipment_reservations
FOR EACH ROW
EXECUTE FUNCTION update_equipment_status();

-- Création d'une tâche planifiée pour nettoyer les anciens embeddings
-- Note: Ceci nécessite l'extension pg_cron
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('0 3 * * 0', 'SELECT clean_old_embeddings()');

-- Table pour les paramètres système et configurations
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    is_editable BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertion des paramètres par défaut
INSERT INTO system_settings (key, value, description, is_editable) VALUES
    ('company_info', '{"name": "Votre Entreprise BTP", "address": "123 Rue de la Construction", "phone": "+33123456789", "email": "contact@entreprisebtp.fr", "website": "https://www.entreprisebtp.fr", "logo_url": "/assets/logo.png", "siret": "12345678901234", "tva": "FR12345678901"}', 'Informations de l''entreprise utilisées dans les documents', true),
    ('invoice_settings', '{"prefix": "FACT-", "next_number": 1, "payment_delay_days": 30, "default_tva_rate": 20, "footer_text": "Merci pour votre confiance", "payment_instructions": "Paiement par virement bancaire"}', 'Paramètres pour la génération des factures', true),
    ('quotation_settings', '{"prefix": "DEV-", "next_number": 1, "validity_days": 30, "default_tva_rate": 20, "footer_text": "Nous restons à votre disposition pour tout renseignement complémentaire"}', 'Paramètres pour la génération des devis', true),
    ('notification_settings', '{"email_notifications": true, "sms_notifications": false, "invoice_reminders": true, "project_updates": true, "maintenance_alerts": true}', 'Paramètres pour les notifications système', true),
    ('ai_settings', '{"embedding_model": "text-embedding-ada-002", "embedding_dimension": 1536, "similarity_threshold": 0.75, "max_context_length": 4000, "default_temperature": 0.7}', 'Paramètres pour l''assistant IA', true),
    ('security_settings', '{"password_expiry_days": 90, "session_timeout_minutes": 30, "failed_login_attempts": 5, "two_factor_auth": false}', 'Paramètres de sécurité', true),
    ('system_version', '{"version": "1.0.0", "db_schema_version": "1.0.0", "last_update": "2023-12-01"}', 'Version du système', false);

-- Fonction pour obtenir un paramètre système
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

-- Vue matérialisée pour le tableau de bord financier
CREATE MATERIALIZED VIEW IF NOT EXISTS financial_dashboard AS
SELECT
    -- Statistiques globales
    (SELECT COUNT(*) FROM projects WHERE status = 'en_cours') as active_projects_count,
    (SELECT COUNT(*) FROM projects WHERE status = 'termine') as completed_projects_count,
    
    -- Statistiques de facturation
    (SELECT COUNT(*) FROM invoices) as total_invoices_count,
    (SELECT COUNT(*) FROM invoices WHERE status = 'payée') as paid_invoices_count,
    (SELECT COUNT(*) FROM invoices WHERE status = 'en_retard') as overdue_invoices_count,
    (SELECT COALESCE(SUM(total_ttc), 0) FROM invoices) as total_invoiced_amount,
    (SELECT COALESCE(SUM(total_ttc), 0) FROM invoices WHERE status = 'payée') as total_paid_amount,
    (SELECT COALESCE(SUM(total_ttc), 0) FROM invoices WHERE status = 'en_retard') as total_overdue_amount,
    
    -- Statistiques de paiement
    (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payment_date >= CURRENT_DATE - INTERVAL '30 days') as payments_last_30_days,
    (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payment_date >= CURRENT_DATE - INTERVAL '90 days') as payments_last_90_days,
    
    -- Statistiques de dépenses
    (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE expense_date >= CURRENT_DATE - INTERVAL '30 days') as expenses_last_30_days,
    (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE expense_date >= CURRENT_DATE - INTERVAL '90 days') as expenses_last_90_days,
    
    -- Date de mise à jour
    CURRENT_TIMESTAMP as last_updated;

-- Vue matérialisée pour les factures en retard
CREATE MATERIALIZED VIEW IF NOT EXISTS overdue_invoices_report AS
SELECT
    i.id as invoice_id,
    i.reference as invoice_reference,
    i.issue_date,
    i.due_date,
    i.total_ttc as invoice_amount,
    COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.id), 0) as paid_amount,
    i.total_ttc - COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.id), 0) as remaining_amount,
    CURRENT_DATE - i.due_date as days_overdue,
    p.id as project_id,
    p.name as project_name,
    CONCAT(c.firstname, ' ', c.lastname) as client_name,
    c.email as client_email,
    c.phone as client_phone
FROM invoices i
JOIN projects p ON i.project_id = p.id
JOIN clients c ON p.client_id = c.id
WHERE i.status NOT IN ('payée', 'annulée') 
  AND i.due_date < CURRENT_DATE
ORDER BY days_overdue DESC;

-- Vue matérialisée pour la rentabilité des projets
CREATE MATERIALIZED VIEW IF NOT EXISTS project_profitability_report AS
SELECT
    p.id as project_id,
    p.name as project_name,
    p.status,
    CONCAT(c.firstname, ' ', c.lastname) as client_name,
    
    -- Revenus (factures)
    COALESCE((SELECT SUM(total_ht) FROM invoices WHERE project_id = p.id), 0) as invoiced_amount,
    COALESCE((SELECT SUM(amount) FROM payments JOIN invoices ON payments.invoice_id = invoices.id WHERE invoices.project_id = p.id), 0) as received_amount,
    
    -- Dépenses
    COALESCE((SELECT SUM(amount) FROM expenses WHERE project_id = p.id), 0) as expenses_amount,
    
    -- Coûts matériaux
    COALESCE((
        SELECT SUM(m.price * pm.quantity_used)
        FROM project_materials pm
        JOIN materials m ON pm.material_id = m.id
        WHERE pm.project_id = p.id
    ), 0) as materials_cost,
    
    -- Coûts commandes fournisseurs
    COALESCE((
        SELECT SUM(so.total_amount)
        FROM supplier_orders so
        WHERE so.project_id = p.id
    ), 0) as supplier_orders_cost,
    
    -- Calcul de la marge
    COALESCE((SELECT SUM(total_ht) FROM invoices WHERE project_id = p.id), 0) - 
    (
        COALESCE((SELECT SUM(amount) FROM expenses WHERE project_id = p.id), 0) +
        COALESCE((
            SELECT SUM(m.price * pm.quantity_used)
            FROM project_materials pm
            JOIN materials m ON pm.material_id = m.id
            WHERE pm.project_id = p.id
        ), 0) +
        COALESCE((
            SELECT SUM(so.total_amount)
            FROM supplier_orders so
            WHERE so.project_id = p.id
        ), 0)
    ) as estimated_margin,
    
    -- Pourcentage de marge
    CASE 
        WHEN COALESCE((SELECT SUM(total_ht) FROM invoices WHERE project_id = p.id), 0) = 0 THEN 0
        ELSE (
            (COALESCE((SELECT SUM(total_ht) FROM invoices WHERE project_id = p.id), 0) - 
            (
                COALESCE((SELECT SUM(amount) FROM expenses WHERE project_id = p.id), 0) +
                COALESCE((
                    SELECT SUM(m.price * pm.quantity_used)
                    FROM project_materials pm
                    JOIN materials m ON pm.material_id = m.id
                    WHERE pm.project_id = p.id
                ), 0) +
                COALESCE((
                    SELECT SUM(so.total_amount)
                    FROM supplier_orders so
                    WHERE so.project_id = p.id
                ), 0)
            )) / COALESCE((SELECT SUM(total_ht) FROM invoices WHERE project_id = p.id), 0) * 100
        END as margin_percentage,
    
    p.start_date,
    p.end_date,
    CURRENT_TIMESTAMP as last_updated
FROM projects p
JOIN clients c ON p.client_id = c.id
ORDER BY margin_percentage DESC;

-- Vue matérialisée pour les paiements à venir
CREATE MATERIALIZED VIEW IF NOT EXISTS upcoming_payments_report AS
SELECT
    i.id as invoice_id,
    i.reference as invoice_reference,
    i.issue_date,
    i.due_date,
    i.total_ttc as invoice_amount,
    COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.id), 0) as paid_amount,
    i.total_ttc - COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.id), 0) as remaining_amount,
    i.due_date - CURRENT_DATE as days_until_due,
    p.id as project_id,
    p.name as project_name,
    CONCAT(c.firstname, ' ', c.lastname) as client_name,
    c.email as client_email,
    c.phone as client_phone
FROM invoices i
JOIN projects p ON i.project_id = p.id
JOIN clients c ON p.client_id = c.id
WHERE i.status NOT IN ('payée', 'annulée') 
  AND i.due_date >= CURRENT_DATE
  AND i.due_date <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY days_until_due ASC;

-- Vue matérialisée pour l'analyse des fournisseurs
CREATE MATERIALIZED VIEW IF NOT EXISTS supplier_analysis_report AS
SELECT
    s.id as supplier_id,
    s.name as supplier_name,
    s.contact_name,
    s.email,
    s.phone,
    
    -- Statistiques commandes
    COUNT(so.id) as total_orders,
    COALESCE(SUM(so.total_amount), 0) as total_ordered_amount,
    
    -- Délais de livraison moyens
    AVG(
        CASE 
            WHEN so.actual_delivery_date IS NOT NULL AND so.order_date IS NOT NULL 
            THEN so.actual_delivery_date - so.order_date 
            ELSE NULL 
        END
    ) as avg_delivery_days,
    
    -- Retards moyens
    AVG(
        CASE 
            WHEN so.actual_delivery_date IS NOT NULL AND so.expected_delivery_date IS NOT NULL AND so.actual_delivery_date > so.expected_delivery_date
            THEN so.actual_delivery_date - so.expected_delivery_date
            ELSE 0
        END
    ) as avg_delay_days,
    
    -- Pourcentage de commandes en retard
    CASE 
        WHEN COUNT(so.id) = 0 THEN 0
        ELSE (
            COUNT(
                CASE 
                    WHEN so.actual_delivery_date IS NOT NULL AND so.expected_delivery_date IS NOT NULL AND so.actual_delivery_date > so.expected_delivery_date
                    THEN 1
                    ELSE NULL
                END
            )::float / COUNT(so.id)
        ) * 100
    END as late_delivery_percentage,
    
    -- Note moyenne
    COALESCE(
        (SELECT AVG(rating) FROM supplier_ratings WHERE supplier_id = s.id),
        0
    ) as avg_rating,
    
    -- Nombre d'évaluations
    COALESCE(
        (SELECT COUNT(*) FROM supplier_ratings WHERE supplier_id = s.id),
        0
    ) as rating_count,
    
    -- Dernière commande
    (
        SELECT MAX(order_date)
        FROM supplier_orders
        WHERE supplier_id = s.id
    ) as last_order_date,
    
    CURRENT_TIMESTAMP as last_updated
FROM suppliers s
LEFT JOIN supplier_orders so ON s.id = so.supplier_id
GROUP BY s.id, s.name, s.contact_name, s.email, s.phone
ORDER BY total_ordered_amount DESC;

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
