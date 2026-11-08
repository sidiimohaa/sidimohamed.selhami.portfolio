import { certifications, education, experiences, identity, interests, languages, projects, skillTree, statusLabel } from "../deathStar/cvData";
import { destinations, landings } from "../universe";
import { profileNotes } from "./profileNotes";

// The droid's knowledge, written out from the same data the portfolio displays, so the chat cannot
// drift from the CV. Sent to the language model on the server, and read by the local engine.

export const portfolioProjects = (landings.Tatooine?.terminals ?? []).map((terminal) => ({
  label: terminal.label,
  title: terminal.heading,
  body: terminal.body,
}));

export function buildKnowledge() {
  const skills = skillTree
    .map((category) => `${category.name} :\n${category.skills.map((skill) => `- ${skill.name} [${statusLabel[skill.status]}] : ${skill.description} (${skill.context})`).join("\n")}`)
    .join("\n");
  const worlds = destinations
    .map((world) => {
      const topics = landings[world.name]?.terminals.map((terminal) => terminal.label).join(", ");
      return `- ${world.name} (${world.category}) : ${world.summary}${topics ? ` Contenu : ${topics}.` : ""}`;
    })
    .join("\n");
  return `IDENTITÉ
Nom : ${identity.name}
Recherche : ${identity.search}
Formation actuelle : ${identity.program}, ${identity.school} (${identity.schoolYear}). Rythme : ${identity.rhythm}.
Résumé : ${identity.summary}
Orientation : ${identity.ambition}
Zone : ${identity.location}. ${identity.mobility}.
E-mail professionnel : ${identity.email}
LinkedIn : ${identity.linkedin}
Langues : ${languages.join(", ")}
Centres d'intérêt : ${interests.join(", ")}
Ce qu'il dit de lui : ${profileNotes.facts.join(" ")}

FORMATIONS (de la plus ancienne à la plus récente)
${education.map((item) => `- ${item.period} : ${item.title}, ${item.school}${item.place ? `, ${item.place}` : ""}${item.status ? ` (${item.status})` : ""}. ${item.details.join(" ")}`).join("\n")}
Certifications : ${certifications.length ? certifications.map((item) => `${item.name} (${item.issuer}${item.date ? `, ${item.date}` : ""}${item.program ? `, module de ${certifications.find((parent) => parent.id === item.program)?.name}` : ""})`).join(", ") : "aucune renseignée pour l'instant"}.

EXPÉRIENCES
${experiences.map((item) => `- ${item.company}, ${item.place} : ${item.role} (${item.contract}, ${item.period}${item.duration ? `, ${item.duration}` : ""}). ${[...item.missions, ...(item.credentials ?? [])].join(" ")}${item.skills.length ? ` Compétences : ${item.skills.join(", ")}.` : ""}`).join("\n")}

COMPÉTENCES (respecter le statut : "En développement" n'est pas acquis, "Domaine d'intérêt" n'est pas une pratique)
${skills}

PROJETS VISIBLES DANS LE PORTFOLIO (terminaux de Tatooine, dans cet ordre)
${portfolioProjects.map((item, index) => `${index + 1}. ${item.title} : ${item.body}`).join("\n")}
Fiches détaillées :
${projects.map((item) => `- ${item.title} (${item.kind}). Objectif : ${item.goal} Solution : ${item.solution} Rôle : ${item.contribution} Technologies : ${item.stack.join(", ")}. Résultat : ${item.result}`).join("\n")}

POURQUOI CE PORTFOLIO
${profileNotes.whyThisPortfolio}

AMBITIONS (des directions, pas des réalisations)
${profileNotes.ambitions.join(", ")}

LIEUX DU PORTFOLIO
${worlds}
Autres : cockpit du X-wing (système orbital holographique et Galactic Arcade), journal de dix missions secrètes, scanner, mode recruteur. Sur Coruscant, un taxi aérien mène au Temple Jedi et au Sénat.`;
}
