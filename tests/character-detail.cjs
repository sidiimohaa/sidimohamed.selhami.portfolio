const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const THREE = require('three');

for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (module, file) => {
  module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, file);
};
// Exercise the real geometry and animation code, without claiming a GPU render test.
global.document = { createElement: () => {
  const canvas = { width: 1, height: 1 }, noop = () => {};
  const context = new Proxy({ canvas, measureText: t => ({ width: t.length * 8 }),
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
  }, { get: (o, k) => k in o ? o[k] : noop });
  canvas.getContext = () => context;
  return canvas;
} };

const { enrichMaterials } = require('../components/render/materialDetail.ts');
const { looks } = require('../components/render/looks.ts');
const { createSeatedGrogu, earGeometry } = require('../components/groguModel.ts');
const { createSeatedHanSolo } = require('../components/hanSoloModel.ts');
const { createSeatedChewbacca } = require('../components/chewbaccaModel.ts');
const { createResidentModel } = require('../components/tatooineResidentModels.ts');
const { createJawa } = require('../components/jawaModels.ts');
const { createSandtrooper } = require('../components/stormtrooperModel.ts');
const { createCantinaCrowd } = require('../components/cantinaCrowd.ts');
const { createEndorVillage } = require('../components/endorVillage.ts');
const { createPadLife } = require('../components/coruscantLife.ts');

const stats = [];
function checkScene(name, root, limit = Infinity) {
  let meshes = 0, vertices = 0;
  root.updateMatrixWorld(true);
  root.traverse(object => {
    assert.ok(object.matrixWorld.elements.every(Number.isFinite), `${name}: finite animated transforms`);
    if (!object.isMesh) return;
    meshes++;
    const positions = object.geometry.getAttribute('position');
    vertices += positions.count;
    for (const attribute of ['position', 'normal']) {
      const values = object.geometry.getAttribute(attribute)?.array;
      if (values) assert.ok(values.every(Number.isFinite), `${name}: finite ${attribute}`);
    }
  });
  assert.ok(meshes > 0 && meshes <= limit, `${name}: details stay batched (${meshes}/${limit})`);
  stats.push({ name, meshes, vertices });
}
function transforms(root) {
  const result = [];
  root.updateMatrixWorld(true);
  root.traverse(o => result.push(...o.matrixWorld.elements));
  return result;
}

// Articulated hero parts must survive static geometry baking and reduced motion.
const grogu = createSeatedGrogu();
grogu.tick(0, false);
const resting = transforms(grogu.group);
grogu.setForcePose(1);
assert.notDeepEqual(transforms(grogu.group), resting, 'Grogu still reaches for the bowl');
grogu.setForcePose(0);
assert.deepEqual(transforms(grogu.group), resting, 'Force pose returns to rest');
const lid = grogu.head.getObjectByName('grogu-left-eyelid');
grogu.tick(3.42, false);
assert.ok(lid.scale.y > .03, 'eyelids animate independently from the baked head');
grogu.tick(3.42, true);
assert.equal(lid.scale.y, .007, 'reduced motion opens the eyelids');
checkScene('Grogu', grogu.group, 32);
for (const [name, create, reaction] of [
  ['Han', createSeatedHanSolo, { look: 1, smug: .8, annoyed: .2 }],
  ['Chewbacca', createSeatedChewbacca, { look: 1, roar: .8, proud: .2 }],
]) {
  const hero = create();
  hero.tick(0, false);
  const before = transforms(hero.group);
  hero.play(1); hero.react(reaction); hero.tick(2, false);
  assert.notDeepEqual(transforms(hero.group), before, `${name}: Dejarik reactions remain articulated`);
  hero.play(0); hero.tick(5, true); hero.react(reaction);
  const still = transforms(hero.group);
  hero.tick(50, true);
  assert.deepEqual(transforms(hero.group), still, `${name}: reduced motion is stable`);
  checkScene(name, hero.group, 90);
}

// Both ears must remain visible from front and back, with mirrored bounds.
const left = earGeometry(-1), right = earGeometry(1);
left.computeBoundingBox(); right.computeBoundingBox();
assert.ok(Math.abs(left.boundingBox.min.x + right.boundingBox.max.x) < 1e-6);
for (const ear of [left, right]) {
  const normals = ear.getAttribute('normal');
  assert.ok(normals.getZ(0) > .8 && normals.getZ(97) < -.8, 'outward ear normals on both sides');
  ear.dispose();
}
for (const kind of ['kx', 'b1', 'b2', 'tusken', 'toydarian', 'gungan']) {
  const resident = createResidentModel(kind);
  resident.tick(3, false); resident.tick(4, true);
  const still = transforms(resident.group);
  resident.tick(50, true);
  assert.deepEqual(transforms(resident.group), still, `${kind}: reduced motion`);
  checkScene(kind, resident.group, 60);
}
checkScene('Jawa', createJawa().group, 30);
const trooper = createSandtrooper(true);
trooper.tick(3, true, false);
assert.ok(trooper.knees.some(knee => knee.rotation.x > .05), 'knees remain articulated');
trooper.tick(4, true, true);
checkScene('Sandtrooper', trooper.group, 55);
const crowd = createCantinaCrowd();
crowd.tick(1, false); crowd.tick(1.05, false);
for (const type of ['dome', 'snout', 'fins', 'hood', 'human']) {
  assert.ok(crowd.group.getObjectByName(`cantina-patron-${type}`), `${type} is present in the cantina`);
}
assert.equal(crowd.actions.length, 2, 'bounty puck and Grogu interactions are retained');
checkScene('Cantina', crowd.group);
const village = createEndorVillage({ terminals: [] }, []);
village.tick(.05, false);
checkScene('Ewok', village.group.getObjectByName('ewok-villager'), 45);
const pad = createPadLife({ glow: new THREE.Texture(), engines: [], notify: () => {}, taxi: false, drone: false, guard: false });
pad.tick(.05, 2, false, { x: 100, z: 100, r: .5 });
const crew = pad.group.children.filter(child => child.userData.character);
assert.ok(crew.length >= 2, 'pad crew are present');
for (const person of crew) checkScene('Pad crew', person, 35);

function compileHook(material) {
  const source = THREE.ShaderLib.standard;
  const shader = { vertexShader: source.vertexShader, fragmentShader: source.fragmentShader, uniforms: THREE.UniformsUtils.clone(source.uniforms) };
  material.onBeforeCompile(shader, {});
  return shader;
}
function surface(kind, detail = looks.hoth.detail, tier = 2, physical = false) {
  const material = physical ? new THREE.MeshPhysicalMaterial({ clearcoat: .3 }) : new THREE.MeshStandardMaterial();
  if (kind) material.userData.surfaceKind = kind;
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), material));
  enrichMaterials(root, detail, tier);
  return { root, material, shader: compileHook(material) };
}
// Planet deposits and wall panels must never be projected onto an animated face.
for (const kind of ['skin', 'cloth', 'fur', 'leather', 'metal']) {
  const { root, material, shader } = surface(kind, looks.hoth.detail, 2, kind === 'metal');
  assert.match(shader.fragmentShader, /vec3 dSurface = vDetailLocal;/);
  assert.match(shader.fragmentShader, /float dTop = .* \* 0\.0000;/);
  assert.match(shader.fragmentShader, /float dSeam = 0\.0;/);
  assert.match(shader.vertexShader, /inverseTransformDirection\(transformedNormal, viewMatrix\)/);
  const hook = material.onBeforeCompile;
  enrichMaterials(root, looks.hoth.detail, 2);
  assert.equal(material.onBeforeCompile, hook, 'enrichment is idempotent');
}
assert.match(surface().shader.fragmentShader, /vec3 dSurface = dW;/, 'architecture retains world-space weathering');
assert.doesNotMatch(surface('skin', looks.hoth.detail, 0).shader.fragmentShader, /vDetailLocal/, 'low tier keeps original material');
assert.doesNotMatch(surface('cloth', looks.hoth.detail, 1).shader.fragmentShader, /float dHeight/, 'medium tier omits bump work');
const first = surface(undefined).material;
const changed = surface(undefined, { ...looks.hoth.detail, bump: .04, grime: [.1, .2, .3] }).material;
assert.notEqual(first.customProgramCacheKey(), changed.customProgramCacheKey(), 'different shader treatments do not share a GPU program');
// Indoor architecture and optical surfaces are preserved; skin indoors is enriched.
const indoor = new THREE.Group(), actor = new THREE.Group(); actor.userData.character = true;
const wall = new THREE.MeshStandardMaterial(), skin = new THREE.MeshStandardMaterial(), eye = new THREE.MeshStandardMaterial();
wall.userData.indoors = skin.userData.indoors = true;
skin.userData.surfaceKind = 'skin'; eye.userData.skipSurfaceDetail = true;
const previousHook = shader => { shader.uniforms.customUniform = { value: 1 }; };
skin.onBeforeCompile = previousHook;
skin.customProgramCacheKey = () => 'existing-character-hook';
for (const material of [skin, eye]) actor.add(new THREE.Mesh(new THREE.SphereGeometry(.1), material));
indoor.add(actor, new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), wall));
enrichMaterials(indoor, looks.tatooine.detail, 3);
assert.equal(wall.userData.detailApplied, undefined);
assert.equal(eye.userData.detailApplied, undefined);
assert.equal(skin.userData.detailApplied, true);
assert.equal(compileHook(skin).uniforms.customUniform.value, 1, 'existing shader hooks are preserved');
assert.ok(skin.customProgramCacheKey().startsWith('existing-character-hook|'));
console.table(stats);
console.log('Character geometry, articulation, interaction contracts and material shader hooks passed.');
