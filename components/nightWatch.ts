import * as THREE from "three";
import { createStandingHuman, shapes, walkPose, type Human } from "./humanFigure";
import { bakePart, part } from "./tatooineCharacters";
import { furClump } from "./wampaModel";

// A crossover visitor on Hoth: Jon Snow, Lord Commander of the Night's Watch, in black leathers
// under a great shaggy fur mantle, Longclaw at his hip, and Ghost, his huge white direwolf.

export function createJonSnow() {
  const fur = new THREE.MeshStandardMaterial({ color: 0x1b1713, roughness: 1 });
  const furTips = new THREE.MeshStandardMaterial({ color: 0x2c251e, roughness: 1 });
  let seed = 700;
  const human = createStandingHuman(
    {
      name: "hoth-jon-snow",
      skin: 0xe6c7ae,
      hair: 0x18120e,
      beard: 0x1f1712,
      shortBeard: true,
      iris: 0x4a3b2c,
      hairStyle: "curly",
      tunic: 0x1e1c1b,
      trousers: 0x1b1a19,
      boots: 0x161412,
      belt: 0x2c221a,
      gloves: 0x1a1613,
    },
    ({ body, legs }, { box, ball, rod }) => {
      const leather = new THREE.MeshStandardMaterial({ color: 0x262321, roughness: 0.55 });
      const strap = new THREE.MeshStandardMaterial({ color: 0x3a2e24, roughness: 0.6 });
      const steel = new THREE.MeshStandardMaterial({ color: 0xa3a8ac, roughness: 0.28, metalness: 0.9 });
      const bone = new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.5 });
      // Leather doublet: two straps crossing the chest, a broad belt and a skirt of tassets.
      for (const side of [-1, 1]) {
        const band = box(body, [0, 1.24, 0.108], [0.05, 0.42, 0.016], strap, 0.004);
        band.rotation.z = side * 0.62;
      }
      box(body, [0, 1.035, 0.003], [0.36, 0.07, 0.225], strap, 0.012);
      box(body, [0.02, 1.035, 0.116], [0.06, 0.055, 0.012], steel, 0.004);
      box(body, [0.02, 1.035, 0.122], [0.035, 0.03, 0.006], strap, 0.002);
      const skirt = new THREE.CylinderGeometry(0.19, 0.26, 0.38, 20, 1, true);
      part(body, skirt, new THREE.MeshStandardMaterial({ color: 0x232120, roughness: 0.6, side: THREE.DoubleSide }), [0, 0.81, 0]);
      for (let i = 0; i < 6; i++) ball(body, [Math.sin((i / 6) * Math.PI * 2) * 0.25, 0.63, Math.cos((i / 6) * Math.PI * 2) * 0.25], [0.012, 0.012, 0.012], steel);
      // The great fur mantle: a shaggy ring round the shoulders, falling in lapels down the chest.
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const clump = part(body, furClump(0.12, seed++, 0.45), i % 3 ? fur : furTips, [Math.sin(a) * 0.21, 1.44 + Math.cos(a * 2) * 0.015, Math.cos(a) * 0.14 - 0.03]);
        clump.scale.set(1.15, 0.9, 1.05);
      }
      for (const side of [-1, 1])
        for (let k = 0; k < 4; k++) {
          const lapel = part(body, furClump(0.075, seed++, 0.5), k % 2 ? fur : furTips, [side * (0.1 + k * 0.006), 1.36 - k * 0.1, 0.1]);
          lapel.scale.set(0.9, 1.25, 0.7);
        }
      for (let k = 0; k < 3; k++) part(body, furClump(0.14, seed++, 0.45), fur, [0, 1.36 - k * 0.12, -0.13]).scale.set(1.5, 1, 0.7);
      // Longclaw on the left hip: scabbard down the leg, crossguard and the white wolf's-head pommel.
      rod(body, [0.21, 0.98, 0.04], [0.29, 0.22, -0.1], 0.024, 0.019, leather);
      box(body, [0.205, 1.0, 0.05], [0.15, 0.02, 0.03], steel, 0.006).rotation.z = -0.1;
      rod(body, [0.2, 1.01, 0.05], [0.18, 1.17, 0.08], 0.016, 0.016, leather);
      ball(body, [0.178, 1.195, 0.085], [0.026, 0.024, 0.032], bone);
      rod(body, [0.178, 1.19, 0.1], [0.178, 1.183, 0.135], 0.012, 0.005, bone);
      for (const side of [-1, 1]) ball(body, [0.178 + side * 0.014, 1.215, 0.08], [0.008, 0.016, 0.008], bone);
      // High riding boots, buckled under the knee.
      legs.forEach((leg) => {
        rod(leg.joint, [0, 0.02, 0], [0, -0.22, -0.01], 0.064, 0.058, new THREE.MeshStandardMaterial({ color: 0x161412, roughness: 0.5 }));
        part(leg.joint, new THREE.TorusGeometry(0.062, 0.009, 6, 16), strap, [0, -0.06, -0.003], [Math.PI / 2, 0, 0]);
      });
    },
  );
  // A long black cloak hangs from the mantle to the ankles and sways as he walks.
  const cape = new THREE.Group();
  cape.position.set(0, 1.43, -0.05);
  human.group.add(cape);
  const cloth = new THREE.CylinderGeometry(0.23, 0.38, 1.33, 26, 8, true, Math.PI / 2 + 0.2, Math.PI - 0.4),
    p = cloth.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      low = 0.5 - y / 1.33,
      fold = 1 + Math.sin(Math.atan2(x, z) * 9) * 0.05 * low + Math.sin(Math.atan2(x, z) * 23 + y * 4) * 0.012;
    p.setXYZ(i, x * fold, y - 0.665, z * fold);
  }
  cloth.computeVertexNormals();
  part(cape, cloth, new THREE.MeshStandardMaterial({ color: 0x151412, roughness: 0.95, side: THREE.DoubleSide }));
  return { ...human, cape };
}

export function createDirewolf() {
  const { rod } = shapes();
  const group = new THREE.Group();
  group.name = "hoth-ghost";
  const coat = new THREE.MeshStandardMaterial({ color: 0xf1efea, roughness: 1 });
  const shade = new THREE.MeshStandardMaterial({ color: 0xdedad2, roughness: 1 });
  const nose = new THREE.MeshStandardMaterial({ color: 0x161414, roughness: 0.35 });
  const eye = new THREE.MeshBasicMaterial({ color: 0xd42433 });
  const rim = new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 0.5 });
  let seed = 900;
  const clump = (g: THREE.Object3D, radius: number, at: [number, number, number], scale: [number, number, number], mat: THREE.Material = coat, shag = 0.3) => {
    const mesh = part(g, furClump(radius, seed++, shag), mat, at);
    mesh.scale.set(...scale);
    return mesh;
  };
  // A thick coat over a long, deep-chested body, with a heavy ruff round the neck.
  const body = new THREE.Group();
  group.add(body);
  clump(body, 0.3, [0, 0.86, -0.02], [0.85, 0.92, 1.95], coat, 0.05);
  clump(body, 0.32, [0, 0.9, 0.42], [0.95, 1.08, 0.95], coat, 0.06);
  clump(body, 0.26, [0, 0.84, -0.46], [0.9, 0.95, 1.1], coat, 0.05);
  clump(body, 0.2, [0, 0.7, 0.3], [0.85, 0.75, 1.2], shade, 0.06);
  clump(body, 0.26, [0, 1.06, 0.6], [1.05, 0.95, 0.85], coat, 0.18);
  clump(body, 0.21, [0, 0.86, 0.72], [0.9, 1.1, 0.7], shade, 0.18);
  rod(body, [0, 1.02, 0.58], [0, 1.16, 0.82], 0.16, 0.13, coat);
  bakePart(body);
  const head = new THREE.Group();
  head.position.set(0, 1.2, 0.86);
  group.add(head);
  clump(head, 0.15, [0, 0.03, 0], [1, 0.92, 1.05], coat, 0.08);
  for (const side of [-1, 1]) clump(head, 0.07, [side * 0.1, -0.03, -0.02], [0.8, 1, 1], coat, 0.2);
  rod(head, [0, -0.01, 0.1], [0, -0.055, 0.37], 0.08, 0.04, coat);
  part(head, new THREE.SphereGeometry(1, 14, 10), shade, [0, -0.09, 0.21]).scale.set(0.055, 0.03, 0.13);
  part(head, new THREE.SphereGeometry(1, 12, 10), nose, [0, -0.045, 0.375]).scale.set(0.03, 0.023, 0.024);
  for (const side of [-1, 1]) {
    // Tall pointed ears.
    const ear = part(head, new THREE.ConeGeometry(0.055, 0.17, 4), coat, [side * 0.075, 0.17, -0.04]);
    ear.rotation.set(-0.15, Math.PI / 4, side * -0.22);
    part(head, new THREE.SphereGeometry(1, 10, 8), rim, [side * 0.058, 0.035, 0.12]).scale.set(0.024, 0.016, 0.012);
  }
  bakePart(head);
  for (const side of [-1, 1]) part(head, new THREE.SphereGeometry(0.014, 10, 8), eye, [side * 0.06, 0.036, 0.128]);
  // A heavy brush of a tail, carried low.
  const tail = new THREE.Group();
  tail.position.set(0, 0.92, -0.78);
  group.add(tail);
  for (let i = 0; i < 5; i++) clump(tail, 0.09 + Math.sin((i / 4) * Math.PI) * 0.045, [0, -i * 0.12, -0.1 - Math.sin(i * 0.5) * 0.12], [1, 1.3, 1], i > 3 ? shade : coat, 0.22);
  bakePart(tail);
  // Long, strong legs with feathered fur and big paws; each has a joint so the paws lift.
  const legs = (
    [
      [-0.15, 0.82, 0.44, 0],
      [0.15, 0.82, 0.44, Math.PI],
      [-0.15, 0.8, -0.48, Math.PI],
      [0.15, 0.8, -0.48, 0],
    ] as const
  ).map(([x, y, z, phase]) => {
    const root = new THREE.Group();
    root.position.set(x, y, z);
    group.add(root);
    clump(root, 0.11, [0, -0.15, 0], [1, 2.1, 1.1], coat, 0.06);
    const joint = new THREE.Group();
    joint.position.set(0, -0.42, 0);
    root.add(joint);
    rod(joint, [0, 0.04, 0], [0, -0.36, 0.02], 0.066, 0.054, coat);
    part(joint, new THREE.SphereGeometry(1, 12, 8), shade, [0, -0.375, 0.06]).scale.set(0.075, 0.04, 0.1);
    bakePart(joint);
    joint.removeFromParent();
    bakePart(root);
    root.add(joint);
    return { root, joint, phase };
  });
  // Ghost stands nearly as tall at the shoulder as Jon's chest.
  group.scale.setScalar(1.3);
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
      tail.rotation.x = 0.3 + Math.sin(step * 0.5) * 0.08 * amount;
      tail.rotation.y = Math.sin(time * 1.3) * 0.2;
    },
  };
}

export type JonSnow = ReturnType<typeof createJonSnow>;
export { walkPose, type Human };
