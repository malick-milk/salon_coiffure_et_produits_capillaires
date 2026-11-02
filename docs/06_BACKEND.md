# ÉTAPE 6 — Développement du backend Laravel

> **Statut** : terminée.
> - **Partie 1** : installation, migrations, modèles, seeders, API publique du catalogue et du salon, disponibilités.
> - **Partie 2** : réservations, authentification Sanctum, commandes, espace client, et **frontend branché sur la vraie API**.
>
> **Vérification** :
> - 51 tests backend (244 vérifications) sur une base MySQL dédiée ;
> - 40 tests frontend ;
> - **51 vérifications de parcours dans un vrai navigateur, sur la vraie API** (24 pour la vitrine, 27 pour le compte et la commande).

---

## 1. Installer et lancer le backend sur votre PC (Windows)

### 1.1 Prérequis : PHP 8.3 et Composer
Laravel 13 exige **PHP 8.3 ou plus**. Le PHP de XAMPP est souvent plus ancien. Pour vérifier, lancez cette commande dans Git Bash :

```bash
php -v
```

Si la commande échoue ou affiche une version inférieure à 8.3, installez PHP et Composer avec l'installateur officiel de Laravel. Ouvrez **PowerShell** (pas Git Bash) et collez cette commande :

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://php.new/install/windows'))
```

Fermez puis rouvrez Git Bash, et vérifiez de nouveau avec `php -v` puis `composer -V`.

### 1.2 Lancer la base de données (Docker Desktop ouvert)
Depuis le dossier du projet :

```bash
docker compose up -d
```

### 1.3 Installer le backend (une seule fois)

```bash
cd backend
```

```bash
composer install
```

```bash
cp .env.example .env
```

```bash
php artisan key:generate
```

```bash
php artisan migrate:fresh --seed
```

La dernière commande crée les tables dans MySQL (port 3307) et y insère le catalogue Dabo Hair, les prestations, les horaires et les comptes de démonstration.

### 1.4 Démarrer l'API

```bash
php artisan serve
```

Testez dans le navigateur : http://localhost:8000/api/v1/products. Vous devez voir le JSON des 9 produits. Comme pour le frontend, **laissez la fenêtre ouverte** ; Ctrl + C arrête le serveur.

### Erreurs fréquentes à l'installation (Windows)

| Message | Cause | Solution |
|---|---|---|
| `Failed opening required '...backend/vendor/autoload.php'` | Les bibliothèques PHP ne sont pas installées : le dossier `vendor/` n'est **jamais** sur GitHub (`.gitignore`), il se recrée sur chaque ordinateur | Dans `backend/` : `composer install`, puis la suite du §1.3 |
| `requires ext-fileinfo` / `ext-zip` / `ext-gd`… (pendant `composer install`) | Extension PHP désactivée dans `php.ini` | `php --ini` affiche le fichier utilisé ; ouvrez-le et retirez le `;` devant `extension=fileinfo`, `openssl`, `mbstring`, `pdo_mysql`, `zip`, `gd`, `intl`, `curl` ; rouvrez Git Bash |
| `could not find driver` | Extension `pdo_mysql` désactivée | Même correction, ligne `extension=pdo_mysql` |
| `No application encryption key has been specified` | `php artisan key:generate` oublié | Le lancer dans `backend/` |
| `SQLSTATE[HY000] [2002]` | MySQL (Docker) arrêté, ou mauvais port | Docker Desktop ouvert, `docker compose up -d`, `DB_PORT=3307` dans `backend/.env` |
| `Test directory "...tests/Unit" not found` | Git ne versionne pas les dossiers vides : `tests/Unit` manquait sur GitHub (corrigé, il contient maintenant des tests) | `git pull` |
| `Your PHP version (8.x) does not satisfy requirement php ^8.3` | PHP trop ancien | Installer PHP 8.3 ou plus récent (§1.1) |

### 1.5 Lancer les tests
Les tests utilisent une base **séparée**, `salon_test`, qu'il faut créer une fois :

```bash
docker exec salon-mysql mysql -uroot -proot_dev_password -e "CREATE DATABASE IF NOT EXISTS salon_test; GRANT ALL ON salon_test.* TO 'salon'@'%';"
```

```bash
php artisan test
```

Résultat attendu : **81 tests réussis**. Deux familles de tests :
- **unitaires** (`tests/Unit`) : une classe testée seule, sans Laravel ni base de données (machines à états, téléphones) ; ils durent quelques millisecondes (`php artisan test --testsuite=Unit`) ;
- **fonctionnels** (`tests/Feature`) : de vraies requêtes HTTP sur l'API, avec une base remplie avant chaque test ; plus lents, mais ils vérifient le comportement de bout en bout.

---

## 2. Les concepts, expliqués

### 2.1 Laravel en une image

```
Requête HTTP ─▶ routes/api.php ─▶ FormRequest (validation) ─▶ Controller ─▶ Service / Model ─▶ MySQL
                                                                   │
JSON ◀── API Resource (choix des champs exposés) ◀─────────────────┘
```

| Dossier | Contenu | Exemple |
|---|---|---|
| `routes/api.php` | Les URL de l'API | `GET /api/v1/products` |
| `app/Http/Requests` | Validation des entrées | `ProductIndexRequest` refuse `min_price=abc` |
| `app/Http/Controllers/Api/V1` | Chefs d'orchestre, « minces » | `CatalogController` |
| `app/Http/Resources` | Forme du JSON (le **contrat**) | `ProductSummaryResource` n'expose jamais `cost_price` |
| `app/Models` | Une classe par table, avec ses relations | `Product::category()`, `Product::variants()` |
| `app/Services` | Logique métier réutilisable | `StockService`, `AvailabilityService` |
| `app/Enums` | Valeurs autorisées des statuts | `OrderStatus::Pending` |
| `database/migrations` | Le schéma, en code versionné | `create_catalog_tables` |
| `database/seeders` | Données de départ | `DaboHairCatalogSeeder` |
| `tests/Feature` | Tests de bout en bout de l'API | `AvailabilityTest` |
| `lang/fr` | Messages d'erreur en français | « Le prix minimum doit être un nombre entier. » |

### 2.2 Les migrations : la base de données en code
`database/schema.sql` (étape 3) a été traduit en **12 migrations**, regroupées par domaine. Avantages :
- l'historique du schéma est dans Git ;
- une seule commande reconstruit la base sur n'importe quel PC (`migrate:fresh --seed`) ;
- chaque modification future sera une nouvelle migration, relue et versionnée.

**Vérification de fidélité** : la base créée par les migrations contient exactement les mêmes 23 contraintes `CHECK`, 4 colonnes générées et 57 clés étrangères que `schema.sql`.

Le constructeur de schéma de Laravel ne sait pas écrire les contraintes `CHECK`. La petite classe `App\Support\Check` les ajoute en SQL, uniquement sur MySQL.

### 2.3 Eloquent : les modèles
Une classe = une table. On y déclare :
- **`$fillable`** : la liste blanche des champs remplissables en masse. `stock_quantity` en est **volontairement absent** : impossible de modifier le stock via un formulaire (protection contre le *mass assignment*) ;
- **`casts()`** : les conversions automatiques (`'status' => OrderStatus::class`, `'password' => 'hashed'`) ;
- **les relations** : `belongsTo`, `hasMany`, `belongsToMany`…

`Model::shouldBeStrict()` est activé en développement. Laravel signale alors immédiatement les erreurs silencieuses, comme les requêtes N+1 ou un attribut inexistant.

### 2.4 Les Enums PHP : une seule liste de valeurs
`OrderStatus`, `BookingStatus`, `StockMovementType`… servent à la fois :
- aux migrations (`$table->enum('status', OrderStatus::values())`) ;
- aux modèles (`'status' => OrderStatus::class`) ;
- à la validation.

Ajouter un statut se fait donc à **un seul endroit**.

### 2.5 Le StockService : le grand livre en action
Toute variation de stock passe par `StockService::record()`. Dans **une transaction** :
1. `lockForUpdate()` **verrouille** la ligne du produit : une vente simultanée attend son tour ;
2. le service vérifie que le stock ne devient pas négatif, sinon il lève `InsufficientStockException` avec le détail ;
3. il met à jour le cache `products.stock_quantity` ;
4. il écrit la ligne immuable dans `stock_movements`.

Même le seeder passe par ce service. C'est pourquoi le stock de chaque produit est **toujours égal** à la somme de son grand livre (test `StockServiceTest`).

### 2.6 Les API Resources : le contrat
Le frontend a défini le format du JSON à l'étape 5 (`types/api.ts`). Les Resources le produisent **exactement** :
- `snake_case` ;
- prix en entiers ;
- `stock_status` au lieu du stock exact ;
- horaires `"09:00"` au lieu de `"09:00:00"` ;
- pagination `{ data, meta }`.

Ce qui n'est pas dans la Resource **ne sort pas** : un test vérifie que `cost_price` et `266.67` n'apparaissent jamais dans la réponse publique.

### 2.7 Une spécification, deux langages
`AvailabilityService` (PHP) est la traduction de `availability.ts` (TypeScript). Les **11 cas de test** sont les mêmes des deux côtés : pause de midi, samedi, vendredi, dimanche, Noël, horizon de 60 jours, délai de 2 h, battement, « peu importe »… Le backend ajoute un cas : **les congés des coiffeurs** (`stylist_time_off`).

`travelTo()` fige « maintenant » dans les tests. Un test qui dépend de l'heure réelle passerait un jour et échouerait le lendemain.

### 2.8 Sécurité déjà en place
| Mesure | Où |
|---|---|
| Requêtes préparées (anti-injection SQL) ; les jokers `%` et `_` de la recherche sont neutralisés | `CatalogController` (test dédié) |
| Validation de **tous** les paramètres, même en lecture | `ProductIndexRequest`, `AvailabilityRequest` |
| Champs sensibles jamais exposés | API Resources (test dédié) |
| Limitation de débit : 120 requêtes par minute et par adresse IP | `AppServiceProvider` |
| Erreurs JSON en français, sans détail technique en production | `bootstrap/app.php` |
| Mot de passe haché automatiquement | `User::casts()` → `'password' => 'hashed'` |
| Comptes de démonstration créés uniquement en local et en test | `DemoAccountsSeeder` |

---

## 3. Partie 2 : réservations, connexion, commandes

### 3.1 Brancher le site React sur la vraie API
Dans `frontend/.env.local`, passez `VITE_ENABLE_MOCKS=false`. Lancez ensuite **trois fenêtres** Git Bash :

| Fenêtre | Commande | Rôle |
|---|---|---|
| 1 (dossier du projet) | `docker compose up -d` | MySQL |
| 2 (`backend`) | `php artisan serve` | API sur le port 8000 |
| 3 (`frontend`) | `npm run dev` | Site sur le port 5173 ; Vite transmet `/api` et `/sanctum` à Laravel |

Ouvrez http://localhost:5173. Comptes de démonstration : `mariama@client.test` / `demo-dabo-2026` (cliente) et `admin@dabohair.test` / `admin-dabo-2026` (pour l'ERP de l'étape 7).

Pour **remettre la démo à zéro** (stock, commandes, réservations) :

```bash
php artisan migrate:fresh --seed
```

### 3.2 Les Actions : un cas d'utilisation = une classe
| Classe | Ce qu'elle garantit |
|---|---|
| `CreateBookingAction` | Verrou sur les coiffeurs, revérification de la disponibilité, affectation de « peu importe », **index unique** en filet de sécurité → 409 si le créneau est pris |
| `PlaceOrderAction` | Prix lus **en base**, produits **verrouillés** par ordre d'identifiant (évite les interblocages), stock vérifié pour **toutes** les lignes avant la moindre écriture, tout dans **une transaction** |
| `CustomerResolver` | Une seule fiche client par téléphone. Un invité ne peut pas renommer la fiche d'un autre |
| `ReferenceGenerator` | Références `CMD-2026-000010` uniques, grâce à un compteur verrouillé (table `counters`) |

Les deux Actions principales sont les traductions PHP de `handlers.ts` et `orders.ts` (frontend). Les mêmes cas sont testés des deux côtés.

### 3.3 L'authentification Sanctum, de bout en bout
1. Le site appelle `GET /sanctum/csrf-cookie` : Laravel dépose le cookie `XSRF-TOKEN`.
2. `POST /api/v1/auth/login` : Laravel vérifie le **hachage** du mot de passe (`Auth::attempt`), puis **régénère l'identifiant de session** pour empêcher la fixation de session.
3. La session est stockée dans un cookie **HttpOnly**, illisible par JavaScript.
4. Chaque requête qui modifie des données doit porter le jeton CSRF. Sans lui, la réponse est **419**. Le frontend a deux intercepteurs : il demande le jeton s'il manque, et rejoue une fois la requête après un 419.

**Autres protections :**
- **message vague** en cas d'échec de connexion ;
- **5 essais**, puis 429 pendant 1 minute (par email et adresse IP) ;
- **compte désactivé** refusé ;
- **`AuthenticateSession`** : si le mot de passe change, les autres sessions sont invalidées.

### 3.4 Les Policies : qui a le droit ?
`OrderPolicy::view` et `BookingPolicy::cancel` vérifient que la ressource appartient à l'utilisateur connecté, ou qu'il a la permission (`orders.view`, `bookings.manage`) pour le personnel. C'est la protection **anti-IDOR** : connaître `CMD-2026-000011` ne suffit pas, la réponse est **403**.

### 3.5 Les codes de réponse, résumés
| Code | Quand |
|---|---|
| 201 | Réservation, commande ou compte créés |
| 401 | Non connecté (`/auth/me` pour un visiteur, `/me/*`) |
| 403 | La ressource appartient à quelqu'un d'autre |
| 404 | Ressource introuvable |
| 409 | Créneau déjà pris, stock insuffisant (avec le détail par produit) |
| 419 | Jeton CSRF absent ou expiré |
| 422 | Données invalides (messages en français, champ par champ) |
| 429 | Trop de tentatives (connexion) ou de créations (20 par heure et par adresse IP) |

## 4. Bugs trouvés pendant cette étape
1. **Table pivot introuvable** : pour `belongsToMany`, Laravel devine le nom de la table pivot par ordre alphabétique (`hair_type_product`), alors que notre schéma l'appelle `product_hair_type`. Le nom est désormais indiqué explicitement.
2. **Lecture d'un paramètre JSON sans conversion** : `->value('value')` contourne les *casts* du modèle. Remplacé par `->first()?->value`.
3. **Messages de validation bruts** (`validation.integer`) : ajout de `lang/fr/validation.php` et `lang/fr.json`.
4. **Arrêt brutal de PHP pendant les tests** : un trait écrit dans `Concerns.php` au lieu de `NormalizesPhones.php`. L'autoload PSR-4 exige **un fichier par classe, au même nom**. L'erreur n'est apparue que dans les tests, parce que le premier test à charger ce trait était celui du profil.
5. **`/auth/me` répondait 201** juste après une inscription : Laravel répond automatiquement « 201 Created » quand le modèle vient d'être créé dans le même cycle. Statut 200 forcé.
6. **Commande en erreur 500** : après `create()`, les valeurs `DEFAULT` de MySQL (`payment_status`) ne sont pas relues dans l'objet PHP. Elles sont maintenant renseignées explicitement.
7. **Réservation d'un visiteur refusée (419)** une fois le frontend branché : sans connexion préalable, le cookie CSRF n'existait pas. Corrigé avec les intercepteurs axios.
8. **Un test supposait des identifiants de produits** propres au faux serveur : il demande maintenant l'identifiant à l'API.

## 5. Décisions
| Décision | Raison |
|---|---|
| Laravel 13 (version actuelle) | Laravel publie une version majeure par an avec peu de changements cassants ; la 12 ne reçoit plus de correctifs de sécurité après début 2027 |
| PHPUnit (fourni par Laravel) plutôt que Pest | Aucune dépendance supplémentaire ; même expressivité pour nos besoins |
| Tests sur MySQL (`salon_test`) et non SQLite | Le schéma utilise des fonctions propres à MySQL (CHECK, colonnes générées, FULLTEXT) : on teste sur le même moteur que la production |
| Laravel Boost non installé | Outil destiné aux assistants de code, non nécessaire au projet |
| Table `activity_log` créée à l'étape 7 | Elle vient du paquet `spatie/laravel-activitylog`, installé avec l'ERP |
