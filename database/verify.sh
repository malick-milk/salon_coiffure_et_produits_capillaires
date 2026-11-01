#!/usr/bin/env bash
# =====================================================================
#  Vérifie le modèle de données de bout en bout, sur une base NEUVE :
#    1. recrée la base   2. charge schema.sql   3. charge sample_data.sql
#    4. contrôle la cohérence stock (cache = grand livre)
#    5. lance les tests d'intégrité (chaque instruction doit être refusée)
#    6. exécute les requêtes analytiques
#
#  Prérequis : un conteneur MySQL 8 démarré, par exemple :
#    docker compose up -d            (conteneur « salon-mysql », recommandé)
#  Usage : bash database/verify.sh [nom_du_conteneur]   (défaut : salon-mysql)
#  ATTENTION : détruit et recrée la base `salon_verify` (jamais la vraie base).
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")"
CONTAINER="${1:-salon-mysql}"
DB="salon_verify"
# Le mot de passe root est lu dans le conteneur lui-même : le script marche
# avec docker compose (root_dev_password) comme avec un conteneur de test (root).
ROOT_PASSWORD=$(docker exec "$CONTAINER" printenv MYSQL_ROOT_PASSWORD) || { echo "Conteneur '$CONTAINER' introuvable ou arrêté. Lancez d'abord : docker compose up -d"; exit 1; }
mysql_exec() { docker exec -i -e MYSQL_PWD="$ROOT_PASSWORD" "$CONTAINER" mysql -uroot --default-character-set=utf8mb4 "$@"; }

echo "1. Base neuve '$DB'"
mysql_exec -e "DROP DATABASE IF EXISTS $DB; CREATE DATABASE $DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "2. Schéma";          mysql_exec "$DB" < schema.sql
echo "3. Données de démo"; mysql_exec "$DB" < sample_data.sql
mysql_exec -N "$DB" -e "SELECT CONCAT('   ', COUNT(*), ' tables') FROM information_schema.tables WHERE table_schema = '$DB';"

echo "4. Cohérence du stock (cache products.stock_quantity = somme du grand livre)"
INCOHERENT=$(mysql_exec -N "$DB" -e "SELECT COUNT(*) FROM (SELECT p.id FROM products p LEFT JOIN stock_movements m ON m.product_id = p.id GROUP BY p.id, p.stock_quantity HAVING p.stock_quantity <> COALESCE(SUM(m.quantity), 0)) x;")
[ "$INCOHERENT" = "0" ] && echo "   OK" || { echo "   ÉCHEC : $INCOHERENT produit(s) incohérent(s)"; exit 1; }

echo "4b. Cohérence des achats (total du bon = somme des lignes ; reçu = mouvements 'purchase')"
BAD_PO=$(mysql_exec -N "$DB" -e "SELECT COUNT(*) FROM purchase_orders po WHERE po.total_cost <> (SELECT COALESCE(SUM(line_total), 0) FROM purchase_order_items WHERE purchase_order_id = po.id) OR (SELECT COALESCE(SUM(quantity_received), 0) FROM purchase_order_items WHERE purchase_order_id = po.id) <> (SELECT COALESCE(SUM(quantity), 0) FROM stock_movements WHERE type = 'purchase' AND reference_type LIKE '%PurchaseOrder' AND reference_id = po.id);")
[ "$BAD_PO" = "0" ] && echo "   OK" || { echo "   ÉCHEC : $BAD_PO bon(s) de commande incohérent(s)"; exit 1; }

echo "5. Tests d'intégrité"
pass=0; fail=0
while IFS= read -r label && IFS= read -r stmt; do
  # </dev/null : sinon "docker exec -i" lirait (et consommerait) les lignes suivantes de la boucle
  if out=$(mysql_exec "$DB" -e "$stmt" </dev/null 2>&1); then
    fail=$((fail+1)); echo "   ÉCHEC ${label#-- } : instruction acceptée à tort"
  else
    pass=$((pass+1)); echo "   OK    ${label#-- }"
  fi
done < <(grep -v -e '^-- ==' -e '^--  ' -e '^$' tests/integrity_tests.sql)
echo "   => $pass refusés comme attendu, $fail acceptés à tort"
[ "$fail" -eq 0 ] || exit 1

echo "6. Requêtes analytiques"
mysql_exec -t "$DB" < analytics_queries.sql
echo "Vérification terminée avec succès."
