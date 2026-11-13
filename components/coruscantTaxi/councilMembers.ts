import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// The twelve members of the Jedi Council, seated. Each is one body mesh and one head mesh in vertex
// colours, so the whole Council costs two dozen draw calls and a single material. A figure is built
// in hip space: y = 0 is the surface of the cushion, +Z faces the centre of the room. A head is
// built with its origin at the top of the neck, so turning the mesh turns the head.

type V = [number, number, number];
type Pose = "armrests" | "lap" | "steeple" | "chin";

function kit() {
  const parts: THREE.BufferGeometry[] = [];
  const add = (geometry: THREE.BufferGeometry, color: number) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    g.deleteAttribute("uv");
    const tint = new THREE.Color(color),
      count = g.getAttribute("position").count,
      colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) colors.set([tint.r, tint.g, tint.b], i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    parts.push(g);
  };
  const ball = (at: V, scale: V, color: number, detail = 14) => {
    const g = new THREE.SphereGeometry(1, detail, Math.max(6, Math.round(detail * 0.7)));
    g.scale(...scale);
    g.translate(...at);
    add(g, color);
  };
  // A limb: a tapered cylinder with rounded ends.
  const rod = (a: V, b: V, r1: number, r2: number, color: number, detail = 10) => {
    const from = new THREE.Vector3(...a),
      to = new THREE.Vector3(...b),
      span = to.clone().sub(from);
    const g = new THREE.CylinderGeometry(r2, r1, span.length(), detail, 1, true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), span.clone().normalize()));
    g.translate(from.x + span.x / 2, from.y + span.y / 2, from.z + span.z / 2);
    add(g, color);
    ball(a, [r1, r1, r1], color, detail);
    ball(b, [r2, r2, r2], color, detail);
  };
  // A curved tapering tentacle, horn or braid, optionally striped along its length.
  const taper = (points: V[], r0: number, r1: number, colors: number[], flatten = 1, segments = 18) => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const frames = curve.computeFrenetFrames(segments, false);
    const sides = 8;
    const ring = (i: number) => {
      const t = i / segments,
        centre = curve.getPointAt(t),
        r = THREE.MathUtils.lerp(r0, r1, t);
      return Array.from({ length: sides + 1 }, (_, k) => {
        const a = (k / sides) * Math.PI * 2;
        const normal = frames.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a) * flatten);
        return { position: centre.clone().addScaledVector(normal, r), normal: normal.normalize() };
      });
    };
    const bands = colors.length;
    for (let b = 0; b < bands; b++) {
      const from = Math.floor((b / bands) * segments),
        to = Math.floor(((b + 1) / bands) * segments);
      const position: number[] = [],
        normal: number[] = [];
      for (let i = from; i < to; i++) {
        const low = ring(i),
          high = ring(i + 1);
        for (let k = 0; k < sides; k++) {
          [low[k], high[k], low[k + 1], low[k + 1], high[k], high[k + 1]].forEach((v) => {
            position.push(v.position.x, v.position.y, v.position.z);
            normal.push(v.normal.x, v.normal.y, v.normal.z);
          });
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
      add(g, colors[b]);
    }
  };
  // Cloth: a lathe with soft vertical folds that deepen towards the hem.
  const cloth = (profile: number[][], color: number, options: { depth?: number; z?: number; open?: number; arc?: [number, number]; folds?: number; amount?: number; detail?: number } = {}) => {
    const { depth = 0.78, z = 0, open = 0, arc, folds = 11, amount = 0.05, detail = 48 } = options;
    const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), detail, arc ? arc[0] : open, arc ? arc[1] : Math.PI * 2 - open * 2);
    const p = g.getAttribute("position"),
      top = Math.max(...profile.map(([, y]) => y)),
      bottom = Math.min(...profile.map(([, y]) => y));
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        zz = p.getZ(i);
      const hem = 1 - (y - bottom) / (top - bottom || 1);
      const k = 1 + amount * hem * Math.sin(Math.atan2(x, zz) * folds);
      p.setXYZ(i, x * k, y, zz * k * depth + z);
    }
    g.computeVertexNormals();
    add(g, color);
  };
  return { ball, rod, taper, cloth, add, build: () => mergeGeometries(parts) };
}
type Kit = ReturnType<typeof kit>;

type Dress = { robe: number; tunic: number; trousers: number; boots: number; belt: number; skin: number; skirt?: boolean; pose?: Pose; slim?: number };

const ARMS: Record<Pose, { elbow: V; wrist: V; hand: V }[]> = {
  armrests: [
    { elbow: [0.37, 0.28, -0.03], wrist: [0.39, 0.21, 0.33], hand: [0.39, 0.2, 0.42] },
    { elbow: [-0.37, 0.28, -0.03], wrist: [-0.39, 0.21, 0.33], hand: [-0.39, 0.2, 0.42] },
  ],
  lap: [
    { elbow: [0.31, 0.27, 0.02], wrist: [0.11, 0.17, 0.3], hand: [0.05, 0.15, 0.37] },
    { elbow: [-0.31, 0.27, 0.02], wrist: [-0.11, 0.17, 0.3], hand: [-0.05, 0.15, 0.37] },
  ],
  steeple: [
    { elbow: [0.37, 0.28, 0.02], wrist: [0.14, 0.38, 0.3], hand: [0.04, 0.46, 0.34] },
    { elbow: [-0.37, 0.28, 0.02], wrist: [-0.14, 0.38, 0.3], hand: [-0.04, 0.46, 0.34] },
  ],
  chin: [
    { elbow: [0.37, 0.28, -0.03], wrist: [0.39, 0.21, 0.33], hand: [0.39, 0.2, 0.42] },
    { elbow: [-0.38, 0.22, 0.14], wrist: [-0.2, 0.5, 0.2], hand: [-0.1, 0.61, 0.17] },
  ],
};

function body(k: Kit, d: Dress) {
  const w = d.slim ?? 1;
  // Tunic, with the open-fronted robe over it.
  k.cloth([[0.21 * w, 0.02], [0.2 * w, 0.28], [0.22 * w, 0.5], [0.19 * w, 0.62], [0.07, 0.7]], d.tunic, { depth: 0.7, z: -0.03, amount: 0.02, folds: 7 });
  k.cloth([[0.37 * w, 0.0], [0.34 * w, 0.2], [0.29 * w, 0.42], [0.27 * w, 0.58], [0.17, 0.665], [0.09, 0.7]], d.robe, { depth: 0.74, z: -0.05, open: 0.46 });
  // The belt and the crossed front of the tunic.
  const belt = new THREE.TorusGeometry(0.205 * w, 0.03, 6, 24);
  belt.rotateX(Math.PI / 2);
  belt.scale(1, 1.5, 0.72);
  belt.translate(0, 0.24, -0.03);
  k.add(belt, d.belt);
  k.rod([-0.07, 0.62, 0.11], [0.05, 0.3, 0.145], 0.012, 0.012, d.robe, 6);
  k.rod([0.07, 0.62, 0.11], [-0.05, 0.3, 0.145], 0.012, 0.012, d.robe, 6);
  // The hood, lying on the shoulders.
  const hood = new THREE.TorusGeometry(0.125, 0.062, 8, 20);
  hood.rotateX(Math.PI / 2 + 0.32);
  hood.scale(1.1, 1, 0.92);
  hood.translate(0, 0.665, -0.055);
  k.add(hood, d.robe);
  // Legs.
  [1, -1].forEach((side) => {
    k.rod([side * 0.14, 0.07, -0.02], [side * 0.18, 0.07, 0.42], 0.105, 0.078, d.skirt ? d.robe : d.trousers);
    k.rod([side * 0.18, 0.07, 0.42], [side * 0.19, -0.42, 0.47], 0.068, 0.05, d.trousers);
    k.rod([side * 0.19, -0.42, 0.47], [side * 0.19, -0.5, 0.48], 0.058, 0.066, d.boots);
    k.ball([side * 0.19, -0.52, 0.54], [0.062, 0.042, 0.115], d.boots);
  });
  // Robes falling over the legs, feet showing below.
  if (d.skirt) k.cloth([[0.38, -0.47], [0.34, -0.2], [0.29, 0.06], [0.2, 0.15]], d.robe, { depth: 0.92, z: 0.22, arc: [-1.35, 2.7], amount: 0.07, folds: 14, detail: 36 });
  // Arms, in wide sleeves.
  ARMS[d.pose ?? "armrests"].forEach(({ elbow, wrist, hand }) => {
    const side = Math.sign(elbow[0]);
    const shoulder: V = [side * 0.26 * w, 0.59, -0.08];
    k.rod(shoulder, elbow, 0.095, 0.085, d.robe);
    k.rod(elbow, wrist, 0.085, 0.078, d.robe);
    // The bell of the sleeve.
    const a = new THREE.Vector3(...wrist),
      span = new THREE.Vector3(...hand).sub(a);
    const bell = new THREE.CylinderGeometry(0.105, 0.078, 0.12, 12, 1, true);
    bell.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), span.clone().normalize()));
    bell.translate(a.x, a.y, a.z);
    k.add(bell, d.robe);
    k.ball(hand, [0.042, 0.03, 0.062], d.skin, 10);
  });
}

type Face = { skin: number; iris?: number; brow?: number; lip?: number; ears?: boolean };
function shade(color: number, k: number) {
  return new THREE.Color(color).multiplyScalar(k).getHex();
}
// The human-shaped face most of the Council shares; the species details go on top.
function face(k: Kit, f: Face) {
  const { skin, iris = 0x3a2a1c, brow = shade(skin, 0.5), lip = shade(skin, 0.68), ears = true } = f;
  k.rod([0, -0.08, -0.01], [0, 0.08, 0], 0.056, 0.05, skin);
  k.ball([0, 0.15, 0], [0.105, 0.128, 0.118], skin, 20);
  k.ball([0, 0.08, 0.022], [0.082, 0.072, 0.086], skin, 16);
  k.rod([0, 0.158, 0.112], [0, 0.108, 0.13], 0.012, 0.019, skin, 8);
  k.ball([0, 0.078, 0.102], [0.027, 0.007, 0.009], lip, 8);
  [1, -1].forEach((side) => {
    k.ball([side * 0.041, 0.155, 0.097], [0.021, 0.012, 0.012], 0xe6ded0, 8);
    k.ball([side * 0.041, 0.155, 0.106], [0.0085, 0.0085, 0.005], iris, 8);
    k.rod([side * 0.018, 0.183, 0.108], [side * 0.066, 0.177, 0.088], 0.007, 0.006, brow, 6);
    if (ears) k.ball([side * 0.108, 0.14, -0.002], [0.012, 0.03, 0.019], shade(skin, 0.9), 8);
  });
}

const ROBE = { dark: 0x4a372a, brown: 0x6a4d33, umber: 0x7f6042, tan: 0xb09a74, grey: 0x7a7263 };
const TUNIC = { cream: 0xd8c9ae, sand: 0xbfae88, dust: 0xa39474 };
const BOOT = 0x2a1f18,
  BELT = 0x33241a;

type Member = {
  id: string;
  name: string;
  seat: number;
  scale?: number;
  headScale?: number;
  // Height of the neck in hip space, for those who do not fit the standard body.
  neck?: number;
  // Shown as a hologram: this member attends from afar.
  hologram?: boolean;
  dress: Dress;
  head: (k: Kit) => void;
};

export const COUNCIL_MEMBERS: Member[] = [
  {
    id: "oppo",
    name: "Oppo Rancisis",
    seat: 0,
    dress: { robe: ROBE.dark, tunic: TUNIC.dust, trousers: ROBE.brown, boots: BOOT, belt: BELT, skin: 0x8a6a4c, skirt: true, pose: "lap" },
    head: (k) => {
      face(k, { skin: 0x8a6a4c, iris: 0x1c1712, ears: false });
      // The long banded mane that falls from the crown to the lap.
      const bands = [0xe4d4b2, 0x8a2f26, 0xe4d4b2, 0xb78d58];
      for (let i = 0; i < 16; i++) {
        const a = -2.25 + (i / 15) * 4.5,
          sx = Math.sin(a),
          cz = Math.cos(a);
        k.taper(
          [
            [sx * 0.05, 0.3, cz * 0.03],
            [sx * 0.15, 0.25, cz * 0.13 - 0.02],
            [sx * 0.24, 0.02, cz * 0.14 - 0.03],
            [sx * 0.3, -0.34, cz * 0.18 - 0.02],
            [sx * 0.3, -0.62, cz * 0.22],
          ],
          0.042,
          0.024,
          bands,
        );
      }
    },
  },
  {
    id: "adi",
    name: "Adi Gallia",
    seat: 1,
    hologram: true,
    dress: { robe: ROBE.brown, tunic: TUNIC.cream, trousers: ROBE.brown, boots: BOOT, belt: BELT, skin: 0x5a3b2b, skirt: true, slim: 0.9 },
    head: (k) => {
      face(k, { skin: 0x5a3b2b });
      const band = new THREE.TorusGeometry(0.112, 0.016, 6, 24);
      band.rotateX(Math.PI / 2 - 0.2);
      band.translate(0, 0.2, 0);
      k.add(band, 0x8a2f26);
      [1, -1].forEach((side) =>
        k.taper(
          [
            [side * 0.06, 0.25, -0.04],
            [side * 0.16, 0.32, -0.14],
            [side * 0.22, 0.14, -0.22],
            [side * 0.2, -0.16, -0.2],
          ],
          0.03,
          0.008,
          [0x5a3b2b],
        ),
      );
    },
  },
  {
    id: "plo",
    name: "Plo Koon",
    seat: 2,
    dress: { robe: ROBE.brown, tunic: TUNIC.sand, trousers: ROBE.umber, boots: BOOT, belt: BELT, skin: 0xb86e3e, skirt: true },
    head: (k) => {
      const skin = 0xb86e3e;
      k.rod([0, -0.08, -0.01], [0, 0.08, 0], 0.06, 0.055, 0x2a2622);
      k.ball([0, 0.18, -0.01], [0.112, 0.135, 0.124], skin, 20);
      // Ridge over the cranium and the dark protective goggles.
      k.rod([0, 0.3, 0.02], [0, 0.26, -0.11], 0.012, 0.012, shade(skin, 0.72), 6);
      [1, -1].forEach((side) => {
        k.ball([side * 0.044, 0.17, 0.1], [0.033, 0.027, 0.018], 0x08090b, 14);
        k.ball([side * 0.044, 0.17, 0.092], [0.039, 0.034, 0.018], 0x4a4037, 12);
      });
      // The breathing mask, its tubes and two small tusks.
      k.ball([0, 0.08, 0.04], [0.088, 0.058, 0.09], 0x3d3831, 16);
      k.ball([0, 0.075, 0.105], [0.036, 0.022, 0.026], 0x8d7f6a, 10);
      [1, -1].forEach((side) => {
        k.taper([[side * 0.05, 0.07, 0.1], [side * 0.08, 0.02, 0.12], [side * 0.06, -0.03, 0.12]], 0.009, 0.005, [0xc9bda2]);
        k.taper([[side * 0.08, 0.08, 0.02], [side * 0.14, 0.02, -0.02], [side * 0.14, -0.06, -0.05]], 0.012, 0.012, [0x1d1a17]);
      });
    },
  },
  {
    id: "saesee",
    name: "Saesee Tiin",
    seat: 3,
    dress: { robe: ROBE.umber, tunic: TUNIC.sand, trousers: ROBE.brown, boots: BOOT, belt: BELT, skin: 0xbd8456, skirt: false, pose: "chin" },
    head: (k) => {
      const skin = 0xbd8456;
      face(k, { skin, iris: 0xb88a2a, ears: false });
      // Heavy brow, and the two horns curving down past the jaw.
      k.ball([0, 0.2, 0.05], [0.094, 0.024, 0.07], shade(skin, 0.86), 12);
      [1, -1].forEach((side) =>
        k.taper(
          [
            [side * 0.09, 0.2, 0.0],
            [side * 0.17, 0.215, -0.01],
            [side * 0.205, 0.1, 0.03],
            [side * 0.17, -0.03, 0.09],
            [side * 0.11, -0.1, 0.13],
          ],
          0.034,
          0.006,
          [0xd8cbab, 0xc4b48f, 0x8e7f62],
        ),
      );
    },
  },
  {
    id: "mace",
    name: "Mace Windu",
    seat: 4,
    dress: { robe: ROBE.dark, tunic: TUNIC.dust, trousers: ROBE.dark, boots: BOOT, belt: BELT, skin: 0x4a2f20, skirt: true, pose: "steeple" },
    head: (k) => {
      face(k, { skin: 0x4a2f20, iris: 0x120c08, brow: 0x1a110c, lip: 0x341f15 });
    },
  },
  {
    id: "yoda",
    name: "Maître Yoda",
    seat: 5,
    scale: 0.54,
    headScale: 1.7,
    dress: { robe: ROBE.tan, tunic: TUNIC.cream, trousers: TUNIC.sand, boots: 0x7f8f5a, belt: 0x6d5c43, skin: 0x8c9f66, skirt: true, pose: "lap" },
    head: (k) => {
      const skin = 0x8c9f66;
      k.rod([0, -0.06, -0.01], [0, 0.05, 0], 0.05, 0.05, skin);
      k.ball([0, 0.115, 0.005], [0.122, 0.098, 0.105], skin, 20);
      k.ball([0, 0.07, 0.03], [0.09, 0.05, 0.07], shade(skin, 0.96), 14);
      k.ball([0, 0.1, 0.105], [0.016, 0.013, 0.014], shade(skin, 0.86), 8);
      k.ball([0, 0.055, 0.092], [0.044, 0.005, 0.008], shade(skin, 0.5), 8);
      [1, -1].forEach((side) => {
        k.ball([side * 0.052, 0.125, 0.082], [0.03, 0.023, 0.02], 0xcfc9a6, 10);
        k.ball([side * 0.052, 0.125, 0.098], [0.015, 0.015, 0.006], 0x3b2d14, 8);
        k.rod([side * 0.018, 0.158, 0.098], [side * 0.08, 0.15, 0.072], 0.009, 0.007, shade(skin, 0.84), 6);
        // The great drooping ears.
        k.taper(
          [
            [side * 0.105, 0.125, -0.01],
            [side * 0.19, 0.16, -0.02],
            [side * 0.28, 0.17, -0.03],
            [side * 0.37, 0.11, -0.03],
          ],
          0.05,
          0.006,
          [skin],
          0.45,
        );
        k.taper(
          [
            [side * 0.12, 0.127, 0.012],
            [side * 0.2, 0.158, 0.003],
            [side * 0.29, 0.162, -0.008],
          ],
          0.028,
          0.005,
          [0xa8836a],
          0.3,
        );
      });
      // A few white wisps on the crown.
      for (let i = 0; i < 8; i++) {
        const a = 1.5 + (i / 7) * 3.3;
        k.taper([[Math.sin(a) * 0.05, 0.2, Math.cos(a) * 0.05], [Math.sin(a) * 0.1, 0.205, Math.cos(a) * 0.09], [Math.sin(a) * 0.13, 0.155, Math.cos(a) * 0.11]], 0.004, 0.0015, [0xe9e4d6], 1, 8);
      }
    },
  },
  {
    id: "kiadi",
    name: "Ki-Adi-Mundi",
    seat: 6,
    dress: { robe: ROBE.umber, tunic: TUNIC.sand, trousers: ROBE.brown, boots: 0x4a2b1c, belt: BELT, skin: 0xd8b08c, skirt: false },
    head: (k) => {
      const skin = 0xd8b08c;
      face(k, { skin, brow: 0xe6e0d4 });
      // The tall, conical cranium.
      const dome = new THREE.LatheGeometry([[0.104, 0.14], [0.107, 0.22], [0.098, 0.34], [0.08, 0.46], [0.055, 0.56], [0.03, 0.625], [0.0, 0.64]].map(([r, y]) => new THREE.Vector2(r, y)), 24);
      dome.scale(1, 1, 1.05);
      dome.computeVertexNormals();
      k.add(dome, 0xe2c2a0);
      // White hair behind, moustache and long beard.
      k.ball([0, 0.18, -0.055], [0.1, 0.09, 0.07], 0xe6e0d4, 12);
      [1, -1].forEach((side) => k.taper([[side * 0.012, 0.098, 0.122], [side * 0.05, 0.078, 0.105], [side * 0.062, 0.03, 0.09]], 0.012, 0.004, [0xe6e0d4], 1, 10));
      k.taper([[0, 0.07, 0.1], [0, -0.03, 0.12], [0, -0.15, 0.13], [0, -0.3, 0.14]], 0.055, 0.008, [0xe6e0d4]);
      [1, -1].forEach((side) => k.taper([[side * 0.055, 0.075, 0.075], [side * 0.05, -0.04, 0.11], [side * 0.02, -0.17, 0.13]], 0.034, 0.006, [0xd8d1c1]));
    },
  },
  {
    id: "depa",
    name: "Depa Billaba",
    seat: 7,
    dress: { robe: ROBE.brown, tunic: TUNIC.cream, trousers: ROBE.brown, boots: BOOT, belt: BELT, skin: 0xa0704a, skirt: true, slim: 0.9, pose: "lap" },
    head: (k) => {
      const skin = 0xa0704a;
      face(k, { skin, lip: 0x7a4436 });
      // Hair drawn back into a knot, and the marks on the forehead.
      k.ball([0, 0.17, -0.022], [0.113, 0.128, 0.118], 0x17110c, 18);
      k.ball([0, 0.22, -0.12], [0.05, 0.05, 0.05], 0x17110c, 12);
      k.ball([0.02, 0.215, 0.1], [0.008, 0.008, 0.005], 0xa12c22, 6);
      k.ball([-0.02, 0.215, 0.1], [0.008, 0.008, 0.005], 0xa12c22, 6);
    },
  },
  {
    id: "yarael",
    name: "Yarael Poof",
    seat: 8,
    dress: { robe: ROBE.grey, tunic: TUNIC.sand, trousers: ROBE.grey, boots: BOOT, belt: BELT, skin: 0xb2ad96, skirt: true, slim: 0.78, pose: "lap" },
    head: (k) => {
      const skin = 0xb2ad96;
      // A long neck that lifts a narrow head above the others.
      k.taper([[0, -0.1, -0.02], [0, 0.14, -0.01], [0, 0.3, 0.015], [0, 0.42, 0.02]], 0.058, 0.036, [skin]);
      k.ball([0, 0.54, 0.015], [0.092, 0.135, 0.1], skin, 18);
      k.ball([0, 0.44, 0.03], [0.055, 0.05, 0.062], shade(skin, 0.96), 12);
      k.ball([0, 0.425, 0.085], [0.02, 0.005, 0.006], shade(skin, 0.6), 8);
      [1, -1].forEach((side) => {
        k.ball([side * 0.04, 0.54, 0.098], [0.02, 0.012, 0.01], 0xe6ded0, 8);
        k.ball([side * 0.04, 0.54, 0.106], [0.008, 0.008, 0.004], 0x201b16, 8);
        k.rod([side * 0.018, 0.565, 0.104], [side * 0.066, 0.56, 0.084], 0.006, 0.005, shade(skin, 0.6), 6);
      });
    },
  },
  {
    id: "shaak",
    name: "Shaak Ti",
    seat: 9,
    dress: { robe: ROBE.brown, tunic: TUNIC.cream, trousers: ROBE.umber, boots: BOOT, belt: BELT, skin: 0xa8432e, skirt: true, slim: 0.9 },
    head: (k) => {
      const skin = 0xa8432e,
        stripes = [0xe9e4da, 0x2e4f8c, 0xe9e4da, 0x2e4f8c, 0xe9e4da, 0x2e4f8c];
      face(k, { skin, lip: 0x63241a, ears: false });
      // White marks across the cheeks and brow.
      [1, -1].forEach((side) => {
        k.ball([side * 0.062, 0.115, 0.078], [0.02, 0.012, 0.012], 0xe9e4da, 8);
        k.ball([side * 0.035, 0.205, 0.09], [0.015, 0.01, 0.01], 0xe9e4da, 8);
        // Montrals rising from the head.
        k.taper([[side * 0.06, 0.25, -0.01], [side * 0.11, 0.35, -0.05], [side * 0.12, 0.47, -0.11], [side * 0.09, 0.56, -0.17]], 0.052, 0.009, stripes);
        // Head-tails falling over the shoulders.
        k.taper([[side * 0.09, 0.16, 0.0], [side * 0.15, 0.03, 0.04], [side * 0.16, -0.14, 0.07], [side * 0.14, -0.33, 0.1]], 0.052, 0.012, stripes);
      });
      k.taper([[0, 0.17, -0.1], [0, 0.04, -0.17], [0, -0.16, -0.19], [0, -0.38, -0.2]], 0.058, 0.014, stripes);
    },
  },
  {
    id: "kit",
    name: "Kit Fisto",
    seat: 10,
    hologram: true,
    dress: { robe: ROBE.umber, tunic: TUNIC.sand, trousers: ROBE.brown, boots: BOOT, belt: BELT, skin: 0x6f9a60, skirt: false },
    head: (k) => {
      const skin = 0x6f9a60;
      face(k, { skin, iris: 0x07090a, ears: false });
      // Dark eyes, and head-tails sweeping back from the scalp.
      [1, -1].forEach((side) => k.ball([side * 0.041, 0.158, 0.098], [0.024, 0.018, 0.012], 0x07090a, 10));
      for (let i = 0; i < 18; i++) {
        const a = -2.05 + (i / 17) * 4.1,
          sx = Math.sin(a),
          cz = Math.cos(a) - 0.3,
          len = 0.8 + (i % 3) * 0.14;
        k.taper(
          [
            [sx * 0.07, 0.25, cz * 0.06],
            [sx * 0.13, 0.23, cz * 0.1 - 0.06],
            [sx * 0.2, 0.05 * len, cz * 0.1 - 0.13],
            [sx * 0.2, -0.26 * len, cz * 0.1 - 0.13],
          ],
          0.03,
          0.008,
          [shade(skin, 0.95)],
          1,
          12,
        );
      }
    },
  },
  {
    id: "eeth",
    name: "Eeth Koth",
    seat: 11,
    dress: { robe: ROBE.dark, tunic: TUNIC.dust, trousers: ROBE.brown, boots: BOOT, belt: BELT, skin: 0xb5825a, skirt: true },
    head: (k) => {
      const skin = 0xb5825a;
      face(k, { skin, iris: 0x8a6a1e, ears: true });
      // A crown of short horns and a close beard.
      for (let i = 0; i < 11; i++) {
        const a = -2.3 + (i / 10) * 4.6,
          x = Math.sin(a),
          z = Math.cos(a);
        k.rod([x * 0.096, 0.23, z * 0.1], [x * 0.11, 0.285, z * 0.115], 0.018, 0.004, 0xd5c7a6, 6);
      }
      k.ball([0, 0.045, 0.06], [0.05, 0.035, 0.05], 0x1d1612, 10);
    },
  },
];

const hologramVertex = `varying vec3 vNormal;varying vec3 vView;varying float vY;
 void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vNormal=normalize(normalMatrix*normal);vView=normalize(-mv.xyz);vY=position.y;gl_Position=projectionMatrix*mv;}`;
const hologramFragment = `uniform float time;uniform float reveal;uniform float focus;uniform vec3 color;varying vec3 vNormal;varying vec3 vView;varying float vY;
 void main(){
  float fres=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),1.5);
  float scan=.62+.38*sin(vY*90.0-time*5.0);
  float flick=.88+.12*sin(time*23.0+vY*4.0);
  float a=(.26+fres*.8)*scan*flick*reveal*(.8+focus*.6);
  gl_FragColor=vec4(color*(.7+fres*.8+focus*.5),a);
 }`;

/** Builds every member, ready to be placed on its seat. */
export function createCouncilMembers() {
  return COUNCIL_MEMBERS.map(buildMember);
}
/** Builds one member alone, for a scene outside the Council's chamber. */
export function createCouncilMember(id: string) {
  return buildMember(COUNCIL_MEMBERS.find((member) => member.id === id)!);
}
function buildMember(member: (typeof COUNCIL_MEMBERS)[number]) {
  const flesh = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, metalness: 0, emissive: 0x18110c, side: THREE.DoubleSide });
  flesh.userData.surfaceKind = "cloth";
  {
    const bodyKit = kit();
    body(bodyKit, member.dress);
    const headKit = kit();
    member.head(headKit);
    const headShape = headKit.build();
    if (member.headScale) headShape.scale(member.headScale, member.headScale, member.headScale);
    const hologram = member.hologram
      ? new THREE.ShaderMaterial({
          uniforms: { time: { value: 0 }, reveal: { value: 0 }, focus: { value: 0 }, color: { value: new THREE.Color(0x8fd8ff) } },
          vertexShader: hologramVertex,
          fragmentShader: hologramFragment,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      : null;
    const material = hologram ?? flesh;
    const group = new THREE.Group();
    group.name = member.name;
    group.userData.character = true;
    group.scale.setScalar(member.scale ?? 1);
    const trunk = new THREE.Mesh(bodyKit.build(), material);
    const head = new THREE.Mesh(headShape, material);
    head.position.set(0, member.neck ?? 0.71, 0);
    group.add(trunk, head);
    return { ...member, group, trunk, head, hologram, phase: member.seat * 1.7, yaw: 0, pitch: 0 };
  }
}
