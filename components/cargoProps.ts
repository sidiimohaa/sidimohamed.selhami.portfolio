import * as THREE from "three";
import { bakePart, part, rounded } from "./tatooineCharacters";

// Spacers' cargo, the way it piles up on a landing pad: ribbed metal footlockers, moulded hard cases
// with their latches and handles, small ammunition boxes and ribbed plastic canisters, all of it
// scuffed and dusty. Every piece sits on y = 0, is centred on x and z, and is baked into a few meshes.

type XYZ = [number, number, number];

// One grey scuff map shared by every piece, tinted by each material's colour.
let grime: THREE.CanvasTexture | null = null;
function grimeMap() {
  if (grime) return grime;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#e9e9e9";
  c.fillRect(0, 0, 256, 256);
  let seed = 909;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 70; i++) {
    c.fillStyle = `rgba(70,62,52,${0.03 + rand() * 0.07})`;
    c.beginPath();
    c.ellipse(rand() * 256, rand() * 256, 4 + rand() * 26, 2 + rand() * 12, rand() * 3, 0, Math.PI * 2);
    c.fill();
  }
  for (let i = 0; i < 120; i++) {
    c.strokeStyle = rand() < 0.6 ? `rgba(255,255,255,${0.25 + rand() * 0.3})` : `rgba(40,36,30,${0.2 + rand() * 0.2})`;
    c.lineWidth = 0.6 + rand();
    c.beginPath();
    const x = rand() * 256,
      y = rand() * 256;
    c.moveTo(x, y);
    c.lineTo(x + (rand() - 0.5) * 30, y + (rand() - 0.5) * 8);
    c.stroke();
  }
  // Dust settled along the lower edge.
  const dust = c.createLinearGradient(0, 160, 0, 256);
  dust.addColorStop(0, "rgba(196,170,128,0)");
  dust.addColorStop(1, "rgba(196,170,128,.28)");
  c.fillStyle = dust;
  c.fillRect(0, 160, 256, 96);
  grime = new THREE.CanvasTexture(canvas);
  grime.colorSpace = THREE.SRGBColorSpace;
  grime.wrapS = grime.wrapT = THREE.RepeatWrapping;
  return grime;
}

const materials = new Map<string, THREE.MeshStandardMaterial>();
function finish(color: number, metalness: number, roughness: number) {
  const key = `${color}-${metalness}-${roughness}`;
  let material = materials.get(key);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color, metalness, roughness, map: grimeMap() });
    materials.set(key, material);
  }
  return material;
}
const steel = () => finish(0x6d6f70, 0.75, 0.42);
const black = () => finish(0x26282b, 0.3, 0.6);

const box = (root: THREE.Object3D, w: number, h: number, d: number, material: THREE.Material, at: XYZ, r = 0.01, turn: XYZ = [0, 0, 0]) =>
  part(root, rounded(w, h, d, Math.min(r, w / 2.2, h / 2.2, d / 2.2)), material, at, turn);

// A latch on a face: a hinge plate and its clasp. `out` is the face's normal, x or z.
function latch(root: THREE.Object3D, at: XYZ, along: "x" | "z", sign: number) {
  const metal = steel();
  const plate: XYZ = along === "z" ? [0.06, 0.07, 0.014] : [0.014, 0.07, 0.06];
  box(root, ...plate, metal, at, 0.004);
  const clasp: XYZ = along === "z" ? [at[0], at[1] - 0.03, at[2] + sign * 0.012] : [at[0] + sign * 0.012, at[1] - 0.03, at[2]];
  box(root, along === "z" ? 0.035 : 0.014, 0.05, along === "z" ? 0.014 : 0.035, metal, clasp, 0.004);
}

// A carry handle standing off a face on two mounts.
function handle(root: THREE.Object3D, at: XYZ, along: "x" | "z", sign: number, width = 0.16) {
  const metal = steel();
  const loop = part(root, new THREE.TorusGeometry(width / 2, 0.012, 6, 14, Math.PI), black(), at);
  // Laid flat so it stands out from the face: tipped forward, then turned to face along x if need be.
  loop.rotation.order = "YXZ";
  if (along === "z") loop.rotation.set(sign > 0 ? Math.PI / 2 : -Math.PI / 2, 0, 0);
  else loop.rotation.set(Math.PI / 2, sign * Math.PI / 2, 0);
  for (const end of [-1, 1]) {
    const mount: XYZ = along === "z" ? [at[0] + end * width / 2, at[1], at[2]] : [at[0], at[1], at[2] + end * width / 2];
    box(root, along === "z" ? 0.035 : 0.02, 0.04, along === "z" ? 0.02 : 0.035, metal, mount, 0.004);
  }
}

/** A long metal footlocker: ribs round it, recessed panels, capped corners, latches and side handles. */
export function createTrunk(w: number, h: number, d: number, color = 0x8b8a84) {
  const root = new THREE.Group();
  const body = finish(color, 0.6, 0.48);
  const trim = finish(new THREE.Color(color).multiplyScalar(0.72).getHex(), 0.65, 0.45);
  box(root, w, h, d, body, [0, h / 2, 0], 0.03);
  // The lid's seam, and ribs pressed round the body.
  box(root, w + 0.012, 0.012, d + 0.012, black(), [0, h * 0.8, 0], 0.004);
  for (const y of [h * 0.14, h * 0.48, h * 0.92]) box(root, w + 0.022, 0.028, d + 0.022, trim, [0, y, 0], 0.01);
  // Recessed panels down the long faces.
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++) box(root, w * 0.26, h * 0.26, 0.012, trim, [(-1 + i) * w * 0.31, h * 0.31, side * (d / 2 + 0.002)], 0.006);
  // Corner caps.
  for (const x of [-1, 1]) for (const y of [0.03, h - 0.03]) for (const z of [-1, 1]) box(root, 0.09, 0.09, 0.09, steel(), [x * (w / 2 - 0.035), y, z * (d / 2 - 0.035)], 0.015);
  for (const x of [-0.28, 0.28]) latch(root, [x * w, h * 0.82, d / 2 + 0.012], "z", 1);
  for (const side of [-1, 1]) handle(root, [side * (w / 2 + 0.02), h * 0.62, 0], "x", side);
  // A stencilled plate.
  box(root, 0.14, 0.08, 0.008, finish(0xd9cfb8, 0.1, 0.7), [w * 0.32, h * 0.66, d / 2 + 0.006], 0.003);
  bakePart(root);
  return root;
}

/** A moulded hard case: rounded shell, ribs at the corners, a seam, latches and a carry handle. */
export function createHardCase(w: number, h: number, d: number, color = 0x2e3135) {
  const root = new THREE.Group();
  const shell = finish(color, 0.15, 0.58);
  const rib = finish(new THREE.Color(color).multiplyScalar(0.8).getHex(), 0.15, 0.6);
  box(root, w, h, d, shell, [0, h / 2, 0], 0.045);
  box(root, w + 0.01, 0.018, d + 0.01, rib, [0, h * 0.58, 0], 0.008);
  for (const x of [-1, 1]) for (const z of [-1, 1]) box(root, 0.05, h * 0.9, 0.05, rib, [x * (w / 2 - 0.03), h / 2, z * (d / 2 - 0.03)], 0.018);
  for (const x of [-0.3, 0.3]) latch(root, [x * w, h * 0.58, d / 2 + 0.01], "z", 1);
  handle(root, [0, h * 0.62, d / 2 + 0.02], "z", 1, Math.min(0.22, w * 0.3));
  // Small feet underneath, and the pressure valve on the side.
  for (const x of [-1, 1]) for (const z of [-1, 1]) box(root, 0.06, 0.02, 0.06, black(), [x * w * 0.38, 0.01, z * d * 0.35], 0.006);
  part(root, new THREE.CylinderGeometry(0.025, 0.025, 0.012, 12), steel(), [w / 2 + 0.006, h * 0.35, 0], [0, 0, Math.PI / 2]);
  bakePart(root);
  return root;
}

/** A small ammunition box with a lipped lid, a latch and a folding handle on top. */
export function createSmallBox(w: number, h: number, d: number, color = 0xb9a37e) {
  const root = new THREE.Group();
  const body = finish(color, 0.45, 0.55);
  box(root, w, h * 0.72, d, body, [0, h * 0.36, 0], 0.012);
  box(root, w + 0.02, h * 0.28, d + 0.02, body, [0, h * 0.86, 0], 0.012);
  latch(root, [0, h * 0.7, d / 2 + 0.012], "z", 1);
  part(root, new THREE.TorusGeometry(Math.min(0.08, w * 0.25), 0.01, 6, 14, Math.PI), black(), [0, h + 0.002, 0]);
  bakePart(root);
  return root;
}

/** A ribbed plastic canister, wider at the hips, narrowing to a capped neck, with two side grips. */
export function createCanister(r: number, h: number, color = 0xd9cfb6) {
  const root = new THREE.Group();
  const plastic = finish(color, 0.05, 0.62);
  const profile = [
    [0, 0], [r * 0.92, 0], [r, h * 0.05], [r, h * 0.62], [r * 0.95, h * 0.72], [r * 0.62, h * 0.86], [r * 0.5, h * 0.9], [r * 0.5, h * 0.96], [0, h * 0.96],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  part(root, new THREE.LatheGeometry(profile, 28), plastic);
  for (const y of [0.18, 0.4, 0.58]) part(root, new THREE.TorusGeometry(r * 1.005, 0.012, 6, 28), plastic, [0, y * h, 0], [Math.PI / 2, 0, 0]);
  part(root, new THREE.CylinderGeometry(r * 0.54, r * 0.54, h * 0.06, 20), finish(0x8d8676, 0.1, 0.6), [0, h * 0.98, 0]);
  for (const side of [-1, 1]) {
    const grip = part(root, new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), plastic, [side * r * 0.82, h * 0.78, 0]);
    grip.rotation.set(0, Math.PI / 2, side * 0.6);
  }
  bakePart(root);
  return root;
}

/** A pile of cargo, about 2.6 m across and 1.6 m tall, in one of a few arrangements. */
export function createCargoStack(variant = 0) {
  const root = new THREE.Group();
  root.name = "cargo-stack";
  const put = (item: THREE.Object3D, x: number, y: number, z: number, yaw = 0) => {
    item.position.set(x, y, z);
    item.rotation.y = yaw;
    root.add(item);
    return item;
  };
  const flip = variant % 2 ? -1 : 1;
  // The long footlocker on the ground, and the cases stacked on it.
  put(createTrunk(1.3, 0.48, 0.66), 0.05 * flip, 0, 0.1, 0.04);
  put(createHardCase(0.72, 0.34, 0.5, variant % 2 ? 0x5f7280 : 0x2e3135), 0.12 * flip, 0.48, 0.12, -0.08 * flip);
  put(createHardCase(0.66, 0.28, 0.46, variant % 2 ? 0x2e3135 : 0x6c7f8c), 0.1 * flip, 0.82, 0.1, 0.1 * flip);
  put(createSmallBox(0.42, 0.2, 0.3), 0.18 * flip, 1.1, 0.08, -0.15 * flip);
  // A big upright case leaning in at the end of the pile.
  put(createTrunk(0.62, 0.74, 0.56, 0x7d8174), -0.95 * flip, 0, 0.2, 0.25 * flip);
  // Two canisters, one carrying a small box.
  put(createCanister(0.24, 0.78), 0.98 * flip, 0, 0.05);
  put(createCanister(0.24, 0.72, 0xcfc4a8), 1.42 * flip, 0, -0.12);
  put(createHardCase(0.5, 0.26, 0.4, 0x8b8a84), 1.42 * flip, 0.72, -0.12, 0.2 * flip);
  root.userData.radius = 1.6;
  return root;
}

/** A power unit for the pad: a heavy housing with a vent grille, cooling fins down its sides, hazard
 *  stripes, a stubby exhaust, a cable to the ground and two status lamps. Faces +z. */
export function createPowerUnit(w = 1.4, h = 1.2, d = 0.9, color = 0x77726a) {
  const root = new THREE.Group();
  root.name = "power-unit";
  const body = finish(color, 0.6, 0.5);
  const trim = finish(new THREE.Color(color).multiplyScalar(0.7).getHex(), 0.65, 0.45);
  box(root, w, h * 0.9, d, body, [0, h * 0.5, 0], 0.05);
  box(root, w + 0.04, h * 0.08, d + 0.04, trim, [0, h * 0.04, 0], 0.02);
  // The vent grille on the face, in a recessed frame.
  box(root, w * 0.6, h * 0.46, 0.03, black(), [-w * 0.1, h * 0.52, d / 2 + 0.005], 0.01);
  for (let i = 0; i < 8; i++) box(root, w * 0.56, 0.018, 0.03, trim, [-w * 0.1, h * 0.32 + i * h * 0.056, d / 2 + 0.02], 0.004);
  // Hazard stripes down the right of the face.
  const yellow = finish(0xc9a033, 0.2, 0.6);
  for (let i = 0; i < 4; i++) box(root, w * 0.16, 0.06, 0.012, i % 2 ? black() : yellow, [w * 0.34, h * 0.32 + i * 0.08, d / 2 + 0.006], 0.003);
  // Fins down both sides.
  for (const side of [-1, 1]) for (let i = 0; i < 6; i++) box(root, 0.05, h * 0.7, 0.025, trim, [side * (w / 2 + 0.02), h * 0.5, -d * 0.35 + i * d * 0.14], 0.006);
  // The exhaust stack on top, and a handle rail.
  part(root, new THREE.CylinderGeometry(0.09, 0.11, 0.26, 14), trim, [-w * 0.28, h + 0.08, -d * 0.15]);
  part(root, new THREE.CylinderGeometry(0.07, 0.07, 0.02, 14), black(), [-w * 0.28, h + 0.22, -d * 0.15]);
  for (const x of [-0.18, 0.18]) box(root, 0.03, 0.12, 0.03, steel(), [w * 0.2 + x, h * 0.96, d * 0.25], 0.006);
  box(root, 0.4, 0.03, 0.03, steel(), [w * 0.2, h * 1.02, d * 0.25], 0.006);
  // The cable running from its back down to the ground.
  part(root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(w * 0.3, h * 0.4, -d / 2), new THREE.Vector3(w * 0.38, h * 0.15, -d / 2 - 0.3), new THREE.Vector3(w * 0.2, 0.03, -d / 2 - 0.8)]), 12, 0.035, 6, false), black());
  bakePart(root);
  // Status lamps, left unbaked so they can be told apart.
  for (const [x, colour] of [[w * 0.3, 0x6dff9c], [w * 0.38, 0xffb35c]] as [number, number][])
    part(root, new THREE.SphereGeometry(0.025, 10, 8), new THREE.MeshBasicMaterial({ color: colour, toneMapped: false }), [x, h * 0.82, d / 2 + 0.015]);
  return root;
}
