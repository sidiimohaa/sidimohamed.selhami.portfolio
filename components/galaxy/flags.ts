// Switches for the living-universe systems, each independent of the others. Everything is on by
// default; a visitor can turn the events off in the settings, and ?living=off or
// ?living=-cityTraffic,-events turns systems off for one visit (to compare or to diagnose).

export const livingFlags = ["cityCycle", "cityTraffic", "cityHolograms", "cityNeon", "events", "spaceEvents", "worldEvents", "hothFauna", "hothOutpost", "droid"] as const;
export type LivingFlag = (typeof livingFlags)[number];

const KEY = "orbital-living-flags-v1";
let saved: Partial<Record<LivingFlag, boolean>> | null = null;

function load() {
  if (saved) return saved;
  saved = {};
  if (typeof window === "undefined") return saved;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Record<string, unknown> | null;
    if (raw && typeof raw === "object") for (const flag of livingFlags) if (typeof raw[flag] === "boolean") saved[flag] = raw[flag] as boolean;
  } catch {
    // Unreadable or blocked storage: the defaults apply.
  }
  return saved;
}

function fromAddress(flag: LivingFlag): boolean | null {
  if (typeof window === "undefined" || !window.location) return null;
  const value = new URLSearchParams(window.location.search).get("living");
  if (!value) return null;
  if (value === "off") return false;
  const parts = value.split(",");
  if (parts.includes(`-${flag}`)) return false;
  if (parts.includes(flag)) return true;
  return null;
}

export const livingOn = (flag: LivingFlag) => fromAddress(flag) ?? load()[flag] ?? true;

export function setLiving(flag: LivingFlag, on: boolean) {
  const flags = { ...load(), [flag]: on };
  saved = flags;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(flags));
  } catch {
    // The choice still holds for this visit.
  }
}
