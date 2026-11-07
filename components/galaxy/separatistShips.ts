import * as THREE from "three";

// The Separatist ships of the trade convoy event: the ring-shaped battleships of the Trade
// Federation, the vulture droids that escort them, and General Grievous's flagship behind them.
// Each faces +Z, is built at unit scale and carries its engine glows as sprites, like the traffic.
// Both big ships are pale grey plating with the Separatists' blue-violet markings.

type Glow = THREE.Texture;
export type XYZ = [number, number, number];

export const GREY = "#b4b6ba";
const BLUE = "#4d55a6";

export function seeded(seed: number) {
  let state = seed;
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// A canvas pair for a hull: what it looks like, and where it glows.
export function paint(width: number, height: number) {
  const make = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return [canvas, canvas.getContext("2d")!] as const;
  };
  const [colourCanvas, c] = make();
  const [glowCanvas, g] = make();
  g.fillStyle = "#000";
  g.fillRect(0, 0, width, height);
  const done = (repeatX = 1, repeatY = 1) => {
    const texture = (canvas: HTMLCanvasElement, colour: boolean) => {
      const map = new THREE.CanvasTexture(canvas);
      if (colour) map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(repeatX, repeatY);
      map.anisotropy = 8;
      return map;
    };
    return { map: texture(colourCanvas, true), emissiveMap: texture(glowCanvas, false) };
  };
  return { c, g, done };
}

// Weathered plating: blocks a shade lighter or darker than the base, and their seams.
export function plating(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rand: () => number, block = 14, base = GREY) {
  c.fillStyle = base;
  c.fillRect(x, y, w, h);
  for (let row = y; row < y + h; row += block) {
    let at = x - rand() * block * 2;
    while (at < x + w) {
      const length = block + Math.floor(rand() * block * 3);
      const shade = rand();
      c.fillStyle = shade < 0.45 ? `rgba(40,42,48,${0.06 + rand() * 0.14})` : `rgba(255,255,255,${0.04 + rand() * 0.1})`;
      c.fillRect(at + 1, row + 1, length - 1, Math.min(block, y + h - row) - 1);
      at += length;
    }
    c.fillStyle = "rgba(30,32,38,.35)";
    c.fillRect(x, row, w, 1);
  }
}

// Rows of lit windows: dark slots on the plating, glowing in the glow map.
export function windows(c: CanvasRenderingContext2D, g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rows: number, light: string, rand: () => number) {
  c.fillStyle = "#3a3c42";
  c.fillRect(x, y, w, h);
  for (let r = 0; r < rows; r++) {
    const row = y + ((r + 0.5) * h) / rows;
    for (let at = x + rand() * 4; at < x + w; at += 3) {
      if (rand() < 0.3) continue;
      c.fillStyle = "#1c1d21";
      c.fillRect(at, row - 1, 2, 2);
      g.fillStyle = rand() < 0.9 ? light : "#ffd6a0";
      g.fillRect(at, row - 1, 2, 2);
    }
  }
}

export function engine(root: THREE.Object3D, glow: Glow, color: number, size: number, at: XYZ) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  sprite.position.set(...at);
  sprite.scale.setScalar(size);
  root.add(sprite);
}

export const mesh = (root: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, at: XYZ = [0, 0, 0], turn: XYZ = [0, 0, 0]) => {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...at);
  item.rotation.set(...turn);
  root.add(item);
  return item;
};

/** A Trade Federation battleship: a ring open at the bow, a wall of lit hangars round its inside,
 *  the docking tubes along its two ends, the central sphere on a neck from the stern, and the
 *  engine block with its four great thrusters and its spires. One unit is the ring's outer radius. */
export function createFederationBattleship(glow: Glow) {
  const root = new THREE.Group();
  root.name = "federation-battleship";
  const rand = seeded(66);
  // The ring's section, from the inner hangar wall over the raised inner band and the long sloping
  // deck to the outer rim, and back underneath. The texture is painted segment by segment.
  const section: [number, number][] = [
    [0.62, -0.075], [0.62, 0.075], [0.64, 0.11], [0.73, 0.11], [0.75, 0.09], [0.97, 0.05], [1, 0.025],
    [1, -0.025], [0.97, -0.05], [0.75, -0.09], [0.73, -0.11], [0.64, -0.11], [0.62, -0.075],
  ];
  const segments = section.length - 1;
  const W = 2048,
    H = segments * 16;
  const { c, g, done } = paint(W, H);
  // v runs from the first point (bottom of the canvas) to the last.
  const band = (k: number) => H - (k + 1) * 16;
  for (let k = 0; k < segments; k++) plating(c, 0, band(k), W, 16, rand, 8);
  windows(c, g, 0, band(0), W, 16, 4, "#d6ffcf", rand);
  windows(c, g, 0, band(6), W, 16, 2, "#d6ffcf", rand);
  // The violet markings: a broken stripe along the inner band, sweeping shapes over the deck.
  for (const k of [2, 10]) {
    for (let x = 0; x < W; x += 160) {
      c.fillStyle = BLUE;
      c.fillRect(x + 10, band(k) + 5, 120 + rand() * 20, 6);
    }
  }
  for (const k of [4, 8]) {
    for (let x = 40; x < W; x += 260 + rand() * 120) {
      c.fillStyle = BLUE;
      c.beginPath();
      c.moveTo(x, band(k) + 16);
      c.lineTo(x + 90, band(k) + 16);
      c.lineTo(x + 130, band(k) + 2);
      c.lineTo(x + 20, band(k) + 6);
      c.closePath();
      c.fill();
      c.fillRect(x + 160, band(k) + 3, 40, 10);
    }
  }
  const { map, emissiveMap } = done(2, 1);
  const hull = new THREE.MeshStandardMaterial({ color: 0xffffff, map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 1, metalness: 0.3, roughness: 0.62, side: THREE.DoubleSide });
  const plain = new THREE.MeshStandardMaterial({ color: 0xaeb0b5, metalness: 0.35, roughness: 0.58 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x45474e, metalness: 0.45, roughness: 0.65 });
  const violet = new THREE.MeshStandardMaterial({ color: 0x4d55a6, metalness: 0.3, roughness: 0.6 });
  const gap = 0.3;
  const points = section.map(([r, y]) => new THREE.Vector2(r, y));
  mesh(root, new THREE.LatheGeometry(points, 160, gap, Math.PI * 2 - gap * 2), hull);
  const along = (phi: number, r: number, y: number): XYZ => [Math.sin(phi) * r, y, Math.cos(phi) * r];
  // The two cut ends, and on each the docking tube lying along the deck and the claws at the cut.
  for (const side of [-1, 1]) {
    const phi = side * gap;
    const cap = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(points)), plain);
    cap.rotation.y = phi - Math.PI / 2;
    root.add(cap);
    const length = 0.55,
      start = gap + 0.03;
    const tube = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.04, 12, 40, length), plain);
    tube.rotation.set(Math.PI / 2, 0, side > 0 ? Math.PI / 2 - start - length : Math.PI / 2 + start);
    tube.position.y = 0.105;
    root.add(tube);
    for (const end of [start, start + length]) mesh(root, new THREE.SphereGeometry(0.04, 14, 10), plain, along(side * end, 0.84, 0.105));
    const claws = new THREE.Group();
    claws.position.set(...along(phi, 0, 0));
    claws.rotation.y = phi;
    root.add(claws);
    [0.68, 0.8, 0.92].forEach((r, i) => {
      mesh(claws, new THREE.BoxGeometry(0.07, 0.025, 0.025), dark, [-side * 0.03, -0.03 + i * 0.03, r]);
      mesh(claws, new THREE.BoxGeometry(0.025, 0.025, 0.05), dark, [-side * 0.06, -0.03 + i * 0.03, r + 0.02]);
    });
  }
  // Dishes and gun towers over the deck.
  for (let i = 0; i < 12; i++) {
    const phi = (rand() < 0.5 ? -1 : 1) * (gap + 0.3 + rand() * (Math.PI - gap - 0.8));
    const r = 0.8 + rand() * 0.14;
    const y = 0.11 - (r - 0.75) * 0.27;
    const at = along(phi, r, y);
    if (i % 3 === 0) {
      mesh(root, new THREE.CylinderGeometry(0.008, 0.012, 0.05, 8), dark, [at[0], at[1] + 0.025, at[2]]);
      mesh(root, new THREE.SphereGeometry(0.03, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), plain, [at[0], at[1] + 0.06, at[2]], [Math.PI, 0, 0.4]);
    } else {
      mesh(root, new THREE.BoxGeometry(0.03, 0.03, 0.03), plain, [at[0], at[1] + 0.015, at[2]], [0, phi, 0]);
      mesh(root, new THREE.BoxGeometry(0.004, 0.004, 0.05), dark, [at[0], at[1] + 0.03, at[2]], [0, phi + 1.2, 0]);
    }
  }
  // The core: a sphere ringed with violet bands, its bridge towers on top, and the neck to the stern.
  mesh(root, new THREE.SphereGeometry(0.29, 48, 32), plain);
  mesh(root, new THREE.TorusGeometry(0.291, 0.008, 8, 64), violet, [0, 0, 0], [Math.PI / 2, 0, 0]);
  mesh(root, new THREE.TorusGeometry(0.25, 0.007, 8, 64), violet, [0, 0.15, 0], [Math.PI / 2, 0, 0]);
  mesh(root, new THREE.TorusGeometry(0.25, 0.007, 8, 64), dark, [0, -0.15, 0], [Math.PI / 2, 0, 0]);
  for (const x of [-0.07, 0.08]) {
    mesh(root, new THREE.BoxGeometry(0.05, 0.1, 0.06), plain, [x, 0.3, 0.02 - x * 0.5]);
    mesh(root, new THREE.BoxGeometry(0.12, 0.012, 0.03), dark, [x, 0.36, 0.02 - x * 0.5]);
  }
  mesh(root, new THREE.CylinderGeometry(0.08, 0.09, 0.36, 20), plain, [0, 0, -0.45], [Math.PI / 2, 0, 0]);
  // The engine block across the stern, its four thrusters burning blue, its spires above.
  mesh(root, new THREE.BoxGeometry(0.56, 0.16, 0.34), plain, [0, 0.02, -0.92]);
  mesh(root, new THREE.BoxGeometry(0.4, 0.08, 0.2), dark, [0, 0.12, -0.9]);
  const nozzle = new THREE.MeshBasicMaterial({ color: 0x8fd6ff, toneMapped: false });
  [-0.21, -0.07, 0.07, 0.21].forEach((x, i) => {
    const y = i % 2 ? -0.01 : 0.04;
    mesh(root, new THREE.CylinderGeometry(0.06, 0.068, 0.24, 20), plain, [x, y, -1.14], [Math.PI / 2, 0, 0]);
    mesh(root, new THREE.CylinderGeometry(0.052, 0.052, 0.01, 20), nozzle, [x, y, -1.265], [Math.PI / 2, 0, 0]);
    engine(root, glow, 0x8fd6ff, 0.2, [x, y, -1.29]);
  });
  for (let i = 0; i < 8; i++) {
    const height = 0.1 + rand() * 0.22;
    mesh(root, new THREE.BoxGeometry(0.02 + rand() * 0.015, height, 0.035), plain, [-0.2 + i * 0.055 + rand() * 0.02, 0.16 + height / 2, -0.86 - rand() * 0.1]);
  }
  return root;
}

/** General Grievous's flagship, after its plans: a long round hull, thicker aft, tapering forward
 *  to a pointed beak; a long pod beneath the bow; a tall tower raked back near the stern with its
 *  bridge across the top; a keel fin aft; the engine at the very stern. One unit is its length. */
export function createGrievousFlagship(glow: Glow) {
  const root = new THREE.Group();
  root.name = "grievous-flagship";
  const rand = seeded(1138);
  // The hull, as a radius along its length.
  const Z0 = -0.47,
    Z1 = 0.56;
  const radius = (z: number) => {
    const ease = (a: number, b: number, from: number, to: number) => THREE.MathUtils.lerp(from, to, THREE.MathUtils.smoothstep(z, a, b));
    if (z < -0.45) return ease(-0.47, -0.45, 0.05, 0.075);
    if (z < -0.4) return ease(-0.45, -0.4, 0.075, 0.086);
    if (z < -0.08) return 0.086;
    if (z < -0.02) return ease(-0.08, -0.02, 0.086, 0.064);
    if (z < 0.3) return ease(-0.02, 0.3, 0.064, 0.058);
    if (z < 0.46) return ease(0.3, 0.46, 0.058, 0.026);
    if (z < 0.5) return ease(0.46, 0.5, 0.026, 0.009);
    return ease(0.5, Z1, 0.009, 0.003);
  };
  const profile = [new THREE.Vector2(0.001, Z0)];
  for (let i = 0; i <= 80; i++) {
    const z = Z0 + ((Z1 - Z0) * i) / 80;
    profile.push(new THREE.Vector2(radius(z), z));
  }
  profile.push(new THREE.Vector2(0.001, Z1));
  // Painted in hull coordinates: u round the hull (0.5 on top, 0.25 and 0.75 on the flanks), v
  // along it from stern to bow.
  const W = 1024,
    H = 1024;
  const { c, g, done } = paint(W, H);
  plating(c, 0, 0, W, H, rand, 12);
  const y = (z: number) => H * (1 - (z - Z0) / (Z1 - Z0));
  const x = (u: number) => u * W;
  // A dark hangar slot and window decks along each flank of the aft section.
  for (const u of [0.25, 0.75]) {
    windows(c, g, x(u - 0.035), y(-0.06), x(0.07), y(-0.4) - y(-0.06), 0, "#ffd6a0", rand);
    for (const deckU of [u - 0.08, u + 0.08]) windows(c, g, x(deckU - 0.012), y(0.3), x(0.024), y(-0.42) - y(0.3), 2, "#ffd6a0", rand);
  }
  // The blue bands across the aft section.
  c.fillStyle = BLUE;
  for (const z of [-0.33, -0.27, -0.21, -0.15]) {
    c.fillRect(x(0.12), y(z + 0.018), x(0.11), y(z) - y(z + 0.018));
    c.fillRect(x(0.77), y(z + 0.018), x(0.11), y(z) - y(z + 0.018));
    if (z > -0.3) c.fillRect(x(0.4), y(z + 0.018), x(0.2), y(z) - y(z + 0.018));
  }
  // The sweeping blue flash along each side of the bow, and the pale oval eye at its tip.
  for (const side of [-1, 1]) {
    const mid = 0.5 + side * 0.22;
    c.fillStyle = BLUE;
    c.beginPath();
    c.moveTo(x(mid), y(0.12));
    c.quadraticCurveTo(x(mid + side * 0.06), y(0.3), x(mid - side * 0.02), y(0.46));
    c.quadraticCurveTo(x(mid - side * 0.06), y(0.36), x(mid - side * 0.05), y(0.2));
    c.closePath();
    c.fill();
    c.beginPath();
    c.ellipse(x(mid - side * 0.03), y(0.475), x(0.04), y(0.45) - y(0.5), 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#c9cdd6";
    c.beginPath();
    c.ellipse(x(mid - side * 0.03), y(0.475), x(0.025), (y(0.45) - y(0.5)) * 0.6, 0, 0, Math.PI * 2);
    c.fill();
  }
  const { map, emissiveMap } = done();
  const hull = new THREE.MeshStandardMaterial({ color: 0xffffff, map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 1, metalness: 0.4, roughness: 0.55 });
  const plain = new THREE.MeshStandardMaterial({ color: 0xa6a8ad, metalness: 0.4, roughness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x34363c, metalness: 0.5, roughness: 0.6 });
  const lit = new THREE.MeshBasicMaterial({ color: 0xffd7a0, toneMapped: false });
  const body = new THREE.LatheGeometry(profile, 48);
  body.rotateX(Math.PI / 2);
  mesh(root, body, hull);
  // The long pod beneath the bow, and the raised blisters along the flanks of the aft section.
  mesh(root, new THREE.SphereGeometry(1, 32, 16), plain, [0, -0.058, 0.2]).scale.set(0.044, 0.026, 0.19);
  for (const side of [-1, 1]) {
    mesh(root, new THREE.SphereGeometry(1, 28, 14), plain, [side * 0.078, -0.005, -0.21]).scale.set(0.022, 0.05, 0.17);
    mesh(root, new THREE.BoxGeometry(0.006, 0.012, 0.22), dark, [side * 0.099, -0.005, -0.21]);
  }
  // The deck along the back of the aft section, with its masts.
  mesh(root, new THREE.BoxGeometry(0.11, 0.012, 0.42), plain, [0, 0.088, -0.2]);
  mesh(root, new THREE.BoxGeometry(0.04, 0.02, 0.3), dark, [0, 0.1, -0.16]);
  mesh(root, new THREE.SphereGeometry(0.02, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), plain, [0, 0.094, -0.02]);
  for (const [z, height] of [[-0.1, 0.05], [-0.06, 0.035], [0.08, 0.04], [0.14, 0.05], [0.18, 0.03], [0.28, 0.04], [-0.38, 0.04]] as [number, number][]) {
    const top = radius(z) + (z < -0.05 ? 0.012 : 0);
    mesh(root, new THREE.CylinderGeometry(0.0015, 0.003, height, 5), dark, [0, top + height / 2, z]);
  }
  // A fin, drawn side on as [z, y] points and extruded across the hull.
  const fin = (points: [number, number][], thickness: number, material: THREE.Material) => {
    const shape = new THREE.Shape(points.map(([z, height]) => new THREE.Vector2(-z, height)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1 });
    geometry.translate(0, 0, -thickness / 2);
    geometry.rotateY(Math.PI / 2);
    return mesh(root, geometry, material);
  };
  // The tower, raked back, with the bridge across its top.
  fin([[-0.34, 0.07], [-0.21, 0.07], [-0.26, 0.11], [-0.355, 0.29], [-0.385, 0.29], [-0.37, 0.12]], 0.026, plain);
  mesh(root, new THREE.CapsuleGeometry(0.013, 0.075, 4, 14), plain, [0, 0.297, -0.375], [Math.PI / 2, 0, 0]);
  mesh(root, new THREE.BoxGeometry(0.034, 0.006, 0.1), dark, [0, 0.31, -0.375]);
  mesh(root, new THREE.BoxGeometry(0.03, 0.004, 0.06), lit, [0, 0.297, -0.335]);
  mesh(root, new THREE.CylinderGeometry(0.0012, 0.0012, 0.03, 4), dark, [0.008, 0.325, -0.39]);
  // The keel fin aft, with a pod at its tip; the small fins over the stern.
  fin([[-0.31, -0.07], [-0.24, -0.07], [-0.27, -0.13], [-0.3, -0.135]], 0.016, plain);
  mesh(root, new THREE.CapsuleGeometry(0.009, 0.03, 4, 10), plain, [0, -0.135, -0.29], [Math.PI / 2, 0, 0]);
  for (const side of [-1, 1]) mesh(root, new THREE.BoxGeometry(0.06, 0.004, 0.04), plain, [side * 0.05, 0.075, -0.44], [0, 0, side * 0.35]);
  // The engine at the stern.
  mesh(root, new THREE.CylinderGeometry(0.038, 0.046, 0.05, 20), dark, [0, 0, -0.49], [Math.PI / 2, 0, 0]);
  mesh(root, new THREE.CylinderGeometry(0.03, 0.03, 0.006, 20), new THREE.MeshBasicMaterial({ color: 0x9fd4ff, toneMapped: false }), [0, 0, -0.516], [Math.PI / 2, 0, 0]);
  engine(root, glow, 0x9fd4ff, 0.11, [0, 0, -0.53]);
  return root;
}

/** A vulture droid in flight: a narrow body, a sensor head, and two pairs of wings spread in a
 *  shallow X with cannons at their tips. About a unit long. */
export function createVultureDroid(glow: Glow) {
  const root = new THREE.Group();
  root.name = "vulture-droid";
  const body = new THREE.MeshStandardMaterial({ color: 0x8c7b62, metalness: 0.45, roughness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a342c, metalness: 0.4, roughness: 0.7 });
  mesh(root, new THREE.BoxGeometry(0.11, 0.08, 0.6), body);
  mesh(root, new THREE.BoxGeometry(0.08, 0.06, 0.22), dark, [0, 0.015, 0.4]);
  for (const side of [-1, 1]) {
    mesh(root, new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff5a3a, toneMapped: false }), [side * 0.028, 0.03, 0.51]);
    for (const level of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(side * 0.05, level * 0.03, -0.05);
      wing.rotation.z = side * level * 0.16;
      root.add(wing);
      mesh(wing, new THREE.BoxGeometry(0.6, 0.018, 0.14), body, [side * 0.3, 0, 0]);
      mesh(wing, new THREE.BoxGeometry(0.12, 0.02, 0.1), dark, [side * 0.56, 0, -0.06]);
      mesh(wing, new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), dark, [side * 0.58, 0, 0.08], [Math.PI / 2, 0, 0]);
    }
  }
  engine(root, glow, 0xffa06a, 0.25, [0, 0, -0.34]);
  return root;
}
