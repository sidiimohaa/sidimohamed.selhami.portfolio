import * as THREE from "three";
import type { PadEvent } from "./coruscantLife";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { glowTexture, random, type Reveal, type Spot, type ZoneAction } from "./landingKit";
import { createHeroDroids, part } from "./tatooineCharacters";
import { snowCover } from "./weathering";
import { createWampa } from "./wampaModel";

// What hides in and around Echo Base's hangar: a wampa's ice cave in the west wall with Luke's
// lightsaber planted at its mouth, and R2-D2 watching the storm for his master.

// The cave is carved into the west wall: an ice facade follows the cliff with a ragged arch in it,
// and behind it lies a lit chamber of blue ice where the wampa waits.
export const WAMPA_CAVE = { x: -25.6, z: 30 };
const CHAMBER: [number, number, number] = [3.4, 3.8, 4.3];
const ARCH = { z: 30, halfWidth: 1.8, height: 3.2 };
const R2_SPOT = { x: -7, z: 34.4 };
type Walker = { x: number; z: number; yaw: number };
const shortest = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
const smooth = (value: number, from: number, to: number) => {
  const t = THREE.MathUtils.clamp((value - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
};
// The facade leans back with the cliff and tucks its edges into the rock.
const facadeX = (y: number, z: number) =>
  -21.95 - 0.12 * y - smooth(Math.max(Math.abs(z - ARCH.z) / 7, y / 15), 0.55, 1) * 3 + 0.22 * Math.sin(z * 1.7 + y * 0.9) + 0.12 * Math.sin(y * 2.3 - z * 1.1);
const bulge = (x: number, y: number, z: number) => 1 + 0.08 * Math.sin(3.1 * x + 4.7 * z + 1.3 * y) + 0.05 * Math.sin(7.3 * y + 2.9 * z + 5 * x);

function iceCave(glow: THREE.Texture) {
  const group = new THREE.Group();
  group.name = "hoth-wampa-cave";
  const pale = new THREE.Color(0xc8dcea),
    blue = new THREE.Color(0x86aecb),
    deep = new THREE.Color(0x5c86a8),
    tint = new THREE.Color();
  const ice = new THREE.MeshStandardMaterial({ color: 0xd6ebf7, roughness: 0.22, metalness: 0.02, emissive: 0x1a3a50, emissiveIntensity: 0.3 });

  // The facade, a ragged arch cut out of it.
  const zs: number[] = [],
    ys: number[] = [];
  for (let z = 23; z <= 37.001; z += 0.25) zs.push(z);
  for (let y = -0.2; y <= 15.001; y += 0.25) ys.push(y);
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  ys.forEach((y) =>
    zs.forEach((z) => {
      positions.push(facadeX(y, z), y, z);
      tint.copy(pale).lerp(blue, 0.5 + 0.5 * Math.sin(z * 2.1 + y * 0.7) * Math.sin(y * 1.3));
      colors.push(tint.r, tint.g, tint.b);
    }),
  );
  const inArch = (y: number, z: number) => Math.pow((z - ARCH.z) / ARCH.halfWidth, 2) + Math.pow(y / ARCH.height, 2) < 1;
  for (let j = 0; j < ys.length - 1; j++)
    for (let i = 0; i < zs.length - 1; i++) {
      if (inArch(ys[j] + 0.125, zs[i] + 0.125)) continue;
      const a = j * zs.length + i,
        b = a + 1,
        c = a + zs.length,
        d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  const facade = new THREE.BufferGeometry();
  facade.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  facade.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  facade.setIndex(indices);
  facade.computeVertexNormals();
  group.add(new THREE.Mesh(facade, snowCover(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), 0.7)));
  // A thick lip of ice round the arch, and icicles hanging from its crown like teeth.
  const lip: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI,
      y = ARCH.height * Math.sin(a) * 1.02,
      z = ARCH.z + ARCH.halfWidth * Math.cos(a) * 1.02;
    lip.push(new THREE.Vector3(facadeX(y, z) + 0.05, y, z));
  }
  part(group, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lip), 60, 0.2, 8, false), ice);
  const rand = random(4242);
  for (let i = 0; i < 9; i++) {
    const a = 0.45 + (i / 8) * 2.25,
      y = ARCH.height * Math.sin(a) * 0.96,
      z = ARCH.z + ARCH.halfWidth * Math.cos(a) * 0.96,
      length = 0.3 + rand() * 0.6;
    part(group, new THREE.ConeGeometry(0.06 + rand() * 0.05, length, 6), ice, [facadeX(y, z) - 0.05, y - length / 2, z], [Math.PI, 0, 0]);
  }
  // A short vaulted passage leads from the arch into the chamber.
  const passage = new THREE.CylinderGeometry(1, 1, 1.8, 24, 1, true, 0, Math.PI).rotateZ(Math.PI / 2);
  passage.scale(1, ARCH.height, ARCH.halfWidth);
  part(group, passage, new THREE.MeshStandardMaterial({ color: 0xbcd6e8, roughness: 0.3, emissive: 0x1a3a50, emissiveIntensity: 0.3, side: THREE.BackSide }), [facadeX(0, ARCH.z) - 0.85, 0, ARCH.z]);

  // The chamber: a lumpy hollow of ice with a flat floor, paler at the mouth.
  const shell = new THREE.IcosahedronGeometry(1, 4);
  shell.deleteAttribute("normal");
  shell.deleteAttribute("uv");
  const chamber = mergeVertices(shell);
  shell.dispose();
  const cp = chamber.getAttribute("position"),
    shellColors: number[] = [];
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i),
      y = cp.getY(i),
      z = cp.getZ(i),
      f = bulge(x, y, z);
    cp.setXYZ(i, x * CHAMBER[0] * f, Math.max(0, y) * CHAMBER[1] * f, z * CHAMBER[2] * f);
    tint.copy(pale).lerp(deep, (1 - (x + 1) / 2) * 0.6 + 0.2 * Math.sin(z * 9 + y * 5));
    shellColors.push(tint.r, tint.g, tint.b);
  }
  chamber.setAttribute("color", new THREE.Float32BufferAttribute(shellColors, 3));
  chamber.computeVertexNormals();
  part(group, chamber, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.04, emissive: 0x16344a, emissiveIntensity: 0.35, side: THREE.BackSide }), [WAMPA_CAVE.x, 0, WAMPA_CAVE.z]);
  part(group, new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf2f6fa, roughness: 0.9 }), [WAMPA_CAVE.x, 0.02, WAMPA_CAVE.z]).scale.set(CHAMBER[0] * 0.98, 1, CHAMBER[2] * 0.98);
  part(group, new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xeef3f8, roughness: 0.9 }), [facadeX(0, ARCH.z) + 0.2, -0.02, ARCH.z]).scale.set(1.3, 0.22, 2);
  // Icicles hang from the ceiling and ice spikes rise from the floor round the walls.
  const at = new THREE.Vector3();
  for (let i = 0; i < 46; i++) {
    at.set(rand() * 2 - 1, 0.35 + rand() * 0.65, rand() * 2 - 1).normalize();
    const f = bulge(at.x, at.y, at.z) * 0.95,
      length = 0.3 + rand() * 1.1;
    const x = WAMPA_CAVE.x + at.x * CHAMBER[0] * f,
      y = at.y * CHAMBER[1] * f,
      z = WAMPA_CAVE.z + at.z * CHAMBER[2] * f;
    if (x > facadeX(y, z) - 0.6) continue;
    part(group, new THREE.ConeGeometry(0.05 + rand() * 0.12, length, 6), ice, [x, y - length / 2 + 0.1, z], [Math.PI, rand() * Math.PI, (rand() - 0.5) * 0.15]);
  }
  for (let i = 0; i < 16; i++) {
    const a = Math.PI * (0.35 + rand() * 1.3),
      x = WAMPA_CAVE.x + Math.cos(a) * CHAMBER[0] * 0.82,
      z = WAMPA_CAVE.z + Math.sin(a) * CHAMBER[2] * 0.82 * (rand() < 0.5 ? 1 : -1),
      height = 0.4 + rand() * 1.4;
    part(group, new THREE.ConeGeometry(0.12 + rand() * 0.2, height, 7), ice, [x, height / 2, z], [0, rand() * Math.PI, (rand() - 0.5) * 0.2]);
  }
  // What is left of a tauntaun: a curve of ribs, a spine and a long skull in the snow.
  const bone = new THREE.MeshStandardMaterial({ color: 0xe6dfcf, roughness: 0.6 });
  const bones = new THREE.Group();
  bones.position.set(WAMPA_CAVE.x - 0.6, 0.02, WAMPA_CAVE.z + 1.7);
  bones.rotation.y = 0.5;
  group.add(bones);
  part(bones, new THREE.CylinderGeometry(0.035, 0.03, 1.5, 8), bone, [0, 0.06, 0], [0, 0, Math.PI / 2]);
  for (let i = 0; i < 7; i++)
    part(bones, new THREE.TorusGeometry(0.22 - Math.abs(i - 3) * 0.02, 0.018, 6, 16, Math.PI), bone, [-0.5 + i * 0.15, 0.06, 0], [0, Math.PI / 2, 0.2]);
  part(bones, new THREE.ConeGeometry(0.08, 0.38, 8), bone, [0.95, 0.08, 0], [0, 0, -Math.PI / 2]);

  // The light inside: cold and bright, as in a glacier lit through its own walls.
  const light = new THREE.PointLight(0xd8efff, 22, 10, 1.6);
  light.position.set(WAMPA_CAVE.x + 0.4, 3, WAMPA_CAVE.z);
  const floorLight = new THREE.PointLight(0x7fb4df, 6, 6, 2);
  floorLight.position.set(facadeX(0, ARCH.z) - 1.2, 0.6, ARCH.z);
  group.add(light, floorLight);
  const haze = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xcfe8ff, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
  haze.position.set(WAMPA_CAVE.x + 1, 1.2, WAMPA_CAVE.z);
  haze.scale.set(6, 3, 1);
  group.add(haze);

  const wampa = createWampa();
  // Framed by the arch from the hangar floor, turned a little towards the visitors' side.
  wampa.group.position.set(WAMPA_CAVE.x - 1.8, 0, WAMPA_CAVE.z + 0.35);
  wampa.group.rotation.y = Math.PI / 2 + 0.2;
  group.add(wampa.group);
  return { group, wampa };
}

// Luke's lightsaber: silver hilt with black grips, and a blue blade from the emitter (+y).
function lightsaber() {
  const group = new THREE.Group();
  const silver = new THREE.MeshStandardMaterial({ color: 0xc9cccd, roughness: 0.25, metalness: 0.92 });
  const black = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.5 });
  part(group, new THREE.CylinderGeometry(0.018, 0.017, 0.05, 16), silver, [0, 0.025, 0]);
  part(group, new THREE.CylinderGeometry(0.016, 0.016, 0.13, 16), silver, [0, 0.115, 0]);
  for (let i = 0; i < 6; i++) part(group, new THREE.CylinderGeometry(0.0185, 0.0185, 0.009, 16), black, [0, 0.07 + i * 0.016, 0]);
  part(group, new THREE.CylinderGeometry(0.021, 0.017, 0.05, 16), silver, [0, 0.205, 0]);
  part(group, new THREE.CylinderGeometry(0.023, 0.021, 0.03, 16), silver, [0, 0.245, 0]);
  part(group, new THREE.BoxGeometry(0.01, 0.018, 0.01), black, [0, 0.18, 0.02]);
  const blade = new THREE.Group();
  blade.position.y = 0.26;
  group.add(blade);
  part(blade, new THREE.CylinderGeometry(0.011, 0.011, 1, 10), new THREE.MeshBasicMaterial({ color: 0xf2fbff }), [0, 0.5, 0]);
  const aura = (radius: number, opacity: number) =>
    part(blade, new THREE.CylinderGeometry(radius, radius, 1.02, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0x3f8cff, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }), [0, 0.5, 0]);
  const auras = [aura(0.027, 0.5), aura(0.055, 0.16)];
  blade.scale.y = 0.9;
  return { group, blade, auras };
}

function footprint() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 96;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "rgba(60,88,112,.55)";
  c.beginPath();
  c.ellipse(32, 62, 17, 24, 0, 0, Math.PI * 2);
  c.fill();
  for (const [x, y] of [
    [16, 24],
    [32, 16],
    [48, 24],
  ]) {
    c.beginPath();
    c.ellipse(x, y, 7, 10, (x - 32) * 0.02, 0, Math.PI * 2);
    c.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createHothSecrets(reveal: Reveal, notify: (event: PadEvent) => void) {
  const group = new THREE.Group();
  group.name = "hoth-secrets";
  const glow = glowTexture();
  // The dome's footprint is an ellipse: one circle in the middle and one at each front corner.
  // The cave lies behind the wall, beyond where the visitor can walk, so it needs no collider.
  const circles: Spot[] = [];
  const pick = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

  // The cave, and a trail of huge three-toed prints from the plain to its mouth, fading in the storm.
  const cave = iceCave(glow);
  group.add(cave.group);
  const print = new THREE.MeshStandardMaterial({ map: footprint(), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3 });
  const trail = new THREE.CatmullRomCurve3([new THREE.Vector3(-11, 0, 45), new THREE.Vector3(-15.5, 0, 38.5), new THREE.Vector3(-19.4, 0, 33), new THREE.Vector3(-21.3, 0, 30.5)]);
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1),
      at = trail.getPointAt(t),
      ahead = trail.getTangentAt(t),
      side = i % 2 ? 1 : -1;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.62), print.clone());
    mesh.rotation.set(-Math.PI / 2, 0, Math.atan2(-ahead.x, -ahead.z));
    mesh.position.set(at.x - ahead.z * side * 0.3, 0.03, at.z + ahead.x * side * 0.3);
    (mesh.material as THREE.MeshStandardMaterial).opacity = 0.35 + t * 0.65;
    group.add(mesh);
  }

  // Luke's saber, blade buried in the snow at the cave mouth, steaming and glowing blue.
  const saber = lightsaber();
  group.add(saber.group);
  const planted = { position: new THREE.Vector3(-21.45, 0.36, 30.7), quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, 0, Math.PI + 0.3)) };
  saber.group.position.copy(planted.position);
  saber.group.quaternion.copy(planted.quaternion);
  const saberLight = new THREE.PointLight(0x4f9bff, 3, 5, 2);
  group.add(saberLight);
  const melt = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x4a90ff, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  melt.position.set(-21.38, 0.06, 30.7);
  melt.scale.setScalar(0.7);
  group.add(melt);
  const steam = Array.from({ length: 4 }, (_, i) => {
    const puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xe8f2fa, transparent: true, opacity: 0, depthWrite: false }));
    group.add(puff);
    return { puff, age: i * 0.6 };
  });
  const saberPick = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.6), pick);
  saberPick.position.set(-21.45, 0.35, 30.7);
  group.add(saberPick);
  // The pull: up into the visitor's hand, a few seconds held lit, then back into the snow.
  let pull = -1;
  const held = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };

  // R2-D2 just inside the mouth, looking out over the plain.
  const r2 = createHeroDroids().r2;
  r2.position.set(R2_SPOT.x, 0, R2_SPOT.z);
  group.add(r2);
  const dome = r2.getObjectByName("r2-dome")!;
  circles.push({ x: R2_SPOT.x, z: R2_SPOT.z, r: 0.55 });
  const r2Pick = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.3, 0.8), pick);
  r2Pick.position.set(R2_SPOT.x, 0.65, R2_SPOT.z);
  group.add(r2Pick);
  let greeting = -1,
    noticed = false;

  const toward = new THREE.Vector3();
  let snarl = 0;

  const actions: ZoneAction[] = [
    {
      id: "luke-saber",
      label: "Attirer le sabre",
      hidden: true,
      position: new THREE.Vector3(-21.45, 0.4, 30.7),
      objects: [saberPick],
      activate: () => {
        if (pull < 0) pull = 0;
      },
    },
    {
      id: "r2-hello",
      label: "Saluer R2-D2",
      hidden: true,
      position: new THREE.Vector3(R2_SPOT.x, 0.9, R2_SPOT.z),
      objects: [r2Pick],
      activate: () => {
        greeting = 0;
        notify("droid");
      },
    },
  ];

  return {
    group,
    circles,
    actions,
    tick: (dt: number, elapsed: number, reduced: boolean, walker: Walker) => {
      const time = elapsed;
      // The wampa watches whoever comes to the arch, and snarls the closer they get.
      const wampa = cave.wampa.group.position,
        mouthDistance = Math.hypot(walker.x - facadeX(0, ARCH.z), walker.z - ARCH.z);
      const near = 1 - THREE.MathUtils.smoothstep(mouthDistance, 2.5, 9),
        roar = reduced ? 0 : Math.max(0, Math.sin(time * 0.45)) ** 12;
      snarl += (Math.max(near * 0.55, roar * (0.4 + near * 0.6)) - snarl) * Math.min(1, dt * 4);
      const gaze = THREE.MathUtils.clamp(shortest(Math.atan2(walker.x - wampa.x, walker.z - wampa.z) - cave.wampa.group.rotation.y), -0.6, 0.6);
      cave.wampa.pose(time, reduced ? 0 : snarl, reduced ? 0 : gaze * (0.3 + near * 0.7), reduced);

      // The saber.
      const forward = toward.set(-Math.sin(walker.yaw), 0, -Math.cos(walker.yaw));
      if (pull >= 0) {
        pull += dt;
        held.position.set(walker.x, 1.32, walker.z).addScaledVector(forward, 0.75);
        held.quaternion.setFromEuler(new THREE.Euler(0, walker.yaw + (pull - 1) * 0.5, 0.12));
        const rise = reduced ? 1 : THREE.MathUtils.smootherstep(pull, 0, 1),
          back = reduced ? (pull > 3 ? 1 : 0) : THREE.MathUtils.smootherstep(pull, 4.2, 5.4);
        const k = rise * (1 - back);
        saber.group.position.lerpVectors(planted.position, held.position, k);
        saber.group.quaternion.slerpQuaternions(planted.quaternion, held.quaternion, k);
        if (pull >= 1 && pull - dt < 1) reveal("jedi-weapon");
        if (pull > (reduced ? 3 : 5.4)) {
          pull = -1;
          saber.group.position.copy(planted.position);
          saber.group.quaternion.copy(planted.quaternion);
        }
      }
      const flicker = reduced ? 1 : 1 + Math.sin(time * 37) * 0.04 + Math.sin(time * 61) * 0.03;
      saber.auras[0].material.opacity = 0.5 * flicker;
      saber.auras[1].material.opacity = 0.16 * flicker;
      saber.blade.getWorldPosition(saberLight.position);
      saberLight.position.y = Math.max(0.25, saberLight.position.y + (pull >= 0 ? 0.4 : 0));
      saberLight.intensity = 3 * flicker;
      const buried = pull < 0;
      melt.visible = buried;
      melt.material.opacity = 0.55 * flicker;
      steam.forEach((wisp) => {
        wisp.puff.visible = buried && !reduced;
        if (!wisp.puff.visible) return;
        wisp.age = (wisp.age + dt) % 2.4;
        const t = wisp.age / 2.4;
        wisp.puff.position.set(-21.38 + t * 0.15, 0.1 + t * 0.8, 30.7 + Math.sin(time + wisp.age) * 0.05);
        wisp.puff.scale.setScalar(0.15 + t * 0.4);
        wisp.puff.material.opacity = Math.sin(t * Math.PI) * 0.25;
      });

      // R2 scans the horizon, shivers in the cold, and turns his dome to anyone who comes near.
      const r2Distance = Math.hypot(walker.x - R2_SPOT.x, walker.z - R2_SPOT.z);
      const facing = shortest(Math.atan2(walker.x - R2_SPOT.x, walker.z - R2_SPOT.z));
      let domeGoal = reduced ? 0 : Math.sin(time * 0.35) * 0.75;
      if (r2Distance < 3.5) {
        domeGoal = THREE.MathUtils.clamp(facing, -2.6, 2.6);
        if (!noticed) {
          noticed = true;
          notify("droid");
        }
      } else if (r2Distance > 5) noticed = false;
      if (greeting >= 0) {
        greeting += dt;
        // A happy whistle: a full spin of the dome and a rock from foot to foot.
        domeGoal = facing + (reduced ? 0 : THREE.MathUtils.smootherstep(greeting, 0, 0.9) * Math.PI * 2);
        r2.rotation.z = reduced ? 0 : Math.sin(greeting * 14) * 0.06 * (1 - greeting / 1.8);
        if (greeting > 1.8) {
          greeting = -1;
          r2.rotation.z = 0;
          dome.rotation.y = shortest(dome.rotation.y);
          reveal("lost-droid");
        }
        dome.rotation.y = domeGoal;
      } else {
        dome.rotation.y += shortest(domeGoal - dome.rotation.y) * (1 - Math.exp(-dt * 3));
        r2.rotation.z = reduced ? 0 : Math.sin(time * 23) * 0.004;
      }
    },
  };
}
