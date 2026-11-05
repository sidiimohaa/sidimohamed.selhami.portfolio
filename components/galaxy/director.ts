import { eventById, galacticEvents, type EventPlace, type GalacticEvent } from "./catalog";

// The Galactic Event Director. It decides what happens, where and when, and keeps the record; it
// draws nothing and knows no scene. Scenes read what is active at their place each frame.
//
// Rules: weighted draw among what the context allows, a long gap between events, a cooldown per
// event, at most one major event at a time, nothing during a transition or a cinematic. Only the
// visitor's place is simulated in detail: elsewhere, an occasional distant event only exists as an
// entry in the monitor, and is live in the scene if the visitor arrives before it ends.

export type EventStatus = "active" | "found" | "ended" | "ignored";
export type ActiveEvent = { key: number; id: string; place: EventPlace; startedAt: number; endsAt: number; choice?: string };
export type LogEntry = { id: string; place: EventPlace; status: EventStatus; at: number };
export type Discovery = { id: string; title: string; body: string; at: number };
export type ActivityRecord = { version: 1; log: LogEntry[]; discoveries: Discovery[]; seen: number };
export type DirectorContext = { place: EventPlace | null; blocked: boolean; enabled: (place: EventPlace) => boolean };
export type DirectorNotice = { kind: "start" | "end" | "found" | "choice"; event: GalacticEvent; line: string; key: number };

const LOG_SIZE = 30;
// Quiet between two events where the visitor is, and for a distant entry in the monitor.
const GAP = { first: 28, min: 55, max: 110, afterMajor: 150, settle: 22 };
const REMOTE_GAP = { min: 120, max: 260 };

export const emptyRecord = (): ActivityRecord => ({ version: 1, log: [], discoveries: [], seen: 0 });

export function createDirector(options: { random?: () => number; events?: GalacticEvent[]; record?: ActivityRecord; onRecord?: (record: ActivityRecord) => void; onDiscovery?: (event: GalacticEvent) => void } = {}) {
  const random = options.random ?? Math.random;
  const events = options.events ?? galacticEvents;
  let record = options.record ?? emptyRecord();
  let clock = 0,
    nextLocal = GAP.first,
    nextRemote = 60,
    place: EventPlace | null = null,
    key = 0;
  const cooldown = new Map<string, number>();
  let active: ActiveEvent[] = [];
  const notices: DirectorNotice[] = [];
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((listener) => listener());
  const save = (next: ActivityRecord) => {
    record = next;
    options.onRecord?.(record);
  };
  const log = (run: ActiveEvent, status: EventStatus) =>
    save({ ...record, log: [{ id: run.id, place: run.place, status, at: Date.now() }, ...record.log].slice(0, LOG_SIZE), seen: record.seen + 1 });
  const span = (range: [number, number]) => range[0] + random() * (range[1] - range[0]);

  function start(event: GalacticEvent, local: boolean) {
    const run: ActiveEvent = { key: ++key, id: event.id, place: event.place, startedAt: clock, endsAt: clock + span(event.duration) };
    active = [...active, run];
    cooldown.set(event.id, clock + event.cooldown);
    if (local) notices.push({ kind: "start", event, line: event.line, key: run.key });
    changed();
    return run;
  }
  function draw(allowed: GalacticEvent[]) {
    const pool = allowed.filter((event) => (cooldown.get(event.id) ?? 0) <= clock && !active.some((run) => run.id === event.id));
    const total = pool.reduce((sum, event) => sum + event.weight, 0);
    if (!total) return null;
    let roll = random() * total;
    for (const event of pool) if ((roll -= event.weight) <= 0) return event;
    return pool[pool.length - 1];
  }
  function finish(run: ActiveEvent, status: EventStatus, line?: string) {
    active = active.filter((item) => item.key !== run.key);
    log(run, status);
    const event = eventById(run.id);
    if (event && line && run.place === place) notices.push({ kind: status === "found" ? "found" : "end", event, line, key: run.key });
    changed();
  }

  return {
    /** Advances the clock. Call about once a second; dt is how long since the last call. */
    tick(dt: number, context: DirectorContext) {
      clock += dt;
      if (context.place !== place) {
        place = context.place;
        // Let the visitor settle in before anything happens at a new place.
        nextLocal = Math.max(nextLocal, clock + GAP.settle);
      }
      for (const run of active) if (clock >= run.endsAt) finish(run, "ended", eventById(run.id)?.endLine);
      if (context.blocked) return;
      if (place && context.enabled(place) && clock >= nextLocal) {
        const majorRunning = active.some((run) => eventById(run.id)?.priority === 3);
        const here = active.some((run) => run.place === place);
        const event = here ? null : draw(events.filter((item) => item.place === place && !(majorRunning && item.priority === 3)));
        if (event) {
          start(event, true);
          nextLocal = clock + (event.priority === 3 ? GAP.afterMajor : 0) + GAP.min + random() * (GAP.max - GAP.min);
        } else nextLocal = clock + 15;
      }
      if (clock >= nextRemote) {
        nextRemote = clock + REMOTE_GAP.min + random() * (REMOTE_GAP.max - REMOTE_GAP.min);
        // Distant events are routine or notable, and only for places the visitor is not at.
        const event = draw(events.filter((item) => item.place !== place && item.priority < 3 && !item.seek && context.enabled(item.place)));
        if (event) start(event, false);
      }
    },
    /** What is happening at a place, for its scene to draw. */
    activeAt: (where: EventPlace) => active.filter((run) => run.place === where),
    active: () => active,
    record: () => record,
    /** The scene reports the visitor has reached what the event was hiding. */
    found(id: string) {
      const run = active.find((item) => item.id === id);
      const event = eventById(id);
      if (!run || !event) return false;
      if (event.discovery && !record.discoveries.some((item) => item.id === id))
        save({ ...record, discoveries: [{ id, title: event.discovery.title, body: event.discovery.body, at: Date.now() }, ...record.discoveries] });
      options.onDiscovery?.(event);
      finish(run, "found", event.discovery ? `${event.discovery.title} : ${event.discovery.body}` : undefined);
      return true;
    },
    choose(id: string, choiceId: string) {
      const run = active.find((item) => item.id === id);
      const choice = eventById(id)?.choices?.find((item) => item.id === choiceId);
      if (!run || !choice || run.choice) return false;
      const event = eventById(id)!;
      notices.push({ kind: "choice", event, line: choice.line, key: run.key });
      if (choice.ends) finish(run, "ignored");
      else {
        active = active.map((item) => (item.key === run.key ? { ...item, choice: choiceId } : item));
        changed();
      }
      return true;
    },
    /** For testing an event by hand: starts it now, ignoring gaps and cooldowns. */
    trigger(id: string) {
      const event = eventById(id);
      if (!event || active.some((run) => run.id === id)) return false;
      start(event, event.place === place);
      return true;
    },
    /** Witnessing an event to its end also reveals what it holds. */
    witness(id: string) {
      const event = eventById(id);
      if (!event?.discovery || event.seek || record.discoveries.some((item) => item.id === id)) return false;
      save({ ...record, discoveries: [{ id, title: event.discovery.title, body: event.discovery.body, at: Date.now() }, ...record.discoveries] });
      options.onDiscovery?.(event);
      return true;
    },
    drainNotices: () => notices.splice(0),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    now: () => clock,
  };
}
export type Director = ReturnType<typeof createDirector>;
