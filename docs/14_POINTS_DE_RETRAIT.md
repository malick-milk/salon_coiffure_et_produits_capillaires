# Étape 14 — Points de retrait partenaires dans les régions

> Statut : **implémenté et testé**. Maquette : section « Points de retrait partenaires » du [canevas](https://claude.ai/artifact/NpExLjgNGZiUutFi51EtZL).

## 1. Le principe

Des **boutiques déjà installées** dans les régions servent de **points de retrait**. Au lieu de se déplacer pour chaque commande lointaine, Dabo Hair livre le partenaire **une fois par mois**. Les clientes de la région y retirent leurs commandes en ligne, et le partenaire peut aussi vendre au comptoir.

C'est du **dépôt-vente** : les produits livrés **restent la propriété de Dabo Hair** jusqu'à leur vente.

| Règle (décidée le 9 novembre 2026) | Dans le site |
|---|---|
| Un partenaire peut couvrir plusieurs régions | La Casamance (Ziguinchor, Sédhiou, Kolda) n'a qu'un seul partenaire |
| Prix de vente imposé : le **prix du site**, partout | Écrit sur le bon de dépôt et le relevé |
| Commission : **10 %** de chaque produit vendu ou remis | Modifiable par partenaire dans l'ERP |
| Livraison mensuelle par Dabo Hair | **Bon de dépôt** PDF à faire signer |
| Relevé des produits restants en fin de mois | **Relevé** PDF : comptage, ventes, commission, montant dû |
| Versement **au plus tard le 5** | Statut « payé », « à payer avant le 5 » ou « en retard » ; SMS de rappel le 1er du mois |
| Produits abîmés ou perdus : déduits de la commission | La commission ne descend **jamais sous 0** ; deux mois de suite avec des abîmés : alerte **« à investiguer »** |

## 2. Le cycle d'un mois

```
Livraison (début de mois)       ERP → Points de retrait → fiche → Livraison
   stock du salon  ──(sortie « consignment_out »)──►  stock du partenaire   + bon de dépôt BD-2026-…
                                                        │
Commandes en ligne (tout le mois)                       │  la cliente choisit « Point de retrait »
   le stock du PARTENAIRE est réservé                   ◄─┘  (pas celui du salon)
   « prête » → SMS à la cliente (code à 4 chiffres) + SMS au partenaire (lien de remise)
   le partenaire saisit le code sur la page du lien → commande remise, payée sur place

Relevé (fin de mois)            ERP → fiche → Relevé du mois
   ventes au comptoir = stock attendu − compté − abîmés
   total encaissé par le partenaire = comptoir + commandes en ligne remises
   commission nette = max(10 % du total − abîmés, 0)        → relevé REL-2026-…
   à verser avant le 5 = total encaissé − commission nette

Versement (avant le 5)          ERP → fiche → Historique → « Versement reçu »
   chaque commande du relevé est encaissée, sa facture est émise
```

### Pourquoi un code de retrait

Le **code** est envoyé **seulement à la cliente**. Le partenaire reçoit un lien, pas le code. Sans le code donné par la cliente, la commande ne peut pas être remise : ni à une autre personne, ni « oubliée » dans le relevé. Après 5 codes faux, la remise est bloquée 15 minutes et la tentative est inscrite au journal de sécurité.

## 3. Exemple chiffré

Moussa (Thiès) a reçu 12 sérums à 3 000 F. À la fin du mois, il en reste 8, et 1 est abîmé :

| Calcul | Montant |
|---|---|
| Ventes au comptoir : 12 − 8 − 1 = **3 sérums** | 9 000 F |
| Commission 10 % | 900 F |
| Abîmé déduit (1 sérum à 3 000 F) | − 900 F (la commission ne descend pas sous 0) |
| **À verser avant le 5** | **9 000 F** |

Si le partenaire déclare 2 ventes alors que le comptage en donne 3, l'ERP **exige une explication** avant de valider. Elle est inscrite sur le relevé.

## 4. Les écrans

| Qui | Où | Quoi |
|---|---|---|
| Cliente | Commande → « Point de retrait » | Choix du point de sa région (adresse, horaires) ; le code arrive par SMS |
| Cliente | Espace client → commande | Le point de retrait et, quand la commande est prête, le code |
| Partenaire | `/retrait/<lien du SMS>` | Page simple pour téléphone : produits, montant à encaisser, code à saisir |
| Direction | ERP → **Points de retrait** | Points actifs, régions couvertes sur 14, montant à encaisser, retards, alertes |
| Direction | ERP → fiche d'un point | Stock confié, commandes à remettre, livraison, relevé du mois, historique et versements, PDF |

Permission : `partners.manage` (propriétaire et gérante).

## 5. Dans le code

| Fichier | Rôle |
|---|---|
| `backend/database/migrations/2026_11_10_100000_create_pickup_points_tables.php` | Tables, nouveaux modes (`pickup_point`, canal `partner`, mouvement `consignment_out`), contrainte CHECK mise à jour |
| `backend/app/Services/PickupPoints/PickupPointService.php` | Livraison, réservation pour une commande, annulation, calcul et validation du relevé, versement, alerte |
| `backend/app/Actions/PlaceOrderAction.php` | Une commande « point de retrait » réserve le stock du partenaire |
| `backend/app/Actions/Admin/ChangeOrderStatusAction.php` | « Prête » : code + lien + SMS ; annulation : retour dans le stock du partenaire |
| `backend/app/Http/Controllers/Api/V1/PickupPointController.php` | Liste publique des points, page de remise du partenaire |
| `backend/app/Http/Controllers/Api/V1/Admin/PickupPointAdminController.php` | ERP |
| `backend/resources/views/pdf/consignment-*.blade.php` | Bon de dépôt et relevé |
| `frontend/src/features/admin/pages/PickupPointsPages.tsx` | Écrans de l'ERP |
| `frontend/src/features/pickup/pages/HandoverPage.tsx` | Page du partenaire |

**Les ventes du partenaire entrent dans les analyses** : les ventes au comptoir deviennent une commande du canal « partenaire », et les commandes en ligne remises sont déjà des commandes. Tout est compté au moment du versement, comme les autres encaissements.

## 6. Tests

`tests/Feature/PickupPointsTest.php` : 14 tests (mouvements de stock, bon de dépôt, réservation et annulation, code et blocage, calcul du relevé, commission plafonnée à 0, écart à expliquer, versement et factures, alerte d'investigation, rappel mensuel, permissions). Côté frontend : `handover.test.tsx` et le cas « point de retrait » du formulaire de commande. Le parcours `e2e/parcours-admin.cjs` (étape 9 bis) valide un relevé de bout en bout.

En local, `php artisan migrate:fresh --seed` crée deux points de démonstration (Casamance et Thiès), avec une livraison chacun.
