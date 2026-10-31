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
_À compléter aux étapes 5 et 6._

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
_À compléter à l'étape 9._

## 7. Ajouter une fonctionnalité pas à pas (recette type)
1. Écrire la règle de gestion dans `docs/01_ANALYSE_DU_BESOIN.md`.
2. Migration (si nouvelle table / colonne) → mettre à jour `DATABASE.md`.
3. Model + Enum + Policy.
4. FormRequest (validation) → Action / Service (logique) → Controller → Resource → Route.
5. Test Feature (Pest).
6. Côté React : `features/<module>/api.ts` → hook TanStack Query → composants → page → route.
7. Mettre à jour `API_DOCUMENTATION.md`.
