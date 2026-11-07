import { education, experiences, identity, projects, skillTree } from "../deathStar/cvData";

// What the rank rewards reveal, drawn from the CV so that nothing here can drift from it. To tell a
// more personal story, replace the paragraphs of `anecdote` with your own words.

const skillsWith = (status: "confirmed" | "growing") =>
  skillTree.flatMap((category) => category.skills).filter((skill) => skill.status === status).map((skill) => skill.name);

export const anecdote = {
  title: "Du rayon au cockpit",
  paragraphs: [
    "Pendant plus de trois ans chez Bricoman/Tecnomat, j’ai conseillé des clients sur les rayons électricité, outillage et quincaillerie : comprendre un besoin, conseiller, puis préparer et suivre les commandes.",
    `Quand un CV classique m’a semblé trop étroit pour montrer ma curiosité, j’ai construit ORBITAL en dirigeant des assistants de code IA : concept, direction artistique, briefs, tests et validation de chaque étape. ${identity.search}`,
  ],
};

export const skills = {
  title: "Terminal des compétences",
  groups: [
    { name: "Compétences confirmées", items: skillsWith("confirmed") },
    { name: "En développement", items: skillsWith("growing") },
    { name: "Expériences", items: experiences.map((item) => `${item.role}, ${item.company} (${item.period})`) },
    { name: "Réalisations", items: projects.map((item) => item.title) },
  ],
};

export const temple = {
  relics: [
    { id: "archives", title: "Les archives du Temple", text: `Ce qui a formé le pilote : ${education.map((item) => `${item.title} (${item.period})`).join(" ; ")}.` },
    { id: "kyber", title: "Le cristal du pilote", text: identity.ambition },
    { id: "council", title: "Le siège du Conseil", text: "Un Jedi n’avance jamais seul : en magasin chez Bricoman / Tecnomat, coordonner son travail avec celui de l’équipe faisait partie du quotidien." },
    { id: "holocron", title: "L’holocron scellé", text: `${identity.search} ${identity.rhythm}.` },
  ],
};

// What Yoda says of each relic. His words, but only what the record above says.
export const yoda = {
  welcome: "Attendu, je t’ai, jeune Maître. Quatre reliques devant toi sont. De ton pilote, chacune une page garde.",
  archives: "Apprendre, jamais il n’a cessé. Ce qui l’a formé, ces archives montrent.",
  kyber: "Du commerce et du terrain, il vient. Vers le digital et l’IA, son cristal l’appelle.",
  council: "Seul, un Jedi n’avance jamais. Avec son équipe, en magasin, cela il a appris.",
  holocron: "Scellé, cet holocron n’est plus. Une alternance, il cherche. L’aider, peut-être tu pourrais.",
  // When every secret has been found; until then he passes on the mission's own whisper.
  fulfilled: "Accomplie, la prophétie est. Dans ton cockpit, la dernière pièce de la carte t’attend.",
};
