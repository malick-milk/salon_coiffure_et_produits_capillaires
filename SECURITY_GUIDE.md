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

### Backend (étape 6) — à implémenter, déjà spécifié par le faux serveur
- Message de connexion vague, limitation à 5 tentatives par minute (RG-SEC-02).
- Vérification du propriétaire sur `/me/orders/{reference}` (Policy Laravel, anti-IDOR).
- Validation complète (FormRequest), même pour ce que le frontend valide déjà.
- Transaction + verrou (`lockForUpdate`) pour les commandes et les réservations.

_Audit complet : étape 10._
