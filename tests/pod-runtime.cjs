const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");
const THREE = require("three");

require.extensions[".ts"] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, filename);
};

global.matchMedia = () => ({ matches: false });
global.window = { devicePixelRatio: 2, addEventListener() {}, removeEventListener() {} };
global.document = { hidden: false };

let frame;
let stage;
let disposed = 0;
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "../jedi/stage" && parent.filename.endsWith("/podracing/runtime.ts")) {
    return {
      createStage(_mount, tick) {
        frame = tick;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(59, 16 / 9, .05, 1900);
        stage = { scene, camera, renderer: { setPixelRatio() {} }, dispose() { disposed++; } };
        return stage;
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { mountPodRace } = require("../components/podracing/runtime.ts");
Module._load = originalLoad;
const { tracks } = require("../components/podracing/tracks.ts");
const { neutralInput, upgradeKeys } = require("../components/podracing/types.ts");
let state;
let finish = 0;
const track = tracks.boonta;
const runtime = mountPodRace({ clientWidth: 1280 }, {
  track, mode: "time", difficulty: "rookie", laps: 1, reduced: false, sound: false,
  upgrades: Object.fromEntries(upgradeKeys.map((key) => [key, 0])),
}, { onState(value) { state = value; }, onFinish() { finish++; } });
assert.ok(runtime);
assert.ok(stage.scene.children.length > 0, "The actual race world was mounted.");
function advance(frames) { for (let i = 0; i < frames; i++) frame(1 / 60); }
runtime.setInput({ ...neutralInput, throttle: true });
advance(335);
assert.equal(state.phase, "racing");
assert.ok(state.player.speed > 20);
const time = state.time;
runtime.setPaused(true);
advance(35);
assert.equal(state.time, time);
runtime.setPaused(false);
runtime.setInput({ ...neutralInput, throttle: true, steer: .55 });
advance(29);
assert.ok(state.player.lane < -1, "The right input moves to screen right for a +Z-oriented pod.");
const at = track.sample(state.player.distance);
const centre = new THREE.Vector3(at.x, at.y + 2.4, at.z);
const rider = centre.clone().add(new THREE.Vector3(Math.cos(at.heading), 0, -Math.sin(at.heading)).multiplyScalar(state.player.lane));
stage.camera.updateMatrixWorld(true);
assert.ok(rider.project(stage.camera).x > centre.project(stage.camera).x, "The camera confirms the steering direction.");
const chase = stage.camera.position.clone();
runtime.setCamera("cockpit");
advance(1);
assert.ok(chase.distanceTo(stage.camera.position) > 4);
runtime.dispose();
runtime.dispose();
assert.equal(disposed, 1);
assert.equal(finish, 0, "Leaving mid-race never awards a result.");
console.log("Race scene, screen steering, pause, cockpit camera and cleanup passed.");
