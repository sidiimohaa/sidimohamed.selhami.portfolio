const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const THREE = require('three');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, file);
const { ORBITAL_BODIES: bodies, homeCameraZ } = require('../components/orbitalSystem.ts');
const { createApproachFlight } = require('../components/approachFlight.ts');
const obstacles = bodies.map(b => ({ position: new THREE.Vector3(...b.position), radius: b.radius }));

// Every destination must be wholly visible, separately selectable and reachable from home.
for (const aspect of [16 / 9, 4 / 3, 1, 390 / 844, 320 / 740, 844 / 390]) {
  const camera = new THREE.PerspectiveCamera(aspect < .8 ? 52 : 50, aspect, .1, 650);
  camera.position.set(0, 0, homeCameraZ(aspect, camera.fov));
  camera.updateMatrixWorld();
  const projected = bodies.map(b => {
    const point = new THREE.Vector3(...b.position).project(camera);
    const depth = camera.position.z - b.position[2];
    const ry = b.radius / (depth * Math.tan(camera.fov * Math.PI / 360));
    assert.ok(Math.abs(point.x) + ry / aspect < .9, `horizontal framing ${aspect}`);
    assert.ok(Math.abs(point.y) + ry < .82, `vertical framing ${aspect}`);
    assert.ok(point.z > -1 && point.z < 1, 'inside near/far planes');
    return { point, radius: ry };
  });
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = projected[i], b = projected[j];
    assert.ok(Math.hypot((a.point.x - b.point.x) * aspect, a.point.y - b.point.y) > a.radius + b.radius + .03,
      `separate silhouettes ${i}/${j}, aspect ${aspect}`);
  }
  // Simulate actual normal and reduced-motion navigation: home -> each body -> every other body.
  for (const reduced of [false, true]) for (let from = -1; from < bodies.length; from++) for (let to = 0; to < bodies.length; to++) {
    if (from === to) continue;
    camera.position.set(0, 0, homeCameraZ(aspect, camera.fov)); camera.quaternion.identity();
    const shipDistance = aspect < .8 ? 10 : 7;
    const shipHeight = shipDistance * Math.tan((aspect < .8 ? 52 : 50) * Math.PI / 360) * .48;
    const ship = new THREE.Group(); ship.position.copy(camera.position).add(new THREE.Vector3(0, -shipHeight, -shipDistance));
    const make = index => createApproachFlight({ camera, ship, destination: obstacles[index].position, radius: bodies[index].radius, shipDistance, shipHeight, reduced, obstacles });
    if (from >= 0) make(from).update(3600);
    const flight = make(to);
    let frames = 0;
    while (!flight.completed && frames++ < 600) {
      flight.update(1 / 60);
      assert.ok([...camera.position.toArray(), ...ship.position.toArray()].every(Number.isFinite), 'finite flight');
      for (const obstacle of obstacles) {
        assert.ok(ship.position.distanceTo(obstacle.position) >= obstacle.radius + 1.2,
          `ship clearance ${from}->${to} (${aspect}, frame ${frames})`);
        assert.ok(camera.position.distanceTo(obstacle.position) > obstacle.radius,
          `camera clearance ${from}->${to} (${aspect}, frame ${frames})`);
      }
    }
    assert.ok(flight.completed && frames <= 481, 'arrival within eight seconds');
  }
}
console.log('Orbital system: six aspect ratios, separate silhouettes, 300 normal/reduced approaches and collision checks passed.');
