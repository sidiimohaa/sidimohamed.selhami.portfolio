// Galactic Arcade's catalogue: one entry per simulation. Adding a game means adding an entry here
// and a player for its `mode`; the console, scores, credits and achievements read from this list.

export type ArcadeGameId = "space-battle" | "asteroid-survival" | "imperial-hacking" | "speeder-racing" | "defense-of-hoth" | "podracing";
export type ArcadeStatus = "available" | "locked" | "soon";
// How a simulation runs: inside the cockpit scene, as a hologram puzzle, in its own environment,
// or through the Defense of Hoth simulator that already lives in the cockpit.
export type ArcadeMode = "cockpit" | "hologram" | "environment" | "defense";

export type ArcadeGame = {
  id: ArcadeGameId;
  number: string;
  name: string;
  planet: string;
  location: string;
  description: string;
  rules: string[];
  controls: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  duration: string;
  status: ArcadeStatus;
  mode: ArcadeMode;
  // Lower is better for races; higher for everything else.
  scoring: "score" | "time";
  // The cinematic line shown and spoken while the simulation loads.
  transition: { title: string; lines: string[] };
  announce: string;
};

export const arcadeGames: ArcadeGame[] = [
  {
    id: "space-battle",
    number: "01",
    name: "Space Battle",
    planet: "Espace galactique",
    location: "Secteur d’interception",
    description: "Des escadrilles de chasseurs impériaux fondent sur votre vaisseau. Abattez-les avant qu’ils ne percent vos boucliers.",
    rules: ["Trois vagues de chasseurs impériaux attaquent votre vaisseau.", "Les boucliers absorbent les tirs ; quand ils tombent, la coque encaisse.", "Les torpilles à protons détruisent la cible verrouillée, mais il n’y en a que trois.", "Victoire si les trois vagues sont détruites, défaite si la coque cède."],
    controls: ["Souris ou doigt : viser (flèches au clavier)", "Clic maintenu, FEU ou Entrée : canons laser", "Espace : torpille à protons sur la cible verrouillée", "Échap : pause"],
    difficulty: 3,
    duration: "3 min",
    status: "available",
    mode: "cockpit",
    scoring: "score",
    transition: { title: "Activation des systèmes de combat", lines: ["Déflecteurs à pleine puissance", "Canons laser armés", "Contacts impériaux en approche"] },
    announce: "Programme Space Battle chargé. Chasseurs ennemis en approche, Commandant.",
  },
  {
    id: "asteroid-survival",
    number: "02",
    name: "Asteroid Survival",
    planet: "Champ d’astéroïdes",
    location: "Ceinture de Hoth",
    description: "Traversez un champ d’astéroïdes de plus en plus dense. Chaque seconde de survie compte.",
    rules: ["Esquivez les astéroïdes qui foncent vers le cockpit.", "Le champ se densifie et accélère avec le temps.", "Frôler un astéroïde sans le toucher rapporte un bonus.", "Survivre 90 secondes valide la mission ; la partie continue jusqu’à la destruction de la coque."],
    controls: ["Souris, doigt ou ZQSD / WASD / flèches : manœuvrer", "Espace : poussée latérale d’urgence", "Échap : pause"],
    difficulty: 2,
    duration: "2 à 4 min",
    status: "available",
    mode: "cockpit",
    scoring: "score",
    transition: { title: "Détection d’un champ d’astéroïdes", lines: ["Densité de débris : critique", "Navigation manuelle requise", "Bonne chance, pilote"] },
    announce: "Champ d’astéroïdes détecté. Les probabilités de survie ne sont pas en votre faveur, Commandant.",
  },
  {
    id: "imperial-hacking",
    number: "03",
    name: "Imperial Hacking",
    planet: "Étoile noire",
    location: "Terminal de maintenance impérial",
    description: "Infiltrez un terminal impérial : reconnectez les circuits, décryptez les codes et contournez le pare-feu avant l’alerte.",
    rules: ["Trois couches de sécurité à franchir avant la fin du compte à rebours.", "Circuit : faites pivoter les modules pour relier la source au terminal.", "Décryptage : traduisez le code chiffré grâce à la table de correspondance.", "Pare-feu : reproduisez la séquence de nœuds affichée.", "Chaque erreur coûte des points et du temps."],
    controls: ["Clic ou toucher : faire pivoter, choisir", "Clavier : Tab et Entrée", "Échap : pause"],
    difficulty: 3,
    duration: "2 à 3 min",
    status: "available",
    mode: "hologram",
    scoring: "score",
    transition: { title: "Connexion à un terminal sécurisé", lines: ["Brouillage de la signature", "Accès à la grille de maintenance", "Liaison établie"] },
    announce: "Connexion au terminal impérial établie. Soyez discret, Commandant : ils surveillent ce réseau.",
  },
  {
    id: "speeder-racing",
    number: "04",
    name: "Speeder Bike Racing",
    planet: "Endor",
    location: "Forêt de la lune forestière",
    description: "Filez entre les troncs géants d’Endor à pleine vitesse, du départ au village ewok.",
    rules: ["Rejoignez la ligne d’arrivée le plus vite possible.", "Les troncs et les racines vous ralentissent ; trois chocs violents et la course est perdue.", "Le boost se recharge avec le temps.", "Les points de passage valident votre trajectoire."],
    controls: ["Q/D, A/D ou flèches : diriger (ou glisser le doigt)", "Maj, Espace ou BOOST : accélérer", "Échap : pause"],
    difficulty: 4,
    duration: "1 à 2 min",
    status: "available",
    mode: "environment",
    scoring: "time",
    transition: { title: "Transfert vers le speeder sur Endor", lines: ["Moteurs répulseurs en chauffe", "Visière tactique abaissée", "Départ imminent"] },
    announce: "Speeder prêt sur Endor. Attention aux arbres, Commandant : ils ne s’écartent pas.",
  },
  {
    id: "defense-of-hoth",
    number: "05",
    name: "Defense of Hoth",
    planet: "Hoth",
    location: "Base Echo",
    description: "Défendez la Base Echo depuis le cockpit contre les sondes, les blindés et un AT-AT.",
    rules: ["Trois vagues : sondes, véhicules au sol, puis l’AT-AT.", "Neutralisez les articulations et les canons de l’AT-AT, puis sa commande.", "Surveillez la chaleur des canons.", "La mission échoue si la Base Echo ou vos boucliers tombent."],
    controls: ["Souris : viser, clic gauche : tirer, clic droit : zoom", "Espace : impulsion, R : refroidir", "Échap : pause"],
    difficulty: 4,
    duration: "3 à 4 min",
    status: "available",
    mode: "defense",
    scoring: "score",
    transition: { title: "Activation de la simulation de défense", lines: ["Liaison avec la Base Echo", "Tourelles de défense synchronisées", "Offensive impériale détectée"] },
    announce: "Simulation de défense de Hoth activée. La Base Echo compte sur vous.",
  },
  {
    id: "podracing",
    number: "06",
    name: "Podracing",
    planet: "Tatooine",
    location: "Arène de Mos Espa",
    description: "Deux moteurs et un pod lancé entre les falaises. Affrontez Sebulba ou chassez votre meilleur temps dans les canyons de Tatooine.",
    rules: ["Choisissez un circuit, une difficulté et l’un des cinq modes au hangar.", "Dérapez puis relâchez pour déclencher un mini-turbo.", "Surveillez la température des deux moteurs et réparez en roulant.", "Gagnez des crédits pour améliorer votre pod."],
    controls: ["ZQSD, WASD ou flèches pour conduire", "Espace pour le boost · Maj pour déraper", "R pour réparer · C pour la caméra · Échap pour la pause", "Commandes tactiles disponibles"],
    difficulty: 3,
    duration: "Environ 1 min par course",
    status: "available",
    mode: "environment",
    scoring: "score",
    transition: { title: "Liaison avec Mos Espa", lines: ["Turbines synchronisées", "Pod en position", "Accès au hangar de course"] },
    announce: "Les deux moteurs sont prêts. Bienvenue à Mos Espa, Commandant.",
  },
];

export const gameById = (id: ArcadeGameId) => arcadeGames.find((game) => game.id === id)!;
