// Which lost sector a 404 shows: every variant once before any repeats, never the same one twice in
// a row, and a collection the visitor can complete. ?secteur=<id> shows a given variant.

export const sectorIds = ["asteroids", "transmission", "jawas", "planet"] as const;
export type SectorId = (typeof sectorIds)[number];
export type SectorPick = { id: SectorId; found: number; total: number; seen: SectorId[] };

const KEY = "orbital-lost-sectors-v1";
type Saved = { seen: SectorId[]; last: SectorId | null };

const isSector = (value: unknown): value is SectorId => sectorIds.includes(value as SectorId);

function read(): Saved {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Partial<Saved> | null;
    return {
      seen: Array.isArray(saved?.seen) ? [...new Set(saved.seen.filter(isSector))] : [],
      last: isSector(saved?.last) ? saved.last : null,
    };
  } catch {
    return { seen: [], last: null };
  }
}

// One pick per page load, even when an effect runs twice (React's development checks).
let current: SectorPick | null = null;

export function pickSector(): SectorPick {
  if (current) return current;
  const saved = read();
  const asked = new URLSearchParams(window.location.search).get("secteur");
  let id: SectorId;
  if (isSector(asked)) id = asked;
  else {
    const unseen = sectorIds.filter((sector) => !saved.seen.includes(sector));
    const pool = (unseen.length ? unseen : sectorIds.filter((sector) => sector !== saved.last)) as SectorId[];
    id = pool[Math.floor(Math.random() * pool.length)];
  }
  // Once the collection is complete it stays complete; the rotation simply starts over.
  const seen = saved.seen.includes(id) ? saved.seen : [...saved.seen, id];
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ seen, last: id }));
  } catch {
    // Without storage every visit is a first visit.
  }
  current = { id, found: seen.length, total: sectorIds.length, seen };
  return current;
}
