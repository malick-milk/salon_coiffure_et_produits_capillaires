#!/usr/bin/env bash
# =====================================================================================================
#  METTRE EN LIGNE la dernière version (branche main) — en tant qu'utilisateur « dabo » :
#
#    bash /var/www/dabohair/current/deploy/deploy.sh          (mises à jour)
#    bash ~/salon_coiffure_et_produits_capillaires/deploy/deploy.sh --first   (TOUTE PREMIÈRE fois)
#
#  Principe (« déploiement atomique ») : chaque version est installée dans son propre dossier
#  releases/AAAAMMJJ-HHMMSS. Le lien « current » ne bascule vers elle qu'une fois TOUT prêt et vérifié.
#  Si une étape échoue, le site continue de tourner sur l'ancienne version : rien n'est cassé.
#  Retour arrière : bash deploy/rollback.sh
# =====================================================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/dabohair}"
REPO_URL="${REPO_URL:-https://github.com/malick-milk/salon_coiffure_et_produits_capillaires.git}"
BRANCH="${BRANCH:-main}"
KEEP=5                                   # versions conservées pour un retour arrière
FIRST=0; [ "${1:-}" = "--first" ] && FIRST=1
RELEASE="$APP_DIR/releases/$(date -u +%Y%m%d-%H%M%S)"

step() { printf '\n\033[1;33m== %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31mÉCHEC : %s\033[0m\nLe site tourne toujours sur la version précédente. Dossier incomplet supprimé.\n' "$1"; rm -rf "$RELEASE"; exit 1; }
trap 'fail "étape interrompue (ligne $LINENO)"' ERR

[ "$(id -un)" != "root" ] || { echo "Ne pas lancer en root : sudo -u dabo bash deploy.sh"; exit 1; }
[ -f "$APP_DIR/shared/.env" ] || { echo "Configuration absente : lancez d'abord provision.sh"; exit 1; }

step "1/7 Récupération du code ($BRANCH)"
git clone --quiet --depth 1 --branch "$BRANCH" "$REPO_URL" "$RELEASE"
echo "   Version : $(git -C "$RELEASE" log -1 --format='%h — %s')"

step "2/7 Configuration et fichiers partagés entre les versions"
ln -s "$APP_DIR/shared/.env" "$RELEASE/backend/.env"
rm -rf "$RELEASE/backend/storage"
ln -s "$APP_DIR/shared/storage" "$RELEASE/backend/storage"

step "3/7 Bibliothèques PHP (sans les outils de développement)"
cd "$RELEASE/backend"
composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction --no-progress --quiet

step "4/7 Construction du site React"
cd "$RELEASE/frontend"
npm ci --no-audit --no-fund --loglevel=error
npm run build --silent
rm -rf node_modules                      # inutile une fois construit : 300 Mo de moins par version

step "5/7 Base de données"
cd "$RELEASE/backend"
if [ "$FIRST" -eq 0 ]; then
  bash "$RELEASE/deploy/backup.sh"       # sauvegarde AVANT de toucher à la structure
fi
php artisan migrate --force --no-interaction
if [ "$FIRST" -eq 1 ]; then
  # Données de référence : rôles et permissions, prestations, horaires, catalogue (jamais les comptes de démonstration)
  php artisan db:seed --force --class=RolesAndPermissionsSeeder
  php artisan db:seed --force --class=ReferenceDataSeeder
  php artisan db:seed --force --class=DaboHairCatalogSeeder
  if ! php artisan tinker --execute='exit(App\Models\User::role("super_admin")->exists() ? 0 : 1);' >/dev/null 2>&1; then
    echo; echo "   Création du compte du PROPRIÉTAIRE (vos identifiants de connexion à l'ERP) :"
    php artisan app:create-admin
  fi
fi

step "6/7 Optimisation et contrôle de sécurité"
php artisan optimize                     # met en cache configuration, routes, vues, événements
php artisan app:security-check || fail "configuration non sûre (voir les points BLOQUANT ci-dessus)"

step "7/7 Bascule vers la nouvelle version"
ln -sfn "$RELEASE" "$APP_DIR/current.new"
mv -Tf "$APP_DIR/current.new" "$APP_DIR/current"   # mv est atomique : aucune requête ne voit un état intermédiaire
sudo -n /usr/bin/systemctl reload php8.3-fpm 2>/dev/null || service php8.3-fpm reload 2>/dev/null || true
trap - ERR

# Vérification : le site répond-il vraiment ? Sinon, retour automatique à la version précédente.
DOMAIN="$(grep -E '^APP_URL=' "$APP_DIR/shared/.env" | cut -d/ -f3)"
sleep 1
if curl -fsS --max-time 15 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/up" >/dev/null 2>&1 \
  || curl -fsS --max-time 15 -H "Host: $DOMAIN" "http://127.0.0.1/up" >/dev/null 2>&1; then
  echo "   Le site répond (/up)."
else
  echo "   Le site ne répond pas : retour à la version précédente."
  bash "$RELEASE/deploy/rollback.sh"
  exit 1
fi

# Ménage : on garde les $KEEP dernières versions
ls -1dt "$APP_DIR"/releases/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -rf
printf '\n\033[1;32mEn ligne : %s\033[0m\n' "$(basename "$RELEASE")"
