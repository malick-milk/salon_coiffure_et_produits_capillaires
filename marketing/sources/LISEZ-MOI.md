# Sources des maquettes de promotion

Chaque visuel publié sur les réseaux a ici sa **page HTML d'origine** : on la retouche (un prix, une date, le nom de domaine) puis on la ré-exporte, au lieu de tout refaire.

| Dossier | Contenu | Images exportées |
|---|---|---|
| `lancement/` | campagne de lancement du site (15 décembre 2026), 21 jours, 5 réseaux ; validée le 16 novembre, mise à jour le 18 novembre (dates, offre membres, Facebook) en attente de validation ; détail dans `lancement/LISEZ-MOI.md` | `marketing/lancement/` |
| `promo-gamme/` | publication et story Instagram de la gamme au prix membre (10 000 F avec un compte gratuit, 15 000 F sans) | à exporter après validation |
| `_images/` | captures du site sur téléphone, utilisées dans les maquettes | — |

Exporter (taille exacte lue dans la maquette, échec si une image manque) :

```bash
node marketing/outils/exporter.cjs marketing/sources/lancement marketing/lancement
```

Ces maquettes sont produites par l'agent **maquettes-promo** (`.claude/agents/maquettes-promo.md`) : ses règles (charte, formats, prix à vérifier, ce qu'il ne fait jamais) sont dans ce fichier.
