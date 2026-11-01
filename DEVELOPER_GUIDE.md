# Guide du développeur

> Statut : conventions posées à l'étape 2. L'installation détaillée sera complétée aux étapes 5 et 6.

## 1. Prérequis
| Outil | Version minimale | Rôle |
|---|---|---|
| PHP | 8.3 | Exécuter Laravel |
| Composer | 2.x | Gestionnaire de paquets PHP |
| Node.js | 20 LTS ou plus | Outillage frontend (Vite) |
| npm | 10 | Gestionnaire de paquets JS |
| Docker + Docker Compose | récent | MySQL 8, Redis, Mailpit |
| Git | 2.x | Versionnement |

## 2. Installation locale

### 2.1 Services (MySQL, Redis, Mailpit)
```bash
docker compose up -d
```
| Service | Adresse | Rôle |
|---|---|---|
| MySQL 8.4 | `127.0.0.1:3307` (base `salon`, utilisateur `salon`) | Base de données. Port 3307 pour ne pas gêner le MySQL de XAMPP (3306) |
| Redis | `127.0.0.1:6379` | Cache et files d'attente |
| Mailpit | http://localhost:8025 | Voir les emails envoyés en développement |

Les ports sont exposés uniquement sur `127.0.0.1` : personne sur le réseau local ne peut atteindre votre base.

### 2.2 Vérifier le modèle de données
```bash
bash database/verify.sh
```
Le script utilise une base séparée `salon_verify`, recréée à chaque lancement. Il ne touche jamais la base `salon`.

### 2.3 Frontend (React)
```bash
cd frontend
```

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```
Puis http://localhost:5173. Avec `VITE_ENABLE_MOCKS=true`, le faux serveur MSW répond à la place de l'API : aucun backend n'est nécessaire. Détails et explications : [docs/05_FRONTEND.md](docs/05_FRONTEND.md).

### 2.4 Backend (Laravel 13, PHP 8.3+)
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

```bash
php artisan serve
```
L'API répond sur http://localhost:8000/api/v1. Installation de PHP 8.3 sous Windows et explications : [docs/06_BACKEND.md](docs/06_BACKEND.md).

## 3. Structure des dossiers
Voir [ARCHITECTURE.md §3.2 (backend)](ARCHITECTURE.md) et [§4.3 (frontend)](ARCHITECTURE.md).

Fichiers de configuration à la racine :
- `.gitignore` : ce que Git ne doit jamais versionner (secrets `.env`, `node_modules`, `vendor`).
- `.editorconfig` : indentation et encodage identiques dans tous les éditeurs.
- `.gitattributes` : fins de ligne normalisées (LF), fichiers binaires déclarés.

## 4. Conventions de code et de nommage

### Langue
- **Code** (variables, classes, tables, routes) : **anglais**, le standard de l'industrie, compatible avec la documentation Laravel et React.
- **Documentation, commentaires métier, textes de l'interface** : **français**.

### Backend (PHP / Laravel)
| Élément | Convention | Exemple |
|---|---|---|
| Classe | PascalCase | `PlaceOrderAction` |
| Méthode / variable | camelCase | `calculateTotal()`, `$unitPrice` |
| Table | snake_case, pluriel | `order_items` |
| Colonne | snake_case | `cost_price`, `created_at` |
| Clé étrangère | `<singulier>_id` | `product_id` |
| Route API | kebab-case, pluriel | `/api/v1/stock-movements` |
| Enum | PascalCase, cas en snake_case | `OrderStatus::Pending` → `'pending'` |
- Formatage automatique : `./vendor/bin/pint`
- Analyse statique : `./vendor/bin/phpstan analyse`

### Frontend (TypeScript / React)
| Élément | Convention | Exemple |
|---|---|---|
| Composant | PascalCase, fichier `.tsx` | `ProductCard.tsx` |
| Hook | `use` + camelCase | `useProducts()` |
| Fichier utilitaire | camelCase | `format.ts` |
| Type | PascalCase | `type Order = {...}` |

### Règles d'or
1. Un contrôleur ne contient **pas** de logique métier (voir ARCHITECTURE.md §3.1).
2. Le stock ne se modifie **que** via `StockService`.
3. Tout montant est un **entier en XOF**. Jamais de `float` pour l'argent (erreurs d'arrondi : `0.1 + 0.2 ≠ 0.3`).
4. On vérifie des **permissions**, jamais des noms de rôles.
5. Aucune donnée sensible (`cost_price`, `password`) dans une API Resource publique.
6. Aucun emoji, ni dans l'interface ni dans les messages de commit.

## 5. Workflow Git
- `main` : version stable, déployable.
- `feature/<nom>` : une branche par fonctionnalité, fusionnée par Pull Request.
- Messages de commit (convention *Conventional Commits*) :
  - `feat: ajout du calcul des créneaux`
  - `fix: stock négatif lors d'une annulation`
  - `docs: mise à jour DATABASE.md`
  - `test: ...`, `refactor: ...`, `chore: ...`

## 6. Lancer les tests
| Partie | Commande | Contenu |
|---|---|---|
| Base de données | `bash database/verify.sh` | 25 tests d'intégrité + 17 requêtes KPI |
| Backend | `cd backend && php artisan test` | 66 tests sur MySQL `salon_test` (PHPUnit) |
| Frontend | `cd frontend && npm run test:run` | 40 tests unitaires (Vitest) |
| Parcours navigateur | `node frontend/e2e/parcours-vitrine.cjs ./captures` puis `parcours-compte.cjs` | 24 + 27 vérifications (Playwright) |

La suite complète (backend, CI) sera mise en place à l'étape 9.

## 7. Ajouter une fonctionnalité pas à pas (recette type)
1. Écrire la règle de gestion dans `docs/01_ANALYSE_DU_BESOIN.md`.
2. Migration (si nouvelle table / colonne) → mettre à jour `DATABASE.md`.
3. Model + Enum + Policy.
4. FormRequest (validation) → Action / Service (logique) → Controller → Resource → Route.
5. Test Feature (Pest).
6. Côté React : `features/<module>/api.ts` → hook TanStack Query → composants → page → route.
7. Mettre à jour `API_DOCUMENTATION.md`.
