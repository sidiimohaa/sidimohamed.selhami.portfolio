import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { bakePart, part, pipe } from "./tatooineCharacters";

type XYZ = [number, number, number];
type Obstacle = { u: number; v: number; r: number };

/** Street furniture in district coordinates. The central pedestrian lane stays clear. */
export function createTatooineMarket() {
  const group = new THREE.Group(); group.name = "mos-eisley-market-furniture";
  const colliders: Obstacle[] = [];
  const paint = document.createElement("canvas"); paint.width = paint.height = 256;
  const c = paint.getContext("2d")!;
  let seed = 7794;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  c.fillStyle = "#d6c7ac"; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1100; i++) {
    c.fillStyle = i % 4 ? "#403a2c15" : "#f9edd63a";
    c.fillRect(rand() * 256, rand() * 256, 1 + rand() * 7, .4 + rand() * 2);
  }
  const finish = new THREE.CanvasTexture(paint); finish.colorSpace = THREE.SRGBColorSpace; finish.anisotropy = 8;
  const steel = new THREE.MeshStandardMaterial({ color: 0x888b80, map: finish, roughness: .7, metalness: .48 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3b3a31, roughness: .85, metalness: .28 });
  const pale = new THREE.MeshStandardMaterial({ color: 0xdcd4b7, map: finish, roughness: .82, metalness: .1 });
  const rust = new THREE.MeshStandardMaterial({ color: 0xa57a4b, map: finish, roughness: .87, metalness: .28 });
  const wicker = new THREE.MeshStandardMaterial({ color: 0xa99061, map: finish, roughness: 1 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0xc7b28b, map: finish, roughness: 1, side: THREE.DoubleSide });
  const green = new THREE.MeshStandardMaterial({ color: 0x899055, roughness: .86 });
  const violet = new THREE.MeshStandardMaterial({ color: 0x6d5c68, roughness: .8 });
  const ochre = new THREE.MeshStandardMaterial({ color: 0xc19459, roughness: .86 });
  const box = (root: THREE.Group, w: number, h: number, d: number, mat: THREE.Material, at: XYZ, radius = 0) =>
    part(root, radius ? new RoundedBoxGeometry(w, h, d, 1, radius) : new THREE.BoxGeometry(w, h, d), mat, at);
  const cylinder = (root: THREE.Group, r1: number, r2: number, h: number, mat: THREE.Material, at: XYZ, segments = 12) =>
    part(root, new THREE.CylinderGeometry(r1, r2, h, segments), mat, at);
  const ring = (root: THREE.Group, radius: number, thickness: number, mat: THREE.Material, at: XYZ) =>
    part(root, new THREE.TorusGeometry(radius, thickness, 4, 14), mat, at, [Math.PI / 2, 0, 0]);
  const block = (u: number, v: number, r: number) => colliders.push({ u, v, r });
  const place = (name: string, u: number, v: number, yaw = 0) => {
    const root = new THREE.Group(); root.name = name; root.position.set(u, -.055, v); root.rotation.y = yaw; group.add(root); return root;
  };
  function fruitBowl(root: THREE.Group, x: number, y: number, z: number, color: THREE.Material, radius = .27) {
    cylinder(root, radius, radius * .75, .18, wicker, [x, y, z], 14);
    ring(root, radius, .025, wicker, [x, y + .1, z]);
    for (let rib = 0; rib < 10; rib++) {
      const a = rib / 10 * Math.PI * 2;
      box(root, .018, .17, .022, dark, [x + Math.sin(a) * radius * .91, y, z + Math.cos(a) * radius * .91]);
    }
    for (let fruit = 0; fruit < 10; fruit++) {
      const a = fruit * 2.4, reach = Math.sqrt(fruit / 10) * radius * .75;
      const m = part(root, new THREE.IcosahedronGeometry(.061 + fruit % 3 * .008, 0), color,
        [x + Math.sin(a) * reach, y + .13 + (fruit % 4 === 0 ? .055 : 0), z + Math.cos(a) * reach]);
      m.scale.y = fruit % 3 ? .9 : 1.3;
    }
  }
  function pedestal(root: THREE.Group, x: number, z: number, material: THREE.Material, variant: number) {
    const profile = [new THREE.Vector2(0, 0), new THREE.Vector2(.22, 0), new THREE.Vector2(.23, .06), new THREE.Vector2(.15, .18), new THREE.Vector2(.13, .45), new THREE.Vector2(.24, .66), new THREE.Vector2(.29, .7)];
    part(root, new THREE.LatheGeometry(profile, 12), material, [x, 0, z]);
    for (let band = 0; band < 4; band++) ring(root, .151 + band * .014, .013, rust, [x, .24 + band * .08, z]);
    fruitBowl(root, x, .76, z, [green, violet, ochre][variant % 3], .29);
  }
  function hangingProduce(root: THREE.Group, x: number, z: number, variant: number) {
    cylinder(root, .007, .007, .48, dark, [x, 1.88, z], 6);
    for (let j = 0; j < 4; j++) {
      const f = part(root, new THREE.IcosahedronGeometry(.052, 0), variant % 2 ? ochre : violet,
        [x + (j % 2 ? .035 : -.035), 2.07 - j * .1, z]);
      f.scale.set(.7, 1.6, .75);
    }
  }
  function stall(u: number, v: number, side: number, variant: number) {
    const root = place(`produce-stall-${variant}`, u, v, side < 0 ? Math.PI / 2 : -Math.PI / 2);
    // The counter and baskets occupy the same footprint as the old simple shop counter.
    box(root, 2.8, .1, .78, dark, [0, .91, 0], .025);
    for (const x of [-1.1, 1.1]) {
      box(root, .13, .85, .62, rust, [x, .43, 0]);
      box(root, .22, .06, .73, dark, [x, .035, 0]);
    }
    for (let slat = 0; slat < 9; slat++) box(root, .25, .71, .045, wicker, [-1.12 + slat * .28, .49, .39]);
    for (const y of [.18, .72]) box(root, 2.72, .055, .06, dark, [0, y, .42]);
    for (let i = 0; i < 3; i++) fruitBowl(root, -.83 + i * .83, 1.06, .05, [green, violet, ochre][(i + variant) % 3]);
    const awning = new THREE.PlaneGeometry(3.1, 1.28, 12, 5); awning.rotateX(-Math.PI / 2);
    const p = awning.getAttribute("position");
    for (let i = 0; i < p.count; i++) p.setY(i, -.11 * Math.sin((p.getX(i) + 1.55) / 3.1 * Math.PI) - .07 * Math.sin((p.getZ(i) + .64) / 1.28 * Math.PI));
    awning.computeVertexNormals(); part(root, awning, cloth, [0, 2.37, .02]);
    const valance = new THREE.PlaneGeometry(3.1, .23, 12, 1), vp = valance.getAttribute("position");
    for (let i = 0; i < vp.count; i++) if (vp.getY(i) < 0) vp.setY(i, vp.getY(i) + Math.sin(vp.getX(i) * 8) * .033);
    valance.computeVertexNormals(); part(root, valance, cloth, [0, 2.17, .66]);
    for (const x of [-1.5, 1.5]) for (const z of [-.6, .35]) {
      cylinder(root, .025, .037, 2.37, dark, [x, 1.185, z], 8);
      const realU = u - side * z, realV = v + (side < 0 ? -x : x); block(realU, realV, .06);
    }
    for (let i = 0; i < 6; i++) hangingProduce(root, -1.2 + i * .48, -.31, variant + i);
    pedestal(root, -1.84, .03, pale, variant);
    pedestal(root, 1.84, .02, variant % 2 ? rust : steel, variant + 1);
    for (const x of [-1, 0, 1]) block(u, v + x, .46);
    block(u - side * .03, v + (side < 0 ? 1.84 : -1.84), .34);
    block(u - side * .02, v + (side < 0 ? -1.84 : 1.84), .34);
    box(root, .54, .48, .51, rust, [-2.4, .25, -.01], .018);
    box(root, .61, .06, .57, dark, [-2.4, .52, -.01]);
    block(u, v + (side < 0 ? 2.4 : -2.4), .4);
  }
  stall(-4.3, 28, -1, 0);
  stall(4.3, 38, 1, 1);
  stall(5.0, 55, 1, 2);

  function crate(root: THREE.Group, x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) {
    box(root, w, h, d, mat, [x, y + h / 2, z], .035);
    for (const side of [-1, 1]) {
      for (const u of [-w * .36, w * .36]) box(root, .055, h * .91, .035, dark, [x + u, y + h / 2, z + side * (d / 2 + .015)]);
      box(root, w * .44, .065, .04, dark, [x, y + h * .76, z + side * (d / 2 + .025)]);
      for (let rib = 0; rib < 3; rib++) box(root, w * .69, .023, .025, pale, [x, y + .14 + rib * .13, z + side * (d / 2 + .025)]);
    }
    for (const u of [-w * .25, w * .25]) box(root, .07, .027, d * .9, steel, [x + u, y + h / 2 * 2 + .016, z]);
  }
  function drum(root: THREE.Group, x: number, z: number, r: number, h: number, material: THREE.Material) {
    cylinder(root, r * .94, r, h, material, [x, h / 2, z], 16);
    for (const y of [.07, h * .45, h - .07]) ring(root, r * 1.01, .025, dark, [x, y, z]);
    cylinder(root, r * .74, r * .78, .085, dark, [x, h + .03, z], 16);
    part(root, new THREE.TorusGeometry(.055, .014, 5, 10), steel, [x, h * .78, z + r]);
  }
  function salvage(u: number, v: number, mirrored: boolean) {
    const root = place(mirrored ? "market-service-generator" : "market-salvage-cargo", u, v, mirrored ? -.15 : .18);
    crate(root, -.39, 0, 0, .78, .69, .65, steel);
    crate(root, -.43, .71, 0, .59, .33, .5, rust);
    crate(root, .34, 0, .15, .57, .56, .62, pale);
    drum(root, .96, -.03, .3, 1.14, mirrored ? steel : rust);
    drum(root, -.98, -.15, .24, .9, dark);
    box(root, .63, .42, .5, dark, [.08, 1.14, -.06], .022);
    for (let vent = 0; vent < 7; vent++) box(root, .4, .025, .02, rust, [.08, .99 + vent * .048, .21]);
    for (const x of [-.17, .32]) cylinder(root, .12, .12, .2, steel, [x, 1.45, -.04], 10);
    pipe(root, [[-.17, 1.55, -.04], [-.17, 1.68, -.04], [.32, 1.68, -.04], [.32, 1.55, -.04]], .04, dark);
    // A cloth thrown over the last case makes the storage pile feel used.
    const tarp = new THREE.PlaneGeometry(.63, .85, 5, 7), p = tarp.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i); p.setZ(i, .035 * Math.sin(p.getX(i) * 19) + (y > 0 ? (y / .425) * -.3 : 0));
    }
    tarp.computeVertexNormals(); part(root, tarp, cloth, [.37, .55, .49]);
    block(u - .5, v, .7); block(u + .7, v, .63);
  }
  salvage(-6.2, 35.7, false);
  salvage(6.7, 44.8, true);

  // Two café tables just beyond the north-east shop; every seat remains in walking range.
  const terrace = place("mos-eisley-shaded-terrace", 0, 0);
  const chair = (u: number, v: number, yaw: number) => {
    const root = new THREE.Group(); root.position.set(u, 0, v); root.rotation.y = yaw; terrace.add(root);
    box(root, .54, .11, .53, dark, [0, .42, 0], .025);
    box(root, .51, .15, .49, rust, [0, .5, 0], .025);
    box(root, .54, .58, .09, dark, [0, .83, -.24], .025);
    for (let rib = 0; rib < 4; rib++) box(root, .49, .035, .025, wicker, [0, .64 + rib * .12, -.178]);
    for (const x of [-.21, .21]) for (const z of [-.2, .2]) cylinder(root, .025, .035, .41, steel, [x, .205, z], 8);
    block(u, v, .36);
  };
  for (const [u, v] of [[5.8, 73.9], [8.3, 74.2]]) {
    cylinder(terrace, .52, .5, .065, pale, [u, .76, v], 24);
    cylinder(terrace, .17, .25, .68, rust, [u, .36, v], 16);
    for (let vent = 0; vent < 10; vent++) {
      const a = vent / 10 * Math.PI * 2;
      box(terrace, .025, .12, .025, dark, [u + Math.cos(a) * .2, .35, v + Math.sin(a) * .2]);
    }
    for (const dx of [-.17, .18]) {
      cylinder(terrace, .045, .04, .13, dx < 0 ? steel : ochre, [u + dx, .86, v], 10);
      ring(terrace, .045, .006, pale, [u + dx, .926, v]);
    }
    block(u, v, .58); chair(u - .86, v, Math.PI / 2); chair(u + .86, v, -Math.PI / 2);
  }
  const sail = new THREE.PlaneGeometry(4.7, 2.6, 12, 8); sail.rotateX(-Math.PI / 2);
  const sp = sail.getAttribute("position");
  for (let i = 0; i < sp.count; i++) sp.setY(i, -.23 * Math.sin((sp.getX(i) + 2.35) / 4.7 * Math.PI) - .12 * Math.cos(sp.getZ(i) * .8));
  sail.computeVertexNormals(); part(terrace, sail, cloth, [7.05, 2.63, 74.1]);
  for (const [u, v] of [[4.7, 72.8], [9.4, 72.8], [4.7, 75.4], [9.4, 75.4]]) {
    cylinder(terrace, .025, .038, 2.66, dark, [u, 1.33, v], 8); block(u, v, .06);
  }
  bakePart(group);
  // Restore vertex sharing after the material bake, preserving UV seams and hard normals.
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const original = object.geometry;
    object.geometry = mergeVertices(original, 1e-5);
    original.dispose();
  });
  return { group, colliders };
}
