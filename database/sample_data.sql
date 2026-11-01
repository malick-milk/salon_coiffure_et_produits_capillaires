-- =====================================================================
--  Jeu de données de DÉMONSTRATION (petit, lisible, à but pédagogique)
-- =====================================================================
--  Sert à vérifier que le schéma et les requêtes analytiques fonctionnent.
--  À l'étape 6, il sera remplacé par des Seeders et des Factories Laravel
--  capables de générer des milliers de lignes réalistes.
--  Prérequis : schema.sql déjà chargé.
-- =====================================================================

SET NAMES utf8mb4;

-- ---------- Dimension calendrier : tous les jours de 2026 (CTE récursive) ----------
-- Cours : une CTE récursive génère une suite de lignes sans boucle côté application.
SET SESSION cte_max_recursion_depth = 1000;
INSERT INTO calendar_dates (date, year, quarter, month, iso_week, day_of_month, day_of_week, is_weekend)
WITH RECURSIVE days AS (
    SELECT DATE('2026-01-01') AS d
    UNION ALL
    SELECT d + INTERVAL 1 DAY FROM days WHERE d < '2026-12-31'
)
SELECT d, YEAR(d), QUARTER(d), MONTH(d), WEEK(d, 3), DAY(d),
       WEEKDAY(d) + 1,                 -- WEEKDAY : 0 = lundi → on décale pour avoir 1 = lundi
       WEEKDAY(d) >= 5
FROM days;

-- ---------- Rôles ----------
INSERT INTO roles (name, guard_name, created_at) VALUES
 ('super_admin','web',NOW()), ('manager','web',NOW()), ('cashier','web',NOW()),
 ('stylist','web',NOW()), ('stock_keeper','web',NOW()), ('customer','web',NOW());

INSERT INTO permissions (name, guard_name, created_at) VALUES
 ('products.view','web',NOW()), ('products.update','web',NOW()),
 ('orders.view','web',NOW()), ('orders.update','web',NOW()),
 ('bookings.view','web',NOW()), ('bookings.update','web',NOW()),
 ('stock.adjust','web',NOW()), ('analytics.view','web',NOW());

-- Le manager a tout sauf les analytics financières ; le coiffeur voit seulement les réservations.
INSERT INTO role_has_permissions (permission_id, role_id)
SELECT p.id, r.id FROM permissions p JOIN roles r ON r.name = 'super_admin';
INSERT INTO role_has_permissions (permission_id, role_id)
SELECT p.id, r.id FROM permissions p JOIN roles r ON r.name = 'manager' WHERE p.name <> 'analytics.view';
INSERT INTO role_has_permissions (permission_id, role_id)
SELECT p.id, r.id FROM permissions p JOIN roles r ON r.name = 'stylist' WHERE p.name = 'bookings.view';

-- ---------- Utilisateurs (mot de passe = hash bcrypt fictif) ----------
INSERT INTO users (id, first_name, last_name, email, phone, password, created_at) VALUES
 (1,'Awa','Ndiaye','admin@salon.test','+221770000001','$2y$12$exempleDeHashBcryptNonUtilisable000000000000000000000',NOW()),
 (2,'Fatou','Diop','fatou@salon.test','+221770000002','$2y$12$exempleDeHashBcryptNonUtilisable000000000000000000000',NOW()),
 (3,'Mariama','Sow','mariama@client.test','+221770000003','$2y$12$exempleDeHashBcryptNonUtilisable000000000000000000000',NOW());

INSERT INTO model_has_roles (role_id, model_type, model_id)
SELECT id, 'App\\Models\\User', 1 FROM roles WHERE name = 'super_admin' UNION ALL
SELECT id, 'App\\Models\\User', 2 FROM roles WHERE name = 'stylist'     UNION ALL
SELECT id, 'App\\Models\\User', 3 FROM roles WHERE name = 'customer';

-- ---------- Clients : 1 inscrit (user 3) + 5 invités ----------
INSERT INTO customers (id, user_id, first_name, last_name, phone, email, created_at) VALUES
 (1, 3,   'Mariama','Sow',   '+221770000003','mariama@client.test','2026-01-05 10:00:00'),
 (2, NULL,'Khady',  'Fall',  '+221770000010',NULL,                 '2026-01-12 11:00:00'),
 (3, NULL,'Aminata','Ba',    '+221770000011','aminata@mail.test',  '2026-02-03 09:30:00'),
 (4, NULL,'Ndeye',  'Gueye', '+221770000012',NULL,                 '2026-02-20 15:00:00'),
 (5, NULL,'Coumba', 'Mbaye', '+221770000013',NULL,                 '2026-03-08 16:45:00'),
 (6, NULL,'Rokhaya','Sarr',  '+221770000014',NULL,                 '2026-03-15 12:10:00');

INSERT INTO delivery_zones (id, name, fee, created_at) VALUES
 (1,'Dakar Plateau',1000,NOW()), (2,'Parcelles Assainies',1500,NOW()), (3,'Rufisque',2500,NOW());

-- ---------- Catalogue ----------
INSERT INTO categories (id, parent_id, name, slug, position, created_at) VALUES
 (1, NULL,'Soins capillaires','soins-capillaires',1,NOW()),
 (2, 1,   'Huiles',           'huiles',           1,NOW()),
 (3, 1,   'Shampoings',       'shampoings',       2,NOW()),
 (4, NULL,'Accessoires',      'accessoires',      2,NOW());

INSERT INTO brands (id, name, slug, created_at) VALUES (1,'Maison Karité','maison-karite',NOW()), (2,'Baobab Care','baobab-care',NOW());
INSERT INTO hair_types (id, name, slug) VALUES (1,'Crépus','crepus'), (2,'Bouclés','boucles'), (3,'Lisses','lisses');

-- stock_quantity = résultat des mouvements de stock insérés plus bas (cache cohérent)
INSERT INTO products (id, category_id, brand_id, sku, name, slug, unit_size, price, cost_price, stock_quantity, low_stock_threshold, is_featured, created_at) VALUES
 (1, 2, 1, 'HUI-RIC-250','Huile de ricin bio',        'huile-de-ricin-bio',        '250 ml', 6500, 3500, 31, 5, TRUE,  '2026-01-01 08:00:00'),
 (2, 2, 2, 'HUI-BAO-100','Huile de baobab pure',      'huile-de-baobab-pure',      '100 ml', 8000, 4200,  4, 5, TRUE,  '2026-01-01 08:00:00'),
 (3, 3, 1, 'SHA-KAR-500','Shampoing karité hydratant','shampoing-karite-hydratant','500 ml', 5500, 2500, 38, 8, FALSE, '2026-01-01 08:00:00'),
 (4, 3, 2, 'SHA-CLA-250','Shampoing clarifiant',      'shampoing-clarifiant',      '250 ml', 4500, 2800, 20, 5, FALSE, '2026-01-01 08:00:00'),
 (5, 4, NULL,'ACC-PEI-001','Peigne démêlant en bois', 'peigne-demelant-bois',      NULL,     3000,  900, 12, 3, FALSE, '2026-01-01 08:00:00');

INSERT INTO product_hair_type VALUES (1,1),(1,2),(2,1),(3,1),(3,2),(3,3),(4,3);

-- ---------- Commandes (payées, livrées, une annulée) ----------
INSERT INTO orders (id, reference, customer_id, channel, status, payment_status, fulfillment_method, delivery_zone_id,
                    shipping_name, shipping_phone, shipping_city, shipping_address,
                    subtotal, discount_total, shipping_fee, total, placed_at, paid_at, delivered_at, cancelled_at) VALUES
 (1,'CMD-2026-000001',1,'online','delivered','paid','delivery',1,'Mariama Sow','+221770000003','Dakar','Rue 10, Plateau',
     19500,0,1000,20500,'2026-01-06 10:15:00','2026-01-07 14:00:00','2026-01-07 14:00:00',NULL),
 (2,'CMD-2026-000002',2,'store', 'delivered','paid','pickup',NULL,NULL,NULL,NULL,NULL,
      8000,0,0, 8000,'2026-01-12 11:05:00','2026-01-12 11:05:00','2026-01-12 11:05:00',NULL),
 (3,'CMD-2026-000003',1,'online','delivered','paid','pickup',NULL,NULL,NULL,NULL,NULL,
     16000,0,0,16000,'2026-02-10 09:00:00','2026-02-11 10:00:00','2026-02-11 10:00:00',NULL),
 (4,'CMD-2026-000004',3,'online','delivered','paid','delivery',2,'Aminata Ba','+221770000011','Dakar','Unité 15, Parcelles',
     14000,0,1500,15500,'2026-02-03 09:45:00','2026-02-04 16:00:00','2026-02-04 16:00:00',NULL),
 (5,'CMD-2026-000005',4,'online','cancelled','unpaid','pickup',NULL,NULL,NULL,NULL,NULL,
      6500,0,0, 6500,'2026-02-21 18:00:00',NULL,NULL,'2026-02-22 09:00:00'),
 (6,'CMD-2026-000006',2,'store', 'delivered','paid','pickup',NULL,NULL,NULL,NULL,NULL,
     12000,0,0,12000,'2026-03-02 17:20:00','2026-03-02 17:20:00','2026-03-02 17:20:00',NULL),
 (7,'CMD-2026-000007',5,'online','delivered','paid','delivery',3,'Coumba Mbaye','+221770000013','Rufisque','Cité Diokoul',
     11000,0,2500,13500,'2026-03-08 17:00:00','2026-03-10 12:00:00','2026-03-10 12:00:00',NULL),
 (8,'CMD-2026-000008',1,'online','confirmed','unpaid','pickup',NULL,NULL,NULL,NULL,NULL,
     13000,0,0,13000,'2026-03-20 08:30:00',NULL,NULL,NULL);

INSERT INTO order_items (order_id, product_id, product_name, sku, unit_price, unit_cost, quantity, line_total) VALUES
 (1,1,'Huile de ricin bio','HUI-RIC-250',6500,3500,2,13000), (1,1,'Huile de ricin bio','HUI-RIC-250',6500,3500,1,6500),
 (2,2,'Huile de baobab pure','HUI-BAO-100',8000,4200,1,8000),
 (3,2,'Huile de baobab pure','HUI-BAO-100',8000,4200,2,16000),
 (4,3,'Shampoing karité hydratant','SHA-KAR-500',5500,2500,2,11000), (4,5,'Peigne démêlant en bois','ACC-PEI-001',3000,900,1,3000),
 (5,1,'Huile de ricin bio','HUI-RIC-250',6500,3500,1,6500),
 (6,2,'Huile de baobab pure','HUI-BAO-100',8000,4200,1,8000), (6,5,'Peigne démêlant en bois','ACC-PEI-001',3000,900,1,3000),
 (6,5,'Peigne démêlant en bois','ACC-PEI-001',1000,900,1,1000),   -- vente promotionnelle à 1 000 XOF
 (7,3,'Shampoing karité hydratant','SHA-KAR-500',5500,2500,2,11000),
 (8,1,'Huile de ricin bio','HUI-RIC-250',6500,3500,2,13000);

-- ---------- Grand livre du stock ----------
-- Entrées initiales, puis une sortie par ligne vendue, une restitution pour la commande annulée.
INSERT INTO stock_movements (product_id, type, quantity, stock_after, unit_cost, reference_type, reference_id, reason, user_id, created_at) VALUES
 (1,'initial', 40, 40,3500,NULL,NULL,'Stock initial',1,'2025-12-31 18:00:00'),
 (2,'initial', 10, 10,4200,NULL,NULL,'Stock initial',1,'2025-12-31 18:00:00'),
 (3,'initial', 42, 42,2500,NULL,NULL,'Stock initial',1,'2025-12-31 18:00:00'),
 (4,'initial', 20, 20,2800,NULL,NULL,'Stock initial',1,'2025-12-31 18:00:00'),
 (5,'initial', 15, 15, 900,NULL,NULL,'Stock initial',1,'2025-12-31 18:00:00'),
 (1,'sale',    -3, 37,NULL,'App\\Models\\Order',1,NULL,NULL,'2026-01-06 10:15:00'),
 (2,'sale',    -1,  9,NULL,'App\\Models\\Order',2,NULL,2,   '2026-01-12 11:05:00'),
 (3,'sale',    -2, 40,NULL,'App\\Models\\Order',4,NULL,NULL,'2026-02-03 09:45:00'),
 (5,'sale',    -1, 14,NULL,'App\\Models\\Order',4,NULL,NULL,'2026-02-03 09:45:00'),
 (2,'sale',    -2,  7,NULL,'App\\Models\\Order',3,NULL,NULL,'2026-02-10 09:00:00'),
 (1,'sale',    -1, 36,NULL,'App\\Models\\Order',5,NULL,NULL,'2026-02-21 18:00:00'),
 (1,'sale_cancellation',1,37,NULL,'App\\Models\\Order',5,'Annulation client',NULL,'2026-02-22 09:00:00'),
 (2,'sale',    -1,  6,NULL,'App\\Models\\Order',6,NULL,2,   '2026-03-02 17:20:00'),
 (5,'sale',    -2, 12,NULL,'App\\Models\\Order',6,NULL,2,   '2026-03-02 17:20:00'),
 (3,'sale',    -2, 38,NULL,'App\\Models\\Order',7,NULL,NULL,'2026-03-08 17:00:00'),
 (1,'loss',    -4, 33,NULL,NULL,NULL,'Flacons cassés à la réception',1,'2026-03-12 10:00:00'),
 (2,'loss',    -2,  4,NULL,NULL,NULL,'Produits périmés',1,'2026-03-15 10:00:00'),
 (1,'sale',    -2, 31,NULL,'App\\Models\\Order',8,NULL,NULL,'2026-03-20 08:30:00');

-- ---------- Salon ----------
INSERT INTO service_categories (id, name, slug, position) VALUES (1,'Tresses','tresses',1), (2,'Soins','soins',2);
INSERT INTO services (id, service_category_id, name, slug, duration_minutes, buffer_minutes, price, created_at) VALUES
 (1,1,'Tresses africaines',      'tresses-africaines', 180,15,25000,NOW()),
 (2,1,'Nattes collées',          'nattes-collees',      90,15,12000,NOW()),
 (3,2,'Soin profond au karité',  'soin-profond-karite', 60,10, 8000,NOW());

INSERT INTO stylists (id, user_id, display_name, created_at) VALUES (1,2,'Fatou',NOW()), (2,NULL,'Bineta',NOW());
INSERT INTO service_stylist VALUES (1,1),(2,1),(3,1),(1,2),(3,2);

INSERT INTO business_hours (day_of_week, is_closed, opens_at, closes_at, break_start, break_end) VALUES
 (1,FALSE,'09:00','19:00','13:00','14:00'), (2,FALSE,'09:00','19:00','13:00','14:00'),
 (3,FALSE,'09:00','19:00','13:00','14:00'), (4,FALSE,'09:00','19:00','13:00','14:00'),
 (5,FALSE,'09:00','19:00','13:00','15:00'), (6,FALSE,'09:00','20:00',NULL,NULL),
 (7,TRUE, NULL,NULL,NULL,NULL);

INSERT INTO closures (starts_on, ends_on, reason) VALUES ('2026-04-04','2026-04-04','Fête de l''Indépendance');

INSERT INTO bookings (reference, customer_id, service_id, stylist_id, source, status, starts_at, ends_at,
                      service_name, duration_minutes, price, completed_at, cancelled_at, cancelled_by) VALUES
 ('RDV-2026-000001',1,1,1,'online','completed','2026-01-10 09:00:00','2026-01-10 12:15:00','Tresses africaines',180,25000,'2026-01-10 12:00:00',NULL,NULL),
 ('RDV-2026-000002',2,3,2,'phone', 'completed','2026-01-17 15:00:00','2026-01-17 16:10:00','Soin profond au karité',60,8000,'2026-01-17 16:00:00',NULL,NULL),
 ('RDV-2026-000003',3,2,1,'online','completed','2026-02-07 10:00:00','2026-02-07 11:45:00','Nattes collées',90,12000,'2026-02-07 11:30:00',NULL,NULL),
 ('RDV-2026-000004',4,1,2,'online','no_show',  '2026-02-14 10:00:00','2026-02-14 13:15:00','Tresses africaines',180,25000,NULL,NULL,NULL),
 ('RDV-2026-000005',1,3,1,'online','completed','2026-02-21 16:00:00','2026-02-21 17:10:00','Soin profond au karité',60,8000,'2026-02-21 17:00:00',NULL,NULL),
 ('RDV-2026-000006',6,1,1,'online','completed','2026-03-14 10:00:00','2026-03-14 13:15:00','Tresses africaines',180,25000,'2026-03-14 13:00:00',NULL,NULL),
 ('RDV-2026-000007',5,3,2,'walk_in','completed','2026-03-14 10:00:00','2026-03-14 11:10:00','Soin profond au karité',60,8000,'2026-03-14 11:00:00',NULL,NULL),
 ('RDV-2026-000008',2,2,1,'online','cancelled','2026-03-21 10:00:00','2026-03-21 11:45:00','Nattes collées',90,12000,NULL,'2026-03-19 09:00:00','customer'),
 ('RDV-2026-000009',2,2,1,'online','confirmed','2026-03-21 10:00:00','2026-03-21 11:45:00','Nattes collées',90,12000,NULL,NULL,NULL),
 ('RDV-2026-000010',3,1,2,'online','pending',  '2026-03-28 14:00:00','2026-03-28 17:15:00','Tresses africaines',180,25000,NULL,NULL,NULL);

INSERT INTO settings (`group`, `key`, value) VALUES
 ('booking','booking.min_notice_minutes','120'),
 ('booking','booking.max_horizon_days','60'),
 ('booking','booking.customer_cancel_hours','24'),
 ('tax','tax.enabled','false'),
 ('tax','tax.rate','18.0'),
 ('shop','shop.guest_checkout','true'),
 ('company','company.identity','{"name": "Nom de l''entreprise", "ninea": "À renseigner", "rccm": "À renseigner", "address": "Dakar, Sénégal"}');

-- =====================================================================
--  CATALOGUE RÉEL DABO HAIR — marque fabriquée par l'entreprise
-- =====================================================================
--  RÉEL : noms, contenances, PRIX DE VENTE.
--  RÉEL : lots de fabrication (quantités) et coûts « Achat » de 6 produits
--         (capture « Calcul des bénéfices par produit », total 156 000 F CFA).
--  RÉEL : la commande de 1 374 000 F CFA, enregistrée comme vente en gros (n° 9).
--  INCONNU : coût du spray anti-chute ; lots de l'hydratant 100 ml et du sérum 15 ml.
--  DÉMO : numéros de lot, dates de fabrication et de péremption.
-- =====================================================================

INSERT INTO categories (id, parent_id, name, slug, position, created_at) VALUES
 (5, 1, 'Hydratants et crèmes', 'hydratants-et-cremes', 3, NOW()),
 (6, 1, 'Sérums',               'serums',               4, NOW()),
 (7, 1, 'Soins traitants',      'soins-traitants',      5, NOW());

INSERT INTO brands (id, name, slug, is_house_brand, created_at) VALUES (3, 'Dabo Hair', 'dabo-hair', TRUE, NOW());

-- stock_quantity et cost_price sont calculés plus bas, à partir des lots et des ventes
INSERT INTO products (id, category_id, brand_id, variant_of_id, sku, name, slug, unit_size, price, cost_price, stock_quantity, low_stock_threshold, is_active, is_featured, created_at) VALUES
 ( 6, 3, 3, NULL, 'DAB-SHA-001', 'Shampooing sans sulfate', 'shampooing-sans-sulfate',  NULL,     3000, NULL, 0, 12, TRUE, TRUE,  '2026-03-20 10:00:00'),
 ( 7, 5, 3, NULL, 'DAB-SPH-250', 'Spray hydratant',         'spray-hydratant-250-ml',   '250 ml', 5000, NULL, 0, 12, TRUE, TRUE,  '2026-03-20 10:00:00'),
 ( 8, 5, 3, NULL, 'DAB-HYD-100', 'Hydratant',               'hydratant-100-ml',         '100 ml', 2500, NULL, 0, 12, TRUE, FALSE, '2026-03-20 10:00:00'),
 ( 9, 5, 3, NULL, 'DAB-CRE-001', 'Crème capillaire',        'creme-capillaire',         NULL,     3000, NULL, 0, 12, TRUE, TRUE,  '2026-03-20 10:00:00'),
 (10, 6, 3, NULL, 'DAB-SAP-030', 'Sérum Activ''Pousse',     'serum-activ-pousse-30-ml', '30 ml',  3000, NULL, 0, 12, TRUE, TRUE,  '2026-03-20 10:00:00'),
 (11, 6, 3, 10,   'DAB-SAP-015', 'Sérum Activ''Pousse',     'serum-activ-pousse-15-ml', '15 ml',  1500, NULL, 0,  6, TRUE, FALSE, '2026-03-20 10:00:00'),
 (12, 7, 3, NULL, 'DAB-SAC-001', 'Spray anti-chute',        'spray-anti-chute',         NULL,     5000, NULL, 0,  6, TRUE, FALSE, '2026-03-20 10:00:00'),
 (13, 7, 3, NULL, 'DAB-MAS-001', 'Masque capillaire',       'masque-capillaire',        NULL,     3000, NULL, 0,  6, TRUE, FALSE, '2026-03-20 10:00:00'),
 (14, 6, 3, NULL, 'DAB-SBO-030', 'Sérum Booster',           'serum-booster-30-ml',      '30 ml',  3000, NULL, 0,  6, TRUE, FALSE, '2026-03-20 10:00:00');

-- Lots de fabrication. total_cost = somme des postes de coût (vérifié par verify.sh) ;
-- unit_cost est CALCULÉ par MySQL (colonne générée).
INSERT INTO production_batches (id, batch_number, product_id, quantity_produced, total_cost, produced_on, expires_on, notes, created_by, created_at) VALUES
 (1, 'LOT-2603-SPH',   7, 96, 33600, '2026-03-20', '2027-09-20', '8 douzaines', 1, '2026-03-20 10:00:00'),
 (2, 'LOT-2603-CRE',   9, 96, 14400, '2026-03-20', '2027-09-20', '8 douzaines', 1, '2026-03-20 10:00:00'),
 (3, 'LOT-2603-SHA',   6, 96, 38400, '2026-03-20', '2028-03-20', '8 douzaines', 1, '2026-03-20 10:00:00'),
 (4, 'LOT-2603-SAP30',10, 96, 25600, '2026-03-20', '2027-03-20', '8 douzaines', 1, '2026-03-20 10:00:00'),
 (5, 'LOT-2603-SBO',  14, 96, 25600, '2026-03-20', '2027-03-20', '8 douzaines', 1, '2026-03-20 10:00:00'),
 (6, 'LOT-2603-MAS',  13, 48, 18400, '2026-03-20', '2026-09-30', '4 douzaines (péremption proche : démo)', 1, '2026-03-20 10:00:00'),
 (7, 'LOT-2603-SAC',  12, 96, NULL,  '2026-03-20', '2027-09-20', '8 douzaines, coût à compléter', 1, '2026-03-20 10:00:00'),
 (8, 'LOT-2603-HYD',   8, 84, NULL,  '2026-03-20', '2027-09-20', 'DÉMO : quantité et coût inconnus', 1, '2026-03-20 10:00:00'),
 (9, 'LOT-2603-SAP15',11, 48, NULL,  '2026-03-20', '2027-03-20', 'DÉMO : quantité et coût inconnus', 1, '2026-03-20 10:00:00');

-- Postes de coût. Catégorie 'other' : la capture dit « Achat » sans préciser s'il s'agit
-- d'ingrédients ou d'emballages ([À PRÉCISER PAR L'ENTREPRISE]).
INSERT INTO production_batch_costs (production_batch_id, category, label, amount, spent_on, created_by, created_at) VALUES
 (1, 'other', 'Achat (calcul des bénéfices)', 33600, '2026-03-20', 1, NOW()),
 (2, 'other', 'Achat (calcul des bénéfices)', 14400, '2026-03-20', 1, NOW()),
 (3, 'other', 'Achat (calcul des bénéfices)', 38400, '2026-03-20', 1, NOW()),
 (4, 'other', 'Achat (calcul des bénéfices)', 25600, '2026-03-20', 1, NOW()),
 (5, 'other', 'Achat (calcul des bénéfices)', 25600, '2026-03-20', 1, NOW()),
 (6, 'other', 'Achat (calcul des bénéfices)', 18400, '2026-03-20', 1, NOW());

INSERT INTO stock_movements (product_id, type, quantity, stock_after, unit_cost, reference_type, reference_id, reason, user_id, created_at)
SELECT product_id, 'production', quantity_produced, quantity_produced, ROUND(unit_cost),
       'App\\Models\\ProductionBatch', id, CONCAT('Fabrication ', batch_number), 1, '2026-03-20 10:00:00'
FROM production_batches;

-- Le coût de revient unitaire du produit = celui de son dernier lot
UPDATE products p JOIN production_batches pb ON pb.product_id = p.id
SET p.cost_price = pb.unit_cost
WHERE pb.unit_cost IS NOT NULL;

-- ---------- La commande RÉELLE de la capture : vente en gros à un revendeur ----------
INSERT INTO customers (id, user_id, customer_type, first_name, last_name, phone, notes, created_at) VALUES
 (7, NULL, 'reseller', '[REVENDEUR]', '[NOM]', '+221770000099', 'Client revendeur : commandes à la douzaine.', '2026-03-24 09:00:00');

INSERT INTO orders (id, reference, customer_id, created_by, channel, status, payment_status, fulfillment_method,
                    subtotal, discount_total, shipping_fee, total, customer_notes, placed_at, confirmed_at) VALUES
 (9, 'CMD-2026-000009', 7, 1, 'store', 'confirmed', 'unpaid', 'pickup',
     1374000, 0, 0, 1374000, 'Commande en gros (douzaines)', '2026-03-24 09:30:00', '2026-03-24 10:00:00');

-- unit_cost FIGÉ au moment de la vente (copié depuis le produit) ; NULL si le coût est encore inconnu
INSERT INTO order_items (order_id, product_id, product_name, sku, unit_price, unit_cost, quantity, line_total)
SELECT 9, p.id, CONCAT(p.name, IFNULL(CONCAT(' ', p.unit_size), '')), p.sku, p.price, p.cost_price, q.qty, p.price * q.qty
FROM products p
JOIN (SELECT 6 AS id, 48 AS qty UNION ALL SELECT 7, 48 UNION ALL SELECT 8, 60 UNION ALL SELECT 9, 96 UNION ALL SELECT 10, 72
      UNION ALL SELECT 11, 24 UNION ALL SELECT 12, 24 UNION ALL SELECT 13, 24 UNION ALL SELECT 14, 36) q ON q.id = p.id;

INSERT INTO stock_movements (product_id, type, quantity, stock_after, reference_type, reference_id, user_id, created_at)
SELECT oi.product_id, 'sale', -oi.quantity, pb.quantity_produced - oi.quantity, 'App\\Models\\Order', 9, 1, '2026-03-24 09:30:00'
FROM order_items oi JOIN production_batches pb ON pb.product_id = oi.product_id
WHERE oi.order_id = 9;

-- Stock = somme du grand livre (la crème capillaire tombe à 0 : 96 fabriqués, 96 vendus)
UPDATE products p SET stock_quantity = (SELECT SUM(m.quantity) FROM stock_movements m WHERE m.product_id = p.id) WHERE p.brand_id = 3;

-- ---------- Achat fournisseur (DÉMO) : réassort d'un produit REVENDU d'une autre marque ----------
INSERT INTO suppliers (id, name, notes, created_at) VALUES
 (1, '[FOURNISSEUR DE DÉMONSTRATION]', 'Utile seulement si la boutique revend des marques tierces.', NOW());

INSERT INTO purchase_orders (id, reference, supplier_id, status, total_cost, ordered_at, expected_at, received_at, created_by, created_at) VALUES
 (1, 'BC-2026-0001', 1, 'received', 114000, '2026-03-22 09:00:00', '2026-03-25', '2026-03-25 11:00:00', 1, '2026-03-22 09:00:00');

-- quantity_ordered et line_total sont calculés par MySQL (colonnes générées)
INSERT INTO purchase_order_items (purchase_order_id, product_id, packs_ordered, units_per_pack, unit_cost, quantity_received) VALUES
 (1, 1, 2, 12, 3500, 24),   -- Huile de ricin bio         2 douzaines x 3 500 = 84 000
 (1, 3, 1, 12, 2500, 12);   -- Shampoing karité hydratant 1 douzaine  x 2 500 = 30 000

INSERT INTO stock_movements (product_id, type, quantity, stock_after, unit_cost, reference_type, reference_id, reason, user_id, created_at) VALUES
 (1, 'purchase', 24, 55, 3500, 'App\\Models\\PurchaseOrder', 1, 'Réception BC-2026-0001', 1, '2026-03-25 11:00:00'),
 (3, 'purchase', 12, 50, 2500, 'App\\Models\\PurchaseOrder', 1, 'Réception BC-2026-0001', 1, '2026-03-25 11:00:00');
UPDATE products SET stock_quantity = stock_quantity + 24 WHERE id = 1;
UPDATE products SET stock_quantity = stock_quantity + 12 WHERE id = 3;

-- ---------- Avis, favoris, paniers (entités issues du MCD existant) ----------
INSERT INTO product_reviews (product_id, customer_id, order_id, rating, comment, status, moderated_by, moderated_at, created_at) VALUES
 (2, 1, 3, 5, 'Très bonne huile, cheveux plus doux.', 'approved', 1, '2026-02-15 10:00:00', '2026-02-14 18:00:00'),
 (2, 2, 2, 4, 'Bon produit, flacon un peu petit.',     'approved', 1, '2026-01-20 10:00:00', '2026-01-19 12:00:00'),
 (3, 3, 4, 5, 'Mousse bien et n''assèche pas.',        'pending',  NULL, NULL,              '2026-02-08 09:00:00');

INSERT INTO favorites (user_id, product_id, created_at) VALUES (3, 1, '2026-01-05 10:05:00'), (3, 2, '2026-02-09 20:00:00');

INSERT INTO carts (id, user_id, token, status, converted_order_id, last_activity_at, created_at) VALUES
 (1, 3,    '7d1c2a4e-0000-4000-8000-000000000001', 'converted', 8,    '2026-03-20 08:30:00', '2026-03-19 21:00:00'),
 (2, NULL, '7d1c2a4e-0000-4000-8000-000000000002', 'abandoned', NULL, '2026-03-10 22:15:00', '2026-03-10 22:00:00'),
 (3, 3,    '7d1c2a4e-0000-4000-8000-000000000003', 'active',    NULL, '2026-03-21 09:00:00', '2026-03-21 09:00:00');

INSERT INTO cart_items (cart_id, product_id, quantity, created_at) VALUES
 (1, 1, 2, '2026-03-19 21:00:00'),
 (2, 2, 1, '2026-03-10 22:00:00'), (2, 5, 1, '2026-03-10 22:05:00'),
 (3, 4, 2, '2026-03-21 09:00:00');
