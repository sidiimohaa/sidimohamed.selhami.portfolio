import type { MissionId } from "../jediProgression";

// Every event the universe can produce. Adding one is adding an entry here: the director reads
// nothing else. `place` is where it happens; visuals, if any, are drawn by that place's scene.

export type EventPlace = "coruscant" | "space" | "tatooine" | "hoth" | "endor" | "station";
export const placeNames: Record<EventPlace, string> = {
  coruscant: "Coruscant", space: "Espace profond", tatooine: "Tatooine", hoth: "Hoth", endor: "Endor", station: "Étoile de la Mort",
};

export type EventChoice = { id: string; label: string; line: string; ends?: boolean };
export type GalacticEvent = {
  id: string;
  place: EventPlace;
  title: string;
  // What the monitor says about it.
  summary: string;
  // The astromech's line when it is detected, and when it is over.
  line: string;
  endLine?: string;
  // 1 routine, 2 notable, 3 major. Major events are rare and never overlap another major one.
  priority: 1 | 2 | 3;
  weight: number;
  duration: [number, number];
  // Seconds before this event can come back.
  cooldown: number;
  // Choices offered in the notification and the monitor.
  choices?: EventChoice[];
  // What witnessing it through to the end reveals in the log.
  discovery?: { title: string; body: string; project?: boolean; mission?: MissionId };
  // Needs the visitor to reach something: the event is only "found" when the scene reports it.
  seek?: boolean;
  // Started only by the visitor's own action, never drawn by the director.
  manual?: boolean;
};

export const galacticEvents: GalacticEvent[] = [
  // Coruscant.
  {
    id: "city-chase", place: "coruscant", title: "Poursuite aérienne", priority: 2, weight: 3, duration: [38, 50], cooldown: 240,
    summary: "Un speeder suspect a forcé un barrage de la Sécurité et fuit à travers les couloirs de circulation.",
    line: "Commandant, la Sécurité poursuit un speeder dans le trafic. Regardez vers les couloirs supérieurs.",
    endLine: "Le suspect a quitté le secteur, les patrouilles reprennent leur ronde.",
    discovery: { title: "Fréquence de la Sécurité", body: "Le speeder transportait des données volées. Sur cette fréquence, un même nom revient : une console oubliée, quelque part sur une plateforme.", mission: "forgotten-archives" },
  },
  {
    id: "city-alert", place: "coruscant", title: "Alerte de sécurité", priority: 2, weight: 2, duration: [34, 46], cooldown: 300,
    summary: "Alerte déclarée dans le quartier : sirènes, hologrammes d’alerte et circulation réduite.",
    line: "Activité inhabituelle détectée dans ce secteur. La circulation est détournée, restez à proximité de la plateforme.",
    endLine: "Fin de l’alerte. La circulation reprend.",
  },
  {
    id: "city-envoy", place: "coruscant", title: "Arrivée diplomatique", priority: 2, weight: 2, duration: [52, 64], cooldown: 360,
    summary: "Une navette officielle se pose sur la plateforme voisine. Une garde d’honneur prend position.",
    line: "Une navette diplomatique approche de la plateforme voisine.",
    endLine: "La délégation a rejoint le Sénat.",
    discovery: { title: "Note de la délégation", body: "Le protocole mentionne un profil à recruter : « Son dossier est aux archives de la station impériale, en mode recruteur. »", project: true },
  },
  {
    id: "city-outage", place: "coruscant", title: "Panne énergétique", priority: 2, weight: 2, duration: [30, 42], cooldown: 300,
    summary: "Un secteur de la ville s’éteint tour par tour. Les hologrammes vacillent, le trafic s’écarte.",
    line: "Chute de tension sur le réseau du secteur. Les tours s’éteignent une à une.",
    endLine: "Le réseau est rétabli.",
  },
  {
    id: "city-storm", place: "coruscant", title: "Tempête sur Coruscant", priority: 3, weight: 2, duration: [60, 80], cooldown: 480,
    summary: "Le ciel s’assombrit, le vent forcit et les éclairs frappent les antennes. Le trafic se raréfie.",
    line: "Une tempête approche. Je recommande de rester à l’abri des plateformes hautes.",
    endLine: "La tempête s’éloigne vers le quartier industriel.",
  },
  // Open space.
  {
    id: "space-distress", place: "space", title: "Signal de détresse", priority: 2, weight: 3, duration: [90, 120], cooldown: 300, seek: true,
    summary: "Une balise automatique émet depuis un vaisseau endommagé, à portée de capteurs.",
    line: "Un signal de détresse provient d’un vaisseau inconnu. Sa balise clignote devant nous : souhaitez-vous l’examiner ?",
    endLine: "Le signal s’est éteint.",
    choices: [{ id: "ignore", label: "Ignorer", line: "Bien reçu, je retire la balise de nos instruments.", ends: true }],
    discovery: { title: "Journal de bord récupéré", body: "L’équipage a quitté le navire à temps. Dernière entrée : un projet transmis aux archives, encore lisible.", project: true },
  },
  {
    id: "space-patrol", place: "space", title: "Patrouille impériale", priority: 2, weight: 2, duration: [34, 46], cooldown: 300,
    summary: "Une escadrille de chasseurs TIE croise notre trajectoire et demande une identification.",
    line: "Patrouille impériale à proximité. Ils demandent notre code d’identification.",
    endLine: "La patrouille poursuit sa ronde.",
    choices: [
      { id: "code", label: "Transmettre le code", line: "Code transmis : « navette de ravitaillement ». Ils n’y ont vu que du feu." },
      { id: "silence", label: "Garder le silence", line: "Silence radio. Espérons qu’ils aient mieux à faire." },
    ],
  },
  {
    id: "space-asteroids", place: "space", title: "Champ d’astéroïdes", priority: 2, weight: 2, duration: [50, 64], cooldown: 360,
    summary: "Un amas d’astéroïdes dérive sur notre trajectoire. Passage possible en pilotage manuel.",
    line: "Champ d’astéroïdes droit devant. Les chances de le traverser… je préfère ne pas vous les donner.",
    endLine: "L’amas s’éloigne de notre trajectoire.",
  },
  {
    id: "space-wreck", place: "space", title: "Épave mystérieuse", priority: 2, weight: 2, duration: [90, 120], cooldown: 420, seek: true,
    summary: "Une épave dérive sans signature. Une inspection de près révélera peut-être son contenu.",
    line: "Une épave dérive à portée, sans signature connue. Approchez-vous pour que je l’analyse.",
    endLine: "L’épave a quitté la portée de nos capteurs.",
    discovery: { title: "Archive de l’épave", body: "Un holocron de données endommagé : il renferme une fiche de projet et un indice sur une carte mal rangée.", project: true, mission: "star-map" },
  },
  {
    id: "space-fleet", place: "space", title: "Passage d’une flotte", priority: 3, weight: 1, duration: [46, 58], cooldown: 900,
    summary: "Une flotte sort d’hyperespace et traverse le secteur en formation.",
    line: "Sorties d’hyperespace multiples ! Une flotte complète traverse le secteur, gardons nos distances.",
    endLine: "La flotte a sauté. Le secteur est de nouveau calme.",
  },
  // Tatooine, Hoth, Endor: the weather and passers-by of each landing zone.
  {
    id: "tatooine-storm", place: "tatooine", title: "Tempête de sable", priority: 2, weight: 3, duration: [34, 46], cooldown: 240,
    summary: "Un front de sable balaie Mos Eisley. La visibilité chute.",
    line: "Front de sable en approche sur Mos Eisley. Mes capteurs n’aiment pas ça du tout.",
    endLine: "Le front de sable est passé.",
  },
  {
    id: "tatooine-pods", place: "tatooine", title: "Podracers au large", priority: 1, weight: 3, duration: [16, 22], cooldown: 200,
    summary: "Des pilotes s’entraînent pour le prochain Boonta et passent à pleine vitesse au-dessus de la baie.",
    line: "Podracers en approche, regardez vers le désert ! Le simulateur de l’arcade reproduit ce circuit.",
  },
  {
    id: "hoth-blizzard", place: "hoth", title: "Blizzard", priority: 2, weight: 3, duration: [34, 46], cooldown: 240,
    summary: "Le blizzard s’engouffre dans le hangar. Rester près des installations est conseillé.",
    line: "Le blizzard se lève sur la base Écho. La température chute de vingt degrés.",
    endLine: "Le vent retombe.",
  },
  {
    id: "hoth-probe", place: "hoth", title: "Sonde de reconnaissance", priority: 2, weight: 2, duration: [110, 140], cooldown: 300, seek: true,
    summary: "Un écho sur le radar : une sonde impériale descend vers la base et tourne devant l’entrée du hangar.",
    line: "Écho radar au-dessus de la crête : une sonde impériale descend vers la base. Suivez le repère, sortez du hangar.",
    endLine: "L’écho a disparu. La sonde a repris de l’altitude.",
    discovery: { title: "Sonde neutralisée", body: "Un tir depuis la tranchée, et la sonde s’est autodétruite. Selon Han Solo, il l’a à peine touchée. Elle transmettait ce dossier à l’Empire.", project: true },
  },
  {
    id: "hoth-distress", place: "hoth", title: "Signal de détresse", priority: 2, weight: 1, duration: [600, 600], cooldown: 900, seek: true,
    summary: "Un poste relais abandonné émet encore un signal automatique, à l’est de l’entrée de la base.",
    line: "Signal de détresse très faible, à l’est de l’entrée. La balise rouge d’un ancien poste relais vient de s’allumer.",
    discovery: { title: "Journal du poste relais 7", body: "L’équipe a évacué avant les blizzards. Le dernier opérateur a laissé un dossier à transmettre au commandement.", project: true },
  },
  {
    id: "endor-mist", place: "endor", title: "Brouillard forestier", priority: 1, weight: 3, duration: [34, 46], cooldown: 240,
    summary: "Une nappe de brouillard monte entre les troncs géants.",
    line: "Le brouillard monte entre les arbres. Bonne visibilité pour personne, sauf les Ewoks.",
    endLine: "Le brouillard se dissipe.",
  },
  {
    id: "endor-patrol", place: "endor", title: "Patrouille dans les bois", priority: 1, weight: 2, duration: [18, 26], cooldown: 240,
    summary: "Le bruit de speeders résonne au loin : une patrouille longe la clairière.",
    line: "Moteurs de speeders au loin. Les Ewoks l’ont entendu avant moi.",
    endLine: "La patrouille s’éloigne.",
  },
  {
    id: "endor-atst", place: "endor", title: "TS-TT en patrouille", priority: 2, weight: 2, duration: [52, 66], cooldown: 300,
    summary: "Un marcheur TS-TT et deux éclaireurs contournent la clairière entre les arbres.",
    line: "Pas lourds dans la forêt : un TS-TT contourne la clairière. Les Ewoks s’agitent dans les arbres.",
    endLine: "Deux troncs ont écrasé la tête du marcheur. Les Ewoks poussent des cris de joie.",
  },
  {
    id: "endor-shield", place: "endor", title: "Bunker du bouclier", priority: 3, weight: 1, duration: [40, 40], cooldown: 60, seek: true, manual: true,
    summary: "Les charges sont posées sur le générateur du bouclier. Quittez le bunker.",
    line: "Charges armées ! Sortez du bunker : le bouclier de la station va tomber.",
    discovery: { title: "Bouclier détruit", body: "Le générateur a sauté, le bouclier est tombé, et la station de combat a explosé au-dessus d’Endor. Une archive a survécu dans le réseau du bunker.", project: true },
  },
  // The station: atmosphere only, and never in Recruiter mode.
  {
    id: "station-drill", place: "station", title: "Exercice d’alerte", priority: 1, weight: 3, duration: [24, 34], cooldown: 300,
    summary: "Exercice de routine : l’éclairage de la station passe au rouge.",
    line: "Exercice d’alerte à bord. Rien à craindre : vos archives restent accessibles.",
    endLine: "Fin de l’exercice.",
  },
];

export const eventById = (id: string) => galacticEvents.find((event) => event.id === id);
