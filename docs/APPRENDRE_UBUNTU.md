# Apprendre Ubuntu pour gérer le serveur de Dabo Hair

> Pour qui : vous, qui allez administrer le serveur de production, sans expérience préalable de Linux.
> Objectif : en 4 semaines, à raison de 30 à 45 minutes par jour, savoir installer, mettre à jour, surveiller et dépanner le serveur, **sans risque pour le vrai site**.
> Méthode : tout se pratique d'abord sur **votre ordinateur**, grâce à WSL (un vrai Ubuntu dans Windows), puis seulement sur le serveur.

---

## 1. Pourquoi Ubuntu ?

| Question | Réponse |
|---|---|
| Pourquoi Linux et pas Windows pour un serveur ? | Plus de 90 % des serveurs web tournent sous Linux. Il est gratuit, léger (pas d'interface graphique : toute la mémoire sert au site) et tous les outils du projet (Nginx, PHP, MySQL) y sont nés |
| Pourquoi Ubuntu parmi les Linux ? | C'est le plus utilisé et le plus documenté. Les versions « LTS » (comme la 24.04) sont maintenues **5 ans** avec des correctifs de sécurité gratuits |
| Faut-il tout savoir ? | Non. Une trentaine de commandes couvrent 95 % du travail d'administration de ce serveur (§5) |

Sur un serveur, il n'y a **ni souris ni fenêtres**, seulement un terminal. C'est déroutant au début, puis on découvre que c'est **plus rapide** et surtout **reproductible** : une commande se copie, se documente et se rejoue à l'identique.

---

## 2. Installer Ubuntu sur votre ordinateur (WSL), en 10 minutes

**WSL** (Windows Subsystem for Linux) fait tourner un vrai Ubuntu dans Windows, sans rien effacer. C'est votre **terrain d'entraînement** : vous pouvez tout y casser, ce n'est pas grave.

1. Ouvrez **PowerShell en administrateur** (clic droit sur le menu Démarrer → « Terminal (administrateur) »), puis :

   ```powershell
   wsl --install -d Ubuntu-24.04
   ```

2. Redémarrez l'ordinateur si on vous le demande.
3. Au premier lancement, choisissez un **nom d'utilisateur** et un **mot de passe**. Rien ne s'affiche quand vous tapez le mot de passe : c'est normal, c'est une sécurité.
4. Ensuite, ouvrez « Ubuntu » depuis le menu Démarrer.

Vos fichiers Windows sont visibles depuis Ubuntu dans `/mnt/c/Users/EM2D/`.

---

## 3. Le programme en 4 semaines

Chaque semaine : des notions, des exercices **sur votre projet**, et un test pour vérifier que c'est acquis.

### Semaine 1 — Se déplacer et manipuler des fichiers

| Commande | Rôle | Exercice |
|---|---|---|
| `pwd` | Où suis-je ? | La lancer après chaque `cd` |
| `ls -la` | Lister, y compris les fichiers cachés | Repérer `.env.example` dans le projet |
| `cd dossier`, `cd ..`, `cd ~` | Se déplacer | Aller dans `deploy/`, puis revenir |
| `cat`, `less`, `head`, `tail -n 20` | Lire un fichier | Lire `deploy/deploy.sh` avec `less` (on quitte avec `q`) |
| `cp`, `mv`, `rm`, `mkdir` | Copier, déplacer, supprimer, créer | Créer un dossier `essais`, y copier `README.md`, le supprimer |
| `nano fichier` | Modifier un fichier | Modifier une copie de `home.ts`, enregistrer (Ctrl + O), quitter (Ctrl + X) |
| `grep -rn "mot" dossier` | Chercher dans des fichiers | Trouver où apparaît « Activ’Pousse » dans `backend/` |

Pour commencer, récupérez le projet dans Ubuntu :

```bash
git clone https://github.com/malick-milk/salon_coiffure_et_produits_capillaires.git
```

> **Le piège n° 1** : `rm` ne passe pas par une corbeille, ce qui est supprimé est perdu. Ne tapez **jamais** `rm -rf /` ni `rm -rf *` sans savoir exactement dans quel dossier vous êtes (`pwd` d'abord).

**Test de fin de semaine** : retrouver, sans aide, dans quel fichier est défini le mot de passe initial du propriétaire (indice : `grep -rn "password" backend/app/Console`).

### Semaine 2 — Utilisateurs, droits, paquets

C'est la semaine qui explique **pourquoi** le script de déploiement fait ce qu'il fait.

| Notion | Commandes | Lien avec votre serveur |
|---|---|---|
| Utilisateurs et groupes | `whoami`, `id`, `sudo adduser essai` | Le serveur a `dabo` (qui déploie) et `www-data` (qui fait tourner PHP et Nginx) |
| Super-utilisateur | `sudo commande` | `root` peut tout, y compris tout casser : on ne l'utilise que pour installer |
| Droits | `ls -l`, `chmod 640 fichier`, `chown dabo:www-data fichier` | Le `.env` est en **640** : le propriétaire lit et écrit, le groupe lit, les autres rien |
| Paquets | `sudo apt update`, `sudo apt install tree`, `apt list --upgradable` | C'est ainsi que le serveur installe PHP, MySQL, Nginx |

**Lire des droits** : `-rw-r-----` se découpe en `rw-` (propriétaire : lecture et écriture), `r--` (groupe : lecture), `---` (les autres : rien). En chiffres, `r` = 4, `w` = 2, `x` = 1, donc 6 + 4 + 0 = **640**.

**Test** : créer un fichier `secret.txt` que vous seul pouvez lire (`chmod 600`), puis vérifier avec un autre utilisateur (`sudo -u essai cat secret.txt`) que la lecture est refusée.

### Semaine 3 — Services, journaux, réseau

| Notion | Commandes |
|---|---|
| Services (programmes qui tournent en permanence) | `systemctl status nginx`, `sudo systemctl restart php8.3-fpm` |
| Journaux | `sudo journalctl -u nginx -n 50`, `tail -f fichier.log` (suivre en direct, Ctrl + C pour arrêter) |
| Processus | `top` (q pour quitter), `ps aux \| grep php`, `free -h`, `df -h` |
| Réseau | `curl -I https://dabohair.com`, `ping`, `ss -tlnp` (quels ports écoutent) |
| Tâches planifiées | `cat /etc/cron.d/dabohair`, `crontab -l` |

**Exercice clé : la répétition générale.** Installez le site dans votre Ubuntu WSL **exactement** comme sur le serveur. C'est le meilleur entraînement possible, et sans risque :

```bash
sudo SKIP_TLS=1 SKIP_FIREWALL=1 SKIP_SSH_HARDENING=1 bash salon_coiffure_et_produits_capillaires/deploy/provision.sh localhost vous@exemple.com
```

```bash
sudo -u dabo bash salon_coiffure_et_produits_capillaires/deploy/deploy.sh --first
```

Puis ouvrez **http://localhost** dans Chrome, sous Windows : le site tourne sur « votre serveur ». Entraînez-vous ensuite avec `sante.sh`, `backup.sh`, `restore.sh` et `rollback.sh`.

**Test** : arrêter volontairement PHP (`sudo systemctl stop php8.3-fpm`), constater l'erreur « 502 » dans le navigateur, la retrouver dans `sudo tail /var/log/nginx/dabohair.error.log`, puis réparer.

### Semaine 4 — SSH et sécurité, puis le vrai serveur

| Notion | Commandes |
|---|---|
| Clé SSH (déjà vue au §3.1 de [11_DEPLOIEMENT.md](11_DEPLOIEMENT.md)) | `ssh-keygen -t ed25519`, `ssh dabo@adresse` |
| Copier un fichier vers ou depuis le serveur | `scp fichier dabo@adresse:/tmp/` |
| Pare-feu | `sudo ufw status` |
| Bannissements | `sudo fail2ban-client status sshd` |
| Mises à jour | `sudo apt update && sudo apt upgrade`, puis `sudo reboot` si le fichier `/var/run/reboot-required` existe |

Cette semaine-là, on fait la **vraie mise en ligne ensemble** (§3 de [11_DEPLOIEMENT.md](11_DEPLOIEMENT.md)), avec ce que vous avez répété en semaine 3.

---

## 4. Les règles de sécurité de l'administrateur

1. **Comprendre avant de lancer.** Ne copiez jamais une commande trouvée sur Internet sans savoir ce qu'elle fait, surtout avec `sudo`. En cas de doute, demandez-moi.
2. **Instantané avant une opération risquée.** Chez OVHcloud, un « snapshot » du serveur se prend en un clic depuis l'espace client : c'est un point de retour complet.
3. **Une seule commande à la fois** sur le serveur, en lisant le résultat avant de passer à la suivante.
4. **Jamais de modification directe du code sur le serveur** : on modifie sur l'ordinateur, on pousse sur GitHub, on déploie.
5. **Le terminal ne pardonne pas les fautes de frappe** : relisez les commandes qui contiennent `rm`, `>` (écrase un fichier) ou `DROP`.

---

## 5. Aide-mémoire : les commandes du serveur Dabo Hair

| Je veux… | Commande |
|---|---|
| Me connecter | `ssh dabo@dabohair.com` |
| Mettre le site à jour | `bash /var/www/dabohair/current/deploy/deploy.sh` |
| Annuler la dernière mise à jour | `bash /var/www/dabohair/current/deploy/rollback.sh` |
| Faire le bilan de santé | `bash /var/www/dabohair/current/deploy/sante.sh` |
| Sauvegarder maintenant | `bash /var/www/dabohair/current/deploy/backup.sh` |
| Tester une restauration | `bash /var/www/dabohair/current/deploy/restore.sh` |
| Voir les dernières erreurs du site | `tail -n 50 /var/www/dabohair/shared/storage/logs/laravel-$(date +%F).log` |
| Voir les tentatives d'intrusion | `tail -n 30 /var/www/dabohair/shared/storage/logs/security-$(date +%F).log` |
| Redémarrer PHP ou Nginx | `sudo systemctl restart php8.3-fpm` ou `sudo systemctl restart nginx` |
| Espace disque, mémoire | `df -h`, `free -h` |
| Installer les mises à jour système | `sudo apt update && sudo apt upgrade` |
| Me déconnecter | `exit` |

---

## 6. Pour aller plus loin (ressources gratuites)

| Ressource | Pour quoi |
|---|---|
| [Tutoriel officiel Ubuntu : la ligne de commande pour débutants](https://ubuntu.com/tutorials/command-line-for-beginners) | Le point de départ (en anglais, très progressif) |
| [Linux Journey](https://linuxjourney.com) | Cours courts et illustrés, par thème |
| [OverTheWire : Bandit](https://overthewire.org/wargames/bandit/) | Un jeu : chaque niveau se gagne avec une commande Linux. Idéal pour ancrer les réflexes |
| *The Linux Command Line*, de William Shotts ([linuxcommand.org](https://linuxcommand.org/tlcl.php)) | Le livre de référence, gratuit en PDF |
| `man commande` (ex. `man chmod`) | Le manuel intégré à Ubuntu (q pour quitter) |

Et le plus efficace : à chaque opération sur le serveur, je vous explique ce que fait chaque commande. Au bout de quelques mises à jour, vous les ferez seul.
