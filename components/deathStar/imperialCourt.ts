import * as THREE from "three";
import { bakePart, part, pipe, rounded } from "../tatooineCharacters";

type XYZ = [number, number, number];
// `rig` exposes the parts the station's easter eggs move: heads, arms, weapons, hands.
export type FigureRig = { head?: THREE.Object3D; body?: THREE.Object3D; upper?: THREE.Object3D; arms?: THREE.Object3D[]; weapon?: THREE.Object3D; hands?: THREE.Vector3[] };
export type ImperialFigure = { group: THREE.Group; tick: (time: number, reduced: boolean) => void; rig?: FigureRig };
const standard = (color: number, roughness = .75, metalness = 0, side: THREE.Side = THREE.FrontSide) => new THREE.MeshStandardMaterial({ color, roughness, metalness, side });
const emissive = (color: number) => new THREE.MeshBasicMaterial({ color, toneMapped: false });
const ball = (g: THREE.Object3D, p: XYZ, size: XYZ, m: THREE.Material, segments = 18) => {
  const mesh = part(g, new THREE.SphereGeometry(1, segments, 12), m, p); mesh.scale.set(...size); return mesh;
};
const box = (g: THREE.Object3D, p: XYZ, size: XYZ, m: THREE.Material, radius = .012) => part(g, rounded(...size, radius), m, p);
function rod(g: THREE.Object3D, a: XYZ, b: XYZ, r1: number, r2: number, m: THREE.Material, sides = 12) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), span = end.clone().sub(start);
  const mesh = part(g, new THREE.CylinderGeometry(r2, r1, span.length(), sides), m);
  mesh.position.copy(start).add(end).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), span.normalize()); return mesh;
}
function plate(g: THREE.Object3D, points: [number, number][], m: THREE.Material, p: XYZ, depth = .025, bevel = .008) {
  const s = new THREE.Shape(); points.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath();
  const geometry = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSegments: 2, steps: 1, bevelSize: bevel, bevelThickness: bevel });
  return part(g, geometry, m, p);
}

// An actual folded garment: several elliptical body profiles, not a cylinder/cone silhouette.
function robeGeometry(profiles: { y: number; x: number; z: number; offset?: number }[], folds: number, strength: number) {
  const around = 48, positions: number[] = [], uv: number[] = [], indices: number[] = [];
  profiles.forEach((p, row) => {
    for (let column = 0; column <= around; column++) {
      const theta = column / around * Math.PI * 2;
      const ripple = Math.sin(theta * folds + row * .12) * strength + Math.sin(theta * folds * 2 + .6) * strength * .23;
      positions.push(Math.sin(theta) * (p.x + ripple), p.y, Math.cos(theta) * (p.z + ripple * .7) + (p.offset ?? 0));
      uv.push(column / around, row / (profiles.length - 1));
      if (row < profiles.length - 1 && column < around) {
        const a = row * (around + 1) + column, b = a + around + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  });
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}
function capeGeometry(height: number, shoulder: number, hem: number) {
  const across = 32, down = 16, positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let row = 0; row <= down; row++) {
    const v = row / down, width = THREE.MathUtils.lerp(hem, shoulder, Math.pow(v, .65));
    for (let column = 0; column <= across; column++) {
      const u = column / across * 2 - 1;
      const fold = Math.sin(u * 19 + v * .8) * (.022 + (1 - v) * .022);
      positions.push(width * u, .04 + v * height, -.09 - (1 - u * u) * (.26 - v * .10) + fold + (1 - v) * .045);
      uv.push(column / across, v);
      if (row < down && column < across) { const a = row * (across + 1) + column, b = a + across + 1; indices.push(a, a + 1, b, a + 1, b + 1, b); }
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
function saber(parent: THREE.Group, at: XYZ, direction: XYZ, color: number, silver: THREE.Material, dark: THREE.Material, glow: THREE.MeshBasicMaterial, core: THREE.Material) {
  const grip = new THREE.Group(); grip.position.set(...at);
  grip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...direction).normalize());
  rod(grip, [0, -.13, 0], [0, .13, 0], .025, .025, silver);
  for (let i = 0; i < 6; i++) part(grip, new THREE.TorusGeometry(.026, .004, 5, 12), dark, [0, -.095 + i * .033, 0], [Math.PI / 2, 0, 0]);
  rod(grip, [0, .11, 0], [0, .16, 0], .034, .028, silver);
  rod(grip, [0, .16, 0], [0, 1.01, 0], .012, .009, core, 10);
  rod(grip, [0, .16, 0], [0, 1.01, 0], .027, .023, glow, 10);
  // The small emitter gives the hilt a colored tip without adding a shadow-casting light.
  const emitter = emissive(color); ball(grip, [0, .155, 0], [.032, .016, .032], emitter, 12);
  bakePart(grip); parent.add(grip);
}

/** Four articulated arms and the elongated bone mask distinguish the general at a distance. */
export function createGeneralGrievous(): ImperialFigure {
  const group = new THREE.Group(); group.name = "general-grievous";
  const bone = standard(0xd3c7a8, .52, .13), edge = standard(0xa4977a, .7, .25), black = standard(0x10171a, .57, .55), steel = standard(0x73817e, .34, .8);
  const recess = standard(0x050808, .87), eye = emissive(0xe6c74f), pupil = standard(0x160f06, .45);
  const outer = standard(0x20302e, .95, 0, THREE.BackSide), lining = standard(0x561d24, .95, 0, THREE.FrontSide);
  const core = emissive(0xe9fff8), blue = new THREE.MeshBasicMaterial({ color: 0x50baff, transparent: true, opacity: .31, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const green = blue.clone(); green.color.setHex(0x72ff6e);
  const cloak = new THREE.Group(); cloak.name = "grievous-lined-cape";
  const cape = capeGeometry(1.77, .41, .62); part(cloak, cape, lining); part(cloak, cape.clone(), outer);
  for (const sign of [-1, 1]) pipe(cloak, [[sign * .42, 1.81, -.08], [sign * .49, 1.28, -.07], [sign * .60, .12, -.02]], .018, outer);
  bakePart(cloak); group.add(cloak);

  const torso = new THREE.Group(); torso.name = "grievous-exposed-rib-cage";
  rod(torso, [0, .99, -.055], [0, 1.77, -.04], .085, .095, black);
  for (let i = 0; i < 8; i++) {
    const y = 1.15 + i * .052, width = .15 + i * .005;
    for (const sign of [-1, 1]) pipe(torso, [[sign * .02, y, .115], [sign * width, y + .045, .07], [sign * (width + .018), y + .07, -.045]], .018, steel);
  }
  for (const sign of [-1, 1]) {
    plate(torso, [[sign * .025, .04], [sign * .235, .02], [sign * .28, -.16], [sign * .13, -.37], [sign * .03, -.27]], bone, [0, 1.77, .10], .045, .012);
    ball(torso, [sign * .275, 1.72, -.025], [.13, .115, .12], edge);
    ball(torso, [sign * .285, 1.72, .045], [.104, .085, .11], bone);
    plate(torso, [[0, .10], [sign * .16, .04], [sign * .12, -.07], [sign * .015, -.01]], bone, [sign * .08, 1.08, .12], .032);
    pipe(torso, [[sign * .11, 1.43, -.05], [sign * .21, 1.6, -.1], [sign * .15, 1.82, -.1]], .023, black);
  }
  rod(torso, [0, 1.77, -.02], [0, 1.97, .12], .065, .045, steel);
  for (let i = 0; i < 4; i++) part(torso, new THREE.TorusGeometry(.055, .012, 6, 16), black, [0, 1.83 + i * .028, .045 + i * .02], [Math.PI / 2, 0, 0]);
  bakePart(torso); group.add(torso);

  const head = new THREE.Group(); head.name = "grievous-bone-mask"; head.position.set(0, 2.01, .13);
  ball(head, [0, .025, -.025], [.13, .20, .105], black);
  ball(head, [0, .135, -.02], [.135, .115, .105], bone);
  for (const sign of [-1, 1]) {
    const mask = new THREE.Shape();
    const contour: [number, number][] = [[.014, .20], [.105, .24], [.16, .15], [.16, .015], [.115, -.15], [.07, -.22], [.042, -.09], [.018, .085]];
    contour.forEach(([x, y], i) => i ? mask.lineTo(sign * x, y) : mask.moveTo(sign * x, y)); mask.closePath();
    const hole = new THREE.Path(); [[.036, .076], [.115, .10], [.117, .052], [.058, .028]].forEach(([x, y], i) => i ? hole.lineTo(sign * x, y) : hole.moveTo(sign * x, y)); hole.closePath(); mask.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(mask, { depth: .038, bevelEnabled: true, bevelSegments: 2, bevelSize: .008, bevelThickness: .006, curveSegments: 10 });
    part(head, geometry, bone, [0, 0, .052]);
    const socket = ball(head, [sign * .079, .063, .062], [.047, .035, .028], recess); socket.rotation.z = sign * .26;
    ball(head, [sign * .079, .063, .085], [.027, .020, .014], eye, 14);
    ball(head, [sign * .079, .063, .098], [.006, .020, .004], pupil, 10);
    pipe(head, [[sign * .15, .15, .068], [sign * .15, .01, .096], [sign * .095, -.17, .11]], .008, edge);
    pipe(head, [[sign * .052, -.12, .015], [sign * .11, -.19, -.005], [sign * .12, -.10, -.08]], .016, black);
  }
  plate(head, [[-.035, .09], [.035, .09], [.052, -.13], [.026, -.20], [-.026, -.20], [-.052, -.13]], bone, [0, -.005, .107], .035, .007);
  for (let i = -2; i <= 2; i++) box(head, [i * .012, -.116, .149], [.005, .072 - Math.abs(i) * .007, .006], recess, .001);
  ball(head, [0, -.21, .055], [.065, .042, .068], edge);
  plate(head, [[-.04, .02], [.04, .02], [.02, -.025], [-.02, -.025]], bone, [0, -.23, .085], .022);
  bakePart(head); group.add(head);

  const legs: THREE.Group[] = [];
  for (const sign of [-1, 1]) {
    const leg = new THREE.Group(); leg.name = sign < 0 ? "grievous-left-leg" : "grievous-right-leg";
    const hip: XYZ = [sign * .14, 1.08, -.015], knee: XYZ = [sign * .23, .64, .12], ankle: XYZ = [sign * .24, .17, -.04];
    ball(leg, hip, [.10, .10, .085], steel); ball(leg, knee, [.078, .079, .075], black);
    for (const offset of [-.037, .037]) {
      rod(leg, [hip[0] + offset, hip[1], hip[2]], [knee[0] + offset, knee[1], knee[2]], .023, .019, steel);
      rod(leg, [knee[0] + offset, knee[1], knee[2]], [ankle[0] + offset, ankle[1], ankle[2]], .018, .021, black);
    }
    rod(leg, [sign * .20, .98, .015], [sign * .255, .73, .105], .065, .039, bone);
    rod(leg, [sign * .245, .57, .105], [sign * .25, .24, -.025], .049, .031, bone);
    ball(leg, [knee[0], knee[1], knee[2] + .057], [.07, .075, .04], bone);
    ball(leg, ankle, [.065, .075, .07], steel);
    for (const offset of [-.085, 0, .085]) {
      const toe: XYZ = [ankle[0] + offset, .04, .29 - Math.abs(offset) * .6];
      rod(leg, [ankle[0] + offset * .3, .12, .015], [toe[0], .065, toe[2] - .06], .022, .019, black);
      rod(leg, [toe[0], .065, toe[2] - .06], toe, .021, .006, steel);
    }
    rod(leg, [ankle[0], .11, -.04], [ankle[0], .035, -.17], .019, .007, steel);
    bakePart(leg); legs.push(leg); group.add(leg);
  }

  const arms: THREE.Group[] = [];
  for (const sign of [-1, 1]) for (let pair = 0; pair < 2; pair++) {
    const arm = new THREE.Group(); arm.name = `grievous-${sign < 0 ? "left" : "right"}-arm-${pair + 1}`;
    arm.position.set(sign * .28, pair ? 1.52 : 1.72, pair ? -.03 : .015);
    const elbow: XYZ = [sign * (pair ? .25 : .29), pair ? -.16 : .04, .08];
    const hand: XYZ = [sign * (pair ? .42 : .54), pair ? -.34 : .16, pair ? .18 : .12];
    ball(arm, [0, 0, 0], [.069, .069, .075], black);
    rod(arm, [0, 0, 0], elbow, .043, .033, steel);
    rod(arm, [sign * .035, -.015, .025], [elbow[0] + sign * .025, elbow[1], elbow[2]], .022, .025, bone);
    ball(arm, elbow, [.060, .06, .06], black);
    rod(arm, elbow, hand, .048, .03, bone);
    rod(arm, [elbow[0], elbow[1], elbow[2] -.025], [hand[0], hand[1], hand[2] -.025], .022, .02, steel);
    for (let i = 0; i < 3; i++) {
      const x = hand[0] + (i - 1) * .023;
      pipe(arm, [[x, hand[1] + .025, hand[2]], [x, hand[1] -.018, hand[2] + .05], [x, hand[1] -.035, hand[2] + .015]], .009, steel);
    }
    bakePart(arm);
    const bladeDirection: XYZ = pair ? [sign * .75, -.52, .12] : [sign * .42, .88, -.04];
    saber(arm, [hand[0], hand[1], hand[2] + .035], bladeDirection, (sign < 0) !== !!pair ? 0x50baff : 0x72ff6e, steel, black, (sign < 0) !== !!pair ? blue : green, core);
    arms.push(arm); group.add(arm);
  }
  group.userData.character = "General Grievous";
  return { group, rig: { head, arms }, tick: (time, reduced) => {
    head.rotation.y = reduced ? 0 : Math.sin(time * .31) * .055;
    head.rotation.x = -.055 + (reduced ? 0 : Math.sin(time * .7) * .012);
    cloak.rotation.x = reduced ? 0 : Math.sin(time * .5) * .009;
    arms.forEach((arm, index) => arm.rotation.z = reduced ? 0 : Math.sin(time * .65 + index * .85) * .012);
    blue.opacity = reduced ? .31 : .30 + Math.sin(time * 27) * .018; green.opacity = reduced ? .31 : .30 + Math.sin(time * 29 + 2) * .018;
  } };
}

/** The Emperor's bent posture, deep open hood and drawn face are modeled independently. */
export function createEmperorPalpatine(): ImperialFigure {
  const group = new THREE.Group(); group.name = "emperor-palpatine";
  const cloth = standard(0x151519, .99, 0, THREE.DoubleSide), shadowCloth = standard(0x08090d, .98, 0, THREE.DoubleSide), ridgeCloth = standard(0x242329, .98, 0, THREE.DoubleSide);
  const skin = standard(0xb3a497, .9), crease = standard(0x75675f, .99), shadow = standard(0x3e3334, .95), lip = standard(0x736060, .9);
  const eye = standard(0xb5a987, .6), iris = emissive(0xcab565), pupil = standard(0x16100c, .5), clasp = standard(0x434349, .55, .6);
  const cane = standard(0x171316, .58, .18);
  const body = new THREE.Group(); body.name = "emperor-layered-robes";
  part(body, robeGeometry([{ y: .06, x: .34, z: .245, offset: -.035 }, { y: .22, x: .32, z: .235, offset: -.045 }, { y: .56, x: .265, z: .20, offset: -.045 }, { y: .92, x: .23, z: .18, offset: -.035 }, { y: 1.14, x: .25, z: .19, offset: -.02 }, { y: 1.31, x: .31, z: .19, offset: .01 }, { y: 1.39, x: .25, z: .16, offset: .035 }, { y: 1.45, x: .105, z: .10, offset: .05 }], 14, .018), cloth);
  const lower = new THREE.Group();
  part(lower, robeGeometry([{ y: .055, x: .265, z: .21, offset: .02 }, { y: .5, x: .22, z: .18, offset: .015 }, { y: 1.10, x: .19, z: .13, offset: .03 }], 10, .012), shadowCloth); bakePart(lower); group.add(lower);
  for (const sign of [-1, 1]) {
    // Overlapping cloth panels hang from the shoulders and wrap across the breast.
    plate(body, [[sign * .08, .08], [sign * .30, -.04], [sign * .27, -.31], [sign * .14, -.59], [sign * .04, -.43]], ridgeCloth, [0, 1.36, .12], .018, .006);
    ball(body, [sign * .095, .055, .10], [.10, .055, .18], shadowCloth);
    const shoulder: XYZ = [sign * .255, 1.29, .015], elbow: XYZ = [sign * .34, 1.10, .14], wrist: XYZ = sign < 0 ? [-.335, .99, .30] : [.39, 1.17, .29];
    rod(body, shoulder, elbow, .105, .085, cloth);
    rod(body, elbow, wrist, .10, .14, cloth);
    // A loose cuff surrounds a bony hand, with four separate curled fingers.
    rod(body, [wrist[0], wrist[1] + .025, wrist[2] -.045], wrist, .065, .052, shadowCloth);
    ball(body, wrist, [.055, .025, .07], skin);
    for (let finger = 0; finger < 4; finger++) {
      const x = wrist[0] + (finger - 1.5) * .022, len = [.067, .083, .079, .057][finger];
      pipe(body, [[x, wrist[1], wrist[2] + .045], [x, wrist[1] -.02, wrist[2] + .045 + len * .7], [x, wrist[1] -.047, wrist[2] + .045 + len]], .011, skin);
      ball(body, [x, wrist[1] -.005, wrist[2] + .065], [.012, .011, .013], crease, 10);
    }
    pipe(body, [[wrist[0] - sign * .045, wrist[1], wrist[2]], [wrist[0] - sign * .073, wrist[1] -.015, wrist[2] + .035], [wrist[0] - sign * .053, wrist[1] -.04, wrist[2] + .07]], .013, skin);
  }
  box(body, [0, 1.28, .225], [.10, .038, .018], clasp, .008);
  for (const sign of [-1, 1]) for (let i = 0; i < 3; i++) ball(body, [sign * (.021 + i * .018), 1.28 + Math.sin(i) * .006, .235], [.009, .012, .008], clasp, 10);
  bakePart(body); group.add(body);
  const walkingStick = new THREE.Group(); walkingStick.name = "emperor-walking-cane";
  pipe(walkingStick, [[-.34, .045, .345], [-.35, .50, .345], [-.33, .83, .34], [-.34, .99, .345], [-.39, 1.045, .34]], .016, cane);
  ball(walkingStick, [-.385, 1.035, .34], [.035, .025, .028], cane, 14); bakePart(walkingStick); group.add(walkingStick);

  const head = new THREE.Group(); head.name = "emperor-aged-face-and-hood"; head.position.set(0, 1.49, .07);
  ball(head, [0, .025, -.07], [.23, .245, .185], shadowCloth, 24);
  ball(head, [0, .015, .075], [.119, .155, .105], skin, 24);
  ball(head, [0, -.095, .105], [.084, .061, .083], skin);
  // Folded hood band: an opening in front, receding to an outer shell behind the face.
  const positions: number[] = [], uv: number[] = [], indices: number[] = [], rows = 6, columns = 40;
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
    const v = row / rows, a = col / columns * Math.PI * 2, top = Math.max(0, Math.cos(a));
    const x = Math.sin(a) * THREE.MathUtils.lerp(.139, .228, v), y = Math.cos(a) * THREE.MathUtils.lerp(.179, .242, v) + top ** 5 * .028;
    positions.push(x, y, THREE.MathUtils.lerp(.145 + Math.cos(a) * .015, -.035, v) + Math.sin(a * 8) * .007 * v); uv.push(col / columns, v);
    if (row < rows && col < columns) { const n = row * (columns + 1) + col; indices.push(n, n + 1, n + columns + 1, n + 1, n + columns + 2, n + columns + 1); }
  }
  const hood = new THREE.BufferGeometry(); hood.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); hood.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); hood.setIndex(indices); hood.computeVertexNormals(); part(head, hood, cloth);
  const hoodEdge: XYZ[] = [];
  for (let i = 0; i <= 28; i++) { const a = i / 28 * Math.PI * 2; hoodEdge.push([Math.sin(a) * .139, Math.cos(a) * .179 + Math.max(0, Math.cos(a)) ** 5 * .028, .145 + Math.cos(a) * .015]); }
  pipe(head, hoodEdge, .012, ridgeCloth);
  for (const sign of [-1, 1]) {
    ball(head, [sign * .046, .048, .164], [.039, .027, .021], shadow);
    ball(head, [sign * .046, .048, .179], [.022, .010, .008], eye, 14);
    ball(head, [sign * .046, .047, .186], [.009, .010, .004], iris, 12);
    ball(head, [sign * .046, .047, .190], [.004, .009, .002], pupil, 10);
    pipe(head, [[sign * .016, .074, .171], [sign * .043, .082, .178], [sign * .079, .068, .163]], .013, crease);
    pipe(head, [[sign * .019, .030, .181], [sign * .050, .022, .178], [sign * .078, .034, .164]], .006, crease);
    for (let i = 0; i < 3; i++) pipe(head, [[sign * .035, .103 + i * .014, .158 - i * .008], [sign * .069, .108 + i * .013, .143 - i * .009], [sign * .085, .102 + i * .01, .125 - i * .008]], .003, crease);
    pipe(head, [[sign * .030, -.014, .182], [sign * .059, -.051, .165], [sign * .056, -.086, .164]], .006, crease);
    pipe(head, [[sign * .083, .007, .142], [sign * .085, -.045, .138], [sign * .074, -.092, .143]], .004, crease);
    ball(head, [sign * .029, -.018, .194], [.021, .014, .022], skin, 14);
    ball(head, [sign * .022, -.025, .209], [.009, .005, .006], shadow, 10);
  }
  ball(head, [0, .016, .186], [.028, .062, .044], skin);
  ball(head, [0, -.018, .215], [.026, .020, .025], skin);
  pipe(head, [[-.044, -.066, .177], [0, -.073, .188], [.044, -.066, .177]], .006, shadow);
  pipe(head, [[-.032, -.080, .177], [0, -.085, .186], [.032, -.080, .177]], .007, lip);
  pipe(head, [[-.037, -.112, .163], [0, -.118, .175], [.037, -.112, .163]], .004, crease);
  bakePart(head); group.add(head);
  group.userData.character = "Palpatine";
  // The finger tips, where the lightning leaves.
  const hands = [new THREE.Vector3(-.335, .965, .40), new THREE.Vector3(.39, 1.145, .39)];
  return { group, rig: { head, body, hands }, tick: (time, reduced) => {
    body.scale.y = reduced ? 1 : 1 + Math.sin(time * 1.05) * .0018;
    head.rotation.y = reduced ? 0 : Math.sin(time * .27) * .045;
    head.rotation.x = .06 + (reduced ? 0 : Math.sin(time * .53) * .012);
  } };
}

/** The Royal Guard's lacquered mask is distinct from ordinary white stormtrooper helmets. */
export function createRoyalGuard(): ImperialFigure {
  const group = new THREE.Group(); group.name = "emperor-royal-guard";
  const red = standard(0x9e1020, .23, .32), edge = standard(0x660c15, .4, .18), cloth = standard(0xa91426, .93, 0, THREE.DoubleSide), clothShadow = standard(0x780e1e, .96, 0, THREE.DoubleSide);
  const visor = standard(0x08090c, .13, .35), black = standard(0x17151a, .8), silver = standard(0xb6bec3, .27, .8);
  const body = new THREE.Group(); body.name = "royal-guard-draped-robes";
  part(body, robeGeometry([{ y: .045, x: .365, z: .25 }, { y: .14, x: .36, z: .25 }, { y: .42, x: .315, z: .225 }, { y: .83, x: .285, z: .21 }, { y: 1.13, x: .275, z: .20 }, { y: 1.48, x: .32, z: .195 }, { y: 1.64, x: .285, z: .175 }, { y: 1.69, x: .11, z: .11 }], 15, .015), cloth);
  for (const sign of [-1, 1]) {
    ball(body, [sign * .235, 1.53, -.01], [.13, .14, .14], cloth);
    pipe(body, [[sign * .11, 1.63, .10], [sign * .28, 1.43, .17], [sign * .32, .82, .14], [sign * .36, .10, .17]], .018, clothShadow);
    ball(body, [sign * .11, .045, .11], [.10, .045, .17], black);
  }
  plate(body, [[-.055, 0], [.18, -.025], [.31, -.30], [.32, -1.35], [.22, -1.60], [.10, -.95]], clothShadow, [0, 1.67, .10], .015, .005);
  // A glimpse of the gauntlet grips the staff through a split in the robe.
  rod(body, [-.25, 1.34, .10], [-.335, 1.11, .20], .065, .05, red);
  ball(body, [-.35, 1.09, .23], [.052, .035, .044], black);
  for (let i = 0; i < 4; i++) pipe(body, [[-.386 + i * .020, 1.11, .25], [-.389 + i * .020, 1.07, .27], [-.383 + i * .020, 1.06, .235]], .009, black);
  bakePart(body); group.add(body);

  const helmet = new THREE.Group(); helmet.name = "royal-guard-swept-red-helmet"; helmet.position.set(0, 1.82, .015);
  ball(helmet, [0, .040, -.025], [.157, .19, .145], red, 28);
  // Raised crown and the single sloping face shield form one long, polished mask.
  plate(helmet, [[-.135, .07], [.135, .07], [.115, -.11], [.055, -.235], [0, -.265], [-.065, -.225], [-.12, -.10]], red, [0, -.012, .105], .040, .014);
  for (const sign of [-1, 1]) {
    pipe(helmet, [[sign * .135, .105, .09], [sign * .145, -.035, .13], [sign * .080, -.205, .16], [sign * .020, -.25, .16]], .014, red);
    pipe(helmet, [[sign * .030, -.047, .167], [sign * .039, -.15, .168], [sign * .015, -.225, .163]], .005, edge);
    ball(helmet, [sign * .14, -.015, -.005], [.026, .075, .065], edge);
  }
  plate(helmet, [[-.126, .027], [-.080, .012], [.080, .012], [.126, .027], [.104, -.011], [.063, -.020], [-.063, -.020], [-.104, -.011]], visor, [0, .005, .160], .006, .002);
  pipe(helmet, [[-.132, .041, .145], [0, .035, .171], [.132, .041, .145]], .006, edge);
  bakePart(helmet); group.add(helmet);
  const pike = new THREE.Group(); pike.name = "royal-guard-force-pike";
  rod(pike, [-.36, .04, .25], [-.36, 2.13, .25], .010, .010, silver, 10);
  rod(pike, [-.36, .85, .25], [-.36, 1.18, .25], .019, .019, black, 12);
  for (const y of [.16, .77, 1.24, 1.76, 1.92]) rod(pike, [-.36, y, .25], [-.36, y + .035, .25], .022, .022, silver, 12);
  rod(pike, [-.36, 1.96, .25], [-.36, 2.16, .25], .028, .002, silver, 12);
  bakePart(pike); group.add(pike);
  group.userData.character = "Royal Guard";
  return { group, tick: (time, reduced) => { body.rotation.z = reduced ? 0 : Math.sin(time * .4) * .0025; helmet.rotation.y = reduced ? 0 : Math.sin(time * .20 + 1) * .018; } };
}
