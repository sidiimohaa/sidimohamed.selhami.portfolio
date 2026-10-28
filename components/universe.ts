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
      "Des forêts émeraude, des océans et des voiles de nuages : un monde vivant pour ce qui me passionne. Un jour, vous y découvrirez les inspirations qui nourrissent ma créativité.",
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
};
export type Landing = {
  pad: string;
  welcome: string;
  soundscape: "city" | "desert" | "ice";
  terminals: LandingTerminal[];
};

// Textes provisoires : remplace-les par tes coordonnées (Coruscant), tes projets (Tatooine) et tes diplômes (Hoth).
export const landings: Partial<Record<string, Landing>> = {
  Coruscant: {
    pad: "PLATEFORME 3-7 · NIVEAU 5127",
    soundscape: "city",
    welcome:
      "Bienvenue sur Coruscant. Approchez un terminal pour lire sa transmission.",
    terminals: [
      {
        id: "identite",
        label: "Identité",
        heading: "Prénom Nom",
        body: "Métier · Ville, Pays",
      },
      {
        id: "transmission",
        label: "Transmission",
        heading: "bonjour@exemple.com",
        body: "Écrivez-moi pour un projet, une question ou un simple bonjour.",
        links: [{ label: "Envoyer un message", href: "mailto:bonjour@exemple.com" }],
      },
      {
        id: "reseaux",
        label: "Réseaux",
        heading: "Me retrouver en ligne",
        body: "Mon parcours et mes travaux, ailleurs dans la galaxie.",
        links: [
          { label: "LinkedIn", href: "https://www.linkedin.com/" },
          { label: "GitHub", href: "https://github.com/" },
        ],
      },
      {
        id: "disponibilite",
        label: "Disponibilité",
        heading: "Ouvert aux collaborations",
        body: "Stage, alternance, freelance ou projet personnel : parlons-en.",
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
