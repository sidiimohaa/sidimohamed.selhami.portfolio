import type { PodModuleId } from "./modules";

export type PodMode = "classic" | "arcade" | "time" | "championship" | "challenge";
export type PodDifficulty = "rookie" | "pilot" | "ace";
export type PodTrackId = "boonta" | "jawa" | "dune";
export const upgradeKeys = ["speed", "acceleration", "handling", "cooling", "armor", "repair", "boost"] as const;
export type UpgradeKey = typeof upgradeKeys[number];
export type PodUpgrades = Record<UpgradeKey, number>;

export interface PodTrackFrame {
  x: number;
  y: number;
  z: number;
  /** Heading in radians, the vehicle points along its local +Z axis. */
  heading: number;
  /** Half width in metres. */
  width: number;
  /** Signed curvature in radians per metre. */
  curve: number;
  sector: "stadium" | "mesas" | "canyon" | "tunnel" | "dunes";
}
export interface PodBranch {
  start: number;
  end: number;
  offset: number;
  width: number;
  gain: number;
}
export interface PodHazard {
  id: string;
  distance: number;
  lane: number;
  radius: number;
  swing: number;
  rate: number;
  phase: number;
  kind: "rock" | "scrap" | "sweeper";
}
/** Tusken raiders posted beside the course, who open fire as the visitor comes within range. */
export interface PodRaider {
  distance: number;
  side: -1 | 1;
}
/** A shot on its way: it lands at this spot of the course when the clock reaches impactAt. */
export interface PodShot {
  id: number;
  raider: number;
  distance: number;
  lane: number;
  radius: number;
  firedAt: number;
  impactAt: number;
}
export interface PodPad {
  start: number;
  end: number;
  lane: number;
  width: number;
}
export interface PodTrack {
  id: PodTrackId;
  name: string;
  description: string;
  light: "day" | "sunset" | "night";
  length: number;
  branches: PodBranch[];
  hazards: PodHazard[];
  pads: PodPad[];
  raiders: PodRaider[];
  sample: (distance: number) => PodTrackFrame;
}
export type PodInput = { steer: number; throttle: boolean; brake: boolean; boost: boolean; drift: boolean; repair: boolean };
export const neutralInput: PodInput = { steer: 0, throttle: false, brake: false, boost: false, drift: false, repair: false };
export interface PodVehicle {
  id: string;
  name: string;
  color: number;
  module: PodModuleId;
  distance: number;
  lane: number;
  speed: number;
  lateral: number;
  roll: number;
  heat: [number, number];
  health: [number, number];
  boost: number;
  boosting: boolean;
  repairing: boolean;
  drifting: boolean;
  driftCharge: number;
  miniTurbo: number;
  slipstream: number;
  hit: number;
  branch: number;
  finishedAt: number | null;
}
export interface GhostFrame { time: number; distance: number; lane: number }
export interface PodStanding { id: string; name: string; position: number; time: number | null }
export interface PodRaceState {
  phase: "countdown" | "racing" | "finished" | "wrecked";
  countdown: number;
  time: number;
  lap: number;
  laps: number;
  position: number;
  player: PodVehicle;
  opponents: PodVehicle[];
  standings: PodStanding[];
  crashes: number;
  miniTurbos: number;
  shortcuts: number;
  nearMisses: number;
  dodges: number;
  shots: PodShot[];
  topSpeed: number;
  alert: string;
}
export interface PodResult {
  finished: boolean;
  position: number;
  time: number;
  bestLap: number | null;
  crashes: number;
  miniTurbos: number;
  shortcuts: number;
  nearMisses: number;
  dodges: number;
  topSpeed: number;
  standings: PodStanding[];
  ghost: GhostFrame[];
}
export interface PodRaceOptions {
  track: PodTrack;
  mode: PodMode;
  difficulty: PodDifficulty;
  upgrades: PodUpgrades;
  laps: number;
  seed?: number;
  // The visitor's racing module and paint, and whether Tusken raiders fire on this race.
  pod?: { module: PodModuleId; color: number };
  raiders?: boolean;
}
export type PodRaceEvent = "countdown" | "go" | "hit" | "boost" | "mini" | "lap" | "finish" | "overheat" | "pad" | "overtake" | "near" | "shot" | "dodge";
export interface PodSimulation {
  state: PodRaceState;
  step(dt: number, input: PodInput): void;
  drainEvents(): PodRaceEvent[];
  result(): PodResult;
}
export interface PodStageOptions extends PodRaceOptions {
  reduced: boolean;
  sound: boolean;
  ghost?: GhostFrame[];
}
export interface PodStage {
  setInput(input: PodInput): void;
  setPaused(paused: boolean): void;
  setCamera(mode: "chase" | "cockpit"): void;
  setQuality(quality: "auto" | "low" | "high"): void;
  setSound(sound: boolean): void;
  dispose(): void;
}
