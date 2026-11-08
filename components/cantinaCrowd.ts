import * as THREE from "three";
import { glowTexture } from "./landingKit";
import { bakePart, part, pipe, rounded } from "./tatooineCharacters";
import { createSeatedMandalorian } from "./mandalorianModel";
import { createSeatedGrogu } from "./groguModel";
import { createCantinaTableActions } from "./cantinaTableActions";

// The cantina's regulars, all placed in the district's (u, y, v) frame, facing +v by default.
// Each is of a species of the galaxy, recognisable by its head and its colouring: Bith (dome),
// Rodian (snout), Twi'lek (lekku), Duros (fins) and the human bartender.
export type Head = "dome" | "snout" | "lekku" | "fins" | "human";
const LEKKU_TONES = [0x5b8fc4, 0x79a85f, 0xb5544a];
// The colour of a species' skin; only Twi'leks and humans vary from one to the next.
export function skinOf(head: Head, index: number, fallback: number) {
  if (head === "dome") return 0xe2c3a6;
  if (head === "snout") return 0x5e8a47;
  if (head === "fins") return 0x5b8c8e;
  if (head === "lekku") return LEKKU_TONES[index % LEKKU_TONES.length];
  return fallback;
}
// Arms are jointed at the shoulder and at the elbow; `rest` is how they hang when nothing is done.
type Figure = { root: THREE.Group; head: THREE.Group; arms: THREE.Group[]; elbows: THREE.Group[]; rest: { shoulder: number; elbow: number } };
const BEAT = 132 / 60;

/** A robed figure of one of the galaxy's species, seated when `seat` is given, standing otherwise. */
export function createRobedFigure(options: {
  head: Head;
  robe: number;
  skin: number;
  seat?: number;
  height?: number;
}): Figure {
  const root = new THREE.Group();
  root.name = `cantina-patron-${options.head}`;
  root.userData.character = true;
  const robe = new THREE.MeshStandardMaterial({ color: options.robe, roughness: 0.94 });
  robe.userData.surfaceKind = "cloth";
  const skin = new THREE.MeshStandardMaterial({ color: options.skin, roughness: 0.72 });
  skin.userData.surfaceKind = "skin";
  const crease = new THREE.MeshStandardMaterial({ color: skin.color.clone().multiplyScalar(0.67), roughness: 0.85 });
  crease.userData.surfaceKind = "skin";
  const dark = new THREE.MeshStandardMaterial({ color: 0x14110f, roughness: 0.24 });
  dark.userData.skipSurfaceDetail = true;
  const leather = new THREE.MeshStandardMaterial({ color: 0x42372b, roughness: 0.8 });
  leather.userData.surfaceKind = "leather";
  const ball = (parent: THREE.Group, at: [number, number, number], size: [number, number, number], material: THREE.Material) => {
    const mesh = part(parent, new THREE.SphereGeometry(1, 18, 12), material, at);
    mesh.scale.set(...size);
    return mesh;
  };
  const seated = options.seat !== undefined;
  const height = options.height ?? 1.75;
  const shoulder = seated ? (options.seat ?? 0.75) + 0.62 : height * 0.78;
  const body = new THREE.Group();
  root.add(body);
  const robeHeight = seated ? 0.62 : shoulder;
  const robeBase = seated ? (options.seat ?? 0.75) : 0;
  const cloth = new THREE.CylinderGeometry(0.19, seated ? 0.25 : 0.32, robeHeight, 24, 5);
  const positions = cloth.getAttribute("position");
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index), y = positions.getY(index), z = positions.getZ(index);
    const hem = 0.5 - y / robeHeight;
    const fold = 1 + Math.sin(Math.atan2(x, z) * 11 + hem * 0.7) * (0.014 + hem * 0.035);
    positions.setXYZ(index, x * fold, y, z * fold);
  }
  cloth.computeVertexNormals();
  part(body, cloth, robe, [0, robeBase + robeHeight / 2, 0]);
  if (seated) {
    const hip = options.seat ?? 0.75;
    for (const side of [-1, 1]) {
      part(body, rounded(0.15, 0.14, 0.44, 0.05), robe, [side * 0.11, hip + 0.05, 0.18]);
      part(body, new THREE.CylinderGeometry(0.065, 0.07, hip - 0.05, 12), robe, [side * 0.11, (hip - 0.05) / 2, 0.38]);
      part(body, rounded(0.13, 0.085, 0.24, 0.025), leather, [side * 0.11, 0.045, 0.43]);
    }
  } else {
    for (const side of [-1, 1]) part(body, rounded(0.14, 0.09, 0.24, 0.025), leather, [side * 0.13, 0.045, 0.1]);
  }
  ball(body, [0, shoulder, 0], [0.25, 0.12, 0.195], robe);
  part(body, new THREE.CylinderGeometry(0.055, 0.07, 0.13, 14), skin, [0, shoulder + 0.1, 0]);
  // The robe's radius at a height, to lay things on its surface.
  const bottom = seated ? 0.25 : 0.32;
  const radiusAt = (y: number) => bottom + (0.19 - bottom) * THREE.MathUtils.clamp((y - robeBase) / robeHeight, 0, 1);
  // A rolled cowl round the neck, and the robe's front opening down from it, a shade darker.
  const seam = new THREE.MeshStandardMaterial({ color: robe.color.clone().multiplyScalar(0.55), roughness: 0.95 });
  part(body, new THREE.TorusGeometry(0.1, 0.035, 8, 20), robe, [0, shoulder + 0.045, 0.01], [Math.PI / 2, 0, 0]);
  const opening = robeBase + robeHeight * 0.55;
  pipe(body, [[0.02, shoulder - 0.02, 0.19], [0.03, (shoulder + opening) / 2, radiusAt((shoulder + opening) / 2) + 0.004], [0.035, robeBase + 0.04, radiusAt(robeBase) + 0.004]], 0.006, seam);
  // A belt with its buckle and pouches, and a sash across the chest.
  const belt = robeBase + (seated ? 0.16 : robeHeight * 0.52);
  part(body, new THREE.TorusGeometry(radiusAt(belt) + 0.008, 0.022, 6, 28), leather, [0, belt, 0], [Math.PI / 2, 0, 0]);
  part(body, rounded(0.065, 0.05, 0.02, 0.008), new THREE.MeshStandardMaterial({ color: 0x9b8458, metalness: 0.7, roughness: 0.4 }), [0, belt, radiusAt(belt) + 0.025]);
  for (const side of [-1, 1]) part(body, rounded(0.07, 0.08, 0.04, 0.012), leather, [side * 0.15, belt - 0.05, radiusAt(belt) - 0.03], [0, side * 0.6, 0]);
  pipe(body, [[-0.16, shoulder + 0.02, 0.12], [-0.05, (shoulder + belt) / 2 + 0.04, radiusAt((shoulder + belt) / 2) + 0.012], [0.13, belt + 0.02, radiusAt(belt) + 0.01]], 0.018, leather);
  bakePart(body);
  // Each arm: one continuous sleeve, jointed at the shoulder and the elbow with balls of the same
  // width as the sleeve so that no seam shows, then the hand. Held a little away from the robe, bent
  // at the elbow, hands forward.
  const rest = seated ? { shoulder: -0.3, elbow: -1.15 } : { shoulder: -0.12, elbow: -0.85 };
  const elbows: THREE.Group[] = [];
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.255, shoulder - 0.03, 0);
    arm.rotation.set(rest.shoulder, 0, side * 0.08);
    const upper = new THREE.Group();
    arm.add(upper);
    ball(upper, [0, -0.01, 0], [0.072, 0.075, 0.072], robe);
    part(upper, new THREE.CylinderGeometry(0.072, 0.063, 0.28, 14), robe, [0, -0.14, 0]);
    bakePart(upper);
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.28, 0);
    // Bent forward first, then turned in, so the hands come together in front.
    elbow.rotation.order = "YXZ";
    elbow.rotation.set(rest.elbow, -side * (seated ? 0.5 : 0.35), 0);
    arm.add(elbow);
    ball(elbow, [0, 0, 0], [0.063, 0.063, 0.063], robe);
    part(elbow, new THREE.CylinderGeometry(0.063, 0.056, 0.24, 14), robe, [0, -0.12, 0]);
    part(elbow, new THREE.CylinderGeometry(0.03, 0.034, 0.05, 10), skin, [0, -0.26, 0]);
    // The hand, palm towards the body, fingers loosely curled.
    ball(elbow, [0, -0.3, 0.004], [0.04, 0.045, 0.022], skin);
    for (let finger = 0; finger < 4; finger++) {
      const x = -0.026 + finger * 0.017;
      const length = finger === 0 || finger === 3 ? 0.04 : 0.05;
      ball(elbow, [x, -0.34 - length / 4, 0.01], [0.009, length / 2, 0.01], skin);
      ball(elbow, [x, -0.355 - length / 2, 0.024], [0.008, 0.012, 0.011], skin);
    }
    ball(elbow, [-side * 0.038, -0.31, 0.02], [0.013, 0.026, 0.013], skin).rotation.z = -side * 0.55;
    bakePart(elbow);
    elbows.push(elbow);
    root.add(arm);
    return arm;
  });
  const head = new THREE.Group();
  head.position.y = shoulder + 0.2;
  root.add(head);
  const eyeShine = new THREE.MeshStandardMaterial({ color: 0x0b0a0a, roughness: 0.12, metalness: 0.1 });
  eyeShine.userData.skipSurfaceDetail = true;
  if (options.head === "dome") {
    // Bith: a pale, towering cranium folded into lobes, great black eyes, no nose, and the folds of
    // skin over a small puckered mouth.
    ball(head, [0, 0.12, -0.035], [0.17, 0.25, 0.19], skin);
    for (const side of [-1, 1]) ball(head, [side * 0.085, 0.16, -0.07], [0.11, 0.17, 0.15], skin);
    ball(head, [0, 0.2, -0.13], [0.12, 0.16, 0.1], skin);
    for (let fold = 0; fold < 4; fold++) {
      const x = -0.075 + fold * 0.05;
      pipe(head, [[x, 0.1, 0.12], [x * 1.1, 0.3, 0.02], [x * 1.15, 0.32, -0.1], [x, 0.2, -0.2]], 0.006, crease);
    }
    ball(head, [0, -0.05, 0.06], [0.12, 0.11, 0.11], skin);
    for (const side of [-1, 1]) {
      ball(head, [side * 0.066, 0.015, 0.128], [0.055, 0.038, 0.03], crease).rotation.z = side * 0.4;
      ball(head, [side * 0.066, 0.015, 0.145], [0.047, 0.031, 0.022], eyeShine).rotation.z = side * 0.4;
      pipe(head, [[side * 0.03, -0.03, 0.155], [side * 0.075, -0.05, 0.14], [side * 0.1, -0.09, 0.105]], 0.006, crease);
      pipe(head, [[side * 0.02, -0.065, 0.16], [side * 0.06, -0.085, 0.148], [side * 0.085, -0.115, 0.115]], 0.005, crease);
    }
    part(head, new THREE.TorusGeometry(0.018, 0.009, 6, 14), crease, [0, -0.115, 0.152]);
    ball(head, [0, -0.115, 0.153], [0.011, 0.011, 0.006], dark);
  } else if (options.head === "snout") {
    // Rodian: green and spined, huge dark faceted eyes, a tapering snout, small antennae.
    ball(head, [0, 0.04, -0.02], [0.13, 0.15, 0.13], skin);
    const snout = part(head, new THREE.CylinderGeometry(0.03, 0.062, 0.14, 16), skin, [0, -0.07, 0.13], [1.25, 0, 0]);
    snout.scale.x = 0.9;
    part(head, new THREE.TorusGeometry(0.024, 0.007, 6, 14), crease, [0, -0.095, 0.2], [0.3, 0, 0]);
    ball(head, [0, -0.095, 0.202], [0.017, 0.017, 0.006], dark);
    for (const side of [-1, 1]) {
      ball(head, [side * 0.085, 0.055, 0.08], [0.066, 0.07, 0.055], crease);
      ball(head, [side * 0.088, 0.056, 0.098], [0.058, 0.063, 0.046], eyeShine);
      ball(head, [side * 0.06, -0.06, 0.07], [0.04, 0.035, 0.045], skin);
      part(head, new THREE.ConeGeometry(0.025, 0.07, 8), skin, [side * 0.13, 0.03, -0.03], [0, 0, -side * 1.2]);
      pipe(head, [[side * 0.04, 0.17, -0.01], [side * 0.05, 0.22, -0.02], [side * 0.065, 0.245, -0.03]], 0.006, skin);
      ball(head, [side * 0.066, 0.247, -0.03], [0.012, 0.012, 0.012], crease);
    }
    for (let spine = 0; spine < 6; spine++) {
      const angle = 0.15 + (spine / 5) * 1.6;
      part(head, new THREE.ConeGeometry(0.014, 0.05, 6), crease, [0, 0.04 + 0.15 * Math.cos(angle), -0.02 - 0.13 * Math.sin(angle)], [-angle, 0, 0]);
    }
  } else if (options.head === "lekku") {
    // Twi'lek: a fine face, a leather band across the brow, and the two head-tails falling from the
    // back of the skull over the shoulders.
    ball(head, [0, 0.03, -0.01], [0.12, 0.15, 0.125], skin);
    ball(head, [0, -0.065, 0.035], [0.092, 0.075, 0.09], skin);
    ball(head, [0, 0.07, -0.09], [0.11, 0.12, 0.1], skin);
    for (const side of [-1, 1]) {
      ball(head, [side * 0.045, 0.02, 0.105], [0.026, 0.016, 0.012], new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.4 }));
      ball(head, [side * 0.045, 0.02, 0.114], [0.011, 0.012, 0.005], dark);
      pipe(head, [[side * 0.02, 0.05, 0.112], [side * 0.045, 0.058, 0.113], [side * 0.072, 0.048, 0.104]], 0.006, crease);
      part(head, new THREE.ConeGeometry(0.02, 0.05, 8), skin, [side * 0.122, 0.01, -0.01], [0, 0, -side * 1.3]);
      pipe(head, [[side * 0.045, 0.1, -0.12], [side * 0.09, -0.02, -0.16], [side * 0.13, -0.2, -0.1], [side * 0.15, -0.38, 0.02]], 0.042, skin);
      pipe(head, [[side * 0.15, -0.37, 0.015], [side * 0.152, -0.5, 0.08], [side * 0.14, -0.58, 0.12]], 0.028, skin);
      ball(head, [side * 0.14, -0.585, 0.122], [0.026, 0.03, 0.026], skin);
      for (let ring = 0; ring < 3; ring++) part(head, new THREE.TorusGeometry(0.045, 0.006, 5, 14), crease, [side * (0.105 + ring * 0.013), -0.07 - ring * 0.08, -0.15 + ring * 0.03], [Math.PI / 2 + 0.5, side * 0.3, 0]);
    }
    ball(head, [0, -0.008, 0.124], [0.016, 0.03, 0.017], skin);
    pipe(head, [[-0.03, -0.075, 0.113], [0, -0.082, 0.124], [0.03, -0.075, 0.113]], 0.006, crease);
    part(head, new THREE.TorusGeometry(0.122, 0.014, 6, 28), leather, [0, 0.085, 0], [Math.PI / 2 - 0.25, 0, 0]);
    part(head, rounded(0.035, 0.03, 0.012, 0.006), new THREE.MeshStandardMaterial({ color: 0x9b8458, metalness: 0.7, roughness: 0.4 }), [0, 0.11, 0.122]);
  } else if (options.head === "human") {
    ball(head, [0, .01, 0], [.128, .16, .116], skin);
    ball(head, [0, -.08, .035], [.103, .075, .092], skin);
    for (const side of [-1, 1]) {
      ball(head, [side * .126, .004, -.005], [.022, .043, .018], skin);
      ball(head, [side * .047, .025, .108], [.027, .009, .013], crease);
      ball(head, [side * .047, .024, .118], [.012, .007, .005], dark);
      pipe(head, [[side*.025,.051,.108],[side*.047,.059,.109],[side*.072,.047,.101]], .008, leather);
    }
    ball(head, [0, -.012, .121], [.023, .046, .03], skin);
    pipe(head, [[-.035,-.074,.116],[0,-.078,.129],[.035,-.074,.116]], .004, crease);
    ball(head, [0, .085, -.032], [.137, .104, .112], leather);
  } else {
    // Duros: a tall, smooth, blue-green head, great red eyes with slit pupils, no nose but two
    // slits, a lipless mouth, and the wide flat-brimmed hat of the spacers.
    ball(head, [0, .06, -.015], [.13, .2, .14], skin);
    ball(head, [0, -.08, .045], [.085, .075, .085], skin);
    const eye = new THREE.MeshStandardMaterial({ color: 0xb2382e, roughness: .25 });
    eye.userData.skipSurfaceDetail = true;
    for (const side of [-1, 1]) {
      ball(head, [side*.064,.03,.112], [.048,.034,.025], crease).rotation.z = side*.2;
      ball(head, [side*.064,.03,.127], [.04,.027,.017], eye).rotation.z = side*.2;
      ball(head, [side*.064,.03,.142], [.007,.022,.004], dark);
      ball(head, [side*.013,-.045,.127], [.005,.012,.004], dark);
    }
    pipe(head, [[-.035,-.1,.115],[0,-.104,.126],[.035,-.1,.115]], .003, crease);
    part(head, new THREE.CylinderGeometry(.24, .24, .014, 32), leather, [0, .205, -.01], [-.08, 0, 0]);
    part(head, new THREE.CylinderGeometry(.13, .14, .085, 28), leather, [0, .25, -.015], [-.08, 0, 0]);
    part(head, new THREE.TorusGeometry(.137, .009, 6, 28), dark, [0, .225, -.015], [Math.PI / 2 - .08, 0, 0]);
  }
  bakePart(head);
  return { root, head, arms, elbows, rest };
}

export function createCantinaCrowd() {
  const group = new THREE.Group();
  const circles: { u: number; v: number; r: number }[] = [];
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.75, metalness: 0.2 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xa7733c, roughness: 0.35, metalness: 0.8 });
  const stage = new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: 0.85 });
  const keys = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  const palette = [
    { robe: 0x8a4a2c, skin: 0x6f8a56 },
    { robe: 0x5d4a3a, skin: 0xb8956f },
    { robe: 0x9b6a3f, skin: 0x7c9168 },
    { robe: 0x4d4436, skin: 0xa98060 },
    { robe: 0x7a3f2c, skin: 0x8f9a72 },
  ];
  const heads: Head[] = ["dome", "snout", "lekku", "fins"];

  // Stools round the island bar, most of them taken; the bartender works its far side.
  type Regular = Figure & { phase: number; lift: number };
  const regulars: Regular[] = [];
  const stools: [number, number][] = [
    [-12.35, 58.6],
    [-12.35, 60],
    [-12.35, 61.4],
    [-12.35, 62.8],
    [-12.35, 64.2],
    [-12.35, 65.6],
    [-15.6, 57.3],
    [-13.9, 57.25],
    [-15.6, 66.7],
    [-13.9, 66.75],
  ];
  stools.forEach(([u, v], index) => {
    // This empty stool's place at the counter is where Luke stands.
    if (index === 3) return;
    part(group, new THREE.CylinderGeometry(0.2, 0.2, 0.07, 14), wood, [u, 0.74, v]);
    part(group, new THREE.CylinderGeometry(0.035, 0.05, 0.72, 8), brass, [u, 0.36, v]);
    part(group, new THREE.TorusGeometry(0.15, 0.015, 6, 14), brass, [u, 0.28, v], [Math.PI / 2, 0, 0]);
    circles.push({ u, v, r: 0.3 });
    if (index % 4 === 3) return;
    const look = palette[index % palette.length];
    const species = heads[index % heads.length];
    const regular = createRobedFigure({ head: species, robe: look.robe, skin: skinOf(species, index, look.skin), seat: 0.78 });
    // Turn to face the bar's spine.
    const target = new THREE.Vector2(-14.7, THREE.MathUtils.clamp(v, 59.25, 64.75));
    regular.root.position.set(u, 0, v);
    regular.root.rotation.y = Math.atan2(target.x - u, target.y - v);
    group.add(regular.root);
    regulars.push({ ...regular, phase: index * 1.7, lift: index % 2 });
  });

  // Patrons in the booths and at the tables by the door.
  (
    [
      [-20.55, 55.85, 0],
      [-20.55, 63.55, Math.PI],
      [-20.55, 67.05, 0],
      [-8.3, 68.4, Math.PI],
    ] as const
  ).forEach(([u, v, yaw], index) => {
    const look = palette[(index + 2) % palette.length];
    const species = heads[(index + 1) % heads.length];
    const patron = createRobedFigure({ head: species, robe: look.robe, skin: skinOf(species, index + 1, look.skin), seat: 0.55 });
    patron.root.position.set(u, 0, v);
    patron.root.rotation.y = yaw;
    group.add(patron.root);
    regulars.push({ ...patron, phase: index * 2.3 + 1, lift: index % 2 });
  });

  // The empty north banquette, opposite the green regular in the rust-colored robe.
  const duo=new THREE.Group();duo.name="cantina-mandalorian-grogu";
  const mandalorian=createSeatedMandalorian(.55),grogu=createSeatedGrogu(.55);
  mandalorian.group.position.set(-8.52,0,66.2);
  grogu.group.position.set(-7.94,0,66.2);
  duo.add(mandalorian.group,grogu.group);group.add(duo);
  const tableActions=createCantinaTableActions(grogu);group.add(tableActions.group);

  // A few tall figures standing about, like the ones lingering by the bar.
  (
    [
      [-10.5, 59.2, -2.2],
      [-10.8, 65.5, -1],
      [-18.6, 59.6, 1.2],
    ] as const
  ).forEach(([u, v, yaw], index) => {
    const look = palette[(index + 4) % palette.length];
    const species = heads[(index + 2) % heads.length];
    const stander = createRobedFigure({ head: species, robe: look.robe, skin: skinOf(species, index + 2, look.skin), height: 2.05 });
    stander.root.position.set(u, 0, v);
    stander.root.rotation.y = yaw;
    group.add(stander.root);
    circles.push({ u, v, r: 0.4 });
    regulars.push({ ...stander, phase: index * 3.1 + 0.5, lift: 0 });
  });

  // The bartender paces behind the far side of the counter, stopping to wipe and pour.
  const bartender = createRobedFigure({ head: "human", robe: 0x3d3229, skin: 0xb19374, height: 1.8 });
  const rag = part(bartender.elbows[1], rounded(0.12, 0.03, 0.1, 0.01), new THREE.MeshStandardMaterial({ color: 0xcfc3a5 }), [0, -0.36, 0.03]);
  rag.visible = true;
  group.add(bartender.root);
  const bartenderSpot = { u: -16.85, v: 62, r: 0.35 };

  // The band on a low stage at the north end, playing in time.
  part(group, rounded(3, 0.32, 2.3, 0.08), stage, [-11.2, 0.16, 69.45]);
  part(group, new THREE.TorusGeometry(1.5, 0.12, 8, 24, Math.PI), wood, [-11.2, 0.3, 70.5], [0, 0, 0]);
  circles.push({ u: -11.9, v: 69.4, r: 1 }, { u: -10.5, v: 69.4, r: 1 });
  type Player = Figure & { instrument: THREE.Group; style: "horn" | "drum" | "keys" };
  const players: Player[] = (
    [
      [-12.35, 69.7, "horn"],
      [-11.55, 69.25, "horn"],
      [-10.7, 69.7, "keys"],
      [-9.95, 69.35, "drum"],
    ] as const
  ).map(([u, v, style], index) => {
    const player = createRobedFigure({ head: "dome", robe: [0x3b3a36, 0x4b3d30, 0x37342e, 0x45392c][index], skin: skinOf("dome", index, 0), height: 1.7 });
    player.root.position.set(u, 0.32, v);
    player.root.rotation.y = Math.PI;
    const instrument = new THREE.Group();
    if (style === "horn") {
      part(instrument, new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), brass, [0, 0, 0.2], [Math.PI / 2 - 0.4, 0, 0]);
      part(instrument, new THREE.ConeGeometry(0.09, 0.16, 14, 1, true), brass, [0, -0.11, 0.45], [-Math.PI / 2 - 0.4, 0, 0]);
      instrument.position.set(0, 1.25, 0.05);
    } else if (style === "keys") {
      part(instrument, rounded(0.7, 0.08, 0.28, 0.02), wood, [0, 0, 0]);
      part(instrument, new THREE.BoxGeometry(0.6, 0.015, 0.1), keys, [0, 0.048, 0.05]);
      part(instrument, new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6), brass, [0, -0.4, 0]);
      instrument.position.set(0, 0.95, 0.38);
    } else {
      for (const side of [-1, 1])
        part(instrument, new THREE.CylinderGeometry(0.16, 0.14, 0.36, 16), wood, [side * 0.2, 0, 0]);
      instrument.position.set(0, 0.7, 0.38);
    }
    player.root.add(instrument);
    group.add(player.root);
    return { ...player, instrument, style };
  });

  // Warm haze hanging under the dome.
  const glow = glowTexture();
  const haze = Array.from({ length: 22 }, (_, i) => {
    const puff = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glow, color: 0xd9b565, transparent: true, opacity: 0.07, depthWrite: false }),
    );
    const base = new THREE.Vector3(-20 + (i % 6) * 2.9, 1.8 + (i % 3) * 0.8, 56 + Math.floor(i / 6) * 4);
    puff.position.copy(base);
    puff.scale.setScalar(2.6 + (i % 4) * 0.6);
    group.add(puff);
    return { puff, base, phase: i * 0.9 };
  });

  let clock = 0;
  return {
    group,
    actions: tableActions.actions,
    circles,
    bartenderSpot,
    tick: (time: number, reduced: boolean) => {
      mandalorian.tick(time,reduced);grogu.tick(time,reduced);
      tableActions.tick(time,reduced);
      const dt = Math.min(0.05, Math.max(0, time - clock));
      clock = time;
      const beat = time * BEAT * Math.PI * 2;
      regulars.forEach((regular) => {
        if (reduced) return;
        // Now and then a drink comes up, and heads turn to the room.
        const sip = Math.max(0, Math.sin(time * 0.35 + regular.phase)) ** 6;
        regular.arms[regular.lift].rotation.x = regular.rest.shoulder - sip * 0.9;
        regular.elbows[regular.lift].rotation.x = regular.rest.elbow - sip * 0.95;
        regular.head.rotation.y = Math.sin(time * 0.27 + regular.phase) * 0.5;
        regular.head.rotation.x = sip * -0.25;
      });
      // Bartender: walks between three stations, then wipes the counter.
      const cycle = (time * 0.09) % 1,
        station = [58.8, 62, 65.2][Math.floor(cycle * 3)],
        target = reduced ? 62 : station;
      const step = target - bartenderSpot.v;
      const walking = Math.abs(step) > 0.05;
      if (!reduced) bartenderSpot.v += Math.sign(step) * Math.min(Math.abs(step), dt * 1.1);
      bartender.root.position.set(bartenderSpot.u, 0, bartenderSpot.v);
      const facing = walking ? (step > 0 ? 0 : Math.PI) : Math.PI / 2;
      bartender.root.rotation.y += Math.atan2(Math.sin(facing - bartender.root.rotation.y), Math.cos(facing - bartender.root.rotation.y)) * (1 - Math.exp(-dt * 6));
      const wiping = !walking && !reduced;
      bartender.arms[1].rotation.x = wiping ? -0.55 : bartender.rest.shoulder;
      bartender.arms[1].rotation.z = wiping ? 0.12 + Math.sin(time * 4) * 0.3 : 0.12;
      bartender.elbows[1].rotation.x = wiping ? -0.75 : bartender.rest.elbow;
      // The band sways and plays on the beat.
      players.forEach((player, index) => {
        if (reduced) return;
        const pulse = Math.sin(beat + index * 0.6);
        player.root.rotation.z = pulse * 0.04;
        player.head.rotation.x = Math.max(0, pulse) * 0.18;
        if (player.style === "horn") {
          player.instrument.rotation.x = -0.15 + Math.sin(beat * 0.25 + index) * 0.12;
          player.arms.forEach((arm) => (arm.rotation.x = -0.75));
          player.elbows.forEach((elbow) => (elbow.rotation.x = -1.15));
        } else if (player.style === "keys") {
          player.arms.forEach((arm, i) => (arm.rotation.x = -0.35 + Math.sin(beat * 2 + i * Math.PI) * 0.1));
          player.elbows.forEach((elbow) => (elbow.rotation.x = -1.05));
        } else {
          player.arms.forEach((arm, i) => (arm.rotation.x = -0.35 + Math.max(0, Math.sin(beat * 2 + i * Math.PI)) * 0.35));
          player.elbows.forEach((elbow, i) => (elbow.rotation.x = -1.1 + Math.max(0, Math.sin(beat * 2 + i * Math.PI)) * 0.3));
        }
      });
      haze.forEach(({ puff, base, phase }) => {
        if (reduced) return;
        puff.position.set(base.x + Math.sin(time * 0.05 + phase) * 1.2, base.y + Math.sin(time * 0.08 + phase) * 0.3, base.z + Math.cos(time * 0.04 + phase) * 1.2);
        puff.material.opacity = 0.05 + Math.sin(time * 0.11 + phase) * 0.02;
      });
    },
  };
}
