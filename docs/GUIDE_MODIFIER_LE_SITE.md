# Guide : modifier le site soi-même, et savoir s'il y a des erreurs

> Pour qui : la personne qui maintient le site sans l'avoir écrit. Aucune connaissance préalable du code n'est supposée.
> Prérequis : le projet ouvert dans **VS Code** (Fichier → Ouvrir le dossier → `salon_coiffure_et_produits_capillaires`).

---

## 1. La règle qui répond à presque tout : code ou base de données ?

Une information du site vient de **deux endroits possibles** :

| Si l'information… | Elle est dans… | On la modifie… |
|---|---|---|
| change souvent, ou chaque jour (prix, stock, commandes, rendez-vous) | la **base de données** (MySQL) | dans l'**ERP** (`/admin`), sans toucher au code |
| est fixe et fait partie de la page (titres, phrases, photos, couleurs, mise en page) | le **code** (fichiers du dossier `frontend/`) | dans un fichier, avec VS Code |

Exemples : le prix du sérum se change dans l'ERP. Le titre « L'art du soin capillaire » se change dans un fichier.

---

## 2. La carte : « je veux changer… → où ? »

### 2.1 Les textes et photos des pages (code)
| Je veux changer… | Fichier |
|---|---|
| **Le hero** (titre, phrase, boutons, photo), les 4 engagements, la bannière promo | `frontend/src/content/home.ts`, le fichier prévu pour ça (§3) |
| Les photos elles-mêmes | les déposer dans `frontend/public/images/` |
| Le reste de la page d'accueil (sections produits, prestations, horaires) | `frontend/src/features/home/pages/HomePage.tsx` |
| Le menu du haut, le bandeau doré, le pied de page | `frontend/src/app/layouts/PublicLayout.tsx` |
| Le logo (provisoire) | `frontend/src/components/common/Placeholder.tsx`, fonction `Logo` |
| Les couleurs de la marque | `frontend/src/index.css`, bloc `@theme` |
| Le titre de l'onglet et la description Google d'une page | la balise `<Seo title=… description=…>` en haut de chaque page |
| Une page de la boutique | `frontend/src/features/catalog/pages/` |
| La page de réservation | `frontend/src/features/booking/pages/BookingPage.tsx` |
| Le panier, la commande | `frontend/src/features/cart/` et `frontend/src/features/checkout/` |
| Les écrans de l'ERP | `frontend/src/features/admin/pages/` |
| Les adresses des pages (URL) | `frontend/src/app/router.tsx` |
| Les messages d'erreur des formulaires (côté serveur) | `backend/lang/fr/validation.php` |
| La facture PDF | `backend/resources/views/pdf/invoice.blade.php` |

**Logique des dossiers** : `frontend/src/features/<domaine>/` regroupe tout ce qui concerne un domaine du métier (boutique = `catalog`, réservation = `booking`, compte client = `account`, ERP = `admin`). Dans chaque domaine, `pages/` contient les pages et `components/` leurs morceaux.

### 2.2 Les données (base de données)
| Je veux changer… | Où |
|---|---|
| Prix, activation d'un produit, stock | ERP → **Produits et stock** |
| Coût de revient (marge) | ERP → **Fabrication** (saisir un lot avec ses coûts) |
| Statut d'une commande, d'un rendez-vous | ERP → **Commandes**, **Planning** |
| Comptes du personnel | ERP → **Équipe et rôles** |
| Nom ou description d'un produit, nouveau produit | pas encore d'écran : `backend/database/seeders/DaboHairCatalogSeeder.php` |
| Prestations du salon et leurs prix, coiffeuses, horaires, zones et frais de livraison | pas encore d'écran : `backend/database/seeders/ReferenceDataSeeder.php` |

Après une modification d'un fichier **seeder**, appliquez-la sans effacer les commandes, depuis `backend/` :

```bash
php artisan db:seed --class=ReferenceDataSeeder
```

(`updateOrCreate` met à jour ce qui existe au lieu de créer des doublons.)

> Les écrans ERP manquants (prestations, horaires, fiche produit complète) sont une bonne idée d'amélioration : dites-le-moi si vous les voulez.

---

## 3. Exemple complet : mettre la vraie photo du hero

1. **Préparez la photo** : verticale (environ 1200 × 1400 px), au format `.webp` ou `.jpg`, moins de 300 Ko. Pour réduire une photo, l'outil gratuit https://squoosh.app fonctionne dans le navigateur.
2. **Nommez-la simplement**, sans espace ni accent : `hero.webp`.
3. **Déposez-la** dans `frontend/public/images/`.
4. **Ouvrez** `frontend/src/content/home.ts` et remplacez la ligne :
   ```ts
   image: null as string | null,
   ```
   par :
   ```ts
   image: '/images/hero.webp' as string | null,
   ```
   Le chemin commence par `/images/` : tout ce qui est dans `public/` est servi à la racine du site.
5. **Adaptez la description** `imageAlt`. Elle est lue aux personnes malvoyantes et sert au référencement Google.
6. **Enregistrez** avec Ctrl + S. Si `npm run dev` tourne, la page se met à jour toute seule.

Pour **changer un texte** du hero, c'est le même fichier : modifiez le texte entre apostrophes, puis enregistrez.

**Le piège n° 1 : l'apostrophe.** Ce texte casse la page :
```ts
title: 'L'art du soin',        // l'apostrophe ferme le texte après « L »
```
Ces deux versions fonctionnent :
```ts
title: 'L’art du soin',        // apostrophe typographique ’ (la plus jolie)
title: "L'art du soin",        // ou des guillemets doubles autour du texte
```

---

## 4. Trouver n'importe quel fichier en 10 secondes

La carte ne peut pas tout lister. La méthode suivante, elle, marche pour **tout ce qui est visible à l'écran**.

1. **Repérez un texte unique** à l'endroit à modifier, par exemple « Produits phares ».
2. Dans VS Code : **Ctrl + Maj + F** (recherche dans tous les fichiers), tapez ce texte.
3. Le résultat indique le fichier **et** la ligne : cliquez dessus.

D'autres raccourcis utiles :

| Raccourci VS Code | Effet |
|---|---|
| Ctrl + P | Ouvrir un fichier en tapant une partie de son nom (`HomePage`) |
| Ctrl + clic sur un nom | Aller à l'endroit où ce composant ou cette fonction est défini |
| Ctrl + Z | Annuler la dernière modification |

**Pour un élément sans texte** (une image, une couleur) : dans le navigateur, faites un clic droit sur l'élément, puis **Inspecter**. Les classes affichées (`aspect-[6/7] rounded-3xl`…) se recherchent ensuite avec Ctrl + Maj + F.

---

## 5. Savoir s'il y a des erreurs

### 5.1 Pendant que vous modifiez (en direct)
| Où regarder | Ce qu'on y voit |
|---|---|
| **La page elle-même** | Vite affiche un cadre rouge avec le fichier et la ligne fautive, pour une erreur de syntaxe |
| **Le terminal de `npm run dev`** | Les mêmes erreurs, en texte |
| **VS Code** | Le mot fautif est souligné en rouge. Survolez-le pour lire l'explication. Onglet **Problèmes** : Ctrl + Maj + M |
| **La console du navigateur** (F12 → Console) | Les erreurs JavaScript (en rouge) et les appels à l'API qui échouent |
| **Le terminal de `php artisan serve`** | Chaque requête reçue par Laravel |
| **`backend/storage/logs/laravel.log`** | Le détail d'une erreur serveur (le dernier bloc est le plus récent) |

Pour lire les dernières lignes du journal Laravel, depuis `backend/` :

```bash
tail -n 40 storage/logs/laravel.log
```

### 5.2 Avant d'enregistrer dans Git (les vérifications automatiques)
Ce sont les « filets de sécurité » écrits pendant les étapes précédentes. Lancez-les après une modification.

Vérifier les types et construire le site, depuis `frontend/` (c'est la commande la plus importante) :

```bash
npm run build
```

Lancer les 44 tests du frontend :

```bash
npm run test:run
```

Lancer les 93 tests du backend, depuis `backend/` (Docker doit être lancé) :

```bash
php artisan test
```

Un résultat **vert / passed** signifie que rien de ce qui est testé n'est cassé. Un **rouge** donne le nom du test, ce qui était attendu et ce qui a été obtenu.

**Lire une erreur TypeScript** :
```
src/features/home/pages/HomePage.tsx(72,18): error TS2786: 'Icon' cannot be used as a JSX component.
```
- `HomePage.tsx(72,18)` : le fichier, ligne 72, colonne 18 ;
- `TS2786` : le code de l'erreur (à copier dans un moteur de recherche si besoin) ;
- la phrase : ce qui ne va pas.

C'est une vraie erreur rencontrée en écrivant ce guide : TypeScript a signalé qu'une icône pouvait être absente si l'on ajoutait un 5ᵉ engagement. Elle a été corrigée avant même que la page ne s'ouvre.

---

## 6. Git : le bouton « annuler » de tout le projet

Avant une modification risquée, sachez où vous en êtes. Voir les fichiers modifiés :

```bash
git status
```

Voir ligne par ligne ce qui a changé (`-` en rouge : supprimé ; `+` en vert : ajouté ; touche `q` pour quitter) :

```bash
git diff
```

**Tout annuler** dans un fichier, pour revenir à la dernière version enregistrée dans Git :

```bash
git restore frontend/src/content/home.ts
```

Enregistrer une modification qui fonctionne :

```bash
git add -A
```

```bash
git commit -m "Accueil : vraie photo du hero"
```

```bash
git push
```

**Bonne habitude** : une modification = un commit. En cas de problème, on sait exactement quelle modification l'a causé, et on peut revenir en arrière.

---

## 7. Demander de l'aide efficacement

Pour que je puisse corriger vite, envoyez :

1. **ce que vous avez fait** (« j'ai changé le titre dans `home.ts` ») ;
2. **ce que vous attendiez** et **ce qui se passe** ;
3. **le message d'erreur complet**, copié depuis le terminal, la console F12 ou le cadre rouge de la page ;
4. si possible, le résultat de `git diff`.
