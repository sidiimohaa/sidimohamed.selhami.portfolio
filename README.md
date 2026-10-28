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

## Exploration immersive

L'approche automatique suit une courbe avec accélération progressive puis freinage. Le X-wing s'incline selon le virage et la caméra le poursuit avec un léger retard ; la poussée visuelle et sonore suit sa vitesse. Le trajet contourne les autres planètes. L'arrivée est déclenchée par la fin réelle du vol, et non par un minuteur indépendant. Annuler une approche rend les commandes au pilote. Au repos, le vaisseau n'avance toujours pas. Le mode mouvement réduit conserve une arrivée directe sans inclinaison ni effet de vitesse.

- Le halo de ciblage, le nom et la distance apparaissent uniquement lorsque la planète est visée ou survolée. E rejoint la planète visée (ou la planète focalisée au clavier).
- L’approche garde la vue 3D visible et peut être annulée. L’arrivée affiche une petite transmission non modale ; le pilotage la referme naturellement. Les intérieurs des planètes restent à développer.
- Les références planétaires restent attachées aux sphères dans un repère fixe. Une lumière directionnelle, une atmosphère indépendante, les nuages d’Endor, une fine poussière de Tatooine et les éclairages nocturnes de Coruscant donnent du relief pendant les déplacements.
- L’audio est coupé par défaut. Le bouton sonore active un moteur synthétisé qui réagit à l’accélération, une décélération d’hyperespace et les bips de l’astromécano. Le son peut aussi être activé pendant le préloader ; l’aide permet de rejouer l’arrivée.
- La commande circulaire apparaît sous le doigt sur mobile (et dans les aperçus étroits), puis disparaît au relâchement. Aucun déplacement ni inertie n’est ajouté au repos.
- Cliquer sur le petit astromécano fait tourner sa tête et allume brièvement son œil. Les bips respectent le bouton de son et le mouvement réduit est pris en compte.
- Le ciel compte environ 5 600 étoiles de tailles, couleurs et éclats variés qui scintillent, une bande galactique et une nébuleuse discrète, calculée une seule fois au chargement. Des étoiles filantes traversent parfois le haut du ciel.
- Après 30 secondes de vol, puis toutes les 3 minutes, un vaisseau sort de l'hyperespace, traverse le champ de vision devant les planètes, puis repart en vitesse lumière. Les passages alternent : un destroyer en forme de dague (pont en gradins, tour de commandement à deux dômes, hublots allumés), un cargo en disque à mandibules et cockpit décalé, puis un chasseur argenté au nez en aiguille. Chaque vaisseau s'incline vers la caméra pour montrer son pont, comme dans une vue de trois quarts. Le passage se fige quand une interface est ouverte, et le son du saut suit le bouton sonore.
- Les astéroïdes autour de Tatooine dérivent et tournent sur eux-mêmes ; trois balises de patrouille orbitent autour de l'Étoile de la Mort.
- À l'arrivée, chaque planète est cadrée à une taille comparable, au-dessus du vaisseau et à l'écart de la transmission. Son étiquette passe au-dessus d'elle lorsqu'elle toucherait le vaisseau. Sur écran étroit, la caméra recule pour que toutes les planètes tiennent dans le cadre.
- En mouvement réduit, le scintillement, les étoiles filantes et le convoi sont désactivés, et les astéroïdes comme les balises restent immobiles.

## Atterrissage sur Coruscant

- En orbite de Coruscant, le bouton « Atterrir » (ou E) fait descendre le vaisseau sur la plateforme 3-7 : un plan large suit le X-wing qui freine et se pose, puis la caméra passe à hauteur d'yeux. « Passer » saute la cinématique.
- La ville est générée sur place : des milliers de tours dont les fenêtres sont dessinées par le shader, une brume de crépuscule et des couloirs de trafic aérien. La scène spatiale cesse de se dessiner tant qu'on est au sol.
- Exploration libre : flèches, ZQSD ou WASD pour marcher (Maj pour courir). Glisser à la souris fait tourner le regard dans toutes les directions, pour lever les yeux vers les tours ou les baisser vers le pont. Au doigt, la moitié gauche de l'écran sert de joystick de marche et la moitié droite de regard, les deux en même temps si besoin. Le vaisseau, les caisses, les terminaux, l'équipe et les droids bloquent le passage.
- La plateforme vit. Un astromécano blanc à dôme rouge fait sa ronde autour du X-wing ; il s'arrête quand on lui barre la route, tourne son dôme vers le visiteur et bipe. Deux droids de piste réparent un moteur dans des gerbes d'étincelles pendant qu'un troisième trotte derrière le vaisseau, et un droid de combat monte la garde à l'avant de la plateforme, la tête tournée vers le visiteur quand il approche. L'équipe au sol porte la tenue des pilotes (combinaison orange, gilet blanc à boîtier de poitrine, casque blanc à visière orange) : l'un vérifie un moteur, l'autre fait l'aller-retour jusqu'aux caisses. Un chariot flottant transporte une caisse et un drone de surveillance tourne au-dessus. Les moteurs refroidissent en lâchant de la vapeur après l'atterrissage, des grilles du sol en crachent par bouffées, et un taxi volant vient se garer au bord de la plateforme avant de repartir dans le trafic.
- Avec le son activé, la ville prend le relais du moteur spatial : rumeur lointaine, rafales de vent sur la plateforme et passages de trafic d'une oreille à l'autre. On entend aussi ses pas sur le pont métallique, un carillon quand un hologramme s'allume, et le taxi qui arrive puis repart.
- Quatre terminaux holographiques (identité, transmission, réseaux, disponibilité) s'allument quand on s'en approche et ouvrent un panneau lisible avec de vrais liens. Cliquer un hologramme ou un bouton de la barre du bas y conduit automatiquement, en contournant le vaisseau.
- « Décoller » ramène en orbite. En mouvement réduit, les cinématiques sont coupées, les déplacements automatiques deviennent instantanés, la vapeur et les étincelles disparaissent, l'équipe et les droids restent immobiles et le taxi attend à quai.
- Les textes sont provisoires : ils se remplacent dans `landings` de `components/universe.ts`. Tatooine, Endor et l'Étoile de la Mort suivront le même modèle.

## Atterrissage sur Tatooine

- En orbite de Tatooine, « Atterrir » (ou E) pose le X-wing dans la baie d'amarrage 94 de Mos Eisley : un cercle de sable tassé entouré d'un mur d'adobe, avec un grand portail par lequel on voit les deux soleils se coucher sur les dunes.
- Autour : village de dômes et de tours, évaporateurs d'humidité, dunes et mesas dans la brume. Le vent souffle des bouffées de sable sur le sol de la baie et l'ambiance sonore est celle du désert.
- Chaque terminal présente un projet (titre, ligne « rôle · technos · année », description, liens). Les quatre projets sont provisoires : ils se remplacent dans `landings.Tatooine` de `components/universe.ts`.
- Les deux planètes partagent la même disposition et le même fonctionnement (`components/landingKit.ts`) ; chaque décor a son fichier (`coruscantZone.ts`, `tatooineZone.ts`).
