const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, file);

const { createPodSimulation } = require("../components/podracing/simulation.ts");
const { tracks, branchOffset, hazardLane } = require("../components/podracing/tracks.ts");
const { neutralInput, upgradeKeys } = require("../components/podracing/types.ts");

const upgrades = Object.fromEntries(upgradeKeys.map((key) => [key, 0]));
const throttle = { ...neutralInput, throttle: true };
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function simulation(options = {}) {
  return createPodSimulation({ track: tracks.boonta, mode: "time", difficulty: "pilot", upgrades, laps: 1, seed: 1999, ...options });
}

function advance(sim, seconds, input = throttle, dt = 1 / 60) {
  const events = new Set();
  for (let frame = 0; frame < Math.round(seconds / dt); frame++) {
    sim.step(dt, typeof input === "function" ? input(sim.state) : input);
    for (const event of sim.drainEvents()) events.add(event);
    if (sim.state.phase === "finished" || sim.state.phase === "wrecked") break;
  }
  return events;
}

const startSequence = simulation();
const startEvents = startSequence.drainEvents();
const beats = [startSequence.state.countdown];
for (let frame = 1; frame <= 360; frame++) {
  const previous = startSequence.state.countdown;
  startSequence.step(1 / 120, throttle);
  assert.ok(startSequence.state.countdown < previous, "The camera countdown advances every simulation step");
  const events = startSequence.drainEvents();
  startEvents.push(...events);
  if (events.includes("countdown")) beats.push(startSequence.state.countdown);
  assert.equal(startSequence.state.player.distance, 0, "Holding throttle cannot launch before the start signal");
}
assert.deepEqual(beats, [3, 2, 1], "Countdown audio fires once on each numbered beat");
assert.deepEqual(startEvents, ["countdown", "countdown", "countdown", "go"]);
assert.equal(startSequence.state.countdown, 0);
assert.equal(startSequence.state.phase, "racing");
assert.equal(startSequence.state.time, 0);
startSequence.step(1 / 120, throttle);
assert.ok(startSequence.state.player.distance > 0, "Throttle held through the countdown launches the pod");

const grid = simulation({ mode: "classic" });
advance(grid, 3.25);
const gridSpeed = (id) => grid.state.opponents.find((opponent) => opponent.id === id).speed;
assert.ok(gridSpeed("quadinaros") > gridSpeed("sebulba") * 1.14, "The light Quadra module accelerates faster than the heavy Mammoth on the rival grid");
assert.ok(gridSpeed("mawhonic") > gridSpeed("gasgano"), "Rivals receive the acceleration traits of their own fitted modules");
assert.equal(grid.state.crashes, 0);

for (const track of Object.values(tracks)) {
  assert.ok(track.length > 2000);
  const start = track.sample(0);
  assert.deepEqual(track.sample(track.length), start);
  assert.deepEqual(track.sample(-10), track.sample(track.length - 10));
  const sectorSet = new Set();
  let peak = 0;
  for (let d = 0; d < track.length; d += 7) {
    const a = track.sample(d);
    const b = track.sample(d + 7);
    assert.ok(Math.abs(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) - 7) < .2, "Arc-length sampling follows metres");
    sectorSet.add(a.sector);
    peak = Math.max(a.y, peak);
  }
  assert.equal(sectorSet.size, 5);
  assert.ok(peak >= 25);
  for (const branch of track.branches) {
    assert.equal(branchOffset(branch, branch.start), 0);
    assert.equal(branchOffset(branch, (branch.start + branch.end) / 2), branch.offset);
    assert.equal(Math.abs(branchOffset(branch, branch.end)), 0);
  }
  const sweeper = track.hazards.find((hazard) => hazard.kind === "sweeper");
  assert.notEqual(hazardLane(sweeper, 0), hazardLane(sweeper, 3));
}

const centered = simulation({ laps: 2 });
advance(centered, 2);
assert.equal(centered.state.phase, "countdown");
assert.equal(centered.state.player.distance, 0);
const lapEvents = advance(centered, 85);
assert.ok(lapEvents.has("lap") && lapEvents.has("finish"));
assert.equal(centered.state.phase, "finished");
assert.equal(centered.state.lap, 2);
assert.equal(centered.state.crashes, 0, "Centered pilot can complete two clean laps with throttle");
assert.equal(centered.state.opponents.length, 0);
const record = centered.result();
assert.ok(record.bestLap > 20 && record.bestLap < 35);
assert.equal(record.ghost[0].time, 0);
assert.ok(Math.abs(record.ghost.at(-1).time - record.time) < .001);
for (let i = 1; i < record.ghost.length; i++) {
  assert.ok(record.ghost[i].time > record.ghost[i - 1].time);
  assert.ok(record.ghost[i].distance >= record.ghost[i - 1].distance);
}
const coarse = simulation({ laps: 2 });
advance(coarse, 88, throttle, 1 / 30);
assert.deepEqual(coarse.result(), record, "Fixed-step race and ghost match at different frame rates");

const drift = simulation({ mode: "challenge" });
advance(drift, 5);
advance(drift, 1.1, { ...throttle, steer: .3, drift: true });
assert.ok(drift.state.player.drifting && drift.state.player.driftCharge > .34);
advance(drift, .05, { ...throttle, drift: true });
assert.equal(drift.state.miniTurbos, 0, "Straightening while holding drift keeps the charge");
assert.ok(advance(drift, .05).has("mini"));
assert.equal(drift.state.miniTurbos, 1);
assert.ok(drift.state.player.miniTurbo > .6);
assert.equal(drift.state.player.driftCharge, 0);

const hot = simulation({ laps: 2 });
const boostEvents = advance(hot, 9, { ...throttle, boost: true });
assert.ok(boostEvents.has("boost") && boostEvents.has("overheat"));
const overheated = hot.state.player;
assert.ok(hot.state.topSpeed > 130);
assert.ok(overheated.health[0] < overheated.health[1], "Engine load and thermal damage are separate");
const speed = overheated.speed;
const health = overheated.health[0];
const heat = overheated.heat[0];
advance(hot, .8, { ...throttle, repair: true });
assert.equal(overheated.repairing, true);
assert.ok(overheated.health[0] > health && overheated.heat[0] < heat && overheated.speed < speed - 15);

const impact = simulation({ track: {
  ...tracks.boonta,
  pads: [],
  hazards: [{ id: "barrier", distance: 185, lane: .9, radius: 1.55, swing: .25, rate: 1, phase: 0, kind: "sweeper" }],
} });
assert.ok(advance(impact, 9, { ...throttle, boost: true }, .23).has("hit"));
assert.equal(impact.state.crashes, 1, "Swept contact registers once when a moving obstacle is crossed");
assert.ok(impact.state.player.health[1] < impact.state.player.health[0]);

function routeRun(takeBranch) {
  const track = tracks.boonta;
  const sim = simulation();
  advance(sim, 70, ({ player }) => {
    const aim = takeBranch ? branchOffset(track.branches[0], player.distance + player.speed * .33) : 0;
    const frame = track.sample(player.distance);
    const steer = (aim - player.lane) * .27 - player.lateral * .038 + frame.curve * player.speed * .034;
    return { ...throttle, steer: clamp(steer, -1, 1) };
  });
  return sim.result();
}
const main = routeRun(false);
const shortcut = routeRun(true);
assert.ok(main.finished && shortcut.finished);
assert.equal(shortcut.shortcuts, 1);
assert.equal(shortcut.crashes, 0);
assert.ok(shortcut.time < main.time - .2, "A driven shortcut reduces lap time");

function race(difficulty) {
  const sim = simulation({ mode: "classic", difficulty, laps: 2 });
  assert.equal(sim.state.opponents.length, 6);
  assert.ok(sim.state.opponents.some((pilot) => pilot.name === "Sebulba"));
  advance(sim, 95, ({ player }) => ({
    ...throttle,
    boost: player.boost > .1 && Math.max(...player.heat) < .78,
    repair: Math.min(...player.health) < .48,
  }));
  return sim.result();
}
const rookie = race("rookie");
const ace = race("ace");
assert.ok(rookie.finished && ace.finished);
assert.equal(rookie.position, 1, "Smart boost management can win the rookie race");
assert.equal(rookie.standings[0].id, "player");
assert.equal(rookie.standings[0].time, rookie.time);
assert.deepEqual(ace.standings.map(({ position }) => position), [1, 2, 3, 4, 5, 6, 7]);
assert.equal(new Set(ace.standings.map(({ id }) => id)).size, 7);
assert.ok(ace.position > rookie.position);
assert.equal(simulation({ mode: "championship" }).state.opponents.length, 6);
assert.equal(simulation({ mode: "arcade" }).state.opponents.length, 6);
assert.equal(simulation({ mode: "challenge" }).state.opponents.length, 0);

console.log(JSON.stringify({
  circuits: Object.values(tracks).map((track) => ({ id: track.id, metres: Math.round(track.length) })),
  cleanTwoLaps: Number(record.time.toFixed(2)),
  ghostSamples: record.ghost.length,
  miniTurbo: true,
  distinctEngines: true,
  sweptImpact: true,
  shortcutGain: Number((main.time - shortcut.time).toFixed(2)),
  rookiePlace: rookie.position,
  acePlace: ace.position,
}));
