# ORBITAL

Portfolio spatial interactif. Première étape : préloader, espace, vaisseau et navigation entre trois planètes. Aucun intérieur de planète n’est développé.

## Lancer

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000. `npm run build` produit un export statique dans `out/`.

## Stack

Next.js App Router, React, TypeScript, Tailwind CSS 4, Motion, Three.js, Lottie React et Lucide.

## Commandes

- « Prendre les commandes » : activer le pilotage.
- Flèches, ZQSD ou WASD : déplacer le vaisseau.
- Glisser dans l’espace : diriger à la souris ou au doigt.
- Maj : accélérer. E : rejoindre la destination sélectionnée.
- Carte stellaire ou destinations : effectuer un saut et afficher la mise en orbite.
- Échap : fermer une interface. Le bouton ORBITAL réinitialise le voyage.
- Audio désactivé au départ ; le bouton sonore active une ambiance synthétisée localement.

Textures des planètes, géométrie du vaisseau et animation Lottie originales, générées localement. Aucun asset externe requis. Le mode mouvement réduit est respecté. Une vue simplifiée permet de naviguer sans WebGL.

Les noms de planètes sont des références à Star Wars ; il s’agit d’un portfolio conceptuel indépendant.
