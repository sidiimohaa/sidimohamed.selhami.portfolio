// What R-X7 knows about its pilot beyond the CV. This file is meant to be edited by hand: everything
// factual (studies, jobs, skills, projects) comes from deathStar/cvData.ts and universe.ts, so correct
// those there. Add a line here only if it is true. An ambition must stay in `ambitions`, never in
// `facts`: the droid is told to present it as a direction, not as something already done.

export const profileNotes = {
  // Told by Sidi-Mohamed himself.
  facts: [
    "Passionné de nouvelles technologies, d’intelligence artificielle et d’exploration.",
    "Après plusieurs années dans le commerce, il oriente son parcours vers le digital et l’IA.",
  ],
  whyThisPortfolio:
    "Un simple CV ne suffisait pas à contenir ses idées : il voulait réunir sa passion pour l’espace, la création numérique et l’intelligence artificielle dans une expérience interactive.",
  // Directions, not achievements.
  ambitions: ["Entrepreneuriat", "Innovation technologique", "Développement de ses compétences", "Indépendance professionnelle"],
  // Subjects the droid must decline, even if asked nicely.
  neverDiscuss: ["adresse exacte", "téléphone", "âge ou date de naissance", "salaire ou prétentions", "santé", "religion", "opinions politiques", "famille", "situation personnelle"],
};
