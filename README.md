# Planning de révisions — PASS

Agenda de révisions personnel, pensé pour une année de PASS. Fonctionne entièrement hors-ligne, sans installation ni compte : un seul fichier HTML, ouvrable dans n'importe quel navigateur.

## Fonctionnalités

- **Calendrier hebdomadaire** navigable par semaine (dates réelles, numéro de semaine), avec des blocs colorés déplaçables (matières, pauses, repas, sport, sommeil, cours...) et une note libre par bloc pour préciser une révision.
- **To-do de la semaine**, une liste par jour, synchronisée avec la même navigation de semaine que le calendrier.
- **Suivi par matière** : historique des révisions (date, durée, chapitre travaillé, niveau de maîtrise, note obtenue), matières ajoutables et supprimables.
- **Entraînement — annales et QCM** : suivi des sessions d'entraînement avec note obtenue.
- **3 thèmes** (noir, bleu, vert) et fond personnalisable.
- **Export / import des données** en JSON, pour sauvegarder ou transférer son planning d'un appareil à l'autre.

## Utilisation

1. Ouvre `index.html` dans un navigateur (double-clic, ou glisser-déposer dans une fenêtre de navigateur).
2. Toutes les données sont sauvegardées automatiquement dans le navigateur (`localStorage`) — rien n'est envoyé sur internet.
3. Avant de changer d'appareil ou de navigateur, utilise le bouton **Exporter mes données** (en bas de page) pour télécharger une sauvegarde, puis **Importer un fichier** sur l'autre appareil.

## Hébergement (GitHub Pages)

Ce dépôt peut être publié via GitHub Pages : Réglages du dépôt → Pages → sélectionner la branche `main` et le dossier racine. Le fichier `index.html` sera alors accessible via une URL publique.

⚠️ Les données restent stockées localement dans le navigateur de chaque appareil, même en hébergeant le site : GitHub Pages sert uniquement le fichier, il n'y a pas de synchronisation automatique entre appareils.

## Stack technique

HTML / CSS / JavaScript natifs, sans framework ni dépendance de build. Voir le fichier unique `index.html`.
