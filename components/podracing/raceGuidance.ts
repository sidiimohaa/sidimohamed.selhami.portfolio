import type { PodRaceState, PodStanding, PodTrack, PodTrackFrame } from "./types";

export interface CourseGuidance {
  direction: "left" | "right" | "straight";
  turnLabel: string;
  distance: number;
  sharp: boolean;
  sectorLabel: string;
  progress: number;
}

export type NearbyStanding = PodStanding & { gapLabel: string };

const sectorNames: Record<PodTrackFrame["sector"], string> = {
  stadium: "TRIBUNES", mesas: "MESAS", canyon: "CANYON", tunnel: "TUNNEL", dunes: "DUNES",
};
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

/** Read the next bend along the same centreline used by the simulation and the minimap. */
export function courseGuidance(track: PodTrack, state: PodRaceState): CourseGuidance {
  const player = state.player;
  const current = track.sample(player.distance);
  const horizon = clamp(player.speed * 1.65, 30, 220);
  let distance = horizon;
  let sign = 0;
  let peak = 0;
  for (let ahead = 0; ahead <= horizon; ahead += 5) {
    const curve = track.sample(player.distance + ahead).curve;
    if (Math.abs(curve) < .0035) {
      if (sign) break;
      continue;
    }
    if (!sign) {
      distance = ahead;
      sign = Math.sign(curve);
    } else if (Math.sign(curve) !== sign) break;
    peak = Math.max(peak, Math.abs(curve));
  }
  // Pods face +Z: increasing heading bends towards screen left in either racing camera.
  const direction = sign > 0 ? "left" : sign < 0 ? "right" : "straight";
  const finished = state.phase === "finished" || player.finishedAt !== null;
  const progress = finished ? 1 : player.distance <= 0 ? 0 : (player.distance % track.length) / track.length;
  return {
    direction,
    turnLabel: direction === "left" ? "VIRAGE À GAUCHE" : direction === "right" ? "VIRAGE À DROITE" : "LIGNE DROITE",
    distance: Math.round(distance),
    sharp: peak >= .012,
    sectorLabel: sectorNames[current.sector],
    progress,
  };
}

/** Keep the leader and the player's closest ranked rivals visible, even at the back of the grid. */
export function nearbyStandings(state: PodRaceState): NearbyStanding[] {
  const ordered = [...state.standings].sort((a, b) => a.position - b.position);
  const playerIndex = ordered.findIndex((entry) => entry.id === state.player.id);
  let selected = ordered;
  if (ordered.length > 4) {
    const start = clamp(playerIndex - 1, 1, ordered.length - 3);
    selected = [ordered[0], ...ordered.slice(start, start + 3)];
  }
  const vehicles = new Map(state.opponents.map((vehicle) => [vehicle.id, vehicle]));
  return selected.map((entry) => {
    if (entry.id === state.player.id) return { ...entry, gapLabel: "VOUS" };
    const vehicle = vehicles.get(entry.id);
    if (entry.time !== null || vehicle?.finishedAt != null) return { ...entry, gapLabel: "ARRIVÉ" };
    if (!vehicle) return { ...entry, gapLabel: "—" };
    const gap = Math.round(vehicle.distance - state.player.distance);
    return { ...entry, gapLabel: `${gap > 0 ? "+" : gap < 0 ? "−" : ""}${Math.abs(gap)} M` };
  });
}
