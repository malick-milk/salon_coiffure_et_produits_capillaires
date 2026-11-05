#!/usr/bin/env bash
# VÉRIFIER TOUT AVANT UN « git push » : les mêmes contrôles que l'intégration continue (hors navigateur).
# Utilisation, depuis le dossier du projet (Git Bash sous Windows) :   bash scripts/verifier-tout.sh
# Prérequis : Docker lancé (MySQL), « composer install » et « npm install » déjà faits.
#
# Le détail complet de chaque contrôle est enregistré dans verification.log (à envoyer en cas de souci).
set -u
cd "$(dirname "$0")/.." || exit 1
LOG="verification.log"
: > "$LOG"
results=()
failed_details=()

step() { # step "nom" commande…
  local name="$1"; shift
  local out
  printf '\n\033[1m== %s\033[0m\n' "$name"
  out=$("$@" 2>&1); local code=$?
  printf '%s\n' "$out"
  printf '\n===== %s (code %s) =====\n%s\n' "$name" "$code" "$out" >> "$LOG"
  if [ $code -eq 0 ]; then
    results+=("OK    $name")
  else
    results+=("ÉCHEC $name")
    # Les 25 dernières lignes contiennent presque toujours la cause : on les remet dans le résumé
    failed_details+=("--- $name : fin du message ---"$'\n'"$(printf '%s\n' "$out" | grep -v '^\s*$' | tail -n 25 | cut -c1-300)")
  fi
}

# Avant les tests backend : la base de TEST est-elle joignable ? (cause n° 1 des échecs sur un poste)
# shellcheck disable=SC1112  # apostrophes typographiques dans les messages PHP : voulues
check_test_database() {
  (cd backend && php -r '
    $e = @parse_ini_file(".env", false, INI_SCANNER_RAW);
    if (!$e) { fwrite(STDERR, "Fichier backend/.env introuvable : lancez « cp .env.example .env » puis « php artisan key:generate ».\n"); exit(1); }
    try {
        new PDO("mysql:host={$e["DB_HOST"]};port={$e["DB_PORT"]};dbname=salon_test", $e["DB_USERNAME"], $e["DB_PASSWORD"], [PDO::ATTR_TIMEOUT => 3]);
        echo "Base de test salon_test joignable ({$e["DB_HOST"]}:{$e["DB_PORT"]}).\n";
    } catch (PDOException $x) {
        $m = $x->getMessage();
        fwrite(STDERR, "Base de test injoignable : $m\n\n");
        if (str_contains($m, "Unknown database")) {
            fwrite(STDERR, "CAUSE : la base salon_test n’existe pas. Créez-la une fois :\n  docker exec salon-mysql mysql -uroot -proot_dev_password -e \"CREATE DATABASE IF NOT EXISTS salon_test; GRANT ALL ON salon_test.* TO \x27salon\x27@\x27%\x27;\"\n");
        } elseif (str_contains($m, "refused") || str_contains($m, "2002") || str_contains($m, "timed out")) {
            fwrite(STDERR, "CAUSE : MySQL ne répond pas. Ouvrez Docker Desktop, puis à la racine du projet : docker compose up -d (attendre 30 secondes).\n");
        } elseif (str_contains($m, "Access denied")) {
            fwrite(STDERR, "CAUSE : identifiants refusés. Vérifiez DB_USERNAME / DB_PASSWORD dans backend/.env (salon / salon_dev_password).\n");
        }
        exit(1);
    }')
}

step "Backend : style du code (Pint)"            bash -c 'cd backend && vendor/bin/pint --test'
step "Backend : base de test joignable"          check_test_database
if [[ "${results[-1]}" == OK* ]]; then
  step "Backend : tests PHPUnit"                 bash -c 'cd backend && php artisan test'
else
  results+=("—     Backend : tests PHPUnit (non lancés : corrigez d'abord l'accès à la base)")
fi
step "Frontend : qualité du code (ESLint)"       bash -c 'cd frontend && npm run lint'
step "Frontend : types (TypeScript)"             bash -c 'cd frontend && npm run typecheck'
step "Frontend : tests unitaires (Vitest)"       bash -c 'cd frontend && npm run test:run'
step "Frontend : construction (build)"           bash -c 'cd frontend && npm run build'

printf '\n\033[1mRésumé\033[0m\n'
printf '%s\n' "${results[@]}"
if [ ${#failed_details[@]} -gt 0 ]; then
  printf '\n\033[1mPourquoi ça échoue\033[0m\n'
  printf '%s\n\n' "${failed_details[@]}"
  printf "Détail complet : %s (à m'envoyer si besoin). Corrigez avant de pousser.\n" "$LOG"
  exit 1
fi
printf '\nTout est vert : vous pouvez faire git push.\n'
