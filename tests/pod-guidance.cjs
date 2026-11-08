const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

const { courseGuidance, nearbyStandings } = require("../components/podracing/raceGuidance.ts");
const { createPodSimulation } = require("../components/podracing/simulation.ts");
const { tracks } = require("../components/podracing/tracks.ts");
const { upgradeKeys } = require("../components/podracing/types.ts");
const upgrades = Object.fromEntries(upgradeKeys.map((key) => [key, 0]));
const state = createPodSimulation({ track: tracks.boonta, mode: "classic", difficulty: "pilot", laps: 2, upgrades }).state;
const length = 1000;
const course = (curve, sector = "canyon") => ({
  ...tracks.boonta, length,
  sample(distance) {
    const at = ((distance % length) + length) % length;
    return { x: 0, y: 0, z: at, heading: 0, width: 20, curve: curve(at), sector };
  },
});

state.player.distance = -24;
state.player.speed = 0;
let guidance = courseGuidance(course(() => 0), state);
assert.equal(guidance.direction, "straight");
assert.equal(guidance.progress, 0, "The starting grid is not the end of the first lap.");
assert.equal(guidance.distance, 30, "A stationary racer retains a short view ahead.");
assert.equal(guidance.sectorLabel, "CANYON");

state.player.distance = 0;
state.player.speed = 160;
const left = course((distance) => distance >= 80 && distance < 160 ? .014 : 0);
guidance = courseGuidance(left, state);
assert.equal(guidance.direction, "left", "Positive curvature turns left on the racing screen.");
assert.equal(guidance.distance, 80);
assert.equal(guidance.sharp, true);
const right = course((distance) => distance >= 60 && distance < 100 ? -.005 : 0);
guidance = courseGuidance(right, state);
assert.equal(guidance.direction, "right");
assert.equal(guidance.distance, 60);
assert.equal(guidance.sharp, false);
assert.equal(courseGuidance(course(() => 0), state).distance, 220, "Lookahead stays bounded at high speed.");
state.player.speed = 10;
assert.equal(courseGuidance(left, state).direction, "straight", "A distant bend waits until it enters the speed-dependent horizon.");
state.player.speed = 160;
const consecutive = course((distance) => distance >= 30 && distance < 70 ? .005 : distance >= 70 && distance < 90 ? .015 : distance >= 110 ? -.025 : 0);
guidance = courseGuidance(consecutive, state);
assert.equal(guidance.direction, "left", "The nearest bend takes precedence over a stronger opposite bend.");
assert.equal(guidance.sharp, true, "Read tightening curvature within the same bend.");

state.player.distance = 980;
const wrap = course((distance) => distance >= 20 && distance < 60 ? -.015 : 0);
guidance = courseGuidance(wrap, state);
assert.equal(guidance.direction, "right");
assert.equal(guidance.distance, 40, "Lookahead wraps across the timing line.");
assert.equal(guidance.progress, .98);
state.player.distance = 1000;
assert.equal(courseGuidance(wrap, state).progress, 0, "A new lap resets the lap progress.");
state.player.distance = 1250;
assert.equal(courseGuidance(wrap, state).progress, .25);
state.phase = "finished";
state.player.distance = 2000.8;
assert.equal(courseGuidance(wrap, state).progress, 1, "The finish preserves a full progress bar.");

state.phase = "racing";
state.player.distance = 100;
state.opponents.forEach((vehicle, index) => { vehicle.distance = 700 - index * 100; });
state.standings = [...state.opponents, state.player].map((vehicle, index) => ({ id: vehicle.id, name: vehicle.name, position: index + 1, time: null }));
const original = JSON.stringify(state);
let rows = nearbyStandings(state);
assert.deepEqual(rows.map((row) => row.position), [1, 5, 6, 7]);
assert.equal(rows.at(-1).gapLabel, "VOUS");
assert.equal(rows[0].gapLabel, "+600 M");
assert.equal(JSON.stringify(state), original, "The HUD helpers do not mutate race state.");
state.standings = [state.player, ...state.opponents].map((vehicle, index) => ({ id: vehicle.id, name: vehicle.name, position: index + 1, time: null }));
state.player.distance = 800;
rows = nearbyStandings(state);
assert.deepEqual(rows.map((row) => row.position), [1, 2, 3, 4]);
assert.equal(rows[0].gapLabel, "VOUS");
assert.equal(rows[1].gapLabel, "−100 M");
state.opponents[0].finishedAt = 23.4;
assert.equal(nearbyStandings(state)[1].gapLabel, "ARRIVÉ", "Finished rivals do not expose misleading live distances.");
state.standings = state.standings.slice(0, 2);
assert.equal(nearbyStandings(state).length, 2, "Small fields do not duplicate entries.");

console.log("Pod guidance: bend direction, horizon, lap wrap, finish, nearby standings and signed metre gaps passed.");
