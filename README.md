# ORBITAL

Portfolio spatial interactif. Première étape : sortie d’hyperespace, espace, vaisseau et navigation entre trois planètes et l’Étoile de la Mort. Aucun intérieur de planète n’est développé.

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

Les quatre visuels fournis par l’utilisateur sont conservés dans public/planets/ et projetés sur des sphères 3D sans étirement de leurs globes déjà éclairés. Ils servent aussi à la carte et aux aperçus de destination. Le filtrage anisotrope, les mipmaps et une résolution de rendu adaptée aux écrans Retina préservent les détails. La géométrie et les textures procédurales précédentes servent de repli si un visuel ne se charge pas. Le préloader attend la fin du chargement des images. La géométrie du vaisseau et l’animation Lottie sont générées localement. Aucun asset distant requis. Le mode mouvement réduit est respecté. Une vue simplifiée permet de naviguer sans WebGL.

Les noms de planètes sont des références à Star Wars ; il s’agit d’un portfolio conceptuel indépendant.

Deux clins d’œil discrets : un astromécano miniature derrière le cockpit et deux soleils lointains près de Tatooine.

Le préloader simule une sortie d’hyperespace : traînées radiales qui décélèrent en étoiles fixes, puis révélation progressive de la scène. Il attend le chargement de la 3D et propose un fondu statique lorsque le mouvement réduit est activé.

Le modèle 3D du vaisseau suit la référence conservée dans references/x-wing.png : quatre ailes ouvertes, quatre moteurs à échappement rose, fuselage à sections octogonales, verrière encadrée, astromécano et panneaux patinés. Les détails statiques sont regroupés par matériau pour limiter les appels de rendu. Son envergure et son échelle dans la scène sont conservées.
