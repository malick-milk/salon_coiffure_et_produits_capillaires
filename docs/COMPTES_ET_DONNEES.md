# Comptes de test, vraies données et signalement des bugs

## 1. Lancer le site sur votre ordinateur

Il faut **deux fenêtres Git Bash** ouvertes en même temps, avec **MySQL démarré**.

Fenêtre 1, le backend (l'API Laravel) :

```bash
cd backend
php artisan serve
```

Fenêtre 2, le frontend (le site React) :

```bash
cd frontend
npm run dev
```

**Après chaque `git pull`**, mettez les dépendances à jour, sinon un paquet ajouté entre-temps manquera :

```bash
cd backend && composer install && php artisan migrate
cd ../frontend && npm ci
```

Puis ouvrez **http://localhost:5173** (écrivez `localhost` et pas `127.0.0.1`, sinon la connexion ne tient pas).

| Message | Cause | Solution |
|---|---|---|
| « Une erreur est survenue » ou « Erreur réseau » | La fenêtre 1 est fermée | Relancer `php artisan serve` |
| Pastille brune « Faux serveur (MSW) actif » | `frontend/.env.local` contient `VITE_ENABLE_MOCKS=true` | Mettre `false`, puis relancer `npm run dev` |
| `vendor/autoload.php` introuvable | Dépendances PHP absentes | `composer install` dans `backend/` |
| `Failed to resolve import "@fontsource-variable/inter"` (ou un autre paquet) | Un `git pull` a apporté un nouveau paquet npm, pas encore installé | Arrêter Vite (Ctrl + C), `npm ci` dans `frontend/`, puis `npm run dev` |
| Un compte de test est refusé | Base remplie avant la création du compte | `php artisan migrate:fresh --seed` dans `backend/` |

## 2. Deux bases de données séparées

| | Votre ordinateur (local) | Le serveur (production) |
|---|---|---|
| Rôle | Terrain d'essai, on peut tout casser | Le vrai site, avec les vrais clients |
| Comptes de test | Oui, recréés à chaque `migrate:fresh --seed` | **Jamais créés** |
| Fausses commandes et faux rendez-vous | Oui | Non |
| Catalogue, rôles, zones de livraison | Oui | Oui |
| Compte du propriétaire | Facultatif | Créé avec `php artisan app:create-admin` |

**Comptes de test (local uniquement)** : `admin@dabohair.test` / `admin-dabo-2026` (ERP) et `mariama@client.test` / `demo-dabo-2026` (client).

### Pourquoi les comptes de test n'arrivent jamais en production

Dans `backend/database/seeders/DemoAccountsSeeder.php` :

```php
if (! app()->environment(['local', 'testing'])) {
    return;
}
```

Sur le serveur, `.env` contient `APP_ENV=production` : ce code ne crée donc rien. `deploy/deploy.sh --first` remplit seulement les rôles, les données de référence et le catalogue, puis lance `app:create-admin`. Cette commande demande le prénom, le nom, l'e-mail et le mot de passe (12 caractères minimum, avec des lettres et des chiffres). Le mot de passe ne s'affiche pas pendant la saisie et ne reste pas dans l'historique du terminal.

Il n'y a donc **rien à désactiver** en production. En local, la page **Équipe** de l'ERP permet malgré tout de désactiver un compte (elle interdit de désactiver le sien).

### Ce que vous saisissez en local reste en local

Les données saisies sur votre ordinateur ne partent pas sur le serveur : ce sont deux bases différentes. En plus, `migrate:fresh --seed` **efface tout**, y compris le compte que vous vous êtes créé. Ce qui doit exister dès l'ouverture du site (produits, prestations, prix) doit donc être écrit **dans le code**, dans les seeders de `backend/database/seeders/`.

### Répéter la mise en ligne sur votre ordinateur

Pour remplir votre base locale exactement comme le serveur le fera, sans données de démonstration, lancez dans `backend/` :

```bash
php artisan migrate:fresh
php artisan db:seed --class=RolesAndPermissionsSeeder
php artisan db:seed --class=ReferenceDataSeeder
php artisan db:seed --class=DaboHairCatalogSeeder
php artisan app:create-admin
```

Pour revenir aux données de démonstration : `php artisan migrate:fresh --seed`.

## 3. Comment les bugs sont corrigés

Aucun mot de passe n'est nécessaire, ni pour votre ordinateur ni pour le serveur. Les corrections se font sur le code, à partir de GitHub, et sont vérifiées sur une copie séparée avec les comptes de test et les tests automatiques.

```
Vous testez et notez le problème
        ↓
Reproduction sur une copie séparée (comptes de test + tests automatiques)
        ↓
Correction, puis tests backend, frontend et parcours Playwright
        ↓
Envoi de la correction sur GitHub
        ↓
Vous : git pull, puis vérification en local
        ↓
Vous : deploy.sh sur le serveur
```

### Fiche de signalement

| Champ | Exemple |
|---|---|
| Page | ERP → Commandes |
| Ce que j'ai fait | 1. Ouvert la commande CMD-2026-000004 ; 2. Cliqué sur « Marquer comme livrée » |
| Ce qui s'est passé | Message « Une erreur est survenue » |
| Ce que j'attendais | Statut « Livrée » |
| Capture d'écran | Jointe |
| Journal (en cas d'erreur) | `tail -n 30 storage/logs/laravel.log`, lancé dans `backend/` |

**Règle de sécurité** : ne jamais transmettre un mot de passe ni le contenu du fichier `.env`. Si un journal en contient, masquez-le avant de l'envoyer.

### Idées pour la journée de test

Essayez de casser le site, pas seulement de vérifier qu'il marche : panier vide, quantité 0, faux numéro de téléphone, bouton « Retour » au milieu d'une commande, deux réservations sur le même créneau, téléphone en mode paysage, connexion lente.
