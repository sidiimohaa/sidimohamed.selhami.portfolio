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
    image: "/planets/tatooine.png",
    reference: {
      width: 894,
      height: 879,
      centerX: 447,
      centerY: 433,
      radius: 399,
    },
    summary: "Dunes, reliefs ocre et deux soleils : le terrain de mes projets.",
    description:
      "Sous deux soleils, les dunes et les reliefs ocre dessinent un terrain d’expérimentation. Ici prendront forme mes projets, du premier croquis à l’expérience aboutie.",
  },
  {
    name: "Endor",
    category: "Les passions",
    tag: "CURIOSITÉ & INSPIRATION",
    number: "02",
    className: "forest",
    image: "/planets/endor.png",
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
    image: "/planets/coruscant.png",
    reference: {
      width: 1000,
      height: 1000,
      centerX: 500,
      centerY: 482,
      radius: 422,
    },
    summary: "Des réseaux de lumière pour imaginer de nouvelles connexions.",
    description:
      "Sous la brume, des anneaux de lumière relient une planète entière. Ce sera notre point de rencontre pour échanger, imaginer et faire naître la prochaine collaboration.",
  },
  {
    name: "L’Étoile de la Mort",
    category: "Station orbitale",
    tag: "AUX CONFINS DE L’EMPIRE",
    number: "04",
    className: "death-star",
    image: "/planets/death-star.png",
    reference: {
      width: 720,
      height: 700,
      centerX: 355,
      centerY: 341,
      radius: 330,
    },
    summary: "L’acier, la tranchée et une silhouette impossible à confondre.",
    description:
      "Une surface d’acier striée de lumière, une tranchée à l’équateur, une parabole monumentale. Un clin d’œil à l’univers qui inspire ce voyage, à découvrir depuis l’orbite.",
  },
  {
    name: "Hoth",
    category: "Les diplômes",
    tag: "FORMATIONS & DIPLÔMES",
    number: "05",
    className: "ice",
    image: "/planets/hoth.png",
    reference: {
      width: 900,
      height: 900,
      centerX: 450,
      centerY: 450,
      radius: 405,
    },
    summary: "Un monde de glace où des plans holographiques révèlent mes diplômes.",
    description:
      "Des plaines gelées, des tempêtes et une base taillée dans la glace. Sur la table de briefing, des plans holographiques dévoilent mes diplômes, un objectif atteint après l’autre.",
  },
];

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
};
export type Landing = {
  pad: string;
  welcome: string;
  soundscape: "city" | "desert" | "ice" | "forest";
  terminals: LandingTerminal[];
};

// Présentations des zones : contact et formation à Coruscant, projets à Tatooine, diplômes à Hoth.
export const landings: Partial<Record<string, Landing>> = {
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
        meta: "Disponible dès maintenant",
        body: "Je recherche une alternance en marketing, IA et data. Contactez-moi pour échanger sur votre opportunité.",
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
  // Hoth présente les diplômes : un par terminal, du plus ancien au plus récent (quatre au plus
  // sur les plans holographiques).
  Hoth: {
    pad: "HANGAR PRINCIPAL · BASE ÉCHO",
    welcome:
      "Bienvenue sur Hoth. Les plans de la table de briefing révèlent mes diplômes, chaque terminal en détaille un.",
    soundscape: "ice",
    terminals: [
      {
        id: "diplome-1",
        label: "2018",
        heading: "Intitulé du premier diplôme",
        body: "Une phrase sur la formation, sa spécialité et ce qu’elle a apporté.",
        meta: "École · Ville · 2018",
      },
      {
        id: "diplome-2",
        label: "2020",
        heading: "Intitulé du deuxième diplôme",
        body: "Une phrase sur la formation, sa spécialité et ce qu’elle a apporté.",
        meta: "École · Ville · 2020",
      },
      {
        id: "diplome-3",
        label: "2022",
        heading: "Intitulé du troisième diplôme",
        body: "Une phrase sur la formation, sa spécialité et ce qu’elle a apporté.",
        meta: "École · Ville · 2022",
      },
      {
        id: "diplome-4",
        label: "2024",
        heading: "Intitulé du quatrième diplôme",
        body: "Une phrase sur la formation, sa spécialité et ce qu’elle a apporté.",
        meta: "École · Ville · 2024",
        links: [{ label: "Voir le diplôme", href: "https://example.com/" }],
      },
    ],
  },
  Tatooine: {
    pad: "BAIE D’AMARRAGE 94 · MOS EISLEY",
    welcome:
      "Bienvenue sur Tatooine. Chaque terminal de la baie présente un projet.",
    soundscape: "desert",
    terminals: [
      {
        id: "alpha",
        label: "Alpha",
        heading: "Projet Alpha",
        body: "Une phrase qui présente le projet, le problème qu’il résout et ce qu’il apporte.",
        meta: "Rôle · Technos · Année",
        links: [
          { label: "Voir le projet", href: "https://example.com/" },
          { label: "Code source", href: "https://github.com/" },
        ],
      },
      {
        id: "beta",
        label: "Bêta",
        heading: "Projet Bêta",
        body: "Une phrase qui présente le projet, le problème qu’il résout et ce qu’il apporte.",
        meta: "Rôle · Technos · Année",
        links: [{ label: "Voir le projet", href: "https://example.com/" }],
      },
      {
        id: "gamma",
        label: "Gamma",
        heading: "Projet Gamma",
        body: "Une phrase qui présente le projet, le problème qu’il résout et ce qu’il apporte.",
        meta: "Rôle · Technos · Année",
        links: [{ label: "Voir le projet", href: "https://example.com/" }],
      },
      {
        id: "delta",
        label: "Delta",
        heading: "Projet Delta",
        body: "Une phrase qui présente le projet, le problème qu’il résout et ce qu’il apporte.",
        meta: "Rôle · Technos · Année",
        links: [{ label: "Voir le projet", href: "https://example.com/" }],
      },
    ],
  },
};
