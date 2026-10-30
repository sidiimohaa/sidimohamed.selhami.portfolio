export type Vec3 = [number, number, number];
export type DefensePhase = "briefing" | "transition" | "playing" | "paused" | "victory" | "defeat";
export type EnemyKind = "probe" | "scout" | "tank" | "atat";
export type WeakpointId = "left-leg" | "right-leg" | "weapons" | "command";
export type Weakpoint = { id: WeakpointId; position: Vec3; radius: number; hp: number; maxHp: number; vulnerable: boolean };
export type DefenseEnemy = {
  id: number; kind: EnemyKind; position: Vec3; radius: number;
  hp: number; maxHp: number; alive: boolean; target: "base" | "ship";
  weakpoints: Weakpoint[]; collapse: number; flash: number;
};
export type DefenseProjectile = {
  id: number; owner: "player" | "enemy"; position: Vec3; previous: Vec3;
  velocity: Vec3; damage: number; ttl: number; active: boolean;
};
export type DefenseEvent = {
  type: "shot" | "hit" | "explosion" | "wave" | "boss" | "damage" | "overheat" | "cooldown" | "special" | "victory" | "defeat" | "radio" | "step";
  position?: Vec3; text?: string; target?: "base" | "ship"; amount?: number;
};
export type DefenseState = {
  phase: DefensePhase; wave: number; time: number; phaseTime: number;
  base: number; shields: number; heat: number; overheated: boolean;
  specialReadyAt: number; coolingReadyAt: number;
  score: number; multiplier: number; shots: number; hits: number; kills: number;
  totalDamage: number; enemies: DefenseEnemy[]; projectiles: DefenseProjectile[];
  message: string; rank: "Bronze" | "Argent" | "Or" | "Légende" | null;
};
export type DefenseSimulation = {
  state: DefenseState;
  start: () => void; restart: () => void;
  pause: () => void; resume: () => void;
  fire: (origin: Vec3, direction: Vec3) => boolean;
  special: () => boolean; cool: () => boolean;
  step: (dt: number) => void;
  drainEvents: () => DefenseEvent[];
};
export type DefenseRecord = { best: number; badge: boolean; flawless: boolean; rank: string | null };
/** The HUD receives a snapshot at 10Hz; Three.js keeps the complete live state. */
export type DefenseView = Omit<DefenseState, "enemies" | "projectiles"> & {
  enemies: { id: number; kind: EnemyKind; x: number; z: number; hp: number; maxHp: number }[];
  boss: { hp: number; maxHp: number; weakpoints: { id: WeakpointId; hp: number; maxHp: number; vulnerable: boolean }[] } | null;
  record: DefenseRecord; zoom: boolean; target: string | null; aim: [number, number];
  // Cockpit effects: glare from explosions on the canopy, a jolt when the ship is hit, the start
  // alarm and the critical alert when the base or the shields are nearly gone.
  glare: number; hurt: number; alarm: boolean; critical: boolean;
};
