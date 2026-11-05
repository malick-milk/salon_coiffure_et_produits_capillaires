# Guide de maintenance

> Pour la personne qui gère le serveur au quotidien. Connexion : `ssh dabo@dabohair.com`.

## Tâches périodiques

| Quand | Quoi | Commande |
|---|---|---|
| Automatique, chaque minute | Planificateur Laravel (agrégats analytiques à 00 h 30) | `/etc/cron.d/dabohair` |
| Automatique, chaque nuit à 2 h 15 | Sauvegarde chiffrée de la base | `/etc/cron.d/dabohair` |
| Automatique, chaque nuit | Mises à jour de **sécurité** du système | unattended-upgrades |
| Automatique, tous les 60 jours | Renouvellement du certificat HTTPS | certbot.timer |
| Automatique, chaque lundi | Audit des failles connues des bibliothèques | GitHub Actions (onglet Actions) |
| **Chaque semaine** (5 min) | Bilan de santé | `bash /var/www/dabohair/current/deploy/sante.sh` |
| **Chaque mois** (10 min) | Tester une restauration | `bash /var/www/dabohair/current/deploy/restore.sh` |
| Chaque mois | Mises à jour du système, puis redémarrage si demandé | `sudo apt update && sudo apt upgrade` |
| Quand l'audit du lundi est rouge | Mettre à jour les bibliothèques (sur votre ordinateur, tests, push, déploiement) | `composer update` / `npm update` |
| Chaque année | Renouveler le domaine (activez le renouvellement automatique) | bureau d'enregistrement |

## Surveillance et logs

| Je veux savoir… | Où regarder |
|---|---|
| Si le site est en ligne | UptimeRobot (alerte par email), ou `curl -I https://dabohair.com/up` |
| L'état général du serveur | `bash /var/www/dabohair/current/deploy/sante.sh` |
| Pourquoi une page affiche « Une erreur est survenue » | `tail -n 50 /var/www/dabohair/shared/storage/logs/laravel-$(date +%F).log` |
| Si quelqu'un essaie de forcer les connexions | `tail -n 30 /var/www/dabohair/shared/storage/logs/security-$(date +%F).log` |
| Qui a modifié quoi dans l'ERP | ERP → Journal d'audit |
| Les erreurs du serveur web | `sudo tail -n 50 /var/log/nginx/dabohair.error.log` |
| Les adresses bannies par fail2ban | `sudo fail2ban-client status sshd` |
| Si les sauvegardes tournent | `tail /var/www/dabohair/shared/storage/logs/backup.log` |

## Incidents fréquents

| Symptôme | Cause probable | Solution |
|---|---|---|
| Le site affiche « 502 Bad Gateway » | PHP est arrêté | `sudo systemctl restart php8.3-fpm` |
| « Une erreur est survenue » partout | Base de données arrêtée ou disque plein | `sudo systemctl status mysql`, puis `df -h` |
| Une mise à jour a introduit un bug | — | `bash /var/www/dabohair/current/deploy/rollback.sh` |
| Disque presque plein | Journaux ou sauvegardes | Les versions, journaux et sauvegardes anciens sont supprimés automatiquement ; sinon, agrandir le disque chez l'hébergeur |
| Certificat expiré (alerte du navigateur) | Renouvellement bloqué | `sudo certbot renew`, puis `sudo systemctl reload nginx` |
| Vous avez perdu l'accès SSH | Clé perdue | Console de secours de l'hébergeur (espace client OVHcloud → KVM), puis ajouter une nouvelle clé dans `~/.ssh/authorized_keys` |
| Erreur grave dans les données | — | `restore.sh` (voir DEPLOYMENT_GUIDE.md) |

## Règles d'or

1. **Ne jamais modifier le code directement sur le serveur.** On modifie sur l'ordinateur, on teste, on pousse sur GitHub, puis on déploie. Sinon, la modification sera perdue au prochain déploiement.
2. **Ne jamais partager un compte.** Un compte par personne dans l'ERP, sinon le journal d'audit ne sert plus à rien.
3. **Une sauvegarde non testée n'est pas une sauvegarde** : un test de restauration par mois.
4. **La clé des sauvegardes vit en deux endroits** : le serveur, et un lieu sûr hors du serveur.
