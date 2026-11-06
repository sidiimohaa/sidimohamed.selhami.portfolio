import { useSyncExternalStore } from "react";

// The visitor's Jedi progression: ten secret missions across the galaxy, each worth 100 XP, kept
// in this browser. XP, rank and completion are always derived from the missions found, and
// unlockSecret() is the one way to complete a mission, so nothing is ever rewarded twice.

export type MissionId =
  | "sith-mode"
  | "hyperspace"
  | "lost-droid"
  | "forgotten-archives"
  | "jedi-weapon"
  | "forbidden-holocron"
  | "star-map"
  | "order-66"
  | "kyber-crystal"
  | "last-message";

export type Mission = {
  id: MissionId;
  number: string;
  title: string;
  icon: "saber" | "stars" | "droid" | "archive" | "holocron" | "map" | "empire" | "crystal" | "hologram" | "dark";
  // Shown once the mission is completed.
  description: string;
  // Shown under the classified folder: a riddle that never says exactly where to look.
  whisper: string;
  holocron: { name: string; lore: string };
};

export const XP_PER_MISSION = 100;
// Full-screen progression screens that handle their own Escape key before anything else.
export const OVERLAYS = ".rank-cinematic, .holo-transmission, .reward-scene, .hoth-defense, .arcade-game, .death-star-station, .coruscant-taxi";

export const missions: Mission[] = [
  {
    id: "sith-mode",
    number: "01",
    title: "L’appel de la Force",
    icon: "dark",
    description: "Vous avez basculé le cockpit du côté obscur. Le rouge vous va bien, peut-être trop.",
    whisper: "Sous un capot qu’on ne doit pas soulever, le côté obscur attend. Tentant il est, hmm.",
    holocron: { name: "Holocron de la tentation", lore: "La colère, la peur, l’agression : rapide et séduisant est le côté obscur, mais plus fort il n’est pas." },
  },
  {
    id: "hyperspace",
    number: "02",
    title: "Au-delà des étoiles",
    icon: "stars",
    description: "Poussée maintenue jusqu’au bout : les étoiles se sont étirées et le vaisseau a franchi le mur de la lumière.",
    whisper: "Accélérer un instant, tout pilote sait. Longtemps tenir la poussée, seul un audacieux ose.",
    holocron: { name: "Holocron du navigateur", lore: "Sans calcul de trajectoire, l’hyperespace traverse étoiles et planètes. Les meilleurs pilotes le sentent plus qu’ils ne le calculent." },
  },
  {
    id: "lost-droid",
    number: "03",
    title: "Le droïde perdu",
    icon: "droid",
    description: "À l’entrée du hangar de la base Écho, R2-D2 guettait la tempête en attendant Luke. Il vous a répondu d’un sifflement.",
    whisper: "Dans le froid, un petit ami attend son maître. Le saluer, tu devrais.",
    holocron: { name: "Holocron de la fidélité", lore: "Un astromécano n’oublie jamais son pilote. Celui-ci a traversé deux guerres sans un seul effacement de mémoire." },
  },
  {
    id: "forgotten-archives",
    number: "04",
    title: "Les archives oubliées",
    icon: "archive",
    description: "Une console oubliée de Coruscant a livré un dossier sur le parcours du pilote de ce portfolio.",
    whisper: "Dans la cité sans nuit, une console que personne ne consulte plus dort. Les archives, complètes elles ne sont jamais.",
    holocron: { name: "Holocron de la mémoire", lore: "Si un élément manque aux archives, c’est qu’il n’existe pas, disait-on. Le Temple s’est trompé plus d’une fois." },
  },
  {
    id: "jedi-weapon",
    number: "05",
    title: "L’arme d’un Jedi",
    icon: "saber",
    description: "Dans la grotte du wampa, vous avez attiré le sabre de Luke à vous et allumé sa lame bleue.",
    whisper: "Là où le froid mord le plus, une lame dans la neige est restée. Tends la main, et vers toi elle viendra.",
    holocron: { name: "Holocron de la lame", lore: "Un sabre laser n’est rien sans son cristal, et un cristal ne chante que pour celui qui l’a choisi." },
  },
  {
    id: "forbidden-holocron",
    number: "06",
    title: "Le savoir interdit",
    icon: "holocron",
    description: "Caché sous les racines d’Endor, un holocron ancien s’est ouvert entre vos mains.",
    whisper: "Sous les racines des géants, un savoir ancien sommeille. Le trouver ne suffit pas : l’ouvrir, tu dois.",
    holocron: { name: "Holocron des anciens", lore: "Les holocrons ne s’ouvrent qu’au contact de la Force. Celui-ci attendait depuis des siècles." },
  },
  {
    id: "star-map",
    number: "07",
    title: "Cartographe galactique",
    icon: "map",
    description: "Vous avez déployé la carte stellaire holographique du vaisseau.",
    whisper: "Sans carte, perdu même le meilleur pilote est. Au cockpit, les étoiles projetées sont.",
    holocron: { name: "Holocron du cartographe", lore: "Chaque route hyperspatiale a été tracée un jour par un éclaireur qui n’était pas sûr de revenir." },
  },
  {
    id: "order-66",
    number: "08",
    title: "Ordre 66",
    icon: "empire",
    description: "Le code secret a déclenché une transmission impériale. L’Empire écoute toujours.",
    whisper: "Deux chiffres, identiques, l’Empereur prononça. Au clavier, les répéter tu pourrais.",
    holocron: { name: "Holocron de la trahison", lore: "Un seul ordre a suffi à changer la galaxie. Méfie-toi des ordres que l’on n’explique pas." },
  },
  {
    id: "kyber-crystal",
    number: "09",
    title: "Le cristal Kyber",
    icon: "crystal",
    description: "Un cristal kyber brillait dans les rochers de Tatooine. Il chante désormais pour vous.",
    whisper: "Sous deux soleils, entre les pierres, une lueur bleue chante. Seuls ceux qui regardent bas la voient.",
    holocron: { name: "Holocron du cristal", lore: "Les cristaux kyber sont vivants, dit-on. Ils appellent celui qu’ils ont choisi." },
  },
  {
    id: "last-message",
    number: "10",
    title: "Le dernier message",
    icon: "hologram",
    description: "Au sommet du village ewok, la transmission des fantômes de la Force s’est allumée : Anakin, Yoda et Obi-Wan veillent.",
    whisper: "Tout en haut, là où la fête monte, d’anciens maîtres un message lumineux gardent.",
    holocron: { name: "Holocron de l’éternité", lore: "Ceux qui ne font qu’un avec la Force ne disparaissent jamais vraiment." },
  },
];

export type RankId = "initiate" | "padawan" | "knight" | "master" | "chosen";
export type Rank = { id: RankId; title: string; min: number; color: string };

export const ranks: Rank[] = [
  { id: "initiate", title: "Initié", min: 0, color: "#8b97a8" },
  { id: "padawan", title: "Padawan", min: 1, color: "#78c6ff" },
  { id: "knight", title: "Chevalier Jedi", min: 4, color: "#4aaaf4" },
  { id: "master", title: "Maître Jedi", min: 7, color: "#dab45e" },
  { id: "chosen", title: "L’Élu", min: 10, color: "#f0f6ff" },
];

export const rankFor = (found: number) => [...ranks].reverse().find((rank) => found >= rank.min) ?? ranks[0];

export type Reward = { id: string; rank: RankId; title: string; description: string };

export const rewards: Reward[] = [
  { id: "anecdote", rank: "padawan", title: "L’anecdote du pilote", description: "Comment le pilote est passé du magasin au cockpit." },
  { id: "skills", rank: "knight", title: "Le terminal des compétences", description: "Un terminal holographique : compétences techniques, expériences et réalisations." },
  { id: "temple", rank: "master", title: "La salle du temple", description: "Une salle secrète du Temple Jedi, ses archives et ses reliques." },
  { id: "destiny", rank: "chosen", title: "Accéder à la destinée", description: "Une dernière rencontre, et un choix entre deux chemins." },
];

export type Path = "jedi" | "sith";
export type Progress = {
  // Missions in the order they were completed.
  found: MissionId[];
  // Completed missions the visitor has not looked at in the cockpit yet.
  unseen: MissionId[];
  // Missions revealed but not yet completed (an holocron found but still closed, say).
  started: MissionId[];
  // The highest rank whose ceremony has played, so a reload never replays it.
  celebrated: RankId;
  path: Path | null;
  sith: boolean;
};

const KEY = "orbital-jedi-progress";
const known = new Set<string>(missions.map((mission) => mission.id));
const blank: Progress = { found: [], unseen: [], started: [], celebrated: "initiate", path: null, sith: false };

// Anything unexpected in storage (an old version, a hand edit) falls back to a clean slate.
function sanitize(raw: unknown): Progress {
  if (!raw || typeof raw !== "object") return blank;
  const value = raw as Record<string, unknown>;
  const ids = (list: unknown) =>
    Array.isArray(list) ? [...new Set(list.filter((id): id is MissionId => typeof id === "string" && known.has(id)))] : [];
  const found = ids(value.found);
  return {
    found,
    unseen: ids(value.unseen).filter((id) => found.includes(id)),
    started: ids(value.started).filter((id) => !found.includes(id)),
    celebrated: ranks.some((rank) => rank.id === value.celebrated) ? (value.celebrated as RankId) : rankFor(found.length).id,
    path: value.path === "jedi" || value.path === "sith" ? value.path : null,
    sith: value.sith === true,
  };
}

function read(): Progress {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) ?? "null"));
  } catch {
    return blank;
  }
}

let state: Progress = blank,
  loaded = false;
const listeners = new Set<() => void>();

export type ProgressEvent = { type: "unlock"; mission: Mission; total: number } | { type: "rank"; from: Rank; to: Rank };
const watchers = new Set<(event: ProgressEvent) => void>();

function ensure() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  state = read();
  // Another tab of the portfolio shares the same adventure.
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY) return;
    state = read();
    listeners.forEach((listener) => listener());
  });
}

function commit(next: Progress) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private windows and blocked storage keep the progress for this visit only.
  }
  listeners.forEach((listener) => listener());
}

export function getProgress() {
  ensure();
  return state;
}

/** The single public way to complete a mission. Returns false if unknown or already done. */
export function unlockSecret(id: MissionId) {
  ensure();
  const mission = missions.find((item) => item.id === id);
  if (!mission || state.found.includes(id)) return false;
  const before = rankFor(state.found.length),
    found = [...state.found, id],
    after = rankFor(found.length);
  commit({ ...state, found, unseen: [...state.unseen, id], started: state.started.filter((item) => item !== id) });
  watchers.forEach((watch) => watch({ type: "unlock", mission, total: found.length }));
  if (after.id !== before.id) watchers.forEach((watch) => watch({ type: "rank", from: before, to: after }));
  return true;
}

/** Marks a mission as under way without completing it. */
export function startMission(id: MissionId) {
  ensure();
  if (!known.has(id) || state.found.includes(id) || state.started.includes(id)) return;
  commit({ ...state, started: [...state.started, id] });
}

export const markMissionsSeen = () => {
  ensure();
  if (state.unseen.length) commit({ ...state, unseen: [] });
};
export const markRankCelebrated = (rank: RankId) => {
  ensure();
  if (state.celebrated !== rank) commit({ ...state, celebrated: rank });
};
export const choosePath = (path: Path) => {
  ensure();
  commit({ ...state, path });
};
export const setSithMode = (sith: boolean) => {
  ensure();
  if (state.sith !== sith) commit({ ...state, sith });
};
export const resetAdventure = () => {
  ensure();
  commit(blank);
};

export function onProgress(watch: (event: ProgressEvent) => void) {
  watchers.add(watch);
  return () => {
    watchers.delete(watch);
  };
}

const subscribe = (listener: () => void) => {
  ensure();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export type MissionStatus = "secret" | "started" | "done";

/** Everything the cockpit terminal, the widget and the notifications read, from one source. */
export function useJediProgression() {
  const progress = useSyncExternalStore(subscribe, getProgress, () => blank);
  const count = progress.found.length,
    rank = rankFor(count),
    next = ranks.find((item) => item.min > count) ?? null;
  return {
    progress,
    count,
    total: missions.length,
    xp: count * XP_PER_MISSION,
    maxXp: missions.length * XP_PER_MISSION,
    percent: Math.round((count / missions.length) * 100),
    rank,
    next,
    remainingToNext: next ? next.min - count : 0,
    status: (id: MissionId): MissionStatus => (progress.found.includes(id) ? "done" : progress.started.includes(id) ? "started" : "secret"),
    unlocked: (reward: Reward) => count >= (ranks.find((item) => item.id === reward.rank)?.min ?? Infinity),
    unlockSecret,
  };
}
