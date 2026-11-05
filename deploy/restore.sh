#!/usr/bin/env bash
# RESTAURER une sauvegarde — et surtout TESTER qu'elle se restaure (une sauvegarde jamais testée n'est pas une sauvegarde).
#
#   bash restore.sh                         -> restaure la PLUS RÉCENTE dans une base d'ESSAI « dabohair_restore_test »
#   bash restore.sh fichier.sql.gz.enc      -> idem pour un fichier précis
#   bash restore.sh fichier.sql.gz.enc --production   -> remplace la VRAIE base (après confirmation)
set -euo pipefail
APP_DIR="${APP_DIR:-/var/www/dabohair}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/dabohair}"
KEY="${BACKUP_KEY:-/etc/dabohair/backup.key}"
ENV_FILE="$APP_DIR/shared/.env"
get() { grep -E "^$1=" "$ENV_FILE" | head -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }

FILE="${1:-$(ls -1t "$BACKUP_DIR"/*.sql.gz.enc 2>/dev/null | head -n 1)}"
[ -f "${FILE:-}" ] || { echo "Aucune sauvegarde trouvée dans $BACKUP_DIR."; exit 1; }
PROD=0; [ "${2:-}" = "--production" ] && PROD=1
TARGET="$(get DB_DATABASE)"; [ "$PROD" -eq 1 ] || TARGET="${TARGET}_restore_test"

if [ "$PROD" -eq 1 ]; then
  read -r -p "Remplacer la base de PRODUCTION « $TARGET » par $(basename "$FILE") ? Tapez RESTAURER : " answer
  [ "$answer" = "RESTAURER" ] || { echo "Annulé."; exit 1; }
  bash "$(dirname "$0")/backup.sh"   # filet de sécurité : l'état actuel est sauvegardé avant
fi

CNF="$(mktemp)"; trap 'rm -f "$CNF"' EXIT
chmod 600 "$CNF"
# Restauration : il faut un compte qui peut créer la base d'essai (root via « sudo mysql », ou le compte de l'application)
if [ "$(id -u)" -eq 0 ]; then MYSQL=(mysql); else
  printf '[client]\nuser=%s\npassword=%s\nhost=%s\nport=%s\n' "$(get DB_USERNAME)" "$(get DB_PASSWORD)" "$(get DB_HOST)" "$(get DB_PORT)" > "$CNF"
  MYSQL=(mysql --defaults-extra-file="$CNF")
fi
"${MYSQL[@]}" -e "CREATE DATABASE IF NOT EXISTS \`$TARGET\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:$KEY" -in "$FILE" | gunzip | "${MYSQL[@]}" "$TARGET"

echo "Restauré dans « $TARGET » depuis $(basename "$FILE"). Contrôle :"
"${MYSQL[@]}" -N "$TARGET" -e "SELECT CONCAT('   ', (SELECT COUNT(*) FROM products), ' produits, ', (SELECT COUNT(*) FROM orders), ' commandes, ', (SELECT COUNT(*) FROM bookings), ' rendez-vous, ', (SELECT COUNT(*) FROM users), ' utilisateurs')"
[ "$PROD" -eq 1 ] || echo "   Base d'essai : supprimez-la après vérification ->  sudo mysql -e 'DROP DATABASE $TARGET'"
