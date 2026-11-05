import * as THREE from "three";
import { bakePart, part, pipe, rounded } from "./tatooineCharacters";

type XYZ = [number, number, number];

/** Chewie at the holotable: shaggy coat and bandolier, seated facing +Z. */
export function createSeatedChewbacca(seatHeight = .55) {
  const group = new THREE.Group(); group.name = "cantina-chewbacca"; group.userData.character = true;
  const brown = new THREE.MeshStandardMaterial({ color: 0x59402b, roughness: 1 });
  const shadow = new THREE.MeshStandardMaterial({ color: 0x332b22, roughness: 1 });
  const gold = new THREE.MeshStandardMaterial({ color: 0x88633f, roughness: 1 });
  const warm = brown;
  const skin = new THREE.MeshStandardMaterial({ color: 0x4a3c30, roughness: .88 });
  const black = new THREE.MeshStandardMaterial({ color: 0x181716, roughness: .5 });
  const eyes = new THREE.MeshStandardMaterial({ color: 0x241c14, roughness: .19 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x37291f, roughness: .79 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xabb5b5, metalness: .82, roughness: .33 });
  const socket = new THREE.MeshStandardMaterial({ color: 0x262423, metalness: .42, roughness: .58 });
  for (const material of [brown, shadow, gold]) material.userData.surfaceKind = "fur";
  skin.userData.surfaceKind = "skin";
  leather.userData.surfaceKind = "leather";
  silver.userData.surfaceKind = "metal";
  socket.userData.surfaceKind = "metal";
  eyes.userData.skipSurfaceDetail = true;
  black.userData.skipSurfaceDetail = true;
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
  const strand = (root: THREE.Group, points: XYZ[], radius: number, material: THREE.Material) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const geometry = new THREE.TubeGeometry(curve, 8, radius, 5, false);
    const positions = geometry.getAttribute("position");
    const center = new THREE.Vector3();
    for (let ring = 0; ring <= 8; ring++) {
      const progress = ring / 8;
      curve.getPointAt(progress, center);
      const taper = 1 - progress * .92;
      for (let side = 0; side <= 5; side++) {
        const index = ring * 6 + side;
        positions.setXYZ(index,
          center.x + (positions.getX(index) - center.x) * taper,
          center.y + (positions.getY(index) - center.y) * taper,
          center.z + (positions.getZ(index) - center.z) * taper);
      }
    }
    geometry.computeVertexNormals();
    return part(root, geometry, material);
  };
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
    for (let finger = 0; finger < 4; finger++) {
      const x = -side * .045 - .045 + finger * .03;
      rod(arm, [x, -.49, .44], [x - .002, -.505, .49], .013, .011, skin);
      rod(arm, [x - .002, -.505, .49], [x - .003, -.522, .516], .011, .009, skin);
      // Dark, blunt Wookiee claws.
      const claw = part(arm, new THREE.ConeGeometry(.0075, .024, 6), black, [x - .003, -.528, .527]);
      claw.rotation.x = Math.PI / 2 + .7;
    }
    rod(arm, [-side * .045 - side * .05, -.49, .4], [-side * .045 - side * .062, -.505, .45], .015, .011, skin);
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
    pipe(head, [[side * .026, .059, .153], [side * .069, .063, .162], [side * .106, .039, .141]], .019, warm);
    for (let k = 0; k < 5; k++) strand(head,
      [[side * (.035 + k * .013), .079, .13], [side * (.055 + k * .016), .098 - k * .006, .148], [side * (.085 + k * .014), .043 - k * .01, .14]], .006, k % 2 ? gold : brown);
  }
  // A dark facial mask frames the muzzle, with fur growing out of its edges.
  for (const side of [-1, 1]) {
    sphere(head, [side * .045, -.035, .158], [.034, .054, .025], shadow);
    strand(head, [[side * .09, -.012, .17], [side * .125, -.055, .17], [side * .14, -.17, .145]], .011, gold);
    strand(head, [[side * .105, .018, .149], [side * .151, -.025, .139], [side * .17, -.11, .12]], .01, brown);
  }
  sphere(head, [0, -.047, .153], [.068, .053, .045], skin);
  sphere(head, [0, -.033, .191], [.053, .025, .025], black);
  for (const side of [-1, 1]) sphere(head, [side * .026, -.042, .212], [.013, .008, .006], shadow);
  // The moustache spreads sideways then drops into the long golden beard.
  for (const side of [-1, 1]) for (let i = 0; i < 11; i++) {
    const x = side * (.018 + i * .009), y = -.067 - i * .002;
    strand(head, [[x * .7, y, .194], [x, y - .037, .205 - i * .002], [x * 1.12, y - .10, .175 - i * .002]], .007, i % 3 ? gold : brown);
  }
  pipe(head, [[-.053, -.105, .184], [0, -.12, .196], [.053, -.104, .184]], .008, shadow);
  locks(head, [0, -.17, .11], [.118, .105, .082], 85, .24, 32, true);
  // Long swept locks soften the pointed crown rather than leaving a round cap.
  for (let i = 0; i < 15; i++) {
    const x = -.14 + i * .02;
    strand(head, [[x, .16 + .09 * (1 - Math.abs(x) / .16), .015], [x * .85, .19, .10], [x * .95, .09, .13]], .0065, i % 3 ? brown : warm);
  }
  bakePart(head);
  // Deep-set dark eyes with a wet catchlight, under furred lids that blink.
  const glint = new THREE.MeshBasicMaterial({ color: 0xfff4e0 });
  const gazes = [-1, 1].map(side => {
    const g = new THREE.Group(); g.position.set(side * .065, .014, .163); head.add(g);
    sphere(g, [0, 0, 0], [.021, .017, .012], eyes);
    sphere(g, [-.005, .005, .011], [.003, .003, .0015], glint);
    return g;
  });
  const lids = [-1, 1].map(side => sphere(head, [side * .065, .037, .157], [.026, .013, .02], warm));
  // A mouth that opens under the moustache: dark inside, ivory fangs and a lower lip.
  const ivory = new THREE.MeshStandardMaterial({ color: 0xd8ccae, roughness: .45 });
  const mouth = new THREE.Group(); mouth.position.set(0, -.1, .2); head.add(mouth);
  const inner = sphere(mouth, [0, 0, 0], [.055, .004, .028], black);
  const fangs = [-1, 1].map(side => {
    const fang = part(mouth, new THREE.ConeGeometry(.008, .032, 6), ivory, [side * .03, -.012, .02]);
    fang.rotation.x = Math.PI; return fang;
  });
  const lowerLip = sphere(mouth, [0, -.012, .012], [.05, .015, .024], skin);
  let idleTime = 0, quiet = false, gesture = 0;
  const mood = { look: 0, roar: 0, proud: 0 };
  const pose = () => {
    const a = THREE.MathUtils.clamp(gesture, 0, 1), t = quiet ? 0 : idleTime, { look, roar, proud } = mood;
    // He throws his head back to roar when Han wins, and nods, pleased, when the board goes his way.
    head.rotation.x = .085 + a * .055 + (1 - look) * .16 - roar * .38 + proud * Math.sin(t * 5) * .05 + (quiet ? 0 : Math.sin(t * .37) * .012);
    head.rotation.y = (quiet ? 0 : Math.sin(t * .23) * .045) - a * .035 + roar * Math.sin(t * 3) * .08;
    gazes.forEach(g => g.position.y = .014 + (look - .6) * .003);
    const blinkPhase = (t + 1.7) % 5.2;
    const blink = !quiet && blinkPhase < .2 ? Math.sin(Math.PI * blinkPhase / .2) : 0;
    lids.forEach(l => { l.position.y = .037 - blink * .019 - roar * .006; });
    const open = Math.max(roar, proud * .35 * (.5 + .5 * Math.sin(t * 9)));
    inner.scale.y = .004 + open * .048; inner.position.y = -open * .024;
    fangs.forEach(f => { f.visible = open > .12; f.scale.setScalar(.4 + open * .6); });
    lowerLip.position.y = -.012 - open * .05;
    arms[0].rotation.x = -a * .13 - roar * .75;
    arms[0].rotation.y = a * -.13;
    arms[0].rotation.z = -roar * .35;
    arms[1].rotation.x = a * .035 - roar * .75;
    arms[1].rotation.z = a * -.065 + roar * .35;
    body.scale.y = quiet ? 1 : 1 + Math.sin(t * .8) * .002 + proud * .012;
  };
  return { group,
    tick: (time: number, reduced: boolean) => { idleTime = time; quiet = reduced; pose(); },
    play: (amount: number) => { gesture = quiet ? 0 : amount; pose(); },
    react: (next: { look: number; roar: number; proud: number }) => { Object.assign(mood, quiet ? { look: 0, roar: 0, proud: 0 } : next); pose(); },
  };
}
