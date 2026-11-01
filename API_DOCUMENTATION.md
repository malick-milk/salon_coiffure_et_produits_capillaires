# Documentation API

> Statut : **contrat v0** défini à l'étape 5 par le frontend (types : `frontend/src/types/api.ts`, faux serveur : `frontend/src/mocks/handlers.ts`). Implémentation Laravel et documentation générée (Scribe) à l'étape 6.

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
| 429 | Trop de requêtes | `{ "message": "…" }` |

## Authentification

_À compléter._

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

_À compléter._

## Endpoints ERP

_À compléter._

## Endpoints analytics

_À compléter._

