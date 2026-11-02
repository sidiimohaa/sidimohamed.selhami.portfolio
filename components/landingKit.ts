import * as THREE from "three";
import type { MissionId } from "./jediProgression";
import { createShipModel } from "./shipModel";
import type { Landing } from "./universe";

export function random(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export function glowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!,
    gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.25, "rgba(255,255,255,.65)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
function hologramTexture(
  index: number,
  terminal: Landing["terminals"][number],
) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 640;
  const ctx = canvas.getContext("2d")!;
  const glow = ctx.createLinearGradient(0, 0, 0, 640);
  glow.addColorStop(0, "rgba(60,160,220,.16)");
  glow.addColorStop(1, "rgba(60,160,220,.05)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1024, 640);
  ctx.strokeStyle = "#9fe6ff";
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, 976, 592);
  ctx.lineWidth = 10;
  [
    [24, 24, 1, 1],
    [1000, 24, -1, 1],
    [24, 616, 1, -1],
    [1000, 616, -1, -1],
  ].forEach(([x, y, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(x, y + dy * 70);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * 70, y);
    ctx.stroke();
  });
  ctx.fillStyle = "#9fe6ff";
  ctx.font = "34px SFMono-Regular, Consolas, monospace";
  ctx.fillText(`TERMINAL 0${index + 1} · ${terminal.label.toUpperCase()}`, 72, 112);
  ctx.fillStyle = "#e9f9ff";
  ctx.font = "bold 70px Arial, Helvetica, sans-serif";
  wrap(ctx, terminal.heading, 880)
    .slice(0, 2)
    .forEach((line, i) => ctx.fillText(line, 72, 230 + i * 82));
  ctx.fillStyle = "#bfeeff";
  ctx.font = "38px Arial, Helvetica, sans-serif";
  wrap(ctx, terminal.body, 880)
    .slice(0, terminal.meta ? 2 : 3)
    .forEach((line, i) => ctx.fillText(line, 72, 400 + i * 52));
  ctx.fillStyle = "#7fd0f0";
  ctx.font = "26px SFMono-Regular, Consolas, monospace";
  if (terminal.meta) ctx.fillText(terminal.meta.toUpperCase(), 72, 524);
  ctx.fillText("APPROCHEZ-VOUS POUR INTERAGIR", 72, 574);
  ctx.fillStyle = "rgba(0,0,0,.35)";
  for (let y = 0; y < 640; y += 6) ctx.fillRect(0, y, 1024, 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export type Spot = { x: number; z: number; r: number };
export type ZoneTerminal = {
  position: THREE.Vector3;
  angle: number;
  hologram: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  beam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  focus: number;
  // Where to stand to read it, when that is not simply in front of it towards the ship.
  stand?: THREE.Vector3;
};
// Every landing zone shares one layout: the ship on the centre circle, terminals on a ring.
export type ZoneAction = {
  // A wider portrait lens can frame an interaction with several participants.
  portraitFov?: number;
  // Optional stand point for an interaction away from the zone’s default.
  approach?: { position: THREE.Vector3; lookAt: THREE.Vector3 };
  id: string;
  label: string;
  position: THREE.Vector3;
  objects: THREE.Object3D[];
  // Actions that show one of the zone's projects get it before they activate.
  present?: (project: Landing["terminals"][number], index: number, count: number) => void;
  // Actions that open the "Mes passions" presentation (at a step, or from its intro).
  story?: { at?: number; title: string };
  // A secret: usable by clicking it in the scene, and offered as a button only up close.
  hidden?: boolean;
  // Calls the zone's vehicle: once it is ready the visitor climbs aboard (see Zone.board).
  boards?: boolean;
  activate: (reduced: boolean) => void;
};
export type Zone = {
  group: THREE.Group;
  fog: THREE.FogExp2;
  exposure: number;
  walkRadius: number;
  explorePoint?: THREE.Vector3;
  actions?: ZoneAction[];
  actionApproach?: { position: THREE.Vector3; lookAt: THREE.Vector3 };
  // Where the arrival is watched from, then the closer view it settles to (also used at takeoff).
  arrival?: { from: THREE.Vector3; to: THREE.Vector3; shipFrom?:THREE.Vector3; shipYaw?:number; reveal?:number };
  interior?: {name:string;entry:THREE.Vector3;exit:THREE.Vector3;contains:(x:number,z:number)=>boolean};
  constrainWalk?: (walker: { x: number; z: number }) => void;
  routeTo?: (from: THREE.Vector3, to: THREE.Vector3) => THREE.Vector3[];
  // Height of the ground the visitor stands on, for zones with ramps and platforms.
  floorAt?: () => number;
  // A way up to a raised level (Endor's village): where to walk to go up or back down.
  climb?: { up: string; down: string; top: THREE.Vector3; bottom: THREE.Vector3; aloft: () => boolean; place: (aloft: boolean) => void };
  // How loud a zone's music is where the visitor stands, and whether they are inside with it.
  music?: (walker: { x: number; z: number }) => { level: number; inside: boolean };
  // 2 is full detail; lower levels trade shadow quality for frame rate.
  setQuality?: (level: number) => void;
  // A vehicle to board (Coruscant's air taxi): whether it waits with its door open, where the
  // passenger sits, and letting it go once they are aboard or have walked away.
  board?: { ready: () => boolean; seat: () => { position: THREE.Vector3; target: THREE.Vector3 }; release: () => void };
  terminals: ZoneTerminal[];
  ship: THREE.Group;
  shipRest: THREE.Vector3;
  colliders: {
    circles: Spot[];
    footprint: { minX: number; maxX: number; minZ: number; maxZ: number };
    movers: Spot[];
  };
  spawn: { position: THREE.Vector3; yaw: number };
  setViewport: (height: number) => void;
  setThrust: (level: number) => void;
  tick: (dt: number, elapsed: number, reduced: boolean, walker: { x: number; z: number; yaw: number }) => void;
};
// Zones report a secret mission once the visitor has completed it there.
export type Reveal = (id: MissionId) => void;

const TERMINAL_RING = 12;
// Four spots clear of the cargo stacks, then the front and back of the ring for longer lists.
const TERMINAL_ANGLES = [-0.8, 0.8, 2.15, -2.15, 0, Math.PI].map((angle) => angle - Math.PI / 2);

// Holographic terminals around the ring, each facing the centre of the pad.
export function createTerminals(landing: Landing, metal: THREE.Material, circles: Spot[]) {
  const group = new THREE.Group();
  const terminals = landing.terminals.slice(0, TERMINAL_ANGLES.length).map((terminal, index) => {
    const angle = TERMINAL_ANGLES[index];
    const position = new THREE.Vector3(
      Math.cos(angle) * TERMINAL_RING,
      0,
      Math.sin(angle) * TERMINAL_RING,
    );
    const station = new THREE.Group();
    station.position.copy(position);
    station.lookAt(0, 0, 0);
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.6, 1, 18), metal);
    pedestal.position.y = 0.5;
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 0.6), metal);
    desk.position.set(0, 1.04, 0.05);
    desk.rotation.x = -0.35;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.03, 6, 32),
      new THREE.MeshBasicMaterial({ color: 0x8fdcff }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.13;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 0.34, 0.75, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x4fb8e8,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    beam.position.y = 1.5;
    const hologram = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.625),
      new THREE.MeshBasicMaterial({
        map: hologramTexture(index, terminal),
        color: 0x9fdcff,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    hologram.position.y = 2.7;
    hologram.userData.terminal = index;
    pedestal.userData.terminal = index;
    station.add(pedestal, desk, ring, beam, hologram);
    group.add(station);
    circles.push({ x: position.x, z: position.z, r: 0.95 });
    return { position, angle, hologram, beam, focus: 0 };
  });
  return {
    group,
    terminals,
    tick: (elapsed: number, reduced: boolean) => {
      terminals.forEach((terminal, i) => {
        const flicker = reduced
          ? 1
          : 0.93 + Math.sin(elapsed * 7 + i * 2) * 0.04 + (Math.sin(elapsed * 31 + i) > 0.97 ? -0.2 : 0);
        terminal.hologram.material.opacity = (0.55 + terminal.focus * 0.4) * flicker;
        terminal.beam.material.opacity = (0.07 + terminal.focus * 0.08) * flicker;
        terminal.hologram.position.y = 2.7 + (reduced ? 0 : Math.sin(elapsed * 1.4 + i) * 0.04);
      });
    },
  };
}

// The ship, parked on the landing circle with its gear down, nose towards the arrival spot.
export function parkShip(metal: THREE.Material) {
  const ship = new THREE.Group();
  const model = createShipModel();
  model.rotation.x = -Math.PI / 2;
  model.scale.setScalar(3.4);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  model.position.y = 1.15 - bounds.min.y;
  ship.add(model);
  ship.add(
    ...[
      [0, bounds.min.z + 1.6],
      [-1.3, bounds.max.z - 1.6],
      [1.3, bounds.max.z - 1.6],
    ].map(([x, z]) => {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.2, 8), metal);
      strut.position.set(x, 0.6, z);
      return strut;
    }),
  );
  const shipRest = new THREE.Vector3(0, 0, 2);
  ship.position.copy(shipRest);
  ship.rotation.y = Math.PI;
  ship.updateMatrixWorld(true);
  const parked = new THREE.Box3().setFromObject(ship);
  const exhausts: THREE.Sprite[] = [];
  const cores = new Set<THREE.MeshStandardMaterial>();
  model.traverse((object) => {
    if (object instanceof THREE.Sprite && object.name === "engine") exhausts.push(object);
    if (
      object instanceof THREE.Mesh &&
      object.material instanceof THREE.MeshStandardMaterial &&
      object.material.name === "reactor-core"
    )
      cores.add(object.material);
  });
  return {
    ship,
    shipRest,
    exhausts,
    footprint: {
      minX: parked.min.x - 0.4,
      maxX: parked.max.x + 0.4,
      minZ: parked.min.z - 0.4,
      maxZ: parked.max.z + 0.4,
    },
    setThrust: (level: number) => {
      exhausts.forEach((sprite) => {
        sprite.material.opacity = 0.2 + level * 0.65;
        sprite.scale.set(0.32, 0.25 + level * 0.45, 0.32);
      });
      cores.forEach((material) => {
        material.emissiveIntensity = 0.5 + level * 1.2;
      });
    },
  };
}
