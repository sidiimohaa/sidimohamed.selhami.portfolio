import * as THREE from "three";
import { glowTexture } from "./landingKit";
import { bakePart, part, rounded } from "./tatooineCharacters";
import { createSeatedMandalorian } from "./mandalorianModel";
import { createSeatedGrogu } from "./groguModel";
import { createCantinaTableActions } from "./cantinaTableActions";

// The cantina's regulars, all placed in the district's (u, y, v) frame, facing +v by default.
type Head = "dome" | "snout" | "hood" | "fins";
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
  const robe = new THREE.MeshStandardMaterial({ color: options.robe, roughness: 0.95 });
  const skin = new THREE.MeshStandardMaterial({ color: options.skin, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0f0d0b, roughness: 0.3 });
  const seated = options.seat !== undefined;
  const height = options.height ?? 1.75;
  const shoulder = seated ? (options.seat ?? 0.75) + 0.62 : height * 0.78;
  const body = new THREE.Group();
  root.add(body);
  if (seated) {
    const hip = options.seat ?? 0.75;
    part(body, new THREE.CylinderGeometry(0.19, 0.25, 0.62, 12), robe, [0, hip + 0.31, 0]);
    for (const side of [-1, 1]) {
      part(body, rounded(0.15, 0.14, 0.44, 0.05), robe, [side * 0.11, hip + 0.05, 0.18]);
      part(body, new THREE.CylinderGeometry(0.065, 0.07, hip - 0.05, 8), robe, [
        side * 0.11,
        (hip - 0.05) / 2,
        0.38,
      ]);
    }
  } else
    part(body, new THREE.CylinderGeometry(0.2, 0.34, shoulder, 14), robe, [0, shoulder / 2, 0]);
  part(body, new THREE.SphereGeometry(0.22, 14, 10), robe, [0, shoulder, 0]).scale.set(1.15, 0.55, 0.9);
  bakePart(body);
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.24, shoulder - 0.02, 0);
    part(arm, new THREE.CylinderGeometry(0.065, 0.08, 0.5, 8), robe, [0, -0.22, 0.04], [0.25, 0, 0]);
    part(arm, new THREE.SphereGeometry(0.055, 8, 6), skin, [0, -0.47, 0.12]);
    root.add(arm);
    return arm;
  });
  const head = new THREE.Group();
  head.position.y = shoulder + 0.2;
  root.add(head);
  if (options.head === "dome") {
    // A tall bare cranium with big dark eyes.
    part(head, new THREE.SphereGeometry(0.17, 16, 12), skin, [0, 0.08, 0]).scale.set(1, 1.35, 1);
    for (const side of [-1, 1])
      part(head, new THREE.SphereGeometry(0.05, 10, 8), dark, [side * 0.075, 0.02, 0.13]);
  } else if (options.head === "snout") {
    part(head, new THREE.SphereGeometry(0.15, 14, 10), skin);
    part(head, new THREE.ConeGeometry(0.09, 0.3, 10), skin, [0, -0.04, 0.2], [Math.PI / 2, 0, 0]);
    for (const side of [-1, 1])
      part(head, new THREE.SphereGeometry(0.03, 8, 6), dark, [side * 0.09, 0.05, 0.1]);
  } else if (options.head === "hood") {
    part(head, new THREE.SphereGeometry(0.19, 14, 10), robe).scale.set(1, 1.1, 1);
    part(head, new THREE.SphereGeometry(0.12, 12, 8), dark, [0, -0.02, 0.09]);
  } else {
    part(head, new THREE.SphereGeometry(0.15, 14, 10), skin).scale.set(1, 1.1, 1);
    for (const side of [-1, 1]) {
      part(head, rounded(0.03, 0.22, 0.16, 0.01), skin, [side * 0.16, 0.05, -0.02], [0, 0, side * 0.5]);
      part(head, new THREE.SphereGeometry(0.03, 8, 6), dark, [side * 0.06, 0.03, 0.13]);
    }
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
  const bartender = figure({ head: "dome", robe: 0x3d3229, skin: 0xb19374, height: 1.8 });
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
