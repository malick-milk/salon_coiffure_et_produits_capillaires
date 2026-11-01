# Salon Platform — E-commerce, Réservation, ERP & BI

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
| 6 | Backend Laravel — [docs/06_BACKEND.md](docs/06_BACKEND.md), [backend/](backend/) | Partie 1 terminée (migrations, catalogue, disponibilités) ; partie 2 : réservations, auth, commandes |
| 7 | ERP | À faire |
| 8 | Data Analytics | À faire |
| 9 | Tests | À faire |
| 10 | Audit de sécurité | À faire |
| 11 | Déploiement | À faire |

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
| [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) | Installer, coder, conventions |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Organisation technique du projet |
| [DATABASE.md](DATABASE.md) | Modèle de données |
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | Endpoints REST |
| [SECURITY_GUIDE.md](SECURITY_GUIDE.md) | Mesures OWASP |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) | Mise en production |
| [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) | Exploitation et dépannage |
