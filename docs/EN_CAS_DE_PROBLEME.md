# En cas de problème sur le site

Fiche pour Awa, la gérante et la personne qui maintient le site. **À imprimer et à garder près de la caisse.**

## 1. Les 3 boutons d'urgence

Ils marchent tout de suite, sans attendre une correction.

| Ce qui se passe | Que faire | Qui |
|---|---|---|
| Une **promotion** affiche un mauvais prix | ERP → **Promotions** → la promotion → **Arrêter maintenant**. Le prix initial revient immédiatement. | Propriétaire ou gérante |
| Un **produit** pose problème (mauvais prix, mauvaise photo, rupture non affichée) | ERP → **Produits et stock** → décocher **En vente**. Il disparaît du site, le reste continue. | Propriétaire ou gérante |
| **Tout le site est cassé juste après une mise à jour** | Sur le serveur : `bash /var/www/dabohair/current/deploy/rollback.sh`. La version précédente revient en une seconde. | Personne qui maintient le site |

## 2. Que faire selon la situation

| Situation | Gravité | Première action | Délai de correction habituel |
|---|---|---|---|
| Le site ne s'ouvre plus (e-mail d'UptimeRobot, ou page blanche sur plusieurs téléphones) | **Urgent** | Vérifier en 4G (pas le wifi du salon). Si toujours en panne : prévenir tout de suite la personne qui maintient le site. | Moins d'une heure |
| Les clientes ne peuvent plus commander ou réserver | **Urgent** | Prendre les commandes et les rendez-vous par **WhatsApp** en attendant ; noter l'heure et le message affiché. | 1 à 2 heures |
| Un prix est faux | **Urgent** | Bouton d'urgence (promotion ou produit), puis signaler. | Immédiat avec le bouton |
| Un e-mail « **[Dabo Hair] Erreur…** » arrive, mais le site marche | Normal | Le transférer à la personne qui maintient le site. Rien à faire de plus. | Dans la journée |
| Un texte faux, un affichage qui déborde sur téléphone | Pas urgent | Capture d'écran, à envoyer. | Quelques jours (groupé avec d'autres) |

## 3. Comment bien signaler (on corrige 2 fois plus vite)

Envoyer, par WhatsApp ou e-mail :

1. **Une capture d'écran** de la page, avec le message affiché ;
2. **L'heure** à laquelle c'est arrivé ;
3. **L'adresse de la page** (ce qui est écrit en haut du navigateur) ;
4. **Ce que vous faisiez** : « j'ai ajouté le spray au panier, puis cliqué sur Valider la commande » ;
5. **Le compte utilisé** : cliente, gérante, caissière… (le nom du compte, **jamais le mot de passe**).

À ne **jamais** envoyer : un mot de passe, le contenu du fichier `.env`, les codes de retrait des clientes.

## 4. Les e-mails d'erreur automatiques

Le site enregistre lui-même ses erreurs et prévient la propriétaire par e-mail (adresse réglée par `ALERT_EMAIL` sur le serveur).

- **Un e-mail à la première apparition** d'une erreur, puis **au plus un par heure** pour la même erreur : pas d'avalanche.
- Le message dit **où** (serveur ou navigateur d'une visiteuse), **quoi**, et **combien de fois**.
- Les données personnelles sont **masquées** avant l'enregistrement : e-mails, numéros de téléphone, jetons, mots de passe. Rien ne part chez un service extérieur : tout reste sur notre serveur.
- Les erreurs plus vues depuis 90 jours sont effacées automatiquement.
- Les erreurs « normales » ne déclenchent **pas** d'e-mail : page introuvable, formulaire mal rempli, mot de passe faux.

## 5. Pour la personne qui maintient le site

| Besoin | Commande (sur le serveur) |
|---|---|
| Bilan de santé : services, disque, mémoire, sauvegardes | `bash /var/www/dabohair/current/deploy/sante.sh` |
| Revenir à la version précédente | `bash /var/www/dabohair/current/deploy/rollback.sh` |
| Lire les dernières erreurs du serveur | `tail -n 50 /var/www/dabohair/shared/storage/logs/laravel.log` |
| Liste des erreurs enregistrées (les plus récentes) | `cd /var/www/dabohair/current/backend && php artisan tinker --execute='App\Models\ErrorReport::latest("last_seen_at")->take(10)->get(["source","message","location","occurrences","last_seen_at"])->each(fn($r)=>print($r->last_seen_at." ".$r->occurrences."x ".$r->message." (".$r->location.")\n"));'` |
| Restaurer la base (en dernier recours) | `bash /var/www/dabohair/current/deploy/restore.sh` (voir `docs/11_DEPLOIEMENT.md` §6) |

Le circuit d'une correction : reproduire le problème, corriger, **ajouter un test** pour qu'il ne revienne pas, laisser la CI tout vérifier (environ 12 minutes), puis mettre en ligne avec `deploy.sh` (2 à 5 minutes, sans couper le site).
