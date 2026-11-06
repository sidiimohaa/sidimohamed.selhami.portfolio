import * as THREE from "three";
import { education, experiences, identity } from "./deathStar/cvData";
import type { Spot } from "./landingKit";
import { createHeroDroids, bakePart, part, rounded } from "./tatooineCharacters";
import { ewok } from "./endorVillage";

// C-3PO on the throne the Ewoks built him, telling the visitor's story to the tribe the way he told
// them the war: as a legend. Everything he says comes from the CV.

export const THRONE = new THREE.Vector3(10.5, 0, 23);
const FACING = Math.atan2(0 - THRONE.x, 20 - THRONE.z);

export function legendLines() {
  const [recent, earlier] = experiences;
  const degree = education[education.length - 1];
  return [
    "Je parle plus de six millions de formes de communication, et aucune n’est de trop pour vous conter l’histoire de " + identity.name + ".",
    `Tout commença chez ${earlier.company}, où il apprit le métier : ${earlier.role.toLowerCase()}, de ${earlier.period.toLowerCase()}.`,
    `Puis il servit chez ${recent.company}, ${recent.duration?.toLowerCase() ?? recent.period.toLowerCase()} durant, à conseiller les clients : ${recent.role.toLowerCase()}.`,
    `Les Ewoks l’écoutèrent quand il reprit ses études : ${degree.title}, ${degree.school}.`,
    "Alors il bâtit ORBITAL, ce monde même où vous marchez, en guidant des assistants de code IA. Oui, ce monde-ci !",
    `${identity.search} Oh, ne me regardez pas ainsi : je ne fais que traduire.`,
  ];
}

export function createEndorThrone(circles: Spot[]) {
  const group = new THREE.Group();
  group.name = "endor-throne";
  group.position.copy(THRONE);
  group.rotation.y = FACING;
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a4a2c, roughness: 0.95 });
  const pale = new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: 0.95 });
  const hide = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1, side: THREE.DoubleSide });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x4f7a34, roughness: 0.9, side: THREE.DoubleSide });
  const seat = new THREE.Group();
  // A litter of lashed logs, its seat, tall back, footboard and a fan of fronds behind.
  [-0.9, 0.9].forEach((x) => part(seat, new THREE.CylinderGeometry(0.1, 0.11, 3.4, 8), wood, [x, 0.34, 0.1], [Math.PI / 2, 0, 0]));
  for (let i = 0; i < 6; i++) part(seat, new THREE.CylinderGeometry(0.075, 0.075, 2, 8), pale, [0, 0.46, -0.9 + i * 0.36], [0, 0, Math.PI / 2]);
  part(seat, rounded(1.15, 0.5, 1.1, 0.08), wood, [0, 0.82, -0.15]);
  part(seat, rounded(1.2, 0.06, 1.15, 0.02), hide, [0, 1.09, -0.15]);
  part(seat, rounded(1.2, 2, 0.14, 0.05), wood, [0, 2.1, -0.72]);
  [-0.55, 0.55].forEach((x) => {
    part(seat, new THREE.CylinderGeometry(0.06, 0.07, 2.4, 8), pale, [x, 2.1, -0.62]);
    part(seat, rounded(0.14, 0.1, 0.9, 0.03), pale, [x * 1.1, 1.5, -0.15]);
  });
  part(seat, rounded(1.1, 0.1, 0.62, 0.02), pale, [0, 0.74, 0.72]);
  [-0.42, 0.42].forEach((x) => part(seat, new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6), wood, [x, 0.56, 0.72]));
  for (let i = 0; i < 7; i++) {
    const a = -0.9 + i * 0.3;
    const frond = part(seat, new THREE.ConeGeometry(0.22, 1.5, 4), leaf, [Math.sin(a) * 0.9, 3.35 + Math.cos(a) * 0.6, -0.72]);
    frond.rotation.z = -a;
    frond.scale.z = 0.12;
  }
  bakePart(seat);
  group.add(seat);
  // C-3PO, seated, feet on the footboard, gesturing as he talks.
  const hero = createHeroDroids();
  const droid = hero.c3;
  droid.position.set(0, 0.42, -0.1);
  droid.scale.setScalar(0.94);
  hero.rig.legs.forEach((leg) => (leg.rotation.x = -1.32));
  hero.rig.arms.forEach((arm, i) => {
    arm.rotation.x = -0.5;
    arm.rotation.z = (i ? 1 : -1) * 0.08;
  });
  group.add(droid);
  // The audience, sitting on the ground in an arc before him.
  const audience = [
    [-1.3, 2.1, "#6e5238", 0x7a5a38],
    [0.1, 2.7, "#8a6a48", 0x5a4632],
    [1.4, 2.1, "#54402c", 0x8a6a48],
    [-2.3, 1.1, "#7c6650", 0x6a4a2c],
  ].map(([x, z, fur, hood], i) => {
    const villager = ewok(fur as string, hood as number, i === 1 ? 0.92 : 1);
    villager.root.position.set(x as number, -0.24, z as number);
    villager.root.rotation.y = Math.atan2(-(x as number), -(z as number));
    villager.legs.forEach((leg, k) => {
      leg.rotation.x = -1.5;
      leg.rotation.z = (k ? -1 : 1) * 0.3;
    });
    villager.arms.forEach((arm) => (arm.rotation.x = -0.5));
    group.add(villager.root);
    return villager;
  });
  group.updateMatrixWorld(true);
  const world = new THREE.Vector3();
  circles.push({ x: THRONE.x, z: THRONE.z, r: 1.6 });
  audience.forEach((villager) => {
    villager.root.getWorldPosition(world);
    circles.push({ x: world.x, z: world.z, r: 0.45 });
  });
  const pick = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 3.4, 10), new THREE.MeshBasicMaterial({ visible: false }));
  pick.position.y = 1.7;
  group.add(pick);
  const approachAt = group.localToWorld(new THREE.Vector3(0.5, 0, 3.7));
  let telling = 0;
  return {
    group,
    pick,
    approachAt,
    speak: (seconds: number) => (telling = seconds),
    tick: (dt: number, time: number, reduced: boolean) => {
      telling = Math.max(0, telling - dt);
      if (reduced) return;
      const talk = telling > 0 ? 1 : 0.25;
      hero.rig.head.rotation.y = Math.sin(time * 0.7) * 0.3 * talk;
      hero.rig.head.rotation.x = Math.sin(time * 1.3) * 0.05 * talk;
      hero.rig.arms[1].rotation.x = -0.5 - (Math.sin(time * 2.1) * 0.5 + 0.5) * 0.9 * talk;
      hero.rig.arms[0].rotation.x = -0.5 - (Math.sin(time * 1.6 + 1) * 0.5 + 0.5) * 0.6 * talk;
      audience.forEach((villager, i) => {
        villager.head.rotation.x = -0.15 + Math.sin(time * 0.6 + i) * 0.06;
        if (telling > 0) villager.arms.forEach((arm, k) => (arm.rotation.x = -0.5 - Math.max(0, Math.sin(time * 3 + i + k)) * 0.35));
      });
    },
  };
}
