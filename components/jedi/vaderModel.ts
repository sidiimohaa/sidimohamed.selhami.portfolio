import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** Darth Vader. "confront" faces the visitor, blade lit; "watch" stands with hands behind his back,
 * the saber hanging unlit at his belt. Front is +Z, feet at y = 0, about two metres tall. */
export function createDarkLord(pose: "confront" | "watch" = "confront") {
  const group = new THREE.Group();
  group.name = "dark-lord";
  const gloss = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.12, metalness: 0.35 });
  const suit = new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.5, metalness: 0.1 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x070708, roughness: 0.95, side: THREE.DoubleSide });
  const grey = new THREE.MeshStandardMaterial({ color: 0x585c61, roughness: 0.32, metalness: 0.85 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xa2a8ae, roughness: 0.22, metalness: 0.92 });
  const lens = new THREE.MeshStandardMaterial({ color: 0x14080a, roughness: 0.02, metalness: 0.7 });
  const lamp = (color: number) => new THREE.MeshBasicMaterial({ color });
  const add = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, at: [number, number, number], scale?: [number, number, number], rotation?: [number, number, number]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...at);
    if (scale) mesh.scale.set(...scale);
    if (rotation) mesh.rotation.set(...rotation);
    parent.add(mesh);
    return mesh;
  };
  const tube = (parent: THREE.Object3D, points: [number, number, number][], radius: number, material: THREE.Material) =>
    add(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 24, radius, 8, false), material, [0, 0, 0]);

  // Helmet: a glossy dome flaring into a wide skirt at the back and sides, a heavy brow, slanted
  // eye lenses, angular cheeks and the triangular grille of the respirator.
  const head = new THREE.Group();
  head.position.y = 1.86;
  group.add(head);
  add(head, new THREE.SphereGeometry(0.15, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2), gloss, [0, 0, 0], [1, 1.08, 1.12]);
  add(head, new THREE.BoxGeometry(0.012, 0.02, 0.3), gloss, [0, 0.155, -0.01]);
  // The flared back of the helmet, listed from the rim upwards so that its faces point outwards, and
  // lit on both sides so that it also reads from underneath.
  const flareGloss = gloss.clone();
  flareGloss.side = THREE.DoubleSide;
  const flareAngle = 0.95;
  const flareLength = Math.PI * 2 - flareAngle * 2;
  const flareProfile = [new THREE.Vector2(0.262, -0.25), new THREE.Vector2(0.245, -0.21), new THREE.Vector2(0.2, -0.15), new THREE.Vector2(0.165, -0.07), new THREE.Vector2(0.15, 0.002)];
  add(head, new THREE.LatheGeometry(flareProfile, 48, flareAngle, flareLength), flareGloss, [0, 0, 0], [1, 1, 1.08]);
  // The rolled lip along its lower edge, the raised ridge down the middle of the back, and the dark
  // inside of the helmet, so that nothing shows through it.
  const lip: [number, number, number][] = [];
  for (let i = 0; i <= 28; i++) {
    const phi = flareAngle + (i / 28) * flareLength;
    lip.push([Math.sin(phi) * 0.263, -0.25, Math.cos(phi) * 0.263 * 1.08]);
  }
  tube(head, lip, 0.0085, gloss);
  tube(head, [[0, 0.158, -0.03], [0, 0.11, -0.122], [0, 0.03, -0.172], [0, -0.07, -0.183], [0, -0.15, -0.222], [0, -0.238, -0.284]], 0.0075, gloss);
  for (const side of [-1, 1]) {
    tube(head, [[side * 0.1, -0.012, -0.135], [side * 0.126, -0.1, -0.15], [side * 0.165, -0.17, -0.178], [side * 0.195, -0.238, -0.214]], 0.0045, gloss);
  }
  add(head, new THREE.CylinderGeometry(0.15, 0.17, 0.26, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0x030304, roughness: 1, side: THREE.DoubleSide }), [0, -0.13, -0.008]);
  const brow: [number, number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    const t = -0.9 + (i / 10) * 1.8;
    brow.push([Math.sin(t) * 0.154, -0.012 - Math.abs(t) * 0.01, Math.cos(t) * 0.17]);
  }
  tube(head, brow, 0.017, gloss);
  for (const side of [-1, 1]) {
    add(head, new THREE.SphereGeometry(1, 18, 12), lens, [side * 0.047, -0.055, 0.158], [0.036, 0.024, 0.012], [0, side * 0.18, side * 0.28]);
    add(head, new THREE.BoxGeometry(0.06, 0.1, 0.035), gloss, [side * 0.058, -0.115, 0.142], undefined, [0.1, side * 0.35, side * 0.38]);
    add(head, new THREE.CylinderGeometry(0.009, 0.012, 0.06, 8), grey, [side * 0.075, -0.155, 0.135], undefined, [0.3, 0, side * 0.5]);
  }
  add(head, new THREE.BoxGeometry(0.02, 0.075, 0.025), gloss, [0, -0.07, 0.165]);
  const grille = add(head, new THREE.ConeGeometry(0.058, 0.095, 3), grey, [0, -0.152, 0.152], [1, 1, 0.35], [Math.PI, 0, 0]);
  grille.rotation.y = Math.PI;
  for (let i = 0; i < 3; i++) add(head, new THREE.BoxGeometry(0.05 - i * 0.012, 0.004, 0.01), suit, [0, -0.135 - i * 0.017, 0.17]);
  add(head, new THREE.BoxGeometry(0.14, 0.045, 0.07), gloss, [0, -0.205, 0.118]);
  add(group, new THREE.CylinderGeometry(0.066, 0.076, 0.17, 16), suit, [0, 1.66, 0]);

  // Shoulder armour over a grey ribbed yoke, the chest box with its lights, a quilted tunic.
  // A rounded mantle over the shoulders, heavy pads, and the two grey plates of the collar in a V.
  add(group, new THREE.SphereGeometry(1, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), gloss, [0, 1.44, -0.005], [0.39, 0.2, 0.225]);
  for (const side of [-1, 1]) {
    add(group, new THREE.SphereGeometry(0.15, 22, 14), gloss, [side * 0.3, 1.5, 0], [1.02, 0.62, 1.14]);
    add(group, new RoundedBoxGeometry(0.15, 0.13, 0.024, 2, 0.01), grey, [side * 0.085, 1.5, 0.2], undefined, [-0.28, side * 0.2, side * -0.3]);
    for (let i = 0; i < 3; i++) add(group, new THREE.BoxGeometry(0.01, 0.105, 0.008), suit, [side * (0.045 + i * 0.04), 1.5, 0.214], undefined, [-0.28, side * 0.2, side * -0.3]);
  }
  const torso = new THREE.CylinderGeometry(0.25, 0.205, 0.58, 36, 4),
    tp = torso.getAttribute("position");
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i),
      z = tp.getZ(i),
      ridge = 1 + Math.cos(Math.atan2(x, z) * 30) * 0.02;
    tp.setXYZ(i, x * ridge, tp.getY(i), z * ridge * 0.85);
  }
  torso.computeVertexNormals();
  add(group, torso, suit, [0, 1.17, 0]);
  add(group, new RoundedBoxGeometry(0.17, 0.14, 0.035, 2, 0.008), new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.4, metalness: 0.5 }), [0, 1.27, 0.2]);
  for (let i = 0; i < 3; i++) add(group, new THREE.BoxGeometry(0.045, 0.008, 0.006), lamp(0xff3030), [-0.04, 1.31 - i * 0.017, 0.219]);
  add(group, new THREE.BoxGeometry(0.018, 0.018, 0.006), lamp(0x2f7dff), [0.035, 1.31, 0.219]);
  add(group, new THREE.BoxGeometry(0.018, 0.018, 0.006), lamp(0xff2a2a), [0.035, 1.285, 0.219]);
  for (let i = 0; i < 4; i++) add(group, new THREE.BoxGeometry(0.022, 0.03, 0.008), i % 2 ? steel : grey, [-0.051 + i * 0.034, 1.238, 0.219]);
  for (const side of [-1, 1]) add(group, new THREE.CylinderGeometry(0.005, 0.005, 0.15, 6), steel, [side * 0.1, 1.27, 0.21]);

  // The belt with its two control boxes and the round buckle.
  add(group, new THREE.CylinderGeometry(0.205, 0.205, 0.06, 32), gloss, [0, 0.98, 0], [1, 1, 0.85]);
  add(group, new RoundedBoxGeometry(0.1, 0.075, 0.03, 2, 0.008), steel, [0, 0.98, 0.178]);
  add(group, new THREE.CylinderGeometry(0.026, 0.026, 0.01, 18), grey, [0, 0.98, 0.196], undefined, [Math.PI / 2, 0, 0]);
  for (const side of [-1, 1]) {
    add(group, new RoundedBoxGeometry(0.085, 0.06, 0.03, 2, 0.006), new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.4, metalness: 0.6 }), [side * 0.13, 0.98, 0.15], undefined, [0, side * 0.5, 0]);
    for (let i = 0; i < 2; i++) add(group, new THREE.BoxGeometry(0.014, 0.014, 0.006), lamp(i === 1 && side > 0 ? 0xff3030 : 0x2fe060), [side * (0.115 + i * 0.022), 0.985, 0.168 - i * 0.012]);
  }
  // The robe falls to the floor behind and to the sides, open at the front over armoured legs.
  const robe = new THREE.CylinderGeometry(0.22, 0.34, 0.94, 32, 6, true, 0.55, Math.PI * 2 - 1.1),
    rp = robe.getAttribute("position");
  for (let i = 0; i < rp.count; i++) {
    const x = rp.getX(i),
      y = rp.getY(i),
      z = rp.getZ(i),
      fold = 1 + Math.sin(Math.atan2(x, z) * 10) * 0.04 * (0.5 - y / 0.94);
    rp.setXYZ(i, x * fold, y, z * fold);
  }
  robe.computeVertexNormals();
  add(group, robe, cloth, [0, 0.5, 0]);
  // Over the legs, the heavy leather tabard that falls from the belt to the knees.
  const tabard = new THREE.CylinderGeometry(0.205, 0.285, 0.5, 26, 4, true, -1.15, 2.3),
    ap = tabard.getAttribute("position");
  for (let i = 0; i < ap.count; i++) {
    const fold = 1 + Math.sin(Math.atan2(ap.getX(i), ap.getZ(i)) * 8) * 0.035 * (0.5 - ap.getY(i) / 0.5);
    ap.setXYZ(i, ap.getX(i) * fold, ap.getY(i), ap.getZ(i) * fold);
  }
  tabard.computeVertexNormals();
  add(group, tabard, cloth, [0, 0.71, 0.005]);
  const legs = [-1, 1].map((side) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.115, 0.94, 0.01);
    group.add(leg);
    add(leg, new THREE.CylinderGeometry(0.105, 0.085, 0.46, 18), suit, [0, -0.22, 0]);
    const shin = new THREE.Group();
    shin.position.y = -0.46;
    leg.add(shin);
    add(shin, new THREE.SphereGeometry(0.078, 16, 12), gloss, [0, 0, 0.012]);
    add(shin, new THREE.CylinderGeometry(0.088, 0.078, 0.4, 18), gloss, [0, -0.22, 0]);
    add(shin, new RoundedBoxGeometry(0.115, 0.34, 0.05, 2, 0.022), gloss, [0, -0.22, 0.072]);
    add(shin, new RoundedBoxGeometry(0.135, 0.095, 0.3, 2, 0.034), gloss, [0, -0.432, 0.064]);
    return { leg, shin };
  });

  // Arms: the left reaches out towards the visitor, the right holds the blade low.
  const arm = (side: number) => {
    const root = new THREE.Group();
    root.position.set(side * 0.345, 1.49, 0);
    group.add(root);
    add(root, new THREE.CylinderGeometry(0.088, 0.075, 0.32, 16), suit, [0, -0.16, 0]);
    const elbow = new THREE.Group();
    elbow.position.y = -0.31;
    root.add(elbow);
    add(elbow, new THREE.SphereGeometry(0.075, 14, 10), suit, [0, 0, 0]);
    add(elbow, new THREE.CylinderGeometry(0.072, 0.058, 0.26, 16), suit, [0, -0.13, 0]);
    const cuff = new THREE.CylinderGeometry(0.076, 0.062, 0.14, 18),
      cp = cuff.getAttribute("position");
    for (let i = 0; i < cp.count; i++) {
      const ridge = 1 + Math.cos(Math.atan2(cp.getX(i), cp.getZ(i)) * 16) * 0.04;
      cp.setXYZ(i, cp.getX(i) * ridge, cp.getY(i), cp.getZ(i) * ridge);
    }
    cuff.computeVertexNormals();
    add(elbow, cuff, gloss, [0, -0.2, 0]);
    add(elbow, new RoundedBoxGeometry(0.09, 0.1, 0.055, 2, 0.018), gloss, [0, -0.315, 0.01]);
    for (let finger = 0; finger < 4; finger++) add(elbow, new THREE.CapsuleGeometry(0.0115, 0.055, 3, 6), gloss, [-0.03 + finger * 0.02, -0.395, 0.014]);
    add(elbow, new THREE.CapsuleGeometry(0.013, 0.04, 3, 6), gloss, [-side * 0.052, -0.335, 0.03], undefined, [0, 0, -side * 0.5]);
    return { root, elbow };
  };
  const left = arm(-1),
    right = arm(1);
  const saber = new THREE.Group();
  if (pose === "watch") {
    // Hands clasped behind the back, the hilt at the belt.
    left.root.rotation.set(0.32, 0, 0.16);
    left.elbow.rotation.x = 1.05;
    right.root.rotation.set(0.32, 0, -0.16);
    right.elbow.rotation.x = 1.05;
    saber.position.set(0.17, 0.86, 0.13);
    saber.rotation.set(0, 0, 0.12);
    group.add(saber);
  } else {
    left.root.rotation.set(-1.25, 0.25, -0.12);
    left.elbow.rotation.x = -0.25;
    right.root.rotation.set(-0.15, 0, 0.12);
    right.elbow.rotation.x = -0.55;
    // A red blade from the right hand, angled down and forward.
    saber.position.set(0, -0.32, 0.05);
    saber.rotation.set(Math.PI - 0.55, 0, 0.3);
    right.elbow.add(saber);
  }
  add(saber, new THREE.CylinderGeometry(0.017, 0.017, 0.26, 12), steel, [0, 0, 0]);
  for (let i = 0; i < 5; i++) add(saber, new THREE.CylinderGeometry(0.019, 0.019, 0.012, 12), suit, [0, -0.06 + i * 0.03, 0]);
  add(saber, new THREE.CylinderGeometry(0.012, 0.012, 1, 10), lamp(0xffe9ea), [0, 0.63, 0]);
  const blade = add(
    saber,
    new THREE.CylinderGeometry(0.036, 0.036, 1.02, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
    [0, 0.63, 0],
  ) as THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  add(saber, new THREE.CylinderGeometry(0.075, 0.075, 1.05, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending }), [0, 0.63, 0]);
  // At rest the blade is off: only the hilt shows.
  if (pose === "watch") saber.children.slice(6).forEach((part) => (part.visible = false));

  // The cape, from the shoulders to the floor, wrapping round the back and sides.
  const cape = new THREE.CylinderGeometry(0.37, 0.98, 1.66, 56, 8, true, Math.PI / 2 - 0.2, Math.PI + 0.4),
    kp = cape.getAttribute("position");
  for (let i = 0; i < kp.count; i++) {
    const x = kp.getX(i),
      y = kp.getY(i),
      z = kp.getZ(i),
      low = 0.5 - y / 1.66,
      fold = 1 + Math.sin(Math.atan2(x, z) * 11) * 0.075 * low + Math.sin(Math.atan2(x, z) * 29) * 0.016 * low;
    kp.setXYZ(i, x * fold, y, z * fold);
  }
  cape.computeVertexNormals();
  const capeMesh = add(group, cape, cloth, [0, 0.75, -0.04]);
  // The blade grows out of the hilt; 0 is off and 1 is fully lit.
  const bladeParts = saber.children.slice(6);
  const setBlade = (amount: number) => {
    const k = Math.max(amount, 0.001);
    bladeParts.forEach((part) => {
      part.visible = amount > 0.001;
      part.scale.y = k;
      part.position.y = 0.12 + 0.51 * k;
    });
  };
  return { group, blade, head, chest: torso, arms: { left, right }, legs, cape: capeMesh, setBlade };
}
