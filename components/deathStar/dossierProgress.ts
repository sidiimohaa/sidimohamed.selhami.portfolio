import { SECTIONS, type Section } from "./cvData";

// Which sections of the record the visitor has read, and whether the High Command's last word
// has been shown. Shared by the station and the cockpit's flight log.

const STORE = "orbital-death-star-v1";
export type DossierProgress = { seen: Section[]; secret: boolean };

export const loadDossier = (): DossierProgress => {
  try {
    const value = JSON.parse(localStorage.getItem(STORE) ?? "null");
    if (value && Array.isArray(value.seen)) return { seen: value.seen.filter((s: string) => (SECTIONS as readonly string[]).includes(s)), secret: value.secret === true };
  } catch {
    // Private browsing: progress lasts for the visit.
  }
  return { seen: [], secret: false };
};
export const saveDossier = (value: DossierProgress) => {
  try {
    localStorage.setItem(STORE, JSON.stringify(value));
  } catch {
    // Nothing to do.
  }
};
