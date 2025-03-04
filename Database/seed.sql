BEGIN;

-- -- Insertion d'utilisateurs admin
-- INSERT INTO users (firstname, lastname, age, email, password, role_id) VALUES 
--     ('Jordan', 'Serafini', 35, 'jordan@solution-logique.fr', 'pass123', 1),
--     ('Admin', 'System', 30, 'admin@technidalle.fr', 'admin123', 1),
--     ('User', 'Standard', 25, 'user@technidalle.fr', 'user123', 2);

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
INSERT INTO project_materials (project_id, material_id, quantity_used) VALUES 
    -- Projet 1: Rénovation salle de bain
    (1, 1, 8),  -- Carrelage sol sdb
    (1, 3, 24), -- Carrelage mural sdb
    (1, 5, 4),  -- Mortier colle
    (1, 8, 2),  -- Croisillons
    (1, 9, 3),  -- Joint
    
    -- Projet 2: Chape et carrelage appartements
    (2, 4, 300),  -- Chape fluide
    (2, 6, 4),    -- Primaire
    (2, 7, 10),   -- Bande périphérique
    (2, 1, 250),  -- Carrelage 60x60
    (2, 5, 50),   -- Mortier colle
    
    -- Projet 3: Carrelage espaces communs
    (3, 2, 300),  -- Carrelage 80x80
    (3, 5, 60),   -- Mortier colle
    (3, 9, 30),   -- Joint
    (3, 10, 40),  -- Profilés

    -- Projet 4: Rénovation cuisine
    (4, 1, 20),   -- Carrelage 60x60
    (4, 5, 6),    -- Mortier colle
    (4, 9, 4),    -- Joint
    
    -- Projet 5: Programme neuf Les Clarines
    (5, 4, 900),   -- Chape fluide
    (5, 6, 15),    -- Primaire
    (5, 7, 30),    -- Bande périphérique
    (5, 16, 800),  -- Carrelage 120x120
    (5, 5, 160),   -- Mortier colle
    (5, 17, 15),   -- Sous-couche acoustique
    (5, 18, 20);   -- Profilé de dilatation

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
INSERT INTO project_materials (project_id, material_id, quantity_used) VALUES 
    -- Salle de bain moderne
    (9, 1, 6),    -- Carrelage sol
    (9, 3, 18),   -- Carrelage mural
    (9, 5, 3),    -- Mortier colle
    (9, 8, 2),    -- Croisillons
    (9, 9, 2),    -- Joint
    
    -- Cuisine contemporaine
    (10, 1, 15),   -- Carrelage sol
    (10, 3, 6),    -- Carrelage mural crédence
    (10, 5, 5),    -- Mortier colle
    (10, 9, 3),    -- Joint
    
    -- Studio location
    (12, 4, 25),   -- Chape fluide
    (12, 1, 25),   -- Carrelage
    (12, 5, 8),    -- Mortier colle
    (12, 7, 2),    -- Bande périphérique
    
    -- Local commercial
    (13, 2, 80),   -- Carrelage 80x80
    (13, 5, 20),   -- Mortier colle
    (13, 9, 8),    -- Joint
    (13, 18, 4),   -- Profilé de dilatation
    
    -- Douche italienne
    (14, 11, 1),   -- Natte d'étanchéité
    (14, 14, 4),   -- Carrelage antidérapant
    (14, 3, 12),   -- Carrelage mural
    (14, 15, 1),   -- Colle époxy
    
    -- Hall immeuble
    (15, 2, 40),   -- Carrelage 80x80
    (15, 5, 10),   -- Mortier colle
    (15, 9, 4),    -- Joint
    (15, 10, 15),  -- Profilés
    
    -- Terrasse couverte
    (16, 14, 35),  -- Carrelage antidérapant
    (16, 11, 2),   -- Natte d'étanchéité
    (16, 5, 9),    -- Mortier colle
    (16, 9, 4),    -- Joint
    
    -- WC suspendus
    (17, 1, 4),    -- Carrelage sol
    (17, 3, 12),   -- Carrelage mural
    (17, 5, 3),    -- Mortier colle
    (17, 9, 2),    -- Joint
    
    -- Appartement T2
    (18, 4, 45),   -- Chape fluide
    (18, 16, 45),  -- Carrelage 120x120
    (18, 5, 15),   -- Mortier colle
    (18, 17, 3),   -- Sous-couche acoustique
    
    -- Buanderie
    (19, 14, 8),   -- Carrelage antidérapant
    (19, 11, 1),   -- Natte d'étanchéité
    (19, 15, 1),   -- Colle époxy
    (19, 9, 1),    -- Joint
    
    -- SPA Hotel
    (20, 11, 4),   -- Natte d'étanchéité
    (20, 14, 120), -- Carrelage antidérapant
    (20, 15, 5),   -- Colle époxy
    (20, 9, 12),   -- Joint
    
    -- Restaurant
    (21, 14, 60),  -- Carrelage antidérapant
    (21, 15, 3),   -- Colle époxy
    (21, 9, 6),    -- Joint
    (21, 10, 25),  -- Profilés
    
    -- Cave à vin
    (22, 1, 25),   -- Carrelage sol
    (22, 3, 45),   -- Carrelage mural
    (22, 5, 12),   -- Mortier colle
    (22, 9, 5),    -- Joint
    
    -- Balcons résidence
    (23, 11, 5),   -- Natte d'étanchéité
    (23, 14, 75),  -- Carrelage antidérapant
    (23, 15, 4),   -- Colle époxy
    (23, 18, 8);   -- Profilé de dilatation

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

COMMIT;
