# Salon Platform — E-commerce, Réservation, ERP & BI

[![CI](https://github.com/malick-milk/salon_coiffure_et_produits_capillaires/actions/workflows/ci.yml/badge.svg)](https://github.com/malick-milk/salon_coiffure_et_produits_capillaires/actions/workflows/ci.yml)

Plateforme web pour une entreprise de produits capillaires et un salon de coiffure :
vitrine et e-commerce, réservation en ligne, ERP d'administration et tableau de bord décisionnel.

## Avancement

| Étape | Contenu | Statut |
|---|---|---|
| 1 | Analyse du besoin — [docs/01_ANALYSE_DU_BESOIN.md](docs/01_ANALYSE_DU_BESOIN.md) | Terminée |
| 2 | Architecture — [ARCHITECTURE.md](ARCHITECTURE.md) | Terminée (décisions provisoires, ADR-011) |
| 3 | Base de données — [DATABASE.md](DATABASE.md), [database/](database/), [analyse du MCD existant](docs/03b_ANALYSE_MCD_EXISTANT.md) | Terminée (45 tables testées sur MySQL 8.4) |
| 4 | Maquettes — [docs/04_MAQUETTES.md](docs/04_MAQUETTES.md), [maquettes interactives](https://claude.ai/artifact/KUfhiWo6RP8ziNSapB9CEa) | Terminée |
| 5 | Frontend React — [docs/05_FRONTEND.md](docs/05_FRONTEND.md), [frontend/](frontend/) | Terminée (vitrine, panier, réservation, compte client, commande) |
| 6 | Backend Laravel — [docs/06_BACKEND.md](docs/06_BACKEND.md), [backend/](backend/) | Terminée : API complète, frontend branché sur la vraie API |
| 7 | ERP — [docs/07_ERP.md](docs/07_ERP.md) | Terminée (API d'administration, factures PDF, audit, interface React `/admin`) |
| 8 | Data Analytics — [docs/08_ANALYTICS.md](docs/08_ANALYTICS.md), [analytics/](analytics/) | Terminée (agrégats quotidiens, tableau de bord BI, exports CSV, prévisions Python) |
| 9 | Tests — [docs/09_TESTS.md](docs/09_TESTS.md) | Terminée (252 vérifications, couverture backend 95,8 %, concurrence, intégration continue GitHub Actions) |
| 10 | Audit de sécurité — [docs/10_SECURITE.md](docs/10_SECURITE.md) | Terminée (OWASP Top 10 : 3 failles corrigées, 9 renforcements, `app:security-check`) |
| 11 | Déploiement — [docs/11_DEPLOIEMENT.md](docs/11_DEPLOIEMENT.md), [deploy/](deploy/) | Prête (scripts testés sur Ubuntu 24.04 ; reste : acheter le domaine et le serveur) |
| 12 | Publicités de l'accueil et « Nos gammes » — [docs/12_PUBLICITES_ET_GAMMES.md](docs/12_PUBLICITES_ET_GAMMES.md), [maquette](https://claude.ai/artifact/NpExLjgNGZiUutFi51EtZL) | Maquette en attente de validation |

## Stack
- Frontend : React + TypeScript + Vite + Tailwind CSS + shadcn/ui + Lucide React
- Backend : Laravel (API REST versionnée `/api/v1`), Sanctum (auth SPA), spatie/laravel-permission (RBAC)
- Base de données : MySQL 8 (+ Redis pour le cache et les files d'attente)
- Dev : Docker Compose (MySQL, Redis, Mailpit)

## Démarrage rapide (étape 3)

```bash
docker compose up -d
```

```bash
bash database/verify.sh
```

Le script vérifie le modèle de données sur une base de test séparée. Guide complet : [docs/TESTER_LE_PROJET.md](docs/TESTER_LE_PROJET.md).

## Documentation
| Fichier | Rôle |
|---|---|
| [docs/GUIDE_MODIFIER_LE_SITE.md](docs/GUIDE_MODIFIER_LE_SITE.md) | **Commencer ici pour modifier le site** : où est quoi, trouver un fichier, détecter les erreurs |
| [docs/APPRENDRE_UBUNTU.md](docs/APPRENDRE_UBUNTU.md) | Apprendre Ubuntu pour gérer le serveur (programme de 4 semaines, répétition générale dans WSL) |
| [docs/COMPTES_ET_DONNEES.md](docs/COMPTES_ET_DONNEES.md) | Lancer le site, comptes de test et vraies données, signaler un bug |
| [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) | Installer, coder, conventions |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Organisation technique du projet |
| [DATABASE.md](DATABASE.md) | Modèle de données |
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | Endpoints REST |
| [SECURITY_GUIDE.md](SECURITY_GUIDE.md) | Mesures OWASP |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) | Mise en production |
| [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) | Exploitation et dépannage |
