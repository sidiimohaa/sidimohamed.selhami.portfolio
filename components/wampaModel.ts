import * as THREE from "three";
import { random } from "./landingKit";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { bakePart, part } from "./tatooineCharacters";

// The wampa: a hulking, shaggy white creature, hunched, with curled horns, a dark grey face, a jaw
// full of teeth and long arms ending in black claws. Facing +Z, about 2.6 m tall as it stoops.

type XYZ = [number, number, number];

// A clump of fur: a sphere whose surface is roughened into tufts, so the silhouette reads shaggy.
export function furClump(radius: number, seed: number, shag = 0.22) {
  // UVs are kept so clumps bake together with ordinary parts sharing their material.
  const base = new THREE.IcosahedronGeometry(radius, 3);
  base.deleteAttribute("normal");
  const geometry = mergeVertices(base);
  base.dispose();
  const p = geometry.getAttribute("position"),
    rand = random(seed),
    tuft = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    // Coincident vertices get the same tuft, so the clump stays closed.
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    if (!tuft.has(key)) tuft.set(key, 1 + (rand() - 0.35) * shag + Math.max(0, -y / radius) * shag * 0.6);
    const k = tuft.get(key)!;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function createWampa() {
  const group = new THREE.Group();
  group.name = "hoth-wampa";
  const fur = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 1 });
  const shade = new THREE.MeshStandardMaterial({ color: 0xd9d6cc, roughness: 1 });
  const skin = new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 0.7 });
  const gum = new THREE.MeshStandardMaterial({ color: 0x5a2224, roughness: 0.6 });
  const throat = new THREE.MeshBasicMaterial({ color: 0x140707 });
  const tooth = new THREE.MeshStandardMaterial({ color: 0xece3cc, roughness: 0.4 });
  const horn = new THREE.MeshStandardMaterial({ color: 0xc9bea6, roughness: 0.55 });
  const claw = new THREE.MeshStandardMaterial({ color: 0x1b1816, roughness: 0.35 });
  let seed = 31;
  const clump = (g: THREE.Object3D, radius: number, at: XYZ, scale: XYZ, mat: THREE.Material = fur) => {
    const mesh = part(g, furClump(radius, seed++), mat, at);
    mesh.scale.set(...scale);
    return mesh;
  };

  // Body, hunched forward: hips, belly, a broad chest and a great hump of shoulders.
  const body = new THREE.Group();
  group.add(body);
  clump(body, 0.46, [0, 0.95, -0.05], [1, 0.9, 0.85]);
  clump(body, 0.5, [0, 1.35, 0.05], [1.05, 1, 0.85], shade);
  clump(body, 0.56, [0, 1.8, 0.12], [1.15, 0.95, 0.9]);
  clump(body, 0.45, [0, 2.12, 0.02], [1.35, 0.6, 0.85]);
  for (const side of [-1, 1]) {
    clump(body, 0.27, [side * 0.24, 0.55, 0], [1, 1.5, 1.05]);
    clump(body, 0.2, [side * 0.26, 0.16, 0.08], [1.1, 0.8, 1.5], shade);
    for (let c = 0; c < 3; c++) part(body, new THREE.ConeGeometry(0.03, 0.12, 6), claw, [side * 0.26 + (c - 1) * 0.08, 0.05, 0.36]).rotation.x = Math.PI / 2;
  }
  bakePart(body);

  // Head: a furred skull with a bare, dark face, small deep eyes, and horns curling round.
  const head = new THREE.Group();
  head.position.set(0, 2.3, 0.42);
  group.add(head);
  clump(head, 0.27, [0, 0.05, -0.05], [1, 1, 1]);
  part(head, new THREE.SphereGeometry(0.18, 18, 12), skin, [0, -0.02, 0.17]).scale.set(1, 0.95, 0.72);
  // A heavy brow of fur overhanging the deep-set eyes.
  clump(head, 0.1, [0, 0.13, 0.2], [1.6, 0.55, 0.7]);
  for (const side of [-1, 1]) {
    part(head, new THREE.SphereGeometry(0.03, 10, 8), throat, [side * 0.07, 0.05, 0.285]);
    // A curled ram's horn from each temple, sweeping back and round to point forward.
    const turns: THREE.Vector3[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14,
        a = t * Math.PI * 1.6,
        r = 0.21 - t * 0.09;
      turns.push(new THREE.Vector3(side * (0.22 + t * 0.16), 0.14 + Math.cos(a) * r - t * 0.06, 0.02 - Math.sin(a) * r * 0.9 + t * 0.1));
    }
    const curve = new THREE.CatmullRomCurve3(turns);
    const spiral = new THREE.TubeGeometry(curve, 28, 1, 8, false),
      sp = spiral.getAttribute("position");
    // Each ring of the tube narrows towards the tip.
    for (let i = 0; i < sp.count; i++) {
      const along = Math.floor(i / 9) / 28,
        point = curve.getPointAt(along),
        width = 0.075 * (1 - along * 0.75);
      sp.setXYZ(i, point.x + (sp.getX(i) - point.x) * width, point.y + (sp.getY(i) - point.y) * width, point.z + (sp.getZ(i) - point.z) * width);
    }
    spiral.computeVertexNormals();
    part(head, spiral, horn);
  }
  bakePart(head);
  // The jaw hangs open in a snarl and gapes wider when it roars.
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.08, 0.16);
  head.add(jaw);
  part(jaw, new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), skin, [0, 0.02, 0.06]).scale.set(1, 0.6, 0.9);
  part(jaw, new THREE.CircleGeometry(0.11, 16), throat, [0, 0.03, 0.12]).rotation.x = -0.4;
  part(head, new THREE.CircleGeometry(0.1, 16), gum, [0, -0.07, 0.29]);
  for (let i = 0; i < 6; i++) {
    const x = -0.075 + i * 0.03;
    part(head, new THREE.ConeGeometry(0.011, 0.045, 5), tooth, [x, -0.08, 0.3]).rotation.x = Math.PI;
    part(jaw, new THREE.ConeGeometry(0.01, 0.04, 5), tooth, [x, 0.05, 0.16]);
  }
  // A faint glint deep in each eye.
  const glint = new THREE.MeshBasicMaterial({ color: 0xffc36a, transparent: true, opacity: 0.6 });
  for (const side of [-1, 1]) part(head, new THREE.SphereGeometry(0.009, 8, 6), glint, [side * 0.07, 0.055, 0.31]);

  // Long arms: the right one raised, the left hanging towards the knee, both clawed.
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.58, 2.0, 0.1);
    group.add(arm);
    clump(arm, 0.22, [0, -0.25, 0], [1, 1.6, 1]);
    clump(arm, 0.19, [0, -0.72, 0.05], [1, 1.7, 1], shade);
    const hand = new THREE.Group();
    hand.position.set(0, -1.05, 0.08);
    arm.add(hand);
    part(hand, new THREE.SphereGeometry(0.1, 12, 8), skin).scale.set(1, 0.8, 1.2);
    for (let c = 0; c < 3; c++) {
      const tip = part(hand, new THREE.ConeGeometry(0.022, 0.16, 6), claw, [(c - 1) * 0.055, -0.08, 0.09]);
      tip.rotation.x = Math.PI * 0.75;
    }
    bakePart(arm);
    return arm;
  });
  arms[1].rotation.set(-0.55, 0, 0.95);
  arms[0].rotation.set(-0.2, 0, 0.12);

  return {
    group,
    head,
    /** `snarl` 0 to 1 opens the jaw and lifts the head; `look` turns the head (radians). */
    pose: (time: number, snarl: number, look: number, still: boolean) => {
      const breath = still ? 0 : Math.sin(time * 1.6);
      body.scale.set(1 + breath * 0.012, 1 + breath * 0.02, 1 + breath * 0.012);
      head.rotation.y = look;
      head.rotation.x = 0.18 - snarl * 0.3 + (still ? 0 : Math.sin(time * 0.9) * 0.03);
      jaw.rotation.x = 0.25 + snarl * 0.45;
      // The raised arm swings up and out, claws spread, as it snarls.
      arms[1].rotation.x = -0.55 - snarl * 0.3 + (still ? 0 : Math.sin(time * 1.1) * 0.05);
      arms[1].rotation.z = 0.95 + snarl * 0.35;
    },
  };
}
