import * as THREE from "three";
import { bakePart, part, pipe, rounded } from "./tatooineCharacters";

type XYZ = [number, number, number];

// A standing human for the cameos (Obi-Wan, Luke, Jon Snow): facing +Z, feet at y = 0, with
// jointed hips, knees, shoulders and elbows, and a face whose eyes look about and blink.

export type HumanLook = {
  name: string;
  skin: number;
  hair: number;
  iris: number;
  hairStyle: "swept" | "curly" | "short";
  beard?: number;
  tunic: number;
  sleeves?: number;
  trousers: number;
  boots: number;
  belt: number;
  gloves?: number;
};

export function shapes() {
  const box = (g: THREE.Object3D, at: XYZ, size: XYZ, mat: THREE.Material, r = 0.01) => part(g, rounded(...size, r), mat, at);
  const ball = (g: THREE.Object3D, at: XYZ, scale: XYZ, mat: THREE.Material) => {
    const mesh = part(g, new THREE.SphereGeometry(1, 16, 12), mat, at);
    mesh.scale.set(...scale);
    return mesh;
  };
  const rod = (g: THREE.Object3D, a: XYZ, b: XYZ, r1: number, r2: number, mat: THREE.Material) => {
    const from = new THREE.Vector3(...a),
      to = new THREE.Vector3(...b),
      span = to.clone().sub(from);
    const mesh = part(g, new THREE.CylinderGeometry(r2, r1, span.length(), 14), mat);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), span.normalize());
    return mesh;
  };
  return { box, ball, rod, pipe };
}

export type Limb = { root: THREE.Group; joint: THREE.Group };
export type Human = {
  group: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  arms: Limb[];
  legs: Limb[];
  // Where the eyes look, -1 to 1 across and down to up, and the blink, driven every frame.
  look: (across: number, up: number, time: number, still: boolean) => void;
};

const mat = (color: number, roughness = 0.85, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

/** Builds the figure; `dress` adds costume pieces to the groups before they are baked. */
export function createStandingHuman(look: HumanLook, dress?: (parts: Omit<Human, "look">, s: ReturnType<typeof shapes>) => void): Human {
  const s = shapes();
  const { box, ball, rod } = s;
  const group = new THREE.Group();
  group.name = look.name;
  const skin = mat(look.skin, 0.78),
    lip = mat(new THREE.Color(look.skin).multiplyScalar(0.78).getHex(), 0.85),
    hair = mat(look.hair, 0.92),
    tunic = mat(look.tunic, 0.9),
    sleeves = look.sleeves === undefined ? tunic : mat(look.sleeves, 0.9),
    trousers = mat(look.trousers, 0.92),
    boots = mat(look.boots, 0.55),
    belt = mat(look.belt, 0.7),
    hands = look.gloves === undefined ? skin : mat(look.gloves, 0.6),
    white = mat(0xe4ddd2, 0.5);

  const body = new THREE.Group();
  group.add(body);
  box(body, [0, 0.95, 0], [0.33, 0.17, 0.2], trousers, 0.05);
  ball(body, [0, 1.16, 0], [0.165, 0.2, 0.105], tunic);
  box(body, [0, 1.3, -0.005], [0.36, 0.28, 0.2], tunic, 0.07);
  for (const side of [-1, 1]) ball(body, [side * 0.155, 1.405, 0], [0.06, 0.045, 0.075], tunic);
  rod(body, [0, 1.42, 0], [0, 1.57, 0.01], 0.058, 0.052, skin);
  box(body, [0, 1.035, 0], [0.345, 0.055, 0.215], belt, 0.012);

  const legs = [-1, 1].map((side) => {
    const root = new THREE.Group();
    root.position.set(side * 0.095, 0.93, 0);
    group.add(root);
    rod(root, [0, 0.03, 0], [0, -0.44, 0.01], 0.078, 0.062, trousers);
    const joint = new THREE.Group();
    joint.position.set(0, -0.44, 0.01);
    root.add(joint);
    ball(joint, [0, 0, 0], [0.06, 0.06, 0.065], trousers);
    rod(joint, [0, 0, 0], [0, -0.22, -0.01], 0.055, 0.05, trousers);
    rod(joint, [0, -0.2, -0.01], [0, -0.4, 0], 0.058, 0.052, boots);
    box(joint, [0, -0.445, 0.045], [0.11, 0.09, 0.26], boots, 0.03);
    return { root, joint };
  });

  const arms = [-1, 1].map((side) => {
    const root = new THREE.Group();
    root.position.set(side * 0.205, 1.41, 0);
    group.add(root);
    ball(root, [0, -0.015, 0], [0.06, 0.066, 0.064], sleeves);
    rod(root, [0, -0.02, 0], [side * 0.01, -0.29, 0], 0.056, 0.047, sleeves);
    const joint = new THREE.Group();
    joint.position.set(side * 0.01, -0.29, 0);
    root.add(joint);
    ball(joint, [0, 0, 0], [0.047, 0.047, 0.05], sleeves);
    rod(joint, [0, 0, 0], [0, -0.24, 0.015], 0.046, 0.037, sleeves);
    // Hand: palm, a block of fingers curled slightly in, and the thumb on the inner side.
    box(joint, [0, -0.29, 0.02], [0.05, 0.085, 0.032], hands, 0.012);
    box(joint, [0, -0.35, 0.03], [0.047, 0.05, 0.03], hands, 0.012).rotation.x = 0.35;
    rod(joint, [-side * 0.024, -0.27, 0.03], [-side * 0.03, -0.32, 0.05], 0.011, 0.009, hands);
    return { root, joint };
  });

  // Head: skull, jaw and chin, cheekbones, ears, a straight nose and a mouth.
  const head = new THREE.Group();
  head.position.set(0, 1.645, 0.012);
  group.add(head);
  ball(head, [0, 0.025, -0.012], [0.108, 0.135, 0.105], skin);
  ball(head, [0, -0.066, 0.018], [0.08, 0.07, 0.083], skin);
  ball(head, [0, -0.1, 0.045], [0.064, 0.03, 0.053], skin);
  for (const side of [-1, 1]) {
    ball(head, [side * 0.106, -0.012, -0.005], [0.022, 0.04, 0.021], skin);
    ball(head, [side * 0.068, -0.03, 0.068], [0.03, 0.022, 0.025], skin);
    ball(head, [side * 0.042, 0.024, 0.086], [0.025, 0.012, 0.013], white);
    // Brow ridge, then the eyebrow in the hair colour.
    pipe(head, [[side * 0.019, 0.032, 0.099], [side * 0.041, 0.039, 0.097], [side * 0.066, 0.027, 0.086]], 0.0047, skin);
    pipe(head, [[side * 0.019, 0.05, 0.096], [side * 0.043, 0.056, 0.093], [side * 0.07, 0.043, 0.076]], 0.0048, hair);
  }
  rod(head, [0, 0.05, 0.094], [0, -0.013, 0.118], 0.009, 0.014, skin);
  ball(head, [0, -0.017, 0.117], [0.017, 0.013, 0.015], skin);
  for (const side of [-1, 1]) ball(head, [side * 0.014, -0.02, 0.109], [0.008, 0.009, 0.009], skin);
  pipe(head, [[-0.027, -0.056, 0.098], [0, -0.059, 0.103], [0.027, -0.056, 0.098]], 0.0034, lip);

  const cap = (scaleX: number, scaleY: number, scaleZ: number, lift: number) => {
    const geometry = new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
      p = geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * scaleX, p.getY(i) * scaleY + lift + Math.max(0, p.getZ(i)) * 0.012, p.getZ(i) * scaleZ - 0.025);
    geometry.computeVertexNormals();
    return part(head, geometry, hair);
  };
  if (look.hairStyle === "swept") {
    // A full farm-boy mop swept across from a side parting.
    cap(0.12, 0.155, 0.116, 0.034);
    for (const [x, lift, r] of [[-0.07, 0, 0.016], [-0.035, 0.008, 0.019], [0.005, 0.012, 0.02], [0.042, 0.004, 0.018], [0.074, -0.01, 0.015]]) {
      pipe(head, [[x * 0.3 - 0.02, 0.168, -0.01], [x + 0.015, 0.155 + lift, 0.055], [x + 0.04, 0.112 + lift * 0.5, 0.084]], r, hair);
    }
    for (const side of [-1, 1]) ball(head, [side * 0.097, 0.03, -0.035], [0.03, 0.075, 0.07], hair);
  } else if (look.hairStyle === "short") {
    // Short, receding and swept back, fuller over the ears.
    cap(0.114, 0.145, 0.112, 0.03);
    for (const side of [-1, 1]) {
      ball(head, [side * 0.098, 0.03, -0.04], [0.028, 0.07, 0.068], hair);
      ball(head, [side * 0.09, 0.0, 0.01], [0.02, 0.045, 0.03], hair);
    }
  } else {
    // Long dark curls to the shoulders, the top half tied back in a knot.
    cap(0.122, 0.157, 0.12, 0.034);
    for (let i = 0; i < 26; i++) {
      const a = Math.PI * (0.27 + (i % 13) / 12 * 0.55) * (i < 13 ? 1 : -1),
        drop = i % 2 ? 0.07 : 0.0;
      ball(head, [Math.sin(a) * 0.11, -0.02 - drop - Math.abs(Math.cos(a)) * 0.05, Math.cos(a) * 0.1 - 0.03], [0.034, 0.05, 0.034], hair);
    }
    for (let i = 0; i < 9; i++) ball(head, [(i - 4) * 0.022, -0.1 - (i % 2) * 0.03, -0.085], [0.03, 0.06, 0.028], hair);
    for (let i = 0; i < 5; i++) pipe(head, [[-0.05 + i * 0.025, 0.16, 0.035], [-0.07 + i * 0.03, 0.135, 0.085], [-0.08 + i * 0.035, 0.09, 0.095]], 0.01, hair);
    ball(head, [0, 0.1, -0.115], [0.04, 0.035, 0.035], hair);
  }
  if (look.beard !== undefined) {
    const beard = mat(look.beard, 1);
    ball(head, [0, -0.085, 0.045], [0.07, 0.05, 0.06], beard);
    for (const side of [-1, 1]) {
      ball(head, [side * 0.065, -0.055, 0.04], [0.035, 0.05, 0.05], beard);
      ball(head, [side * 0.088, -0.015, 0.02], [0.022, 0.045, 0.04], beard);
      pipe(head, [[side * 0.004, -0.043, 0.112], [side * 0.022, -0.047, 0.108], [side * 0.037, -0.062, 0.096]], 0.007, beard);
    }
  }
  dress?.({ group, body, head, arms, legs }, s);
  bakePart(body);
  legs.forEach((leg) => {
    bakePart(leg.joint);
    const joint = leg.joint;
    joint.removeFromParent();
    bakePart(leg.root);
    leg.root.add(joint);
  });
  arms.forEach((arm) => {
    bakePart(arm.joint);
    const joint = arm.joint;
    joint.removeFromParent();
    bakePart(arm.root);
    arm.root.add(joint);
  });
  bakePart(head);

  // Irises with a catchlight slide across the eye whites; the lids drop for a blink.
  const iris = mat(look.iris, 0.25),
    pupil = mat(0x0b0a09, 0.15),
    glint = new THREE.MeshBasicMaterial({ color: 0xfff6e8 });
  const gazes = [-1, 1].map((side) => {
    const g = new THREE.Group();
    g.position.set(side * 0.042, 0.024, 0.1);
    head.add(g);
    part(g, new THREE.CircleGeometry(0.0095, 16), iris);
    part(g, new THREE.CircleGeometry(0.0045, 12), pupil, [0, 0, 0.0004]);
    part(g, new THREE.CircleGeometry(0.0018, 8), glint, [-0.003, 0.003, 0.0008]);
    return g;
  });
  const lids = [-1, 1].map((side) => ball(head, [side * 0.042, 0.042, 0.088], [0.027, 0.01, 0.0145], skin));
  const phase = look.name.length * 0.37;
  return {
    group,
    body,
    head,
    arms,
    legs,
    look: (across, up, time, still) => {
      gazes.forEach((g, i) => {
        g.position.x = (i ? 1 : -1) * 0.042 + across * 0.006;
        g.position.y = 0.024 + up * 0.004;
      });
      const blink = !still && (time * 0.25 + phase) % 1 > 0.962 ? 1 : 0;
      lids.forEach((l) => {
        l.position.y = 0.042 - blink * 0.015;
        l.scale.y = 0.01 + blink * 0.004;
      });
    },
  };
}

/** Swings the legs and arms through a walking stride; `step` is the phase in radians. */
export function walkPose(human: Human, step: number, amount = 1) {
  human.legs.forEach((leg, i) => {
    const swing = Math.sin(step + i * Math.PI);
    leg.root.rotation.x = -swing * 0.38 * amount;
    // The knee bends as the leg swings through, and stays near straight while it bears weight.
    leg.joint.rotation.x = Math.max(0, Math.cos(step + i * Math.PI)) * 0.55 * amount;
  });
  human.arms.forEach((arm, i) => {
    arm.root.rotation.x = Math.sin(step + i * Math.PI) * 0.28 * amount;
    arm.joint.rotation.x = -0.18 * amount;
  });
  human.body.position.y = Math.abs(Math.cos(step)) * 0.02 * amount;
  human.head.position.y = 1.645 + human.body.position.y;
}
