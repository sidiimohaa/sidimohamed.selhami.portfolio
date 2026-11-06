import * as THREE from "three";
import { createStandingHuman } from "../humanFigure";
import { createSandtrooper } from "../stormtrooperModel";
import { createPrincessLeia } from "./stationLeia";
import type { Performance } from "./stationPresences";
import type { RoomId } from "./stationWorld";

// The parts of the station from the first film that are not part of the record: detention block
// AA-23 and cell 2187, garbage compactor 3263827, the superlaser's firing room and the tractor beam's
// shaft. They use the same building kit as the rest of the station; `createStation` hands it over.

type Rect = { x0: number; x1: number; z0: number; z1: number };
type Side = "n" | "s" | "e" | "w";
type Gap = { side: Side; at: number; width: number; height?: number; bottom?: number; door?: boolean };
type RoomSpec = Rect & { h: number; gaps?: Gap[]; panels?: boolean; panelSides?: Side[]; strips?: number; walls?: Side[]; inset?: Partial<Record<Side, number>> };
type HoloLine = { text: string; size: number; color?: string };
type Door = { x: number; z: number; locked?: boolean };

export type WingsContext = {
  root: THREE.Group;
  decor: THREE.Group;
  kit: {
    box: (material: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, ry?: number, size?: number, rx?: number, rz?: number) => void;
    plane: (material: THREE.Material, w: number, h: number, x: number, y: number, z: number, rx?: number, ry?: number, size?: number) => void;
    cylinder: (material: THREE.Material, top: number, bottom: number, h: number, x: number, y: number, z: number, segments?: number, open?: boolean) => void;
  };
  materials: { wall: THREE.Material; dark: THREE.Material; trim: THREE.Material; floor: THREE.Material; strip: THREE.Material; red: THREE.Material; doorMat: THREE.Material };
  room: (id: RoomId, spec: RoomSpec) => void;
  passage: (id: RoomId, rect: Rect, extend: "x" | "z") => void;
  holoPanel: (lines: HoloLine[], w: number, h: number, x: number, y: number, z: number, ry: number, frame?: boolean) => THREE.Mesh;
  sign: (title: string, sub: string, x: number, y: number, z: number, ry: number, width?: number) => void;
  interact: (id: string, label: string, room: RoomId, x: number, y: number, z: number, reach: number, ...meshes: THREE.Object3D[]) => void;
  block: (x: number, z: number, r: number, decorOnly?: boolean) => void;
  lightSlots: Partial<Record<RoomId, { at: [number, number, number]; color: number; power: number; range: number }[]>>;
  owned: THREE.Material[];
  doors: Door[];
  // Walkable ground that is not a rectangle, and solid things that come and go.
  addFree: (test: (x: number, z: number) => boolean) => void;
  addSolid: (test: (x: number, z: number) => boolean) => void;
};

export const COMPACTOR = { x: -63, z: -21, half: 8.2 };
export const DETENTION_EXIT = { x: -33.2, z: -7, yaw: Math.PI };
export const SUPERLASER_CONSOLE = { x: 94, z: -92.6 };
export const TRACTOR_CENTRE = { x: 50, z: -46 };
const FOCUS = new THREE.Vector3(94, 6, -186);
const ASTEROID = new THREE.Vector3(94, 34, -1050);
const smooth = THREE.MathUtils.smootherstep;

// A beam between two points, as a thin additive cylinder.
function beamBetween(material: THREE.Material, from: THREE.Vector3, to: THREE.Vector3, radius: number) {
  const span = to.clone().sub(from);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, span.length(), 10, 1, true), material);
  mesh.position.copy(from).addScaledVector(span, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), span.normalize());
  mesh.visible = false;
  return mesh;
}

function gunner(x: number, z: number, yaw: number) {
  const human = createStandingHuman({ name: "superlaser-gunner", skin: 0xc99a7c, hair: 0x111112, iris: 0x201812, hairStyle: "short", tunic: 0x121315, trousers: 0x101113, boots: 0x08080a, belt: 0x050506, gloves: 0x050506 }, (parts, s) => {
    // The gunner's black helmet and its visor.
    const shell = new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.28, metalness: 0.45 });
    s.ball(parts.head, [0, 0.04, -0.01], [0.145, 0.15, 0.15], shell);
    s.box(parts.head, [0, -0.005, 0.12], [0.2, 0.05, 0.04], new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.12, metalness: 0.6 }), 0.01);
    s.box(parts.head, [0, -0.09, 0.09], [0.14, 0.07, 0.06], shell, 0.015);
  });
  human.group.position.set(x, 0, z);
  human.group.rotation.y = yaw;
  // At the controls, leaning a little over the console.
  human.arms.forEach((arm) => {
    arm.root.rotation.x = -0.85;
    arm.joint.rotation.x = -0.5;
  });
  return human;
}

export function createStationWings(ctx: WingsContext) {
  const { root, decor, kit, materials, room, passage, holoPanel, sign, interact, block, lightSlots, owned, doors, addFree, addSolid } = ctx;
  const { wall, dark, trim, floor, strip, red, doorMat } = materials;
  const owns = <T extends THREE.Material>(material: T) => (owned.push(material), material);

  // --- Detention block AA-23, behind a locked door of the confidential archive. ---
  room("detention", { x0: -39, x1: -31, z0: -30, z1: -4, h: 4.4, strips: 2, panels: false, walls: ["e", "w", "s"], gaps: [{ side: "w", at: -15, width: 2.2, height: 2.9, door: true }] });
  passage("detention", { x0: -37, x1: -33, z0: -30, z1: -26 }, "z");
  lightSlots.detention = [
    { at: [-35, 3.6, -22], color: 0xdfe8ff, power: 26, range: 16 },
    { at: [-35, 3.6, -9], color: 0xdfe8ff, power: 26, range: 16 },
    { at: [-38, 2, -5], color: 0xff2a2a, power: 6, range: 9 },
  ];
  const detentionDoor = doors[doors.findIndex((door) => Math.abs(door.x + 35) < 0.2 && Math.abs(door.z + 29.7) < 0.8)];
  if (detentionDoor) detentionDoor.locked = true;
  let unlocked = false;
  addSolid((x, z) => !unlocked && x > -38 && x < -32 && z > -30.4 && z < -28.9);
  // A row of cell doors on each side.
  const cells: [number, number, number, number][] = [
    [-31.05, -25.5, -Math.PI / 2, 2183],
    [-31.05, -20.5, -Math.PI / 2, 2184],
    [-31.05, -15.5, -Math.PI / 2, 2185],
    [-31.05, -10.5, -Math.PI / 2, 2186],
    [-38.95, -25.5, Math.PI / 2, 2181],
    [-38.95, -20.5, Math.PI / 2, 2182],
    [-38.95, -10, Math.PI / 2, 2188],
    [-38.95, -6, Math.PI / 2, 2189],
  ];
  for (const [x, z, ry, number] of cells) {
    const face = x > -35 ? -1 : 1;
    kit.box(trim, 0.08, 3, 2.3, x + face * 0.02, 1.5, z);
    kit.box(doorMat, 0.08, 2.7, 2, x + face * 0.06, 1.35, z);
    kit.box(dark, 0.04, 0.36, 1.1, x + face * 0.11, 1.95, z);
    kit.box(red, 0.04, 0.1, 0.1, x + face * 0.11, 1.2, z + 0.75);
    sign(`${number}`, "BLOC AA-23", x + face * 0.1, 3.25, z, ry, 1.4);
  }
  sign("CELLULE 2187", "BLOC AA-23 · ISOLEMENT", -38.9, 3.3, -15, Math.PI / 2, 2.2);
  sign("BLOC DE DÉTENTION AA-23", "NIVEAU 5 · ACCÈS CONTRÔLÉ", -35, 3.65, -29.45, 0, 4);
  // The officer's desk at the far end, and the grate of the garbage chute.
  kit.box(trim, 3, 1.05, 1.1, -35, 0.52, -5.4);
  kit.box(dark, 2.8, 0.2, 0.9, -35, 1.13, -5.4);
  holoPanel([{ text: "BLOC AA-23", size: 66 }, { text: "Transfert du prisonnier : autorisé", size: 40, color: "#9fd6ff" }], 1.9, 0.8, -35, 1.85, -5.2, Math.PI);
  block(-35, -5.2, 1.8);
  const grate = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 1.6), new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.7, metalness: 0.4 }));
  owns(grate.material as THREE.Material);
  grate.position.set(-31.06, 0.95, -6);
  root.add(grate);
  for (let i = 0; i < 6; i++) kit.box(trim, 0.06, 1.5, 0.05, -31.14, 0.95, -6.65 + i * 0.26);
  interact("chute", "Sauter dans le vide-ordures", "detention", -31.5, 1, -6, 2.6, grate);

  // Cell 2187: a bare cell, and the princess on its bench.
  room("cell", { x0: -46.2, x1: -39.6, z0: -18, z1: -12, h: 3.2, strips: 1, panels: false, walls: ["n", "s", "w"] });
  passage("cell", { x0: -41, x1: -37.8, z0: -16, z1: -14 }, "x");
  lightSlots.cell = [
    { at: [-43, 2.7, -15], color: 0xe6eeff, power: 9, range: 9 },
    { at: [-41, 1.6, -13], color: 0xc8d8ff, power: 2.5, range: 7 },
  ];
  kit.box(trim, 1.5, 0.5, 5.2, -45.3, 0.25, -15);
  const leia = createPrincessLeia();
  // On the edge of the bench, facing the door.
  leia.group.position.set(-44.75, 0, -15);
  leia.group.rotation.y = Math.PI / 2;
  root.add(leia.group);
  const leiaHit = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.7, 10), owns(new THREE.MeshBasicMaterial({ visible: false })));
  leiaHit.position.set(-44.6, 0.85, -15);
  root.add(leiaHit);
  block(-44.9, -15, 1);
  interact("cell-2187", "Parler à la princesse", "cell", -44.6, 1.2, -15, 3, leiaHit);
  const LEIA: Performance = { kind: "gesture", duration: 2.6, line: "« Vous n’êtes pas un peu petit pour un stormtrooper ? »" };
  let leiaTalk = 0;

  // --- Garbage compactor 3263827: reached only by the chute. ---
  room("compactor", { x0: -72, x1: -54, z0: -30, z1: -12, h: 7, strips: 1, panels: false, gaps: [{ side: "s", at: -63, width: 3, height: 3, door: true }] });
  lightSlots.compactor = [
    { at: [-63, 6, -21], color: 0xa8c8a0, power: 30, range: 20 },
    { at: [-63, 1, -24], color: 0x5f8f6a, power: 8, range: 10 },
  ];
  const compactorDoor = doors[doors.length - 1];
  compactorDoor.locked = true;
  sign("COMPACTEUR 3263827", "NIVEAU DE DÉTENTION", -63, 5.4, -29.7, 0, 5.2);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), new THREE.MeshStandardMaterial({ color: 0x18261c, roughness: 0.12, metalness: 0.5 }));
  owns(water.material as THREE.Material);
  water.rotation.x = -Math.PI / 2;
  water.position.set(-63, 0.32, -21);
  root.add(water);
  // The heaps of scrap, half under water.
  const scrapMaterial = owns(new THREE.MeshStandardMaterial({ color: 0x4a4d48, roughness: 0.72, metalness: 0.55 }));
  const scrap = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), scrapMaterial, 130);
  let seed = 3263827;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const place = new THREE.Object3D(),
    tone = new THREE.Color();
  for (let i = 0; i < 130; i++) {
    const edge = i % 3 ? 1 : -1;
    place.position.set(-63 + edge * (2.5 + rnd() * 6) * (rnd() < 0.5 ? 1 : -1), 0.1 + rnd() * 0.5, -29 + rnd() * 16);
    place.scale.set(0.4 + rnd() * 2.2, 0.15 + rnd() * 0.8, 0.3 + rnd() * 1.8);
    place.rotation.set(rnd() * 0.8, rnd() * 3, rnd() * 0.8);
    place.updateMatrix();
    scrap.setMatrixAt(i, place.matrix);
    const v = 0.35 + rnd() * 0.65;
    scrap.setColorAt(i, tone.setRGB(v, v * (0.92 + rnd() * 0.1), v * 0.85));
  }
  root.add(scrap);
  // The two walls that close in, ribbed like the real thing.
  const crusherMaterial = owns(new THREE.MeshStandardMaterial({ color: 0x3f4340, roughness: 0.5, metalness: 0.7 }));
  const crushers = [-1, 1].map((side) => {
    const crusher = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1, 7, 18), crusherMaterial);
    crusher.add(slab);
    for (let i = 0; i < 7; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.34, 7, 0.8), crusherMaterial);
      rib.position.set(-side * 0.62, 0, -7.8 + i * 2.6);
      crusher.add(rib);
    }
    crusher.position.set(-63 + side * 9.5, 3.5, -21);
    root.add(crusher);
    return { crusher, side };
  });
  // The creature of the pit: a pale stalk with a single eye, rising from the water.
  const dianoga = new THREE.Group();
  const flesh = owns(new THREE.MeshStandardMaterial({ color: 0x7d8466, roughness: 0.6 }));
  const stalk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.9, 0), new THREE.Vector3(0.1, 0.1, 0), new THREE.Vector3(-0.08, 0.9, 0.05), new THREE.Vector3(0.05, 1.5, 0.15)]), 22, 0.09, 8), flesh);
  dianoga.add(stalk);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), flesh);
  bulb.position.set(0.05, 1.56, 0.17);
  dianoga.add(bulb);
  const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), owns(new THREE.MeshStandardMaterial({ color: 0xd8d4a8, roughness: 0.3 })));
  eyeWhite.position.set(0.05, 1.58, 0.31);
  dianoga.add(eyeWhite);
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), owns(new THREE.MeshStandardMaterial({ color: 0x080704, roughness: 0.2 })));
  iris.position.set(0.05, 1.58, 0.4);
  dianoga.add(iris);
  dianoga.position.set(-58, -1.3, -24);
  root.add(dianoga);
  // How far the walls have come, 0 to 1, and what the room is doing.
  let close = 0,
    state: "idle" | "closing" | "stopped" = "idle",
    entered = 0;
  const halfWidth = () => COMPACTOR.half - close * 6.9;
  addSolid((x, z) => x < -54 && x > -72 && z < -12 && z > -30 && Math.abs(x - COMPACTOR.x) > halfWidth());
  interact("compactor-exit", "Sortir du compacteur", "compactor", -63, 1.2, -13, 0);

  // --- The superlaser's firing room, on the command level. ---
  room("laserhall", { x0: 82.5, x1: 85.5, z0: -70, z1: -62, h: 4, walls: ["e", "w"], strips: 1, panels: false });
  passage("laserhall", { x0: 82.5, x1: 85.5, z0: -70, z1: -62 }, "z");
  lightSlots.laserhall = [{ at: [84, 3.2, -66], color: 0xdfe8ff, power: 12, range: 11 }];
  room("superlaser", { x0: 70, x1: 118, z0: -100, z1: -70, h: 14, strips: 2, panelSides: ["e", "w"], gaps: [{ side: "s", at: 84, width: 3, height: 3.4 }, { side: "n", at: 94, width: 30, height: 9, bottom: 1.3 }], inset: { n: 3 } });
  lightSlots.superlaser = [
    { at: [94, 11, -84], color: 0xdfe8ff, power: 70, range: 30 },
    { at: [94, 3, -94], color: 0x50ff7a, power: 26, range: 16 },
    { at: [75, 3, -74], color: 0xff2a2a, power: 7, range: 10 },
    { at: [113, 3, -74], color: 0xff2a2a, power: 7, range: 10 },
  ];
  sign("SALLE DE TIR DU SUPERLASER", "ALLUMAGE PRIMAIRE · ACCÈS RESTREINT", 94, 11, -70.5, Math.PI, 8);
  // The firing console and its levers, then the gunners' bank on either side.
  kit.box(trim, 7, 1.05, 1.5, 94, 0.52, -94.2);
  kit.box(dark, 6.8, 0.25, 1.2, 94, 1.15, -94.1, 0, 0, -0.35);
  const levers: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), trim);
    lever.position.set(92.2 + i * 1.2, 1.5, -94.1);
    root.add(lever);
    levers.push(lever);
    kit.box(i % 2 ? red : strip, 0.28, 0.04, 0.16, 92.2 + i * 1.2, 1.3, -93.7, 0, 0, -0.35);
  }
  block(94, -94.2, 2.2);
  for (const x of [91, 97]) block(x, -94.2, 1.8);
  const fireLabel = holoPanel([{ text: "TIR D’ESSAI", size: 70 }, { text: "Cible : astéroïde XN-12", size: 44, color: "#a8ffba" }], 2.6, 1, 94, 2.7, -94.5, 0);
  (fireLabel.material as THREE.MeshBasicMaterial).color.set(0x8fffa8);
  interact("superlaser", "Lancer le tir d’essai", "superlaser", SUPERLASER_CONSOLE.x, 1.3, SUPERLASER_CONSOLE.z + 2.4, 3.6, fireLabel);
  for (const side of [-1, 1]) {
    const x = 94 + side * 14;
    kit.box(dark, 11, 1, 1.2, x, 0.5, -92);
    kit.box(trim, 11, 0.35, 0.9, x, 1.15, -91.9, 0, 0, -0.45);
    for (let i = 0; i < 12; i++) kit.box(i % 3 ? strip : red, 0.16, 0.05, 0.1, x - 5 + i * 0.9, 1.3, -91.7, 0, 0, -0.45);
    for (let k = -5; k <= 5; k += 2.5) block(x + k, -92, 1);
  }
  const gunners = [
    gunner(84, -90.7, Math.PI),
    gunner(104, -90.7, Math.PI),
    gunner(108, -90.7, Math.PI),
  ];
  gunners.forEach((human) => {
    decor.add(human.group);
    block(human.group.position.x, human.group.position.z, 0.6, true);
  });
  // Through the great window: the firing chamber, eight tributaries round a focus, open on space.
  const chamberMaterial = owns(new THREE.MeshStandardMaterial({ color: 0x2e3238, roughness: 0.55, metalness: 0.6, side: THREE.BackSide }));
  const chamber = new THREE.Mesh(new THREE.CylinderGeometry(38, 38, 150, 48, 1, true), chamberMaterial);
  chamber.rotation.x = Math.PI / 2;
  chamber.position.set(94, 6, -176);
  root.add(chamber);
  for (let z = -112, i = 0; z > -250; z -= 16, i++) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(37.6, 0.4, 6, 64), i % 3 === 2 ? strip : trim);
    hoop.position.set(94, 6, z);
    root.add(hoop);
  }
  const bolt = owns(new THREE.MeshBasicMaterial({ color: 0x66ff88, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const boltCore = owns(new THREE.MeshBasicMaterial({ color: 0xeaffef, toneMapped: false }));
  const emitters = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    const at = new THREE.Vector3(94 + Math.cos(a) * 30, 6 + Math.sin(a) * 30, -122);
    kit.cylinder(trim, 2.6, 3.4, 8, at.x, at.y, at.z, 12);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 10), boltCore);
    lens.position.copy(at);
    lens.visible = false;
    root.add(lens);
    const glow = beamBetween(bolt, at, FOCUS, 1.25);
    const core = beamBetween(boltCore, at, FOCUS, 0.42);
    root.add(glow, core);
    return { glow, core, lens };
  });
  const focusGlow = new THREE.Mesh(new THREE.SphereGeometry(5, 18, 14), bolt);
  focusGlow.position.copy(FOCUS);
  focusGlow.visible = false;
  root.add(focusGlow);
  const mainGlow = beamBetween(bolt, FOCUS, ASTEROID, 6),
    mainCore = beamBetween(boltCore, FOCUS, ASTEROID, 2.2);
  root.add(mainGlow, mainCore);
  // The test target, drifting in the open end of the chamber.
  const rockShape = new THREE.IcosahedronGeometry(46, 3);
  const rp = rockShape.getAttribute("position");
  for (let i = 0; i < rp.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(rp, i);
    v.multiplyScalar(1 + 0.2 * Math.sin(v.x * 0.09 + v.y * 0.07) * Math.cos(v.z * 0.11) + 0.08 * Math.sin(v.y * 0.3));
    rp.setXYZ(i, v.x, v.y, v.z);
  }
  rockShape.computeVertexNormals();
  const rock = new THREE.Mesh(rockShape, owns(new THREE.MeshStandardMaterial({ color: 0x776e62, roughness: 0.95, flatShading: true, emissive: 0x15120e })));
  rock.position.copy(ASTEROID);
  root.add(rock);
  // The explosion: a flash, a shockwave and a cloud of pieces.
  const flash = new THREE.Mesh(new THREE.SphereGeometry(70, 20, 14), owns(new THREE.MeshBasicMaterial({ color: 0xfff2cc, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
  flash.position.copy(ASTEROID);
  flash.visible = false;
  root.add(flash);
  const shock = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 64), owns(new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
  shock.position.copy(ASTEROID);
  shock.visible = false;
  root.add(shock);
  const shardCount = 400;
  const shardDirs = new Float32Array(shardCount * 3);
  for (let i = 0; i < shardCount; i++) {
    const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(0.5 + rnd());
    shardDirs.set([v.x, v.y, v.z], i * 3);
  }
  const shardGeometry = new THREE.BufferGeometry();
  shardGeometry.setAttribute("position", new THREE.BufferAttribute(shardDirs.slice(), 3));
  const shards = new THREE.Points(shardGeometry, owns(new THREE.PointsMaterial({ color: 0xffc98a, size: 3, sizeAttenuation: false, transparent: true, toneMapped: false })));
  shards.position.copy(ASTEROID);
  shards.visible = false;
  shards.frustumCulled = false;
  root.add(shards);

  const FIRE: Performance = { kind: "superlaser", duration: 8.2, line: "« Allumage primaire. » Les huit faisceaux convergent sur l’astéroïde XN-12." };
  let firing = -1;
  const setBeams = (t: number, reduced: boolean) => {
    // The tributaries light one after another, then join at the focus, then the shot.
    emitters.forEach((item, i) => {
      const on = t > 0.5 + i * 0.32 && t < 5.1;
      item.glow.visible = item.core.visible = item.lens.visible = on;
    });
    const gathered = smooth(t, 3, 3.9) * (1 - smooth(t, 4.9, 5.2));
    focusGlow.visible = gathered > 0.01;
    focusGlow.scale.setScalar(0.4 + gathered * (reduced ? 1 : 1 + Math.sin(t * 40) * 0.08));
    const shooting = t > 3.95 && t < 4.75;
    mainGlow.visible = mainCore.visible = shooting;
    const boom = t - 4.1;
    const lit = boom > 0;
    rock.visible = !lit;
    flash.visible = shock.visible = shards.visible = lit;
    if (lit) {
      (flash.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - boom * 1.3);
      flash.scale.setScalar(1 + boom * 2.6);
      shock.scale.setScalar(40 + boom * 240);
      (shock.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.75 - boom * 0.2);
      const position = shardGeometry.getAttribute("position") as THREE.BufferAttribute;
      const reach = 60 + boom * 150;
      for (let i = 0; i < shardCount * 3; i++) (position.array as Float32Array)[i] = shardDirs[i] * reach;
      position.needsUpdate = true;
      (shards.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - boom * 0.28);
    }
    levers.forEach((lever, i) => (lever.rotation.x = t > 0.4 + i * 0.32 ? -0.55 : 0));
  };
  const endFire = () => {
    firing = -1;
    emitters.forEach((item) => (item.glow.visible = item.core.visible = item.lens.visible = false));
    focusGlow.visible = mainGlow.visible = mainCore.visible = flash.visible = shock.visible = shards.visible = false;
    levers.forEach((lever) => (lever.rotation.x = 0));
    rock.visible = true;
  };

  // --- The tractor beam's shaft, west of the command room: no rails over the drop. ---
  const { x: tx, z: tz } = TRACTOR_CENTRE;
  room("tractorway", { x0: 72, x1: 80, z0: -47.8, z1: -44.2, h: 3.6, walls: ["n", "s"], strips: 1, panels: false });
  passage("tractorway", { x0: 72, x1: 80, z0: -47.8, z1: -44.2 }, "x");
  lightSlots.tractorway = [{ at: [76, 3, -46], color: 0xdfe8ff, power: 10, range: 10 }];
  lightSlots.tractor = [
    { at: [tx + 12, 6, tz], color: 0xbcd4ff, power: 70, range: 34 },
    { at: [tx, 3.5, tz + 8], color: 0x4aa8ff, power: 34, range: 22 },
    { at: [tx, 3.5, tz - 8], color: 0x4aa8ff, power: 34, range: 22 },
    { at: [tx, -30, tz], color: 0x2d6fbf, power: 60, range: 60 },
  ];
  const shaftWall = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 170, 56, 1, true), owns(new THREE.MeshStandardMaterial({ color: 0x3a3e45, roughness: 0.55, metalness: 0.55, side: THREE.BackSide })));
  shaftWall.position.set(tx, -25, tz);
  root.add(shaftWall);
  const pitGlow = new THREE.Mesh(new THREE.CircleGeometry(22, 48), owns(new THREE.MeshBasicMaterial({ color: 0x143a70, toneMapped: false })));
  pitGlow.rotation.x = -Math.PI / 2;
  pitGlow.position.set(tx, -108, tz);
  root.add(pitGlow);
  const shaftTop = new THREE.Mesh(new THREE.CircleGeometry(22, 48), owns(new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.7, metalness: 0.5 })));
  shaftTop.rotation.x = Math.PI / 2;
  shaftTop.position.set(tx, 60, tz);
  root.add(shaftTop);
  for (let y = -100; y < 58; y += 12) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(21.7, 0.28, 6, 72), y % 36 === 8 ? strip : trim);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.set(tx, y, tz);
    root.add(hoop);
  }
  // The catwalk, the ring round the tower, and the tower itself.
  kit.box(dark, 17.5, 0.24, 2.2, tx + 13.6, -0.12, tz, 0, 4);
  kit.cylinder(floor, 6.4, 6.4, 0.24, tx, -0.12, tz, 48);
  kit.cylinder(trim, 6.5, 5.8, 1.2, tx, -0.9, tz, 48);
  const towerProfile = [
    [7, -108], [4.8, -92], [3.7, -60], [3.7, 4], [4.2, 5.5], [3.7, 7], [3.5, 30], [5.4, 40], [6.2, 60],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const tower = new THREE.Mesh(new THREE.LatheGeometry(towerProfile, 40), owns(new THREE.MeshStandardMaterial({ color: 0x565b63, roughness: 0.42, metalness: 0.7 })));
  tower.position.set(tx, 0, tz);
  root.add(tower);
  const hum = owns(new THREE.MeshBasicMaterial({ color: 0x7fc8ff, toneMapped: false }));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 54, 0.16), hum);
    fin.position.set(tx + Math.sin(a) * 3.75, -28, tz + Math.cos(a) * 3.75);
    root.add(fin);
  }
  addFree((x, z) => {
    const r = Math.hypot(x - tx, z - tz);
    return (r < 6 && r > 4.5) || (x > tx + 4 && x < 72.6 && Math.abs(z - tz) < 0.85);
  });
  // The control panel, on the tower's face towards the catwalk.
  kit.box(trim, 0.7, 1.5, 2.4, tx + 4.1, 0.75, tz);
  const switches: THREE.Mesh[] = [-0.55, 0.55].map((dz) => {
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.1), strip);
    lever.position.set(tx + 4.5, 1.52, tz + dz);
    root.add(lever);
    return lever;
  });
  const tractorPanel = holoPanel([{ text: "RAYON TRACTEUR", size: 64 }, { text: "Puissance : 100 %", size: 46, color: "#9fd6ff" }], 2.2, 0.9, tx + 4.5, 2.5, tz, Math.PI / 2);
  interact("tractor", "Couper le rayon tracteur", "tractor", tx + 4.6, 1.4, tz, 2.6, tractorPanel);
  const TRACTOR: Performance = { kind: "tractor", duration: 3, line: "Les deux leviers basculent. Rayon tracteur coupé : votre vaisseau est libre." };
  let tractorOn = true,
    tractorFade = 1;
  const setTractorOff = () => {
    tractorOn = false;
    switches.forEach((lever) => (lever.rotation.z = 0.6));
    const label = tractorPanel.material as THREE.MeshBasicMaterial;
    label.color.set(0xff8d8d);
  };

  // --- Patrols: a few stormtroopers on their rounds, and droids scurrying about. ---
  const beats: { from: [number, number]; to: [number, number]; room: RoomId }[] = [
    { from: [-1.1, -53], to: [-1.1, -78], room: "corridor" },
    { from: [-13, -89], to: [-34, -89], room: "west" },
    { from: [13, -91], to: [34, -91], room: "east" },
    { from: [-5.8, -46], to: [-5.8, -14], room: "hangar" },
    { from: [-37.5, -27], to: [-37.5, -8], room: "detention" },
  ];
  const patrols = beats.map((beat, i) => {
    const trooper = createSandtrooper();
    decor.add(trooper.group);
    return { trooper, beat, k: (i * 0.37) % 1, way: i % 2 ? -1 : 1, wait: 0, length: Math.hypot(beat.to[0] - beat.from[0], beat.to[1] - beat.from[1]) };
  });

  return {
    /** The code of the restricted terminal opens the block. */
    unlockDetention: () => {
      unlocked = true;
      if (detentionDoor) detentionDoor.locked = false;
    },
    detentionOpen: () => unlocked,
    compactorState: () => state,
    compactorClose: () => close,
    stopCompactor: () => {
      if (state === "closing") state = "stopped";
    },
    /** Pushes the visitor out of the way of the walls. */
    constrain: (player: { x: number; z: number }) => {
      if (player.x < -54 && player.x > -72 && player.z < -12 && player.z > -30) {
        const limit = halfWidth() - 0.02;
        player.x = THREE.MathUtils.clamp(player.x, COMPACTOR.x - limit, COMPACTOR.x + limit);
      }
    },
    fire: () => {
      if (firing >= 0) return null;
      firing = 0;
      return FIRE;
    },
    tractor: (): Performance | null => (tractorOn ? TRACTOR : null),
    leia: (): Performance => {
      leiaTalk = LEIA.duration + 8;
      return LEIA;
    },
    tractorOn: () => tractorOn,
    setTractorOff,
    tick: (dt: number, time: number, player: THREE.Vector3, room_: RoomId | null, reduced: boolean) => {
      // The princess only stirs for a visitor who has come close.
      leia.group.visible = room_ === "cell" || room_ === "detention";
      if (leia.group.visible) {
        leiaTalk = Math.max(0, leiaTalk - dt);
        const toVisitor = Math.atan2(player.x - leia.group.position.x, player.z - leia.group.position.z) - Math.PI / 2;
        const near = room_ === "cell" && Math.hypot(player.x - leia.group.position.x, player.z - leia.group.position.z) < 4;
        leia.tick(dt, time, reduced, near || leiaTalk > 0, THREE.MathUtils.clamp(Math.atan2(Math.sin(toVisitor), Math.cos(toVisitor)), -0.6, 0.6));
      }
      // The compactor runs once the visitor is inside: the creature first, then the walls.
      if (room_ === "compactor") {
        entered += dt;
        if (state === "idle" && entered > 6) state = "closing";
        if (state === "closing") {
          close = Math.min(1, close + dt / 24);
          // R-X7 does not let it end badly.
          if (close >= 0.8) state = "stopped";
        }
      } else if (entered > 0) {
        entered = 0;
        state = "idle";
        close = 0;
      }
      if (state === "stopped") close = Math.max(0.25, close - dt * 0.2);
      compactorDoor.locked = state !== "stopped";
      crushers.forEach(({ crusher, side }) => (crusher.position.x = COMPACTOR.x + side * (halfWidth() + 1.15)));
      dianoga.visible = room_ === "compactor";
      if (dianoga.visible) {
        const up = reduced ? 1 : smooth(entered, 1, 3) * (1 - smooth(entered, 10, 12) * 0.85);
        dianoga.position.y = -1.3 + up * 1.2;
        dianoga.rotation.y = Math.atan2(player.x - dianoga.position.x, player.z - dianoga.position.z);
        if (!reduced) dianoga.rotation.z = Math.sin(time * 0.9) * 0.14;
      }
      // The firing sequence.
      if (firing >= 0) {
        firing += dt;
        setBeams(firing, reduced);
        if (firing >= FIRE.duration) endFire();
      }
      if (!reduced && firing < 0) rock.rotation.y = time * 0.03;
      // The generator's glow, dying when the beam is cut.
      tractorFade = THREE.MathUtils.damp(tractorFade, tractorOn ? 1 : 0.12, 2, dt);
      hum.color.setHex(0x7fc8ff).multiplyScalar(tractorFade * (reduced ? 1 : 0.9 + Math.sin(time * 6) * 0.1));
      // The rounds: only the near troopers are drawn and animated.
      patrols.forEach((patrol) => {
        const { trooper, beat } = patrol;
        const x = THREE.MathUtils.lerp(beat.from[0], beat.to[0], patrol.k),
          z = THREE.MathUtils.lerp(beat.from[1], beat.to[1], patrol.k);
        const away = Math.hypot(player.x - x, player.z - z);
        const show = beat.room === "detention" ? unlocked && away < 40 : away < 45;
        trooper.group.visible = show;
        if (!show) return;
        const blocked = away < 1.9;
        if (patrol.wait > 0) patrol.wait -= dt;
        const walking = !reduced && !blocked && patrol.wait <= 0;
        if (walking) {
          patrol.k += (patrol.way * dt * 1.25) / patrol.length;
          if (patrol.k >= 1 || patrol.k <= 0) {
            patrol.k = THREE.MathUtils.clamp(patrol.k, 0, 1);
            patrol.way *= -1;
            patrol.wait = 2.2;
          }
        }
        trooper.group.position.set(x, 0, z);
        const heading = Math.atan2((beat.to[0] - beat.from[0]) * patrol.way, (beat.to[1] - beat.from[1]) * patrol.way);
        // Stopped by the visitor, he turns to look.
        const want = blocked ? Math.atan2(player.x - x, player.z - z) : heading;
        const turn = Math.atan2(Math.sin(want - trooper.group.rotation.y), Math.cos(want - trooper.group.rotation.y));
        trooper.group.rotation.y += turn * Math.min(1, dt * 5);
        trooper.tick(time, walking, reduced);
      });
      gunners.forEach((human, i) => {
        if (room_ === "superlaser") human.look(Math.sin(time * 0.3 + i) * 0.3, -0.25, time, reduced);
      });
    },
  };
}
export type StationWings = ReturnType<typeof createStationWings>;
