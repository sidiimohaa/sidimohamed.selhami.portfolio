import * as THREE from "three";
import { glowTexture, random, type Spot, type ZoneTerminal } from "./landingKit";
import { bakePart, part, pipe, rounded } from "./tatooineCharacters";
import type { Landing } from "./universe";

// The Ewok village round the clearing: platforms on four great trees, huts, rope bridges and a
// ramp coiling up the first trunk; on the ground, the campfire where an elder tells the story,
// drummers, dancers, and four carved totems, one per chapter of "Mes passions".
export const FIRE = new THREE.Vector2(0, 20);
export const DECK = 8.4;
export const VILLAGE = [
  { x: -25, z: 12, radius: 3.4, height: 92, deck: 11 },
  { x: -22, z: -16, radius: 3, height: 88, deck: 12 },
  { x: 25, z: -11, radius: 3.2, height: 90, deck: 12 },
  { x: 22, z: 19, radius: 3.1, height: 86, deck: 11 },
];
// The ramp coils 290 degrees round the first tree, outside its platform, from the clearing up to the deck.
export const RAMP = {
  tree: VILLAGE[0],
  inner: DECK,
  outer: DECK + 1.4,
  start: Math.atan2(-VILLAGE[0].z, -VILLAGE[0].x),
  span: (290 / 180) * Math.PI,
};
export const rampPoint = (p: number, radius = (RAMP.inner + RAMP.outer) / 2) => {
  const angle = RAMP.start + p * RAMP.span;
  return new THREE.Vector3(RAMP.tree.x + Math.cos(angle) * radius, RAMP.tree.deck * p, RAMP.tree.z + Math.sin(angle) * radius);
};
// The walkable bridge between the first two platforms.
const along = new THREE.Vector2(VILLAGE[1].x - VILLAGE[0].x, VILLAGE[1].z - VILLAGE[0].z).normalize();
export const BRIDGE = {
  from: new THREE.Vector3(VILLAGE[0].x + along.x * DECK, VILLAGE[0].deck, VILLAGE[0].z + along.y * DECK),
  to: new THREE.Vector3(VILLAGE[1].x - along.x * DECK, VILLAGE[1].deck, VILLAGE[1].z - along.y * DECK),
  sag: 0.8,
};
export const bridgeHeight = (t: number) => THREE.MathUtils.lerp(BRIDGE.from.y, BRIDGE.to.y, t) - Math.sin(t * Math.PI) * BRIDGE.sag;

type Ewok = { root: THREE.Group; body: THREE.Group; head: THREE.Group; arms: THREE.Group[]; legs: THREE.Group[] };
function furTexture(tone: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const c = canvas.getContext("2d")!,
    rand = random(tone.length * 97);
  c.fillStyle = tone;
  c.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    c.fillStyle = rand() < 0.5 ? "rgba(0,0,0,.18)" : "rgba(255,240,220,.12)";
    c.fillRect(rand() * 128, rand() * 128, 1, 2 + rand() * 5);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return map;
}
// A small furry forest dweller in a leather hood, ears poking through, big dark eyes.
function ewok(fur: string, hood: number, height = 1, staff?: "spear" | "staff"): Ewok {
  const root = new THREE.Group();
  const coat = new THREE.MeshStandardMaterial({ map: furTexture(fur), roughness: 1 });
  const muzzle = new THREE.MeshStandardMaterial({ color: new THREE.Color(fur).lerp(new THREE.Color(0xd9c3a0), 0.5), roughness: 1 });
  const leather = new THREE.MeshStandardMaterial({ color: hood, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0a0806, roughness: 0.25, metalness: 0.2 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.9 });
  const body = new THREE.Group();
  root.add(body);
  part(body, new THREE.SphereGeometry(0.3, 16, 12), coat, [0, 0.48, 0]).scale.set(1, 1.2, 0.9);
  part(body, new THREE.SphereGeometry(0.2, 12, 8), leather, [0, 0.62, -0.04]).scale.set(1.35, 0.5, 1.2);
  bakePart(body);
  const head = new THREE.Group();
  head.position.y = 0.92;
  body.add(head);
  part(head, new THREE.SphereGeometry(0.24, 16, 12), coat);
  part(head, new THREE.SphereGeometry(0.12, 12, 8), muzzle, [0, -0.06, 0.17]).scale.set(1.2, 0.8, 1);
  part(head, new THREE.SphereGeometry(0.035, 8, 6), dark, [0, -0.02, 0.29]);
  for (const side of [-1, 1]) {
    part(head, new THREE.SphereGeometry(0.05, 10, 8), dark, [side * 0.1, 0.05, 0.19]);
    part(head, new THREE.CylinderGeometry(0.05, 0.06, 0.12, 8), coat, [side * 0.15, 0.22, -0.02], [0, 0, side * -0.4]);
  }
  part(head, new THREE.SphereGeometry(0.265, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), leather, [0, 0.02, -0.03], [-0.25, 0, 0]);
  bakePart(head);
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.27, 0.62, 0.02);
    part(arm, new THREE.CylinderGeometry(0.065, 0.08, 0.32, 8), coat, [0, -0.15, 0]);
    part(arm, new THREE.SphereGeometry(0.06, 8, 6), muzzle, [0, -0.32, 0.02]);
    if (side > 0 && staff) {
      part(arm, new THREE.CylinderGeometry(0.018, 0.022, staff === "spear" ? 1.5 : 1.2, 6), wood, [0, -0.15, 0.06]);
      if (staff === "spear") part(arm, new THREE.ConeGeometry(0.04, 0.16, 6), new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.7 }), [0, 0.67, 0.06]);
      else part(arm, new THREE.SphereGeometry(0.06, 8, 6), leather, [0, 0.47, 0.06]);
    }
    bakePart(arm);
    body.add(arm);
    return arm;
  });
  const legs = [-1, 1].map((side) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.13, 0.22, 0);
    part(leg, new THREE.CylinderGeometry(0.08, 0.09, 0.22, 8), coat, [0, -0.1, 0]);
    part(leg, new THREE.SphereGeometry(0.08, 8, 6), muzzle, [0, -0.2, 0.05]).scale.set(1, 0.6, 1.4);
    bakePart(leg);
    root.add(leg);
    return leg;
  });
  root.scale.setScalar(height);
  return { root, body, head, arms, legs };
}
const FURS: [string, number][] = [
  ["#6b4a2e", 0xb06a3a],
  ["#4a3626", 0x8f5a36],
  ["#8a6a48", 0xd09a5c],
  ["#7a7068", 0x6d4f3b],
  ["#5c4332", 0xc08048],
];

// A carved plaque for one chapter: its symbol and name, painted pale on dark wood.
function plaque(label: string, index: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 384;
  const c = canvas.getContext("2d")!,
    rand = random(index * 31 + 5);
  c.fillStyle = "#5a3b22";
  c.fillRect(0, 0, 512, 384);
  for (let i = 0; i < 60; i++) {
    c.strokeStyle = rand() < 0.5 ? "rgba(30,18,8,.35)" : "rgba(150,104,60,.25)";
    c.lineWidth = 1 + rand() * 2;
    c.beginPath();
    const y = rand() * 384;
    c.moveTo(0, y);
    c.bezierCurveTo(170, y + (rand() - 0.5) * 20, 340, y + (rand() - 0.5) * 20, 512, y + (rand() - 0.5) * 10);
    c.stroke();
  }
  c.strokeStyle = "#f3dcae";
  c.lineWidth = 7;
  c.strokeRect(16, 16, 480, 352);
  c.lineWidth = 6;
  c.fillStyle = "#f3dcae";
  const cx = 256,
    cy = 150;
  c.beginPath();
  if (index === 0) {
    // A ringed planet among stars.
    c.arc(cx, cy, 52, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.ellipse(cx, cy, 98, 26, -0.35, 0, Math.PI * 2);
    c.stroke();
    for (const [x, y] of [[120, 70], [390, 90], [150, 220], [380, 210]]) c.fillRect(x - 4, y - 4, 8, 8);
  } else if (index === 1) {
    // A watch dial, its hands and lugs.
    c.arc(cx, cy, 70, 0, Math.PI * 2);
    c.stroke();
    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * Math.PI * 2;
      c.fillRect(cx + Math.cos(a) * 56 - 3, cy + Math.sin(a) * 56 - 3, 6, 6);
    }
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx, cy - 46);
    c.moveTo(cx, cy);
    c.lineTo(cx + 34, cy + 12);
    c.stroke();
    c.strokeRect(cx - 24, cy - 104, 48, 26);
    c.strokeRect(cx - 24, cy + 78, 48, 26);
  } else if (index === 2) {
    // A framed painting with a swirl of stars.
    c.strokeRect(cx - 96, cy - 72, 192, 144);
    c.beginPath();
    for (let a = 0; a < Math.PI * 4; a += 0.2) c.lineTo(cx + Math.cos(a) * a * 7, cy + Math.sin(a) * a * 5);
    c.stroke();
  } else {
    // An open book.
    c.moveTo(cx, cy + 60);
    c.quadraticCurveTo(cx - 60, cy + 30, cx - 110, cy + 50);
    c.lineTo(cx - 110, cy - 50);
    c.quadraticCurveTo(cx - 60, cy - 70, cx, cy - 40);
    c.quadraticCurveTo(cx + 60, cy - 70, cx + 110, cy - 50);
    c.lineTo(cx + 110, cy + 50);
    c.quadraticCurveTo(cx + 60, cy + 30, cx, cy + 60);
    c.lineTo(cx, cy - 40);
    c.stroke();
  }
  c.font = "bold 54px Georgia, 'Times New Roman', serif";
  c.textAlign = "center";
  c.fillText(label.toUpperCase(), cx, 300);
  c.font = "22px SFMono-Regular, Consolas, monospace";
  c.fillStyle = "#ffc98a";
  c.fillText("▶ ÉCOUTER LE RÉCIT", cx, 344);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return map;
}

export function createEndorVillage(landing: Landing, circles: Spot[]) {
  const group = new THREE.Group();
  group.name = "endor-village";
  const rand = random(1984);
  const glow = glowTexture();
  // Boards with dark seams and grain; double-sided, so the platforms are seen from below as well.
  const boards = document.createElement("canvas");
  boards.width = boards.height = 256;
  const b = boards.getContext("2d")!;
  b.fillStyle = "#86633f";
  b.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    b.fillStyle = y % 64 ? "#7b5a38" : "#8d6a44";
    b.fillRect(0, y + 2, 256, 28);
    b.fillStyle = "#3a2716";
    b.fillRect(0, y, 256, 2);
    for (let i = 0; i < 14; i++) {
      b.fillStyle = "rgba(40,26,14,.25)";
      b.fillRect(rand() * 256, y + 4 + rand() * 24, 18 + rand() * 50, 1);
    }
  }
  const boardMap = new THREE.CanvasTexture(boards);
  boardMap.colorSpace = THREE.SRGBColorSpace;
  boardMap.wrapS = boardMap.wrapT = THREE.RepeatWrapping;
  // About seven tiles across a platform, so each board is roughly a hand's span wide.
  boardMap.repeat.set(7, 7);
  const decking = new THREE.MeshStandardMaterial({ map: boardMap, roughness: 0.95, side: THREE.DoubleSide });
  const plank = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.95 });
  const beam = new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 0.95 });
  const thatch = new THREE.MeshStandardMaterial({ color: 0x8a7444, roughness: 1 });
  const rope = new THREE.MeshStandardMaterial({ color: 0x9a8058, roughness: 1 });
  const hide = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 1, side: THREE.DoubleSide });
  const structure = new THREE.Group();
  group.add(structure);
  // Obstacles on the platforms (huts, villagers), used by the walking rules up there.
  const deckObstacles: { x: number; z: number; r: number; deck: number }[] = [];

  // Platforms: plank decks round each trunk, railings, huts and lanterns.
  VILLAGE.forEach((tree, index) => {
    const deck = new THREE.Mesh(new THREE.RingGeometry(tree.radius * 0.9, DECK, 48, 1).rotateX(-Math.PI / 2), decking);
    deck.position.set(tree.x, tree.deck, tree.z);
    structure.add(deck);
    part(structure, new THREE.CylinderGeometry(DECK, DECK, 0.35, 48, 1, true), beam, [tree.x, tree.deck - 0.17, tree.z]);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      // Diagonal braces from the trunk out under the platform.
      pipe(structure, [[tree.x + Math.cos(a) * tree.radius, tree.deck - 3.2, tree.z + Math.sin(a) * tree.radius], [tree.x + Math.cos(a) * (DECK - 0.4), tree.deck - 0.2, tree.z + Math.sin(a) * (DECK - 0.4)]], 0.12, beam);
    }
    // Railing posts and two ropes, leaving openings for the ramp landing and the bridges.
    const openings: number[] = [];
    if (index === 0) openings.push(RAMP.start + RAMP.span, Math.atan2(along.y, along.x));
    if (index === 1) openings.push(Math.atan2(-along.y, -along.x));
    if (index === 2) openings.push(Math.atan2(VILLAGE[3].z - tree.z, VILLAGE[3].x - tree.x));
    if (index === 3) openings.push(Math.atan2(VILLAGE[2].z - tree.z, VILLAGE[2].x - tree.x));
    const open = (a: number) => openings.some((o) => Math.abs(Math.atan2(Math.sin(a - o), Math.cos(a - o))) < 0.16);
    for (let k = 0; k < 44; k++) {
      const a = (k / 44) * Math.PI * 2;
      if (open(a)) continue;
      part(structure, new THREE.CylinderGeometry(0.06, 0.07, 1.1, 6), beam, [tree.x + Math.cos(a) * (DECK - 0.15), tree.deck + 0.55, tree.z + Math.sin(a) * (DECK - 0.15)]);
    }
    for (const h of [0.55, 1.05]) {
      const ring = new THREE.TorusGeometry(DECK - 0.15, 0.03, 4, 96);
      part(structure, ring, rope, [tree.x, tree.deck + h, tree.z], [Math.PI / 2, 0, 0]);
    }
    // A hut on the outer side of each platform, away from the walkways.
    const hutAngle = [2.2, 3.4, 0.3, 0.6][index];
    const hx = tree.x + Math.cos(hutAngle) * 7.1,
      hz = tree.z + Math.sin(hutAngle) * 7.1;
    part(structure, new THREE.CylinderGeometry(1.1, 1.15, 2, 14), thatch, [hx, tree.deck + 1, hz]);
    part(structure, new THREE.ConeGeometry(1.55, 1.6, 14), thatch, [hx, tree.deck + 2.75, hz]);
    part(structure, new THREE.PlaneGeometry(0.7, 1.3), hide, [hx - Math.cos(hutAngle) * 1.16, tree.deck + 0.7, hz - Math.sin(hutAngle) * 1.16], [0, Math.PI / 2 - hutAngle, 0]);
    deckObstacles.push({ x: hx, z: hz, r: 1.5, deck: index });
    // Hanging lanterns.
    for (let k = 0; k < 3; k++) {
      const a = hutAngle + 1.4 + k * 1.6;
      const lantern = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffb060, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
      lantern.position.set(tree.x + Math.cos(a) * (tree.radius + 0.3), tree.deck + 2.4, tree.z + Math.sin(a) * (tree.radius + 0.3));
      lantern.scale.setScalar(0.9);
      group.add(lantern);
    }
  });

  // Rope bridges: planks hung on a sagging curve between two platforms, with hand ropes.
  const bridge = (from: THREE.Vector3, to: THREE.Vector3, sag: number) => {
    const length = from.distanceTo(to),
      side = new THREE.Vector3(to.z - from.z, 0, from.x - to.x).normalize(),
      steps = Math.max(8, Math.round(length / 0.45));
    const at = (t: number) => from.clone().lerp(to, t).setY(THREE.MathUtils.lerp(from.y, to.y, t) - Math.sin(t * Math.PI) * sag);
    const heading = Math.atan2(to.x - from.x, to.z - from.z);
    for (let i = 0; i <= steps; i++) {
      const p = at(i / steps);
      part(structure, new THREE.BoxGeometry(1.4, 0.07, 0.32), plank, [p.x, p.y - 0.03, p.z], [0, heading, 0]);
    }
    for (const s of [-1, 1]) {
      const points: [number, number, number][] = [];
      for (let i = 0; i <= 12; i++) {
        const p = at(i / 12).addScaledVector(side, s * 0.72);
        points.push([p.x, p.y + 1, p.z]);
      }
      pipe(structure, points, 0.03, rope);
    }
  };
  bridge(BRIDGE.from, BRIDGE.to, BRIDGE.sag);
  const across = new THREE.Vector2(VILLAGE[3].x - VILLAGE[2].x, VILLAGE[3].z - VILLAGE[2].z).normalize();
  const farFrom = new THREE.Vector3(VILLAGE[2].x + across.x * DECK, VILLAGE[2].deck, VILLAGE[2].z + across.y * DECK),
    farTo = new THREE.Vector3(VILLAGE[3].x - across.x * DECK, VILLAGE[3].deck, VILLAGE[3].z - across.y * DECK);
  bridge(farFrom, farTo, 1.1);

  // The ramp: plank treads coiling up the first tree on stilts, with a rope rail outside.
  const treads = 70;
  for (let i = 0; i <= treads; i++) {
    const p = i / treads,
      inner = rampPoint(p, RAMP.inner + 0.05),
      outer = rampPoint(p, RAMP.outer - 0.05);
    const mid = inner.clone().add(outer).multiplyScalar(0.5);
    part(structure, new THREE.BoxGeometry(RAMP.outer - RAMP.inner, 0.1, 0.55), plank, [mid.x, mid.y - 0.05, mid.z], [0, Math.atan2(outer.x - inner.x, outer.z - inner.z), 0]);
    if (i % 7 === 3 && mid.y > 0.6) part(structure, new THREE.CylinderGeometry(0.09, 0.1, mid.y, 6), beam, [mid.x, mid.y / 2, mid.z]);
  }
  const rail: [number, number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const p = rampPoint(i / 40, RAMP.outer - 0.1);
    rail.push([p.x, p.y + 1, p.z]);
  }
  pipe(structure, rail, 0.035, rope);
  bakePart(structure);

  // The campfire: a ring of stones, crossed logs, flames, embers and a flickering glow.
  const stone = new THREE.MeshStandardMaterial({ color: 0x6d6a60, roughness: 1 });
  const camp = new THREE.Group();
  group.add(camp);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    part(camp, new THREE.IcosahedronGeometry(0.28 + rand() * 0.1, 0), stone, [FIRE.x + Math.cos(a) * 1.05, 0.12, FIRE.y + Math.sin(a) * 1.05], [rand(), rand(), rand()]);
  }
  for (let i = 0; i < 4; i++) part(camp, new THREE.CylinderGeometry(0.1, 0.12, 1.5, 8), beam, [FIRE.x, 0.22, FIRE.y], [Math.PI / 2 - 0.35, (i / 4) * Math.PI, 0]);
  // Seats: logs round the near side of the fire.
  for (const [x, z, turn] of [[-1.6, 16.4, 0.4], [2.2, 16.6, -0.5]]) part(camp, new THREE.CylinderGeometry(0.28, 0.3, 1.8, 10), beam, [x, 0.28, z], [0, turn, Math.PI / 2]);
  bakePart(camp);
  circles.push({ x: FIRE.x, z: FIRE.y, r: 1.55 }, { x: -1.6, z: 16.4, r: 0.85 }, { x: 2.2, z: 16.6, r: 0.85 });
  const flames = Array.from({ length: 7 }, (_, i) => {
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: i % 2 ? 0xffb347 : 0xff6a1a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    group.add(flame);
    return { flame, phase: i * 1.3, spread: (i % 3) * 0.18 };
  });
  const embers = new THREE.Points(
    new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(40 * 3), 3)),
    new THREE.PointsMaterial({ color: 0xffa040, size: 0.07, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  const emberSeeds = Array.from({ length: 40 }, () => ({ a: rand() * Math.PI * 2, r: rand() * 0.5, offset: rand() }));
  group.add(embers);
  const firelight = new THREE.PointLight(0xff8a3a, 40, 18, 2);
  firelight.position.set(FIRE.x, 1.3, FIRE.y);
  group.add(firelight);

  // Villagers: the elder by the fire, two drummers, two dancers, sentries and folk on the platforms.
  type Villager = Ewok & { role: string; phase: number; base: THREE.Vector3; path?: [THREE.Vector3, THREE.Vector3]; spot?: Spot };
  const villagers: Villager[] = [];
  const add = (role: string, at: THREE.Vector3, facing: number, look: number, height = 1, staff?: "spear" | "staff") => {
    const [fur, hood] = FURS[look % FURS.length];
    const villager = ewok(role === "elder" ? "#8c8580" : fur, role === "elder" ? 0x5a4632 : hood, height, staff);
    villager.root.position.copy(at);
    villager.root.rotation.y = facing;
    group.add(villager.root);
    const entry: Villager = { ...villager, role, phase: villagers.length * 1.37, base: at.clone() };
    villagers.push(entry);
    return entry;
  };
  const faceFire = (x: number, z: number) => Math.atan2(FIRE.x - x, FIRE.y - z);
  const elder = add("elder", new THREE.Vector3(-0.99, 0, 17.27), faceFire(-0.99, 17.27), 3, 1.05, "staff");
  // A feather headdress marks the storyteller.
  const feathers = new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.9 });
  for (const s of [-1, 0, 1]) part(elder.head, new THREE.ConeGeometry(0.035, 0.36, 5), feathers, [s * 0.08, 0.34, -0.06], [-0.3, 0, s * 0.35]);
  circles.push({ x: -0.99, z: 17.27, r: 0.55 });
  for (const side of [-1, 1]) {
    const x = side * 3.44,
      z = 17.59;
    add("drummer", new THREE.Vector3(x, 0, z), faceFire(x, z), side > 0 ? 0 : 2);
    part(group, new THREE.CylinderGeometry(0.32, 0.36, 0.55, 14, 1, true), hide, [x + Math.sin(faceFire(x, z)) * 0.55, 0.3, z + Math.cos(faceFire(x, z)) * 0.55]);
    circles.push({ x, z, r: 0.95 });
  }
  for (const side of [-1, 1]) add("dancer", new THREE.Vector3(side * 2.1, 0, 15.2), faceFire(side * 2.1, 15.2), side > 0 ? 4 : 1, 0.95);
  circles.push({ x: -2.1, z: 15.2, r: 0.5 }, { x: 2.1, z: 15.2, r: 0.5 });
  // Sentries pacing at the clearing's edge, under the trees.
  const movers: Spot[] = [];
  for (const [ax, az, bx, bz, look] of [
    [-18, 5, -18, -3, 0],
    [17, -4, 17, 5, 3],
    [-7, -22, 6, -22, 2],
  ]) {
    const sentry = add("sentry", new THREE.Vector3(ax, 0, az), 0, look, 1, "spear");
    sentry.path = [new THREE.Vector3(ax, 0, az), new THREE.Vector3(bx, 0, bz)];
    sentry.spot = { x: ax, z: az, r: 0.45 };
    movers.push(sentry.spot);
  }
  // Up on the platforms, at the railings, looking out.
  VILLAGE.forEach((tree, index) => {
    for (let k = 0; k < 2; k++) {
      const a = [0.9, 2.9, 1.6, 4.2, 2.4, 4.6, 3.6, 5.3][index * 2 + k];
      const x = tree.x + Math.cos(a) * (DECK - 0.9),
        z = tree.z + Math.sin(a) * (DECK - 0.9);
      add("lookout", new THREE.Vector3(x, tree.deck, z), Math.atan2(Math.cos(a), Math.sin(a)), index + k);
      deckObstacles.push({ x, z, r: 0.45, deck: index });
    }
  });
  // One villager keeps crossing the far bridge.
  const crosser = add("crosser", farFrom.clone(), 0, 2);
  crosser.path = [farFrom, farTo];

  // The four totems: one per chapter, round the far side of the fire, each facing it.
  const totemWood = new THREE.MeshStandardMaterial({ color: 0x6e4a2c, roughness: 0.95 });
  const paint = [0xb5442a, 0x2f6f8a, 0xd0a03c, 0x4f7a3a].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  const terminals: ZoneTerminal[] = landing.terminals.slice(0, 4).map((chapter, index) => {
    const angle = [-66, -22, 22, 66][index] * (Math.PI / 180);
    const position = new THREE.Vector3(FIRE.x + Math.sin(angle) * 5.4, 0, FIRE.y + Math.cos(angle) * 5.4);
    const stand = new THREE.Vector3(FIRE.x + Math.sin(angle) * 2.55, 0, FIRE.y + Math.cos(angle) * 2.55);
    const totem = new THREE.Group();
    totem.position.copy(position);
    totem.rotation.y = faceFire(position.x, position.z);
    group.add(totem);
    const pole = new THREE.Group();
    totem.add(pole);
    part(pole, new THREE.CylinderGeometry(0.3, 0.36, 2.9, 12), totemWood, [0, 1.45, 0]);
    // Stacked carved faces, painted in the chapter's colour.
    for (let f = 0; f < 3; f++) {
      const y = 0.55 + f * 0.75;
      part(pole, rounded(0.5, 0.42, 0.18, 0.06), f === 1 ? paint[index] : totemWood, [0, y, 0.3]);
      for (const s of [-1, 1]) part(pole, new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: 0x1a120a }), [s * 0.11, y + 0.06, 0.4]);
    }
    for (const s of [-1, 1]) part(pole, rounded(0.7, 0.12, 0.08, 0.03), paint[index], [s * 0.5, 2.7, 0.05], [0, 0, s * 0.5]);
    part(pole, new THREE.ConeGeometry(0.34, 0.5, 10), paint[index], [0, 3.15, 0]);
    bakePart(pole);
    pole.children.forEach((child) => (child.userData.terminal = index));
    const hologram = new THREE.Mesh(
      new THREE.PlaneGeometry(1.05, 0.79),
      new THREE.MeshBasicMaterial({ map: plaque(chapter.label, index), color: 0xd8c8b0, transparent: true }),
    );
    hologram.position.set(0, 1.95, 0.52);
    hologram.userData.terminal = index;
    totem.add(hologram);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.2, 0.5, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffa050, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    beam.position.y = 0.25;
    totem.add(beam);
    circles.push({ x: position.x, z: position.z, r: 0.55 });
    return { position, angle, hologram, beam, focus: 0, stand };
  });

  let clock = 0,
    gesture = -10;
  const ember = new THREE.Vector3();
  return {
    group,
    terminals,
    movers,
    deckObstacles,
    elder: { root: elder.root, position: new THREE.Vector3(-0.99, 1.05, 17.27), speak: () => (gesture = clock) },
    tick: (dt: number, reduced: boolean) => {
      clock += reduced ? 0 : dt;
      const t = clock;
      // The fire.
      flames.forEach(({ flame, phase, spread }, i) => {
        const lick = reduced ? 0.5 : (t * 1.6 + phase) % 1;
        flame.position.set(FIRE.x + Math.sin(phase * 3) * spread, 0.35 + lick * 1.1, FIRE.y + Math.cos(phase * 3) * spread);
        flame.scale.setScalar((1.3 - lick * 0.9) * (i < 2 ? 1.5 : 1));
        flame.material.opacity = (1 - lick) * 0.85;
      });
      firelight.intensity = reduced ? 40 : 36 + Math.sin(t * 13) * 5 + Math.sin(t * 29) * 3;
      const ep = embers.geometry.getAttribute("position") as THREE.BufferAttribute;
      emberSeeds.forEach((seed, i) => {
        const life = reduced ? seed.offset : (seed.offset + t * 0.35) % 1;
        ember.set(FIRE.x + Math.cos(seed.a + life * 3) * (seed.r + life * 0.4), 0.4 + life * 4, FIRE.y + Math.sin(seed.a + life * 3) * (seed.r + life * 0.4));
        ep.setXYZ(i, ember.x, ember.y, ember.z);
      });
      ep.needsUpdate = true;
      // The villagers.
      villagers.forEach((v) => {
        const k = t + v.phase;
        if (reduced) return;
        v.head.rotation.y = Math.sin(k * 0.5) * 0.35;
        if (v.role === "elder") {
          // Telling the story: slow gestures, arms raised high when someone comes to listen.
          const lifted = Math.max(0, 1 - Math.abs(t - gesture - 1.5) / 1.5);
          v.arms[0].rotation.x = -0.4 - Math.max(0, Math.sin(k * 0.8)) * 0.8 - lifted * 1.6;
          v.arms[1].rotation.x = -0.2 - lifted * 1.2;
          v.body.rotation.x = Math.sin(k * 0.6) * 0.05;
        } else if (v.role === "drummer") {
          v.arms.forEach((arm, i) => (arm.rotation.x = -1 - Math.max(0, Math.sin(k * 9 + i * Math.PI)) * 0.5));
          v.body.position.y = Math.abs(Math.sin(k * 4.5)) * 0.02;
        } else if (v.role === "dancer") {
          v.root.position.y = v.base.y + Math.abs(Math.sin(k * 4.5)) * 0.16;
          v.root.rotation.y += dt * 0.9;
          v.arms.forEach((arm, i) => (arm.rotation.x = -1.6 + Math.sin(k * 4.5 + i * Math.PI) * 0.5));
          v.legs.forEach((leg, i) => (leg.rotation.x = Math.sin(k * 9 + i * Math.PI) * 0.35));
        } else if (v.path) {
          // Pacing between two points, turning at each end.
          const [a, b] = v.path,
            span = a.distanceTo(b),
            speed = v.role === "crosser" ? 0.9 : 0.7;
          const u = ((k * speed) / span) % 2,
            forward = u < 1,
            f = forward ? u : 2 - u;
          v.root.position.lerpVectors(a, b, f);
          if (v.role === "crosser") v.root.position.y = THREE.MathUtils.lerp(a.y, b.y, f) - Math.sin(f * Math.PI) * 1.1;
          v.root.rotation.y = Math.atan2((b.x - a.x) * (forward ? 1 : -1), (b.z - a.z) * (forward ? 1 : -1));
          v.legs.forEach((leg, i) => (leg.rotation.x = Math.sin(k * 8 + i * Math.PI) * 0.45));
          v.arms.forEach((arm, i) => (arm.rotation.x = Math.sin(k * 8 + i * Math.PI + Math.PI) * 0.3));
          v.root.position.y += Math.abs(Math.sin(k * 8)) * 0.03;
          if (v.spot) {
            v.spot.x = v.root.position.x;
            v.spot.z = v.root.position.z;
          }
        } else {
          v.arms[1].rotation.x = -0.3 + Math.sin(k * 0.7) * 0.15;
        }
      });
      terminals.forEach((terminal, i) => {
        const flicker = reduced ? 1 : 0.9 + Math.sin(t * 9 + i) * 0.06;
        terminal.beam.material.opacity = (0.06 + terminal.focus * 0.22) * flicker;
        terminal.hologram.material.color.setScalar(0.8 + terminal.focus * 0.2);
      });
    },
  };
}
