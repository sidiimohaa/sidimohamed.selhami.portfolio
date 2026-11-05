import { CV_PDF, SECTIONS, identity, sectionLabel, type Section } from "../deathStar/cvData";
import { destinationSlug, destinations } from "../universe";

// Everything R-X7 can offer to do, and nothing else. The droid only ever proposes one of these as a
// button, and only a click by the visitor carries it out: neither its words nor a visitor's message
// can move the ship, and an id that is not listed here is thrown away.

export type DroidLang = "fr" | "en";
export type DroidActionInfo = { fr: string; en: string; href?: string; external?: boolean };

const sectionEnglish: Record<Section, string> = { profil: "Profile", experiences: "Experience", formations: "Education", competences: "Skills", projets: "Projects", contact: "Contact" };

const sections = Object.fromEntries(SECTIONS.map((section) => [`recruiter:${section}`, { fr: sectionLabel[section], en: sectionEnglish[section] }]));
const courses = Object.fromEntries(destinations.map((world) => [`course:${destinationSlug(world)}`, { fr: `Cap sur ${world.name}`, en: `Set course for ${world.name}` }]));

export const droidActions: Record<string, DroidActionInfo> = {
  recruiter: { fr: "Ouvrir le mode recruteur", en: "Open recruiter mode" },
  ...sections,
  ...courses,
  cv: { fr: "Télécharger le CV", en: "Download the CV", href: CV_PDF },
  email: { fr: "Écrire un e-mail", en: "Send an email", href: `mailto:${identity.email}` },
  linkedin: { fr: "LinkedIn", en: "LinkedIn", href: identity.linkedin, external: true },
  map: { fr: "Ouvrir la carte stellaire", en: "Open the star map" },
  journal: { fr: "Journal des missions", en: "Mission journal" },
  scanner: { fr: "Lancer le scanner", en: "Run the scanner" },
  station: { fr: "Explorer la station", en: "Explore the station" },
};

export const actionIds = Object.keys(droidActions);
export const isDroidAction = (id: unknown): id is string => typeof id === "string" && Object.prototype.hasOwnProperty.call(droidActions, id);
export const courseAction = (name: string) => {
  const world = destinations.find((item) => item.name === name);
  return world ? `course:${destinationSlug(world)}` : null;
};
