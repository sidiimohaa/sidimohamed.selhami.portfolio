const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, file);

const { createDirector } = require("../components/galaxy/director.ts");
const { galacticEvents, eventById } = require("../components/galaxy/catalog.ts");

const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const allow = () => true;

// The catalog holds together.
assert.equal(new Set(galacticEvents.map((event) => event.id)).size, galacticEvents.length);
for (const event of galacticEvents) {
  assert.ok(event.title && event.summary && event.line, event.id);
  assert.ok(event.duration[0] <= event.duration[1] && event.cooldown >= event.duration[1], `${event.id}: it cannot come back while it runs`);
  assert.ok(event.weight > 0);
}

// One simulated hour at Coruscant: rules on rhythm, overlap and repetition.
{
  const director = createDirector({ random: seeded(1) });
  const started = [];
  let majors = 0, peak = 0;
  for (let t = 0; t < 3600; t++) {
    director.tick(1, { place: "coruscant", blocked: false, enabled: allow });
    for (const notice of director.drainNotices()) if (notice.kind === "start") started.push({ t, id: notice.event.id, priority: notice.event.priority });
    const here = director.activeAt("coruscant");
    assert.ok(here.length <= 1, "One event at a time where the visitor is");
    peak = Math.max(peak, director.active().length);
    majors = Math.max(majors, director.active().filter((run) => eventById(run.id).priority === 3).length);
  }
  assert.ok(started.length >= 12, `Things happen: ${started.length}`);
  assert.ok(started.length <= 40, `Not constantly: ${started.length}`);
  assert.ok(started[0].t >= 20, "Nothing in the first seconds");
  assert.equal(majors <= 1, true);
  for (let i = 1; i < started.length; i++) assert.ok(started[i].t - started[i - 1].t >= 30, "A gap between events");
  const last = {};
  for (const item of started) {
    if (last[item.id] !== undefined) assert.ok(item.t - last[item.id] >= eventById(item.id).cooldown, `${item.id} respects its cooldown`);
    last[item.id] = item.t;
  }
  assert.ok(new Set(started.map((item) => item.id)).size >= 4, "Variety");
  assert.ok(director.record().log.length > 0);
  assert.equal(director.active().every((run) => run.endsAt > director.now()), true, "Everything ends");
}

// Blocked: nothing starts during a transition, a cinematic or the recruiter's record.
{
  const director = createDirector({ random: seeded(2) });
  for (let t = 0; t < 1200; t++) director.tick(1, { place: "space", blocked: true, enabled: allow });
  assert.equal(director.active().length, 0);
  assert.equal(director.drainNotices().length, 0);
}

// Switched off, a place stays quiet, but the others can still be heard from afar.
{
  const director = createDirector({ random: seeded(3) });
  for (let t = 0; t < 1200; t++) director.tick(1, { place: "hoth", blocked: false, enabled: (place) => place !== "hoth" });
  assert.equal(director.record().log.filter((row) => row.place === "hoth").length, 0);
  assert.equal(director.activeAt("hoth").length, 0);
}
{
  const director = createDirector({ random: seeded(4) });
  for (let t = 0; t < 1200; t++) director.tick(1, { place: "coruscant", blocked: false, enabled: () => false });
  assert.equal(director.record().log.length, 0, "With everything off, nothing at all");
}

// Distant events are only monitor entries: no notifications from a place the visitor is not at.
{
  const director = createDirector({ random: seeded(5) });
  const heard = [];
  for (let t = 0; t < 1800; t++) {
    director.tick(1, { place: "tatooine", blocked: false, enabled: allow });
    heard.push(...director.drainNotices());
  }
  assert.ok(heard.every((notice) => notice.event.place === "tatooine"));
  assert.ok(director.record().log.some((row) => row.place !== "tatooine"), "The rest of the galaxy goes on");
  assert.ok(director.record().log.filter((row) => row.place !== "tatooine").every((row) => !eventById(row.id).seek), "Nothing to seek far away");
}

// Discoveries: once, kept, and passed on for the mission journal; choices; ignoring.
{
  const reached = [];
  let saved = null;
  const director = createDirector({ random: seeded(6), onDiscovery: (event) => reached.push(event.id), onRecord: (record) => (saved = record) });
  director.tick(1, { place: "space", blocked: true, enabled: allow });
  assert.equal(director.trigger("space-wreck"), true);
  assert.equal(director.trigger("space-wreck"), false, "Never twice at once");
  assert.equal(director.found("space-wreck"), true);
  assert.equal(director.active().length, 0);
  assert.equal(saved.discoveries.length, 1);
  assert.deepEqual(reached, ["space-wreck"]);
  director.trigger("space-wreck");
  director.found("space-wreck");
  assert.equal(saved.discoveries.length, 1, "The same archive is not counted twice");
  assert.equal(saved.log[0].status, "found");

  director.trigger("space-distress");
  assert.equal(director.choose("space-distress", "nope"), false);
  assert.equal(director.choose("space-distress", "ignore"), true);
  assert.equal(director.active().length, 0);
  assert.equal(saved.log[0].status, "ignored");

  director.trigger("space-patrol");
  assert.equal(director.choose("space-patrol", "code"), true);
  assert.equal(director.choose("space-patrol", "silence"), false, "One answer");
  assert.equal(director.active()[0].choice, "code");

  assert.equal(director.witness("city-chase"), true);
  assert.equal(director.witness("city-chase"), false);
  assert.equal(director.witness("city-alert"), false, "Nothing to reveal");
  assert.ok(reached.includes("city-chase"));
}

// A place change gives the visitor time to settle.
{
  const director = createDirector({ random: seeded(7) });
  for (let t = 0; t < 400; t++) director.tick(1, { place: "space", blocked: false, enabled: allow });
  director.drainNotices();
  const before = director.now();
  let first = null;
  for (let t = 0; t < 400 && first === null; t++) {
    director.tick(1, { place: "endor", blocked: false, enabled: allow });
    if (director.drainNotices().some((notice) => notice.kind === "start")) first = director.now() - before;
  }
  assert.ok(first >= 20, `Settling time at a new place (${first})`);
}

console.log("Galactic Event Director passed.");
