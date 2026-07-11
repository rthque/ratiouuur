# Suivi de Chantier — Punch List Numérique

Outil web (100% statique, sans backend) pour suivre l'avancement de travaux, inspiré des affiches papier de punch list utilisées sur chantier (câblage inter-array, hookup charts, etc.).

## Concept

- **62 fondations** : le projet par défaut ("Parc éolien — 62 fondations") reconstruit la grille lettre (A–M, sans I) / rang (1–7) visible sur l'affiche papier, en conservant la même orientation. C'est une reconstruction au mieux depuis la photo d'affiche manuscrite — les positions et labels se corrigent facilement (glisser-déposer, renommer dans les détails du point).
- **Catégories principales (8 max)** : le camembert au centre de chaque fondation, une part par catégorie (ex: *Cable Cleats*, *PIM Gate*, *Scotch Kote*, *Gearing Repair*…), chacune avec sa couleur.
- **Variables secondaires (16 max)** : anneau de petits points autour du cercle, pour suivre des tâches précises (boulons, échelle, anodes, etc.), indépendamment des catégories principales.
- **Zoom & déplacement fluides** : pincer pour zoomer (tactile), molette (souris), boutons +/− et "vue d'ensemble" ; glisser pour déplacer la vue. Optimisé pour consulter les 62 fondations d'un coup d'œil sur mobile, puis zoomer sur un secteur précis.
- **Liaisons** : reliez les points entre eux (mode "Relier") pour représenter un tracé de câble ou un cheminement.
- **Points bloquants** : marquez un point d'une croix ✕ (comme les marqueurs rouges sur l'affiche) avec une note associée.
- **Punch List** : liste de tâches restantes à cocher, équivalente aux annotations manuscrites sur le côté de l'affiche.
- **Avancement** : barres de progression calculées automatiquement par catégorie, par variable secondaire et au global.
- **Projets multiples** : plusieurs chantiers/plans peuvent être gérés séparément.
- **Mobile-first** : sur petit écran, les catégories et le suivi/punch-list se rangent dans des tiroirs (☰ / 📋) pour laisser toute la place à la carte.

Les données sont sauvegardées automatiquement dans le navigateur (`localStorage`). Utilisez **Exporter/Importer** pour sauvegarder un projet en JSON ou le transférer entre appareils.

## Utilisation

Aucune installation requise : ouvrez `index.html` dans un navigateur, ou hébergez le dossier tel quel sur n'importe quel serveur statique.

### Hébergement via GitHub Pages

Un workflow GitHub Actions (`.github/workflows/deploy.yml`) déploie automatiquement le site sur GitHub Pages à chaque push sur `master`. Pour l'activer : **Settings → Pages → Source: GitHub Actions** sur le dépôt.

## Structure

- `index.html` — structure de la page
- `styles.css` — styles (clair/sombre automatique)
- `app.js` — logique de l'application (aucune dépendance externe)
