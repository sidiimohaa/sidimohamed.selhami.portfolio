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
