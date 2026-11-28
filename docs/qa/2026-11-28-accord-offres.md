# QA du 28 novembre 2026 : accord pour les nouveautés et offres par e-mail

Commit testé : `a6fdfc9` (« Accord pour les nouveautés et offres par e-mail (loi 2008-12) »). Le correctif +221 (`5703ebe`) a été revérifié. Base locale et comptes de démonstration uniquement.

Captures (hors dépôt) : `/tmp/claude-0/-home-user/53246402-aa7b-58fe-b65d-300e4d770fd3/scratchpad/qa/` (sous-dossiers `explore/`, `accord-qa/` et un dossier par parcours).

## 🔍 Analyse

**Ce qui a changé** (`git show a6fdfc9 --stat` : 40 fichiers, +751 −37) : table `customer_consents` et service `MarketingConsent`, case `marketing_consent` dans les requêtes d'inscription, de commande et de réservation, `GET/PATCH /api/v1/me/preferences`, `POST /api/v1/offers/unsubscribe/{customer}` signé, ERP Clients (colonne et filtre, `POST admin/customers/{id}/marketing-consent`, montants masqués sans `customers.stats`), permissions `customers.stats` et `customers.consent`, `MarketingConsentBox`, section « Les messages que je reçois », page `/offres/desinscription/:customer`, politique de confidentialité, CI (`parcours-accord`).

**Commandes lancées et résultats exacts**

| Commande | Résultat |
|---|---|
| `php artisan test` (avant mes ajouts) | 258 tests, 258 réussis, 1960 assertions |
| `php artisan test` (avec `MarketingConsentEdgeCasesTest`, 11 tests) | 269 tests, **268 réussis, 1 échec voulu** (bug n° 1) |
| `npx tsc -b` | code de sortie 0 |
| `npx eslint src e2e` | 0 erreur, 19 avertissements (aucun dans les fichiers modifiés) |
| `npx vitest run` | 161 réussis sur 161 (dont `MarketingConsentBox.test.tsx` : 3 sur 3) |
| `npm run build` | réussi ; `index` 136,80 kB (40,32 kB gzip), `AccountPages` 22,17 kB, `CheckoutPage` 15,37 kB, `UnsubscribePage` 2,65 kB |
| `parcours-accord` | 12 OK, 0 FAIL |
| `parcours-compte` | 41 OK, 0 FAIL |
| `parcours-admin` | 44 OK, 0 FAIL |
| `parcours-vitrine` | **échouait** (mode strict : deux cases à cocher) ; après correction du test : 26 OK, 0 FAIL |
| `parcours-prix-membre` | 12 OK, 0 FAIL |
| `parcours-twist-express` | 9 OK, 0 FAIL |
| `parcours-promotions`, `livraison`, `gamme`, `moins-de-choix`, `rh` | 10, 11, 16, 12 et 13 OK, 0 FAIL |
| `concurrence.mjs` (serveur à 8 processus) | tous les scénarios réussis |
| **nouveau** `parcours-accord-qa.cjs` | 1 OK, **5 FAIL voulus** (bugs n° 2, 3, 5, 6 et 7) |
| **nouveau** `concurrence-accord.mjs` | 2 OK, **3 FAIL voulus** (bug n° 4) |

La base a été remise à zéro avant chaque parcours.

## ✅ Éléments validés

- **Case facultative et preuve** : non cochée, rien ne change ; cochée, une preuve `register`, `order` ou `booking` avec la version du texte (`MarketingConsentTest`, 6 sur 6).
- **Cliente connectée qui a déjà accepté puis commande** (case cochée, puis non cochée) : aucune preuve en double, l'accord reste (`MarketingConsentEdgeCasesTest`).
- **Invitée qui coche à la commande avec « +221 78 … », puis s'inscrit sans cocher** : une seule fiche, reprise par le compte ; l'accord reste ; l'espace client affiche la source « commande ». L'inverse (invitée qui ne coche pas, puis coche à l'inscription avec `+221…`) donne une preuve `register`.
- **Retrait puis nouvel accord** : les preuves `account oui` → `account non` → `salon oui` sont toutes gardées. L'ERP passe de « Retiré » à « Accepte ». Remettre le même état n'ajoute pas de ligne.
- **Correctif +221 revérifié** : 4 commandes avec `+221 78 123 45 67`, `00221781234567`, `78 123 45 67` et `+221781234567` donnent une seule fiche (`781234567`) et une seule preuve.
- **Sécurité, une cliente et une autre** : un `PATCH /me/preferences` avec `customer_id` ou `customer` d'une autre cliente ne touche que la fiche de la cliente connectée. Sans connexion : 401. Valeur invalide : 422.
- **Lien signé** : sans signature, avec une signature inventée, ou avec la signature des **rappels** réutilisée pour les offres : 403. Avec un autre numéro de cliente dans l'adresse : refusé (« Ce lien n'est pas valide »). Le lien valide fonctionne sur téléphone (page de 390 px, « C'est noté »). Après rechargement, un deuxième clic répond encore « C'est noté », sans preuve en double.
- **La caisse ne reçoit jamais de montant** : `total_spent` vaut `null` pour toutes les lignes avec `''`, `?marketing=1`, `?search=`, `?type=` et `?page=2`. La réponse de « Elle accepte » ne contient pas `spent`. La colonne « Dépensé » est absente pour la caisse (capture `explore/D-erp-caisse-390.png`) ; la gérante la voit (capture `explore/D-erp-gerante-1440.png`).
- **Permissions** : coiffeur, magasinier et cliente reçoivent 403 sur `POST …/marketing-consent` ; coiffeur et magasinier reçoivent aussi 403 sur `GET admin/customers`. Sans connexion : 401. Le manager peut noter un accord.
- **Performances** : le nombre de requêtes de la liste ERP reste le même avec 0 preuve ou 2 preuves par cliente : pas de N+1 (test).
- **Pages à 390 px** : `/inscription` et `/compte/profil` font 390 px de large ; `/offres/desinscription/…` aussi (via le lien valide). Les interrupteurs font 69 et 85 px de haut sur 316 px de large ; la case des offres fait 132 px de haut (inscription) et 110 px (commande).
- **Clavier** : Espace et Entrée basculent l'interrupteur ; le contour de focus fait 2 px plein. Lors d'une commande vide, le focus va sur `first_name`.
- **Console** : 0 erreur JavaScript dans tous les parcours et toutes les explorations.
- **Journaux** : `queue:failed` est vide ; `error_reports` est vide depuis le 28/11. Dans `laravel.log`, je trouve seulement des erreurs attendues : « stock insuffisant » et « créneau déjà réservé » viennent des scripts de concurrence ; les « Connection refused » datent de 00:08, quand MySQL démarrait, avant la campagne.

## ⚠️ Problèmes détectés

### 1. BLOQUANT : une visiteuse peut donner l'accord à la place d'une cliente inscrite, et annuler son retrait

- **Fichiers** : `backend/app/Actions/PlaceOrderAction.php:88` (même chose dans `CreateBookingAction.php:59`) avec `CustomerResolver::resolve()`.
- **Étapes** : Mariama retire son accord dans son espace client. Une personne non connectée commande ensuite avec le numéro de Mariama (`+221 77 000 00 03`) et coche la case des offres.
- **Attendu** : rien ne change sur la fiche d'une cliente inscrite. Elle seule décide, dans son espace client. La loi n° 2008-12 exige un accord venant de la personne elle-même.
- **Obtenu** : `marketing_consent` repasse à `true` et une preuve `order` est enregistrée **au nom de Mariama**. Reproduit 3 fois : le test, puis la vraie API (`curl` : `{"id":2,"marketing_consent":false}` → HTTP 201 → `{"id":2,"marketing_consent":true}` et la preuve `{"customer_id":2,"granted":true,"source":"order"}`).
- **Même risque pour une fiche invitée** qui a déjà un e-mail : l'invitée qui coche n'est pas forcément la personne de la fiche, et `firstOrCreate` ne remplace pas l'e-mail. Les offres partent donc à l'adresse de quelqu'un d'autre.

### 2. GÊNANT (régression de ce commit) : ERP Clients sur téléphone, page de 548 à 694 px de large, boutons « Noter son accord » impossibles à toucher

- **Fichier** : `frontend/src/features/admin/pages/TeamPages.tsx`, `MarketingCell`, le `<span className="sr-only">` dans le bouton.
- **Étapes** : se connecter comme caisse (ou gérante) sur un téléphone de 390 × 844, ouvrir `/admin/clients`.
- **Attendu** : la page fait 390 px, le tableau défile dans son cadre.
- **Obtenu** : la page fait 694 px pour la caisse et 548 px pour la gérante, avec une bande noire vide à droite (capture `explore/D-erp-caisse-390.png`). Le Playwright `click` sur le dernier bouton expire au bout de 5 s. Cause **prouvée** : le `span.sr-only` est en `position: absolute` sans ancêtre positionné, donc il sort du `div.overflow-x-auto`. Son bord droit est à 693 px ; si on masque ces 6 spans, la page revient à 390 px. Avec `position: relative` sur le bouton, la page revient à 390 px et le toucher fonctionne.

### 3. GÊNANT : double clic sur « Elle accepte » : message d'erreur rouge et panneau qui reste ouvert, alors que l'accord est enregistré

- **Fichier** : `TeamPages.tsx` (`consent.mutate(confirming.id, { onSuccess: () => setConfirming(null) })`, bouton `disabled={consent.isPending}`) et `CustomerAdminController::recordMarketingConsent` (`abort_if … 422`).
- **Étapes** : ERP Clients → « Noter son accord donné au salon » → double clic sur « Elle accepte les offres par e-mail ».
- **Obtenu** : 2 POST partent ; le 2e répond 422. La page affiche « Cette cliente a déjà accepté les offres. » et le panneau reste ouvert (capture `explore/H-erp-caisse-apres-double-clic.png`). La caisse croit à un échec. Dans TanStack Query v5, le `onSuccess` passé à `mutate()` n'est appelé que pour le dernier appel. Reproduit 3 fois.

### 4. GÊNANT : requêtes simultanées : preuves en double dans le journal « jamais modifié »

- **Fichier** : `backend/app/Services/Customers/MarketingConsent.php:28-37`. L'état est lu **avant** la transaction, sans verrou.
- **Étapes** : 8 `POST …/marketing-consent` en même temps sur un serveur à 8 processus (comme en production), ou 8 `PATCH /me/preferences {marketing_email:true}`.
- **Obtenu** : (a) « Elle accepte », 3 ou 4 réponses 200 et 3 ou 4 preuves `salon` pour la même cliente ; (b) interrupteur, 3 ou 4 preuves `account`. Reproduit 3 fois. L'état final reste juste, mais la preuve est polluée.

### 5. GÊNANT (accessibilité) : après un appui sur l'interrupteur, le focus est perdu

- **Fichier** : `frontend/src/features/account/pages/AccountPages.tsx`, `Toggle` (`disabled={update.isPending}`).
- **Étapes** : `/compte/profil` → Tab jusqu'à « Nouveautés et offres » → Espace.
- **Attendu** : le focus reste sur l'interrupteur.
- **Obtenu** : `document.activeElement` est `BODY`. Le bouton devient `disabled` pendant l'envoi et perd le focus. L'utilisatrice au clavier ou au lecteur d'écran revient en haut de page. Reproduit avec Espace et avec Entrée.

### 6. GÊNANT (EXISTAIT AVANT ce commit) : `/commande` sur téléphone : page de 446 px et case obligatoire découpée en colonnes

- **Fichier** : `frontend/src/features/checkout/pages/CheckoutPage.tsx:220-223`. Le `label` en `flex` contient du texte nu et deux `<Link>` : chaque morceau devient une colonne, et la largeur minimale (388 px) élargit le `fieldset`.
- **Étapes** : panier rempli, `/commande` en 390 × 844.
- **Obtenu** : la page fait 446 px ; le texte « J'accepte les conditions de vente… » s'affiche en 4 colonnes étroites (capture `explore/C-commande-invitee-390.png`). Ce n'est pas causé par `MarketingConsentBox` : si on retire la case, la largeur reste 430 px.
- **Pourquoi `parcours-compte` ne l'a pas vu** : son contrôle « Mobile 390 px : /commande » se fait **panier vide** et compare `scrollWidth` à `window.innerWidth`. Avec `isMobile`, les deux grandissent ensemble, donc le contrôle ne peut pas échouer.

### 7. MINEUR : « Noter son accord donné au salon » fait 16 px de haut

Il en faut 44 au moins (règle du projet). Sur la tablette ou le téléphone de la caisse, la zone à toucher est trop petite.

### 8. MINEUR : accord « par e-mail » proposé pour des clientes sans e-mail

Exemples : Fatou Sarr et Mame Badji, invitées sans e-mail. L'accord est enregistré mais inutilisable, et il est compté dans « Acceptent les offres (N) ».

### 9. MINEUR : panneau de confirmation affiché en haut de page, focus laissé dans la ligne

Avec une liste longue sur téléphone, le panneau peut être hors de l'écran après le toucher. Le focus reste sur « Noter son accord… » (Échap non vérifié : le code n’écoute pas la touche).

### 10. MINEUR : case des offres affichée brièvement pour une cliente connectée qui a déjà accepté

Sur `/commande`, la case est visible au chargement, puis disparaît quand `/me/preferences` répond (mesuré : 1 case visible au début, 0 après 1,5 s).

### 11. MINEUR : textes et nom accessible

- Le nom lu de l'interrupteur colle le titre et l'aide : « Rappels de resserragePar e-mail… ».
- Après un retrait, le profil dit « refusé » ; « retiré » serait plus juste.

### 12. MINEUR (existait avant) : un coiffeur qui tape `/admin/clients` voit le titre et les filtres

Il voit aussi « Acceptent les offres (…) » et « Vous n'avez pas la permission… ». Aucune donnée ne s'affiche (API 403), mais une page « accès refusé » serait plus claire.

## 🛠 Corrections proposées

| N° | Correction (session principale) | Test qui la vérifiera |
|---|---|---|
| 1 | Sans connexion (`$user === null`), n'enregistrer l'accord que si la fiche vient d'être **créée** par cette commande ou réservation (`$customer->wasRecentlyCreated`) ; sinon, ignorer la case et ne rien changer. Pour une fiche inscrite, seule l'espace client décide. À terme : double confirmation par e-mail. | `backend/tests/Feature/MarketingConsentEdgeCasesTest.php::test_bug_une_visiteuse_ne_peut_pas_donner_l_accord_a_la_place_d_une_cliente_inscrite` (en échec aujourd'hui) ; ajouter le même cas pour une réservation. |
| 2 | Ajouter `relative` au bouton de `MarketingCell` (ou au `div.overflow-x-auto` de `Table` dans `components/ui.tsx`, ce qui protège tous les tableaux). | `frontend/e2e/parcours-accord-qa.cjs` (« ERP Clients (caisse, 390 px) ») |
| 3 | Serveur : rendre `recordMarketingConsent` idempotent (200 avec l'état actuel si l'accord existe déjà, au lieu de 422). Site : `onSuccess` dans `useRecordMarketingConsent` (niveau du hook) ou verrou `useRef` contre le 2e clic. | `parcours-accord-qa.cjs` (« Double clic « Elle accepte » ») |
| 4 | Dans `MarketingConsent::record()`, ouvrir la transaction **puis** relire la fiche avec `Customer::lockForUpdate()->find($customer->id)` avant de comparer l'état. | `backend/tests/charge/concurrence-accord.mjs` (en échec aujourd'hui) |
| 5 | Ne pas mettre `disabled` sur l'interrupteur pendant l'envoi : utiliser `aria-disabled` et ignorer le clic si une requête est en cours, ou mise à jour optimiste. | `parcours-accord-qa.cjs` (« après Espace, le focus reste… ») |
| 6 | Mettre le texte du `label` dans un `<span>` (comme `MarketingConsentBox`), ou ajouter `min-w-0` au `fieldset`. Corriger aussi le contrôle de `parcours-compte` : panier rempli, comparaison à 390. | `parcours-accord-qa.cjs` (« Commande (panier rempli, 390 px) ») |
| 7 | Bouton d'au moins `min-h-11` (44 px), ou `py-3`. | `parcours-accord-qa.cjs` (« 44 au moins ») |
| 8 | Masquer « Noter son accord » si `email` est vide (ou demander l'e-mail dans le panneau) ; compter seulement les fiches avec e-mail dans `marketing_total`. | à ajouter dans `MarketingConsentTest` |
| 9 | Ouvrir le panneau près de la ligne (ou en fenêtre), y déplacer le focus, fermer avec Échap. | à ajouter dans `parcours-accord-qa.cjs` |
| 10 | Masquer la case tant que `prefs.isLoading` pour une cliente connectée. | `MarketingConsentBox.test.tsx` (cas « en chargement ») |
| 11 | Ajouter `aria-describedby` vers l'aide ; écrire « retiré » au lieu de « refusé ». | `parcours-accord.cjs` (nom exact du switch) |
| 12 | Garde de route ERP par permission (`useCan('customers.view')`). | `parcours-admin.cjs` |

**Fichiers écrits par moi**
- `frontend/e2e/parcours-vitrine.cjs` : la case obligatoire est visée par son nom. Déjà commitée par la session principale.
- `backend/tests/Feature/MarketingConsentEdgeCasesTest.php` : 11 tests, dont 1 en échec voulu.
- `frontend/e2e/parcours-accord-qa.cjs` : 5 échecs voulus.
- `backend/tests/charge/concurrence-accord.mjs` : 3 échecs voulus.

**À ajouter à la CI (je ne l'ai pas fait)**, une fois les corrections faites :
- `(cd backend && php artisan migrate:fresh --seed --force) && node frontend/e2e/parcours-accord-qa.cjs captures`
- `(cd backend && php artisan migrate:fresh --seed --force) && node backend/tests/charge/concurrence-accord.mjs` (serveur 8001 déjà lancé par la CI)

**Attention** : `MarketingConsentEdgeCasesTest` fait échouer `php artisan test`, donc la CI, tant que le bug n° 1 n'est pas corrigé. Le commiter avec la correction.

**Non testé, et pourquoi**
- **Vrai e-mail d'offre avec le lien de désinscription** : aucun e-mail d'offre n'existe encore ; `unsubscribeUrl()` n'est appelé nulle part dans `app/` ni `resources/`.
- **Vrai lecteur d'écran (TalkBack, VoiceOver)** : seuls les rôles et noms ont été vérifiés.
- **Étape « Coordonnées » de la réservation à 390 px avec la case** : couverte seulement par les parcours existants (`twist-express`, `vitrine`), pas mesurée à part.
- **Contraste** : mesure partielle. Aide `#bdbdbd` 12 px sur `#1d1810` : contraste suffisant à l'œil ; non calculé pour le lien doré souligné de l'ERP.

## 🚀 Prêt pour production : **Non**

Le bug n° 1 est **bloquant** : un accord est enregistré au nom d'une personne qui ne l'a pas donné, et cela annule son retrait. C'est contraire à la loi n° 2008-12, que la fonctionnalité doit justement respecter. Les bugs n° 2 (ERP inutilisable sur téléphone pour noter un accord) et n° 4 (preuves en double) sont à corriger avant la mise en ligne.

**Risques à connaître avant le déploiement**
1. **Permissions** : en production, relancer `php artisan db:seed --class=RolesAndPermissionsSeeder`. Sans cela, `customers.stats` et `customers.consent` n'existent pas : la gérante et le manager perdent la colonne « Dépensé », et la caisse reçoit 403 sur « Elle accepte ». Cette commande n'est pas dans `docs/11_DEPLOIEMENT.md`. Elle réécrit aussi les permissions des rôles changées depuis l'ERP (`syncPermissions`).
2. **Migration** : `customer_consents` doit être créée avant le déploiement du site, car le site appelle `/me/preferences` dès le chargement de la commande pour une cliente connectée.
3. **Fiches existantes** avec `marketing_consent = true` mais sans preuve : l'ERP affiche « Accepte » sans source. À vérifier sur la base de production (lecture seule) avant la première campagne.
4. **Premier e-mail d'offre** : il devra inclure `MarketingConsent::unsubscribeUrl()`. Aucun test ne le garantit aujourd'hui.
5. **`politique de confidentialité`** : il reste « [À COMPLÉTER : durée après le retrait] ».
6. **Supervision** : les erreurs métier attendues (« stock insuffisant », « créneau déjà réservé ») sont écrites au niveau ERROR dans `laravel.log`. Elles risquent de cacher de vraies erreurs.


## Suite donnée par la session principale (28 novembre 2026)

| Problème | Correction |
|---|---|
| 1. Une visiteuse donnait l'accord à la place d'une cliente inscrite (BLOQUANT) | Sans connexion, l'accord n'est enregistré que pour une fiche **nouvelle** (`wasRecentlyCreated`), à la commande comme à la réservation |
| 2. ERP Clients plus large que l'écran, boutons inactifs au toucher | `relative` sur le conteneur défilant de tous les tableaux de l'ERP (`Table`) et sur le bouton |
| 3. Double clic « Elle accepte » : message d'erreur | Réponse 200 si l'accord existe déjà, sans nouvelle preuve ; le panneau se ferme |
| 4. Preuves en double sous requêtes simultanées | `lockForUpdate` sur la fiche et relecture de l'état dans la transaction (`MarketingConsent::record`) |
| 5. Focus perdu après Espace sur un interrupteur | `aria-disabled` au lieu de `disabled` ; aide reliée par `aria-describedby` |
| 6. Commande à 446 px sur téléphone | Texte des cases obligatoires dans un `<span>` (commande, inscription, réservation) |
| 7. Mineurs | Bouton de 44 px ; pas d'accord « par e-mail » sans adresse (serveur : 422, ERP : « Pas d'e-mail ») ; focus sur le panneau à l'ouverture ; case masquée pendant le chargement ; « retiré » au lieu de « refusé » |

Les parcours `parcours-accord-qa.cjs` et `concurrence-accord.mjs` passent et sont ajoutés à la CI. Non repris : un coiffeur qui tape `/admin/clients` voit le titre de la page sans aucune donnée (l'API refuse) ; le seeder des rôles est documenté dans `docs/11_DEPLOIEMENT.md`.
