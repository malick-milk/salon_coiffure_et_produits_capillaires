# ÉTAPE 10 — Audit de sécurité (OWASP Top 10)

> **Statut** : terminée, le 4 novembre 2026.
> **Méthode** : relecture du code catégorie par catégorie du **Top 10 de l'OWASP 2021** (la liste de référence des risques des applications web), analyse des bibliothèques, tests d'attaque automatisés.
> **Résultat** : 3 failles réelles corrigées (dont une de priorité haute), 9 renforcements, 0 vulnérabilité connue dans le code livré, 3 risques résiduels acceptés et documentés.
> **Preuves** : 115 tests backend (dont 9 de sécurité), 57 tests frontend, 81 vérifications dans un navigateur (dont une attaque XSS), test de concurrence.

---

## 1. Synthèse

| Priorité | Constat | Correction | Preuve |
|---|---|---|---|
| **Haute** | 6 failles publiées le jour de l'audit dans les composants Symfony utilisés par Laravel (contournement du contrôle d'accès par l'URL, en-têtes `Host` falsifiés…) | Mise à jour 7.4.22 → 7.4.23 | `composer audit` : 0 faille |
| **Moyenne** | **Redirection ouverte** après connexion : `?redirect=/\pirate.com` envoyait la cliente vers un autre site, malgré la vérification | Analyse de l'adresse par le navigateur lui-même (`new URL`), puis contrôle de l'origine | 6 contournements testés ; l'ancienne version en laissait passer 3 |
| Moyenne | 2 failles « critiques » dans l'outil de test Vitest (exécution de code via un serveur de test) | Vitest 3 → 5 | `npm audit` : 0 critique |
| Renforcement | Aucun en-tête de sécurité HTTP | Middleware `SecurityHeaders` | SecurityAuditTest |
| Renforcement | Mot de passe client : `12345678` accepté | Lettre + chiffre ; en production, refus des mots de passe déjà fuités | SecurityAuditTest |
| Renforcement | Aucun journal des événements de sécurité | `storage/logs/security-*.log` | SecurityAuditTest |
| Renforcement | CORS ouvert à toutes les origines (réglage par défaut) | Limité à la vitrine | SecurityAuditTest |
| Renforcement | Cookie de session non forcé en HTTPS | `secure` par défaut en production | `app:security-check` |
| Renforcement | Version de PHP annoncée (`X-Powered-By`) | En-tête supprimé | SecurityAuditTest |
| Renforcement | Rien n'empêchait d'écrire du HTML brut dans React | Règle ESLint bloquante | ESLint, en intégration continue |
| Renforcement | Aucun contrôle de la configuration avant la mise en production | Commande `php artisan app:security-check` | SecurityAuditTest |
| Renforcement | Nouvelles failles des bibliothèques non surveillées | Audit à chaque push **et chaque lundi** | GitHub Actions |

---

## 2. Revue catégorie par catégorie

### A01 — Contrôle d'accès défaillant

*Le risque : faire ce que l'on n'a pas le droit de faire (lire la commande d'un autre, ouvrir l'ERP).*

| Point vérifié | État |
|---|---|
| Chaque route `/api/v1/admin/*` exige une connexion **et** une permission | Vérifié **automatiquement** : un test parcourt toutes les routes, et une route ajoutée sans permission le fait échouer |
| Commande, facture ou réservation d'un autre client (IDOR) | Policies → 403 (tests depuis l'étape 6) ; chaque tentative est maintenant **journalisée** |
| Montants masqués au caissier côté serveur, pas seulement à l'écran | Testé (étape 7) |
| Inscription avec `role: super_admin`, `is_active`, `id` dans la requête (*mass assignment*) | Ignorés : le compte créé est un simple client (test) |
| Redirection après connexion | **Faille corrigée** (§3) |

### A02 — Défaillances cryptographiques

| Point vérifié | État |
|---|---|
| Mots de passe | Hachés en bcrypt (12 tours), jamais en clair ni dans les journaux (testé) |
| Session | Cookie `HttpOnly` (illisible par JavaScript), `SameSite=Lax`, **HTTPS uniquement en production** |
| HTTPS | En-tête HSTS envoyé sur toute connexion sécurisée : le navigateur refusera ensuite le HTTP pendant 1 an |
| Secrets | `.env` jamais versionné ; aucune variable `VITE_*` secrète (elles sont lisibles par tous) |

### A03 — Injection (SQL, XSS, CSV)

| Point vérifié | État |
|---|---|
| Injection SQL | Eloquent et requêtes paramétrées (`?`) partout. Les 2 seules requêtes construites avec une variable utilisent des valeurs fixées par le code, jamais une saisie |
| XSS (script injecté dans une page) | React échappe tout le texte. **Testé en attaque réelle** : une remarque de réservation piégée s'affiche comme du texte dans le planning. Avec une version volontairement vulnérable, le test a vu le script s'exécuter |
| HTML brut dans React | Interdit par ESLint (`dangerouslySetInnerHTML`) |
| Facture PDF | Le modèle n'utilise que `{{ }}`, qui échappe le texte |
| Injection de formule dans les exports CSV | Neutralisée depuis l'étape 8 (test) |

### A04 — Conception non sécurisée

| Point vérifié | État |
|---|---|
| Spam de réservations ou de commandes | 20 par heure et par adresse IP (testé à l'étape 9) |
| Double réservation, stock négatif sous attaque simultanée | Verrous + index unique, prouvés par le test de concurrence (étape 9) |
| Prix envoyés par le navigateur | Ignorés : le serveur recalcule tout (étape 6) |

### A05 — Mauvaise configuration de sécurité

| Point vérifié | État |
|---|---|
| En-têtes HTTP | **Ajoutés** : `nosniff`, `X-Frame-Options: DENY` (anti-clickjacking), `Referrer-Policy`, `Permissions-Policy`, CSP stricte sur l'API, HSTS |
| CORS | **Limité** à la vitrine (`CORS_ALLOWED_ORIGINS`) |
| Erreur serveur | En production, aucun détail ne sort (testé : ni requête SQL, ni mot de passe, ni trace) |
| Mode debug, comptes de démo, mots de passe par défaut | **`php artisan app:security-check`** les détecte et bloque (§4) |
| Version de PHP | `X-Powered-By` supprimé |

> **Une leçon sur CORS.** Pour une requête venant d'un site pirate, le serveur répond « seule la vitrine est autorisée » (`Access-Control-Allow-Origin: http://localhost:5173`). Ce n'est pas une fuite : le **navigateur** compare cette réponse à l'origine qui demande et bloque la lecture. La sécurité CORS repose sur le navigateur, d'où l'importance de ne jamais répondre `*` à une API qui utilise des cookies.

### A06 — Composants vulnérables ou obsolètes

| Où | Avant | Après |
|---|---|---|
| Bibliothèques PHP (`composer audit`) | 6 failles Symfony, publiées le jour même | **0** |
| Code livré au navigateur (`npm audit --omit=dev`) | 0 | **0** |
| Outils de développement (`npm audit`) | 13 (dont 2 critiques) | 7 modérées, risque accepté (§5) |

L'audit tourne maintenant à chaque push et **chaque lundi** : une faille peut apparaître dans une bibliothèque sans que notre code change, comme ici.

### A07 — Identification et authentification

| Point vérifié | État |
|---|---|
| Force brute | 5 essais par minute (email + IP), puis blocage ; chaque blocage est journalisé |
| Énumération des comptes | Même message pour un email inconnu et un mauvais mot de passe, **et même durée de réponse** (Laravel impose une durée minimale, le *timebox*) |
| Fixation de session | Nouvel identifiant de session à chaque connexion |
| Mot de passe client | **Renforcé** : 8 caractères, une lettre, un chiffre ; en production, refus des mots de passe publiés dans une fuite connue (service « Have I Been Pwned » : seuls 5 caractères du hachage quittent le serveur) |
| Mot de passe du propriétaire | 12 caractères, lettres et chiffres, saisi sans affichage |

### A08 — Intégrité des logiciels et des données

- Les versions exactes des bibliothèques sont figées (`composer.lock`, `package-lock.json`) et installées avec `npm ci`.
- Chaque modification est vérifiée par l'intégration continue avant d'être considérée comme bonne.
- Les montants d'une commande sont recalculés par le serveur ; les factures sont numérotées sans trou ; chaque modification de l'ERP est tracée (journal d'audit).
- **À prévoir avec le paiement en ligne** (Wave, Orange Money) : vérifier la **signature** de chaque notification de paiement, et ne jamais croire une page de retour « paiement réussi ». La table `payments` est déjà prête pour l'idempotence (index unique sur la référence du prestataire).

### A09 — Journalisation et surveillance

**Nouveau** : `storage/logs/security-AAAA-MM-JJ.log`, conservé 90 jours, une ligne JSON par événement.

| Événement | Quand |
|---|---|
| `login.failed` | Mot de passe ou email incorrect (email masqué : `m***@client.test`, nombre d'essais) |
| `login.locked` | Blocage après 5 échecs |
| `login.staff` | Connexion d'un membre du personnel (accès à l'ERP) |
| `access.denied` | Action hors permission, ou tentative sur la commande d'un autre client |
| `rate.limited` | Limite anti-abus atteinte |

Le journal ne contient jamais de mot de passe (testé), et l'email y est masqué : il doit permettre d'enquêter sans devenir lui-même une fuite de données personnelles. Pour voir les dernières tentatives :

```bash
tail -n 20 backend/storage/logs/security-$(date +%F).log
```

À compléter à l'étape 11 : une alerte (email) quand les `login.failed` dépassent un seuil.

### A10 — Falsification de requête côté serveur (SSRF)

Le serveur n'appelle jamais une adresse fournie par un utilisateur. Seule exception future : la vérification des mots de passe fuités en production, qui vise une adresse fixe. Non applicable aujourd'hui ; à revoir si l'on ajoute un import d'image par URL.

---

## 3. Zoom : la redirection ouverte

**Le scénario d'attaque.** Le pirate envoie par WhatsApp un lien vers le **vrai** site : `https://dabohair.sn/connexion?redirect=/\faux-dabohair.com`. La cliente se connecte en confiance, puis se retrouve sur le faux site, qui affiche « session expirée, ressaisissez votre mot de passe ».

**Pourquoi la protection ne suffisait pas.** Elle vérifiait le **texte** : « commence par `/` mais pas par `//` ». Or le navigateur, lui, **interprète** l'adresse :

| Adresse | Vérification texte | Ce que fait le navigateur |
|---|---|---|
| `/\faux-dabohair.com` | acceptée | `\` lu comme `/` → **faux-dabohair.com** |
| `/<tab>/faux-dabohair.com` | acceptée | tabulation supprimée → **faux-dabohair.com** |
| `/<retour à la ligne>/faux-dabohair.com` | acceptée | idem → **faux-dabohair.com** |

**La correction.** On demande au navigateur d'interpréter l'adresse (`new URL(valeur, origine du site)`), puis on vérifie que le résultat reste sur le site. **Leçon** : pour valider une donnée, utilisez le **même analyseur** que celui qui l'utilisera, jamais une comparaison de texte « à la main ».

---

## 4. Avant la mise en production : `php artisan app:security-check`

À lancer sur le serveur de production, depuis `backend/`. La commande s'arrête en erreur (code 1) s'il reste un point bloquant, ce qui permet de l'intégrer au script de déploiement de l'étape 11.

```bash
php artisan app:security-check
```

| Contrôle | Bloquant |
|---|---|
| `APP_ENV=production`, `APP_DEBUG=false`, `APP_KEY` générée | oui |
| `APP_URL` en `https://` ; cookie de session HTTPS et HttpOnly | oui |
| Mot de passe de la base différent de ceux de développement | oui |
| Aucun compte de démonstration ; un propriétaire actif existe | oui |
| Journaux sans niveau `debug` ; limites anti-abus par défaut ; CORS limité | conseil |

Sur le poste de développement, la commande signale 6 points bloquants : c'est normal, et c'est la preuve qu'elle fonctionne.

---

## 5. Risques résiduels acceptés

Un audit honnête dit aussi ce qui **n'est pas** corrigé, et pourquoi.

| Risque | Pourquoi il est accepté | À revoir |
|---|---|---|
| 7 alertes modérées dans `minimatch`, utilisé par ESLint (ralentissement possible si un attaquant fournit le motif de fichiers) | Outil de développement, jamais livré ; les motifs sont ceux de notre configuration ; le seul correctif proposé par npm est un retour en arrière de version | À chaque mise à jour de `typescript-eslint` |
| L'inscription révèle si un email a déjà un compte (« déjà utilisé ») | Compromis confort / sécurité courant en e-commerce ; limité à 20 essais par heure et par adresse IP ; la connexion, elle, ne révèle rien | Si des abus apparaissent dans le journal |
| Larastan (analyse statique PHP) non installé | Téléchargement bloqué dans l'environnement de développement | Commande dans `docs/09_TESTS.md` §6 |

---

## 6. Pour l'étape 11 (déploiement)

- Les en-têtes de la **vitrine** (dont sa Content-Security-Policy) seront posés par le serveur web (Nginx).
- Les secrets de production (mot de passe de la base, `APP_KEY`) seront générés sur le serveur, jamais versionnés.
- `app:security-check` sera lancé à chaque déploiement.
- Sauvegardes chiffrées de la base, et test de restauration.
