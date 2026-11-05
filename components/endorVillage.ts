import * as THREE from "three";
import { glowTexture, random, type Spot, type ZoneTerminal } from "./landingKit";
import { softBeam } from "./render/softBeam";
import { bakePart, part, pipe, rounded } from "./tatooineCharacters";
import type { Landing } from "./universe";

// The Ewok village round the clearing: platforms on four great trees, huts, rope bridges and a
// ramp coiling up the first trunk; on the ground, the campfire where an elder tells the story,
// drummers and dancers, and a salvaged holoprojector showing one hologram per chapter of "Mes passions".
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
// A small furry forest dweller, after the reference pictures: a big head with a cream face, glossy
// black eyes and a dark nose; a leather hood open at the face, stitched across the forehead and
// ending in a bib on the chest; fluffy ears poking through; dark fur with a pale belly.
function leatherTexture(tone: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const c = canvas.getContext("2d")!,
    rand = random(tone % 997);
  c.fillStyle = `#${new THREE.Color(tone).getHexString()}`;
  c.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 160; i++) {
    const r = 3 + rand() * 10;
    c.fillStyle = rand() < 0.5 ? "rgba(60,26,8,.09)" : "rgba(255,200,140,.07)";
    c.beginPath();
    c.ellipse(rand() * 128, rand() * 128, r, r * 0.6, rand() * 3, 0, Math.PI * 2);
    c.fill();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return map;
}
function ewok(fur: string, hood: number, height = 1, staff?: "spear" | "staff"): Ewok {
  const root = new THREE.Group();
  root.name = "ewok-villager";
  root.userData.character = true;
  // Fur gets a soft sheen at grazing angles, which reads as fuzz.
  const coat = new THREE.MeshPhysicalMaterial({ map: furTexture(fur), roughness: 1, sheen: 1, sheenRoughness: 0.8, sheenColor: new THREE.Color(fur).lerp(new THREE.Color(0xe8dcc4), 0.6) });
  const cream = new THREE.MeshPhysicalMaterial({ map: furTexture("#ebe2cc"), roughness: 1, sheen: 1, sheenRoughness: 0.8, sheenColor: new THREE.Color(0xfff8ec) });
  const leather = new THREE.MeshStandardMaterial({ map: leatherTexture(hood), roughness: 0.85, side: THREE.DoubleSide });
  const stitch = new THREE.MeshStandardMaterial({ color: 0x3a2414, roughness: 0.9 });
  const gloss = new THREE.MeshPhysicalMaterial({ color: 0x080604, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08 });
  gloss.userData.skipSurfaceDetail = true;
  const nose = new THREE.MeshStandardMaterial({ color: 0x2a1e18, roughness: 0.5 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b5a34, roughness: 0.9 });
  const flint = new THREE.MeshStandardMaterial({ color: 0x8c8e88, roughness: 0.5, metalness: 0.3 });
  coat.userData.surfaceKind = cream.userData.surfaceKind = "fur";
  leather.userData.surfaceKind = stitch.userData.surfaceKind = "leather";
  nose.userData.surfaceKind = "skin";
  const body = new THREE.Group();
  root.add(body);
  part(body, new THREE.SphereGeometry(0.3, 18, 14), coat, [0, 0.5, 0]).scale.set(1.12, 1.35, 1);
  part(body, new THREE.SphereGeometry(0.2, 14, 10), cream, [0, 0.46, 0.17]).scale.set(1, 1.25, 0.55);
  // The hood's bib hangs over the chest.
  part(body, new THREE.ConeGeometry(0.22, 0.36, 4), leather, [0, 0.6, 0.21], [Math.PI, Math.PI / 4, 0]).scale.set(1, 1, 0.35);
  part(body, new THREE.CylinderGeometry(0.25, 0.34, 0.24, 18, 1, true), leather, [0, 0.79, -0.02]);
  // Small tapered locks soften the outline without transparent fur layers.
  for (const side of [-1, 1]) {
    for (let lock = 0; lock < 5; lock++) {
      part(body, new THREE.ConeGeometry(.026, .11, 5), coat,
        [side * (.31 - lock * .008), .61 - lock * .065, .045], [0, 0, side * 2.8]);
    }
  }
  bakePart(body);
  const head = new THREE.Group();
  head.position.y = 1.03;
  body.add(head);
  part(head, new THREE.SphereGeometry(0.27, 18, 14), coat);
  part(head, new THREE.SphereGeometry(0.225, 18, 12), cream, [0, -0.01, 0.1]).scale.set(1, 1.05, 0.85);
  part(head, new THREE.SphereGeometry(0.12, 14, 10), cream, [0, -0.08, 0.2]).scale.set(1.1, 0.75, 0.9);
  for (const side of [-1, 1]) {
    part(head, new THREE.SphereGeometry(0.075, 12, 10), coat, [side * 0.085, 0.03, 0.2]).scale.set(1, 0.9, 0.5);
    part(head, new THREE.SphereGeometry(0.044, 18, 12), gloss, [side * 0.085, 0.035, 0.243]).scale.set(1, .86, .64);
    pipe(head, [[side * .047, .041, .261], [side * .083, .071, .262], [side * .125, .047, .244]], .013, coat);
    pipe(head, [[side * .049, .021, .257], [side * .084, .005, .263], [side * .123, .024, .245]], .008, cream);
    part(head, new THREE.SphereGeometry(.067, 14, 10), cream, [side * .056, -.083, .245]).scale.set(1, .65, .8);
    for (let lock = 0; lock < 4; lock++) {
      part(head, new THREE.ConeGeometry(.014, .065, 5), cream,
        [side * (.173 - lock * .017), -.055 - lock * .028, .18], [0, 0, side * 2.6]);
    }
    // Fluffy ears through the hood, their tips pale.
    part(head, new THREE.SphereGeometry(0.075, 10, 8), coat, [side * 0.21, 0.21, -0.03]);
    part(head, new THREE.SphereGeometry(0.05, 12, 8), cream, [side * 0.235, 0.24, -0.01]).scale.set(1, 1.12, .75);
    part(head, new THREE.SphereGeometry(.026, 12, 8), nose, [side * .235, .242, .023]).scale.set(1, 1.12, .3);
  }
  part(head, new THREE.SphereGeometry(0.045, 10, 8), nose, [0, -0.05, 0.305]).scale.set(1.25, 0.8, 0.8);
  for (const side of [-1, 1]) part(head, new THREE.SphereGeometry(.009, 8, 6), gloss, [side * .023, -.06, .335]).scale.z = .35;
  pipe(head, [[0, -.077, .324], [0, -.113, .302]], .006, nose);
  pipe(head, [[-.065, -.118, .281], [0, -.131, .294], [.065, -.118, .281]], .007, nose);
  // The hood: a cap over the crown and forehead, sides falling to the shoulders, open only at the
  // face, and a stitched seam running across the forehead.
  part(head, new THREE.SphereGeometry(0.305, 22, 10, 0, Math.PI * 2, 0, Math.PI * 0.33), leather, [0, 0.02, -0.01]);
  part(head, new THREE.SphereGeometry(0.3, 22, 14, Math.PI / 2 + 0.85, Math.PI * 2 - 1.7, Math.PI * 0.28, Math.PI * 0.52), leather, [0, 0.02, -0.02]);
  for (let k = -4; k <= 4; k++) {
    const a = (k / 4) * 0.75;
    part(head, new THREE.BoxGeometry(0.012, 0.04, 0.012), stitch, [Math.sin(a) * 0.255, 0.18, Math.cos(a) * 0.255 - 0.01], [0.5, a, 0]);
  }
  bakePart(head);
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.29, 0.66, 0.03);
    part(arm, new THREE.CylinderGeometry(0.075, 0.09, 0.34, 10), coat, [0, -0.16, 0]);
    part(arm, new THREE.SphereGeometry(0.068, 12, 8), coat, [0, -0.34, 0.02]);
    for (let finger = 0; finger < 3; finger++) {
      part(arm, new THREE.CapsuleGeometry(.015, .045, 3, 6), nose, [-.032 + finger * .032, -.385, .043], [-.28, 0, 0]);
    }
    part(arm, new THREE.SphereGeometry(.022, 10, 8), nose, [-side * .061, -.349, .056]).scale.set(.75, 1.2, 1);
    if (side > 0 && staff === "staff") {
      part(arm, new THREE.CylinderGeometry(0.02, 0.026, 1.25, 6), wood, [0, -0.2, 0.06]);
      part(arm, new THREE.SphereGeometry(0.06, 8, 6), leather, [0, 0.44, 0.06]);
    }
    bakePart(arm);
    body.add(arm);
    return arm;
  });
  // A spear held across the body in both paws, its flint tip bound with cord.
  if (staff === "spear") {
    const spear = new THREE.Group();
    spear.position.set(0.02, 0.5, 0.3);
    spear.rotation.set(0.2, 0, -0.55);
    part(spear, new THREE.CylinderGeometry(0.02, 0.024, 1.75, 6), wood, [0, 0.2, 0]);
    part(spear, new THREE.ConeGeometry(0.045, 0.2, 4), flint, [0, 1.17, 0]);
    part(spear, new THREE.CylinderGeometry(0.03, 0.03, 0.09, 6), stitch, [0, 1.03, 0]);
    bakePart(spear);
    body.add(spear);
    arms.forEach((arm, i) => arm.rotation.set(-0.95, 0, i ? -0.35 : 0.35));
  }
  const legs = [-1, 1].map((side) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.14, 0.22, 0);
    part(leg, new THREE.CylinderGeometry(0.095, 0.1, 0.22, 10), coat, [0, -0.1, 0]);
    part(leg, new THREE.SphereGeometry(0.09, 10, 8), cream, [0, -0.2, 0.05]).scale.set(1, 0.55, 1.4);
    bakePart(leg);
    root.add(leg);
    return leg;
  });
  root.scale.setScalar(height);
  return { root, body, head, arms, legs };
}
const FURS: [string, number][] = [
  ["#4f3826", 0xb8642c],
  ["#3e2c20", 0x9a5a30],
  ["#6a4c34", 0xc77a3a],
  ["#5a4a3e", 0x8a5634],
  ["#463224", 0xa8603a],
];

// One chapter's hologram above the projector: a ringed planet, a watch, a painting, an open book.
function chapterHologram(index: number, material: THREE.MeshBasicMaterial, lines: THREE.LineBasicMaterial) {
  const g = new THREE.Group();
  const line = (points: THREE.Vector3[]) => g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lines));
  const mesh = (geometry: THREE.BufferGeometry, x = 0, y = 0, z = 0, name = "") => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.name = name;
    g.add(m);
    return m;
  };
  if (index === 0) {
    g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 2), new THREE.MeshBasicMaterial({ color: 0x4fa8d8, wireframe: true, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })));
    mesh(new THREE.TorusGeometry(0.44, 0.012, 4, 64)).rotation.set(Math.PI / 2 - 0.4, 0, 0.2);
    for (const [x, y, z] of [[0.6, 0.3, 0], [-0.5, -0.25, 0.2], [0.1, 0.5, -0.3]]) mesh(new THREE.SphereGeometry(0.03, 8, 6), x, y, z);
  } else if (index === 1) {
    mesh(new THREE.TorusGeometry(0.3, 0.02, 6, 64));
    mesh(new THREE.TorusGeometry(0.22, 0.008, 4, 48));
    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * Math.PI * 2;
      line([new THREE.Vector3(Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0), new THREE.Vector3(Math.cos(a) * 0.28, Math.sin(a) * 0.28, 0)]);
    }
    mesh(new THREE.BoxGeometry(0.018, 0.22, 0.01).translate(0, 0.11, 0), 0, 0, 0, "hand");
    mesh(new THREE.BoxGeometry(0.018, 0.15, 0.01).translate(0, 0.075, 0)).rotation.z = -2.1;
    for (const y of [0.42, -0.42]) mesh(new THREE.BoxGeometry(0.2, 0.2, 0.01), 0, y);
    mesh(new THREE.BoxGeometry(0.06, 0.05, 0.03), 0.33);
  } else if (index === 2) {
    line([new THREE.Vector3(-0.36, -0.27, 0), new THREE.Vector3(0.36, -0.27, 0), new THREE.Vector3(0.36, 0.27, 0), new THREE.Vector3(-0.36, 0.27, 0), new THREE.Vector3(-0.36, -0.27, 0)]);
    const swirl: THREE.Vector3[] = [];
    for (let a = 0; a < Math.PI * 5; a += 0.15) swirl.push(new THREE.Vector3(Math.cos(a) * a * 0.018, Math.sin(a) * a * 0.014, 0));
    line(swirl);
    for (const [x, y] of [[-0.22, 0.14], [0.2, 0.16], [0.24, -0.12]]) mesh(new THREE.CircleGeometry(0.03, 10), x, y);
  } else {
    for (const side of [-1, 1]) {
      const turn = new THREE.Euler(0, side * 0.45, 0);
      line([new THREE.Vector3(0, -0.22, 0), new THREE.Vector3(side * 0.34, -0.2, 0), new THREE.Vector3(side * 0.34, 0.22, 0), new THREE.Vector3(0, 0.2, 0)].map((p) => p.applyEuler(turn)));
      for (let k = 0; k < 5; k++) {
        const y = 0.12 - k * 0.06;
        line([new THREE.Vector3(side * 0.05, y, 0), new THREE.Vector3(side * 0.29, y + 0.005, 0)].map((p) => p.applyEuler(turn)));
      }
    }
  }
  return g;
}
// The label under a hologram: the chapter's name and the hint to listen.
function holoLabel(label: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "rgba(60,160,220,.14)";
  c.fillRect(0, 0, 512, 160);
  c.strokeStyle = "#9fe6ff";
  c.lineWidth = 4;
  c.strokeRect(6, 6, 500, 148);
  c.fillStyle = "#e9f9ff";
  c.textAlign = "center";
  c.font = "bold 58px Arial, Helvetica, sans-serif";
  c.fillText(label.toUpperCase(), 256, 78);
  c.fillStyle = "#ffc98a";
  c.font = "24px SFMono-Regular, Consolas, monospace";
  c.fillText("▶ ÉCOUTER LE RÉCIT", 256, 128);
  c.fillStyle = "rgba(0,0,0,.3)";
  for (let y = 0; y < 160; y += 5) c.fillRect(0, y, 512, 2);
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
  // Straw thatch: long strands in tans and browns, darker where they overlap.
  const straw = document.createElement("canvas");
  straw.width = straw.height = 256;
  const st = straw.getContext("2d")!;
  st.fillStyle = "#7d6a3e";
  st.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const x = rand() * 256,
      y = rand() * 256;
    st.strokeStyle = rand() < 0.5 ? "rgba(170,146,92,.55)" : "rgba(60,46,24,.5)";
    st.lineWidth = 1 + rand() * 1.5;
    st.beginPath();
    st.moveTo(x, y);
    st.lineTo(x + (rand() - 0.5) * 6, y + 20 + rand() * 30);
    st.stroke();
  }
  for (let y = 0; y < 256; y += 32) {
    st.fillStyle = "rgba(40,30,14,.35)";
    st.fillRect(0, y, 256, 3);
  }
  const strawMap = new THREE.CanvasTexture(straw);
  strawMap.colorSpace = THREE.SRGBColorSpace;
  strawMap.wrapS = strawMap.wrapT = THREE.RepeatWrapping;
  strawMap.repeat.set(3, 2);
  const thatch = new THREE.MeshStandardMaterial({ map: strawMap, roughness: 1 });
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

  // Higher up, a second platform on each tree with a dome hut hugging the trunk, as in the
  // reference pictures, reached by ladders; ladders also run up from the ground to the platforms
  // the ramp does not serve.
  const upper = VILLAGE.map((tree, index) => tree.deck + (index === 1 || index === 2 ? 7 : 9.5));
  const ladder = (tree: (typeof VILLAGE)[number], angle: number, from: number, to: number) => {
    const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)),
      side = new THREE.Vector3(-out.z, 0, out.x),
      base = new THREE.Vector3(tree.x, 0, tree.z).addScaledVector(out, tree.radius + 0.18);
    for (const s of [-1, 1]) {
      const rail = base.clone().addScaledVector(side, s * 0.28);
      part(structure, new THREE.CylinderGeometry(0.04, 0.04, to - from, 6), beam, [rail.x, (from + to) / 2, rail.z]);
    }
    for (let y = from + 0.3; y < to; y += 0.38) part(structure, new THREE.CylinderGeometry(0.025, 0.025, 0.58, 5), beam, [base.x, y, base.z], [Math.PI / 2, 0, Math.atan2(side.z, side.x)]);
  };
  VILLAGE.forEach((tree, index) => {
    const y = upper[index],
      outer = tree.radius + 4.2,
      toClearing = Math.atan2(-tree.z, -tree.x);
    const deck = new THREE.Mesh(new THREE.RingGeometry(tree.radius * 0.9, outer, 32, 1).rotateX(-Math.PI / 2), decking);
    deck.position.set(tree.x, y, tree.z);
    structure.add(deck);
    part(structure, new THREE.CylinderGeometry(outer, outer, 0.3, 32, 1, true), beam, [tree.x, y - 0.15, tree.z]);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      pipe(structure, [[tree.x + Math.cos(a) * tree.radius, y - 2.6, tree.z + Math.sin(a) * tree.radius], [tree.x + Math.cos(a) * (outer - 0.3), y - 0.2, tree.z + Math.sin(a) * (outer - 0.3)]], 0.1, beam);
    }
    // The dome hut wraps right round the trunk.
    // A tall thatched dome, its eaves curling out a little at the bottom.
    part(structure, new THREE.SphereGeometry(tree.radius + 1.9, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), thatch, [tree.x, y + 0.2, tree.z]).scale.y = 1.25;
    part(structure, new THREE.TorusGeometry(tree.radius + 1.95, 0.28, 6, 32), thatch, [tree.x, y + 0.3, tree.z], [Math.PI / 2, 0, 0]);
    part(structure, new THREE.PlaneGeometry(1, 1.6), hide, [tree.x + Math.cos(toClearing) * (tree.radius + 1.95), y + 0.9, tree.z + Math.sin(toClearing) * (tree.radius + 1.95)], [0, Math.PI / 2 - toClearing, 0]);
    ladder(tree, toClearing + 0.6, tree.deck, y);
    if (index > 0) ladder(tree, toClearing - 0.4, 0, tree.deck);
  });
  // Two more dome huts on the ground at the clearing's edge.
  for (const [x, z, r] of [
    [-15, -13.5, 2.3],
    [19.5, 10.5, 2],
  ]) {
    part(structure, new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), thatch, [x, 0, z]).scale.y = 1.2;
    const facing = Math.atan2(-z, -x);
    part(structure, new THREE.PlaneGeometry(0.9, 1.4), hide, [x + Math.cos(facing) * (r - 0.05), 0.7, z + Math.sin(facing) * (r - 0.05)], [0, Math.PI / 2 - facing, 0]);
    circles.push({ x, z, r: r + 0.2 });
  }

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
  // Long bridges between the upper platforms, high over the clearing and its back.
  const highBridge = (a: number, b: number, sag: number) => {
    const ta = VILLAGE[a],
      tb = VILLAGE[b];
    const dir = new THREE.Vector2(tb.x - ta.x, tb.z - ta.z).normalize();
    const reachA = ta.radius + 4.2,
      reachB = tb.radius + 4.2;
    bridge(
      new THREE.Vector3(ta.x + dir.x * reachA, upper[a], ta.z + dir.y * reachA),
      new THREE.Vector3(tb.x - dir.x * reachB, upper[b], tb.z - dir.y * reachB),
      sag,
    );
  };
  highBridge(0, 3, 3);
  highBridge(1, 2, 2.5);
  highBridge(0, 1, 1.4);

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
  type Villager = Ewok & { role: string; phase: number; base: THREE.Vector3; path?: [THREE.Vector3, THREE.Vector3]; spot?: Spot; spear?: boolean };
  const villagers: Villager[] = [];
  const add = (role: string, at: THREE.Vector3, facing: number, look: number, height = 1, staff?: "spear" | "staff") => {
    const [fur, hood] = FURS[look % FURS.length];
    const villager = ewok(role === "elder" ? "#8c8580" : fur, role === "elder" ? 0x5a4632 : hood, height, staff);
    villager.root.position.copy(at);
    villager.root.rotation.y = facing;
    group.add(villager.root);
    const entry: Villager = { ...villager, role, phase: villagers.length * 1.37, base: at.clone(), spear: staff === "spear" };
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

  // The salvaged holoprojector beyond the fire: an Imperial unit on a tripod of branches, dressed
  // with feathers and cord, projecting one hologram per chapter.
  const P = new THREE.Vector2(FIRE.x, FIRE.y + 5.4);
  const steelDark = new THREE.MeshStandardMaterial({ color: 0x2c3136, roughness: 0.45, metalness: 0.7 });
  const branch = new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 0.95 });
  const feather = new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.9 });
  const emitterGlow = new THREE.MeshBasicMaterial({ color: 0x8fdcff });
  const projector = new THREE.Group();
  projector.position.set(P.x, 0, P.y);
  group.add(projector);
  const rig = new THREE.Group();
  projector.add(rig);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.3;
    pipe(rig, [[Math.cos(a) * 0.75, 0, Math.sin(a) * 0.75], [Math.cos(a) * 0.3, 0.55, Math.sin(a) * 0.3], [Math.cos(a) * 0.12, 0.82, Math.sin(a) * 0.12]], 0.05, branch);
    part(rig, new THREE.ConeGeometry(0.03, 0.34, 4), feather, [Math.cos(a + 0.5) * 0.55, 0.5, Math.sin(a + 0.5) * 0.55], [0, 0, Math.PI]);
  }
  part(rig, new THREE.CylinderGeometry(0.5, 0.42, 0.22, 24), steelDark, [0, 0.92, 0]);
  part(rig, new THREE.CylinderGeometry(0.28, 0.3, 0.1, 20), steelDark, [0, 1.07, 0]);
  part(rig, new THREE.TorusGeometry(0.47, 0.03, 6, 32), rope, [0, 0.88, 0], [Math.PI / 2, 0, 0]);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    part(rig, rounded(0.08, 0.04, 0.03, 0.01), steelDark, [Math.cos(a) * 0.5, 0.98, Math.sin(a) * 0.5], [0, -a, 0]);
  }
  bakePart(rig);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    part(projector, new THREE.SphereGeometry(0.025, 8, 6), emitterGlow, [Math.cos(a) * 0.2, 1.13, Math.sin(a) * 0.2]);
  }
  const cone = part(
    projector,
    new THREE.CylinderGeometry(1.5, 0.25, 0.9, 32, 1, true),
    softBeam(new THREE.MeshBasicMaterial({ color: 0x4fb8e8, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })),
    [0, 1.58, 0],
  );
  circles.push({ x: P.x, z: P.y, r: 1.05 });
  const holograms: THREE.Group[] = [];
  const terminals: ZoneTerminal[] = landing.terminals.slice(0, 4).map((chapter, index) => {
    // Four directions fanning out towards the fire and the clearing.
    const angle = [-63, -21, 21, 63][index] * (Math.PI / 180);
    const dir = new THREE.Vector2(Math.sin(angle), -Math.cos(angle));
    const position = new THREE.Vector3(P.x + dir.x * 1.25, 0, P.y + dir.y * 1.25);
    const stand = new THREE.Vector3(P.x + dir.x * 3.7, 0, P.y + dir.y * 3.7);
    // A deeper blue than the other holograms, so it does not burn out to white against the sunlit haze.
    const material = new THREE.MeshBasicMaterial({ color: 0x4fa8d8, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const lines = new THREE.LineBasicMaterial({ color: 0x4fa8d8, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending });
    const holo = chapterHologram(index, material, lines);
    holo.position.set(position.x, 2.05, position.z);
    holo.rotation.y = Math.atan2(dir.x, dir.y);
    holo.traverse((o) => (o.userData.terminal = index));
    group.add(holo);
    holograms.push(holo);
    const hologram = new THREE.Mesh(
      new THREE.PlaneGeometry(0.78, 0.24),
      new THREE.MeshBasicMaterial({ map: holoLabel(chapter.label), color: 0x9fdcff, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    hologram.position.set(position.x + dir.x * 0.1, 1.5, position.z + dir.y * 0.1);
    hologram.rotation.y = Math.atan2(dir.x, dir.y);
    hologram.userData.terminal = index;
    group.add(hologram);
    // A thin beam from the emitter up to the hologram.
    const from = new THREE.Vector3(P.x, 1.13, P.y),
      to = new THREE.Vector3(position.x, 1.85, position.z);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.04, from.distanceTo(to), 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x4fb8e8, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    beam.position.copy(from).add(to).multiplyScalar(0.5);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    group.add(beam);
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
          // Spear carriers keep both paws on the shaft; the others swing their arms.
          if (!v.spear) v.arms.forEach((arm, i) => (arm.rotation.x = Math.sin(k * 8 + i * Math.PI + Math.PI) * 0.3));
          v.root.position.y += Math.abs(Math.sin(k * 8)) * 0.03;
          if (v.spot) {
            v.spot.x = v.root.position.x;
            v.spot.z = v.root.position.z;
          }
        } else {
          v.arms[1].rotation.x = -0.3 + Math.sin(k * 0.7) * 0.15;
        }
      });
      // The holograms turn slowly and flicker; the one being read grows and brightens.
      const flicker = reduced ? 1 : 0.92 + Math.sin(t * 7) * 0.04 + (Math.sin(t * 31) > 0.97 ? -0.2 : 0);
      cone.material.opacity = 0.08 * flicker;
      terminals.forEach((terminal, i) => {
        const holo = holograms[i];
        holo.rotation.y = Math.atan2(Math.sin(terminal.angle), -Math.cos(terminal.angle)) + (reduced ? 0 : Math.sin(t * 0.5 + i) * 0.5);
        holo.position.y = 2.05 + (reduced ? 0 : Math.sin(t * 1.2 + i) * 0.04);
        holo.scale.setScalar(0.85 * (1 + terminal.focus * 0.15));
        holo.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | undefined;
          if (m && "opacity" in m) m.opacity = (0.35 + terminal.focus * 0.35) * flicker;
          if (o.name === "hand" && !reduced) o.rotation.z = -t * 1.2;
        });
        terminal.beam.material.opacity = (0.06 + terminal.focus * 0.14) * flicker;
        terminal.hologram.material.opacity = (0.45 + terminal.focus * 0.5) * flicker;
      });
    },
  };
}
