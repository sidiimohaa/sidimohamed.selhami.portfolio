import * as THREE from "three";
import { createStandingHuman, type HumanLook } from "../humanFigure";
import { bakePart, part } from "../tatooineCharacters";
import { capeGeometry, type ImperialFigure } from "./imperialCourt";

// The men who ran the station: Grand Moff Tarkin, Admiral Motti and Director Krennic, on the
// articulated human used across the site. Each has his own short easter egg, driven by `perform`
// (t in seconds, on: 0 to 1 envelope) and undone by `finish`.

export type OfficerFigure = ImperialFigure & { perform: (t: number, on: number, reduced: boolean) => void; finish: () => void };

const OLIVE = 0x565b4a,
  OLIVE_DARK = 0x45493b,
  BLACK = 0x0d0d0e;
const clothOf = (color: number) => {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.82 });
  material.userData.surfaceKind = "cloth";
  return material;
};
const flat = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.35 });

function officer(look: HumanLook, dress: (parts: Parameters<NonNullable<Parameters<typeof createStandingHuman>[1]>>[0], s: Parameters<NonNullable<Parameters<typeof createStandingHuman>[1]>>[1]) => void) {
  const human = createStandingHuman(look, dress);
  // At ease: hands clasped behind the back.
  const rest = () =>
    human.arms.forEach((arm) => {
      arm.root.rotation.set(0.42, 0, 0);
      arm.joint.rotation.set(-0.25, 0, 0);
    });
  rest();
  return { human, rest };
}

// The rank plaque and the two code cylinders worn on an Imperial tunic.
function insignia(parts: { body: THREE.Group }, s: { box: (g: THREE.Object3D, at: [number, number, number], size: [number, number, number], mat: THREE.Material, r?: number) => unknown; rod: (g: THREE.Object3D, a: [number, number, number], b: [number, number, number], r1: number, r2: number, mat: THREE.Material) => unknown }, rows: [number, number][]) {
  const plaque = flat(0x151618),
    red = new THREE.MeshBasicMaterial({ color: 0xc23a2c, toneMapped: false }),
    blue = new THREE.MeshBasicMaterial({ color: 0x3f7fc4, toneMapped: false }),
    silver = flat(0xc0c4c8);
  rows.forEach(([reds, blues], row) => {
    const y = 1.33 - row * 0.03;
    s.box(parts.body, [-0.085, y, 0.117], [0.1, 0.024, 0.006], plaque, 0.002);
    for (let i = 0; i < reds + blues; i++) s.box(parts.body, [-0.122 + i * 0.015, y, 0.122], [0.009, 0.012, 0.003], i < reds ? red : blue, 0.001);
  });
  for (const x of [0.07, 0.095]) s.rod(parts.body, [x, 1.27, 0.117], [x, 1.33, 0.117], 0.006, 0.006, silver);
}

/** Commander of the station: gaunt, silver-haired, the highest rank plaque in the room. */
export function createGrandMoffTarkin(): OfficerFigure {
  const { human, rest } = officer(
    { name: "grand-moff-tarkin", skin: 0xc9ad98, hair: 0x9a9690, iris: 0x4c5660, hairStyle: "swept", tunic: OLIVE, trousers: OLIVE_DARK, boots: BLACK, belt: BLACK },
    (parts, s) => insignia(parts, s, [[3, 3], [3, 3]]),
  );
  return {
    group: human.group,
    tick: (time, reduced) => human.look(Math.sin(time * 0.3) * 0.25, -0.05, time, reduced),
    // He raises an accusing finger at the visitor.
    perform: (_t, on) => {
      const [, right] = human.arms;
      right.root.rotation.set(0.42 - 1.95 * on, 0, 0);
      right.joint.rotation.set(-0.25 + 0.1 * on, 0, 0);
      human.head.rotation.x = -0.06 * on;
    },
    finish: () => {
      rest();
      human.head.rotation.x = 0;
    },
  };
}

/** The admiral who doubted the Force: when his easter egg plays, he learns better. */
export function createAdmiralMotti(): OfficerFigure {
  const { human, rest } = officer(
    { name: "admiral-motti", skin: 0xd2ae94, hair: 0x4a3524, iris: 0x3a2a1a, hairStyle: "short", tunic: OLIVE, trousers: OLIVE_DARK, boots: BLACK, belt: BLACK },
    (parts, s) => insignia(parts, s, [[3, 2], [2, 2]]),
  );
  return {
    group: human.group,
    tick: (time, reduced) => human.look(Math.sin(time * 0.42 + 1) * 0.3, 0, time, reduced),
    // Hands at his throat, lifted a little off the floor, gasping.
    perform: (t, on, reduced) => {
      human.arms.forEach((arm, i) => {
        arm.root.rotation.set(0.42 - 2.55 * on, 0, (i ? -1 : 1) * 0.3 * on);
        arm.joint.rotation.set(-0.25 - 1.75 * on, 0, 0);
      });
      human.head.rotation.x = -0.3 * on;
      human.group.position.y = on * 0.18 + (reduced ? 0 : Math.sin(t * 34) * 0.006 * on);
    },
    finish: () => {
      rest();
      human.head.rotation.x = 0;
      human.group.position.y = 0;
    },
  };
}

/** Director of Advanced Weapons Research: white tunic, long white cape, black gloves. */
export function createDirectorKrennic(): OfficerFigure {
  const white = clothOf(0xe4e2dc);
  const lining = new THREE.MeshStandardMaterial({ color: 0xd8d6cf, roughness: 0.9, side: THREE.DoubleSide });
  lining.userData.surfaceKind = "cloth";
  const cape = new THREE.Group();
  const { human, rest } = officer(
    { name: "director-krennic", skin: 0xd6b39a, hair: 0x8c7a66, iris: 0x4c5a68, hairStyle: "swept", tunic: 0xe4e2dc, trousers: 0xdedcd5, boots: BLACK, belt: BLACK, gloves: BLACK },
    (parts, s) => {
      insignia(parts, s, [[2, 3]]);
      s.box(parts.body, [0, 1.46, 0.1], [0.2, 0.05, 0.03], white, 0.012);
    },
  );
  part(cape, capeGeometry(1.45, 0.3, 0.5), lining, [0, 0.02, 0.0]);
  bakePart(cape);
  human.group.add(cape);
  return {
    group: human.group,
    tick: (time, reduced) => {
      human.look(Math.sin(time * 0.36 + 2) * 0.3, 0, time, reduced);
      cape.rotation.x = reduced ? 0 : Math.sin(time * 0.6) * 0.012;
    },
    // A hand laid on the chest, the cape stirring: he presents the station as his own work.
    perform: (t, on, reduced) => {
      const [, right] = human.arms;
      right.root.rotation.set(0.42 - 1.25 * on, 0, -0.1 * on);
      right.joint.rotation.set(-0.25 - 1.55 * on, 0, 0);
      human.head.rotation.x = 0.1 * on;
      cape.rotation.x = reduced ? 0 : -0.1 * on * (0.7 + Math.sin(t * 5) * 0.3);
    },
    finish: () => {
      rest();
      human.head.rotation.x = 0;
      cape.rotation.x = 0;
    },
  };
}
