#!/usr/bin/env bash
# RETOUR ARRIÈRE : remet en ligne la version précédente en une seconde (le code, pas la base de données).
#   bash /var/www/dabohair/current/deploy/rollback.sh
# Si la version fautive avait modifié la base : php artisan migrate:rollback (avec prudence), ou restore.sh.
set -euo pipefail
APP_DIR="${APP_DIR:-/var/www/dabohair}"
current="$(readlink -f "$APP_DIR/current")"
previous="$(ls -1dt "$APP_DIR"/releases/*/ | sed 's:/$::' | grep -vxF "$current" | head -n 1 || true)"
[ -n "$previous" ] || { echo "Aucune version précédente disponible."; exit 1; }
ln -sfn "$previous" "$APP_DIR/current.new"
mv -Tf "$APP_DIR/current.new" "$APP_DIR/current"
sudo -n /usr/bin/systemctl reload php8.3-fpm 2>/dev/null || service php8.3-fpm reload 2>/dev/null || true
echo "Version en ligne : $(basename "$previous") (au lieu de $(basename "$current"))."
