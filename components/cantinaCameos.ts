import * as THREE from "three";
import { glowTexture } from "./landingKit";
import { createStandingHuman, type Human } from "./humanFigure";
import { part } from "./tatooineCharacters";

// Two nods hidden in the cantina, in the district's (u, y, v) frame: Obi-Wan and Luke at the bar,
// looking for a pilot, and the scorch left on a booth wall the day Han shot first.

const HAN_TABLE = { u: -8.3, v: 57.4 };
const shortest = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

function createKenobi() {
  return createStandingHuman(
    {
      name: "cantina-obi-wan",
      skin: 0xd7ae95,
      hair: 0xdcd8cf,
      beard: 0xd3cdc2,
      iris: 0x5f7d8f,
      hairStyle: "short",
      tunic: 0xd6c4a0,
      trousers: 0xc9b690,
      boots: 0x55392a,
      belt: 0x6a472d,
    },
    ({ body, arms }, { box, ball, rod }) => {
      const robe = new THREE.MeshStandardMaterial({ color: 0x4c3222, roughness: 1, side: THREE.DoubleSide });
      const tabard = new THREE.MeshStandardMaterial({ color: 0xbfa985, roughness: 0.95 });
      const metal = new THREE.MeshStandardMaterial({ color: 0xb9bcbc, roughness: 0.3, metalness: 0.85 });
      const grip = new THREE.MeshStandardMaterial({ color: 0x1b1a18, roughness: 0.6 });
      // Tabards crossing over the shoulders and hanging down the front of the tunic.
      for (const side of [-1, 1]) {
        box(body, [side * 0.072, 1.25, 0.104], [0.075, 0.36, 0.022], tabard, 0.008);
        box(body, [side * 0.072, 1.25, -0.104], [0.075, 0.36, 0.022], tabard, 0.008);
      }
      box(body, [0, 0.9, 0.0], [0.3, 0.2, 0.2], new THREE.MeshStandardMaterial({ color: 0xd6c4a0, roughness: 0.9 }), 0.05);
      // The heavy brown cloak, open at the front, falling in folds to the ankles.
      const cloak = new THREE.CylinderGeometry(0.245, 0.43, 1.34, 36, 8, true, 0.55, Math.PI * 2 - 1.1),
        p = cloak.getAttribute("position");
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          y = p.getY(i),
          z = p.getZ(i),
          angle = Math.atan2(x, z),
          low = 0.5 - y / 1.34,
          fold = 1 + Math.sin(angle * 9) * 0.035 * low + Math.sin(angle * 4 + 1) * 0.02 * low;
        p.setXYZ(i, x * fold, y, z * fold * 0.82);
      }
      cloak.computeVertexNormals();
      part(body, cloak, robe, [0, 0.74, -0.01]);
      // The hood lies bunched at the back of the neck.
      ball(body, [0, 1.47, -0.11], [0.17, 0.075, 0.1], robe);
      ball(body, [0, 1.52, -0.09], [0.12, 0.05, 0.08], robe);
      // His lightsaber hangs at the left hip.
      rod(body, [0.19, 1.0, 0.07], [0.2, 0.77, 0.09], 0.017, 0.017, metal);
      rod(body, [0.19, 0.97, 0.072], [0.195, 0.86, 0.082], 0.019, 0.019, grip);
      // Wide robe sleeves over the tunic.
      arms.forEach((arm) => {
        rod(arm.root, [0, 0.02, 0], [0, -0.29, 0], 0.08, 0.088, robe);
        rod(arm.joint, [0, 0, 0], [0, -0.22, 0.015], 0.09, 0.115, robe);
      });
    },
  );
}

function createLuke() {
  return createStandingHuman(
    {
      name: "cantina-luke",
      skin: 0xe3bb9b,
      hair: 0xc59e5e,
      iris: 0x5a86b3,
      hairStyle: "swept",
      tunic: 0xebe6da,
      trousers: 0xd5cab2,
      boots: 0x7b5a3a,
      belt: 0x6a675f,
    },
    ({ body }, { box, rod, pipe }) => {
      const tunic = new THREE.MeshStandardMaterial({ color: 0xebe6da, roughness: 0.9 });
      const seam = new THREE.MeshStandardMaterial({ color: 0xc8c1b1, roughness: 1 });
      const metal = new THREE.MeshStandardMaterial({ color: 0xa9adad, roughness: 0.35, metalness: 0.8 });
      const pouch = new THREE.MeshStandardMaterial({ color: 0x55524b, roughness: 0.8 });
      // The wrap-over front of his farm tunic, its high collar, and the flared skirt below the belt.
      pipe(body, [[-0.12, 1.44, 0.07], [-0.02, 1.3, 0.106], [0.1, 1.12, 0.1], [0.15, 1.05, 0.09]], 0.005, seam);
      rod(body, [0, 1.02, 0], [0, 0.84, 0], 0.19, 0.205, tunic);
      // Utility belt with its buckle and pouches.
      box(body, [0, 1.035, 0.112], [0.06, 0.045, 0.02], metal, 0.004);
      for (const x of [-0.13, 0.13]) box(body, [x, 1.0, 0.1], [0.06, 0.07, 0.035], pouch, 0.01);
    },
  );
}

export function createBarCameos() {
  const group = new THREE.Group();
  group.name = "cantina-kenobi-luke";
  const figures: { holder: THREE.Group; human: Human; phase: number; yaw: number }[] = [];
  const place = (human: Human, u: number, v: number, turn: number, phase: number) => {
    const holder = new THREE.Group();
    holder.position.set(u, 0, v);
    holder.rotation.y = turn;
    holder.add(human.group);
    group.add(holder);
    figures.push({ holder, human, phase, yaw: 0 });
  };
  const luke = createLuke(),
    kenobi = createKenobi();
  // Luke leans on the counter, forearms on its edge; Obi-Wan stands beside him, one hand on it.
  luke.group.rotation.x = 0.07;
  luke.arms.forEach((arm) => {
    arm.root.rotation.x = -0.5;
    arm.joint.rotation.x = -1.0;
    arm.root.rotation.z = (arm.root.position.x > 0 ? -1 : 1) * 0.12;
  });
  // Obi-Wan has his back to the counter, watching the room and Han's table, a hand at his belt.
  kenobi.arms[1].root.rotation.x = -0.12;
  kenobi.arms[1].joint.rotation.x = -1.05;
  kenobi.arms[1].root.rotation.z = -0.12;
  kenobi.arms[0].joint.rotation.x = -0.2;
  place(luke, -12.55, 62.35, -Math.PI / 2 - 0.12, 0);
  place(kenobi, -12.45, 63.4, Math.PI / 2 + 0.45, 2.1);

  // The scorch on the booth wall, still smoking, and the coins left for the mess.
  const scorch = (() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const c = canvas.getContext("2d")!;
    const ring = c.createRadialGradient(64, 64, 2, 64, 64, 60);
    ring.addColorStop(0, "rgba(8,5,3,1)");
    ring.addColorStop(0.18, "rgba(25,14,8,.95)");
    ring.addColorStop(0.45, "rgba(58,33,18,.6)");
    ring.addColorStop(1, "rgba(60,35,20,0)");
    c.fillStyle = ring;
    c.fillRect(0, 0, 128, 128);
    c.strokeStyle = "rgba(20,12,7,.5)";
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + Math.sin(i * 7) * 0.2,
        r = 26 + ((i * 37) % 22);
      c.lineWidth = 1 + (i % 3);
      c.beginPath();
      c.moveTo(64 + Math.cos(a) * 10, 64 + Math.sin(a) * 10);
      c.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
      c.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  })();
  part(
    group,
    new THREE.PlaneGeometry(0.42, 0.42),
    new THREE.MeshStandardMaterial({ map: scorch, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }),
    [-21.72, 1.8, 57.3],
    [0, Math.PI / 2, 0],
  );
  const halo = glowTexture();
  const ember = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0xff7a30, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  ember.position.set(-21.68, 1.8, 57.3);
  ember.scale.setScalar(0.09);
  group.add(ember);
  const smoke = Array.from({ length: 5 }, (_, i) => {
    const puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0x9b928a, transparent: true, opacity: 0, depthWrite: false }));
    group.add(puff);
    return { puff, age: i * 0.7 };
  });
  const coin = new THREE.MeshStandardMaterial({ color: 0xc9a14a, roughness: 0.3, metalness: 0.9 });
  for (const [du, dv, tilt] of [
    [0.32, 0.22, 0],
    [0.36, 0.31, 0.3],
    [0.27, 0.36, 0.1],
  ])
    part(group, new THREE.CylinderGeometry(0.022, 0.022, 0.005, 16), coin, [-20.3 + du, 0.795, 56.9 + dv], [tilt * 0.1, tilt, 0]);

  const circles = figures.map(({ holder }) => ({ u: holder.position.x, v: holder.position.z, r: 0.38 }));
  const target = new THREE.Vector2();
  return {
    group,
    circles,
    tick: (time: number, dt: number, reduced: boolean, visitor: { u: number; v: number }) => {
      figures.forEach((figure, index) => {
        const { holder, human, phase } = figure;
        const near = Math.hypot(visitor.u - holder.position.x, visitor.v - holder.position.z) < 3.2;
        // Glances at Han's table and at each other, and a look at whoever comes close.
        const other = figures[1 - index].holder.position,
          beat = Math.sin(time * 0.21 + phase);
        if (near) target.set(visitor.u, visitor.v);
        else if (beat > 0.45) target.set(HAN_TABLE.u, HAN_TABLE.v);
        else if (beat < -0.6) target.set(other.x, other.z);
        else target.set(holder.position.x - 3, holder.position.z + Math.sin(time * 0.13 + phase) * 1.5);
        const goal = THREE.MathUtils.clamp(shortest(Math.atan2(target.x - holder.position.x, target.y - holder.position.z) - holder.rotation.y), -1.3, 1.3);
        if (!reduced) figure.yaw += (goal - figure.yaw) * (1 - Math.exp(-dt * 3));
        else figure.yaw = 0;
        human.head.rotation.y = figure.yaw * 0.8;
        human.head.rotation.x = reduced ? 0 : 0.04 + Math.sin(time * 0.3 + phase) * 0.02;
        human.look(THREE.MathUtils.clamp(figure.yaw * 0.6, -1, 1), near ? 0.2 : -0.2, time, reduced);
        human.body.position.y = reduced ? 0 : Math.sin(time * 1.1 + phase) * 0.003;
      });
      ember.material.opacity = reduced ? 0.4 : 0.35 + Math.sin(time * 5) * 0.1 + Math.sin(time * 13) * 0.05;
      smoke.forEach((wisp) => {
        wisp.puff.visible = !reduced;
        if (reduced) return;
        wisp.age = (wisp.age + dt) % 3.5;
        const t = wisp.age / 3.5;
        wisp.puff.position.set(-21.62 + t * 0.12, 1.85 + t * 0.9, 57.3 + Math.sin(time * 0.8 + wisp.age) * 0.05);
        wisp.puff.scale.setScalar(0.12 + t * 0.35);
        wisp.puff.material.opacity = Math.sin(t * Math.PI) * 0.16;
      });
    },
  };
}
