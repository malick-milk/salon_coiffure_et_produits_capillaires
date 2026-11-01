# Guide de sécurité

> Statut : exigences posées à l'étape 1 — implémentation détaillée aux étapes 6 et 10.

## Exigences issues de l'analyse
| Menace (OWASP) | Exigence |
|---|---|
| A01 Contrôle d'accès défaillant | RBAC par permission + vérification de propriété (IDOR) via les Policies Laravel |
| A02 Défaillances cryptographiques | HTTPS obligatoire, mots de passe hachés (bcrypt/argon2) |
| A03 Injection (SQL, XSS) | ORM Eloquent / requêtes préparées, échappement automatique de React, aucun `dangerouslySetInnerHTML` non assaini |
| A04 Conception non sécurisée | Totaux et stock recalculés côté serveur, transactions |
| A05 Mauvaise configuration | `APP_DEBUG=false` en production, en-têtes de sécurité, CORS restreint |
| A07 Authentification | Limitation des tentatives, sessions sécurisées (cookies HttpOnly, SameSite), protection CSRF |
| A09 Journalisation | Journal d'audit des actions administrateur |

## Implémentation

### Frontend (étape 5) — mesures en place et testées
| Mesure | Détail | Test |
|---|---|---|
| Session dans un cookie HttpOnly | Aucun jeton dans `localStorage` ; axios `withCredentials` + `withXSRFToken` | — |
| Cache vidé à la déconnexion | `queryClient.clear()` | parcours-compte |
| Garde de route `RequireAuth` | Confort uniquement : la protection réelle est le 401 du serveur | parcours-compte |
| Anti open redirect | `safeRedirect()` n'accepte que des chemins internes | checkout.test.ts, parcours-compte |
| Aucun prix envoyé à la commande | Le serveur recalcule (RG-COM-04) | orders.test.ts |
| Texte jamais injecté en HTML | Pas de `dangerouslySetInnerHTML` (anti-XSS) | revue de code |
| Aucun secret dans le frontend | Les variables `VITE_*` sont publiques | revue de code |
| Faux serveur exclu de la production | `import.meta.env.DEV` | build vérifié |

### Backend (étape 6) — mesures en place et testées
| Mesure | Détail | Test |
|---|---|---|
| CSRF | Sanctum `statefulApi()` : 419 sans jeton | vérification manuelle + parcours navigateur |
| Session sécurisée | Cookie HttpOnly, session régénérée à la connexion, invalidée à la déconnexion, `AuthenticateSession` | AuthApiTest |
| Mots de passe | Hachage bcrypt automatique (`'password' => 'hashed'`), 8 à 72 caractères | AuthApiTest |
| Anti-énumération | Même message pour un email inconnu et un mauvais mot de passe | AuthApiTest |
| Anti-force brute | 5 essais par email et adresse IP, puis 429 | AuthApiTest, parcours-compte |
| Anti-IDOR | `OrderPolicy`, `BookingPolicy` → 403 | OrderApiTest, AccountApiTest |
| Mass assignment | `$fillable` en liste blanche ; `stock_quantity` non remplissable | revue de code |
| Injection SQL | Eloquent + liaison de paramètres ; jokers `%` et `_` neutralisés | CatalogApiTest |
| Données sensibles | API Resources : jamais `cost_price`, `unit_cost`, stock exact, mot de passe | CatalogApiTest, OrderApiTest |
| Intégrité métier | Transactions + `lockForUpdate` + contraintes CHECK et UNIQUE | BookingApiTest, OrderApiTest, StockServiceTest |
| Anti-abus | Limitation de débit (voir API_DOCUMENTATION.md) | — |
| Erreurs | JSON en français, sans détail technique quand `APP_DEBUG=false` | — |
| RBAC sur l'ERP | Middleware `permission:*` sur chaque route d'administration ; montants masqués côté serveur sans `analytics.view` | AdminApiTest |
| Journal d'audit | `spatie/laravel-activitylog` : auteur, date, valeurs avant et après (RG-SEC-01) | AdminApiTest |
| Garde-fou administrateur | Impossible de retirer ses propres droits ; compte de production créé par `app:create-admin` (mot de passe non affiché) | AdminApiTest |

_Audit complet : étape 10._
