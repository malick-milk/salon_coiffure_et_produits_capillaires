# Les agents de Dabo Hair

Un agent est un **fichier d'instructions** dans `.claude/agents/`. Quand on lui confie une tâche, il travaille dans son propre contexte, avec seulement les outils et les règles de son fichier : comme un employé avec sa fiche de poste. Les agents sont sur GitHub : **toute session ouverte sur ce dépôt les connaît** (ils se chargent au démarrage de la session).

## L'annuaire

| Agent | Son métier | Ce qu'il ne fait jamais |
|---|---|---|
| `maquettes-promo` | visuels de promotion de la boutique pour Instagram, Facebook, TikTok, Snapchat, statut WhatsApp ; légendes, hashtags, liens mesurés | toucher au code du site, publier, inventer un prix, commit ou push |

## Parler à un agent

Une phrase qui commence par son nom, puis **la demande précise** :

> Utilise l'agent maquettes-promo pour créer une publication Instagram et un statut WhatsApp pour Noël : la gamme en coffret cadeau, réservée aux membres, publication le 20 décembre.

Plus la demande est précise (produit, prix, date, réseaux), moins l'agent écrit `[à confirmer]`. Ensuite :

1. l'agent fait des **aperçus** et un compte rendu ;
2. la session te les montre ; tu valides ou demandes des retouches ;
3. après validation seulement : images définitives, commit, push.

Un agent n'a **pas de mémoire** d'une fois sur l'autre. Sa mémoire, ce sont les fichiers : son fichier de règles et les `LISEZ-MOI.md` de ses travaux. Ce qui doit durer s'écrit dans le dépôt.

## Créer un nouvel agent toi-même

Écris d'abord le brouillon : c'est toi qui connais le besoin. Puis demande-moi mon avis (« relis mon agent X ») : je relis, je signale les trous, sans réécrire à ta place.

**Les questions à te poser avant d'écrire :**

1. **Quel métier, et un seul ?** « Les visuels de la boutique », pas « le marketing ». Un agent qui fait tout fait tout moyennement.
2. **Qu'est-ce qu'il ne fait jamais ?** C'est la partie la plus importante : code du site, publication, argent, données des clientes, commit et push.
3. **Où vérifie-t-il les faits ?** Prix, adresses, dates : un fichier du dépôt plutôt que sa mémoire.
4. **Que livre-t-il, et où ?** Fichiers créés, dossier des aperçus, compte rendu dans un ordre fixe.
5. **Quels outils lui faut-il ?** Le moins possible. Lire et écrire des fichiers ; la ligne de commande seulement s'il doit lancer un script.
6. **Comment saura-t-il qu'il a bien travaillé ?** Une vérification à faire avant de rendre (regarder chaque image, relancer un test…).

**Le squelette du fichier** (`.claude/agents/<nom>.md`) :

```markdown
---
name: <nom-en-minuscules>
description: <une phrase : son métier, quand l'utiliser, ce qu'il ne touche pas>
tools: Read, Write, Edit, Glob, Grep
---

Tu es <rôle> de Dabo Hair. <Son seul travail, en une phrase.>

## Ce que tu ne fais JAMAIS
## Les faits (et où les vérifier)
## Comment tu travailles
## Ton compte rendu
```

Pour t'en inspirer, relis `.claude/agents/maquettes-promo.md` : chaque partie y est remplie. Dans Claude Code, la commande `/agents` affiche et gère les agents du projet. Pense à ajouter chaque nouvel agent à l'annuaire ci-dessus.

## Outils branchés au projet (24 novembre 2026)

| Outil | Ce qu'il apporte | Où | Précautions |
|---|---|---|---|
| **Chrome DevTools MCP** 1.13.0 (officiel, équipe Chrome de Google) | Claude pilote un vrai Chrome : console, requêtes réseau, captures, **audit Lighthouse** (vitesse, accessibilité, référencement), enregistrement de performance | `.mcp.json` à la racine du dépôt (Claude Code le propose à la première ouverture : accepter) | `--isolated` : profil Chrome jetable, jamais vos comptes ni vos mots de passe enregistrés ; `--no-usage-statistics` : aucune statistique envoyée à Google. Version **fixée** : on monte de version volontairement, après lecture des notes de version |

**Décision du 24 novembre 2026 : seul Chrome DevTools est utilisé.** Pas de plugin Vercel (le site est prévu sur OVHcloud, Laravel + MySQL), pas d'oh-my-claudecode. Les agents sont créés par le responsable du projet, au fur et à mesure des besoins (voir « Créer un nouvel agent toi-même » ci-dessus).

**Pourquoi pas « oh-my-claudecode ».** Le paquet npm de ce nom appartient à un autre auteur que le projet connu (`Yeachan-Heo/oh-my-claudecode` sur GitHub) : risque d'usurpation. Ce plugin ajoute aussi des « hooks » qui s'exécutent à chaque message et changent la façon de travailler (modes automatiques). À n'installer, si on le décide, que depuis le dépôt GitHub officiel, après lecture de ses hooks.
