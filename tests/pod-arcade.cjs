const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, filename);
};

const oldGames = ["space-battle", "asteroid-survival", "imperial-hacking", "speeder-racing", "defense-of-hoth"];
const oldStats = Object.fromEntries(oldGames.map((id, index) => [
  id,
  { plays: 2, wins: 1, best: 700 + index, seconds: 80, bestTime: id === "speeder-racing" ? 62 : null },
]));
let saved = JSON.stringify({
  version: 1,
  stats: oldStats,
  credits: 740,
  owned: ["holo-amber"],
  equipped: { holo: "holo-amber" },
  paid: ["first-win:space-battle"],
  playSeconds: 400,
});
global.localStorage = { getItem: () => saved, setItem: (_key, value) => { saved = value; } };
global.window = { localStorage, addEventListener() {} };

const { getArcade, recordResult } = require("../components/arcade/arcadeStore.ts");
const { arcadeGames, gameById } = require("../components/arcade/catalog.ts");
assert.equal(arcadeGames.length, 6);
assert.equal(gameById("podracing").mode, "environment");
assert.equal(getArcade().credits, 740);
assert.equal(getArcade().equipped.holo, "holo-amber");
assert.equal(getArcade().stats["podracing"].plays, 0);
for (const id of oldGames) {
  assert.equal(getArcade().stats[id].best, oldStats[id].best);
  assert.equal(getArcade().stats[id].wins, 1);
}
const previous = recordResult({ gameId: "defense-of-hoth", score: 999, won: true, perfect: false, seconds: 100 });
assert.ok(previous.achievements.some(({ id }) => id === "galactic-legend"), "The original five wins still unlock Galactic Legend.");
recordResult({ gameId: "podracing", score: 1080, won: true, perfect: true, seconds: 58 });
const persisted = JSON.parse(saved);
assert.equal(persisted.stats.podracing.best, 1080);
assert.equal(persisted.stats.podracing.wins, 1);
assert.equal(persisted.stats["speeder-racing"].bestTime, 62);
assert.equal(persisted.equipped.holo, "holo-amber");
console.log("Arcade save migration, podium record and legacy Galactic Legend passed.");
