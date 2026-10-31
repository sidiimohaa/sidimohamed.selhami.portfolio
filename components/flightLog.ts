import { useSyncExternalStore } from "react";

// The pilot's flight log: which worlds were reached in orbit, where the ship set down, whether it
// docked with the Death Star, and how long the visitor has flown. Kept in this browser only.

export type FlightLog = {
  version: 1;
  orbits: string[];
  landings: string[];
  docked: boolean;
  seconds: number;
  since: string | null;
  visits: number;
};

const KEY = "orbital-flight-log-v1";
const fresh = (): FlightLog => ({ version: 1, orbits: [], landings: [], docked: false, seconds: 0, since: null, visits: 0 });
const names = (value: unknown) => (Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string"))] : []);

let state: FlightLog = fresh(),
  loaded = false;
const listeners = new Set<() => void>();

function ensure() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (raw && raw.version === 1)
      state = {
        version: 1,
        orbits: names(raw.orbits),
        landings: names(raw.landings),
        docked: raw.docked === true,
        seconds: Number.isFinite(raw.seconds) ? Math.max(0, raw.seconds) : 0,
        since: typeof raw.since === "string" ? raw.since : null,
        visits: Number.isFinite(raw.visits) ? Math.max(0, Math.floor(raw.visits)) : 0,
      };
  } catch {
    state = fresh();
  }
  // One visit per browser session.
  try {
    if (!sessionStorage.getItem(KEY)) {
      sessionStorage.setItem(KEY, "1");
      commit({ ...state, visits: state.visits + 1, since: state.since ?? new Date().toISOString() });
    }
  } catch {
    // Storage unavailable: the log lasts for this visit.
  }
}
function commit(next: FlightLog) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private browsing.
  }
  listeners.forEach((listener) => listener());
}

export const getFlightLog = () => {
  ensure();
  return state;
};
export function logOrbit(name: string) {
  ensure();
  if (!state.orbits.includes(name)) commit({ ...state, orbits: [...state.orbits, name] });
}
export function logLanding(name: string) {
  ensure();
  if (!state.landings.includes(name)) commit({ ...state, landings: [...state.landings, name], orbits: state.orbits.includes(name) ? state.orbits : [...state.orbits, name] });
}
export function logDocking() {
  ensure();
  if (!state.docked) commit({ ...state, docked: true });
}
export function addFlightTime(seconds: number) {
  ensure();
  commit({ ...state, seconds: state.seconds + seconds });
}

const subscribe = (listener: () => void) => {
  ensure();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const blank = fresh();
export const useFlightLog = () => useSyncExternalStore(subscribe, getFlightLog, () => blank);
