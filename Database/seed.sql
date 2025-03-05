BEGIN;

-- Désactiver temporairement le trigger de création de partition
ALTER TABLE activity_logs DISABLE TRIGGER activity_logs_insert_trigger;

-- Insertion d'utilisateurs admin et standards
INSERT INTO users (firstname, lastname, age, email, password, role_id) VALUES 
    ('Jordan', 'Serafini', 35, 'jordan@solution-logique.fr', 'pass123', 1),
    ('Admin', 'System', 30, 'admin@technidalle.fr', 'admin123', 1),
    ('User', 'Standard', 25, 'user@technidalle.fr', 'user123', 2);

-- Insertion du personnel avec des rôles spécifiques au carrelage
INSERT INTO staff (firstname, lastname, email, role, phone, is_available) VALUES 
    ('Jean', 'Dupont', 'jean.dupont@technidalle.fr', 'Chef carreleur', '06 11 22 33 44', true),
    ('Marie', 'Laurent', 'marie.laurent@technidalle.fr', 'Conductrice de travaux', '06 22 33 44 55', true),
    ('Paul', 'Michel', 'paul.michel@technidalle.fr', 'Carreleur confirmé', '06 33 44 55 66', false),
    ('Lucas', 'Martin', 'lucas.martin@technidalle.fr', 'Chapiste', '06 44 55 66 77', true),
    ('Thomas', 'Petit', 'thomas.petit@technidalle.fr', 'Carreleur', '06 66 77 88 99', true),
    ('Antoine', 'Garcia', 'antoine.garcia@technidalle.fr', 'Chapiste', '06 88 99 00 11', true),
    ('Hugo', 'Lefevre', 'hugo.lefevre@technidalle.fr', 'Carreleur apprenti', '06 00 11 22 33', false),
    ('Sarah', 'Dubois', 'sarah.dubois@technidalle.fr', 'Conductrice de travaux', '06 11 22 33 55', true),
    ('Nicolas', 'Girard', 'nicolas.girard@technidalle.fr', 'Chef carreleur', '06 22 33 44 66', true),
    ('Maxime', 'Rousseau', 'maxime.rousseau@technidalle.fr', 'Chapiste confirmé', '06 44 55 66 88', true),
    ('Laura', 'Fontaine', 'laura.fontaine@technidalle.fr', 'Carreleur', '06 33 44 55 77', true),
    ('Alexandre', 'Bonnet', 'alexandre.bonnet@technidalle.fr', 'Carreleur confirmé', '06 66 77 88 00', true);

-- Insertion des clients avec des adresses réalistes
INSERT INTO clients (firstname, lastname, street_number, street_name, zip_code, city, email, phone) VALUES 
    ('Pierre', 'Durand', '15', 'Rue des Alpes', '74000', 'Annecy', 'p.durand@email.com', '06 12 34 56 78'),
    ('Immobilier', 'Savoie SARL', '45', 'Avenue du Parmelan', '74370', 'Argonay', 'contact@immobilier-savoie.fr', '04 50 27 89 12'),
    ('Résidence', 'Les Clarines', '8', 'Route des Aravis', '74450', 'Le Grand-Bornand', 'gestion@lesclarines.fr', '04 50 02 31 48'),
    ('Sophie', 'Martin', '23', 'Chemin du Vieux Pont', '74150', 'Rumilly', 'sophie.martin@email.com', '06 78 91 23 45'),
    ('Promotion', 'Alpes Construction', '156', 'Route des Creuses', '74600', 'Seynod', 'contact@alpes-construction.fr', '04 50 69 12 34'),
    ('Marc', 'Leroy', '12', 'Rue du Mont Blanc', '74940', 'Annecy-le-Vieux', 'm.leroy@email.com', '06 45 78 91 23'),
    ('Copropriété', 'Le Panorama', '34', 'Avenue de Genève', '74160', 'Saint-Julien-en-Genevois', 'syndic@lepanorama.fr', '04 50 35 67 89'),
    ('Laurent', 'Dubois', '78', 'Rue des Écoles', '74100', 'Ville-la-Grand', 'l.dubois@email.com', '06 89 12 34 56');

-- Insertion des matériaux spécifiques au carrelage et à la chape
INSERT INTO materials (name, description, unit, price, quantity) VALUES 
    ('Carrelage grès cérame 60x60', 'Grès cérame rectifié aspect béton gris', 'm²', 35.00, 1500),
    ('Carrelage grès cérame 80x80', 'Grès cérame rectifié aspect marbre blanc', 'm²', 45.00, 800),
    ('Carrelage 30x60 mural', 'Faïence blanche rectifiée', 'm²', 28.00, 600),
    ('Chape fluide anhydrite', 'Chape liquide à base de sulfate de calcium', 'm²', 18.00, 2000),
    ('Mortier colle Keraflex', 'Mortier colle amélioré C2ET', 'sac 25kg', 25.00, 200),
    ('Primaire d''adhérence', 'Primaire d''accrochage pour chape', 'bidon 20L', 85.00, 30),
    ('Bande périphérique', 'Bande de désolidarisation 5mm', 'rouleau 50m', 15.00, 50),
    ('Croisillons 2mm', 'Croisillons autonivelants', 'sachet 500', 12.00, 100),
    ('Joint souple gris', 'Joint de carrelage hydrofuge', 'sac 5kg', 22.00, 150),
    ('Profilé alu quart de rond', 'Profilé de finition', 'barre 2.5m', 8.50, 200),
    ('Natte d''étanchéité', 'Système d''étanchéité sous carrelage', 'rouleau 30m²', 180.00, 15),
    ('Mortier de chape', 'Mortier pour chape traditionnelle', 'tonne', 180.00, 20),
    ('Treillis de chape', 'Treillis métallique anti-fissuration', 'rouleau 50m²', 45.00, 40),
    ('Carrelage antidérapant R11', 'Grès cérame 30x30 pour extérieur', 'm²', 32.00, 300),
    ('Colle époxy', 'Colle et joint époxy pour zones humides', 'kit 5kg', 85.00, 25),
    ('Carrelage grès cérame 120x120', 'Grès cérame grand format aspect pierre', 'm²', 65.00, 400),
    ('Sous-couche acoustique', 'Isolation phonique sous carrelage', 'rouleau 20m²', 120.00, 25),
    ('Profilé de dilatation', 'Joint de dilatation pour grands formats', 'barre 3m', 22.00, 50),
    ('Mortier de jointoiement', 'Joint fin hydrofuge', 'sac 5kg', 18.00, 180),
    ('Système de nivellement', 'Croisillons auto-nivelants réutilisables', 'kit 100pcs', 45.00, 40);

-- Insertion de projets réalistes
INSERT INTO projects (client_id, name, description, street_number, street_name, zip_code, city, start_date, end_date, status) VALUES 
    -- Semaine précédente
    (1, 'Rénovation salle de bain', 'Pose carrelage sol et murs salle de bain 8m²', '15', 'Rue des Alpes', '74000', 'Annecy', 
        CURRENT_DATE - INTERVAL '1 week', CURRENT_DATE - INTERVAL '5 days', 'termine'),
    (2, 'Chape et carrelage appartements', 'Réalisation chape et carrelage 5 appartements T3', '45', 'Avenue du Parmelan', '74370', 'Argonay', 
        CURRENT_DATE - INTERVAL '1 week', CURRENT_DATE + INTERVAL '2 days', 'en_cours'),
    (3, 'Carrelage espaces communs', 'Pose carrelage hall et coursives 300m²', '8', 'Route des Aravis', '74450', 'Le Grand-Bornand', 
        CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '2 days', 'en_cours'),

    -- Semaine en cours
    (4, 'Rénovation cuisine', 'Dépose ancien carrelage et pose nouveau 20m²', '23', 'Chemin du Vieux Pont', '74150', 'Rumilly', 
        CURRENT_DATE, CURRENT_DATE + INTERVAL '3 days', 'en_cours'),
    (5, 'Programme neuf Les Clarines', 'Chape et carrelage 15 logements', '156', 'Route des Creuses', '74600', 'Seynod', 
        CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '5 days', 'prospect'),
    (6, 'Rénovation complète appartement', 'Chape et carrelage 85m²', '12', 'Rue du Mont Blanc', '74940', 'Annecy-le-Vieux', 
        CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '4 days', 'prospect'),

    -- Semaine suivante
    (7, 'Terrasse extérieure', 'Pose carrelage extérieur R11 120m²', '34', 'Avenue de Genève', '74160', 'Saint-Julien-en-Genevois', 
        CURRENT_DATE + INTERVAL '1 week', CURRENT_DATE + INTERVAL '1 week 4 days', 'prospect'),
    (8, 'Rénovation hammam', 'Étanchéité et carrelage mosaïque 45m²', '78', 'Rue des Écoles', '74100', 'Ville-la-Grand', 
        CURRENT_DATE + INTERVAL '1 week 2 days', CURRENT_DATE + INTERVAL '1 week 5 days', 'prospect');

-- Insertion des étapes de projet détaillées
INSERT INTO stages (project_id, staff_id, name, description, duration_days, start_date, end_date, status, order_index) VALUES 
    -- Projet 1: Rénovation salle de bain (terminé)
    (1, 1, 'Préparation support', 'Dépose ancien carrelage et préparation support', 1, CURRENT_DATE - INTERVAL '1 week', CURRENT_DATE - INTERVAL '6 days', 'termine', 1),
    (1, 1, 'Pose carrelage sol', 'Pose carrelage sol salle de bain', 2, CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE - INTERVAL '5 days', 'termine', 2),
    (1, 1, 'Pose carrelage mural', 'Pose faïence murale salle de bain', 1, CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '5 days', 'termine', 3),
    
    -- Projet 2: Chape et carrelage appartements (en cours)
    (2, 4, 'Coulage chapes', 'Réalisation des chapes dans les 5 appartements', 5, CURRENT_DATE - INTERVAL '1 week', CURRENT_DATE - INTERVAL '2 days', 'termine', 1),
    (2, 3, 'Pose carrelage apt 1-2', 'Carrelage premiers appartements', 8, CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '1 day', 'en_cours', 2),
    (2, 5, 'Pose carrelage apt 3-5', 'Carrelage derniers appartements', 8, CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '2 days', 'en_cours', 3),
    
    -- Projet 3: Carrelage espaces communs
    (3, 9, 'Zone hall entrée', 'Pose carrelage hall principal', 5, CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE - INTERVAL '5 days', 'termine', 1),
    (3, 9, 'Coursives RDC', 'Pose carrelage coursives rez-de-chaussée', 8, CURRENT_DATE - INTERVAL '4 days', CURRENT_DATE + INTERVAL '4 days', 'en_cours', 2),
    (3, 3, 'Coursives étages', 'Pose carrelage coursives étages', 8, CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE + INTERVAL '12 days', 'en_cours', 3),

    -- Projet 4: Rénovation cuisine
    (4, 5, 'Dépose ancien carrelage', 'Dépose et évacuation ancien carrelage', 1, CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE - INTERVAL '3 days', 'termine', 1),
    (4, 5, 'Préparation support', 'Ragréage et préparation support', 1, CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE - INTERVAL '2 days', 'termine', 2),
    (4, 5, 'Pose carrelage', 'Pose nouveau carrelage', 2, CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE, 'en_cours', 3),
    (4, 5, 'Joints', 'Réalisation des joints', 1, CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '1 day', 'en_cours', 4),

    -- Projet 5: Programme neuf Les Clarines
    (5, 4, 'Chape logements 1-5', 'Réalisation chapes premiers logements', 10, CURRENT_DATE + INTERVAL '30 days', CURRENT_DATE + INTERVAL '40 days', 'prospect', 1),
    (5, 6, 'Chape logements 6-10', 'Réalisation chapes deuxième tranche', 10, CURRENT_DATE + INTERVAL '41 days', CURRENT_DATE + INTERVAL '51 days', 'prospect', 2),
    (5, 10, 'Chape logements 11-15', 'Réalisation chapes dernière tranche', 10, CURRENT_DATE + INTERVAL '52 days', CURRENT_DATE + INTERVAL '62 days', 'prospect', 3),
    (5, 3, 'Carrelage logements 1-5', 'Pose carrelage premiers logements', 15, CURRENT_DATE + INTERVAL '45 days', CURRENT_DATE + INTERVAL '60 days', 'prospect', 4),
    (5, 11, 'Carrelage logements 6-10', 'Pose carrelage deuxième tranche', 15, CURRENT_DATE + INTERVAL '56 days', CURRENT_DATE + INTERVAL '71 days', 'prospect', 5),
    (5, 12, 'Carrelage logements 11-15', 'Pose carrelage dernière tranche', 15, CURRENT_DATE + INTERVAL '67 days', CURRENT_DATE + INTERVAL '82 days', 'prospect', 6);

-- Insertion des devis
INSERT INTO quotations (project_id, created_date, total, status, validity_date, reference, tva_rate, payment_conditions, notes) VALUES
    (1, CURRENT_DATE - INTERVAL '10 days', 2800.00, 'accepté', CURRENT_DATE + INTERVAL '20 days', 'DEV-2024-001', 20.00, '30% à la commande, solde à la fin des travaux', 'Travaux à réaliser en semaine'),
    (2, CURRENT_DATE - INTERVAL '15 days', 42000.00, 'accepté', CURRENT_DATE + INTERVAL '15 days', 'DEV-2024-002', 20.00, '40% à la commande, 30% à la fin des chapes, 30% à la fin des travaux', 'Accès chantier par l''arrière du bâtiment'),
    (3, CURRENT_DATE - INTERVAL '20 days', 28500.00, 'accepté', CURRENT_DATE + INTERVAL '10 days', 'DEV-2024-003', 20.00, '50% à la commande, solde à la fin des travaux', 'Travaux à réaliser en coordination avec le plombier'),
    (4, CURRENT_DATE - INTERVAL '5 days', 3200.00, 'accepté', CURRENT_DATE + INTERVAL '25 days', 'DEV-2024-004', 20.00, '100% à la fin des travaux', 'Protection des meubles à prévoir'),
    (5, CURRENT_DATE, 156000.00, 'en_attente', CURRENT_DATE + INTERVAL '30 days', 'DEV-2024-005', 20.00, '30% à la commande, 40% à mi-chantier, 30% à la réception', 'Prix négocié pour volume important'),
    (6, CURRENT_DATE - INTERVAL '2 days', 12500.00, 'en_attente', CURRENT_DATE + INTERVAL '28 days', 'DEV-2024-006', 20.00, '40% à la commande, solde à la fin des travaux', 'Option pose sur ancien carrelage à étudier'),
    (7, CURRENT_DATE - INTERVAL '1 day', 18000.00, 'en_attente', CURRENT_DATE + INTERVAL '29 days', 'DEV-2024-007', 20.00, '30% à la commande, solde à la fin des travaux', 'Sous réserve conditions météo favorables'),
    (8, CURRENT_DATE - INTERVAL '8 days', 15600.00, 'accepté', CURRENT_DATE + INTERVAL '22 days', 'DEV-2024-008', 20.00, '50% à la commande, solde à la fin des travaux', 'Utilisation colle et joint époxy spécifiques');

-- Insertion des produits du devis
INSERT INTO quotation_products (quotation_id, product_name, description, quantity, unit_price, unit, category) VALUES
    -- Devis 1: Rénovation salle de bain
    (1, 'Dépose ancien carrelage', 'Dépose et évacuation ancien carrelage', 8, 35.00, 'm²', 'main_doeuvre'),
    (1, 'Carrelage sol 60x60', 'Fourniture carrelage grès cérame', 8, 35.00, 'm²', 'matériaux'),
    (1, 'Carrelage mural 30x60', 'Fourniture faïence murale', 24, 28.00, 'm²', 'matériaux'),
    (1, 'Pose carrelage sol', 'Main d''œuvre pose sol', 8, 45.00, 'm²', 'main_doeuvre'),
    (1, 'Pose carrelage mural', 'Main d''œuvre pose mural', 24, 48.00, 'm²', 'main_doeuvre'),
    (1, 'Mortier colle', 'Fourniture mortier colle', 4, 25.00, 'sac', 'matériaux'),
    (1, 'Joint', 'Fourniture et réalisation joints', 1, 150.00, 'forfait', 'matériaux'),

    -- Devis 2: Chape et carrelage appartements
    (2, 'Chape liquide', 'Fourniture et coulage chape', 300, 32.00, 'm²', 'matériaux'),
    (2, 'Carrelage 60x60', 'Fourniture carrelage', 300, 35.00, 'm²', 'matériaux'),
    (2, 'Main d''œuvre chape', 'Réalisation des chapes', 300, 18.00, 'm²', 'main_doeuvre'),
    (2, 'Main d''œuvre carrelage', 'Pose du carrelage', 300, 38.00, 'm²', 'main_doeuvre'),
    (2, 'Transport', 'Livraison matériaux', 1, 450.00, 'forfait', 'transport'),
    (2, 'Joints', 'Fourniture et réalisation', 300, 4.50, 'm²', 'matériaux'),

    -- Devis 3: Carrelage espaces communs
    (3, 'Carrelage 80x80', 'Fourniture carrelage grand format', 300, 45.00, 'm²', 'matériaux'),
    (3, 'Pose carrelage', 'Main d''œuvre pose', 300, 42.00, 'm²', 'main_doeuvre'),
    (3, 'Profilés', 'Profilés de finition', 40, 8.50, 'ml', 'matériaux'),
    (3, 'Transport', 'Livraison matériaux', 1, 350.00, 'forfait', 'transport'),

    -- Devis 4: Rénovation cuisine
    (4, 'Dépose', 'Dépose ancien carrelage', 20, 35.00, 'm²', 'main_doeuvre'),
    (4, 'Carrelage 60x60', 'Fourniture carrelage', 20, 35.00, 'm²', 'matériaux'),
    (4, 'Pose', 'Main d''œuvre pose', 20, 45.00, 'm²', 'main_doeuvre'),
    (4, 'Plinthes', 'Fourniture et pose plinthes', 18, 12.00, 'ml', 'matériaux');

-- Insertion des matériaux utilisés par projet
INSERT INTO project_materials (project_id, material_id, quantity, unit_price) VALUES 
    -- Projet 1: Rénovation salle de bain
    (1, 1, 8, 35.00),  -- Carrelage sol sdb
    (1, 3, 24, 28.00), -- Carrelage mural sdb
    (1, 5, 4, 25.00),  -- Mortier colle
    (1, 8, 2, 12.00),  -- Croisillons
    (1, 9, 3, 22.00),  -- Joint
    
    -- Projet 2: Chape et carrelage appartements
    (2, 4, 300, 32.00),  -- Chape fluide
    (2, 6, 4, 25.00),    -- Primaire
    (2, 7, 10, 15.00),   -- Bande périphérique
    (2, 1, 250, 35.00),  -- Carrelage 60x60
    (2, 5, 50, 25.00),   -- Mortier colle
    
    -- Projet 3: Carrelage espaces communs
    (3, 2, 300, 45.00),  -- Carrelage 80x80
    (3, 5, 60, 25.00),   -- Mortier colle
    (3, 9, 30, 22.00),   -- Joint
    (3, 10, 40, 8.50),   -- Profilés

    -- Projet 4: Rénovation cuisine
    (4, 1, 20, 35.00),   -- Carrelage 60x60
    (4, 5, 6, 25.00),    -- Mortier colle
    (4, 9, 4, 22.00),    -- Joint
    
    -- Projet 5: Programme neuf Les Clarines
    (5, 4, 900, 32.00),   -- Chape fluide
    (5, 6, 15, 25.00),    -- Primaire
    (5, 7, 30, 15.00),    -- Bande périphérique
    (5, 16, 800, 65.00),  -- Carrelage 120x120
    (5, 5, 160, 25.00),   -- Mortier colle
    (5, 17, 15, 120.00),   -- Sous-couche acoustique
    (5, 18, 20, 22.00);   -- Profilé de dilatation

-- Insertion des affectations personnel-projet
INSERT INTO project_staff (project_id, staff_id) VALUES 
    (1, 1), (1, 7),           -- Rénovation salle de bain
    (2, 4), (2, 3), (2, 5),   -- Chape et carrelage appartements
    (3, 9), (3, 3), (3, 11),  -- Carrelage espaces communs
    (4, 5), (4, 7),           -- Rénovation cuisine
    (5, 4), (5, 6), (5, 10),  -- Programme neuf Les Clarines
    (5, 3), (5, 11), (5, 12);

-- Ajout de nouveaux projets (3 par jour sur 2 semaines)
INSERT INTO projects (client_id, name, description, street_number, street_name, zip_code, city, start_date, end_date, status) VALUES 
    -- Jour 1
    (1, 'Salle de bain moderne', 'Rénovation complète salle de bain 6m²', '15', 'Rue des Alpes', '74000', 'Annecy', 
        CURRENT_DATE, CURRENT_DATE + INTERVAL '2 days', 'en_cours'),
    (3, 'Cuisine contemporaine', 'Pose carrelage sol et crédence 15m²', '8', 'Route des Aravis', '74450', 'Le Grand-Bornand', 
        CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day', 'en_cours'),
    (4, 'Entrée appartement', 'Pose carrelage entrée et couloir 12m²', '23', 'Chemin du Vieux Pont', '74150', 'Rumilly', 
        CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day', 'en_cours'),

    -- Jour 2
    (2, 'Studio location', 'Rénovation complète studio 25m²', '45', 'Avenue du Parmelan', '74370', 'Argonay', 
        CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '4 days', 'prospect'),
    (5, 'Local commercial', 'Pose carrelage boutique 80m²', '156', 'Route des Creuses', '74600', 'Seynod', 
        CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '3 days', 'prospect'),
    (6, 'Douche italienne', 'Installation douche à l''italienne 4m²', '12', 'Rue du Mont Blanc', '74940', 'Annecy-le-Vieux', 
        CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '2 days', 'prospect'),

    -- Jour 3
    (7, 'Hall immeuble', 'Rénovation hall d''entrée 40m²', '34', 'Avenue de Genève', '74160', 'Saint-Julien-en-Genevois', 
        CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '4 days', 'prospect'),
    (8, 'Terrasse couverte', 'Carrelage terrasse 35m²', '78', 'Rue des Écoles', '74100', 'Ville-la-Grand', 
        CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '3 days', 'prospect'),
    (1, 'WC suspendus', 'Carrelage sol et faïence WC 4m²', '15', 'Rue des Alpes', '74000', 'Annecy', 
        CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '3 days', 'prospect'),

    -- Jour 4
    (2, 'Appartement T2', 'Chape et carrelage T2 45m²', '45', 'Avenue du Parmelan', '74370', 'Argonay', 
        CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE + INTERVAL '7 days', 'prospect'),
    (3, 'SPA Hotel', 'Carrelage espace bien-être 120m²', '8', 'Route des Aravis', '74450', 'Le Grand-Bornand', 
        CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE + INTERVAL '8 days', 'prospect'),
    (4, 'Buanderie', 'Carrelage et étanchéité buanderie 8m²', '23', 'Chemin du Vieux Pont', '74150', 'Rumilly', 
        CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE + INTERVAL '4 days', 'prospect'),

    -- Jour 5
    (5, 'Restaurant', 'Carrelage cuisine professionnelle 60m²', '156', 'Route des Creuses', '74600', 'Seynod', 
        CURRENT_DATE + INTERVAL '4 days', CURRENT_DATE + INTERVAL '7 days', 'prospect'),
    (6, 'Cave à vin', 'Carrelage cave à vin 25m²', '12', 'Rue du Mont Blanc', '74940', 'Annecy-le-Vieux', 
        CURRENT_DATE + INTERVAL '4 days', CURRENT_DATE + INTERVAL '5 days', 'prospect'),
    (7, 'Balcons résidence', 'Étanchéité et carrelage 15 balcons', '34', 'Avenue de Genève', '74160', 'Saint-Julien-en-Genevois', 
        CURRENT_DATE + INTERVAL '4 days', CURRENT_DATE + INTERVAL '9 days', 'prospect');

-- Insertion des étapes pour les nouveaux projets
INSERT INTO stages (project_id, staff_id, name, description, duration_days, start_date, end_date, status, order_index) VALUES 
    -- Salle de bain moderne (2 jours)
    (9, 1, 'Dépose existant', 'Démolition et évacuation', 0.5, CURRENT_DATE, CURRENT_DATE, 'en_cours', 1),
    (9, 1, 'Préparation supports', 'Ragréage et étanchéité', 0.5, CURRENT_DATE, CURRENT_DATE, 'en_cours', 2),
    (9, 1, 'Pose sol', 'Carrelage sol et plinthes', 0.5, CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '1 day', 'prospect', 3),
    (9, 1, 'Pose murs', 'Faïence murale', 0.5, CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '2 days', 'prospect', 4),

    -- Cuisine contemporaine (1 jour)
    (10, 3, 'Préparation', 'Protection et préparation surface', 0.2, CURRENT_DATE, CURRENT_DATE, 'en_cours', 1),
    (10, 3, 'Pose sol', 'Carrelage sol cuisine', 0.5, CURRENT_DATE, CURRENT_DATE, 'en_cours', 2),
    (10, 3, 'Crédence', 'Pose faïence crédence', 0.3, CURRENT_DATE, CURRENT_DATE, 'prospect', 3),

    -- Studio location (4 jours)
    (12, 4, 'Chape', 'Coulage chape complète', 1, CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '1 day', 'prospect', 1),
    (12, 4, 'Séchage', 'Temps de séchage chape', 2, CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '3 days', 'prospect', 2),
    (12, 5, 'Carrelage', 'Pose carrelage complet', 1, CURRENT_DATE + INTERVAL '4 days', CURRENT_DATE + INTERVAL '4 days', 'prospect', 3),

    -- Local commercial (3 jours)
    (13, 9, 'Préparation', 'Vérification support et traçage', 0.5, CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '1 day', 'prospect', 1),
    (13, 9, 'Zone 1', 'Pose carrelage première moitié', 1, CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '2 days', 'prospect', 2),
    (13, 9, 'Zone 2', 'Pose carrelage seconde moitié', 1, CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '3 days', 'prospect', 3),
    (13, 9, 'Joints', 'Réalisation des joints', 0.5, CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE + INTERVAL '3 days', 'prospect', 4),

    -- SPA Hotel (8 jours)
    (20, 1, 'Étanchéité', 'Système d''étanchéité complet', 2, CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE + INTERVAL '4 days', 'prospect', 1),
    (20, 3, 'Carrelage sol', 'Pose carrelage antidérapant', 3, CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE + INTERVAL '7 days', 'prospect', 2),
    (20, 5, 'Carrelage mural', 'Pose carrelage mural décoratif', 2, CURRENT_DATE + INTERVAL '6 days', CURRENT_DATE + INTERVAL '7 days', 'prospect', 3),
    (20, 1, 'Finitions', 'Joints et silicone', 1, CURRENT_DATE + INTERVAL '8 days', CURRENT_DATE + INTERVAL '8 days', 'prospect', 4),

    -- Restaurant (3 jours)
    (21, 11, 'Préparation', 'Protection et ragréage', 1, CURRENT_DATE + INTERVAL '4 days', CURRENT_DATE + INTERVAL '4 days', 'prospect', 1),
    (21, 11, 'Zone cuisson', 'Carrelage zone cuisson', 1, CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE + INTERVAL '5 days', 'prospect', 2),
    (21, 11, 'Zone préparation', 'Carrelage zone préparation', 1, CURRENT_DATE + INTERVAL '6 days', CURRENT_DATE + INTERVAL '6 days', 'prospect', 3),
    (21, 11, 'Plinthes à gorge', 'Pose plinthes spéciales', 1, CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE + INTERVAL '7 days', 'prospect', 4),

    -- Balcons résidence (5 jours)
    (23, 4, 'Préparation', 'Nettoyage et préparation', 1, CURRENT_DATE + INTERVAL '4 days', CURRENT_DATE + INTERVAL '4 days', 'prospect', 1),
    (23, 4, 'Étanchéité', 'Système d''étanchéité', 2, CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE + INTERVAL '6 days', 'prospect', 2),
    (23, 6, 'Carrelage', 'Pose carrelage extérieur', 3, CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE + INTERVAL '9 days', 'prospect', 3);

-- Insertion des affectations personnel-projet pour les nouveaux projets
INSERT INTO project_staff (project_id, staff_id) VALUES 
    (9, 1), (9, 7),    -- Salle de bain moderne
    (10, 3), (10, 7),  -- Cuisine contemporaine
    (12, 4), (12, 5),  -- Studio location
    (13, 9), (13, 11), -- Local commercial
    (20, 1), (20, 3), (20, 5), -- SPA Hotel
    (21, 11), (21, 12), -- Restaurant
    (23, 4), (23, 6);  -- Balcons résidence

-- Ajout des étapes manquantes pour les projets
INSERT INTO stages (project_id, staff_id, name, description, duration_days, start_date, end_date, status, order_index) VALUES 
    -- Entrée appartement (1 jour)
    (11, 5, 'Protection', 'Protection des zones adjacentes', 0.2, CURRENT_DATE, CURRENT_DATE, 'en_cours', 1),
    (11, 5, 'Dépose existant', 'Dépose ancien revêtement', 0.3, CURRENT_DATE, CURRENT_DATE, 'en_cours', 2),
    (11, 5, 'Pose carrelage', 'Pose du nouveau carrelage', 0.4, CURRENT_DATE, CURRENT_DATE, 'prospect', 3),
    (11, 5, 'Joints', 'Réalisation des joints', 0.1, CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '1 day', 'prospect', 4),

    -- Douche italienne (2 jours)
    (14, 1, 'Préparation', 'Préparation support et étanchéité', 0.5, CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '1 day', 'prospect', 1),
    (14, 1, 'Étanchéité', 'Pose système d''étanchéité', 0.5, CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '1 day', 'prospect', 2),
    (14, 1, 'Carrelage sol', 'Pose carrelage sol avec pente', 0.5, CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '2 days', 'prospect', 3),
    (14, 1, 'Carrelage mural', 'Pose carrelage mural', 0.5, CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '2 days', 'prospect', 4),

    -- Hall immeuble (4 jours)
    (15, 9, 'Protection', 'Installation protections et balisage', 0.5, CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '2 days', 'prospect', 1),
    (15, 9, 'Dépose', 'Dépose ancien carrelage', 1, CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '2 days', 'prospect', 2),
    (15, 9, 'Préparation', 'Préparation support', 0.5, CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE + INTERVAL '3 days', 'prospect', 3),
    (15, 9, 'Pose', 'Pose nouveau carrelage', 1.5, CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE + INTERVAL '4 days', 'prospect', 4),
    (15, 9, 'Finitions', 'Joints et nettoyage', 0.5, CURRENT_DATE + INTERVAL '4 days', CURRENT_DATE + INTERVAL '4 days', 'prospect', 5),

    -- Terrasse couverte (3 jours)
    (16, 3, 'Préparation', 'Nettoyage et préparation support', 0.5, CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '2 days', 'prospect', 1),
    (16, 3, 'Étanchéité', 'Pose système d''étanchéité', 1, CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '2 days', 'prospect', 2),
    (16, 3, 'Pose carrelage', 'Pose carrelage extérieur', 1, CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE + INTERVAL '3 days', 'prospect', 3),
    (16, 3, 'Joints', 'Joints spéciaux extérieur', 0.5, CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE + INTERVAL '3 days', 'prospect', 4),

    -- WC suspendus (3 jours)
    (17, 5, 'Démolition', 'Dépose ancien carrelage', 0.5, CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '2 days', 'prospect', 1),
    (17, 5, 'Préparation', 'Préparation supports', 0.5, CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '2 days', 'prospect', 2),
    (17, 5, 'Carrelage sol', 'Pose carrelage sol', 1, CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE + INTERVAL '3 days', 'prospect', 3),
    (17, 5, 'Faïence', 'Pose faïence murale', 1, CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE + INTERVAL '3 days', 'prospect', 4),

    -- Appartement T2 (7 jours)
    (18, 4, 'Préparation', 'Préparation support', 1, CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE + INTERVAL '3 days', 'prospect', 1),
    (18, 4, 'Chape', 'Coulage chape', 1, CURRENT_DATE + INTERVAL '4 days', CURRENT_DATE + INTERVAL '4 days', 'prospect', 2),
    (18, 4, 'Séchage', 'Temps de séchage', 3, CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE + INTERVAL '7 days', 'prospect', 3),
    (18, 3, 'Carrelage', 'Pose carrelage', 2, CURRENT_DATE + INTERVAL '6 days', CURRENT_DATE + INTERVAL '7 days', 'prospect', 4),

    -- Buanderie (4 jours)
    (19, 11, 'Dépose', 'Dépose ancien revêtement', 1, CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE + INTERVAL '3 days', 'prospect', 1),
    (19, 11, 'Étanchéité', 'Pose système d''étanchéité', 1, CURRENT_DATE + INTERVAL '4 days', CURRENT_DATE + INTERVAL '4 days', 'prospect', 2),
    (19, 11, 'Carrelage', 'Pose carrelage antidérapant', 1, CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE + INTERVAL '5 days', 'prospect', 3),
    (19, 11, 'Finitions', 'Joints et remontées en plinthe', 1, CURRENT_DATE + INTERVAL '6 days', CURRENT_DATE + INTERVAL '6 days', 'prospect', 4),

    -- Cave à vin (5 jours)
    (22, 12, 'Préparation', 'Préparation sol et murs', 1, CURRENT_DATE + INTERVAL '4 days', CURRENT_DATE + INTERVAL '4 days', 'prospect', 1),
    (22, 12, 'Étanchéité', 'Traitement étanchéité', 1, CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE + INTERVAL '5 days', 'prospect', 2),
    (22, 12, 'Sol', 'Pose carrelage sol', 1.5, CURRENT_DATE + INTERVAL '6 days', CURRENT_DATE + INTERVAL '7 days', 'prospect', 3),
    (22, 12, 'Murs', 'Pose carrelage mural', 1.5, CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE + INTERVAL '8 days', 'prospect', 4);

-- Ajout des affectations personnel-projet manquantes
INSERT INTO project_staff (project_id, staff_id) VALUES 
    (11, 5), (11, 7),  -- Entrée appartement
    (14, 1), (14, 7),  -- Douche italienne
    (15, 9), (15, 11), -- Hall immeuble
    (16, 3), (16, 5),  -- Terrasse couverte
    (17, 5), (17, 7),  -- WC suspendus
    (18, 4), (18, 3),  -- Appartement T2
    (19, 11), (19, 12), -- Buanderie
    (22, 12), (22, 5);  -- Cave à vin

-- Ajout des devis pour les nouveaux projets
INSERT INTO quotations (project_id, created_date, total, status, validity_date, reference, tva_rate, payment_conditions, notes) VALUES
    -- Salle de bain moderne
    (9, CURRENT_DATE - INTERVAL '5 days', 3200.00, 'accepté', CURRENT_DATE + INTERVAL '25 days', 'DEV-2024-009', 20.00, 
    '40% à la commande, solde à la fin des travaux', 'Travaux en site occupé'),
    
    -- Cuisine contemporaine
    (10, CURRENT_DATE - INTERVAL '4 days', 2800.00, 'accepté', CURRENT_DATE + INTERVAL '26 days', 'DEV-2024-010', 20.00,
    '30% à la commande, solde à la fin des travaux', 'Protection des meubles de cuisine incluse'),
    
    -- Entrée appartement
    (11, CURRENT_DATE - INTERVAL '3 days', 1800.00, 'accepté', CURRENT_DATE + INTERVAL '27 days', 'DEV-2024-011', 20.00,
    '100% à la fin des travaux', 'Intervention rapide demandée'),
    
    -- Studio location
    (12, CURRENT_DATE - INTERVAL '2 days', 4500.00, 'accepté', CURRENT_DATE + INTERVAL '28 days', 'DEV-2024-012', 20.00,
    '50% à la commande, solde à la fin des travaux', 'Chape et carrelage complet'),
    
    -- Local commercial
    (13, CURRENT_DATE - INTERVAL '2 days', 12000.00, 'accepté', CURRENT_DATE + INTERVAL '28 days', 'DEV-2024-013', 20.00,
    '40% à la commande, 30% à mi-chantier, 30% à la fin', 'Travaux hors horaires d''ouverture'),
    
    -- Douche italienne
    (14, CURRENT_DATE - INTERVAL '3 days', 2200.00, 'accepté', CURRENT_DATE + INTERVAL '27 days', 'DEV-2024-014', 20.00,
    '30% à la commande, solde à la fin des travaux', 'Système d''étanchéité spécifique inclus'),
    
    -- Hall immeuble
    (15, CURRENT_DATE - INTERVAL '4 days', 8500.00, 'accepté', CURRENT_DATE + INTERVAL '26 days', 'DEV-2024-015', 20.00,
    '40% à la commande, solde à la fin des travaux', 'Protection et balisage renforcés'),
    
    -- Terrasse couverte
    (16, CURRENT_DATE - INTERVAL '5 days', 6200.00, 'accepté', CURRENT_DATE + INTERVAL '25 days', 'DEV-2024-016', 20.00,
    '40% à la commande, solde à la fin des travaux', 'Sous réserve conditions météo'),
    
    -- WC suspendus
    (17, CURRENT_DATE - INTERVAL '4 days', 1900.00, 'accepté', CURRENT_DATE + INTERVAL '26 days', 'DEV-2024-017', 20.00,
    '100% à la fin des travaux', 'Petite surface, intervention rapide'),
    
    -- Appartement T2
    (18, CURRENT_DATE - INTERVAL '3 days', 8800.00, 'accepté', CURRENT_DATE + INTERVAL '27 days', 'DEV-2024-018', 20.00,
    '40% à la commande, 30% après chape, 30% à la fin', 'Chape et carrelage complet'),
    
    -- Buanderie
    (19, CURRENT_DATE - INTERVAL '2 days', 2400.00, 'accepté', CURRENT_DATE + INTERVAL '28 days', 'DEV-2024-019', 20.00,
    '50% à la commande, solde à la fin des travaux', 'Étanchéité spécifique incluse'),
    
    -- SPA Hotel
    (20, CURRENT_DATE - INTERVAL '5 days', 28000.00, 'accepté', CURRENT_DATE + INTERVAL '25 days', 'DEV-2024-020', 20.00,
    '30% à la commande, 40% à mi-chantier, 30% à la fin', 'Carrelage antidérapant spécifique'),
    
    -- Restaurant
    (21, CURRENT_DATE - INTERVAL '3 days', 15600.00, 'accepté', CURRENT_DATE + INTERVAL '27 days', 'DEV-2024-021', 20.00,
    '40% à la commande, solde à la fin des travaux', 'Carrelage technique cuisine professionnelle'),
    
    -- Cave à vin
    (22, CURRENT_DATE - INTERVAL '2 days', 5800.00, 'accepté', CURRENT_DATE + INTERVAL '28 days', 'DEV-2024-022', 20.00,
    '30% à la commande, solde à la fin des travaux', 'Traitement anti-humidité inclus'),
    
    -- Balcons résidence
    (23, CURRENT_DATE - INTERVAL '1 day', 22000.00, 'accepté', CURRENT_DATE + INTERVAL '29 days', 'DEV-2024-023', 20.00,
    '40% à la commande, 30% après étanchéité, 30% à la fin', 'Système d''étanchéité garantie 10 ans');

-- Ajout des produits pour les nouveaux devis
INSERT INTO quotation_products (quotation_id, product_name, description, quantity, unit_price, unit, category) VALUES
    -- Salle de bain moderne (Devis 9)
    (9, 'Dépose existant', 'Dépose ancien carrelage et évacuation', 6, 35.00, 'm²', 'main_doeuvre'),
    (9, 'Carrelage sol 60x60', 'Fourniture carrelage grès cérame', 6, 35.00, 'm²', 'matériaux'),
    (9, 'Carrelage mural 30x60', 'Fourniture faïence murale', 18, 28.00, 'm²', 'matériaux'),
    (9, 'Pose sol', 'Main d''œuvre pose sol', 6, 45.00, 'm²', 'main_doeuvre'),
    (9, 'Pose mural', 'Main d''œuvre pose mural', 18, 48.00, 'm²', 'main_doeuvre'),
    (9, 'Mortier colle', 'Fourniture mortier colle', 4, 25.00, 'sac', 'matériaux'),
    (9, 'Joint', 'Fourniture et réalisation joints', 1, 150.00, 'forfait', 'matériaux'),

    -- Cuisine contemporaine (Devis 10)
    (10, 'Carrelage sol 60x60', 'Fourniture carrelage cuisine', 15, 38.00, 'm²', 'matériaux'),
    (10, 'Carrelage crédence', 'Fourniture carrelage mural', 6, 32.00, 'm²', 'matériaux'),
    (10, 'Pose sol', 'Main d''œuvre pose sol', 15, 45.00, 'm²', 'main_doeuvre'),
    (10, 'Pose crédence', 'Main d''œuvre pose murale', 6, 55.00, 'm²', 'main_doeuvre'),
    
    -- Local commercial (Devis 13)
    (13, 'Carrelage technique', 'Fourniture carrelage grand format', 80, 48.00, 'm²', 'matériaux'),
    (13, 'Pose carrelage', 'Main d''œuvre pose complète', 80, 52.00, 'm²', 'main_doeuvre'),
    (13, 'Joints techniques', 'Joints spéciaux forte résistance', 80, 8.00, 'm²', 'matériaux'),
    
    -- SPA Hotel (Devis 20)
    (20, 'Étanchéité', 'Système d''étanchéité complet', 120, 45.00, 'm²', 'matériaux'),
    (20, 'Carrelage antidérapant', 'Carrelage spécial R11', 120, 55.00, 'm²', 'matériaux'),
    (20, 'Carrelage mural', 'Carrelage décoratif', 180, 42.00, 'm²', 'matériaux'),
    (20, 'Main d''œuvre', 'Pose complète', 300, 48.00, 'm²', 'main_doeuvre');

-- Ajout des matériaux utilisés pour les nouveaux projets
INSERT INTO project_materials (project_id, material_id, quantity, unit_price) VALUES 
    -- Salle de bain moderne
    (9, 1, 6, 35.00),    -- Carrelage sol
    (9, 3, 18, 28.00),   -- Carrelage mural
    (9, 5, 3, 25.00),    -- Mortier colle
    (9, 8, 2, 12.00),    -- Croisillons
    (9, 9, 1, 22.00),    -- Joint
    
    -- Cuisine contemporaine
    (10, 1, 15, 35.00),  -- Carrelage sol
    (10, 3, 6, 28.00),   -- Carrelage mural
    (10, 5, 4, 25.00),   -- Mortier colle
    (10, 9, 2, 22.00),   -- Joint
    
    -- Entrée appartement
    (11, 2, 12, 45.00),  -- Carrelage 80x80
    (11, 5, 3, 25.00),   -- Mortier colle
    (11, 9, 1, 22.00),   -- Joint
    
    -- Local commercial
    (13, 14, 80, 32.00), -- Carrelage antidérapant
    (13, 5, 20, 25.00),  -- Mortier colle
    (13, 9, 8, 22.00),   -- Joint
    
    -- SPA Hotel
    (20, 11, 120, 180.00), -- Natte d'étanchéité
    (20, 14, 120, 32.00),  -- Carrelage antidérapant
    (20, 5, 30, 25.00),    -- Mortier colle
    (20, 9, 12, 22.00),    -- Joint
    
    -- Restaurant
    (21, 14, 60, 32.00),  -- Carrelage antidérapant
    (21, 5, 15, 25.00),   -- Mortier colle
    (21, 9, 6, 22.00);    -- Joint

-- Modification des événements du calendrier
INSERT INTO calendar_events (
    title,
    description,
    event_type,
    start_date,
    end_date,
    all_day,
    location,
    project_id,
    staff_id,
    client_id,
    status
) VALUES 
    -- Semaine précédente
    (
        'Réception chantier - Salle de bain',
        'Réception finale avec le client',
        'reunion_chantier',
        CURRENT_DATE - INTERVAL '5 days' + INTERVAL '14 hours',
        CURRENT_DATE - INTERVAL '5 days' + INTERVAL '15 hours',
        false,
        'Annecy',
        1,
        2,
        1,
        'termine'
    ),
    (
        'Formation nouveaux matériaux',
        'Formation technique équipe',
        'formation',
        CURRENT_DATE - INTERVAL '3 days' + INTERVAL '9 hours',
        CURRENT_DATE - INTERVAL '3 days' + INTERVAL '17 hours',
        false,
        'Atelier Technidalle',
        NULL,
        1,
        NULL,
        'termine'
    ),

    -- Semaine en cours
    (
        'Livraison carrelage - Cuisine',
        'Livraison matériaux',
        'livraison_materiaux',
        CURRENT_DATE + INTERVAL '1 day' + INTERVAL '8 hours',
        CURRENT_DATE + INTERVAL '1 day' + INTERVAL '10 hours',
        false,
        'Rumilly',
        4,
        4,
        4,
        'en_cours'
    ),
    (
        'Réunion de chantier - Les Clarines',
        'Point d''avancement',
        'reunion_chantier',
        CURRENT_DATE + INTERVAL '2 days' + INTERVAL '14 hours',
        CURRENT_DATE + INTERVAL '2 days' + INTERVAL '16 hours',
        false,
        'Seynod',
        5,
        2,
        5,
        'en_cours'
    ),

    -- Semaine suivante
    (
        'Visite technique - Terrasse',
        'Vérification support',
        'visite_technique',
        CURRENT_DATE + INTERVAL '1 week 1 day' + INTERVAL '9 hours',
        CURRENT_DATE + INTERVAL '1 week 1 day' + INTERVAL '11 hours',
        false,
        'Saint-Julien-en-Genevois',
        7,
        2,
        7,
        'en_cours'
    ),
    (
        'Réunion équipe hebdomadaire',
        'Point hebdomadaire',
        'reunion_interne',
        CURRENT_DATE + INTERVAL '1 week 3 days' + INTERVAL '8 hours',
        CURRENT_DATE + INTERVAL '1 week 3 days' + INTERVAL '10 hours',
        false,
        'Bureau Technidalle',
        NULL,
        2,
        NULL,
        'en_cours'
    );

-- Points quotidiens sur les 3 semaines
INSERT INTO calendar_events (
    title,
    description,
    event_type,
    start_date,
    end_date,
    all_day,
    location,
    project_id,
    staff_id,
    status
)
SELECT 
    'Point quotidien équipe',
    'Brief quotidien des équipes',
    'reunion_interne',
    CURRENT_DATE + (n || ' days')::INTERVAL - INTERVAL '1 week' + INTERVAL '8 hours',
    CURRENT_DATE + (n || ' days')::INTERVAL - INTERVAL '1 week' + INTERVAL '8 hours 30 minutes',
    false,
    'Bureau Technidalle',
    NULL,
    2,
    CASE 
        WHEN CURRENT_DATE + (n || ' days')::INTERVAL - INTERVAL '1 week' < CURRENT_DATE THEN 'termine'
        ELSE 'en_cours'
    END
FROM generate_series(0, 14) n
WHERE extract(dow from CURRENT_DATE + (n || ' days')::INTERVAL - INTERVAL '1 week') BETWEEN 1 AND 5;

-- Remplissage de la table document_embeddings avec des exemples
INSERT INTO document_embeddings (document_type, document_id, content) VALUES 
    ('project', 1, 'Rénovation salle de bain carrelage pose complète faïence salle d''eau'),
    ('project', 2, 'Chape et carrelage appartements neufs grand format grès cérame'),
    ('project', 3, 'Carrelage espaces communs hall entrée résidence'),
    ('client', 1, 'Pierre Durand Annecy particulier'),
    ('client', 2, 'Immobilier Savoie SARL professionnel promoteur'),
    ('client', 3, 'Résidence Les Clarines copropriété'),
    ('quotation', 1, 'Devis salle de bain rénovation complète'),
    ('quotation', 2, 'Devis chape carrelage appartements neufs'),
    ('quotation', 8, 'Devis rénovation hammam pose mosaïque');

-- Insertion de logs d'activité pour simuler l'utilisation du système
INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES
    -- Activités passées
    (1, 'create', 'project', 1, '{"name": "Rénovation salle de bain", "client_id": 1}'::jsonb, '192.168.1.10'),
    (1, 'create', 'quotation', 1, '{"project_id": 1, "total": 2800.00}'::jsonb, '192.168.1.10'),
    (2, 'update', 'quotation', 1, '{"status": "accepté", "previous_status": "en_attente"}'::jsonb, '192.168.1.15'),
    (2, 'create', 'project', 2, '{"name": "Chape et carrelage appartements", "client_id": 2}'::jsonb, '192.168.1.15'),
    (1, 'update', 'project', 1, '{"status": "termine", "previous_status": "en_cours"}'::jsonb, '192.168.1.10'),
    (3, 'view', 'client', 3, ('{"timestamp": "' || (CURRENT_DATE - INTERVAL '8 days')::TEXT || '"}')::jsonb, '192.168.1.20'),
    
    -- Activités récentes
    (1, 'create', 'project', 9, '{"name": "Salle de bain moderne", "client_id": 1}'::jsonb, '192.168.1.10'),
    (2, 'create', 'quotation', 9, '{"project_id": 9, "total": 3200.00}'::jsonb, '192.168.1.15'),
    (2, 'update', 'quotation', 9, '{"status": "accepté", "previous_status": "en_attente"}'::jsonb, '192.168.1.15'),
    (1, 'create', 'project', 10, '{"name": "Cuisine contemporaine", "client_id": 3}'::jsonb, '192.168.1.10'),
    (3, 'view', 'client', 5, ('{"timestamp": "' || (CURRENT_DATE - INTERVAL '2 days')::TEXT || '"}')::jsonb, '192.168.1.20'),
    (1, 'update', 'project', 4, '{"status": "en_cours", "previous_status": "prospect"}'::jsonb, '192.168.1.10'),
    
    -- Activités d'aujourd'hui
    (2, 'view', 'project', 5, ('{"timestamp": "' || CURRENT_DATE::TEXT || '"}')::jsonb, '192.168.1.15'),
    (1, 'create', 'calendar_event', 5, '{"title": "Réunion de chantier - Les Clarines", "project_id": 5}'::jsonb, '192.168.1.10'),
    (3, 'update', 'quotation', 5, '{"notes": "Prix négocié pour volume important", "previous_notes": ""}'::jsonb, '192.168.1.20'),
    (2, 'view', 'stage', 15, ('{"timestamp": "' || CURRENT_DATE::TEXT || '"}')::jsonb, '192.168.1.15'),
    (1, 'update', 'staff', 3, '{"is_available": false, "previous_status": true}'::jsonb, '192.168.1.10');

-- Ajout de plusieurs événements de calendrier pour avoir un planning complet
-- Réunions clients
INSERT INTO calendar_events (
    title,
    description,
    event_type,
    start_date,
    end_date,
    all_day,
    location,
    project_id,
    staff_id,
    client_id,
    status
) VALUES 
    (
        'Rendez-vous client - Projet balcons',
        'Discussion technique et planning',
        'rendez_vous_client',
        CURRENT_DATE + INTERVAL '2 days' + INTERVAL '14 hours',
        CURRENT_DATE + INTERVAL '2 days' + INTERVAL '15 hours',
        false,
        'Bureau Technidalle',
        23,
        2,
        7,
        'en_cours'
    ),
    (
        'Signature devis - Cave à vin',
        'Finalisation contrat',
        'rendez_vous_client',
        CURRENT_DATE + INTERVAL '3 days' + INTERVAL '10 hours',
        CURRENT_DATE + INTERVAL '3 days' + INTERVAL '11 hours',
        false,
        'Bureau Technidalle',
        22,
        2,
        6,
        'en_cours'
    ),
    (
        'Présentation échantillons - Spa Hôtel',
        'Choix finaux matériaux',
        'rendez_vous_client',
        CURRENT_DATE + INTERVAL '5 days' + INTERVAL '9 hours',
        CURRENT_DATE + INTERVAL '5 days' + INTERVAL '10 hours 30 minutes',
        false,
        'Le Grand-Bornand',
        20,
        1,
        3,
        'en_cours'
    );

-- Livraisons matériaux
INSERT INTO calendar_events (
    title,
    description,
    event_type,
    start_date,
    end_date,
    all_day,
    location,
    project_id,
    staff_id,
    status
) VALUES 
    (
        'Livraison chape - Studio location',
        'Livraison matériaux chape',
        'livraison_materiaux',
        CURRENT_DATE + INTERVAL '1 day' + INTERVAL '7 hours',
        CURRENT_DATE + INTERVAL '1 day' + INTERVAL '9 hours',
        false,
        'Argonay',
        12,
        4,
        'en_cours'
    ),
    (
        'Livraison carrelage - Local commercial',
        'Livraison carrelage technique',
        'livraison_materiaux',
        CURRENT_DATE + INTERVAL '1 day' + INTERVAL '13 hours',
        CURRENT_DATE + INTERVAL '1 day' + INTERVAL '15 hours',
        false,
        'Seynod',
        13,
        9,
        'en_cours'
    ),
    (
        'Livraison matériaux - SPA Hotel',
        'Livraison carrelage et étanchéité',
        'livraison_materiaux',
        CURRENT_DATE + INTERVAL '1 week' + INTERVAL '8 hours',
        CURRENT_DATE + INTERVAL '1 week' + INTERVAL '12 hours',
        false,
        'Le Grand-Bornand',
        20,
        1,
        'en_cours'
    );

-- Interventions techniques
INSERT INTO calendar_events (
    title,
    description,
    event_type,
    start_date,
    end_date,
    all_day,
    location,
    project_id,
    staff_id,
    status
) VALUES 
    (
        'Visite technique - Restaurant',
        'Vérification supports',
        'visite_technique',
        CURRENT_DATE + INTERVAL '3 days' + INTERVAL '8 hours',
        CURRENT_DATE + INTERVAL '3 days' + INTERVAL '10 hours',
        false,
        'Seynod',
        21,
        11,
        'en_cours'
    ),
    (
        'Contrôle qualité - Chape appartements',
        'Vérification séchage et planéité',
        'visite_technique',
        CURRENT_DATE + INTERVAL '2 days' + INTERVAL '10 hours',
        CURRENT_DATE + INTERVAL '2 days' + INTERVAL '12 hours',
        false,
        'Argonay',
        2,
        2,
        'en_cours'
    );

-- Formation équipe
INSERT INTO calendar_events (
    title,
    description,
    event_type,
    start_date,
    end_date,
    all_day,
    location,
    staff_id,
    status
) VALUES 
    (
        'Formation sécurité chantier',
        'Formation obligatoire sécurité',
        'formation',
        CURRENT_DATE + INTERVAL '2 weeks' + INTERVAL '9 hours',
        CURRENT_DATE + INTERVAL '2 weeks' + INTERVAL '17 hours',
        true,
        'Centre formation Annecy',
        2,
        'en_cours'
    ),
    (
        'Formation nouvelle technique pose XXL',
        'Formation technique carrelage grand format',
        'formation',
        CURRENT_DATE + INTERVAL '3 weeks' + INTERVAL '14 hours',
        CURRENT_DATE + INTERVAL '3 weeks' + INTERVAL '18 hours',
        false,
        'Showroom fournisseur',
        1,
        'en_cours'
    );

-- Congés personnel
INSERT INTO calendar_events (
    title,
    description,
    event_type,
    start_date,
    end_date,
    all_day,
    staff_id,
    status
) VALUES 
    (
        'Congés Marie Laurent',
        'Congés annuels',
        'absence',
        CURRENT_DATE + INTERVAL '3 weeks',
        CURRENT_DATE + INTERVAL '5 weeks',
        true,
        2,
        'en_cours'
    ),
    (
        'Congés Thomas Petit',
        'Congés annuels',
        'absence',
        CURRENT_DATE + INTERVAL '2 weeks',
        CURRENT_DATE + INTERVAL '4 weeks',
        true,
        5,
        'en_cours'
    ),
    (
        'Congés Alexandre Bonnet',
        'Congés annuels',
        'absence',
        CURRENT_DATE + INTERVAL '4 weeks',
        CURRENT_DATE + INTERVAL '6 weeks',
        true,
        12,
        'en_cours'
    );

-- Ajout de données pour la table des fournisseurs
INSERT INTO suppliers (name, contact_name, email, phone, address, website, notes, payment_terms) VALUES
    ('Carrelages du Sud', 'Martin Dupuis', 'contact@carrelages-sud.fr', '04 50 12 34 56', '125 Route des Carrières, 74600 Seynod', 'www.carrelages-sud.fr', 'Fournisseur principal de carrelage', '30 jours fin de mois'),
    ('Matériaux Savoie', 'Sophie Laurent', 'contact@materiaux-savoie.fr', '04 50 23 45 67', '45 Avenue des Matériaux, 74960 Annecy', 'www.materiaux-savoie.fr', 'Fournisseur de matériaux de construction', '45 jours fin de mois'),
    ('Outillage Pro', 'Philippe Martin', 'contact@outillage-pro.com', '04 50 34 56 78', '78 Rue de l''Industrie, 74100 Ville-la-Grand', 'www.outillage-pro.com', 'Outillage professionnel', 'Paiement à 30 jours'),
    ('Chape Express', 'Julien Bonnet', 'j.bonnet@chape-express.fr', '04 50 45 67 89', '15 Rue des Artisans, 74000 Annecy', 'www.chape-express.fr', 'Fournisseur de chape et mortier', 'Comptant'),
    ('Carrelages Import', 'Alice Dubois', 'a.dubois@carrelages-import.com', '04 50 56 78 90', '230 Route de Genève, 74240 Gaillard', 'www.carrelages-import.com', 'Importateur de carrelage italien et espagnol', '60 jours fin de mois');

-- Ajout de catégories de produits
INSERT INTO product_categories (name, description) VALUES
    ('Carrelage sol', 'Carrelage pour sol intérieur et extérieur'),
    ('Carrelage mural', 'Carrelage et faïence pour murs'),
    ('Mortiers et colles', 'Produits pour la pose de carrelage'),
    ('Outils', 'Outillage spécifique carrelage'),
    ('Accessoires', 'Accessoires de finition et profilés'),
    ('Produits d''étanchéité', 'Produits d''étanchéité et préparation'),
    ('Chapes', 'Produits pour chapes traditionnelles et fluides');

-- Ajout de produits
INSERT INTO products (supplier_id, category_id, name, reference, description, unit_price, unit, min_order_quantity, lead_time_days, notes) VALUES
    (1, 1, 'Carrelage grès cérame 60x60 gris', 'CAR-GC60-G', 'Carrelage grès cérame rectifié aspect béton gris', 35.00, 'm²', 10, 5, 'Disponible en plusieurs teintes'),
    (1, 1, 'Carrelage grès cérame 80x80 blanc', 'CAR-GC80-B', 'Carrelage grès cérame rectifié aspect marbre blanc', 45.00, 'm²', 10, 5, 'Poli brillant'),
    (1, 2, 'Faïence blanche 30x60', 'FAI-B-3060', 'Faïence murale blanche rectifiée', 28.00, 'm²', 5, 3, 'Pour salle de bain et cuisine'),
    (2, 3, 'Mortier colle Keraflex', 'MC-KERA-25', 'Mortier colle amélioré C2ET', 25.00, 'sac 25kg', 10, 2, 'Pour tous types de carrelages'),
    (2, 3, 'Joint souple gris', 'JOINT-SG-5', 'Joint de carrelage hydrofuge', 22.00, 'sac 5kg', 5, 2, 'Résistant à l''humidité'),
    (2, 6, 'Primaire d''adhérence', 'PRIM-ADH-20', 'Primaire d''accrochage pour chape', 85.00, 'bidon 20L', 1, 3, 'Préparation des supports'),
    (3, 4, 'Niveau laser rotatif', 'OUT-NLR-PRO', 'Niveau laser professionnel pour chantier', 450.00, 'unité', 1, 7, 'Avec trépied et mire'),
    (3, 4, 'Scie à carrelage électrique', 'OUT-SCE-180', 'Scie électrique 1800W pour carrelage', 580.00, 'unité', 1, 5, 'Lame diamant incluse'),
    (4, 7, 'Mortier de chape', 'CHA-MT-1T', 'Mortier pour chape traditionnelle', 180.00, 'tonne', 1, 3, 'Livraison par camion'),
    (4, 7, 'Chape fluide anhydrite', 'CHA-FLU-1T', 'Chape liquide à base de sulfate de calcium', 220.00, 'tonne', 1, 3, 'Pour plancher chauffant'),
    (5, 1, 'Carrelage grès cérame 120x120 pierre', 'CAR-GC120-P', 'Carrelage grand format aspect pierre', 65.00, 'm²', 5, 10, 'Import Italie'),
    (5, 2, 'Mosaïque verre bleu', 'MOS-VB-30', 'Mosaïque sur trame 30x30cm', 18.00, 'plaque', 10, 7, 'Pour douche et piscine');

-- Ajout de catégories d'équipement
INSERT INTO equipment_categories (name, description) VALUES
    ('Machines de chantier', 'Machines et équipements lourds'),
    ('Outillage électroportatif', 'Outillage électrique professionnel'),
    ('Outillage manuel', 'Outils manuels spécifiques'),
    ('Matériel de mesure', 'Équipements de mesure et traçage'),
    ('Équipement de protection', 'EPI et sécurité'),
    ('Véhicules', 'Véhicules de chantier et transport');

-- Ajout d'équipements
INSERT INTO equipment (name, reference, category_id, supplier_id, purchase_date, purchase_price, status, location, maintenance_interval, last_maintenance_date, next_maintenance_date, notes) VALUES
    ('Malaxeur professionnel', 'MALAX-PRO-3000', 1, 3, CURRENT_DATE - INTERVAL '2 years', 1200.00, 'disponible', 'Entrepôt principal', 180, CURRENT_DATE - INTERVAL '3 months', CURRENT_DATE + INTERVAL '3 months', 'Puissance 3000W'),
    ('Ponceuse à béton', 'PONC-BET-180', 1, 3, CURRENT_DATE - INTERVAL '1 year', 2500.00, 'disponible', 'Entrepôt principal', 90, CURRENT_DATE - INTERVAL '1 month', CURRENT_DATE + INTERVAL '2 months', 'Avec aspirateur intégré'),
    ('Niveau laser', 'NIV-LAS-PRO', 4, 3, CURRENT_DATE - INTERVAL '6 months', 800.00, 'en_maintenance', 'Atelier', 120, CURRENT_DATE - INTERVAL '4 months', CURRENT_DATE - INTERVAL '10 days', 'Précision +/- 0.1mm/m'),
    ('Scie à carrelage sur rail', 'SCIE-CAR-125', 2, 3, CURRENT_DATE - INTERVAL '3 years', 1800.00, 'disponible', 'Entrepôt principal', 60, CURRENT_DATE - INTERVAL '1 month', CURRENT_DATE + INTERVAL '1 month', 'Longueur de coupe 125cm'),
    ('Camionnette Renault Master', 'VEHIC-RM-01', 6, NULL, CURRENT_DATE - INTERVAL '4 years', 28000.00, 'disponible', 'Parking entreprise', 90, CURRENT_DATE - INTERVAL '2 months', CURRENT_DATE + INTERVAL '1 month', 'Immatriculation AB-123-CD'),
    ('Malaxeur portable', 'MALAX-PORT-1200', 2, 3, CURRENT_DATE - INTERVAL '1 year', 400.00, 'disponible', 'Entrepôt principal', 180, CURRENT_DATE - INTERVAL '2 months', CURRENT_DATE + INTERVAL '4 months', 'Pour petits chantiers');

-- Ajout de réservations d'équipement
INSERT INTO equipment_reservations (equipment_id, project_id, staff_id, start_date, end_date, status, notes) VALUES
    (1, 2, 1, CURRENT_DATE - INTERVAL '1 week', CURRENT_DATE - INTERVAL '5 days', 'terminée', 'Utilisé pour mélange mortier colle'),
    (4, 2, 3, CURRENT_DATE - INTERVAL '1 week', CURRENT_DATE - INTERVAL '5 days', 'terminée', 'Coupe carrelage appartements'),
    (5, 3, 9, CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '2 days', 'en_cours', 'Transport matériaux chantier'),
    (2, 4, 5, CURRENT_DATE, CURRENT_DATE + INTERVAL '3 days', 'en_cours', 'Préparation sol cuisine'),
    (1, 5, 4, CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE + INTERVAL '15 days', 'planifiée', 'Préparation mortier programme neuf'),
    (4, 7, 3, CURRENT_DATE + INTERVAL '1 week', CURRENT_DATE + INTERVAL '1 week 4 days', 'planifiée', 'Coupe carrelage terrasse');

-- Ajout d'enregistrements de maintenance
INSERT INTO maintenance_records (equipment_id, maintenance_date, maintenance_type, description, cost, performed_by, next_maintenance_date, notes) VALUES
    (3, CURRENT_DATE - INTERVAL '10 days', 'réparation', 'Remplacement diode laser', 150.00, 1, CURRENT_DATE + INTERVAL '6 months', 'Problème de précision résolu'),
    (1, CURRENT_DATE - INTERVAL '3 months', 'révision', 'Révision complète et graissage', 80.00, 1, CURRENT_DATE + INTERVAL '3 months', 'Remplacement courroie'),
    (5, CURRENT_DATE - INTERVAL '2 months', 'entretien', 'Vidange et filtres', 320.00, NULL, CURRENT_DATE + INTERVAL '1 month', 'Effectué au garage Renault'),
    (4, CURRENT_DATE - INTERVAL '1 month', 'remplacement', 'Remplacement disque diamant', 120.00, 1, CURRENT_DATE + INTERVAL '1 month', 'Disque très usé');

-- Ajout de commandes fournisseurs
INSERT INTO supplier_orders (supplier_id, project_id, reference, order_date, expected_delivery_date, actual_delivery_date, status, total_amount, shipping_cost, notes) VALUES
    (1, 1, 'CMD-2024-001', CURRENT_DATE - INTERVAL '2 weeks', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE - INTERVAL '9 days', 'livrée', 850.00, 40.00, 'Livraison conforme'),
    (2, 2, 'CMD-2024-002', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE - INTERVAL '7 days', 'livrée', 2300.00, 0.00, 'Livraison directe sur chantier'),
    (4, 2, 'CMD-2024-003', CURRENT_DATE - INTERVAL '12 days', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE - INTERVAL '11 days', 'livrée', 3800.00, 120.00, 'Livraison avancée d''un jour'),
    (1, 4, 'CMD-2024-004', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE - INTERVAL '2 days', 'livrée', 700.00, 40.00, 'Livraison conforme'),
    (5, 5, 'CMD-2024-005', CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '3 days', NULL, 'en_cours', 12500.00, 250.00, 'Commande importante programme neuf'),
    (3, 9, 'CMD-2024-006', CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '2 days', NULL, 'en_cours', 450.00, 0.00, 'Outillage spécifique'),
    (2, NULL, 'CMD-2024-007', CURRENT_DATE, CURRENT_DATE + INTERVAL '5 days', NULL, 'en_cours', 1800.00, 60.00, 'Réapprovisionnement stock');

-- Ajout d'éléments de commande
INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, notes) VALUES
    (1, 1, 20, 35.00, 700.00, 'Carrelage salle de bain'),
    (1, 5, 3, 22.00, 66.00, 'Joint pour carrelage'),
    (2, 4, 30, 25.00, 750.00, 'Mortier colle pour appartements'),
    (2, 6, 10, 85.00, 850.00, 'Primaire d''adhérence'),
    (2, 5, 20, 22.00, 440.00, 'Joint pour carrelage'),
    (3, 10, 15, 220.00, 3300.00, 'Chape fluide pour appartements'),
    (4, 3, 25, 28.00, 700.00, 'Faïence pour cuisine'),
    (5, 11, 180, 65.00, 11700.00, 'Carrelage grand format programme neuf'),
    (5, 5, 25, 22.00, 550.00, 'Joint pour programme neuf'),
    (6, 7, 1, 450.00, 450.00, 'Niveau laser pour chantier'),
    (7, 4, 50, 25.00, 1250.00, 'Réapprovisionnement mortier colle'),
    (7, 5, 25, 22.00, 550.00, 'Réapprovisionnement joint');

-- Ajout de catégories de dépenses
INSERT INTO expense_categories (name, description) VALUES
    ('Matériaux', 'Achats de matériaux pour chantiers'),
    ('Outillage', 'Achat et location d''outils'),
    ('Carburant', 'Carburant pour véhicules'),
    ('Maintenance', 'Entretien des équipements'),
    ('Salaires', 'Salaires et charges sociales'),
    ('Fournitures', 'Fournitures de bureau et consommables'),
    ('Assurances', 'Assurances professionnelles'),
    ('Location', 'Location d''équipements ou de locaux');

-- Ajout de dépenses
INSERT INTO expenses (project_id, category_id, description, amount, expense_date, payment_method, receipt_file, notes) VALUES
    (1, 1, 'Achat carrelage et matériaux', 850.00, CURRENT_DATE - INTERVAL '2 weeks', 'virement', 'facture_001.pdf', 'Matériaux salle de bain'),
    (2, 1, 'Achat chape et mortier', 6100.00, CURRENT_DATE - INTERVAL '10 days', 'virement', 'facture_002.pdf', 'Matériaux appartements'),
    (3, 1, 'Achat carrelage espace commun', 4500.00, CURRENT_DATE - INTERVAL '9 days', 'virement', 'facture_003.pdf', 'Carrelage grand format'),
    (NULL, 3, 'Carburant véhicules février', 480.00, CURRENT_DATE - INTERVAL '15 days', 'carte', 'essence_fev2024.pdf', 'Tous véhicules'),
    (NULL, 4, 'Réparation niveau laser', 150.00, CURRENT_DATE - INTERVAL '10 days', 'carte', 'reparation_laser.pdf', 'Maintenance équipement'),
    (NULL, 6, 'Fournitures bureau', 120.00, CURRENT_DATE - INTERVAL '8 days', 'carte', 'bureau_fev2024.pdf', 'Papeterie et consommables'),
    (5, 8, 'Location nacelle', 350.00, CURRENT_DATE - INTERVAL '3 days', 'virement', 'location_nacelle.pdf', 'Location pour 2 jours');

-- Ajout de factures
INSERT INTO invoices (project_id, reference, issue_date, due_date, total_ht, tva_rate, total_ttc, status, notes) VALUES
    (1, 'FACT-2024-001', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '25 days', 2800.00, 20.00, 3360.00, 'payée', 'Facture salle de bain'),
    (2, 'FACT-2024-002', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '25 days', 15000.00, 20.00, 18000.00, 'envoyée', 'Premier acompte appartements'),
    (3, 'FACT-2024-003', CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '15 days', 14250.00, 20.00, 17100.00, 'envoyée', 'Premier acompte espaces communs'),
    (9, 'FACT-2024-004', CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '27 days', 1280.00, 20.00, 1536.00, 'envoyée', 'Acompte salle de bain moderne'),
    (10, 'FACT-2024-005', CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '28 days', 840.00, 20.00, 1008.00, 'envoyée', 'Acompte cuisine contemporaine');

-- Ajout d'éléments de facture
INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price) VALUES
    (1, 'Dépose ancien carrelage', 8, 35.00, 280.00),
    (1, 'Fourniture carrelage sol', 8, 35.00, 280.00),
    (1, 'Fourniture carrelage mural', 24, 28.00, 672.00),
    (1, 'Main d''œuvre pose sol', 8, 45.00, 360.00),
    (1, 'Main d''œuvre pose mural', 24, 48.00, 1152.00),
    (1, 'Fourniture et pose joint', 1, 56.00, 56.00),
    (2, 'Coulage chape 5 appartements', 300, 32.00, 9600.00),
    (2, 'Pose carrelage sol et plinthes', 150, 36.00, 5400.00),
    (3, 'Fourniture carrelage grand format', 300, 45.00, 13500.00),
    (3, 'Fourniture et pose profilés', 50, 15.00, 750.00),
    (4, 'Acompte rénovation salle de bain', 1, 1280.00, 1280.00),
    (5, 'Acompte pose carrelage cuisine', 1, 840.00, 840.00);

-- Ajout de paiements
INSERT INTO payments (invoice_id, amount, payment_date, payment_method, reference, notes) VALUES
    (1, 3360.00, CURRENT_DATE - INTERVAL '2 days', 'virement', 'VIR20240215', 'Paiement reçu'),
    (2, 5400.00, CURRENT_DATE - INTERVAL '3 days', 'chèque', 'CHQ12345', 'Acompte 30%'),
    (3, 8550.00, CURRENT_DATE - INTERVAL '10 days', 'virement', 'VIR20240210', 'Acompte 50%'),
    (4, 768.00, CURRENT_DATE - INTERVAL '1 day', 'virement', 'VIR20240220', 'Acompte 50%');

-- Ajout de budgets de projet
INSERT INTO project_budgets (project_id, total_budget, materials_budget, labor_budget, equipment_budget, subcontractor_budget, other_budget, notes) VALUES
    (1, 2000.00, 1000.00, 900.00, 50.00, 0.00, 50.00, 'Budget serré'),
    (2, 35000.00, 18000.00, 15000.00, 1000.00, 0.00, 1000.00, 'Budget standard'),
    (3, 25000.00, 15000.00, 9000.00, 800.00, 0.00, 200.00, 'Budget conforme au devis'),
    (5, 140000.00, 75000.00, 55000.00, 5000.00, 0.00, 5000.00, 'Budget important pour programme neuf'),
    (20, 25000.00, 15000.00, 9000.00, 500.00, 0.00, 500.00, 'Budget spécifique SPA');

-- Données pour les tables du chatbot

-- Questions/réponses fréquentes
INSERT INTO knowledge_base (question, answer, category, tags) VALUES
    ('Quelle est la durée moyenne d''un chantier de rénovation de salle de bain?', 'Pour une salle de bain standard (environ 6-8m²), notre équipe réalise généralement les travaux en 5 à 7 jours ouvrés, incluant la dépose de l''ancien carrelage, la préparation des supports, la pose du nouveau carrelage sol et murs, et les finitions.', 'délais', ARRAY['salle de bain', 'rénovation', 'durée']),
    
    ('Quelles sont les différences entre une chape traditionnelle et une chape fluide?', 'La chape traditionnelle est réalisée à base de mortier de ciment, appliquée et tirée manuellement. Elle nécessite un temps de séchage de 7-10 jours avant pose du carrelage. La chape fluide, généralement anhydrite, est coulée, autonivellante et permet une mise en œuvre plus rapide. Elle est idéale pour les planchers chauffants et offre une meilleure planéité, mais nécessite un séchage de 2-3 semaines.', 'technique', ARRAY['chape', 'comparaison']),
    
    ('Proposez-vous des garanties sur vos travaux?', 'Oui, tous nos travaux de carrelage et chape sont garantis 10 ans dans le cadre de la garantie décennale. Nous fournissons également une garantie de parfait achèvement d''un an couvrant les éventuels défauts de finition.', 'garanties', ARRAY['garantie', 'assurance']),
    
    ('Quels sont vos délais d''intervention pour un projet urgent?', 'Pour les projets urgents, nous pouvons généralement intervenir sous 1 à 2 semaines selon la charge de travail de nos équipes. Pour les dépannages urgents (fuite, problème d''étanchéité), nous proposons une intervention sous 24 à 48h.', 'délais', ARRAY['urgence', 'intervention']),
    
    ('Comment se déroule un premier rendez-vous pour un devis?', 'Lors du premier rendez-vous, notre conducteur de travaux visite le chantier pour comprendre vos besoins, prendre les mesures nécessaires et évaluer les contraintes techniques. Il vous conseille sur les solutions possibles et les matériaux adaptés. Suite à cette visite, un devis détaillé vous est envoyé sous 3 à 5 jours ouvrés.', 'devis', ARRAY['rendez-vous', 'visite', 'conseils']),
    
    ('Quels types de carrelages proposez-vous?', 'Nous proposons une large gamme de carrelages : grès cérame, faïence, mosaïque, pierre naturelle, grands formats jusqu''à 120x120cm. Nous travaillons avec des fournisseurs de qualité et pouvons vous accompagner dans le choix des matériaux en fonction de l''usage, du style recherché et de votre budget.', 'matériaux', ARRAY['carrelage', 'produits']),
    
    ('Peut-on poser du carrelage sur un ancien carrelage?', 'Oui, la pose de carrelage sur carrelage est possible sous certaines conditions : le support existant doit être sain, solidaire et plan. Cette technique permet d''économiser le temps et le coût de la dépose. Nous appliquons un primaire d''accrochage spécifique pour garantir une adhérence parfaite du nouveau revêtement.', 'technique', ARRAY['rénovation', 'support']),
    
    ('Combien coûte la pose de carrelage au m²?', 'Le prix de pose du carrelage varie entre 35€ et 80€/m² selon plusieurs facteurs : dimensions des carreaux (les grands formats sont plus coûteux à poser), complexité du motif, état du support, accessibilité du chantier. La dépose de l''ancien revêtement est facturée entre 20€ et 35€/m² supplémentaires.', 'tarifs', ARRAY['prix', 'coût', 'pose']),
    
    ('Quel est le délai de séchage après la pose d''une chape?', 'Pour une chape traditionnelle, le délai de séchage est d''environ 7 à 10 jours avant la pose du carrelage. Pour une chape fluide anhydrite, comptez 2 à 3 semaines selon l''épaisseur et les conditions d''humidité. Des solutions de séchage accéléré existent pour les projets urgents.', 'technique', ARRAY['chape', 'séchage', 'délai']),
    
    ('Travaillez-vous avec les particuliers ou uniquement les professionnels?', 'Nous travaillons aussi bien avec les particuliers que les professionnels. Nous réalisons des chantiers de toutes tailles, de la simple rénovation de salle de bain chez un particulier jusqu''aux grands projets résidentiels ou commerciaux pour les professionnels du bâtiment.', 'entreprise', ARRAY['clients', 'particuliers', 'professionnels']),
    
    ('Quelles zones géographiques couvrez-vous?', 'Nous intervenons principalement dans le département de la Haute-Savoie (74), notamment sur Annecy et son agglomération, le bassin annécien, le Genevois français et les stations des Aravis. Pour les projets importants, nous pouvons intervenir dans un rayon plus large.', 'entreprise', ARRAY['zone', 'intervention', 'localisation']),
    
    ('Proposez-vous des échantillons de carrelage?', 'Oui, nous pouvons vous fournir des échantillons des principales gammes de carrelage. Pour les choix plus spécifiques, nous vous accompagnons chez nos fournisseurs partenaires où vous pourrez voir les produits en situation et bénéficier de conseils personnalisés.', 'matériaux', ARRAY['échantillons', 'choix']);

-- Glossaire technique
INSERT INTO technical_glossary (term, definition, category) VALUES
    ('Chape', 'Couche de mortier posée sur une dalle béton pour la niveler avant la pose d''un revêtement de sol.', 'matériaux'),
    ('Grès cérame', 'Type de carrelage très résistant à l''usure, aux chocs et aux taches, obtenu par pressage et cuisson à haute température.', 'matériaux'),
    ('Faïence', 'Carrelage en céramique émaillée, généralement utilisé pour les murs dans les pièces humides.', 'matériaux'),
    ('Rectifié', 'Se dit d''un carrelage dont les bords ont été usinés avec précision pour permettre une pose avec des joints très fins.', 'technique'),
    ('Ragréage', 'Application d''un enduit destiné à égaliser une surface avant la pose d''un revêtement de sol.', 'technique'),
    ('Joints époxy', 'Type de joint très résistant à base de résine, imperméable et anti-tache, utilisé dans les pièces humides ou à fort passage.', 'matériaux'),
    ('Système SPEC', 'Système de Protection à l''Eau sous Carrelage, membrane d''étanchéité appliquée sous le carrelage dans les zones humides.', 'technique'),
    ('Planéité', 'Caractère d''une surface plane, sans creux ni bosses. Une bonne planéité est essentielle pour la pose de carrelage grand format.', 'technique'),
    ('Double encollage', 'Technique de pose consistant à appliquer de la colle à la fois sur le support et au dos du carreau pour garantir une adhérence optimale.', 'technique'),
    ('Format rectifié', 'Carrelage dont les bords ont été usinés pour obtenir des dimensions précises, permettant une pose avec des joints très fins.', 'matériaux'),
    ('Calibre', 'Dimension exacte des carreaux après fabrication. Un même modèle peut avoir plusieurs calibres selon les lots de production.', 'technique'),
    ('Biscuit', 'Corps du carreau en céramique avant application de l''émail ou du décor.', 'matériaux'),
    ('Adhérence', 'Capacité d''un matériau à se fixer durablement sur un support. L''adhérence du carrelage dépend de la qualité du support et de la colle utilisée.', 'technique'),
    ('Primaire d''accrochage', 'Produit appliqué sur un support avant pose pour améliorer l''adhérence de la colle ou du mortier.', 'matériaux'),
    ('Carrelage pleine masse', 'Carrelage dont la couleur est identique dans toute l''épaisseur, permettant des finitions invisibles sur les bords.', 'matériaux');

-- Services standards
INSERT INTO standard_services (name, description, category, avg_price_min, avg_price_max, avg_duration_days) VALUES
    ('Rénovation salle de bain complète', 'Dépose ancien carrelage, préparation supports, pose nouveau carrelage sol et murs, joints et finitions.', 'rénovation', 2500.00, 5000.00, 7),
    ('Chape traditionnelle', 'Réalisation d''une chape ciment traditionnelle pour préparation avant pose de revêtement.', 'chape', 25.00, 40.00, 3),
    ('Chape fluide', 'Coulage d''une chape fluide anhydrite, idéale pour plancher chauffant.', 'chape', 35.00, 50.00, 2),
    ('Carrelage sol', 'Fourniture et pose de carrelage au sol avec plinthes assorties.', 'carrelage', 70.00, 120.00, 3),
    ('Carrelage mural', 'Fourniture et pose de faïence murale pour cuisine, salle de bain ou crédence.', 'carrelage', 80.00, 150.00, 2),
    ('Terrasse extérieure', 'Réalisation complète d''une terrasse carrelée avec système d''étanchéité et carrelage antidérapant.', 'extérieur', 120.00, 200.00, 5),
    ('Douche à l''italienne', 'Création d''une douche à l''italienne avec système d''étanchéité, receveur maçonné et carrelage.', 'rénovation', 1800.00, 3500.00, 5),
    ('Chape isolante', 'Réalisation d''une chape isolante thermique ou acoustique avec isolant sous chape.', 'chape', 45.00, 65.00, 4),
    ('Mosaïque décorative', 'Pose de mosaïque décorative sur murs ou au sol pour créer des motifs personnalisés.', 'décoration', 120.00, 250.00, 3),
    ('Rénovation cuisine', 'Dépose ancien revêtement, pose de carrelage sol et crédence de cuisine.', 'rénovation', 2000.00, 4000.00, 5),
    ('Étanchéité sous carrelage', 'Application d''un système d''étanchéité complet avant pose de carrelage en zone humide.', 'technique', 45.00, 70.00, 2),
    ('Rénovation hall d''immeuble', 'Rénovation des sols d''un hall d''immeuble avec carrelage grand format.', 'collectif', 100.00, 150.00, 10);

-- Témoignages clients
INSERT INTO testimonials (client_id, project_id, rating, comment, is_published) VALUES
    (1, 1, 5, 'Travail soigné et dans les délais. Équipe très professionnelle. Je recommande vivement pour une rénovation de salle de bain.', true),
    (4, 4, 4, 'Bonne prestation dans l''ensemble. La cuisine est superbe avec le nouveau carrelage. Un jour de retard sur le planning mais résultat impeccable.', true),
    (3, 3, 5, 'Nous sommes très satisfaits de la qualité du carrelage posé dans les parties communes de notre résidence. Le rendu est à la hauteur de nos attentes.', true),
    (2, 2, 5, 'Excellente entreprise, très professionnelle. La chape et le carrelage de nos 5 appartements sont parfaits. Respect des délais et budget maîtrisé.', true),
    (5, 5, 4, 'Très bonne communication tout au long du projet. Équipes sérieuses et travail de qualité. Un léger retard dû aux conditions météo, sinon parfait.', true),
    (6, 6, 5, 'Rénovation complète de notre appartement avec une chape et carrelage dans toutes les pièces. Travail remarquable, nous sommes ravis.', true),
    (7, 7, 4, 'Belle réalisation de notre terrasse extérieure. Le carrelage antidérapant est parfait et l''étanchéité bien réalisée. Nous apprécions le professionnalisme de l''équipe.', true);

-- Historique de conversations fictif pour le chatbot
INSERT INTO chat_history (session_id, user_id, user_message, bot_response, intent, confidence, entities, timestamp) VALUES
    ('session_123456', NULL, 'Bonjour, j''aimerais savoir combien coûte la pose de carrelage au mètre carré', 'Bonjour ! Le prix de pose du carrelage varie entre 35€ et 80€/m² selon plusieurs facteurs : dimensions des carreaux (les grands formats sont plus coûteux à poser), complexité du motif, état du support, accessibilité du chantier. La dépose de l''ancien revêtement est facturée entre 20€ et 35€/m² supplémentaires. Souhaitez-vous un devis personnalisé pour votre projet ?', 'demande_tarif', 0.92, '{"service": "pose carrelage"}', CURRENT_TIMESTAMP - INTERVAL '5 days'),
    
    ('session_123456', NULL, 'Oui, pour une salle de bain de 8m²', 'Pour une salle de bain de 8m², nous pouvons vous proposer un devis personnalisé. Pourriez-vous nous préciser s''il s''agit d''une rénovation (avec dépose de l''ancien revêtement) ou d''une construction neuve ? Avez-vous déjà choisi le type de carrelage ou souhaitez-vous des conseils ?', 'demande_devis', 0.88, '{"surface": "8m²", "piece": "salle de bain"}', CURRENT_TIMESTAMP - INTERVAL '5 days'),
    
    ('session_123456', NULL, 'C''est une rénovation, l''ancien carrelage doit être enlevé', 'Très bien. Pour une rénovation complète de salle de bain de 8m² avec dépose de l''ancien carrelage, le budget estimatif serait entre 2500€ et 3500€ TTC, incluant la dépose, la préparation du support, la fourniture et pose du nouveau carrelage sol et murs, et les finitions. Nous pouvons organiser une visite technique pour établir un devis précis. Quand seriez-vous disponible ?', 'demande_devis', 0.95, '{"surface": "8m²", "piece": "salle de bain", "type": "rénovation"}', CURRENT_TIMESTAMP - INTERVAL '5 days'),
    
    ('session_789012', NULL, 'Quels sont vos délais d''intervention pour une chape ?', 'Pour la réalisation d''une chape, nos délais d''intervention sont généralement de 2 à 3 semaines. Cependant, ce délai peut varier selon notre planning et la complexité du projet. Pour une chape traditionnelle, comptez 1 à 2 jours de réalisation puis 7 à 10 jours de séchage avant pose du revêtement. Pour une chape fluide, la mise en œuvre est plus rapide (quelques heures) mais le temps de séchage est plus long (2 à 3 semaines). Pouvez-vous me donner plus de détails sur votre projet pour une estimation plus précise ?', 'demande_delai', 0.87, '{"service": "chape"}', CURRENT_TIMESTAMP - INTERVAL '2 days'),
    
    ('session_345678', NULL, 'Faites-vous des douches à l''italienne ?', 'Oui, nous réalisons régulièrement des douches à l''italienne. Cette prestation comprend la création du receveur maçonné avec pente d''écoulement, la mise en place d''un système d''étanchéité complet, et la pose du carrelage et/ou de la mosaïque. Nous pouvons également installer des systèmes de receveur prêt à carreler pour gagner du temps. Le prix moyen pour une douche à l''italienne complète se situe entre 1800€ et 3500€ selon les dimensions et la complexité. Souhaitez-vous des informations complémentaires ou un rendez-vous pour un devis ?', 'demande_service', 0.94, '{"service": "douche à l''italienne"}', CURRENT_TIMESTAMP - INTERVAL '1 day');

-- Intents utilisateurs pour le suivi des demandes fréquentes
INSERT INTO user_intents (intent_name, count, examples, last_detected) VALUES
    ('demande_tarif', 35, ARRAY['Combien coûte la pose de carrelage', 'Quel est votre tarif pour une chape', 'Prix au m2 pour du carrelage'], CURRENT_TIMESTAMP - INTERVAL '1 day'),
    ('demande_devis', 42, ARRAY['Je voudrais un devis', 'Pouvez-vous me faire un devis pour ma salle de bain', 'Devis pour carrelage cuisine'], CURRENT_TIMESTAMP - INTERVAL '2 days'),
    ('demande_delai', 28, ARRAY['Quels sont vos délais', 'Dans combien de temps pourriez-vous intervenir', 'Délai pour refaire une salle de bain'], CURRENT_TIMESTAMP - INTERVAL '3 days'),
    ('demande_service', 31, ARRAY['Faites-vous des terrasses', 'Est-ce que vous posez du carrelage mural', 'Rénovation de douche'], CURRENT_TIMESTAMP - INTERVAL '1 day'),
    ('demande_information', 20, ARRAY['Comment se passe un chantier', 'Quelle est la différence entre grès cérame et faïence', 'Avantages de la chape fluide'], CURRENT_TIMESTAMP - INTERVAL '4 days'),
    ('prise_rdv', 15, ARRAY['Je voudrais prendre rendez-vous', 'Quand pourriez-vous passer voir le chantier', 'Disponibilité pour une visite'], CURRENT_TIMESTAMP - INTERVAL '5 days');

-- Réactiver le trigger
ALTER TABLE activity_logs ENABLE TRIGGER activity_logs_insert_trigger;

COMMIT;
