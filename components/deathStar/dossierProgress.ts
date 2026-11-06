import { SECTIONS, type Section } from "./cvData";

// Which sections of the record the visitor has read, and whether the High Command's last word
// has been shown. Shared by the station and the cockpit's flight log.

const STORE = "orbital-death-star-v1";
// `detention`, `tractor`, `escaped`: block AA-23 opened, tractor beam cut, the flight out already flown.
export type DossierProgress = { seen: Section[]; secret: boolean; detention?: boolean; tractor?: boolean; escaped?: boolean };

export const loadDossier = (): DossierProgress => {
  try {
    const value = JSON.parse(localStorage.getItem(STORE) ?? "null");
    if (value && Array.isArray(value.seen)) return { seen: value.seen.filter((s: string) => (SECTIONS as readonly string[]).includes(s)), secret: value.secret === true, detention: value.detention === true, tractor: value.tractor === true, escaped: value.escaped === true };
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
