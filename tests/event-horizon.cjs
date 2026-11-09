const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const THREE = require("three");
require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, file);
const { createKonami } = require("../components/eventHorizon/konami.ts");
const { horizonFrame } = require("../components/eventHorizon/timeline.ts");
const { captureWorld } = require("../components/eventHorizon/worldGravity.ts");
const code = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "B", "A"];
const type = (detector, keys, eligible = true, start = 0) => keys.map((key, i) => detector.feed(key, start + i * 100, eligible));

assert.deepEqual(type(createKonami(), code), [...Array(9).fill(false), true]);
for (const blockedPlace of ["Coruscant", "Hoth", "Tatooine", "Endor", "Death Star", "transition"]) {
  assert.equal(type(createKonami(), code, false).some(Boolean), false, blockedPlace);
}
{
  const detector = createKonami();
  type(detector, code.slice(0, 8));
  detector.feed("b", 900, false);
  assert.equal(detector.feed("a", 1000, true), false, "Leaving space clears partial input");
  type(detector, code.slice(0, 9));
  assert.equal(detector.feed("a", 5000, true), false, "Stale sequences cannot activate");
  assert.equal(type(createKonami(), ["ArrowUp", ...code]).at(-1), true, "Overlapping prefixes remain valid");
  assert.equal(type(createKonami(), [...code.slice(0, 5), "x", ...code.slice(5)]).some(Boolean), false);
}
for (const reduced of [false, true]) {
  const end = reduced ? 11 : 20, voidAt = reduced ? 5.5 : 13, rebirthAt = reduced ? 6.5 : 14;
  assert.equal(horizonFrame(0, reduced).phase, "anomaly");
  assert.equal(horizonFrame(voidAt, reduced).phase, "void");
  assert.equal(horizonFrame(rebirthAt, reduced).phase, "rebirth");
  assert.equal(horizonFrame(end, reduced).done, true);
  assert.equal(horizonFrame(end, reduced).collapse, 0);
  for (let t = 0; t <= end; t += 0.01) {
    const frame = horizonFrame(t, reduced);
    for (const field of ["birth", "pull", "collapse", "rebuild", "blackout", "flash", "pressure"]) {
      assert.ok(Number.isFinite(frame[field]) && frame[field] >= 0 && frame[field] <= 1, `${field} at ${t}`);
    }
    if (t >= voidAt && t < rebirthAt) assert.equal(frame.blackout, 1, "One full second of darkness");
  }
}

// Interrupt at any point: actual scene nodes, materials and instance buffers must survive
// and return exactly to their captured pose. No cloning or reconstruction of game state.
for (const collapse of [0, 0.13, 0.5, 0.98, 1]) {
  const scene = new THREE.Scene();
  const planet = new THREE.Group(); planet.position.set(-25, 3, -19); planet.rotation.set(0.1, 0.5, 0.7); planet.scale.set(2, 3, 4);
  const material = new THREE.MeshStandardMaterial({ emissiveIntensity: 0.734 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), material); planet.add(mesh); scene.add(planet);
  const hidden = new THREE.Group(); hidden.visible = false; scene.add(hidden);
  const excluded = new THREE.Group(); scene.add(excluded);
  const light = new THREE.PointLight(0xffffff, 0.371); scene.add(light);
  const rocks = new THREE.InstancedMesh(mesh.geometry, material, 3);
  for (let i = 0; i < 3; i++) rocks.setMatrixAt(i, new THREE.Matrix4().makeTranslation(i * 7, 4, 9));
  scene.add(rocks);
  const orbit = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial()); scene.add(orbit);
  const before = planet.matrix.clone(); planet.updateMatrix(); before.copy(planet.matrix);
  const matrices = Array.from(rocks.instanceMatrix.array);
  const capture = captureWorld(scene, excluded);
  capture.update(collapse, new THREE.Vector3(0, 2, -95), new THREE.Vector3(0, 0, 1), 17, false);
  assert.equal(orbit.visible, false, "Orbit traces are hidden during the sequence");
  capture.restore(); planet.updateMatrix();
  assert.equal(orbit.visible, true, "Orbit traces come back on restore");
  assert.deepEqual(planet.matrix.elements, before.elements);
  assert.deepEqual(Array.from(rocks.instanceMatrix.array), matrices);
  assert.equal(material.emissiveIntensity, 0.734);
  assert.equal(light.intensity, 0.371);
  assert.equal(hidden.visible, false);
  assert.equal(planet.children[0], mesh);
  assert.equal(mesh.material, material);
  assert.equal(scene.children.length, 6);
  capture.restore(); // Idempotent restoration.
  mesh.geometry.dispose(); material.dispose(); orbit.geometry.dispose(); orbit.material.dispose();
}
console.log("Event Horizon: Konami gates, timing, darkness and exact scene restoration passed");
