import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { softBeam } from "../render/softBeam";

// The Senate rotunda: a vast drum lined with hundreds of delegation pods, a podium on a tall
// column at the centre under a shaft of light, a few pods adrift in the void. The visitor stands
// in the ORBITAL pod on the wall; it detaches and floats to the centre to take the floor. The
// hall lives far below the city and is only drawn while the visitor is inside.

const R = 66,
  FLOOR = -60,
  CEILING = 52;
export const HALL_ORIGIN = new THREE.Vector3(0, -4000, 0);

function nonIndexed(geometry: THREE.BufferGeometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.deleteAttribute("uv");
  return g;
}
// A delegation pod: a shallow open saucer with a real deck, its front at +Z (the centre of the hall).
const pts = (list: number[][]) => list.map(([r, y]) => new THREE.Vector2(r, y));
const HULL = pts([[0.02, -0.92], [0.6, -0.82], [1.25, -0.42], [1.72, 0.2], [1.98, 0.9], [2.1, 1.42]]);
const LIP = pts([[2.1, 1.42], [2.13, 1.5], [2.05, 1.56], [1.95, 1.5]]);
const WELL = pts([[1.95, 1.5], [1.88, 0.95], [1.78, 0.64], [1.7, 0.6]]);
const DECK_Y = 0.6;
function podGeometry(detail: number) {
  const hull = new THREE.LatheGeometry([...HULL, ...LIP.slice(1), ...WELL.slice(1)], detail);
  const deck = new THREE.CircleGeometry(1.72, detail);
  deck.rotateX(-Math.PI / 2);
  deck.translate(0, DECK_Y, 0);
  const arm = new THREE.BoxGeometry(0.5, 0.42, 2.6);
  arm.translate(0, 0.1, -2.6);
  return mergeGeometries([hull, deck, arm].map(nonIndexed));
}
// The deck the visitor looks down at: plates, a ring of studs and a worn walkway.
function deckTexture() {
  const size = 1024,
    canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#79808c";
  c.fillRect(0, 0, size, size);
  const shade = c.createRadialGradient(size / 2, size / 2, 40, size / 2, size / 2, size / 2);
  shade.addColorStop(0, "rgba(170,176,188,.5)");
  shade.addColorStop(1, "rgba(20,22,28,.3)");
  c.fillStyle = shade;
  c.fillRect(0, 0, size, size);
  c.translate(size / 2, size / 2);
  c.strokeStyle = "#2a2e36";
  c.lineWidth = 5;
  [0.28, 0.62, 0.9].forEach((r) => {
    c.beginPath();
    c.arc(0, 0, (r * size) / 2, 0, Math.PI * 2);
    c.stroke();
  });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2,
      x = Math.cos(a),
      y = Math.sin(a);
    c.beginPath();
    c.moveTo((x * 0.28 * size) / 2, (y * 0.28 * size) / 2);
    c.lineTo((x * 0.9 * size) / 2, (y * 0.9 * size) / 2);
    c.stroke();
  }
  c.fillStyle = "#c2c8d2";
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    c.beginPath();
    c.arc((Math.cos(a) * 0.86 * size) / 2, (Math.sin(a) * 0.86 * size) / 2, 4, 0, Math.PI * 2);
    c.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
// The console screen: the delegation's name, the speaking queue and a few live readouts.
function consoleScreen() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 420;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#07101a";
  c.fillRect(0, 0, 1024, 420);
  c.strokeStyle = "#2f6d92";
  c.lineWidth = 4;
  c.strokeRect(14, 14, 996, 392);
  c.fillStyle = "#d8eeff";
  c.font = "bold 66px SFMono-Regular, Consolas, monospace";
  c.textAlign = "center";
  c.fillText("DÉLÉGATION ORBITAL", 512, 96);
  c.fillStyle = "#ffbf73";
  c.font = "34px SFMono-Regular, Consolas, monospace";
  c.fillText("PAROLE ACCORDÉE", 512, 152);
  c.fillStyle = "#17364d";
  c.fillRect(60, 190, 904, 2);
  [0.8, 0.45, 0.65, 0.3, 0.9, 0.55].forEach((level, i) => {
    const y = 214 + i * 29;
    c.fillStyle = "#143044";
    c.fillRect(60, y, 620, 15);
    c.fillStyle = i === 0 ? "#ffbf73" : "#59b7e6";
    c.fillRect(60, y, 620 * level, 15);
  });
  c.fillStyle = "#7fd0f5";
  c.font = "30px SFMono-Regular, Consolas, monospace";
  c.textAlign = "left";
  ["QUORUM   OK", "CANAL    07", "SÉANCE   OUVERTE"].forEach((line, i) => c.fillText(line, 712, 240 + i * 56));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
function figureGeometry() {
  // Standing on the pod floor, 0.6 above its keel, behind a waist-high rim.
  const body = new THREE.CapsuleGeometry(0.32, 0.7, 3, 8);
  body.translate(0, 1.27, -0.3);
  const head = new THREE.SphereGeometry(0.2, 8, 6);
  head.translate(0, 1.95, -0.3);
  return mergeGeometries([body, head].map(nonIndexed));
}
function panelTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#2a2f38";
  c.fillRect(0, 0, 256, 256);
  c.strokeStyle = "#1a1d24";
  c.lineWidth = 4;
  for (let i = 0; i <= 256; i += 64) {
    c.beginPath();
    c.moveTo(i, 0);
    c.lineTo(i, 256);
    c.moveTo(0, i);
    c.lineTo(256, i);
    c.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(48, 14);
  return texture;
}

export function createSenateHall(glow: THREE.Texture, quality: number) {
  const group = new THREE.Group();
  group.name = "senate-hall";
  group.position.copy(HALL_ORIGIN);
  group.visible = false;
  let s = 2207;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const steel = new THREE.MeshStandardMaterial({ color: 0x858d99, roughness: 0.5, metalness: 0.3, emissive: 0x141a26, emissiveIntensity: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c313a, roughness: 0.55, metalness: 0.5 });
  const amber = new THREE.MeshBasicMaterial({ color: 0xffbf73, toneMapped: false });
  group.add(new THREE.HemisphereLight(0xaec2e2, 0x3a2a20, 1.9));
  const podiumLight = new THREE.PointLight(0xffc98a, 90, 70, 1.4);
  podiumLight.position.set(0, 4, 0);
  group.add(podiumLight);
  const fill = new THREE.PointLight(0x9fc4ff, 40, 140, 1.2);
  fill.position.set(0, 40, 0);
  group.add(fill);

  // The drum, floor and ceiling.
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R + 3.2, R + 3.2, CEILING - FLOOR + 10, 72, 1, true), new THREE.MeshStandardMaterial({ map: panelTexture(), color: 0xc4cad4, roughness: 0.72, metalness: 0.2, emissive: 0x161a24, side: THREE.BackSide }));
  wall.position.y = (CEILING + FLOOR) / 2;
  group.add(wall);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 3.2, 72), new THREE.MeshStandardMaterial({ color: 0x3a2524, roughness: 0.8, metalness: 0.15 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR;
  group.add(floor);
  [10, 22, 38].forEach((r) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.25, 6, 96), amber);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = FLOOR + 0.05;
    group.add(ring);
  });
  const ceiling = new THREE.Mesh(new THREE.SphereGeometry(R + 3.2, 72, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5c6470, roughness: 0.6, metalness: 0.4, side: THREE.BackSide }));
  ceiling.scale.y = 0.28;
  ceiling.position.y = CEILING;
  group.add(ceiling);

  // Pods: rings of them up the wall, each tilted towards the centre; the visitor's place is left open.
  const rows: number[] = [];
  for (let y = FLOOR + 8; y <= CEILING - 4; y += quality >= 2 ? 5.2 : 7.8) rows.push(y);
  const VISITOR = { y: 1.6, angle: 0 };
  const seats: { x: number; y: number; z: number; angle: number }[] = [];
  rows.forEach((y, row) => {
    const count = Math.floor((Math.PI * 2 * R) / 5.1);
    for (let i = 0; i < count; i++) {
      const angle = ((i + (row % 2) * 0.5) / count) * Math.PI * 2;
      // Nothing right beside or above the visitor: the pods there would fill the view.
      if (Math.abs(y - VISITOR.y) < 9 && Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) < 0.12) continue;
      seats.push({ x: Math.sin(angle) * R, y, z: Math.cos(angle) * R, angle });
    }
  });
  const pods = new THREE.InstancedMesh(podGeometry(quality >= 2 ? 12 : 8), steel, seats.length);
  const lamps = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.4, 0.26), new THREE.MeshBasicMaterial({ toneMapped: false }), seats.length);
  const figures = new THREE.InstancedMesh(figureGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.8 }), seats.length);
  const robes = [0x6a2f3a, 0x2f4a6a, 0x705a3a, 0x3a5a48, 0x5a3a6a, 0x8a7a64, 0x2a2a30];
  const dummy = new THREE.Object3D();
  const lampColors: THREE.Color[] = [];
  let seated = 0;
  seats.forEach((seat, i) => {
    dummy.position.set(seat.x, seat.y, seat.z);
    dummy.rotation.set(0, seat.angle + Math.PI, 0);
    dummy.updateMatrix();
    pods.setMatrixAt(i, dummy.matrix);
    if (rand() < 0.42) {
      figures.setMatrixAt(seated, dummy.matrix);
      figures.setColorAt(seated++, new THREE.Color(robes[Math.floor(rand() * robes.length)]));
    }
    dummy.position.set(seat.x - Math.sin(seat.angle) * 2.12, seat.y + 1.36, seat.z - Math.cos(seat.angle) * 2.12);
    dummy.updateMatrix();
    lamps.setMatrixAt(i, dummy.matrix);
    const color = new THREE.Color().setHSL(0.09 + rand() * 0.04, 0.6, rand() < 0.15 ? 0.15 : 0.62 + rand() * 0.2);
    lampColors.push(color.clone());
    lamps.setColorAt(i, color);
  });
  figures.count = seated;
  group.add(pods, lamps, figures);

  // The podium: a tall column, a ring platform with lit rail and lectern, a mast with a beacon.
  const podium = new THREE.Group();
  const column = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.8, -FLOOR - 4, 32), dark);
  column.position.y = (FLOOR - 4) / 2;
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 5.4, 1.4, 64), steel);
  deck.position.y = -4;
  const rail = new THREE.Mesh(new THREE.TorusGeometry(6.4, 0.12, 6, 96), amber);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = -2.4;
  const parapet = new THREE.Mesh(new THREE.CylinderGeometry(6.55, 6.55, 1.2, 64, 1, true), dark);
  parapet.position.y = -2.9;
  const lectern = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 0.8), steel);
  lectern.position.set(0, -2.7, 2.6);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 18, 12), dark);
  mast.position.set(0, 5.5, -2.2);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 15, 0.08), amber);
  strip.position.set(0.24, 5.5, -2.2);
  podium.add(column, deck, rail, parapet, lectern, mast, strip);
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xfff0d0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  beacon.position.set(0, 14.8, -2.2);
  beacon.scale.setScalar(3.2);
  podium.add(beacon);
  // Four delegates at the podium.
  [-2.2, -0.8, 0.9, 2.3].forEach((x, i) => {
    const figure = new THREE.Mesh(figureGeometry(), new THREE.MeshStandardMaterial({ color: robes[(i * 3) % robes.length], roughness: 0.8 }));
    figure.position.set(x, -3.9, -1.2 + Math.abs(x) * 0.3);
    podium.add(figure);
  });
  group.add(podium);
  // The shaft of light from the oculus down to the podium.
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 8.5, CEILING + 18 - 2, 32, 1, true),
    softBeam(new THREE.MeshBasicMaterial({ color: 0xcfe2ff, transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), 8),
  );
  shaft.position.y = (CEILING + 18 + 2) / 2;
  group.add(shaft);
  const oculus = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xdfeaff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  oculus.position.y = CEILING + 17;
  oculus.scale.setScalar(26);
  group.add(oculus);

  // Pods adrift in the hall, delegations on their way to speak.
  const drifters = Array.from({ length: 5 }, (_, i) => {
    const pod = new THREE.Group();
    pod.add(new THREE.Mesh(podGeometry(12), steel));
    const delegate = new THREE.Mesh(figureGeometry(), new THREE.MeshStandardMaterial({ color: robes[(i * 2 + 1) % robes.length], roughness: 0.8 }));
    pod.add(delegate);
    group.add(pod);
    return { pod, radius: 30 + i * 6, angle: 1.2 + i * 1.1, height: -20 + i * 9, speed: 0.025 + i * 0.006 };
  });

  // The visitor's pod: built for being looked at from inside. Pale hull, dark padded well, a deck
  // underfoot, a chrome rail with a lit strip, and a console with a live screen and a microphone.
  const visitor = new THREE.Group();
  const hullSkin = new THREE.MeshStandardMaterial({ color: 0xc6ccd4, roughness: 0.5, metalness: 0.28 });
  const wellSkin = new THREE.MeshStandardMaterial({ color: 0x565d6a, roughness: 0.82, metalness: 0.1, side: THREE.DoubleSide });
  const railSkin = new THREE.MeshStandardMaterial({ color: 0xdfe4ea, roughness: 0.24, metalness: 0.75 });
  const addTo = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0, tilt = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.x = tilt;
    parent.add(mesh);
    return mesh;
  };
  addTo(visitor, new THREE.LatheGeometry(HULL, 72), hullSkin);
  addTo(visitor, new THREE.LatheGeometry(WELL, 72), wellSkin);
  const deckTop = addTo(visitor, new THREE.CircleGeometry(1.72, 72), new THREE.MeshStandardMaterial({ map: deckTexture(), roughness: 0.72, metalness: 0.2 }), 0, DECK_Y, 0, -Math.PI / 2);
  deckTop.renderOrder = 1;
  addTo(visitor, new THREE.TorusGeometry(2.04, 0.075, 12, 96), railSkin, 0, 1.53, 0, Math.PI / 2);
  addTo(visitor, new THREE.TorusGeometry(1.9, 0.018, 6, 96), amber, 0, 1.42, 0, Math.PI / 2);
  addTo(visitor, new THREE.TorusGeometry(1.7, 0.02, 6, 96), amber, 0, DECK_Y + 0.02, 0, Math.PI / 2);
  // The console, on a post rising from the deck, leaning back towards the visitor.
  const desk = new THREE.Group();
  desk.position.set(0, 1.42, 1.32);
  desk.rotation.set(-0.72, Math.PI, 0, "YXZ");
  desk.scale.setScalar(0.84);
  addTo(desk, new THREE.BoxGeometry(1.5, 0.78, 0.09), dark);
  addTo(desk, new THREE.BoxGeometry(1.56, 0.84, 0.04), railSkin, 0, 0, -0.05);
  addTo(desk, new THREE.PlaneGeometry(1.36, 0.5), new THREE.MeshBasicMaterial({ map: consoleScreen(), toneMapped: false }), 0, 0.09, 0.05);
  // A row of keys under the screen.
  const keyLight = [0x4f97b8, 0xb98a50, 0x5fa77f, 0xb06a54];
  for (let i = 0; i < 4; i++) addTo(desk, new THREE.BoxGeometry(0.13, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: keyLight[i], toneMapped: false }), -0.24 + i * 0.16, -0.27, 0.05);
  visitor.add(desk);
  addTo(visitor, new THREE.CylinderGeometry(0.1, 0.17, 0.8, 16), dark, 0, 1.0, 1.42);
  const stalk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.62, 1.32, 1.22), new THREE.Vector3(0.62, 1.68, 1.16), new THREE.Vector3(0.48, 1.86, 0.95)]), 16, 0.012, 6), dark);
  visitor.add(stalk);
  addTo(visitor, new THREE.CapsuleGeometry(0.02, 0.05, 4, 10), dark, 0.48, 1.87, 0.93, 1.1);
  const visitorLight = new THREE.PointLight(0xffd2a0, 9, 7, 1.6);
  visitorLight.position.set(0, 2.6, 0);
  visitor.add(visitorLight);
  group.add(visitor);
  const home = new THREE.Vector3(Math.sin(VISITOR.angle) * R, VISITOR.y, Math.cos(VISITOR.angle) * R);
  const stage = new THREE.Vector3(0, 3.5, 17);
  const podPath = new THREE.CatmullRomCurve3([home, new THREE.Vector3(0, 6, 46), new THREE.Vector3(0, 5, 28), stage]);
  let podK = 0,
    podTarget = 0,
    vote = -1;
  const voteColor = new THREE.Color(0x7dffb0).multiplyScalar(1.6),
    shown = new THREE.Color();
  const placeVisitor = () => {
    podPath.getPointAt(podK, visitor.position);
    // Facing the podium the whole way.
    visitor.rotation.set(0, Math.atan2(-visitor.position.x, -visitor.position.z), 0);
  };
  placeVisitor();
  return {
    group,
    visitor,
    // Where the visitor's eyes are, in the pod.
    eye: () => {
      visitor.updateWorldMatrix(true, false);
      return new THREE.Vector3(0, 2.34, -0.55).applyMatrix4(visitor.matrixWorld);
    },
    podium: () => new THREE.Vector3(0, -1, 0).add(HALL_ORIGIN),
    setFloor: (out: boolean) => (podTarget = out ? 1 : 0),
    floorOut: () => podK > 0.98,
    vote: () => (vote = 0),
    tick: (dt: number, elapsed: number, reduced: boolean) => {
      const was = podK;
      podK = reduced ? podTarget : THREE.MathUtils.clamp(podK + Math.sign(podTarget - podK) * dt * 0.2, 0, 1);
      if (Math.abs(podTarget - podK) < 0.005) podK = podTarget;
      if (podK !== was || reduced) placeVisitor();
      visitor.position.y += reduced ? 0 : Math.sin(elapsed * 0.9) * 0.04;
      drifters.forEach((d) => {
        d.angle += reduced ? 0 : dt * d.speed;
        d.pod.position.set(Math.sin(d.angle) * d.radius, d.height + (reduced ? 0 : Math.sin(elapsed * 0.5 + d.radius) * 1.2), Math.cos(d.angle) * d.radius);
        d.pod.rotation.y = d.angle + Math.PI;
      });
      beacon.material.opacity = reduced ? 1 : 0.7 + Math.sin(elapsed * 2) * 0.3;
      // The vote: pods light up in a wave around the hall.
      if (vote >= 0) {
        vote += dt;
        const wave = reduced ? 9 : vote * 2.4;
        seats.forEach((seat, i) => {
          const reach = Math.abs(Math.atan2(Math.sin(seat.angle), Math.cos(seat.angle)));
          const k = THREE.MathUtils.clamp(wave - reach - (seat.y - FLOOR) / 60, 0, 1);
          shown.copy(lampColors[i]).lerp(voteColor, k);
          lamps.setColorAt(i, shown);
        });
        if (lamps.instanceColor) lamps.instanceColor.needsUpdate = true;
        if (vote > 9) vote = -2;
      }
    },
  };
}
export type SenateHall = ReturnType<typeof createSenateHall>;
