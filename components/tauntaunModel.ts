import * as THREE from "three";
import { bakePart, part, pipe, rounded } from "./tatooineCharacters";

type XYZ = [number, number, number];

/** A saddled Echo Base tauntaun, feet at Y=0 and muzzle facing +Z. */
export function createTauntaun(seed = 0) {
  const root = new THREE.Group(); root.name = "hoth-tauntaun";
  const fur = new THREE.MeshStandardMaterial({ color: 0xd1d4cb, roughness: .98 });
  const mane = new THREE.MeshStandardMaterial({ color: 0xe5e4d9, roughness: 1 });
  const skin = new THREE.MeshStandardMaterial({ color: 0x8f9690, roughness: .84 });
  const horn = new THREE.MeshStandardMaterial({ color: 0xb0a98a, roughness: .8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x252a27, roughness: .6 });
  const eye = new THREE.MeshStandardMaterial({ color: 0x30291e, roughness: .21 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x414941, roughness: .87 });
  const blanket = new THREE.MeshStandardMaterial({ color: 0x7c847d, roughness: 1 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9da7a5, roughness: .44, metalness: .65 });
  const body = new THREE.Group(); root.add(body);
  const sphere = (parent: THREE.Object3D, at: XYZ, scale: XYZ, material = fur) => {
    const mesh = part(parent, new THREE.SphereGeometry(1, 18, 12), material, at);
    mesh.scale.set(...scale); return mesh;
  };
  // Tapered tufts sit on an ellipsoid, following the coat downwards. They are
  // baked into one mesh per material, rather than issuing a draw call per hair.
  const coat = (parent: THREE.Group, center: XYZ, radii: XYZ, count: number, material = fur) => {
    for (let i = 0; i < count; i++) {
      const y = 1 - (i + .5) / count * 2;
      const a = i * 2.399963 + seed * .7;
      const s = Math.sqrt(1 - y * y), n = new THREE.Vector3(Math.cos(a) * s, y, Math.sin(a) * s);
      const mesh = part(parent, new THREE.ConeGeometry(.025 + (i % 4) * .004, .10 + (i % 5) * .014, 4), material,
        [center[0] + n.x * radii[0], center[1] + n.y * radii[1], center[2] + n.z * radii[2]]);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(n.x * .4, -.8 + n.y * .25, n.z * .4).normalize());
    }
  };
  sphere(body, [0, 1.55, -.16], [.56, .76, .78]);
  coat(body, [0, 1.55, -.16], [.55, .74, .77], 245);
  // Upright chest and long, shaggy throat are the distinguishing silhouette.
  sphere(body, [0, 2.02, .38], [.36, .79, .37], mane).rotation.x = -.2;
  coat(body, [0, 2.05, .38], [.34, .71, .35], 135, mane);
  // Thick thighs, bent hocks and broad three-toed feet. Each leg hangs from its hip so it can swing;
  // the inner group keeps the coordinates the model was drawn in.
  const hips: THREE.Group[] = [], limbs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group(), limb = new THREE.Group();
    hip.position.set(side * .42, 1.19, -.17);
    limb.position.set(-side * .42, -1.19, .17);
    hip.add(limb); root.add(hip);
    hips.push(hip); limbs.push(limb);
    sphere(limb, [side * .42, 1.19, -.17], [.29, .5, .38]);
    pipe(limb, [[side * .42, 1.14, -.17], [side * .43, .65, -.4], [side * .45, .17, -.1]], .115, fur);
    sphere(limb, [side * .45, .12, .03], [.17, .12, .27]);
    for (let toe = -1; toe <= 1; toe++) {
      sphere(limb, [side * .45 + toe * .09, .075, .2 + (toe === 0 ? .045 : 0)], [.058, .065, .15], skin);
      part(limb, new THREE.ConeGeometry(.035, .09, 6), dark, [side * .45 + toe * .09, .058, .345 + (toe === 0 ? .045 : 0)], [Math.PI / 2, 0, 0]);
    }
    // Short arms, elbows tucked against the chest, three little claws.
    pipe(body, [[side * .3, 2.08, .46], [side * .43, 1.59, .61], [side * .36, 1.46, .77]], .065, fur);
    sphere(body, [side * .36, 1.45, .77], [.078, .085, .09], skin);
    for (let digit = 0; digit < 3; digit++) pipe(body, [[side * (.31 + digit * .045), 1.44, .81], [side * (.31 + digit * .045), 1.38, .85]], .013, dark);
  }
  // Worn blanket under a raised leather saddle; rolled bed and panniers.
  sphere(body, [0, 2.13, -.35], [.58, .14, .61], blanket);
  part(body, rounded(.58, .13, .65, .06), leather, [0, 2.28, -.36]);
  for (const z of [-.7, -.05]) part(body, rounded(.64, .19, .11, .045), leather, [0, 2.38, z], [z < -.3 ? -.15 : .1, 0, 0]);
  for (const side of [-1, 1]) {
    pipe(body, [[side * .27, 2.27, -.29], [side * .59, 1.86, -.23], [side * .44, 1.14, -.1]], .025, leather);
    part(body, rounded(.12, .035, .18, .015), metal, [side * .44, 1.09, -.06]);
    part(body, rounded(.24, .35, .3, .045), leather, [side * .57, 1.86, -.69], [0, 0, side * -.12]);
    part(body, rounded(.26, .1, .32, .035), blanket, [side * .57, 2.03, -.69]);
    for (const y of [1.78, 1.99]) part(body, new THREE.BoxGeometry(.035, .045, .32), leather, [side * .57, y, -.69]);
    part(body, rounded(.065, .07, .012, .008), metal, [side * .57, 1.85, -.527]);
  }
  part(body, new THREE.CylinderGeometry(.13, .13, .72, 14), blanket, [0, 2.25, -.9], [0, 0, Math.PI / 2]);
  for (const x of [-.23, .23]) part(body, new THREE.TorusGeometry(.135, .013, 5, 18), leather, [x, 2.25, -.9], [0, Math.PI / 2, 0]);
  bakePart(body);
  limbs.forEach((limb) => bakePart(limb));

  const head = new THREE.Group(); head.name = "tauntaun-head"; head.position.set(0, 2.65, .48); root.add(head);
  sphere(head, [0, .035, .055], [.245, .31, .26]);
  sphere(head, [0, -.04, .27], [.215, .19, .24], skin);
  sphere(head, [0, -.16, .27], [.185, .08, .21], mane);
  for (const side of [-1, 1]) {
    // Heavy jowls and creased nostrils make this an adult patrol animal, not a smooth toy muzzle.
    sphere(head, [side * .162, -.11, .285], [.083, .112, .157], fur);
    sphere(head, [side * .1, .015, .447], [.047, .028, .017], dark).rotation.z = side * .2;
    pipe(head, [[side * .055, .027, .456], [side * .09, .055, .457], [side * .134, .031, .442]], .012, skin);
    pipe(head, [[side * .08, .08, .398], [side * .105, .117, .331], [side * .12, .145, .266]], .014, skin);
    for (let fold = 0; fold < 3; fold++) pipe(head, [[side * (.14 + fold * .017), -.045 - fold * .03, .405], [side * (.18 + fold * .013), -.065 - fold * .028, .365], [side * (.2 + fold * .008), -.082 - fold * .026, .31]], .008, skin);
    sphere(head, [side * .202, .12, .192], [.045, .05, .024], eye).rotation.y = side * .55;
    pipe(head, [[side * .15, .175, .205], [side * .2, .19, .2], [side * .245, .15, .17]], .026, skin);
    pipe(head, [[side * .17, .08, .212], [side * .21, .068, .214], [side * .245, .1, .183]], .012, skin);
    for (let crease = 0; crease < 2; crease++) pipe(head, [[side * .05, .19 + crease * .025, .213], [side * .095, .2 + crease * .025, .222], [side * .14, .19 + crease * .025, .212]], .008, skin);
    sphere(head, [side * .25, .28, -.01], [.105, .18, .057], fur).rotation.z = -side * .55;
    sphere(head, [side * .257, .29, .03], [.059, .115, .012], skin).rotation.z = -side * .55;
    // Curled ram horns grow out beside the ears, down round the cheeks and up at the tips.
    const points: XYZ[] = [[side * .19, .19, -.05], [side * .34, .17, -.09], [side * .4, -.04, -.055], [side * .37, -.19, .09], [side * .31, -.17, .27], [side * .29, -.05, .31]];
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const geo = new THREE.TubeGeometry(curve, 36, .061, 10, false);
    const p = geo.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const t = Math.floor(i / 11) / 36, center = curve.getPointAt(t);
      const shrink = 1.12 - t * .75;
      p.setXYZ(i, center.x + (p.getX(i) - center.x) * shrink, center.y + (p.getY(i) - center.y) * shrink, center.z + (p.getZ(i) - center.z) * shrink);
    }
    geo.computeVertexNormals(); part(head, geo, horn);
    pipe(head, [[side * .21, -.05, .25], [side * .22, -.13, .27], [side * .2, -.18, .34]], .016, leather);
  }
  pipe(head, [[-.15, -.13, .43], [0, -.145, .475], [.15, -.13, .43]], .007, dark);
  coat(head, [0, .025, -.03], [.24, .28, .19], 65);
  // A central forelock and two small horn-like knobs above the brow.
  for (const side of [-1, 1]) part(head, new THREE.ConeGeometry(.045, .1, 8), horn, [side * .1, .32, .06], [.12, 0, -side * .2]);
  bakePart(head);
  // Reins hang loosely from muzzle to saddle, staying below the animal's sightline.
  const tack = new THREE.Group(); root.add(tack);
  for (const side of [-1, 1]) pipe(tack, [[side * .22, 2.51, .75], [side * .34, 2.13, .47], [side * .4, 2.12, -.05], [side * .26, 2.32, -.23]], .012, leather);
  bakePart(tack);
  const tail = new THREE.Group(); tail.name = "tauntaun-tail"; tail.position.set(0, 1.5, -.7); root.add(tail);
  const tailCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -.18, -.5), new THREE.Vector3(.05, -.53, -1.05), new THREE.Vector3(.08, -.62, -1.5)]);
  const tailGeo = new THREE.TubeGeometry(tailCurve, 20, .18, 10, false), tp = tailGeo.getAttribute("position");
  for (let i = 0; i < tp.count; i++) { const t = Math.floor(i / 11) / 20, c = tailCurve.getPointAt(t), factor = 1 - t * .92; tp.setXYZ(i, c.x + (tp.getX(i) - c.x) * factor, c.y + (tp.getY(i) - c.y) * factor, c.z + (tp.getZ(i) - c.z) * factor); }
  tailGeo.computeVertexNormals(); part(tail, tailGeo, fur);
  return { root, tick: (time: number, reduced: boolean) => {
    const t = reduced ? 0 : time;
    head.rotation.y = reduced ? 0 : Math.sin(t * .33 + seed * 1.7) * .13;
    head.rotation.x = reduced ? 0 : Math.sin(t * .49 + seed) * .025;
    tail.rotation.y = reduced ? 0 : Math.sin(t * .7 + seed) * .07;
    body.scale.y = reduced ? 1 : 1 + Math.sin(t * 1.1 + seed) * .004;
  },
  /** A loping stride: `phase` advances with the ground covered, `amount` 0 to 1 eases it in. */
  walk: (phase: number, amount: number) => {
    hips.forEach((hip, i) => hip.rotation.x = Math.sin(phase + i * Math.PI) * .6 * amount);
    const lift = Math.abs(Math.cos(phase)) * .09 * amount;
    body.position.y = lift;
    head.position.y = 2.65 + lift + Math.sin(phase * 2) * .025 * amount;
    head.rotation.x += Math.sin(phase * 2 + .6) * .05 * amount;
    tail.rotation.x = Math.sin(phase * 2) * .06 * amount;
    root.rotation.z = Math.sin(phase) * .025 * amount;
  } };
}
