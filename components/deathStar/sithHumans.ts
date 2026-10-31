import * as THREE from "three";
import { bakePart, part, pipe, rounded } from "../tatooineCharacters";

type XYZ = [number, number, number];
export type SithFigure = { group: THREE.Group; tick: (time: number, reduced: boolean) => void; rig: { head: THREE.Object3D; upper: THREE.Object3D; weapon: THREE.Object3D } };

const material = (color: number, roughness = .8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const sphere = (parent: THREE.Object3D, at: XYZ, scale: XYZ, mat: THREE.Material, segments = 20) => {
  const mesh = part(parent, new THREE.SphereGeometry(1, segments, Math.floor(segments * .75)), mat, at);
  mesh.scale.set(...scale);
  return mesh;
};
function rod(parent: THREE.Object3D, a: XYZ, b: XYZ, r: number, end: number, mat: THREE.Material, segments = 14) {
  const start = new THREE.Vector3(...a), span = new THREE.Vector3(...b).sub(start);
  const mesh = part(parent, new THREE.CylinderGeometry(end, r, span.length(), segments), mat);
  mesh.position.copy(start).addScaledVector(span, .5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), span.normalize());
  return mesh;
}
function panel(parent: THREE.Object3D, xy: [number, number][], z: number, depth: number, mat: THREE.Material) {
  const shape = new THREE.Shape(xy.map(p => new THREE.Vector2(...p)));
  return part(parent, new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .004, bevelThickness: .003 }), mat, [0, 0, z]);
}
function turned(parent: THREE.Object3D, profile: [number, number][], mat: THREE.Material, zScale = .65) {
  const mesh = part(parent, new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), 32), mat);
  mesh.scale.z = zScale;
  return mesh;
}

/** A tailored cape, open at the front, with actual folds and a differently coloured lining. */
function cape(parent: THREE.Object3D, outer: THREE.Material, lining: THREE.Material, height = 1.56, hem = .16, width = .44) {
  const group = new THREE.Group(); group.name = "lined-cloth-cape";
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const columns = 48, rows = 18;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    for (let column = 0; column <= columns; column++) {
      const u = column / columns, angle = .77 + u * (Math.PI * 2 - 1.54);
      const r = .235 + (width - .235) * Math.pow(t, .65) + Math.sin(angle * 11) * (.008 + t * .021);
      const edge = Math.pow(Math.abs(u - .5) * 2, 6);
      positions.push(Math.sin(angle) * r, height - (height - hem) * t - Math.sin(u * Math.PI) * .035 + Math.sin(angle * 11) * t * .009, Math.cos(angle) * r * (.53 + t * .12) - .055 - t * .04 + edge * .035);
      uvs.push(u * 4, t * 4);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column, b = a + columns + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const coat = new THREE.Mesh(geometry, outer); group.add(coat);
  const inner = new THREE.Mesh(geometry, lining); group.add(inner);
  parent.add(group);
  return group;
}

function blade(parent: THREE.Object3D, a: XYZ, b: XYZ, core: THREE.Material, halo: THREE.Material, haze: THREE.Material) {
  rod(parent, a, b, .009, .009, core, 10);
  rod(parent, a, b, .017, .017, halo, 12);
  rod(parent, a, b, .031, .031, haze, 12);
  sphere(parent, b, [.01, .01, .01], core, 10);
}
function saberMaterials() {
  const core = new THREE.MeshBasicMaterial({ color: 0xffd8d4, toneMapped: false });
  const glow = new THREE.MeshBasicMaterial({ color: 0xff1730, toneMapped: false, transparent: true, opacity: .68, blending: THREE.AdditiveBlending, depthWrite: false });
  const haze = new THREE.MeshBasicMaterial({ color: 0xff1028, toneMapped: false, transparent: true, opacity: .12, blending: THREE.AdditiveBlending, depthWrite: false });
  return { core, glow, haze };
}
function boot(parent: THREE.Object3D, x: number, z: number, leather: THREE.Material, trim: THREE.Material, yaw = 0) {
  const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = yaw;
  part(group, rounded(.135, .085, .29, .025), leather, [0, .053, .075]);
  part(group, rounded(.14, .018, .29, .01), trim, [0, .014, .075]);
  sphere(group, [0, .19, -.008], [.064, .16, .07], leather);
  pipe(group, [[-.045, .23, .047], [0, .22, .061], [.045, .23, .047]], .003, trim);
  parent.add(group);
}
function hand(parent: THREE.Object3D, at: XYZ, skin: THREE.Material, cuff: THREE.Material, gripping = false) {
  const group = new THREE.Group(); group.position.set(...at);
  sphere(group, [0, 0, 0], [.036, .055, .025], skin);
  for (let finger = 0; finger < 4; finger++) {
    const x = -.024 + finger * .016;
    if (gripping) {
      pipe(group, [[x, -.017, .014], [x, -.046, .029], [x, -.052, .009]], .0075, skin);
    } else {
      pipe(group, [[x, -.027, .007], [x * 1.12, -.065, .014], [x * 1.18, -.078 + Math.abs(finger - 1.5) * .01, .024]], .0065, skin);
    }
  }
  pipe(group, [[-.025, .012, .006], [-.043, -.012, .025], [-.03, -.032, .032]], .01, skin);
  part(group, rounded(.08, .04, .065, .008), cuff, [0, .055, -.004]);
  parent.add(group);
  return group;
}

// The tattoos are drawn on UVs projected onto the curved skull. No photograph, flat portrait,
// transparency or external asset is used; the brow, nose, eyes, horns and jaw are sculpted.
function maulSkin() {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#a52b29"; c.fillRect(0, 0, 512, 512);
  const fill = (points: [number, number][]) => { c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); };
  c.fillStyle = "#111315";
  fill([[235, 0], [277, 0], [283, 74], [268, 110], [271, 173], [256, 218], [241, 173], [244, 110], [229, 74]]);
  for (const sign of [-1, 1]) {
    c.save(); c.translate(256, 0); c.scale(sign, 1);
    fill([[32, 0], [80, 12], [100, 75], [79, 100], [85, 135], [120, 161], [151, 139], [161, 90], [183, 72], [196, 151], [175, 193], [136, 199], [99, 183], [76, 194], [40, 167], [31, 120], [44, 84]]);
    fill([[12, 203], [45, 222], [84, 211], [105, 234], [130, 230], [158, 254], [141, 283], [103, 279], [79, 257], [42, 260], [20, 239]]);
    fill([[34, 281], [69, 292], [111, 319], [141, 332], [141, 365], [109, 353], [87, 320], [62, 324], [26, 308]]);
    fill([[20, 329], [49, 355], [66, 391], [97, 406], [101, 443], [80, 462], [55, 421], [31, 401]]);
    fill([[14, 392], [36, 425], [40, 471], [62, 490], [63, 512], [4, 512]]);
    c.restore();
  }
  fill([[244, 294], [256, 278], [268, 294], [264, 328], [256, 345], [248, 328]]);
  fill([[232, 375], [245, 363], [256, 374], [267, 363], [280, 375], [270, 395], [256, 389], [242, 395]]);
  fill([[237, 421], [247, 430], [244, 453], [256, 467], [268, 453], [265, 430], [275, 421], [282, 462], [266, 484], [256, 481], [246, 484], [230, 462]]);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: texture, roughness: .72, metalness: .02 });
}

export function createDarthMaul(): SithFigure {
  const group = new THREE.Group(); group.name = "darth-maul"; group.userData.character = "Dark Maul";
  const base = new THREE.Group(), upper = new THREE.Group(), head = new THREE.Group(), weapon = new THREE.Group();
  base.name = "maul-stance"; upper.name = "maul-layered-tunic"; head.name = "maul-tattooed-head"; weapon.name = "maul-double-lightsaber";
  group.add(base, upper); upper.add(head, weapon);
  const cloth = material(0x121517, .91), lapel = material(0x23282a, .86), belt = material(0x181413, .7);
  const leather = material(0x101112, .42, .1), trim = material(0x33383a, .63, .2), black = material(0x0a0b0d, .73);
  const crimson = material(0xa42928, .76), shadedRed = material(0x6c2022, .8), horn = material(0xc8b796, .62), hornBase = material(0x4c3a30, .9);
  const metal = material(0x939b9e, .25, .88), grip = material(0x222628, .55, .5);
  const saber = saberMaterials();

  // The planted stance and long black boots carry the silhouette; the two skirt panels move
  // independently of the feet when the torso breathes.
  for (const side of [-1, 1]) {
    const hip: XYZ = [side * .105, .98, -.025], knee: XYZ = [side * .19, .56, side < 0 ? .04 : -.06], ankle: XYZ = [side * .22, .2, side < 0 ? .085 : -.11];
    rod(base, hip, knee, .082, .073, cloth); sphere(base, knee, [.074, .075, .074], cloth);
    rod(base, knee, ankle, .064, .06, leather);
    boot(base, ankle[0], ankle[2], leather, trim, side * -.09);
    panel(upper, [[side * .014, .99], [side * .16, .98], [side * .195, .49], [side * .025, .46]], .125, .018, cloth);
  }
  turned(upper, [[.15, .95], [.17, 1.04], [.19, 1.25], [.215, 1.43], [.15, 1.51], [.075, 1.53]], cloth);
  for (const side of [-1, 1]) {
    sphere(upper, [side * .19, 1.455, -.004], [.075, .078, .11], cloth);
    panel(upper, [[side * .047, 1.52], [side * .13, 1.45], [-side * .065, 1.01], [-side * .14, 1.01]], .13, .015, lapel);
    for (let i = 0; i < 3; i++) pipe(upper, [[side * .12, 1.32 - i * .045, .108], [side * .08, 1.25 - i * .045, .133], [side * .025, 1.16 - i * .045, .142]], .0032, lapel);
  }
  turned(upper, [[.175, .965], [.177, 1.04]], belt, .7);
  for (const y of [.981, 1.012, 1.034]) pipe(upper, [[-.15, y, .069], [0, y, .129], [.15, y, .069]], .004, leather);
  part(upper, rounded(.06, .047, .022, .006), trim, [.07, 1.006, .128]);
  rod(upper, [0, 1.49, -.005], [0, 1.64, .01], .061, .054, crimson);

  const armPose: [XYZ, XYZ, XYZ][] = [
    [[-.225, 1.445, .005], [-.31, 1.22, .095], [-.145, 1.09, .325]],
    [[.225, 1.445, .005], [.33, 1.23, .14], [.15, 1.05, .34]],
  ];
  armPose.forEach(([shoulder, elbow, wrist]) => {
    rod(upper, shoulder, elbow, .075, .062, cloth); sphere(upper, elbow, [.063, .062, .063], lapel);
    rod(upper, elbow, wrist, .061, .045, cloth); hand(upper, wrist, leather, lapel, true);
    for (const t of [.75, .88]) {
      const a = new THREE.Vector3(...elbow).lerp(new THREE.Vector3(...wrist), t);
      sphere(upper, a.toArray() as XYZ, [.046, .018, .048], lapel);
    }
  });

  head.position.set(0, 1.735, .009); head.rotation.x = -.035;
  const skullGeometry = new THREE.SphereGeometry(1, 40, 28);
  const pos = skullGeometry.attributes.position, uv = skullGeometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, .5 + pos.getX(i) * .45, .5 + pos.getY(i) * .5);
  const skull = part(head, skullGeometry, maulSkin()); skull.scale.set(.112, .142, .108);
  sphere(head, [0, -.072, .03], [.082, .067, .077], crimson);
  sphere(head, [0, -.111, .05], [.052, .026, .044], shadedRed);
  for (const side of [-1, 1]) {
    sphere(head, [side * .112, -.01, -.004], [.02, .036, .018], crimson);
    sphere(head, [side * .07, -.034, .072], [.033, .023, .027], crimson);
    pipe(head, [[side * .035, -.016, .102], [side * .074, -.031, .09], [side * .087, -.068, .065]], .009, black);
    sphere(head, [side * .043, .017, .093], [.031, .016, .014], black);
    const iris = new THREE.MeshBasicMaterial({ color: 0xd8a037, toneMapped: false });
    sphere(head, [side * .043, .014, .107], [.017, .008, .005], iris, 16);
    sphere(head, [side * .041, .014, .112], [.006, .007, .003], black, 12);
    const glint = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    sphere(head, [side * .04 - .004, .018, .114], [.002, .002, .002], glint, 8);
    pipe(head, [[side * .014, .033, .104], [side * .042, .041, .103], [side * .077, .029, .084]], .011, black);
    pipe(head, [[side * .016, -.05, .118], [side * .039, -.066, .1], [side * .045, -.089, .083]], .006, black);
  }
  rod(head, [0, .046, .097], [0, -.026, .122], .009, .014, crimson);
  sphere(head, [0, -.03, .12], [.017, .012, .014], shadedRed);
  for (const side of [-1, 1]) sphere(head, [side * .014, -.034, .114], [.008, .005, .006], black, 12);
  pipe(head, [[-.029, -.073, .1], [0, -.078, .112], [.029, -.073, .1]], .0053, black);
  pipe(head, [[-.014, -.091, .099], [0, -.105, .099], [.014, -.091, .099]], .005, black);
  // Small, slightly irregular horns rather than a comic oversized crown.
  const horns: [XYZ, XYZ, number][] = [
    [[0, .131, .005], [0, .193, .006], .015],
    [[-.063, .111, .05], [-.075, .165, .074], .014], [[.063, .111, .05], [.075, .165, .074], .014],
    [[-.098, .065, .015], [-.14, .104, .026], .015], [[.098, .065, .015], [.14, .104, .026], .015],
    [[-.058, .104, -.066], [-.075, .15, -.096], .013], [[.058, .104, -.066], [.075, .15, -.096], .013],
  ];
  horns.forEach(([a, b, r]) => { sphere(head, a, [r * 1.2, r, r * 1.2], hornBase, 12); rod(head, a, b, r, .001, horn, 10); });
  head.userData.hornCount = horns.length;

  weapon.position.set(0, 1.075, .35); weapon.rotation.z = -.12;
  rod(weapon, [-.25, 0, 0], [.25, 0, 0], .026, .026, metal, 20);
  for (const x of [-.235, -.19, -.11, .11, .19, .235]) rod(weapon, [x - .009, 0, 0], [x + .009, 0, 0], .032, .032, grip, 18);
  for (const side of [-1, 1]) {
    rod(weapon, [side * .25, 0, 0], [side * .285, 0, 0], .038, .03, metal, 18);
    blade(weapon, [side * .283, 0, 0], [side * 1.14, 0, 0], saber.core, saber.glow, saber.haze);
  }
  part(weapon, rounded(.036, .025, .027, .004), crimson, [0, .028, .004]);
  bakePart(base); bakePart(head); bakePart(weapon);
  head.removeFromParent(); weapon.removeFromParent(); bakePart(upper); upper.add(head, weapon);
  return { group, rig: { head, upper, weapon }, tick: (time, reduced) => {
    const breath = reduced ? 0 : Math.sin(time * 1.45) * .0035;
    upper.position.y = breath;
    head.rotation.y = reduced ? 0 : Math.sin(time * .27) * .07;
    saber.glow.opacity = reduced ? .68 : .65 + Math.sin(time * 41) * .025;
  } };
}

export function createCountDooku(): SithFigure {
  const group = new THREE.Group(); group.name = "count-dooku"; group.userData.character = "Comte Dooku";
  const legs = new THREE.Group(), upper = new THREE.Group(), head = new THREE.Group(), weapon = new THREE.Group();
  legs.name = "dooku-boots"; upper.name = "dooku-tailored-tunic"; head.name = "dooku-sculpted-head"; weapon.name = "dooku-curved-lightsaber";
  group.add(legs, upper); upper.add(head, weapon);
  const cloth = material(0x181a1a, .87), lapel = material(0x222524, .8), black = material(0x111214, .5, .08);
  const belt = material(0x4a2e22, .67), darkLeather = material(0x2b211d, .6), trim = material(0x4a4d4c, .48, .35);
  const skin = material(0xbba28c, .83), shadow = material(0x8d7060, .9), lip = material(0x75584f, .9);
  const hair = material(0xc1beb2, .91), hairShade = material(0x878a85, .91), metal = material(0xb4b8b6, .22, .9);
  const eyeWhite = material(0xd2d1c5, .6), iris = material(0x53666a, .4), pupil = material(0x131515, .3);
  const outer = new THREE.MeshStandardMaterial({ color: 0x3e281f, roughness: .94, side: THREE.FrontSide });
  const inner = new THREE.MeshStandardMaterial({ color: 0x886043, roughness: .91, side: THREE.BackSide });
  const saber = saberMaterials();
  for (const side of [-1, 1]) {
    rod(legs, [side * .095, 1.02, -.012], [side * .105, .53, -.014], .08, .065, cloth);
    rod(legs, [side * .105, .53, -.014], [side * .115, .18, .01], .061, .06, black);
    boot(legs, side * .115, .008, black, trim, side * .06);
  }
  // The long high collar and restrained shoulders distinguish Dooku's straight, aristocratic pose.
  turned(upper, [[.17, .91], [.19, 1.12], [.213, 1.4], [.23, 1.49], [.15, 1.56], [.07, 1.57]], cloth);
  turned(upper, [[.17, .89], [.19, .99]], belt, .73);
  for (let i = 0; i < 4; i++) pipe(upper, [[-.155, .91 + i * .022, .068], [0, .91 + i * .022, .137], [.155, .91 + i * .022, .068]], .0035, darkLeather);
  for (const side of [-1, 1]) part(upper, rounded(.055, .08, .025, .007), darkLeather, [side * .16, .944, .075]);
  panel(upper, [[-.175, .89], [-.19, 1.03], [.19, 1.03], [.175, .89]], .116, .014, cloth);
  panel(upper, [[-.19, 1.43], [-.13, 1.57], [-.075, 1.61], [-.065, 1.47]], .077, .025, lapel);
  panel(upper, [[.19, 1.43], [.13, 1.57], [.075, 1.61], [.065, 1.47]], .077, .025, lapel);
  rod(upper, [0, 1.51, 0], [0, 1.72, 0], .06, .054, skin);
  const coat = cape(upper, outer, inner, 1.565, .145, .445);
  for (const side of [-1, 1]) {
    sphere(upper, [side * .208, 1.49, -.02], [.081, .056, .115], outer);
    sphere(upper, [side * .095, 1.5, .135], [.018, .018, .007], metal, 14);
  }
  pipe(upper, [[-.095, 1.5, .143], [-.045, 1.478, .161], [0, 1.47, .167], [.045, 1.478, .161], [.095, 1.5, .143]], .0043, metal);
  for (let i = 0; i < 7; i++) part(upper, new THREE.TorusGeometry(.007, .0018, 4, 10), metal, [-.075 + i * .025, 1.472 + Math.abs(i - 3) * .006, .163]);

  // Right hand carries the curved hilt low; the free left hand is open in a measured gesture.
  rod(upper, [-.225, 1.46, 0], [-.28, 1.18, .015], .067, .054, cloth);
  rod(upper, [-.28, 1.18, .015], [-.29, .985, .12], .053, .04, cloth);
  hand(upper, [-.29, .954, .125], skin, lapel, true);
  rod(upper, [.225, 1.46, 0], [.3, 1.22, .04], .067, .054, cloth);
  rod(upper, [.3, 1.22, .04], [.39, 1.1, .15], .053, .04, cloth);
  const openHand = hand(upper, [.415, 1.067, .17], skin, lapel); openHand.rotation.z = .32; openHand.rotation.x = -.22;
  for (const side of [-1, 1]) {
    for (const y of [1.06, 1.085]) pipe(upper, [[side * .27, y, .085], [side * .29, y, .105], [side * .315, y, .09]], .003, lapel);
  }

  head.position.set(0, 1.79, .007); head.rotation.x = -.02;
  sphere(head, [0, .014, -.013], [.104, .145, .099], skin, 32);
  sphere(head, [0, -.07, .011], [.078, .083, .079], skin, 28);
  sphere(head, [0, -.125, .025], [.052, .035, .054], skin);
  for (const side of [-1, 1]) {
    sphere(head, [side * .103, -.013, -.012], [.023, .04, .019], skin);
    sphere(head, [side * .105, -.014, -.001], [.01, .025, .011], shadow, 14);
    sphere(head, [side * .07, -.035, .068], [.031, .035, .027], skin);
    pipe(head, [[side * .031, -.032, .097], [side * .047, -.052, .091], [side * .065, -.063, .075]], .0026, shadow);
    sphere(head, [side * .043, .014, .087], [.024, .01, .012], eyeWhite);
    sphere(head, [side * .043, .014, .099], [.008, .008, .0028], iris, 14);
    sphere(head, [side * .043, .014, .102], [.0035, .006, .002], pupil, 12);
    pipe(head, [[side * .018, .037, .095], [side * .044, .049, .092], [side * .074, .034, .077]], .009, skin);
    pipe(head, [[side * .018, .045, .099], [side * .044, .055, .093], [side * .074, .039, .079]], .0055, hairShade);
    pipe(head, [[side * .016, .0, .102], [side * .041, -.002, .1], [side * .067, .004, .086]], .0027, shadow);
    // Characteristic silver sideburns and pointed cheeks of the short beard.
    sphere(head, [side * .083, -.01, .027], [.017, .06, .035], hairShade);
    sphere(head, [side * .066, -.074, .051], [.027, .052, .041], hair);
    pipe(head, [[side * .085, -.019, .05], [side * .066, -.075, .09], [side * .027, -.13, .074]], .009, hairShade);
    pipe(head, [[side * .005, -.053, .112], [side * .025, -.057, .109], [side * .038, -.07, .095]], .008, hair);
  }
  rod(head, [0, .053, .083], [0, -.02, .123], .009, .014, skin);
  sphere(head, [0, -.026, .12], [.016, .013, .016], skin);
  for (const side of [-1, 1]) sphere(head, [side * .014, -.031, .109], [.007, .006, .009], shadow, 14);
  pipe(head, [[-.026, -.072, .106], [0, -.074, .11], [.026, -.072, .106]], .0034, lip);
  sphere(head, [0, -.115, .054], [.05, .05, .043], hair);
  const beardTip = part(head, new THREE.ConeGeometry(.038, .067, 18), hair, [0, -.148, .055], [Math.PI, 0, 0]); beardTip.scale.z = .7;
  for (let i = 0; i < 7; i++) pipe(head, [[-.026 + i * .008, -.09, .092], [-.02 + i * .006, -.125, .096], [-.012 + i * .004, -.16, .066]], .0023, hairShade);
  // Receding hairline, combed backward in long silver ridges rather than a round white cap.
  const hairCap = new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, Math.PI * .59);
  const hp = hairCap.attributes.position;
  for (let i = 0; i < hp.count; i++) hp.setXYZ(i, hp.getX(i) * .108, hp.getY(i) * .133 + .027, hp.getZ(i) * .104 - .03);
  hairCap.computeVertexNormals(); part(head, hairCap, hairShade);
  for (let i = 0; i < 11; i++) {
    const x = -.085 + i * .017;
    const reach = Math.sqrt(Math.max(0, 1 - (x / .11) ** 2));
    pipe(head, [[x, .103 + reach * .023, .053 * reach - .012], [x * .9, .166 - Math.abs(x) * .15, -.018], [x * .8, .138, -.083]], .006, i % 3 ? hair : hairShade);
  }
  for (const side of [-1, 1]) sphere(head, [side * .096, .02, -.05], [.021, .077, .059], hair);
  for (const y of [.066, .077]) pipe(head, [[-.037, y, .088], [0, y + .004, .093], [.037, y, .088]], .0018, shadow);

  weapon.position.set(-.29, .94, .13); weapon.rotation.z = -.64; weapon.rotation.x = -.12;
  pipe(weapon, [[0, .13, 0], [-.025, .055, .002], [0, -.045, .007], [.06, -.13, .005]], .023, metal);
  pipe(weapon, [[-.006, .085, .024], [-.012, .02, .027], [.012, -.048, .03]], .014, black);
  rod(weapon, [.047, -.1, .005], [.073, -.14, .005], .03, .028, metal, 18);
  rod(weapon, [0, .12, 0], [0, .18, 0], .031, .027, metal, 18);
  blade(weapon, [0, .175, 0], [0, 1.12, 0], saber.core, saber.glow, saber.haze);
  part(weapon, rounded(.016, .033, .011, .003), material(0x8e1d22, .5), [.015, .076, .02]);
  // Rotate the emitter downward away from his legs, so the blade reads clearly beside the cape.
  weapon.rotation.z = 2.5;

  bakePart(legs); bakePart(head); bakePart(weapon);
  head.removeFromParent(); weapon.removeFromParent(); coat.removeFromParent(); bakePart(upper); upper.add(coat, head, weapon);
  return { group, rig: { head, upper, weapon }, tick: (time, reduced) => {
    upper.position.y = reduced ? 0 : Math.sin(time * 1.2 + .9) * .003;
    head.rotation.y = reduced ? -.045 : -.045 + Math.sin(time * .22 + 1.1) * .065;
    coat.rotation.z = reduced ? 0 : Math.sin(time * .53) * .006;
    saber.glow.opacity = reduced ? .68 : .65 + Math.sin(time * 37 + .4) * .025;
  } };
}
