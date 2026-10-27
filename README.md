# ORBITAL

Portfolio spatial interactif. Première étape : préloader, espace, vaisseau et navigation entre trois planètes et l’Étoile de la Mort. Aucun intérieur de planète n’est développé.

## Lancer

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000. `npm run build` produit un export statique dans `out/`.

## Stack

Next.js App Router, React, TypeScript, Tailwind CSS 4, Motion, Three.js, Lottie React et Lucide.

## Commandes

- Le vaisseau reste immobile au repos. Aucun vol automatique ni inertie après relâchement des commandes.
- Flèches, ZQSD ou WASD : traverser l’espace avec une caméra de poursuite derrière le vaisseau. Maintenir les commandes oriente le vol et fait avancer le vaisseau dans la direction visée. Les relâcher arrête immédiatement le déplacement.
- Maintenir et glisser dans l’espace : diriger à la souris ou au doigt. Relâcher pour s’arrêter.
- Maj ou deux doigts pendant le glissement : accélérer. E : rejoindre la dernière destination sélectionnée.
- Survoler une planète pour afficher son nom ; cliquer pour l’approcher. La carte reste accessible en haut à droite.
- Échap : fermer une interface. Le logo ORBITAL ou le bouton de retour réinitialise le voyage. Le bouton ? affiche les commandes.
- Audio désactivé au départ ; le bouton sonore active une ambiance synthétisée localement.

Textures des planètes, modèle de station avec parabole concave et tranchée équatoriale, géométrie du vaisseau et animation Lottie originales, générées localement. Aucun asset externe requis. Le mode mouvement réduit est respecté. Une vue simplifiée permet de naviguer sans WebGL.

Les noms de planètes sont des références à Star Wars ; il s’agit d’un portfolio conceptuel indépendant.

Deux clins d’œil discrets : un astromécano miniature derrière le cockpit et deux soleils lointains près de Tatooine.
