-- =====================================================================
--  REQUÊTES ANALYTIQUES DE RÉFÉRENCE (KPIs du dictionnaire, analyse §5)
-- =====================================================================
--  Chaque requête implémente UNE définition validée du dictionnaire des KPI.
--  À l'étape 8, elles seront encapsulées dans des classes Laravel
--  (app/Queries/Analytics/*) et exposées par l'API au tableau de bord.
--
--  Notions SQL utilisées (MySQL 8) :
--    - CTE (WITH ...)         : sous-requête nommée, lisible et réutilisable
--    - Fonctions de fenêtrage : SUM() OVER (...), RANK() OVER (...)
--    - LEFT JOIN calendrier   : faire apparaître les périodes sans vente (0)
--    - Agrégation conditionnelle : SUM(CASE WHEN ... THEN ... END)
--
--  Paramètres : on fixe une date de référence (« aujourd'hui ») et une période.
-- =====================================================================

SET @ref_date     = DATE('2026-03-20');   -- « aujourd'hui » pour la démonstration
SET @period_start = DATE('2026-01-01');
SET @period_end   = DATE('2026-03-31');

-- ---------------------------------------------------------------------
-- Q01 — CA mensuel (produits + prestations), mois sans vente inclus
-- Définition : commandes PAYÉES (date = paid_at) + réservations TERMINÉES (date = starts_at)
-- ---------------------------------------------------------------------
WITH months AS (
    SELECT DISTINCT year, month FROM calendar_dates
    WHERE date BETWEEN @period_start AND @period_end
),
product_sales AS (
    SELECT YEAR(paid_at) AS year, MONTH(paid_at) AS month, SUM(total) AS revenue
    FROM orders
    WHERE payment_status = 'paid'
    GROUP BY YEAR(paid_at), MONTH(paid_at)
),
service_sales AS (
    SELECT YEAR(starts_at) AS year, MONTH(starts_at) AS month, SUM(price) AS revenue
    FROM bookings
    WHERE status = 'completed'
    GROUP BY YEAR(starts_at), MONTH(starts_at)
)
SELECT m.year, m.month,
       COALESCE(p.revenue, 0)                          AS products_revenue,
       COALESCE(s.revenue, 0)                          AS services_revenue,
       COALESCE(p.revenue, 0) + COALESCE(s.revenue, 0) AS total_revenue,
       -- Fonction de fenêtrage : cumul depuis le début de la période
       SUM(COALESCE(p.revenue, 0) + COALESCE(s.revenue, 0)) OVER (ORDER BY m.year, m.month) AS cumulative_revenue
FROM months m
LEFT JOIN product_sales p ON p.year = m.year AND p.month = m.month
LEFT JOIN service_sales s ON s.year = m.year AND s.month = m.month
ORDER BY m.year, m.month;

-- ---------------------------------------------------------------------
-- Q02 — CA du jour / de la semaine / du mois / de l'année + comparaison au mois précédent
-- ---------------------------------------------------------------------
WITH revenue_events AS (                 -- une ligne par encaissement, quelle que soit la source
    SELECT DATE(paid_at) AS day, total AS amount FROM orders   WHERE payment_status = 'paid'
    UNION ALL
    SELECT DATE(starts_at), price             FROM bookings WHERE status = 'completed'
)
SELECT
    SUM(CASE WHEN day = @ref_date THEN amount ELSE 0 END)                                       AS revenue_today,
    SUM(CASE WHEN YEARWEEK(day, 3) = YEARWEEK(@ref_date, 3) THEN amount ELSE 0 END)             AS revenue_this_week,
    SUM(CASE WHEN day BETWEEN DATE_FORMAT(@ref_date, '%Y-%m-01') AND @ref_date THEN amount ELSE 0 END) AS revenue_month_to_date,
    SUM(CASE WHEN day BETWEEN DATE_FORMAT(@ref_date - INTERVAL 1 MONTH, '%Y-%m-01')
                          AND @ref_date - INTERVAL 1 MONTH THEN amount ELSE 0 END)              AS revenue_prev_month_same_period,
    SUM(CASE WHEN YEAR(day) = YEAR(@ref_date) AND day <= @ref_date THEN amount ELSE 0 END)      AS revenue_year_to_date
FROM revenue_events;

-- ---------------------------------------------------------------------
-- Q03 — Panier moyen = CA produits ÷ nombre de commandes payées
-- ---------------------------------------------------------------------
SELECT COUNT(*)                AS paid_orders,
       SUM(total)              AS products_revenue,
       ROUND(AVG(total))       AS average_basket
FROM orders
WHERE payment_status = 'paid'
  AND DATE(paid_at) BETWEEN @period_start AND @period_end;

-- ---------------------------------------------------------------------
-- Q04 — Produits les plus vendus ET les plus rentables (marge brute)
-- Utilise les INSTANTANÉS unit_price / unit_cost des lignes (RG-COM-03)
-- ---------------------------------------------------------------------
SELECT oi.product_id,
       oi.product_name,
       SUM(oi.quantity)                                        AS units_sold,
       SUM(oi.line_total)                                      AS revenue,
       -- Qualité des données : si un coût est inconnu (NULL), la marge est NULL plutôt que fausse
       IF(SUM(oi.unit_cost IS NULL) > 0, NULL, SUM(oi.line_total - oi.unit_cost * oi.quantity)) AS gross_margin,
       IF(SUM(oi.unit_cost IS NULL) > 0, NULL,
          ROUND(100 * SUM(oi.line_total - oi.unit_cost * oi.quantity) / SUM(oi.line_total), 1)) AS margin_rate_pct,
       RANK() OVER (ORDER BY SUM(oi.quantity) DESC)            AS rank_by_units,
       RANK() OVER (ORDER BY SUM(oi.line_total - oi.unit_cost * oi.quantity) DESC) AS rank_by_margin
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE o.payment_status = 'paid'
  AND DATE(o.paid_at) BETWEEN @period_start AND @period_end
GROUP BY oi.product_id, oi.product_name
ORDER BY gross_margin DESC;

-- ---------------------------------------------------------------------
-- Q05 — Nouveaux clients par mois (1re commande non annulée ou 1re réservation)
-- ---------------------------------------------------------------------
WITH activity AS (
    SELECT customer_id, placed_at AS at FROM orders   WHERE status <> 'cancelled'
    UNION ALL
    SELECT customer_id, starts_at       FROM bookings WHERE status NOT IN ('cancelled')
),
first_activity AS (
    SELECT customer_id, MIN(at) AS first_at FROM activity GROUP BY customer_id
)
SELECT YEAR(first_at) AS year, MONTH(first_at) AS month, COUNT(*) AS new_customers
FROM first_activity
WHERE DATE(first_at) BETWEEN @period_start AND @period_end
GROUP BY YEAR(first_at), MONTH(first_at)
ORDER BY year, month;

-- ---------------------------------------------------------------------
-- Q06 — Taux de retour client
-- = clients ayant au moins 2 achats/prestations réalisés ÷ clients actifs (≥ 1)
-- ---------------------------------------------------------------------
WITH visits AS (
    SELECT customer_id FROM orders   WHERE payment_status = 'paid'  AND DATE(paid_at)   BETWEEN @period_start AND @period_end
    UNION ALL
    SELECT customer_id FROM bookings WHERE status = 'completed'     AND DATE(starts_at) BETWEEN @period_start AND @period_end
),
per_customer AS (
    SELECT customer_id, COUNT(*) AS visits FROM visits GROUP BY customer_id
)
SELECT COUNT(*)                                        AS active_customers,
       SUM(visits >= 2)                                AS returning_customers,
       ROUND(100 * SUM(visits >= 2) / COUNT(*), 1)     AS returning_rate_pct
FROM per_customer;

-- ---------------------------------------------------------------------
-- Q07 — Top clients et valeur vie client (CLV historique)
-- CLV historique = total dépensé depuis la première visite (produits + prestations)
-- ---------------------------------------------------------------------
WITH spending AS (
    SELECT customer_id, total AS amount, paid_at AS at FROM orders   WHERE payment_status = 'paid'
    UNION ALL
    SELECT customer_id, price,           starts_at     FROM bookings WHERE status = 'completed'
)
SELECT c.id,
       CONCAT(c.first_name, ' ', c.last_name)         AS customer,
       IF(c.user_id IS NULL, 'invité', 'inscrit')     AS account_type,
       COUNT(*)                                       AS visits,
       SUM(s.amount)                                  AS lifetime_value,
       ROUND(AVG(s.amount))                           AS avg_ticket,
       DATE(MIN(s.at))                                AS first_visit,
       DATE(MAX(s.at))                                AS last_visit,
       DATEDIFF(@ref_date, MAX(s.at))                 AS days_since_last_visit  -- « Récence » (analyse RFM)
FROM spending s
JOIN customers c ON c.id = s.customer_id
GROUP BY c.id, c.first_name, c.last_name, c.user_id
ORDER BY lifetime_value DESC
LIMIT 10;

-- ---------------------------------------------------------------------
-- Q08 — Jours et heures de réservation les plus demandés (données d'une heatmap)
-- On compte les demandes (hors annulations) : elles mesurent la DEMANDE, même en cas d'absence.
-- ---------------------------------------------------------------------
SELECT WEEKDAY(starts_at) + 1                  AS day_of_week,   -- 1 = lundi
       ELT(WEEKDAY(starts_at) + 1, 'Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche') AS day_name,
       HOUR(starts_at)                          AS hour,
       COUNT(*)                                 AS bookings
FROM bookings
WHERE status <> 'cancelled'
GROUP BY day_of_week, day_name, hour
ORDER BY bookings DESC, day_of_week, hour;

-- ---------------------------------------------------------------------
-- Q09 — Taux de no-show = absents ÷ réservations passées qui auraient dû avoir lieu
-- ---------------------------------------------------------------------
SELECT COUNT(*)                                             AS past_bookings,
       SUM(status = 'no_show')                              AS no_shows,
       ROUND(100 * SUM(status = 'no_show') / COUNT(*), 1)   AS no_show_rate_pct
FROM bookings
WHERE starts_at < @ref_date
  AND status IN ('completed', 'no_show');

-- ---------------------------------------------------------------------
-- Q10 — Rotation des stocks sur la période
-- = coût des marchandises vendues ÷ valeur moyenne du stock (au prix d'achat)
-- Stock moyen ≈ (stock au début + stock à la fin) ÷ 2, reconstruit depuis le grand livre.
-- ---------------------------------------------------------------------
WITH stock_levels AS (
    SELECT p.id, p.name, p.cost_price,
           COALESCE(SUM(CASE WHEN m.created_at <  @period_start              THEN m.quantity END), 0) AS stock_start,
           COALESCE(SUM(CASE WHEN m.created_at <  @period_end + INTERVAL 1 DAY THEN m.quantity END), 0) AS stock_end,
           -- Sorties nettes pour vente : ventes moins annulations, en valeur positive
           -COALESCE(SUM(CASE WHEN m.type IN ('sale','sale_cancellation')
                              AND m.created_at BETWEEN @period_start AND @period_end + INTERVAL 1 DAY
                             THEN m.quantity END), 0) AS units_sold
    FROM products p
    LEFT JOIN stock_movements m ON m.product_id = p.id
    WHERE p.is_active = TRUE              -- un produit pas encore en vente n'a pas de rotation à mesurer
    GROUP BY p.id, p.name, p.cost_price
)
SELECT id, name, stock_start, stock_end, units_sold,
       units_sold * cost_price                                        AS cogs,
       ROUND((stock_start + stock_end) / 2 * cost_price)              AS avg_stock_value,
       -- Calculée en UNITÉS : identique au ratio en valeur quand le coût est constant,
       -- et utilisable même si le coût de revient n'est pas encore connu
       ROUND(units_sold / NULLIF((stock_start + stock_end) / 2, 0), 2) AS turnover_ratio
FROM stock_levels
ORDER BY turnover_ratio DESC;

-- ---------------------------------------------------------------------
-- Q11 — Proches de la rupture + prévision simple (couverture de stock)
-- Couverture (jours) = stock actuel ÷ ventes moyennes journalières sur 90 jours
-- ---------------------------------------------------------------------
WITH demand AS (
    SELECT product_id,
           -SUM(quantity) / 90 AS avg_daily_sales      -- ventes nettes des 90 derniers jours
    FROM stock_movements
    WHERE type IN ('sale', 'sale_cancellation')
      AND created_at >= @ref_date - INTERVAL 90 DAY
    GROUP BY product_id
)
SELECT p.id, p.name, p.stock_quantity, p.low_stock_threshold,
       ROUND(COALESCE(d.avg_daily_sales, 0), 3)                          AS avg_daily_sales,
       ROUND(p.stock_quantity / NULLIF(d.avg_daily_sales, 0))            AS days_of_cover,
       @ref_date + INTERVAL ROUND(p.stock_quantity / NULLIF(d.avg_daily_sales, 0)) DAY AS estimated_stockout_date,
       CASE
           WHEN p.stock_quantity = 0                                      THEN 'RUPTURE'
           WHEN p.stock_quantity <= p.low_stock_threshold                 THEN 'SOUS LE SEUIL'
           WHEN p.stock_quantity / NULLIF(d.avg_daily_sales, 0) < 7       THEN 'COUVERTURE < 7 J'
           ELSE 'OK'
       END                                                               AS stock_status
FROM products p
LEFT JOIN demand d ON d.product_id = p.id
WHERE p.deleted_at IS NULL
  AND p.is_active = TRUE
ORDER BY (p.stock_quantity <= p.low_stock_threshold) DESC, days_of_cover;

-- ---------------------------------------------------------------------
-- Q12 — Produits à faible rotation : en stock mais peu ou pas vendus sur 90 jours
-- ---------------------------------------------------------------------
SELECT p.id, p.name, p.stock_quantity,
       p.stock_quantity * p.cost_price                       AS immobilized_value,   -- argent « dormant »
       COALESCE(-SUM(m.quantity), 0)                          AS units_sold_90d
FROM products p
LEFT JOIN stock_movements m
       ON m.product_id = p.id
      AND m.type IN ('sale', 'sale_cancellation')
      AND m.created_at >= @ref_date - INTERVAL 90 DAY
WHERE p.stock_quantity > 0
  AND p.is_active = TRUE
GROUP BY p.id, p.name, p.stock_quantity, p.cost_price
HAVING units_sold_90d <= 2
ORDER BY immobilized_value DESC;

-- ---------------------------------------------------------------------
-- Q13 — Pertes de stock valorisées (objectif métier : réduire les pertes)
-- ---------------------------------------------------------------------
SELECT p.name,
       DATE(m.created_at)                  AS day,
       -m.quantity                         AS units_lost,
       -m.quantity * p.cost_price          AS loss_value,
       m.reason
FROM stock_movements m
JOIN products p ON p.id = m.product_id
WHERE m.type = 'loss'
ORDER BY m.created_at;

-- ---------------------------------------------------------------------
-- Q14 — Achats par fournisseur et valeur du stock reçu
-- ---------------------------------------------------------------------
SELECT s.name                               AS supplier,
       po.reference,
       DATE(po.received_at)                 AS received_on,
       COUNT(poi.id)                        AS product_lines,
       SUM(poi.packs_ordered)               AS packs,
       SUM(poi.quantity_received)           AS units_received,
       SUM(poi.line_total)                  AS lines_total,
       po.total_cost                        AS order_total
FROM purchase_orders po
JOIN suppliers s             ON s.id = po.supplier_id
JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
GROUP BY s.name, po.id, po.reference, po.received_at, po.total_cost
ORDER BY po.received_at;

-- ---------------------------------------------------------------------
-- Q15 — Satisfaction : note moyenne par produit (avis publiés uniquement)
-- ---------------------------------------------------------------------
SELECT p.name,
       COUNT(r.id)                          AS published_reviews,
       ROUND(AVG(r.rating), 2)              AS avg_rating,
       SUM(r.order_id IS NOT NULL)          AS verified_purchases
FROM product_reviews r
JOIN products p ON p.id = r.product_id
WHERE r.status = 'approved'
GROUP BY p.id, p.name
ORDER BY avg_rating DESC, published_reviews DESC;

-- ---------------------------------------------------------------------
-- Q16 — Taux d'abandon de panier = paniers abandonnés ÷ (abandonnés + convertis)
-- Un panier sans activité depuis 24 h passe en 'abandoned' (job planifié, étape 6).
-- ---------------------------------------------------------------------
SELECT SUM(status = 'converted')                                              AS converted_carts,
       SUM(status = 'abandoned')                                              AS abandoned_carts,
       ROUND(100 * SUM(status = 'abandoned') / NULLIF(SUM(status IN ('converted','abandoned')), 0), 1) AS abandonment_rate_pct
FROM carts;

-- ---------------------------------------------------------------------
-- Q17 — Fabrication : lots proches de la péremption (moins de 90 jours)
-- Stock restant estimé au niveau du produit (le stock n'est pas suivi lot par lot en V1).
-- ---------------------------------------------------------------------
SELECT pb.batch_number,
       p.name,
       p.unit_size,
       pb.quantity_produced,
       pb.produced_on,
       pb.expires_on,
       DATEDIFF(pb.expires_on, @ref_date)   AS days_before_expiry,
       p.stock_quantity                     AS product_stock_now
FROM production_batches pb
JOIN products p ON p.id = pb.product_id
WHERE pb.expires_on IS NOT NULL
  AND pb.expires_on <= @ref_date + INTERVAL 270 DAY   -- fenêtre large pour la démo ; 90 jours en production
ORDER BY pb.expires_on;

-- ---------------------------------------------------------------------
-- Q18 — Rentabilité POTENTIELLE de chaque lot fabriqué (si tout le lot est vendu au prix public)
-- Reproduit le « calcul des bénéfices par produit » de l'entreprise, directement depuis la base.
-- Marge AVANT les autres charges (loyer, salaires, électricité, transport…).
-- ---------------------------------------------------------------------
SELECT pb.batch_number,
       p.name,
       pb.quantity_produced                                       AS units,
       CONCAT(pb.quantity_produced DIV 12, ' douz.')              AS dozens,
       pb.quantity_produced * p.price                             AS potential_revenue,
       pb.total_cost,
       pb.unit_cost,
       pb.quantity_produced * p.price - pb.total_cost             AS potential_gross_margin,
       ROUND(100 * (pb.quantity_produced * p.price - pb.total_cost) / (pb.quantity_produced * p.price), 1) AS margin_rate_pct
FROM production_batches pb
JOIN products p ON p.id = pb.product_id
WHERE pb.total_cost IS NOT NULL
ORDER BY potential_gross_margin DESC;

-- Total des lots dont le coût est connu (contrôle : 1 776 000 / 156 000 / 1 620 000)
SELECT COUNT(*)                                                    AS batches_with_cost,
       SUM(pb.quantity_produced * p.price)                         AS potential_revenue,
       SUM(pb.total_cost)                                          AS total_cost,
       SUM(pb.quantity_produced * p.price) - SUM(pb.total_cost)    AS potential_gross_margin
FROM production_batches pb
JOIN products p ON p.id = pb.product_id
WHERE pb.total_cost IS NOT NULL;
