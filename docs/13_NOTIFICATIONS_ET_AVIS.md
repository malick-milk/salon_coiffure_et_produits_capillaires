# Étape 13 — Messages aux clientes, motif d'annulation et satisfaction

> Statut : **implémenté et testé**. Les SMS et les e-mails sont prêts, mais ils sont écrits dans les journaux tant qu'aucun fournisseur d'envoi n'est branché (§5).

---

## 1. Ce que la cliente reçoit

| Moment | Canal | Contenu | Déclencheur |
|---|---|---|---|
| Réservation en ligne | SMS + e-mail | Demande reçue : prestation, date, référence | `POST /bookings` |
| Le salon confirme | SMS + e-mail | Rendez-vous confirmé | ERP → Planning → « Confirmer » |
| La veille, à 17 h | SMS + e-mail | Rappel, avec le numéro du salon | commande `bookings:remind` (planifiée) |
| **Le salon annule** | **SMS + e-mail** | **Le motif**, des excuses et un lien pour choisir un autre créneau | ERP → Planning → « Annuler… » |
| La cliente annule | SMS + e-mail | Confirmation de l'annulation | Espace client → « Annuler » |
| Lendemain d'une prestation ou d'une livraison, à 10 h | SMS + e-mail | Lien personnel vers l'enquête de satisfaction | commande `surveys:send` (planifiée) |

**Les canaux dépendent des coordonnées connues** : SMS si la cliente a un mobile sénégalais (70, 75, 76, 77, 78), e-mail si elle a donné une adresse. Sans aucun des deux, rien n'est envoyé.

**Le motif d'annulation est obligatoire** (5 caractères au moins) : sans lui, l'ERP refuse l'annulation. La cliente le reçoit par message et le voit aussi dans son espace « Mes réservations », avec un lien pour reprendre rendez-vous.

## 2. Comment ça marche (pour comprendre le code)

```
Action métier (réservation, annulation…)
   │  Notify::customer($cliente, new BookingCancelledBySalon($rdv))
   ▼
File d'attente (table jobs)          ← le message est mis de côté : la page répond tout de suite
   │  traitée chaque minute par le planificateur (cron → schedule:run → queue:work)
   ▼
Canal « mail »  → service d'envoi d'e-mails (MAIL_MAILER)
Canal « sms »   → SmsSender → fournisseur choisi (SMS_DRIVER)
```

| Notion | Où | Pourquoi |
|---|---|---|
| **Notification Laravel** | `app/Notifications/` | Un seul objet décrit le message pour plusieurs canaux (`toSms()`, `toMail()`) |
| **File d'attente** (`ShouldQueue`) | `CustomerNotification` | La cliente n'attend pas l'opérateur SMS ; en cas d'échec, 3 essais espacés (1 min, puis 5 min) |
| **`afterCommit`** | `CustomerNotification` | Le message n'est envoyé qu'une fois la donnée vraiment enregistrée en base |
| **`Notify::customer()`** | `app/Support/Notify.php` | Une panne d'envoi ne fait JAMAIS échouer une réservation : l'erreur est écrite dans le journal |
| **Interface `SmsSender`** | `app/Services/Sms/` | Changer de fournisseur = une classe de plus et une ligne dans `AppServiceProvider`, sans toucher aux messages |
| **Traitement de la file par le planificateur** | `routes/console.php` | Aucun service supplémentaire à surveiller sur le serveur : la tâche cron existante suffit |

Les textes des messages sont dans `app/Notifications/*.php`. **Pour modifier un texte**, changez la phrase dans `toSms()` ou `toMail()`. Un SMS de plus de 160 caractères est découpé et facturé double : le test `test_tous_les_messages_sont_rediges_en_francais` le vérifie.

## 3. L'enquête de satisfaction

| Règle | Pourquoi |
|---|---|
| Envoyée le **lendemain** (pas dans l'heure), au plus tard 7 jours après | La cliente a eu le temps d'apprécier le résultat |
| **Au plus une enquête tous les 14 jours** par cliente | Une cliente fidèle n'est pas harcelée |
| **Lien personnel** de 40 caractères, valable **14 jours**, **une seule réponse** | Pas de compte à créer, et pas de faux avis |
| Seule l'**empreinte SHA-256** du lien est stockée | Une fuite de la base ne permettrait pas de répondre à la place des clientes |
| Note (1 à 5), recommandation de 0 à 10 (facultative), commentaire (facultatif) | 20 secondes suffisent |
| Case « J'accepte que mon avis soit publié » | Sans elle, l'avis reste privé (loi sénégalaise sur les données personnelles) |
| **Toutes les notes peuvent être publiées**, pas seulement les bonnes | Ne proposer la publication qu'aux clientes satisfaites (pratique dite *review gating*) trompe les visiteurs ; Google l'interdit pour ses avis |
| Note de **3 étoiles ou moins** → alerte « À rappeler » dans l'ERP | Le salon rappelle la cliente avant qu'elle parte mécontente |

Sur le site, l'auteur apparaît sous la forme « Aïssatou D. », jamais avec son nom complet ni son téléphone.

## 4. Dans l'ERP : « Avis clients »

Permission `reviews.manage` : propriétaire et gérante.

- **Indicateurs sur 90 jours** : note moyenne, **NPS**, taux de réponse, clientes à rappeler, détail par prestation et par coiffeuse.
- **À modérer** : publier (avec une réponse publique facultative) ou refuser, pour un motif objectif seulement : insultes, données personnelles, publicité, hors sujet. **On ne refuse pas un avis parce qu'il est négatif : on y répond.**
- **À rappeler** : le numéro de la cliente (cliquable sur téléphone) et une case pour noter ce qui a été fait.
- Chaque décision est inscrite au **journal d'audit** (qui, quand, avant et après).

### Le NPS, expliqué

À la question « Recommanderiez-vous Dabo Hair à une amie ? » (de 0 à 10) :
- 9 ou 10 : **promotrices** ; 7 ou 8 : neutres ; 0 à 6 : **détractrices**.
- **NPS = % de promotrices − % de détractrices**, de −100 à +100.
- Exemple : 10 réponses, dont 6 promotrices, 3 neutres et 1 détractrice : 60 % − 10 % = **+50**.
- Repères : au-dessus de 0, plus de clientes recommandent qu'elles ne critiquent ; au-dessus de +50, c'est excellent.

La **note moyenne publique** est calculée sur **toutes** les réponses, publiées ou non : un salon ne peut pas améliorer sa moyenne en ne publiant que les bons avis.

## 5. Brancher un vrai envoi (avant la mise en ligne)

Tant que `SMS_DRIVER=log` et `MAIL_MAILER=log`, les messages sont écrits dans `storage/logs/sms-AAAA-MM-JJ.log` et `storage/logs/laravel.log`. `php artisan app:security-check` affiche alors deux « CONSEIL ».

**E-mails** : un service SMTP (par exemple Brevo, dont la formule gratuite permet environ 300 e-mails par jour), à renseigner dans `.env` :

```
MAIL_MAILER=smtp
MAIL_HOST=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_USERNAME=…
MAIL_PASSWORD=…
MAIL_FROM_ADDRESS="contact@dabohair.com"
```

**SMS** : choisir un fournisseur qui couvre le Sénégal (agrégateur local ou international), puis :
1. écrire une classe `app/Services/Sms/NomDuFournisseurSmsSender.php` qui implémente `SmsSender` (une requête HTTP vers l'API du fournisseur) ;
2. l'ajouter dans `AppServiceProvider` (`'nom' => new NomDuFournisseurSmsSender(...)`) ;
3. mettre `SMS_DRIVER=nom` et la clé du fournisseur dans `.env`, jamais dans le code.

Ce branchement se fera ensemble, une fois le fournisseur choisi : ses tarifs et son API changent selon les fournisseurs.

## 6. En local : voir les messages

1. Lancez la file d'attente dans une troisième fenêtre Git Bash, dans `backend/` :

   ```bash
   php artisan queue:work
   ```

2. Faites une réservation sur le site.
3. Lisez le SMS « envoyé » (Git Bash, dans `backend/`) :

   ```bash
   tail -n 5 storage/logs/sms-$(date +%F).log
   ```

Pour tester l'enquête : `php artisan migrate:fresh --seed` crée 5 avis de démonstration (local uniquement), visibles sur l'accueil et dans l'ERP « Avis clients ».

## 7. Tests

| Fichier | Ce qui est vérifié |
|---|---|
| `tests/Feature/NotificationsTest.php` | Messages envoyés à chaque étape, choix SMS ou e-mail, motif obligatoire, rappel envoyé une seule fois, numéro masqué dans les journaux, panne d'envoi sans effet sur la réservation, longueur des SMS, e-mails en français |
| `tests/Feature/SatisfactionTest.php` | Envoi le lendemain et une seule fois, délai de 14 jours, réponse unique, lien expiré, avis privé sans accord, moyenne honnête, modération, rappel, permissions, journal d'audit, calcul du NPS |
| `tests/Unit/PhoneTest.php` | Format international des numéros (+221) |
| `frontend/src/features/reviews/reviews.test.tsx` | Formulaire accessible (note obligatoire), envoi, message de rappel, lien expiré, affichage des avis |
| `frontend/e2e/parcours-admin.cjs` (étape 7 bis) | Publier un avis avec une réponse, rappeler une cliente mécontente |
