import { useSyncExternalStore } from "react";
import { arcadeGames, gameById, type ArcadeGameId } from "./catalog";

// Galactic Arcade's local records: per-game statistics, Galactic Credits, achievements, cosmetics
// and secrets, saved under a versioned key. Every reward is computed from real results, and a
// one-off bonus is keyed so it can never be paid twice. Nothing here is shared or online; the
// shape (one result per finished run) is ready to be sent to a leaderboard later.

export type GameStats = {
  last: number | null;
  best: number | null;
  plays: number;
  wins: number;
  // Best time in seconds, for races.
  bestTime: number | null;
  recordAt: string | null;
  seconds: number;
};
export type GameResult = {
  gameId: ArcadeGameId;
  score: number;
  won: boolean;
  perfect: boolean;
  seconds: number;
  // Race time in seconds, when the run finished the course.
  time?: number;
  // Facts some achievements depend on.
  survived?: number;
  errors?: number;
  hullLost?: boolean;
};

export const REWARDS = { win: 100, record: 50, perfect: 100, firstWin: 150 };

export type AchievementId = "ace-pilot" | "asteroid-master" | "imperial-ghost" | "speed-demon" | "defender-of-hoth" | "galactic-legend";
export const SPEED_TARGET = 70;
export const achievements: { id: AchievementId; icon: string; name: string; description: string }[] = [
  { id: "ace-pilot", icon: "◆", name: "Ace Pilot", description: "Remporter Space Battle sans que la coque soit touchée." },
  { id: "asteroid-master", icon: "✷", name: "Asteroid Master", description: "Survivre trois minutes dans le champ d’astéroïdes." },
  { id: "imperial-ghost", icon: "◎", name: "Imperial Ghost", description: "Réussir Imperial Hacking sans aucune erreur." },
  { id: "speed-demon", icon: "➤", name: "Speed Demon", description: `Terminer la course de speeder en moins de ${SPEED_TARGET} secondes.` },
  { id: "defender-of-hoth", icon: "✦", name: "Defender of Hoth", description: "Repousser l’assaut impérial sur Hoth." },
  { id: "galactic-legend", icon: "✪", name: "Galactic Legend", description: "Remporter au moins une victoire dans chacun des cinq mini-jeux." },
];

export type Grade = { id: string; title: string; rule: string };
export const grades: Grade[] = [
  { id: "cadet", title: "Cadet", rule: "Grade de départ." },
  { id: "pilot", title: "Pilote", rule: "Remporter une première simulation." },
  { id: "commander", title: "Commandant", rule: "Remporter trois simulations différentes." },
  { id: "ace", title: "As", rule: "Débloquer quatre succès." },
  { id: "legend", title: "Légende galactique", rule: "Débloquer le succès Galactic Legend." },
];

export type CosmeticKind = "holo" | "theme" | "title" | "accent" | "engine";
export type Cosmetic = { id: string; kind: CosmeticKind; name: string; price: number; value: string };
export const cosmetics: Cosmetic[] = [
  { id: "holo-cyan", kind: "holo", name: "Hologramme cyan", price: 0, value: "#78c6ff" },
  { id: "holo-amber", kind: "holo", name: "Hologramme ambre", price: 200, value: "#ffc56b" },
  { id: "holo-emerald", kind: "holo", name: "Hologramme émeraude", price: 300, value: "#6fe3a8" },
  { id: "holo-crimson", kind: "holo", name: "Hologramme écarlate", price: 300, value: "#ff6f7d" },
  { id: "holo-violet", kind: "holo", name: "Hologramme améthyste", price: 400, value: "#b99bff" },
  { id: "theme-standard", kind: "theme", name: "Console standard", price: 0, value: "standard" },
  { id: "theme-imperial", kind: "theme", name: "Console impériale", price: 400, value: "imperial" },
  { id: "theme-retro", kind: "theme", name: "Console rétro", price: 500, value: "retro" },
  { id: "title-cadet", kind: "title", name: "Cadet de l’Académie", price: 0, value: "Cadet de l’Académie" },
  { id: "title-rogue", kind: "title", name: "As de l’escadron Rogue", price: 300, value: "As de l’escadron Rogue" },
  { id: "title-echo", kind: "title", name: "Gardien de la Base Echo", price: 250, value: "Gardien de la Base Echo" },
  { id: "title-shadow", kind: "title", name: "Ombre de l’Empire", price: 500, value: "Ombre de l’Empire" },
  { id: "accent-blue", kind: "accent", name: "Éclairage de cockpit bleu", price: 0, value: "#709cc6" },
  { id: "accent-amber", kind: "accent", name: "Éclairage de cockpit ambré", price: 250, value: "#d99a52" },
  { id: "accent-green", kind: "accent", name: "Éclairage de cockpit vert", price: 250, value: "#5fbf8a" },
  { id: "engine-standard", kind: "engine", name: "Réacteurs standard", price: 0, value: "standard" },
  { id: "engine-blue", kind: "engine", name: "Traînée de réacteurs bleue", price: 350, value: "#58b8ff" },
  { id: "engine-green", kind: "engine", name: "Traînée de réacteurs verte", price: 350, value: "#58ff9a" },
];

export type ArcadeData = {
  version: 1;
  stats: Record<ArcadeGameId, GameStats>;
  credits: number;
  // One-off bonuses already paid, such as "first-win:space-battle".
  paid: string[];
  unlocked: Partial<Record<AchievementId, string>>;
  owned: string[];
  equipped: Record<CosmeticKind, string>;
  playSeconds: number;
  secrets: string[];
};

const KEY = "orbital-galactic-arcade";
const emptyStats = (): GameStats => ({ last: null, best: null, plays: 0, wins: 0, bestTime: null, recordAt: null, seconds: 0 });
const fresh = (): ArcadeData => ({
  version: 1,
  stats: Object.fromEntries(arcadeGames.map((game) => [game.id, emptyStats()])) as Record<ArcadeGameId, GameStats>,
  credits: 0,
  paid: [],
  unlocked: {},
  owned: cosmetics.filter((item) => item.price === 0).map((item) => item.id),
  equipped: { holo: "holo-cyan", theme: "theme-standard", title: "title-cadet", accent: "accent-blue", engine: "engine-standard" },
  playSeconds: 0,
  secrets: [],
});

const finite = (value: unknown, fallback: number | null) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
function sanitize(raw: unknown): ArcadeData {
  const base = fresh();
  if (!raw || typeof raw !== "object" || (raw as { version?: number }).version !== 1) return base;
  const value = raw as Partial<ArcadeData>;
  for (const game of arcadeGames) {
    const stats = (value.stats as Record<string, Partial<GameStats>> | undefined)?.[game.id];
    if (!stats) continue;
    base.stats[game.id] = {
      last: finite(stats.last, null),
      best: finite(stats.best, null),
      plays: Math.max(0, finite(stats.plays, 0)!),
      wins: Math.max(0, finite(stats.wins, 0)!),
      bestTime: finite(stats.bestTime, null),
      recordAt: typeof stats.recordAt === "string" ? stats.recordAt : null,
      seconds: Math.max(0, finite(stats.seconds, 0)!),
    };
  }
  base.credits = Math.max(0, Math.floor(finite(value.credits, 0)!));
  base.paid = Array.isArray(value.paid) ? value.paid.filter((item): item is string => typeof item === "string") : [];
  for (const item of achievements) {
    const at = value.unlocked?.[item.id];
    if (typeof at === "string") base.unlocked[item.id] = at;
  }
  const known = new Set(cosmetics.map((item) => item.id));
  base.owned = [...new Set([...base.owned, ...(Array.isArray(value.owned) ? value.owned.filter((id): id is string => typeof id === "string" && known.has(id)) : [])])];
  for (const kind of Object.keys(base.equipped) as CosmeticKind[]) {
    const id = value.equipped?.[kind];
    if (typeof id === "string" && base.owned.includes(id) && cosmetics.find((item) => item.id === id)?.kind === kind) base.equipped[kind] = id;
  }
  base.playSeconds = Math.max(0, finite(value.playSeconds, 0)!);
  base.secrets = Array.isArray(value.secrets) ? value.secrets.filter((item): item is string => typeof item === "string") : [];
  return base;
}

let state: ArcadeData = fresh(),
  loaded = false;
const listeners = new Set<() => void>();

// Defense of Hoth predates the arcade and keeps its own record; its best score carries over once.
function seedFromDefense(data: ArcadeData) {
  try {
    const defense = JSON.parse(localStorage.getItem("orbital-defense-of-hoth-v1") || "null");
    const stats = data.stats["defense-of-hoth"];
    if (defense && Number.isFinite(defense.best) && defense.best > 0 && stats.best === null) {
      stats.best = defense.best;
      if (defense.badge === true) stats.wins = Math.max(1, stats.wins);
    }
  } catch {
    // No earlier record.
  }
}
function ensure() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    state = sanitize(JSON.parse(localStorage.getItem(KEY) ?? "null"));
  } catch {
    state = fresh();
  }
  seedFromDefense(state);
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY) return;
    try {
      state = sanitize(JSON.parse(event.newValue ?? "null"));
    } catch {
      return;
    }
    listeners.forEach((listener) => listener());
  });
}
function commit(next: ArcadeData) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private browsing: the records last for this visit only.
  }
  listeners.forEach((listener) => listener());
}
export const getArcade = () => {
  ensure();
  return state;
};

export const gradeFor = (data: ArcadeData) => {
  const wonGames = arcadeGames.filter((game) => data.stats[game.id].wins > 0).length;
  const unlocked = Object.keys(data.unlocked).length;
  if (data.unlocked["galactic-legend"]) return grades[4];
  if (unlocked >= 4) return grades[3];
  if (wonGames >= 3) return grades[2];
  if (wonGames >= 1) return grades[1];
  return grades[0];
};

export type ResultSummary = {
  result: GameResult;
  credits: { label: string; amount: number }[];
  record: boolean;
  previousBest: number | null;
  achievements: (typeof achievements)[number][];
  grade: { from: Grade; to: Grade };
};

/** Records one finished run, pays its credits and unlocks the achievements it earned. */
export function recordResult(result: GameResult): ResultSummary {
  ensure();
  const game = gameById(result.gameId);
  const next: ArcadeData = structuredClone(state);
  const stats = next.stats[result.gameId];
  const fromGrade = gradeFor(state);
  const previousBest = game.scoring === "time" ? stats.bestTime : stats.best;
  stats.plays++;
  stats.last = game.scoring === "time" ? (result.time ?? null) : result.score;
  stats.seconds += result.seconds;
  next.playSeconds += result.seconds;
  if (result.won) stats.wins++;
  let record = false;
  if (game.scoring === "time") {
    if (result.won && result.time !== undefined && (stats.bestTime === null || result.time < stats.bestTime)) {
      record = stats.bestTime !== null;
      stats.bestTime = result.time;
      stats.recordAt = new Date().toISOString();
    }
    stats.best = Math.max(stats.best ?? 0, result.score);
  } else if (stats.best === null || result.score > stats.best) {
    record = stats.best !== null && result.score > 0;
    stats.best = result.score;
    stats.recordAt = new Date().toISOString();
  }
  const credits: { label: string; amount: number }[] = [];
  const once = (key: string, label: string, amount: number) => {
    if (next.paid.includes(key)) return;
    next.paid.push(key);
    credits.push({ label, amount });
  };
  if (result.won) credits.push({ label: "Mission réussie", amount: REWARDS.win });
  if (record) credits.push({ label: "Nouveau record", amount: REWARDS.record });
  if (result.won && result.perfect) once(`perfect:${result.gameId}`, "Performance parfaite", REWARDS.perfect);
  if (result.won) once(`first-win:${result.gameId}`, "Première victoire", REWARDS.firstWin);
  next.credits += credits.reduce((sum, item) => sum + item.amount, 0);
  // Achievements, each with its real condition.
  const earned: AchievementId[] = [];
  const unlock = (id: AchievementId, condition: boolean) => {
    if (condition && !next.unlocked[id]) {
      next.unlocked[id] = new Date().toISOString();
      earned.push(id);
    }
  };
  unlock("ace-pilot", result.gameId === "space-battle" && result.won && result.hullLost === false);
  unlock("asteroid-master", result.gameId === "asteroid-survival" && (result.survived ?? 0) >= 180);
  unlock("imperial-ghost", result.gameId === "imperial-hacking" && result.won && result.errors === 0);
  unlock("speed-demon", result.gameId === "speeder-racing" && result.won && result.time !== undefined && result.time < SPEED_TARGET);
  unlock("defender-of-hoth", result.gameId === "defense-of-hoth" && result.won);
  const legendGames: ArcadeGameId[] = ["space-battle", "asteroid-survival", "imperial-hacking", "speeder-racing", "defense-of-hoth"];
  unlock("galactic-legend", legendGames.every((id) => gameById(id).status === "available" && next.stats[id].wins > 0));
  commit(next);
  return { result, credits, record, previousBest, achievements: achievements.filter((item) => earned.includes(item.id)), grade: { from: fromGrade, to: gradeFor(next) } };
}

/** Buys a cosmetic with credits; returns false if unaffordable or already owned. */
export function purchase(id: string) {
  ensure();
  const item = cosmetics.find((entry) => entry.id === id);
  if (!item || state.owned.includes(id) || state.credits < item.price) return false;
  commit({ ...state, credits: state.credits - item.price, owned: [...state.owned, id], equipped: { ...state.equipped, [item.kind]: id } });
  return true;
}
export function equip(id: string) {
  ensure();
  const item = cosmetics.find((entry) => entry.id === id);
  if (!item || !state.owned.includes(id)) return;
  commit({ ...state, equipped: { ...state.equipped, [item.kind]: id } });
}
export function noteSecret(id: string) {
  ensure();
  if (state.secrets.includes(id)) return false;
  commit({ ...state, secrets: [...state.secrets, id] });
  return true;
}
export const equippedValue = (data: ArcadeData, kind: CosmeticKind) => cosmetics.find((item) => item.id === data.equipped[kind])?.value ?? "";

const subscribe = (listener: () => void) => {
  ensure();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
/** Calls back whenever the records change (in this tab or another); returns the unsubscribe. */
export const onArcadeChange = (listener: () => void) => subscribe(listener);
const blank = fresh();
export function useArcade() {
  const data = useSyncExternalStore(subscribe, getArcade, () => blank);
  return { data, grade: gradeFor(data) };
}
