# Tester le projet sur votre ordinateur

> **Ce qui est testable aujourd'hui (étapes 1 à 4)** : les maquettes, et la base de données avec ses règles et ses KPI.
> **Nouveau (étape 5)** : le site React se teste aussi, voir le Test 3 en fin de document.
> **Nouveau (étape 7)** : l'ERP d'administration, voir le Test 4.

Durée : environ 30 minutes la première fois (installations comprises), puis 2 minutes.

---

## Test 1 — Les maquettes (aucune installation)

1. Ouvrez https://claude.ai/artifact/KUfhiWo6RP8ziNSapB9CEa (connecté à votre compte Claude).
2. Déplacez-vous sur le canevas (glisser) et zoomez (molette ou pincement).
3. Sur l'artboard **« 04 — Tunnel de réservation »**, cliquez sur **Play** et réservez :

| À vérifier | Résultat attendu |
|---|---|
| Cliquer sur « Continuer » sans choisir de prestation | Impossible : le bouton est désactivé |
| Choisir « Nattes collées », puis l'étape Coiffeur | Seuls « Peu importe » et Fatou sont proposés (Bineta ne fait pas cette prestation) |
| Regarder les dimanches dans le calendrier | Barrés, impossibles à cliquer (salon fermé) |
| Choisir « Tresses africaines » (3 h), puis un lundi | Pas de créneau entre 10 h 30 et 13 h 30 : la prestation déborderait sur la pause de midi |
| Choisir un samedi | Les créneaux vont plus tard (fermeture à 20 h, sans pause) |
| Observer le panneau de droite | Le récapitulatif se met à jour à chaque choix |

4. Vous pouvez laisser des **commentaires** directement sur le canevas ; je les recevrai.

---

## Test 2 — La base de données

### 2.1 Installer les outils (une seule fois)

| Outil | Rôle | Où le trouver |
|---|---|---|
| **Git** | Récupérer le code | https://git-scm.com — sous Windows, il installe aussi **Git Bash** (terminal où les commandes ci-dessous fonctionnent) |
| **Docker Desktop** | Faire tourner MySQL sans l'installer | https://www.docker.com/products/docker-desktop — lancez-le et attendez « Engine running » |
| **DBeaver** ou **MySQL Workbench** (facultatif) | Explorer la base avec une interface graphique | https://dbeaver.io (Community, gratuite) ou https://dev.mysql.com/downloads/workbench/ |

> **Vous avez XAMPP ?** Son MySQL (en réalité MariaDB) utilise le port **3306**. Le MySQL du projet, dans Docker, utilise le port **3307** : les deux peuvent tourner en même temps. Attention à bien choisir le **port 3307** dans DBeaver ou Workbench, sinon vous serez connecté à la base de XAMPP, qui ne contient pas les tables du projet.
>
> **Pourquoi ne pas utiliser le MySQL de XAMPP ?** XAMPP fournit MariaDB, un « cousin » de MySQL. Certaines fonctionnalités du schéma (colonnes générées, contraintes `CHECK`, type `JSON`) s'y comportent un peu différemment. Le projet cible MySQL 8.4, celui de la production : on développe sur la même version que la production pour éviter les mauvaises surprises.

> **Windows** : utilisez **Git Bash** (clic droit dans un dossier, « Open Git Bash here ») pour toutes les commandes. Si Docker demande d'activer WSL 2, acceptez et redémarrez.

### 2.2 Récupérer le projet

```bash
git clone https://github.com/malick-milk/salon_coiffure_et_produits_capillaires.git
```

```bash
cd salon_coiffure_et_produits_capillaires
```

### 2.3 Démarrer MySQL, Redis et Mailpit

```bash
docker compose up -d
```

La première fois, Docker télécharge les images (quelques minutes). Vérifiez ensuite que tout tourne :

```bash
docker compose ps
```

La colonne `STATUS` doit afficher `Up` pour `salon-mysql`, `salon-redis` et `salon-mailpit` (MySQL met environ 30 secondes à être prêt).

### 2.4 Lancer la vérification automatique

```bash
bash database/verify.sh
```

**Résultat attendu** (extrait) :

```
1. Base neuve 'salon_verify'
2. Schéma
3. Données de démo
   45 tables
4. Cohérence du stock (cache products.stock_quantity = somme du grand livre)
   OK
4b. Cohérence des achats (total du bon = somme des lignes ; reçu = mouvements 'purchase')
   OK
4c. Cohérence de la production (coût du lot = somme de ses postes de coût)
   OK
5. Tests d'intégrité
   OK    T01 RG-STK-01 : stock négatif interdit (colonne UNSIGNED)
   ...
   => 27 refusés comme attendu, 0 acceptés à tort
6. Requêtes analytiques
   (18 tableaux de KPI)
Vérification terminée avec succès.
```

| Message | Cause | Solution |
|---|---|---|
| `Conteneur 'salon-mysql' introuvable ou arrêté` | Docker n'est pas lancé, ou `docker compose up -d` pas exécuté | Lancer Docker Desktop, puis `docker compose up -d` |
| `Can't connect to local MySQL server` | MySQL démarre encore | Attendre 30 secondes et relancer |
| `port is already allocated` (au `docker compose up`) | Un autre programme utilise déjà le port 3307 | Choisir un autre port : `DB_PORT=3308 docker compose up -d` (et utiliser 3308 dans DBeaver ou Workbench) |
| Accents mal affichés dans Git Bash | Réglage du terminal | Sans gravité : les données sont correctes en base |

### 2.5 Explorer la base avec DBeaver ou MySQL Workbench

**DBeaver** (recommandé pour un analyste)

1. DBeaver → **Nouvelle connexion** → **MySQL**.
2. Paramètres :
   - Hôte : `127.0.0.1` — Port : **`3307`**
   - Base : `salon_verify` (la base remplie par `verify.sh`)
   - Utilisateur : `root` — Mot de passe : `root_dev_password`
   - Onglet « Propriétés du pilote » : si une erreur parle de *Public Key Retrieval*, passez `allowPublicKeyRetrieval` à `true`.
3. Ouvrez `database/analytics_queries.sql` dans DBeaver et exécutez les requêtes une par une (Ctrl + Entrée).
4. Clic droit sur la base → **Diagramme ER** : DBeaver dessine toutes les tables et leurs relations.

**MySQL Workbench**

1. Écran d'accueil → bouton **+** à côté de « MySQL Connections ».
2. Connection Name : `Salon (Docker)` — Hostname : `127.0.0.1` — Port : **`3307`** — Username : `root`.
3. **Store in Vault** → mot de passe `root_dev_password` → **Test Connection** → **OK**.
4. Ouvrez la connexion, double-cliquez sur `salon_verify` dans le panneau **Schemas** (elle passe en gras = base active).
5. **File → Open SQL Script** → `database/analytics_queries.sql` → exécutez une requête avec l'éclair à curseur (Ctrl + Entrée).
6. **Database → Reverse Engineer** sur `salon_verify` : Workbench génère le diagramme de toutes les tables (l'équivalent du MLD de Looping).

> Ces identifiants sont ceux de **développement** (fichier `docker-compose.yml`). En production, ils seront différents et secrets (étape 11).

### 2.6 Exercices pour vous entraîner

Écrivez ces requêtes vous-même, puis comparez avec la solution (cliquez pour l'afficher).

**Exercice 1** — Combien de réservations par statut ?
<details><summary>Solution</summary>

```sql
SELECT status, COUNT(*) AS nb FROM bookings GROUP BY status ORDER BY nb DESC;
```
</details>

**Exercice 2** — Chiffre d'affaires produits par canal (en ligne / boutique), commandes payées uniquement.
<details><summary>Solution</summary>

```sql
SELECT channel, COUNT(*) AS commandes, SUM(total) AS ca
FROM orders WHERE payment_status = 'paid'
GROUP BY channel;
```
Résultat attendu : `online` 4 commandes / 65 500 · `store` 2 commandes / 20 000.
</details>

**Exercice 3** — Historique complet du stock de l'huile de ricin (produit 1), dans l'ordre.
<details><summary>Solution</summary>

```sql
SELECT created_at, type, quantity, stock_after, reason
FROM stock_movements WHERE product_id = 1 ORDER BY created_at;
```
La dernière ligne doit indiquer `stock_after = 31`, égal à `products.stock_quantity`.
</details>

**Exercice 4** — Essayez de casser une règle : insérer une 2ᵉ réservation active pour Fatou le 21 mars 2026 à 10 h.
<details><summary>Solution</summary>

```sql
INSERT INTO bookings (reference, customer_id, service_id, stylist_id, status, starts_at, ends_at, service_name, duration_minutes, price)
VALUES ('RDV-TEST', 4, 2, 1, 'pending', '2026-03-21 10:00:00', '2026-03-21 11:45:00', 'Nattes collées', 90, 12000);
```
MySQL refuse : `Duplicate entry ... for key 'bookings_stylist_active_slot_unique'`. Changez `'pending'` en `'cancelled'` : l'insertion passe, car une réservation annulée ne bloque pas le créneau.
</details>

**Exercice 5** — Retrouvez le total de la commande Dabo Hair (commande n° 9) à partir de ses lignes, et le nombre de douzaines.
<details><summary>Solution</summary>

```sql
SELECT SUM(quantity) AS unites, SUM(quantity) / 12 AS douzaines, SUM(line_total) AS total
FROM order_items WHERE order_id = 9;
```
Résultat attendu : 432 unités, 36 douzaines, 1 374 000.
</details>

### 2.7 Arrêter les services

```bash
docker compose down
```

Les données de la base `salon` sont conservées (volume Docker). Pour tout effacer et repartir de zéro :

```bash
docker compose down -v
```

---

## Ce que vous me renvoyez

Pour valider l'étape, indiquez-moi simplement :
1. Le résultat de `bash database/verify.sh` (la dernière ligne suffit, ou le message d'erreur complet).
2. Vos remarques sur les maquettes (design, textes, parcours, éléments manquants).
3. Vos réponses aux questions métier encore ouvertes (voir [ARCHITECTURE.md, ADR-011](../ARCHITECTURE.md)), si vous souhaitez changer une hypothèse.

---

## Test 3 — Le site React (étape 5)

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

Ouvrez http://localhost:5173. Par défaut (`VITE_ENABLE_MOCKS=false` dans `.env.example`), le site interroge la **vraie API Laravel** : lancez aussi `php artisan serve` dans `backend/` (voir le Test 4). Sans PHP, mettez `VITE_ENABLE_MOCKS=true` dans `.env.local` : le faux serveur répond alors à la place de Laravel.

| À essayer | Résultat attendu |
|---|---|
| Boutique → filtre « Sérums » | 3 produits ; l'URL contient `?category=serums` |
| Crème capillaire | En rupture (96 fabriquées, 96 vendues au revendeur) : bouton désactivé |
| Fiche du sérum 30 ml → « 15 ml » | Le prix passe à 1 500 F CFA |
| Panier → Valider la commande → Livraison | Zone et adresse deviennent obligatoires ; les frais s'ajoutent au total |
| Réserver → Nattes collées | Bineta n'est pas proposée |
| Connexion `mariama@client.test` / `demo-dabo-2026` | Accès à l'espace client : commandes, réservations, profil |
| 6 connexions ratées de suite | La 6e est bloquée pendant 1 minute |

**Remettre la démo à zéro** : outils de développement du navigateur (F12) → Application → Local Storage → supprimer `msw-db-v1` et `msw-session-user-id`.

---

## Test 4 — L'ERP d'administration (étape 7)

Il faut la vraie API Laravel (voir [docs/06_BACKEND.md](06_BACKEND.md) pour la première installation). Dans trois fenêtres Git Bash :

```bash
docker compose up -d
```

```bash
cd backend && php artisan migrate:fresh --seed && php artisan serve
```

```bash
cd frontend && npm run dev
```

Vérifiez que `frontend/.env.local` contient `VITE_ENABLE_MOCKS=false` (valeur par défaut ; avec `true`, le faux serveur, qui ne connaît pas l'ERP, répond à la place de Laravel).

Connectez-vous sur http://localhost:5173/connexion avec `admin@dabohair.test` / `admin-dabo-2026` : vous arrivez sur `/admin`.

| À essayer | Résultat attendu |
|---|---|
| Tableau de bord | Alerte « Crème capillaire · rupture de stock » |
| Commandes → CMD-2026-000102 → Mettre en préparation → Prête à retirer | Les boutons changent à chaque étape (seules les transitions permises sont proposées) |
| Encaisser avec Wave | « Paiement enregistré, facture émise » et lien Facture FAC-2026-000001 (PDF) |
| Produits et stock → Stock (shampooing) → Perte de 2 avec un motif | Stock 48 → 46, ligne ajoutée au grand livre |
| Fabrication → Spray anti-chute, 96 unités, postes 15 000 + 10 000 | Coût de revient 260,42 F par unité ; la marge apparaît dans Produits |
| Équipe → créer un caissier, puis se reconnecter avec ce compte | Pas de chiffre d'affaires, pas de menu Équipe ni Audit |
| Journal d'audit | Toutes vos actions, avec l'auteur et les valeurs avant / après |
| Se connecter avec `mariama@client.test` puis ouvrir `/admin` | « Accès réservé au personnel » |

**Le mot de passe administrateur est refusé ?**

| Symptôme | Cause | Solution |
|---|---|---|
| Pastille brune « Faux serveur (MSW) actif » en bas à gauche | `frontend/.env.local` contient `VITE_ENABLE_MOCKS=true` (copié à l'étape 5) : le faux serveur ne connaît que Mariama | Mettre `VITE_ENABLE_MOCKS=false`, arrêter `npm run dev` (Ctrl + C) et le relancer : Vite ne relit ce fichier qu'au démarrage |
| « Ces identifiants ne correspondent à aucun compte » sans pastille | Base remplie avant la création du compte, ou mot de passe mal saisi | Dans `backend/` : `php artisan migrate:fresh --seed`, puis réessayer |
| « Trop de tentatives » | 5 essais ratés en une minute (protection anti force brute) | Attendre une minute |
| Aucune ligne `/api/v1/auth/login` n'apparaît dans la fenêtre de `php artisan serve` ; Vite affiche `http proxy error … ECONNREFUSED ::1:8000` | Le proxy de Vite visait « localhost », que Windows traduit en IPv6 (`::1`), alors que Laravel écoute en IPv4 (`127.0.0.1`) | Corrigé dans `vite.config.ts` : `git pull`, puis relancer `npm run dev` |
| « Erreur réseau » | `php artisan serve` n'est pas lancé | Le lancer dans une autre fenêtre |
| Connexion acceptée mais on redevient déconnecté | Site ouvert via `http://127.0.0.1:5173` : le cookie de session est réglé pour `localhost` | Toujours ouvrir `http://localhost:5173` |

**Parcours automatique** (après `php artisan migrate:fresh --seed`) :

```bash
cd frontend && node e2e/parcours-admin.cjs ./captures
```

Résultat attendu : 25 lignes `OK`, et les captures d'écran dans `frontend/captures/`.
