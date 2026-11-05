# Guide de déploiement

> Explications détaillées, choix de l'hébergeur et du domaine : **[docs/11_DEPLOIEMENT.md](docs/11_DEPLOIEMENT.md)**.
> Ce guide est l'aide-mémoire des commandes.

## Environnements

| Environnement | Où | Données | Configuration |
|---|---|---|---|
| Développement | votre ordinateur (Docker + `php artisan serve` + `npm run dev`) | démonstration (`migrate:fresh --seed`, `app:demo-history`) | `backend/.env` (copie de `.env.example`) |
| Intégration continue | serveurs GitHub, à chaque push | base neuve à chaque fois | `.github/workflows/ci.yml` |
| **Production** | VPS Ubuntu 24.04, `https://dabohair.com` | **réelles** | `/var/www/dabohair/shared/.env` (créé par `provision.sh` à partir de `backend/.env.production.example`) |

## Configuration serveur

Une seule fois, en root, sur un Ubuntu 24.04 neuf :

```bash
git clone https://github.com/malick-milk/salon_coiffure_et_produits_capillaires.git
```

```bash
sudo bash salon_coiffure_et_produits_capillaires/deploy/provision.sh dabohair.com contact@dabohair.com
```

Le script installe Nginx, PHP 8.3, MySQL 8.0, Node 22, Composer, le pare-feu, fail2ban, le HTTPS, les tâches planifiées et les sauvegardes.

## Variables d'environnement

Elles se trouvent dans `/var/www/dabohair/shared/.env` (droits `640`). Les secrets y sont générés sur le serveur et n'existent nulle part ailleurs.

| Variable | Valeur en production | Pourquoi |
|---|---|---|
| `APP_ENV` / `APP_DEBUG` | `production` / `false` | Pas de détail technique en cas d'erreur |
| `APP_KEY` | générée | Chiffre les cookies et les sessions |
| `APP_URL`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS` | `https://dabohair.com` | Adresse officielle |
| `SESSION_DOMAIN` / `SESSION_SECURE_COOKIE` | `dabohair.com` / `true` | Cookie de session uniquement en HTTPS |
| `SANCTUM_STATEFUL_DOMAINS` | `dabohair.com,www.dabohair.com` | Connexion du site par cookie |
| `DB_*` | base `dabohair`, mot de passe généré | MySQL n'écoute que localement |
| `LOG_LEVEL` | `warning` | Pas de données personnelles dans les journaux |

Après une modification du `.env`, relancez un déploiement, ou depuis `current/backend` :

```bash
php artisan optimize
```

## Procédure de mise en production

Première fois (crée les données de référence et le compte du propriétaire) :

```bash
sudo -u dabo bash salon_coiffure_et_produits_capillaires/deploy/deploy.sh --first
```

Ensuite, à chaque mise à jour, en tant que `dabo` :

```bash
bash /var/www/dabohair/current/deploy/deploy.sh
```

Le déploiement s'arrête **sans rien changer au site en ligne** si une étape échoue, ou si `php artisan app:security-check` trouve un point bloquant.

## Sauvegardes

| Commande | Effet |
|---|---|
| `bash /var/www/dabohair/current/deploy/backup.sh` | Sauvegarde chiffrée immédiate (aussi lancée chaque nuit et avant chaque déploiement) |
| `bash /var/www/dabohair/current/deploy/restore.sh` | **Test** : restaure la dernière sauvegarde dans une base d'essai |
| `bash … restore.sh FICHIER --production` | Restauration réelle (confirmation demandée) |

La clé `/etc/dabohair/backup.key` doit être conservée **hors du serveur**.

## Retour arrière (rollback)

```bash
bash /var/www/dabohair/current/deploy/rollback.sh
```

Le code de la version précédente est remis en ligne en une seconde. Le déploiement le fait aussi automatiquement si le site ne répond plus après une mise à jour.
