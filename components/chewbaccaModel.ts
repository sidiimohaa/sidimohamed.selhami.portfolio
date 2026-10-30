import * as THREE from "three";
import { bakePart, part, pipe, rounded } from "./tatooineCharacters";

type XYZ = [number, number, number];

/** Chewie at the holotable: shaggy coat and bandolier, seated facing +Z. */
export function createSeatedChewbacca(seatHeight = .55) {
  const group = new THREE.Group(); group.name = "cantina-chewbacca";
  const brown = new THREE.MeshStandardMaterial({ color: 0x59402b, roughness: 1 });
  const shadow = new THREE.MeshStandardMaterial({ color: 0x332b22, roughness: 1 });
  const gold = new THREE.MeshStandardMaterial({ color: 0x977044, roughness: 1 });
  const warm = brown;
  const skin = new THREE.MeshStandardMaterial({ color: 0x4a3c30, roughness: .88 });
  const black = new THREE.MeshStandardMaterial({ color: 0x181716, roughness: .5 });
  const eyes = new THREE.MeshStandardMaterial({ color: 0x241c14, roughness: .19 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x37291f, roughness: .79 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xabb5b5, metalness: .82, roughness: .33 });
  const socket = new THREE.MeshStandardMaterial({ color: 0x262423, metalness: .42, roughness: .58 });
  const hip = seatHeight + .09, shoulder = seatHeight + .83;
  const sphere = (root: THREE.Group, at: XYZ, radii: XYZ, mat: THREE.Material = brown) => {
    const mesh = part(root, new THREE.SphereGeometry(1, 18, 12), mat, at);
    mesh.scale.set(...radii); return mesh;
  };
  const rod = (root: THREE.Group, a: XYZ, b: XYZ, ra: number, rb: number, material: THREE.Material) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), span = end.clone().sub(start);
    const m = part(root, new THREE.CylinderGeometry(rb, ra, span.length(), 12), material);
    m.position.copy(start).add(end).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), span.normalize()); return m;
  };
  const strand = (root: THREE.Group, points: XYZ[], radius: number, material: THREE.Material) =>
    part(root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 8, radius, 4, false), material);
  // Overlapping tapered locks follow the coat's surface. All locks are merged
  // by material, so a long shaggy coat does not cost one draw call per strand.
  const locks = (root: THREE.Group, center: XYZ, radii: XYZ, count: number, length: number, seed: number, beard = false) => {
    for (let i = 0; i < count; i++) {
      const y = 1 - (i + .5) * 2 / count, a = i * 2.399963 + seed;
      const s = Math.sqrt(1 - y * y), n = new THREE.Vector3(Math.cos(a) * s, y, Math.sin(a) * s);
      const l = length * (.72 + (i % 7) * .075);
      const material = i % 9 < 2 ? gold : i % 5 === 0 ? shadow : i % 3 === 0 ? warm : brown;
      const direction = new THREE.Vector3(n.x * .12, -1, beard ? .09 : n.z * .15).normalize();
      // An open root is sunk into the coat. Closed, broad cone caps looked
      // like little tiles from the side; these six-sided locks read as hair.
      const anchor = new THREE.Vector3(center[0] + n.x * radii[0], center[1] + n.y * radii[1], center[2] + n.z * radii[2]).addScaledVector(n, -.014);
      const mesh = part(root, new THREE.ConeGeometry(.008 + (i % 4) * .0018, l, 6, 1, true), material);
      mesh.position.copy(anchor).addScaledVector(direction, l * .5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    }
  };

  const body = new THREE.Group(); body.name = "chewbacca-coat"; group.add(body);
  sphere(body, [0, hip + .29, -.025], [.265, .45, .185]);
  sphere(body, [0, shoulder - .055, -.025], [.315, .17, .19]);
  sphere(body, [0, hip + .025, .015], [.255, .15, .21]);
  locks(body, [0, hip + .30, -.015], [.265, .44, .19], 310, .22, .3);
  locks(body, [0, shoulder - .03, -.015], [.31, .15, .19], 100, .16, 1.2);
  for (const side of [-1, 1]) {
    const x = side * .16;
    rod(body, [x, hip, .015], [side * .19, hip - .035, .38], .13, .115, brown);
    sphere(body, [side * .19, hip - .035, .38], [.13, .13, .13]);
    locks(body, [side * .175, hip + .015, .19], [.125, .12, .23], 75, .18, side + 4);
    rod(body, [side * .19, hip - .08, .39], [side * .195, .11, .405], .095, .083, brown);
    locks(body, [side * .192, (hip + .06) / 2, .4], [.094, (hip - .1) / 2, .10], 62, .19, side + 7);
    sphere(body, [side * .195, .073, .49], [.1, .075, .18], shadow);
    locks(body, [side * .195, .10, .48], [.1, .055, .15], 35, .11, side + 9);
    for (let toe = 0; toe < 3; toe++) sphere(body, [side * .195 - .06 + toe * .06, .047, .635], [.025, .03, .047], skin);
  }
  // The broad ammunition bandolier lies above the fur, slanting from left
  // shoulder to right hip, with the paired silver boxes from the reference.
  const strap = part(body, rounded(.105, .86, .035, .009), leather, [.005, hip + .37, .225]);
  strap.rotation.z = -.52;
  for (let i = 0; i < 7; i++) {
    const x = -.178 + i * .056, y = shoulder - .035 - i * .102;
    const base = part(body, rounded(.106, .078, .024, .004), socket, [x, y, .249]); base.rotation.z = -.52;
    for (const offset of [-.023, .023]) {
      const box = part(body, rounded(.039, .067, .028, .004), silver, [x + offset * .87, y + offset * .5, .268]); box.rotation.z = -.52;
      const seam = part(body, new THREE.BoxGeometry(.027, .007, .003), leather, [x + offset * .87, y + offset * .5, .284]); seam.rotation.z = -.52;
    }
  }
  const bag = part(body, rounded(.19, .20, .10, .018), leather, [.24, hip - .035, .12]); bag.rotation.z = -.1;
  part(body, rounded(.20, .063, .108, .012), brown, [.24, hip + .054, .128]);
  part(body, rounded(.037, .036, .012, .004), silver, [.24, hip + .012, .181]);
  bakePart(body);
  body.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const p = o.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) if (p.getY(i) < .006) p.setY(i, .006);
    o.geometry.computeVertexNormals();
  });

  const arms = [-1, 1].map(side => {
    const arm = new THREE.Group(); arm.name = side < 0 ? "chewbacca-left-arm" : "chewbacca-right-arm";
    arm.position.set(side * .32, shoulder - .055, -.005); group.add(arm);
    sphere(arm, [0, -.035, 0], [.105, .13, .11]);
    rod(arm, [0, -.04, 0], [side * .025, -.34, .07], .09, .072, brown);
    locks(arm, [side * .012, -.19, .035], [.092, .19, .09], 100, .19, side + 12);
    rod(arm, [side * .025, -.34, .07], [-side * .045, -.48, .38], .077, .057, brown);
    locks(arm, [-side * .01, -.415, .22], [.074, .085, .17], 100, .18, side + 14);
    sphere(arm, [-side * .045, -.49, .405], [.068, .046, .09], skin);
    locks(arm, [-side * .045, -.468, .405], [.067, .025, .075], 25, .075, side + 16);
    for (let finger = 0; finger < 4; finger++) rod(arm,
      [-side * .045 - .045 + finger * .03, -.49, .44],
      [-side * .045 - .047 + finger * .03, -.508, .503], .013, .010, skin);
    bakePart(arm); return arm;
  });

  const head = new THREE.Group(); head.name = "chewbacca-head";
  head.position.set(0, shoulder + .18, -.015); group.add(head);
  // Long Wookiee cranium, swept crown and cheek fur. There are deliberately
  // no round projecting ears: the brow, nose and moustache define the face.
  sphere(head, [0, .035, -.005], [.19, .265, .16]);
  sphere(head, [0, -.085, .06], [.175, .19, .145]);
  locks(head, [0, .06, -.03], [.19, .235, .14], 150, .18, 22);
  for (const side of [-1, 1]) {
    sphere(head, [side * .115, -.07, .073], [.076, .15, .075], warm);
    locks(head, [side * .13, -.09, .085], [.075, .15, .06], 48, .20, side + 25, true);
    sphere(head, [side * .065, .015, .143], [.049, .028, .027], shadow);
    sphere(head, [side * .065, .014, .165], [.021, .017, .012], eyes);
    pipe(head, [[side * .026, .059, .153], [side * .069, .063, .162], [side * .106, .039, .141]], .019, warm);
    for (let k = 0; k < 5; k++) strand(head,
      [[side * (.035 + k * .013), .079, .13], [side * (.055 + k * .016), .098 - k * .006, .148], [side * (.085 + k * .014), .043 - k * .01, .14]], .006, k % 2 ? gold : brown);
  }
  sphere(head, [0, -.047, .153], [.068, .053, .045], skin);
  sphere(head, [0, -.033, .191], [.053, .025, .025], black);
  for (const side of [-1, 1]) sphere(head, [side * .026, -.042, .212], [.013, .008, .006], shadow);
  // The moustache spreads sideways then drops into the long golden beard.
  for (const side of [-1, 1]) for (let i = 0; i < 11; i++) {
    const x = side * (.018 + i * .009), y = -.067 - i * .002;
    pipe(head, [[x * .7, y, .194], [x, y - .037, .205 - i * .002], [x * 1.12, y - .10, .175 - i * .002]], .007, i % 3 ? gold : brown);
  }
  pipe(head, [[-.053, -.105, .184], [0, -.12, .196], [.053, -.104, .184]], .008, shadow);
  locks(head, [0, -.17, .11], [.118, .105, .082], 85, .24, 32, true);
  // Long swept locks soften the pointed crown rather than leaving a round cap.
  for (let i = 0; i < 15; i++) {
    const x = -.14 + i * .02;
    strand(head, [[x, .16 + .09 * (1 - Math.abs(x) / .16), .015], [x * .85, .19, .10], [x * .95, .09, .13]], .0065, i % 3 ? brown : warm);
  }
  bakePart(head);
  let idleTime = 0, quiet = false;
  const pose = (amount: number) => {
    const a = THREE.MathUtils.clamp(amount, 0, 1), t = quiet ? 0 : idleTime;
    head.rotation.x = .085 + a * .055 + (quiet ? 0 : Math.sin(t * .37) * .012);
    head.rotation.y = (quiet ? 0 : Math.sin(t * .23) * .045) - a * .035;
    arms[0].rotation.x = -a * .13;
    arms[0].rotation.y = a * -.13;
    arms[1].rotation.x = a * .035;
    arms[1].rotation.z = a * -.065;
    body.scale.y = quiet ? 1 : 1 + Math.sin(t * .8) * .002;
  };
  return { group,
    tick: (time: number, reduced: boolean) => { idleTime = time; quiet = reduced; pose(0); },
    play: (amount: number) => pose(quiet ? 0 : amount),
  };
}
