import * as THREE from "three";
import { createJawa } from "./jawaModels";
import { createDroidKit } from "./droidModels";
import { glowTexture } from "./landingKit";
import { bakePart, createSandtrooper, part, rounded } from "./tatooineCharacters";

// Street scenes for Mos Eisley, all in the district's (u, y, v) frame, figures facing +v by default.
type Spot = { u: number; v: number; r: number };
type Robed = { root: THREE.Group; head: THREE.Group; arms: THREE.Group[] };

const ease = (from: number, to: number, value: number) => {
  const t = THREE.MathUtils.clamp((value - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
};
const toward = (current: number, target: number, dt: number, rate = 6) =>
  current + (target - current) * (1 - Math.exp(-dt * rate));

// A robed figure: a hooded Jawa when no skin is given, otherwise a traveller.
function robed(height: number, robe: number, skin?: number): Robed {
  if(skin===undefined){const figure=createJawa(robe);figure.group.scale.setScalar(height/1.2);return{root:figure.group,head:figure.head,arms:figure.arms};}
  const root = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: robe, roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0d0b09, roughness: 0.9 });
  const jawa = skin === undefined;
  const face = jawa ? dark : new THREE.MeshStandardMaterial({ color: skin, roughness: 0.85 });
  const shoulder = height * (jawa ? 0.7 : 0.8);
  const body = new THREE.Group();
  root.add(body);
  part(body, new THREE.CylinderGeometry(jawa ? 0.21 : 0.18, jawa ? 0.37 : 0.33, shoulder, 14), cloth, [0, shoulder / 2, 0]);
  part(body, new THREE.SphereGeometry(0.21, 14, 10), cloth, [0, shoulder, 0]).scale.set(1.15, 0.6, 0.95);
  bakePart(body);
  const head = new THREE.Group();
  head.position.y = shoulder + (jawa ? 0.12 : 0.2);
  root.add(head);
  if (jawa) {
    // Deep hood, a shadowed face and two glowing eyes.
    part(head, new THREE.SphereGeometry(0.24, 14, 10), cloth, [0, 0.05, 0]);
    part(head, new THREE.SphereGeometry(0.17, 12, 8), dark, [0, 0.04, 0.13]);
    const eye = new THREE.MeshBasicMaterial({ color: 0xf4bd58 });
    for (const side of [-1, 1]) part(head, new THREE.SphereGeometry(0.024, 6, 4), eye, [side * 0.055, 0.06, 0.28]);
  } else {
    part(head, new THREE.SphereGeometry(0.15, 16, 12), face).scale.set(0.92, 1.08, 0.95);
    part(head, new THREE.SphereGeometry(0.185, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), cloth, [0, 0.01, -0.04]);
    for (const side of [-1, 1]) part(head, new THREE.SphereGeometry(0.017, 8, 6), dark, [side * 0.05, 0.02, 0.135]);
  }
  bakePart(head);
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * (jawa ? 0.22 : 0.24), shoulder - 0.03, 0);
    part(arm, new THREE.CylinderGeometry(0.06, 0.095, jawa ? 0.36 : 0.52, 8), cloth, [0, jawa ? -0.16 : -0.23, 0.02]);
    part(arm, new THREE.SphereGeometry(0.05, 8, 6), face, [0, jawa ? -0.35 : -0.5, 0.04]);
    root.add(arm);
    return arm;
  });
  return { root, head, arms };
}

// Jawas talk up a droid to a farmer at their workbench, on a slow loop of offers and refusals.
function haggling(group: THREE.Group, colliders: Spot[]) {
  const sellers = [
    { figure: robed(0.95, 0x5f402a), u: -7.2, v: 46.6 },
    { figure: robed(0.9, 0x6a4a31), u: -6.8, v: 45 },
  ];
  const buyer = robed(1.78, 0xb79f7c, 0xa77d5c);
  buyer.root.position.set(-5.1, 0, 46.3);
  buyer.root.rotation.y = -Math.PI / 2;
  group.add(buyer.root);
  colliders.push({ u: -5.1, v: 46.3, r: 0.42 });
  sellers.forEach(({ figure, u, v }) => {
    figure.root.position.set(u, 0, v);
    figure.root.rotation.y = Math.atan2(-5.1 - u, 46.3 - v);
    group.add(figure.root);
    colliders.push({ u, v, r: 0.36 });
  });
  const droid = createDroidKit().astromech();
  droid.droid.position.set(-6.9, 0, 47.9);
  droid.droid.rotation.y = Math.atan2(-5.1 + 6.9, 46.3 - 47.9);
  group.add(droid.droid);
  colliders.push({ u: -6.9, v: 47.9, r: 0.45 });
  const pointAt = Math.atan2(-6.9 + 5.1, 47.9 - 46.3);
  return (time: number, dt: number, reduced: boolean) => {
    if (reduced) return;
    const t = time % 16;
    // 0-7 s: the pitch, 7-10 s: the farmer points at the droid, 10-13 s: a deal, then a pause.
    const pitch = t < 7,
      point = t >= 7 && t < 10,
      deal = t >= 10 && t < 13;
    sellers.forEach(({ figure }, i) => {
      const talk = pitch ? Math.sin(time * (7 + i) + i * 2) : 0;
      figure.arms.forEach((arm, side) => {
        const lift = pitch ? 0.7 + talk * (side === i ? 0.5 : 0.2) : deal ? 1.6 + Math.sin(time * 11 + side) * 0.3 : 0.25;
        arm.rotation.x = toward(arm.rotation.x, -lift, dt, 9);
        arm.rotation.z = toward(arm.rotation.z, deal ? (side ? -0.5 : 0.5) : 0, dt);
      });
      figure.root.position.y = deal ? Math.abs(Math.sin(time * 9 + i)) * 0.12 : pitch ? Math.abs(talk) * 0.025 : 0;
      figure.head.rotation.z = pitch ? Math.sin(time * 5 + i) * 0.12 : 0;
    });
    // Arms crossed while listening, a shake of the head, then a point and a nod.
    const shake = pitch && ((t > 2 && t < 3.2) || (t > 5 && t < 6.2));
    buyer.head.rotation.y = toward(buyer.head.rotation.y, shake ? Math.sin(time * 10) * 0.4 : point ? -0.35 : 0, dt, 12);
    buyer.head.rotation.x = toward(buyer.head.rotation.x, deal ? Math.sin(time * 8) * 0.2 : 0, dt, 12);
    buyer.root.rotation.y = toward(buyer.root.rotation.y, point ? pointAt * 0.4 - Math.PI / 2 * 0.6 : -Math.PI / 2, dt, 3);
    buyer.arms.forEach((arm, side) => {
      const pointing = point && side === 0;
      arm.rotation.x = toward(arm.rotation.x, pointing ? -1.45 : deal ? -0.2 : -1.25, dt);
      arm.rotation.z = toward(arm.rotation.z, pointing ? 0 : deal ? 0 : side ? -0.75 : 0.75, dt);
    });
    droid.dome.rotation.y = point ? Math.sin(time * 6) * 0.5 : Math.sin(time * 0.6) * 0.6;
  };
}

// Sandtroopers check papers at the bay exit, behind a striped barrier and a sweeping scanner.
function checkpoint(group: THREE.Group, colliders: Spot[]) {
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c2f2b, roughness: 0.7, metalness: 0.5 });
  const stripes = [0xc76a2a, 0xd8d2c0].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2 }));
  const barrier = new THREE.Group();
  group.add(barrier);
  for (const u of [2.5, 5.5]) {
    part(barrier, new THREE.CylinderGeometry(0.1, 0.14, 1.1, 12), dark, [u, 0.55, 21.6]);
    colliders.push({ u, v: 21.6, r: 0.2 });
  }
  for (let i = 0; i < 6; i++) {
    part(barrier, rounded(0.5, 0.1, 0.1, 0.02), stripes[i % 2], [2.75 + i * 0.5, 0.95, 21.6]);
    colliders.push({ u: 2.75 + i * 0.5, v: 21.6, r: 0.25 });
  }
  // The scanner pylon: a red beacon on top and a fan of light swinging across the exit.
  part(barrier, rounded(0.6, 0.25, 0.6, 0.05), dark, [6.2, 0.12, 20.9]);
  part(barrier, new THREE.CylinderGeometry(0.12, 0.15, 1.9, 12), dark, [6.2, 1.2, 20.9]);
  bakePart(barrier);
  colliders.push({ u: 6.2, v: 20.9, r: 0.45 });
  const head = new THREE.Group();
  head.position.set(6.2, 2.2, 20.9);
  group.add(head);
  part(head, rounded(0.34, 0.22, 0.3, 0.04), dark);
  const fan = part(
    head,
    new THREE.ConeGeometry(1, 4, 24, 1, true).translate(0, -2, 0),
    new THREE.MeshBasicMaterial({ color: 0xff4a32, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    [0, 0, 0.15],
    [-Math.PI / 2 + 0.3, 0, 0],
  );
  fan.scale.set(0.04, 1, 1);
  const beacon = part(head, new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3b2a }), [0, 0.16, 0]);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff4a32, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.y = 0.16;
  halo.scale.setScalar(0.7);
  head.add(halo);

  // One trooper scans a traveller and her pit droid; another stands guard by the barrier.
  const scanner = createSandtrooper();
  scanner.group.position.set(4, -0.06, 20.6);
  group.add(scanner.group);
  part(scanner.arms[0], rounded(0.08, 0.05, 0.16, 0.02), dark, [0.147, -0.373, 0.305]);
  const guard = createSandtrooper();
  guard.group.position.set(1.9, -0.06, 21.3);
  guard.group.rotation.y = -Math.PI / 2;
  group.add(guard.group);
  const traveller = robed(1.72, 0x8d6b4a, 0xc79b78);
  traveller.root.position.set(4, 0, 22.8);
  traveller.root.rotation.y = Math.PI;
  group.add(traveller.root);
  part(traveller.root, rounded(0.42, 0.55, 0.22, 0.06), new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.95 }), [0, 1.08, -0.24]);
  const papers = part(traveller.arms[1], rounded(0.14, 0.02, 0.2, 0.01), new THREE.MeshBasicMaterial({ color: 0x8fd6ff }), [0, -0.52, 0.12]);
  const droid = createDroidKit().pitDroid();
  droid.droid.position.set(5, 0, 23.3);
  droid.droid.rotation.y = Math.PI - 0.3;
  group.add(droid.droid);
  colliders.push({ u: 4, v: 20.6, r: 0.42 }, { u: 1.9, v: 21.3, r: 0.42 }, { u: 4, v: 22.8, r: 0.42 }, { u: 5, v: 23.3, r: 0.35 });
  // A blue scan line climbs and falls over the traveller.
  const line = part(
    group,
    new THREE.BoxGeometry(0.7, 0.012, 0.012),
    new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
    [4, 1, 22.45],
  );
  return (time: number, dt: number, reduced: boolean) => {
    const t = time % 12;
    // 0-6 s: the scan, 6-9 s: the traveller hands over her papers, then a wait.
    const scanning = t < 6,
      handing = t >= 6 && t < 9;
    scanner.tick(time, false, reduced);
    guard.tick(time + 3, false, reduced);
    scanner.arms[0].rotation.x = toward(scanner.arms[0].rotation.x, scanning ? -1.25 + Math.sin(time * 2.2) * 0.15 : handing ? -0.9 : -0.15, dt);
    line.visible = scanning && !reduced;
    line.position.y = 0.25 + (0.5 - 0.5 * Math.cos(time * 2.2)) * 1.5;
    traveller.arms[1].rotation.x = toward(traveller.arms[1].rotation.x, handing ? -1.3 : scanning ? -0.25 : -0.05, dt);
    traveller.arms[0].rotation.x = toward(traveller.arms[0].rotation.x, scanning ? -0.15 : 0, dt);
    papers.visible = t > 5.4;
    traveller.head.rotation.y = reduced ? 0 : Math.sin(time * 0.5) * 0.25;
    droid.head.rotation.y = reduced ? 0 : Math.sin(time * 1.3) * 0.45;
    head.rotation.y = -Math.PI / 2 + (reduced ? 0 : Math.sin(time * 0.9) * 0.75);
    const blink = reduced || Math.sin(time * 5) > 0;
    halo.material.opacity = blink ? 0.85 : 0.15;
    beacon.visible = blink;
    fan.material.opacity = reduced ? 0.05 : 0.06 + Math.sin(time * 3.1) * 0.015;
  };
}

// A sandtrooper rides a big desert lizard on a slow loop beyond the end of the street.
function mount(group: THREE.Group, heightAt: (u: number, v: number) => number) {
  const root = new THREE.Group();
  group.add(root);
  const hide = new THREE.MeshStandardMaterial({ color: 0x8c7a5a, roughness: 0.95 });
  const belly = new THREE.MeshStandardMaterial({ color: 0xb7a07a, roughness: 0.95 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x241c14, roughness: 0.8 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x6b3f28, roughness: 0.85 });
  const blanket = new THREE.MeshStandardMaterial({ color: 0x8a3b26, roughness: 1 });
  const torso = new THREE.Group();
  root.add(torso);
  part(torso, new THREE.SphereGeometry(1, 24, 16), hide, [0, 1.55, 0]).scale.set(0.95, 0.82, 2);
  part(torso, new THREE.SphereGeometry(1, 20, 12), belly, [0, 1.25, 0.1]).scale.set(0.8, 0.55, 1.7);
  for (let plate = 0; plate < 7; plate++)
    part(torso, new THREE.ConeGeometry(0.12, 0.3, 6), dark, [0, 2.32 - Math.abs(plate - 2) * 0.05, 1.1 - plate * 0.45]);
  part(torso, rounded(0.95, 0.18, 1.1, 0.06), leather, [0, 2.36, 0.3]);
  for (const side of [-1, 1]) part(torso, rounded(0.04, 0.8, 0.95, 0.02), blanket, [side * 0.78, 1.95, 0.3], [0, 0, side * 0.35]);
  bakePart(torso);
  const neck = new THREE.Group();
  neck.position.set(0, 1.85, 1.8);
  root.add(neck);
  part(neck, new THREE.CylinderGeometry(0.38, 0.5, 1, 14), hide, [0, 0.15, 0.35], [1.1, 0, 0]);
  part(neck, new THREE.SphereGeometry(0.45, 18, 12), hide, [0, 0.3, 0.95]).scale.set(1, 0.75, 1.5);
  part(neck, rounded(0.5, 0.22, 0.5, 0.1), belly, [0, 0.14, 1.45]);
  for (const side of [-1, 1]) {
    part(neck, new THREE.SphereGeometry(0.06, 8, 6), dark, [side * 0.33, 0.42, 1.1]);
    part(neck, new THREE.ConeGeometry(0.07, 0.3, 6), dark, [side * 0.2, 0.62, 0.7], [-0.6, 0, side * 0.3]);
  }
  bakePart(neck);
  // A tapering tail of four links that swings from side to side.
  const tail: THREE.Group[] = [];
  let parent: THREE.Object3D = root,
    offset = new THREE.Vector3(0, 1.45, -1.8);
  for (let link = 0; link < 4; link++) {
    const segment = new THREE.Group();
    segment.position.copy(offset);
    parent.add(segment);
    const radius = 0.48 - link * 0.1;
    part(segment, new THREE.CylinderGeometry(radius * 0.75, radius, 1, 12), hide, [0, -0.08, -0.5], [-Math.PI / 2 - 0.15, 0, 0]);
    tail.push(segment);
    parent = segment;
    offset = new THREE.Vector3(0, -0.14, -0.95);
  }
  const legs = [
    [-0.75, 1.15],
    [0.75, 1.15],
    [-0.75, -1.1],
    [0.75, -1.1],
  ].map(([x, z]) => {
    const leg = new THREE.Group();
    leg.position.set(x, 1.25, z);
    part(leg, new THREE.CylinderGeometry(0.28, 0.2, 1.1, 10), hide, [x * 0.15, -0.6, 0]);
    part(leg, rounded(0.42, 0.18, 0.6, 0.06), dark, [x * 0.15, -1.18, 0.12]);
    root.add(leg);
    return leg;
  });
  const rider = createSandtrooper();
  rider.group.position.set(0, 1.62, 0.25);
  root.add(rider.group);
  let angle = 1.2,
    stride = 0;
  return (time: number, dt: number, reduced: boolean) => {
    // An oval loop, 44 m by 12 m, walked at a steady 1.1 m/s, clear of the sandcrawler.
    const radiusU = 22,
      radiusV = 6;
    const pace = Math.hypot(radiusU * Math.cos(angle), radiusV * Math.sin(angle));
    if (!reduced) {
      angle += (dt * 1.1) / pace;
      stride += dt * 3.2;
    }
    const u = 8 + radiusU * Math.sin(angle),
      v = 95 + radiusV * Math.cos(angle);
    root.position.set(u, heightAt(u, v), v);
    root.rotation.y = Math.atan2(radiusU * Math.cos(angle), -radiusV * Math.sin(angle));
    legs.forEach((leg, i) => (leg.rotation.x = Math.sin(stride + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.4));
    torso.position.y = Math.abs(Math.sin(stride)) * 0.06;
    torso.rotation.z = Math.sin(stride) * 0.03;
    neck.rotation.x = Math.sin(stride * 2) * 0.05;
    neck.rotation.y = Math.sin(time * 0.3) * 0.2;
    tail.forEach((segment, i) => (segment.rotation.y = Math.sin(stride - i * 0.7) * 0.18));
    rider.tick(time, false, reduced);
    rider.group.position.y = 1.62 + torso.position.y;
    rider.legs.forEach((leg, i) => leg.rotation.set(-0.9, 0, i ? 0.75 : -0.75));
    rider.arms.forEach((arm) => (arm.rotation.x = -0.6));
  };
}

// A herd of shaggy, horned grazers crossing a dune far out, with their herder at the tail.
function herd(group: THREE.Group, heightAt: (u: number, v: number) => number) {
  const fur = new THREE.MeshStandardMaterial({ color: 0x5e4836, roughness: 1 });
  const pale = new THREE.MeshStandardMaterial({ color: 0x8a7056, roughness: 1 });
  const horn = new THREE.MeshStandardMaterial({ color: 0xd9c8a6, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d1712, roughness: 0.8 });
  const beasts = Array.from({ length: 7 }, (_, index) => {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    part(body, new THREE.SphereGeometry(1, 18, 12), fur, [0, 2.35, 0]).scale.set(1.3, 1.15, 1.9);
    part(body, new THREE.CylinderGeometry(1.2, 1.5, 1.5, 16, 1, true), fur, [0, 1.55, 0]).scale.z = 1.45;
    part(body, new THREE.SphereGeometry(0.6, 14, 10), pale, [0, 2.55, 1.85]).scale.set(0.95, 1, 1.15);
    part(body, rounded(0.5, 0.4, 0.45, 0.12), dark, [0, 2.25, 2.45]);
    for (const side of [-1, 1])
      part(body, new THREE.TorusGeometry(0.34, 0.1, 6, 14, Math.PI * 1.5), horn, [side * 0.55, 2.85, 1.75], [0, Math.PI / 2, side * 0.4]);
    bakePart(body);
    const legs = [-0.7, 0.7].flatMap((x) =>
      [-0.9, 0.9].map((z) => {
        const leg = new THREE.Group();
        leg.position.set(x, 1.2, z);
        part(leg, new THREE.CylinderGeometry(0.26, 0.3, 1.2, 8), fur, [0, -0.6, 0]);
        root.add(leg);
        return leg;
      }),
    );
    const scale = index === 3 ? 0.62 : 0.9 + (index % 3) * 0.08;
    root.scale.setScalar(scale);
    group.add(root);
    return { root, legs, lag: index * 0.22 + (index % 2) * 0.06, side: ((index * 5) % 7) - 3, phase: index * 1.3 };
  });
  const herder = robed(1.85, 0x6f5a44, 0x9c7454);
  part(herder.arms[1], new THREE.CylinderGeometry(0.025, 0.025, 2.1, 6), dark, [0, -0.2, 0.15]);
  herder.root.scale.setScalar(1.05);
  group.add(herder.root);
  let travelled = 0;
  // A long, flat oval out on the dunes, framed by the end of the street from anywhere in it.
  const place = (object: THREE.Object3D, angle: number, side: number) => {
    const u = Math.sin(angle) * (34 + side),
      v = 175 - Math.cos(angle) * (10 + side * 0.3);
    object.position.set(u, heightAt(u, v) - 0.1, v);
    object.rotation.y = Math.atan2(Math.cos(angle) * 34, Math.sin(angle) * 10);
  };
  return (time: number, dt: number, reduced: boolean) => {
    if (!reduced) travelled += dt * 0.02;
    beasts.forEach((beast) => {
      place(beast.root, travelled - beast.lag, beast.side);
      beast.legs.forEach((leg, i) => (leg.rotation.x = reduced ? 0 : Math.sin(time * 1.6 + beast.phase + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.22));
    });
    place(herder.root, travelled - 1.75, 2.5);
    herder.arms[0].rotation.x = reduced ? 0 : Math.sin(time * 2.2) * 0.25;
  };
}

export function createStreetLife(heightAt: (u: number, v: number) => number) {
  const group = new THREE.Group();
  group.name = "mos-eisley-street-life";
  const colliders: Spot[] = [];
  const scenes: ((time: number, dt: number, reduced: boolean) => void)[] = [
    haggling(group, colliders),
    checkpoint(group, colliders),
    mount(group, heightAt),
    herd(group, heightAt),
  ];
  return {
    group,
    colliders,
    tick: (time: number, dt: number, reduced: boolean) => scenes.forEach((scene) => scene(time, reduced ? 0 : dt, reduced)),
  };
}
