BEGIN;

-- Ajout de l'extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ajout de l'extension pgvector pour les embeddings
CREATE EXTENSION IF NOT EXISTS "vector";

-- Ajout de l'extension pg_trgm pour la fonction similarity
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Suppression des vues matérialisées existantes si elles existent
DROP MATERIALIZED VIEW IF EXISTS financial_dashboard;
DROP MATERIALIZED VIEW IF EXISTS project_profitability_report;

-- Création du type ENUM pour la catégorie des produits des devis
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_category') THEN
        CREATE TYPE product_category AS ENUM ('matériaux', 'main_doeuvre', 'transport', 'autres');
    END IF;
END $$;

-- Tables de référence pour remplacer les ENUMs
CREATE TABLE IF NOT EXISTS ref_status (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    entity_type TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (code, entity_type)
);

-- Tables de référence pour les commandes fournisseurs
CREATE TABLE IF NOT EXISTS ref_supplier_order_status (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tables de référence pour l'état des équipements
CREATE TABLE IF NOT EXISTS ref_equipment_status (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tables de référence pour les points de contrôle qualité
CREATE TABLE IF NOT EXISTS ref_quality_checkpoint_status (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tables de référence pour les demandes de matériaux
CREATE TABLE IF NOT EXISTS ref_material_request_status (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tables de référence pour le suivi d'équipement
CREATE TABLE IF NOT EXISTS ref_equipment_condition (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tables de référence pour les notes de chantier
CREATE TABLE IF NOT EXISTS ref_note_types (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ref_note_priorities (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ref_note_status (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tables de référence pour les devis
CREATE TABLE IF NOT EXISTS ref_quotation_status (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tables de référence pour les événements
CREATE TABLE IF NOT EXISTS ref_event_types (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    icon TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tables de référence pour les méthodes de paiement
CREATE TABLE IF NOT EXISTS ref_payment_methods (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tables de référence pour les catégories de produits
CREATE TABLE IF NOT EXISTS ref_product_categories (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table addresses normalisée avant de l'utiliser
CREATE TABLE IF NOT EXISTS addresses (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    street_number VARCHAR(10),
    street_name VARCHAR(255) NOT NULL,
    zip_code VARCHAR(10) NOT NULL,
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) DEFAULT 'France',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table des rôles utilisateurs
CREATE TABLE IF NOT EXISTS roles (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insertion des rôles par défaut si la table est vide
INSERT INTO roles (name, description)
SELECT 'admin', 'Administrateur avec tous les droits'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'admin');

INSERT INTO roles (name, description)
SELECT 'user', 'Utilisateur standard'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'user');

-- Table des utilisateurs avec contraintes améliorées
CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firstname TEXT NOT NULL,
    lastname TEXT NOT NULL,
    age INTEGER,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role_id uuid NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT email_format CHECK (email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'),
    CONSTRAINT age_check CHECK (age IS NULL OR age >= 18)
);

-- Création de la table des utilisateurs (staff)
CREATE TABLE IF NOT EXISTS staff (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firstname VARCHAR(100) NOT NULL,
    lastname VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    is_available BOOLEAN DEFAULT true,
    address_id uuid REFERENCES addresses(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT staff_email_format CHECK (email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$')
);

-- Création de la table des clients
CREATE TABLE IF NOT EXISTS clients (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firstname VARCHAR(100) NOT NULL,
    lastname VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    address_id uuid REFERENCES addresses(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    embedding vector(1536),
    CONSTRAINT client_email_format CHECK (email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$')
);

CREATE TABLE IF NOT EXISTS projects (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id uuid NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    status uuid REFERENCES ref_status(id),
    address_id uuid REFERENCES addresses(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    search_metadata JSONB,
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('french', coalesce(name, '')), 'A') ||
        setweight(to_tsvector('french', coalesce(description, '')), 'B')
    ) STORED,
    embedding vector(1536),
    CONSTRAINT fk_project_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    CONSTRAINT valid_dates CHECK (
        (start_date IS NULL AND end_date IS NULL) OR
        (start_date IS NOT NULL AND end_date IS NULL) OR
        (start_date IS NOT NULL AND end_date IS NOT NULL AND end_date >= start_date)
    )
);

-- Insertion des données de référence pour les statuts
INSERT INTO ref_status (code, name, description, entity_type, display_order) VALUES
('prospect', 'Prospect', 'Projet en phase de prospection', 'project', 1),
('en_cours', 'En cours', 'Projet actif', 'project', 2),
('termine', 'Terminé', 'Projet terminé', 'project', 3),
('en_pause', 'En pause', 'Projet temporairement suspendu', 'project', 4),
('annule', 'Annulé', 'Projet annulé', 'project', 5),
('brouillon', 'Brouillon', 'Facture en cours de rédaction', 'invoice', 1),
('envoyée', 'Envoyée', 'Facture envoyée au client', 'invoice', 2),
('payée_partiellement', 'Payée partiellement', 'Facture partiellement payée', 'invoice', 3),
('payée', 'Payée', 'Facture entièrement payée', 'invoice', 4),
('en_retard', 'En retard', 'Facture en retard de paiement', 'invoice', 5),
('annulée', 'Annulée', 'Facture annulée', 'invoice', 6),
('en_attente', 'En attente', 'Étape en attente de démarrage', 'stage', 1),
('en_cours', 'En cours', 'Étape en cours de réalisation', 'stage', 2),
('termine', 'Terminée', 'Étape terminée', 'stage', 3),
('en_pause', 'En pause', 'Étape temporairement suspendue', 'stage', 4),
('annule', 'Annulée', 'Étape annulée', 'stage', 5),
('à_commander', 'À commander', 'Matériau à commander', 'material', 1),
('commandé', 'Commandé', 'Matériau commandé', 'material', 2),
('livré', 'Livré', 'Matériau livré', 'material', 3),
('utilisé', 'Utilisé', 'Matériau utilisé', 'material', 4),
('retourné', 'Retourné', 'Matériau retourné', 'material', 5),
('modification', 'Modification', 'Note concernant une modification du projet', 'site_note', 1),
('technique', 'Technique', 'Note technique', 'site_note', 2),
('client', 'Client', 'Note concernant le client', 'site_note', 3),
('probleme', 'Problème', 'Note concernant un problème', 'site_note', 4),
('installation', 'Installation', 'Note concernant une installation', 'site_note', 5),
('basse', 'Basse', 'Priorité basse', 'site_note_priority', 1),
('moyenne', 'Moyenne', 'Priorité moyenne', 'site_note_priority', 2),
('haute', 'Haute', 'Priorité haute', 'site_note_priority', 3),
('nouveau', 'Nouveau', 'Note nouvellement créée', 'site_note_status', 1),
('en_cours', 'En cours', 'Note en cours de traitement', 'site_note_status', 2),
('termine', 'Terminé', 'Note terminée', 'site_note_status', 3),
('annule', 'Annulé', 'Note annulée', 'site_note_status', 4)
ON CONFLICT (code, entity_type) DO NOTHING;

-- Insertion des données de référence pour les statuts de devis
INSERT INTO ref_quotation_status (code, name, description, display_order) VALUES
('en_attente', 'En attente', 'Devis en attente de réponse', 1),
('accepté', 'Accepté', 'Devis accepté par le client', 2),
('refusé', 'Refusé', 'Devis refusé par le client', 3)
ON CONFLICT (code) DO NOTHING;

-- Insertion des données de référence pour les catégories de produits
INSERT INTO ref_product_categories (code, name, description, display_order) VALUES
('matériaux', 'Matériaux', 'Matériaux utilisés dans les projets', 1),
('main_doeuvre', 'Main d''œuvre', 'Coûts liés à la main d''œuvre', 2),
('transport', 'Transport', 'Frais de transport associés', 3),
('autres', 'Autres', 'Autres catégories de produits', 4)
ON CONFLICT (code) DO NOTHING;


-- Création de la table des fournisseurs
CREATE TABLE IF NOT EXISTS suppliers (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    contact_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    address_id uuid REFERENCES addresses(id),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- Création de la table des commandes fournisseurs
CREATE TABLE IF NOT EXISTS supplier_orders (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id uuid REFERENCES suppliers(id),
    project_id uuid REFERENCES projects(id),
    reference VARCHAR(50),
    order_date DATE NOT NULL,
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    status uuid REFERENCES ref_supplier_order_status(id),
    total_amount DECIMAL(10, 2),
    shipping_cost DECIMAL(10, 2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insertion des données de référence pour les statuts de commande fournisseur
INSERT INTO ref_supplier_order_status (code, name, description, display_order) VALUES
('en_attente', 'En attente', 'Commande en attente de traitement', 1),
('commandé', 'Commandé', 'Commande passée au fournisseur', 2),
('en_transit', 'En transit', 'Commande en cours de livraison', 3),
('livré', 'Livré', 'Commande livrée', 4),
('annulé', 'Annulé', 'Commande annulée', 5)
ON CONFLICT (code) DO NOTHING;

-- Insertion des données de référence pour les statuts d'équipement
INSERT INTO ref_equipment_status (code, name, description, display_order) VALUES
('disponible', 'Disponible', 'Équipement disponible', 1),
('en_utilisation', 'En utilisation', 'Équipement en cours d''utilisation', 2),
('maintenance', 'En maintenance', 'Équipement en maintenance', 3),
('hors_service', 'Hors service', 'Équipement hors service', 4)
ON CONFLICT (code) DO NOTHING;

-- Insertion des données de référence pour les statuts de point de contrôle qualité
INSERT INTO ref_quality_checkpoint_status (code, name, description, display_order) VALUES
('à_faire', 'À faire', 'Point de contrôle à réaliser', 1),
('en_cours', 'En cours', 'Point de contrôle en cours', 2),
('validé', 'Validé', 'Point de contrôle validé', 3),
('rejeté', 'Rejeté', 'Point de contrôle rejeté', 4)
ON CONFLICT (code) DO NOTHING;

-- Insertion des données de référence pour les statuts de demande de matériaux
INSERT INTO ref_material_request_status (code, name, description, display_order) VALUES
('pending', 'En attente', 'Demande en attente de validation', 1),
('approved', 'Approuvée', 'Demande approuvée', 2),
('delivered', 'Livrée', 'Matériaux livrés', 3),
('partially_delivered', 'Partiellement livrée', 'Livraison partielle effectuée', 4)
ON CONFLICT (code) DO NOTHING;

-- Insertion des données de référence pour les conditions d'équipement
INSERT INTO ref_equipment_condition (code, name, description, display_order) VALUES
('excellent', 'Excellent', 'Équipement en parfait état', 1),
('bon', 'Bon', 'Équipement en bon état', 2),
('acceptable', 'Acceptable', 'Équipement en état acceptable', 3),
('mauvais', 'Mauvais', 'Équipement en mauvais état', 4)
ON CONFLICT (code) DO NOTHING;

-- Création de la table des notes de chantier
CREATE TABLE IF NOT EXISTS site_notes (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    note_type uuid REFERENCES ref_note_types(id),
    content TEXT NOT NULL,
    priority uuid REFERENCES ref_note_priorities(id),
    status uuid REFERENCES ref_note_status(id),
    photos TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_site_note_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_site_note_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- Suppression des anciennes entrées de ref_status pour les notes
DELETE FROM ref_status WHERE entity_type IN ('site_note', 'site_note_priority', 'site_note_status');

-- Récupération de l'ID du statut 'prospect' pour l'utiliser comme valeur par défaut
DO $$
DECLARE
    prospect_id uuid;
BEGIN
    SELECT id INTO prospect_id FROM ref_status WHERE code = 'prospect' AND entity_type = 'project' LIMIT 1;
    
    -- Modification de la table des projets pour utiliser la table de référence des statuts
    EXECUTE format('ALTER TABLE projects ALTER COLUMN status SET DEFAULT %L::uuid', prospect_id);
END $$;

-- Modification des tables financières pour utiliser NUMERIC(12,2)
CREATE TABLE IF NOT EXISTS invoices (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id uuid NOT NULL,
    reference TEXT UNIQUE NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    total_ht NUMERIC(12,2) NOT NULL,
    tva_rate NUMERIC(5,2) NOT NULL,
    total_ttc NUMERIC(12,2) NOT NULL,
    status uuid REFERENCES ref_status(id),
    notes TEXT,
    payment_conditions TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    embedding vector(1536),
    CONSTRAINT fk_invoice_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_invoice_status FOREIGN KEY (status) REFERENCES ref_status(id),
    CONSTRAINT positive_amounts CHECK (total_ht >= 0 AND total_ttc >= 0),
    CONSTRAINT valid_tva CHECK (tva_rate >= 0 AND tva_rate <= 100)
);

-- Création de la table des éléments de facture
CREATE TABLE IF NOT EXISTS invoice_items (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id uuid NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_invoice_item_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

-- Modification de la table des paiements
CREATE TABLE IF NOT EXISTS payments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id uuid NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method uuid REFERENCES ref_payment_methods(id),
    reference TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    CONSTRAINT positive_payment CHECK (amount > 0)
);

-- Création de la table des catégories de dépenses
CREATE TABLE IF NOT EXISTS expense_categories (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table des dépenses
CREATE TABLE IF NOT EXISTS expenses (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id uuid REFERENCES projects(id),
    category_id uuid REFERENCES expense_categories(id),
    description TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    expense_date DATE NOT NULL,
    payment_method uuid REFERENCES ref_payment_methods(id),
    receipt_file VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table des feuilles de temps
CREATE TABLE IF NOT EXISTS timesheet_entries (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    date DATE NOT NULL,
    hours DECIMAL(5,2) NOT NULL,
    hourly_rate DECIMAL(10,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_timesheet_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_timesheet_staff FOREIGN KEY (staff_id) REFERENCES staff(id)
);

CREATE TABLE IF NOT EXISTS equipment (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    purchase_date DATE,
    purchase_price NUMERIC(10,2),
    status uuid REFERENCES ref_equipment_status(id),
    supplier_id uuid REFERENCES suppliers(id),
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table des produits
CREATE TABLE IF NOT EXISTS products (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id uuid REFERENCES suppliers(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    reference VARCHAR(50),
    unit_price DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    category TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table des articles de commande
CREATE TABLE IF NOT EXISTS order_items (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id uuid REFERENCES supplier_orders(id),
    product_id uuid REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table des budgets de projets
CREATE TABLE IF NOT EXISTS project_budgets (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id uuid REFERENCES projects(id),
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

-- Création de la table d'audit
CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    record_id uuid NOT NULL,
    action TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_by uuid REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Fonction pour l'audit avec gestion de l'utilisateur courant
CREATE OR REPLACE FUNCTION log_changes()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id uuid;
BEGIN
    -- Récupération de l'ID de l'utilisateur courant
    BEGIN
        current_user_id := current_setting('app.current_user_id', true)::uuid;
    EXCEPTION WHEN OTHERS THEN
        -- Si la variable n'est pas définie, on utilise NULL
        current_user_id := NULL;
    END;

    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (
        TG_TABLE_NAME,
        CASE TG_OP
            WHEN 'DELETE' THEN OLD.id
            ELSE NEW.id
        END,
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(OLD) END,
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
        current_user_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Création de la table des devis
CREATE TABLE IF NOT EXISTS quotations (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id uuid NOT NULL,
    reference TEXT UNIQUE NOT NULL,
    issue_date DATE NOT NULL,
    validity_date DATE NOT NULL,
    total_ht NUMERIC(12,2) NOT NULL,
    tva_rate NUMERIC(5,2) NOT NULL,
    total_ttc NUMERIC(12,2) NOT NULL,
    status uuid REFERENCES ref_quotation_status(id),
    notes TEXT,
    payment_conditions TEXT,
    is_active BOOLEAN DEFAULT true,
    modified_by uuid,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    search_metadata JSONB,
    embedding vector(1536),
    CONSTRAINT fk_quotation_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT positive_amounts CHECK (total_ht >= 0 AND total_ttc >= 0),
    CONSTRAINT valid_tva CHECK (tva_rate >= 0 AND tva_rate <= 100)
);

-- Création de la table des produits de devis
CREATE TABLE IF NOT EXISTS quotation_products (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_id uuid NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    category uuid,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_quotation_product_quotation FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
);

-- Ajout des triggers d'audit sur les tables principales
CREATE TRIGGER projects_audit
    AFTER INSERT OR UPDATE OR DELETE ON projects
    FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TRIGGER clients_audit
    AFTER INSERT OR UPDATE OR DELETE ON clients
    FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TRIGGER quotations_audit
    AFTER INSERT OR UPDATE OR DELETE ON quotations
    FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TRIGGER invoices_audit
    AFTER INSERT OR UPDATE OR DELETE ON invoices
    FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TRIGGER payments_audit
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TRIGGER staff_audit
    AFTER INSERT OR UPDATE OR DELETE ON staff
    FOR EACH ROW EXECUTE FUNCTION log_changes();

-- Création de la table des journaux d'activité
CREATE TABLE IF NOT EXISTS activity_logs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES users(id),
    activity_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id uuid,
    description TEXT,
    metadata JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table des étapes de projet
CREATE TABLE IF NOT EXISTS stages (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id uuid NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    status uuid REFERENCES ref_status(id),
    completion_percentage INTEGER DEFAULT 0,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_stage_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_stage_status FOREIGN KEY (status) REFERENCES ref_status(id),
    CONSTRAINT valid_percentage CHECK (completion_percentage >= 0 AND completion_percentage <= 100)
);

-- Création de la table des affectations de personnel aux projets
CREATE TABLE IF NOT EXISTS project_staff (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    role VARCHAR(50) NOT NULL,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_project_staff_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_project_staff_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    CONSTRAINT unique_project_staff_role UNIQUE (project_id, staff_id, role)
);

-- Création de la table des matériaux
CREATE TABLE IF NOT EXISTS materials (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    unit VARCHAR(20) NOT NULL,
    unit_price DECIMAL(10,2),
    supplier_id uuid REFERENCES suppliers(id),
    category VARCHAR(50),
    stock_quantity DECIMAL(10,2) DEFAULT 0,
    minimum_stock DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- Création de la table des matériaux de projet
CREATE TABLE IF NOT EXISTS project_materials (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id uuid NOT NULL,
    material_name VARCHAR(100) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    unit_price DECIMAL(10,2),
    total_price DECIMAL(10,2),
    supplier_id uuid REFERENCES suppliers(id),
    delivery_date DATE,
    status uuid REFERENCES ref_status(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_project_material_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_material_status FOREIGN KEY (status) REFERENCES ref_status(id)
);



-- Création de la table des événements de calendrier
CREATE TABLE IF NOT EXISTS calendar_events (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(100) NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    all_day BOOLEAN DEFAULT false,
    event_type uuid REFERENCES ref_event_types(id),
    project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
    staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
    location TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_site_reports (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    weather_conditions VARCHAR(50),
    temperature INTEGER,
    hours_worked DECIMAL(5,2),
    work_done TEXT,
    issues_encountered TEXT,
    materials_used JSONB,
    next_day_planning TEXT,
    staff_id uuid REFERENCES staff(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table des points de contrôle qualité
CREATE TABLE IF NOT EXISTS quality_checkpoints (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    stage_id uuid REFERENCES stages(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    deadline DATE,
    status uuid REFERENCES ref_quality_checkpoint_status(id),
    notes TEXT,
    completed_by uuid REFERENCES staff(id),
    completed_at DATE,
    required_photos BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index optimisés pour les recherches fréquentes
CREATE INDEX users_email_role_idx ON users(email, role_id);
CREATE INDEX clients_email_idx ON clients(email);
CREATE INDEX projects_status_idx ON projects(status);
CREATE INDEX projects_client_id_idx ON projects(client_id);
CREATE INDEX activity_logs_user_date_idx ON activity_logs(user_id, created_at DESC);
CREATE INDEX quotations_project_id_idx ON quotations(project_id);
CREATE INDEX invoices_project_id_idx ON invoices(project_id);
CREATE INDEX invoices_status_idx ON invoices(status);
CREATE INDEX invoices_due_date_idx ON invoices(due_date);
CREATE INDEX payments_invoice_id_idx ON payments(invoice_id);
CREATE INDEX payments_date_idx ON payments(payment_date);
CREATE INDEX stages_project_id_idx ON stages(project_id);
CREATE INDEX project_staff_project_id_idx ON project_staff(project_id);
CREATE INDEX project_staff_staff_id_idx ON project_staff(staff_id);
CREATE INDEX calendar_events_start_date_idx ON calendar_events(start_date);
CREATE INDEX calendar_events_project_id_idx ON calendar_events(project_id);
CREATE INDEX timesheet_entries_project_staff_idx ON timesheet_entries(project_id, staff_id);

-- Création des rôles de sécurité
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_read_only') THEN
        CREATE ROLE app_read_only;
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_admin') THEN
        CREATE ROLE app_admin;
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_project_manager') THEN
        CREATE ROLE app_project_manager;
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_accountant') THEN
        CREATE ROLE app_accountant;
    END IF;
END
$$;

-- Révocation de tous les privilèges existants
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM app_read_only, app_admin, app_project_manager, app_accountant;

-- Attribution des permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_read_only;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_admin;

-- Permissions pour les gestionnaires de projet
GRANT SELECT, INSERT, UPDATE ON projects, stages, project_staff, project_materials, 
    calendar_events, quotations, quotation_products TO app_project_manager;
GRANT SELECT ON clients, staff, materials, suppliers, products TO app_project_manager;

-- Permissions pour les comptables
GRANT SELECT, INSERT, UPDATE ON invoices, invoice_items, payments, expenses, 
    expense_categories, timesheet_entries TO app_accountant;
GRANT SELECT ON projects, clients, quotations, staff TO app_accountant;

-- Optimisation des vues matérialisées
CREATE OR REPLACE FUNCTION refresh_materialized_view_by_name(view_name text)
RETURNS void AS $$
BEGIN
    EXECUTE format('REFRESH MATERIALIZED VIEW %I', view_name);
END;
$$ LANGUAGE plpgsql;

-- Suppression des vues matérialisées qui dépendent de la colonne status de projects
DROP MATERIALIZED VIEW IF EXISTS financial_dashboard;
DROP MATERIALIZED VIEW IF EXISTS project_profitability_report;

-- Recréation des vues matérialisées après la modification de la colonne status
-- Vue matérialisée pour le tableau de bord financier
CREATE MATERIALIZED VIEW IF NOT EXISTS financial_dashboard AS
SELECT
    -- Statistiques globales
    (SELECT COUNT(*) FROM projects WHERE status = (SELECT id FROM ref_status WHERE code = 'en_cours' AND entity_type = 'project')) as active_projects_count,
    (SELECT COUNT(*) FROM projects WHERE status = (SELECT id FROM ref_status WHERE code = 'termine' AND entity_type = 'project')) as completed_projects_count,
    
    -- Date de mise à jour
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

-- Indexation des vues matérialisées
CREATE UNIQUE INDEX IF NOT EXISTS project_profitability_report_idx ON project_profitability_report(project_id);

-- Installation simple de pg_cron
DO $$ 
BEGIN
            CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'L''extension pg_cron n''a pas pu être installée. Le rafraîchissement automatique des vues matérialisées ne sera pas configuré.';
END $$;

-- Configuration des tâches cron si l'extension est disponible
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_extension 
        WHERE extname = 'pg_cron'
    ) THEN
        -- Ici, ajoutez vos tâches cron
        -- Par exemple :
        -- SELECT cron.schedule('refresh_views', '0 0 * * *', 'REFRESH MATERIALIZED VIEW financial_dashboard');
        RAISE NOTICE 'pg_cron est installé et prêt à être utilisé';
    END IF;
END $$;

-- Activation de l'historisation automatique
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Application du trigger updated_at à toutes les tables principales
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name::text 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE 'pg_%'
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = t 
            AND column_name = 'updated_at'
        ) THEN
            IF NOT EXISTS (
                SELECT 1 FROM pg_trigger 
                WHERE tgname = format('set_%s_updated_at', t)
            ) THEN
                EXECUTE format('
                    CREATE TRIGGER set_%I_updated_at
                    BEFORE UPDATE ON %I
                    FOR EACH ROW 
                    EXECUTE FUNCTION set_updated_at()', t, t);
            END IF;
        END IF;
    END LOOP;
END $$;

-- Ajout d'index GIN pour la recherche full-text et JSONB
CREATE INDEX IF NOT EXISTS projects_search_vector_idx ON projects USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS projects_search_metadata_idx ON projects USING GIN (search_metadata);
CREATE INDEX IF NOT EXISTS quotations_search_metadata_idx ON quotations USING GIN (search_metadata);

-- Insertion des données de référence pour les types d'événements
INSERT INTO ref_event_types (code, name, description, color, icon, display_order) VALUES
('appel_telephonique', 'Appel téléphonique', 'Appel avec un client ou fournisseur', '#4CAF50', 'phone', 1),
('reunion_chantier', 'Réunion de chantier', 'Réunion sur site', '#2196F3', 'construction', 2),
('visite_technique', 'Visite technique', 'Visite technique sur site', '#FFC107', 'engineering', 3),
('rendez_vous_client', 'Rendez-vous client', 'Rendez-vous avec un client', '#9C27B0', 'person', 4),
('reunion_interne', 'Réunion interne', 'Réunion d''équipe', '#607D8B', 'group', 5)
ON CONFLICT (code) DO NOTHING;

-- Insertion des données de référence pour les méthodes de paiement
INSERT INTO ref_payment_methods (code, name, description, display_order) VALUES
('carte', 'Carte bancaire', 'Paiement par carte bancaire', 1),
('cheque', 'Chèque', 'Paiement par chèque', 2),
('virement', 'Virement bancaire', 'Paiement par virement bancaire', 3),
('especes', 'Espèces', 'Paiement en espèces', 4),
('prelevement', 'Prélèvement', 'Paiement par prélèvement automatique', 5)
ON CONFLICT (code) DO NOTHING;

-- Index pour les tables de référence
CREATE INDEX IF NOT EXISTS ref_status_entity_type_idx ON ref_status(entity_type);
CREATE INDEX IF NOT EXISTS ref_status_is_active_idx ON ref_status(is_active);
CREATE INDEX IF NOT EXISTS ref_event_types_is_active_idx ON ref_event_types(is_active);
CREATE INDEX IF NOT EXISTS ref_payment_methods_is_active_idx ON ref_payment_methods(is_active);

-- Tables pour le chatbot
CREATE TABLE IF NOT EXISTS chatbot_conversations (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES users(id),
    session_id TEXT NOT NULL,
    context JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Création de la table des messages du chatbot avec gestion optimisée des embeddings
CREATE TABLE IF NOT EXISTS chatbot_messages (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id uuid REFERENCES chatbot_conversations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    embedding vector(1536)
);

-- Création de l'index vectoriel avec une configuration adaptée
DO $$
BEGIN
    -- Suppression de l'index existant s'il existe
    DROP INDEX IF EXISTS chatbot_messages_embedding_idx;
    
    -- Création de l'index avec une configuration optimisée
    -- Note: Le nombre de listes (100) est un compromis entre performance et espace
    -- Il devrait être ajusté en fonction du volume de données
    CREATE INDEX chatbot_messages_embedding_idx 
    ON chatbot_messages 
    USING ivfflat (embedding vector_l2_ops) 
    WITH (lists = 100);
    
    -- Ajout d'un commentaire explicatif
    COMMENT ON INDEX chatbot_messages_embedding_idx IS 
        'Index vectoriel pour la recherche sémantique des messages. Le nombre de listes (100) est optimisé pour un volume de données moyen. À ajuster en fonction du volume réel de données.';
END $$;

-- Fonction pour réindexer les embeddings si nécessaire
CREATE OR REPLACE FUNCTION reindex_chatbot_embeddings()
RETURNS void AS $$
BEGIN
    -- Suppression et recréation de l'index
    DROP INDEX IF EXISTS chatbot_messages_embedding_idx;
    
    CREATE INDEX chatbot_messages_embedding_idx 
    ON chatbot_messages 
    USING ivfflat (embedding vector_l2_ops) 
    WITH (lists = 100);
    
    RAISE NOTICE 'Index vectoriel des messages chatbot recréé avec succès';
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS chatbot_feedbacks (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id uuid REFERENCES chatbot_messages(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chatbot_entities (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index pour les tables chatbot
CREATE INDEX IF NOT EXISTS chatbot_conversations_user_id_idx ON chatbot_conversations(user_id);
CREATE INDEX IF NOT EXISTS chatbot_conversations_session_id_idx ON chatbot_conversations(session_id);
CREATE INDEX IF NOT EXISTS chatbot_messages_conversation_id_idx ON chatbot_messages(conversation_id);
CREATE INDEX IF NOT EXISTS chatbot_messages_embedding_idx ON chatbot_messages USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);

-- Création de la table des plannings hebdomadaires des travailleurs
-- Le champ schedule est un JSONB avec la structure suivante :
-- {
--   "YYYY-MM-DD": {
--     "hours": number,
--     "project": string (project_id),
--     "role": string,
--     "notes": string (optional)
--   }
-- }
CREATE TABLE IF NOT EXISTS worker_weekly_schedule (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id uuid NOT NULL,
    week_start_date DATE NOT NULL,
    schedule JSONB NOT NULL,
    total_hours INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_worker_schedule_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- Création de la table des demandes de matériaux
CREATE TABLE IF NOT EXISTS material_requests (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id uuid NOT NULL,
    request_date DATE NOT NULL,
    requested_by uuid NOT NULL,
    needed_by_date DATE NOT NULL,
    status uuid REFERENCES ref_material_request_status(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_material_request_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_material_request_staff FOREIGN KEY (requested_by) REFERENCES staff(id) ON DELETE CASCADE
);

-- Création de la table des éléments de demande de matériaux
CREATE TABLE IF NOT EXISTS material_request_items (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id uuid NOT NULL,
    material_id uuid NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_request_item_request FOREIGN KEY (request_id) REFERENCES material_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_request_item_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);

-- Création de la table de suivi du matériel sur site
CREATE TABLE IF NOT EXISTS site_equipment_tracking (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id uuid NOT NULL,
    equipment_id uuid NOT NULL,
    check_out_time TIMESTAMP WITH TIME ZONE NOT NULL,
    expected_return_time TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_return_time TIMESTAMP WITH TIME ZONE,
    staff_id uuid NOT NULL,
    condition_at_checkout uuid REFERENCES ref_equipment_condition(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_equipment_tracking_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_equipment_tracking_equipment FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
    CONSTRAINT fk_equipment_tracking_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- Table pour l'historique des requêtes
CREATE TABLE IF NOT EXISTS query_history (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    question TEXT NOT NULL,
    question_reformulee TEXT NOT NULL,
    sql_query TEXT,
    result JSONB,
    error_message TEXT,
    is_successful BOOLEAN DEFAULT true,
    explanation TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS query_history_created_at_idx ON query_history(created_at DESC);

-- Ajout d'index vectoriels sur toutes les colonnes embedding existantes
DO $$
BEGIN
    -- Suppression des index existants s'ils existent
    DROP INDEX IF EXISTS clients_embedding_idx;
    DROP INDEX IF EXISTS projects_embedding_idx;
    DROP INDEX IF EXISTS quotations_embedding_idx;
    DROP INDEX IF EXISTS invoices_embedding_idx;
    
    -- Création des index avec une configuration optimisée
    CREATE INDEX clients_embedding_idx 
    ON clients 
    USING ivfflat (embedding vector_l2_ops) 
    WITH (lists = 100);
    
    CREATE INDEX projects_embedding_idx 
    ON projects 
    USING ivfflat (embedding vector_l2_ops) 
    WITH (lists = 100);
    
    CREATE INDEX quotations_embedding_idx 
    ON quotations 
    USING ivfflat (embedding vector_l2_ops) 
    WITH (lists = 100);
    
    CREATE INDEX invoices_embedding_idx 
    ON invoices 
    USING ivfflat (embedding vector_l2_ops) 
    WITH (lists = 100);
    
    RAISE NOTICE 'Tous les index vectoriels ont été créés avec succès';
END $$;

-- Fonction pour réindexer tous les embeddings de la base de données
CREATE OR REPLACE FUNCTION reindex_all_embeddings()
RETURNS void AS $$
BEGIN
    -- Suppression des index existants
    DROP INDEX IF EXISTS clients_embedding_idx;
    DROP INDEX IF EXISTS projects_embedding_idx;
    DROP INDEX IF EXISTS quotations_embedding_idx;
    DROP INDEX IF EXISTS invoices_embedding_idx;
    DROP INDEX IF EXISTS chatbot_messages_embedding_idx;
    
    -- Recréation des index avec une configuration optimisée
    -- Index pour les clients
    CREATE INDEX clients_embedding_idx 
    ON clients 
    USING ivfflat (embedding vector_l2_ops) 
    WITH (lists = 100);
    
    -- Index pour les projets
    CREATE INDEX projects_embedding_idx 
    ON projects 
    USING ivfflat (embedding vector_l2_ops) 
    WITH (lists = 100);
    
    -- Index pour les devis
    CREATE INDEX quotations_embedding_idx 
    ON quotations 
    USING ivfflat (embedding vector_l2_ops) 
    WITH (lists = 100);
    
    -- Index pour les factures
    CREATE INDEX invoices_embedding_idx 
    ON invoices 
    USING ivfflat (embedding vector_l2_ops) 
    WITH (lists = 100);
    
    -- Index pour les messages du chatbot
    CREATE INDEX chatbot_messages_embedding_idx 
    ON chatbot_messages 
    USING ivfflat (embedding vector_l2_ops) 
    WITH (lists = 100);
    
    RAISE NOTICE 'Tous les index vectoriels ont été recréés avec succès';
END;
$$ LANGUAGE plpgsql;

-- Fonctions spécifiques pour réindexer chaque type d'embedding individuellement
CREATE OR REPLACE FUNCTION reindex_clients_embeddings()
RETURNS void AS $$
BEGIN
    DROP INDEX IF EXISTS clients_embedding_idx;
    CREATE INDEX clients_embedding_idx 
    ON clients 
    USING ivfflat (embedding vector_l2_ops) 
    WITH (lists = 100);
    RAISE NOTICE 'Index vectoriel des clients recréé avec succès';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reindex_projects_embeddings()
RETURNS void AS $$
BEGIN
    DROP INDEX IF EXISTS projects_embedding_idx;
    CREATE INDEX projects_embedding_idx 
    ON projects 
    USING ivfflat (embedding vector_l2_ops) 
    WITH (lists = 100);
    RAISE NOTICE 'Index vectoriel des projets recréé avec succès';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reindex_quotations_embeddings()
RETURNS void AS $$
BEGIN
    DROP INDEX IF EXISTS quotations_embedding_idx;
    CREATE INDEX quotations_embedding_idx 
    ON quotations 
    USING ivfflat (embedding vector_l2_ops) 
    WITH (lists = 100);
    RAISE NOTICE 'Index vectoriel des devis recréé avec succès';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reindex_invoices_embeddings()
RETURNS void AS $$
BEGIN
    DROP INDEX IF EXISTS invoices_embedding_idx;
    CREATE INDEX invoices_embedding_idx 
    ON invoices 
    USING ivfflat (embedding vector_l2_ops) 
    WITH (lists = 100);
    RAISE NOTICE 'Index vectoriel des factures recréé avec succès';
END;
$$ LANGUAGE plpgsql;

COMMIT;
