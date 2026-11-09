# ÉTAPE 5 — Développement du frontend

> **Statut** : terminée.
> - **Partie 1** : vitrine, catalogue, fiche produit, panier, réservation.
> - **Partie 2** : connexion, inscription, espace client, validation de commande.
>
> **Vérification** : TypeScript strict sans erreur, 40 tests unitaires, 51 vérifications de parcours dans un vrai navigateur (24 pour la vitrine, 27 pour le compte et la commande).

---

## 1. Ce qui a été construit

| Page | URL | Ce qu'on peut faire |
|---|---|---|
| Accueil | `/` | Hero, engagements, produits phares, prestations, horaires |
| Boutique | `/boutique` | Filtrer par catégorie et par prix, « en stock », rechercher (sans tenir compte des accents), trier, paginer |
| Fiche produit | `/produits/:slug` | Choisir la contenance (30 ml / 15 ml), la quantité, ajouter au panier |
| Panier | `/panier` | Modifier les quantités, retirer un article, sous-total. Le panier est conservé après rechargement |
| Réserver | `/reserver` | Tunnel en 5 étapes, créneaux réellement disponibles, formulaire validé, code de réservation |
| 404 | toute autre URL | Message clair et liens de retour |

Le catalogue est le **vrai catalogue Dabo Hair** (9 références, prix de vente réels).

---

## 2. Lancer le frontend

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

Ouvrez ensuite http://localhost:5173. Autres commandes utiles :

| Commande | Rôle |
|---|---|
| `npm run test:run` | Lance les 28 tests unitaires une fois |
| `npm test` | Relance les tests à chaque modification (mode surveillance) |
| `npm run typecheck` | Vérifie les types TypeScript |
| `npm run build` | Construit la version de production dans `dist/` |

---

## 3. Les concepts, expliqués

### 3.1 React : des composants
Une page est un **assemblage de composants**. Un composant est une fonction qui reçoit des données (les *props*) et renvoie de l'interface :

```tsx
export function ProductCard({ product }: { product: ProductSummary }) {
  return <article>… {formatPrice(product.price)} …</article>
}
```

`ProductCard` sert à trois endroits (accueil, boutique, produits associés). On la corrige **une seule fois** : c'est le principe **DRY** (*Don't Repeat Yourself*).

### 3.2 TypeScript : le contrat des données
`src/types/api.ts` décrit **exactement** le JSON que renverra l'API Laravel. Si l'on écrit `product.prix` au lieu de `product.price`, l'éditeur le signale **avant** l'exécution.

Ces types ont été écrits **avant** le backend : c'est l'approche **« contrat d'abord »**. L'étape 6 devra produire ce JSON.

### 3.3 Les quatre types d'état (ARCHITECTURE.md §4.2), appliqués
| État | Exemple dans le code | Outil |
|---|---|---|
| Données du serveur | Liste des produits | `useProducts()` → TanStack Query |
| État global du navigateur | Panier | `useCart()` → Zustand + `localStorage` |
| Formulaire | Coordonnées de réservation | React Hook Form + Zod |
| URL | Filtres du catalogue | `useSearchParams()` |

**Pourquoi les filtres dans l'URL ?** Un lien comme `/boutique?category=serums&sort=price_asc` se partage sur WhatsApp. Le bouton « Retour » du navigateur fonctionne. Un rechargement ne perd rien.

### 3.4 TanStack Query : gérer les données du serveur
```tsx
const products = useProducts({ category: 'serums' })
if (products.isPending) return <Skeleton />          // chargement
if (products.isError) return <QueryError … />        // erreur + bouton « Réessayer »
return products.data.data.map(p => <ProductCard … />)  // données
```

Chaque appel a **trois états** à afficher : chargement, erreur, données. On ne laisse jamais un écran vide sans explication.

Deux réglages expliqués :
- **cache de 60 s** : revenir sur une page déjà vue est instantané ;
- **nouvelles tentatives** uniquement pour les erreurs passagères (réseau coupé, erreur 5xx). Une 404 ne sera pas « réparée » par une nouvelle tentative.

### 3.5 MSW : développer sans attendre le backend
**Mock Service Worker** intercepte les requêtes du navigateur et répond **à la place de Laravel**. Le code React appelle les **vraies URL** (`/api/v1/products`). À l'étape 6, on passe `VITE_ENABLE_MOCKS=false`, et rien d'autre ne change.

Le faux serveur applique aussi les règles « serveur » : validation (erreur 422), conflit de créneau (erreur 409), produit introuvable (erreur 404). Le frontend sait déjà gérer ces cas.

### 3.6 Une fonction pure pour la règle la plus délicate
Le calcul des créneaux (`src/mocks/availability.ts`) est une **fonction pure** : mêmes entrées, même résultat, sans réseau ni horloge (« maintenant » est un paramètre). Elle est donc testable. Ses 11 tests constituent la **spécification** que le `AvailabilityService` PHP devra respecter à l'étape 6 :
- pause de midi ;
- fermeture à 19 h (20 h le samedi) ;
- dimanche fermé et fermetures exceptionnelles ;
- délai de 2 h et horizon de 60 jours ;
- chevauchement avec le battement de nettoyage ;
- affectation automatique d'un coiffeur pour « peu importe ».

### 3.7 Le tunnel de réservation : un *reducer*
Toutes les transitions du tunnel sont dans **une seule fonction** (`bookingReducer`). Par exemple :
- changer de prestation efface le coiffeur et l'heure ;
- un conflit 409 ramène au choix de l'heure.

Ces règles sont testées sans afficher la page.

### 3.8 Validation : deux niveaux
| Où | Outil | Rôle |
|---|---|---|
| Navigateur | Zod (`schema.ts`) | **Confort** : erreur immédiate sous le champ |
| Serveur | FormRequest Laravel (étape 6), aujourd'hui MSW | **Sécurité** : seule validation qui protège vraiment |

Si le serveur renvoie une erreur 422, chaque message s'affiche sous le bon champ.

### 3.9 Sécurité dans le frontend
- Le **prix du panier** sert à l'affichage. Le serveur recalcule tout à la commande (RG-COM-04).
- Le **stock exact** n'est jamais envoyé au navigateur : seulement « en stock », « plus que 4 » ou « rupture ».
- Les descriptions sont affichées comme **texte**, jamais comme HTML brut. Pas de `dangerouslySetInnerHTML`, donc pas de faille XSS.
- **Aucun secret** dans le frontend : tout ce qui est préfixé `VITE_` est lisible par n'importe qui.

### 3.10 Accessibilité, vérifiée par les tests
- Lien « Aller au contenu » pour la navigation au clavier.
- Libellés reliés aux champs ; erreurs annoncées (`role="alert"`, `aria-describedby`).
- `aria-pressed` sur les choix, `aria-current="step"` sur l'étape en cours.
- Boutons à icône seule avec `aria-label` (« Ajouter Sérum Activ'Pousse 30 ml au panier »).
- Animations désactivées si l'utilisateur l'a demandé dans son système.

### 3.11 Performance : le chargement à la demande
La page Réserver utilise zod et react-hook-form, deux bibliothèques lourdes. Avec `lazy` dans le routeur, leur code n'est téléchargé **que** lorsqu'on ouvre cette page.

| | Avant | Après |
|---|---|---|
| JavaScript téléchargé pour l'accueil (gzip) | 202 Ko | **~160 Ko** |
| Page Réserver | incluse | 44 Ko, à la demande |

Les bibliothèques sont aussi placées dans des fichiers à part (`react`, `data`). Elles restent en cache dans le navigateur d'une mise en ligne à l'autre.

---

## 4. Organisation des fichiers

```
frontend/
├── index.html               # page HTML unique, polices
├── vite.config.ts           # serveur de dev, alias @, proxy /api, découpage du build, tests
├── .env.example             # VITE_ENABLE_MOCKS
├── public/mockServiceWorker.js  # généré par MSW (ne pas modifier)
├── e2e/parcours-vitrine.cjs # parcours navigateur (24 vérifications) ; parcours-compte.cjs (27) ; parcours-admin.cjs (25, étape 7)
└── src/
    ├── main.tsx             # démarre MSW (si activé) puis React
    ├── index.css            # Tailwind v4 + tokens de la marque (@theme)
    ├── app/                 # App (providers), router, layouts, page d'erreur
    ├── components/
    │   ├── ui/              # button, badge, input, skeleton (style shadcn/ui)
    │   └── common/          # Seo, Logo, Placeholder, états (erreur, vide)
    ├── features/
    │   ├── home/            # page d'accueil
    │   ├── catalog/         # api.ts → hooks.ts → components/ → pages/
    │   ├── cart/            # store Zustand + page panier
    │   └── booking/         # api, hooks, schema (Zod), calendrier, étapes, page
    ├── lib/                 # http (axios), format (XOF, dates), utils (cn)
    ├── mocks/               # faux serveur : données, handlers, calcul des créneaux
    ├── pages/               # pages transverses (404)
    ├── types/api.ts         # CONTRAT de l'API
    └── test/setup.ts
```

**La recette d'une fonctionnalité**, toujours la même : `api.ts` (appels HTTP) → `hooks.ts` (TanStack Query) → `components/` → `pages/` → route dans `router.tsx` → tests.

---

## 5. Décisions prises pendant cette étape

| Décision | Raison |
|---|---|
| Versions majeures stables (Vite 7, React Router 7, MSW 2, Zod 4) plutôt que les toutes dernières | API connues et documentées ; on évite d'essuyer les plâtres d'une version majeure récente |
| Tailwind v4 configuré en CSS (`@theme`) | C'est la méthode officielle de la v4 : plus de `tailwind.config.ts` |
| Composants shadcn/ui écrits dans le projet | C'est le principe même de shadcn (on possède le code). La commande `npx shadcn add` reste utilisable pour en ajouter d'autres |
| `<title>` et `<meta>` natifs de React 19 | Plus besoin de `react-helmet-async` (ADR-009 simplifié) |
| JSON de l'API en `snake_case` (ADR-012) | Identique aux colonnes MySQL et à la convention Laravel : aucune traduction, moins de bugs |
| `@testing-library/jest-dom` fixé en 6.9.1 | La 6.10.0 a été publiée par erreur (avertissement npm) |

## 6. Partie 2 : compte client et commande

### 6.1 Les nouvelles pages
| Page | URL | Ce qu'on peut faire |
|---|---|---|
| Connexion | `/connexion` | Se connecter, puis revenir à la page demandée |
| Inscription | `/inscription` | Créer un compte (connexion automatique ensuite) |
| Validation de commande | `/commande` | Retrait ou livraison (zone, adresse, point de repère), **avec ou sans compte** |
| Espace client | `/compte` | Prochain rendez-vous, commande en cours |
| Mes commandes | `/compte/commandes` et `/compte/commandes/:reference` | Historique, détail avec prix figés, adresse de livraison |
| Mes réservations | `/compte/reservations` | Historique, annulation jusqu'à 24 h avant |
| Profil | `/compte/profil` | Modifier nom, prénom, téléphone |

**Compte de démonstration** (faux serveur uniquement) : `mariama@client.test` / `demo-dabo-2026`.

### 6.2 La connexion sécurisée, expliquée
1. `GET /sanctum/csrf-cookie` : le serveur dépose un jeton anti-CSRF dans un cookie.
2. `POST /auth/login` : axios renvoie automatiquement ce jeton dans l'en-tête `X-XSRF-TOKEN`.
3. Le serveur répond avec un **cookie de session HttpOnly**, que JavaScript **ne peut pas lire**. Même en cas de faille XSS, la session ne peut pas être volée.
4. `GET /auth/me` indique qui est connecté (**401** pour un visiteur : c'est normal).

L'utilisateur connecté est une donnée du **serveur** (`useMe()`), pas une variable stockée dans le navigateur. À la déconnexion, **tout le cache est vidé** : les données d'un compte ne restent pas visibles pour la personne suivante sur le même téléphone.

### 6.3 Les protections démontrées par les tests
| Protection | Ce qui se passe | Où |
|---|---|---|
| **Page protégée** | `/compte/...` sans être connecté renvoie vers `/connexion?redirect=…` | `RequireAuth` (confort) + **401 du serveur** (sécurité) |
| **Message d'erreur vague** | « Ces identifiants ne correspondent à aucun compte » : on ne révèle pas si l'email existe | Serveur |
| **Limitation des tentatives** (RG-SEC-02) | 6e essai bloqué pendant 1 minute (429) | Serveur |
| **IDOR** (OWASP A01) | Connaître la référence de la commande d'un autre client ne suffit pas : 403 | Serveur (vérifie le propriétaire) |
| **Open redirect** | `?redirect=https://site-pirate…` est remplacé par `/compte` | `safeRedirect()` |
| **Prix non modifiables** (RG-COM-04) | La commande n'envoie que des identifiants et des quantités : le serveur recalcule tout | `CheckoutRequest` |
| **Stock vérifié** (RG-STK-01) | 30 sérums demandés pour 24 en stock : 409 avec le détail, et un bouton « Passer à 24 » | `priceOrder()` |
| **Faux serveur jamais en production** | `import.meta.env.DEV` : MSW est supprimé du build | `main.tsx` |

### 6.4 Validation conditionnelle
L'adresse n'est obligatoire **que** pour une livraison. Zod l'exprime avec `superRefine`, qui voit tout l'objet et signale le bon champ :

```ts
.superRefine((v, ctx) => {
  if (v.fulfillment_method !== 'delivery') return
  if (v.address_line.length < 3) ctx.addIssue({ code: 'custom', path: ['address_line'], message: 'Indiquez l’adresse de livraison.' })
})
```

### 6.5 Le calcul de commande, en fonction pure
`src/mocks/orders.ts` (`priceOrder`) est la **spécification** du futur `PlaceOrderAction` Laravel. Elle prend ses prix dans la base, regroupe les doublons, vérifie le stock et ajoute les frais de la zone (0 pour un retrait). Elle calcule `total = sous-total - remise + frais`, exactement comme la contrainte `CHECK` de MySQL. Ses 5 tests seront rejoués en PHP.

## 7. Bugs trouvés et corrigés grâce aux tests
1. **Créneau réservé affiché libre un instant** : après une réservation, l'ancien cache était réaffiché pendant le rechargement. Corrigé avec `removeQueries`.
2. **Nouvelle tentative inutile après une 404** : corrigé par une règle de nouvelles tentatives limitée aux erreurs 5xx et réseau.
3. **Indicateur d'étapes sur deux lignes** sur mobile : compacté (seule l'étape en cours garde son libellé).
4. **Faux serveur inclus dans le build de production** (308 Ko), parce que `.env.local` est aussi lu par `vite build`. Corrigé avec `import.meta.env.DEV`. Le build est vérifié sans aucune trace de MSW.
5. **Données du faux serveur perdues au rechargement** : le stock remontait à 24 après une vente. L'état du faux serveur est maintenant enregistré dans le `localStorage`, pour qu'il se comporte comme une vraie base.
6. **Préremplissage qui écrasait la saisie** : si le client tapait avant le chargement de son profil, son texte était remplacé. Corrigé avec `keepDirtyValues`.
