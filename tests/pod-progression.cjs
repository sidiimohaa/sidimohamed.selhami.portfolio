const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, file);

const { buyUpgrade, clockLabel, emptyProfile, loadProfile, registerRace, saveProfile, scoreRound, upgradeCost } = require("../components/podracing/progression.ts");

let stored = '{"version":1,"credits":12.9,"upgrades":{"speed":8,"repair":-4},"challenges":["clean","clean","invalid"],"wins":10,"starts":2}';
global.window = {
  localStorage: {
    getItem: () => stored,
    setItem: (_key, data) => { stored = data; },
  },
};
const loaded = loadProfile();
assert.equal(loaded.credits, 12);
assert.equal(loaded.upgrades.speed, 4);
assert.equal(loaded.upgrades.repair, 0);
assert.equal(loaded.wins, 2);
assert.deepEqual(loaded.challenges, ["clean"]);
stored = "invalid json";
assert.deepEqual(loadProfile(), emptyProfile());

const baseline = { ...emptyProfile(), credits: 1000 };
const improved = buyUpgrade(baseline, "speed");
assert.equal(improved.upgrades.speed, 1);
assert.equal(improved.credits, 1000 - upgradeCost("speed", 0));
assert.equal(baseline.upgrades.speed, 0);
assert.equal(buyUpgrade(loaded, "speed"), loaded);
assert.equal(buyUpgrade(loaded, "handling"), loaded);

const player = { id: "player", name: "Pilote", position: 1, time: 36.05 };
const rival = { id: "rival", name: "Rival", position: 2, time: 38 };
const result = {
  finished: true, position: 1, time: player.time, bestLap: player.time, crashes: 0, miniTurbos: 2,
  shortcuts: 1, nearMisses: 0, topSpeed: 100, standings: [player], ghost: [
    { time: 0, distance: 0, lane: 0 },
    { time: 20, distance: 1400, lane: 2 },
    { time: 14, distance: 1400, lane: 2 },
    { time: 30, distance: 2000, lane: 900 },
  ],
};
const trial = registerRace(improved, result, { track: "boonta", trial: true });
assert.equal(trial.award.record, true);
assert.equal(trial.profile.records.boonta.ghost.length, 2);
assert.equal(trial.profile.wins, 0);
saveProfile(trial.profile);
assert.deepEqual(loadProfile(), trial.profile);
const slower = registerRace(trial.profile, { ...result, time: 37 }, { track: "boonta", trial: true });
assert.equal(slower.award.record, false);
assert.equal(slower.profile.records.boonta.time, result.time);

const cleared = registerRace(trial.profile, result, { track: "boonta", trial: false, challenge: "clean" });
assert.equal(cleared.award.challenge, true);
const repeated = registerRace(cleared.profile, result, { track: "boonta", trial: false, challenge: "clean" });
assert.equal(repeated.award.challenge, false);
assert.equal(cleared.award.credits - repeated.award.credits, 180);

const firstRound = scoreRound([], [player, rival], true);
assert.deepEqual(firstRound.map((entry) => entry.points), [10, 7]);
const secondRound = scoreRound(firstRound, [{ ...rival, position: 1 }, { ...player, position: 2, time: null }], false);
assert.deepEqual(secondRound.map((entry) => [entry.id, entry.points]), [["rival", 17], ["player", 10]]);
assert.equal(clockLabel(60.01), "01:00.01");
assert.equal(clockLabel(59.999), "00:59.99");
console.log("Podracing progression, upgrades, records, challenges and standings passed.");
