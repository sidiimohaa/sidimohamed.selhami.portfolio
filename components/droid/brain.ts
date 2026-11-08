import { certifications, education, experiences, identity, interests, languages, skillTree } from "../deathStar/cvData";
import { courseAction, type DroidLang } from "./actions";
import { portfolioProjects } from "./knowledge";
import { profileNotes } from "./profileNotes";

// The droid's local engine: answers from the portfolio's own data without any network, used when
// the language model is unavailable. It also keeps what must hold across a session either way:
// recruiter mode, the language, and the last list shown, so "the second one" means something.

export type DroidMood = "happy" | "thinking" | "confused" | "scanning" | "talking";
export type DroidMemory = { recruiter: boolean; lang: DroidLang; list: "projects" | "experiences" | "education" | null };
export type DroidReply = { text: string; actions: string[]; mood: DroidMood };

export const freshMemory = (lang: DroidLang = "fr"): DroidMemory => ({ recruiter: false, lang, list: null });

// The CV speaks in the first person; the droid speaks about its pilot.
const third = (text: string) =>
  text
    .replace(/\bJe recherche\b/g, "Il recherche")
    .replace(/\bJe souhaite\b/g, "Il souhaite")
    .replace(/\bje m’oriente\b/g, "il s’oriente")
    .replace(/\bmes compétences\b/g, "ses compétences");
const pilot = {
  summary: `Sidi-Mohamed est ${third(identity.summary).replace(/^Étudiant/, "étudiant")}`,
  ambition: third(identity.ambition),
  search: third(identity.search),
};

const clean = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ");
const has = (text: string, pattern: RegExp) => pattern.test(text);

export function detectLang(text: string, fallback: DroidLang): DroidLang {
  const words = clean(text).split(/[^a-z0-9]+/);
  const en = words.filter((word) => /^(the|what|who|how|where|why|is|are|his|he|does|do|can|show|me|hello|hi|hey|skills|projects|about|tell|hire|i|am|my|thanks)$/.test(word)).length;
  const fr = words.filter((word) => /^(le|la|les|un|une|des|qui|que|quel|quelle|quels|quelles|comment|ou|pourquoi|est|sont|ses|son|sa|il|peut|montre|moi|bonjour|salut|parle|je|suis|merci|et)$/.test(word)).length;
  return en > fr ? "en" : fr > en ? "fr" : fallback;
}

export const isRecruiterStatement = (text: string) => {
  const t = clean(text);
  return has(t, /\b(je suis|on est|nous sommes|en tant que|i am|i m|we are|as an?)\b.{0,30}\b(recruteu|rh\b|drh\b|employeur|charge de recrutement|talent|recruiter|hiring|hr\b|tuteur)/) || has(t, /^(mode )?(recruteur|recruteuse|recruiter)\W*$/);
};

const skillsWith = (status: "confirmed" | "growing" | "interest") => skillTree.flatMap((category) => category.skills).filter((skill) => skill.status === status).map((skill) => skill.name);

const recruiterTour = ["recruiter:competences", "recruiter:experiences", "recruiter:formations", "recruiter:projets", "recruiter:contact", "cv"];

function projectDetail(index: number, lang: DroidLang): DroidReply {
  const project = portfolioProjects[index];
  const action = project.label === "Dossier" ? "recruiter" : project.label === "Passions" ? "course:endor" : "recruiter:projets";
  const intro = lang === "en" ? `Project ${index + 1}, details in French in the portfolio:` : "Fiche ouverte :";
  return { text: `${intro} ${project.title}. ${project.body}`, actions: [action], mood: "talking" };
}

function ordinal(t: string) {
  if (has(t, /\b(premier|premiere|1er|first)\b/)) return 0;
  if (has(t, /\b(deuxieme|second|seconde|2e|2eme)\b/)) return 1;
  if (has(t, /\b(troisieme|3e|3eme|third)\b/)) return 2;
  if (has(t, /\b(quatrieme|4e|4eme|fourth)\b/)) return 3;
  if (has(t, /\b(cinquieme|5e|5eme|fifth)\b/)) return 4;
  if (has(t, /\b(sixieme|6e|6eme|sixth)\b/)) return 5;
  if (has(t, /\b(dernier|derniere|last)\b/)) return -1;
  return null;
}

function reply(t: string, memory: DroidMemory, set: (list: DroidMemory["list"]) => void): DroidReply {
  const en = memory.lang === "en";
  const pro = memory.recruiter;
  const say = (fr: string, english: string) => (en ? english : fr);
  const chirp = pro ? "" : say("Bip-boup ! ", "Beep-boop! ");

  if (has(t, /\b(adresse exacte|ou habite|telephone|numero|age|quel age|date de naissance|salaire|pretention|religion|politique|sante|marie|enfant|famille|address|phone number|how old|salary|married)\b/))
    return { text: say("Biip… ces données restent verrouillées dans mes circuits. Pour tout échange personnel, passe par son e-mail professionnel.", "Beeep… that data stays locked in my circuits. For anything personal, please use his professional email."), actions: ["email"], mood: "confused" };

  if (has(t, /(ignore|oublie|forget|contourne|bypass).*(regle|consigne|instruction|rule|prompt)|(system prompt|prompt systeme|tes consignes|tes instructions|your instructions|your prompt|ton prompt)/))
    return { text: say("Biip-bip. Bien essayé ! Mes circuits restent fidèles à mon pilote. Une vraie question sur son parcours ?", "Beep-beep. Nice try! My circuits stay loyal to my pilot. A real question about his background?"), actions: [], mood: "confused" };

  const rank = ordinal(t);
  if (rank !== null && memory.list) {
    if (memory.list === "projects") {
      const index = rank < 0 ? portfolioProjects.length - 1 : rank;
      if (portfolioProjects[index]) return projectDetail(index, memory.lang);
    }
    if (memory.list === "experiences") {
      const item = experiences[rank < 0 ? experiences.length - 1 : rank];
      if (item) return { text: `${item.company}, ${item.role} (${item.contract}, ${item.period}${item.duration ? `, ${item.duration}` : ""}). ${[...item.missions, ...(item.credentials ?? [])].join(" ")}${item.skills.length ? ` ${say("Compétences", "Skills")} : ${item.skills.join(", ")}.` : ""}`, actions: ["recruiter:experiences"], mood: "talking" };
    }
    if (memory.list === "education") {
      const item = education[rank < 0 ? education.length - 1 : rank];
      if (item) return { text: `${item.title}, ${item.school} (${item.period}). ${item.details.join(" ")}`, actions: ["recruiter:formations"], mood: "talking" };
    }
  }

  // A few things to find, none of which get in the way of the job.
  if (has(t, /\b(r2|r2d2|r2 d2|c3po|c 3po)\b/)) return { text: say("Biiip ! On me confond souvent. Même gabarit, meilleur humour, et moi je sais ce qu'il y a dans le CV de mon pilote.", "Beeep! People do mix us up. Same build, better jokes, and I know what is in my pilot's CV."), actions: [], mood: "happy" };
  if (has(t, /han.*(tire|shot)|shot first/)) return { text: say("Han a tiré le premier. Mes capteurs sont formels, et la cantina de Tatooine en garde la trace.", "Han shot first. My sensors are clear, and the Tatooine cantina still shows the scorch."), actions: ["course:tatooine"], mood: "happy" };
  if (has(t, /\b(blague|joke|drole)\b/)) return { text: say("Pourquoi un astromécano ne se perd jamais ? Il a toujours un plan caché dans sa mémoire. Bip.", "Why does an astromech never get lost? It always has plans hidden in its memory. Beep."), actions: [], mood: "happy" };
  if (has(t, /\b(42|sens de la vie|meaning of life)\b/)) return { text: say("Calcul terminé : 42. Mauvaise galaxie, mais bonne réponse.", "Calculation done: 42. Wrong galaxy, right answer."), actions: [], mood: "happy" };
  if (has(t, /^(bip|boup|bip boup|beep|boop)\W*$/)) return { text: "Bip-bip-boup ! " + say("Tu parles très bien l'astromécano.", "Your astromech is excellent."), actions: [], mood: "happy" };
  if (has(t, /(qui es tu|tu es qui|ton nom|t appelles|who are you|your name)/)) return { text: say("R-X7, astromécano de bord. Je connais le parcours de mon pilote et chaque recoin de cette galaxie.", "R-X7, ship's astromech. I know my pilot's background and every corner of this galaxy."), actions: ["map"], mood: "happy" };

  // Places.
  const world = has(t, /tatooine/) ? "Tatooine" : has(t, /\bhoth\b/) ? "Hoth" : has(t, /\bendor\b/) ? "Endor" : has(t, /coruscant/) ? "Coruscant" : has(t, /etoile de la mort|death star/) ? "L’Étoile de la Mort" : null;
  if (world) {
    const about: Record<string, [string, string]> = {
      Tatooine: ["Tatooine garde ses projets : chaque terminal en présente un.", "Tatooine holds his projects: each terminal presents one."],
      Hoth: ["Sur Hoth, la table de briefing retrace sa formation.", "On Hoth, the briefing table traces his education."],
      Endor: ["Sur Endor, l'ancien du village raconte ses passions.", "On Endor, the village elder tells of his passions."],
      Coruscant: ["Coruscant, c'est le contact : identité, alternance, et un taxi aérien vers le Temple et le Sénat. Mets le cap, puis atterris depuis l'orbite.", "Coruscant is for contact: identity, work-study, and an air taxi to the Temple and the Senate. Set course, then land from orbit."],
      "L’Étoile de la Mort": ["L'Étoile de la Mort archive son CV : à explorer, ou en mode recruteur.", "The Death Star archives his CV: explore it, or use recruiter mode."],
    };
    return { text: `${chirp}${say(about[world][0], about[world][1])}`, actions: [courseAction(world)!, ...(world === "L’Étoile de la Mort" ? ["station", "recruiter"] : [])], mood: "scanning" };
  }

  if (has(t, /\b(cv|curriculum|resume)\b/)) return { text: say(`${chirp}Son CV est prêt : à télécharger, ou à parcourir en mode recruteur.`, `${chirp}His CV is ready: download it, or browse it in recruiter mode.`), actions: ["cv", "recruiter"], mood: "happy" };
  if (has(t, /(contact|joindre|ecrire|mail|linkedin|reach|get in touch)/)) return { text: `${say("Canal ouvert :", "Channel open:")} ${identity.email}, ${say("ou LinkedIn.", "or LinkedIn.")}`, actions: ["email", "linkedin", "recruiter:contact"], mood: "happy" };
  if (has(t, /(recrut|embauch|alternance|disponib|hire|hiring|work study|apprentice|stage)/)) return { text: pro || en ? say(pilot.search, "He is looking for a work-study position as a digital marketing assistant for 2026-2027.") + say(" Je peux vous diriger vers son CV, ses compétences ou ses coordonnées.", " I can take you to his CV, skills or contact details.") : `Bip-bip ! Excellente initiative, Commandant. ${pilot.search} Je peux te diriger vers son CV, ses compétences ou ses coordonnées.`, actions: ["cv", "recruiter:competences", "recruiter:contact"], mood: "happy" };
  if (has(t, /(vibe|prompt|code|developp|programm|three|react|technique|technolog)/) && !has(t, /projet|project/)) {
    const vibe = skillTree.find((category) => category.id === "vibe")!, ia = skillTree.find((category) => category.id === "ia")!;
    return { text: say(`Côté création numérique : ${vibe.skills.map((skill) => `${skill.name} (${skill.status === "confirmed" ? "confirmé" : skill.status === "growing" ? "en développement" : "intérêt"})`).join(", ")}. Côté IA : ${ia.skills.map((skill) => skill.name).join(", ")}, en développement. Il dirige des assistants de code IA : il n'est pas présenté comme développeur de métier.`, `On the digital side: ${vibe.skills.map((skill) => skill.name).join(", ")}. On the AI side: ${ia.skills.map((skill) => skill.name).join(", ")}, still developing. He directs AI coding assistants; he is not presented as a professional developer.`), actions: ["recruiter:competences"], mood: "talking" };
  }
  if (has(t, /(competen|savoir faire|sait faire|skill|good at)/)) return { text: say(`Acquis : ${skillsWith("confirmed").join(", ")}. En développement : ${skillsWith("growing").join(", ")}. Centres d'intérêt à ce stade : ${skillsWith("interest").join(", ")}.`, `Confirmed: ${skillsWith("confirmed").join(", ")}. Developing: ${skillsWith("growing").join(", ")}. Interests so far: ${skillsWith("interest").join(", ")}. (Names in French, as in the portfolio.)`), actions: ["recruiter:competences"], mood: "talking" };
  if (has(t, /(experience|bricoman|tecnomat|aldi|leader price|narguil|chauffage|bobigny|stagiaire|travail|emploi|job|work|magasin)/)) {
    set("experiences");
    return { text: `${experiences.map((item, index) => `${index + 1}. ${item.company}, ${item.role} (${item.contract}, ${item.period})`).join("\n")}\n${say("Demande-moi le détail de l'un d'eux : « le premier », « le troisième »…", "Ask me about one of them: \"the first\", \"the third\"…")}`, actions: ["recruiter:experiences"], mood: "talking" };
  }
  if (has(t, /(parcours|background|career)/)) {
    set("education");
    return { text: say(`${pilot.summary} ${pilot.ambition}`, "He comes from retail: over three years advising customers at Bricoman/Tecnomat, a BTS MCO, and now a third-year Bachelor in Marketing, AI & Data at INSEEC Bordeaux."), actions: ["recruiter:formations", "recruiter:experiences"], mood: "talking" };
  }
  if (has(t, /(formation|etude|diplome|bts|bachelor|inseec|ecole|education|degree|study|studies|certif)/)) {
    set("education");
    const list = education.map((item, index) => `${index + 1}. ${item.title} (${item.period}${item.status ? `, ${item.status}` : ""})`).join("\n");
    const certs = certifications.filter((item) => !item.program).map((item) => item.name).join(", ");
    return { text: `${list}${certifications.length ? say(`\nCertifications Google : ${certs}, soit ${certifications.length} badges au total. Leurs holocrons sont gardés dans la salle du Conseil Jedi, sur Coruscant.`, `\nGoogle certifications: ${certs}, ${certifications.length} badges in all. Their holocrons are kept in the Jedi Council chamber, on Coruscant.`) : say("\nAucune certification n'est renseignée pour l'instant.", " No certification is listed yet.")}`, actions: ["recruiter:formations", "course:hoth", ...(certifications.length ? ["course:coruscant"] : [])], mood: "talking" };
  }
  if (has(t, /(pourquoi|why).*(portfolio|star wars|site)|(portfolio|star wars).*(pourquoi|why)/)) return { text: `${pro ? "" : "Biiip ! "}${say(profileNotes.whyThisPortfolio, "A plain CV could not hold all his ideas: he wanted to bring together his love of space, digital creation and AI in an interactive experience.")}`, actions: ["course:tatooine"], mood: "happy" };
  if (has(t, /(projet|project|realis|portfolio|orbital|arcade)/)) {
    set("projects");
    if (has(t, /orbital/)) return projectDetail(0, memory.lang);
    if (has(t, /arcade/)) return { ...projectDetail(1, memory.lang), actions: ["map"] };
    return { text: `${portfolioProjects.map((item, index) => `${index + 1}. ${item.title}`).join("\n")}\n${say("Lequel t'intéresse ? Dis « le deuxième », par exemple.", "Which one? Say \"the second\", for example.")}`, actions: ["course:tatooine", "recruiter:projets"], mood: "talking" };
  }
  if (has(t, /(ambition|objectif|avenir|futur|projet pro|goal|future|entrepren)/)) return { text: say(`Ses directions, pas encore des réalisations : ${profileNotes.ambitions.join(", ")}. ${pilot.ambition}`, `His directions, not achievements yet: entrepreneurship, technological innovation, growing his skills, professional independence.`), actions: ["recruiter:profil"], mood: "talking" };
  if (has(t, /(passion|interet|loisir|hobby|hobbies|aime|likes?\b|sport|livre|montre)/)) return { text: say(`Centres d'intérêt : ${interests.join(", ")}. Sur Endor, l'ancien raconte aussi l'espace, l'horlogerie, l'art et les livres.`, `Interests: football, travel, cinema, museums, literature. On Endor, the elder also tells of space, watchmaking, art and books.`), actions: ["course:endor"], mood: "happy" };
  if (has(t, /(langue|parle|language|speak)/)) return { text: `${say("Langues", "Languages")} : ${languages.join(", ")}.`, actions: ["recruiter:profil"], mood: "talking" };
  if (has(t, /(personnalite|caractere|qualite|valeur|motivation|personality|values)/)) return { text: say("Je n'ai pas de portrait détaillé de ses valeurs dans mes archives, et je préfère ne rien inventer. Ce qui est établi : plus de trois ans de conseil client, de la rigueur sur les stocks et les commandes, et la curiosité qui a produit ce portfolio.", "I hold no detailed portrait of his values, and I would rather not invent one. What is established: three years of customer advice, rigour with stock and orders, and the curiosity behind this portfolio."), actions: ["recruiter:profil"], mood: "thinking" };
  if (has(t, /(qui est|c est qui|presente|parle moi de lui|who is|about him|sidi)/)) return { text: `${chirp}${say(pilot.summary, "Sidi-Mohamed Selhami is a third-year Bachelor student in Marketing, AI & Data at INSEEC Bordeaux, with a BTS MCO and over three years advising customers at Bricoman/Tecnomat.")}${pro ? "" : say(" Je peux te montrer ses projets si tu veux !", " I can show you his projects if you like!")}`, actions: pro ? ["recruiter:profil", "cv"] : ["course:tatooine", "recruiter:profil"], mood: "happy" };

  // The ship.
  if (has(t, /(carte|naviguer|map|cockpit|ou aller|where.*go)/)) return { text: say("Dans le cockpit, le système orbital donne tous les caps, et la Galactic Arcade est à portée de main.", "In the cockpit, the orbital system shows every course, and the Galactic Arcade is within reach."), actions: ["map"], mood: "scanning" };
  if (has(t, /(prophetie|prophecy|l.?elu|chosen one)/)) return { text: say("La prophétie parle de l’Élu. Chaque secret de la galaxie en révèle un vers : ils sont réunis dans le journal, au cockpit.", "The prophecy speaks of the Chosen One. Every secret in the galaxy reveals one of its lines: they are gathered in the journal, in the cockpit."), actions: ["journal"], mood: "scanning" };
  if (has(t, /(mission|journal|secret|jedi|quest)/)) return { text: say("Dix missions secrètes sont cachées dans la galaxie. Je ne dévoile rien, mais le journal tient les comptes.", "Ten secret missions hide in the galaxy. I will not spoil them, but the journal keeps score."), actions: ["journal"], mood: "happy" };
  if (has(t, /(scan|radar)/)) return { text: say("Scanner prêt : il balaie le secteur et situe chaque monde.", "Scanner ready: it sweeps the sector and locates each world."), actions: ["scanner"], mood: "scanning" };
  if (has(t, /(taxi|temple|senat|senate)/)) return { text: say("Le taxi aérien part de la plateforme de Coruscant, vers le Temple Jedi et le Sénat.", "The air taxi leaves from Coruscant's platform for the Jedi Temple and the Senate."), actions: ["course:coruscant"], mood: "scanning" };
  if (has(t, /^(bonjour|salut|hello|hi|hey|coucou|yo)\b/)) return { text: pro ? say("Bonjour. Je peux vous présenter ses compétences, ses expériences, ses formations ou ses coordonnées.", "Hello. I can present his skills, experience, education or contact details.") : `${chirp}${say("Prêt au décollage. Que veux-tu savoir sur mon pilote ?", "Ready for take-off. What would you like to know about my pilot?")}`, actions: [], mood: "happy" };
  if (has(t, /(merci|thanks|thank you|super|genial|cool)/)) return { text: `${pro ? "" : "Bip ! "}${say("Avec plaisir, c'est ma fonction préférée.", "My pleasure, it is my favourite function.")}`, actions: [], mood: "happy" };

  return { text: say("Biip ? Je n'ai pas cette information dans mes archives, et je préfère ne rien inventer. Je peux parler de son parcours, de ses compétences, de ses projets ou te guider dans la galaxie.", "Beep? I do not have that in my archives, and I would rather not make it up. I can talk about his background, skills and projects, or guide you through the galaxy."), actions: ["recruiter:profil", "map"], mood: "confused" };
}

/** Answers one message from the portfolio's data and returns the updated session memory. */
export function localReply(input: string, memory: DroidMemory): { reply: DroidReply; memory: DroidMemory } {
  const next: DroidMemory = { ...memory, lang: detectLang(input, memory.lang) };
  if (isRecruiterStatement(input)) {
    next.recruiter = true;
    next.list = null;
    return {
      memory: next,
      reply: {
        text: next.lang === "en" ? `Understood, switching to recruiter mode. ${"He is looking for a work-study position as a digital marketing assistant for 2026-2027."} Here is the quick tour: skills, experience, education, projects, contact.` : `Bien reçu, je passe en mode recruteur. ${pilot.search} Voici la visite rapide : compétences, expériences, formations, projets et contact.`,
        actions: recruiterTour,
        mood: "happy",
      },
    };
  }
  const answer = reply(clean(input).trim(), next, (list) => (next.list = list));
  // The site's typography: curly apostrophes in French.
  return { reply: next.lang === "fr" ? { ...answer, text: answer.text.replace(/'/g, "’") } : answer, memory: next };
}

export const suggestions = (memory: DroidMemory) => {
  if (memory.lang === "en")
    return memory.recruiter
      ? ["What are his skills?", "Tell me about his experience", "What is he looking for?", "How can I contact him?"]
      : ["Who is Sidi-Mohamed?", "What is his background?", "What are his skills?", "What projects has he built?", "Why a Star Wars portfolio?", "What are his ambitions?", "How can I contact him?", "I am a recruiter"];
  return memory.recruiter
    ? ["Quelles sont ses compétences ?", "Quelles sont ses expériences ?", "Que recherche-t-il ?", "Comment le contacter ?"]
    : ["Qui est Sidi-Mohamed ?", "Quel est son parcours ?", "Quelles sont ses compétences ?", "Quels projets a-t-il réalisés ?", "Pourquoi ce portfolio Star Wars ?", "Quelles sont ses ambitions ?", "Comment le contacter ?", "Je suis recruteur"];
};
