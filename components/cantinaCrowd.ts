import * as THREE from "three";
import { glowTexture } from "./landingKit";
import { bakePart, part, pipe, rounded } from "./tatooineCharacters";
import { createSeatedMandalorian } from "./mandalorianModel";
import { createSeatedGrogu } from "./groguModel";
import { createCantinaTableActions } from "./cantinaTableActions";

// The cantina's regulars, all placed in the district's (u, y, v) frame, facing +v by default.
type Head = "dome" | "snout" | "hood" | "fins" | "human";
type Figure = { root: THREE.Group; head: THREE.Group; arms: THREE.Group[] };
const BEAT = 132 / 60;

function figure(options: {
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
  if (options.head === "fins") skin.color.lerp(new THREE.Color(0x557d81), 0.6);
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
  for (const side of [-1, 1]) {
    part(body, rounded(0.09, 0.15, 0.018, 0.012), leather, [side * 0.062, shoulder - 0.013, 0.177], [0, 0, side * 0.3]);
    part(body, rounded(0.09, 0.1, 0.028, 0.012), leather, [side * 0.145, robeBase + robeHeight * 0.45, 0.195]);
  }
  bakePart(body);
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.24, shoulder - 0.02, 0);
    ball(arm, [0, -0.055, 0], [0.085, 0.12, 0.085], robe);
    part(arm, new THREE.CylinderGeometry(0.065, 0.08, 0.27, 12), robe, [0, -0.17, 0.025], [0.18, 0, 0]);
    part(arm, new THREE.CylinderGeometry(0.054, 0.064, 0.22, 12), robe, [0, -0.36, 0.08], [0.32, 0, 0]);
    part(arm, new THREE.TorusGeometry(0.054, 0.008, 5, 12), leather, [0, -0.457, 0.112], [Math.PI / 2 + 0.32, 0, 0]);
    ball(arm, [0, -0.485, 0.124], [0.04, 0.04, 0.024], skin);
    for (let finger = 0; finger < 4; finger++) {
      const x = -0.026 + finger * 0.017;
      const length = finger === 0 || finger === 3 ? 0.043 : 0.055;
      ball(arm, [x, -0.515, 0.135], [0.009, length / 2, 0.01], skin);
      ball(arm, [x, -0.523 - length / 4, 0.145], [0.008, 0.012, 0.011], skin);
    }
    ball(arm, [-side * 0.041, -0.492, 0.14], [0.014, 0.025, 0.013], skin).rotation.z = -side * 0.55;
    bakePart(arm);
    root.add(arm);
    return arm;
  });
  const head = new THREE.Group();
  head.position.y = shoulder + 0.2;
  root.add(head);
  if (options.head === "dome") {
    // Bith have a broad, lobed cranium and a small mouth below the deep eye sockets.
    ball(head, [0, 0.075, -0.005], [0.19, 0.235, 0.165], skin);
    ball(head, [0, -0.07, 0.07], [0.115, 0.1, 0.105], skin);
    for (const side of [-1, 1]) {
      ball(head, [side * 0.075, 0.18, -0.006], [0.095, 0.13, 0.13], skin);
      ball(head, [side * 0.082, 0.025, 0.129], [0.07, 0.065, 0.033], crease).rotation.z = side * 0.19;
      ball(head, [side * 0.082, 0.025, 0.151], [0.052, 0.048, 0.028], dark).rotation.z = side * 0.19;
      ball(head, [side * 0.067, -0.061, 0.135], [0.05, 0.043, 0.022], skin);
      pipe(head, [[side * 0.024, -0.044, 0.158], [side * 0.047, -0.077, 0.158], [side * 0.033, -0.102, 0.154]], 0.003, crease);
    }
    ball(head, [0, -0.09, 0.162], [0.027, 0.008, 0.006], dark);
    ball(head, [0, -0.105, 0.156], [0.034, 0.009, 0.011], skin);
  } else if (options.head === "snout") {
    // Rodian eyes sit wide, above a rounded muzzle and paired antennae.
    ball(head, [0, 0.015, -0.008], [0.145, 0.17, 0.135], skin);
    ball(head, [0, -0.073, 0.13], [0.07, 0.059, 0.106], skin);
    part(head, new THREE.TorusGeometry(0.026, 0.009, 6, 14), crease, [0, -0.077, 0.232]);
    part(head, new THREE.CircleGeometry(0.022, 14), dark, [0, -0.077, 0.234]);
    for (const side of [-1, 1]) {
      ball(head, [side * 0.105, 0.043, 0.085], [0.064, 0.069, 0.05], crease);
      ball(head, [side * 0.11, 0.044, 0.114], [0.049, 0.053, 0.04], dark);
      ball(head, [side * 0.155, 0.09, -0.015], [0.035, 0.063, 0.019], skin).rotation.z = -side * 0.55;
      pipe(head, [[side * 0.05, 0.145, -0.02], [side * 0.066, 0.22, -0.035], [side * 0.086, 0.246, -0.045]], 0.009, skin);
      ball(head, [side * 0.087, 0.247, -0.045], [0.013, 0.018, 0.013], crease);
    }
    for (let spine = 0; spine < 5; spine++) {
      const angle = spine / 4 * 1.3;
      ball(head, [0, 0.17 * Math.cos(angle), -0.14 * Math.sin(angle)], [0.017, 0.035, 0.02], crease);
    }
  } else if (options.head === "hood") {
    ball(head, [0, 0.018, -0.015], [0.19, 0.215, 0.17], robe);
    ball(head, [0, -0.02, 0.092], [0.126, 0.14, 0.068], dark);
    ball(head, [0, -0.03, 0.134], [0.087, 0.095, 0.031], skin);
    pipe(head, [[-.12, -.11, .1], [-.14, .05, .12], [0, .18, .1], [.14, .05, .12], [.12, -.11, .1]], .018, robe);
    for (const side of [-1, 1]) ball(head, [side * .039, .004, .164], [.016, .008, .007], dark);
    ball(head, [0, -.026, .17], [.019, .03, .014], skin);
    pipe(head, [[-.06, -.101, .14], [0, -.12, .166], [.06, -.101, .14]], .022, robe);
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
    // Duros silhouettes are smooth and elongated, with red inset eyes and pronounced brow ridges.
    ball(head, [0, .035, -.018], [.15, .21, .142], skin);
    ball(head, [0, -.092, .045], [.102, .083, .087], skin);
    const eye = new THREE.MeshStandardMaterial({ color: 0x713b32, roughness: .28 });
    eye.userData.skipSurfaceDetail = true;
    for (const side of [-1, 1]) {
      ball(head, [side*.074,.023,.113], [.055,.042,.025], crease).rotation.z = side*.25;
      ball(head, [side*.074,.023,.133], [.042,.029,.017], eye).rotation.z = side*.25;
      ball(head, [side*.074,.023,.149], [.009,.023,.004], dark);
      pipe(head, [[side*.028,.07,.119],[side*.07,.085,.114],[side*.118,.067,.09]], .012, skin);
      ball(head, [side*.057,-.062,.105], [.043,.047,.024], skin);
    }
    pipe(head, [[-.039,-.112,.112],[0,-.119,.125],[.039,-.112,.112]], .004, crease);
  }
  bakePart(head);
  return { root, head, arms };
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
  const heads: Head[] = ["dome", "snout", "hood", "fins"];

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
    const regular = figure({ head: heads[index % heads.length], robe: look.robe, skin: look.skin, seat: 0.78 });
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
    const patron = figure({ head: heads[(index + 1) % heads.length], robe: look.robe, skin: look.skin, seat: 0.55 });
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
    const stander = figure({ head: heads[(index + 2) % heads.length], robe: look.robe, skin: look.skin, height: 2.05 });
    stander.root.position.set(u, 0, v);
    stander.root.rotation.y = yaw;
    group.add(stander.root);
    circles.push({ u, v, r: 0.4 });
    regulars.push({ ...stander, phase: index * 3.1 + 0.5, lift: 0 });
  });

  // The bartender paces behind the far side of the counter, stopping to wipe and pour.
  const bartender = figure({ head: "human", robe: 0x3d3229, skin: 0xb19374, height: 1.8 });
  const rag = part(bartender.arms[1], rounded(0.12, 0.03, 0.1, 0.01), new THREE.MeshStandardMaterial({ color: 0xcfc3a5 }), [0, -0.5, 0.14]);
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
    const player = figure({ head: "dome", robe: [0x3b3a36, 0x4b3d30, 0x37342e, 0x45392c][index], skin: 0xc7a582, height: 1.7 });
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
        regular.arms[regular.lift].rotation.x = -sip * 1.4;
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
      bartender.arms[1].rotation.x = walking || reduced ? 0 : -0.9;
      bartender.arms[1].rotation.z = walking || reduced ? 0 : Math.sin(time * 4) * 0.35;
      // The band sways and plays on the beat.
      players.forEach((player, index) => {
        if (reduced) return;
        const pulse = Math.sin(beat + index * 0.6);
        player.root.rotation.z = pulse * 0.04;
        player.head.rotation.x = Math.max(0, pulse) * 0.18;
        if (player.style === "horn") {
          player.instrument.rotation.x = -0.15 + Math.sin(beat * 0.25 + index) * 0.12;
          player.arms.forEach((arm) => (arm.rotation.x = -1.15));
        } else if (player.style === "keys") player.arms.forEach((arm, i) => (arm.rotation.x = -0.9 + Math.sin(beat * 2 + i * Math.PI) * 0.12));
        else player.arms.forEach((arm, i) => (arm.rotation.x = -0.8 + Math.max(0, Math.sin(beat * 2 + i * Math.PI)) * 0.6));
      });
      haze.forEach(({ puff, base, phase }) => {
        if (reduced) return;
        puff.position.set(base.x + Math.sin(time * 0.05 + phase) * 1.2, base.y + Math.sin(time * 0.08 + phase) * 0.3, base.z + Math.cos(time * 0.04 + phase) * 1.2);
        puff.material.opacity = 0.05 + Math.sin(time * 0.11 + phase) * 0.02;
      });
    },
  };
}
