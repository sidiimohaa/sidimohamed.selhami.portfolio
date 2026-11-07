import * as THREE from "three";
import { createPilotDroid } from "./pilotDroid";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { glowTexture } from "../landingKit";
import { softBeam } from "../render/softBeam";

// The Coruscant air taxi: a long amber hull with an open cockpit of two rows of seats under a
// low bubble windscreen, two oval humps on the rear deck, dark swept fins at the rear corners
// with red tips, a red light bar across the tail, turbines exposed under the nose, chrome
// vents along the flanks and a checkered band. A pilot droid flies it; the passenger rides on
// the rear right, where a side panel drops open to let them in. Faces +Z with its belly at
// y = 0; the same model waits at pad 3-7 and carries the visitor across the city.

export type AirTaxi = ReturnType<typeof createAirTaxi>;

type XYZ = [number, number, number];

function checkerTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 64;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#16181b";
  c.fillRect(0, 0, 512, 64);
  for (let i = 0; i < 40; i++)
    for (let row = 0; row < 2; row++) {
      if ((i + row) % 2) continue;
      c.fillStyle = "#e9a62b";
      c.fillRect(220 + i * 7, 18 + row * 14, 7, 14);
    }
  // A line of glyphs for the operator's name.
  c.strokeStyle = "#e9a62b";
  c.lineWidth = 5;
  for (let i = 0; i < 6; i++) {
    const x = 26 + i * 30;
    c.beginPath();
    c.moveTo(x, 16);
    c.lineTo(x + 16, 16);
    c.lineTo(x + (i % 2 ? 4 : 14), 48);
    c.moveTo(x + 4, 32);
    c.lineTo(x + 18, 32);
    c.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
// A swept fin blade, drawn backwards along -Z in the YZ plane, thickness along X.
function blade() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(2.1, -0.08);
  shape.lineTo(1.95, 0.26);
  shape.lineTo(0.35, 0.56);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1 });
  geometry.translate(0, 0, -0.035);
  geometry.rotateY(Math.PI / 2);
  return geometry;
}

export function createAirTaxi(options: { glow?: THREE.Texture; holo?: boolean } = {}) {
  const glow = options.glow ?? glowTexture();
  const group = new THREE.Group();
  group.name = "air-taxi";
  group.rotation.order = "YXZ";
  const paint = new THREE.MeshStandardMaterial({ color: 0xe9a62b, metalness: 0.4, roughness: 0.3 }),
    trim = new THREE.MeshStandardMaterial({ color: 0x2a2e33, metalness: 0.6, roughness: 0.42 }),
    chrome = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.85, roughness: 0.22 }),
    leather = new THREE.MeshStandardMaterial({ color: 0xa88d6c, metalness: 0.05, roughness: 0.72 }),
    piping = new THREE.MeshStandardMaterial({ color: 0x3f6f9a, metalness: 0.1, roughness: 0.6 }),
    cabin = new THREE.MeshStandardMaterial({ color: 0x1b1f24, metalness: 0.35, roughness: 0.6 }),
    bronze = new THREE.MeshStandardMaterial({ color: 0xb37d3c, metalness: 0.75, roughness: 0.32 }),
    glass = new THREE.MeshStandardMaterial({ color: 0xbfe0ff, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
    amber = new THREE.MeshBasicMaterial({ color: 0xffb35c, toneMapped: false }),
    red = new THREE.MeshBasicMaterial({ color: 0xff3a2e, toneMapped: false }),
    cyan = new THREE.MeshBasicMaterial({ color: 0x8fe4ff, toneMapped: false }),
    white = new THREE.MeshBasicMaterial({ color: 0xfff4dc, toneMapped: false });
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, at: XYZ = [0, 0, 0], turn: XYZ = [0, 0, 0], parent: THREE.Object3D = group) => {
    const item = new THREE.Mesh(geometry, material);
    item.position.set(...at);
    item.rotation.set(...turn);
    parent.add(item);
    return item;
  };
  const sprite = (color: number, size: number, at: XYZ) => {
    const item = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    item.scale.setScalar(size);
    item.position.set(...at);
    group.add(item);
    return item;
  };
  const rounded = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 4, r);

  // Hull: a long lower body, the hood and the rear deck, with the cockpit open between them.
  add(rounded(2.3, 0.62, 5.5, 0.28), paint, [0, 0.5, 0]);
  add(rounded(1.7, 0.3, 4.6, 0.12), trim, [0, 0.2, -0.05]);
  // The hood slopes down towards the nose.
  add(rounded(2.3, 0.5, 1.3, 0.22), paint, [0, 0.98, 2.1], [0.1, 0, 0]);
  add(rounded(2.1, 0.12, 0.42, 0.05), paint, [0, 1.16, 2.84]);
  add(rounded(2.3, 0.42, 1.2, 0.2), paint, [0, 0.98, -2.2]);
  add(rounded(2.0, 0.56, 0.5, 0.22), paint, [0, 0.78, -2.85]);
  // Long rounded fenders down both flanks, narrowing to the nose: the taxi's silhouette.
  [-1, 1].forEach((side) => {
    const fender = new THREE.CapsuleGeometry(0.38, 4.7, 6, 20).rotateX(Math.PI / 2);
    const p = fender.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      // Slimmer towards the nose, fuller at the rear where the fins grow out.
      const k = THREE.MathUtils.clamp((p.getZ(i) + 2.7) / 5.4, 0, 1);
      const shrink = 1 - k * 0.38;
      p.setX(i, p.getX(i) * shrink);
      p.setY(i, p.getY(i) * (1.15 - k * 0.3));
    }
    fender.computeVertexNormals();
    add(fender, paint, [side * 1.12, 0.64, -0.15]);
    add(new THREE.BoxGeometry(0.03, 0.03, 4.2), chrome, [side * 1.47, 0.6, -0.4]);
  });
  // Cockpit walls; on the right (-X) the rear section is the door.
  add(rounded(0.3, 0.6, 3.2, 0.12), paint, [1.0, 1.05, -0.05]);
  add(rounded(0.3, 0.6, 1.55, 0.12), paint, [-1.0, 1.05, 0.775]);
  add(rounded(0.3, 0.6, 0.45, 0.12), paint, [-1.0, 1.05, -1.425]);
  [-1, 1].forEach((side) => add(new THREE.BoxGeometry(0.03, 0.025, 3.0), amber, [side * 0.84, 1.3, -0.05]));
  // Two oval humps on the rear deck.
  [-0.5, 0.5].forEach((x) => {
    const hump = add(new THREE.SphereGeometry(1, 20, 12), paint, [x, 1.2, -2.2]);
    hump.scale.set(0.22, 0.12, 0.6);
    const inset = add(new THREE.SphereGeometry(1, 16, 10), trim, [x, 1.25, -2.2]);
    inset.scale.set(0.14, 0.08, 0.48);
  });
  // Tail: a red light bar across the back.
  add(new THREE.BoxGeometry(1.5, 0.07, 0.04), red, [0, 0.92, -3.11]);
  sprite(0xff3a2e, 1, [0, 0.92, -3.2]).scale.set(1.5, 0.28, 1);
  // Swept fins at the rear corners, above and below, with red tips.
  const fin = blade();
  [-1, 1].forEach((side) =>
    [1, -1].forEach((up) => {
      const item = add(fin, trim, [side * 1.2, up > 0 ? 0.95 : 0.4, -2.1]);
      // Upper fins lean out and up, lower ones out and down; all splay back and outward.
      item.rotation.set(0, -side * 0.18, up > 0 ? -side * 0.95 : -side * (Math.PI - 1.15), "YXZ");
      const tip = new THREE.Vector3(0, 0.1, -2.02).applyEuler(item.rotation).add(item.position);
      add(new THREE.BoxGeometry(0.09, 0.09, 0.22), red, [tip.x, tip.y, tip.z]);
      sprite(0xff3a2e, 0.55, [tip.x, tip.y, tip.z - 0.1]);
    }),
  );
  // Nose: headlights under the lip, an intake grille, and the turbines exposed below.
  [-1, 1].forEach((side) => {
    add(new THREE.CircleGeometry(0.13, 20), white, [side * 0.62, 0.78, 2.765]);
    add(new THREE.TorusGeometry(0.14, 0.025, 6, 20), chrome, [side * 0.62, 0.78, 2.76]);
    sprite(0xfff1d6, 0.8, [side * 0.62, 0.78, 2.9]);
  });
  add(new THREE.BoxGeometry(0.9, 0.16, 0.06), trim, [0, 0.52, 2.76]);
  for (let i = 0; i < 7; i++) add(new THREE.BoxGeometry(0.02, 0.14, 0.07), chrome, [-0.39 + i * 0.13, 0.52, 2.78]);
  const intakes: THREE.MeshBasicMaterial[] = [];
  [-1, 1].forEach((side) => {
    add(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 20).rotateX(Math.PI / 2), trim, [side * 0.72, 0.3, 2.5]);
    [2.2, 2.45, 2.7].forEach((z) => add(new THREE.TorusGeometry(0.31, 0.035, 6, 20), chrome, [side * 0.72, 0.3, z]));
    const intake = new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.8, toneMapped: false });
    intakes.push(intake);
    add(new THREE.CircleGeometry(0.22, 20), intake, [side * 0.72, 0.3, 2.96]);
    add(new THREE.BoxGeometry(0.22, 0.2, 0.5), cabin, [side * 0.38, 0.28, 2.45]);
  });
  // Chrome vents along the flanks, and the checkered band.
  const checker = new THREE.MeshStandardMaterial({ map: checkerTexture(), metalness: 0.3, roughness: 0.4 });
  [-1, 1].forEach((side) => {
    add(new THREE.BoxGeometry(0.06, 0.3, 1.3), trim, [side * 1.46, 0.62, -1.5]);
    for (let i = 0; i < 9; i++) add(new THREE.BoxGeometry(0.06, 0.26, 0.04), chrome, [side * 1.5, 0.62, -2.08 + i * 0.145]);
    add(new THREE.PlaneGeometry(1.6, 0.2), checker, [side * 1.153, 1.2, 0.65], [0, (side * Math.PI) / 2, 0]);
  });
  add(new THREE.PlaneGeometry(0.42, 1.2), checker, [0.42, 1.255, 2.05], [-Math.PI / 2, 0, Math.PI / 2]);

  // The cockpit: floor, two rows of seats, dashboard under a low bubble windscreen.
  add(new THREE.BoxGeometry(1.75, 0.04, 3.1), cabin, [0, 0.83, -0.05]);
  const seat = (x: number, z: number, back: number, wide = 0.52) => {
    add(rounded(0.56, 0.16, 0.5, 0.05), leather, [x, 1.11, z]);
    add(rounded(wide, back, 0.12, 0.05), leather, [x, 1.19 + back / 2, z - 0.27], [-0.14, 0, 0]);
    add(new THREE.BoxGeometry(0.04, back * 0.8, 0.01), piping, [x, 1.19 + back / 2, z - 0.2], [-0.14, 0, 0]);
    add(new THREE.BoxGeometry(0.36, 0.28, 0.36), cabin, [x, 0.97, z]);
  };
  // Low, narrow backs in front, so the passenger sees over them.
  seat(0.45, 0.78, 0.32, 0.46);
  seat(-0.45, 0.78, 0.32, 0.46);
  seat(0.45, -0.55, 0.52);
  seat(-0.45, -0.55, 0.52);
  add(new THREE.BoxGeometry(0.3, 0.3, 0.85), trim, [0, 1.0, 0.7]);
  add(new THREE.BoxGeometry(1.7, 0.32, 0.45), cabin, [0, 1.16, 1.5], [-0.3, 0, 0]);
  // Gauges: two lit dials and a strip of status lights, in front of the pilot.
  const gauges = document.createElement("canvas");
  gauges.width = 512;
  gauges.height = 128;
  const g = gauges.getContext("2d")!;
  g.fillStyle = "#061016";
  g.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 2; i++) {
    const cx = 120 + i * 270;
    g.strokeStyle = i ? "#8fe4ff" : "#ffb35c";
    g.lineWidth = 6;
    g.beginPath();
    g.arc(cx, 70, 44, Math.PI * 0.8, Math.PI * 2.2);
    g.stroke();
  }
  g.fillStyle = "#8fe4ff";
  for (let k = 0; k < 12; k++) g.fillRect(208 + (k % 4) * 24, 30 + Math.floor(k / 4) * 26, 14, 10);
  const gaugeTexture = new THREE.CanvasTexture(gauges);
  gaugeTexture.colorSpace = THREE.SRGBColorSpace;
  add(new THREE.PlaneGeometry(0.5, 0.125), new THREE.MeshBasicMaterial({ map: gaugeTexture, toneMapped: false }), [0.5, 1.33, 1.27], [0.3, Math.PI, 0]);
  const yoke = add(new THREE.TorusGeometry(0.16, 0.022, 8, 24, Math.PI * 1.2), chrome, [0.45, 1.38, 1.12], [-0.3, 0, Math.PI * -0.1]);
  add(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8).rotateX(Math.PI / 2), chrome, [0.45, 1.32, 1.27]);
  const screen = new THREE.SphereGeometry(1, 28, 10, 0, Math.PI, 0, Math.PI / 2);
  screen.scale(0.95, 0.55, 0.72);
  add(screen, glass, [0, 1.25, 1.36]);
  add(new THREE.TorusGeometry(1, 0.025, 6, 32, Math.PI).rotateX(Math.PI / 2).scale(0.95, 1, 0.72), chrome, [0, 1.25, 1.36]);

  // The pilot droid, in the front right seat, its hands on the yoke.
  const pilot = createPilotDroid(new THREE.Vector3(0, 0.19, 0.32));
  pilot.group.position.set(0.45, 1.19, 0.8);
  group.add(pilot.group);

  // Holo projector on the console; the panel itself is drawn by the journey.
  add(new THREE.CylinderGeometry(0.07, 0.09, 0.05, 20), chrome, [-0.12, 1.17, 0.5]);
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 16), cyan, [-0.12, 1.2, 0.5]);
  let holo: { mesh: THREE.Mesh; canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } | null = null;
  if (options.holo) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 600;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = add(
      new THREE.PlaneGeometry(0.56, 0.33),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }),
      [-0.38, 1.74, 0.3],
      // Turned to face the passenger on the rear right seat.
      [0, Math.atan2(-0.07, -0.9), 0],
    );
    mesh.name = "taxi-holo";
    const beam = add(
      new THREE.ConeGeometry(0.2, 0.5, 20, 1, true),
      softBeam(new THREE.MeshBasicMaterial({ color: 0x5fcfff, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })),
      [-0.26, 1.45, 0.4],
      [Math.PI, 0, 0],
    );
    beam.name = "taxi-holo-beam";
    holo = { mesh, canvas, texture };
  }

  // The door: the rear of the right wall, hinged at its foot, drops outward.
  const door = new THREE.Group();
  door.position.set(-1.0, 0.78, -0.6);
  group.add(door);
  add(rounded(0.3, 0.6, 1.2, 0.12), paint, [0, 0.27, 0], [0, 0, 0], door);
  add(new THREE.BoxGeometry(0.03, 0.025, 1.1), amber, [0.16, 0.52, 0], [0, 0, 0], door);
  add(new THREE.BoxGeometry(0.02, 0.06, 0.24), chrome, [-0.16, 0.36, 0.3], [0, 0, 0], door);

  // Thrust: the turbines' glow, warm wash under the tail, repulsor light under the belly.
  const exhausts = [-0.6, 0.6].map((x) => sprite(0xff9a50, 0.8, [x, 0.28, -3.0]));
  const underGlow = add(
    new THREE.PlaneGeometry(1.6, 4.4),
    new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    [0, 0.04, 0],
    [Math.PI / 2, 0, 0],
  );
  const cabinLight = new THREE.PointLight(0xffb26a, 0.4, 3.6, 2);
  cabinLight.position.set(0, 1.95, 0);
  group.add(cabinLight);

  let doorOpen = 0;
  return {
    group,
    door,
    head: pilot.head,
    pilot: pilot.group,
    yoke,
    // The droid at work: talking 0 to 1, steer -1 to 1, with the yoke turning under its hands.
    tickPilot: (time: number, still: boolean, talking: number, steer: number) => {
      yoke.rotation.z = Math.PI * -0.1 + pilot.tick(time, still, talking, steer);
    },
    holo,
    // The passenger's eyes, on the rear right seat.
    eye: new THREE.Vector3(-0.45, 1.88, -0.6),
    setDoor: (k: number) => {
      doorOpen = THREE.MathUtils.clamp(k, 0, 1);
      door.rotation.z = 1.3 * doorOpen;
    },
    doorOpen: () => doorOpen,
    setThrust: (level: number) => {
      exhausts.forEach((item) => item.scale.setScalar(0.4 + level * 0.8));
      intakes.forEach((intake) => (intake.opacity = 0.4 + level * 0.6));
      (underGlow.material as THREE.MeshBasicMaterial).opacity = 0.18 + level * 0.2;
    },
  };
}

export type StandState = "idle" | "called" | "docked";
// The call post at the edge of pad 3-7: a slim pole, a call plate and a holographic sign.
export const STAND = new THREE.Vector3(-1.7, 0, -14.75);

export function createTaxiStand(glow: THREE.Texture) {
  const group = new THREE.Group();
  group.name = "taxi-stand";
  group.position.copy(STAND);
  group.rotation.y = Math.PI;
  const metal = new THREE.MeshStandardMaterial({ color: 0x4a5258, roughness: 0.4, metalness: 0.75 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.5, 12), metal);
  pole.position.y = 1.25;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.12, 20), metal);
  foot.position.y = 0.06;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.08), metal);
  plate.position.set(0, 1.12, -0.06);
  const buttonMaterial = new THREE.MeshBasicMaterial({ color: 0xffb35c, toneMapped: false });
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 20).rotateX(Math.PI / 2), buttonMaterial);
  button.position.set(0, 1.08, -0.11);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.55),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }),
  );
  sign.position.set(0, 2.62, 0);
  sign.rotation.y = Math.PI;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffb35c, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.set(0, 1.08, -0.16);
  halo.scale.setScalar(0.35);
  group.add(pole, foot, plate, button, sign, halo);
  const colors: Record<StandState, string> = { idle: "#ffb35c", called: "#8fe4ff", docked: "#7dffb0" };
  const lines: Record<StandState, string> = { idle: "APPEL · BORNE 3-7", called: "TAXI EN APPROCHE", docked: "À QUAI · MONTEZ" };
  let state: StandState | null = null;
  const draw = (next: StandState) => {
    if (next === state) return;
    state = next;
    const c = canvas.getContext("2d")!;
    c.clearRect(0, 0, 512, 256);
    c.strokeStyle = c.fillStyle = c.shadowColor = colors[next];
    c.shadowBlur = 12;
    c.lineWidth = 5;
    c.strokeRect(12, 12, 488, 232);
    c.textAlign = "center";
    c.font = "bold 92px Arial, Helvetica, sans-serif";
    c.fillText("TAXI", 256, 120);
    c.font = "30px SFMono-Regular, Consolas, monospace";
    c.fillText(lines[next], 256, 190);
    texture.needsUpdate = true;
    buttonMaterial.color.set(colors[next]);
    halo.material.color.set(colors[next]);
  };
  draw("idle");
  // What a pointer can pick to call the taxi.
  const pickables = [pole, plate, button, sign];
  return {
    group,
    pickables,
    setState: draw,
    tick: (elapsed: number, reduced: boolean) => {
      halo.material.opacity = reduced ? 0.5 : 0.35 + Math.max(0, Math.sin(elapsed * (state === "called" ? 7 : 2.4))) * 0.45;
    },
  };
}
