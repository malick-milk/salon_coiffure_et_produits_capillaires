# Tester le projet sur votre ordinateur

> **Ce qui est testable aujourd'hui (étapes 1 à 4)** : les maquettes, et la base de données avec ses règles et ses KPI.
> Le site React et l'API Laravel arriveront aux étapes 5 et 6 ; ce guide sera complété à ce moment-là.

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
| **DBeaver** (facultatif) | Explorer la base avec une interface graphique | https://dbeaver.io (version Community, gratuite) |

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
   43 tables
4. Cohérence du stock (cache products.stock_quantity = somme du grand livre)
   OK
4b. Cohérence des achats (total du bon = somme des lignes ; reçu = mouvements 'purchase')
   OK
5. Tests d'intégrité
   OK    T01 RG-STK-01 : stock négatif interdit (colonne UNSIGNED)
   ...
   => 22 refusés comme attendu, 0 acceptés à tort
6. Requêtes analytiques
   (16 tableaux de KPI)
Vérification terminée avec succès.
```

| Message | Cause | Solution |
|---|---|---|
| `Conteneur 'salon-mysql' introuvable ou arrêté` | Docker n'est pas lancé, ou `docker compose up -d` pas exécuté | Lancer Docker Desktop, puis `docker compose up -d` |
| `Can't connect to local MySQL server` | MySQL démarre encore | Attendre 30 secondes et relancer |
| `port is already allocated` (au `docker compose up`) | Un autre MySQL utilise déjà le port 3306 sur votre PC | Arrêter cet autre MySQL (XAMPP, WAMP…) |
| Accents mal affichés dans Git Bash | Réglage du terminal | Sans gravité : les données sont correctes en base |

### 2.5 Explorer la base avec DBeaver (recommandé pour un analyste)

1. DBeaver → **Nouvelle connexion** → **MySQL**.
2. Paramètres :
   - Hôte : `127.0.0.1` — Port : `3306`
   - Base : `salon_verify` (la base remplie par `verify.sh`)
   - Utilisateur : `root` — Mot de passe : `root_dev_password`
   - Onglet « Propriétés du pilote » : si une erreur parle de *Public Key Retrieval*, passez `allowPublicKeyRetrieval` à `true`.
3. Ouvrez `database/analytics_queries.sql` dans DBeaver et exécutez les requêtes une par une (Ctrl + Entrée).
4. Clic droit sur la base → **Diagramme ER** : DBeaver dessine toutes les tables et leurs relations.

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

**Exercice 5** — Retrouvez le total de votre commande Dabo Hair à partir des lignes, sans utiliser `total_cost`.
<details><summary>Solution</summary>

```sql
SELECT SUM(packs_ordered) AS douzaines, SUM(quantity_ordered) AS unites, SUM(line_total) AS total
FROM purchase_order_items WHERE purchase_order_id = 1;
```
Résultat attendu : 36 douzaines, 432 unités, 1 374 000.
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
