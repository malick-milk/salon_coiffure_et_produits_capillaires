# Documentation API

> Statut : **v1 implémentée** (étape 6) dans `backend/routes/api.php`, conforme au contrat défini par le frontend (`frontend/src/types/api.ts`). Vérifiée par 51 tests backend et 51 vérifications de parcours navigateur sur la vraie API.

## Conventions (format, erreurs, pagination)

- Préfixe : `/api/v1`. Format : JSON, clés en `snake_case` (ADR-012).
- Montants : entiers en XOF. Dates : `YYYY-MM-DD`, heures `HH:mm`, horodatages ISO 8601.
- Une ressource seule est enveloppée : `{ "data": { … } }`. Une liste paginée : `{ "data": [ … ], "meta": { "current_page", "last_page", "per_page", "total" } }`.

| Code | Signification | Corps |
|---|---|---|
| 200 / 201 | Succès / ressource créée | `{ "data": … }` |
| 404 | Introuvable | `{ "message": "Produit introuvable." }` |
| 409 | Conflit (créneau déjà pris) | `{ "message": "…" }` |
| 422 | Données invalides | `{ "message": "…", "errors": { "customer.phone": ["…"] } }` |
| 401 | Non authentifié | `{ "message": "Non authentifié." }` |
| 403 | Accès refusé (ressource d'un autre client) | `{ "message": "Accès refusé." }` |
| 419 | Jeton CSRF absent ou expiré | `{ "message": "Session expirée. Rechargez la page." }` |
| 429 | Trop de requêtes | `{ "message": "…" }` |

## Authentification

Sanctum en mode SPA (ADR-003) : cookie de session HttpOnly + jeton CSRF.

| Méthode | URL | Corps | Réponse |
|---|---|---|---|
| GET | `/sanctum/csrf-cookie` | — | 204 + cookie `XSRF-TOKEN` (à appeler avant login et inscription) |
| POST | `/auth/login` | `{ email, password, remember }` | 200 `User` ; 422 identifiants invalides (message vague) ; 429 après 5 échecs |
| POST | `/auth/register` | `RegisterRequest` | 201 `User` (connecté) ; 422 (email ou téléphone déjà utilisés, mots de passe différents…) |
| POST | `/auth/logout` | — | 204 |
| GET | `/auth/me` | — | 200 `User` ; **401 si visiteur** |

## Endpoints publics

| Méthode | URL | Paramètres | Réponse |
|---|---|---|---|
| GET | `/categories` | — | `Category[]` (avec `product_count`) |
| GET | `/products` | `category`, `search`, `min_price`, `max_price`, `in_stock=1`, `featured=1`, `sort` (`newest`, `price_asc`, `price_desc`, `name`), `page` | `Paginated<ProductSummary>` (12 par page) |
| GET | `/products/{slug}` | — | `ProductDetail` (avec `variants` = autres contenances) |
| GET | `/services` | — | `Service[]` |
| GET | `/stylists` | `service_id` | `Stylist[]` (seulement ceux qui réalisent la prestation) |
| GET | `/business-hours` | — | `BusinessHour[]` |
| GET | `/availability` | `service_id`, `date`, `stylist_id` (facultatif) | `DayAvailability` : `is_open`, `closed_reason`, `slots[{time, available}]` |
| POST | `/bookings` | `BookingRequest` | 201 `BookingConfirmation` ; 409 si créneau pris ; 422 si invalide |

**Règles côté serveur, obligatoires même si le frontend les applique déjà :**
- le stock exact n'est jamais exposé : seulement `stock_status` et `stock_left` (si stock faible) ;
- `cost_price` n'apparaît jamais dans une réponse publique ;
- `POST /bookings` revérifie la disponibilité **dans une transaction**, et affecte un coiffeur libre si `stylist_id` vaut `null` ;
- limitation de débit sur `POST /bookings` (anti-abus RG-RES-07).

Exemple de `POST /api/v1/bookings` :

```json
{
  "service_id": 2, "stylist_id": null, "date": "2026-12-07", "time": "14:00",
  "customer": { "first_name": "Mariama", "last_name": "Sow", "phone": "771234567", "email": null },
  "notes": null, "consent": true
}
```

Réponse 201 :

```json
{ "data": { "reference": "RDV-2026-000011", "status": "pending", "service_name": "Nattes collées",
  "stylist_name": "Fatou", "starts_at": "2026-12-07T14:00:00", "ends_at": "2026-12-07T15:30:00", "price": 12000 } }
```

## Endpoints client

Tous exigent d'être connecté (401 sinon) et ne renvoient **que** les données de l'utilisateur connecté.

| Méthode | URL | Réponse |
|---|---|---|
| GET | `/me/orders` | `OrderSummary[]`, la plus récente en premier |
| GET | `/me/orders/{reference}` | `OrderDetail` ; **403** si la commande appartient à un autre client (anti-IDOR) ; 404 si inconnue |
| GET | `/me/bookings` | `CustomerBooking[]` avec `can_cancel` calculé par le serveur |
| POST | `/me/bookings/{reference}/cancel` | `CustomerBooking` ; 422 à moins de 24 h (RG-RES-04) |
| PATCH | `/me/profile` | `{ first_name, last_name, phone }` → `User` |

### Commande (avec ou sans compte)

| Méthode | URL | Réponse |
|---|---|---|
| GET | `/delivery-zones` | `DeliveryZone[]` |
| POST | `/orders` | 201 `OrderDetail` ; **409** `StockConflict` (`items[{ product_id, name, requested, available }]`) ; 422 |

Le corps de `POST /orders` ne contient **aucun prix** : `items[{ product_id, quantity }]`, mode de réception, zone, coordonnées, adresse. Le serveur, dans une transaction : verrouille les produits, vérifie le stock, recalcule les montants, crée la commande et ses lignes avec les prix figés, puis enregistre les mouvements de stock « vente ».

## Limitations de débit

| Limite | Portée |
|---|---|
| 120 requêtes / minute | Toute l'API, par utilisateur ou adresse IP |
| 20 / heure | `POST /bookings`, `POST /orders`, `POST /auth/register`, par adresse IP |
| 5 essais / minute | `POST /auth/login`, par email et adresse IP |

## Endpoints ERP

Tous exigent d'être connecté **et** de détenir une permission précise (403 sinon). Liste complète, permissions et règles : [docs/07_ERP.md](docs/07_ERP.md) §1.

`GET /auth/me` renvoie `permissions` (tableau de chaînes, vide pour un client) : l'interface s'en sert pour masquer ce qui est interdit, le serveur reste seul juge. `GET /admin/audit` renvoie `subject` (technique) et `subject_label` (lisible, `null` si l'objet a été supprimé).

## Avis clients et satisfaction (étape 13)

Détail : [docs/13_NOTIFICATIONS_ET_AVIS.md](docs/13_NOTIFICATIONS_ET_AVIS.md).

| Méthode | URL | Accès | Paramètres | Réponse |
|---|---|---|---|---|
| GET | `/reviews` | public | `page`, `per_page` (1 à 24, 6 par défaut) | `{ data: [{ id, author, kind, subject_label, rating, comment, reply, date }], summary: { average, answered_count, published_count, distribution }, meta }` — seuls les avis **publiés** ; `average` porte sur **toutes** les réponses |
| GET | `/surveys/{jeton}` | lien personnel (40 caractères) | — | `{ data: { kind, subject_label, first_name, state: open \| answered \| expired } }` ; 404 si inconnu |
| POST | `/surveys/{jeton}` | lien personnel, 20 par minute | `rating` (1-5, obligatoire), `nps` (0-10), `comment` (1 000 caractères), `publish_consent` (booléen) | 201 `{ data: { state, follow_up } }` ; 409 déjà répondu ; 410 expiré |
| GET | `/admin/surveys` | `reviews.manage` | `filter` : `to_moderate` (défaut), `follow_up`, `answered`, `published` ; `page` | liste paginée (20) + `counts: { to_moderate, follow_up }` ; contient le téléphone de la cliente (rappel) |
| PATCH | `/admin/surveys/{id}/review` | `reviews.manage` | `decision` : `approve`, `reject` ou `reply` ; `reply` ; `reject_reason` (`insultes`, `données personnelles`, `publicité`, `hors sujet`) | l'enquête à jour ; 422 si la cliente n'a pas donné son accord |
| PATCH | `/admin/surveys/{id}/follow-up` | `reviews.manage` | `note` (5 à 500 caractères) | l'enquête à jour |
| GET | `/admin/surveys/stats` | `reviews.manage` | `from`, `to` (90 derniers jours par défaut) | `{ data: { sent, answered, response_rate, average_rating, nps, nps_answers, by_service, orders, by_stylist, by_month, counts } }` |

Changements liés : `PATCH /admin/bookings/{ref}/status` exige `reason` (5 caractères au moins) pour annuler ; `GET /me/bookings` renvoie `cancelled_by` et `cancellation_reason` (le motif, seulement quand le salon a annulé).

## Points de retrait partenaires (étape 14)

Détail : [docs/14_POINTS_DE_RETRAIT.md](docs/14_POINTS_DE_RETRAIT.md). `POST /orders` accepte `fulfillment_method: "pickup_point"` avec `pickup_point_id` ; le stock réservé est celui du partenaire (409 s'il en manque). `GET /me/orders/{ref}` renvoie `pickup_point` et `pickup_code` (le code, seulement quand la commande est prête).

| Méthode | URL | Accès | Paramètres | Réponse |
|---|---|---|---|---|
| GET | `/pickup-points` | public | — | `{ data: [{ id, name, regions, city, address, opening_hours }] }` (points actifs) |
| GET | `/handover/{jeton}` | lien envoyé au partenaire | — | `{ data: { reference, pickup_point, customer_first_name, items, total, state: ready \| handed_over \| unavailable } }` |
| POST | `/handover/{jeton}` | lien du partenaire | `code` (4 chiffres, donné par la cliente) | `{ data: { state: "handed_over", total } }` ; 422 code faux ; 429 après 5 erreurs (15 min) ; 409 déjà remise |
| GET / POST | `/admin/pickup-points` | `partners.manage` | création : `name`, `owner_name`, `phone`, `email`, `regions[]` (14 régions), `city`, `address`, `opening_hours`, `commission_rate` | liste avec stock, dernier relevé, alertes + `summary` |
| GET / PATCH | `/admin/pickup-points/{id}` | `partners.manage` | champs ci-dessus, `is_active` | fiche : stock, commandes à remettre, livraisons, relevés |
| POST | `/admin/pickup-points/{id}/deliveries` | `partners.manage` | `items: [{ product_id, quantity }]`, `delivered_on` | bon de dépôt ; 409 si le stock du salon manque |
| POST | `/admin/pickup-points/{id}/statements/preview` | `partners.manage` | `counts: [{ product_id, counted, damaged }]` | `{ data: { lines, totals } }` sans rien enregistrer ; 422 si compté + abîmés > attendu |
| POST | `/admin/pickup-points/{id}/statements` | `partners.manage` | `period` (AAAA-MM), `counts`, `declared_sold`, `gap_note` (obligatoire en cas d'écart) | relevé (un seul par mois) |
| POST | `/admin/consignment-statements/{id}/payment` | `partners.manage` | `method` | relevé payé ; chaque commande du relevé est encaissée et facturée |
| GET | `/admin/consignment-deliveries/{id}/pdf`, `/admin/consignment-statements/{id}/pdf` | `partners.manage` | — | PDF |

## Endpoints analytics

Permission `analytics.view` (propriétaire). Détail des formules : [docs/08_ANALYTICS.md](docs/08_ANALYTICS.md) §3.

| Méthode | URL | Paramètres | Réponse |
|---|---|---|---|
| GET | `/admin/analytics` | `from`, `to` (AAAA-MM-JJ, 30 derniers jours par défaut, 2 ans maximum, `to` ≤ aujourd'hui) | `{ data: { period, previous_period, kpis: { current, previous }, series, top_products, stock, top_customers, booking_heatmap, payment_methods, data_quality, computed_at } }` |
| GET | `/admin/analytics/export/{jeu}` | `jeu` : `daily_sales`, `product_daily` ou `order_lines` ; `from`, `to` | Fichier CSV (`;`, UTF-8 avec BOM), sans donnée personnelle ; 20 par minute |

Conventions :
- montants en F CFA (entiers) ;
- une valeur **`null`** signifie « inconnu » ou « non calculable » (marge sans coût de revient, taux sans dénominateur), jamais 0 ;
- `granularity` vaut `day` jusqu'à 62 jours, `week` jusqu'à 190 jours, `month` au-delà ;
- `series[].date` est le premier jour de la période regroupée (le lundi pour une semaine).

