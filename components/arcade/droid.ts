import type { ArcadeGameId } from "./catalog";
import { gameById } from "./catalog";
import type { ResultSummary } from "./arcadeStore";

// The arcade droid speaks from written lines only: no AI call for these simple reactions. Lines
// are shown on the console, never read aloud.

const pick = <T,>(list: T[], seed = Math.random()) => list[Math.floor(seed * list.length) % list.length];

export const droidLines = {
  boot: "Centre de simulation galactique activé. Sélectionnez votre programme d’entraînement, Commandant.",
  open: "Galactic Arcade opérationnel. Les programmes de simulation sont prêts. Quel défi souhaitez-vous relever, Commandant ?",
  impatient: [
    "Commandant ? Les simulations ne vont pas se lancer toutes seules. Enfin, techniquement, si, mais ce serait moins drôle.",
    "Je calcule qu’à ce rythme, l’Empire aura le temps de construire une troisième station avant votre premier choix.",
    "Je peux vous recommander quelque chose, si vous hésitez. Les astéroïdes, peut-être ? Ils adorent les pilotes indécis.",
  ],
  rewards: "Chaque mission réussie rapporte des crédits galactiques. Dépensez-les dans l’onglet Récompenses : couleurs d’hologramme, thèmes de console, titres et traînées de réacteurs.",
  locked: "Ce programme n’est pas encore disponible, Commandant.",
};

export function launchLine(id: ArcadeGameId) {
  return gameById(id).announce;
}

/** A reaction to a finished run: congratulations, a record, or encouragement, then a suggestion. */
export function resultLine(summary: ResultSummary, suggestion: string) {
  const { result, record, achievements } = summary;
  if (achievements.length) return `Succès débloqué : ${achievements.map((a) => a.name).join(", ")}. Impressionnant, Commandant. ${suggestion}`;
  if (record) return `Nouveau record personnel ! Je l’ai consigné dans les archives. ${suggestion}`;
  if (result.won && result.perfect) return `Une performance parfaite. Même un maître Jedi prendrait des notes. ${suggestion}`;
  if (result.won) return pick([`Mission accomplie, Commandant. ${suggestion}`, `Simulation réussie. Le Haut Commandement sera ravi. ${suggestion}`]);
  return pick([`La simulation a échoué, mais c’est fait pour ça. Réessayez, Commandant.`, `Pas cette fois. Je recommande une nouvelle tentative, avec un peu moins d’optimisme.`]);
}
export function suggestion(exclude: ArcadeGameId, ids: ArcadeGameId[]) {
  const other = ids.filter((id) => id !== exclude);
  return other.length ? `Pourquoi ne pas tenter ${gameById(pick(other)).name} ?` : "";
}

