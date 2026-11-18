# Étape 12 — Publicités de l'accueil, « Nos gammes » et vraies prestations

> Statut : **maquette proposée, en attente de validation**. Rien n'est encore implémenté dans le code.
> Maquette interactive : [canevas « Dabo Hair — Accueil et gammes »](https://claude.ai/artifact/NpExLjgNGZiUutFi51EtZL) (privé : visible seulement par son propriétaire tant qu'il n'est pas partagé).
> Sources des écrans : [docs/maquettes/publicites-gammes/](maquettes/publicites-gammes/) (les images n'y sont que des références : elles ne s'affichent que dans le canevas).

---

## 1. Le besoin

1. La section « hero » (le haut de l'accueil) sert de **panneau publicitaire** : plusieurs publicités qui défilent, changées par la boutique **depuis l'ERP**, sans toucher au code.
2. La boutique vend des **gammes** (des ensembles de produits) : le menu doit proposer **« Nos gammes »**.
3. Les **prestations du salon** affichées doivent être les vraies, avec les vrais prix (les actuelles sont des exemples).

## 2. Les 7 écrans de la maquette

| Écran | Fichier | Ce qu'il montre |
|---|---|---|
| Accueil, ordinateur | `Main.dc.html` | Carrousel de publicités, menu « Nos gammes » ouvert (coffrets, par besoin, par produit), engagements, gammes, aperçu du salon |
| Accueil, téléphone | `Mobile.dc.html` | Même page en 390 px, barre de navigation en bas (Accueil, Gammes, Réserver, Compte) |
| Menu, téléphone | `MobileMenu.dc.html` | « Nos gammes » déplié, besoins en boutons, bouton Réserver |
| Les 3 publicités | `Slides.dc.html` | Rôle de chaque publicité et page vers laquelle mène son bouton |
| Page d'une gamme | `Gamme.dc.html` | « La routine complète » en 4 étapes, bouton « Ajouter les 4 produits » |
| Prestations | `Prestations.dc.html` | Vrais tarifs en 3 onglets : Twists, Soin + twist, Brushing |
| ERP, publicités | `AdminPubs.dc.html` | Liste des publicités (en ligne, programmées) et formulaire d'édition |

## 3. Les choix d'expérience utilisateur

| Choix | Pourquoi |
|---|---|
| Le texte d'une publicité n'est **jamais posé sur la photo** : il reste sur fond noir, à côté | Il reste lisible quelle que soit l'image chargée depuis l'ERP |
| **Une publicité = une image, un message, un prix, un bouton** | Un seul message à la fois : le visiteur comprend en 3 secondes |
| **3 publicités au maximum** | Au-delà, presque personne ne voit les suivantes |
| Le **prix vient du produit ou de la gamme liée** | Changer un prix dans la boutique met la publicité à jour : jamais de prix périmé |
| Dates de début et de fin facultatives | Une promotion (Tabaski, fin d'année) s'affiche et disparaît toute seule |
| Un coffret s'ajoute **en un clic** ; le stock des produits est vérifié avant validation | Moins d'étapes, pas de commande impossible à servir |
| Zones cliquables d'au moins **44 px** | Taille minimale recommandée (WCAG) pour le pouce sur téléphone |

## 4. Le contenu proposé

### Gammes

| Type | Proposition |
|---|---|
| Coffrets | **La routine complète** : shampooing, crème, sérum, spray hydratant, 10 000 F. **Le trio essentiel** : shampooing, crème, sérum, 5 000 F |
| Par besoin | Pousse et fortification, Hydratation, Anti-chute, Soin réparateur à la kératine |
| Par produit | Shampoings, Crèmes et hydratants, Sérums, Soins traitants |

### Prestations (en place dans le site depuis le 9 novembre 2026)

Une seule coiffeuse, **Awa Dabo**, tous les jours de 9 h à 19 h sans pause. Twists **uniquement sur les cheveux de la cliente, sans mèches**. Salon : Cité Almadies 2, ZAC Mbao (Extension Jaxaay), Dakar · 77 602 62 00. Une prestation n'est proposée en ligne que si sa durée est connue : sinon, la réservation proposerait de faux créneaux.

| Prestation | Durée | Prix | En ligne |
|---|---|---|---|
| Twist simple | 2 h | 5 000 F | Oui |
| Mini twist | 4 h | 10 000 F | Oui |
| Micro twist court (cheveux de 8 à 10 cm) | 8 h | 20 000 F | Oui |
| Micro twist mi-long (12 à 15 cm) | 8 h | 25 000 F | Oui |
| Micro twist long (18 à 20 cm) | 8 h | 30 000 F | Oui |
| Resserrage twist simple | 1 h 30 | 5 000 F | Oui |
| Resserrage micro twist | 2 h | 10 000 F | Oui |
| Soin, shampooing et twist | 2 h | 8 000 F | Oui |
| Soin, shampooing, bain d'huile et twist | 2 h 30 | 10 000 F | Oui |
| Brushing | 1 h | 3 000 F | Oui |
| Soin et brushing | 1 h 45 | 5 000 F | Oui |

Ces données sont dans `backend/database/seeders/ReferenceDataSeeder.php`. Pour activer une prestation, on indique sa durée et on passe `false` à `true`. Les tests de calcul des créneaux utilisent un scénario plus riche (deux coiffeuses, une pause, un jour de fermeture) : `SalonTestScenarioSeeder`, qui n'est jamais chargé en production.

## 5. À confirmer par Dabo Hair

- [ ] Les noms des gammes « par besoin » et des deux coffrets
- [x] Le prix du Mini twist : **10 000 F** (confirmé le 9 novembre)
- [x] Durées des twists (2 h, 4 h, 8 h) et horaires (tous les jours, 9 h – 19 h)
- [ ] Durées du resserrage, des soins + twist et des brushings
- [x] La coiffeuse : Awa Dabo ; pas de pause ; adresse et téléphone du salon
- [x] Prix de la gamme complète (6 produits) : **15 000 F** (confirmé le 10 novembre), affiché sur la publicité de l’accueil
- [x] Promotion « 20 gammes à 10 000 F au lieu de 15 000 F » : maquette validée et implémentée le 10 novembre, **masquée** tant que la gamme n'est pas un produit du panier (`visible: false` dans `home.ts`). L'acompte de 5 000 F est remplacé par le paiement à la réception
- [ ] Afficher ou non le prix barré du coffret (14 000 F = somme des 4 produits séparés)
- [x] Le logo : redessiné en vectoriel, validé et intégré au site
- [x] Le Leave In : **5 000 F, 250 ml, 20 en stock** (confirmé le 10 novembre), ajouté au catalogue avec ses 2 photos (coût de fabrication à compléter)
- [ ] Les photos des produits (voir §6) : masque, spray hydratant, shampooing, sérum et Leave In reçus et en ligne ; restent la crème, les sérums, l'hydratant 100 ml et le spray anti-chute

## 6. Refaire les photos des produits

Les images actuelles sont des captures de stories : elles sont floues en grand et ne donnent pas une image professionnelle de la boutique. La méthode retenue : la boutique photographie chaque produit seul, puis les images sont détourées et composées par programme (Python, bibliothèque Pillow). Toutes les images ont alors le même fond, la même lumière et la même taille de produit.

| Règle | Pourquoi |
|---|---|
| **Un seul produit par photo**, face à l'appareil, étiquette droite | Les coffrets peuvent ensuite être composés librement |
| **Fond uni et clair** (drap blanc, mur, carton) | Le détourage est propre |
| **Lumière du jour** près d'une fenêtre, **sans flash** | Pas de reflet blanc sur le plastique |
| Téléphone **à hauteur du produit**, à environ 40 cm, **sans zoom** | Pas de déformation |
| Envoyer le **fichier d'origine** (galerie, ou WhatsApp en mode « document »), jamais une capture d'écran | Garder toute la résolution |

Produits à photographier : shampooing, crème, sérum Activ'Pousse (30 ml et 15 ml), sérum Booster, spray hydratant, hydratant 100 ml, spray anti-chute, masque à la kératine.

Formats produits : **1600 × 1000** pour une publicité sur ordinateur, **1080 × 1350** pour le téléphone, **1200 × 1200** pour une fiche produit. Fond au choix : noir et or (comme le site) ou crème clair.

## 7. Ce que l'implémentation changera dans le code (après validation)

| Partie | Changement prévu |
|---|---|
| Base de données | Tables `promotions` (publicités : image, textes, cible, dates, ordre, statut) et `collections` (gammes) avec leurs produits |
| API | Lecture publique des publicités en cours ; gestion dans l'ERP (droits d'administration, journal d'audit) |
| ERP | Page « Publicités » ; gestion des gammes dans « Produits et gammes » |
| Vitrine | Carrousel accessible (pause, clavier, lecteurs d'écran), menu « Nos gammes », pages de gamme, ajout d'une gamme entière au panier |
| Données | Vraies prestations dans les seeders à la place des exemples |
| Tests | Tests backend et frontend, parcours Playwright mis à jour |

## 8. La gamme complète au prix membre (lancement du 15 décembre 2026)

Maquettes validées le 18 novembre 2026 (canevas, section « Lancement du 15 décembre »). Décisions : promotion sur la gamme seulement (les twists plus tard), **réservée aux membres**, **une gamme par compte**.

| Règle | Où dans le code |
|---|---|
| La gamme est un **article composé** : 6 soins (shampooing, masque, Leave In, crème, sérum Activ'Pousse 30 ml provisoirement, spray hydratant), 15 000 F | `product_bundle_items`, `DaboHairCatalogSeeder` (référence DAB-GAM-001) |
| Pas de stock à elle : on peut en vendre autant que le **soin le plus rare** le permet | `Product::availableQuantity()` |
| Une vente retire les 6 soins du grand livre ; une annulation les rend | `PlaceOrderAction`, `ChangeOrderStatusAction` |
| **Prix membre** 10 000 F : cliente connectée, 20 gammes en tout, une par compte ; une commande annulée rend sa place | `MemberPriceService` |
| Le **serveur** décide du prix, sous verrou : deux commandes en même temps ne prennent pas la même place | `PlaceOrderAction::priceLines()` |
| Sans compte : on peut toujours commander, à 15 000 F | |
| Pas de gamme en point de retrait (le partenaire n'a pas les 6 soins) | `PlaceOrderAction` (refus 422) |
| Inscription rapide : prénom, téléphone, mot de passe ; nom et e-mail complétés à la 1re commande ; connexion par e-mail **ou** téléphone | `RegisterRequest`, `AuthController::login()`, `CustomerResolver` |

**Le prix membre affiché ET le prix facturé.** Le site demande au serveur où en est la visiteuse (`member_offer.status` : `eligible`, `sign_in`, `already_used`, `sold_out`) et affiche en conséquence. Mais à la commande, le serveur recalcule tout : changer un prix dans le navigateur ne sert à rien (RG-COM-04). `order_items.regular_unit_price` garde le prix normal (15 000 F) sur la ligne vendue au prix membre : c'est ce qui permet de compter les 20 places et de vérifier « une par compte ».

**Attention, la crème.** La gamme contient la crème capillaire. Si la crème est en rupture, la gamme l'est aussi (« Rupture » sur le site). Avant le 15 décembre : vérifier dans l'ERP que les 6 soins sont en stock (au moins 20 de chaque pour les 20 gammes).

**À confirmer avec Awa :** le sérum de la gamme (Activ'Pousse ou Booster). Pour changer : la liste des 6 références dans `DaboHairCatalogSeeder`, puis `php artisan db:seed --class=DaboHairCatalogSeeder`.

**Limite connue :** un compte créé sans e-mail ne peut pas utiliser « mot de passe oublié » (le lien part par e-mail). La cliente passe par le salon ; une réinitialisation par SMS est à prévoir avec le chiffrage des SMS.
