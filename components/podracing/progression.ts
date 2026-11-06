import { podModules, podModuleIds, podPaints, podPaintIds, type PodModuleId, type PodPaintId } from "./modules";
import { tracks } from "./tracks";
import { upgradeKeys, type GhostFrame, type PodResult, type PodStanding, type PodTrackId, type PodUpgrades, type UpgradeKey } from "./types";

export const podTrackIds: PodTrackId[] = ["boonta", "jawa", "dune"];
export const podiumPoints = [10, 7, 5, 3, 2, 1];
export const maxUpgrade = 4;
const storageKey = "orbital-podracing-v1";

export type PodRecord = { time: number; ghost: GhostFrame[] };
export type ChallengeId = "clean" | "drift" | "route" | "tusken";
type Challenge = { id: ChallengeId; name: string; goal: string; credits: number; passed: (result: PodResult) => boolean };
export const challenges: Challenge[] = [
  { id: "clean", name: "Trajectoire intacte", goal: "Terminez un tour sans collision.", credits: 180, passed: (result) => result.finished && result.crashes === 0 },
  { id: "drift", name: "Sortie de virage", goal: "Terminez un tour avec au moins deux mini-turbos.", credits: 220, passed: (result) => result.finished && result.miniTurbos >= 2 },
  { id: "tusken", name: "Terres Tusken", goal: "Évitez trois tirs Tusken et terminez le tour.", credits: 260, passed: (result) => result.finished && (result.dodges ?? 0) >= 3 },
  { id: "route", name: "Passage clandestin", goal: "Empruntez une bifurcation et terminez le tour.", credits: 230, passed: (result) => result.finished && result.shortcuts >= 1 },
];

// Medals are earned on the best lap of any race: 1 bronze, 2 silver, 3 gold. Each threshold is an
// average speed over the lap, so longer circuits simply take longer. The same speeds set the times
// of the pilots on the Mos Espa board.
export type MedalLevel = 0 | 1 | 2 | 3;
const medalSpeed = [95, 112, 130];
const medalBonus = [0, 100, 200, 350];
export const medalNames = ["", "Bronze", "Argent", "Or"];
export const medalTime = (track: PodTrackId, level: 1 | 2 | 3) => tracks[track].length / medalSpeed[level - 1];
export const medalFor = (track: PodTrackId, time: number): MedalLevel =>
  time <= medalTime(track, 3) ? 3 : time <= medalTime(track, 2) ? 2 : time <= medalTime(track, 1) ? 1 : 0;

export type BoardEntry = { time: number; module: PodModuleId; date: string };
export type BoardRow = { name: string; time: number; module: PodModuleId; date?: string; player: boolean };
const boardSize = 5;
const boardPilots: { name: string; module: PodModuleId; speed: number }[] = [
  { name: "Sebulba", module: "mammoth", speed: 130 },
  { name: "Aldar Beedo", module: "manta", speed: 124 },
  { name: "Gasgano", module: "pedrovia", speed: 118 },
  { name: "Teemto Pagalies", module: "longtail", speed: 112 },
  { name: "Mawhonic", module: "gpe", speed: 105 },
  { name: "Ben Quadinaros", module: "quadra", speed: 95 },
];
/** The visitor's best laps among the pilots of the grid, fastest first. */
export function boardFor(profile: PodProfile, track: PodTrackId): BoardRow[] {
  const pilots = boardPilots.map((pilot): BoardRow => ({ name: pilot.name, module: pilot.module, time: tracks[track].length / pilot.speed, player: false }));
  const own = (profile.board[track] ?? []).map((entry): BoardRow => ({ ...entry, name: "Toi", player: true }));
  return [...pilots, ...own].sort((a, b) => a.time - b.time);
}

export interface PodProfile {
  version: 1;
  credits: number;
  upgrades: PodUpgrades;
  records: Partial<Record<PodTrackId, PodRecord>>;
  challenges: ChallengeId[];
  starts: number;
  wins: number;
  championships: number;
  // The fitted module and paint, what has been bought, and the medals and best laps per circuit.
  pod: { module: PodModuleId; paint: PodPaintId };
  owned: { modules: PodModuleId[]; paints: PodPaintId[] };
  medals: Partial<Record<PodTrackId, MedalLevel>>;
  board: Partial<Record<PodTrackId, BoardEntry[]>>;
}

const emptyUpgrades: PodUpgrades = { speed: 0, acceleration: 0, handling: 0, cooling: 0, armor: 0, repair: 0, boost: 0 };
export const emptyProfile = (): PodProfile => ({
  version: 1, credits: 0, upgrades: { ...emptyUpgrades }, records: {}, challenges: [], starts: 0, wins: 0, championships: 0,
  pod: { module: "ulzer", paint: "azure" }, owned: { modules: ["ulzer"], paints: ["azure"] }, medals: {}, board: {},
});

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const count = (value: unknown, max = 1_000_000) => typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : 0;
const boundedNumber = (value: unknown, min: number, max: number): value is number => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

function cleanGhost(data: unknown, time: number): GhostFrame[] {
  if (!Array.isArray(data)) return [];
  const frames: GhostFrame[] = [];
  let lastTime = -1;
  for (const candidate of data.slice(0, 2600)) {
    const frame = object(candidate);
    if (!boundedNumber(frame.time, 0, time + 0.1) || frame.time <= lastTime ||
        !boundedNumber(frame.distance, -100, 100_000) || !boundedNumber(frame.lane, -400, 400)) continue;
    frames.push({ time: frame.time, distance: frame.distance, lane: frame.lane });
    lastTime = frame.time;
  }
  return frames.length >= 2 ? frames : [];
}

export function loadProfile(): PodProfile {
  if (typeof window === "undefined") return emptyProfile();
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw || raw.length > 1_200_000) return emptyProfile();
    const data = object(JSON.parse(raw));
    if (data.version !== 1) return emptyProfile();
    const profile = emptyProfile();
    profile.credits = count(data.credits);
    profile.starts = count(data.starts);
    profile.wins = Math.min(profile.starts, count(data.wins));
    profile.championships = count(data.championships);
    const levels = object(data.upgrades);
    for (const key of upgradeKeys) profile.upgrades[key] = count(levels[key], maxUpgrade);
    const records = object(data.records);
    for (const id of podTrackIds) {
      const record = object(records[id]);
      if (boundedNumber(record.time, 1, 2400)) profile.records[id] = { time: record.time, ghost: cleanGhost(record.ghost, record.time) };
    }
    if (Array.isArray(data.challenges)) {
      const completed = data.challenges;
      profile.challenges = challenges.filter((challenge) => completed.includes(challenge.id)).map((challenge) => challenge.id);
    }
    const owned = object(data.owned);
    const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
    const ownedModules = list(owned.modules), ownedPaints = list(owned.paints);
    profile.owned.modules = podModuleIds.filter((id) => id === "ulzer" || ownedModules.includes(id));
    profile.owned.paints = podPaintIds.filter((id) => id === "azure" || ownedPaints.includes(id));
    const pod = object(data.pod);
    if (profile.owned.modules.includes(pod.module as PodModuleId)) profile.pod.module = pod.module as PodModuleId;
    if (profile.owned.paints.includes(pod.paint as PodPaintId)) profile.pod.paint = pod.paint as PodPaintId;
    const medals = object(data.medals), board = object(data.board);
    for (const id of podTrackIds) {
      const medal = count(medals[id], 3) as MedalLevel;
      if (medal) profile.medals[id] = medal;
      const rows = list(board[id]).map(object).filter((row) => boundedNumber(row.time, 1, 2400) && podModuleIds.includes(row.module as PodModuleId) && typeof row.date === "string");
      if (rows.length) profile.board[id] = rows.slice(0, boardSize).map((row) => ({ time: row.time as number, module: row.module as PodModuleId, date: (row.date as string).slice(0, 10) }));
    }
    return profile;
  } catch {
    return emptyProfile();
  }
}

export function saveProfile(profile: PodProfile): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(profile));
  } catch {
    // The active session still works when persistent storage is unavailable.
  }
}

export const upgrades: Record<UpgradeKey, { name: string; description: string; base: number; value: (level: number) => string }> = {
  speed: { name: "Transmission", description: "Vitesse maximale hors boost", base: 190, value: (level) => `${Math.round((93 + level * 5.4) * 3.6)} km/h` },
  acceleration: { name: "Injecteurs", description: "Montée en régime plus rapide", base: 150, value: (level) => `${(27 + level * 4.2).toFixed(1)} m/s²` },
  handling: { name: "Stabilisateurs", description: "Réactivité et déplacement latéral", base: 175, value: (level) => `${(16.3 + level * 0.8).toFixed(1)} m/s` },
  cooling: { name: "Radiateurs", description: "Refroidissement et meilleure tolérance au boost", base: 180, value: (level) => `${100 + level * 18} %` },
  armor: { name: "Blindage", description: "Dégâts de choc absorbés", base: 155, value: (level) => `${Math.round(100 - 100 / (1 + level * 0.21))} %` },
  repair: { name: "Unité de réparation", description: "Intégrité récupérée par seconde", base: 130, value: (level) => `${(12.4 + level * 2.6).toFixed(1)} %/s` },
  boost: { name: "Condensateurs", description: "Gain de vitesse et réserve de boost", base: 220, value: (level) => `+${Math.round((52 + level * 5.8) * 3.6)} km/h` },
};

export const upgradeCost = (key: UpgradeKey, level: number) => Math.round(upgrades[key].base * (1 + level * 0.68) / 5) * 5;

export function buyUpgrade(profile: PodProfile, key: UpgradeKey): PodProfile {
  const level = profile.upgrades[key];
  const cost = upgradeCost(key, level);
  if (level >= maxUpgrade || profile.credits < cost) return profile;
  return { ...profile, credits: profile.credits - cost, upgrades: { ...profile.upgrades, [key]: level + 1 } };
}

export function buyModule(profile: PodProfile, id: PodModuleId): PodProfile {
  const cost = podModules[id].cost;
  if (profile.owned.modules.includes(id) || profile.credits < cost) return profile;
  return { ...profile, credits: profile.credits - cost, owned: { ...profile.owned, modules: [...profile.owned.modules, id] }, pod: { ...profile.pod, module: id } };
}
export function buyPaint(profile: PodProfile, id: PodPaintId): PodProfile {
  const cost = podPaints[id].cost;
  if (profile.owned.paints.includes(id) || profile.credits < cost) return profile;
  return { ...profile, credits: profile.credits - cost, owned: { ...profile.owned, paints: [...profile.owned.paints, id] }, pod: { ...profile.pod, paint: id } };
}
export const fitModule = (profile: PodProfile, id: PodModuleId): PodProfile =>
  profile.owned.modules.includes(id) ? { ...profile, pod: { ...profile.pod, module: id } } : profile;
export const fitPaint = (profile: PodProfile, id: PodPaintId): PodProfile =>
  profile.owned.paints.includes(id) ? { ...profile, pod: { ...profile.pod, paint: id } } : profile;

// medal is what this lap earned; improved says it beat the circuit's previous medal.
export type RaceAward = { credits: number; record: boolean; challenge: boolean; medal: MedalLevel; improved: boolean; rank: number | null };
export function registerRace(
  profile: PodProfile,
  result: PodResult,
  options: { track: PodTrackId; trial: boolean; challenge?: ChallengeId; championshipPlace?: number },
): { profile: PodProfile; award: RaceAward } {
  const contract = challenges.find((item) => item.id === options.challenge);
  const challenge = !!contract?.passed(result) && !profile.challenges.includes(contract.id);
  const previous = profile.records[options.track];
  const record = options.trial && result.finished && boundedNumber(result.time, 1, 2400) && (!previous || result.time < previous.time);
  const racedAgainstOthers = result.standings.length > 1;
  const podiumBonus = racedAgainstOthers ? [110, 65, 35][result.position - 1] ?? 0 : 0;
  const earned = result.finished ? 75 + podiumBonus + (result.crashes === 0 ? 45 : 0) + Math.min(40, result.miniTurbos * 8 + result.shortcuts * 12) : 0;
  const cupBonus = options.championshipPlace === 1 ? 300 : options.championshipPlace === 2 ? 160 : options.championshipPlace === 3 ? 90 : 0;
  const lap = result.finished && boundedNumber(result.bestLap, 1, 2400) ? result.bestLap : null;
  const medal = lap === null ? 0 : medalFor(options.track, lap);
  const previousMedal = profile.medals[options.track] ?? 0;
  const improved = medal > previousMedal;
  const medalCredits = improved ? medalBonus[medal] - medalBonus[previousMedal] : 0;
  const credits = earned + cupBonus + (challenge ? contract!.credits : 0) + medalCredits;
  const entry: BoardEntry | null = lap === null ? null : { time: lap, module: profile.pod.module, date: new Date().toISOString().slice(0, 10) };
  const rows = entry ? [...(profile.board[options.track] ?? []), entry].sort((a, b) => a.time - b.time).slice(0, boardSize) : profile.board[options.track];
  const ranked: PodProfile = { ...profile, board: rows ? { ...profile.board, [options.track]: rows } : profile.board };
  const rank = entry && rows?.includes(entry) ? boardFor(ranked, options.track).findIndex((row) => row.player && row.time === entry.time) + 1 : null;
  return {
    profile: {
      ...ranked, medals: improved ? { ...profile.medals, [options.track]: medal } : profile.medals, credits: Math.min(1_000_000, profile.credits + credits),
      starts: profile.starts + 1, wins: profile.wins + Number(result.finished && racedAgainstOthers && result.position === 1),
      championships: profile.championships + Number(options.championshipPlace === 1),
      challenges: challenge ? [...profile.challenges, contract!.id] : profile.challenges,
      records: record ? { ...profile.records, [options.track]: { time: result.time, ghost: cleanGhost(result.ghost, result.time) } } : profile.records,
    },
    award: { credits, record, challenge, medal, improved, rank },
  };
}

export type CupEntry = { id: string; name: string; points: number; wins: number; last: number };
export function scoreRound(previous: CupEntry[], standings: PodStanding[], finished: boolean): CupEntry[] {
  const results = new Map(previous.map((entry) => [entry.id, { ...entry }]));
  for (const standing of standings) {
    const total = results.get(standing.id) ?? { id: standing.id, name: standing.name, points: 0, wins: 0, last: 99 };
    const place = standing.id === "player" && !finished ? 99 : standing.position;
    total.points += podiumPoints[place - 1] ?? 0;
    total.wins += Number(place === 1);
    total.last = place;
    results.set(total.id, total);
  }
  return [...results.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.last - b.last);
}

export const clockLabel = (seconds: number) => {
  const centis = Math.max(0, Math.floor(seconds * 100 + 1e-6));
  const min = Math.floor(centis / 6000).toString().padStart(2, "0");
  const sec = (Math.floor(centis / 100) % 60).toString().padStart(2, "0");
  return `${min}:${sec}.${(centis % 100).toString().padStart(2, "0")}`;
};
