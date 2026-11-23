# Campagne de lancement du site · 21 jours, 5 réseaux

Ouverture du site : **mardi 15 décembre 2026**. Campagne du mardi 24 novembre au mardi 15 décembre.
Maquettes validées le 16 novembre 2026, mises à jour le 18 novembre 2026 (dates réelles, offre membres, Facebook ajouté, twists retirés, vouvoiement partout). **Ces mises à jour attendent la validation** : les PNG de `marketing/lancement/` sont encore ceux du 16 novembre.

Exporter (après validation) :

```bash
node marketing/outils/exporter.cjs marketing/sources/lancement marketing/lancement
```

## L'offre de lancement (décision du 18 novembre 2026)

- La **gamme complète** (6 soins : shampooing, masque, Leave In, crème, sérum, spray hydratant) à **10 000 F au lieu de 15 000 F**, **réservée aux membres** : il suffit de créer un **compte gratuit** sur le site (« 30 secondes »).
- Sans compte, la gamme reste à 15 000 F. **Seulement 20 gammes.**
- But : faire créer des comptes (la communauté). Le message montre que le compte est gratuit et rapide, sans pousser.
- Annoncée à partir de J-7 (avant l'ouverture, les visuels disent « Le 15 décembre, créez votre compte gratuit »), puis le Jour J.
- Modalités non décidées, **absentes des visuels et des légendes** : une gamme par membre ou plus ? vérification du compte (SMS ?) ? date de fin si les 20 gammes ne partent pas ? `[à confirmer]`

## Calendrier daté

Heure de publication conseillée : le soir, 19 h – 21 h (à vérifier avec les statistiques de la 1re semaine). Détail par réseau : `00-calendrier-21-jours.html`.

| Phase | Jour | Date | Visuels préparés (un par réseau) |
|---|---|---|---|
| 1 · Mystère | J-21 | mardi 24 novembre | `01-J21-mystere-…` |
| | J-18 | vendredi 27 novembre | sondage en story (sans maquette) |
| | J-16 | dimanche 29 novembre | question en story (sans maquette) |
| 2 · Révélation | J-14 | mardi 1er décembre | `02-J14-revelation-…` |
| | J-11 | vendredi 4 décembre | carrousel, vidéo (sans maquette) |
| | J-9 | dimanche 6 décembre | retrait gratuit au salon, livraison à Dakar (sans maquette) |
| 3 · Compte à rebours | J-7 | mardi 8 décembre | `03-J7-compte-a-rebours-…` + offre membres |
| | J-3 | samedi 12 décembre | `03-J3-compte-a-rebours-…` + offre membres |
| | J-1 | lundi 14 décembre | `03-J1-compte-a-rebours-…` + offre membres |
| 4 · Jour J | J | mardi 15 décembre | `04-JourJ-…` + offre membres |

Jours de la semaine vérifiés au calendrier (commande `date`).

## Les liens mesurés

Jamais dans l'image. Un lien par réseau, le même pendant toute la campagne :

| Réseau | Où mettre le lien | Lien |
|---|---|---|
| Instagram | bio | `https://dabohair.com/?utm_source=instagram&utm_medium=bio&utm_campaign=lancement-2026-12` |
| Facebook | texte de la publication | `https://dabohair.com/?utm_source=facebook&utm_medium=post&utm_campaign=lancement-2026-12` |
| WhatsApp | légende du statut, message de diffusion | `https://dabohair.com/?utm_source=whatsapp&utm_medium=statut&utm_campaign=lancement-2026-12` |
| TikTok | bio | `https://dabohair.com/?utm_source=tiktok&utm_medium=bio&utm_campaign=lancement-2026-12` |
| Snapchat | trombone (lien attaché) | `https://dabohair.com/?utm_source=snapchat&utm_medium=story&utm_campaign=lancement-2026-12` |

Le Jour J, on peut aussi envoyer directement vers la création de compte (la page existe : `/inscription`), en gardant la source, par exemple `https://dabohair.com/inscription?utm_source=whatsapp&utm_medium=statut&utm_campaign=lancement-2026-12`. À décider avec Awa `[à confirmer]`.

Avant le Jour J, le site n'est pas ouvert : J-21 à J-1, les légendes ne donnent **pas** de lien, elles invitent à suivre le compte ou à enregistrer le numéro.

## Hashtags

Base (7) : `#DaboHair #FaitADakar #CheveuxNaturels #SoinsCapillaires #Dakar #Senegal #BeauteAfricaine`
Remplacer le dernier selon le moment : `#Bientot` (J-21), `#NouveauSite` (J-14), `#Lancement` (J-7 à J). TikTok : ajouter `#PourToi` à la place de `#Senegal` si besoin de place. Pas de hashtags sur WhatsApp ni Snapchat.

## Visuel par visuel : réseau, date, légende à copier

### J-21 · mardi 24 novembre · Mystère

| Fichier | Réseau | Légende |
|---|---|---|
| `01-J21-mystere-instagram-publication` | Instagram, publication | Quelque chose se prépare. Depuis des mois, nous travaillons à une nouvelle façon de prendre soin de vos cheveux. Rendez-vous ici dans 3 semaines. Activez les notifications pour ne rien rater. #DaboHair #FaitADakar #CheveuxNaturels #SoinsCapillaires #Dakar #Senegal #Bientot |
| `01-J21-mystere-facebook-publication` | Facebook, publication | Quelque chose se prépare chez Dabo Hair. Depuis des mois, nous travaillons à une nouvelle façon de prendre soin de vos cheveux. Suivez la page pour être les premières informées. #DaboHair #FaitADakar #CheveuxNaturels #Dakar #Bientot |
| `01-J21-mystere-whatsapp-statut` | Statut WhatsApp | Vous commandez vos soins par message ? Bientôt, ce sera beaucoup plus simple. |
| `01-J21-mystere-tiktok-couverture` | TikTok, couverture (vidéo partie 1) | Partie 1 sur 4 : ce que Dabo Hair prépare depuis des mois… Indice : vos cheveux vont adorer. Abonnez-vous pour la suite. #DaboHair #FaitADakar #CheveuxNaturels #Dakar #PourToi #Bientot |
| `01-J21-mystere-snapchat` | Snapchat, story | Devinez ce qu'on prépare depuis des mois… Ajoutez Dabo Hair pour ne rien rater. |

### J-14 · mardi 1er décembre · Révélation

| Fichier | Réseau | Légende |
|---|---|---|
| `02-J14-revelation-instagram-publication` | Instagram, publication | Dabo Hair arrive en ligne le mardi 15 décembre. Commander vos soins, vous faire livrer à Dakar ou retirer gratuitement au salon, payer à la réception : tout depuis votre téléphone. #DaboHair #FaitADakar #CheveuxNaturels #SoinsCapillaires #Dakar #Senegal #NouveauSite |
| `02-J14-revelation-facebook-publication` | Facebook, publication | Dabo Hair arrive en ligne le mardi 15 décembre. Bientôt, vos soins se commandent en quelques clics : livraison à Dakar et environs ou retrait gratuit au salon, paiement à la réception. Suivez la page pour recevoir le lien. #DaboHair #FaitADakar #CheveuxNaturels #Dakar #NouveauSite |
| `02-J14-revelation-whatsapp-statut` | Statut WhatsApp | Vos soins Dabo Hair, commandés en quelques clics, sans appeler ni attendre une réponse. Ouverture du site le mardi 15 décembre. |
| `02-J14-revelation-tiktok-couverture` | TikTok, couverture (vidéo partie 2) | Partie 2 sur 4 : je vous montre le site Dabo Hair en avant-première. Ouverture le mardi 15 décembre. #DaboHair #FaitADakar #CheveuxNaturels #Dakar #PourToi #NouveauSite |
| `02-J14-revelation-snapchat` | Snapchat, story | Regardez : le site Dabo Hair, en avant-première. Ouverture le mardi 15 décembre. |

### J-7 · mardi 8 décembre · Compte à rebours

| Fichier | Réseau | Légende |
|---|---|---|
| `03-J7-compte-a-rebours-instagram-publication` | Instagram, publication | Plus que 7 jours. Le mardi 15 décembre, le site Dabo Hair ouvre, avec une offre pour notre communauté : la gamme complète (6 soins) à 10 000 F au lieu de 15 000 F pour les membres. Devenir membre, c'est créer un compte gratuit sur le site, en 30 secondes. Seulement 20 gammes. Lien en bio le jour J. #DaboHair #FaitADakar #CheveuxNaturels #SoinsCapillaires #Dakar #Senegal #Lancement |
| `03-J7-compte-a-rebours-facebook-publication` | Facebook, publication | Plus que 7 jours avant l'ouverture du site Dabo Hair, le mardi 15 décembre. Pour fêter ça, la gamme complète (shampooing, masque, Leave In, crème, sérum, spray hydratant) passe à 10 000 F au lieu de 15 000 F pour les membres. Membre = compte gratuit sur le site, 30 secondes. Sans compte, la gamme reste à 15 000 F. Seulement 20 gammes. #DaboHair #FaitADakar #CheveuxNaturels #Dakar #Lancement |
| `03-J7-compte-a-rebours-whatsapp-statut` | Statut WhatsApp | J-7. Enregistrez notre numéro 77 602 62 00 : le mardi 15 décembre, le lien arrive directement chez vous. Ce jour-là, la gamme complète est à 10 000 F au lieu de 15 000 F pour les membres (compte gratuit, 30 secondes). Seulement 20 gammes. |
| `03-J7-compte-a-rebours-tiktok-couverture` | TikTok, couverture (vidéo partie 3) | Partie 3 sur 4 : 7 jours avant le lancement. La gamme complète à 10 000 F au lieu de 15 000 F pour les membres, le 15 décembre. Le compte est gratuit. Seulement 20 gammes. #DaboHair #FaitADakar #CheveuxNaturels #Dakar #PourToi #Lancement |
| `03-J7-compte-a-rebours-snapchat` | Snapchat, story | J-7. Activez les notifications : le lien arrive le mardi 15 décembre. La gamme à 10 000 F pour les membres, compte gratuit. |

### J-3 · samedi 12 décembre · Compte à rebours

| Fichier | Réseau | Légende |
|---|---|---|
| `03-J3-compte-a-rebours-instagram-publication` | Instagram, publication | Plus que 3 jours. Mardi 15 décembre : le site Dabo Hair ouvre et la gamme complète passe à 10 000 F au lieu de 15 000 F pour les membres. Le compte est gratuit et se crée en 30 secondes. Seulement 20 gammes. #DaboHair #FaitADakar #CheveuxNaturels #SoinsCapillaires #Dakar #Senegal #Lancement |
| `03-J3-compte-a-rebours-facebook-publication` | Facebook, publication | Plus que 3 jours avant l'ouverture du site Dabo Hair. Mardi 15 décembre, créez votre compte gratuit (30 secondes) et profitez de la gamme complète à 10 000 F au lieu de 15 000 F. Seulement 20 gammes. #DaboHair #FaitADakar #CheveuxNaturels #Dakar #Lancement |
| `03-J3-compte-a-rebours-whatsapp-statut` | Statut WhatsApp | J-3. Enregistrez notre numéro 77 602 62 00 pour recevoir le lien mardi 15 décembre. Gamme complète à 10 000 F pour les membres, compte gratuit. |
| `03-J3-compte-a-rebours-tiktok-couverture` | TikTok, couverture (vidéo avis de clientes) | 3 jours avant le lancement : elles vous disent ce qu'elles pensent des soins Dabo Hair. Mardi 15 décembre, la gamme complète à 10 000 F pour les membres. #DaboHair #FaitADakar #CheveuxNaturels #Dakar #PourToi #Lancement — **accord écrit de chaque cliente filmée avant publication `[à confirmer]`** |
| `03-J3-compte-a-rebours-snapchat` | Snapchat, story | J-3. Activez les notifications : le lien arrive le mardi 15 décembre. |

### J-1 · lundi 14 décembre · Compte à rebours

| Fichier | Réseau | Légende |
|---|---|---|
| `03-J1-compte-a-rebours-instagram-publication` | Instagram, publication | Demain, le site ouvre ses portes. Mardi 15 décembre, créez votre compte gratuit (30 secondes) : la gamme complète est à 10 000 F au lieu de 15 000 F pour les membres. Seulement 20 gammes. Le lien sera dans la bio. #DaboHair #FaitADakar #CheveuxNaturels #SoinsCapillaires #Dakar #Senegal #Lancement |
| `03-J1-compte-a-rebours-facebook-publication` | Facebook, publication | C'est demain. Mardi 15 décembre, le site Dabo Hair ouvre. Membres (compte gratuit, 30 secondes) : la gamme complète à 10 000 F au lieu de 15 000 F. Seulement 20 gammes. Le lien sera publié ici demain. #DaboHair #FaitADakar #CheveuxNaturels #Dakar #Lancement |
| `03-J1-compte-a-rebours-whatsapp-statut` | Statut WhatsApp | Le lien part demain, mardi 15 décembre. Pas encore enregistré notre numéro 77 602 62 00 ? Faites-le aujourd'hui pour le recevoir. |
| `03-J1-compte-a-rebours-tiktok-couverture` | TikTok, couverture (vidéo courte) | Demain, le site Dabo Hair est en ligne. Membres : la gamme complète à 10 000 F, compte gratuit. #DaboHair #FaitADakar #CheveuxNaturels #Dakar #PourToi #Lancement |
| `03-J1-compte-a-rebours-snapchat` | Snapchat, story | C'est demain, mardi 15 décembre ! Activez les notifications pour avoir le lien. |

### Jour J · mardi 15 décembre

| Fichier | Réseau | Légende |
|---|---|---|
| `04-JourJ-instagram-publication` | Instagram, publication | C'est en ligne ! Commandez vos soins Dabo Hair et payez à la réception. Pour notre communauté : la gamme complète à 10 000 F au lieu de 15 000 F pour les membres. Créez votre compte gratuit sur le site, 30 secondes. Seulement 20 gammes. Lien en bio. #DaboHair #FaitADakar #CheveuxNaturels #SoinsCapillaires #Dakar #Senegal #Lancement |
| `04-JourJ-facebook-publication` | Facebook, publication | C'est en ligne ! Le site Dabo Hair est ouvert : https://dabohair.com/?utm_source=facebook&utm_medium=post&utm_campaign=lancement-2026-12 — Créez votre compte gratuit (30 secondes) et la gamme complète est à 10 000 F au lieu de 15 000 F. Sans compte : 15 000 F. Seulement 20 gammes. Livraison à Dakar et environs ou retrait gratuit au salon, paiement à la réception. #DaboHair #FaitADakar #CheveuxNaturels #Dakar #Lancement |
| `04-JourJ-whatsapp-statut` | Statut WhatsApp (+ message de diffusion) | Le site Dabo Hair est en ligne : https://dabohair.com/?utm_source=whatsapp&utm_medium=statut&utm_campaign=lancement-2026-12 — Créez votre compte gratuit (30 secondes) : la gamme complète est à 10 000 F au lieu de 15 000 F. Seulement 20 gammes. |
| `04-JourJ-tiktok-couverture` | TikTok, couverture (vidéo partie 4) | Partie 4 sur 4 : le site est en ligne ! Lien dans la bio. Membres (compte gratuit) : la gamme complète à 10 000 F au lieu de 15 000 F. #DaboHair #FaitADakar #CheveuxNaturels #Dakar #PourToi #Lancement |
| `04-JourJ-snapchat` | Snapchat, story + lien attaché (trombone) | C'est en ligne ! Touchez le lien attaché. Gamme complète à 10 000 F pour les membres, compte gratuit. |

## À refaire avant de publier

| Visuel ou texte | Provisoire | Il faut | Qui |
|---|---|---|---|
| Tous les visuels J-7 → Jour J | « gamme complète », « seulement 20 gammes » | refaire avec les **3 gammes** (avocat, palme, coco), **200 unités**, et la décision sur la livraison (incluse ou non) — décisions du 23 novembre | agent `maquettes-promo` |
| Liens des comptes (bio Instagram et TikTok, page Facebook, compte Snapchat) | non connus | les adresses des comptes | Awa |
| `03-J3-…-tiktok-couverture` (vidéo avis de clientes) | `[à confirmer]` | l'accord écrit de chaque cliente filmée | Awa |
| Offre membres : modalités | absentes | une gamme par membre ou plus ? vérification du compte (SMS) ? date de fin ? | Awa |
| Story J-1 Instagram (sans maquette) | « demain à 18 h » | ouverture le 15 décembre à **18 h** (décidé le 23 novembre) | fait |
| Tous les visuels J-7 → Jour J | prix 10 000 F membre | que le site facture vraiment 10 000 F à un membre et 15 000 F sans compte, et vende la gamme en un seul article (voir ci-dessous) | session principale |
| « compte gratuit, 30 secondes » | à vérifier | le formulaire `/inscription` demande 6 champs + une case : chronométrer sur téléphone | Awa |

## À mettre en place sur le site avant publication

- Le **prix membre** de la gamme (10 000 F avec compte, 15 000 F sans) n'existe pas : la publicité « 20 gammes à 10 000 F » de `frontend/src/content/home.ts` est masquée (`visible: false`) et ne parle pas de compte.
- La **gamme en un seul article** au panier n'existe pas : `DaboHairCatalogSeeder.php` ne contient que les produits séparés.
- Le **compteur des 20 gammes** (vrai stock, `remaining`) doit être branché.

## Rappels

- Statut WhatsApp de J-7 et J-3 : demander aux clientes d'**enregistrer le numéro**, sinon la liste de diffusion du Jour J ne leur arrive pas.
- Vouvoiement sur tous les réseaux, Snapchat compris (le tutoiement n'est pas confirmé).
- Les twists et prestations du salon ne font pas partie de cette campagne.
- Zones cachées respectées : stories et statuts, rien d'important dans les 250 px du haut ni les 340 px du bas ; TikTok, rien dans les 400 px du bas.
