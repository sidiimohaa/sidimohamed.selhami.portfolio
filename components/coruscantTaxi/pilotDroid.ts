import * as THREE from "three";
import { bakePart, part, pipe, rounded } from "../tatooineCharacters";

type XYZ = [number, number, number];

// The air taxi's pilot: an old protocol droid in a worn bronze shell, retrained to drive, seated with
// both hands on the yoke. The passenger mostly sees it from behind, so the back of its head, its neck
// and its spine are as detailed as its face; it wears a chauffeur's cap with the taxi's checkered band.

function wornBronze() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#cdb48c";
  c.fillRect(0, 0, 256, 256);
  let seed = 327;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 900; i++) {
    c.fillStyle = i % 3 ? "rgba(84,68,50,.08)" : "rgba(255,240,214,.08)";
    c.fillRect(rand() * 256, rand() * 256, 1 + rand() * 14, 1 + rand() * 2);
  }
  for (let i = 0; i < 26; i++) {
    c.fillStyle = "rgba(60,48,36,.2)";
    c.beginPath();
    c.ellipse(rand() * 256, rand() * 256, 2 + rand() * 9, 1 + rand() * 5, rand() * 3, 0, Math.PI * 2);
    c.fill();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return map;
}

function checkerBand() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 32;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#e9a62b";
  c.fillRect(0, 0, 256, 32);
  c.fillStyle = "#14161a";
  for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) if ((x + y) % 2) c.fillRect(x * 16, y * 16, 16, 16);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.repeat.x = 2;
  return map;
}

// Lays a unit-height cylinder between two points; it is moved again every frame for the forearms.
const lay = (mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) => {
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.scale.y = a.distanceTo(b);
  mesh.quaternion.setFromUnitVectors(UP, DIRECTION.copy(b).sub(a).normalize());
};
const UP = new THREE.Vector3(0, 1, 0);
const DIRECTION = new THREE.Vector3();

/** Seated, facing +Z, the seat cushion at y = 0, with `grip` the centre of the yoke in this space. */
export function createPilotDroid(grip: THREE.Vector3) {
  const group = new THREE.Group();
  group.name = "pilot-droid";
  group.userData.character = true;
  const map = wornBronze();
  const bronze = new THREE.MeshStandardMaterial({ color: 0xffffff, map, metalness: 0.64, roughness: 0.36 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1a1a, metalness: 0.55, roughness: 0.58 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8e9297, metalness: 0.85, roughness: 0.34 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xa8562c, metalness: 0.8, roughness: 0.42 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x20242b, roughness: 0.82 });
  const box = (p: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material, at: XYZ, r = 0.012) => part(p, rounded(w, h, d, r), m, at);
  const rod = (p: THREE.Object3D, a: XYZ, b: XYZ, r1: number, r2: number, m: THREE.Material) => {
    const from = new THREE.Vector3(...a),
      to = new THREE.Vector3(...b);
    const mesh = part(p, new THREE.CylinderGeometry(r2, r1, from.distanceTo(to), 12), m);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(UP, to.clone().sub(from).normalize());
    return mesh;
  };

  // The pelvis on the seat, and the bare midriff of pipes and cables below the chest.
  const body = new THREE.Group();
  group.add(body);
  box(body, 0.27, 0.11, 0.2, bronze, [0, 0.055, 0], 0.035);
  part(body, new THREE.CylinderGeometry(0.075, 0.09, 0.15, 14), dark, [0, 0.17, 0]);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    pipe(body, [[Math.sin(a) * 0.1, 0.1, Math.cos(a) * 0.075], [Math.sin(a) * 0.082, 0.17, Math.cos(a) * 0.066], [Math.sin(a) * 0.1, 0.25, Math.cos(a) * 0.075]], 0.0075, i % 3 === 0 ? copper : i % 3 === 1 ? steel : dark);
  }
  // The chest: a rounded shell, narrower at the waist, its plates seamed.
  const chest = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), bronze);
  chest.scale.set(0.17, 0.155, 0.112);
  chest.position.set(0, 0.36, 0);
  body.add(chest);
  box(body, 0.17, 0.018, 0.01, dark, [0, 0.42, 0.108], 0.003);
  box(body, 0.012, 0.13, 0.01, dark, [0, 0.35, 0.112], 0.003);
  part(body, new THREE.CylinderGeometry(0.026, 0.026, 0.012, 16), steel, [0, 0.31, 0.112], [Math.PI / 2, 0, 0]);
  // Its back, which the passenger looks at all the way: a spine of plates, a vent, power cells, cables.
  for (let i = 0; i < 5; i++) box(body, 0.09 - i * 0.006, 0.032, 0.024, i % 2 ? steel : dark, [0, 0.27 + i * 0.038, -0.108 - Math.sin((i / 4) * Math.PI) * 0.012], 0.006);
  box(body, 0.2, 0.15, 0.03, dark, [0, 0.36, -0.092], 0.01);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) box(body, 0.05, 0.008, 0.012, steel, [side * 0.07, 0.31 + i * 0.03, -0.11], 0.002);
    part(body, new THREE.CylinderGeometry(0.022, 0.022, 0.1, 12), copper, [side * 0.128, 0.37, -0.086]);
    part(body, new THREE.CylinderGeometry(0.024, 0.024, 0.012, 12), steel, [side * 0.128, 0.42, -0.086]);
    pipe(body, [[side * 0.128, 0.42, -0.086], [side * 0.1, 0.47, -0.07], [side * 0.05, 0.525, -0.03]], 0.008, dark);
  }
  // Shoulders, and the collar the neck rises from.
  box(body, 0.31, 0.05, 0.13, bronze, [0, 0.475, 0], 0.024);
  part(body, new THREE.CylinderGeometry(0.075, 0.094, 0.05, 18), steel, [0, 0.51, 0]);
  bakePart(body);

  // Status lamps set into the back.
  const lampOn = new THREE.MeshBasicMaterial({ color: 0x57ff9a, toneMapped: false });
  const lampAmber = new THREE.MeshBasicMaterial({ color: 0xffb35c, toneMapped: false });
  part(group, new THREE.SphereGeometry(0.009, 8, 6), lampOn, [-0.04, 0.42, -0.112]);
  part(group, new THREE.SphereGeometry(0.009, 8, 6), lampAmber, [0.04, 0.42, -0.112]);

  // A ribbed neck with cables that can twist as far as the head needs to turn.
  const neck = new THREE.Group();
  group.add(neck);
  part(neck, new THREE.CylinderGeometry(0.036, 0.042, 0.13, 14), dark, [0, 0.58, 0]);
  for (let i = 0; i < 4; i++) part(neck, new THREE.TorusGeometry(0.041, 0.006, 6, 18), steel, [0, 0.535 + i * 0.03, 0], [Math.PI / 2, 0, 0]);
  bakePart(neck);

  // The head: a smooth oval with a brow, deep sockets, big round eyes and a slot of a mouth.
  const head = new THREE.Group();
  head.name = "pilot-droid-head";
  head.position.set(0, 0.66, 0.012);
  group.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 30, 22), bronze);
  skull.scale.set(0.112, 0.125, 0.12);
  skull.position.y = 0.03;
  head.add(skull);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 14), bronze);
  jaw.scale.set(0.082, 0.07, 0.092);
  jaw.position.set(0, -0.05, 0.014);
  head.add(jaw);
  pipe(head, [[-0.09, 0.052, 0.078], [-0.05, 0.066, 0.106], [0, 0.07, 0.116], [0.05, 0.066, 0.106], [0.09, 0.052, 0.078]], 0.012, bronze);
  for (const side of [-1, 1]) {
    part(head, new THREE.SphereGeometry(0.03, 18, 14), dark, [side * 0.046, 0.028, 0.094]).scale.z = 0.62;
    part(head, new THREE.TorusGeometry(0.026, 0.005, 8, 22), steel, [side * 0.046, 0.028, 0.112]);
    // The audio sensors, one on each side: a stepped disc with a dark centre.
    part(head, new THREE.CylinderGeometry(0.036, 0.04, 0.016, 18), bronze, [side * 0.112, 0.022, -0.002], [0, 0, Math.PI / 2]);
    part(head, new THREE.CylinderGeometry(0.022, 0.022, 0.018, 16), dark, [side * 0.118, 0.022, -0.002], [0, 0, Math.PI / 2]);
  }
  box(head, 0.022, 0.05, 0.03, bronze, [0, -0.012, 0.117], 0.008);
  box(head, 0.07, 0.016, 0.01, dark, [0, -0.062, 0.1], 0.004);
  for (let i = 0; i < 5; i++) box(head, 0.004, 0.012, 0.012, steel, [-0.022 + i * 0.011, -0.062, 0.104], 0.001);
  // The back of the skull: a seamed service panel with a small antenna.
  box(head, 0.09, 0.075, 0.012, dark, [0, 0.03, -0.115], 0.006);
  for (let i = 0; i < 3; i++) box(head, 0.066, 0.006, 0.006, steel, [0, 0.012 + i * 0.018, -0.123], 0.001);
  part(head, new THREE.CylinderGeometry(0.003, 0.005, 0.12, 6), steel, [0.084, 0.13, -0.05], [-0.25, 0, -0.22]);
  // The chauffeur's cap, in the colours of the line.
  const capCloth = cloth;
  part(head, new THREE.CylinderGeometry(0.104, 0.1, 0.05, 28), capCloth, [0, 0.122, -0.004]);
  part(head, new THREE.CylinderGeometry(0.128, 0.105, 0.03, 28), capCloth, [0, 0.158, -0.012]);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.102, 0.026, 28, 1, true), new THREE.MeshStandardMaterial({ map: checkerBand(), roughness: 0.6, metalness: 0.2 }));
  band.position.set(0, 0.118, -0.004);
  head.add(band);
  const peak = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.112, 0.011, 24, 1, false, -0.95, 1.9), dark);
  peak.position.set(0, 0.096, 0.024);
  head.add(peak);
  bakePart(head);
  // Glowing lenses proud of their sockets, each with the dark point of its aperture.
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(1, 0.42, 0.08), toneMapped: false });
  const eyes = [-1, 1].map((side) => {
    const eye = part(head, new THREE.SphereGeometry(0.018, 16, 12), eyeMaterial, [side * 0.046, 0.028, 0.114]);
    eye.scale.z = 0.5;
    part(eye, new THREE.SphereGeometry(0.004, 8, 6), dark, [0, 0, 0.0175]);
    return eye;
  });

  // Legs: thighs along the seat, shins down to the floor of the cabin.
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    group.add(leg);
    part(leg, new THREE.SphereGeometry(0.056, 14, 10), dark, [side * 0.09, 0.05, 0.04]);
    rod(leg, [side * 0.09, 0.05, 0.04], [side * 0.1, 0.055, 0.31], 0.052, 0.042, bronze);
    part(leg, new THREE.SphereGeometry(0.044, 14, 10), steel, [side * 0.1, 0.055, 0.32]);
    rod(leg, [side * 0.1, 0.05, 0.325], [side * 0.1, -0.27, 0.33], 0.04, 0.03, bronze);
    box(leg, 0.075, 0.042, 0.15, dark, [side * 0.1, -0.31, 0.37], 0.016);
    bakePart(leg);
  }

  // The arms: fixed from the shoulder to the elbow, and the forearm re-laid to wherever the hand has
  // gone as the yoke turns.
  const upperGeometry = new THREE.CylinderGeometry(0.03, 0.033, 1, 12);
  const foreGeometry = new THREE.CylinderGeometry(0.03, 0.024, 1, 12);
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Vector3(side * 0.19, 0.47, 0);
    const elbow = new THREE.Vector3(side * 0.245, 0.26, 0.11);
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.047, 14, 10), bronze);
    joint.position.copy(shoulder);
    const upper = new THREE.Mesh(upperGeometry, bronze);
    lay(upper, shoulder, elbow);
    const elbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), dark);
    elbowBall.position.copy(elbow);
    const fore = new THREE.Mesh(foreGeometry, bronze);
    const hand = new THREE.Group();
    const palm = new THREE.Mesh(rounded(0.05, 0.03, 0.058, 0.012), dark);
    hand.add(palm);
    for (let i = 0; i < 3; i++) {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.0065, 0.024, 3, 6), steel);
      finger.position.set(-0.016 + i * 0.016, -0.016, 0.03);
      finger.rotation.x = 1.1;
      hand.add(finger);
    }
    group.add(joint, upper, elbowBall, fore, hand);
    return { side, elbow, fore, hand };
  });
  const handAt = new THREE.Vector3();
  const setHands = (steer: number) => {
    arms.forEach(({ side, elbow, fore, hand }) => {
      const angle = steer * 0.55 + (side > 0 ? 0 : Math.PI);
      handAt.set(grip.x + Math.cos(angle) * 0.15, grip.y + Math.sin(angle) * 0.15, grip.z - 0.015);
      lay(fore, elbow, handAt);
      hand.position.copy(handAt);
      hand.rotation.z = steer * 0.55;
    });
  };
  setHands(0);
  let steerNow = 0;
  return {
    group,
    head,
    // talking: 0 to 1; steer: -1 to 1, how far the yoke is over. Returns the yoke's own angle.
    tick(time: number, still: boolean, talking: number, steer: number) {
      steerNow = still ? 0 : THREE.MathUtils.lerp(steerNow, steer, 0.08);
      setHands(steerNow);
      const flicker = !still && talking > 0.3 ? 0.72 + Math.abs(Math.sin(time * 15)) * 0.28 : 0.92;
      eyeMaterial.color.setRGB(flicker, flicker * 0.42, flicker * 0.08);
      eyes.forEach((eye) => (eye.scale.x = eye.scale.y = 1 + talking * 0.12));
      // The lamps on its back, going about their business.
      lampOn.color.setHex(still || Math.sin(time * 1.3) > -0.6 ? 0x57ff9a : 0x123a22);
      lampAmber.color.setHex(still || Math.sin(time * 3.1 + 1) > 0.2 ? 0xffb35c : 0x3a260f);
      return steerNow * 0.55;
    },
  };
}
