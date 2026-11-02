import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type Paint = "grey" | "ochre" | "blue" | "olive" | "ivory";
type CargoCollider = { x: number; z: number; r: number };

function random(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// Painted, scratched metal rather than photographs of the reference sheets.
function wornPaint(base: string, seed: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const rand = random(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = i % 3 ? "#1b25210b" : "#e8e3cb0d";
    ctx.fillRect(rand() * 512, rand() * 512, 2 + rand() * 54, 1 + rand() * 35);
  }
  // Grease trails run down from joints, while chipped paint collects at the edges.
  for (let i = 0; i < 28; i++) {
    const x = rand() * 512;
    const stain = ctx.createLinearGradient(0, 0, 0, 330);
    stain.addColorStop(0, "#20241a28");
    stain.addColorStop(1, "#20241a00");
    ctx.fillStyle = stain;
    ctx.fillRect(x, 0, 1 + rand() * 7, 90 + rand() * 220);
  }
  for (let i = 0; i < 640; i++) {
    const edge = i % 4;
    const depth = Math.pow(rand(), 2.6) * 25;
    const x = edge < 2 ? (edge ? 512 - depth : depth) : rand() * 512;
    const y = edge > 1 ? (edge === 3 ? 512 - depth : depth) : rand() * 512;
    ctx.fillStyle = i % 4 ? "#b7b9aa8c" : "#30372c8a";
    ctx.fillRect(x, y, 1 + rand() * 6, 1 + rand() * 3);
  }
  for (let i = 0; i < 130; i++) {
    const x = rand() * 512,
      y = rand() * 512;
    ctx.strokeStyle = i % 3 ? "#ddd7bc36" : "#28312b45";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + rand() * 20 - 10, y + 2 + rand() * 19);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function manifestTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#d5d1b7";
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = "#353d35";
  ctx.font = "bold 28px monospace";
  ctx.fillText("03 / 17", 14, 38);
  const rand = random(317);
  let x = 15;
  while (x < 236) {
    const w = 1 + Math.floor(rand() * 4);
    ctx.fillRect(x, 59, w, 42);
    x += w + 1 + Math.floor(rand() * 4);
  }
  ctx.fillStyle = "#676a5140";
  for (let i = 0; i < 80; i++)
    ctx.fillRect(rand() * 256, rand() * 128, 1 + rand() * 6, 1 + rand() * 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function createCoruscantCargo(): {
  group: THREE.Group;
  colliders: CargoCollider[];
} {
  const source = new THREE.Group();
  const paint: Record<Paint, THREE.MeshStandardMaterial> = {
    grey: new THREE.MeshStandardMaterial({
      map: wornPaint("#9da9a7", 20),
      roughness: 0.8,
      metalness: 0.32,
    }),
    ochre: new THREE.MeshStandardMaterial({
      map: wornPaint("#b17c38", 37),
      roughness: 0.78,
      metalness: 0.3,
    }),
    blue: new THREE.MeshStandardMaterial({
      map: wornPaint("#6c858d", 52),
      roughness: 0.87,
      metalness: 0.25,
    }),
    olive: new THREE.MeshStandardMaterial({
      map: wornPaint("#6d705c", 73),
      roughness: 0.85,
      metalness: 0.24,
    }),
    ivory: new THREE.MeshStandardMaterial({
      map: wornPaint("#c2bfaa", 94),
      roughness: 0.82,
      metalness: 0.22,
    }),
  };
  const steel = new THREE.MeshStandardMaterial({
    color: 0x8a918b,
    roughness: 0.58,
    metalness: 0.72,
  });
  const frame = new THREE.MeshStandardMaterial({
    color: 0x444d48,
    roughness: 0.74,
    metalness: 0.55,
  });
  const recess = new THREE.MeshStandardMaterial({
    color: 0x202b2b,
    roughness: 0.96,
    metalness: 0.12,
  });
  const label = new THREE.MeshStandardMaterial({
    map: manifestTexture(),
    roughness: 0.92,
    metalness: 0.05,
  });
  const unitBox = new THREE.BoxGeometry(1, 1, 1);

  function part(
    parent: THREE.Group,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
  ) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function box(
    parent: THREE.Group,
    material: THREE.Material,
    w: number,
    h: number,
    d: number,
    x = 0,
    y = 0,
    z = 0,
  ) {
    const mesh = part(parent, unitBox, material, x, y, z);
    mesh.scale.set(w, h, d);
    return mesh;
  }
  function rounded(
    parent: THREE.Group,
    material: THREE.Material,
    w: number,
    h: number,
    d: number,
    radius: number,
    y = 0,
  ) {
    return part(
      parent,
      new RoundedBoxGeometry(w, h, d, 2, radius),
      material,
      0,
      y,
      0,
    );
  }
  function manifest(
    parent: THREE.Group,
    w: number,
    h: number,
    z: number,
    x: number,
    y: number,
  ) {
    box(parent, label, w, h, 0.008, x, y, z);
  }
  function screw(parent: THREE.Group, x: number, y: number, z: number) {
    const mesh = part(
      parent,
      new THREE.CylinderGeometry(0.013, 0.013, 0.012, 6),
      recess,
      x,
      y,
      z,
    );
    mesh.rotation.x = Math.PI / 2;
  }
  function addFeet(parent: THREE.Group, w: number, h: number, d: number) {
    for (const x of [-1, 1])
      for (const z of [-1, 1]) {
        box(
          parent,
          frame,
          0.13,
          0.035,
          0.13,
          x * (w / 2 - 0.11),
          -h / 2 + 0.0175,
          z * (d / 2 - 0.11),
        );
      }
  }

  function ventilated(w: number, h: number, d: number, color: Paint) {
    const item = new THREE.Group();
    item.name = `ventilated-${color}-crate`;
    rounded(item, paint[color], w, h, d, 0.045);
    // Corner armor, raised rails and a real dark cavity beneath each row of louvers.
    for (const side of [-1, 1]) {
      const face = side * (d / 2 + 0.012);
      for (const x of [-1, 1]) {
        box(item, steel, 0.065, h - 0.09, 0.04, x * (w / 2 - 0.055), 0, face);
        for (const y of [-1, 1])
          screw(
            item,
            x * (w / 2 - 0.055),
            y * (h / 2 - 0.08),
            face + side * 0.03,
          );
      }
      for (const y of [-1, 1])
        box(item, frame, w - 0.1, 0.045, 0.035, 0, y * (h / 2 - 0.045), face);
      box(item, recess, w * 0.74, h * 0.47, 0.027, 0, h * 0.055, face);
      for (let slat = 0; slat < 5; slat++) {
        const louver = box(
          item,
          paint[color],
          w * 0.72,
          h * 0.055,
          0.052,
          0,
          h * (0.245 - slat * 0.095),
          face + side * 0.025,
        );
        louver.rotation.x = side * -0.16;
      }
      box(item, steel, w * 0.76, 0.025, 0.045, 0, -h * 0.2, face + side * 0.02);
      if (side > 0)
        manifest(
          item,
          Math.min(0.21, w * 0.2),
          0.075,
          face + 0.025,
          -w * 0.22,
          -h * 0.35,
        );
      box(
        item,
        paint.ochre,
        0.045,
        0.09,
        0.025,
        w * 0.26,
        -h * 0.34,
        face + side * 0.01,
      );
    }
    // Separate lid plates catch highlights at their narrow perimeter seams.
    for (const x of [-1, 1])
      box(
        item,
        paint[color],
        w * 0.44,
        0.025,
        d - 0.15,
        x * w * 0.23,
        h / 2 + 0.006,
      );
    for (const x of [-1, 1]) {
      box(
        item,
        recess,
        0.012,
        h * 0.25,
        d * 0.36,
        x * (w / 2 + 0.006),
        h * 0.04,
      );
      box(item, steel, 0.04, 0.045, d * 0.24, x * (w / 2 + 0.025), h * 0.1);
    }
    addFeet(item, w, h, d);
    return item;
  }

  function transportCase(w: number, h: number, d: number, color: Paint) {
    const item = new THREE.Group();
    item.name = `sealed-${color}-transport-case`;
    rounded(
      item,
      paint[color],
      w,
      h * 0.69,
      d,
      Math.min(0.09, h * 0.16),
      -h * 0.145,
    );
    rounded(
      item,
      paint[color],
      w,
      h * 0.28,
      d,
      Math.min(0.075, h * 0.12),
      h * 0.36,
    );
    // The dark, recessed split line remains visible all around the suitcase.
    box(item, recess, w - 0.08, 0.023, d - 0.06, 0, h * 0.205);
    for (const x of [-1, 1]) {
      for (const z of [-1, 1]) {
        box(
          item,
          paint[color],
          0.07,
          h * 0.86,
          0.04,
          x * w * 0.36,
          0,
          z * (d / 2 + 0.01),
        );
      }
      box(item, steel, 0.065, 0.025, d * 0.87, x * w * 0.36, h / 2 + 0.003);
    }
    for (const side of [-1, 1]) {
      const face = side * (d / 2 + 0.04);
      for (const x of [-1, 1]) {
        box(item, frame, 0.075, h * 0.28, 0.028, x * w * 0.27, h * 0.17, face);
        box(
          item,
          steel,
          0.042,
          h * 0.18,
          0.028,
          x * w * 0.27,
          h * 0.17,
          face + side * 0.017,
        );
        box(
          item,
          recess,
          0.021,
          0.025,
          0.032,
          x * w * 0.27,
          h * 0.1,
          face + side * 0.03,
        );
      }
      // Stand-off handle leaves a visible gap between grip and body.
      for (const x of [-1, 1])
        box(item, steel, 0.035, 0.065, 0.085, x * w * 0.13, -h * 0.04, face);
      box(
        item,
        frame,
        w * 0.27,
        0.045,
        0.035,
        0,
        -h * 0.07,
        face + side * 0.055,
      );
      if (side > 0)
        manifest(
          item,
          Math.min(0.21, w * 0.22),
          0.08,
          face + 0.006,
          -w * 0.25,
          -h * 0.25,
        );
    }
    for (const side of [-1, 1]) {
      box(
        item,
        frame,
        0.035,
        h * 0.28,
        d * 0.45,
        side * (w / 2 + 0.008),
        -h * 0.02,
      );
      box(item, steel, 0.07, 0.05, d * 0.28, side * (w / 2 + 0.03), h * 0.02);
    }
    addFeet(item, w, h, d);
    return item;
  }

  function drum(radius: number, height: number, color: Paint) {
    const item = new THREE.Group();
    item.name = `${color}-ribbed-fuel-drum`;
    const profile = [
      [0, 0],
      [radius * 0.83, 0],
      [radius * 0.97, 0.06],
      [radius, height * 0.13],
      [radius, height * 0.78],
      [radius * 0.96, height * 0.9],
      [radius * 0.72, height],
      [0, height],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    part(item, new THREE.LatheGeometry(profile, 32), paint[color]);
    for (const y of [height * 0.14, height * 0.77]) {
      const hoop = part(
        item,
        new THREE.TorusGeometry(radius + 0.003, 0.018, 6, 40),
        steel,
        0,
        y,
      );
      hoop.rotation.x = Math.PI / 2;
    }
    for (let rib = 0; rib < 10; rib++) {
      const angle = (rib / 10) * Math.PI * 2;
      const strip = box(
        item,
        paint[color],
        0.033,
        height * 0.54,
        0.02,
        Math.sin(angle) * radius,
        height * 0.46,
        Math.cos(angle) * radius,
      );
      strip.rotation.y = angle;
    }
    part(
      item,
      new THREE.CylinderGeometry(0.085, 0.11, 0.026, 12),
      frame,
      radius * 0.28,
      height + 0.01,
      -radius * 0.25,
    );
    const handle = part(
      item,
      new THREE.TorusGeometry(0.075, 0.022, 6, 20),
      paint.ochre,
      0,
      height * 0.87,
      radius * 0.9,
    );
    handle.scale.y = 0.65;
    return item;
  }

  function put(
    parent: THREE.Group,
    object: THREE.Group,
    x: number,
    bottom: number,
    z: number,
    height: number,
    yaw = 0,
  ) {
    object.position.set(x, bottom + height / 2, z);
    object.rotation.y = yaw;
    parent.add(object);
  }
  const right = new THREE.Group();
  right.position.x = 13.3;
  right.rotation.y = 0.08;
  source.add(right);
  put(right, ventilated(1.13, 1.1, 1.08, "grey"), -0.75, 0, -0.66, 1.1);
  put(
    right,
    ventilated(1.0, 0.95, 0.96, "grey"),
    -0.75,
    1.1,
    -0.66,
    0.95,
    -0.025,
  );
  put(
    right,
    transportCase(0.79, 0.27, 0.65, "ochre"),
    -0.75,
    2.05,
    -0.66,
    0.27,
    0.025,
  );
  put(right, ventilated(1.95, 0.77, 1.02, "ochre"), 0.0, 0, 0.66, 0.77);
  put(
    right,
    transportCase(1.25, 0.43, 0.82, "ochre"),
    0.1,
    0.77,
    0.66,
    0.43,
    0.015,
  );
  put(
    right,
    transportCase(0.68, 0.65, 0.72, "blue"),
    -1.53,
    0,
    0.72,
    0.65,
    -0.12,
  );
  const rightDrum = drum(0.36, 1.5, "ivory");
  rightDrum.position.set(1.12, 0, -0.64);
  right.add(rightDrum);

  const left = new THREE.Group();
  left.position.x = -13.3;
  left.rotation.y = -0.1;
  source.add(left);
  put(left, transportCase(2.3, 0.6, 0.98, "grey"), 0, 0, -0.65, 0.6);
  put(
    left,
    transportCase(1.05, 0.58, 0.84, "blue"),
    -0.53,
    0.6,
    -0.65,
    0.58,
    0.03,
  );
  put(
    left,
    transportCase(0.83, 0.81, 0.68, "olive"),
    -0.53,
    1.18,
    -0.65,
    0.81,
    -0.035,
  );
  put(left, ventilated(0.71, 0.76, 0.76, "grey"), 1.38, 0, -0.64, 0.76, 0.08);
  const leftDrumA = drum(0.37, 1.45, "ivory");
  leftDrumA.position.set(0.89, 0, 0.68);
  left.add(leftDrumA);
  const leftDrumB = drum(0.34, 1.28, "ivory");
  leftDrumB.position.set(-0.85, 0, 0.7);
  left.add(leftDrumB);
  put(
    left,
    transportCase(0.59, 0.38, 0.56, "ivory"),
    -0.85,
    1.29,
    0.7,
    0.38,
    0.05,
  );

  // Bake every latch and rib into one mesh per material, keeping this set inexpensive.
  source.updateMatrixWorld(true);
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const originalGeometries = new Set<THREE.BufferGeometry>();
  source.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const material = object.material as THREE.Material;
    const geometry = object.geometry.index
      ? object.geometry.toNonIndexed()
      : object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    const batch = batches.get(material) ?? [];
    batch.push(geometry);
    batches.set(material, batch);
    originalGeometries.add(object.geometry);
  });
  const group = new THREE.Group();
  group.name = "coruscant-detailed-cargo";
  batches.forEach((parts, material) => {
    const geometry = mergeGeometries(parts, false);
    parts.forEach((part) => part.dispose());
    if (!geometry) return;
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "baked-cargo-details";
    group.add(mesh);
  });
  originalGeometries.forEach((geometry) => geometry.dispose());
  return {
    group,
    colliders: [
      { x: 13.3, z: 0, r: 2.3 },
      { x: -13.3, z: 0, r: 2.3 },
    ],
  };
}
