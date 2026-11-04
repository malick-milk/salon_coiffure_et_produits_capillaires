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

### Interface ERP (étape 7.2) — mesures en place et testées
| Mesure | Détail | Test |
|---|---|---|
| Interface adaptée aux permissions | Menu et boutons masqués via `useCan()` ; **confort uniquement**, le serveur reste seul juge | parcours-admin |
| Accès direct à l'API refusé | Un caissier qui appelle `/api/v1/admin/users` reçoit 403 | parcours-admin |
| Montants jamais envoyés sans droit | Le CA est `null` côté serveur pour le caissier, pas seulement caché | AdminApiTest, parcours-admin |
| Code de l'ERP non téléchargé par les clients | Routes `/admin` chargées à la demande (`lazy`) | build vérifié |
| Client sur `/admin` | Page « accès réservé au personnel » | parcours-admin |

### Analytique (étape 8) — mesures en place et testées
| Mesure | Détail | Test |
|---|---|---|
| Accès réservé | `analytics.view` (propriétaire) ; 403 pour gérant, caissier, coiffeuse | AnalyticsApiTest, parcours-admin |
| Minimisation des exports | Aucun nom, téléphone ni adresse : le client est un identifiant (pseudonyme) | AnalyticsApiTest, parcours-admin |
| Injection de formule CSV (OWASP) | Cellule texte commençant par `= + - @` préfixée d'une apostrophe | CsvSanitizeTest |
| Anti-abus | Exports limités à 20 par minute ; période limitée à 2 ans ; dates validées | AnalyticsApiTest |
| Données fictives isolées | `app:demo-history` refusé hors environnement local ; n'écrit pas dans le journal d'audit | AnalyticsApiTest |

### Tests de sécurité ajoutés (étape 9)
| Mesure | Preuve |
|---|---|
| Anti-spam des réservations et commandes : 20 par heure et par adresse IP | RateLimitTest (la 21ᵉ reçoit 429) ; les limites par défaut ne peuvent pas être relevées sans variable d'environnement explicite |
| Protection CSRF côté client : jeton demandé avant toute modification, un seul rejeu après 419 | http.test.ts |
| Aucune double réservation, aucun stock négatif sous requêtes simultanées | tests/charge/concurrence.mjs (+ test de mutation : sans verrou, 8 ventes perdues) |
| Messages d'erreur sans détail technique | http.test.ts, TranslationCoverageTest (aucune clé brute affichée) |
| Mot de passe du propriétaire haché, jamais en clair | ConsoleCommandsTest |
| Accessibilité vérifiée automatiquement | ESLint jsx-a11y dans l'intégration continue |

### Audit de l'étape 10
Rapport complet, catégorie par catégorie (OWASP Top 10), avec les risques résiduels acceptés : **[docs/10_SECURITE.md](docs/10_SECURITE.md)**.

| Mesure ajoutée | Preuve |
|---|---|
| Composants Symfony mis à jour (6 failles publiées le jour de l'audit) | `composer audit` en intégration continue, chaque push et chaque lundi |
| Redirection après connexion analysée comme le fait le navigateur (`/\pirate.com` refusé) | checkout.test.ts (6 contournements) |
| En-têtes HTTP : nosniff, anti-iframe, Referrer-Policy, Permissions-Policy, CSP sur l'API, HSTS en HTTPS | SecurityAuditTest |
| CORS limité à la vitrine | SecurityAuditTest |
| Mot de passe client : lettre + chiffre ; fuites connues refusées en production | SecurityAuditTest |
| Journal de sécurité `storage/logs/security-*.log` (emails masqués, jamais de mot de passe) | SecurityAuditTest |
| Aucun détail technique dans une erreur 500 en production | SecurityAuditTest |
| Toute route d'administration exige connexion + permission (vérifié sur toutes les routes) | SecurityAuditTest |
| XSS stocké : attaque réelle dans le planning, affichée comme texte | parcours-admin (et test de mutation) |
| HTML brut interdit dans React | ESLint (`no-restricted-syntax`) |
| Contrôle de configuration avant la production | `php artisan app:security-check` |
