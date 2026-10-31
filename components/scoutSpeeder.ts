import * as THREE from "three";
import { bakePart, part, pipe, rounded } from "./tatooineCharacters";

type XYZ = [number, number, number];
const UP = new THREE.Vector3(0, 1, 0);

// Shared 74-Z and scout trooper for Endor's patrols and the racing simulation.
// The bike faces +Z, with its seat at y=.29. The racing scene turns this complete rig around.
// Small mechanical details are baked by material; the helmet, steering and arm joints remain live.
const material = (name: string, color: number | string, roughness: number, metalness = 0) => {
  const result = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  result.name = name;
  return result;
};
const box = (g: THREE.Object3D, at: XYZ, size: XYZ, mat: THREE.Material, radius = .01) => part(g, rounded(...size, radius), mat, at);
const ball = (g: THREE.Object3D, at: XYZ, scale: XYZ, mat: THREE.Material) => {
  const mesh = part(g, new THREE.SphereGeometry(1, 18, 12), mat, at);
  mesh.scale.set(...scale);
  return mesh;
};
function rod(g: THREE.Object3D, a: XYZ, b: XYZ, radius: number, mat: THREE.Material, endRadius = radius) {
  const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), delta = to.clone().sub(from);
  const mesh = part(g, new THREE.CylinderGeometry(endRadius, radius, delta.length(), 12), mat);
  mesh.position.copy(from).add(to).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(UP, delta.normalize());
  return mesh;
}
function panel(g: THREE.Object3D, points: [number, number][], depth: number, mat: THREE.Material, at: XYZ, rotate: XYZ = [0, 0, 0]) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  return part(g, new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }), mat, at, rotate);
}

// Rounded sections make the cowling taper into a narrow nose, instead of a rectangular block.
function cowling(sections: { z: number; y: number; w: number; h: number }[]) {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [], sides = 16;
  for (let ring = 0; ring < sections.length; ring++) {
    const s = sections[ring];
    for (let j = 0; j < sides; j++) {
      const a = j / sides * Math.PI * 2, c = Math.cos(a), n = Math.sin(a);
      positions.push(Math.sign(c) * Math.abs(c) ** .55 * s.w / 2, s.y + Math.sign(n) * Math.abs(n) ** .7 * s.h / 2, s.z);
      uv.push(j / sides, ring / (sections.length - 1));
      if (ring < sections.length - 1) {
        const a0 = ring * sides + j, b0 = ring * sides + (j + 1) % sides;
        indices.push(a0, b0, a0 + sides, b0, b0 + sides, a0 + sides);
      }
    }
  }
  // End faces are triangulated as fans; the softened outline is still visible from the rear.
  for (let j = 1; j < sides - 1; j++) {
    indices.push(0, j + 1, j);
    const last = (sections.length - 1) * sides;
    indices.push(last, last + j, last + j + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function exhaustTexture() {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 64;
  const c = canvas.getContext("2d")!;
  const gradient = c.createRadialGradient(32, 32, 1, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(.18, "rgba(255,255,255,.6)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = gradient; c.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export function createScoutRider() {
  const group = new THREE.Group(); group.name = "scout-trooper-rider";
  const ivory = material("scout-ivory-armor", 0xdcded4, .36, .12);
  const edge = material("scout-armor-seams", 0x8e968e, .58, .15);
  const suit = material("scout-black-undersuit", 0x11171a, .92);
  const rubber = material("scout-gloves-and-joints", 0x202526, .66);
  const visor = material("scout-optical-visor", 0x03090d, .16, .18);
  const dirt = material("scout-forest-weathering", 0x92907a, .92);
  const metal = material("scout-buckle", 0x89958f, .38, .65);
  const body = new THREE.Group(); body.name = "scout-torso"; group.add(body);
  // The pelvis is actually on the saddle, with the chest leaning forward over the tank.
  ball(body, [0, .51, -.36], [.18, .105, .15], suit);
  rod(body, [0, .54, -.32], [0, .97, -.03], .15, suit, .20);
  for (const side of [-1, 1]) {
    const breast = ball(body, [side * .105, .88, .105], [.13, .19, .056], ivory);
    breast.rotation.x = .45;
    box(body, [side * .205, .83, -.04], [.035, .23, .17], edge, .009);
  }
  box(body, [0, 1.015, .025], [.35, .075, .18], ivory, .025);
  // Tapered belly plate, belt pouches and the scout's compact back-mounted power unit.
  panel(body, [[-.16, .12], [.16, .12], [.13, -.12], [-.13, -.12]], .025, ivory, [0, .66, -.015], [.48, 0, 0]);
  box(body, [0, .545, -.28], [.35, .065, .26], ivory, .015);
  for (const x of [-.135, -.045, .045, .135]) box(body, [x, .535, -.105], [.063, .10, .045], ivory, .012);
  box(body, [0, .535, -.076], [.063, .045, .015], metal, .005);
  box(body, [0, .85, -.24], [.31, .30, .13], ivory, .04);
  box(body, [0, .85, -.31], [.21, .12, .022], suit, .008);
  for (const x of [-.08, 0, .08]) box(body, [x, .85, -.324], [.035, .09, .012], edge, .002);
  // Ribbed soft cloth under the plate makes the armor read as separate pieces.
  for (let i = 0; i < 5; i++) rod(body, [-.13, .61 + i * .035, -.005 + i * .019], [.13, .61 + i * .035, -.005 + i * .019], .009, rubber);
  box(body, [-.12, .86, .163], [.025, .09, .005], dirt, .002);
  box(body, [.11, .93, .16], [.052, .012, .005], dirt, .002);
  rod(body, [0, 1.02, .045], [0, 1.17, .075], .06, suit);
  bakePart(body);

  const head = new THREE.Group(); head.name = "scout-helmet";
  head.position.set(0, 1.28, .12); group.add(head);
  // Raised crown, broad peak and angular cheeks distinguish a scout from a stormtrooper.
  const dome = part(head, new THREE.SphereGeometry(.168, 24, 16, 0, Math.PI * 2, 0, Math.PI * .73), ivory, [0, .045, -.005]);
  dome.scale.set(1.04, 1.02, 1.03);
  box(head, [0, .12, -.025], [.21, .115, .245], ivory, .045);
  box(head, [0, .093, .147], [.355, .045, .16], ivory, .019);
  box(head, [0, .112, .213], [.32, .016, .026], edge, .005);
  // A single, deep black visor with downturned outer lobes and a narrow white nose bridge.
  panel(head, [[-.147, .075], [.147, .075], [.139, -.002], [.086, -.038], [.04, .004], [0, .017], [-.04, .004], [-.086, -.038], [-.139, -.002]], .012, visor, [0, -.01, .169]);
  for (const side of [-1, 1]) {
    panel(head, [[side * .04, .02], [side * .14, .02], [side * .148, -.13], [side * .105, -.19], [side * .052, -.145]], .055, ivory, [0, -.005, .15]);
    box(head, [side * .17, -.02, -.015], [.055, .18, .13], ivory, .018);
    rod(head, [side * .197, -.05, -.03], [side * .197, .038, -.03], .024, edge);
    box(head, [side * .163, -.105, .077], [.027, .07, .05], edge, .006);
  }
  // Long vented snout, rather than the stormtrooper's round respirators and frown.
  panel(head, [[-.045, .04], [.045, .04], [.062, -.13], [.042, -.18], [-.042, -.18], [-.062, -.13]], .09, ivory, [0, -.023, .173]);
  box(head, [0, -.112, .269], [.047, .133, .017], visor, .013);
  for (let i = 0; i < 5; i++) box(head, [0, -.157 + i * .021, .281], [.041, .006, .006], rubber, .001);
  box(head, [0, -.146, -.102], [.25, .065, .12], ivory, .018);
  box(head, [0, -.176, .161], [.09, .018, .058], edge, .005);
  bakePart(head);

  // Hip, knee and ankle placement is seated. The boots sit on the two pedals, not in mid-air.
  const legs = [-1, 1].map((side) => {
    const limb = new THREE.Group(); limb.name = side < 0 ? "scout-leg-left" : "scout-leg-right";
    const hip: XYZ = [side * .115, .49, -.35], knee: XYZ = [side * .32, .13, .08], ankle: XYZ = [side * .32, -.38, -.12];
    rod(limb, hip, knee, .079, suit, .068);
    ball(limb, [side * .27, .235, -.035], [.075, .13, .12], ivory).rotation.x = -.65;
    ball(limb, knee, [.089, .089, .08], rubber);
    box(limb, [side * .32, .13, .151], [.14, .14, .055], ivory, .035);
    rod(limb, knee, ankle, .067, suit, .056);
    const shin = ball(limb, [side * .32, -.15, .008], [.076, .24, .065], ivory); shin.rotation.x = -.34;
    box(limb, [side * .32, -.38, -.08], [.15, .17, .19], ivory, .035);
    box(limb, [side * .32, -.465, .015], [.16, .09, .29], ivory, .032);
    box(limb, [side * .32, -.51, .018], [.165, .028, .30], rubber, .012);
    box(limb, [side * .32, -.44, .132], [.11, .015, .018], dirt, .003);
    for (let i = 0; i < 3; i++) box(limb, [side * .32, -.31 + i * .035, -.182], [.12, .014, .024], edge, .003);
    if (side > 0) box(limb, [.419, -.16, -.05], [.063, .18, .1], suit, .014);
    bakePart(limb); group.add(limb);
    const foot = new THREE.Object3D(); foot.name = `scout-foot-${side < 0 ? "left" : "right"}`; foot.position.set(side * .32, -.51, .018); group.add(foot);
    return limb;
  });

  const armSpecs = [-1, 1].map((side) => {
    const shoulder = new THREE.Vector3(side * .23, 1.0, -.005), elbow = new THREE.Vector3(side * .355, .79, .10), grip = new THREE.Vector3(side * .345, .665, .43);
    const makeBone = (from: THREE.Vector3, to: THREE.Vector3, upper: boolean) => {
      const bone = new THREE.Group(), length = from.distanceTo(to);
      rod(bone, [0, 0, 0], [0, length, 0], upper ? .067 : .058, suit, upper ? .058 : .047);
      const plate = ball(bone, [0, length * .51, .022], [upper ? .083 : .065, length * .43, upper ? .077 : .062], ivory);
      plate.rotation.y = side * .18;
      if (!upper) {
        box(bone, [0, length * .55, .075], [.075, length * .65, .018], ivory, .008);
        box(bone, [side * .041, length * .4, .062], [.023, .055, .014], edge, .004);
      }
      bakePart(bone); group.add(bone); return { bone, length };
    };
    const upper = makeBone(shoulder, elbow, true), lower = makeBone(elbow, grip, false);
    const cap = new THREE.Group();
    ball(cap, [0, 0, 0], [.105, .105, .105], ivory);
    box(cap, [side * .05, -.035, .015], [.065, .15, .12], ivory, .03);
    bakePart(cap); group.add(cap);
    const joint = part(group, new THREE.SphereGeometry(.064, 12, 10), rubber); joint.position.copy(elbow);
    const hand = new THREE.Group(); hand.name = `scout-grip-${side < 0 ? "left" : "right"}`;
    hand.position.copy(grip); group.add(hand);
    ball(hand, [0, .015, .01], [.068, .053, .061], rubber);
    box(hand, [0, .046, .008], [.11, .025, .075], suit, .008);
    // Curled fingers wrap below the handlebar; a thumb braces its inside edge.
    for (let i = 0; i < 4; i++) {
      const x = -.041 + i * .026;
      pipe(hand, [[x, .022, .04], [x, -.016, .063], [x, -.038, .025], [x, -.027, -.004]], .012, rubber);
    }
    rod(hand, [-side * .048, .014, .025], [-side * .071, -.02, .0], .022, rubber);
    bakePart(hand);
    return { side, shoulder, elbow, grip, upper, lower, cap, joint };
  });
  const a = new THREE.Vector3(), b = new THREE.Vector3(), direction = new THREE.Vector3();
  const placeBone = (piece: { bone: THREE.Group; length: number }, from: THREE.Vector3, to: THREE.Vector3) => {
    direction.copy(to).sub(from); piece.bone.position.copy(from);
    piece.bone.scale.y = direction.length() / piece.length;
    piece.bone.quaternion.setFromUnitVectors(UP, direction.normalize());
  };
  const tick = (time: number, reduced: boolean, bank = 0, thrust = 1) => {
    const breathe = reduced ? 0 : Math.sin(time * 2.0) * .004;
    const brace = reduced ? 0 : Math.min(1, Math.max(0, thrust)) * .012;
    body.position.set(bank * .018, breathe - brace, 0);
    head.position.set(bank * .025, 1.28 + breathe - brace, .12);
    head.rotation.set(reduced ? 0 : -.025 + Math.sin(time * .7) * .009, -bank * .22, -bank * .07);
    for (const arm of armSpecs) {
      a.copy(arm.shoulder); a.x += bank * .018; a.y += breathe - brace;
      b.copy(arm.elbow); b.x += bank * .012; b.y -= brace * .4;
      arm.cap.position.copy(a); arm.joint.position.copy(b);
      placeBone(arm.upper, a, b); placeBone(arm.lower, b, arm.grip);
    }
  };
  tick(0, true);
  return { group, body, head, arms: armSpecs.map(a => a.upper.bone), legs, tick };
}

export function createScoutSpeeder(options: { withRider?: boolean; trail?: string; light?: boolean } = {}) {
  const withRider = options.withRider !== false, trail = options.trail ?? "#ffab68";
  const root = new THREE.Group(); root.name = "imperial-74-z-speeder";
  const frame = new THREE.Group(); frame.name = "74z-hull-and-mechanics"; root.add(frame);
  const brown = material("74z-worn-brown-cowling", 0x76503a, .62, .32);
  const rim = material("74z-exposed-panel-edges", 0xa28a68, .66, .35);
  const dark = material("74z-graphite-chassis", 0x22282a, .62, .57);
  const metal = material("74z-steering-alloy", 0x86938f, .34, .80);
  const black = material("74z-hoses-and-saddle", 0x111719, .82, .05);
  const tan = material("74z-rolled-kit", 0x9a8e6b, .95);
  const exhaustMat = new THREE.MeshBasicMaterial({ color: trail, toneMapped: false });
  exhaustMat.name = "74z-engine-glow";
  part(frame, cowling([{ z: -.78, y: .06, w: .46, h: .32 }, { z: -.4, y: .05, w: .57, h: .36 }, { z: .12, y: .09, w: .52, h: .30 }, { z: .60, y: .0, w: .32, h: .12 }, { z: .69, y: -.025, w: .20, h: .075 }]), brown);
  box(frame, [0, -.19, -.25], [.41, .075, 1.5], dark, .028);
  // Narrow black saddle, rear side cowls and the rolled equipment pack from the references.
  box(frame, [0, .285, -.42], [.285, .105, .68], black, .05);
  box(frame, [0, .25, -.45], [.32, .025, .74], rim, .012);
  for (const side of [-1, 1]) {
    const rear = part(frame, cowling([{ z: -1.39, y: .02, w: .24, h: .31 }, { z: -1.24, y: .05, w: .28, h: .38 }, { z: -.72, y: .07, w: .22, h: .31 }]), brown);
    rear.position.x = side * .24;
    rod(frame, [side * .32, -.14, -1.35], [side * .32, -.14, -.67], .035, dark);
    box(frame, [side * .39, -.0, -.99], [.018, .11, .28], rim, .007);
    for (let i = 0; i < 5; i++) box(frame, [side * .255, .07 + i * .045, -1.42], [.17, .018, .016], dark, .003);
  }
  rod(frame, [-.27, .33, -1.13], [.27, .33, -1.13], .11, tan);
  for (const side of [-1, 1]) part(frame, new THREE.TorusGeometry(.112, .014, 6, 18), black, [side * .17, .33, -1.13], [0, Math.PI / 2, 0]);
  // Fine panel seams, latches, inset vents and exposed fasteners on the sloping nose.
  box(frame, [0, .239, .02], [.25, .018, .18], rim, .008);
  box(frame, [0, .252, .02], [.21, .012, .13], brown, .006);
  for (const side of [-1, 1]) {
    rod(frame, [side * .22, .15, -.16], [side * .125, .076, .55], .008, dark);
    for (let i = 0; i < 4; i++) box(frame, [side * .279, .03, -.37 + i * .08], [.012, .082, .033], dark, .004);
    for (const z of [-.7, -.3, .28, .52]) ball(frame, [side * (z > .2 ? .12 : .23), .14 - Math.max(0, z) * .12, z], [.012, .006, .012], metal);
    box(frame, [side * .245, .125, -.22], [.016, .006, .16], rim, .002);
  }
  // Engine block, cooling fins, paired nozzles and bundled cables remain open underneath.
  rod(frame, [0, -.13, -.92], [0, -.13, -.05], .15, dark);
  for (let i = 0; i < 11; i++) part(frame, new THREE.TorusGeometry(.151, .012, 6, 18), metal, [0, -.13, -.82 + i * .065]);
  box(frame, [0, -.32, -.58], [.31, .14, .36], dark, .018);
  for (let i = 0; i < 6; i++) box(frame, [-.12 + i * .048, -.40, -.58], [.018, .05, .30], metal, .002);
  for (const side of [-1, 1]) {
    rod(frame, [side * .16, -.06, -1.2], [side * .16, -.06, -1.60], .095, dark, .106);
    part(frame, new THREE.TorusGeometry(.096, .013, 6, 18), metal, [side * .16, -.06, -1.60]);
    part(frame, new THREE.CircleGeometry(.078, 16), black, [side * .16, -.06, -1.61], [0, Math.PI, 0]);
    part(frame, new THREE.CircleGeometry(.046, 16), exhaustMat, [side * .16, -.06, -1.616], [0, Math.PI, 0]);
    pipe(frame, [[side * .21, -.08, .23], [side * .32, -.30, -.1], [side * .30, -.32, -.70], [side * .17, -.1, -1.16]], .025, black);
    pipe(frame, [[side * .19, -.04, .07], [side * .35, -.25, -.18], [side * .33, -.15, -.80]], .012, metal);
    // Drop-down pedal cage aligns exactly with the boot sole.
    rod(frame, [side * .16, -.18, -.05], [side * .34, -.49, .0], .025, metal);
    box(frame, [side * .32, -.535, .015], [.23, .035, .35], dark, .01);
    rod(frame, [side * .43, -.53, -.14], [side * .43, -.53, .18], .019, metal);
    for (let i = 0; i < 4; i++) rod(frame, [side * .24, -.51, -.11 + i * .08], [side * .40, -.51, -.11 + i * .08], .009, metal);
  }
  // Long fork spars, chromed sliding sleeves and separate aerodynamic steering vanes.
  for (const side of [-1, 1]) {
    rod(frame, [side * .18, -.095, .45], [side * .18, -.095, 2.70], .027, dark);
    rod(frame, [side * .18, -.095, .75], [side * .18, -.095, 1.36], .039, metal);
    for (const z of [.73, 1.0, 1.36, 2.45]) part(frame, new THREE.TorusGeometry(.043, .008, 5, 12), dark, [side * .18, -.095, z]);
    rod(frame, [side * .18, -.095, 1.02], [side * .18, -.095, 2.53], .014, metal);
    const vane = new THREE.Group(); vane.name = `74z-vane-${side < 0 ? "left" : "right"}`;
    vane.position.set(side * .18, -.10, 2.59);
    panel(vane, [[0, -.19], [side * .36, -.21], [side * .39, .17], [side * .12, .30], [0, .06]], .016, brown, [0, 0, 0], [0, side * -.22, 0]);
    panel(vane, [[0, 0], [side * .34, -.06], [side * .44, .35], [side * .04, .43]], .016, brown, [0, -.18, -.10], [Math.PI / 2, 0, 0]);
    box(vane, [0, 0, -.02], [.07, .10, .09], metal, .008);
    bakePart(vane); frame.add(vane);
  }
  rod(frame, [-.18, -.095, 1.10], [.18, -.095, 1.10], .026, metal);
  // The higher, jointed handlebar is separate from the bike cowling.
  const steering = new THREE.Group(); steering.name = "74z-articulated-handlebar";
  root.add(steering);
  for (const side of [-1, 1]) {
    rod(steering, [side * .14, .18, .31], [side * .23, .41, .22], .027, metal);
    rod(steering, [side * .23, .41, .22], [side * .345, .665, .43], .025, metal);
    for (const [x, y, z] of [[side * .14, .18, .31], [side * .23, .41, .22]]) {
      rod(steering, [x - .028, y, z], [x + .028, y, z], .038, dark);
    }
    rod(steering, [side * .285, .665, .43], [side * .415, .665, .43], .024, black);
    for (let i = 0; i < 5; i++) part(steering, new THREE.TorusGeometry(.025, .004, 5, 10), metal, [side * (.293 + i * .023), .665, .43], [0, Math.PI / 2, 0]);
    pipe(steering, [[side * .36, .64, .43], [side * .30, .42, .18], [side * .24, .21, -.01]], .009, black);
    rod(steering, [side * .37, .653, .44], [side * .38, .635, .50], .009, metal);
  }
  box(steering, [0, .24, .31], [.16, .035, .12], dark, .015);
  bakePart(steering); bakePart(frame);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: exhaustTexture(), color: trail, transparent: true, opacity: .65, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.name = "74z-exhaust-plume"; glow.position.set(0, -.06, -1.70); glow.scale.setScalar(.45); glow.visible = withRider; root.add(glow);
  const light = new THREE.PointLight(trail, options.light ? 1.5 : 0, 6, 2);
  light.visible = !!options.light; light.position.set(0, -.8, -2.8); root.add(light);
  const rider = withRider ? createScoutRider() : null;
  if (rider) root.add(rider.group);
  root.traverse(object => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
  const tick = (time: number, reduced: boolean, bank = 0, thrust = 1) => {
    rider?.tick(time, reduced, bank, thrust);
    // The grips are fixed in the scout's hands; steering is driven through the vanes and body bank.
    steering.rotation.y = reduced ? 0 : bank * .025;
    if (withRider) (glow.material as THREE.SpriteMaterial).opacity = reduced ? .6 : .56 + Math.sin(time * 29) * .055 + thrust * .08;
  };
  return { root, rider, glow, light, tick };
}
