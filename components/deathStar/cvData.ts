// The professional record shown inside the Death Star. Every line comes from the CV
// (public/cv/CV_Sidi_Mohamed_Selhami_Alternance_2026.pdf), from the portfolio itself, or from
// what Sidi-Mohamed asked to show, including his LinkedIn profile (internships, grades and the Google
// certifications). Nothing here is estimated: a field that is not documented is left out rather than
// filled in. Where LinkedIn and the CV disagree, the CV wins, so the downloadable PDF stays consistent.

export const CV_PDF = "/cv/CV_Sidi_Mohamed_Selhami_Alternance_2026.pdf";

export const identity = {
  name: "Sidi-Mohamed Selhami",
  title: "Assistant marketing digital · Alternance",
  program: "Bachelor 3 Marketing IA & Data",
  school: "INSEEC Bordeaux",
  schoolYear: "Septembre 2026 – août 2027",
  rhythm: "3 jours à l’école / 2 jours en entreprise, puis 6 mois en entreprise",
  location: "Gradignan, région bordelaise",
  mobility: "Permis de conduire, véhiculé",
  email: "sidimohamed.selhami1@gmail.com",
  linkedin: "https://www.linkedin.com/in/sidi-mohamed-selhami-919848242/",
  summary:
    "Étudiant en Bachelor 3 Marketing IA & Data à l’INSEEC Bordeaux, titulaire d’un BTS MCO, avec plus de trois ans de conseil client chez Bricoman/Tecnomat. Je souhaite mettre cette expérience commerciale au service du marketing digital et développer mes compétences en IA et en analyse de données.",
  ambition:
    "Venu du commerce et du terrain, je m’oriente vers les métiers du digital, de l’IA et du business, avec un intérêt marqué pour l’entrepreneuriat et les nouvelles technologies.",
  search: "Je recherche une alternance d’assistant marketing digital pour l’année 2026-2027.",
};

export type Experience = {
  id: string;
  company: string;
  place: string;
  role: string;
  contract: string;
  period: string;
  duration?: string;
  missions: string[];
  skills: string[];
  // An authorisation or training received on the job.
  credentials?: string[];
  highlight?: boolean;
};

export const experiences: Experience[] = [
  {
    id: "bricoman",
    company: "Bricoman / Tecnomat",
    place: "Villeparisis",
    role: "Conseiller technique et vendeur polyvalent",
    contract: "CDI",
    period: "Septembre 2021 – avril 2025",
    duration: "3 ans et 8 mois",
    missions: [
      "Accueillir et conseiller les clients sur les rayons électricité, outillage et quincaillerie.",
      "Préparer et suivre les commandes clients ; gérer les contrats de location et leur conformité administrative.",
      "Assurer le réapprovisionnement et contrôler les stocks pour prévenir les ruptures.",
      "Participer aux inventaires et résoudre les écarts de stock et les anomalies constatées.",
      "Implanter, présenter et étiqueter les produits (merchandising).",
    ],
    skills: ["Accueil et conseil client", "Conseil technique", "Relation client", "Préparation et suivi de commandes", "Gestion des stocks", "Inventaires", "Merchandising", "Conduite d’engins de manutention", "Rigueur administrative", "Travail en équipe"],
    credentials: ["Autorisation interne de conduite d’engins de manutention (Tecnomat) : formation à la conduite en sécurité des gerbeurs électriques, transpalettes électriques et chariots élévateurs."],
    highlight: true,
  },
  {
    id: "aldi",
    company: "Aldi",
    place: "Claye-Souilly",
    role: "Employé commercial",
    contract: "Stages et CDD estival",
    period: "Septembre 2020 – août 2021",
    missions: [
      "Réceptionner et contrôler les marchandises ; participer au suivi des stocks et aux inventaires.",
      "Mettre les produits en rayon selon les règles de merchandising et actualiser leur étiquetage.",
      "Assurer la rotation des produits et contrôler les dates de péremption.",
    ],
    skills: ["Réception de marchandises", "Mise en rayon", "Respect des règles d’hygiène et de sécurité", "Suivi des stocks", "Inventaires", "Merchandising", "Étiquetage", "Rotation des produits"],
  },
  {
    id: "leaderprice",
    company: "Leader Price",
    place: "Claye-Souilly",
    role: "Employé commercial",
    contract: "CDD",
    period: "Juillet 2020 – août 2020",
    duration: "2 mois",
    missions: [],
    skills: [],
  },
  {
    id: "narguilhouse",
    company: "Narguil’House",
    place: "Livry-Gargan",
    role: "Stagiaire en marketing et commerce",
    contract: "Stage",
    period: "Novembre 2019",
    duration: "1 mois",
    missions: [],
    skills: ["Marketing", "Analyse de marché"],
  },
  {
    id: "easychauffage",
    company: "Easy Chauffage",
    place: "Villevaudé",
    role: "Assistant chantier",
    contract: "Stage",
    period: "Octobre 2018 – décembre 2018",
    duration: "3 mois",
    missions: [],
    skills: ["Sens de l’observation", "Préparation du matériel"],
  },
  {
    id: "bobigny",
    company: "Annexe de la mairie de Bobigny",
    place: "Bobigny",
    role: "Assistant RH",
    contract: "Stage",
    period: "Janvier 2017",
    duration: "1 mois",
    missions: [],
    skills: [],
  },
];

export type Education = {
  id: string;
  title: string;
  school: string;
  place?: string;
  period: string;
  year: string;
  status?: string;
  details: string[];
};

// From the oldest to the most recent, as the timeline reads.
export const education: Education[] = [
  {
    id: "brevet",
    title: "Diplôme national du brevet",
    school: "Collège Henri IV",
    period: "Septembre 2014 – juin 2017",
    year: "2017",
    details: ["Le premier diplôme du parcours, au terme des années de collège."],
  },
  {
    id: "bac",
    title: "Baccalauréat STMG, spécialité mercatique",
    school: "Lycée André Boulloche",
    place: "Livry-Gargan",
    period: "Septembre 2017 – juin 2020",
    year: "2020",
    status: "Mention assez bien",
    details: ["Spécialité mercatique : les fondamentaux du marketing et de la relation commerciale.", "Moyenne : 12,80/20.", "Analyse des performances commerciales et analyse de marché."],
  },
  {
    id: "bts",
    title: "BTS Management commercial opérationnel (MCO)",
    school: "Lycée André Boulloche",
    place: "Livry-Gargan",
    period: "Septembre 2020 – juillet 2022",
    year: "2022",
    status: "Diplômé",
    details: ["Formation à la gestion d’une unité commerciale et à la relation client, menée en parallèle de l’expérience en magasin.", "Management de l’équipe commerciale et développement commercial.", "Moyenne : 13,25/20."],
  },
  {
    id: "prisma",
    title: "Formation aéroportuaire — Sécurité, sûreté et relation clientèle",
    school: "PRISMA Formations",
    place: "Villepinte",
    period: "Août 2026 – septembre 2026",
    year: "2026",
    details: ["Sécurité, sûreté et relation clientèle en environnement aéroportuaire.", "Modules : agent d’accueil, agent d’assistance aux personnes à mobilité réduite (APMR) et anglais (English 360).", "Formation sûreté 11.2.6.2 (TCA) et procédures aéroportuaires."],
  },
  {
    id: "bachelor",
    title: "Bachelor 3 Marketing IA & Data",
    school: "INSEEC",
    place: "Bordeaux",
    period: "Septembre 2026 – août 2027",
    year: "2027",
    status: "En cours",
    details: ["Rythme : 3 jours à l’école / 2 jours en entreprise, puis 6 mois en entreprise.", "Marketing digital, intelligence artificielle et analyse de données.", "Intitulé : Licence en commerce, Bachelor 3 Digital Business, IA et Data — Responsable de projet Marketing Communication."],
  },
];

// Real certifications only, as listed on LinkedIn. A date LinkedIn does not show is left out.
// `program` groups the five courses that make up Google AI Essentials.
export type Certification = { id: string; name: string; french: string; issuer: string; date?: string; program?: string };
export const certifications: Certification[] = [
  { id: "essentials", name: "Google AI Essentials", french: "Les fondamentaux de l’IA au travail", issuer: "Google" },
  { id: "intro", name: "Introduction to AI", french: "Comprendre ce qu’est l’IA et ce qu’elle sait faire", issuer: "Google", date: "Octobre 2026", program: "essentials" },
  { id: "productivity", name: "Maximize Productivity With AI Tools", french: "Gagner en efficacité avec les outils d’IA", issuer: "Google", date: "Octobre 2026", program: "essentials" },
  { id: "prompting", name: "Discover the Art of Prompting", french: "L’art du prompt", issuer: "Google", date: "Octobre 2026", program: "essentials" },
  { id: "responsible", name: "Use AI Responsibly", french: "Utiliser l’IA de façon responsable", issuer: "Google", date: "Octobre 2026", program: "essentials" },
  { id: "curve", name: "Stay Ahead of the AI Curve", french: "Garder une longueur d’avance sur l’IA", issuer: "Google", date: "Octobre 2026", program: "essentials" },
  { id: "fundamentals", name: "AI Fundamentals", french: "Les bases de l’intelligence artificielle", issuer: "Google", date: "Novembre 2026" },
];
export const certificationLine = (item: Certification) => [item.name, item.issuer, item.date].filter(Boolean).join(" · ");

export type SkillStatus = "confirmed" | "growing" | "interest";
export const statusLabel: Record<SkillStatus, string> = { confirmed: "Compétence confirmée", growing: "En développement", interest: "Domaine d’intérêt" };
export type Skill = { id: string; name: string; status: SkillStatus; description: string; context: string; proof: string[] };
export type SkillCategory = { id: string; letter: string; name: string; color: string; skills: Skill[] };

// Confirmed: shown by an experience or a finished project. Growing: the subject of the current
// training or of a project under way. Interest: a direction, not yet a practice.
export const skillTree: SkillCategory[] = [
  {
    id: "commerce",
    letter: "A",
    name: "Commerce et relation client",
    color: "#7fd4ff",
    skills: [
      { id: "besoins", name: "Identification des besoins", status: "confirmed", description: "Écouter le client, comprendre son projet et cerner ce dont il a réellement besoin.", context: "Plus de trois ans en magasin, au contact quotidien des clients.", proof: ["Bricoman / Tecnomat", "BTS MCO"] },
      { id: "conseil", name: "Conseil technique et vente", status: "confirmed", description: "Conseiller sur des produits techniques et accompagner jusqu’à l’achat.", context: "Rayons électricité, outillage et quincaillerie.", proof: ["Bricoman / Tecnomat"] },
      { id: "commandes", name: "Suivi commercial", status: "confirmed", description: "Préparer et suivre les commandes clients, gérer les contrats de location.", context: "Suivi des commandes et conformité administrative des locations.", proof: ["Bricoman / Tecnomat"] },
      { id: "merch", name: "Merchandising", status: "confirmed", description: "Implanter, présenter et étiqueter les produits pour faciliter l’achat.", context: "Mise en rayon et étiquetage selon les règles de merchandising.", proof: ["Bricoman / Tecnomat", "Aldi"] },
      { id: "accueil", name: "Accueil et assistance PMR", status: "growing", description: "Accueillir, orienter et accompagner les voyageurs, y compris les personnes à mobilité réduite.", context: "Formation d’agent d’accueil et d’agent APMR en environnement aéroportuaire, avec un module d’anglais.", proof: ["PRISMA Formations"] },
    ],
  },
  {
    id: "marketing",
    letter: "B",
    name: "Marketing digital",
    color: "#ffc56b",
    skills: [
      { id: "mercatique", name: "Fondamentaux du marketing", status: "confirmed", description: "Les bases de la mercatique et de la relation commerciale.", context: "Baccalauréat STMG spécialité mercatique, un stage en marketing et commerce, puis le BTS MCO.", proof: ["Bac STMG mercatique", "Narguil’House", "BTS MCO"] },
      { id: "marche", name: "Analyse de marché", status: "confirmed", description: "Observer un marché, sa clientèle et sa concurrence pour orienter l’action commerciale.", context: "Stage en marketing et commerce chez Narguil’House, après les bases vues en bac STMG.", proof: ["Narguil’House", "Bac STMG mercatique"] },
      { id: "digital", name: "Marketing digital", status: "growing", description: "Stratégie et outils du marketing en ligne.", context: "Au cœur du Bachelor Marketing IA & Data et de l’alternance recherchée.", proof: ["Bachelor 3 INSEEC (en cours)"] },
    ],
  },
  {
    id: "ia",
    letter: "C",
    name: "IA et prompt engineering",
    color: "#b99bff",
    skills: [
      { id: "prompt", name: "Prompt engineering", status: "growing", description: "Rédiger des consignes précises pour obtenir d’une IA un résultat exploitable.", context: "Pratiqué pour concevoir ce portfolio : briefs détaillés, itérations et vérifications. Certifié par Google (Discover the Art of Prompting).", proof: ["Projet ORBITAL", "Google AI Essentials"] },
      { id: "ia-business", name: "IA appliquée au business", status: "growing", description: "Comprendre comment l’IA transforme le marketing et les métiers commerciaux.", context: "Volet IA du Bachelor Marketing IA & Data, et les certifications Google AI Essentials et AI Fundamentals.", proof: ["Bachelor 3 INSEEC (en cours)", "Google AI Essentials", "Google AI Fundamentals"] },
      { id: "ia-outils", name: "Productivité avec les outils d’IA", status: "growing", description: "Confier à l’IA les tâches qui s’y prêtent pour gagner du temps sur le reste.", context: "Certification Google « Maximize Productivity With AI Tools ».", proof: ["Google AI Essentials"] },
      { id: "ia-responsable", name: "IA responsable", status: "growing", description: "Utiliser l’IA en connaissant ses limites et ses risques, et vérifier ce qu’elle produit.", context: "Certification Google « Use AI Responsibly ».", proof: ["Google AI Essentials"] },
    ],
  },
  {
    id: "data",
    letter: "D",
    name: "Data et analyse",
    color: "#6fe3a8",
    skills: [
      { id: "ecarts", name: "Analyse des écarts de stock", status: "confirmed", description: "Repérer une anomalie, en chercher la cause et la corriger.", context: "Inventaires et résolution des écarts de stock en magasin.", proof: ["Bricoman / Tecnomat", "Aldi"] },
      { id: "analyse", name: "Analyse de données", status: "growing", description: "Lire, structurer et interpréter des données pour décider.", context: "Volet Data du Bachelor Marketing IA & Data.", proof: ["Bachelor 3 INSEEC (en cours)"] },
    ],
  },
  {
    id: "projet",
    letter: "E",
    name: "Gestion de projet et organisation",
    color: "#ff9a7d",
    skills: [
      { id: "organisation", name: "Organisation et rigueur", status: "confirmed", description: "Tenir des stocks, des commandes et des contrats à jour et conformes.", context: "Réapprovisionnement, inventaires et gestion administrative des locations.", proof: ["Bricoman / Tecnomat"] },
      { id: "equipe", name: "Travail en équipe", status: "confirmed", description: "Coordonner son travail avec celui de l’équipe du magasin.", context: "Vie quotidienne d’un point de vente.", proof: ["Bricoman / Tecnomat", "Aldi"] },
      { id: "securite", name: "Sécurité et sûreté", status: "confirmed", description: "Appliquer les règles d’hygiène, de sécurité et de sûreté de son lieu de travail.", context: "Hygiène et sécurité en rayon, conduite d’engins de manutention sous autorisation interne, formation sûreté aéroportuaire 11.2.6.2.", proof: ["Bricoman / Tecnomat", "Aldi", "PRISMA Formations"] },
      { id: "pilotage", name: "Pilotage d’un projet numérique", status: "growing", description: "Définir un objectif, découper le travail, tester et ajuster.", context: "Conduite du projet ORBITAL, étape par étape.", proof: ["Projet ORBITAL"] },
      { id: "entrepreneuriat", name: "Entrepreneuriat", status: "interest", description: "Créer et développer une activité.", context: "Un intérêt affirmé, nourri par l’expérience commerciale.", proof: [] },
    ],
  },
  {
    id: "vibe",
    letter: "F",
    name: "Vibe coding et prototypage",
    color: "#ff7dbb",
    skills: [
      { id: "prototypage", name: "Prototypage assisté par IA", status: "confirmed", description: "Transformer une idée en prototype fonctionnel en dialoguant avec des assistants de code.", context: "ORBITAL : un portfolio 3D complet construit ainsi.", proof: ["Projet ORBITAL"] },
      { id: "direction", name: "Direction créative", status: "confirmed", description: "Fixer une direction artistique et la faire respecter jusqu’au détail.", context: "Univers, scènes et interfaces d’ORBITAL.", proof: ["Projet ORBITAL", "Présentation « Mes passions »"] },
      { id: "tech", name: "Technologies web et 3D", status: "interest", description: "Comprendre ce que permettent le web moderne et la 3D temps réel.", context: "Découvertes au fil de la construction du portfolio.", proof: ["Projet ORBITAL"] },
    ],
  },
];

export type Project = {
  id: string;
  title: string;
  kind: string;
  goal: string;
  problem: string;
  solution: string;
  stack: string[];
  contribution: string;
  result: string;
  link?: { label: string; href: string };
};

export const projects: Project[] = [
  {
    id: "orbital",
    title: "ORBITAL — portfolio 3D Star Wars",
    kind: "Projet numérique · prototypage assisté par IA",
    goal: "Présenter mon profil autrement qu’avec un CV papier : un univers à explorer.",
    problem: "Un CV classique montre mal la curiosité, la créativité et l’appétence pour le digital et l’IA.",
    solution: "Une galaxie en 3D : planètes à visiter, cockpit de X-wing, missions Jedi, arcade, droïde R-X7 et cette station qui rassemble le dossier professionnel.",
    stack: ["Next.js", "React", "TypeScript", "Three.js", "Web Audio", "Assistants de code IA"],
    contribution: "Concept, direction artistique, rédaction des briefs et des prompts, choix des contenus, tests et validation de chaque étape.",
    result: "Un portfolio explorable sur ordinateur et sur téléphone ; vous êtes en train de le parcourir.",
  },
  {
    id: "passions",
    title: "Mes passions — présentation interactive",
    kind: "Création numérique",
    goal: "Partager mes centres d’intérêt sous la forme d’une présentation vivante.",
    problem: "Des passions variées, de l’infiniment grand à l’infiniment petit, difficiles à résumer en une ligne.",
    solution: "Une présentation web en chapitres : l’espace, l’horlogerie, l’art et les livres.",
    stack: ["HTML", "CSS", "JavaScript"],
    contribution: "Choix des thèmes, des contenus et de la mise en forme.",
    result: "Consultable dans le portfolio, sur Endor, et ici.",
    link: { label: "Ouvrir la présentation", href: "/passions/index.html" },
  },
];

export const languages = ["Français", "Anglais", "Arabe", "Espagnol"];
export const interests = ["Football", "Voyages", "Cinéma", "Musées", "Littérature"];

// The sections whose full consultation unlocks the station's last message.
export const SECTIONS = ["profil", "experiences", "formations", "competences", "projets", "contact"] as const;
export type Section = (typeof SECTIONS)[number];
export const sectionLabel: Record<Section, string> = {
  profil: "Profil",
  experiences: "Expériences",
  formations: "Formations",
  competences: "Compétences",
  projets: "Projets",
  contact: "Contact",
};
