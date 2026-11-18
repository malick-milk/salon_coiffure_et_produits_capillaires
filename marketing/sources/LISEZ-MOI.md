# Sources des maquettes de promotion

Chaque visuel publié sur les réseaux a ici sa **page HTML d'origine** : on la retouche (un prix, une date, le nom de domaine) puis on la ré-exporte, au lieu de tout refaire.

| Dossier | Contenu | Images exportées |
|---|---|---|
| `lancement/` | campagne de lancement du site, 21 jours, 4 réseaux (validée le 16 novembre 2026) | `marketing/lancement/` |
| `promo-gamme/` | publication et story Instagram de la gamme en promotion | à exporter après validation |
| `_images/` | captures du site sur téléphone, utilisées dans les maquettes | — |

Exporter (taille exacte lue dans la maquette, échec si une image manque) :

```bash
node marketing/outils/exporter.cjs marketing/sources/lancement marketing/lancement
```

Ces maquettes sont produites par l'agent **maquettes-promo** (`.claude/agents/maquettes-promo.md`) : ses règles (charte, formats, prix à vérifier, ce qu'il ne fait jamais) sont dans ce fichier.
