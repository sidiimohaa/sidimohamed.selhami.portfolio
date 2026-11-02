# ORBITAL

Portfolio spatial interactif. Première étape : sortie d’hyperespace, espace, vaisseau et navigation entre trois planètes et l’Étoile de la Mort. Aucun intérieur de planète n’est développé.

## Lancer

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000. `npm run build` produit un export statique dans `out/`.

## Stack

Next.js App Router, React, TypeScript, Tailwind CSS 4, Motion, Three.js et Lucide.

## Commandes

- Le vaisseau reste immobile au repos. Aucun vol automatique ni inertie après relâchement des commandes.
- Flèches, ZQSD ou WASD : traverser l’espace avec une caméra de poursuite derrière le vaisseau. Maintenir les commandes oriente le vol et fait avancer le vaisseau dans la direction visée. Les relâcher arrête immédiatement le déplacement.
- Maintenir et glisser dans l’espace : diriger à la souris ou au doigt. Relâcher pour s’arrêter.
- Maj ou deux doigts pendant le glissement : accélérer. E : rejoindre la dernière destination sélectionnée.
- Survoler une planète pour afficher son nom ; cliquer pour l’approcher. La carte reste accessible en haut à droite.
- Échap : fermer une interface. Le logo ORBITAL ou le bouton de retour réinitialise le voyage. Le bouton ? affiche les commandes.
- Audio désactivé au départ ; le bouton sonore active une ambiance synthétisée localement.

Les quatre visuels fournis par l’utilisateur sont conservés dans public/planets/, avec celui de Hoth (`hoth.png`), généré dans le même style, et projetés sur des sphères 3D sans étirement de leurs globes déjà éclairés. Ils servent aussi à la carte et aux aperçus de destination. Le filtrage anisotrope, les mipmaps et une résolution de rendu adaptée aux écrans Retina préservent les détails. La géométrie et les textures procédurales précédentes servent de repli si un visuel ne se charge pas. Le préloader attend la fin du chargement des images. La géométrie du vaisseau et la lueur de sortie d’hyperespace (en CSS) sont générées localement. Les textures procédurales de repli ne sont calculées que si une image échoue, et les shaders sont compilés avant la fin du chargement, pour que l’écran de chargement reste fluide. Aucun asset distant requis. Le mode mouvement réduit est respecté. Une vue simplifiée permet de naviguer sans WebGL.

Les noms de planètes sont des références à Star Wars ; il s’agit d’un portfolio conceptuel indépendant.

Deux clins d’œil discrets : un astromécano miniature derrière le cockpit et deux soleils lointains près de Tatooine.

Le préloader simule une sortie d’hyperespace : traînées radiales qui décélèrent en étoiles fixes, puis révélation progressive de la scène. Il attend le chargement de la 3D et propose un fondu statique lorsque le mouvement réduit est activé.

Le modèle 3D du vaisseau suit la référence conservée dans references/x-wing.png : quatre ailes ouvertes, quatre moteurs à échappement rose, fuselage à sections octogonales, verrière encadrée, astromécano et panneaux patinés. Les détails statiques sont regroupés par matériau pour limiter les appels de rendu. Son envergure et son échelle dans la scène sont conservées.

## Exploration immersive

Le cockpit possède des armatures aux arêtes adoucies, des fixations, trappes, conduits et protections latérales usées. Deux consoles supplémentaires et un bandeau supérieur affichent radar, diagnostics et schéma de vol animés par shaders ; le radar réagit à la destination sélectionnée. Une verrière légèrement marquée, les reflets du métal et les éclairages pratiques donnent du relief à l'habitacle. Un léger mouvement de regard suit la souris sur les zones libres, sans déplacer le vaisseau ; les commandes gardent leur stabilité au survol. Ce mouvement et les animations des instruments sont désactivés avec le mouvement réduit. Les géométries statiques restent regroupées par matériau.

La carte stellaire s'ouvre à l'intérieur d'un cockpit 3D de X-wing, avec une courte avancée de caméra vers le siège. Cinq planètes holographiques (scanlines, reliefs, méridiens et faisceaux) survolent le projecteur. Sélectionner un globe change le véritable aperçu en couleur et les informations sur la console ; « Rejoindre l'orbite » confirme la destination. Les flèches parcourent les destinations au clavier, Tab parcourt les commandes et Échap revient à la vue précédente. Sur mobile, les cinq projections se disposent sur deux rangées (trois en haut, deux en bas). Le mouvement réduit, le son facultatif et la navigation sans WebGL sont conservés. Les scènes extérieures cessent de se dessiner pendant l'utilisation du cockpit. Les quatre références visuelles sont conservées dans `references/cockpit/`.

L'approche automatique suit une courbe avec accélération progressive puis freinage. Le X-wing s'incline selon le virage et la caméra le poursuit avec un léger retard ; la poussée visuelle et sonore suit sa vitesse. Le trajet contourne les autres planètes. L'arrivée est déclenchée par la fin réelle du vol, et non par un minuteur indépendant. Annuler une approche rend les commandes au pilote. Au repos, le vaisseau n'avance toujours pas. Le mode mouvement réduit conserve une arrivée directe sans inclinaison ni effet de vitesse.

- Le halo de ciblage, le nom et la distance apparaissent uniquement lorsque la planète est visée ou survolée. E rejoint la planète visée (ou la planète focalisée au clavier).
- L’approche garde la vue 3D visible et peut être annulée. L’arrivée affiche une petite transmission non modale ; le pilotage la referme naturellement. Les intérieurs des planètes restent à développer.
- Les références planétaires restent attachées aux sphères dans un repère fixe. Une lumière directionnelle, une atmosphère indépendante, les nuages d’Endor, une fine poussière de Tatooine, les tempêtes de Hoth et les éclairages nocturnes de Coruscant donnent du relief pendant les déplacements.
- L’audio est coupé par défaut. Le bouton sonore active un moteur synthétisé qui réagit à l’accélération, une décélération d’hyperespace et les bips de l’astromécano. Le son peut aussi être activé pendant le préloader ; l’aide permet de rejouer l’arrivée.
- La commande circulaire apparaît sous le doigt sur mobile (et dans les aperçus étroits), puis disparaît au relâchement. Aucun déplacement ni inertie n’est ajouté au repos.
- Cliquer sur le petit astromécano fait tourner sa tête et allume brièvement son œil. Les bips respectent le bouton de son et le mouvement réduit est pris en compte.
- Le ciel compte environ 5 600 étoiles de tailles, couleurs et éclats variés qui scintillent, une bande galactique et une nébuleuse discrète, calculée une seule fois au chargement. Des étoiles filantes traversent parfois le haut du ciel.
- Après 30 secondes de vol, puis toutes les 3 minutes, un vaisseau sort de l'hyperespace, traverse le champ de vision devant les planètes, puis repart en vitesse lumière. Les passages alternent : un destroyer en forme de dague (pont en gradins, tour de commandement à deux dômes, hublots allumés), un cargo en disque à mandibules et cockpit décalé, puis un chasseur argenté au nez en aiguille. Chaque vaisseau s'incline vers la caméra pour montrer son pont, comme dans une vue de trois quarts. Le passage se fige quand une interface est ouverte, et le son du saut suit le bouton sonore.
- Les astéroïdes autour de Tatooine dérivent et tournent sur eux-mêmes ; trois balises de patrouille orbitent autour de l'Étoile de la Mort.
- À l'arrivée, chaque planète est cadrée à une taille comparable, au-dessus du vaisseau et à l'écart de la transmission. Son étiquette passe au-dessus d'elle lorsqu'elle toucherait le vaisseau. Sur écran étroit, la caméra recule pour que toutes les planètes tiennent dans le cadre.
- En mouvement réduit, le scintillement, les étoiles filantes et le convoi sont désactivés, et les astéroïdes comme les balises restent immobiles.

## Entrée atmosphérique

- Chaque atterrissage commence par une traversée de l'atmosphère (`AtmosphereEntry.tsx`) : chaleur de rentrée incandescente et traînées, puis bancs de nuages aux couleurs de la planète (sable sur Tatooine, smog violet sur Coruscant, neige sur Hoth), jusqu'à la percée au-dessus de la zone d'atterrissage. L'approche du vaisseau attend la fin de la traversée. Avec le mouvement réduit, un simple fondu la remplace.

## Atterrissage sur Coruscant

La skyline s'inspire de la référence conservée dans `references/coruscant/skyline-reference.png` : tours aux épaules galbées, aiguilles, gradins, coupoles et passerelles suspendues, dans un crépuscule orange-violet. Les fenêtres blanc bleuté suivent les façades courbes et les tours de fond réservent les emprises des bâtiments repères. Le fret de la plateforme reprend les deux références de caisses : modèles gris et ocre ventilés, coffres de transport avec poignées et loquets, fûts ivoire, renforts et peinture usée. Les objets restent regroupés en deux amas hors des passages piétons. Les éléments statiques sont fusionnés par matériau.

- En orbite de Coruscant, le bouton « Atterrir » (ou E) fait descendre le vaisseau sur la plateforme 3-7 : un plan large suit le X-wing qui freine et se pose, puis la caméra passe à hauteur d'yeux. « Passer » saute la cinématique.
- La ville est générée sur place : des milliers de tours dont les fenêtres sont dessinées par le shader, une brume de crépuscule et des couloirs de trafic aérien. La scène spatiale cesse de se dessiner tant qu'on est au sol.
- Exploration libre : flèches, ZQSD ou WASD pour marcher (Maj pour courir). Glisser à la souris fait tourner le regard dans toutes les directions, pour lever les yeux vers les tours ou les baisser vers le pont. Au doigt, la moitié gauche de l'écran sert de joystick de marche et la moitié droite de regard, les deux en même temps si besoin. Le vaisseau, les caisses, les terminaux, l'équipe et les droids bloquent le passage.
- La plateforme vit. Un astromécano blanc à dôme rouge fait sa ronde autour du X-wing ; il s'arrête quand on lui barre la route, tourne son dôme vers le visiteur et bipe. Deux droids de piste réparent un moteur dans des gerbes d'étincelles pendant qu'un troisième trotte derrière le vaisseau, et un droid de combat monte la garde à l'avant de la plateforme, la tête tournée vers le visiteur quand il approche. L'équipe au sol porte la tenue des pilotes (combinaison orange, gilet blanc à boîtier de poitrine, casque blanc à visière orange) : l'un vérifie un moteur, l'autre fait l'aller-retour jusqu'aux caisses. Un chariot flottant transporte une caisse et un drone de surveillance tourne au-dessus. Les moteurs refroidissent en lâchant de la vapeur après l'atterrissage, des grilles du sol en crachent par bouffées, et un taxi volant vient se garer au bord de la plateforme avant de repartir dans le trafic.
- Avec le son activé, la ville prend le relais du moteur spatial : rumeur lointaine, rafales de vent sur la plateforme et passages de trafic d'une oreille à l'autre. On entend aussi ses pas sur le pont métallique, un carillon quand un hologramme s'allume, et le taxi qui arrive puis repart.
- Quatre terminaux holographiques (identité, transmission, réseaux, disponibilité) s'allument quand on s'en approche et ouvrent un panneau lisible avec de vrais liens. Cliquer un hologramme ou un bouton de la barre du bas y conduit automatiquement, en contournant le vaisseau.
- « Décoller » ramène en orbite. En mouvement réduit, les cinématiques sont coupées, les déplacements automatiques deviennent instantanés, la vapeur et les étincelles disparaissent, l'équipe et les droids restent immobiles et le taxi attend à quai.
- Les textes sont provisoires : ils se remplacent dans `landings` de `components/universe.ts`. L'Étoile de la Mort suivra le même modèle.

## Taxi aérien de Coruscant

- Sur la plateforme 3-7, une borne « TAXI » appelle un taxi aérien : bouton « Taxi aérien », ou clic sur la borne ou sur le taxi. Le taxi reprend la silhouette du taxi aérien de Coruscant : coque ambrée, habitacle ouvert à deux rangées de sièges sous un petit pare-brise bombé, ailes galbées le long des flancs, deux bosses ovales sur le pont arrière, ailerons sombres à pointe rouge, barre de feux rouges, turbines apparentes sous le nez, grilles chromées et bande en damier. Il quitte le trafic, se met à quai et lève sa verrière, puis la caméra monte à bord. L'expérience prend alors le relais en plein écran (`components/coruscantTaxi/`).
- À bord, un hologramme cliquable du tableau de bord propose les destinations : Temple Jedi, Sénat galactique ou retour à la plateforme. Un droïde pilote annonce le départ, les points de vue et l'arrivée en sous-titres, et avec la voix française du navigateur quand le son est activé (le bouton VOIX la coupe).
- Six trajets traversent la ville : canyons de tours, courants de trafic qui passent au-dessus ou en dessous, passerelles, enseignes holographiques, puis une approche propre à chaque monument.
  - Vue cabine : regard libre, et le regard se tourne vers ce que le droïde annonce.
  - Vue cinéma (V) : poursuite, travelling latéral, plans fixes au passage, plongée, contrechamp et révélation finale.
  - « Arriver maintenant » saute le trajet.
- La ville compte environ 15 000 tours instanciées, dont le shader dessine les fenêtres. Elle s'écarte autour de chaque trajet et de chaque voie de trafic, si bien que rien ne traverse un immeuble.
- Environ 1 300 véhicules circulent, répartis en trois modèles instanciés, avec des phares en points lumineux. Une vingtaine accompagnent le taxi : ils le doublent ou le croisent dans un souffle stéréo.
- Temple Jedi : un socle à colonnade éclairée porte un bloc massif aux façades inclinées et rainurées, entre des pylônes d'angle et une arête centrale sur chaque face. Le toit plat porte cinq flèches regroupées, la plus haute au milieu, face au soleil couchant. Le taxi se pose sur la plateforme du Conseil ; on descend, on traverse la passerelle et on entre dans la salle. Elle offre un sol en mosaïque, douze sièges et des baies sur la ville.
  - Le Conseil y apparaît en hologrammes.
  - Quatre holocrons présentent Vision, La quête, Orientation et Projets majeurs.
  - « Contempler » mène à la baie du couchant.
- Sénat galactique : une soucoupe très plate coiffe un large tambour, avec fenêtres éclairées, contreforts et une couronne de lumières sous le surplomb. L'ensemble repose sur une esplanade circulaire, avec ses anneaux de lumière et ses pavillons. La Grande Place passe sous la soucoupe jusqu'aux portes ; elle est bordée de statues élancées et encadrée par deux grands mâts. On entre dans la Rotonde : des centaines de nacelles et le podium sous un puits de lumière.
  - La nacelle ORBITAL se détache pour prendre la parole : Expériences, Compétences, Projets structurés.
  - « Soumettre la motion » fait voter l'hémicycle, dont les nacelles s'allument en vert, puis donne le CV et les contacts.
- Tous les contenus viennent de `components/deathStar/cvData.ts` ; rien n'est inventé.
- En mouvement réduit, il n'y a ni trajet ni travelling : un fondu mène directement à destination. Sans WebGL, une liste donne accès aux mêmes contenus. La qualité baisse d'elle-même si l'image ralentit.

## Atterrissage sur Tatooine

- En orbite de Tatooine, « Atterrir » (ou E) pose le X-wing dans la baie d'amarrage 94 de Mos Eisley : un cercle de sable tassé entouré d'un mur d'adobe, avec un grand portail par lequel on voit les deux soleils se coucher sur les dunes.
- Autour : village de dômes et de tours, évaporateurs d'humidité, dunes et mesas dans la brume. Le vent souffle des bouffées de sable sur le sol de la baie et l'ambiance sonore est celle du désert.
- Chaque terminal présente un projet (titre, ligne « rôle · technos · année », description, liens). Les quatre projets sont réels : ORBITAL, ses modules Galactic Arcade et Étoile de la Mort, et la présentation « Mes passions » (`landings.Tatooine` de `components/universe.ts`).
- « Mos Eisley » mène dans la rue du quartier. À la sortie de la baie, un plan holographique montre le quartier et la position du visiteur en direct (`tatooineMap.ts`).
- Scènes de rue (`tatooineStreetLife.ts`) : des Jawas marchandent un droïde avec un fermier, des sandtroopers contrôlent une voyageuse derrière une barrière et un scanner, un sandtrooper patrouille à dos de lézard au bout de la rue, et un troupeau traverse une dune au loin.
- Les soldats impériaux (`stormtrooperModel.ts`) reprennent le casque classique : deux oculaires noirs, joues évasées, grille et aérateurs. Plastron galbé, plaques articulées, ceinture à cartouches, blaster E-11 et sacs de terrain détaillés remplacent les volumes simples ; l'officier conserve son épaulette orange. La marche, le contrôle au scanner, la pose du cavalier et le mouvement réduit utilisent le même modèle.
- La population du marché (`tatooineResidentModels.ts`, `tatooineResidents.ts`) comprend un KX de manutention, deux anciens droïdes B1/B2 récupérés et sans armes, un Tusken, un marchand Toydarian et un voyageur Gungan. Leurs petits gestes s'arrêtent près du visiteur. Ces six silhouettes remplacent trois passants génériques pour diversifier la rue sans surcharger son axe central.
- Le mobilier (`tatooineMarket.ts`) ajoute trois étals de paniers et fruits suspendus, des caisses/fûts et petits générateurs patinés, ainsi qu'une terrasse de deux tables sous voile. Les obstacles restent sur les côtés et les accès à la cantina et à la baie sont conservés.
- Les speeders (`tatooineVehicleModels.ts`) partagent les mêmes emprises et règles de priorité : X-34 rouge et crème à trois moteurs, pare-brise courbé et grille périphérique, ou modèle jaune à nez fourchu. Le cavalier impérial (`dewbackPatrol.ts`) monte désormais un dewback massif à tête basse, peau écaillée, selle, sacoches, rênes et perche ; ses genoux sont pliés et ses tibias descendent le long des flancs. La boucle de patrouille au loin et le mouvement réduit restent inchangés.
- La cantina (`tatooineCantina.ts`, `cantinaCrowd.ts`) : un grand dôme avec porche et lanterne. À l'intérieur, une voûte nervurée, un puits de lumière, des appliques et une brume ambrée. Le barman sert, les clients boivent aux tables et un orchestre joue sur scène.
- Sur la banquette de la table nord près de la porte, face au client vert à la robe rouille, le Mandalorien et Grogu sont assis côte à côte (`mandalorianModel.ts`, `groguModel.ts`). Le beskar, la visière en T, la bandoulière et la petite cape répondent aux grandes oreilles, aux yeux noirs et au col épais de Grogu. Leurs mouvements de tête restent discrets et se figent en mouvement réduit. Le mobilier et les passages conservent leurs emprises.
- La musique de la cantina est une composition originale générée dans le navigateur. On l'entend étouffée depuis la rue, de plus en plus fort près du porche, puis pleinement à l'intérieur.
- Qualité automatique : sur mobile, la scène démarre avec une résolution et des ombres réduites. Si les images ralentissent, la résolution baisse d'abord, puis la qualité des ombres.
- Les deux planètes partagent la même disposition et le même fonctionnement (`components/landingKit.ts`) ; chaque décor a son fichier (`coruscantZone.ts`, `tatooineZone.ts`).

## Atterrissage sur Hoth

- Hoth présente les diplômes (rubrique 05). La base Écho est creusée au pied d'une muraille glaciaire d'environ 200 mètres de haut. Une arrivée large montre ses stries, sa crête enneigée et l'entrée voûtée, puis le X-wing entre par cette ouverture et se pose dans le hangar. La cavité conserve ses corniches, ses stalactites et ses lampes de travail latérales. Le décollage repasse par l'ouverture sur la plaine.
- Dans le hangar, on trouve des portes blindées, une galerie de commandement éclairée, un second X-wing en réparation, un snowspeeder, des caisses et l'équipe au sol.
- La table de briefing (`hothBriefing.ts`) projette, comme les plans d'attaque des rebelles, le schéma holographique d'une station de combat : parallèles, méridiens, tranchée, parabole et anneau de scan. Ses cibles sont les étapes de formation : chaque cible est reliée à une fiche « Objectif atteint » (ou « En cours »), un tracé lumineux passe de l'une à l'autre, la cible s'allume quand on s'approche de son terminal, et toucher une fiche y mène.
- Au loin (`hothBattle.ts`), trois marcheurs géants avancent dans la tempête et tirent sur la tranchée. Les canons rebelles et deux snowspeeders ripostent, les tirs soulèvent des gerbes de neige, et le générateur de bouclier brille derrière la tranchée. Les snowspeeders reprennent la silhouette des films : coque en coin effilée, cockpit à l'avant, deux grosses nacelles moteur, aérofreins fendus et canons de nez. Les tirs ont un cœur blanc et un halo de couleur : rouge orangé pour les marcheurs, rouge vif pour les rebelles.
- Une trentaine de secondes après l'arrivée, puis environ toutes les deux minutes et demie, un snowspeeder quitte sa ronde, fait trois boucles serrées autour des pattes d'un marcheur en déroulant son câble, puis le lâche. Le marcheur entravé vacille, bascule sur le côté et s'écrase dans une gerbe d'explosions, avant de disparaître dans la tempête et d'être remplacé au loin.
- Les AT-AT (`atatModel.ts`) ont une coque à panneaux patinés, un cou annelé, une tête à quatre canons, des articulations circulaires et des vérins. Leur démarche lève une patte à la fois ; une résolution géométrique des jambes maintient les pieds au sol pendant l'appui, même sur le relief. Les détails fixes sont regroupés par matériau (48 maillages par marcheur).
- La tempête : neige qui tombe (plus rare sous le toit), rafales de poudreuse devant l'ouverture et brouillard qui respire. L'ambiance sonore mêle le vent, le ronronnement de la base et des explosions lointaines.
- Les quatre étapes de formation viennent du CV (`components/deathStar/cvData.ts`) : Bac STMG, BTS MCO, formation PRISMA et Bachelor 3 INSEEC ; une étape en cours s’affiche « En cours » plutôt qu’« Objectif atteint ».

## Atterrissage sur Endor

- Endor représente les passions (rubrique 02). Le X-wing se pose dans une clairière de séquoias géants, sous un village ewok, d'après les images de référence (`endorForest.ts`, `endorVillage.ts`).
- La forêt : troncs à l'écorce profondément sillonnée, mousse épaisse au pied des troncs et en plaques plus haut, racines à contreforts, branches chargées d'aiguilles en couches qui se perdent dans la brume, et rayons de soleil dans la trouée.
- Le village : plateformes autour de quatre troncs, huttes de chaume, plateformes plus hautes avec des huttes en dôme accrochées aux troncs, échelles, et ponts de cordes à plusieurs hauteurs, dont un très haut au-dessus de la clairière.
- Les Ewoks : grosse tête au visage crème, grands yeux noirs brillants, capuche de cuir orangé couvrant le front avec une couture et tombant en bavoir, oreilles duveteuses, fourrure sombre au reflet velouté et ventre clair. Les sentinelles tiennent leur lance à deux mains.
- Autour du feu de camp, un ancien conte, deux Ewoks jouent du tambour et deux autres dansent. Des sentinelles patrouillent et des guetteurs veillent sur les plateformes.
- Au-delà du feu, les Ewoks ont décoré un holoprojecteur impérial récupéré, monté sur un trépied de branches. Il projette un hologramme par chapitre de la présentation « Mes passions » : une planète à anneaux, une montre, un tableau et un livre ouvert. Chaque hologramme ouvre son chapitre (« Écouter le récit »), et l'ancien ouvre la présentation entière depuis son intro (`PassionsViewer.tsx`). La présentation est copiée dans `public/passions/`, et les étapes visées se règlent avec `story` dans `landings.Endor` (`components/universe.ts`).
- Dans cette copie en ligne, les couvertures d'Incendies, du Trône de fer et du Petit Prince sont redessinées en SVG (originales). La présentation de classe d'origine, dans `présentation passions`, n'est pas modifiée.
- Autour de la clairière (`endorLandmarks.ts`) : l'Étoile de la Mort pâle dans le ciel, visible par une trouée dans la canopée au-dessus du feu ; au bout d'un sentier, le bunker impérial envahi de mousse ; et, sur le sentier, des speeder bikes écrasés et des casques de scouts.
- « Monter au village » fait gravir la rampe enroulée autour du premier tronc jusqu'à sa plateforme. On peut y marcher et traverser le pont jusqu'à la plateforme voisine, puis « Redescendre ».
- Des speeder bikes filent entre les troncs de temps en temps. Des oiseaux tournent sous la canopée, et du pollen et des papillons flottent dans la lumière (`endorLife.ts`). L'ambiance sonore mêle le vent dans les feuilles et des chants d'oiseaux.


## Defense of Hoth

Depuis la carte stellaire, le programme **DEFENSE OF HOTH** de Galactic Arcade ouvre un simulateur dans le cockpit existant. Le champ de bataille, les sondes, les véhicules et le boss AT-AT sont rendus dans la même scène Three.js, derrière la verrière. Trois vagues, des projectiles avec collisions, la chaleur des canons, les boucliers et la Base Echo déterminent la partie.

- Souris : viser ; clic gauche maintenu : tirer ; clic droit maintenu ou bouton Zoom : zoom tactique.
- Clavier : flèches pour viser, Entrée maintenue pour tirer, Espace pour l’impulsion ionique, R pour refroidir, Échap pour mettre en pause.
- Tactile : glisser pour viser et maintenir TIR avec un second doigt ; actions dédiées en bas.
- Le son et les messages vocaux sont synthétisés localement, activables depuis le bouton sonore. Le meilleur score et les badges restent dans le stockage local du navigateur.
- Quitter restitue la carte et la destination sélectionnée ; les ressources, écouteurs et sons du combat sont libérés. Le changement d’onglet suspend la bataille.
- Au lancement, l’éclairage du cockpit vire au rouge, une alarme retentit et les systèmes de ciblage s’allument. La Base Echo (générateur de bouclier, canon à ions, tranchées) est visible par la verrière gauche, et des AT-AT avancent à l’horizon dans le blizzard.
- Le boss AT-AT, plus grand, émerge d’un blizzard qui s’épaissit puis se dissipe. Les explosions se reflètent sur la verrière ; les tirs reçus font jaillir des étincelles du tableau de bord, et des fissures apparaissent quand les boucliers faiblissent.

`npm run test:hoth` vérifie les trois vagues avec de vrais tirs simulés, les points faibles protégés du boss, sa chute, la victoire parfaite, la défaite, les délais de recharge, la surchauffe, la pause, le redémarrage et le nettoyage des ressources 3D. `npm run build` produit l’export statique.

## Carnet de vol

Au centre du tableau de bord, l’écran vert **CARNET DE VOL** résume la visite : planètes atteintes en orbite, atterrissages, accostage de l’Étoile de la Mort, temps de vol, missions Jedi, crédits et records de Galactic Arcade, sections du dossier CV consultées. Il propose le prochain cap et permet de s’y rendre d’un clic. Tout reste dans le stockage local (`orbital-flight-log-v1`).

## Galactic Arcade

Sur le tableau de bord, à droite du journal de missions, la console **GALACTIC ARCADE** (écran, LED, boutons) projette au clic un hologramme : catalogue de simulations, profil de pilote, succès, récompenses et terminal de codes. Sur téléphone, elle s’ouvre en panneau depuis l’icône manette de l’en-tête. Le catalogue est piloté par les données (`components/arcade/catalog.ts`).

- **Space Battle** : trois vagues de chasseurs TIE dans le cockpit ; boucliers puis coque, trois torpilles à protons sur la cible verrouillée.
- **Asteroid Survival** : champ d’astéroïdes de plus en plus dense ; 90 s valident la mission, 180 s débloquent Asteroid Master, les passages au ras rapportent des combos.
- **Imperial Hacking** : circuit à reconnecter, code chiffré à traduire, séquence du pare-feu à reproduire avant l’alerte ; chaque erreur coûte du temps.
- **Speeder Bike Racing** : course en caméra poursuite dans la forêt d’Endor, avec boost, points de passage et arrivée au village ewok ; trois collisions avec un tronc détruisent le speeder.
- **Defense of Hoth** : le simulateur existant, lancé depuis le catalogue ; ses parties comptent aussi dans l’arcade.

Chaque partie terminée met à jour les statistiques (dernier score, record, parties, victoires, meilleur temps, date du record), verse des crédits galactiques (victoire, record, performance parfaite, première victoire, sans double paiement) et débloque les succès et les grades, de Cadet à Légende galactique. Les crédits achètent des couleurs d’hologramme, des thèmes de console, des titres, l’éclairage du cockpit et la couleur des réacteurs du X-wing. Tout reste dans le stockage local versionné `orbital-galactic-arcade`, sans achat réel. Codes du terminal : 1977 et 1138 ; une combinaison de flèches cache autre chose.

## L’Étoile de la Mort · dossier professionnel

En orbite de l’Étoile de la Mort, la transmission propose **Accoster la station** (ou E) et **Mode Recruteur**. L’approche est une courte séquence : le X-wing entre dans la baie du hangar, la transmission « IMPERIAL ARCHIVES — Personnel File Access Granted » s’affiche, puis la vue passe à la première personne. L’introduction peut être passée.

- **Hangar** : console d’accueil holographique (identité, profil, trois choix : explorer, consulter rapidement, télécharger le CV PDF).
- **Archives** : un terminal par expérience (Bricoman/Tecnomat, Aldi) et une synthèse du parcours.
- **Centre de formation** : table holographique et frise des diplômes, du Bac STMG au Bachelor 3 INSEEC.
- **Salle des compétences** : arbre holographique en six branches ; chaque nœud distingue compétence confirmée, en développement et domaine d’intérêt, avec son contexte et ses preuves.
- **Salle de commandement** (par ascenseur) : grand écran, consoles par projet (ORBITAL, « Mes passions »).
- **Archives confidentielles** (depuis le hangar) : le CV complet, téléchargement, LinkedIn, e-mail, retour à la galaxie.

Quatre présences impériales se rencontrent dans la station (`imperialRoster.ts`) : le général Grievous au hangar, le comte Dooku aux archives, Dark Maul au centre de formation et Palpatine, entre deux gardes royaux, en salle de commandement. Le plan les liste sous « Présences impériales ». Chacun a son easter egg à l’interaction, avant sa fiche : Palpatine lance des éclairs de Force sur le visiteur, Grievous fait tournoyer ses quatre sabres puis tousse, Maul fait tourner son sabre double, Dooku adresse le salut des duellistes, et Dark Vador, devant la baie, se retourne et étrangle le visiteur par la Force (vue soulevée, vignette rouge, respiration). Les effets restent sobres avec le mouvement réduit.

Déplacements : ZQSD/WASD et flèches, souris glissée pour regarder, clic pour aller vers un point ou une console, E pour interagir, M pour le plan ; sur téléphone, pouce gauche pour avancer, glisser à droite pour regarder. Le **Mode Recruteur** reste accessible partout et remplace la station sans WebGL. Qualité graphique réglable ; mouvements réduits respectés.

Toutes les données viennent de `components/deathStar/cvData.ts`, tirées du CV `public/cv/CV_Sidi_Mohamed_Selhami_Alternance_2026.pdf`. Les certifications restent masquées tant que leurs intitulés réels n’y sont pas ajoutés.

## Page 404 · secteur non cartographié

- Une adresse inconnue lance un saut en hyperespace qui tourne court : traînées d'étoiles qui freinent, alerte « Saut interrompu · Erreur 404 ». Le bouton « Passer » abrège l'animation, réduite à un fondu en mouvement réduit (`components/notFound/LostSector.tsx`, exporté en `404.html`).
- Le visiteur se retrouve dans le cockpit du X-wing, lumières d'alerte allumées. Le briefing rappelle l'adresse introuvable et propose de traverser le champ d'astéroïdes ou de rentrer sur ORBITAL. Le CV et le contact restent à un clic.
- Le jeu est l'Asteroid Survival de la Galactic Arcade, avec son HUD, sa pause et ses règles. Chaque vol compte dans l'arcade (score, record, crédits). À la fin, on peut rejouer ou rentrer.
- Sans WebGL, la page garde le briefing et les liens, sans le jeu.
