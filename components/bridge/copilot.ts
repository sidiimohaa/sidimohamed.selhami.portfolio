import { destinations, landings } from "../universe";

// What the astromech copilot says on the way to a world and once in orbit. Every line describes
// what the portfolio holds at that destination, from the same data the worlds themselves use.

export type CopilotMessage = { id: string; title: string; body: string };

export function copilotOnCourse(index: number): CopilotMessage {
  const world = destinations[index];
  return {
    id: `course-${index}-${Date.now()}`,
    title: `CAP SUR ${world.name.toUpperCase()}`,
    body: `Trajectoire calculée. ${world.category} : ${world.summary}`,
  };
}

export function copilotInOrbit(index: number): CopilotMessage {
  const world = destinations[index],
    landing = landings[world.name];
  const topics = landing?.terminals.map((terminal) => terminal.label).join(" · ");
  let body: string;
  if (world.name === "Coruscant")
    body = `Plateforme ${landing?.pad.split("·")[0].replace("PLATEFORME", "").trim() ?? ""} : ${topics}. Depuis la plateforme, un taxi aérien rejoint le Temple Jedi et le Sénat.`;
  else if (index === 3)
    body = "Le dossier professionnel est accessible : accostez la station, ou passez en mode recruteur pour l’essentiel en quelques clics.";
  else if (world.name === "Hoth") body = `Signal de la base Écho. Sur la table de briefing, les plans retracent ma formation : ${topics}.`;
  else if (world.name === "Endor") body = `Au village, l’ancien raconte mes passions : ${topics}.`;
  else body = `Zone d’atterrissage dégagée. Chaque terminal présente un projet : ${topics}.`;
  return { id: `orbit-${index}-${Date.now()}`, title: `EN ORBITE · ${world.name.toUpperCase()}`, body };
}
