# ÉTAPE 6 — Développement du backend Laravel

> **Statut** :
> - **Partie 1 terminée** : installation, migrations, modèles, seeders, API publique du catalogue et du salon, disponibilités.
> - **Partie 2 (à venir)** : création de réservation, authentification Sanctum, commandes, espace client, puis branchement du frontend sur la vraie API.
>
> **Vérification** : 26 tests (115 vérifications) sur une base MySQL dédiée.

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

### 1.5 Lancer les tests
Les tests utilisent une base **séparée**, `salon_test`, qu'il faut créer une fois :

```bash
docker exec salon-mysql mysql -uroot -proot_dev_password -e "CREATE DATABASE IF NOT EXISTS salon_test; GRANT ALL ON salon_test.* TO 'salon'@'%';"
```

```bash
php artisan test
```

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

## 3. Bugs trouvés pendant cette partie
1. **Table pivot introuvable** : pour `belongsToMany`, Laravel devine le nom de la table pivot par ordre alphabétique (`hair_type_product`), alors que notre schéma l'appelle `product_hair_type`. Le nom est désormais indiqué explicitement.
2. **Lecture d'un paramètre JSON sans conversion** : `->value('value')` contourne les *casts* du modèle. Remplacé par `->first()?->value`.
3. **Messages de validation bruts** (`validation.integer`) : ajout de `lang/fr/validation.php` et `lang/fr.json`.

## 4. Décisions
| Décision | Raison |
|---|---|
| Laravel 13 (version actuelle) | Laravel publie une version majeure par an avec peu de changements cassants ; la 12 ne reçoit plus de correctifs de sécurité après début 2027 |
| PHPUnit (fourni par Laravel) plutôt que Pest | Aucune dépendance supplémentaire ; même expressivité pour nos besoins |
| Tests sur MySQL (`salon_test`) et non SQLite | Le schéma utilise des fonctions propres à MySQL (CHECK, colonnes générées, FULLTEXT) : on teste sur le même moteur que la production |
| Laravel Boost non installé | Outil destiné aux assistants de code, non nécessaire au projet |
| Table `activity_log` créée à l'étape 7 | Elle vient du paquet `spatie/laravel-activitylog`, installé avec l'ERP |
