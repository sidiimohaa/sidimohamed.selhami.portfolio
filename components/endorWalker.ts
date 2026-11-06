import * as THREE from "three";
import { galaxyAudio } from "./galaxy/audio";
import { galaxy } from "./galaxy/store";
import { glowTexture } from "./landingKit";
import { createSandtrooper } from "./stormtrooperModel";
import { bakePart, part, pipe, rounded } from "./tatooineCharacters";

// An All Terrain Scout Transport on patrol through the forest, two scouts at its feet. Before its
// event ends it walks into the Ewoks' trap, as in the battle of Endor: two great logs swing out of
// the canopy and crush its head between them.

const EVENT = "endor-atst";
const HEIGHT = 9.6;

// Worn grey plating: panel joints, chipped edges and streaks of grime running down.
function platingTexture() {
  const size = 512,
    canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#b9b6aa";
  c.fillRect(0, 0, size, size);
  let seed = 1983;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 90; i++) {
    const v = Math.round(160 + rnd() * 40);
    c.fillStyle = `rgba(${v},${v - 2},${v - 10},.5)`;
    c.fillRect(rnd() * size, rnd() * size, 20 + rnd() * 120, 14 + rnd() * 70);
  }
  c.strokeStyle = "rgba(40,38,34,.75)";
  c.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const x = rnd() * size,
      y = rnd() * size;
    c.strokeRect(x, y, 30 + rnd() * 130, 20 + rnd() * 90);
  }
  for (let i = 0; i < 160; i++) {
    c.fillStyle = `rgba(52,46,38,${0.05 + rnd() * 0.16})`;
    c.fillRect(rnd() * size, rnd() * size * 0.7, 1 + rnd() * 4, 30 + rnd() * 150);
  }
  for (let i = 0; i < 260; i++) {
    c.fillStyle = rnd() < 0.6 ? "rgba(36,32,28,.55)" : "rgba(235,232,222,.5)";
    c.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 3, 1 + rnd() * 2);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  return map;
}

type V3 = [number, number, number];
// A straight member between two points, of rectangular section.
function beam(parent: THREE.Object3D, a: V3, b: V3, w: number, d: number, material: THREE.Material) {
  const from = new THREE.Vector3(...a),
    span = new THREE.Vector3(...b).sub(from);
  const mesh = part(parent, rounded(w, span.length(), d, 0.04), material);
  mesh.position.copy(from).addScaledVector(span, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), span.normalize());
  return mesh;
}
function rod(parent: THREE.Object3D, a: V3, b: V3, r: number, material: THREE.Material, sides = 10) {
  const from = new THREE.Vector3(...a),
    span = new THREE.Vector3(...b).sub(from);
  const mesh = part(parent, new THREE.CylinderGeometry(r, r, span.length(), sides), material);
  mesh.position.copy(from).addScaledVector(span, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), span.normalize());
  return mesh;
}
// A disc whose axis runs across the machine: joints, drums and side hatches.
const drum = (parent: THREE.Object3D, x: number, y: number, z: number, r: number, depth: number, material: THREE.Material, sides = 24) => part(parent, new THREE.CylinderGeometry(r, r, depth, sides), material, [x, y, z], [0, 0, Math.PI / 2]);

// The head's hull: a side profile, wider at the top than at the chin, as seen from the front.
function headHull() {
  const profile: [number, number][] = [
    [-1.55, 0.35], [-1.55, 1.95], [-1.15, 2.35], [1.1, 2.1], [1.75, 1.45], [1.35, 0.25], [0.6, -0.05], [-0.9, -0.05],
  ];
  const half = (y: number) => 1.02 + (Math.max(0, y) / 2.35) * 0.52;
  const position: number[] = [],
    uv: number[] = [];
  const push = (x: number, y: number, z: number) => {
    position.push(x, y, z);
    uv.push(x * 0.3 + z * 0.3 + 0.5, y * 0.3);
  };
  const n = profile.length;
  for (let i = 0; i < n; i++) {
    const [za, ya] = profile[i],
      [zb, yb] = profile[(i + 1) % n];
    // Around the edge: the band between the two sides.
    const ax = half(ya),
      bx = half(yb);
    push(-ax, ya, za);
    push(-bx, yb, zb);
    push(bx, yb, zb);
    push(-ax, ya, za);
    push(bx, yb, zb);
    push(ax, ya, za);
  }
  // The two flanks, each as a fan.
  for (const side of [-1, 1]) {
    for (let i = 1; i < n - 1; i++) {
      const tri = side > 0 ? [0, i + 1, i] : [0, i, i + 1];
      tri.forEach((k) => push(side * half(profile[k][1]), profile[k][1], profile[k][0]));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function createATST() {
  const map = platingTexture();
  const armour = new THREE.MeshStandardMaterial({ color: 0xc9c6ba, map, roughness: 0.68, metalness: 0.3, side: THREE.DoubleSide });
  const shade = new THREE.MeshStandardMaterial({ color: 0x7c7a70, map, roughness: 0.62, metalness: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x24241f, roughness: 0.55, metalness: 0.55 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x55544d, roughness: 0.42, metalness: 0.8 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a0d0e, roughness: 0.18, metalness: 0.6, emissive: 0x260d0a });
  armour.userData.surfaceKind = shade.userData.surfaceKind = dark.userData.surfaceKind = steel.userData.surfaceKind = "metal";
  const root = new THREE.Group();
  root.name = "at-st";
  root.userData.character = true;

  // Pelvis: the cross-beam between the hips, its drums, power packs and bundles of hoses.
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 4.95, 0.35);
  root.add(pelvis);
  part(pelvis, rounded(2.3, 0.62, 1.15, 0.1), shade, [0, 0, 0]);
  part(pelvis, rounded(1.1, 0.5, 0.7, 0.08), dark, [0, -0.45, 0.25]);
  for (const side of [-1, 1]) {
    drum(pelvis, side * 0.82, 0.02, 0.55, 0.32, 0.5, dark, 16);
    drum(pelvis, side * 0.82, 0.02, 0.55, 0.16, 0.56, steel, 12);
    part(pelvis, rounded(0.5, 0.36, 0.5, 0.05), steel, [side * 0.55, -0.42, -0.35]);
    pipe(pelvis, [[side * 0.25, -0.2, 0.62], [side * 0.5, -0.62, 0.62], [side * 1.05, -0.5, 0.4]], 0.05, dark);
    pipe(pelvis, [[side * 0.1, -0.28, 0.5], [side * 0.3, -0.78, 0.35], [side * 0.9, -0.62, 0.1]], 0.04, dark);
  }
  // The neck: a stack of rings on which the head turns.
  part(pelvis, new THREE.CylinderGeometry(0.62, 0.7, 0.26, 24), steel, [0, 0.42, -0.1]);
  part(pelvis, new THREE.TorusGeometry(0.66, 0.05, 8, 24), dark, [0, 0.56, -0.1], [Math.PI / 2, 0, 0]);
  part(pelvis, new THREE.CylinderGeometry(0.5, 0.56, 0.42, 20), shade, [0, 0.74, -0.1]);
  part(pelvis, new THREE.CylinderGeometry(0.32, 0.32, 0.5, 14), dark, [0, 1.1, -0.1]);
  bakePart(pelvis);

  const head = new THREE.Group();
  head.position.set(0, 6.25, 0.25);
  root.add(head);
  part(head, headHull(), armour);
  // The broad front plate and its joints, the two dark view slits above it, the roof and vents.
  const front = part(head, rounded(1.9, 1.2, 0.07, 0.03), armour, [0, 0.88, 1.58]);
  front.rotation.x = -0.32;
  [-0.56, 0.56].forEach((x) => {
    const slit = part(head, rounded(0.7, 0.28, 0.08, 0.03), glass, [x, 1.73, 1.47]);
    slit.rotation.x = -0.82;
    const visor = part(head, rounded(0.8, 0.07, 0.3, 0.02), shade, [x, 1.97, 1.27]);
    visor.rotation.x = 0.3;
  });
  part(head, rounded(0.05, 0.9, 0.03, 0.01), dark, [0, 0.95, 1.64]).rotation.x = -0.32;
  part(head, new THREE.CylinderGeometry(0.46, 0.5, 0.1, 18), shade, [0, 2.36, -0.3]);
  part(head, new THREE.CylinderGeometry(0.3, 0.3, 0.05, 14), dark, [0, 2.42, -0.3]);
  pipe(head, [[-0.9, 2.24, 0.45], [-0.9, 2.42, 0.1], [0.9, 2.42, 0.1], [0.9, 2.24, 0.45]], 0.028, steel);
  for (let i = 0; i < 5; i++) part(head, rounded(1.5, 0.1, 0.05, 0.015), dark, [0, 0.72 + i * 0.22, -1.58]);
  part(head, rounded(1.9, 0.5, 0.25, 0.04), shade, [0, 0.22, -1.42]);
  // The chin: a dark notch with the twin guns and their cluster of barrels, as in the film.
  part(head, rounded(0.74, 0.52, 0.5, 0.04), dark, [0, 0.2, 1.26]);
  part(head, rounded(0.5, 0.2, 0.5, 0.03), steel, [0, 0.05, 1.42]);
  for (const x of [-0.17, 0, 0.17]) {
    rod(head, [x, 0.34, 1.45], [x, 0.34, 1.78], 0.055, steel);
    rod(head, [x, 0.34, 1.78], [x, 0.34, 1.82], 0.035, dark);
  }
  for (const x of [-0.14, 0.14]) rod(head, [x, 0.04, 1.5], [x, 0.04, 2.5], 0.04, dark);
  // Side hatches: great round discs, ringed and bolted, each carrying a weapon.
  for (const side of [-1, 1]) {
    const x = side * 1.34;
    drum(head, x, 1.05, -0.1, 0.92, 0.16, shade, 32);
    part(head, new THREE.TorusGeometry(0.76, 0.05, 8, 32), armour, [x + side * 0.09, 1.05, -0.1], [0, Math.PI / 2, 0]);
    drum(head, x + side * 0.08, 1.05, -0.1, 0.46, 0.18, armour, 24);
    drum(head, x + side * 0.13, 1.05, -0.1, 0.22, 0.14, dark, 6);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      drum(head, x + side * 0.1, 1.05 + Math.sin(a) * 0.62, -0.1 + Math.cos(a) * 0.62, 0.05, 0.05, dark, 6);
    }
    part(head, rounded(0.16, 0.7, 0.9, 0.03), armour, [side * 1.18, 0.5, 0.95]);
  }
  // On the left, a small ball mount; on the right, a twin gun behind its guard.
  part(head, new THREE.SphereGeometry(0.26, 14, 10), dark, [-1.62, 1.05, 0.25]);
  part(head, new THREE.TorusGeometry(0.26, 0.035, 6, 16), steel, [-1.62, 1.05, 0.25], [0, Math.PI / 2, 0]);
  rod(head, [-1.62, 1.05, 0.25], [-1.62, 1.05, 1.15], 0.05, dark);
  part(head, rounded(0.34, 0.4, 0.7, 0.04), dark, [1.68, 1.05, 0.35]);
  for (const y of [0.92, 1.18]) rod(head, [1.68, y, 0.65], [1.68, y, 1.75], 0.045, dark);
  part(head, rounded(0.06, 0.74, 0.5, 0.02), shade, [1.92, 1.05, 0.9]);
  bakePart(head);

  const legs = [-1, 1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 1.42, 4.95, 0.35);
    root.add(hip);
    drum(hip, 0, 0, 0, 0.44, 0.5, shade);
    drum(hip, side * 0.28, 0, 0, 0.22, 0.1, steel, 14);
    // The thigh runs back from the hip: an armoured plate over a pair of struts, with hoses.
    beam(hip, [0, 0, 0], [0, -0.55, -1.95], 0.42, 0.42, armour);
    beam(hip, [side * 0.26, 0.05, -0.1], [side * 0.26, -0.45, -1.7], 0.08, 0.22, dark);
    beam(hip, [-side * 0.26, 0.05, -0.1], [-side * 0.26, -0.45, -1.7], 0.08, 0.22, dark);
    pipe(hip, [[side * 0.3, -0.2, 0.2], [side * 0.34, -0.5, -0.9], [side * 0.28, -0.75, -1.7]], 0.035, dark);
    rod(hip, [-side * 0.05, -0.28, -0.25], [-side * 0.05, -0.68, -1.55], 0.05, steel);
    const knee = new THREE.Group();
    knee.position.set(0, -0.55, -1.95);
    hip.add(knee);
    // The knee, at the back: a big drum with the ovoid cover on its outer side.
    drum(knee, 0, 0, 0, 0.5, 0.52, shade);
    drum(knee, side * 0.3, 0, 0, 0.26, 0.08, dark, 14);
    part(knee, new THREE.SphereGeometry(1, 18, 14), armour, [side * 0.44, 0.02, 0]).scale.set(0.26, 0.66, 0.5);
    // The long shin, straight down: a plated box with a slot, a piston and side brackets.
    beam(knee, [0, -0.1, 0.02], [0, -2.75, 0.12], 0.44, 0.5, armour);
    part(knee, rounded(0.2, 1.7, 0.06, 0.02), dark, [0, -1.45, 0.34]);
    rod(knee, [side * 0.3, -0.4, -0.18], [side * 0.3, -2.4, -0.1], 0.05, steel);
    for (const y of [-0.8, -1.7, -2.3]) drum(knee, -side * 0.28, y, 0.04, 0.08, 0.1, dark, 8);
    const ankle = new THREE.Group();
    ankle.position.set(0, -2.75, 0.12);
    knee.add(ankle);
    drum(ankle, 0, 0, 0, 0.32, 0.5, shade);
    drum(ankle, side * 0.28, 0, 0, 0.14, 0.06, dark, 10);
    // The lower link, raked forward to the foot, with its second strut.
    beam(ankle, [0, 0, 0], [0, -1.35, 1.25], 0.32, 0.3, armour);
    rod(ankle, [side * 0.22, -0.1, -0.1], [side * 0.22, -1.2, 0.98], 0.045, steel);
    const foot = new THREE.Group();
    foot.position.set(0, -1.35, 1.25);
    ankle.add(foot);
    // A shallow dome with a rim, two toes in front and a spur behind.
    drum(foot, 0, 0.18, 0, 0.22, 0.46, shade, 14);
    const dome = part(foot, new THREE.SphereGeometry(1, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), armour, [0, -0.3, 0]);
    dome.scale.set(0.8, 0.44, 0.92);
    part(foot, new THREE.CylinderGeometry(0.84, 0.9, 0.08, 24), shade, [0, -0.27, 0]).scale.z = 1.12;
    for (const x of [-0.3, 0.3]) {
      beam(foot, [x * 0.6, -0.05, 0.45], [x, -0.26, 1.28], 0.22, 0.16, shade);
      part(foot, new THREE.ConeGeometry(0.11, 0.3, 6), dark, [x, -0.28, 1.42], [Math.PI / 2, 0, 0]);
    }
    beam(foot, [0, -0.08, -0.5], [0, -0.26, -1.08], 0.2, 0.16, shade);
    bakePart(foot);
    bakePart(ankle);
    bakePart(knee);
    bakePart(hip);
    return { hip, knee, ankle, foot };
  });
  return { root, pelvis, head, legs };
}

export function createEndorWalker(path: THREE.Curve<THREE.Vector3>) {
  const group = new THREE.Group();
  group.name = "endor-atst";
  group.visible = false;
  const walker = createATST();
  group.add(walker.root);
  const scouts = [createSandtrooper(), createSandtrooper()];
  scouts.forEach((scout) => group.add(scout.group));
  // The trap: two trunks on ropes, high in the canopy.
  const bark = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.98 });
  const rope = new THREE.MeshStandardMaterial({ color: 0x8a7a58, roughness: 1 });
  const logs = [-1, 1].map(() => {
    const pivot = new THREE.Group();
    pivot.visible = false;
    group.add(pivot);
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 7.5, 12), bark);
    log.rotation.x = Math.PI / 2;
    log.position.y = -11;
    pivot.add(log);
    for (const z of [-2.6, 2.6]) {
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 11, 5), rope);
      line.position.set(0, -5.5, z);
      pivot.add(line);
    }
    return pivot;
  });
  const glow = glowTexture();
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffb060, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  flash.visible = false;
  group.add(flash);
  const smoke = Array.from({ length: 8 }, () => {
    const puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x2a2c2c, transparent: true, depthWrite: false, opacity: 0 }));
    puff.visible = false;
    group.add(puff);
    return puff;
  });
  const point = new THREE.Vector3(),
    ahead = new THREE.Vector3();
  const FROM = 0.24,
    LENGTH = path.getLength();
  // Slow enough to spend the event along the near side of the clearing, where the trap can be seen.
  const SPEED = 0.85;
  let key = -1,
    age = 0,
    strike = -1,
    stride = 0;
  const at = (u: number, out: THREE.Vector3) => path.getPointAt(THREE.MathUtils.clamp(u, 0, 1), out).setY(0);
  return {
    group,
    tick(dt: number, reduced: boolean, time: number) {
      const run = galaxy().activeAt("endor").find((item) => item.id === EVENT);
      if (run && run.key !== key) {
        key = run.key;
        age = 0;
        strike = -1;
        stride = 0;
        walker.root.rotation.set(0, 0, 0);
        walker.root.position.y = 0;
        logs.forEach((pivot) => (pivot.visible = false));
        flash.visible = false;
        smoke.forEach((puff) => (puff.visible = false));
      }
      group.visible = !!run;
      if (!run) return;
      age += dt;
      const span = run.endsAt - run.startedAt;
      const walking = strike < 0 && !reduced;
      if (strike < 0 && age > span - 13 && !reduced) strike = 0;
      const u = FROM + (Math.min(age, span - 13) * SPEED) / LENGTH;
      at(u, point);
      at(u + 0.006, ahead);
      group.position.set(0, 0, 0);
      if (strike < 0 || strike < 0.01) {
        walker.root.position.set(point.x, 0, point.z);
        walker.root.rotation.y = Math.atan2(ahead.x - point.x, ahead.z - point.z);
      }
      if (walking) stride += dt * 1.1;
      // A long, deliberate stride. The shin swings under the rear knee; the thigh lifts the leg as it
      // comes forward; the foot stays level throughout.
      walker.legs.forEach((leg, i) => {
        const phase = stride + i * Math.PI;
        const lift = reduced ? 0 : Math.max(0, Math.cos(phase));
        leg.hip.rotation.x = 0.17 * lift;
        leg.knee.rotation.x = reduced ? 0 : -Math.sin(phase) * 0.26;
        leg.ankle.rotation.x = -0.1 * lift;
        leg.foot.rotation.x = -(leg.hip.rotation.x + leg.knee.rotation.x + leg.ankle.rotation.x);
      });
      if (walking) {
        walker.root.rotation.z = Math.sin(stride) * 0.02;
        walker.root.position.y = Math.abs(Math.sin(stride)) * 0.1 - 0.1;
        walker.head.rotation.y = Math.sin(time * 0.35) * 0.4;
      }
      scouts.forEach((scout, i) => {
        const behind = u - (i ? 0.012 : 0.02);
        at(behind, point);
        at(behind + 0.006, ahead);
        point.x += i ? 1.8 : -1.8;
        ahead.x += i ? 1.8 : -1.8;
        scout.group.position.copy(point);
        scout.group.rotation.y = Math.atan2(ahead.x - point.x, ahead.z - point.z);
        scout.tick(time, walking, reduced);
      });
      // The logs, then the head caves in and the walker folds up.
      if (strike >= 0) {
        strike += dt;
        const yaw = walker.root.rotation.y;
        logs.forEach((pivot, i) => {
          const side = i ? 1 : -1;
          pivot.visible = true;
          pivot.position.set(walker.root.position.x + Math.cos(yaw) * side * 0.1, HEIGHT + 11 - 2.4, walker.root.position.z - Math.sin(yaw) * side * 0.1);
          pivot.rotation.y = yaw;
          // From high on each side down to the head, meeting in about a second.
          const swing = THREE.MathUtils.smootherstep(strike, 0.4, 1.45);
          pivot.rotation.z = side * (1.15 * (1 - swing) + 0.11);
        });
        if (strike > 1.45) {
          const fall = THREE.MathUtils.smootherstep(strike, 1.6, 3.3);
          walker.head.scale.set(1 - Math.min(0.35, (strike - 1.45) * 3), 1, 1);
          walker.head.rotation.x = 0.5 * fall;
          walker.root.position.y = -0.7 * fall;
          walker.root.rotation.x = 0.92 * fall;
          walker.legs.forEach((leg) => {
            leg.hip.rotation.x = -0.75 * fall;
            leg.knee.rotation.x = 1.25 * fall;
            leg.ankle.rotation.x = -0.9 * fall;
            leg.foot.rotation.x = 0.4 * fall;
          });
          if (!flash.visible && strike < 1.7) {
            flash.visible = true;
            flash.position.copy(walker.root.position).setY(6);
            flash.scale.setScalar(4);
            galaxyAudio.thunder(0.5);
            smoke.forEach((puff, i) => {
              puff.visible = true;
              puff.position.copy(flash.position).add(point.set(Math.sin(i * 1.7) * 1.6, i * 0.2, Math.cos(i * 1.7) * 1.6));
            });
          }
          const t = strike - 1.45;
          flash.scale.setScalar(4 + t * 24);
          flash.material.opacity = Math.max(0, 1 - t * 1.3);
          smoke.forEach((puff, i) => {
            puff.position.y += dt * (0.5 + i * 0.1);
            puff.scale.setScalar(2.6 + t * 1.4);
            puff.material.opacity = Math.min(0.45, t * 0.5) * Math.max(0, 1 - (t - 6) * 0.2);
          });
        }
      } else {
        walker.head.scale.set(1, 1, 1);
      }
    },
  };
}
