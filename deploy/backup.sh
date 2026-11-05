#!/usr/bin/env bash
# SAUVEGARDE CHIFFRÉE de la base — chaque nuit (cron) et avant chaque déploiement.
#   bash /var/www/dabohair/current/deploy/backup.sh
#
# 1. mysqldump --single-transaction : copie COHÉRENTE sans arrêter le site (une photo à un instant précis)
# 2. gzip : environ 10 fois plus petit
# 3. openssl AES-256 : illisible sans la clé /etc/dabohair/backup.key (à conserver AUSSI hors du serveur)
# 4. 14 jours conservés sur le serveur ; copie hors du serveur si BACKUP_REMOTE est défini (rclone)
set -euo pipefail
APP_DIR="${APP_DIR:-/var/www/dabohair}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/dabohair}"
KEY="${BACKUP_KEY:-/etc/dabohair/backup.key}"
ENV_FILE="$APP_DIR/shared/.env"
get() { grep -E "^$1=" "$ENV_FILE" | head -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }

DB="$(get DB_DATABASE)"; USER="$(get DB_USERNAME)"; HOST="$(get DB_HOST)"; PORT="$(get DB_PORT)"
FILE="$BACKUP_DIR/$DB-$(date -u +%Y%m%d-%H%M%S).sql.gz.enc"
mkdir -p "$BACKUP_DIR"
umask 077

# Le mot de passe passe par un fichier temporaire protégé, jamais sur la ligne de commande (visible par « ps »)
CNF="$(mktemp)"; trap 'rm -f "$CNF"' EXIT
printf '[client]\nuser=%s\npassword=%s\nhost=%s\nport=%s\n' "$USER" "$(get DB_PASSWORD)" "$HOST" "$PORT" > "$CNF"

# set -o pipefail : si mysqldump échoue au milieu, tout le pipeline échoue (pas de sauvegarde tronquée « réussie »)
mysqldump --defaults-extra-file="$CNF" --single-transaction --routines --no-tablespaces "$DB" \
  | gzip -9 | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass "file:$KEY" -out "$FILE"
[ -s "$FILE" ] || { echo "Sauvegarde vide : échec."; rm -f "$FILE"; exit 1; }
echo "$(date -u '+%F %T') sauvegarde : $FILE ($(du -h "$FILE" | cut -f1))"

find "$BACKUP_DIR" -name '*.sql.gz.enc' -mtime +14 -delete
if [ -n "${BACKUP_REMOTE:-}" ]; then
  rclone copy "$FILE" "$BACKUP_REMOTE" && echo "   copie hors du serveur : $BACKUP_REMOTE"
fi
