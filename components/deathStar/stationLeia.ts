import * as THREE from "three";
import { createStandingHuman } from "../humanFigure";
import { part } from "../tatooineCharacters";
import { robeGeometry } from "./imperialCourt";

// The prisoner of cell 2187: Princess Leia in her white gown, the hair in two side coils, sitting on
// the bench. Facing +Z in her own frame; she keeps her head down until the visitor comes to speak.

export function createPrincessLeia() {
  const WHITE = 0xece9e2,
    HAIR = 0x3a2416;
  const human = createStandingHuman(
    { name: "princess-leia", skin: 0xe6c4aa, hair: HAIR, iris: 0x4a2e18, hairStyle: "swept", tunic: WHITE, trousers: WHITE, boots: WHITE, belt: 0xb9bdc2 },
    (parts, s) => {
      const hair = new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.8 });
      hair.userData.surfaceKind = "fur";
      // Hair drawn down over the crown, and the two great coils at the sides of the head.
      s.ball(parts.head, [0, 0.05, -0.022], [0.116, 0.128, 0.113], hair);
      [-1, 1].forEach((side) => {
        s.ball(parts.head, [side * 0.125, 0.012, -0.012], [0.05, 0.078, 0.078], hair);
        const coil = part(parts.head, new THREE.TorusGeometry(0.052, 0.012, 6, 18), hair, [side * 0.168, 0.012, -0.012]);
        coil.rotation.y = Math.PI / 2;
      });
    },
  );
  const cloth = new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.9, side: THREE.DoubleSide });
  cloth.userData.surfaceKind = "cloth";
  // The gown falling from the waist over the knees to the floor.
  const gown = new THREE.Mesh(
    robeGeometry(
      [
        { y: 1.13, x: 0.13, z: 0.1, offset: 0 },
        { y: 0.98, x: 0.21, z: 0.17, offset: 0.02 },
        { y: 0.92, x: 0.31, z: 0.4, offset: 0.2 },
        { y: 0.8, x: 0.32, z: 0.44, offset: 0.24 },
        { y: 0.55, x: 0.33, z: 0.22, offset: 0.48 },
        { y: 0.4, x: 0.37, z: 0.26, offset: 0.5 },
      ],
      12,
      0.012,
    ),
    cloth,
  );
  human.group.add(gown);
  // Sitting: the frame is lowered so that the hips rest on the bench, knees forward, hands in the lap.
  human.group.position.y = -0.4;
  human.legs.forEach((leg) => {
    leg.root.rotation.x = -1.45;
    leg.joint.rotation.x = 1.42;
  });
  human.arms.forEach((arm, i) => {
    arm.root.rotation.set(-0.72, 0, (i ? -1 : 1) * 0.08);
    arm.joint.rotation.set(-0.72, 0, 0);
  });
  const holder = new THREE.Group();
  holder.name = "princess-leia";
  holder.add(human.group);
  let raised = 0;
  return {
    group: holder,
    /** `awake`: she lifts her head and turns it to the visitor. */
    tick: (dt: number, time: number, reduced: boolean, awake: boolean, across: number) => {
      raised = reduced ? (awake ? 1 : 0) : THREE.MathUtils.damp(raised, awake ? 1 : 0, 3, dt);
      human.head.rotation.x = 0.34 * (1 - raised) - 0.06 * raised;
      human.head.rotation.y = across * raised;
      human.look(across * raised * 0.5, raised * 0.3 - 0.3, time, reduced);
    },
  };
}
