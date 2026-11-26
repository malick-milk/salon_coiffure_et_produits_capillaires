# Étape 15 — Contrats et RH, règles du travail au Sénégal, impôts

> Statut : **module implémenté et testé** (26 novembre 2026). Maquette : section « ERP : contrats de travail et ressources humaines » du [canevas](https://claude.ai/artifact/NpExLjgNGZiUutFi51EtZL).
>
> **Avertissement.** Les parties 2 et 3 résument le droit sénégalais à partir de sources publiques **secondaires** (guides, presse, simulateurs). Le texte officiel du nouveau Code du travail n'a pas pu être lu depuis le poste de développement. Les sources se contredisent parfois : chaque point indique son **niveau de confiance**. Rien ici ne remplace un **comptable** ou l'**inspection du travail**. Faites valider les chiffres avant la première paie.

---

## 1. Le module « Contrats et RH » de l'ERP

### Qui y a accès

Seule la **propriétaire** a accès au module, avec la permission `hr.manage` donnée au rôle `super_admin` seulement. Le gérant, la caisse et les coiffeuses ne voient ni le menu ni les données, et l'API leur répond « 403 interdit ».

C'est une question de **confidentialité** : le module contient les salaires et les numéros de pièce d'identité. La loi sénégalaise sur les données personnelles (loi n° 2008-12) demande de limiter l'accès aux personnes qui en ont besoin.

### La liste

**Les alertes en haut de la liste.** L'ERP affiche une alerte pour chaque situation qui demande une décision :

| Alerte | Quand elle s'affiche |
|---|---|
| Fin de CDD, d'apprentissage ou de stage | 30 jours avant la date de fin |
| Contrat arrivé à sa fin | La date de fin est dépassée alors que le contrat n'est pas terminé dans l'ERP. Un CDD qui continue devient un CDI de plein droit. |
| Fin de période d'essai | 15 jours avant la fin de l'essai |
| Contrat non signé | Tant que le contrat signé n'a pas été ajouté (ou qu'aucune date de signature n'a été saisie) |

**L'équipe.** Un tableau présente chaque personne avec son poste, son type de contrat, ses dates, sa rémunération et l'état de son contrat. Le total des **salaires fixes du mois** s'affiche au-dessus du tableau.

**Les contrats terminés** sont rangés à part. Ils restent consultables : un dossier du personnel se garde même après le départ de la personne.

### La fiche d'un contrat

1. **L'employée** : son identité, ses numéros **CNI**, **IPRES** et **CSS**, son compte dans l'ERP et sa fiche dans le **planning**.
2. **Le contrat** : le type de contrat (CDI, CDD, apprentissage, stage ou prestataire), le poste, les dates, la fin de l'essai, les heures, les jours de travail et la date de signature.
3. **La rémunération** : le salaire fixe, la **commission** sur ses prestations et le mode de paiement. La commission est calculée toute seule à partir des rendez-vous **réalisés** dans le planning, au prix figé de chaque rendez-vous.
4. **Les documents** : le contrat signé en PDF et la pièce d'identité. Les fichiers sont rangés sur le disque **privé** du serveur (`storage/app/private`), jamais dans le dossier public. Quand on ajoute le contrat signé, le contrat est noté comme signé.

**À droite de la fiche**, on trouve trois blocs :
- **Les actions de fin de contrat** : « Passer en CDI », « Renouveler le CDD (1 fois) » et « Terminer le contrat ». En choisissant « Terminer le contrat », on indique le motif, et l'ERP estime l'indemnité de fin de CDD.
- **Les congés** : les jours acquis et les jours pris.
- **L'historique** des modifications.

**« Imprimer le contrat »** produit un **modèle de contrat** en PDF, rempli avec les informations de la fiche. Les cases à compléter apparaissent en doré. Le modèle est à faire relire avant signature.

### Concepts de développement à retenir

- **Chiffrement au repos.** Les numéros CNI, IPRES et CSS sont enregistrés avec le cast Laravel `encrypted`, qui les chiffre avec la clé `APP_KEY`. Une copie de la base volée ne les montre pas en clair. En revanche, si l'on perd `APP_KEY`, on ne peut plus les relire : il faut sauvegarder cette clé (voir 11_DEPLOIEMENT).
- **Le journal d'audit ne copie jamais ces numéros.** Pour cela, `getActivitylogOptions()` n'enregistre que certains champs, avec `logOnly`. Un test vérifie que le numéro de CNI n'apparaît pas dans le journal.
- **Les règles sont regroupées dans une seule classe**, `app/Services/Hr/ContractRules.php`. Si un comptable corrige un chiffre (durée maximale, pourcentage, congés), on ne modifie **que ce fichier**.
- **Les règles sont vérifiées par le serveur.** L'écran guide la propriétaire, mais c'est l'API qui refuse un CDD de plus de 2 ans ou un second renouvellement, comme pour la sécurité (07_ERP, §10).
- **Une fiche à part pour chaque personne** (`employees`), distincte de ses contrats successifs (`employment_contracts`). Quand un CDD devient un CDI, l'ERP **termine** le CDD et **crée** un CDI relié au CDD par `previous_contract_id`. On ne réécrit pas le CDD : son historique reste intact.

### Ce que le module ne fait pas (encore)

Le module ne fait pas encore les **bulletins de paie**, le calcul de l'**IR**, de l'IPRES et de la CSS, ni les **déclarations** mensuelles. Ces calculs dépendent de barèmes que le comptable doit d'abord confirmer (partie 3). On pourra les ajouter ensuite à partir de ce module, puisque les salaires et les commissions y sont déjà enregistrés.

---

## 2. Les règles du travail au Sénégal (ce qu'il faut savoir)

### Une loi toute neuve

Le Sénégal a un **nouveau Code du travail** : la **loi n° 2026-18 du 3 septembre 2026**. L'Assemblée nationale l'a votée le 18 août 2026, et elle a été publiée au **Journal officiel n° 7931 du 17 septembre 2026**.

Elle **remplace la loi n° 97-17 du 1er décembre 1997**. Selon les sources, elle s'applique **aussi aux contrats déjà en cours**, sans période de transition.

> Beaucoup de guides en ligne décrivent encore **l'ancien Code de 1997**. Vérifiez toujours la date et la loi citée par un guide.

### Les points du module et leur fiabilité

| Sujet | Ce que disent les sources | Confiance | Dans l'ERP |
|---|---|---|---|
| CDD : durée | **2 ans au plus** par contrat (art. 100) | Bonne, plusieurs sources concordent | Refusé au-delà |
| CDD : renouvellement | **Un seul** renouvellement ou une seule prolongation (art. 100). Le *projet* de loi en prévoyait 2, mais le texte adopté en garde 1 selon la plupart des sources. | Moyenne | Bouton bloqué après un renouvellement |
| CDD : cumul | **4 ans au plus** de CDD avec le même employeur (art. 100). Au-delà, le contrat devient un **CDI de plein droit** (art. 101). | Bonne | Renouvellement refusé au-delà des 4 ans ; alerte quand la date de fin est dépassée |
| CDD : forme | **Écrit**. Il serait à **déposer à l'inspection du travail avant le début**, avenants compris. | Moyenne (une seule source pour le dépôt) | Rappel sur la fiche et dans le PDF |
| Fin de CDD : indemnité | **7 %** de la rémunération brute versée, sauf exceptions (par exemple un CDI qui suit). Certains guides parlent encore de 6 %, qui est l'ancien taux. | Moyenne | Estimation affichée quand on termine un CDD |
| Période d'essai | Les durées du **nouveau** Code n'ont pas été trouvées. Sous l'ancien régime : environ 8 jours à 1 mois pour les employées, 3 mois pour les cadres, renouvelable une fois par écrit. | **Faible** | Date saisie librement, alerte 15 jours avant la fin |
| Congés payés | **2 jours ouvrables par mois** de service effectif, soit 24 jours par an, avec un bonus d'ancienneté. Ce sont les chiffres de l'ancien Code ; non vérifiés dans le nouveau. | Moyenne | 2 jours par mois dans le calcul « acquis » |
| Congé de maternité | **18 semaines** (contre 14 avant), dont 12 après l'accouchement selon un guide. L'indemnisation dépend du Code de la sécurité sociale (loi n° 2026-19). | Bonne pour la durée | Type « Congé de maternité » ; rappel des 18 semaines |
| Congé de paternité | Rien de trouvé | — | — |
| Préavis et indemnité de licenciement | Les montants du nouveau Code n'ont pas été trouvés. L'ancien Code fixait le préavis selon la catégorie et l'ancienneté. | **Faible** | Message « demandez conseil avant d'agir » |
| SMIG (salaire minimum) | **370,526 F CFA de l'heure**, soit environ **64 223 F CFA par mois** pour 173,33 heures (décret n° 2023-1710, en vigueur depuis le 1er juillet 2023). Une source donne 63 953 F. | Bonne | Rappel sous la rémunération |
| Télétravail | Désormais encadré : accord écrit, droit à la déconnexion, matériel fourni par l'employeur | Bonne | Pas concerné pour un salon |

### Trois situations propres à Dabo Hair

1. **Awa est la propriétaire.** Si Dabo Hair est une **entreprise individuelle**, Awa n'est **pas** salariée de sa propre entreprise et n'a pas de contrat de travail à saisir. Si Dabo Hair devient une **SARL** ou une **SUARL**, la gérante peut être rémunérée par la société : demandez au comptable comment.
2. **Le livreur « prestataire ».** C'est un vrai prestataire s'il **organise lui-même** son travail (ses horaires, son véhicule) et qu'il peut travailler pour d'autres. S'il a des horaires imposés et reçoit des ordres comme une salariée, la justice peut **requalifier** son contrat en contrat de travail, avec rappels de salaire et de cotisations. La fiche le rappelle.
3. **L'apprentie.** Le contrat d'apprentissage a ses propres règles : la forme du contrat, la formation donnée et une indemnité au lieu d'un salaire. Les sources consultées ne donnent ni la durée ni l'indemnité pour la coiffure dans le nouveau Code. Demandez à la Chambre de métiers de Dakar ou à l'inspection du travail.

### Le texte à lire

- **Journal officiel n° 7931 du 17 septembre 2026** (loi n° 2026-18 portant Code du travail), sur le portail **vie-publique.sn**, rubrique « Code du travail du Sénégal 2026 ». Lisez en priorité :
  - le titre sur le **contrat de travail** (articles 97 à 103 environ, dont **100 et 101** sur le CDD) ;
  - les articles sur l'**engagement à l'essai** ;
  - les articles sur les **congés** et la **maternité** ;
  - les articles sur la **rupture du contrat** (préavis et indemnités).
- **La Convention collective nationale interprofessionnelle (CCNI)**, qui fixe des minimums par catégorie (salaires, préavis). Le comptable saura si une convention de branche s'applique aux salons de coiffure.

---

## 3. Impôts et cotisations : ce que Dabo Hair paiera

Il y a **deux familles** de paiements :
- les **impôts de l'entreprise**, sur son activité ;
- les **charges sur les salaires**, dès qu'il y a une salariée.

### 3.1 Les impôts de l'entreprise : quel régime ?

**L'entreprise est une personne physique (entreprise individuelle), avec un petit chiffre d'affaires.**
- Elle relève de la **CGU** (Contribution globale unique), un impôt unique et simplifié.
- **Plafond de chiffre d'affaires annuel** : environ **50 millions de F CFA**. Certaines fiches anciennes donnent 25 millions pour les prestations de services ; une source dit que le seuil est unique depuis la loi n° 2019-17. *À confirmer*, car le salon fait des **prestations** et vend des **produits**.
- **Taux** : environ **5 %** du chiffre d'affaires pour les services et **2 %** pour le commerce et la production, avec un minimum à payer (de 25 000 à 30 000 F selon l'activité).
- La CGU **remplace** plusieurs impôts : impôt sur le revenu de l'activité, TVA, contribution des patentes (devenue **CEL**), et la contribution forfaitaire à la charge de l'employeur (**CFCE**).

**L'entreprise est une société (SARL, SUARL, SA) ou dépasse le plafond.**
- **Régime du réel.**
- **Impôt sur les sociétés** : **30 %** du bénéfice, avec un impôt **minimum** (0,5 % du chiffre d'affaires, entre 500 000 et 5 000 000 F).
- **TVA à 18 %** sur les ventes. Une seule source mentionne un taux réduit, pour d'autres secteurs.
- **CEL** (Contribution économique locale, ex-patente), versée à la commune.
- Comptabilité complète obligatoire.

**Rien ne montre que la CGU ait été supprimée** en 2025 ou en 2026. Une source indique que la loi de finances 2026 ne la modifie pas.

> **La question n° 1 pour le comptable :** « Avec un **NINEA en cours** et une activité mixte (salon + produits fabriqués et revendus), quel régime pour Dabo Hair, et sous quelle forme juridique ? » Le choix entre entreprise individuelle et SARL/SUARL change tout le reste.

### 3.2 Les charges sur les salaires (dès la première salariée)

| Paiement | Taux (sources concordantes, à confirmer) | Qui paie | À qui |
|---|---|---|---|
| **IPRES** (retraite), régime général | 14 % du salaire brut, plafond d'environ 432 000 F par mois (une source donne 360 000 F, ancienne valeur) | 8,4 % employeur, 5,6 % salariée | IPRES |
| IPRES cadres (complémentaire) | 6 % (3,6 % employeur, 2,4 % salariée) | Seulement pour les cadres | IPRES |
| **CSS** prestations familiales | 7 %, plafond de 63 000 F par mois | Employeur | Caisse de sécurité sociale |
| **CSS** accidents du travail | 1 à 5 % selon le risque de l'activité. La CSS notifie le taux à l'affiliation. | Employeur | Caisse de sécurité sociale |
| **IR** sur salaire | Barème progressif annuel (0 % jusqu'à 630 000 F, puis 20 %, 30 %, 35 %, 37 %, 40 %, voire 43 % selon les sources), après un abattement de 30 %, avec une réduction selon les parts familiales | **Retenu** sur le salaire par l'employeur | Impôts (DGID) |
| **TRIMF** | Petit montant annuel selon le salaire et les parts, retenu chaque mois | Retenu sur le salaire | Impôts (DGID) |
| **CFCE** | **3 %** de la masse salariale. Incluse dans la CGU pour une entreprise à la CGU. | Employeur | Impôts (DGID) |

**Le calendrier.** On déclare et on paie **chaque mois, avant le 15** du mois suivant :
- l'IR, la TRIMF et la CFCE sur **eTax** (DGID) ;
- les cotisations IPRES et CSS.

Pour une **salariée à 90 000 F brut**, l'ordre de grandeur des charges est le suivant :
- l'employeur paie en plus environ **8,4 % (IPRES) + 7 % (CSS) + 1 à 5 % (accidents du travail) ≈ 16 à 20 %**, soit environ **15 000 à 18 000 F par mois** ;
- la salariée voit retenir environ **5,6 % (IPRES)**, plus l'IR et la TRIMF si son salaire les rend dues.

*Ce sont des ordres de grandeur, pas une fiche de paie.*

### 3.3 Les démarches à ne pas oublier

1. **NINEA et RCCM** (en cours) : le NINEA identifie l'entreprise auprès des impôts.
2. **Affiliation employeur** à l'**IPRES** et à la **CSS** dès la **première** embauche, puis **déclaration de chaque salariée**.
3. **Dépôt des CDD** à l'inspection du travail, selon les sources sur le nouveau Code.
4. **Registre de l'employeur** et **bulletin de paie** remis chaque mois.
5. **Déclaration du traitement de données** à la CDP (déjà prévue dans la politique de confidentialité du site).

---

## 4. Ce que je propose de demander au comptable (liste à imprimer)

1. Quelle **forme juridique** et quel **régime fiscal** choisir : CGU ou réel ? Quel seuil s'applique à une activité mixte salon + produits ?
2. Les **taux exacts** en vigueur : IPRES (et son plafond), CSS (et le taux accidents du travail qui nous sera notifié), barème de l'IR et de la TRIMF.
3. Dans le **nouveau Code du travail** : la durée de la **période d'essai** pour une coiffeuse et pour une caissière, les règles de **préavis**, et le taux de l'**indemnité de fin de CDD** (7 % ?).
4. Le **contrat d'apprentissage** en coiffure : sa durée, l'indemnité, les formalités.
5. Le **livreur** : est-il prestataire ou salarié selon la façon dont il travaille ?
6. **Qui fait la paie** : le comptable, ou l'ERP plus tard, avec ses barèmes ?

---

## 5. Sources consultées (26 novembre 2026)

- Vie publique (Sénégal), *Code du travail du Sénégal 2026 : CDD, télétravail, harcèlement, articles et documents*, et le JO n° 7931 du 17 septembre 2026 : https://www.vie-publique.sn/dossiers/code-du-travail-senegal-reforme-2026
- Le Soleil, *Nouveau code du travail au Sénégal : la réforme entre désormais dans sa phase d'application* : https://lesoleil.sn/actualites/nouveau-code-du-travail-au-senegal-la-reforme-entre-desormais-dans-sa-phase-dapplication/
- Seneplus, *Code du travail 2026, ce qui change vraiment pour les travailleurs sénégalais* : https://www.seneplus.com/article/code-du-travail-2026-ce-qui-change-vraiment-pour-les-travailleurs-senegalais
- Echos Médias, *Sénégal : l'Assemblée adopte un nouveau Code du travail* : https://www.echosmedias.org/senegal-lassemblee-adopte-un-nouveau-code-du-travail/
- AfricaPaieRH, *Nouveau Code du travail Sénégal 2026 : ce qui change*, *Impôt sur salaire Sénégal 2026*, *SMIG Sénégal 2026* : https://africapaierh.com
- Droit social en pratique, *CDD au Sénégal en 2026* : https://www.droitsocialenpratique.com/cdd-au-senegal-en-2026-duree-renouvel-lement-et-requalification/
- CLEISS, *Les cotisations au Sénégal* : https://www.cleiss.fr/docs/cotisations/senegal.html
- Izipaie, *Déclarations IPRES, CSS et DAS au Sénégal* : https://izipaie.com/ressources/declarations-ipres-css-das-senegal
- Ministère français des Affaires étrangères, *Fiscalité du pays (Sénégal)* : https://www.diplomatie.gouv.fr/fr/services-aux-francais/preparer-son-expatriation/dossiers-pays-de-l-expatriation/senegal/fiscalite/article/fiscalite-du-pays-110064
- Senformation, *CGU Sénégal : la Contribution Globale Unique expliquée* : https://www.senformation.com/dossiers/se-mettre-a-son-compte-apres-une-formation/la-cgu-l-impot-du-petit-entrepreneur
- DGID, *Lois et règlements, Code général des impôts* : https://www.dgid.sn/loi-reglement
- Lextenso, *Sénégal : introduction de la contribution économique locale en remplacement de la patente* : https://www.labase-lextenso.fr/l-essentiel-droits-africains-des-affaires/2018-n6/senegal-introduction-de-la-contribution-economique-locale-en-remplacement-de-la-patente-DAA111h8
