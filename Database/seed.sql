-- Désactiver temporairement les triggers
SET session_replication_role = 'replica';

BEGIN;

-- Vérifier et créer les types enums s'ils n'existent pas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
        CREATE TYPE payment_method AS ENUM ('carte', 'virement', 'cheque', 'especes');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
        CREATE TYPE invoice_status AS ENUM ('payée', 'envoyée', 'en_retard', 'annulée');
    END IF;
END$$;

-- Insertion des adresses
INSERT INTO addresses (id, street_number, street_name, zip_code, city, country)
VALUES 
    (uuid_generate_v4(), '15', 'Rue de Paris', '75001', 'Paris', 'France'),
    (uuid_generate_v4(), '24', 'Avenue Victor Hugo', '75016', 'Paris', 'France'),
    (uuid_generate_v4(), '8', 'Boulevard Haussmann', '75008', 'Paris', 'France'),
    (uuid_generate_v4(), '42', 'Rue Saint-Antoine', '75004', 'Paris', 'France'),
    (uuid_generate_v4(), '3', 'Place de la République', '75003', 'Paris', 'France'),
    (uuid_generate_v4(), '17', 'Rue des Écoles', '75005', 'Paris', 'France'),
    (uuid_generate_v4(), '29', 'Avenue Montaigne', '75008', 'Paris', 'France'),
    (uuid_generate_v4(), '12', 'Rue du Faubourg Saint-Honoré', '75008', 'Paris', 'France'),
    (uuid_generate_v4(), '5', 'Quai de la Tournelle', '75005', 'Paris', 'France'),
    (uuid_generate_v4(), '22', 'Rue de Rivoli', '75004', 'Paris', 'France'),
    (uuid_generate_v4(), '47', 'Rue de Vaugirard', '75015', 'Paris', 'France'),
    (uuid_generate_v4(), '10', 'Place de la Bastille', '75011', 'Paris', 'France'),
    (uuid_generate_v4(), '31', 'Rue Saint-Michel', '75006', 'Paris', 'France'),
    (uuid_generate_v4(), '14', 'Rue de la Pompe', '75016', 'Paris', 'France'),
    (uuid_generate_v4(), '6', 'Avenue des Ternes', '75017', 'Paris', 'France'),
    (uuid_generate_v4(), '25', 'Boulevard Saint-Germain', '75006', 'Paris', 'France'),
    (uuid_generate_v4(), '9', 'Rue de Passy', '75016', 'Paris', 'France'),
    (uuid_generate_v4(), '33', 'Avenue Marceau', '75008', 'Paris', 'France'),
    (uuid_generate_v4(), '7', 'Rue Mouffetard', '75005', 'Paris', 'France'),
    (uuid_generate_v4(), '18', 'Boulevard Malesherbes', '75008', 'Paris', 'France'),
    (uuid_generate_v4(), '1', 'Rue des Grands Augustins', '75006', 'Paris', 'France'),
    (uuid_generate_v4(), '27', 'Rue du Bac', '75007', 'Paris', 'France'),
    (uuid_generate_v4(), '38', 'Avenue de Wagram', '75017', 'Paris', 'France'),
    (uuid_generate_v4(), '4', 'Rue des Martyrs', '75009', 'Paris', 'France'),
    (uuid_generate_v4(), '19', 'Avenue de l''Opéra', '75001', 'Paris', 'France'),
    (uuid_generate_v4(), '2', 'Rue de la Paix', '75002', 'Paris', 'France');

-- Récupération des IDs d'adresses pour les utiliser dans les insertions suivantes
DO $$
DECLARE
    address_ids UUID[];
BEGIN
    SELECT array_agg(id) INTO address_ids FROM addresses;
    
    -- Insertion du personnel (staff)
    INSERT INTO staff (id, firstname, lastname, email, role, phone, is_available, address_id)
    VALUES 
        (uuid_generate_v4(), 'Jean', 'Dupont', 'jean.dupont@batiment-pro.fr', 'Chef de chantier', '0611223344', true, address_ids[1]),
        (uuid_generate_v4(), 'Marie', 'Laurent', 'marie.laurent@batiment-pro.fr', 'Architecte', '0622334455', true, address_ids[2]),
        (uuid_generate_v4(), 'Thomas', 'Martin', 'thomas.martin@batiment-pro.fr', 'Électricien', '0633445566', true, address_ids[3]),
        (uuid_generate_v4(), 'Sophie', 'Bernard', 'sophie.bernard@batiment-pro.fr', 'Plombier', '0644556677', true, address_ids[4]),
        (uuid_generate_v4(), 'Nicolas', 'Petit', 'nicolas.petit@batiment-pro.fr', 'Maçon', '0655667788', true, address_ids[5]),
        (uuid_generate_v4(), 'Émilie', 'Durand', 'emilie.durand@batiment-pro.fr', 'Peintre', '0666778899', true, address_ids[6]),
        (uuid_generate_v4(), 'Pierre', 'Leroy', 'pierre.leroy@batiment-pro.fr', 'Menuisier', '0677889900', true, address_ids[7]),
        (uuid_generate_v4(), 'Claire', 'Moreau', 'claire.moreau@batiment-pro.fr', 'Carreleur', '0688990011', true, address_ids[8]),
        (uuid_generate_v4(), 'Lucas', 'Simon', 'lucas.simon@batiment-pro.fr', 'Conducteur de travaux', '0699001122', true, address_ids[9]);
    
    -- Insertion des clients
    INSERT INTO clients (id, firstname, lastname, email, phone, address_id)
    VALUES 
        (uuid_generate_v4(), 'François', 'Dubois', 'francois.dubois@gmail.com', '0712345678', address_ids[10]),
        (uuid_generate_v4(), 'Isabelle', 'Lefebvre', 'isabelle.lefebvre@yahoo.fr', '0723456789', address_ids[11]),
        (uuid_generate_v4(), 'Alexandre', 'Garcia', 'alexandre.garcia@hotmail.com', '0734567890', address_ids[12]),
        (uuid_generate_v4(), 'Julie', 'Martin', 'julie.martin@gmail.com', '0745678901', address_ids[13]),
        (uuid_generate_v4(), 'Sébastien', 'Roux', 'sebastien.roux@gmail.com', '0756789012', address_ids[14]),
        (uuid_generate_v4(), 'Aurélie', 'Vincent', 'aurelie.vincent@yahoo.fr', '0767890123', address_ids[15]),
        (uuid_generate_v4(), 'Michel', 'Girard', 'michel.girard@gmail.com', '0778901234', address_ids[16]),
        (uuid_generate_v4(), 'Céline', 'Blanc', 'celine.blanc@hotmail.com', '0789012345', address_ids[17]),
        (uuid_generate_v4(), 'Philippe', 'Rousseau', 'philippe.rousseau@gmail.com', '0790123456', address_ids[18]),
        (uuid_generate_v4(), 'Nathalie', 'Fontaine', 'nathalie.fontaine@yahoo.fr', '0701234567', address_ids[19]),
        (uuid_generate_v4(), 'Laurent', 'Mercier', 'laurent.mercier@gmail.com', '0712345678', address_ids[20]),
        (uuid_generate_v4(), 'Valérie', 'Chevalier', 'valerie.chevalier@hotmail.com', '0723456789', address_ids[21]),
        (uuid_generate_v4(), 'Olivier', 'Roy', 'olivier.roy@gmail.com', '0734567890', address_ids[22]);
    
    -- Insertion des fournisseurs
    INSERT INTO suppliers (id, name, contact_name, email, phone, address_id, notes)
    VALUES 
        (uuid_generate_v4(), 'MatérioPro', 'Daniel Lemaire', 'contact@materiopro.fr', '0145678901', address_ids[23], 'Fournisseur principal de matériaux de construction'),
        (uuid_generate_v4(), 'OutilExpert', 'Patricia Aubert', 'patricia@outilexpert.fr', '0156789012', address_ids[24], 'Fournisseur d''outillage professionnel'),
        (uuid_generate_v4(), 'ElectroBat', 'Henri Leclerc', 'henri@electrobat.fr', '0167890123', address_ids[25], 'Spécialiste du matériel électrique'),
        (uuid_generate_v4(), 'PlomberieTout', 'Sylvie Marchand', 'sylvie@plomberietout.fr', '0178901234', address_ids[26], 'Fournitures de plomberie');
END $$;

-- Récupération des IDs pour les insertions suivantes
DO $$
DECLARE
    client_ids UUID[];
    address_ids UUID[];
    status_ids RECORD;
    staff_ids UUID[];
    supplier_ids UUID[];
BEGIN
    -- Récupération des IDs nécessaires
    SELECT array_agg(id) INTO client_ids FROM clients;
    SELECT array_agg(id) INTO address_ids FROM addresses;
    SELECT array_agg(id) INTO staff_ids FROM staff;
    SELECT array_agg(id) INTO supplier_ids FROM suppliers;
    
    -- Récupération des IDs des statuts
    SELECT 
        (SELECT id FROM ref_status WHERE code = 'prospect' AND entity_type = 'project') as prospect_id,
        (SELECT id FROM ref_status WHERE code = 'en_cours' AND entity_type = 'project') as en_cours_id,
        (SELECT id FROM ref_status WHERE code = 'termine' AND entity_type = 'project') as termine_id
    INTO status_ids;
    
    -- Insertion des projets
    INSERT INTO projects (id, client_id, name, description, start_date, end_date, status, address_id, is_active, search_metadata)
    VALUES 
        (uuid_generate_v4(), client_ids[1], 'Rénovation appartement Haussmannien', 'Rénovation complète d''un appartement de 120m² dans le 8ème arrondissement', '2023-01-15', '2023-06-30', status_ids.termine_id, address_ids[3], true, '{"type": "renovation", "surface": 120, "style": "haussmannien"}'),
        (uuid_generate_v4(), client_ids[2], 'Construction maison individuelle Clamart', 'Construction d''une maison contemporaine de 180m² à Clamart', '2023-02-01', '2023-12-15', status_ids.en_cours_id, address_ids[4], true, '{"type": "construction", "surface": 180, "style": "contemporain"}'),
        (uuid_generate_v4(), client_ids[3], 'Aménagement boutique Marais', 'Aménagement d''une boutique de prêt-à-porter de 85m² dans le Marais', '2023-03-10', '2023-07-20', status_ids.termine_id, address_ids[5], true, '{"type": "commercial", "surface": 85, "secteur": "retail"}'),
        (uuid_generate_v4(), client_ids[4], 'Extension villa Neuilly', 'Extension de 60m² d''une villa à Neuilly-sur-Seine', '2023-04-05', '2023-10-15', status_ids.en_cours_id, address_ids[6], true, '{"type": "extension", "surface": 60, "style": "moderne"}'),
        (uuid_generate_v4(), client_ids[5], 'Rénovation loft Montreuil', 'Rénovation d''un loft industriel de 150m² à Montreuil', '2023-05-20', '2023-11-30', status_ids.en_cours_id, address_ids[7], true, '{"type": "renovation", "surface": 150, "style": "industriel"}'),
        (uuid_generate_v4(), client_ids[6], 'Aménagement restaurant Montmartre', 'Aménagement d''un restaurant de 120m² à Montmartre', '2023-06-10', NULL, status_ids.en_cours_id, address_ids[8], true, '{"type": "commercial", "surface": 120, "secteur": "restauration"}'),
        (uuid_generate_v4(), client_ids[7], 'Construction immeuble Saint-Denis', 'Construction d''un petit immeuble de 6 appartements à Saint-Denis', '2023-01-05', '2024-06-30', status_ids.en_cours_id, address_ids[9], true, '{"type": "construction", "logements": 6, "style": "contemporain"}'),
        (uuid_generate_v4(), client_ids[8], 'Rénovation bureaux La Défense', 'Rénovation d''un plateau de bureaux de 350m² à La Défense', '2023-08-15', '2024-01-15', status_ids.prospect_id, address_ids[10], true, '{"type": "commercial", "surface": 350, "secteur": "bureaux"}'),
        (uuid_generate_v4(), client_ids[9], 'Aménagement clinique Boulogne', 'Aménagement d''une clinique dentaire de 200m² à Boulogne-Billancourt', '2023-09-01', '2024-02-28', status_ids.prospect_id, address_ids[11], true, '{"type": "medical", "surface": 200, "secteur": "dentaire"}'),
        (uuid_generate_v4(), client_ids[10], 'Rénovation hôtel particulier', 'Rénovation complète d''un hôtel particulier de 450m² dans le 16ème arrondissement', '2023-10-10', '2024-10-10', status_ids.prospect_id, address_ids[12], true, '{"type": "renovation", "surface": 450, "style": "classique"}'),
        (uuid_generate_v4(), client_ids[11], 'Construction entrepôt Gennevilliers', 'Construction d''un entrepôt logistique de 1200m² à Gennevilliers', '2023-03-15', '2024-05-30', status_ids.en_cours_id, address_ids[13], true, '{"type": "industrial", "surface": 1200, "secteur": "logistique"}'),
        (uuid_generate_v4(), client_ids[12], 'Réhabilitation usine Saint-Ouen', 'Réhabilitation d''une ancienne usine en espace de coworking à Saint-Ouen', '2023-07-01', '2024-08-31', status_ids.en_cours_id, address_ids[14], true, '{"type": "rehabilitation", "surface": 800, "secteur": "coworking"}');
    
    -- Mise à jour des dates des projets pour qu'elles soient autour de la date actuelle
    UPDATE projects 
    SET 
        start_date = CASE 
            WHEN id = (SELECT id FROM projects WHERE name = 'Rénovation appartement Haussmannien') THEN CURRENT_DATE - interval '6 months'
            WHEN id = (SELECT id FROM projects WHERE name = 'Construction maison individuelle Clamart') THEN CURRENT_DATE - interval '5 months'
            WHEN id = (SELECT id FROM projects WHERE name = 'Aménagement boutique Marais') THEN CURRENT_DATE - interval '4 months'
            WHEN id = (SELECT id FROM projects WHERE name = 'Extension villa Neuilly') THEN CURRENT_DATE - interval '3 months'
            WHEN id = (SELECT id FROM projects WHERE name = 'Rénovation loft Montreuil') THEN CURRENT_DATE - interval '2 months'
            WHEN id = (SELECT id FROM projects WHERE name = 'Aménagement restaurant Montmartre') THEN CURRENT_DATE - interval '1 month'
            WHEN id = (SELECT id FROM projects WHERE name = 'Construction immeuble Saint-Denis') THEN CURRENT_DATE
            WHEN id = (SELECT id FROM projects WHERE name = 'Rénovation bureaux La Défense') THEN CURRENT_DATE + interval '1 week'
            WHEN id = (SELECT id FROM projects WHERE name = 'Aménagement clinique Boulogne') THEN CURRENT_DATE + interval '2 weeks'
            WHEN id = (SELECT id FROM projects WHERE name = 'Rénovation hôtel particulier') THEN CURRENT_DATE + interval '3 weeks'
            WHEN id = (SELECT id FROM projects WHERE name = 'Construction entrepôt Gennevilliers') THEN CURRENT_DATE - interval '1 week'
            WHEN id = (SELECT id FROM projects WHERE name = 'Réhabilitation usine Saint-Ouen') THEN CURRENT_DATE - interval '2 weeks'
        END,
        end_date = CASE 
            WHEN id = (SELECT id FROM projects WHERE name = 'Rénovation appartement Haussmannien') THEN CURRENT_DATE - interval '1 month'
            WHEN id = (SELECT id FROM projects WHERE name = 'Construction maison individuelle Clamart') THEN CURRENT_DATE + interval '6 months'
            WHEN id = (SELECT id FROM projects WHERE name = 'Aménagement boutique Marais') THEN CURRENT_DATE - interval '1 week'
            WHEN id = (SELECT id FROM projects WHERE name = 'Extension villa Neuilly') THEN CURRENT_DATE + interval '3 months'
            WHEN id = (SELECT id FROM projects WHERE name = 'Rénovation loft Montreuil') THEN CURRENT_DATE + interval '4 months'
            WHEN id = (SELECT id FROM projects WHERE name = 'Aménagement restaurant Montmartre') THEN CURRENT_DATE + interval '5 months'
            WHEN id = (SELECT id FROM projects WHERE name = 'Construction immeuble Saint-Denis') THEN CURRENT_DATE + interval '6 months'
            WHEN id = (SELECT id FROM projects WHERE name = 'Rénovation bureaux La Défense') THEN CURRENT_DATE + interval '6 months'
            WHEN id = (SELECT id FROM projects WHERE name = 'Aménagement clinique Boulogne') THEN CURRENT_DATE + interval '6 months'
            WHEN id = (SELECT id FROM projects WHERE name = 'Rénovation hôtel particulier') THEN CURRENT_DATE + interval '12 months'
            WHEN id = (SELECT id FROM projects WHERE name = 'Construction entrepôt Gennevilliers') THEN CURRENT_DATE + interval '6 months'
            WHEN id = (SELECT id FROM projects WHERE name = 'Réhabilitation usine Saint-Ouen') THEN CURRENT_DATE + interval '6 months'
        END;
    
    -- Insertion des affectations de personnel aux projets
    INSERT INTO project_staff (id, project_id, staff_id, role, start_date, end_date)
    WITH roles AS (
        SELECT 'Electricien' AS role_name UNION
        SELECT 'Plombier' UNION
        SELECT 'Maçon' UNION
        SELECT 'Peintre'
    ),
    project_staff_data AS (
        SELECT
            p.id AS project_id,
            s.role_name AS role,
            p.start_date,
            p.end_date,
            ROW_NUMBER() OVER (PARTITION BY p.id, s.role_name ORDER BY random()) AS rn
        FROM projects p
        CROSS JOIN roles s
        ORDER BY p.id, random()
    )
    SELECT
        uuid_generate_v4(),
        project_id,
        staff_ids[1 + floor(random() * array_length(staff_ids, 1))::int],
        role,
        start_date,
        end_date
    FROM project_staff_data
    WHERE rn = 1
    LIMIT (SELECT 3 * COUNT(*) FROM projects); -- 3 rôles par projet maximum
    
    -- Insertion des étapes de projet
    INSERT INTO stages (id, project_id, name, description, start_date, end_date, status, completion_percentage, order_index)
    SELECT
        uuid_generate_v4(),
        p.id,
        'Préparation du chantier',
        'Installation des équipements de sécurité et préparation du site',
        p.start_date,
        p.start_date + interval '2 weeks',
        CASE 
            WHEN p.status = (SELECT id FROM ref_status WHERE code = 'termine' AND entity_type = 'project') THEN (SELECT id FROM ref_status WHERE code = 'termine' AND entity_type = 'stage')
            WHEN p.status = (SELECT id FROM ref_status WHERE code = 'en_cours' AND entity_type = 'project') THEN (SELECT id FROM ref_status WHERE code = 'termine' AND entity_type = 'stage')
            ELSE (SELECT id FROM ref_status WHERE code = 'en_attente' AND entity_type = 'stage')
        END,
        CASE 
            WHEN p.status = (SELECT id FROM ref_status WHERE code = 'termine' AND entity_type = 'project') THEN 100
            WHEN p.status = (SELECT id FROM ref_status WHERE code = 'en_cours' AND entity_type = 'project') THEN 100
            ELSE 0
        END,
        1
    FROM projects p;
    
    -- Insertion des étapes intermédiaires pour chaque projet
    INSERT INTO stages (id, project_id, name, description, start_date, end_date, status, completion_percentage, order_index)
    SELECT
        uuid_generate_v4(),
        p.id,
        CASE MOD(s, 4)
            WHEN 0 THEN 'Gros œuvre'
            WHEN 1 THEN 'Second œuvre'
            WHEN 2 THEN 'Électricité et plomberie'
            WHEN 3 THEN 'Finitions'
        END,
        CASE MOD(s, 4)
            WHEN 0 THEN 'Travaux de fondation et structure'
            WHEN 1 THEN 'Installation des cloisons, menuiseries et isolation'
            WHEN 2 THEN 'Installation des réseaux électriques et sanitaires'
            WHEN 3 THEN 'Peinture, revêtements de sols et aménagements finaux'
        END,
        p.start_date + (s * interval '1 month'),
        p.start_date + ((s+1) * interval '1 month'),
        CASE 
            WHEN p.status = (SELECT id FROM ref_status WHERE code = 'termine' AND entity_type = 'project') THEN (SELECT id FROM ref_status WHERE code = 'termine' AND entity_type = 'stage')
            WHEN p.status = (SELECT id FROM ref_status WHERE code = 'en_cours' AND entity_type = 'project') AND 
                 p.start_date + (s * interval '1 month') < CURRENT_DATE THEN 
                CASE 
                    WHEN p.start_date + ((s+1) * interval '1 month') < CURRENT_DATE THEN (SELECT id FROM ref_status WHERE code = 'termine' AND entity_type = 'stage')
                    ELSE (SELECT id FROM ref_status WHERE code = 'en_cours' AND entity_type = 'stage')
                END
            ELSE (SELECT id FROM ref_status WHERE code = 'en_attente' AND entity_type = 'stage')
        END,
        CASE 
            WHEN p.status = (SELECT id FROM ref_status WHERE code = 'termine' AND entity_type = 'project') THEN 100
            WHEN p.status = (SELECT id FROM ref_status WHERE code = 'en_cours' AND entity_type = 'project') AND 
                 p.start_date + (s * interval '1 month') < CURRENT_DATE THEN 
                CASE 
                    WHEN p.start_date + ((s+1) * interval '1 month') < CURRENT_DATE THEN 100
                    ELSE floor(random() * 90 + 10)::int
                END
            ELSE 0
        END,
        s + 2
    FROM projects p, generate_series(0, 3) AS s;
END $$;

-- Récupération des IDs pour les insertions suivantes
DO $$
DECLARE
    project_ids UUID[];
    quotation_status_ids UUID[];
    product_category_ids UUID[];
BEGIN
    -- Récupération des IDs nécessaires
    SELECT array_agg(id) INTO project_ids FROM projects;
    SELECT array_agg(id) INTO quotation_status_ids FROM ref_quotation_status;
    SELECT array_agg(id) INTO product_category_ids FROM ref_product_categories;
    
    -- Insertion des devis
    INSERT INTO quotations (id, project_id, reference, issue_date, validity_date, total_ht, tva_rate, total_ttc, status, notes, payment_conditions)
    SELECT
        uuid_generate_v4(),
        project_ids[i],
        'DEV-2023-' || LPAD(i::text, 4, '0'),
        (SELECT start_date - interval '1 month' FROM projects WHERE id = project_ids[i]),
        (SELECT start_date - interval '15 days' FROM projects WHERE id = project_ids[i]),
        CASE 
            WHEN (SELECT search_metadata->>'surface' FROM projects WHERE id = project_ids[i]) IS NOT NULL THEN
                (SELECT (search_metadata->>'surface')::numeric * (500 + floor(random() * 300)::numeric) FROM projects WHERE id = project_ids[i])
            ELSE 50000 + floor(random() * 100000)::numeric
        END,
        20.0,
        CASE 
            WHEN (SELECT search_metadata->>'surface' FROM projects WHERE id = project_ids[i]) IS NOT NULL THEN
                (SELECT (search_metadata->>'surface')::numeric * (500 + floor(random() * 300)::numeric) * 1.2 FROM projects WHERE id = project_ids[i])
            ELSE (50000 + floor(random() * 100000)::numeric) * 1.2
        END,
        CASE
            WHEN (SELECT status FROM projects WHERE id = project_ids[i]) = (SELECT id FROM ref_status WHERE code = 'prospect' AND entity_type = 'project') THEN
                (SELECT id FROM ref_quotation_status WHERE code = 'en_attente')
            ELSE
                (SELECT id FROM ref_quotation_status WHERE code = 'accepté')
        END,
        'Devis pour le projet ' || (SELECT name FROM projects WHERE id = project_ids[i]),
        'Paiement en 3 fois : 30% à la signature, 40% à mi-parcours, 30% à la livraison'
    FROM generate_series(1, array_length(project_ids, 1)) AS i;
    
    -- Insertion des produits de devis
    INSERT INTO quotation_products (id, quotation_id, description, quantity, unit_price, total_price, category)
    SELECT
        uuid_generate_v4(),
        q.id,
        CASE mod(s, 4)
            WHEN 0 THEN 'Matériaux de construction'
            WHEN 1 THEN 'Main d''œuvre spécialisée'
            WHEN 2 THEN 'Location d''équipement'
            WHEN 3 THEN 'Préparation du site'
        END,
        CASE mod(s, 4)
            WHEN 0 THEN ceiling(random() * 100)::numeric
            WHEN 1 THEN ceiling(random() * 200)::numeric
            WHEN 2 THEN ceiling(random() * 10)::numeric
            WHEN 3 THEN 1
        END,
        CASE mod(s, 4)
            WHEN 0 THEN (50 + random() * 200)::numeric
            WHEN 1 THEN (100 + random() * 400)::numeric
            WHEN 2 THEN (300 + random() * 1000)::numeric
            WHEN 3 THEN (1000 + random() * 5000)::numeric
        END,
        CASE mod(s, 4)
            WHEN 0 THEN ceiling(random() * 100)::numeric * (50 + random() * 200)::numeric
            WHEN 1 THEN ceiling(random() * 200)::numeric * (100 + random() * 400)::numeric
            WHEN 2 THEN ceiling(random() * 10)::numeric * (300 + random() * 1000)::numeric
            WHEN 3 THEN 1 * (1000 + random() * 5000)::numeric
        END,
        (SELECT id FROM ref_product_categories WHERE code = 
            CASE mod(s, 4)
                WHEN 0 THEN 'matériaux'
                WHEN 1 THEN 'main_doeuvre'
                WHEN 2 THEN 'autres'
                WHEN 3 THEN 'transport'
            END
        )
    FROM quotations q
    CROSS JOIN generate_series(0, 7) AS s;
    
    -- Insertion des factures pour les projets en cours ou terminés
    INSERT INTO invoices (id, project_id, reference, issue_date, due_date, total_ht, tva_rate, total_ttc, status, notes, payment_conditions)
    SELECT
        uuid_generate_v4(),
        p.id,
        'FAC-2023-' || LPAD(row_number() OVER (ORDER BY p.id)::text, 4, '0'),
        p.start_date + interval '15 days',
        p.start_date + interval '45 days',
        (SELECT total_ht * 0.3 FROM quotations WHERE project_id = p.id LIMIT 1),
        20.0,
        (SELECT total_ttc * 0.3 FROM quotations WHERE project_id = p.id LIMIT 1),
        CASE 
            WHEN p.start_date + interval '45 days' < CURRENT_DATE THEN (SELECT id FROM ref_status WHERE code = 'payée' AND entity_type = 'invoice')
            ELSE (SELECT id FROM ref_status WHERE code = 'envoyée' AND entity_type = 'invoice')
        END,
        'Facture d''acompte (30%) pour le projet ' || p.name,
        'Paiement à 30 jours'
    FROM projects p
    WHERE p.status != (SELECT id FROM ref_status WHERE code = 'prospect' AND entity_type = 'project');
    
    -- Insertion de factures intermédiaires pour les projets terminés ou avancés
    INSERT INTO invoices (id, project_id, reference, issue_date, due_date, total_ht, tva_rate, total_ttc, status, notes, payment_conditions)
    SELECT
        uuid_generate_v4(),
        p.id,
        'FAC-2023-' || LPAD((row_number() OVER (ORDER BY p.id) + 100)::text, 4, '0'),
        CASE
            WHEN p.start_date + ((p.end_date - p.start_date) / 2) < CURRENT_DATE THEN p.start_date + ((p.end_date - p.start_date) / 2)
            ELSE CURRENT_DATE - interval '30 days'
        END,
        CASE
            WHEN p.start_date + ((p.end_date - p.start_date) / 2) < CURRENT_DATE THEN p.start_date + ((p.end_date - p.start_date) / 2) + interval '30 days'
            ELSE CURRENT_DATE
        END,
        (SELECT total_ht * 0.4 FROM quotations WHERE project_id = p.id LIMIT 1),
        20.0,
        (SELECT total_ttc * 0.4 FROM quotations WHERE project_id = p.id LIMIT 1),
        CASE 
            WHEN p.status = (SELECT id FROM ref_status WHERE code = 'termine' AND entity_type = 'project') THEN (SELECT id FROM ref_status WHERE code = 'payée' AND entity_type = 'invoice')
            WHEN CURRENT_DATE > p.start_date + ((p.end_date - p.start_date) / 2) + interval '30 days' THEN (SELECT id FROM ref_status WHERE code = 'payée' AND entity_type = 'invoice')
            ELSE (SELECT id FROM ref_status WHERE code = 'envoyée' AND entity_type = 'invoice')
        END,
        'Facture intermédiaire (40%) pour le projet ' || p.name,
        'Paiement à 30 jours'
    FROM projects p
    WHERE p.status = (SELECT id FROM ref_status WHERE code = 'termine' AND entity_type = 'project')
       OR (p.status = (SELECT id FROM ref_status WHERE code = 'en_cours' AND entity_type = 'project') 
           AND p.start_date + interval '3 months' < CURRENT_DATE);
    
    -- Insertion de factures finales pour les projets terminés
    INSERT INTO invoices (id, project_id, reference, issue_date, due_date, total_ht, tva_rate, total_ttc, status, notes, payment_conditions)
    SELECT
        uuid_generate_v4(),
        p.id,
        'FAC-2023-' || LPAD((row_number() OVER (ORDER BY p.id) + 200)::text, 4, '0'),
        p.end_date,
        p.end_date + interval '30 days',
        (SELECT total_ht * 0.3 FROM quotations WHERE project_id = p.id LIMIT 1),
        20.0,
        (SELECT total_ttc * 0.3 FROM quotations WHERE project_id = p.id LIMIT 1),
        CASE 
            WHEN p.end_date + interval '30 days' < CURRENT_DATE THEN (SELECT id FROM ref_status WHERE code = 'payée' AND entity_type = 'invoice')
            ELSE (SELECT id FROM ref_status WHERE code = 'envoyée' AND entity_type = 'invoice')
        END,
        'Facture finale (30%) pour le projet ' || p.name,
        'Paiement à 30 jours'
    FROM projects p
    WHERE p.status = (SELECT id FROM ref_status WHERE code = 'termine' AND entity_type = 'project');
END $$;

-- Récupération des IDs pour les insertions de paiements
DO $$
DECLARE
    payment_method_codes text[];
BEGIN
    -- Récupération des codes de méthodes de paiement
    SELECT array_agg(code) INTO payment_method_codes FROM ref_payment_methods;
    
    -- Insertion des paiements pour les factures payées
    INSERT INTO payments (id, invoice_id, amount, payment_date, payment_method, reference, notes)
    SELECT
        uuid_generate_v4(),
        i.id,
        i.total_ttc,
        i.due_date - interval '5 days',
        pm.id,
        'PMT-' || TO_CHAR(i.due_date - interval '5 days', 'YYYYMMDD') || '-' || LPAD(row_number() OVER (ORDER BY i.id)::text, 4, '0'),
        'Paiement de la facture ' || i.reference
    FROM invoices i
    CROSS JOIN LATERAL (
        SELECT id FROM ref_payment_methods 
        WHERE code = payment_method_codes[1 + floor(random() * array_length(payment_method_codes, 1))::int]
        LIMIT 1
    ) pm
    WHERE i.status = (SELECT id FROM ref_status WHERE code = 'payée' AND entity_type = 'invoice');
END $$;

-- Insertion des dépenses
DO $$
DECLARE
    project_ids UUID[];
    supplier_ids UUID[];
    payment_method_ids UUID[];
BEGIN
    -- Récupération des IDs nécessaires
    SELECT array_agg(id) INTO project_ids FROM projects;
    SELECT array_agg(id) INTO supplier_ids FROM suppliers;
    SELECT array_agg(id) INTO payment_method_ids FROM ref_payment_methods;
    
    -- Insertion des catégories de dépenses
    INSERT INTO expense_categories (id, name, description)
    VALUES
        (uuid_generate_v4(), 'Matériaux', 'Achats de matériaux de construction'),
        (uuid_generate_v4(), 'Main d''œuvre', 'Coûts de main d''œuvre'),
        (uuid_generate_v4(), 'Location d''équipement', 'Location d''équipements et machines'),
        (uuid_generate_v4(), 'Transport', 'Frais de transport et livraison'),
        (uuid_generate_v4(), 'Administration', 'Frais administratifs'),
        (uuid_generate_v4(), 'Assurances', 'Assurances chantier'),
        (uuid_generate_v4(), 'Divers', 'Dépenses diverses');
    
    -- Insertion des dépenses pour chaque projet
    INSERT INTO expenses (id, project_id, category_id, description, amount, expense_date, payment_method, notes)
    SELECT
        uuid_generate_v4(),
        project_ids[1 + floor(random() * array_length(project_ids, 1))::int],
        (SELECT id FROM expense_categories ORDER BY random() LIMIT 1),
        CASE floor(random() * 5)::int
            WHEN 0 THEN 'Achat de matériaux de construction'
            WHEN 1 THEN 'Location engin de chantier'
            WHEN 2 THEN 'Frais de transport'
            WHEN 3 THEN 'Main d''œuvre sous-traitant'
            WHEN 4 THEN 'Équipements de sécurité'
        END,
        500 + floor(random() * 5000)::decimal,
        CURRENT_DATE - (floor(random() * 180)::int || ' days')::interval,
        payment_method_ids[1 + floor(random() * array_length(payment_method_ids, 1))::int],
        'Dépense courante de chantier'
    FROM generate_series(1, 50) AS s;
END $$;

-- Insertion du matériel
DO $$
DECLARE
    supplier_ids UUID[];
BEGIN
    -- Récupération des IDs nécessaires
    SELECT array_agg(id) INTO supplier_ids FROM suppliers;
    
    -- Insertion du matériel
    INSERT INTO materials (id, name, description, unit, unit_price, supplier_id, category, stock_quantity, minimum_stock)
    VALUES
        (uuid_generate_v4(), 'Béton prêt à l''emploi', 'Béton standard pour fondations', 'm³', 110.00, supplier_ids[1], 'Matériaux de construction', 25.5, 10.0),
        (uuid_generate_v4(), 'Sable fin', 'Sable fin pour mortier', 'tonne', 45.50, supplier_ids[1], 'Matériaux de construction', 12.0, 5.0),
        (uuid_generate_v4(), 'Parpaing 20x20x50', 'Bloc béton standard', 'unité', 2.75, supplier_ids[1], 'Matériaux de construction', 850, 200),
        (uuid_generate_v4(), 'Plaque de plâtre BA13', 'Plaque standard 2.5x1.2m', 'unité', 8.90, supplier_ids[1], 'Matériaux de construction', 120, 40),
        (uuid_generate_v4(), 'Carrelage grès cérame 60x60', 'Carrelage haut de gamme', 'm²', 28.50, supplier_ids[1], 'Revêtements', 85, 20),
        (uuid_generate_v4(), 'Peinture acrylique blanc mat', 'Peinture intérieure premium', 'litre', 12.75, supplier_ids[1], 'Peintures', 65, 15),
        (uuid_generate_v4(), 'Câble électrique 3G1.5', 'Câble standard installation domestique', 'mètre', 1.15, supplier_ids[3], 'Électricité', 450, 100),
        (uuid_generate_v4(), 'Tube cuivre Ø16', 'Tuyauterie sanitaire', 'mètre', 7.80, supplier_ids[4], 'Plomberie', 200, 50),
        (uuid_generate_v4(), 'Radiateur électrique 1500W', 'Radiateur à inertie', 'unité', 189.00, supplier_ids[3], 'Chauffage', 15, 5),
        (uuid_generate_v4(), 'Porte intérieure 83cm', 'Porte alvéolaire standard', 'unité', 79.90, supplier_ids[1], 'Menuiserie', 12, 3);
END $$;

-- Insertion d'équipements
DO $$
DECLARE
    supplier_ids UUID[];
    status_ids RECORD;
BEGIN
    -- Récupération des IDs nécessaires
    SELECT array_agg(id) INTO supplier_ids FROM suppliers;
    
    -- Récupération des IDs des statuts
    SELECT 
        (SELECT id FROM ref_equipment_status WHERE code = 'disponible') as disponible_id,
        (SELECT id FROM ref_equipment_status WHERE code = 'en_maintenance') as maintenance_id
    INTO status_ids;
    
    -- Insertion des équipements
    INSERT INTO equipment (id, name, description, purchase_date, purchase_price, status, supplier_id, last_maintenance_date, next_maintenance_date)
    VALUES
        (uuid_generate_v4(), 'Bétonnière 350L', 'Bétonnière professionnelle grande capacité', '2022-03-15', 2100.00, status_ids.disponible_id, supplier_ids[1], '2023-03-15', '2024-03-15'),
        (uuid_generate_v4(), 'Échafaudage modulaire', 'Échafaudage 3x6m hauteur 12m', '2021-07-20', 3500.00, status_ids.disponible_id, supplier_ids[1], '2023-06-10', '2024-06-10'),
        (uuid_generate_v4(), 'Perceuse-visseuse sans fil', 'Perceuse 18V lithium professionnelle', '2022-11-05', 420.00, status_ids.disponible_id, supplier_ids[2], '2023-11-05', '2024-11-05'),
        (uuid_generate_v4(), 'Scie circulaire sur table', 'Table de sciage professionnelle', '2022-05-18', 1850.00, status_ids.disponible_id, supplier_ids[2], '2023-05-18', '2024-05-18'),
        (uuid_generate_v4(), 'Marteau-piqueur', 'Marteau démolisseur électrique 15kg', '2023-01-10', 1250.00, status_ids.disponible_id, supplier_ids[2], '2023-10-10', '2024-10-10'),
        (uuid_generate_v4(), 'Niveau laser rotatif', 'Niveau laser professionnel extérieur', '2022-08-22', 780.00, status_ids.disponible_id, supplier_ids[2], '2023-08-22', '2024-08-22'),
        (uuid_generate_v4(), 'Mini-pelle 1,5t', 'Mini excavatrice thermique', '2020-09-30', 15000.00, status_ids.maintenance_id, supplier_ids[1], '2023-09-15', '2024-03-15'),
        (uuid_generate_v4(), 'Groupe électrogène 5kW', 'Groupe électrogène de chantier', '2021-11-15', 1900.00, status_ids.disponible_id, supplier_ids[3], '2023-10-20', '2024-10-20'),
        (uuid_generate_v4(), 'Compresseur d''air 100L', 'Compresseur professionnel', '2022-04-12', 850.00, status_ids.disponible_id, supplier_ids[2], '2023-04-12', '2024-04-12'),
        (uuid_generate_v4(), 'Meuleuse d''angle 230mm', 'Meuleuse professionnelle grande taille', '2023-02-20', 310.00, status_ids.disponible_id, supplier_ids[2], '2024-02-20', '2025-02-20');
END $$;

-- Insertion des événements calendrier
DO $$
DECLARE
    project_ids UUID[];
    staff_ids UUID[];
    event_type_ids UUID[];
BEGIN
    -- Récupération des IDs nécessaires
    SELECT array_agg(id) INTO project_ids FROM projects;
    SELECT array_agg(id) INTO staff_ids FROM staff;
    SELECT array_agg(id) INTO event_type_ids FROM ref_event_types;
    
    -- Insertion des événements généraux
    INSERT INTO calendar_events (id, title, description, start_date, end_date, event_type, location, project_id, staff_id)
    VALUES 
        (uuid_generate_v4(), 'Réunion équipe direction', 'Réunion hebdomadaire de coordination', CURRENT_DATE + interval '3 days', CURRENT_DATE + interval '3 days' + interval '2 hours', (SELECT id FROM ref_event_types WHERE code = 'reunion_interne'), 'Bureau principal', NULL, NULL),
        (uuid_generate_v4(), 'Formation sécurité', 'Formation obligatoire sécurité chantier', CURRENT_DATE + interval '10 days', CURRENT_DATE + interval '10 days' + interval '8 hours', (SELECT id FROM ref_event_types WHERE code = 'reunion_interne'), 'Centre de formation', NULL, NULL),
        (uuid_generate_v4(), 'Audit qualité annuel', 'Audit de certification ISO', CURRENT_DATE + interval '1 month', CURRENT_DATE + interval '1 month' + interval '2 days', (SELECT id FROM ref_event_types WHERE code = 'reunion_interne'), 'Bureau principal', NULL, NULL);
    
    -- Insertion des événements liés aux projets
    INSERT INTO calendar_events (id, title, description, start_date, end_date, event_type, location, project_id, staff_id)
    SELECT
        uuid_generate_v4(),
        'Visite chantier ' || (SELECT name FROM projects WHERE id = project_ids[1 + mod(s, array_length(project_ids, 1))]),
        'Visite technique avec le client',
        CURRENT_DATE + (s * 2 || ' days')::interval,
        CURRENT_DATE + (s * 2 || ' days')::interval + interval '3 hours',
        (SELECT id FROM ref_event_types WHERE code = 'visite_technique'),
        (SELECT address_id FROM projects WHERE id = project_ids[1 + mod(s, array_length(project_ids, 1))]),
        project_ids[1 + mod(s, array_length(project_ids, 1))],
        staff_ids[1 + mod(s, array_length(staff_ids, 1))]
    FROM generate_series(0, 10) AS s;
    
    -- Insertion des réunions de chantier
    INSERT INTO calendar_events (id, title, description, start_date, end_date, event_type, location, project_id, staff_id)
    SELECT
        uuid_generate_v4(),
        'Réunion chantier ' || (SELECT name FROM projects WHERE id = project_ids[1 + mod(s, array_length(project_ids, 1))]),
        'Réunion hebdomadaire de suivi',
        CURRENT_DATE + (s * 7 || ' days')::interval,
        CURRENT_DATE + (s * 7 || ' days')::interval + interval '1 hour 30 minutes',
        (SELECT id FROM ref_event_types WHERE code = 'reunion_chantier'),
        (SELECT address_id FROM projects WHERE id = project_ids[1 + mod(s, array_length(project_ids, 1))]),
        project_ids[1 + mod(s, array_length(project_ids, 1))],
        staff_ids[1 + mod(s, array_length(staff_ids, 1))]
    FROM generate_series(0, 8) AS s;
END $$;

-- Insertion des rapports de chantier quotidiens
DO $$
DECLARE
    project_ids UUID[];
    staff_ids UUID[];
BEGIN
    -- Récupération des IDs nécessaires
    SELECT array_agg(id) INTO project_ids FROM projects WHERE status = (SELECT id FROM ref_status WHERE code = 'en_cours' AND entity_type = 'project');
    SELECT array_agg(id) INTO staff_ids FROM staff;
    
    -- Insertion des rapports quotidiens
    INSERT INTO daily_site_reports (id, project_id, report_date, weather_conditions, temperature, hours_worked, work_done, issues_encountered, materials_used, next_day_planning, staff_id)
    SELECT
        uuid_generate_v4(),
        project_ids[1 + mod(s, array_length(project_ids, 1))],
        CURRENT_DATE - (mod(s, 30) || ' days')::interval,
        CASE mod(s, 5)
            WHEN 0 THEN 'Ensoleillé'
            WHEN 1 THEN 'Nuageux'
            WHEN 2 THEN 'Pluie légère'
            WHEN 3 THEN 'Vent fort'
            WHEN 4 THEN 'Couvert'
        END,
        CASE mod(s, 5)
            WHEN 0 THEN 22
            WHEN 1 THEN 18
            WHEN 2 THEN 15
            WHEN 3 THEN 12
            WHEN 4 THEN 20
        END,
        mod(s, 8) + 3,
        CASE mod(s, 4)
            WHEN 0 THEN 'Coulage des fondations. Pose des gaines électriques.'
            WHEN 1 THEN 'Montage des murs. Installation des menuiseries.'
            WHEN 2 THEN 'Travaux de plomberie. Installation sanitaire.'
            WHEN 3 THEN 'Travaux de finition. Peinture et revêtements.'
        END,
        CASE 
            WHEN mod(s, 10) = 0 THEN 'Retard livraison matériaux. Problème résolu par commande alternative.'
            WHEN mod(s, 10) = 5 THEN 'Infiltration légère suite à la pluie. Mise en place bâche protection.'
            ELSE NULL
        END,
        CASE mod(s, 3)
            WHEN 0 THEN '{"Béton": "4m³", "Acier": "250kg"}'::jsonb
            WHEN 1 THEN '{"Parpaings": "120", "Mortier": "0.5m³"}'::jsonb
            WHEN 2 THEN '{"Plaques de plâtre": "25", "Peinture": "40L"}'::jsonb
        END,
        CASE mod(s, 4)
            WHEN 0 THEN 'Poursuite coulage des fondations. Installation coffrage.'
            WHEN 1 THEN 'Finition structure murs. Début pose cloisons.'
            WHEN 2 THEN 'Suite travaux plomberie. Début électricité.'
            WHEN 3 THEN 'Poursuite peinture. Démarrage pose revêtements sols.'
        END,
        staff_ids[1 + mod(s, array_length(staff_ids, 1))]
    FROM generate_series(0, 120) AS s;
END $$;

-- Insertion des points de contrôle qualité
DO $$
DECLARE
    project_ids UUID[];
    stage_ids UUID[];
    staff_ids UUID[];
    status_ids RECORD;
BEGIN
    -- Récupération des IDs nécessaires
    SELECT array_agg(id) INTO project_ids FROM projects WHERE status = (SELECT id FROM ref_status WHERE code = 'en_cours' AND entity_type = 'project') OR status = (SELECT id FROM ref_status WHERE code = 'termine' AND entity_type = 'project');
    SELECT array_agg(id) INTO stage_ids FROM stages WHERE status = (SELECT id FROM ref_status WHERE code = 'en_cours' AND entity_type = 'stage') OR status = (SELECT id FROM ref_status WHERE code = 'termine' AND entity_type = 'stage');
    SELECT array_agg(id) INTO staff_ids FROM staff;
    
    -- Récupération des IDs des statuts
    SELECT 
        (SELECT id FROM ref_quality_checkpoint_status WHERE code = 'validé') as valide_id,
        (SELECT id FROM ref_quality_checkpoint_status WHERE code = 'rejeté') as rejete_id,
        (SELECT id FROM ref_quality_checkpoint_status WHERE code = 'à_faire') as a_faire_id
    INTO status_ids;
    
    -- Insertion des points de contrôle qualité
    INSERT INTO quality_checkpoints (id, project_id, stage_id, name, description, deadline, status, notes, completed_by, completed_at, required_photos)
    SELECT
        uuid_generate_v4(),
        project_ids[1 + mod(s, array_length(project_ids, 1))],
        stage_ids[1 + mod(s, array_length(stage_ids, 1))],
        CASE mod(s, 5)
            WHEN 0 THEN 'Contrôle fondations'
            WHEN 1 THEN 'Vérification structure'
            WHEN 2 THEN 'Inspection électricité'
            WHEN 3 THEN 'Contrôle plomberie'
            WHEN 4 THEN 'Validation finitions'
        END,
        CASE mod(s, 5)
            WHEN 0 THEN 'Vérification qualité béton et respect des normes parasismiques'
            WHEN 1 THEN 'Contrôle solidité charpente et murs porteurs'
            WHEN 2 THEN 'Validation conformité installation électrique'
            WHEN 3 THEN 'Test d''étanchéité et contrôle installations sanitaires'
            WHEN 4 THEN 'Inspection des finitions et de la qualité des revêtements'
        END,
        CURRENT_DATE - (mod(s, 60) || ' days')::interval,
        CASE 
            WHEN mod(s, 10) < 7 THEN status_ids.valide_id
            WHEN mod(s, 10) < 9 THEN status_ids.rejete_id
            ELSE status_ids.a_faire_id
        END,
        CASE 
            WHEN mod(s, 10) >= 7 AND mod(s, 10) < 9 THEN 
                CASE mod(s, 3)
                    WHEN 0 THEN 'Défaut d''aplomb mur nord: écart 2cm'
                    WHEN 1 THEN 'Problème d''étanchéité douche principale'
                    WHEN 2 THEN 'Finition peinture irrégulière salon'
                END
            ELSE NULL
        END,
        CASE 
            WHEN mod(s, 10) < 7 THEN staff_ids[1 + mod(s, array_length(staff_ids, 1))]
            ELSE NULL
        END,
        CASE 
            WHEN mod(s, 10) < 7 THEN CURRENT_DATE - (mod(s, 60) || ' days')::interval
            ELSE NULL
        END,
        CASE 
            WHEN mod(s, 5) = 0 THEN true
            ELSE false
        END
    FROM generate_series(0, 40) AS s;
END $$;

-- Insertion des notes de chantier
DO $$
DECLARE
    project_ids UUID[];
    staff_ids UUID[];
    note_type_ids RECORD;
    note_priority_ids RECORD;
    note_status_ids RECORD;
BEGIN
    -- Récupération des IDs nécessaires
    SELECT array_agg(id) INTO project_ids FROM projects;
    SELECT array_agg(id) INTO staff_ids FROM staff;
    
    -- Récupération des IDs des types de notes
    SELECT 
        (SELECT id FROM ref_note_types WHERE code = 'modification') as modification_id,
        (SELECT id FROM ref_note_types WHERE code = 'technique') as technique_id,
        (SELECT id FROM ref_note_types WHERE code = 'client') as client_id,
        (SELECT id FROM ref_note_types WHERE code = 'probleme') as probleme_id,
        (SELECT id FROM ref_note_types WHERE code = 'installation') as installation_id
    INTO note_type_ids;
    
    -- Récupération des IDs des priorités
    SELECT 
        (SELECT id FROM ref_note_priorities WHERE code = 'basse') as basse_id,
        (SELECT id FROM ref_note_priorities WHERE code = 'moyenne') as moyenne_id,
        (SELECT id FROM ref_note_priorities WHERE code = 'haute') as haute_id
    INTO note_priority_ids;
    
    -- Récupération des IDs des statuts
    SELECT 
        (SELECT id FROM ref_note_status WHERE code = 'nouveau') as nouveau_id,
        (SELECT id FROM ref_note_status WHERE code = 'en_cours') as en_cours_id,
        (SELECT id FROM ref_note_status WHERE code = 'termine') as termine_id,
        (SELECT id FROM ref_note_status WHERE code = 'annule') as annule_id
    INTO note_status_ids;
    
    -- Insertion des notes de chantier
    INSERT INTO site_notes (id, project_id, staff_id, note_type, content, priority, status, photos)
    SELECT
        uuid_generate_v4(),
        project_ids[1 + mod(s, array_length(project_ids, 1))],
        staff_ids[1 + mod(s, array_length(staff_ids, 1))],
        CASE mod(s, 5)
            WHEN 0 THEN note_type_ids.modification_id
            WHEN 1 THEN note_type_ids.technique_id
            WHEN 2 THEN note_type_ids.client_id
            WHEN 3 THEN note_type_ids.probleme_id
            WHEN 4 THEN note_type_ids.installation_id
        END,
        CASE mod(s, 5)
            WHEN 0 THEN 'Suite à la demande du client, modifier l''emplacement de l''îlot central et ajouter un point d''eau supplémentaire.'
            WHEN 1 THEN 'Renforcer l''isolation acoustique entre le salon et la chambre principale suite aux tests sonores.'
            WHEN 2 THEN 'Remplacer le carrelage prévu par du parquet dans le séjour selon nouvelle demande client.'
            WHEN 3 THEN 'Traces d''humidité détectées sur mur nord du sous-sol. Prévoir étude et travaux d''étanchéité.'
            WHEN 4 THEN 'Ajouter 3 prises supplémentaires dans bureau et 2 dans chambre d''amis selon plan modifié.'
        END,
        CASE mod(s, 3)
            WHEN 0 THEN note_priority_ids.basse_id
            WHEN 1 THEN note_priority_ids.moyenne_id
            WHEN 2 THEN note_priority_ids.haute_id
        END,
        CASE mod(s, 4)
            WHEN 0 THEN note_status_ids.nouveau_id
            WHEN 1 THEN note_status_ids.en_cours_id
            WHEN 2 THEN note_status_ids.termine_id
            WHEN 3 THEN note_status_ids.annule_id
        END,
        CASE 
            WHEN mod(s, 4) = 0 THEN ARRAY['documents/notes/' || s || '.pdf', 'photos/notes/' || s || '.jpg']
            ELSE NULL
        END
    FROM generate_series(0, 35) AS s;
END $$;

-- Insertion des plannings hebdomadaires
DO $$
DECLARE
    project_ids UUID[];
    staff_ids UUID[];
BEGIN
    -- Récupération des IDs nécessaires
    SELECT array_agg(id) INTO project_ids FROM projects;
    SELECT array_agg(id) INTO staff_ids FROM staff;
    
    -- Insertion des plannings hebdomadaires
    INSERT INTO worker_weekly_schedule (id, staff_id, week_start_date, schedule, total_hours)
    SELECT
        uuid_generate_v4(),
        staff_ids[1 + mod(s, array_length(staff_ids, 1))],
        CURRENT_DATE - ((mod(s, 4) * 7) || ' days')::interval,
        jsonb_build_object(
            'monday', CASE mod(s + 0, 5) WHEN 4 THEN NULL ELSE project_ids[1 + mod(s + 0, array_length(project_ids, 1))] END,
            'tuesday', CASE mod(s + 1, 5) WHEN 4 THEN NULL ELSE project_ids[1 + mod(s + 1, array_length(project_ids, 1))] END,
            'wednesday', CASE mod(s + 2, 5) WHEN 4 THEN NULL ELSE project_ids[1 + mod(s + 2, array_length(project_ids, 1))] END,
            'thursday', CASE mod(s + 3, 5) WHEN 4 THEN NULL ELSE project_ids[1 + mod(s + 3, array_length(project_ids, 1))] END,
            'friday', CASE mod(s + 4, 5) WHEN 4 THEN NULL ELSE project_ids[1 + mod(s + 4, array_length(project_ids, 1))] END,
            'special_instructions', CASE 
                WHEN mod(s, 7) = 0 THEN 'Apporter l''échafaudage mobile pour travaux en hauteur'
                WHEN mod(s, 7) = 3 THEN 'Réunion d''équipe mercredi 8h30 au bureau'
                WHEN mod(s, 7) = 5 THEN 'Formation sécurité obligatoire vendredi après-midi'
                ELSE NULL
            END
        ),
        35 + mod(s, 5) -- Entre 35 et 39 heures par semaine
    FROM generate_series(0, 35) AS s;
END $$;

-- Insertion des demandes de matériaux
DO $$
DECLARE
    project_ids UUID[];
    staff_ids UUID[];
    status_ids RECORD;
BEGIN
    -- Récupération des IDs nécessaires
    SELECT array_agg(id) INTO project_ids FROM projects;
    SELECT array_agg(id) INTO staff_ids FROM staff;
    
    -- Récupération des IDs des statuts
    SELECT 
        (SELECT id FROM ref_material_request_status WHERE code = 'pending') as pending_id,
        (SELECT id FROM ref_material_request_status WHERE code = 'approved') as approved_id,
        (SELECT id FROM ref_material_request_status WHERE code = 'delivered') as delivered_id,
        (SELECT id FROM ref_material_request_status WHERE code = 'partially_delivered') as partially_delivered_id
    INTO status_ids;
    
    -- Insertion des demandes de matériaux
    INSERT INTO material_requests (id, project_id, request_date, requested_by, needed_by_date, status, notes)
    SELECT
        uuid_generate_v4(),
        project_ids[1 + mod(s, array_length(project_ids, 1))],
        CURRENT_DATE - ((mod(s, 10) + 1) || ' days')::interval,
        staff_ids[1 + mod(s, array_length(staff_ids, 1))],
        CURRENT_DATE + ((mod(s, 5) + 2) || ' days')::interval,
        CASE mod(s, 4)
            WHEN 0 THEN status_ids.pending_id
            WHEN 1 THEN status_ids.approved_id
            WHEN 2 THEN status_ids.delivered_id
            WHEN 3 THEN status_ids.partially_delivered_id
        END,
        CASE mod(s, 3)
            WHEN 0 THEN 'Livraison à prévoir avant 10h'
            WHEN 1 THEN 'Matériaux nécessaires pour phase finale'
            WHEN 2 THEN 'Commander en urgence pour éviter retard de chantier'
        END
    FROM generate_series(0, 20) AS s;
END $$;

-- Insertion des suivis d'équipement
DO $$
DECLARE
    project_ids UUID[];
    equipment_ids UUID[];
    staff_ids UUID[];
    condition_ids RECORD;
BEGIN
    -- Récupération des IDs nécessaires
    SELECT array_agg(id) INTO project_ids FROM projects;
    SELECT array_agg(id) INTO equipment_ids FROM equipment;
    SELECT array_agg(id) INTO staff_ids FROM staff;
    
    -- Récupération des IDs des conditions
    SELECT 
        (SELECT id FROM ref_equipment_condition WHERE code = 'excellent') as excellent_id,
        (SELECT id FROM ref_equipment_condition WHERE code = 'bon') as bon_id,
        (SELECT id FROM ref_equipment_condition WHERE code = 'acceptable') as acceptable_id
    INTO condition_ids;
    
    -- Insertion des suivis d'équipement
    INSERT INTO site_equipment_tracking (id, project_id, equipment_id, check_out_time, expected_return_time, actual_return_time, staff_id, condition_at_checkout, notes)
    SELECT
        uuid_generate_v4(),
        project_ids[1 + mod(s, array_length(project_ids, 1))],
        equipment_ids[1 + mod(s, array_length(equipment_ids, 1))],
        CURRENT_DATE - ((mod(s, 14) + 1) || ' days')::interval,
        CURRENT_DATE + ((mod(s, 7) + 1) || ' days')::interval,
        CASE 
            WHEN mod(s, 3) = 0 THEN CURRENT_DATE - ((mod(s, 3)) || ' days')::interval
            ELSE NULL
        END,
        staff_ids[1 + mod(s, array_length(staff_ids, 1))],
        CASE mod(s, 3)
            WHEN 0 THEN condition_ids.excellent_id
            WHEN 1 THEN condition_ids.bon_id
            WHEN 2 THEN condition_ids.acceptable_id
        END,
        CASE 
            WHEN mod(s, 5) = 0 THEN 'Vérifier l''état des lames avant retour'
            WHEN mod(s, 5) = 2 THEN 'Besoin d''un entretien après utilisation intensive'
            ELSE NULL
        END
    FROM generate_series(0, 15) AS s;
END $$;

COMMIT;
-- Réactiver les triggers
SET session_replication_role = 'origin';
