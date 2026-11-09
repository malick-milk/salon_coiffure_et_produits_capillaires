# ÉTAPE 11 — Mise en production : dabohair.com

> **Statut** : prête. Scripts écrits et **testés de bout en bout** sur un Ubuntu 24.04 neuf (simulé par un conteneur), voir §9.
> **À faire de votre côté** : acheter le domaine et le serveur (§1), puis suivre §3 à §6, environ 1 heure la première fois.
> **Coût estimé** : environ **7 000 F CFA par mois** (serveur + domaine + sauvegarde hors serveur).

---

## 1. Les conseils avant de choisir

### 1.1 Le nom de domaine

**Recommandation : `dabohair.com`, acheté chez Cloudflare Registrar ou Porkbun.**

| Bureau d'enregistrement | Prix d'un .com par an (renouvellement) | Pour | Contre |
|---|---|---|---|
| **Cloudflare Registrar** | environ 10,5 à 11 $ (prix coûtant, sans marge) | Le moins cher dans la durée ; DNS rapide et gratuit ; protection DDoS ; données personnelles masquées gratuitement | Interface en anglais ; il faut utiliser le DNS de Cloudflare |
| **Porkbun** | environ 11 $ | Prix identique la 1ʳᵉ année et ensuite ; masquage des données gratuit ; très simple | Interface en anglais |
| GoDaddy et similaires | environ 23 $ | Publicité, support téléphonique | Prix d'appel la 1ʳᵉ année, renouvellement deux fois plus cher |

**Le piège à éviter** : le prix « 1 $ la première année ». Comparez toujours le prix du **renouvellement**, que vous paierez chaque année.

**Vérifier que dabohair.com est libre** : tapez-le dans la recherche du bureau d'enregistrement choisi. Je n'ai pas pu le vérifier moi-même : l'annuaire des domaines n'est pas joignable depuis mon environnement.

**Et `dabohair.sn` ?** C'est un bon complément **plus tard**, pas un remplacement :
- il coûte entre 15 000 et 35 000 F CFA par an selon le bureau agréé ;
- il est réservé aux entités enregistrées : il faudra le RCCM et le NINEA de l'entreprise, déjà prévus sur la facture (`[À RENSEIGNER]`) ;
- il protège la marque au Sénégal : personne d'autre ne pourra l'acheter. On le fera rediriger vers `dabohair.com`.

### 1.2 L'hébergeur

**Le besoin** : un serveur virtuel (VPS) avec **2 processeurs, 4 Go de mémoire et au moins 40 Go de disque**, sous Ubuntu 24.04. C'est largement suffisant pour des centaines de commandes par jour.

| Option | Prix indicatif (2026) | Pour | Contre |
|---|---|---|---|
| **OVHcloud VPS** (France : Gravelines, Roubaix, Strasbourg) — **recommandé** | environ 4,50 à 7,80 € HT par mois, selon la gamme | Entreprise française : interface, support et factures en **français** ; données en Europe ; bon débit vers l'Afrique de l'Ouest | Prix en hausse en 2026 ; support parfois lent |
| Hetzner Cloud (Allemagne, Finlande) | environ 6 € par mois, mais plusieurs hausses en 2026 et des offres d'entrée indisponibles | Très fiable et très bon rapport performance/prix | Interface en anglais ; un peu plus loin de Dakar |
| Centre de données à Dakar (Onix, PAIX) | sur devis | Latence la plus faible pour vos clientes | Offres surtout pour les grandes entreprises (« colocation »), pas de petit VPS en libre-service. À reconsidérer quand l'activité grandira |

**Pourquoi l'Europe ?** Dakar est reliée à l'Europe par plusieurs câbles sous-marins (ACE, SAT-3, MainOne, SHARE, et 2Africa en cours). Un serveur en France répond typiquement en **100 à 200 ms** depuis Dakar : c'est imperceptible pour un site de ce type, d'autant que les fichiers du site sont mis en cache par le navigateur (§2). Mesurez vous-même avant de choisir :

```bash
ping -n 10 gra.proof.ovh.net
```

**Mes conseils** :
1. Prenez le serveur **chez OVHcloud, en France**, avec **Ubuntu 24.04**.
2. Ajoutez votre **clé SSH** à la commande (§3.1) : c'est plus sûr qu'un mot de passe.
3. Il vous faut une **carte bancaire internationale** (Visa ou Mastercard), car ces fournisseurs n'acceptent pas Wave ni Orange Money.
4. Engagez-vous au mois au début ; passez à l'engagement annuel (environ 15 % de remise) quand tout fonctionne.

### 1.3 Budget mensuel

| Poste | Coût |
|---|---|
| Serveur VPS | 6 à 9 € TTC (4 000 à 6 000 F CFA) |
| Domaine .com (11 $ par an) | environ 600 F CFA |
| Copie des sauvegardes hors du serveur (stockage objet, quelques Go) | moins de 1 € (500 F CFA) |
| Certificat HTTPS (Let's Encrypt), surveillance (UptimeRobot) | gratuit |
| **Total** | **environ 7 000 F CFA par mois** |

Le taux euro / franc CFA est fixe : 1 € = 655,957 F CFA.

---

## 2. Comment le site fonctionnera en production

```
Cliente (Dakar, 4G)
        │  https://dabohair.com
        ▼
┌──────────────────────── Serveur Ubuntu 24.04 (VPS) ─────────────────────────┐
│  Pare-feu : seuls 22 (SSH), 80 et 443 ouverts · fail2ban · mises à jour auto │
│                                                                              │
│  Nginx (HTTPS Let's Encrypt, en-têtes de sécurité, compression)              │
│     ├── /           → site React déjà construit (fichiers statiques, cache)  │
│     └── /api, /up   → PHP 8.3-FPM → Laravel → MySQL 8.0 (127.0.0.1 seulement) │
│                                                                              │
│  /var/www/dabohair/                                                          │
│     ├── current ──► releases/20261105-101500   (lien vers la version active) │
│     ├── releases/   (les 5 dernières versions : retour arrière en 1 seconde) │
│     └── shared/     (.env avec les secrets, storage : journaux, sessions)    │
│                                                                              │
│  Chaque minute : planificateur Laravel · Chaque nuit, 2 h 15 : sauvegarde    │
└──────────────────────────────────────────────────────────────────────────────┘
```

Le site et l'API sont servis à **la même adresse** : pas de CORS à gérer, et une seule configuration HTTPS.

---

## 3. Première mise en ligne, pas à pas

### 3.1 Créer votre clé SSH (sur votre ordinateur, dans Git Bash)

Une **clé SSH** remplace le mot de passe : un fichier secret sur votre ordinateur, et sa moitié publique sur le serveur. Impossible à deviner, contrairement à un mot de passe.

```bash
ssh-keygen -t ed25519 -C "dabohair"
```

Appuyez sur Entrée pour l'emplacement proposé, puis choisissez une phrase de passe. Affichez la partie **publique** et copiez-la dans le formulaire de commande du serveur :

```bash
cat ~/.ssh/id_ed25519.pub
```

> Ne communiquez **jamais** le fichier `id_ed25519` (sans `.pub`) : c'est la clé de votre serveur.

### 3.2 Faire pointer le domaine vers le serveur (DNS)

Dans l'espace de votre bureau d'enregistrement, rubrique DNS, créez deux enregistrements de type **A** vers l'adresse IP du serveur (dans l'espace client de l'hébergeur) :

| Type | Nom | Valeur |
|---|---|---|
| A | `@` (= dabohair.com) | adresse IPv4 du serveur |
| A | `www` | la même adresse |

Chez Cloudflare, laissez le nuage **gris** (« DNS only ») pendant l'installation, pour que Let's Encrypt puisse délivrer le certificat. Vérifiez au bout de quelques minutes (la propagation peut prendre jusqu'à une heure) :

```bash
nslookup dabohair.com
```

### 3.3 Préparer le serveur (une seule fois)

Connectez-vous au serveur, en remplaçant l'adresse par la vôtre :

```bash
ssh root@ADRESSE_IP_DU_SERVEUR
```

Puis, sur le serveur :

```bash
git clone https://github.com/malick-milk/salon_coiffure_et_produits_capillaires.git
```

```bash
sudo bash salon_coiffure_et_produits_capillaires/deploy/provision.sh dabohair.com contact@dabohair.com
```

Le script installe et configure tout en une dizaine de minutes :
- les mises à jour de sécurité automatiques ;
- l'utilisateur `dabo` ;
- PHP 8.3, Nginx, MySQL 8.0, Node 22 et Composer ;
- la base de données, avec un mot de passe **généré sur le serveur** ;
- le fichier `.env` de production ;
- le pare-feu, fail2ban et SSH par clé uniquement ;
- le certificat HTTPS ;
- les tâches planifiées et les sauvegardes.

### 3.4 Première version du site

```bash
sudo -u dabo bash salon_coiffure_et_produits_capillaires/deploy/deploy.sh --first
```

Le script crée les tables, installe les données de référence (rôles, prestations, horaires, catalogue Dabo Hair), puis **vous demande vos identifiants de propriétaire**. Ce seront ceux de l'ERP : 12 caractères minimum, avec des lettres et des chiffres.

La mise en ligne n'a lieu que si `app:security-check` affiche **« Configuration prête pour la production »**.

### 3.5 Copier la clé des sauvegardes en lieu sûr

Les sauvegardes sont chiffrées. **Sans cette clé, elles sont illisibles**, y compris pour vous.

```bash
sudo cat /etc/dabohair/backup.key
```

Copiez-la dans un gestionnaire de mots de passe (Bitwarden, par exemple), ou imprimez-la et rangez-la. Ne la laissez jamais **seulement** sur le serveur.

### 3.6 Vérifier

Ouvrez **https://dabohair.com** : le cadenas doit apparaître. Connectez-vous à l'ERP, puis lancez le bilan de santé :

```bash
bash /var/www/dabohair/current/deploy/sante.sh
```

---

## 4. Jour 1 : avant d'annoncer le site

1. **Inventaire réel.** Le catalogue est installé avec ses prix et coûts, mais le stock doit refléter les étagères. Dans ERP → Produits et stock, enregistrez un « Ajustement d'inventaire » par produit.
2. **Personnel.** Créez les comptes dans ERP → Équipe et rôles (caissière, coiffeuses…), un par personne, jamais de compte partagé.
3. **Coûts manquants.** Saisissez les lots du spray anti-chute, de l'hydratant 100 ml et du sérum 15 ml dans ERP → Fabrication.
4. **Facture.** Renseignez l'identité légale imprimée sur chaque facture, depuis `/var/www/dabohair/current/backend` :

   ```bash
   php artisan app:company --ninea="VOTRE NINEA" --rccm="VOTRE RCCM" --address="Adresse, Dakar" --phone="77 000 00 00"
   ```

   Sans option, la commande affiche les valeurs actuelles.
5. **Surveillance.** Créez un compte gratuit sur [UptimeRobot](https://uptimerobot.com), avec un moniteur HTTPS sur `https://dabohair.com/up` toutes les 5 minutes. Vous recevrez un email si le site tombe.
6. **Restauration.** Testez une restauration (§6.2) : elle doit marcher **avant** le jour où vous en aurez besoin.
7. **Deux utilisateurs MySQL (décidé le 9 novembre).** Le site n'utilise qu'un utilisateur limité aux lignes (`SELECT, INSERT, UPDATE, DELETE`). Un second utilisateur, réservé à `deploy.sh`, applique les migrations. Ainsi, une faille dans le site ne pourrait jamais supprimer une table. Explication : [10_SECURITE.md §7](10_SECURITE.md). Nous le faisons ensemble, au moment de préparer le serveur.
8. **Envoi réel des messages.** Choisissez le service d'e-mails et le fournisseur de SMS, puis vérifiez que `php artisan app:security-check` n'affiche plus les deux « CONSEIL » sur les SMS et les e-mails ([13_NOTIFICATIONS_ET_AVIS.md §5](13_NOTIFICATIONS_ET_AVIS.md)).

---

## 5. Mettre à jour le site

Après chaque modification envoyée sur GitHub (et une intégration continue au vert), connectez-vous en `dabo` et lancez :

```bash
ssh dabo@dabohair.com
```

```bash
bash /var/www/dabohair/current/deploy/deploy.sh
```

Ce que fait le script, dans l'ordre :

1. Il récupère le code et installe les bibliothèques.
2. Il construit le site React.
3. Il **sauvegarde la base**, puis applique les migrations.
4. Il optimise et lance le contrôle de sécurité.
5. Il **bascule** vers la nouvelle version.
6. Il vérifie que `/up` répond. Si ce n'est pas le cas, il **revient automatiquement** à la version précédente.

Tant que la bascule n'a pas eu lieu, le site tourne sur l'ancienne version : aucune cliente ne voit un site à moitié installé.

**Revenir à la version précédente** à la main, par exemple si un bug est découvert après coup :

```bash
bash /var/www/dabohair/current/deploy/rollback.sh
```

> **Règle d'or des migrations** : une migration doit rester compatible avec la version précédente du code (ajouter une colonne plutôt que la renommer, par exemple). Le retour arrière ramène le code, pas la structure de la base.

---

## 6. Sauvegardes

### 6.1 Ce qui est en place

- **Quand** : chaque nuit à 2 h 15, **et** avant chaque déploiement.
- **Comment** : `mysqldump` cohérent, sans arrêter le site, puis compression, puis chiffrement AES-256.
- **Où** : `/var/backups/dabohair/`, 14 jours conservés.
- **Hors du serveur (fortement conseillé)** : si le serveur disparaît, ses sauvegardes disparaissent avec lui. Configurez [rclone](https://rclone.org) vers un stockage objet (OVHcloud Object Storage, Backblaze B2), puis ajoutez `BACKUP_REMOTE=nom:dossier` dans `/etc/cron.d/dabohair`.

C'est la **règle 3-2-1** : 3 copies, sur 2 supports, dont 1 hors du site.

### 6.2 Tester une restauration (une fois par mois)

```bash
bash /var/www/dabohair/current/deploy/restore.sh
```

La dernière sauvegarde est restaurée dans une base d'**essai** (`dabohair_restore_test`), et le script affiche le nombre de produits, de commandes et de rendez-vous retrouvés. La vraie base n'est pas touchée.

**Restaurer pour de vrai** (après une erreur grave), avec confirmation demandée et sauvegarde préalable de l'état actuel :

```bash
bash /var/www/dabohair/current/deploy/restore.sh /var/backups/dabohair/FICHIER.sql.gz.enc --production
```

---

## 7. Sécurité du serveur

| Mesure | Effet |
|---|---|
| SSH par clé uniquement, mots de passe refusés | Les robots qui testent des mots de passe en boucle n'ont aucune chance |
| fail2ban | Une adresse IP qui échoue 5 fois en SSH est bannie |
| Pare-feu (ufw) : 22, 80, 443 | MySQL n'est **pas** joignable depuis Internet |
| Mises à jour de sécurité automatiques | Les failles du système sont corrigées chaque nuit |
| Utilisateur `dabo` aux droits limités | Le déploiement ne tourne jamais en root ; `dabo` peut seulement recharger PHP et Nginx |
| Secrets générés sur le serveur | Le mot de passe de la base, la clé de chiffrement et la clé des sauvegardes n'existent nulle part ailleurs, ni dans Git ni dans la documentation |
| `.env` en `640` | Lisible par PHP, invisible pour les autres utilisateurs |
| HTTPS forcé, HSTS, CSP | Voir [10_SECURITE.md](10_SECURITE.md) |
| Polices hébergées sur le serveur (plus de Google Fonts) | Aucune adresse IP de visiteur envoyée à un tiers ; une connexion de moins depuis Dakar |

---

## 8. Plus tard (quand le besoin apparaîtra)

- **Déploiement automatique** depuis GitHub Actions : la CI se connecte en SSH et lance `deploy.sh` quand tout est vert. À mettre en place quand les mises à jour deviendront fréquentes.
- **Email professionnel** `contact@dabohair.com` : Zoho Mail (offre gratuite pour quelques adresses) ou l'offre email de l'hébergeur, avec les enregistrements DNS MX, SPF et DKIM pour ne pas tomber dans les indésirables.
- **Paiement en ligne** (Wave, Orange Money) : prévoir la vérification des signatures des notifications ([10_SECURITE.md](10_SECURITE.md), A08).
- **Serveur plus puissant** : surveiller la mémoire et le disque dans `sante.sh`. Chez OVHcloud, passer à l'offre supérieure prend quelques minutes.

---

## 9. Comment ces scripts ont été testés

Les scripts ont été exécutés sur un **Ubuntu 24.04 neuf** (une image officielle dans un conteneur), exactement comme vous le ferez. Seuls le certificat HTTPS (il faut un vrai domaine qui pointe vers le serveur), le pare-feu et SSH ne s'appliquent pas à un conteneur.

### 9.1 Résultats

| Scénario | Résultat |
|---|---|
| `provision.sh` sur un Ubuntu 24.04 vierge | Réussi ; **relancé deux fois** sans rien casser (le `.env` et ses secrets sont conservés) |
| Fichiers secrets | `.env`, clé des sauvegardes et mot de passe de la base en `640`, lisibles seulement par les bons comptes |
| `deploy.sh --first` | Tables, données de référence et compte du propriétaire créés ; **`app:security-check` : 12/12** « Configuration prête pour la production » |
| Mise à jour (`deploy.sh`) | Sauvegarde **avant** migration, bascule atomique, `/up` vérifié |
| Navigateur en HTTPS (Chromium) | Commande d'une invitée, connexion de la propriétaire, ERP, graphiques : **8/8**, aucune requête vers un autre domaine, **aucun blocage par la CSP** |
| Cookies | Session `secure` + `httponly` + `samesite=lax` ; jeton CSRF `secure` |
| Fichiers sensibles | `/.env`, `/backend/.env` → 404 |
| Sauvegarde | Chiffrée (en-tête `Salted__` d'OpenSSL : gzip lui-même ne peut pas la lire) ; **restauration réussie** dans la base d'essai |
| Retour arrière | Bascule en une seconde, dans les deux sens ; le site reste en ligne |
| Bilan de santé `sante.sh` | Tous les points au vert |
| Tâches planifiées (compte `www-data`) | Agrégats analytiques calculés ; journaux partagés accessibles en écriture |

### 9.2 Ce que ce test a permis de corriger avant votre mise en ligne

1. **Sauvegarde vide sans erreur.** Dans `A || B | gzip | openssl`, la barre `|` est prioritaire sur `||`. Si la première commande réussissait, la copie partait à l'écran, sans compression ni chiffrement. La commande est maintenant unique, avec `pipefail`.
2. **`sudo` absent** sur certaines images Ubuntu minimales : il est maintenant installé par le script.
3. **Serveur sans IPv6** : Nginx refusait de démarrer sur `[::]:80`. Le script détecte l'IPv6 et ne l'active que s'il existe.
4. **Nginx non démarré** : `reload || start` ne démarre pas toujours un Nginx arrêté. Le script vérifie l'état d'abord.
5. **Réglages PHP non appliqués** : ils ne prennent effet qu'au redémarrage de PHP-FPM, qui est désormais fait.
6. **Erreur 500 sur une route protégée** appelée sans en-tête `Accept: application/json` (robot, adresse tapée à la main) : Laravel cherchait une page `login` qui n'existe pas. La réponse est maintenant un **401** propre (test ajouté).
7. **Faux « MySQL arrêté »** dans le bilan de santé (manque de droits du compte `dabo`) : c'est le processus qui est vérifié.
8. **Apostrophe dans un texte entre apostrophes** dans `verifier-tout.sh`, repérée par ShellCheck, désormais exécuté par l'intégration continue sur tous les scripts.

**MySQL 8.0** (la version d'Ubuntu 24.04) a aussi passé les 117 tests du backend. L'intégration continue teste maintenant MySQL 8.0 **et** 8.4.
