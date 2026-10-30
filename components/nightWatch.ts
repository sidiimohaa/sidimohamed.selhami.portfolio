import * as THREE from "three";
import { createStandingHuman, shapes, walkPose, type Human } from "./humanFigure";
import { bakePart, part } from "./tatooineCharacters";

// A crossover visitor on Hoth: Jon Snow, Lord Commander of the Night's Watch, in black leathers
// and fur mantle with Longclaw at his hip, and Ghost, his white direwolf with red eyes.

export function createJonSnow() {
  const fur = new THREE.MeshStandardMaterial({ color: 0x16130f, roughness: 1 });
  const human = createStandingHuman(
    {
      name: "hoth-jon-snow",
      skin: 0xe9cbb3,
      hair: 0x1b1511,
      beard: 0x221a14,
      iris: 0x3a2e24,
      hairStyle: "curly",
      tunic: 0x1e1c1b,
      trousers: 0x1b1a19,
      boots: 0x121212,
      belt: 0x2c221a,
      gloves: 0x1c1815,
    },
    ({ body }, { box, ball, rod }) => {
      const leather = new THREE.MeshStandardMaterial({ color: 0x252220, roughness: 0.6 });
      const steel = new THREE.MeshStandardMaterial({ color: 0x9da2a6, roughness: 0.3, metalness: 0.85 });
      const bone = new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.5 });
      // Quilted leather doublet: stitched panels and a column of dark studs down the front.
      for (let i = 0; i < 5; i++) ball(body, [0.035, 1.38 - i * 0.07, 0.104], [0.009, 0.009, 0.006], steel);
      box(body, [0, 1.25, 0.1], [0.05, 0.3, 0.02], leather, 0.006);
      // The heavy black fur mantle round the shoulders.
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        ball(body, [Math.sin(a) * 0.2, 1.43 + Math.cos(a * 3) * 0.01, Math.cos(a) * 0.13 - 0.02], [0.1, 0.08, 0.09], fur);
      }
      for (const side of [-1, 1]) ball(body, [side * 0.07, 1.38, 0.09], [0.06, 0.09, 0.04], fur);
      // Longclaw on the left hip: scabbard, crossguard and the white wolf-head pommel.
      rod(body, [0.2, 0.98, 0.02], [0.27, 0.36, -0.12], 0.024, 0.02, leather);
      box(body, [0.195, 1.0, 0.03], [0.14, 0.02, 0.03], steel, 0.006).rotation.z = -0.11;
      rod(body, [0.19, 1.01, 0.03], [0.175, 1.16, 0.06], 0.016, 0.016, leather);
      ball(body, [0.172, 1.18, 0.065], [0.026, 0.024, 0.03], bone);
      rod(body, [0.172, 1.18, 0.08], [0.172, 1.175, 0.11], 0.012, 0.006, bone);
    },
  );
  // A long black cloak hangs from the mantle and sways as he walks.
  const cape = new THREE.Group();
  cape.position.set(0, 1.43, -0.04);
  human.group.add(cape);
  const cloth = new THREE.CylinderGeometry(0.22, 0.33, 1.08, 24, 6, true, Math.PI / 2 + 0.25, Math.PI - 0.5),
    p = cloth.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      fold = 1 + Math.sin(Math.atan2(x, z) * 8) * 0.04 * (0.5 - y / 1.08);
    p.setXYZ(i, x * fold, y - 0.54, z * fold);
  }
  cloth.computeVertexNormals();
  part(cape, cloth, new THREE.MeshStandardMaterial({ color: 0x141312, roughness: 0.95, side: THREE.DoubleSide }));
  return { ...human, cape };
}

export function createDirewolf() {
  const { ball, rod } = shapes();
  const group = new THREE.Group();
  group.name = "hoth-ghost";
  const coat = new THREE.MeshStandardMaterial({ color: 0xedebe5, roughness: 1 });
  const shade = new THREE.MeshStandardMaterial({ color: 0xd6d3cc, roughness: 1 });
  const nose = new THREE.MeshStandardMaterial({ color: 0x1d1a19, roughness: 0.4 });
  const eye = new THREE.MeshBasicMaterial({ color: 0xc41f2c });
  const body = new THREE.Group();
  group.add(body);
  ball(body, [0, 0.82, 0], [0.26, 0.29, 0.6], coat);
  ball(body, [0, 0.85, 0.42], [0.29, 0.35, 0.32], coat);
  ball(body, [0, 0.8, -0.44], [0.24, 0.26, 0.3], coat);
  ball(body, [0, 0.66, 0.1], [0.2, 0.14, 0.42], shade);
  rod(body, [0, 0.95, 0.55], [0, 1.1, 0.78], 0.17, 0.13, coat);
  // A thick ruff of fur round the neck and shoulders.
  for (let i = 0; i < 7; i++) {
    const a = ((i - 3) / 3) * 1.6;
    ball(body, [Math.sin(a) * 0.19, 0.98 + Math.cos(a) * 0.12, 0.58], [0.09, 0.13, 0.12], i % 2 ? coat : shade);
  }
  bakePart(body);
  const head = new THREE.Group();
  head.position.set(0, 1.13, 0.83);
  group.add(head);
  ball(head, [0, 0.02, 0], [0.14, 0.13, 0.16], coat);
  for (const side of [-1, 1]) ball(head, [side * 0.075, -0.035, 0.05], [0.055, 0.06, 0.08], coat);
  rod(head, [0, -0.01, 0.1], [0, -0.06, 0.36], 0.08, 0.042, coat);
  ball(head, [0, -0.095, 0.2], [0.06, 0.03, 0.12], shade);
  ball(head, [0, -0.05, 0.365], [0.028, 0.022, 0.022], nose);
  for (const side of [-1, 1]) {
    const ear = part(head, new THREE.ConeGeometry(0.045, 0.13, 8), coat, [side * 0.08, 0.15, -0.03]);
    ear.rotation.set(-0.2, 0, side * -0.3);
  }
  bakePart(head);
  for (const side of [-1, 1]) part(head, new THREE.SphereGeometry(0.016, 10, 8), eye, [side * 0.066, 0.035, 0.125]);
  const tail = new THREE.Group();
  tail.position.set(0, 0.9, -0.7);
  group.add(tail);
  // A thick brush of a tail, hanging low.
  const brush = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.2, -0.16), new THREE.Vector3(0, -0.48, -0.24), new THREE.Vector3(0, -0.62, -0.22)]);
  const fur = new THREE.TubeGeometry(brush, 16, 1, 10, false),
    tp = fur.getAttribute("position");
  // Each ring of the tube sits on the curve; narrow it at the root, fuller in the middle.
  for (let i = 0; i < tp.count; i++) {
    const along = Math.floor(i / 11) / 16,
      width = 0.055 + Math.sin(along * Math.PI * 0.85) * 0.05,
      point = brush.getPointAt(along);
    tp.setXYZ(i, point.x + (tp.getX(i) - point.x) * width, point.y + (tp.getY(i) - point.y) * width, point.z + (tp.getZ(i) - point.z) * width);
  }
  fur.computeVertexNormals();
  part(tail, fur, coat);
  bakePart(tail);
  // Front and hind legs, each with a joint so the paws lift as it trots.
  const legs = (
    [
      [-0.14, 0.78, 0.42, 0],
      [0.14, 0.78, 0.42, Math.PI],
      [-0.14, 0.76, -0.45, Math.PI],
      [0.14, 0.76, -0.45, 0],
    ] as const
  ).map(([x, y, z, phase]) => {
    const root = new THREE.Group();
    root.position.set(x, y, z);
    group.add(root);
    rod(root, [0, 0.06, 0], [0, -0.38, 0], 0.095, 0.06, coat);
    const joint = new THREE.Group();
    joint.position.set(0, -0.38, 0);
    root.add(joint);
    rod(joint, [0, 0, 0], [0, -0.35, 0.02], 0.056, 0.045, coat);
    ball(joint, [0, -0.36, 0.05], [0.06, 0.035, 0.08], shade);
    bakePart(joint);
    joint.removeFromParent();
    bakePart(root);
    root.add(joint);
    return { root, joint, phase };
  });
  return {
    group,
    head,
    /** A trot when amount is 1; standing still at 0. */
    pose: (step: number, amount: number, time: number) => {
      legs.forEach((leg) => {
        leg.root.rotation.x = Math.sin(step + leg.phase) * 0.42 * amount;
        leg.joint.rotation.x = Math.max(0, -Math.cos(step + leg.phase)) * 0.7 * amount;
      });
      body.position.y = Math.abs(Math.sin(step)) * 0.025 * amount;
      tail.rotation.x = 0.25 + Math.sin(step * 0.5) * 0.08 * amount;
      tail.rotation.y = Math.sin(time * 1.3) * 0.2;
    },
  };
}

export type JonSnow = ReturnType<typeof createJonSnow>;
export { walkPose, type Human };
