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

## 6 bis. Rappels de resserrage et rubrique « Notifications » (16 novembre 2026)

Maquette validée le 16 novembre (canevas, « Rappels de resserrage »). **Pas de SMS** pour ces rappels : leur coût sera présenté plus tard.

**Ce que voit la cliente**
- une **cloche** dans l'en-tête, avec le nombre de messages non lus ;
- la rubrique **Notifications** de son espace client : le rappel « Votre resserrage approche » en tête, puis les autres messages du salon (rendez-vous confirmé, commande prête…) ;
- la même carte en tête de la **vue d'ensemble** pendant un mois ;
- un **e-mail** si son adresse est connue, aux couleurs de la boutique, avec un lien « Ne plus recevoir les rappels de resserrage ».

**Les règles** (`app/Services/Salon/ResserrageReminderService.php`, commande `bookings:resserrage`, chaque jour à 9 h 30)

| Règle | Pourquoi |
|---|---|
| Un rappel part X jours après un twist **terminé** (statut mis dans l'ERP) | Le délai dépend du twist : il est fixé par Awa |
| Délai vide = aucun rappel | Pas de conseil inventé tant qu'Awa n'a pas donné ses délais |
| Un seul rappel par twist | Un rappel qui revient tous les jours fait fuir |
| Rien si la cliente a déjà réservé un resserrage depuis | Le rappel n'aurait plus de sens |
| « Me le rappeler dans 1 semaine » : une seule fois | Le rappel revient 7 jours plus tard, puis plus jamais |
| « Réserver mon resserrage » ouvre `/reserver?prestation=…` avec le bon resserrage déjà choisi | Un clic de moins |
| Lien de désinscription **signé** dans chaque e-mail | Obligatoire ; la signature empêche de désinscrire une autre cliente en changeant le numéro dans l'adresse |
| Cliente sans compte : invitation à créer un compte après sa réservation, formulaire pré-rempli | Sans compte, pas de profil ; à l'inscription, ses réservations passées sont rattachées (même téléphone) |

**Délai d'Awa (27 novembre 2026) : 2 mois (60 jours) pour tous les twists.** Le rappel part **7 jours avant** la date conseillée (`ResserrageReminderService::REMIND_DAYS_BEFORE`), pour laisser le temps de réserver. Pour changer un délai : dans `backend/database/seeders/ReferenceDataSeeder.php`, la constante `RESSERRAGE` (par exemple `'micro-twist-long' => ['resserrage-micro-twist', 60]`), puis :

```bash
php artisan db:seed --class=ReferenceDataSeeder
```

**Les autres messages arrivent aussi dans le profil** (canal `database` de Laravel, table `notifications`) quand la cliente a un compte. Exception volontaire : le message de l'enquête de satisfaction n'y recopie **pas** le lien personnel. Son secret n'est gardé en base que sous forme d'empreinte (§3). Le recopier en clair dans la table des notifications annulerait cette protection.

**La cliente connaît la date dès la réservation** (maquette validée le 27 novembre 2026) : écran de confirmation (« Resserrage conseillé vers le … », bouton « Ajouter à mon agenda » qui enregistre un fichier `.ics` avec une alarme 7 jours avant), e-mails de demande et de confirmation du rendez-vous, et « Mes réservations » (date, nombre de jours restants, « Réserver mon resserrage » pour un twist réalisé). Calcul : `App\Support\Resserrage` (serveur) et `src/lib/resserrage.ts` (site).

**La devise dans les e-mails et les factures** : « Vos cheveux à l'état pur · Your hair in the pure state. » est sous le logo, sur le fond noir de l'en-tête de **tous** les e-mails (`resources/views/vendor/mail/html/header.blade.php`), et sur chaque facture PDF : logo, nom, devise, puis « Merci de votre confiance. Vos cheveux à l'état pur. » en bas (`resources/views/pdf/invoice.blade.php`).

**En local** : la démo donne à Mariama un twist fait il y a 55 jours ; conseillé à 60 jours, le rappel est donc déjà parti. Connectez-vous avec `mariama@client.test` : la cloche affiche 1. Les e-mails s'affichent dans Mailpit, http://localhost:8025.

## 7. Tests

| Fichier | Ce qui est vérifié |
|---|---|
| `tests/Feature/NotificationsTest.php` | Messages envoyés à chaque étape, choix SMS ou e-mail, motif obligatoire, rappel envoyé une seule fois, numéro masqué dans les journaux, panne d'envoi sans effet sur la réservation, longueur des SMS, e-mails en français |
| `tests/Feature/SatisfactionTest.php` | Envoi le lendemain et une seule fois, délai de 14 jours, réponse unique, lien expiré, avis privé sans accord, moyenne honnête, modération, rappel, permissions, journal d'audit, calcul du NPS |
| `tests/Unit/PhoneTest.php` | Format international des numéros (+221) |
| `frontend/src/features/reviews/reviews.test.tsx` | Formulaire accessible (note obligatoire), envoi, message de rappel, lien expiré, affichage des avis |
| `frontend/e2e/parcours-admin.cjs` (étape 7 bis) | Publier un avis avec une réponse, rappeler une cliente mécontente |


## Accord pour les nouveautés et offres par e-mail (maquette validée le 28 novembre 2026)

La loi sénégalaise n° 2008-12 demande, pour la prospection, un accord **préalable, distinct et prouvé**. Les confirmations, codes de retrait, factures et rappels de resserrage ne sont pas de la prospection : ils restent à part.

| Règle | Où dans le code |
|---|---|
| Une case **distincte** de la politique de confidentialité, **non cochée**, **facultative** : à l'inscription, à la commande, à la réservation | `MarketingConsentBox.tsx` ; règle `marketing_consent` (`sometimes`, `boolean`) dans `RegisterRequest`, `StoreOrderRequest`, `StoreBookingRequest` |
| Cochée : accord enregistré ; non cochée : **rien ne change** (une case vide ne retire jamais un accord donné ailleurs) | `MarketingConsent::record()` appelé seulement si la case est cochée |
| Masquée pour une cliente connectée qui a déjà accepté | `usePreferences()` |
| **Preuve** de chaque accord et de chaque retrait : date, endroit, personne de la caisse, version du texte | table `customer_consents` (jamais modifiée) ; état actuel dans `customers.marketing_consent` |
| Le texte de la case est le même au serveur et au site | `MarketingConsent::TEXT` / `VERSION` et `src/content/consent.ts` : les changer ensemble |
| Espace client, « Les messages que je reçois » : rappels de resserrage et offres, deux interrupteurs | `GET/PATCH /api/v1/me/preferences` ; `MessagePreferences` dans `AccountPages.tsx` |
| Lien « Ne plus recevoir les offres » à mettre en bas de **chaque** e-mail d'offre : signé, sans connexion | `MarketingConsent::unsubscribeUrl($customer)` → page `/offres/desinscription/:customer` |
| ERP Clients : colonne « Offres par e-mail » (accepte / non / retiré, où et quand), filtre « Acceptent les offres » | `CustomerAdminController` |
| Accord donné **au salon** : noté par la caisse, avec son nom | `POST admin/customers/{id}/marketing-consent`, permission `customers.consent` (gérante, manager, caisse) |
| La caisse voit les clientes **sans les montants dépensés** (retirés par le serveur, pas seulement cachés) | permission `customers.stats` (gérante et manager) |

**Concept : l'état et la preuve.** `customers.marketing_consent` répond vite à « puis-je lui écrire ? ». La table `customer_consents` est un **journal en ajout seul** : on n'y modifie ni n'efface jamais une ligne. En cas de contrôle (CDP) ou de réclamation, on peut montrer quand, où et avec quel texte la cliente a dit oui, puis quand elle a dit non.

Tests : `MarketingConsentTest.php` (case facultative, preuve, commande et réservation, espace client, lien signé, ERP et montants cachés), `MarketingConsentBox.test.tsx`, parcours `e2e/parcours-accord.cjs`.
