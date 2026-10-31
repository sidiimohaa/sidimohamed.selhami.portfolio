import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { tieGeometry } from "../tieModel";
import { createStandingHuman } from "../humanFigure";
import { createSandtrooper } from "../stormtrooperModel";
import { createShipModel } from "../shipModel";
import { createSurfaceNavigator } from "../surfaceNavigation";
import { education, experiences, identity, skillTree, statusLabel } from "./cvData";
import { createStationPresences } from "./stationPresences";

// The inside of the Death Star, built for the professional record: a hangar that welcomes the
// visitor, a main corridor to a hub, and from it the archives (experience), the training centre
// (education), the circular skills room and, by lift, the command room (projects). A side door
// of the hangar leads straight to the confidential archive holding the full CV.
// Static architecture is merged per material; doors, holograms and figures stay separate.

export type RoomId = "hangar" | "passage" | "dossier" | "corridor" | "hub" | "west" | "archives" | "east" | "formation" | "north" | "skills" | "liftA" | "liftB" | "command";
export const roomNames: Record<RoomId, string> = {
  hangar: "Hangar impérial · Accueil",
  passage: "Accès aux archives confidentielles",
  dossier: "Archives confidentielles · Dossier CV",
  corridor: "Couloir principal",
  hub: "Carrefour central",
  west: "Galerie vers les archives",
  archives: "Archives impériales · Expériences",
  east: "Galerie vers la formation",
  formation: "Centre de formation · Parcours académique",
  north: "Galerie vers les compétences",
  skills: "Salle des compétences",
  liftA: "Ascenseur",
  liftB: "Ascenseur",
  command: "Salle de commandement · Projets",
};
type Rect = { x0: number; x1: number; z0: number; z1: number };
type Area = Rect & { room: RoomId };
export type Interactable = { id: string; label: string; room: RoomId; position: THREE.Vector3; reach: number };
type Side = "n" | "s" | "e" | "w";
type Gap = { side: Side; at: number; width: number; height?: number; bottom?: number; door?: boolean };
type LightSlot = { at: [number, number, number]; color: number; power: number; range: number };

export const SPAWN = { x: 0, z: -13, yaw: 0 };
export const LIFT_A = { x: -6.5, z: -101.8 };
export const LIFT_B = { x: 102, z: -28.2 };
export const SKILLS_CENTRE = { x: 0, z: -140 };
const SKILLS_RADIUS = 16;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

// --- Textures, all painted on canvases ---
function paint(width: number, height: number, draw: (c: CanvasRenderingContext2D) => void, repeat = true) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d")!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
const wallTexture = () =>
  paint(512, 512, (c) => {
    c.fillStyle = "#53585f";
    c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 900; i++) {
      c.fillStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,255,255"},${Math.random() * 0.035})`;
      c.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 30, 2 + Math.random() * 30);
    }
    c.strokeStyle = "rgba(10,12,14,.85)";
    c.lineWidth = 4;
    for (const [x, y, w, h] of [
      [0, 0, 512, 160],
      [0, 160, 256, 352],
      [256, 160, 256, 200],
      [256, 360, 256, 152],
    ])
      c.strokeRect(x + 2, y + 2, w - 4, h - 4);
    c.strokeStyle = "rgba(255,255,255,.08)";
    c.lineWidth = 2;
    c.strokeRect(14, 14, 484, 132);
    for (let i = 0; i < 6; i++) {
      c.fillStyle = "rgba(8,10,12,.7)";
      c.fillRect(300, 190 + i * 14, 170, 6);
    }
    c.fillStyle = "rgba(0,0,0,.5)";
    for (const [x, y] of [
      [20, 20],
      [492, 20],
      [20, 492],
      [492, 492],
      [236, 176],
      [276, 176],
    ]) {
      c.beginPath();
      c.arc(x, y, 4, 0, Math.PI * 2);
      c.fill();
    }
  });
const floorTexture = () =>
  paint(512, 512, (c) => {
    c.fillStyle = "#3a3e44";
    c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 500; i++) {
      c.fillStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,255,255"},${Math.random() * 0.03})`;
      c.fillRect(Math.random() * 512, Math.random() * 512, 4 + Math.random() * 60, 4 + Math.random() * 60);
    }
    c.strokeStyle = "rgba(4,5,6,.9)";
    c.lineWidth = 5;
    for (const k of [0, 256]) {
      c.beginPath();
      c.moveTo(k + 2, 0);
      c.lineTo(k + 2, 512);
      c.moveTo(0, k + 2);
      c.lineTo(512, k + 2);
      c.stroke();
    }
  });
// The Death Star's signature wall light: tall rounded bars of white light in a black panel.
const lightPanelTexture = () =>
  paint(
    256,
    1024,
    (c) => {
      c.fillStyle = "#0b0d10";
      c.fillRect(0, 0, 256, 1024);
      c.strokeStyle = "#2b3036";
      c.lineWidth = 10;
      c.strokeRect(5, 5, 246, 1014);
      const bar = (x: number, y: number, h: number) => {
        c.shadowColor = "rgba(220,235,255,.9)";
        c.shadowBlur = 18;
        c.fillStyle = "#f4f8ff";
        c.beginPath();
        c.roundRect(x, y, 62, h, 31);
        c.fill();
      };
      [
        [40, 60, 380],
        [40, 470, 140],
        [40, 650, 310],
        [150, 60, 150],
        [150, 250, 360],
        [150, 650, 310],
      ].forEach(([x, y, h]) => bar(x, y, h));
    },
    false,
  );
const glowTexture = () =>
  paint(
    64,
    256,
    (c) => {
      const g = c.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, "rgba(255,255,255,.9)");
      g.addColorStop(0.35, "rgba(255,255,255,.28)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 256);
      const side = c.createLinearGradient(0, 0, 64, 0);
      side.addColorStop(0, "rgba(0,0,0,1)");
      side.addColorStop(0.3, "rgba(0,0,0,0)");
      side.addColorStop(0.7, "rgba(0,0,0,0)");
      side.addColorStop(1, "rgba(0,0,0,1)");
      c.globalCompositeOperation = "destination-out";
      c.fillStyle = side;
      c.fillRect(0, 0, 64, 256);
    },
    false,
  );
const rackTexture = () =>
  paint(128, 512, (c) => {
    c.fillStyle = "#0e1013";
    c.fillRect(0, 0, 128, 512);
    for (let y = 10; y < 512; y += 22) {
      c.fillStyle = "#1b1f24";
      c.fillRect(8, y, 112, 16);
      for (let x = 14; x < 116; x += 9) {
        const r = Math.random();
        if (r < 0.62) continue;
        c.fillStyle = r < 0.8 ? "#ff3b3b" : r < 0.95 ? "#e8f2ff" : "#5ab8ff";
        c.fillRect(x, y + 6, 4, 3);
      }
    }
  });
const hullTexture = () =>
  paint(1024, 1024, (c) => {
    c.fillStyle = "#5c6168";
    c.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 260; i++) {
      const w = 20 + Math.random() * 160,
        h = 20 + Math.random() * 120;
      c.fillStyle = `rgba(${Math.random() < 0.5 ? "20,22,26" : "160,166,172"},${0.08 + Math.random() * 0.22})`;
      c.fillRect(Math.random() * 1024, Math.random() * 1024, w, h);
    }
    c.strokeStyle = "rgba(15,17,20,.6)";
    c.lineWidth = 3;
    for (let k = 0; k < 1024; k += 128) {
      c.beginPath();
      c.moveTo(k, 0);
      c.lineTo(k, 1024);
      c.moveTo(0, k);
      c.lineTo(1024, k);
      c.stroke();
    }
    for (let i = 0; i < 140; i++) {
      c.fillStyle = Math.random() < 0.8 ? "rgba(235,240,255,.85)" : "rgba(255,90,80,.9)";
      c.fillRect(Math.random() * 1024, Math.random() * 1024, 3, 3);
    }
  });
// A sign above a door: white lettering on black, with a red marker, Imperial style.
function signTexture(title: string, sub: string) {
  return paint(
    1024,
    200,
    (c) => {
      c.fillStyle = "#07080a";
      c.fillRect(0, 0, 1024, 200);
      c.fillStyle = "#2a2f35";
      c.fillRect(0, 0, 1024, 6);
      c.fillRect(0, 194, 1024, 6);
      c.fillStyle = "#e0262c";
      c.fillRect(28, 40, 16, 120);
      c.fillStyle = "#f1f4f8";
      c.font = "600 70px SFMono-Regular, Menlo, Consolas, monospace";
      c.textBaseline = "middle";
      c.fillText(title, 72, 78);
      c.fillStyle = "#8f9aa6";
      c.font = "32px SFMono-Regular, Menlo, Consolas, monospace";
      c.fillText(sub, 74, 148);
    },
    false,
  );
}
// Blue hologram lettering on a transparent ground.
function holoTexture(lines: { text: string; size: number; color?: string }[], frame = true, width = 1024, height = 640) {
  return paint(
    width,
    height,
    (c) => {
      c.clearRect(0, 0, width, height);
      if (frame) {
        c.strokeStyle = "rgba(120,200,255,.75)";
        c.lineWidth = 6;
        c.strokeRect(10, 10, width - 20, height - 20);
        c.fillStyle = "rgba(60,140,220,.12)";
        c.fillRect(10, 10, width - 20, height - 20);
      }
      let y = 70;
      for (const line of lines) {
        c.fillStyle = line.color ?? "#bfe6ff";
        c.font = `${line.size >= 56 ? "600 " : ""}${line.size}px SFMono-Regular, Menlo, Consolas, monospace`;
        c.textBaseline = "top";
        const words = line.text.split(" ");
        let row = "";
        for (const word of words) {
          const next = row ? `${row} ${word}` : word;
          if (c.measureText(next).width > width - 100 && row) {
            c.fillText(row, 50, y);
            y += line.size * 1.2;
            row = word;
          } else row = next;
        }
        c.fillText(row, 50, y);
        y += line.size * 1.45;
      }
      c.fillStyle = "rgba(170,220,255,.07)";
      for (let k = 0; k < height; k += 6) c.fillRect(0, k, width, 2);
    },
    false,
  );
}

// --- Geometry kit: static pieces collected per material, merged at the end ---
function createKit() {
  const parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const m = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    e = new THREE.Euler(),
    v = new THREE.Vector3(),
    one = new THREE.Vector3(1, 1, 1);
  const push = (material: THREE.Material, geometry: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    flat.applyMatrix4(m.compose(v.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz, "YXZ")), one));
    if (!parts.has(material)) parts.set(material, []);
    parts.get(material)!.push(flat);
  };
  const tile = (geometry: THREE.BufferGeometry, su: number, sv: number) => {
    const uv = geometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    return geometry;
  };
  return {
    box: (material: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0, size = 0, rx = 0, rz = 0) =>
      push(material, size ? tile(new THREE.BoxGeometry(w, h, d), Math.max(w, d) / size, h / size) : new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz),
    plane: (material: THREE.Material, w: number, h: number, x: number, y: number, z: number, rx = 0, ry = 0, size = 0) =>
      push(material, size ? tile(new THREE.PlaneGeometry(w, h), w / size, h / size) : new THREE.PlaneGeometry(w, h), x, y, z, rx, ry),
    cylinder: (material: THREE.Material, top: number, bottom: number, h: number, x: number, y: number, z: number, segments = 32, open = false) =>
      push(material, new THREE.CylinderGeometry(top, bottom, h, segments, 1, open), x, y, z),
    geometry: push,
    bake: (parent: THREE.Object3D) => {
      parts.forEach((list, material) => {
        const merged = mergeGeometries(list);
        list.forEach((g) => g.dispose());
        if (!merged) return;
        const mesh = new THREE.Mesh(merged, material);
        mesh.matrixAutoUpdate = false;
        parent.add(mesh);
      });
      parts.clear();
    },
  };
}

export function createStation(scene: THREE.Scene, renderer: THREE.WebGLRenderer, options: { reduced: boolean; light: boolean }) {
  const root = new THREE.Group();
  root.name = "death-star-interior";
  scene.add(root);
  const decor = new THREE.Group();
  root.add(decor);
  const glowLayer = new THREE.Group();
  root.add(glowLayer);
  const textures: THREE.Texture[] = [];
  const keep = <T extends THREE.Texture>(t: T) => (textures.push(t), t);

  // Materials.
  const wallMap = keep(wallTexture()),
    floorMap = keep(floorTexture());
  const wall = new THREE.MeshStandardMaterial({ color: 0x5d636b, map: wallMap, roughness: 0.48, metalness: 0.62, envMapIntensity: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1f23, map: wallMap, roughness: 0.42, metalness: 0.7 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.3, metalness: 0.75 });
  const floor = new THREE.MeshStandardMaterial({ color: 0x4a4f56, map: floorMap, roughness: 0.28, metalness: 0.75, envMapIntensity: 1.1 });
  const ceiling = new THREE.MeshStandardMaterial({ color: 0x24272b, map: wallMap, roughness: 0.6, metalness: 0.5 });
  const lightPanel = new THREE.MeshBasicMaterial({ map: keep(lightPanelTexture()), toneMapped: false });
  const strip = new THREE.MeshBasicMaterial({ color: 0xeef4ff, toneMapped: false });
  const red = new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false });
  const lane = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.35, metalness: 0.1 });
  const floorGlow = new THREE.MeshBasicMaterial({ map: keep(glowTexture()), color: 0xcfe0ff, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const holoBlue = new THREE.MeshBasicMaterial({ color: 0x58b8ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x3d4248, map: wallMap, roughness: 0.4, metalness: 0.7 });
  const rackMap = keep(rackTexture());
  const rackMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: rackMap, roughness: 0.4, metalness: 0.6, emissive: 0xffffff, emissiveMap: rackMap, emissiveIntensity: 0.8 });
  const hullMap = keep(hullTexture());
  hullMap.repeat.set(1, 1);
  const hull = new THREE.MeshStandardMaterial({ color: 0x8a9098, map: hullMap, roughness: 0.75, metalness: 0.3 });
  const owned: THREE.Material[] = [wall, dark, trim, floor, ceiling, lightPanel, strip, red, lane, floorGlow, holoBlue, doorMat, rackMat, hull];
  const kit = createKit(),
    glowKit = createKit();

  // Reflections: a studio of white bars for the glossy floor and the metal to mirror.
  const studio = new THREE.Scene();
  studio.add(new THREE.Mesh(new THREE.SphereGeometry(20, 24, 12), new THREE.MeshBasicMaterial({ color: 0x050607, side: THREE.BackSide })));
  for (let i = 0; i < 10; i++) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 7), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xdde8ff).multiplyScalar(2.6), side: THREE.DoubleSide }));
    const a = (i / 10) * Math.PI * 2;
    bar.position.set(Math.cos(a) * 12, 1, Math.sin(a) * 12);
    bar.lookAt(0, 1, 0);
    studio.add(bar);
  }
  const top = new THREE.Mesh(new THREE.PlaneGeometry(16, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(1.6), side: THREE.DoubleSide }));
  top.position.set(0, 12, 0);
  top.rotation.x = Math.PI / 2;
  studio.add(top);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(studio, 0.03, 0.1, 60);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.7;
  studio.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
  pmrem.dispose();

  const areas: Area[] = [];
  const blocked: { x: number; z: number; r: number }[] = [];
  const block = (x: number, z: number, r: number) => blocked.push({ x, z, r });
  const doors: { leaves: THREE.Mesh[]; axis: THREE.Vector3; base: THREE.Vector3[]; span: number; x: number; z: number; open: number; locked?: boolean }[] = [];
  const signs: THREE.Mesh[] = [];
  const lightSlots: Partial<Record<RoomId, LightSlot[]>> = {};
  const interactables: Interactable[] = [];
  const pickables: THREE.Object3D[] = [];
  const interact = (id: string, label: string, room: RoomId, x: number, y: number, z: number, reach: number, ...meshes: THREE.Object3D[]) => {
    interactables.push({ id, label, room, position: new THREE.Vector3(x, y, z), reach });
    meshes.forEach((mesh) => {
      mesh.userData.interact = id;
      pickables.push(mesh);
    });
  };
  const sign = (title: string, sub: string, x: number, y: number, z: number, ry: number, width = 5.4) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * (200 / 1024)), new THREE.MeshBasicMaterial({ map: keep(signTexture(title, sub)), toneMapped: false }));
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    root.add(mesh);
    signs.push(mesh);
  };
  const holoPanel = (lines: { text: string; size: number; color?: string }[], w: number, h: number, x: number, y: number, z: number, ry: number, frame = true) => {
    // Wide screens get a wider canvas, so their lettering keeps the same size as on a terminal.
    const px = Math.round(THREE.MathUtils.clamp((1024 * w) / 4, 1024, 2048));
    const material = new THREE.MeshBasicMaterial({ map: keep(holoTexture(lines, frame, px, Math.round((px * h) / w))), transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    owned.push(material);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    root.add(mesh);
    holograms.push({ mesh, base: 0.92, phase: Math.random() * 6 });
    return mesh;
  };
  const holograms: { mesh: THREE.Mesh; base: number; phase: number }[] = [];

  // --- Rooms ---
  const T = 0.6;
  const room = (id: RoomId, r: Rect & { h: number; gaps?: Gap[]; panels?: boolean; panelSides?: Side[]; strips?: number; walls?: Side[]; inset?: Partial<Record<Side, number>> }) => {
    const { x0, x1, z0, z1, h } = r,
      w = x1 - x0,
      d = z1 - z0,
      cx = (x0 + x1) / 2,
      cz = (z0 + z1) / 2;
    kit.box(floor, w, 0.2, d, cx, -0.1, cz, 0, 4);
    kit.box(ceiling, w, 0.3, d, cx, h + 0.15, cz, 0, 6);
    const inset = { n: 0.45, s: 0.45, e: 0.45, w: 0.45, ...r.inset };
    areas.push({ room: id, x0: x0 + inset.w, x1: x1 - inset.e, z0: z0 + inset.n, z1: z1 - inset.s });
    for (const side of r.walls ?? (["n", "s", "e", "w"] as Side[])) {
      const alongX = side === "n" || side === "s";
      const [a0, a1] = alongX ? [x0, x1] : [z0, z1];
      const line = side === "n" ? z0 - T / 2 : side === "s" ? z1 + T / 2 : side === "w" ? x0 - T / 2 : x1 + T / 2;
      const surface = side === "n" ? z0 : side === "s" ? z1 : side === "w" ? x0 : x1;
      const inward = side === "n" || side === "w" ? 1 : -1;
      const ry = side === "n" ? 0 : side === "s" ? Math.PI : side === "w" ? Math.PI / 2 : -Math.PI / 2;
      const put = (along: number, off: number) => (alongX ? [along, surface + inward * off] : [surface + inward * off, along]) as [number, number];
      const gaps = (r.gaps ?? []).filter((g) => g.side === side).sort((a, b) => a.at - b.at);
      let cursor = a0;
      const segments: [number, number][] = [];
      for (const gap of gaps) {
        segments.push([cursor, gap.at - gap.width / 2]);
        cursor = gap.at + gap.width / 2;
      }
      segments.push([cursor, a1]);
      for (const [s0, s1] of segments) {
        const len = s1 - s0;
        if (len <= 0.01) continue;
        const mid = (s0 + s1) / 2;
        const [x, z] = alongX ? [mid, line] : [line, mid];
        kit.box(wall, alongX ? len : T, h, alongX ? T : len, x, h / 2, z, 0, 4);
        // A dark base, a band below the ceiling, and the tall light panels with their reflections.
        const [bx, bz] = put(mid, 0.18);
        kit.box(trim, alongX ? len : 0.36, 0.9, alongX ? 0.36 : len, bx, 0.45, bz);
        const [tx, tz] = put(mid, 0.12);
        kit.box(dark, alongX ? len : 0.24, 0.5, alongX ? 0.24 : len, tx, Math.min(h - 0.6, 4.6), tz);
        if (r.panels !== false && (!r.panelSides || r.panelSides.includes(side)) && len > 3) {
          const count = Math.floor((len - 1.5) / 4.2);
          for (let i = 0; i < count; i++) {
            const along = s0 + (len - (count - 1) * 4.2) / 2 + i * 4.2;
            const [px, pz] = put(along, 0.02);
            kit.plane(lightPanel, 1.0, 3.6, px, 2.85, pz, 0, ry);
            const [gx, gz] = put(along, 1.2);
            glowKit.geometry(floorGlow, new THREE.PlaneGeometry(1.0, 2.4).rotateX(-Math.PI / 2), gx, 0.012, gz, 0, ry + Math.PI);
          }
        }
      }
      for (const gap of gaps) {
        const gh = gap.height ?? 3.6;
        const bottom = gap.bottom ?? 0;
        const [x, z] = alongX ? [gap.at, line] : [line, gap.at];
        if (gh + bottom < h) kit.box(wall, alongX ? gap.width : T, h - gh - bottom, alongX ? T : gap.width, x, bottom + gh + (h - gh - bottom) / 2, z, 0, 4);
        if (bottom > 0) kit.box(wall, alongX ? gap.width : T, bottom, alongX ? T : gap.width, x, bottom / 2, z, 0, 4);
        if (!gap.door) continue;
        // An Imperial door: a heavy frame with cut corners, and two leaves that slide apart.
        for (const edge of [gap.at - gap.width / 2 - 0.22, gap.at + gap.width / 2 + 0.22]) {
          const [px, pz] = alongX ? [edge, line] : [line, edge];
          kit.box(trim, alongX ? 0.44 : T + 0.3, gh, alongX ? T + 0.3 : 0.44, px, gh / 2, pz);
        }
        kit.box(trim, alongX ? gap.width + 0.88 : T + 0.3, 0.5, alongX ? T + 0.3 : gap.width + 0.88, x, gh + 0.25, z);
        for (const edge of [gap.at - gap.width / 2 + 0.1, gap.at + gap.width / 2 - 0.1]) {
          const [px, pz] = alongX ? [edge, line] : [line, edge];
          kit.box(trim, 0.85, 0.85, T + 0.2, px, gh - 0.05, pz, ry, 0, 0, Math.PI / 4);
        }
        const [lx, lz] = put(gap.at, 0.05);
        kit.box(red, alongX ? 0.18 : 0.05, 0.18, alongX ? 0.05 : 0.18, alongX ? gap.at + gap.width / 2 + 0.7 : lx, 1.5, alongX ? lz : gap.at + gap.width / 2 + 0.7);
        const axis = alongX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
        const leaves = [-1, 1].map((sign) => {
          const leaf = new THREE.Mesh(new THREE.BoxGeometry(alongX ? gap.width / 2 + 0.06 : 0.22, gh, alongX ? 0.22 : gap.width / 2 + 0.06), doorMat);
          leaf.position.set(alongX ? gap.at + (sign * gap.width) / 4 : line, gh / 2, alongX ? line : gap.at + (sign * gap.width) / 4);
          root.add(leaf);
          return leaf;
        });
        doors.push({ leaves, axis, base: leaves.map((l) => l.position.clone()), span: gap.width / 2, x, z, open: 0 });
      }
    }
    // Ceiling light strips.
    if (r.strips) {
      const along = w >= d;
      for (let i = 0; i < r.strips; i++) {
        const k = (i + 1) / (r.strips + 1);
        if (along) kit.plane(strip, w - 2, 0.32, cx, h - 0.02, z0 + d * k, Math.PI / 2);
        else kit.plane(strip, 0.32, d - 2, x0 + w * k, h - 0.02, cz, Math.PI / 2);
      }
    }
  };
  // A corridor's walkable strip reaches a little into the rooms at both ends.
  const passage = (id: RoomId, r: Rect, extend: "x" | "z") => {
    const e = 1.2;
    areas.push(extend === "z" ? { room: id, x0: r.x0 + 0.45, x1: r.x1 - 0.45, z0: r.z0 - e, z1: r.z1 + e } : { room: id, x0: r.x0 - e, x1: r.x1 + e, z0: r.z0 + 0.45, z1: r.z1 - 0.45 });
  };

  // Hangar.
  room("hangar", { x0: -22, x1: 22, z0: -50, z1: 0, h: 20, strips: 0, gaps: [{ side: "n", at: 0, width: 5, height: 4.2, door: true }, { side: "w", at: -38, width: 4, height: 3.6, door: true }, { side: "s", at: 0, width: 34, height: 13 }], inset: { s: 3 } });
  lightSlots.hangar = [
    { at: [0, 15, -21], color: 0xdfe8ff, power: 240, range: 50 },
    { at: [0, 12, -34], color: 0xdfe8ff, power: 224, range: 45 },
    { at: [-16, 8, -24], color: 0xc8d8ff, power: 83, range: 30 },
    { at: [16, 8, -24], color: 0xc8d8ff, power: 83, range: 30 },
    { at: [0, 3.2, -26], color: 0x4aa8ff, power: 29, range: 14 },
    { at: [-18, 2, -46], color: 0xff2a2a, power: 9, range: 14 },
  ];
  // The bay: a bright frame round the opening onto space, behind a faint force field.
  kit.plane(strip, 34.4, 0.45, 0, 13.1, -0.32, 0, Math.PI);
  kit.plane(strip, 0.45, 13, -17.1, 6.5, -0.32, 0, Math.PI);
  kit.plane(strip, 0.45, 13, 17.1, 6.5, -0.32, 0, Math.PI);
  const field = new THREE.Mesh(new THREE.PlaneGeometry(34, 13), new THREE.MeshBasicMaterial({ color: 0x6fb6ff, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  owned.push(field.material as THREE.Material);
  field.position.set(0, 6.5, -0.1);
  root.add(field);
  // Gantries under the roof, lines of ceiling lights, lanes and landing lights on the deck.
  for (let z = -6; z > -50; z -= 8) kit.box(trim, 44, 0.9, 0.9, 0, 16.8, z);
  for (const x of [-15, -7.5, 7.5, 15]) for (let z = -3; z > -49; z -= 2.2) kit.plane(strip, 0.5, 0.9, x, 19.97, z, Math.PI / 2);
  for (const x of [-5.5, 5.5]) kit.plane(lane, 0.28, 44, x, 0.006, -25, -Math.PI / 2);
  for (const z of [-4, -47]) kit.plane(lane, 11, 0.28, 0, 0.006, z, -Math.PI / 2);
  for (let z = -6; z > -48; z -= 4) for (const x of [-6.2, 6.2]) kit.box(strip, 0.35, 0.05, 0.35, x, 0.03, z);
  // Overhead walkways along the side walls, like the galleries of a real hangar bay.
  for (const x of [-20.2, 20.2]) {
    kit.box(dark, 3.2, 0.4, 50, x, 7.2, -25);
    kit.box(trim, 0.1, 1.1, 50, x + (x < 0 ? 1.55 : -1.55), 7.95, -25);
    for (let z = -2; z > -50; z -= 6) kit.box(trim, 0.25, 7, 0.25, x + (x < 0 ? 1.4 : -1.4), 3.6, z);
  }
  // The central console: a round pedestal, a ring of light and the hologram of the file.
  kit.cylinder(trim, 2.7, 2.9, 1.0, 0, 0.5, -26, 48);
  kit.cylinder(dark, 2.2, 2.4, 0.2, 0, 1.08, -26, 48);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.78, 0.05, 8, 80), strip);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.95, -26);
  root.add(ring);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    kit.box(i % 3 ? strip : red, 0.5, 0.18, 0.05, Math.sin(a) * 2.92, 0.55, -26 + Math.cos(a) * 2.92, a);
  }
  const projector = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.04, 40), new THREE.MeshBasicMaterial({ color: 0x7cc8ff, toneMapped: false }));
  owned.push(projector.material as THREE.Material);
  projector.position.set(0, 1.2, -26);
  root.add(projector);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 2.6, 40, 1, true), new THREE.MeshBasicMaterial({ color: 0x4aa8ff, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  owned.push(cone.material as THREE.Material);
  cone.position.set(0, 2.5, -26);
  root.add(cone);
  // A hologram of an officer standing on the projector: the personnel file being consulted.
  const figure = createStandingHuman({ name: "holo", skin: 0x88ccff, hair: 0x88ccff, iris: 0x88ccff, hairStyle: "short", tunic: 0x88ccff, trousers: 0x88ccff, boots: 0x88ccff, belt: 0x88ccff });
  const holoBody = new THREE.MeshBasicMaterial({ color: 0x6ec0ff, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  owned.push(holoBody);
  figure.group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((mat) => mat.dispose());
      o.material = holoBody;
    }
  });
  figure.group.position.set(0, 1.22, -26);
  figure.group.scale.setScalar(1.05);
  root.add(figure.group);
  const welcomeLeft = holoPanel(
    [
      { text: "ARCHIVES IMPÉRIALES", size: 34, color: "#7fc8ff" },
      { text: identity.name.toUpperCase(), size: 64 },
      { text: identity.title, size: 40 },
      { text: `${identity.program} · ${identity.school}`, size: 34, color: "#9fd6ff" },
    ],
    3.4,
    2.1,
    -2.9,
    3.1,
    -25.4,
    0.38,
  );
  const welcomeRight = holoPanel(
    [
      { text: "DOSSIER DU PERSONNEL", size: 34, color: "#7fc8ff" },
      { text: "Du commerce au digital, à l’IA et à la data.", size: 46 },
      { text: "Approchez et appuyez sur E", size: 32, color: "#9fd6ff" },
    ],
    3.4,
    2.1,
    2.9,
    3.1,
    -25.4,
    -0.38,
  );
  const consoleHit = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 4.2, 16), new THREE.MeshBasicMaterial({ visible: false }));
  consoleHit.position.set(0, 2.1, -26);
  root.add(consoleHit);
  interact("accueil", "Consulter la console d’accueil", "hangar", 0, 1.5, -26, 7, consoleHit, welcomeLeft, welcomeRight, figure.group);
  block(0, -26, 3.2);
  sign("COULOIR PRINCIPAL", "ARCHIVES · FORMATION · COMPÉTENCES · COMMANDEMENT", 0, 5.2, -49.62, 0, 7.4);
  sign("DOSSIER CV", "◂ ARCHIVES CONFIDENTIELLES", -21.62, 4.5, -38, Math.PI / 2, 5);
  sign("BAIE D’ARRIMAGE 327", "HANGAR IMPÉRIAL · ACCUEIL DES VISITEURS", 0, 14.6, -0.7, Math.PI, 8);

  // TIE fighters parked along the walls, nose to the centre, and a stack of cargo.
  const tie = tieGeometry();
  const tieHull = new THREE.MeshStandardMaterial({ color: 0x8f969d, roughness: 0.45, metalness: 0.55 });
  const tiePanels = new THREE.MeshStandardMaterial({ color: 0x1a1f26, roughness: 0.55, metalness: 0.4 });
  const tieGlass = new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: 0.1, metalness: 0.9 });
  owned.push(tieHull, tiePanels, tieGlass);
  for (const [x, z] of [
    [-15.5, -10],
    [-15.5, -22],
    [-15.5, -34],
    [15.5, -10],
    [15.5, -22],
    [15.5, -34],
  ]) {
    const ship = new THREE.Group();
    ship.add(new THREE.Mesh(tie.hull, tieHull), new THREE.Mesh(tie.panels, tiePanels), new THREE.Mesh(tie.glass, tieGlass));
    ship.position.set(x, 3.45, z);
    ship.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    decor.add(ship);
    kit.box(trim, 3.4, 0.3, 3.4, x, 0.15, z);
    kit.box(dark, 0.5, 2.0, 0.5, x, 1.2, z);
    block(x, z, 3.9);
  }
  for (const [x, z, n] of [
    [-19, -4.5, 5],
    [19, -46, 6],
    [-19, -46, 4],
    [19, -4.5, 3],
  ]) {
    for (let i = 0; i < n; i++) {
      const s = 1 + (i % 2) * 0.4;
      kit.box(i % 2 ? dark : trim, s * 1.4, s, s * 1.1, x + ((i % 3) - 1) * 1.5, s / 2 + (i > 2 ? 1.2 : 0), z + Math.floor(i / 3) * 1.4 - 0.7);
    }
    kit.box(red, 0.12, 0.12, 0.05, x, 0.6, z + 1.3);
    block(x, z, 2.8);
  }
  // Two ground control consoles near the bay.
  for (const x of [-9, 9]) {
    kit.box(dark, 1.6, 1.1, 0.9, x, 0.55, -4.5);
    kit.box(trim, 1.6, 0.5, 0.6, x, 1.25, -4.8, 0, 0, -0.5);
    for (let i = 0; i < 5; i++) kit.box(i % 2 ? red : strip, 0.12, 0.05, 0.08, x - 0.5 + i * 0.25, 1.36, -4.62, 0, 0, -0.5);
    block(x, -4.5, 1.3);
  }
  // Stormtroopers on guard by the corridor door.
  for (const x of [-4.2, 4.2]) {
    const trooper = createSandtrooper();
    trooper.group.position.set(x, 0, -48.2);
    trooper.tick(0, false, true);
    decor.add(trooper.group);
    block(x, -48.2, 0.7);
  }
  // The visitor's X-wing, parked where it set down.
  const xwing = createShipModel();
  xwing.scale.setScalar(4.6);
  decor.add(xwing);
  block(7.5, -12, 6.2);

  // Passage and confidential archive (the full CV).
  room("passage", { x0: -28, x1: -22, z0: -40, z1: -36, h: 4.2, walls: ["n", "s"], panels: false, strips: 1 });
  passage("passage", { x0: -28, x1: -22, z0: -40, z1: -36 }, "x");
  room("dossier", { x0: -42, x1: -28, z0: -46, z1: -30, h: 7, strips: 2, panelSides: ["s", "e"], gaps: [{ side: "e", at: -38, width: 4, height: 3.6 }], inset: { n: 1.6, w: 1.6 } });
  lightSlots.dossier = [
    { at: [-35, 5.5, -38], color: 0xdfe8ff, power: 58, range: 22 },
    { at: [-35, 2.4, -42.5], color: 0x4aa8ff, power: 19, range: 10 },
    { at: [-40, 2, -32], color: 0xff2a2a, power: 6, range: 10 },
  ];
  kit.box(trim, 3.4, 1.0, 1.3, -35, 0.5, -42.4);
  kit.box(dark, 3.2, 0.2, 1.1, -35, 1.1, -42.3);
  const dossierScreen = holoPanel(
    [
      { text: "DOSSIER CV · ACCÈS AUTORISÉ", size: 34, color: "#7fc8ff" },
      { text: identity.name.toUpperCase(), size: 66 },
      { text: "Identité · Expériences · Formations · Compétences · Projets · Contact", size: 34 },
      { text: "E pour ouvrir le dossier complet", size: 30, color: "#9fd6ff" },
    ],
    4,
    2.3,
    -35,
    2.75,
    -42.9,
    0,
  );
  interact("dossier", "Ouvrir le dossier CV complet", "dossier", -35, 1.5, -42.4, 4.2, dossierScreen);
  block(-35, -42.4, 2);
  kit.box(trim, 1.1, 1.05, 0.8, -40.6, 0.52, -31.4, Math.PI * 0.75);
  const restricted = holoPanel([{ text: "ACCÈS RESTREINT", size: 70, color: "#ff8d8d" }, { text: "Code requis", size: 50, color: "#ffb3b3" }], 0.9, 0.55, -40.4, 1.55, -31.6, Math.PI * 0.75, true);
  (restricted.material as THREE.MeshBasicMaterial).color.set(0xff6f6f);
  interact("restreint", "Terminal restreint", "dossier", -40.6, 1.2, -31.4, 2.4, restricted);
  block(-40.6, -31.4, 0.9);

  // Main corridor and hub.
  room("corridor", { x0: -2.5, x1: 2.5, z0: -80, z1: -50, h: 5.5, walls: ["e", "w"], strips: 2 });
  passage("corridor", { x0: -2.5, x1: 2.5, z0: -80, z1: -50 }, "z");
  lightSlots.corridor = [
    { at: [0, 4.6, -56], color: 0xdfe8ff, power: 22, range: 16 },
    { at: [0, 4.6, -74], color: 0xdfe8ff, power: 22, range: 16 },
  ];
  room("hub", { x0: -10, x1: 10, z0: -100, z1: -80, h: 8, strips: 3, gaps: [{ side: "s", at: 0, width: 5, height: 4.4 }, { side: "n", at: 0, width: 5, height: 4.4 }, { side: "n", at: -6.5, width: 3, height: 3.2, door: true }, { side: "w", at: -90, width: 4, height: 4 }, { side: "e", at: -90, width: 4, height: 4 }] });
  lightSlots.hub = [
    { at: [0, 6.5, -90], color: 0xdfe8ff, power: 51, range: 26 },
    { at: [0, 2.2, -90], color: 0x4aa8ff, power: 13, range: 8 },
    { at: [8, 2, -98], color: 0xff2a2a, power: 6, range: 8 },
  ];
  // The station plan on a round table at the centre, to find one's way.
  kit.cylinder(trim, 1.5, 1.7, 1.0, 0, 0.5, -90, 40);
  const plan = holoPanel([{ text: "PLAN DE LA STATION", size: 64 }, { text: "E pour s’orienter", size: 44, color: "#9fd6ff" }], 2, 0.9, 0, 2.0, -90, 0, false);
  interact("plan", "Afficher le plan de la station", "hub", 0, 1.2, -90, 3.4, plan);
  block(0, -90, 1.9);
  sign("SALLE DES COMPÉTENCES", "▲ ARBRE DES COMPÉTENCES", 0, 5.2, -99.62, 0, 5.6);
  sign("ASCENSEUR", "▲ COMMANDEMENT · PROJETS", -6.5, 3.75, -99.62, 0, 3);
  sign("ARCHIVES", "◂ EXPÉRIENCES PROFESSIONNELLES", -9.62, 4.8, -90, Math.PI / 2, 5);
  sign("FORMATION", "PARCOURS ACADÉMIQUE ▸", 9.62, 4.8, -90, -Math.PI / 2, 5);
  sign("HANGAR", "▼ ACCUEIL · DOSSIER CV", 0, 5.2, -80.38, Math.PI, 5);
  // The maintenance terminal: nothing to see, unless one looks.
  kit.box(trim, 0.9, 1.1, 0.6, 8.6, 0.55, -98.6, -0.6);
  const maintenance = holoPanel([{ text: "MAINTENANCE 7", size: 60 }, { text: "système nominal", size: 44, color: "#9fd6ff" }], 0.8, 0.45, 8.5, 1.55, -98.4, -0.6, true);
  interact("maintenance", "Terminal de maintenance", "hub", 8.6, 1.2, -98.6, 2.2, maintenance);
  block(8.6, -98.6, 0.8);

  // Lifts: a cabin behind the hub, its twin opening onto the command room.
  room("liftA", { x0: -8.2, x1: -4.8, z0: -103.6, z1: -100, h: 3.4, walls: ["n", "e", "w"], panels: false, strips: 1 });
  passage("liftA", { x0: -8.2, x1: -4.8, z0: -103.6, z1: -100 }, "z");
  room("liftB", { x0: 100.3, x1: 103.7, z0: -30, z1: -26.4, h: 3.4, walls: ["s", "e", "w"], panels: false, strips: 1 });
  passage("liftB", { x0: 100.3, x1: 103.7, z0: -30, z1: -26.4 }, "z");
  for (const [x, z, ry] of [
    [-5.1, -102.2, -Math.PI / 2],
    [103.4, -28, -Math.PI / 2],
  ] as const) {
    kit.box(trim, 0.08, 0.6, 0.4, x + 0.06, 1.35, z);
    kit.box(red, 0.04, 0.12, 0.12, x - 0.0, 1.45, z, ry);
    kit.box(strip, 0.04, 0.12, 0.12, x - 0.0, 1.25, z, ry);
  }
  interact("lift-up", "Monter au poste de commandement", "liftA", LIFT_A.x, 1.4, LIFT_A.z, 1.9);
  interact("lift-down", "Redescendre au carrefour central", "liftB", LIFT_B.x, 1.4, LIFT_B.z, 1.9);
  lightSlots.liftA = [{ at: [-6.5, 3, -101.8], color: 0xdfe8ff, power: 10, range: 6 }];
  lightSlots.liftB = [{ at: [102, 3, -28.2], color: 0xdfe8ff, power: 10, range: 6 }];

  // West gallery and the archives (experience).
  room("west", { x0: -36, x1: -10, z0: -92, z1: -88, h: 5.5, walls: ["n", "s"], strips: 1 });
  passage("west", { x0: -36, x1: -10, z0: -92, z1: -88 }, "x");
  lightSlots.west = [{ at: [-23, 4.6, -90], color: 0xdfe8ff, power: 22, range: 18 }];
  room("archives", { x0: -60, x1: -36, z0: -104, z1: -76, h: 10, strips: 3, panels: false, gaps: [{ side: "e", at: -90, width: 4, height: 4, door: true }], inset: { n: 2.2, s: 2.2, w: 2.2 } });
  lightSlots.archives = [
    { at: [-48, 8.5, -90], color: 0xdfe8ff, power: 83, range: 30 },
    { at: [-56, 3, -90], color: 0x4aa8ff, power: 22, range: 12 },
    { at: [-46, 3, -100], color: 0x4aa8ff, power: 16, range: 10 },
    { at: [-38, 2, -78], color: 0xff2a2a, power: 6, range: 10 },
  ];
  // Archive towers along the walls, their lights blinking.
  const towers: [number, number, number][] = [];
  for (let x = -58.6; x < -37.5; x += 1.6) if (Math.abs(x + 46) > 2.2) towers.push([x, -103.1, 0]);
  for (let x = -58.6; x < -37.5; x += 1.6) if (Math.abs(x + 46) > 2.2) towers.push([x, -76.9, Math.PI]);
  for (let z = -101.4; z < -78; z += 1.6) if (Math.abs(z + 90) > 3) towers.push([-59.1, z, Math.PI / 2]);
  // The confidential archive keeps its own towers along the far walls.
  for (let x = -40.4; x < -29; x += 1.6) towers.push([x, -45.1, 0]);
  for (let z = -43.6; z < -34.5; z += 1.6) towers.push([-41.1, z, Math.PI / 2]);
  const tower = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 6.2, 1.2), rackMat, towers.length);
  const m = new THREE.Matrix4(),
    q = new THREE.Quaternion();
  towers.forEach(([x, z, ry], i) => tower.setMatrixAt(i, m.compose(new THREE.Vector3(x, 3.1, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1))));
  root.add(tower);
  const terminal = (id: string, label: string, title: string[], x: number, z: number, ry: number, big: boolean, roomId: RoomId) => {
    const w = big ? 2.6 : 1.8;
    kit.box(trim, w, 1.05, 1.0, x, 0.52, z, ry);
    kit.box(dark, w - 0.2, 0.3, 0.7, x, 1.15, z, ry, 0, -0.45);
    const dir = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
    for (let i = 0; i < 6; i++) {
      const off = (i - 2.5) * (w / 7);
      kit.box(i % 2 ? red : strip, 0.12, 0.05, 0.08, x + Math.cos(ry) * off + dir.x * 0.1, 1.33, z - Math.sin(ry) * off + dir.z * 0.1, ry);
    }
    const screen = holoPanel(
      title.map((text, i) => ({ text, size: i === 0 ? 30 : i === 1 ? 72 : 40, color: i === 0 ? "#7fc8ff" : undefined })),
      big ? 4.2 : 3,
      big ? 2.4 : 1.75,
      x - dir.x * 0.1,
      big ? 3.15 : 2.7,
      z - dir.z * 0.1,
      ry,
    );
    const ringFloor = new THREE.Mesh(new THREE.RingGeometry(big ? 2.2 : 1.6, big ? 2.32 : 1.7, 48), holoBlue);
    ringFloor.rotation.x = -Math.PI / 2;
    ringFloor.position.set(x + dir.x * 1.6, 0.02, z + dir.z * 1.6);
    root.add(ringFloor);
    interact(id, label, roomId, x + dir.x * 0.6, 1.3, z + dir.z * 0.6, big ? 3.6 : 3, screen);
    block(x, z, big ? 1.6 : 1.2);
  };
  const [bricoman, aldi] = experiences;
  terminal("exp-bricoman", `Consulter : ${bricoman.company}`, ["ARCHIVE · EXPÉRIENCE 01", bricoman.company.toUpperCase(), `${bricoman.role} · ${bricoman.period}`], -57.4, -90, Math.PI / 2, true, "archives");
  terminal("exp-aldi", `Consulter : ${aldi.company}`, ["ARCHIVE · EXPÉRIENCE 02", aldi.company.toUpperCase(), `${aldi.role} · ${aldi.period}`], -46, -101.4, 0, false, "archives");
  terminal("exp-all", "Synthèse du parcours professionnel", ["ARCHIVE · SYNTHÈSE", "DU TERRAIN AU DIGITAL", "Le parcours commercial en un coup d’œil"], -46, -78.6, Math.PI, false, "archives");
  sign("ARCHIVES IMPÉRIALES", "EXPÉRIENCES PROFESSIONNELLES", -36.62, 6.4, -90, -Math.PI / 2, 6);

  // East gallery and the training centre (education).
  room("east", { x0: 10, x1: 36, z0: -92, z1: -88, h: 5.5, walls: ["n", "s"], strips: 1 });
  passage("east", { x0: 10, x1: 36, z0: -92, z1: -88 }, "x");
  lightSlots.east = [{ at: [23, 4.6, -90], color: 0xdfe8ff, power: 22, range: 18 }];
  room("formation", { x0: 36, x1: 60, z0: -104, z1: -76, h: 10, strips: 3, panelSides: ["w"], gaps: [{ side: "w", at: -90, width: 4, height: 4, door: true }] });
  lightSlots.formation = [
    { at: [48, 8.5, -90], color: 0xdfe8ff, power: 70, range: 30 },
    { at: [48, 3.5, -90], color: 0x4aa8ff, power: 38, range: 14 },
  ];
  kit.cylinder(trim, 3.2, 3.4, 1.0, 48, 0.5, -90, 56);
  kit.cylinder(dark, 2.9, 3.0, 0.1, 48, 1.05, -90, 56);
  const tableTop = new THREE.Mesh(new THREE.CircleGeometry(2.8, 56), new THREE.MeshBasicMaterial({ color: 0x2f7fd0, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  owned.push(tableTop.material as THREE.Material);
  tableTop.rotation.x = -Math.PI / 2;
  tableTop.position.set(48, 1.12, -90);
  root.add(tableTop);
  // The timeline: one holographic document per qualification, rising from left to right.
  const docs = new THREE.Group();
  docs.position.set(48, 1.15, -90);
  root.add(docs);
  const docMeshes: THREE.Mesh[] = [];
  const timeline: THREE.Vector3[] = [];
  education.forEach((item, i) => {
    const t = i / (education.length - 1);
    // Seen from the entrance (looking +x), the oldest stands on the left (-z), the latest on the right.
    const at = new THREE.Vector3(-0.4 + Math.sin(t * Math.PI) * 0.6, 0.85 + t * 1.15, -2.3 + t * 4.6);
    timeline.push(at.clone().setY(at.y - 0.62));
    const mesh = holoPanel(
      [
        { text: item.year, size: 150 },
        { text: item.title, size: 72 },
        { text: item.school, size: 56, color: "#9fd6ff" },
      ],
      1.25,
      1.6,
      0,
      0,
      0,
      -Math.PI / 2,
    );
    root.remove(mesh);
    mesh.position.copy(at);
    mesh.userData.education = item.id;
    docs.add(mesh);
    docMeshes.push(mesh);
    interact(`edu-${item.id}`, item.title, "formation", 48 + at.x, 1.4, -90 + at.z, 0, mesh);
  });
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(new THREE.CatmullRomCurve3(timeline).getPoints(60)), new THREE.LineBasicMaterial({ color: 0x8fd4ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }));
  owned.push(line.material as THREE.Material);
  docs.add(line);
  interact("formation", "Ouvrir le parcours académique", "formation", 48, 1.3, -90, 5.2);
  block(48, -90, 3.6);
  sign("CENTRE DE FORMATION", "PARCOURS ACADÉMIQUE · DIPLÔMES", 36.62, 6.4, -90, Math.PI / 2, 6);
  for (const [z, title] of [
    [-103.6, "FORMATIONS"],
    [-76.4, "DIPLÔMES"],
  ] as const) {
    const panel = holoPanel(
      [{ text: title, size: 60 }, ...education.map((item) => ({ text: `${item.year} · ${item.title}`, size: 34 }))],
      6,
      3.4,
      48,
      4.4,
      z + (z < -90 ? 0.1 : -0.1),
      z < -90 ? 0 : Math.PI,
    );
    panel.userData.decor = true;
  }

  // North gallery and the circular skills room.
  room("north", { x0: -2.5, x1: 2.5, z0: -124, z1: -100, h: 5.5, walls: ["e", "w"], strips: 2 });
  passage("north", { x0: -2.5, x1: 2.5, z0: -124.6, z1: -100 }, "z");
  lightSlots.north = [{ at: [0, 4.6, -112], color: 0xdfe8ff, power: 22, range: 16 }];
  const { x: sx, z: sz } = SKILLS_CENTRE;
  const sides = 28,
    h = 12;
  kit.cylinder(floor, SKILLS_RADIUS + 0.6, SKILLS_RADIUS + 0.6, 0.2, sx, -0.1, sz, 56);
  kit.cylinder(ceiling, SKILLS_RADIUS + 0.6, SKILLS_RADIUS + 0.6, 0.3, sx, h + 0.15, sz, 56);
  for (let i = 0; i < sides; i++) {
    const a = ((i + 0.5) / sides) * Math.PI * 2;
    // The opening faces the north gallery (towards +z).
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.17) continue;
    const seg = 2 * (SKILLS_RADIUS + 0.3) * Math.tan(Math.PI / sides) + 0.05;
    const x = sx + Math.sin(a) * (SKILLS_RADIUS + 0.3),
      z = sz + Math.cos(a) * (SKILLS_RADIUS + 0.3);
    kit.box(wall, seg, h, T, x, h / 2, z, a, 4);
    kit.plane(lightPanel, 1, 3.6, sx + Math.sin(a) * (SKILLS_RADIUS - 0.02), 2.85, sz + Math.cos(a) * (SKILLS_RADIUS - 0.02), 0, a + Math.PI);
    kit.box(trim, seg, 0.9, 0.36, sx + Math.sin(a) * (SKILLS_RADIUS - 0.18), 0.45, sz + Math.cos(a) * (SKILLS_RADIUS - 0.18), a);
    glowKit.geometry(floorGlow, new THREE.PlaneGeometry(1.0, 2.4).rotateX(-Math.PI / 2), sx + Math.sin(a) * (SKILLS_RADIUS - 1.2), 0.012, sz + Math.cos(a) * (SKILLS_RADIUS - 1.2), 0, a);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    kit.box(trim, 0.9, 0.9, SKILLS_RADIUS * 1.9, sx, h - 0.5, sz, a);
    kit.plane(strip, 0.3, SKILLS_RADIUS * 1.6, sx, h - 0.06, sz, Math.PI / 2, a);
  }
  // Lintel over the opening, and the wall closing in on the gallery at each side.
  kit.box(wall, 5.6, h - 4.4, T, sx, 4.4 + (h - 4.4) / 2, sz + SKILLS_RADIUS + 0.3);
  for (const side of [-1, 1]) kit.box(wall, 1.2, h, T, sx + side * 3.35, h / 2, sz + Math.sqrt(SKILLS_RADIUS ** 2 - 3.35 ** 2) + 0.3);
  lightSlots.skills = [
    { at: [sx, 9, sz], color: 0xdfe8ff, power: 83, range: 32 },
    { at: [sx, 3.2, sz], color: 0x6f9cff, power: 45, range: 16 },
    { at: [sx - 10, 3, sz - 8], color: 0xff2a2a, power: 6, range: 10 },
  ];
  kit.cylinder(trim, 2.6, 2.9, 0.8, sx, 0.4, sz, 48);
  const skillGroup = new THREE.Group();
  skillGroup.position.set(sx, 0.8, sz);
  root.add(skillGroup);
  const nodeGeometry = new THREE.SphereGeometry(1, 20, 14);
  const core = new THREE.Mesh(nodeGeometry, new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.9, toneMapped: false }));
  owned.push(core.material as THREE.Material);
  core.scale.setScalar(0.42);
  core.position.y = 2.5;
  core.userData.interact = "skills";
  core.userData.label = "Arbre des compétences";
  skillGroup.add(core);
  pickables.push(core);
  // Nodes are small and the tree turns: each gets a larger invisible sphere to aim at.
  const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
  owned.push(hitMaterial);
  const grip = (node: THREE.Mesh, size: number) => {
    const hit = new THREE.Mesh(nodeGeometry, hitMaterial);
    hit.scale.setScalar(size);
    node.add(hit);
  };
  const links: THREE.Vector3[] = [];
  const skillNodes: THREE.Mesh[] = [];
  skillTree.forEach((category, ci) => {
    const a = (ci / skillTree.length) * Math.PI * 2;
    const hubAt = new THREE.Vector3(Math.sin(a) * 3.4, 2.1 + (ci % 2) * 0.9, Math.cos(a) * 3.4);
    const hubMat = new THREE.MeshBasicMaterial({ color: category.color, transparent: true, opacity: 0.95, toneMapped: false });
    owned.push(hubMat);
    const hubNode = new THREE.Mesh(nodeGeometry, hubMat);
    hubNode.scale.setScalar(0.3);
    hubNode.position.copy(hubAt);
    hubNode.userData.category = category.id;
    hubNode.userData.label = `${category.letter} · ${category.name}`;
    grip(hubNode, 2);
    skillGroup.add(hubNode);
    // The branch's name floats beside its hub.
    const tag = document.createElement("canvas");
    tag.width = 1024;
    tag.height = 128;
    const c = tag.getContext("2d")!;
    c.font = "600 42px SFMono-Regular, Menlo, Consolas, monospace";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.shadowColor = category.color;
    c.shadowBlur = 16;
    c.fillStyle = category.color;
    c.fillText(`${category.letter} · ${category.name.toUpperCase()}`, 512, 64);
    const tagTexture = keep(new THREE.CanvasTexture(tag));
    tagTexture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTexture, transparent: true, depthWrite: false, toneMapped: false }));
    owned.push(label.material);
    label.scale.set(3.4, 0.42, 1);
    label.position.copy(hubAt).add(new THREE.Vector3(0, 0.62, 0));
    skillGroup.add(label);
    skillNodes.push(hubNode);
    links.push(core.position.clone(), hubAt.clone());
    category.skills.forEach((skill, si) => {
      const b = a + (si - (category.skills.length - 1) / 2) * 0.32;
      const at = new THREE.Vector3(Math.sin(b) * 5.2, hubAt.y + (si % 2 ? 0.55 : -0.45), Math.cos(b) * 5.2);
      const color = new THREE.Color(category.color);
      const mat = new THREE.MeshBasicMaterial({ color: skill.status === "interest" ? color.clone().multiplyScalar(0.5) : color, transparent: true, opacity: skill.status === "confirmed" ? 1 : skill.status === "growing" ? 0.75 : 0.5, wireframe: skill.status === "interest", toneMapped: false });
      owned.push(mat);
      const node = new THREE.Mesh(nodeGeometry, mat);
      node.scale.setScalar(skill.status === "confirmed" ? 0.2 : 0.16);
      node.position.copy(at);
      node.userData.skill = skill.id;
      node.userData.label = `${skill.name} · ${statusLabel[skill.status]}`;
      grip(node, 2.4);
      skillGroup.add(node);
      skillNodes.push(node);
      links.push(hubAt.clone(), at);
      if (skill.status === "growing") {
        const halo = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.6, 24), new THREE.MeshBasicMaterial({ color: category.color, transparent: true, opacity: 0.7, side: THREE.DoubleSide, toneMapped: false }));
        owned.push(halo.material as THREE.Material);
        node.add(halo);
      }
    });
  });
  const linkLines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(links), new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending }));
  owned.push(linkLines.material as THREE.Material);
  skillGroup.add(linkLines);
  skillNodes.forEach((node) => pickables.push(node));
  areas.push({ room: "skills", x0: sx - 11, x1: sx + 11, z0: sz - 11, z1: sz + 11 });
  interact("skills", "Explorer l’arbre des compétences", "skills", sx, 1.3, sz, 6.2);
  block(sx, sz, 3.2);
  sign("SALLE DES COMPÉTENCES", "SÉLECTIONNEZ UN NŒUD DE L’ARBRE", sx, 7.2, sz + SKILLS_RADIUS - 0.05, Math.PI, 6.4);

  // The command room (projects), on its own level, reached by lift.
  room("command", { x0: 80, x1: 124, z0: -62, z1: -30, h: 12, strips: 4, gaps: [{ side: "s", at: 102, width: 3, height: 3.2, door: true }, { side: "e", at: -46, width: 12, height: 6.6, bottom: 0.9 }], inset: { e: 1.4 } });
  lightSlots.command = [
    { at: [102, 10, -46], color: 0xdfe8ff, power: 96, range: 36 },
    { at: [102, 5, -58], color: 0x4aa8ff, power: 64, range: 22 },
    { at: [102, 2.5, -44], color: 0x4aa8ff, power: 22, range: 10 },
    { at: [88, 2, -36], color: 0xff2a2a, power: 6, range: 10 },
    { at: [116, 2, -36], color: 0xff2a2a, power: 6, range: 10 },
    { at: [118.5, 5.5, -46], color: 0xa9c4ff, power: 40, range: 16 },
  ];
  // The great screen of the room, the two banks of consoles and the central projector.
  const screen = holoPanel(
    [
      { text: "POSTE DE COMMANDEMENT · PROJETS", size: 40, color: "#7fc8ff" },
      { text: "ORBITAL — portfolio 3D Star Wars", size: 64 },
      { text: "Mes passions — présentation interactive", size: 52 },
      { text: "Sélectionnez une console pour examiner un projet", size: 34, color: "#9fd6ff" },
    ],
    20,
    7,
    102,
    6.2,
    -61.6,
    0,
  );
  kit.box(trim, 21, 7.6, 0.3, 102, 6.2, -61.9);
  for (const side of [-1, 1])
    for (const z of [-54, -47, -40]) {
      const x = 102 + side * 11;
      kit.box(dark, 12, 1.0, 1.2, x, 0.5, z);
      kit.box(trim, 12, 0.35, 0.9, x, 1.15, z + 0.15, 0, 0, -0.45);
      for (let i = 0; i < 16; i++) kit.box(i % 3 ? strip : red, 0.18, 0.05, 0.1, x - 5.6 + i * 0.75, 1.3, z + 0.22, 0, 0, -0.45);
      for (let k = -5; k <= 5; k += 2.5) block(x + k, z, 1.0);
    }
  const projectConsole = (id: string, label: string, title: string, x: number) => {
    kit.box(trim, 2.2, 1.1, 1.1, x, 0.55, -50.5);
    const screenMesh = holoPanel([{ text: "PROJET", size: 40, color: "#7fc8ff" }, { text: title, size: 64 }], 2.6, 1.3, x, 2.3, -50.9, 0);
    interact(id, label, "command", x, 1.3, -50, 3.2, screenMesh);
    block(x, -50.5, 1.4);
  };
  projectConsole("proj-orbital", "Examiner le projet ORBITAL", "ORBITAL", 98);
  projectConsole("proj-passions", "Examiner « Mes passions »", "MES PASSIONS", 106);
  kit.cylinder(trim, 2.3, 2.5, 1.0, 102, 0.5, -42.5, 48);
  const galaxy = new THREE.Group();
  galaxy.position.set(102, 2.7, -42.5);
  root.add(galaxy);
  const star = new THREE.Mesh(nodeGeometry, new THREE.MeshBasicMaterial({ color: 0xcfeaff, toneMapped: false }));
  owned.push(star.material as THREE.Material);
  star.scale.setScalar(0.22);
  galaxy.add(star);
  [0.7, 1.05, 1.4, 1.7, 2.0].forEach((r, i) => {
    const orbit = new THREE.Mesh(new THREE.RingGeometry(r - 0.01, r + 0.01, 64), holoBlue);
    orbit.rotation.x = -Math.PI / 2;
    galaxy.add(orbit);
    const planet = new THREE.Mesh(nodeGeometry, holoBlue);
    planet.scale.setScalar(0.08 + (i % 2) * 0.05);
    planet.position.set(r, 0, 0);
    planet.userData.orbit = { r, speed: 0.6 / (i + 1), phase: i * 1.7 };
    galaxy.add(planet);
  });
  interact("projects", "Vue d’ensemble des projets", "command", 102, 1.3, -42.5, 4.4, screen);
  block(102, -42.5, 2.8);
  sign("ASCENSEUR", "▼ RETOUR AU NIVEAU PRINCIPAL", 102, 3.75, -30.38, Math.PI, 3);
  // The viewport onto space, and a familiar dark silhouette watching through it.
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), new THREE.MeshPhysicalMaterial({ color: 0x9fb8d8, transparent: true, opacity: 0.08, roughness: 0.05, metalness: 0, side: THREE.DoubleSide }));
  owned.push(glass.material as THREE.Material);
  glass.position.set(124.05, 4.2, -46);
  glass.rotation.y = Math.PI / 2;
  root.add(glass);
  // The viewport's lit frame, so it reads from across the room.
  kit.plane(strip, 0.12, 6.6, 123.97, 4.2, -52, 0, -Math.PI / 2);
  kit.plane(strip, 0.12, 6.6, 123.97, 4.2, -40, 0, -Math.PI / 2);
  kit.plane(strip, 12, 0.12, 123.97, 7.5, -46, 0, -Math.PI / 2);
  kit.plane(strip, 12, 0.12, 123.97, 0.9, -46, 0, -Math.PI / 2);
  const vader = new THREE.Group();
  const black = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.18, metalness: 0.4 });
  const cape = new THREE.MeshStandardMaterial({ color: 0x060607, roughness: 0.75, side: THREE.DoubleSide });
  owned.push(black, cape);
  const piece = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, s = 1) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(s);
    vader.add(mesh);
    return mesh;
  };
  piece(new THREE.CylinderGeometry(0.62, 0.95, 1.95, 24, 1, true), cape, 0, 1.0, 0);
  piece(new THREE.CylinderGeometry(0.3, 0.42, 0.75, 18), black, 0, 1.75, 0);
  piece(new THREE.SphereGeometry(0.17, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), black, 0, 2.22, 0);
  piece(new THREE.CylinderGeometry(0.17, 0.26, 0.2, 20, 1, true), black, 0, 2.13, 0);
  piece(new THREE.BoxGeometry(0.62, 0.12, 0.36), black, 0, 2.02, 0);
  vader.position.set(121.6, 0, -46);
  vader.rotation.y = Math.PI / 2;
  root.add(vader);
  const vaderHit = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.4, 10), new THREE.MeshBasicMaterial({ visible: false }));
  vaderHit.position.set(121.6, 1.2, -46);
  root.add(vaderHit);
  interact("vader", "Observer la silhouette", "command", 121.6, 1.4, -46, 3.4, vaderHit);
  block(121.6, -46, 1.2);
  // Two officers at work at the consoles.
  const officers: ReturnType<typeof createStandingHuman>[] = [];
  for (const [x, z] of [
    [93, -45.6],
    [111, -45.6],
  ]) {
    const officer = createStandingHuman({ name: "officer", skin: 0xc99a7c, hair: 0x2b2018, iris: 0x3a2a1a, hairStyle: "short", tunic: 0x4b4f4a, trousers: 0x3e423e, boots: 0x0b0b0c, belt: 0x0d0d0d }, (parts, s) => {
      s.box(parts.head, [0, 0.19, 0], [0.22, 0.06, 0.24], new THREE.MeshStandardMaterial({ color: 0x3e423e, roughness: 0.8 }));
      s.box(parts.head, [0, 0.165, 0.07], [0.2, 0.02, 0.1], new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.5 }));
    });
    officer.group.position.set(x, 0, z);
    officer.group.rotation.y = Math.PI;
    decor.add(officer.group);
    officers.push(officer);
    block(x, z, 0.6);
  }

  // Physical encounters: the court's robes, joints and weapons keep their articulated groups.
  const presences = createStationPresences();
  root.add(presences.group);
  presences.setLight(options.light);
  for (const actor of presences.actors) {
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(actor.radius, actor.radius, 2.5, 10), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(actor.position[0], actor.position[1] + 1.2, actor.position[2]);
    presences.group.add(hit);
    interact(`presence:${actor.id}`, `Rencontrer ${actor.name}`, actor.room, actor.position[0], 1.35, actor.position[2], 4, hit);
    block(actor.position[0], actor.position[2], actor.radius);
  }
  presences.guards.forEach((guard) => {
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(.52, .6, 2.3, 10), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(guard.group.position).add(new THREE.Vector3(0, 1.1, 0));
    presences.group.add(hit);
    interact("presence:palpatine", "Observer la garde impériale", "command", guard.group.position.x, 1.35, guard.group.position.z, 3.2, hit);
    block(guard.group.position.x, guard.group.position.z, .62);
  });

  // A mouse droid patrolling the main corridor.
  const mouse = new THREE.Group();
  const droidBody = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.35, metalness: 0.6 });
  owned.push(droidBody);
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.62), droidBody);
  shell.position.y = 0.17;
  mouse.add(shell);
  const top2 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.4), droidBody);
  top2.position.set(0, 0.31, -0.05);
  mouse.add(top2);
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.02), red);
  eye.position.set(0.12, 0.2, 0.32);
  mouse.add(eye);
  mouse.position.set(1.6, 0, -60);
  root.add(mouse);
  interact("mouse-droid", "Un petit droïde ?", "corridor", 1.6, 0.4, -60, 1.8, shell, top2);

  // Outside: the hull of the station round the bay, the stars, a Star Destroyer and patrols.
  const outside = new THREE.Group();
  root.add(outside);
  const hullPiece = (w: number, h2: number, x: number, y: number) => {
    const g = new THREE.PlaneGeometry(w, h2);
    const uv = g.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 60, (uv.getY(i) * h2) / 60);
    const mesh = new THREE.Mesh(g, hull);
    mesh.position.set(x, y, 0.35);
    outside.add(mesh);
  };
  hullMap.wrapS = hullMap.wrapT = THREE.RepeatWrapping;
  hullPiece(400, 400, -217, 0);
  hullPiece(400, 400, 217, 0);
  hullPiece(34, 200, 0, 113);
  hullPiece(34, 200, 0, -100);
  const starCount = options.light ? 1400 : 3200;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const dir = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
    dir.multiplyScalar(rand(560, 760)).toArray(starPositions, i * 3);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, toneMapped: false });
  owned.push(starMaterial);
  const stars = new THREE.Points(starGeometry, starMaterial);
  root.add(stars);
  const destroyerShape = new THREE.Shape([new THREE.Vector2(0, 60), new THREE.Vector2(-22, -20), new THREE.Vector2(22, -20)]);
  const destroyer = new THREE.Mesh(new THREE.ExtrudeGeometry(destroyerShape, { depth: 6, bevelEnabled: true, bevelSize: 3, bevelThickness: 3 }), new THREE.MeshStandardMaterial({ color: 0x8b9097, roughness: 0.7, metalness: 0.4 }));
  owned.push(destroyer.material as THREE.Material);
  destroyer.rotation.set(-Math.PI / 2, 0, -0.9);
  destroyer.position.set(-160, 70, 420);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(12, 14, 8), destroyer.material);
  bridge.position.set(0, -12, 12);
  destroyer.add(bridge);
  outside.add(destroyer);
  const patrols = [0, 1].map((i) => {
    const ship = new THREE.Group();
    ship.add(new THREE.Mesh(tie.hull, tieHull), new THREE.Mesh(tie.panels, tiePanels), new THREE.Mesh(tie.glass, tieGlass));
    ship.userData.phase = i * 3;
    outside.add(ship);
    return ship;
  });
  const sun = new THREE.DirectionalLight(0xdfe8ff, 1.1);
  sun.position.set(80, 120, 260);
  root.add(sun, new THREE.HemisphereLight(0x8a96a6, 0x0d0f12, 0.55));

  kit.bake(root);
  glowKit.bake(glowLayer);

  // A small pool of lights, moved to whichever room the visitor is in.
  const pool = Array.from({ length: options.light ? 3 : 6 }, () => {
    const light = new THREE.PointLight(0xffffff, 0, 20, 1.6);
    root.add(light);
    return { light, goal: 0 };
  });
  let lit: RoomId | null = null;
  const lightRoom = (id: RoomId) => {
    if (id === lit) return;
    lit = id;
    const slots = lightSlots[id] ?? lightSlots.hub!;
    pool.forEach((item, i) => {
      const slot = slots[i];
      item.goal = slot ? slot.power : 0;
      if (!slot) return;
      item.light.position.set(...slot.at);
      item.light.color.setHex(slot.color);
      item.light.distance = slot.range;
      item.light.intensity = 0;
    });
  };

  const inArea = (a: Rect, x: number, z: number) => x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1;
  const inSkills = (x: number, z: number) => Math.hypot(x - sx, z - sz) <= SKILLS_RADIUS - 0.9;
  const isFree = (x: number, z: number) => (areas.some((a) => a.room !== "skills" && inArea(a, x, z)) || inSkills(x, z)) && !blocked.some((b) => Math.hypot(x - b.x, z - b.z) < b.r);
  const roomAt = (x: number, z: number): RoomId | null => {
    if (inSkills(x, z)) return "skills";
    // Rooms before corridors, which overlap them a little at their ends.
    const order: RoomId[] = ["hangar", "dossier", "hub", "archives", "formation", "command", "liftA", "liftB", "passage", "corridor", "west", "east", "north"];
    for (const id of order) if (areas.some((a) => a.room === id && inArea(a, x, z))) return id;
    return null;
  };
  const navigate = createSurfaceNavigator(160, isFree);
  const shipSpot = { x: 7.5, z: -12 };

  return {
    root,
    xwing,
    shipSpot,
    interactables,
    pickables,
    skillNodes,
    docMeshes,
    isFree,
    roomAt,
    navigate,
    /** The minimap's outline, from the walkable areas. */
    plan: () => [...areas.filter((a) => a.room !== "skills").map((a) => ({ ...a })), { room: "skills" as RoomId, x0: sx - SKILLS_RADIUS, x1: sx + SKILLS_RADIUS, z0: sz - SKILLS_RADIUS, z1: sz + SKILLS_RADIUS }],
    lightRoom,
    setLight: (light: boolean) => {
      decor.visible = !light;
      presences.setLight(light);
      glowLayer.visible = true;
      pool.forEach((item, i) => (item.light.visible = !light || i < 3));
    },
    tick: (dt: number, time: number, player: THREE.Vector3, room: RoomId | null, reduced: boolean, liftDoors: { a: number; b: number }) => {
      if (room) lightRoom(room);
      presences.tick(time, reduced, player, room);
      pool.forEach((item) => (item.light.intensity = THREE.MathUtils.damp(item.light.intensity, item.goal, 4, dt)));
      let opened = false;
      for (const door of doors) {
        const near = Math.hypot(player.x - door.x, player.z - door.z) < 6.5;
        const liftA = Math.abs(door.x - LIFT_A.x) < 2 && Math.abs(door.z - -100.3) < 1;
        const liftB = Math.abs(door.x - LIFT_B.x) < 2 && Math.abs(door.z - -29.7) < 1;
        const goal = liftA ? liftDoors.a : liftB ? liftDoors.b : near ? 1 : 0;
        if (goal === 1 && door.open < 0.02) opened = true;
        door.open = reduced ? goal : THREE.MathUtils.damp(door.open, goal, 6, dt);
        door.leaves.forEach((leaf, i) => leaf.position.copy(door.base[i]).addScaledVector(door.axis, (i ? 1 : -1) * door.open * (door.span + 0.05)));
      }
      for (const holo of holograms) {
        const material = holo.mesh.material as THREE.MeshBasicMaterial;
        material.opacity = reduced ? holo.base : holo.base * (0.88 + Math.sin(time * 2.1 + holo.phase) * 0.06 + (Math.sin(time * 37 + holo.phase) > 0.985 ? -0.3 : 0));
      }
      if (!reduced) {
        figure.group.rotation.y = time * 0.35;
        skillGroup.rotation.y = time * 0.025;
        galaxy.children.forEach((child) => {
          const orbit = child.userData.orbit as { r: number; speed: number; phase: number } | undefined;
          if (orbit) child.position.set(Math.cos(time * orbit.speed + orbit.phase) * orbit.r, 0, Math.sin(time * orbit.speed + orbit.phase) * orbit.r);
        });
        cone.rotation.y = time * 0.4;
        // The mouse droid scurries along the corridor and turns back at each end.
        const k = (time * 0.11) % 2,
          along = k < 1 ? k : 2 - k;
        mouse.position.set(1.65, 0, -52.5 - along * 25);
        mouse.rotation.y = k < 1 ? Math.PI : 0;
        interactables.find((item) => item.id === "mouse-droid")!.position.set(1.65, 0.4, mouse.position.z);
        officers.forEach((officer, i) => {
          officer.look(Math.sin(time * 0.4 + i) * 0.4, -0.2, time, false);
          officer.head.rotation.y = Math.sin(time * 0.25 + i * 2) * 0.35;
        });
        patrols.forEach((ship) => {
          const t = time * 0.05 + ship.userData.phase;
          ship.position.set(Math.sin(t) * 140, 30 + Math.sin(t * 2) * 10, 160 + Math.cos(t) * 70);
          ship.lookAt(Math.sin(t + 0.05) * 140, 30, 160 + Math.cos(t + 0.05) * 70);
        });
      }
      // The training centre's documents unfold as the visitor enters the room.
      const unfold = room === "formation" ? 1 : 0;
      docs.scale.y = THREE.MathUtils.damp(docs.scale.y, Math.max(0.02, unfold), reduced ? 30 : 2.5, dt);
      docMeshes.forEach((mesh, i) => (mesh.position.y = docMeshes[i].position.y + (reduced ? 0 : Math.sin(time * 1.2 + i) * 0.0015)));
      return { opened };
    },
    dispose: () => {
      const geometries = new Set<THREE.BufferGeometry>();
      root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((mat) => owned.includes(mat) || owned.push(mat));
      });
      geometries.forEach((g) => g.dispose());
      owned.forEach((mat) => {
        Object.values(mat).forEach((value) => value instanceof THREE.Texture && textures.push(value));
        mat.dispose();
      });
      new Set(textures).forEach((t) => t.dispose());
      environment.dispose();
      scene.environment = null;
      root.removeFromParent();
    },
  };
}
export type Station = ReturnType<typeof createStation>;
