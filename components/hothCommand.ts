import * as THREE from "three";
import { type Human, walkPose } from "./humanFigure";
import { createConsoles } from "./hothConsoles";
import { createHoloMap, type MapData } from "./hothHoloMap";
import { createController, createGeneral, createPilot, createSnowTrooper, createTechnician, giveDatapad } from "./hothRebels";

// Echo Base's command centre: a glazed gallery over the back door of the hangar, reached by the lift
// behind that door. Officers at their consoles, a tactical table and a radar wall that follow the
// walkers out on the plain as they really move; through the glass, the hangar and the battle.

export const GALLERY = { minX: -9.4, maxX: 9.4, minZ: -24, maxZ: -16.4, floor: 7.2 };
const HEIGHT = 3.7;
export type Blip = { x: number; z: number; down: boolean };

function atPost(human: Human, x: number, z: number, yaw: number) {
  human.group.position.set(x, GALLERY.floor, z);
  human.group.rotation.y = yaw;
  return human;
}
const atBoard = (human: Human) =>
  human.arms.forEach((arm, i) => {
    arm.root.rotation.set(-0.72, 0, (i ? -1 : 1) * 0.06);
    arm.joint.rotation.x = -0.68;
  });

export function createHothCommand(blips: () => Blip[], probe: () => THREE.Vector3 | null, options: { heightAt: (x: number, z: number) => number; data: () => MapData }) {
  const group = new THREE.Group();
  group.name = "hoth-command";
  const wall = new THREE.MeshStandardMaterial({ color: 0x8f969b, roughness: 0.62, metalness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23282c, roughness: 0.55, metalness: 0.55 });
  const lamp = new THREE.MeshBasicMaterial({ color: 0xffe3bd, toneMapped: false });
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfe0f2, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material = wall) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  const { floor, minZ, maxZ } = GALLERY;
  const front = maxZ + 0.5,
    back = minZ - 0.7,
    centre = (front + back) / 2,
    deep = front - back;
  // The box itself, on four legs, with its floor, roof, end walls and back wall.
  box(20.4, 0.3, deep, 0, floor - 0.15, centre);
  box(20.4, 0.3, deep, 0, floor + HEIGHT + 0.15, centre);
  box(0.3, HEIGHT, deep, -10.2, floor + HEIGHT / 2, centre);
  box(0.3, HEIGHT, deep, 10.2, floor + HEIGHT / 2, centre);
  box(20.4, HEIGHT, 0.3, 0, floor + HEIGHT / 2, back);
  for (const x of [-10, 10]) for (const z of [front - 0.2, back + 2]) box(0.5, floor, 0.5, x, floor / 2, z, dark);
  // Window wall: glass between mullions over a parapet, with a lit rail.
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(20, HEIGHT - 0.9), glass);
  pane.position.set(0, floor + 0.9 + (HEIGHT - 0.9) / 2, front);
  group.add(pane);
  box(20.4, 0.9, 0.2, 0, floor + 0.45, front, dark);
  box(20.4, 0.05, 0.05, 0, floor + 0.93, front - 0.15, lamp);
  for (let i = 0; i <= 8; i++) box(0.14, HEIGHT - 0.9, 0.14, -10 + i * 2.5, floor + 0.9 + (HEIGHT - 0.9) / 2, front, dark);
  for (const x of [-6, 0, 6]) box(3.4, 0.05, 0.5, x, floor + HEIGHT - 0.03, centre, lamp);
  const light = new THREE.PointLight(0xffd9a8, 16, 17, 1.5);
  light.position.set(0, floor + HEIGHT - 0.7, centre);
  group.add(light);
  // Banks of consoles along the sides, turned to the room.
  const consoles = createConsoles();
  group.add(consoles.group);
  [[-9.1, -22.6, 1], [-9.1, -19.6, 1], [-9.1, -17, 1], [9.1, -22.6, -1], [9.1, -19.6, -1], [9.1, -17, -1]].forEach(([x, z, side], i) => consoles.unit(x, floor, z, (side * Math.PI) / 2, i));
  // Conduit along the back wall, under the radar.
  for (const y of [0.42, 0.58, 0.74]) box(19.6, 0.06, 0.06, 0, floor + y, back + 0.22, dark);
  // The radar wall, redrawn a few times a second while someone is looking.
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 320;
  const c = canvas.getContext("2d")!;
  const radar = new THREE.CanvasTexture(canvas);
  radar.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.6), new THREE.MeshBasicMaterial({ map: radar, toneMapped: false }));
  screen.position.set(0, floor + 2.05, back + 0.17);
  group.add(screen);
  const TOWARDS = 420;
  const draw = (time: number) => {
    c.fillStyle = "#05131a";
    c.fillRect(0, 0, 1024, 320);
    c.strokeStyle = "#1a5a6e";
    c.lineWidth = 1;
    for (let i = 0; i <= 16; i++) {
      c.beginPath();
      c.moveTo(i * 64, 0);
      c.lineTo(i * 64, 320);
      c.stroke();
    }
    for (let i = 0; i <= 5; i++) {
      c.beginPath();
      c.moveTo(0, i * 64);
      c.lineTo(1024, i * 64);
      c.stroke();
    }
    c.fillStyle = "#8fe6ff";
    c.font = "bold 22px SFMono-Regular, Consolas, monospace";
    c.fillText("BASE ÉCHO · SECTEUR 12 · CAPTEURS DE SURFACE", 18, 30);
    // The base at the bottom, the shield line and the sweep.
    const baseX = 512,
      baseY = 300;
    c.fillStyle = "#5fe0a0";
    c.fillRect(baseX - 8, baseY - 8, 16, 16);
    c.strokeStyle = "#5fe0a0";
    c.beginPath();
    c.arc(baseX, baseY, 120, Math.PI, 0);
    c.stroke();
    const sweep = time * 0.9;
    c.strokeStyle = "rgba(143,230,255,.55)";
    c.beginPath();
    c.moveTo(baseX, baseY);
    c.lineTo(baseX + Math.cos(sweep) * 520, baseY - Math.abs(Math.sin(sweep)) * 280);
    c.stroke();
    c.font = "bold 18px SFMono-Regular, Consolas, monospace";
    blips().forEach((blip, i) => {
      const x = baseX + (blip.x / TOWARDS) * 480,
        y = baseY - (blip.z / TOWARDS) * 280;
      c.fillStyle = blip.down ? "#6b7780" : "#ff5a4a";
      c.fillRect(x - 7, y - 7, 14, 14);
      c.fillText(`TB-TT ${i + 1}${blip.down ? " · À TERRE" : ""}`, x + 12, y + 6);
    });
    const seen = probe();
    if (seen) {
      const x = baseX + (seen.x / TOWARDS) * 480,
        y = baseY - (seen.z / TOWARDS) * 280;
      c.fillStyle = "#ffd070";
      c.beginPath();
      c.arc(x, y, 7, 0, Math.PI * 2);
      c.fill();
      c.fillText("SONDE IMPÉRIALE", x + 12, y + 6);
    }
    radar.needsUpdate = true;
  };
  draw(0);
  // The tactical table: a heavy steel drum and glass top with a ring of emitters; over it, the hologram.
  const TABLE_Z = -20.2;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.15, 0.82, 48), dark);
  base.position.set(0, floor + 0.41, TABLE_Z);
  base.scale.z = 0.82;
  group.add(base);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2, 0.12, 48), new THREE.MeshStandardMaterial({ color: 0x8d9296, roughness: 0.42, metalness: 0.6 }));
  rim.position.set(0, floor + 0.87, TABLE_Z);
  rim.scale.z = 0.82;
  group.add(rim);
  const top = new THREE.Mesh(new THREE.CircleGeometry(1.92, 48), new THREE.MeshBasicMaterial({ color: 0x0a2c3c, toneMapped: false }));
  top.rotation.x = -Math.PI / 2;
  top.position.set(0, floor + 0.935, TABLE_Z);
  top.scale.y = 0.82;
  group.add(top);
  const emitter = new THREE.MeshBasicMaterial({ color: 0x8fe0ff, toneMapped: false });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const dot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.08), emitter);
    dot.position.set(Math.cos(a) * 1.98, floor + 0.945, TABLE_Z + Math.sin(a) * 1.98 * 0.82);
    group.add(dot);
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.85, 1.9, 40, 1, true), new THREE.MeshBasicMaterial({ color: 0x6fc8ff, transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }));
  beam.scale.z = 0.82;
  beam.position.set(0, floor + 1.9, TABLE_Z);
  group.add(beam);
  const map = createHoloMap({ heightAt: options.heightAt, data: options.data, centre: new THREE.Vector3(0, floor + 1.02, TABLE_Z) });
  group.add(map.group);

  // The people of the room.
  const general = atPost(createGeneral(), -2.75, -21, 0.95);
  general.arms[1].root.rotation.set(-1.15, 0, -0.12);
  general.arms[1].joint.rotation.x = -0.15;
  general.arms[0].root.rotation.set(0.38, 0, 0);
  general.arms[0].joint.rotation.x = -0.3;
  const pilot = atPost(createPilot(), 2.65, -19.1, -1.9);
  pilot.arms[1].root.rotation.set(-0.08, 0, 0.06);
  pilot.arms[1].joint.rotation.x = -0.55;
  pilot.arms[0].root.rotation.set(-0.3, 0, 0);
  pilot.arms[0].joint.rotation.x = -0.9;
  const controller = atPost(createController(), -7.75, -19.6, -Math.PI / 2);
  const techs = [atPost(createTechnician(0), 7.75, -22.6, Math.PI / 2), atPost(createTechnician(1), 7.75, -17, Math.PI / 2), atPost(createTechnician(2), -7.75, -17, -Math.PI / 2)];
  [controller, ...techs].forEach(atBoard);
  const guard = atPost(createSnowTrooper(), 1.9, -23.9, -0.15);
  guard.arms[0].root.rotation.set(-0.72, 0, 0.3);
  guard.arms[0].joint.rotation.x = -1.05;
  guard.arms[1].root.rotation.set(-0.88, 0, -0.25);
  guard.arms[1].joint.rotation.x = -0.95;
  const courier = atPost(createTechnician(1), -5, -16.9, Math.PI / 2);
  giveDatapad(courier);
  const crew = [general, pilot, controller, ...techs, guard, courier];
  crew.forEach((human) => group.add(human.group));
  const courierSpot = { x: -5, z: -16.9, r: 0.45 };
  consoles.paintAll();
  const pick = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 0.4), new THREE.MeshBasicMaterial({ visible: false }));
  pick.position.set(0, 2.5, -22.2);
  group.add(pick);

  let clock = 0,
    painted = 0;
  return {
    group,
    pick,
    colliders: [
      { x: -1.1, z: TABLE_Z, r: 1.75 },
      { x: 1.1, z: TABLE_Z, r: 1.75 },
      { x: -2.75, z: -21, r: 0.45 },
      { x: 2.65, z: -19.1, r: 0.45 },
      { x: 1.9, z: -23.9, r: 0.45 },
      { x: -7.75, z: -19.6, r: 0.45 },
      { x: 7.75, z: -22.6, r: 0.45 },
      { x: 7.75, z: -17, r: 0.45 },
      { x: -7.75, z: -17, r: 0.45 },
      courierSpot,
    ],
    /** The miniatures of the hologram: heavy to build, so on first entry, under the dark. */
    prepare: () => map.build(),
    tick: (dt: number, time: number, reduced: boolean, inside: boolean) => {
      clock += dt;
      map.tick(dt, time, reduced, inside);
      // The glass is tinted down inside, so that the screens and the hologram stand out from the snow.
      glass.opacity = inside ? 0.72 : 0.16;
      glass.color.setHex(inside ? 0x10202c : 0xbfe0f2);
      if (!inside) return;
      consoles.tick(dt, time, reduced);
      crew.forEach((human, i) => human.look(Math.sin(time * 0.4 + i) * 0.35, i < 2 ? 0.05 : -0.2, time, reduced));
      if (!reduced) {
        // Fingers on the boards.
        [controller, ...techs].forEach((human, i) => {
          human.arms[0].joint.rotation.x = -0.68 + Math.sin(time * 7 + i) * 0.05;
          human.arms[1].joint.rotation.x = -0.68 + Math.sin(time * 5.3 + i * 2) * 0.05;
        });
        // The general follows the battle with his hand; the courier walks the window and back.
        general.arms[1].root.rotation.x = -1.15 + Math.sin(time * 0.5) * 0.14;
        const k = (time * 0.11) % 2,
          along = k < 1 ? k : 2 - k;
        const x = -6 + along * 12;
        courier.group.position.x = x;
        courier.group.rotation.y = k < 1 ? Math.PI / 2 : -Math.PI / 2;
        courierSpot.x = x;
        walkPose(courier, time * 5, 0.8);
        courier.arms[0].root.rotation.x = -0.75;
        courier.arms[0].joint.rotation.x = -0.9;
      }
      if (clock - painted > 0.3) {
        painted = clock;
        draw(reduced ? 0.9 : time);
      }
    },
  };
}
