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
