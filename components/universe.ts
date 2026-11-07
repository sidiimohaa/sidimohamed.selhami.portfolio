import { education, identity, projects } from "./deathStar/cvData";

export type PlanetReference = {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  radius: number;
};

export const destinations = [
  {
    name: "Tatooine",
    category: "Les projets",
    tag: "CRÉATION & EXPLORATION",
    number: "01",
    className: "sand",
    image: "/planets/tatooine.jpg",
    reference: {
      width: 894,
      height: 879,
      centerX: 447,
      centerY: 433,
      radius: 399,
    },
    summary: "Dunes, reliefs ocre et deux soleils : le terrain de mes projets.",
    description:
      "Sous deux soleils, les dunes et les reliefs ocre dessinent un terrain d’expérimentation. Ici prennent forme mes projets, du premier croquis à l’expérience aboutie.",
  },
  {
    name: "Endor",
    category: "Les passions",
    tag: "CURIOSITÉ & INSPIRATION",
    number: "02",
    className: "forest",
    image: "/planets/endor.jpg",
    reference: {
      width: 736,
      height: 736,
      centerX: 368,
      centerY: 368,
      radius: 341,
    },
    summary:
      "Un monde vivant où mes passions et mes inspirations prennent racine.",
    description:
      "Des forêts émeraude, des océans et des voiles de nuages : un monde vivant pour ce qui me passionne. Au coin du feu, un ancien y raconte l’espace, l’horlogerie, l’art et les livres.",
  },
  {
    name: "Coruscant",
    category: "Le contact",
    tag: "RENCONTRES & CONNEXIONS",
    number: "03",
    className: "city",
    image: "/planets/coruscant.jpg",
    reference: {
      width: 1000,
      height: 1000,
      centerX: 500,
      centerY: 482,
      radius: 422,
    },
    summary: "Des réseaux de lumière pour imaginer de nouvelles connexions.",
    description:
      "Sous la brume, des anneaux de lumière relient une planète entière. C’est notre point de rencontre pour échanger, imaginer et faire naître la prochaine collaboration.",
  },
  {
    name: "L’Étoile de la Mort",
    category: "Le dossier CV",
    tag: "ARCHIVES IMPÉRIALES",
    number: "04",
    className: "death-star",
    image: "/planets/death-star.jpg",
    reference: {
      width: 720,
      height: 700,
      centerX: 355,
      centerY: 341,
      radius: 330,
    },
    summary: "Une station impériale qui archive mon parcours professionnel.",
    description:
      "Derrière l’acier strié de lumière, la station archive mon dossier professionnel : expériences, formations, compétences et projets. Accostez pour l’explorer, ou passez en mode recruteur pour l’essentiel en quelques clics.",
  },
  {
    name: "Hoth",
    category: "La formation",
    tag: "FORMATIONS & DIPLÔMES",
    number: "05",
    className: "ice",
    image: "/planets/hoth.jpg",
    reference: {
      width: 900,
      height: 900,
      centerX: 450,
      centerY: 450,
      radius: 405,
    },
    summary: "Un monde de glace où des plans holographiques retracent ma formation.",
    description:
      "Des plaines gelées, des tempêtes et une base taillée dans la glace. Sur la table de briefing, des plans holographiques retracent ma formation, du baccalauréat au Bachelor en cours.",
  },
];

// A destination's name in an address (?cap=etoile-de-la-mort sets course for it on arrival).
export const destinationSlug = (destination: (typeof destinations)[number]) =>
  destination.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^l’|^l'/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// The supplied references are already rendered globes, not flat world maps.
// Use the same framing for the 3D projection and the circular navigation previews.
export function planetReferenceStyle(
  destination: (typeof destinations)[number],
) {
  const { width, height, centerX, centerY, radius } = destination.reference;
  const diameter = radius * 2;
  return {
    backgroundImage: `url("${destination.image}")`,
    backgroundSize: `${(width / diameter) * 100}% ${(height / diameter) * 100}%`,
    backgroundPosition: `${((centerX - radius) / (width - diameter)) * 100}% ${((centerY - radius) / (height - diameter)) * 100}%`,
  };
}

export type LandingTerminal = {
  id: string;
  label: string;
  heading: string;
  body: string;
  meta?: string;
  links?: { label: string; href: string }[];
  // A step of the "Mes passions" presentation this terminal can open (Endor).
  story?: number;
  // On Hoth: a qualification obtained, or one still under way.
  status?: "done" | "progress";
};
export type Landing = {
  pad: string;
  welcome: string;
  soundscape: "city" | "desert" | "ice" | "forest";
  terminals: LandingTerminal[];
};

// Présentations des zones : contact et formation à Coruscant, projets à Tatooine, formation à Hoth.
// Hoth et Tatooine reprennent les données réelles du CV (components/deathStar/cvData.ts).
export const landings: Partial<Record<string, Landing>> = {
  // The hidden world: not a destination of the flight, reached only from the completed map.
  Mustafar: {
    pad: "PLATEFORME DE LA RAFFINERIE · SYSTÈME MUSTAFAR",
    soundscape: "desert",
    welcome:
      "Vous êtes l’un des rares à savoir que ce monde existe. Au bout du bras collecteur, le Temple aurait voulu oublier ce qui s’est passé.",
    terminals: [
      {
        id: "cap",
        label: "Prochain cap",
        heading: "Au bout de la prophétie",
        body: "Vous avez trouvé tous les secrets de ce portfolio. Il ne reste qu’une chose à découvrir : je recherche une alternance d’assistant marketing digital pour l’année 2026-2027.",
        links: [{ label: "M’écrire", href: "mailto:sidimohamed.selhami1@gmail.com" }],
      },
    ],
  },
  Coruscant: {
    pad: "PLATEFORME 3-7 · NIVEAU 5127",
    soundscape: "city",
    welcome:
      "Bienvenue sur Coruscant. Identité, formation et contact : retrouvez mes transmissions sur les terminaux.",
    terminals: [
      {
        id: "identite",
        label: "Identité",
        heading: "Sidi-Mohamed Selhami",
        body: "Étudiant en Bachelor 3 Marketing IA & Data.",
        links: [{ label: "Voir mon LinkedIn", href: "https://www.linkedin.com/in/sidi-mohamed-selhami-919848242/" }],
      },
      {
        id: "transmission",
        label: "Transmission",
        heading: "Entrons en contact",
        body: "sidimohamed.selhami1@gmail.com",
        links: [{ label: "M’écrire", href: "mailto:sidimohamed.selhami1@gmail.com" }],
      },
      {
        id: "formation",
        label: "Formation",
        heading: "Marketing IA & Data",
        meta: "Bachelor · 3e année",
        body: "Actuellement en troisième année de bachelor Marketing IA & Data.",
      },
      {
        id: "disponibilite",
        label: "Alternance",
        heading: "À la recherche d’une alternance",
        meta: "Année 2026-2027",
        body: `${identity.search} Contactez-moi pour échanger sur votre opportunité.`,
        links: [{ label: "Proposer une alternance", href: "mailto:sidimohamed.selhami1@gmail.com?subject=Opportunit%C3%A9%20d%27alternance" }],
      },
    ],
  },
  // Endor raconte les passions : chaque hologramme ouvre un chapitre de la présentation « Mes passions »
  // (public/passions), à l'étape indiquée par story.
  Endor: {
    pad: "CLAIRIÈRE DU VILLAGE · LUNE FORESTIÈRE",
    welcome:
      "Bienvenue sur Endor. Autour du feu, l’ancien raconte mes passions : chaque hologramme du projecteur ouvre un chapitre.",
    soundscape: "forest",
    terminals: [
      {
        id: "espace",
        label: "Espace",
        heading: "Vers l’infiniment grand",
        body: "Le zoom cosmique en huit étapes, de la Terre jusqu’au fond diffus cosmologique.",
        meta: "Chapitre · L’espace",
        story: 6.6,
      },
      {
        id: "horlogerie",
        label: "Horlogerie",
        heading: "Vers l’infiniment petit",
        body: "L’Omega Speedmaster, son mouvement, et mes montres préférées.",
        meta: "Chapitre · L’horlogerie",
        story: 9.9,
      },
      {
        id: "art",
        label: "Art",
        heading: "Paris et le Louvre",
        body: "La Dame à la licorne, La Nuit étoilée de Van Gogh et les Nymphéas de Monet.",
        meta: "Chapitre · L’art",
        story: 16.6,
      },
      {
        id: "livres",
        label: "Livres",
        heading: "La bibliothèque",
        body: "Incendies, Le Trône de fer, Frankenstein et Le Petit Prince.",
        meta: "Chapitre · Les livres",
        story: 23.1,
      },
    ],
  },
  // Hoth retrace la formation : une étape par terminal, de la plus ancienne à la plus récente
  // (quatre au plus sur les plans holographiques), la dernière encore en cours.
  Hoth: {
    pad: "HANGAR PRINCIPAL · BASE ÉCHO",
    welcome:
      "Bienvenue sur Hoth. Les plans de la table de briefing retracent mon parcours de formation, chaque terminal en détaille une étape.",
    soundscape: "ice",
    terminals: education.map((item) => ({
      id: `formation-${item.id}`,
      label: item.year,
      heading: item.title,
      body: item.details[0],
      meta: [item.school, item.place, item.period, item.status].filter(Boolean).join(" · "),
      status: item.status === "En cours" ? ("progress" as const) : ("done" as const),
    })),
  },
  // Tatooine présente les projets : ORBITAL et deux de ses modules, puis « Mes passions ».
  Tatooine: {
    pad: "BAIE D’AMARRAGE 94 · MOS EISLEY",
    welcome:
      "Bienvenue sur Tatooine. Chaque terminal de la baie présente un projet.",
    soundscape: "desert",
    terminals: [
      {
        id: "orbital",
        label: "ORBITAL",
        heading: projects[0].title,
        body: "Une galaxie à explorer en vaisseau : planètes, cockpit de X-wing, missions Jedi, arcade, droïde R-X7 et un dossier CV dans l’Étoile de la Mort. Conçu en dirigeant des assistants de code IA.",
        meta: "Concept et direction · Next.js, Three.js, TypeScript · 2026",
      },
      {
        id: "arcade",
        label: "Arcade",
        heading: "Galactic Arcade — six simulations",
        body: "Un centre de simulation dans le cockpit : combat spatial, champ d’astéroïdes, piratage, course de speeder sur Endor, défense de Hoth et podracing à Tatooine, avec crédits, succès et récompenses.",
        meta: "Module d’ORBITAL · Three.js, Web Audio · 2026",
      },
      {
        id: "dossier",
        label: "Dossier",
        heading: "L’Étoile de la Mort — CV interactif",
        body: "Une station à parcourir en première personne qui présente mon parcours, et un mode recruteur pour l’essentiel en quelques clics.",
        meta: "Module d’ORBITAL · Three.js, React · 2026",
      },
      {
        id: "passions",
        label: "Passions",
        heading: projects[1].title,
        body: projects[1].solution,
        meta: "Création numérique · HTML, CSS, JavaScript",
        links: projects[1].link ? [projects[1].link] : undefined,
      },
    ],
  },
};
