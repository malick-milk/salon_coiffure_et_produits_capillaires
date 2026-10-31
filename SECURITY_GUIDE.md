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
_À compléter aux étapes 6 et 10._
