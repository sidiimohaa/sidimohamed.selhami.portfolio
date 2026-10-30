import * as THREE from "three";
import type { PadEvent } from "./coruscantLife";
import { glowTexture, type Reveal, type Spot, type ZoneAction } from "./landingKit";
import { createDirewolf, createJonSnow, walkPose } from "./nightWatch";
import { createHeroDroids, part } from "./tatooineCharacters";
import { snowCover } from "./weathering";

// What hides in and around Echo Base's hangar: a wampa's ice cave in the west wall with Luke's
// lightsaber planted at its mouth, R2-D2 watching the storm for his master, and, a minute into
// the visit, Jon Snow and Ghost crossing the snow in front of the visitor.

export const WAMPA_CAVE = { x: -22.4, z: 30 };
const CAVE_SCALE: [number, number, number] = [2.4, 3, 2.8];
const R2_SPOT = { x: -7, z: 34.4 };
const BOUNDS = { minX: -21, maxX: 21, minZ: -22, maxZ: 46 };
type Walker = { x: number; z: number; yaw: number };
const shortest = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

// One lumpy ice surface shared by the dome, its lintel, its lining and the rim of the opening.
const bulge = (x: number, y: number, z: number) => 1 + 0.07 * Math.sin(3.1 * x + 4.7 * z + 1.3 * y) + 0.04 * Math.sin(7.3 * y + 2.9 * z + 5 * x);
function caveSurface(geometry: THREE.BufferGeometry, inset = 1) {
  const p = geometry.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      f = bulge(x, y, z) * inset;
    p.setXYZ(i, x * f * CAVE_SCALE[0], y * f * CAVE_SCALE[1], z * f * CAVE_SCALE[2]);
  }
  geometry.computeVertexNormals();
  return geometry;
}
const onCave = (phi: number, theta: number) => {
  const x = -Math.cos(phi) * Math.sin(theta),
    y = Math.cos(theta),
    z = Math.sin(phi) * Math.sin(theta),
    f = bulge(x, y, z);
  return new THREE.Vector3(x * f * CAVE_SCALE[0], y * f * CAVE_SCALE[1], z * f * CAVE_SCALE[2]);
};

function wampaCave(glow: THREE.Texture) {
  const group = new THREE.Group();
  group.name = "hoth-wampa-cave";
  group.position.set(WAMPA_CAVE.x, 0, WAMPA_CAVE.z);
  const ice = snowCover(new THREE.MeshStandardMaterial({ color: 0x9cc0d8, roughness: 0.32, metalness: 0.02, emissive: 0x0e2638, emissiveIntensity: 0.3 }), 0.9);
  // A dome of blue ice against the wall, opening towards the hangar (+x).
  const gap = 1.25,
    top = 0.62;
  part(group, caveSurface(new THREE.SphereGeometry(1, 40, 18, Math.PI + gap / 2, Math.PI * 2 - gap, 0, Math.PI / 2)), ice);
  part(group, caveSurface(new THREE.SphereGeometry(1, 10, 8, Math.PI - gap / 2, gap, 0, top)), ice);
  const edge: THREE.Vector3[] = [];
  for (let i = 0; i <= 6; i++) edge.push(onCave(Math.PI - gap / 2, Math.PI / 2 - (i / 6) * (Math.PI / 2 - top)));
  for (let i = 1; i < 6; i++) edge.push(onCave(Math.PI - gap / 2 + (i / 6) * gap, top));
  for (let i = 0; i <= 6; i++) edge.push(onCave(Math.PI + gap / 2, top + (i / 6) * (Math.PI / 2 - top)));
  part(group, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge), 48, 0.14, 8, false), ice);
  // The lining darkens to black at the back, so the cave reads deep without any light inside.
  const lining = caveSurface(new THREE.SphereGeometry(1, 36, 16, 0, Math.PI * 2, 0, Math.PI / 2), 0.93),
    colors: number[] = [],
    dark = new THREE.Color(0x020304),
    mouth = new THREE.Color(0x3b5a72),
    tint = new THREE.Color();
  const lp = lining.getAttribute("position");
  for (let i = 0; i < lp.count; i++) {
    const depth = (lp.getX(i) / CAVE_SCALE[0] + 1) / 2,
      height = lp.getY(i) / CAVE_SCALE[1];
    tint.copy(dark).lerp(mouth, Math.pow(depth, 2.4) * (1 - height * 0.5));
    colors.push(tint.r, tint.g, tint.b);
  }
  lining.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  part(group, lining, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
  const floor = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2),
    fp = floor.getAttribute("position"),
    floorColors: number[] = [];
  for (let i = 0; i < fp.count; i++) {
    tint.copy(dark).lerp(mouth, Math.pow((fp.getX(i) + 1) / 2, 2) * 0.8);
    floorColors.push(tint.r, tint.g, tint.b);
    fp.setXYZ(i, fp.getX(i) * CAVE_SCALE[0] * 0.92, 0, fp.getZ(i) * CAVE_SCALE[2] * 0.92);
  }
  floor.setAttribute("color", new THREE.Float32BufferAttribute(floorColors, 3));
  part(group, floor, new THREE.MeshBasicMaterial({ vertexColors: true }), [0, 0.025, 0]);

  // The wampa itself: a pale hulk only just made out in the dark, horns curling from its skull.
  const hulk = new THREE.MeshBasicMaterial({ color: 0x141a1f }),
    rim = new THREE.MeshBasicMaterial({ color: 0x1e262d });
  const wampa = new THREE.Group();
  wampa.position.set(-1.7, 0, 0.25);
  group.add(wampa);
  // Hunched shoulders wider than the hips, a heavy brow and a snout, long arms hanging low.
  part(wampa, new THREE.SphereGeometry(1, 16, 12), hulk, [0, 1.15, 0]).scale.set(0.4, 0.75, 0.5);
  part(wampa, new THREE.SphereGeometry(1, 16, 12), rim, [0.1, 1.7, 0]).scale.set(0.42, 0.38, 0.68);
  part(wampa, new THREE.SphereGeometry(1, 14, 10), hulk, [0.28, 2.0, 0]).scale.set(0.24, 0.24, 0.26);
  part(wampa, new THREE.SphereGeometry(1, 12, 8), rim, [0.48, 1.92, 0]).scale.set(0.12, 0.1, 0.12);
  for (const side of [-1, 1]) {
    part(wampa, new THREE.TorusGeometry(0.12, 0.035, 6, 12, Math.PI * 1.3), rim, [0.22, 2.12, side * 0.2], [0, side * 0.3, side * -2.2]);
    part(wampa, new THREE.SphereGeometry(1, 10, 8), hulk, [0.25, 1.05, side * 0.62], [0, 0, 0.15]).scale.set(0.13, 0.7, 0.13);
  }
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0 });
  const eyeGlow = new THREE.SpriteMaterial({ map: glow, color: 0xffb340, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const side of [-1, 1]) {
    part(wampa, new THREE.SphereGeometry(0.026, 10, 8), eyeMaterial, [0.5, 2.04, side * 0.1]);
    const halo = new THREE.Sprite(eyeGlow);
    halo.position.set(0.52, 2.04, side * 0.1);
    halo.scale.setScalar(0.2);
    wampa.add(halo);
  }
  return { group, wampa, eyeMaterial, eyeGlow };
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
  const circles: Spot[] = [
    { x: WAMPA_CAVE.x, z: WAMPA_CAVE.z, r: 2.2 },
    { x: WAMPA_CAVE.x + 1.2, z: WAMPA_CAVE.z - 1.9, r: 1 },
    { x: WAMPA_CAVE.x + 1.2, z: WAMPA_CAVE.z + 1.9, r: 1 },
  ];
  const pick = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

  // The cave, and a trail of huge three-toed prints from the plain to its mouth, fading in the storm.
  const cave = wampaCave(glow);
  group.add(cave.group);
  const print = new THREE.MeshStandardMaterial({ map: footprint(), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3 });
  const trail = new THREE.CatmullRomCurve3([new THREE.Vector3(-11, 0, 45), new THREE.Vector3(-15.5, 0, 38.5), new THREE.Vector3(-19.4, 0, 33), new THREE.Vector3(-20.6, 0, 30.6)]);
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
  const planted = { position: new THREE.Vector3(-20.95, 0.36, 30.9), quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, 0, Math.PI + 0.3)) };
  saber.group.position.copy(planted.position);
  saber.group.quaternion.copy(planted.quaternion);
  const saberLight = new THREE.PointLight(0x4f9bff, 3, 5, 2);
  group.add(saberLight);
  const melt = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x4a90ff, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  melt.position.set(-20.88, 0.06, 30.9);
  melt.scale.setScalar(0.7);
  group.add(melt);
  const steam = Array.from({ length: 4 }, (_, i) => {
    const puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xe8f2fa, transparent: true, opacity: 0, depthWrite: false }));
    group.add(puff);
    return { puff, age: i * 0.6 };
  });
  const saberPick = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.6), pick);
  saberPick.position.set(-20.95, 0.35, 30.9);
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

  // Jon Snow and Ghost, who cross once in front of the visitor after a minute on Hoth.
  const jon = createJonSnow(),
    ghost = createDirewolf();
  const crossing = new THREE.Group();
  crossing.visible = false;
  crossing.add(jon.group, ghost.group);
  group.add(crossing);
  const fading: THREE.Material[] = [];
  crossing.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const material = object.material as THREE.MeshStandardMaterial;
    if (fading.includes(material)) return;
    material.transparent = true;
    fading.push(material);
  });
  let route: { from: THREE.Vector3; to: THREE.Vector3; length: number } | null = null,
    walked = 0,
    crossed = false,
    retryAt = 60;
  const planRoute = (walker: Walker) => {
    const forward = new THREE.Vector2(-Math.sin(walker.yaw), -Math.cos(walker.yaw)),
      across = new THREE.Vector2(-forward.y, forward.x).multiplyScalar(Math.random() < 0.5 ? 1 : -1);
    let best: typeof route = null,
      bestScore = Infinity;
    for (const distance of [9, 10, 8, 11, 7, 12]) {
      const centre = new THREE.Vector2(walker.x, walker.z).addScaledVector(forward, distance);
      // Keep the stretch of a 30 m line that lies inside the hangar and the snow before it.
      const points: THREE.Vector2[] = [];
      for (let s = -15; s <= 15; s += 0.75) {
        const p = centre.clone().addScaledVector(across, s);
        if (p.x > BOUNDS.minX && p.x < BOUNDS.maxX && p.y > BOUNDS.minZ && p.y < BOUNDS.maxZ) points.push(p);
      }
      if (points.length < 16) continue;
      const blocked = points.filter((p) => circles.concat(extra).some((c) => Math.hypot(p.x - c.x, p.y - c.z) < c.r + 0.5)).length;
      const score = blocked * 10 - points.length;
      if (score < bestScore) {
        bestScore = score;
        const a = points[0],
          b = points[points.length - 1];
        best = { from: new THREE.Vector3(a.x, 0, a.y), to: new THREE.Vector3(b.x, 0, b.y), length: a.distanceTo(b) };
      }
    }
    return best;
  };
  const extra: Spot[] = [];
  const toward = new THREE.Vector3();

  const actions: ZoneAction[] = [
    {
      id: "luke-saber",
      label: "Attirer le sabre",
      hidden: true,
      position: new THREE.Vector3(-20.95, 0.4, 30.9),
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
    // Other obstacles in the hangar, so the crossing avoids crates and ships.
    avoid: (spots: Spot[]) => extra.push(...spots),
    tick: (dt: number, elapsed: number, reduced: boolean, walker: Walker) => {
      const time = elapsed;
      // The wampa's eyes catch the light only once the visitor is close to the cave.
      const caveDistance = Math.hypot(walker.x - (WAMPA_CAVE.x + 2.4), walker.z - WAMPA_CAVE.z);
      const blink = !reduced && (time * 0.18) % 1 > 0.95 ? 0 : 1;
      const eyes = (1 - THREE.MathUtils.smoothstep(caveDistance, 4, 10)) * blink;
      cave.eyeMaterial.opacity += (eyes - cave.eyeMaterial.opacity) * Math.min(1, dt * 3);
      cave.eyeGlow.opacity = cave.eyeMaterial.opacity * 0.5;
      cave.wampa.rotation.y = reduced ? 0 : Math.sin(time * 0.2) * 0.12;

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
        wisp.puff.position.set(-20.88 + t * 0.15, 0.1 + t * 0.8, 30.9 + Math.sin(time + wisp.age) * 0.05);
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

      // Jon and Ghost.
      if (!crossed && time > retryAt && !route) {
        if (reduced) {
          route = { from: new THREE.Vector3(7, 0, 38), to: new THREE.Vector3(7, 0, 38), length: 0 };
        } else {
          route = planRoute(walker);
          if (!route) retryAt = time + 4;
        }
        walked = 0;
      }
      if (route && !crossed) {
        crossing.visible = true;
        if (reduced) {
          jon.group.position.copy(route.from);
          ghost.group.position.copy(route.from).add(new THREE.Vector3(1, 0, 0.4));
          jon.group.rotation.y = ghost.group.rotation.y = Math.atan2(walker.x - route.from.x, walker.z - route.from.z);
          walkPose(jon, 0, 0);
          ghost.pose(0, 0, 0);
          fading.forEach((material) => (material.opacity = 1));
        } else {
          walked += dt * 1.35;
          const t = walked / route.length,
            heading = Math.atan2(route.to.x - route.from.x, route.to.z - route.from.z);
          jon.group.position.lerpVectors(route.from, route.to, Math.min(t, 1));
          // Ghost pads a little ahead on the far side, so Jon stays in full view.
          const side = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading)),
            ahead = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
          const towardVisitor = Math.sign(side.x * (walker.x - jon.group.position.x) + side.z * (walker.z - jon.group.position.z)) || 1;
          ghost.group.position.copy(jon.group.position).addScaledVector(side, -0.7 * towardVisitor).addScaledVector(ahead, 1.7);
          jon.group.rotation.y = ghost.group.rotation.y = heading;
          walkPose(jon, walked * 4.2, 1);
          ghost.pose(walked * 4.6, 1, time);
          jon.cape.rotation.x = 0.12 + Math.sin(walked * 4.2) * 0.04;
          // He turns to look at the visitor as he passes, with a slow nod at the closest point.
          const look = THREE.MathUtils.clamp(shortest(Math.atan2(walker.x - jon.group.position.x, walker.z - jon.group.position.z) - heading), -1.2, 1.2);
          const closest = Math.exp(-Math.pow((t - 0.5) * 5, 2));
          jon.head.rotation.y = look * 0.85;
          jon.head.rotation.x = 0.05 + closest * 0.18;
          jon.look(THREE.MathUtils.clamp(look * 0.5, -1, 1), 0, time, false);
          ghost.head.rotation.y = THREE.MathUtils.clamp(look, -0.8, 0.8) * closest;
          const fade = THREE.MathUtils.smoothstep(walked, 0, 1.5) * (1 - THREE.MathUtils.smoothstep(walked, route.length - 1.5, route.length));
          fading.forEach((material) => (material.opacity = fade));
          if (t >= 1) {
            crossed = true;
            crossing.visible = false;
          }
        }
      }
    },
  };
}
