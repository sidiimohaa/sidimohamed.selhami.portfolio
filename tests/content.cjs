const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, file);

const { destinations, briefings } = require("../components/universe.ts");
const { projects, identity, education, CV_PDF } = require("../components/deathStar/cvData.ts");

// Every destination has something to say, and says it with the CV's own words.
assert.equal(briefings.length, destinations.length, "one briefing per destination");
const source = JSON.stringify({ projects, identity, education });
for (const [index, briefing] of briefings.entries()) {
  const name = destinations[index].name;
  assert.ok(briefing.headline.trim().length > 12, `${name}: a headline`);
  assert.ok(briefing.points.length >= 2 && briefing.points.length <= 4, `${name}: two to four points`);
  for (const point of briefing.points) {
    assert.ok(point.label.trim() && point.text.trim(), `${name}: no empty point`);
    // The text of a point is quoted from the data, never written here.
    assert.ok(point.text.split(" · ").every((part) => source.includes(JSON.stringify(part).slice(1, -1))), `${name}: "${point.text}" comes from the CV data`);
  }
  // Nothing unfinished may reach a visitor.
  const shown = JSON.stringify(briefing);
  assert.ok(!/undefined|null|TODO|NaN/.test(shown), `${name}: nothing unfinished on screen`);
  for (const link of briefing.links ?? []) assert.ok(/^(mailto:|https:\/\/|\/)/.test(link.href), `${name}: a real link`);
}

// The contact and the record are reachable from their worlds.
assert.ok(briefings[2].links.some((link) => link.href.startsWith(`mailto:${identity.email}`)), "Coruscant writes to the pilot");
assert.ok(briefings[2].links.some((link) => link.href === identity.linkedin), "Coruscant links to LinkedIn");
assert.ok(briefings[3].links.some((link) => link.href === CV_PDF && link.download), "the station hands over the CV");
assert.ok(fs.existsSync(`public${CV_PDF}`), "the CV file is published");

console.log("content: ok");
