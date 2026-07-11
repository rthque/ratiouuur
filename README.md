# Suivi de Chantier — Punch List Numérique

Outil web (100% statique, sans backend) pour suivre l'avancement de travaux, inspiré des affiches papier de punch list utilisées sur chantier (câblage inter-array, hookup charts, etc.).

## Concept

- **Catégories** : définissez vos propres catégories de suivi (ex: *Cable Cleats*, *PIM Gate*, *Scotch Kote*, *Gearing Repair*), chacune avec sa couleur — comme la légende manuscrite sur l'affiche.
- **Points** : chaque point de travail est un cercle divisé en parts (une par catégorie), exactement comme sur l'affiche. Cliquez une part pour la marquer faite/non faite.
- **Liaisons** : reliez les points entre eux (mode "Relier") pour représenter un tracé de câble ou un cheminement.
- **Points bloquants** : marquez un point d'une croix ✕ (comme les marqueurs rouges sur l'affiche) avec une note associée.
- **Punch List** : liste de tâches restantes à cocher, équivalente aux annotations manuscrites sur le côté de l'affiche.
- **Avancement** : barres de progression calculées automatiquement par catégorie et au global.
- **Projets multiples** : plusieurs chantiers/plans peuvent être gérés séparément.

Les données sont sauvegardées automatiquement dans le navigateur (`localStorage`). Utilisez **Exporter/Importer** pour sauvegarder un projet en JSON ou le transférer entre appareils.

## Utilisation

Aucune installation requise : ouvrez `index.html` dans un navigateur, ou hébergez le dossier tel quel sur n'importe quel serveur statique.

### Hébergement via GitHub Pages

Un workflow GitHub Actions (`.github/workflows/deploy.yml`) déploie automatiquement le site sur GitHub Pages à chaque push sur `master`. Pour l'activer : **Settings → Pages → Source: GitHub Actions** sur le dépôt.

## Structure

- `index.html` — structure de la page
- `styles.css` — styles (clair/sombre automatique)
- `app.js` — logique de l'application (aucune dépendance externe)
