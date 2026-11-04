#!/usr/bin/env bash
# VÉRIFIER TOUT AVANT UN « git push » : les mêmes contrôles que l'intégration continue (hors navigateur).
# Utilisation, depuis le dossier du projet (Git Bash sous Windows) :   bash scripts/verifier-tout.sh
# Prérequis : Docker lancé (MySQL), « composer install » et « npm install » déjà faits.
set -u
cd "$(dirname "$0")/.."
results=()
step() { # step "nom" commande…
  local name="$1"; shift
  printf '\n\033[1m== %s\033[0m\n' "$name"
  if "$@"; then results+=("OK    $name"); else results+=("ÉCHEC $name"); fi
}

step "Backend : style du code (Pint)"            bash -c 'cd backend && vendor/bin/pint --test'
step "Backend : tests PHPUnit"                   bash -c 'cd backend && php artisan test'
step "Frontend : qualité du code (ESLint)"       bash -c 'cd frontend && npm run lint'
step "Frontend : types (TypeScript)"             bash -c 'cd frontend && npm run typecheck'
step "Frontend : tests unitaires (Vitest)"       bash -c 'cd frontend && npm run test:run'
step "Frontend : construction (build)"           bash -c 'cd frontend && npm run build'

printf '\n\033[1mRésumé\033[0m\n'
printf '%s\n' "${results[@]}"
if printf '%s\n' "${results[@]}" | grep -q '^ÉCHEC'; then
  printf '\nAu moins un contrôle a échoué : corrigez avant de pousser (le message est au-dessus).\n'
  exit 1
fi
printf '\nTout est vert : vous pouvez faire git push.\n'
