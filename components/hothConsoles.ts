import * as THREE from "three";
import { bakePart, part, rounded } from "./tatooineCharacters";

// The base's consoles: heavy grey Alliance cabinets, a sloped board of lit keys, two recessed tube
// screens under a hood, cable runs to the floor. Their pictures are drawn on a few shared canvases,
// redrawn a few times a second while someone is in the room.

type Painter = (c: CanvasRenderingContext2D, w: number, h: number, time: number) => void;
const MONO = "SFMono-Regular, Consolas, monospace";

const logLines = ["BOUCLIER  STABLE", "GENERATEUR  98 %", "SECTEUR 12  CONTACT", "TRANCHEE N  EN LIGNE", "RAIDER 3  VERS LE N", "TRANSPORT  PRET", "ION  CHARGE", "ECHO 3  REPOND", "TB-TT  DISTANCE 1,2", "EVACUATION  PHASE 2"];
const painters: Painter[] = [
  // A scrolling log, amber.
  (c, w, h, time) => {
    c.fillStyle = "#120b02";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#ffb04a";
    c.font = `bold 15px ${MONO}`;
    const start = Math.floor(time * 1.4);
    for (let i = 0; i < 9; i++) c.fillText(logLines[(start + i) % logLines.length], 8, 20 + i * 19);
    if (Math.sin(time * 5) > 0) c.fillRect(8, h - 14, 10, 4);
  },
  // A wireframe of a walker in profile, with its target box: green.
  (c, w, h, time) => {
    c.fillStyle = "#031005";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "#5dff8a";
    c.lineWidth = 1.5;
    const s = h / 110,
      x = w / 2 - 50 * s,
      y = h * 0.2;
    c.beginPath();
    c.rect(x + 20 * s, y, 56 * s, 22 * s);
    c.rect(x + 80 * s, y + 4 * s, 18 * s, 12 * s);
    c.moveTo(x + 76 * s, y + 10 * s);
    c.lineTo(x + 80 * s, y + 10 * s);
    for (const lx of [26, 38, 60, 70]) {
      c.moveTo(x + lx * s, y + 22 * s);
      c.lineTo(x + (lx + 3) * s, y + 44 * s);
      c.lineTo(x + lx * s, y + 68 * s);
    }
    c.stroke();
    c.strokeStyle = "#ff5a4a";
    const scan = (time * 26) % h;
    c.beginPath();
    c.moveTo(0, scan);
    c.lineTo(w, scan);
    c.stroke();
    c.fillStyle = "#5dff8a";
    c.font = `bold 13px ${MONO}`;
    c.fillText("TB-TT · BLINDAGE TROP EPAIS", 6, h - 8);
  },
  // The shield grid with its sweep, blue.
  (c, w, h, time) => {
    c.fillStyle = "#020a14";
    c.fillRect(0, 0, w, h);
    const cx = w / 2,
      cy = h * 0.54;
    c.strokeStyle = "#2c7fc0";
    for (let r = 18; r < h / 2; r += 18) {
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.stroke();
    }
    c.strokeStyle = "#8fd8ff";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(time * 1.6) * h * 0.46, cy + Math.sin(time * 1.6) * h * 0.46);
    c.stroke();
    c.lineWidth = 1;
    c.fillStyle = "#8fd8ff";
    c.font = `bold 13px ${MONO}`;
    c.fillText("ECRAN DE PROTECTION", 8, 16);
  },
];

function keyboardTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  return { canvas, c: canvas.getContext("2d")! };
}

export function createConsoles() {
  const group = new THREE.Group();
  group.name = "echo-consoles";
  const screens = painters.map((paint) => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 192;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return { paint, c: canvas.getContext("2d")!, texture, material: new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }) };
  });
  const keys = keyboardTexture();
  const keyTexture = new THREE.CanvasTexture(keys.canvas);
  keyTexture.colorSpace = THREE.SRGBColorSpace;
  const keyMaterial = new THREE.MeshBasicMaterial({ map: keyTexture, toneMapped: false });
  const lit = ["#ff7a4a", "#ffc04a", "#6fe08a", "#6fc8ff", "#e8e4d8"];
  let seed = 327;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const paintKeys = () => {
    const { c, canvas } = keys;
    c.fillStyle = "#1a1c1e";
    c.fillRect(0, 0, canvas.width, canvas.height);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 14; col++) {
        const on = rnd() < 0.42;
        c.fillStyle = on ? lit[Math.floor(rnd() * lit.length)] : "#3b3f42";
        c.fillRect(5 + col * 18, 6 + row * 22, 14, 16);
      }
    }
    keyTexture.needsUpdate = true;
  };
  paintKeys();
  const grey = new THREE.MeshStandardMaterial({ color: 0x8d9296, roughness: 0.6, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1e2124, roughness: 0.55, metalness: 0.5 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x5a5f63, roughness: 0.5, metalness: 0.55 });
  const unit = (x: number, y: number, z: number, turn: number, index: number) => {
    const root = new THREE.Group();
    root.position.set(x, y, z);
    root.rotation.y = turn;
    // Cabinet and kick plate, the sloped board, the upright with its hood.
    part(root, rounded(2.3, 0.82, 0.72, 0.03), grey, [0, 0.45, -0.05]);
    part(root, rounded(2.2, 0.06, 0.74, 0.01), dark, [0, 0.03, -0.05]);
    for (let i = 0; i < 5; i++) part(root, rounded(0.34, 0.03, 0.02, 0.005), dark, [-0.76 + i * 0.38, 0.2, 0.32]);
    const board = part(root, rounded(2.3, 0.07, 0.58, 0.02), trim, [0, 0.93, 0.26]);
    board.rotation.x = 0.34;
    const keyboard = part(root, new THREE.PlaneGeometry(2.05, 0.46), keyMaterial, [0, 0.975, 0.26]);
    keyboard.rotation.x = 0.34 - Math.PI / 2;
    part(root, rounded(2.3, 1.2, 0.34, 0.03), grey, [0, 1.56, -0.22]);
    part(root, rounded(2.34, 0.08, 0.5, 0.02), trim, [0, 2.18, -0.14]);
    // Vents along the top, an indicator row, a pair of tube screens in dark bezels.
    for (let i = 0; i < 8; i++) part(root, rounded(0.2, 0.02, 0.02, 0.004), dark, [-0.8 + i * 0.23, 2.08, -0.04]);
    for (const [k, side] of [[0, -0.56], [1, 0.56]] as const) {
      part(root, rounded(1.02, 0.82, 0.06, 0.05), dark, [side, 1.62, -0.05]);
      const screen = part(root, new THREE.PlaneGeometry(0.9, 0.68), screens[(index + k) % screens.length].material, [side, 1.62, -0.015]);
      screen.renderOrder = 1;
    }
    bakePart(root);
    group.add(root);
    return root;
  };
  let clock = 0,
    frame = 0;
  return {
    group,
    unit,
    tick(dt: number, time: number, reduced: boolean) {
      clock += dt;
      // One canvas at a time: the upload stays small.
      if (clock < 0.12) return;
      clock = 0;
      const screen = screens[frame % screens.length];
      screen.paint(screen.c, 256, 192, reduced ? 1.2 : time);
      screen.texture.needsUpdate = true;
      frame++;
      if (frame % 6 === 0 && !reduced) paintKeys();
    },
    paintAll() {
      screens.forEach((screen) => {
        screen.paint(screen.c, 256, 192, 1.2);
        screen.texture.needsUpdate = true;
      });
    },
  };
}
