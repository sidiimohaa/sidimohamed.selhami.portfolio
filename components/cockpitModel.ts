import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

function metalTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#535d61";
  ctx.fillRect(0, 0, 512, 512);
  let seed = 1977;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 1600; i++) {
    ctx.fillStyle = i % 3 ? "#1621260b" : "#c2cbc511";
    ctx.fillRect(rand() * 512, rand() * 512, 1 + rand() * 34, 1 + rand() * 4);
  }
  ctx.strokeStyle = "#242f3490";
  ctx.lineWidth = 2;
  for (let row = 0; row < 4; row++) {
    ctx.strokeRect(3, row * 128 + 3, 506, 122);
    for (const x of [13, 499]) {
      ctx.fillStyle = "#a2aca6";
      ctx.fillRect(x, row * 128 + 13, 3, 3);
      ctx.fillRect(x, row * 128 + 113, 3, 3);
    }
  }
  for (let i = 0; i < 160; i++) {
    ctx.strokeStyle = i % 2 ? "#b1bcb64a" : "#0b16192a";
    ctx.lineWidth = 0.6;
    const x = rand() * 512,
      y = rand() * 512;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + rand() * 16 - 8, y + rand() * 24);
    ctx.stroke();
  }
  // Exposed edges, old repairs and oil around panel seams give the shell a working history.
  for (let i = 0; i < 350; i++) {
    const x = rand() * 512,
      y = Math.floor(rand() * 4) * 128 + (rand() < 0.5 ? 5 : 120);
    ctx.fillStyle = i % 3 ? "#b8b9a980" : "#201a1580";
    ctx.fillRect(x, y + rand() * 5, 1 + rand() * 12, 0.5 + rand() * 2);
  }
  for (let seam = 0; seam < 7; seam++) {
    const x = 20 + rand() * 470;
    const stain = ctx.createLinearGradient(x, 0, x, 160);
    stain.addColorStop(0, "#161b1b66");
    stain.addColorStop(1, "#161b1b00");
    ctx.fillStyle = stain;
    ctx.fillRect(x, 0, 4 + rand() * 9, 160);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function instrumentsTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#080d11";
  ctx.fillRect(0, 0, 1024, 512);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#6b4a36";
  for (let i = 0; i < 3; i++) ctx.strokeRect(18 + i * 336, 18, 316, 476);
  const names = ["DEFLECTOR", "ASTRONAV", "PROPULSION"];
  for (let i = 0; i < 3; i++) {
    const x = 176 + i * 336,
      y = 255;
    ctx.fillStyle = "#b88954";
    ctx.font = "18px monospace";
    ctx.textAlign = "center";
    ctx.fillText(names[i], x, 58);
    ctx.strokeStyle = i === 1 ? "#9b572d" : "#4e766a";
    ctx.lineWidth = 1.3;
    for (const r of [33, 64, 96, 112]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let tick = 0; tick < 24; tick++) {
      const a = (tick / 24) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 104, y + Math.sin(a) * 104);
      ctx.lineTo(x + Math.cos(a) * 112, y + Math.sin(a) * 112);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x - 112, y);
    ctx.lineTo(x + 112, y);
    ctx.moveTo(x, y - 112);
    ctx.lineTo(x, y + 112);
    ctx.stroke();
    ctx.strokeStyle = "#b68c50";
    ctx.beginPath();
    ctx.moveTo(x, y + 75);
    ctx.lineTo(x - 25, y - 35);
    ctx.lineTo(x, y - 13);
    ctx.lineTo(x + 25, y - 35);
    ctx.closePath();
    ctx.stroke();
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 8; column++) {
        ctx.fillStyle = (row * 7 + column + i) % 5 ? "#443b29" : "#cc6d39";
        ctx.fillRect(x - 110 + column * 29, 397 + row * 20, 20, 6);
      }
    }
    ctx.font = "13px monospace";
    ctx.fillStyle = "#5f7e76";
    ctx.fillText(
      i === 1 ? "NAV SYSTEM · 04 SIGNALS" : "STATUS · NOMINAL",
      x,
      477,
    );
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Wear on painted consoles: every panel face is mapped 0..1, so paint chipped along the borders
// reads as worn edges, with scuffs and smudges where hands rest. Returns a colour map and a
// roughness map (bare metal and polished smudges are smoother than the paint).
function wearTextures(paint: string, seed: number) {
  const colour = document.createElement("canvas"),
    rough = document.createElement("canvas");
  colour.width = colour.height = rough.width = rough.height = 256;
  const c = colour.getContext("2d")!,
    r = rough.getContext("2d")!;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  c.fillStyle = paint;
  c.fillRect(0, 0, 256, 256);
  r.fillStyle = "#c8c8c8";
  r.fillRect(0, 0, 256, 256);
  // Grime and faded patches.
  for (let i = 0; i < 40; i++) {
    const x = rand() * 256,
      y = rand() * 256,
      size = 20 + rand() * 60;
    const g = c.createRadialGradient(x, y, 0, x, y, size);
    g.addColorStop(0, rand() < 0.5 ? "rgba(0,0,0,.18)" : "rgba(160,170,165,.06)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(x - size, y - size, size * 2, size * 2);
  }
  // Chipped paint along the edges shows bright metal.
  for (let i = 0; i < 900; i++) {
    const along = rand() * 256,
      depth = Math.pow(rand(), 3) * 18,
      side = Math.floor(rand() * 4);
    const x = side === 0 ? depth : side === 1 ? 256 - depth : along,
      y = side === 2 ? depth : side === 3 ? 256 - depth : along;
    const w = 1 + rand() * 5,
      h = 0.6 + rand() * 2;
    c.fillStyle = `rgba(150,160,158,${0.35 + rand() * 0.4})`;
    c.fillRect(x, y, side < 2 ? h : w, side < 2 ? w : h);
    r.fillStyle = "#4a4a4a";
    r.fillRect(x, y, side < 2 ? h : w, side < 2 ? w : h);
  }
  // Fine scratches across the faces.
  for (let i = 0; i < 120; i++) {
    const x = rand() * 256,
      y = rand() * 256,
      a = rand() * Math.PI,
      l = 6 + rand() * 30;
    c.strokeStyle = "rgba(170,178,176,.22)";
    r.strokeStyle = "#6a6a6a";
    for (const ctx of [c, r]) {
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
  }
  // Polished, slightly greasy smudges in the middle, where gloves touch.
  for (let i = 0; i < 6; i++) {
    const x = 70 + rand() * 116,
      y = 70 + rand() * 116,
      size = 14 + rand() * 18;
    const g = r.createRadialGradient(x, y, 0, x, y, size);
    g.addColorStop(0, "rgba(70,70,70,.8)");
    g.addColorStop(1, "rgba(70,70,70,0)");
    r.fillStyle = g;
    r.fillRect(x - size, y - size, size * 2, size * 2);
  }
  const map = new THREE.CanvasTexture(colour);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const roughnessMap = new THREE.CanvasTexture(rough);
  return { map, roughnessMap };
}

/** A compact X-wing flight deck, with an open central field for the star-map projection. */
export function createCockpitModel(): THREE.Group {
  const group = new THREE.Group();
  group.name = "x-wing-cockpit";
  const worn = new THREE.MeshStandardMaterial({
    map: metalTexture(),
    roughness: 0.76,
    metalness: 0.5,
  });
  worn.bumpMap = worn.map;
  worn.bumpScale = 0.006;
  worn.roughnessMap = wearTextures("#ffffff", 77).roughnessMap;
  // Roughness comes from the maps: around 0.78 on paint, smoother on bare metal and smudges.
  const graphite = new THREE.MeshStandardMaterial({
    ...wearTextures("#1b2328", 1138),
    roughness: 1,
    metalness: 0.55,
  });
  const edge = new THREE.MeshStandardMaterial({
    ...wearTextures("#8a989b", 2187),
    roughness: 0.75,
    metalness: 0.92,
  });
  const recess = new THREE.MeshStandardMaterial({
    color: 0x05090c,
    roughness: 0.92,
    metalness: 0.12,
  });
  const rubber = new THREE.MeshStandardMaterial({
    color: 0x11181a,
    roughness: 0.95,
    metalness: 0.04,
  });
  const instrument = new THREE.MeshBasicMaterial({
    map: instrumentsTexture(),
    color: 0xc2c5b6,
    toneMapped: false,
  });
  const cyan = new THREE.MeshBasicMaterial({
    color: 0x78b9c7,
    toneMapped: false,
  });
  const red = new THREE.MeshBasicMaterial({
    color: 0xe54b32,
    toneMapped: false,
  });
  const amber = new THREE.MeshBasicMaterial({
    color: 0xd4964c,
    toneMapped: false,
  });
  const white = new THREE.MeshBasicMaterial({
    color: 0xbac7c4,
    toneMapped: false,
  });
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const position = new THREE.Vector3(),
    rotation = new THREE.Quaternion(),
    scale = new THREE.Vector3(1, 1, 1);
  const matrix = new THREE.Matrix4(),
    angles = new THREE.Euler();
  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    rx = 0,
    ry = 0,
    rz = 0,
  ) => {
    rotation.setFromEuler(angles.set(rx, ry, rz));
    matrix.compose(position.set(x, y, z), rotation, scale);
    const baked = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    baked.applyMatrix4(matrix);
    const bucket = batches.get(material) ?? [];
    bucket.push(baked);
    batches.set(material, bucket);
  };
  const box = (
    material: THREE.Material,
    size: [number, number, number],
    at: [number, number, number],
    rotate: [number, number, number] = [0, 0, 0],
  ) =>
    add(
      material === worn || material === edge || material === graphite
        ? new RoundedBoxGeometry(...size, 1, Math.min(...size) * 0.14)
        : new THREE.BoxGeometry(...size),
      material,
      ...at,
      ...rotate,
    );
  const beam = (
    a: number[],
    b: number[],
    width: number,
    material: THREE.Material,
    depth = width,
  ) => {
    const start = new THREE.Vector3(...(a as [number, number, number])),
      end = new THREE.Vector3(...(b as [number, number, number]));
    const delta = end.clone().sub(start);
    rotation.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      delta.clone().normalize(),
    );
    matrix.compose(start.add(end).multiplyScalar(0.5), rotation, scale);
    const geometry = new RoundedBoxGeometry(
      width,
      delta.length(),
      depth,
      1,
      Math.min(width, depth) * 0.18,
    );
    geometry.applyMatrix4(matrix);
    const bucket = batches.get(material) ?? [];
    bucket.push(geometry);
    batches.set(material, bucket);
  };

  // The canopy surrounds the eye line; no centre post blocks the holograms.
  const near = [
    [-2.22, 0.66, -0.8],
    [-1.67, 3.15, -0.8],
    [1.67, 3.15, -0.8],
    [2.22, 0.66, -0.8],
  ];
  const far = [
    [-2.05, 0.71, -4.9],
    [-1.44, 3.18, -4.9],
    [1.44, 3.18, -4.9],
    [2.05, 0.71, -4.9],
  ];
  for (let i = 0; i < near.length; i++) {
    beam(near[i], far[i], 0.13, worn, 0.19);
    if (i < 3) beam(near[i], near[i + 1], 0.16, worn, 0.19);
  }
  // At the forward windshield the header is split, keeping its open centre high and clear.
  beam(far[0], far[1], 0.11, worn);
  beam(far[2], far[3], 0.11, worn);
  beam(far[1], far[2], 0.09, graphite);
  for (const sign of [-1, 1]) {
    beam(
      [sign * 2.12, 0.91, -0.75],
      [sign * 1.61, 3.06, -0.75],
      0.025,
      cyan,
      0.018,
    );
    beam(
      [sign * 1.61, 3.06, -0.75],
      [sign * 1.42, 3.08, -4.85],
      0.023,
      cyan,
      0.018,
    );
    beam([sign * 2.15, 0.7, -4.9], [sign * 2.3, 0.7, 3.8], 0.18, worn, 0.25);
    beam(
      [sign * 2.12, 0.83, -4.85],
      [sign * 2.25, 0.83, 3.6],
      0.025,
      edge,
      0.025,
    );
    // Opaque lower cockpit sides and overlapping access panels.
    box(graphite, [0.23, 1.1, 7.6], [sign * 2.3, 0.04, -0.25]);
    box(
      worn,
      [0.76, 0.17, 3.55],
      [sign * 1.73, 0.31, 0.27],
      [0, 0, sign * 0.07],
    );
    box(recess, [0.62, 0.035, 2.8], [sign * 1.73, 0.415, 0.18]);
    for (let panel = 0; panel < 4; panel++) {
      box(
        graphite,
        [0.57, 0.04, 0.56],
        [sign * 1.74, 0.445, 1.1 - panel * 0.69],
      );
      for (let button = 0; button < 3; button++) {
        box(
          button === 2 ? amber : red,
          [0.065, 0.024, 0.055],
          [sign * (1.58 + button * 0.16), 0.479, 1.1 - panel * 0.69],
        );
      }
      add(
        new THREE.CylinderGeometry(0.032, 0.032, 0.04, 8),
        edge,
        sign * 1.74,
        0.48,
        0.95 - panel * 0.69,
      );
    }
    // Corrugated hoses run along the side consoles, below the projected map.
    const hose = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sign * 1.25, 0.24, 2.3),
      new THREE.Vector3(sign * 1.42, 0.5, 1.1),
      new THREE.Vector3(sign * 1.45, 0.5, -0.45),
      new THREE.Vector3(sign * 1.22, 0.64, -1.25),
    ]);
    add(new THREE.TubeGeometry(hose, 30, 0.072, 8, false), rubber);
    for (let ring = 0; ring < 30; ring++) {
      const t = ring / 29,
        p = hose.getPoint(t),
        tangent = hose.getTangent(t);
      rotation.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      matrix.compose(p, rotation, scale);
      const geometry = new THREE.TorusGeometry(
        0.074,
        0.012,
        4,
        10,
      ).toNonIndexed();
      geometry.applyMatrix4(matrix);
      const bucket = batches.get(graphite) ?? [];
      bucket.push(geometry);
      batches.set(graphite, bucket);
    }
    // A compact mechanical throttle, recognisable without filling the centre with controls.
    box(graphite, [0.25, 0.08, 0.5], [sign * 1.05, 0.11, 1.3]);
    add(
      new THREE.CylinderGeometry(0.023, 0.03, 0.29, 8),
      edge,
      sign * 1.05,
      0.28,
      1.3,
      -0.2,
    );
    box(rubber, [0.17, 0.085, 0.11], [sign * 1.05, 0.435, 1.32]);
    box(red, [0.045, 0.018, 0.045], [sign * 1.05, 0.485, 1.32]);
  }

  // Angled physical dashboard with recessed three-scope instrument plate.
  box(worn, [3.7, 0.94, 0.25], [0, 0.43, -1.53], [-0.6, 0, 0]);
  box(recess, [3.48, 0.79, 0.035], [0, 0.445, -1.36], [-0.6, 0, 0]);
  add(new THREE.PlaneGeometry(3.36, 0.72), instrument, 0, 0.455, -1.325, -0.6);
  for (let i = 0; i < 20; i++) {
    box(
      i % 6 === 0 ? red : i % 4 === 0 ? amber : recess,
      [0.068, 0.028, 0.035],
      [-1.62 + i * 0.17, 0.935, -1.77],
    );
  }
  for (const x of [-1.77, 1.77]) {
    add(new THREE.SphereGeometry(0.055, 10, 6), red, x, 0.88, -1.58);
    box(graphite, [0.12, 0.36, 0.04], [x, 0.61, -1.31], [-0.6, 0, 0]);
  }
  // Overhead electrical bay stays inside the canopy's top margin.
  box(graphite, [2.94, 0.16, 0.55], [0, 3.22, -0.82]);
  for (let i = 0; i < 16; i++) {
    box(edge, [0.14, 0.025, 0.23], [-1.33 + i * 0.177, 3.115, -0.8]);
    box(
      i % 3 ? amber : red,
      [0.062, 0.011, 0.06],
      [-1.33 + i * 0.177, 3.095, -0.72],
    );
  }

  // An actual emitter anchors the floating planetary projection to the cockpit.
  add(
    new THREE.CylinderGeometry(0.38, 0.44, 0.12, 32),
    graphite,
    0,
    0.67,
    -2.03,
  );
  add(new THREE.CylinderGeometry(0.3, 0.32, 0.035, 32), recess, 0, 0.75, -2.03);
  add(
    new THREE.TorusGeometry(0.31, 0.016, 6, 48),
    cyan,
    0,
    0.775,
    -2.03,
    Math.PI / 2,
  );
  add(
    new THREE.TorusGeometry(0.2, 0.009, 4, 40),
    cyan,
    0,
    0.78,
    -2.03,
    Math.PI / 2,
  );
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    add(
      new THREE.CylinderGeometry(0.017, 0.017, 0.013, 8),
      white,
      Math.cos(angle) * 0.35,
      0.755,
      -2.03 + Math.sin(angle) * 0.35,
    );
  }
  box(recess, [4.45, 0.16, 7.6], [0, -0.49, -0.1]);
  // Subtle ribs in the pilot's footwell give the lower edge physical depth.
  for (let i = 0; i < 9; i++)
    box(graphite, [2.6, 0.035, 0.07], [0, -0.387, 1.8 - i * 0.3]);

  batches.forEach((parts, material) => {
    const geometry = mergeGeometries(parts, false);
    parts.forEach((part) => part.dispose());
    if (!geometry) return;
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "cockpit-static-batch";
    group.add(mesh);
  });
  group.userData.projector = new THREE.Vector3(0, 0.78, -2.03);
  return group;
}
