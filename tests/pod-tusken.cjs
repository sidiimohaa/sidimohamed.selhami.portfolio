const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, file);

const { createPodSimulation } = require("../components/podracing/simulation.ts");
const { tracks } = require("../components/podracing/tracks.ts");
const { neutralInput, upgradeKeys } = require("../components/podracing/types.ts");
const { podModules, podModuleIds, moduleTraits } = require("../components/podracing/modules.ts");
const { boardFor, buyModule, buyPaint, emptyProfile, fitModule, loadProfile, medalFor, medalTime, registerRace, saveProfile } = require("../components/podracing/progression.ts");

const upgrades = Object.fromEntries(upgradeKeys.map((key) => [key, 0]));
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const fresh = (track, options = {}) => createPodSimulation({ track, mode: "challenge", difficulty: "pilot", upgrades, laps: 1, seed: 7, ...options });

// A steady pilot: holds the middle of the road, slowing only for what the road asks.
function drive(sim, track, { boost = false, dodge = false, stopAt = 200 } = {}) {
  const fired = new Set();
  let away = 0;
  while ((sim.state.phase === "countdown" || sim.state.phase === "racing") && sim.state.time < stopAt) {
    const v = sim.state.player;
    const frame = track.sample(v.distance + 18);
    let target = 0;
    // Hazards: steer to the far side of anything close ahead.
    const d = ((v.distance % track.length) + track.length) % track.length;
    for (const h of track.hazards) {
      const gap = ((h.distance - d) % track.length + track.length) % track.length;
      if (gap < 80) target = h.lane > 0 ? -frame.width * .55 : frame.width * .55;
    }
    for (const shot of sim.state.shots) {
      if (dodge && !fired.has(shot.id)) { fired.add(shot.id); away = v.lane > 0 ? -1 : 1; }
    }
    if (dodge && sim.state.shots.length) target = away * frame.width * .6;
    const steer = clamp((target - v.lane) * .23 - v.lateral * .043 + frame.curve * v.speed * .055, -1, 1);
    sim.step(1 / 60, { ...neutralInput, throttle: true, steer, boost: boost && Math.max(...v.heat) < .8 });
  }
  return sim.result();
}

for (const id of Object.keys(tracks)) {
  const track = tracks[id];
  assert.equal(track.raiders.length, 4);

  // Without the option there is never a shot: time trials and older callers are unaffected.
  const quiet = fresh(track);
  const calm = drive(quiet, track);
  assert.equal(calm.dodges, 0);
  assert.ok(calm.finished, `${id}: finishes without raiders`);

  // Raiders fire once each per lap, and a pilot who moves away is not hit by them.
  const raided = fresh(track, { raiders: true });
  const ok = drive(raided, track, { dodge: true });
  assert.ok(ok.finished, `${id}: finishes with raiders`);
  assert.equal(ok.dodges + ok.crashes >= 4, true, `${id}: four shots landed (${ok.dodges} dodged, ${ok.crashes} crashes)`);
  assert.ok(ok.dodges >= 3, `${id}: a moving pilot avoids most shots (${ok.dodges})`);
  assert.equal(raided.state.shots.length, 0, `${id}: no shot left in the air after the finish`);

  // A pilot who never reacts to a shot takes at least one, and it costs engine health.
  const still = fresh(track, { raiders: true });
  while (still.state.phase === "countdown" || (still.state.phase === "racing" && still.state.crashes === 0 && still.state.time < 200)) {
    const v = still.state.player;
    const f = track.sample(v.distance + 18);
    still.step(1 / 60, { ...neutralInput, throttle: true, steer: clamp(-v.lane * .23 - v.lateral * .043 + f.curve * v.speed * .055, -1, 1) });
  }
  assert.ok(still.state.crashes >= 1, `${id}: holding a straight line gets hit`);
  assert.ok(Math.min(...still.state.player.health) < 1);

  // Recruits face half of the raiders.
  const rookie = createPodSimulation({ track, mode: "classic", difficulty: "rookie", upgrades, laps: 1, seed: 7, raiders: true });
  const easy = drive(rookie, track, { dodge: true });
  assert.ok(easy.dodges <= 2, `${id}: recruit shots (${easy.dodges})`);

  // Medals are within reach: a steady lap gets bronze, and boost gets further than that.
  const plain = drive(fresh(track), track);
  const boosted = drive(fresh(track), track, { boost: true });
  const maxed = drive(fresh(track, { upgrades: Object.fromEntries(upgradeKeys.map((key) => [key, 4])) }), track, { boost: true });
  console.log(id, { plain: +plain.time.toFixed(2), boosted: +boosted.time.toFixed(2), maxed: +maxed.time.toFixed(2), bronze: +medalTime(id, 1).toFixed(2), silver: +medalTime(id, 2).toFixed(2), gold: +medalTime(id, 3).toFixed(2) });
  assert.ok(medalFor(id, maxed.time) === 3, `${id}: gold is reachable with a fully upgraded pod`);
  assert.ok(medalFor(id, boosted.time) >= 1, `${id}: bronze is reachable on a stock pod`);
}

// Modules change the pod for the visitor only.
const lap = (module) => drive(fresh(tracks.boonta, { pod: { module, color: 1 } }), tracks.boonta);
assert.equal(fresh(tracks.boonta, { pod: { module: "mammoth", color: 0xabcdef } }).state.player.module, "mammoth");
assert.equal(fresh(tracks.boonta, { pod: { module: "mammoth", color: 0xabcdef } }).state.player.color, 0xabcdef);
const grid = createPodSimulation({ track: tracks.boonta, mode: "classic", difficulty: "pilot", upgrades, laps: 1, seed: 7 });
assert.deepEqual(grid.state.opponents.map((v) => v.module).sort(), ["gpe", "longtail", "manta", "mammoth", "pedrovia", "quadra"].sort());
assert.ok(lap("pedrovia").time < lap("ulzer").time, "A faster module laps faster");
for (const id of podModuleIds) assert.ok(id === "ulzer" ? moduleTraits(podModules[id]).length === 0 : moduleTraits(podModules[id]).length >= 2, id);

// Buying, fitting, saving.
let stored = null;
global.window = { localStorage: { getItem: () => stored, setItem: (_k, v) => { stored = v; } } };
let profile = { ...emptyProfile(), credits: 1000 };
assert.equal(fitModule(profile, "mammoth"), profile, "A module must be bought first");
profile = buyModule(profile, "mammoth");
assert.equal(profile.credits, 100);
assert.equal(profile.pod.module, "mammoth");
assert.equal(buyModule(profile, "manta"), profile, "Not enough credits");
profile = buyPaint(profile, "dug");
assert.equal(profile.credits, 100 - 150 < 0 ? 100 : 0, "Not enough credits for the paint");
assert.equal(profile.pod.paint, "azure");
const base = { finished: true, position: 1, crashes: 0, miniTurbos: 0, shortcuts: 0, nearMisses: 0, dodges: 0, topSpeed: 100, standings: [], ghost: [] };
const gold = medalTime("boonta", 3) - .5;
const first = registerRace(profile, { ...base, time: gold, bestLap: gold }, { track: "boonta", trial: false });
assert.equal(first.award.medal, 3);
assert.equal(first.award.improved, true);
assert.equal(first.award.rank, 1, "A gold lap tops Sebulba on the board");
assert.equal(first.profile.medals.boonta, 3);
const again = registerRace(first.profile, { ...base, time: gold, bestLap: gold }, { track: "boonta", trial: false });
assert.equal(again.award.improved, false);
assert.equal(first.award.credits - again.award.credits, 350, "The medal bonus is paid once");
const bronze = registerRace(first.profile, { ...base, time: medalTime("boonta", 1), bestLap: medalTime("boonta", 1) }, { track: "boonta", trial: false });
assert.equal(bronze.profile.medals.boonta, 3, "A slower lap never takes a medal back");
let full = first.profile;
for (let i = 0; i < 8; i++) full = registerRace(full, { ...base, time: 30 + i, bestLap: 30 + i }, { track: "boonta", trial: false }).profile;
assert.equal(full.board.boonta.length, 5);
assert.equal(boardFor(full, "boonta").filter((row) => row.player).length, 5);
assert.equal(boardFor(full, "boonta").filter((row) => !row.player).length, 6);
saveProfile(full);
assert.deepEqual(loadProfile(), full);
stored = JSON.stringify({ ...JSON.parse(stored), pod: { module: "manta", paint: "sith" }, medals: { boonta: 9 }, board: { boonta: [{ time: "x" }] } });
const cleaned = loadProfile();
assert.equal(cleaned.pod.module, "ulzer", "A module that was not bought is not fitted");
assert.equal(cleaned.pod.paint, "azure");
assert.equal(cleaned.medals.boonta, 3);
assert.equal(cleaned.board.boonta, undefined);
console.log("Tusken raiders, modules, medals and the Mos Espa board passed.");
