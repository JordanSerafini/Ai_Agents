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

COMMIT;
