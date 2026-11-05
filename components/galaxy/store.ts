import { useSyncExternalStore } from "react";
import { startMission } from "../jediProgression";
import { landings } from "../universe";
import { createDirector, emptyRecord, type ActivityRecord } from "./director";
import { livingOn } from "./flags";
import type { EventPlace, GalacticEvent } from "./catalog";

// The one director of the visit, its saved record, and what the interface shares with it.

const KEY = "orbital-galactic-activity-v1";

function loadRecord(): ActivityRecord {
  if (typeof window === "undefined") return emptyRecord();
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    if (raw?.version !== 1) return emptyRecord();
    const list = (value: unknown) => (Array.isArray(value) ? value : []);
    return {
      version: 1,
      seen: Number.isFinite(raw.seen) ? Math.max(0, Math.floor(raw.seen)) : 0,
      log: list(raw.log).filter((row) => typeof row?.id === "string" && typeof row?.status === "string" && Number.isFinite(row?.at)).slice(0, 30),
      discoveries: list(raw.discoveries).filter((row) => typeof row?.id === "string" && typeof row?.title === "string" && typeof row?.body === "string"),
    };
  } catch {
    return emptyRecord();
  }
}

let director: ReturnType<typeof createDirector> | null = null;
let version = 0;
const listeners = new Set<() => void>();
const bump = () => {
  version++;
  listeners.forEach((listener) => listener());
};

export function galaxy() {
  if (director) return director;
  director = createDirector({
    record: loadRecord(),
    onRecord: (record) => {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(record));
      } catch {
        // The record lasts for this visit.
      }
    },
    // A discovery can point at a secret mission: it joins the existing journal, nothing more.
    onDiscovery: (event: GalacticEvent) => {
      if (event.discovery?.mission) startMission(event.discovery.mission);
    },
  });
  director.subscribe(bump);
  return director;
}

export const enabledPlace = (place: EventPlace) =>
  livingOn("events") && (place === "space" ? livingOn("spaceEvents") : place === "coruscant" ? true : livingOn("worldEvents"));

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
/** Re-renders whenever an event starts, ends or is answered. */
export const useGalaxy = () => {
  useSyncExternalStore(subscribe, () => version, () => 0);
  return galaxy();
};

// Scenes that are playing something the director must not talk over (a landing, a docking).
const busy = new Set<string>();
export const setGalaxyBusy = (who: string, on: boolean) => {
  if (on) busy.add(who);
  else busy.delete(who);
};
export const galaxyBusy = () => busy.size > 0;

// The monitor is opened from the header and from the cockpit.
let monitorOpen = false;
const monitorListeners = new Set<() => void>();
export const setMonitorOpen = (open: boolean) => {
  monitorOpen = open;
  monitorListeners.forEach((listener) => listener());
};
export const useMonitorOpen = () =>
  useSyncExternalStore((listener) => {
    monitorListeners.add(listener);
    return () => monitorListeners.delete(listener);
  }, () => monitorOpen, () => false);

/** The project a discovery leads to: real entries of the portfolio, the same for one event. */
export function projectFor(id: string) {
  const projects = landings.Tatooine?.terminals ?? [];
  if (!projects.length) return null;
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return projects[hash % projects.length];
}
