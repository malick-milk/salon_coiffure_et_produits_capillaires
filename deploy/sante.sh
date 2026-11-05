#!/usr/bin/env bash
# BILAN DE SANTÉ du serveur, en une commande (à lancer chaque semaine, ou dès qu'un doute apparaît) :
#   bash /var/www/dabohair/current/deploy/sante.sh
set -uo pipefail
APP_DIR="${APP_DIR:-/var/www/dabohair}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/dabohair}"
ok() { printf '  \033[32mOK\033[0m        %s\n' "$1"; }
ko() { printf '  \033[31mATTENTION\033[0m %s\n' "$1"; problems=$((problems + 1)); }
problems=0
DOMAIN="$(grep -E '^APP_URL=' "$APP_DIR/shared/.env" 2>/dev/null | cut -d/ -f3)"

echo "Bilan du $(date -u '+%d/%m/%Y %H:%M') UTC — ${DOMAIN:-domaine inconnu}"
# On regarde si le PROCESSUS tourne : pas besoin de droits root (« service mysql status » en demande)
for pair in nginx:nginx php8.3-fpm:php-fpm8.3 mysql:mysqld cron:cron; do
  name="${pair%%:*}"; process="${pair##*:}"
  if pgrep -x "$process" >/dev/null 2>&1; then ok "Service $name actif"; else ko "Service $name ARRÊTÉ : sudo systemctl restart $name"; fi
done
# Le vrai chemin d'une cliente : HTTPS (en HTTP, le site redirige, ce qui ne prouve rien)
code="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 10 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/up")"
[ "$code" = "200" ] || code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H "Host: $DOMAIN" http://127.0.0.1/up)"
case "$code" in 200) ok "Le site répond (/up : 200)";; *) ko "Le site ne répond pas correctement (/up : $code)";; esac

used="$(df --output=pcent / | tail -1 | tr -dc '0-9')"
[ "${used:-0}" -lt 80 ] && ok "Disque utilisé à $used %" || ko "Disque utilisé à $used % : supprimez d'anciennes versions ou journaux"
mem="$(free | awk '/Mem:/ {printf "%d", $7/$2*100}')"
[ "${mem:-0}" -gt 15 ] && ok "Mémoire disponible : $mem %" || ko "Mémoire presque pleine ($mem % disponible)"

last="$(ls -1t "$BACKUP_DIR"/*.sql.gz.enc 2>/dev/null | head -n 1)"
if [ -n "$last" ]; then
  age=$(( ( $(date +%s) - $(stat -c %Y "$last") ) / 3600 ))
  [ "$age" -le 26 ] && ok "Dernière sauvegarde il y a $age h ($(du -h "$last" | cut -f1))" || ko "Dernière sauvegarde il y a $age h (attendu : chaque nuit)"
else ko "Aucune sauvegarde trouvée dans $BACKUP_DIR"; fi

if command -v openssl >/dev/null && [ -n "$DOMAIN" ]; then
  end="$(echo | openssl s_client -servername "$DOMAIN" -connect 127.0.0.1:443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
  if [ -n "$end" ]; then
    days=$(( ( $(date -d "$end" +%s) - $(date +%s) ) / 86400 ))
    [ "$days" -gt 14 ] && ok "Certificat HTTPS valide encore $days jours" || ko "Certificat HTTPS expire dans $days jours : sudo certbot renew"
  else ko "Pas de certificat HTTPS (sudo certbot --nginx -d $DOMAIN)"; fi
fi

log="$APP_DIR/shared/storage/logs/security-$(date -u +%F).log"
failed="$(grep -c '"login.failed"' "$log" 2>/dev/null || true)"; denied="$(grep -c '"access.denied"' "$log" 2>/dev/null || true)"
[ "${failed:-0}" -lt 50 ] && ok "Connexions échouées aujourd'hui : ${failed:-0}" || ko "${failed} connexions échouées aujourd'hui : attaque possible (voir $log)"
[ "${denied:-0}" -lt 50 ] && ok "Accès refusés aujourd'hui : ${denied:-0}" || ko "${denied} accès refusés aujourd'hui (voir $log)"
upgrades="$(apt list --upgradable 2>/dev/null | grep -c security || true)"
[ "${upgrades:-0}" -eq 0 ] && ok "Aucune mise à jour de sécurité en attente" || ko "$upgrades mise(s) à jour de sécurité en attente : sudo apt upgrade"

echo; [ "$problems" -eq 0 ] && echo "Tout va bien." || echo "$problems point(s) à regarder."
exit $(( problems > 0 ))
