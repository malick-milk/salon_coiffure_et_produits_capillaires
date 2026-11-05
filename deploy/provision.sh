#!/usr/bin/env bash
# =====================================================================================================
#  PRÉPARER UN SERVEUR NEUF pour Dabo Hair — à lancer UNE seule fois, en root, sur Ubuntu 24.04 LTS.
#
#    sudo bash provision.sh dabohair.com contact@dabohair.com
#
#  Le script est « idempotent » : relancé, il ne casse rien (il complète ce qui manque).
#  Options (variables d'environnement), utiles pour un essai sans nom de domaine :
#    SKIP_TLS=1            pas de certificat HTTPS (le DNS doit pointer vers le serveur pour l'obtenir)
#    SKIP_FIREWALL=1       pas de pare-feu (conteneur de test)
#    SKIP_SSH_HARDENING=1  ne pas toucher à la configuration SSH
#    SKIP_NODE_INSTALL=1   Node.js déjà installé
#  Détail de chaque étape : docs/11_DEPLOIEMENT.md
# =====================================================================================================
set -euo pipefail

DOMAIN="${1:?Usage : sudo bash provision.sh DOMAINE EMAIL   (exemple : dabohair.com contact@dabohair.com)}"
EMAIL="${2:?Usage : sudo bash provision.sh DOMAINE EMAIL}"
APP_USER=dabo
APP_DIR=/var/www/dabohair
SECRETS_DIR=/etc/dabohair
BACKUP_DIR=/var/backups/dabohair
HERE="$(cd "$(dirname "$0")" && pwd)"

step() { printf '\n\033[1;33m== %s\033[0m\n' "$1"; }
info() { printf '   %s\n' "$1"; }

[ "$(id -u)" -eq 0 ] || { echo "À lancer en root : sudo bash provision.sh …"; exit 1; }
# shellcheck disable=SC1091
. /etc/os-release
[ "${VERSION_ID:-}" = "24.04" ] || info "Attention : script prévu pour Ubuntu 24.04 (ici : ${PRETTY_NAME:-inconnu})."
export DEBIAN_FRONTEND=noninteractive

step "1/9 Mises à jour du système et outils de base"
apt-get update -q
apt-get -y -q upgrade
apt-get -y -q install ca-certificates curl gnupg unzip git acl openssl cron rsync logrotate sudo \
  ufw fail2ban unattended-upgrades
# Mises à jour de SÉCURITÉ installées automatiquement chaque nuit
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
CONF
timedatectl set-timezone UTC 2>/dev/null || true   # l'application compte en UTC (= heure de Dakar)

step "2/9 Utilisateur « $APP_USER » (c'est lui qui déploie ; root ne sert qu'à l'installation)"
id "$APP_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "Deploiement Dabo Hair" "$APP_USER"
usermod -aG www-data "$APP_USER"
if [ -f /root/.ssh/authorized_keys ] && [ ! -f "/home/$APP_USER/.ssh/authorized_keys" ]; then
  install -d -m 700 -o "$APP_USER" -g "$APP_USER" "/home/$APP_USER/.ssh"
  install -m 600 -o "$APP_USER" -g "$APP_USER" /root/.ssh/authorized_keys "/home/$APP_USER/.ssh/authorized_keys"
  info "Votre clé SSH est copiée : vous pourrez vous connecter avec « ssh $APP_USER@$DOMAIN »."
fi
# Droits d'administration LIMITÉS : recharger PHP et Nginx, rien d'autre
cat > /etc/sudoers.d/dabohair <<CONF
$APP_USER ALL=(root) NOPASSWD: /usr/bin/systemctl reload php8.3-fpm, /usr/bin/systemctl reload nginx
CONF
chmod 440 /etc/sudoers.d/dabohair

step "3/9 PHP 8.3, Nginx, MySQL 8.0, Composer"
apt-get -y -q install nginx mysql-server composer \
  php8.3-fpm php8.3-cli php8.3-mysql php8.3-mbstring php8.3-xml php8.3-curl php8.3-zip php8.3-gd php8.3-intl php8.3-bcmath php8.3-opcache
# Réglages PHP de production
cat > /etc/php/8.3/fpm/conf.d/90-dabohair.ini <<'CONF'
expose_php = Off
display_errors = Off
log_errors = On
memory_limit = 256M
upload_max_filesize = 2M
post_max_size = 2M
opcache.enable = 1
opcache.memory_consumption = 128
opcache.max_accelerated_files = 20000
opcache.validate_timestamps = 0   ; le code ne change qu'au déploiement, qui recharge PHP
CONF
cp /etc/php/8.3/fpm/conf.d/90-dabohair.ini /etc/php/8.3/cli/conf.d/90-dabohair.ini
sed -i 's/^opcache.validate_timestamps.*/opcache.validate_timestamps = 1/' /etc/php/8.3/cli/conf.d/90-dabohair.ini
service php8.3-fpm restart >/dev/null 2>&1 || service php8.3-fpm start   # les réglages ne s'appliquent qu'au redémarrage

step "4/9 Node.js 22 (pour construire le site React au déploiement)"
if [ "${SKIP_NODE_INSTALL:-0}" = "1" ]; then
  info "Ignoré (SKIP_NODE_INSTALL=1) : $(node -v 2>/dev/null || echo 'node absent !')"
elif ! node -v 2>/dev/null | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get -y -q install nodejs
fi

step "5/9 Base de données (mot de passe généré ici, jamais écrit dans Git)"
install -d -m 750 -o root -g "$APP_USER" "$SECRETS_DIR"
if [ ! -f "$SECRETS_DIR/db-password" ]; then
  openssl rand -base64 33 | tr -d '/+=\n' | cut -c1-40 > "$SECRETS_DIR/db-password"
  chmod 640 "$SECRETS_DIR/db-password"; chgrp "$APP_USER" "$SECRETS_DIR/db-password"
fi
DB_PASSWORD="$(cat "$SECRETS_DIR/db-password")"
service mysql start >/dev/null 2>&1 || true
mysql <<SQL
CREATE DATABASE IF NOT EXISTS dabohair CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'dabohair'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
ALTER USER 'dabohair'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON dabohair.* TO 'dabohair'@'localhost';
-- base d'ESSAI pour tester la restauration des sauvegardes (deploy/restore.sh)
GRANT ALL PRIVILEGES ON \`dabohair_restore_test\`.* TO 'dabohair'@'localhost';
FLUSH PRIVILEGES;
SQL
info "Base « dabohair » prête ; MySQL n'écoute que sur le serveur lui-même (127.0.0.1)."

step "6/9 Dossiers de l'application et configuration de production"
install -d -o "$APP_USER" -g www-data -m 2775 "$APP_DIR" "$APP_DIR/releases" "$APP_DIR/shared"
for d in storage/app/public storage/framework/cache/data storage/framework/sessions storage/framework/views storage/framework/testing storage/logs; do
  install -d -o "$APP_USER" -g www-data -m 2775 "$APP_DIR/shared/$d"
done
# www-data (PHP) et dabo (déploiement, tâches planifiées) doivent pouvoir écrire dans storage
setfacl -R -m u:www-data:rwX -m u:"$APP_USER":rwX "$APP_DIR/shared/storage"
setfacl -R -d -m u:www-data:rwX -m u:"$APP_USER":rwX "$APP_DIR/shared/storage"
if [ ! -f "$APP_DIR/shared/.env" ]; then
  APP_KEY="base64:$(openssl rand -base64 32)"
  sed -e "s|__DOMAIN__|$DOMAIN|g" -e "s|__APP_KEY__|$APP_KEY|" -e "s|__DB_PASSWORD__|$DB_PASSWORD|" \
    "$HERE/../backend/.env.production.example" > "$APP_DIR/shared/.env"
  chown "$APP_USER":www-data "$APP_DIR/shared/.env"
  chmod 640 "$APP_DIR/shared/.env"   # lisible par PHP, invisible pour les autres utilisateurs
  info "Créé : $APP_DIR/shared/.env (clé de chiffrement et mot de passe générés)."
else
  info "$APP_DIR/shared/.env existe déjà : conservé tel quel."
fi

step "7/9 Nginx"
sed -e "s|__DOMAIN__|$DOMAIN|g" -e "s|__APP_DIR__|$APP_DIR|g" "$HERE/nginx/dabohair.conf.template" > /etc/nginx/sites-available/dabohair
# Certains serveurs n'ont pas d'IPv6 : Nginx refuserait alors de démarrer sur « [::]:80 »
if [ ! -s /proc/net/if_inet6 ]; then
  sed -i '/listen \[::\]/d' /etc/nginx/sites-available/dabohair
  info "IPv6 absent sur ce serveur : écoute en IPv4 uniquement."
fi
ln -sfn /etc/nginx/sites-available/dabohair /etc/nginx/sites-enabled/dabohair
rm -f /etc/nginx/sites-enabled/default
sed -i 's/# server_tokens off;/server_tokens off;/' /etc/nginx/nginx.conf
nginx -t
# Démarrer s'il est arrêté, sinon recharger (« reload » sur un Nginx arrêté ne le démarre pas toujours)
if service nginx status >/dev/null 2>&1; then service nginx reload; else service nginx start; fi

step "8/9 Tâches planifiées et sauvegardes"
install -d -o "$APP_USER" -g "$APP_USER" -m 700 "$BACKUP_DIR"
if [ ! -f "$SECRETS_DIR/backup.key" ]; then
  openssl rand -base64 48 > "$SECRETS_DIR/backup.key"
  chmod 640 "$SECRETS_DIR/backup.key"; chgrp "$APP_USER" "$SECRETS_DIR/backup.key"
fi
cat > /etc/cron.d/dabohair <<CRON
# Laravel : planificateur (agrégats analytiques à 00 h 30…) — chaque minute
* * * * * www-data cd $APP_DIR/current/backend && php artisan schedule:run >> /dev/null 2>&1
# Sauvegarde chiffrée de la base, chaque nuit à 2 h 15 (UTC = heure de Dakar)
15 2 * * * $APP_USER $APP_DIR/current/deploy/backup.sh >> $APP_DIR/shared/storage/logs/backup.log 2>&1
CRON
chmod 644 /etc/cron.d/dabohair
service cron start >/dev/null 2>&1 || true

step "9/9 Sécurité du serveur : pare-feu, anti-force brute, SSH, HTTPS"
if [ "${SKIP_FIREWALL:-0}" != "1" ]; then
  ufw allow OpenSSH >/dev/null
  ufw allow 'Nginx Full' >/dev/null
  ufw --force enable >/dev/null
  info "Pare-feu actif : seuls SSH (22), HTTP (80) et HTTPS (443) sont ouverts."
  systemctl enable --now fail2ban >/dev/null 2>&1 || true
  info "fail2ban actif : une adresse IP qui rate 5 connexions SSH est bannie."
fi
if [ "${SKIP_SSH_HARDENING:-0}" != "1" ]; then
  if [ -s "/home/$APP_USER/.ssh/authorized_keys" ]; then
    cat > /etc/ssh/sshd_config.d/90-dabohair.conf <<'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
CONF
    systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true
    info "SSH : connexion par CLÉ uniquement (les mots de passe ne sont plus acceptés)."
  else
    info "ATTENTION : aucune clé SSH trouvée ; la connexion par mot de passe reste active. Voir docs/11_DEPLOIEMENT.md §3."
  fi
fi
if [ "${SKIP_TLS:-0}" != "1" ]; then
  apt-get -y -q install certbot python3-certbot-nginx
  certbot --nginx -n --agree-tos -m "$EMAIL" --redirect -d "$DOMAIN" -d "www.$DOMAIN"
  info "HTTPS actif ; le certificat se renouvelle tout seul (certbot.timer)."
else
  info "HTTPS ignoré (SKIP_TLS=1)."
fi

printf '\n\033[1;32mServeur prêt.\033[0m Étape suivante, en tant que %s :\n' "$APP_USER"
printf '   sudo -u %s bash %s/deploy.sh --first\n\n' "$APP_USER" "$HERE"
printf '\033[1;31mIMPORTANT\033[0m : copiez la clé des sauvegardes HORS du serveur (sans elle, une sauvegarde est illisible) :\n'
printf '   sudo cat %s/backup.key\n' "$SECRETS_DIR"
