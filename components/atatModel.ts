import * as THREE from "three";
import { bakePart, part, rounded } from "./tatooineCharacters";
import { random } from "./landingKit";

const UPPER = 6.15, LOWER = 6.4, ANKLE = 1.2;
export const ATAT_SPEED = .55;
export const ATAT_SCALE = 1.35;
const PERIOD = 9, STANCE = .76;

function armorTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const c = canvas.getContext("2d")!, rand = random(1980);
  c.fillStyle = "#d3d6d5"; c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1800; i++) {
    const x = rand() * 512, y = rand() * 512;
    c.fillStyle = i % 4 ? "#3e474c13" : "#ffffff38";
    c.fillRect(x, y, .5 + rand() * 2, 1 + rand() * 22);
  }
  // Restrained scuffs and vertical grime, rather than a noisy camouflage surface.
  for (let i = 0; i < 55; i++) {
    c.fillStyle = "#343f4825";
    c.fillRect(rand() * 512, rand() * 512, 1 + rand() * 4, 2 + rand() * 9);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  return map;
}

/** Four independently articulated legs; static surface details are batched per material. */
export function createATAT() {
  const map = armorTexture();
  const armor = new THREE.MeshStandardMaterial({ color: 0xd5d9d9, map, bumpMap: map, bumpScale: .025, roughness: .74, metalness: .25 });
  const edge = new THREE.MeshStandardMaterial({ color: 0x7c888f, roughness: .68, metalness: .4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x29333c, roughness: .8, metalness: .38 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xa6b1b5, roughness: .33, metalness: .78 });
  const materials = [armor, edge, dark, steel];
  const root = new THREE.Group(); root.name = "imperial-at-at";
  const body = new THREE.Group(); root.add(body);
  const box = (p: THREE.Group, w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => part(p, new THREE.BoxGeometry(w, h, d), mat, [x, y, z]);
  const axis = (p: THREE.Group, radius: number, width: number, mat: THREE.Material, x: number, y: number, z: number) => part(p, new THREE.CylinderGeometry(radius, radius, width, 24), mat, [x, y, z], [0, 0, Math.PI / 2]);
  const strut = (p: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, radius: number, mat: THREE.Material) => {
    const mesh = part(p, new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 8), mat);
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return mesh;
  };

  // Tall slab-sided troop compartment, with a raked bow and a narrower undercarriage.
  const section = new THREE.Shape();
  section.moveTo(-6.5, 14.5); section.lineTo(-6.9, 18.8); section.lineTo(-5.5, 20.1);
  section.lineTo(4.65, 20.1); section.lineTo(6.45, 18.5); section.lineTo(6.25, 14.5); section.closePath();
  const shell = new THREE.ExtrudeGeometry(section, { depth: 6.7, bevelEnabled: true, bevelSize: .08, bevelThickness: .08, bevelSegments: 1 });
  shell.rotateY(-Math.PI / 2); shell.translate(3.35, 0, 0);
  part(body, shell, armor);
  part(body, rounded(5.6, 1.1, 11.9, .14), dark, [0, 14.25, 0]);
  box(body, 5.3, .34, 9.5, edge, 0, 13.6, -.15);
  for (const side of [-1, 1]) {
    // Four pale armor plates separated by fine, recessed seams.
    for (let i = 0; i < 4; i++) {
      const z = -4.55 + i * 2.8;
      box(body, .095, 4.95, 2.65, edge, side * 3.405, 17.25, z);
      box(body, .115, 4.84, 2.54, armor, side * 3.46, 17.26, z);
      for (const dy of [-2.11, 2.11]) for (const dz of [-1.01, 1.01])
        axis(body, .055, .035, dark, side * 3.53, 17.26 + dy, z + dz);
      box(body, .04, .38, .12, dark, side * 3.53, 18.98, z + .56);
      box(body, .04, .38, .12, dark, side * 3.53, 18.98, z + .83);
    }
    // Hatches, offset reinforcements and lower ventilation slots.
    box(body, .13, 1.56, 1.44, dark, side * 3.54, 16.9, -1.5);
    box(body, .16, 1.36, 1.23, armor, side * 3.62, 16.93, -1.5);
    box(body, .2, .075, .4, steel, side * 3.73, 16.95, -1.32);
    for (let i = 0; i < 9; i++) box(body, .11, .53, .18, dark, side * 3.45, 14.92, -4.9 + i * .32);
    for (const z of [-5.9, 5.65]) box(body, .2, 3.6, .16, edge, side * 3.53, 16.6, z);
    for (const z of [-4.55, 4.55]) {
      axis(body, 1.28, .7, dark, side * 2.6, 13.3, z);
      axis(body, 1.03, .13, edge, side * 3.01, 13.3, z);
    }
  }
  for (const z of [-3.9, -.9, 2.1]) {
    box(body, 4.2, .1, 1.4, edge, 0, 20.19, z);
    for (let slat = 0; slat < 8; slat++) box(body, 3.8, .045, .065, dark, 0, 20.26, z - .5 + slat * .14);
  }
  box(body, 4.4, 2.5, .18, dark, 0, 16.9, -6.64);
  for (let i = 0; i < 8; i++) box(body, 3.9, .13, .12, edge, 0, 15.9 + i * .28, -6.77);
  for (const side of [-1, 1]) {
    box(body, 1.15, 1.9, .11, edge, side * 2.05, 16.9, 6.4);
    for (let i = 0; i < 7; i++) box(body, .85, .12, .12, dark, side * 2.05, 16.15 + i * .24, 6.47);
  }
  // Flexible armored neck leading to the separately aimed command cabin.
  part(body, new THREE.CylinderGeometry(.85, .98, 2.6, 20), dark, [0, 16.25, 7.1], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 9; i++) part(body, new THREE.TorusGeometry(.94, .075, 6, 24), edge, [0, 16.25, 6.05 + i * .265]);
  bakePart(body);

  const head = new THREE.Group(); head.name = "atat-command-head";
  head.position.set(0, 16.25, 8.05); body.add(head);
  const profile = new THREE.Shape();
  profile.moveTo(-.7, -1.12); profile.lineTo(-.85, 1.03); profile.lineTo(1.35, 1.1);
  profile.lineTo(3.5, .35); profile.lineTo(3.65, -.78); profile.lineTo(2.5, -1.18); profile.closePath();
  const cabin = new THREE.ExtrudeGeometry(profile, { depth: 2.85, bevelEnabled: true, bevelSize: .07, bevelThickness: .07, bevelSegments: 1 });
  cabin.rotateY(-Math.PI / 2); cabin.translate(1.425, 0, 0); part(head, cabin, armor);
  box(head, 2.55, .27, .12, dark, 0, .06, 3.57);
  box(head, 2.68, .075, .2, edge, 0, .25, 3.54);
  box(head, 2.25, .18, .13, edge, 0, -.62, 3.65);
  for (const side of [-1, 1]) {
    axis(head, .8, .22, dark, side * 1.49, -.04, .9);
    axis(head, .64, .16, edge, side * 1.64, -.04, .9);
    axis(head, .38, .19, armor, side * 1.75, -.04, .9);
    // Cheek blasters and the longer paired chin cannons.
    for (const [x, y, z, length, radius] of [[side * 1.63, -.15, 2.15, 2.2, .11], [side * .72, -1.13, 3.5, 2.4, .15]]) {
      part(head, new THREE.CylinderGeometry(radius * 1.65, radius * 1.65, .6, 12), edge, [x, y, z], [Math.PI / 2, 0, 0]);
      part(head, new THREE.CylinderGeometry(radius, radius, length, 12), dark, [x, y, z + .65], [Math.PI / 2, 0, 0]);
      part(head, new THREE.CylinderGeometry(radius * 1.3, radius * 1.3, .13, 12), steel, [x, y, z + .65 + length / 2], [Math.PI / 2, 0, 0]);
    }
    for (let i = 0; i < 5; i++) box(head, .06, .36, .075, dark, side * 1.5, .64, -.25 + i * .2);
    box(head, .06, .12, 1.5, edge, side * 1.51, -.69, .95);
  }
  box(head, 1.7, .075, .8, edge, 0, 1.16, .25);
  bakePart(head);

  const legs = [[-2.85, 4.55], [2.85, 4.55], [-2.85, -4.55], [2.85, -4.55]].map(([x, z], index) => {
    const hip = new THREE.Group(); hip.name = `atat-hip-${index}`; hip.position.set(x, 13.3, z); body.add(hip);
    const side = Math.sign(x);
    axis(hip, 1.18, .93, dark, 0, 0, 0);
    axis(hip, 1.06, .16, armor, side * .55, 0, 0);
    axis(hip, .78, .18, edge, side * .66, 0, 0);
    axis(hip, .64, .19, armor, side * .76, 0, 0);
    axis(hip, .18, .21, dark, side * .87, 0, 0);
    box(hip, .71, UPPER - .9, 1.02, dark, 0, -UPPER / 2, 0);
    box(hip, .91, UPPER - 1.2, .79, armor, 0, -UPPER / 2, .06);
    for (const dx of [-.33, .33]) box(hip, .09, UPPER - 1.7, .08, edge, dx, -UPPER / 2, .49);
    for (let i = 0; i < 3; i++) box(hip, .95, .08, .1, edge, 0, -1.75 - i * 1.28, .49);
    box(hip, .08, 4.6, .92, edge, side * .5, -3.1, 0);
    box(hip, .09, 4.35, .7, armor, side * .55, -3.1, .01);
    for (let i = 0; i < 4; i++) box(hip, .03, .24, .075, dark, side * .6, -1.4 - i * .17, .16);
    bakePart(hip);
    const knee = new THREE.Group(); knee.name = `atat-knee-${index}`; knee.position.y = -UPPER; hip.add(knee);
    axis(knee, .86, .98, dark, 0, 0, 0);
    axis(knee, .76, .15, armor, side * .58, 0, 0);
    axis(knee, .57, .17, edge, side * .69, 0, 0);
    axis(knee, .43, .18, armor, side * .79, 0, 0);
    box(knee, .58, LOWER - .65, .67, dark, 0, -LOWER / 2, 0);
    box(knee, .7, LOWER - 1.2, .31, armor, 0, -LOWER / 2, .29);
    box(knee, .065, 4.9, .64, edge, side * .39, -3.2, 0);
    box(knee, .07, 4.65, .46, armor, side * .43, -3.2, .015);
    for (const dx of [-.42, .42]) {
      part(knee, new THREE.CylinderGeometry(.11, .11, 3, 10), edge, [dx, -2.1, -.18]);
      part(knee, new THREE.CylinderGeometry(.065, .065, 2.4, 10), steel, [dx, -4.45, -.18]);
    }
    box(knee, 1, .58, .85, armor, 0, -LOWER + .35, 0);
    bakePart(knee);
    const foot = new THREE.Group(); foot.name = `atat-foot-${index}`; foot.position.y = -LOWER; knee.add(foot);
    axis(foot, .4, .95, edge, 0, 0, 0);
    for (const dx of [-.58, .58]) strut(foot, new THREE.Vector3(dx * .5, -.05, 0), new THREE.Vector3(dx, -.7, .02), .11, armor);
    part(foot, new THREE.CylinderGeometry(1.05, 1.43, .65, 12), armor, [0, -.85, .12]);
    part(foot, new THREE.CylinderGeometry(1.41, 1.45, .12, 12), dark, [0, -1.14, .12]);
    part(foot, new THREE.CylinderGeometry(.52, .58, .19, 16), edge, [0, -.46, .12]);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      const tread = box(foot, .12, .42, .22, edge, Math.sin(a) * 1.25, -.88, .12 + Math.cos(a) * 1.25);
      tread.rotation.y = a;
    }
    bakePart(foot);
    return { hip, knee, foot, phase: [0, .5, .75, .25][index] };
  });
  const target = new THREE.Vector3(), world = new THREE.Vector3();
  function pose(time: number, heightAt: (x: number, z: number) => number) {
    const cycle = time / PERIOD;
    body.position.y = Math.sin(cycle * Math.PI * 4) * .055;
    body.rotation.z = Math.sin(cycle * Math.PI * 2) * .006;
    root.updateMatrixWorld(true);
    for (const leg of legs) {
      const phase = ((cycle + leg.phase) % 1 + 1) % 1;
      const stride = ATAT_SPEED * PERIOD * STANCE / ATAT_SCALE;
      const swing = Math.max(0, (phase - STANCE) / (1 - STANCE));
      const travel = phase < STANCE ? .5 - phase / STANCE : -.5 + swing * swing * (3 - 2 * swing);
      target.set(leg.hip.position.x, 0, leg.hip.position.z + travel * stride);
      world.copy(target).applyMatrix4(root.matrixWorld);
      world.y = heightAt(world.x, world.z) + (ANKLE + Math.sin(swing * Math.PI) * 1.25) * root.scale.y;
      target.copy(world); body.worldToLocal(target); target.sub(leg.hip.position);
      const down = -target.y, forward = target.z;
      const distance = Math.min(UPPER + LOWER - .005, Math.hypot(down, forward));
      const bend = Math.acos(THREE.MathUtils.clamp((distance * distance - UPPER * UPPER - LOWER * LOWER) / (2 * UPPER * LOWER), -1, 1));
      leg.hip.rotation.x = Math.atan2(-forward, down) - Math.atan2(LOWER * Math.sin(bend), UPPER + LOWER * Math.cos(bend));
      leg.knee.rotation.x = bend;
      leg.foot.rotation.set(-leg.hip.rotation.x - bend, 0, -body.rotation.z);
    }
  }
  return { root, body, head, legs, materials, pose, muzzle: new THREE.Vector3(0, -1.13, 5.48) };
}
