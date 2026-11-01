-- =====================================================================
--  Tests d'intégrité : CHAQUE instruction ci-dessous DOIT ÉCHOUER.
--  Si l'une réussit, une règle de gestion n'est plus protégée par la base.
--  Exécution : voir DATABASE.md §9 (chaque ligne est lancée séparément).
-- =====================================================================
-- T01 RG-STK-01 : stock négatif interdit (colonne UNSIGNED)
UPDATE products SET stock_quantity = -1 WHERE id = 1;
-- T02 Mouvement de stock de quantité nulle interdit
INSERT INTO stock_movements (product_id, type, quantity, stock_after) VALUES (1, 'adjustment', 0, 31);
-- T03 RG-COM-04 : total incohérent refusé
INSERT INTO orders (reference, customer_id, fulfillment_method, subtotal, shipping_fee, total, placed_at) VALUES ('CMD-T-03', 1, 'pickup', 10000, 0, 9000, NOW());
-- T04 Livraison sans adresse refusée
INSERT INTO orders (reference, customer_id, fulfillment_method, subtotal, total, placed_at) VALUES ('CMD-T-04', 1, 'delivery', 5000, 5000, NOW());
-- T05 Ligne de commande : total de ligne faux refusé
INSERT INTO order_items (order_id, product_id, product_name, sku, unit_price, unit_cost, quantity, line_total) VALUES (1, 1, 'x', 'x', 6500, 3500, 2, 1);
-- T06 Quantité nulle refusée
INSERT INTO order_items (order_id, product_id, product_name, sku, unit_price, unit_cost, quantity, line_total) VALUES (1, 1, 'x', 'x', 6500, 3500, 0, 0);
-- T07 RG-RES-02 : deux réservations ACTIVES au même instant pour le même coiffeur refusées
INSERT INTO bookings (reference, customer_id, service_id, stylist_id, status, starts_at, ends_at, service_name, duration_minutes, price) VALUES ('RDV-T-07', 4, 2, 1, 'pending', '2026-03-21 10:00:00', '2026-03-21 11:45:00', 'Nattes collées', 90, 12000);
-- T08 Réservation qui finit avant de commencer refusée
INSERT INTO bookings (reference, customer_id, service_id, stylist_id, starts_at, ends_at, service_name, duration_minutes, price) VALUES ('RDV-T-08', 4, 2, 1, '2026-05-01 12:00:00', '2026-05-01 10:00:00', 'x', 90, 1);
-- T09 Facture rattachée à la fois à une commande ET à une réservation refusée
INSERT INTO invoices (number, order_id, booking_id, customer_id, customer_name, company_snapshot, subtotal, total, issued_at) VALUES ('FAC-T-09', 1, 1, 1, 'x', '{}', 1, 1, NOW());
-- T10 RG-FAC-02 : numéro de facture en double refusé
INSERT INTO invoices (number, order_id, customer_id, customer_name, company_snapshot, subtotal, total, issued_at) VALUES ('FAC-DUP', 1, 1, 'x', '{}', 1, 1, NOW()), ('FAC-DUP', 2, 2, 'x', '{}', 1, 1, NOW());
-- T11 RG-STK-05 : suppression physique d'un produit déjà vendu bloquée (clé étrangère RESTRICT)
DELETE FROM products WHERE id = 1;
-- T12 RG-CLI-01 : deux clients avec le même téléphone refusés
INSERT INTO customers (first_name, last_name, phone) VALUES ('Doublon', 'Test', '+221770000003');
-- T13 Prix barré inférieur au prix de vente refusé
UPDATE products SET compare_at_price = 1000 WHERE id = 1;
-- T14 Horaires incohérents (fermeture avant ouverture) refusés
UPDATE business_hours SET opens_at = '19:00', closes_at = '09:00' WHERE day_of_week = 1;
-- T15 Commande pour un client inexistant refusée (intégrité référentielle)
INSERT INTO orders (reference, customer_id, fulfillment_method, subtotal, total, placed_at) VALUES ('CMD-T-15', 9999, 'pickup', 1, 1, NOW());
-- T16 Note d'avis hors de l'échelle 1 à 5 refusée
INSERT INTO product_reviews (product_id, customer_id, rating) VALUES (1, 4, 6);
-- T17 Deux avis du même client sur le même produit refusés
INSERT INTO product_reviews (product_id, customer_id, rating) VALUES (2, 1, 3);
-- T18 Même produit ajouté deux fois aux favoris refusé (clé primaire composée)
INSERT INTO favorites (user_id, product_id) VALUES (3, 1);
-- T19 Réception supérieure à la quantité commandée refusée
UPDATE purchase_order_items SET quantity_received = 49 WHERE purchase_order_id = 1 AND product_id = 6;
-- T20 Ligne d'achat à zéro lot refusée
INSERT INTO purchase_order_items (purchase_order_id, product_id, packs_ordered, unit_cost) VALUES (1, 1, 0, 3500);
-- T21 Colonne générée non modifiable à la main (le total d'une ligne d'achat se calcule seul)
UPDATE purchase_order_items SET line_total = 1 WHERE purchase_order_id = 1 AND product_id = 6;
-- T22 Quantité nulle dans un panier refusée
INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (3, 1, 0);
