import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

function panelTexture(painted = false) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;
  let seed = painted ? 1977 : 1138;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  ctx.fillStyle = painted ? "#a4504a" : "#c8c9bc";
  ctx.fillRect(0, 0, 512, 1024);
  for (let row = 0; row < 16; row++) {
    let x = -(row % 2) * 32;
    while (x < 512) {
      const width = 40 + Math.floor(random() * 64),
        y = row * 64;
      const tone = 174 + Math.floor(random() * 35);
      ctx.fillStyle = painted
        ? `rgba(66,33,29,${random() * 0.16})`
        : `rgb(${tone + 16},${tone + 17},${tone + 4})`;
      ctx.fillRect(x + 2, y + 2, width - 4, 60);
      ctx.strokeStyle = painted ? "#522b2870" : "#4b4c4760";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, width - 2, 62);
      ctx.fillStyle = "#20292266";
      ctx.fillRect(x + 5, y + 7, 1.5, 1.5);
      ctx.fillRect(x + width - 7, y + 55, 1.5, 1.5);
      x += width;
    }
  }
  for (let i = 0; i < 2100; i++) {
    const x = random() * 512,
      y = random() * 1024;
    ctx.fillStyle =
      i % 3 === 0 ? "#32393232" : painted ? "#d1d0bc99" : "#eff0de65";
    ctx.fillRect(x, y, 0.4 + random() * 2.8, 0.4 + random() * 9);
  }
  for (let i = 0; i < 90; i++) {
    const x = random() * 512,
      y = random() * 1024;
    ctx.strokeStyle = painted ? "#ddd8bd80" : "#414a3b50";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + random() * 9 - 4, y + 8 + random() * 22);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
function exhaustTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!,
    gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,231,246,1)");
  gradient.addColorStop(0.18, "rgba(255,116,181,.8)");
  gradient.addColorStop(0.48, "rgba(232,62,139,.22)");
  gradient.addColorStop(1, "rgba(232,62,139,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}
function hullGeometry() {
  const sections = [
    [-0.88, 0.25, 0.19, 0.01],
    [-0.38, 0.27, 0.22, 0.03],
    [0.12, 0.21, 0.18, 0.01],
    [0.72, 0.12, 0.1, -0.015],
    [1.56, 0.055, 0.05, -0.045],
    [1.72, 0.035, 0.025, -0.045],
  ];
  const perimeter = [
    [1, 0.55],
    [0.55, 1],
    [-0.55, 1],
    [-1, 0.55],
    [-1, -0.55],
    [-0.55, -1],
    [0.55, -1],
    [1, -0.55],
    [1, 0.55],
  ];
  const vertices: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  sections.forEach(([y, w, h, z], row) => {
    perimeter.forEach(([x, v], i) => {
      vertices.push(x * w, y, z + v * h);
      uvs.push(i / 8, (y + 0.88) / 2.6);
    });
    if (row < sections.length - 1)
      for (let i = 0; i < 8; i++) {
        const a = row * 9 + i,
          b = a + 9;
        indices.push(a, b, b + 1, a, b + 1, a + 1);
      }
  });
  for (let i = 1; i < 7; i++) {
    indices.push(0, i + 1, i);
    const end = (sections.length - 1) * 9;
    indices.push(end, end + i, end + i + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const faceted = geometry.toNonIndexed();
  faceted.computeVertexNormals();
  geometry.dispose();
  return faceted;
}

// Bake the static mechanical detail by material to keep the detailed model inexpensive to draw.
function bakeModel(model: THREE.Group) {
  model.updateMatrixWorld(true);
  const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const sprites: THREE.Sprite[] = [],
    animated: THREE.Object3D[] = [],
    originals = new Set<THREE.BufferGeometry>();
  model.traverse((object) => {
    if (object.name === "astromech-head") {
      animated.push(object);
      return;
    }
    if (object.parent?.name === "astromech-head") return;
    if (object instanceof THREE.Sprite) {
      sprites.push(object);
      return;
    }
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material))
      return;
    let geometry = object.geometry.clone();
    if (geometry.index) {
      const expanded = geometry.toNonIndexed();
      geometry.dispose();
      geometry = expanded;
    }
    for (const attribute of Object.keys(geometry.attributes))
      if (!["position", "normal", "uv"].includes(attribute))
        geometry.deleteAttribute(attribute);
    geometry.applyMatrix4(object.matrixWorld);
    if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
    if (!geometry.getAttribute("uv"))
      geometry.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(
          new Float32Array(geometry.getAttribute("position").count * 2),
          2,
        ),
      );
    const bucket = groups.get(object.material) ?? [];
    bucket.push(geometry);
    groups.set(object.material, bucket);
    originals.add(object.geometry);
  });
  const result = new THREE.Group();
  result.name = "Reference X-wing";
  groups.forEach((geometries, material) => {
    const combined = mergeGeometries(geometries, false);
    if (combined) result.add(new THREE.Mesh(combined, material));
    geometries.forEach((geometry) => geometry.dispose());
  });
  sprites.forEach((sprite) => result.attach(sprite));
  animated.forEach((object) => result.attach(object));
  originals.forEach((geometry) => geometry.dispose());
  return result;
}

export function createShipModel() {
  const model = new THREE.Group();
  const texture = panelTexture(),
    paint = panelTexture(true);
  const hull = new THREE.MeshStandardMaterial({
    color: 0xeeeeda,
    map: texture,
    bumpMap: texture,
    bumpScale: 0.012,
    metalness: 0.32,
    roughness: 0.79,
  });
  const ivory = new THREE.MeshStandardMaterial({
    color: 0xd8dacb,
    metalness: 0.38,
    roughness: 0.68,
  });
  const red = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: paint,
    metalness: 0.22,
    roughness: 0.84,
    side: THREE.DoubleSide,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x252c2b,
    metalness: 0.62,
    roughness: 0.68,
  });
  const steel = new THREE.MeshStandardMaterial({
    color: 0x6c736e,
    metalness: 0.72,
    roughness: 0.52,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x09141b,
    metalness: 0.6,
    roughness: 0.16,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    side: THREE.DoubleSide,
  });
  const blue = new THREE.MeshStandardMaterial({
    color: 0x355f7c,
    metalness: 0.48,
    roughness: 0.5,
  });
  const core = new THREE.MeshStandardMaterial({
    color: 0xee89b4,
    emissive: 0xf14c9c,
    emissiveIntensity: 0.65,
    metalness: 0.1,
    roughness: 0.4,
  });
  core.name = "reactor-core";
  const hot = new THREE.MeshBasicMaterial({
    color: 0xffd8ee,
    toneMapped: false,
  });
  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    parent: THREE.Object3D = model,
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    parent.add(mesh);
    return mesh;
  };
  const box = (
    size: number[],
    position: number[],
    material: THREE.Material = hull,
    parent: THREE.Object3D = model,
  ) => {
    const mesh = add(
      new THREE.BoxGeometry(...(size as [number, number, number])),
      material,
      parent,
    );
    mesh.position.set(...(position as [number, number, number]));
    return mesh;
  };
  const cylinder = (
    r: number,
    length: number,
    position: number[],
    material: THREE.Material = hull,
    parent: THREE.Object3D = model,
  ) => {
    const mesh = add(
      new THREE.CylinderGeometry(r, r, length, 20),
      material,
      parent,
    );
    mesh.position.set(...(position as [number, number, number]));
    return mesh;
  };
  const ring = (
    r: number,
    tube: number,
    position: number[],
    material: THREE.Material = steel,
    parent: THREE.Object3D = model,
  ) => {
    const mesh = add(new THREE.TorusGeometry(r, tube, 6, 32), material, parent);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(...(position as [number, number, number]));
    return mesh;
  };
  const beam = (
    from: number[],
    to: number[],
    r = 0.011,
    material: THREE.Material = ivory,
    parent: THREE.Object3D = model,
  ) => {
    const start = new THREE.Vector3(...(from as [number, number, number])),
      end = new THREE.Vector3(...(to as [number, number, number]));
    const delta = end.clone().sub(start),
      mesh = add(
        new THREE.CylinderGeometry(r, r, delta.length(), 8),
        material,
        parent,
      );
    mesh.position.copy(start).addScaledVector(delta, 0.5);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      delta.normalize(),
    );
    return mesh;
  };
  const polygon = (
    points: number[][],
    material: THREE.Material,
    parent: THREE.Object3D = model,
  ) => {
    const vertices: number[] = [],
      uvs: number[] = [];
    for (let i = 1; i < points.length - 1; i++)
      for (const index of [0, i, i + 1]) {
        vertices.push(...points[index]);
        uvs.push(index % 2, index < 2 ? 0 : 1);
      }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    return add(geometry, material, parent);
  };
  add(hullGeometry(), hull);
  // Long tapered nose with the chipped red identification panels of the reference.
  for (const side of [-1, 1]) {
    polygon(
      [
        [side * 0.121, 0.72, 0.06],
        [side * 0.058, 1.56, -0.018],
        [side * 0.058, 1.56, -0.055],
        [side * 0.121, 0.72, -0.045],
      ],
      red,
    );
    polygon(
      [
        [side * 0.032, 0.69, 0.09],
        [side * 0.014, 1.57, 0.009],
        [side * 0.04, 1.57, 0.009],
        [side * 0.081, 0.69, 0.09],
      ],
      red,
    );
  }
  ring(0.047, 0.009, [0, 1.66, -0.046], dark).rotation.z = Math.PI / 2;
  // Angular glazed canopy with a visible metal frame.
  const backL = [-0.14, 0.03, 0.27],
    backR = [0.14, 0.03, 0.27],
    topL = [-0.105, 0.14, 0.4],
    topR = [0.105, 0.14, 0.4];
  const frontL = [-0.09, 0.62, 0.17],
    frontR = [0.09, 0.62, 0.17],
    roofL = [-0.075, 0.52, 0.29],
    roofR = [0.075, 0.52, 0.29];
  polygon([topL, topR, roofR, roofL], glass);
  polygon([backL, topL, roofL, frontL], glass);
  polygon([backR, frontR, roofR, topR], glass);
  polygon([frontL, roofL, roofR, frontR], glass);
  [
    [backL, topL],
    [backR, topR],
    [topL, topR],
    [topL, roofL],
    [topR, roofR],
    [roofL, roofR],
    [frontL, roofL],
    [frontR, roofR],
    [frontL, frontR],
  ].forEach(([a, b]) => beam(a, b));
  beam([-0.095, 0.3, 0.355], [0.095, 0.3, 0.355], 0.009);
  // Recessed dorsal machinery and the small astromech behind the cockpit.
  box([0.36, 0.41, 0.035], [0, -0.6, 0.27], dark);
  for (let i = 0; i < 9; i++)
    box([0.3, 0.013, 0.025], [0, -0.77 + i * 0.043, 0.296], steel);
  for (const side of [-1, 1])
    beam([side * 0.21, -0.8, 0.27], [side * 0.21, -0.34, 0.27], 0.014, steel);
  const droid = cylinder(0.067, 0.115, [0, -0.29, 0.34], ivory);
  droid.rotation.x = Math.PI / 2;
  const head = new THREE.Group();
  head.name = "astromech-head";
  head.position.set(0, -0.29, 0.398);
  model.add(head);
  const dome = add(
    new THREE.SphereGeometry(0.083, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    ivory,
    head,
  );
  dome.rotation.x = Math.PI / 2;
  const band = add(new THREE.TorusGeometry(0.079, 0.013, 6, 24), blue, head);
  band.position.z = 0.004;
  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0x244e70,
    emissive: 0x4383ba,
    emissiveIntensity: 0.22,
    roughness: 0.4,
    metalness: 0.4,
  });
  eyeMaterial.name = "droid-eye";
  const eye = add(new THREE.SphereGeometry(0.018, 8, 6), eyeMaterial, head);
  eye.position.set(0, -0.07, 0.035);
  // Octagonal rear access plate, bolts and exhaust-side cooling slots.
  const hatch = add(new THREE.CylinderGeometry(0.235, 0.235, 0.035, 8), steel);
  hatch.position.set(0, -0.9, 0.015);
  const cover = add(new THREE.CylinderGeometry(0.209, 0.209, 0.015, 8), hull);
  cover.position.set(0, -0.924, 0.015);
  box([0.23, 0.02, 0.13], [0, -0.938, -0.025], dark);
  for (let i = 0; i < 7; i++)
    box([0.009, 0.022, 0.1], [-0.09 + i * 0.03, -0.953, -0.025], steel);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const bolt = add(new THREE.SphereGeometry(0.014, 6, 4), dark);
    bolt.position.set(Math.cos(a) * 0.18, -0.945, 0.015 + Math.sin(a) * 0.18);
  }
  const glow = exhaustTexture();
  for (const side of [-1, 1])
    for (const level of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(side * 0.19, 0, level * 0.105);
      wing.rotation.y = -side * level * 0.43;
      model.add(wing);
      const shape = new THREE.Shape();
      shape.moveTo(0, 0.1);
      shape.lineTo(side * 1.02, 0.035);
      shape.lineTo(side * 1.14, -0.74);
      shape.lineTo(0, -0.67);
      shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 0.033,
        bevelEnabled: false,
      });
      const positions = geometry.getAttribute("position"),
        uv = geometry.getAttribute("uv");
      for (let i = 0; i < uv.count; i++)
        uv.setXY(
          i,
          Math.abs(positions.getX(i)) / 1.14,
          (positions.getY(i) + 0.74) / 0.84,
        );
      add(geometry, hull, wing);
      polygon(
        [
          [side * 0.51, -0.05, 0.035],
          [side * 1.04, -0.08, 0.035],
          [side * 1.09, -0.36, 0.035],
          [side * 0.51, -0.33, 0.035],
        ],
        red,
        wing,
      );
      polygon(
        [
          [side * 0.51, -0.05, -0.002],
          [side * 0.51, -0.33, -0.002],
          [side * 1.09, -0.36, -0.002],
          [side * 1.04, -0.08, -0.002],
        ],
        red,
        wing,
      );
      for (let i = 0; i < 3; i++)
        box(
          [0.018, 0.2, 0.006],
          [side * (0.68 + i * 0.12), -0.2, 0.04],
          ivory,
          wing,
        );
      box([0.028, 0.6, 0.04], [side * 0.35, -0.31, 0.04], steel, wing);
      // One cylindrical engine on each S-foil, four visible separate nozzles.
      const engineX = side * 0.42;
      cylinder(0.142, 0.86, [engineX, -0.43, 0.05], hull, wing);
      cylinder(0.147, 0.2, [engineX, -0.04, 0.05], ivory, wing);
      cylinder(0.154, 0.23, [engineX, -0.84, 0.05], dark, wing);
      // The open intake at the front: a dark throat, a steel lip and a fan, not a blank cap.
      const intake = new THREE.Group();
      intake.position.set(engineX, 0.061, 0.05);
      intake.rotation.x = -Math.PI / 2;
      wing.add(intake);
      add(new THREE.CircleGeometry(0.13, 28), dark, intake);
      add(new THREE.TorusGeometry(0.133, 0.012, 6, 32), steel, intake).position.z = 0.003;
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2,
          blade = add(new THREE.PlaneGeometry(0.016, 0.082), steel, intake);
        blade.position.set(Math.cos(angle) * 0.078, Math.sin(angle) * 0.078, 0.003);
        blade.rotation.z = angle - Math.PI / 2;
      }
      add(new THREE.CircleGeometry(0.032, 16), hull, intake).position.z = 0.005;
      for (const y of [-0.17, -0.34, -0.56, -0.72, -0.92])
        ring(0.145, 0.012, [engineX, y, 0.05], steel, wing);
      beam(
        [engineX - 0.07, -0.12, 0.18],
        [engineX - 0.07, -0.72, 0.18],
        0.009,
        dark,
        wing,
      );
      const nozzle = new THREE.Group();
      nozzle.position.set(engineX, -0.975, 0.05);
      nozzle.rotation.x = Math.PI / 2;
      wing.add(nozzle);
      add(new THREE.CircleGeometry(0.129, 28), dark, nozzle);
      const disk = add(new THREE.CircleGeometry(0.105, 28), core, nozzle);
      disk.position.z = 0.006;
      const rim = add(
        new THREE.TorusGeometry(0.124, 0.017, 6, 32),
        steel,
        nozzle,
      );
      rim.position.z = 0.005;
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2,
          slot = add(new THREE.PlaneGeometry(0.017, 0.04), hot, nozzle);
        slot.position.set(
          Math.cos(angle) * 0.076,
          Math.sin(angle) * 0.076,
          0.012,
        );
        slot.rotation.z = angle - Math.PI / 2;
      }
      const hub = add(new THREE.CircleGeometry(0.033, 16), core, nozzle);
      hub.position.z = 0.018;
      const fire = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glow,
          color: 0xff8fc2,
          transparent: true,
          opacity: 0.28,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      fire.position.set(engineX, -1.025, 0.05);
      fire.scale.set(0.32, 0.25, 0.32);
      fire.name = "engine";
      wing.add(fire);
      // Long slim wingtip laser cannons with a battered cylindrical base.
      const tip = side * 1.13;
      cylinder(0.055, 0.37, [tip, -0.24, 0.04], hull, wing);
      ring(0.061, 0.013, [tip, -0.43, 0.04], steel, wing);
      cylinder(0.031, 0.24, [tip, 0.065, 0.04], steel, wing);
      cylinder(0.015, 0.73, [tip, 0.52, 0.04], steel, wing);
      cylinder(0.025, 0.1, [tip, 0.92, 0.04], ivory, wing);
      ring(0.028, 0.006, [tip, 0.98, 0.04], dark, wing);
    }
  // Match the previous ship's span while retaining the requested scene scale.
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model),
    span = bounds.getSize(new THREE.Vector3()).x;
  model.scale.setScalar(2.74 / span);
  return bakeModel(model);
}
