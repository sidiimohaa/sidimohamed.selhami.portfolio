import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createStandingHuman } from "../humanFigure";
import { chestShell } from "../stormtrooperModel";
import { bakePart, part, pipe, rounded } from "../tatooineCharacters";

type XYZ = [number, number, number];

// The figures of the night the Temple fell: a Phase II clone of the 501st Legion, a light copy for
// the army on the Processional Way, Anakin in the hood, and the padawan who runs with the visitor.

export type CloneRig = {
  group: THREE.Group;
  head: THREE.Object3D;
  arms: THREE.Object3D[];
  fores: THREE.Object3D[];
  legs: THREE.Object3D[];
  knees: THREE.Object3D[];
  rifle: THREE.Object3D;
  muzzle: THREE.Object3D;
};

// The teal blue of the 501st, and how far each pose moves the hands to the carbine.
const LEGION = 0x1f88ad;

function plate(parent: THREE.Object3D, outline: [number, number][], depth: number, material: THREE.Material, at: XYZ, bevel = 0.003) {
  const shape = new THREE.Shape();
  outline.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  return part(parent, new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1 }), material, at);
}

// Every copy shares the template's geometry and materials.
export function createCloneTemplate() {
  const group = new THREE.Group();
  group.name = "clone-trooper";
  group.userData.character = true;
  const armor = new THREE.MeshPhysicalMaterial({ color: 0xf1efe8, roughness: 0.3, metalness: 0.04, clearcoat: 0.55, clearcoatRoughness: 0.22, side: THREE.DoubleSide });
  const suit = new THREE.MeshStandardMaterial({ color: 0x0e1013, roughness: 0.78 });
  const legion = new THREE.MeshPhysicalMaterial({ color: LEGION, roughness: 0.32, metalness: 0.04, clearcoat: 0.5, clearcoatRoughness: 0.25 });
  const visor = new THREE.MeshStandardMaterial({ color: 0x030405, roughness: 0.16, metalness: 0.45 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x565c60, roughness: 0.46, metalness: 0.65 });
  const gun = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.5, metalness: 0.4 });
  const box = (p: THREE.Object3D, w: number, h: number, d: number, mat: THREE.Material, at: XYZ, r = 0.012) => part(p, rounded(w, h, d, r), mat, at);

  const body = new THREE.Group();
  group.add(body);
  box(body, 0.34, 0.5, 0.2, suit, [0, 1.17, 0], 0.07);
  // The moulded breastplate and back plate, with the Legion's stripe running down the front.
  part(body, chestShell(true), armor);
  part(body, chestShell(false), armor);
  plate(body, [[-0.028, 1.4], [0.028, 1.4], [0.052, 1.09], [0, 1.045], [-0.052, 1.09]], 0.006, legion, [0, 0, 0.178]);
  part(body, new THREE.CylinderGeometry(0.076, 0.082, 0.1, 18), suit, [0, 1.45, 0]);
  const abdomen = part(body, new THREE.CylinderGeometry(0.158, 0.15, 0.2, 22), suit, [0, 0.97, 0]);
  abdomen.scale.z = 0.76;
  for (let rib = 0; rib < 4; rib++) box(body, 0.15, 0.03, 0.03, armor, [0, 0.935 + rib * 0.04, 0.113], 0.01);
  // The belt, its pouches, and the plate below it.
  box(body, 0.39, 0.062, 0.25, armor, [0, 0.87, 0], 0.015);
  for (let i = 0; i < 5; i++) box(body, 0.056, 0.075, 0.04, i === 2 ? metal : armor, [-0.13 + i * 0.065, 0.862, 0.135], 0.007);
  for (const side of [-1, 1]) box(body, 0.05, 0.13, 0.09, armor, [side * 0.19, 0.84, 0.01], 0.008);
  box(body, 0.32, 0.17, 0.2, suit, [0, 0.77, -0.004], 0.04);
  plate(body, [[-0.135, 0.82], [0.135, 0.82], [0.1, 0.73], [0.045, 0.66], [-0.045, 0.66], [-0.1, 0.73]], 0.03, armor, [0, 0, 0.09], 0.007);
  plate(body, [[-0.02, 0.81], [0.02, 0.81], [0.02, 0.69], [-0.02, 0.69]], 0.004, legion, [0, 0, 0.124], 0.002);
  box(body, 0.3, 0.2, 0.05, armor, [0, 0.77, -0.11], 0.02);
  bakePart(body);

  // The Phase II helmet: white dome with a raised crest, blue panels either side of it and a wedge
  // on the forehead, the T visor, angled cheek lines and a ribbed vent on the chin.
  const head = new THREE.Group();
  head.name = "clone-head";
  head.position.y = 1.6;
  group.add(head);
  const R = 0.165,
    SX = 1,
    SY = 1.02,
    SZ = 1.12;
  part(head, new THREE.SphereGeometry(R, 34, 20), armor, [0, 0.02, -0.008]).scale.set(SX, SY, SZ);
  for (const side of [-1, 1]) {
    const length = 1.42,
      start = side > 0 ? Math.PI / 2 + 0.1 : Math.PI / 2 - 0.1 - length;
    part(head, new THREE.SphereGeometry(R + 0.0022, 22, 10, start, length, 0.14, 1.04), legion, [0, 0.02, -0.008]).scale.set(SX, SY, SZ);
    const back = side > 0 ? Math.PI / 2 + 1.62 : Math.PI / 2 - 1.62 - 0.9;
    part(head, new THREE.SphereGeometry(R + 0.0022, 14, 8, back, 0.9, 0.22, 0.8), legion, [0, 0.02, -0.008]).scale.set(SX, SY, SZ);
  }
  const crest: XYZ[] = [],
    fin: XYZ[] = [];
  for (let t = 1.14; t >= -1.5; t -= 0.22) {
    crest.push([0, 0.02 + (R + 0.003) * SY * Math.cos(t), -0.008 + (R + 0.003) * SZ * Math.sin(t)]);
    fin.push([0, 0.02 + (R + 0.012) * SY * Math.cos(t), -0.008 + (R + 0.012) * SZ * Math.sin(t)]);
  }
  pipe(head, crest, 0.018, armor).scale.x = 1;
  pipe(head, fin, 0.008, armor);
  plate(head, [[-0.052, 0.128], [0.052, 0.128], [0.026, 0.068], [0, 0.046], [-0.026, 0.068]], 0.004, legion, [0, 0, 0.158]);
  box(head, 0.285, 0.026, 0.056, armor, [0, 0.05, 0.158], 0.012);
  plate(head, [[-0.15, 0.04], [0.15, 0.04], [0.148, -0.05], [0.12, -0.115], [0.078, -0.152], [-0.078, -0.152], [-0.12, -0.115], [-0.148, -0.05]], 0.05, armor, [0, 0, 0.122], 0.008);
  for (const side of [-1, 1]) {
    plate(head, [[side * 0.016, 0.03], [side * 0.125, 0.034], [side * 0.144, 0.004], [side * 0.112, -0.017], [side * 0.016, -0.004]], 0.004, visor, [0, 0, 0.18]);
    // The cheek lines drop from the visor towards the vent, like a frown.
    pipe(head, [[side * 0.135, -0.052, 0.178], [side * 0.08, -0.052, 0.183], [side * 0.042, -0.074, 0.184], [side * 0.03, -0.108, 0.183]], 0.0048, visor);
    box(head, 0.03, 0.15, 0.2, armor, [side * 0.148, -0.05, 0.022], 0.012);
    part(head, new THREE.CylinderGeometry(0.042, 0.044, 0.016, 18), armor, [side * 0.166, -0.008, -0.012], [0, 0, Math.PI / 2]);
    part(head, new THREE.CylinderGeometry(0.022, 0.022, 0.018, 14), metal, [side * 0.172, -0.008, -0.012], [0, 0, Math.PI / 2]);
  }
  plate(head, [[-0.015, 0.008], [0.015, 0.008], [0.013, -0.075], [-0.013, -0.075]], 0.004, visor, [0, 0, 0.181]);
  box(head, 0.072, 0.046, 0.012, visor, [0, -0.122, 0.178], 0.006);
  for (let i = 0; i < 5; i++) box(head, 0.006, 0.042, 0.006, armor, [-0.026 + i * 0.013, -0.122, 0.186], 0.002);
  part(head, new THREE.TorusGeometry(0.128, 0.012, 8, 28), suit, [0, -0.145, -0.006], [Math.PI / 2, 0, 0]);
  part(head, new THREE.CylinderGeometry(0.082, 0.085, 0.09, 16), suit, [0, -0.17, 0]);
  bakePart(head);

  const arms: THREE.Group[] = [],
    legs: THREE.Group[] = [],
    knees: THREE.Group[] = [];
  [-1, 1].forEach((side, index) => {
    const arm = new THREE.Group();
    arm.name = `clone-arm-${index}`;
    arm.position.set(side * 0.272, 1.365, 0);
    group.add(arm);
    arms.push(arm);
    // The broad blue pauldron over a white upper arm, with the black suit showing at the elbow.
    part(arm, new THREE.SphereGeometry(0.1, 16, 12), suit, [0, -0.02, 0]);
    part(arm, new THREE.SphereGeometry(0.122, 24, 14, 0, Math.PI * 2, 0, 1.75), legion, [side * 0.006, 0.012, 0]).scale.set(1, 1.05, 1.02);
    part(arm, new THREE.CylinderGeometry(0.068, 0.058, 0.2, 16), armor, [0, -0.18, 0]);
    part(arm, new THREE.CylinderGeometry(0.052, 0.05, 0.08, 12), suit, [0, -0.3, 0]);
    bakePart(arm);
    const fore = new THREE.Group();
    fore.name = `clone-fore-${index}`;
    fore.position.y = -0.33;
    arm.add(fore);
    part(fore, new THREE.SphereGeometry(0.052, 12, 8), suit, [0, 0, 0]);
    part(fore, new THREE.CylinderGeometry(0.06, 0.05, 0.23, 16), armor, [0, -0.13, 0]);
    part(fore, new THREE.CylinderGeometry(0.063, 0.058, 0.05, 16), legion, [0, -0.09, 0]);
    part(fore, new THREE.SphereGeometry(0.05, 12, 8), suit, [0, -0.28, 0.008]).scale.set(0.9, 1.1, 1.08);
    box(fore, 0.07, 0.024, 0.08, armor, [0, -0.25, 0.018], 0.008);
    bakePart(fore);
    const leg = new THREE.Group();
    leg.name = `clone-leg-${index}`;
    leg.position.set(side * 0.112, 0.78, 0);
    group.add(leg);
    legs.push(leg);
    part(leg, new THREE.CylinderGeometry(0.08, 0.066, 0.34, 14), suit, [0, -0.17, 0]);
    part(leg, new THREE.CylinderGeometry(0.092, 0.07, 0.26, 20), armor, [0, -0.18, 0.006]).scale.z = 1.12;
    bakePart(leg);
    const knee = new THREE.Group();
    knee.name = `clone-knee-${index}`;
    knee.position.y = -0.35;
    leg.add(knee);
    knees.push(knee);
    part(knee, new THREE.SphereGeometry(0.062, 12, 8), suit, [0, 0, 0]);
    box(knee, 0.11, 0.09, 0.03, armor, [0, 0.008, 0.062], 0.012);
    part(knee, new THREE.CylinderGeometry(0.074, 0.056, 0.3, 20), armor, [0, -0.2, 0.012]).scale.z = 1.16;
    plate(knee, [[-0.016, -0.08], [0.016, -0.08], [0.022, -0.31], [-0.022, -0.31]], 0.004, legion, [0, 0, 0.083], 0.002);
    box(knee, 0.126, 0.07, 0.24, armor, [0, -0.372, 0.066], 0.026);
    box(knee, 0.13, 0.018, 0.25, suit, [0, -0.414, 0.068], 0.006);
    bakePart(knee);
  });
  // The DC-15 carbine, built along +Z with the grip at the origin, so that a pose places it whole.
  const rifle = new THREE.Group();
  rifle.name = "clone-rifle";
  box(rifle, 0.05, 0.075, 0.44, gun, [0, 0.02, 0.13], 0.01);
  box(rifle, 0.036, 0.1, 0.05, gun, [0, -0.06, 0.02], 0.008);
  box(rifle, 0.032, 0.11, 0.05, gun, [0, -0.05, 0.2], 0.006);
  box(rifle, 0.03, 0.05, 0.25, gun, [0, 0.03, -0.2], 0.008);
  box(rifle, 0.03, 0.03, 0.18, metal, [0, 0.07, 0.12], 0.006);
  part(rifle, new THREE.CylinderGeometry(0.015, 0.019, 0.22, 10), metal, [0, 0.025, 0.46], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) part(rifle, new THREE.TorusGeometry(0.024, 0.004, 5, 12), metal, [0, 0.022, 0.3 + i * 0.03]);
  bakePart(rifle);
  group.add(rifle);
  const muzzle = new THREE.Object3D();
  muzzle.name = "clone-muzzle";
  muzzle.position.set(0, 0.025, 0.58);
  rifle.add(muzzle);
  return group;
}

export function instantiateClone(template: THREE.Group): CloneRig {
  const group = template.clone(true);
  const named = (name: string) => group.getObjectByName(name) as THREE.Object3D;
  return {
    group,
    head: named("clone-head"),
    arms: [named("clone-arm-0"), named("clone-arm-1")],
    fores: [named("clone-fore-0"), named("clone-fore-1")],
    legs: [named("clone-leg-0"), named("clone-leg-1")],
    knees: [named("clone-knee-0"), named("clone-knee-1")],
    rifle: named("clone-rifle"),
    muzzle: named("clone-muzzle"),
  };
}

const PORT = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0.74, 0.62, 0.26).normalize());
// Aiming from the shoulder, or carried across the chest as they march.
export function poseClone(rig: CloneRig, pose: "aim" | "port") {
  if (pose === "aim") {
    rig.rifle.position.set(-0.235, 1.205, 0.585);
    rig.rifle.quaternion.identity();
    rig.arms[0].rotation.set(-1, 0, 0);
    rig.fores[0].rotation.set(-0.62, 0, 0);
    rig.arms[1].rotation.set(-1.08, 0, -0.5);
    rig.fores[1].rotation.set(-0.62, 0, 0);
  } else {
    rig.rifle.position.set(-0.17, 1.03, 0.25);
    rig.rifle.quaternion.copy(PORT);
    rig.arms[0].rotation.set(-0.2, 0, -0.08);
    rig.fores[0].rotation.set(-1.28, 0, 0.1);
    rig.arms[1].rotation.set(-0.68, 0, -0.1);
    rig.fores[1].rotation.set(-1.25, 0, -0.34);
  }
}

export function marchClone(rig: CloneRig, time: number, phase: number) {
  const stride = time * 3.1 + phase;
  rig.legs[0].rotation.x = Math.sin(stride) * 0.34;
  rig.legs[1].rotation.x = -Math.sin(stride) * 0.34;
  rig.knees[0].rotation.x = Math.max(0, Math.sin(stride + 1.4)) * 0.5;
  rig.knees[1].rotation.x = Math.max(0, -Math.sin(stride + 1.4)) * 0.5;
}

// Anakin in the hood, as he came through the Temple's doors: the heavy dark robe falling wide to the
// floor over a black tunic and silver buckle, a brown peaked hood framing the face, the blade held low.
function draped(top: number, bottom: number, topR: [number, number], bottomR: [number, number], gapTop: number, gapBottom: number, folds: number, depth: number) {
  const across = 44,
    down = 18,
    positions: number[] = [],
    indices: number[] = [];
  for (let row = 0; row <= down; row++) {
    const v = row / down,
      gap = THREE.MathUtils.lerp(gapTop, gapBottom, v),
      flare = Math.pow(v, 0.8);
    for (let column = 0; column <= across; column++) {
      const angle = gap + (column / across) * (Math.PI * 2 - gap * 2);
      const fold = 1 + Math.sin(angle * folds + v * 1.6) * depth * (0.25 + v);
      positions.push(Math.sin(angle) * THREE.MathUtils.lerp(topR[0], bottomR[0], flare) * fold, THREE.MathUtils.lerp(top, bottom, v), Math.cos(angle) * THREE.MathUtils.lerp(topR[1], bottomR[1], flare) * fold - 0.02);
      if (row < down && column < across) {
        const a = row * (across + 1) + column,
          b = a + across + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createAnakin() {
  const robe = new THREE.MeshStandardMaterial({ color: 0x16100c, roughness: 0.96, side: THREE.DoubleSide });
  const brown = new THREE.MeshStandardMaterial({ color: 0x46301f, roughness: 0.95, side: THREE.DoubleSide });
  const lining = new THREE.MeshStandardMaterial({ color: 0x0a0705, roughness: 1, side: THREE.BackSide });
  const silver = new THREE.MeshStandardMaterial({ color: 0xb9bcc0, roughness: 0.32, metalness: 0.85 });
  const hairMaterial = new THREE.MeshStandardMaterial({ color: 0x241708, roughness: 0.9 });
  const collar = new THREE.MeshStandardMaterial({ color: 0x0d0a08, roughness: 0.92 });
  robe.userData.surfaceKind = brown.userData.surfaceKind = "cloth";
  const human = createStandingHuman(
    { name: "anakin", skin: 0xcfa385, hair: 0x33210f, iris: 0x4e6d7f, hairStyle: "swept", tunic: 0x130f0c, trousers: 0x0f0c0a, boots: 0x090807, belt: 0x20170f, gloves: 0x0b0908 },
    (parts, s) => {
      s.box(parts.body, [0, 1.035, 0.112], [0.05, 0.034, 0.012], silver, 0.003);
      for (const arm of parts.arms) {
        part(arm.root, new THREE.CylinderGeometry(0.075, 0.11, 0.32, 14, 1, true), robe, [0, -0.17, 0]);
        part(arm.joint, new THREE.CylinderGeometry(0.1, 0.15, 0.27, 14, 1, true), robe, [0, -0.12, 0]);
      }
      // The peaked hood: open to a point above the brow, with a lit edge round the face.
      const R = 0.176,
        half = 0.68,
        at: XYZ = [0, 0.03, -0.018],
        scale: XYZ = [1.08, 1.16, 1.18],
        // The crown is drawn up to a soft point, as heavy cloth falls from a peak.
        peak = (y: number) => Math.pow(Math.max(0, y / R), 3) * 0.035;
      // Dark hair falling past the ears, and a high black collar under the hood.
      for (const side of [-1, 1]) {
        s.ball(parts.head, [side * 0.106, 0.004, -0.004], [0.022, 0.085, 0.045], hairMaterial);
        s.ball(parts.head, [side * 0.1, -0.062, -0.012], [0.02, 0.058, 0.04], hairMaterial);
      }
      part(parts.body, new THREE.CylinderGeometry(0.072, 0.1, 0.17, 18), collar, [0, 1.485, 0.002]);
      const shell = (radius: number, material: THREE.Material) => {
        const geometry = new THREE.SphereGeometry(radius, 36, 20, Math.PI / 2 + half, Math.PI * 2 - half * 2, 0, Math.PI * 0.84);
        const position = geometry.getAttribute("position");
        for (let i = 0; i < position.count; i++) position.setY(i, position.getY(i) + peak(position.getY(i)));
        geometry.computeVertexNormals();
        part(parts.head, geometry, material, at).scale.set(...scale);
      };
      shell(R, brown);
      shell(R - 0.012, lining);
      for (const side of [-1, 1]) {
        const edge: XYZ[] = [];
        for (let theta = 0.05; theta < Math.PI * 0.84; theta += 0.2) {
          const phi = Math.PI / 2 + side * half,
            y = Math.cos(theta) * R;
          edge.push([at[0] - Math.cos(phi) * Math.sin(theta) * R * scale[0], at[1] + (y + peak(y)) * scale[1], at[2] + Math.sin(phi) * Math.sin(theta) * R * scale[2]]);
        }
        pipe(parts.head, edge, 0.009, brown);
      }
    },
  );
  const { group, arms, head } = human;
  // The cowl falls from the hood on to the shoulders; the robe falls from there to the floor.
  part(group, draped(1.63, 1.22, [0.125, 0.135], [0.4, 0.285], 0.3, 0.14, 7, 0.05), brown);
  part(group, draped(1.47, 0.012, [0.31, 0.21], [0.88, 0.72], 0.17, 0.12, 13, 0.09), robe);
  arms[0].root.rotation.set(-0.42, 0, -0.34);
  arms[0].joint.rotation.set(-0.5, 0, 0);
  arms[1].root.rotation.set(0.04, 0, 0.1);
  arms[1].joint.rotation.set(-0.3, 0, 0);
  head.rotation.x = 0.13;
  const saber = createSaber(0x3f9dff, 1.02);
  saber.group.position.set(-0.46, 0.85, 0.34);
  saber.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-0.62, -0.7, 0.34).normalize());
  saber.setExtended(0);
  group.add(saber.group);
  return {
    group,
    saber,
    tick(time: number, walking: boolean, reduced: boolean) {
      human.look(0, 0, time, reduced);
      if (!walking || reduced) return;
      const stride = Math.sin(time * 2.5);
      human.legs[0].root.rotation.x = stride * 0.26;
      human.legs[1].root.rotation.x = -stride * 0.26;
      group.position.y = Math.abs(stride) * 0.012;
      arms[1].root.rotation.x = 0.04 + stride * 0.07;
    },
  };
}

// The army on the Processional Way, seen from the air: a few hundred triangles for each trooper.
export function createCloneArmy(columns: number, ranks: number, spacing: [number, number]) {
  const shape = (geometry: THREE.BufferGeometry, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) =>
    geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz)));
  const white = mergeGeometries([
    shape(new THREE.BoxGeometry(0.42, 0.62, 0.25), 0, 1.2, 0),
    shape(new THREE.SphereGeometry(0.17, 8, 6), 0, 1.63, 0),
    ...[-1, 1].flatMap((side) => [
      shape(new THREE.CylinderGeometry(0.09, 0.06, 0.8, 6), side * 0.12, 0.42, 0),
      shape(new THREE.CylinderGeometry(0.07, 0.055, 0.62, 6), side * 0.28, 1.08, 0),
    ]),
  ])!;
  const blue = mergeGeometries([
    shape(new THREE.BoxGeometry(0.03, 0.2, 0.3), 0, 1.76, 0),
    shape(new THREE.BoxGeometry(0.13, 0.08, 0.2), -0.28, 1.38, 0),
    shape(new THREE.BoxGeometry(0.13, 0.08, 0.2), 0.28, 1.38, 0),
  ])!;
  const dark = mergeGeometries([
    shape(new THREE.BoxGeometry(0.2, 0.06, 0.02), 0, 1.63, 0.165),
    shape(new THREE.BoxGeometry(0.06, 0.1, 0.02), 0, 1.57, 0.165),
    shape(new THREE.BoxGeometry(0.08, 0.1, 0.8), 0.18, 1.05, 0.3),
  ])!;
  const group = new THREE.Group();
  group.name = "clone-army";
  const meshes = [
    new THREE.InstancedMesh(white, new THREE.MeshStandardMaterial({ color: 0xece9df, roughness: 0.5 }), columns * ranks),
    new THREE.InstancedMesh(blue, new THREE.MeshStandardMaterial({ color: LEGION, roughness: 0.5 }), columns * ranks),
    new THREE.InstancedMesh(dark, new THREE.MeshStandardMaterial({ color: 0x0b0e12, roughness: 0.6 }), columns * ranks),
  ];
  const matrix = new THREE.Matrix4();
  let index = 0;
  for (let rank = 0; rank < ranks; rank++)
    for (let column = 0; column < columns; column++) {
      matrix.setPosition((column - (columns - 1) / 2) * spacing[0], Math.sin(column * 3.1 + rank) * 0.05, rank * spacing[1]);
      meshes.forEach((mesh) => mesh.setMatrixAt(index, matrix));
      index++;
    }
  meshes.forEach((mesh) => {
    mesh.frustumCulled = false;
    group.add(mesh);
  });
  return group;
}

// A young padawan in tan tunic and brown robe, with the braid of the apprentice. Faces +Z.
export function createPadawan() {
  const group = new THREE.Group();
  group.name = "padawan";
  group.userData.character = true;
  const skin = new THREE.MeshStandardMaterial({ color: 0xb98a68, roughness: 0.75 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x241811, roughness: 0.9 });
  const tunic = new THREE.MeshStandardMaterial({ color: 0xbda886, roughness: 0.95, side: THREE.DoubleSide });
  const robe = new THREE.MeshStandardMaterial({ color: 0x4d3424, roughness: 0.98, side: THREE.DoubleSide });
  const boot = new THREE.MeshStandardMaterial({ color: 0x20150e, roughness: 0.7 });
  const profile = (points: [number, number][]) => new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), 18);
  part(group, profile([[0.06, 1.19], [0.16, 1.14], [0.19, 0.96], [0.17, 0.76], [0.21, 0.58], [0.25, 0.45]]), tunic);
  part(group, profile([[0.17, 1.17], [0.2, 1.08], [0.22, 0.86], [0.26, 0.6], [0.31, 0.34]]), robe, [0, 0, -0.03]).scale.z = 0.92;
  part(group, new THREE.CylinderGeometry(0.17, 0.175, 0.05, 18), boot, [0, 0.8, 0]);
  const head = new THREE.Group();
  head.position.y = 1.3;
  group.add(head);
  part(head, new THREE.SphereGeometry(0.105, 22, 16), skin).scale.set(0.92, 1.1, 0.98);
  part(head, new THREE.SphereGeometry(0.112, 22, 14, 0, Math.PI * 2, 0, 1.7), hair, [0, 0.022, -0.016]);
  pipe(head, [[0.085, 0.01, -0.02], [0.112, -0.06, 0], [0.122, -0.16, 0.014], [0.116, -0.26, 0.022]], 0.011, hair);
  for (const side of [-1, 1]) part(head, new THREE.SphereGeometry(0.011, 8, 6), hair, [side * 0.036, 0.012, 0.094]);
  const legs: THREE.Group[] = [],
    arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.082, 0.56, 0);
    group.add(leg);
    legs.push(leg);
    part(leg, new THREE.CylinderGeometry(0.06, 0.045, 0.38, 10), hair, [0, -0.17, 0]);
    part(leg, new THREE.CylinderGeometry(0.052, 0.058, 0.2, 10), boot, [0, -0.38, 0]);
    part(leg, rounded(0.09, 0.05, 0.19, 0.018), boot, [0, -0.5, 0.036]);
    const arm = new THREE.Group();
    arm.position.set(side * 0.2, 1.12, 0);
    group.add(arm);
    arms.push(arm);
    part(arm, new THREE.CylinderGeometry(0.052, 0.082, 0.44, 12), robe, [0, -0.21, 0]);
    part(arm, new THREE.SphereGeometry(0.038, 10, 8), skin, [0, -0.45, 0]);
  }
  return {
    group,
    head,
    tick(time: number, running: boolean, reduced: boolean) {
      const stride = reduced || !running ? 0 : Math.sin(time * 8.4);
      legs[0].rotation.x = stride * 0.72;
      legs[1].rotation.x = -stride * 0.72;
      arms[0].rotation.x = -stride * 0.6 - (running ? 0.2 : 0);
      arms[1].rotation.x = stride * 0.6 - (running ? 0.2 : 0);
      group.rotation.x = running && !reduced ? 0.12 : 0;
      group.position.y = running && !reduced ? Math.abs(Math.cos(time * 8.4)) * 0.05 : 0;
    },
  };
}

// A lightsaber lying along +Y from its hilt: a hot core inside a coloured glow.
export function createSaber(color: number, length: number) {
  const group = new THREE.Group();
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.024, 0.24, 12), new THREE.MeshStandardMaterial({ color: 0x8d9196, metalness: 0.85, roughness: 0.32 }));
  hilt.position.y = -0.12;
  group.add(hilt);
  const blade = new THREE.Group();
  group.add(blade);
  const core = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 1, 4, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  const glow = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 1, 4, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.62, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  const aura = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 1, 4, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  for (const mesh of [core, glow, aura]) blade.add(mesh);
  return {
    group,
    setExtended(amount: number) {
      const extended = Math.max(amount, 0.0001) * length;
      blade.visible = amount > 0.001;
      blade.scale.y = extended;
      blade.position.y = extended / 2;
    },
  };
}
