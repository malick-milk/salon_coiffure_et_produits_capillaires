# ÉTAPE 9 — Les tests : prouver que tout fonctionne, et le rester

> **Statut** : terminée.
> **En chiffres** : 252 vérifications automatiques, rejouées par GitHub à chaque `git push`.
>
> | Famille | Nombre | Outil |
> |---|---:|---|
> | Tests backend | 106 (17 unitaires + 89 fonctionnels) | PHPUnit |
> | Tests frontend | 56 | Vitest + Testing Library |
> | Parcours dans un vrai navigateur | 80 (24 vitrine + 27 compte + 29 ERP) | Playwright |
> | Concurrence et charge | 10 | script Node, serveur PHP multi-processus |
>
> **Couverture du backend** : 95,8 % des lignes (92,1 % au début de l'étape). L'intégration continue refuse toute baisse sous 90 %.

---

## 1. Pourquoi plusieurs familles de tests : la pyramide

```
                 ▲  lents, réalistes, peu nombreux
        ┌────────────────┐
        │  Concurrence   │  10   30 clientes cliquent en même temps
        ├────────────────┤
        │   Parcours     │  80   un robot utilise le site comme une cliente
        │   navigateur   │
        ├────────────────┤
        │ Fonctionnels   │  89   une vraie requête HTTP sur l'API, une vraie base
        ├────────────────┤
        │  Unitaires     │  73   une fonction seule, en millisecondes
        └────────────────┘
                 ▼  rapides, précis, nombreux
```

| Famille | Ce qu'elle prouve | Ce qu'elle ne voit pas |
|---|---|---|
| **Unitaire** | Une règle isolée est juste (calcul d'un créneau, format d'un prix, machine à états) | Si les morceaux fonctionnent **ensemble** |
| **Fonctionnel** | L'API répond correctement, avec ses permissions, sa validation, sa base | L'écran, et ce qui se passe quand plusieurs requêtes arrivent **en même temps** |
| **Parcours (e2e)** | Une cliente peut vraiment réserver, commander, se connecter ; l'ERP fonctionne | La cause précise d'une panne (le test dit « ça ne marche pas », pas « pourquoi ») |
| **Concurrence** | Les verrous de la base tiennent sous des requêtes simultanées | Les performances de la production (le serveur de test n'est pas celui de la production) |

Une erreur se corrige d'autant plus vite qu'elle est attrapée **bas** dans la pyramide. Un test unitaire désigne la ligne fautive, un parcours dit seulement « la page ne s'affiche pas ».

---

## 2. Lancer les tests

**Tout vérifier avant un `git push`**, depuis le dossier du projet (Git Bash), avec Docker lancé :

```bash
bash scripts/verifier-tout.sh
```

Le script lance le style, les tests, la qualité du code, les types et la construction, puis affiche un résumé `OK` ou `ÉCHEC` par contrôle. En cas d'échec, il recopie **la fin du message d'erreur** sous le résumé et enregistre tout dans `verification.log`. Avant les tests backend, il vérifie que la base `salon_test` est joignable et, sinon, indique la cause (MySQL arrêté, base absente, mauvais identifiants) et la commande qui corrige.

Les commandes une par une :

| Quoi | Dossier | Commande |
|---|---|---|
| Tests backend | `backend/` | `php artisan test` |
| … avec la couverture | `backend/` | `php artisan test --coverage` (il faut l'extension **pcov** ou **xdebug**) |
| Style du code PHP | `backend/` | `vendor/bin/pint --test` (et `vendor/bin/pint` pour corriger) |
| Qualité du code TypeScript | `frontend/` | `npm run lint` |
| Types TypeScript | `frontend/` | `npm run typecheck` |
| Tests frontend | `frontend/` | `npm run test:run` |
| … avec la couverture | `frontend/` | `npm run test:coverage`, rapport détaillé dans `frontend/coverage/index.html` |
| Parcours navigateur | racine | `node frontend/e2e/parcours-vitrine.cjs ./captures` (puis `parcours-compte`, `parcours-admin`). Base remise à zéro avant **chaque** parcours |
| Concurrence | `backend/` | voir §5 |

---

## 3. La couverture : utile, mais à bien lire

La **couverture** mesure la part du code exécutée pendant les tests. Elle dit ce qui n'est **pas** testé ; elle ne prouve pas que ce qui est exécuté est **bien** vérifié. Un test qui appelle une fonction sans rien vérifier fait monter la couverture sans rien prouver.

| | Couverture des lignes | Lecture |
|---|---:|---|
| Backend | **95,8 %** | Les lignes restantes sont surtout des relations d'une ligne dans les modèles (`hasMany`), peu utiles à tester |
| Frontend | 15 % | Normal : les **pages** sont testées par les parcours navigateur (80 vérifications), pas par Vitest. La **logique** est à 100 % (`format.ts`, `orders.ts`, `availability.ts`, `http.ts`, schémas de formulaires) |

La méthode suivie : partir du rapport, repérer le code **important** non testé, puis écrire un test qui vérifie un **comportement**, pas une ligne. Les manques trouvés ainsi :
- les listes de l'ERP (produits avec coût de revient, grand livre, lots), jamais appelées par un test ;
- une perte supérieure au stock (le cas d'erreur) ;
- les commandes `app:create-admin` et `analytics:snapshot` (0 %) ;
- la protection CSRF du frontend (`http.ts` à 38 %) et les permissions de l'interface (0 %).

---

## 4. Les nouveaux tests, et ce qu'ils ont trouvé

| Fichier | Ce qu'il vérifie |
|---|---|
| `backend/tests/Feature/AdminCatalogTest.php` | Coût de revient visible du personnel, grand livre, perte refusée si le stock manque, ajustements, lots, prix barré |
| `backend/tests/Feature/ConsoleCommandsTest.php` | Création du compte propriétaire (mot de passe haché, email en minuscules), agrégats en ligne de commande |
| `backend/tests/Feature/RateLimitTest.php` | La 21ᵉ réservation ou commande d'une même adresse en une heure est bloquée (429) |
| `backend/tests/Feature/TranslationCoverageTest.php` | **Garde-fou** : chaque règle de validation et chaque champ du code a un texte français |
| `frontend/src/lib/http.test.ts` | Jeton CSRF demandé avant un POST ; après un 419, un seul rejeu (jamais de boucle) ; messages d'erreur sans détail technique |
| `frontend/src/features/auth/permissions.test.ts` | On vérifie une permission, jamais un nom de rôle |
| `frontend/src/features/home/pages/HomePage.test.tsx` | Le hero lit bien `src/content/home.ts` (textes, photo, priorité de chargement) |

**Ce que ces tests ont révélé** (tout est corrigé) :

1. **Prix barré impossible à saisir seul.** La règle `gt:price` comparait au champ `price` *de la requête*, absent quand on ne change que le prix barré. Un prix barré de 3 500 F était donc refusé pour un produit à 3 000 F. La comparaison se fait maintenant avec le prix final : celui envoyé, sinon le prix actuel.
2. **Messages d'erreur affichés en clé brute.** Quatre règles n'avaient pas de traduction : `before_or_equal`, `gt`, `after` et `not_in`. L'utilisateur aurait vu `validation.gt.numeric`. Le garde-fou en a ensuite trouvé **23 champs** affichés en anglais (« Batch number est obligatoire »). Tout est traduit, et le test échouera si quelqu'un ajoute une règle ou un champ sans traduction.
3. **Les parcours navigateur ne signalaient pas leurs échecs.** Ils affichaient `FAIL`, mais se terminaient « avec succès » (code 0). En intégration continue, une page cassée serait passée inaperçue. Chaque échec est maintenant compté et fait échouer le script.
4. **La limite anti-spam des réservations n'avait jamais été testée** : seule celle de la connexion l'était.

> **Leçon** : écrire un test, c'est relire le code avec un regard d'utilisateur exigeant. La moitié des défauts trouvés ici ne venaient pas du test lui-même, mais de la réflexion qu'il a obligé à faire.

---

## 5. Le test de concurrence : 30 clientes à la même seconde

`backend/tests/charge/concurrence.mjs`

**Le problème qu'il vise.** Deux clientes veulent le dernier masque au même instant. Sans précaution, les deux lisent « stock = 1 », les deux achètent, et le stock passe à −1 : c'est une **condition de course** (*race condition*). Le projet s'en protège avec des **verrous** (`lockForUpdate` : « attends que l'autre ait fini ») et un **index unique** (deux rendez-vous actifs pour la même coiffeuse au même moment sont impossibles). Mais les tests PHPUnit envoient les requêtes **l'une après l'autre** : ils ne peuvent pas prouver que ces verrous tiennent.

**Les scénarios** :

| | Situation | Résultat attendu | Obtenu |
|---|---|---|---|
| A | 30 réservations simultanées du même créneau, même coiffeuse | 1 acceptée, 29 refusées (409) | 1 / 29 |
| B | 40 commandes simultanées, 24 masques en stock | 24 acceptées, 16 refusées | 24 / 16 |
| C | Cohérence après la course | références uniques, stock final 0, soldes 23, 22… 0 | conforme |
| D | 300 lectures du catalogue, 30 en parallèle | 0 erreur | 0 erreur, environ 115 requêtes/s |

**Lancer le test** (Linux ou macOS ; sous Windows, le serveur PHP n'a qu'un processus et les requêtes passent l'une après l'autre) :

```bash
cd backend && php artisan migrate:fresh --seed
```

```bash
cd public && PHP_CLI_SERVER_WORKERS=8 API_RATE_LIMIT=100000 CHECKOUT_RATE_LIMIT=100000 php -S 127.0.0.1:8001 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php
```

Puis, dans une autre fenêtre, depuis `backend/` :

```bash
node tests/charge/concurrence.mjs
```

Les limites anti-abus sont relevées **pour ce serveur local uniquement**, car toutes les requêtes viennent de la même adresse. En production, elles gardent leurs valeurs par défaut, et `RateLimitTest` le vérifie.

**Le test teste-t-il vraiment quelque chose ? Le test de mutation.** Pour le savoir, on a **retiré volontairement les verrous** du code, puis relancé le test :

```
FAIL B. 40 commandes simultanées pour 24 masques : 19 acceptées, 0 refusées
FAIL C. Stock final du masque : 13 (attendu 0)
```

19 masques vendus, mais le stock n'a baissé que de 11 : **8 ventes « perdues »**. Deux transactions avaient lu le même stock et écrit chacune leur résultat, en écrasant celui de l'autre (*lost update*). Les 21 autres clientes avaient reçu une erreur serveur. Avec les verrous, tout est juste. Un test qui échoue quand on casse le code est un test **utile**.

---

## 6. Les outils de qualité du code (analyse statique)

Ils lisent le code **sans l'exécuter**.

| Outil | Langage | Ce qu'il attrape | Commande |
|---|---|---|---|
| **TypeScript** (mode strict) | TS | Mauvais type, propriété inexistante, valeur peut-être `undefined` | `npm run typecheck` |
| **ESLint** (nouveau) | TS | Règles des hooks React, variables inutilisées, **accessibilité** (image sans texte, label orphelin) | `npm run lint` |
| **Pint** | PHP | Style homogène (indentation, ordre des `use`…) | `vendor/bin/pint --test` |

ESLint a trouvé deux espaces insécables **invisibles** tapés directement dans le code (`format.ts`) : ils sont désormais écrits ` `, ce qui les rend visibles. Les 12 avertissements restants (« Fast refresh ») ne concernent que le rechargement à chaud en développement.

**À ajouter sur votre ordinateur** : **Larastan**, l'équivalent de TypeScript pour PHP. Il n'a pas pu être installé depuis l'environnement de développement (téléchargement GitHub refusé). Depuis `backend/` :

```bash
composer require --dev larastan/larastan
```

---

## 7. L'intégration continue (GitHub Actions)

`.github/workflows/ci.yml`. À chaque `git push` sur `main`, GitHub lance trois tâches sur ses serveurs :

```
backend  (style + 106 tests + couverture ≥ 90 %) ─┐
                                                  ├─► e2e (3 parcours + concurrence)
frontend (ESLint + types + 56 tests + build) ─────┘   ← sur Node 22 ET la dernière version de Node
```

- **Où voir le résultat** : onglet **Actions** du dépôt sur GitHub. Une coche verte ✓ ou une croix rouge ✗ apparaît aussi à côté de chaque commit.
- **En cas d'échec** : cliquez sur la tâche rouge, puis sur l'étape rouge : le message d'erreur complet y est. Pour les parcours, les **captures d'écran** et les journaux sont téléchargeables en bas de la page (« Artifacts »).
- **Pourquoi c'est important** : « ça marche sur ma machine » ne suffit plus. Chaque modification est vérifiée sur une machine neuve, avec une base neuve, exactement comme le sera la production.

Les anciens fichiers `backend/.github/workflows/` ont été supprimés. C'étaient ceux du framework Laravel lui-même ; GitHub ne lit que le dossier `.github/` à la **racine** du dépôt, et ils ne s'exécutaient donc jamais.

---

## 8. Recette : écrire un test

1. **Partir d'une règle métier**, pas du code : « une perte supérieure au stock est refusée et n'écrit rien ».
2. **Préparer** l'état (*Arrange*) : la base de démonstration est rechargée avant chaque test.
3. **Agir** (*Act*) : une requête, un appel.
4. **Vérifier** (*Assert*) la réponse **et** l'effet : le code 409, le stock inchangé, aucun mouvement écrit.
5. **Le voir échouer une fois** : cassez volontairement le code pour vérifier que le test le remarque, puis remettez le code.

Exemple, dans `AdminCatalogTest.php` :

```php
public function test_une_perte_superieure_au_stock_est_refusee_sans_rien_ecrire(): void
{
    $this->actingAs(User::where('email', 'admin@dabohair.test')->first());        // Arrange
    $masque = $this->sku('DAB-MAS-001');
    $movements = $masque->stockMovements()->count();

    $this->postJson("/api/v1/admin/products/{$masque->id}/stock-adjustments",       // Act
        ['type' => 'loss', 'quantity' => 30, 'reason' => 'Inventaire'])
        ->assertStatus(409)->assertJsonPath('items.0.available', 24);                // Assert : la réponse

    $this->assertSame(24, $masque->fresh()->stock_quantity);                         // … et l'effet
    $this->assertSame($movements, $masque->stockMovements()->count());
}
```

Nommez le test comme une phrase : en cas d'échec, son nom dit déjà ce qui ne va plus.

---

## 9. Bug rencontré après l'étape : Node 25 et `localStorage`

**Symptôme** (sur l'ordinateur de développement, pas sur GitHub) : 8 tests du panier en échec, `Cannot read properties of undefined (reading 'setItem')`.

**Cause** : Node 25 et les versions suivantes ont leur **propre** `localStorage` global. Sans l'option `--localstorage-file`, il est inutilisable, et dans Vitest il masque celui du navigateur simulé (jsdom). Le panier, qui se mémorise dans `localStorage`, ne pouvait plus écrire. GitHub utilisait Node 22, d'où « ça marche chez lui, pas chez moi ».

**Correction** : `frontend/src/test/setup.ts` installe un stockage en mémoire quand celui fourni est inutilisable. L'application elle-même n'était pas touchée : dans un vrai navigateur, `localStorage` fonctionne. Et l'intégration continue teste désormais **deux** versions de Node (22 et la plus récente), pour qu'une différence de ce genre soit attrapée par GitHub, avant d'atteindre un poste de travail.

**Leçon** : quand un test passe à un endroit et échoue à un autre, comparez d'abord les **versions** (`node -v`, `php -v`) avant de soupçonner le code.
