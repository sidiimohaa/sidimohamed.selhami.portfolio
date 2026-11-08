import * as THREE from "three";
import { bakePart, part } from "./tatooineCharacters";

// A Mos Eisley market stand: a sun-bleached timber frame with spear-tipped front posts, a striped
// canvas sagging over it with a string of pennants beneath, shelves of pots, jars and bottles at the
// back, a counter laid with fruit and jugs, barrels, a basket and a bucket on the sand, rags and a
// bag hanging from the posts. It faces +z, sits on y = 0 and is about 3 m wide and 1.6 m deep.

type XYZ = [number, number, number];

function canvasMap(width: number, height: number, draw: (c: CanvasRenderingContext2D, rand: () => number) => void, seed: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  let state = seed;
  const rand = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
  draw(canvas.getContext("2d")!, rand);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  return map;
}

// Grey, sun-dried planks: grain running along v, seams between boards, knots and dust.
const woodMap = () =>
  canvasMap(256, 256, (c, rand) => {
    c.fillStyle = "#9a8670";
    c.fillRect(0, 0, 256, 256);
    for (let board = 0; board < 8; board++) {
      const x = board * 32;
      c.fillStyle = `rgba(${120 + rand() * 40},${100 + rand() * 30},${80 + rand() * 25},.55)`;
      c.fillRect(x, 0, 32, 256);
      for (let line = 0; line < 9; line++) {
        c.strokeStyle = `rgba(60,48,36,${0.12 + rand() * 0.18})`;
        c.lineWidth = 0.6 + rand();
        c.beginPath();
        const at = x + 2 + rand() * 28;
        c.moveTo(at, 0);
        c.bezierCurveTo(at + (rand() - 0.5) * 6, 80, at + (rand() - 0.5) * 6, 170, at + (rand() - 0.5) * 4, 256);
        c.stroke();
      }
      c.fillStyle = "rgba(40,30,22,.6)";
      c.fillRect(x, 0, 1.5, 256);
      if (rand() < 0.6) {
        c.fillStyle = "rgba(60,44,30,.5)";
        c.beginPath();
        c.ellipse(x + 8 + rand() * 16, rand() * 256, 3, 5, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
  }, 4021);

// Undyed canvas with woven stripes and weather stains.
const canvasCloth = (stripe: string) =>
  canvasMap(256, 256, (c, rand) => {
    c.fillStyle = "#d8ccb3";
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 400; i++) {
      c.fillStyle = i % 2 ? "rgba(255,250,236,.08)" : "rgba(90,74,52,.06)";
      c.fillRect(rand() * 256, rand() * 256, 1 + rand() * 30, 1);
    }
    for (const [x, w] of [[52, 6], [62, 2], [180, 9], [194, 3]]) {
      c.fillStyle = stripe;
      c.fillRect(x, 0, w, 256);
    }
    for (let i = 0; i < 14; i++) {
      c.fillStyle = `rgba(120,92,60,${0.05 + rand() * 0.1})`;
      c.beginPath();
      c.ellipse(rand() * 256, rand() * 256, 10 + rand() * 30, 6 + rand() * 18, rand() * 3, 0, Math.PI * 2);
      c.fill();
    }
  }, 77 + stripe.length);

const lathe = (points: [number, number][], segments = 14) => new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);
// The shapes of the potter: a jar, a bowl, a bottle and a jug, each about its own unit size.
const POT_SHAPES: [number, number][][] = [
  [[0, 0], [0.05, 0], [0.075, 0.05], [0.08, 0.1], [0.055, 0.17], [0.04, 0.19], [0.045, 0.21], [0, 0.21]],
  [[0, 0], [0.04, 0], [0.09, 0.04], [0.11, 0.07], [0.1, 0.075], [0, 0.03]],
  [[0, 0], [0.04, 0], [0.045, 0.12], [0.03, 0.17], [0.014, 0.2], [0.014, 0.26], [0, 0.26]],
  [[0, 0], [0.06, 0], [0.085, 0.06], [0.08, 0.16], [0.05, 0.22], [0.055, 0.25], [0, 0.25]],
];

export function createMarketStand(variant = 0) {
  const root = new THREE.Group();
  root.name = `market-stand-${variant}`;
  let seed = 31 + variant * 97;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const wood = new THREE.MeshStandardMaterial({ color: 0xffffff, map: woodMap(), roughness: 0.92 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x8a7966, map: woodMap(), roughness: 0.95 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x3a3732, metalness: 0.6, roughness: 0.55 });
  const canopy = new THREE.MeshStandardMaterial({ color: 0xffffff, map: canvasCloth(variant % 2 ? "#5b6f86" : "#8a5a3c"), roughness: 1, side: THREE.DoubleSide });
  const rags = [0xb4532f, 0xc9a46a, 0x5b6f86, 0x8c6d4e, 0xd8ccb3].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide }));
  const clay = [0xa5583a, 0xc28a5a, 0xd8c8a6, 0x8d4a32, 0x9a6a3e].map((color, i) => new THREE.MeshStandardMaterial({ color, roughness: i === 4 ? 0.4 : 0.8, metalness: i === 4 ? 0.7 : 0 }));
  const fruit = [0xd4893c, 0xb8532c, 0x9a9a4a, 0x7a4a6a].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
  const wicker = new THREE.MeshStandardMaterial({ color: 0xa88d5e, roughness: 1 });
  const box = (w: number, h: number, d: number, material: THREE.Material, at: XYZ, turn: XYZ = [0, 0, 0]) => part(root, new THREE.BoxGeometry(w, h, d), material, at, turn);
  const W = 3,
    D = 1.6,
    front = D / 2 - 0.05,
    back = -D / 2 + 0.05;

  // The frame: four posts, the front ones taller and spear-tipped, beams round the top, corner braces.
  for (const side of [-1, 1]) {
    box(0.11, 2.75, 0.11, wood, [side * W / 2, 1.375, front]);
    part(root, new THREE.ConeGeometry(0.06, 0.22, 4), iron, [side * W / 2, 2.86, front], [0, Math.PI / 4, 0]);
    part(root, new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8), iron, [side * W / 2, 2.76, front]);
    box(0.1, 2.5, 0.1, darkWood, [side * W / 2, 1.25, back]);
    box(0.08, 0.08, D, wood, [side * W / 2, 2.42, 0]);
    box(0.06, 0.06, 0.62, wood, [side * (W / 2 - 0.22), 2.2, front], [0, 0, side * 0.75]);
    box(0.06, 0.06, 0.5, wood, [side * W / 2, 2.22, front - 0.2], [-0.75, 0, 0]);
  }
  box(W + 0.12, 0.09, 0.09, wood, [0, 2.48, front]);
  box(W + 0.1, 0.09, 0.09, darkWood, [0, 2.42, back]);

  // The canvas, sagging between the beams and rolled over the front, with its scalloped edge.
  const sheet = new THREE.PlaneGeometry(W + 0.35, D + 0.3, 20, 10);
  sheet.rotateX(-Math.PI / 2);
  const p = sheet.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / ((W + 0.35) / 2),
      z = p.getZ(i) / ((D + 0.3) / 2);
    p.setY(i, -0.2 * Math.cos((x * Math.PI) / 2) * Math.cos((z * Math.PI) / 2) - 0.04 * Math.sin(x * 9 + z * 4));
  }
  sheet.computeVertexNormals();
  part(root, sheet, canopy, [0, 2.62, 0]);
  const roll = part(root, new THREE.CylinderGeometry(0.08, 0.08, W + 0.35, 14), canopy, [0, 2.6, front + 0.15], [0, 0, Math.PI / 2]);
  roll.scale.z = 0.8;
  const flap = new THREE.PlaneGeometry(W + 0.35, 0.32, 24, 2);
  const fp = flap.getAttribute("position");
  for (let i = 0; i < fp.count; i++) if (fp.getY(i) < 0) fp.setY(i, fp.getY(i) + Math.abs(Math.sin(fp.getX(i) * 5)) * 0.1);
  flap.computeVertexNormals();
  part(root, flap, canopy, [0, 2.42, front + 0.2]);

  // Pennants on a sagging string under the front beam.
  const pennant = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.08, 0), new THREE.Vector2(0.08, 0), new THREE.Vector2(0, -0.17)]));
  const along = (x: number) => 2.24 - 0.12 * Math.cos((x / (W / 2)) * (Math.PI / 2));
  part(root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => new THREE.Vector3(-W / 2 + (i * W) / 8, along(-W / 2 + (i * W) / 8), front + 0.06))), 24, 0.006, 4, false), iron);
  for (let i = 0; i < 13; i++) {
    const x = -W / 2 + 0.18 + i * ((W - 0.36) / 12);
    part(root, pennant, rags[(i + variant) % rags.length], [x, along(x), front + 0.065]);
  }
  // Rags drying from the string inside, and long cloths hung from the front posts.
  for (let i = 0; i < 6; i++) {
    const cloth = new THREE.PlaneGeometry(0.22 + rand() * 0.12, 0.3 + rand() * 0.25, 2, 4);
    const cp = cloth.getAttribute("position");
    for (let j = 0; j < cp.count; j++) cp.setZ(j, Math.sin(cp.getY(j) * 9 + i) * 0.02);
    part(root, cloth, rags[(i * 2 + variant) % rags.length], [-1.1 + i * 0.44, 2.05 - rand() * 0.06, 0.35]);
  }
  for (const side of [-1, 1]) {
    const banner = new THREE.PlaneGeometry(0.26, 1.05, 2, 8);
    const bp = banner.getAttribute("position");
    for (let j = 0; j < bp.count; j++) bp.setZ(j, Math.sin(bp.getY(j) * 5) * 0.03);
    part(root, banner, rags[side < 0 ? 0 : 2], [side * (W / 2 + 0.08), 1.85, front + 0.02], [0, side * 1.3, 0]);
  }
  // A cloth bag hanging from a hook on the right.
  part(root, new THREE.CylinderGeometry(0.006, 0.006, 0.5, 4), iron, [W / 2 + 0.22, 1.98, front - 0.1]);
  box(0.3, 0.025, 0.025, iron, [W / 2 + 0.1, 2.23, front - 0.1]);
  const bag = part(root, new THREE.SphereGeometry(0.15, 12, 10), rags[1], [W / 2 + 0.22, 1.62, front - 0.1]);
  bag.scale.set(0.9, 1.25, 0.6);

  // The back: planks, three shelves on their brackets, laden with pottery.
  box(W - 0.05, 2.15, 0.04, darkWood, [0, 1.12, back - 0.03]);
  [1.05, 1.5, 1.95].forEach((y, shelf) => {
    box(W - 0.15, 0.04, 0.32, wood, [0, y, back + 0.15]);
    for (const x of [-1.1, 0, 1.1]) box(0.04, 0.12, 0.25, darkWood, [x, y - 0.08, back + 0.12]);
    let x = -W / 2 + 0.2;
    while (x < W / 2 - 0.2) {
      const kind = Math.floor(rand() * 4);
      const size = 0.8 + rand() * 0.7;
      const pot = part(root, lathe(POT_SHAPES[kind]), clay[Math.floor(rand() * clay.length)], [x, y + 0.02, back + 0.15 + (rand() - 0.5) * 0.08]);
      pot.scale.setScalar(size);
      x += (kind === 1 ? 0.24 : 0.17) * size + 0.04;
      if (shelf === 1 && rand() < 0.2) {
        box(0.16, 0.1, 0.14, darkWood, [x + 0.06, y + 0.07, back + 0.15]);
        x += 0.2;
      }
    }
  });

  // The counter: a planked top on legs, a low shelf, and the day's goods.
  const counterZ = 0.2;
  box(2.3, 0.07, 0.72, wood, [0, 0.92, counterZ]);
  box(2.3, 0.18, 0.04, darkWood, [0, 0.82, counterZ + 0.34]);
  for (const x of [-1.08, 1.08]) for (const z of [-0.3, 0.3]) box(0.07, 0.88, 0.07, darkWood, [x, 0.44, counterZ + z]);
  box(2.2, 0.04, 0.62, darkWood, [0, 0.24, counterZ]);
  // A tray heaped with fruit, jugs, bowls.
  box(0.62, 0.04, 0.38, darkWood, [-0.1, 0.975, counterZ + 0.02]);
  for (let i = 0; i < 16; i++) {
    const a = i * 2.4,
      reach = Math.sqrt(i / 16) * 0.2;
    part(root, new THREE.IcosahedronGeometry(0.045 + (i % 3) * 0.006, 1), fruit[(i + variant) % fruit.length], [-0.1 + Math.sin(a) * reach * 1.4, 1.03 + (i < 4 ? 0.04 : 0), counterZ + 0.02 + Math.cos(a) * reach * 0.8]);
  }
  [[-0.85, 3, 4], [-0.6, 0, 2], [0.45, 3, 4], [0.7, 1, 0], [0.95, 1, 1]].forEach(([x, kind, colour]) => {
    part(root, lathe(POT_SHAPES[kind]), clay[colour], [x, 0.955, counterZ - 0.05]).scale.setScalar(kind === 1 ? 1.3 : 1.15);
  });
  for (const x of [-0.7, -0.2, 0.4, 0.8]) part(root, lathe(POT_SHAPES[0]), clay[(Math.round(x * 10) + 20) % clay.length], [x, 0.26, counterZ]).scale.setScalar(1.3);

  // Barrels, a basket, a bucket and a bowl of fruit on the sand.
  const barrel = (x: number, z: number, r: number, h: number) => {
    part(root, lathe([[0, 0], [r * 0.86, 0], [r, h * 0.5], [r * 0.86, h], [0, h]], 18), darkWood, [x, 0, z]);
    for (const y of [0.12, 0.88]) part(root, new THREE.TorusGeometry(r * (y < 0.5 ? 0.91 : 0.91), 0.012, 4, 20), iron, [x, y * h, z], [Math.PI / 2, 0, 0]);
    part(root, new THREE.TorusGeometry(r * 1.0, 0.012, 4, 20), iron, [x, h * 0.42, z], [Math.PI / 2, 0, 0]);
  };
  barrel(-1.25, 0.62, 0.27, 0.72);
  barrel(-1.7, 0.3, 0.22, 0.6);
  barrel(1.3, 0.6, 0.27, 0.68);
  // A basket on the left barrel, goods on the right one.
  part(root, lathe([[0, 0], [0.13, 0], [0.18, 0.18], [0.19, 0.2], [0, 0.04]], 14), wicker, [-1.25, 0.72, 0.62]);
  part(root, new THREE.TorusGeometry(0.12, 0.01, 4, 14, Math.PI), wicker, [-1.25, 0.92, 0.62]);
  for (let i = 0; i < 5; i++) part(root, new THREE.CylinderGeometry(0.03, 0.03, 0.34, 6), rags[3], [1.2 + i * 0.05, 0.72, 0.56 + (i % 2) * 0.05], [0, i * 0.4, Math.PI / 2]);
  part(root, lathe([[0, 0], [0.14, 0], [0.17, 0.26], [0, 0.26]], 14), darkWood, [1.82, 0, 0.75]);
  part(root, new THREE.TorusGeometry(0.17, 0.008, 4, 16), iron, [1.82, 0.2, 0.75], [Math.PI / 2, 0, 0]);
  part(root, lathe([[0, 0], [0.12, 0], [0.26, 0.1], [0.27, 0.13], [0, 0.04]], 16), clay[1], [0.95, 0, 1.05]);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4,
      reach = Math.sqrt(i / 9) * 0.17;
    part(root, new THREE.IcosahedronGeometry(0.05, 1), fruit[0], [0.95 + Math.sin(a) * reach, 0.13, 1.05 + Math.cos(a) * reach]);
  }
  bakePart(root);
  return root;
}
