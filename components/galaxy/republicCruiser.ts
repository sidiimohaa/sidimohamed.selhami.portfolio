import * as THREE from "three";
import { engine, mesh, paint, plating, seeded, windows, type XYZ } from "./separatistShips";

// A Republic attack cruiser, after Ryan Church's plans for the Jedi cruiser: an arrowhead hull with
// a long dorsal flight deck painted red from the bow, lit trenches down both flanks, wide aft wings
// with their red marks, a tall raked tower carrying two bridges side by side, and the thrusters
// across the stern. Faces +Z; one unit is about its length.

const HULL = "#c8c2b9";
const RED = "#8e3434";

// A hull swept through cross-sections: each station is a z and a ring of [x, y] points, the same
// count at every station. Shaded flat, as plating should be; u runs round the ring, v along z.
function loft(stations: { z: number; ring: [number, number][] }[]) {
  const count = stations[0].ring.length + 1;
  const zMin = stations[0].z,
    zMax = stations[stations.length - 1].z;
  const position: number[] = [],
    uv: number[] = [],
    index: number[] = [];
  stations.forEach(({ z, ring }) => {
    [...ring, ring[0]].forEach(([x, y], k) => {
      position.push(x, y, z);
      uv.push(k / (count - 1), (z - zMin) / (zMax - zMin));
    });
  });
  for (let s = 0; s < stations.length - 1; s++)
    for (let k = 0; k < count - 1; k++) {
      const a = s * count + k,
        b = a + 1,
        c = a + count,
        d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  // Caps at both ends, fanned from the middle of the section.
  for (const s of [0, stations.length - 1]) {
    const centre = position.length / 3;
    const { z, ring } = stations[s];
    position.push(ring.reduce((sum, p) => sum + p[0], 0) / ring.length, ring.reduce((sum, p) => sum + p[1], 0) / ring.length, z);
    uv.push(0.5, s ? 1 : 0);
    for (let k = 0; k < count - 1; k++) {
      const a = s * count + k;
      if (s) index.push(centre, a, a + 1);
      else index.push(centre, a + 1, a);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  const flat = geometry.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

export function createRepublicCruiser(glow: THREE.Texture) {
  const root = new THREE.Group();
  root.name = "republic-cruiser";
  const rand = seeded(1977);
  // The section: flank walls, upper slopes, the flat flight deck on top, lower slopes and keel.
  // Segments round the ring, in u: 0 left wall, 1 left slope, 2 deck, 3 right slope, 4 right wall,
  // 5 right lower slope, 6 keel, 7 left lower slope.
  const section = (z: number, w: number, h: number, wall: number, keel: number): { z: number; ring: [number, number][] } => {
    const deck = w * 0.3,
      floor = w * 0.36;
    return { z, ring: [[-w, -wall], [-w, wall], [-deck, h], [deck, h], [w, wall], [w, -wall], [floor, -keel], [-floor, -keel]] };
  };
  const stations = [
    section(-0.46, 0.19, 0.074, 0.026, 0.054),
    section(-0.3, 0.2, 0.074, 0.026, 0.054),
    section(-0.1, 0.168, 0.064, 0.023, 0.048),
    section(0.1, 0.124, 0.052, 0.02, 0.04),
    section(0.3, 0.08, 0.04, 0.016, 0.031),
    section(0.45, 0.046, 0.03, 0.013, 0.023),
    section(0.5, 0.036, 0.026, 0.012, 0.019),
  ];
  const W = 1024,
    H = 1024;
  const { c, g, done } = paint(W, H);
  plating(c, 0, 0, W, H, rand, 10, HULL);
  const u = (value: number) => (value / 8) * W;
  const v = (z: number) => H * (1 - (z + 0.46) / 0.96);
  // Lit trenches down both flanks.
  for (const side of [0, 4]) windows(c, g, u(side), 0, u(1), H, 4, "#cfeeff", rand);
  // The flight deck: two long red bands from the bow back to the superstructure, panelled across.
  for (const [from, to] of [[2.06, 2.47], [2.53, 2.94]]) {
    c.fillStyle = RED;
    c.fillRect(u(from), v(0.5), u(to) - u(from), v(-0.12) - v(0.5));
    c.fillStyle = "rgba(40,10,10,.35)";
    for (let y = v(0.5); y < v(-0.12); y += 18) c.fillRect(u(from), y, u(to) - u(from), 1);
  }
  c.fillStyle = "rgba(50,46,42,.6)";
  c.fillRect(u(2.475), v(0.5), u(2.525) - u(2.475), v(-0.12) - v(0.5));
  // The weathering of the hull: dark streaks running aft.
  for (let i = 0; i < 60; i++) {
    c.fillStyle = `rgba(60,52,44,${0.05 + rand() * 0.08})`;
    c.fillRect(rand() * W, rand() * H, 2 + rand() * 6, 20 + rand() * 120);
  }
  const { map, emissiveMap } = done();
  const hull = new THREE.MeshStandardMaterial({ color: 0xffffff, map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 1, metalness: 0.3, roughness: 0.6, side: THREE.DoubleSide });
  const plain = new THREE.MeshStandardMaterial({ color: 0xbfb9b0, metalness: 0.3, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, metalness: 0.45, roughness: 0.65 });
  const red = new THREE.MeshStandardMaterial({ color: 0x8e3434, metalness: 0.25, roughness: 0.65 });
  const lit = new THREE.MeshBasicMaterial({ color: 0xcfeeff, toneMapped: false });
  mesh(root, loft(stations), hull);
  // A plate in plan, [x, z] points, extruded to a thickness and set at a height.
  const plate = (points: [number, number][], thickness: number, y: number, material: THREE.Material) => {
    const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, y, 0);
    return mesh(root, geometry, material);
  };
  // The wide aft wings, each with its row of red marks near the tip.
  for (const side of [-1, 1]) {
    plate([[side * 0.17, -0.1], [side * 0.275, -0.34], [side * 0.275, -0.44], [side * 0.17, -0.45]], 0.022, -0.012, plain);
    for (let i = 0; i < 3; i++) mesh(root, new THREE.BoxGeometry(0.03, 0.003, 0.02), red, [side * 0.245, 0.0115, -0.33 - i * 0.03]);
    mesh(root, new THREE.BoxGeometry(0.004, 0.012, 0.1), lit, [side * 0.276, -0.001, -0.39]);
  }
  // The raised decks round the tower, and its turrets.
  mesh(root, new THREE.BoxGeometry(0.2, 0.026, 0.3), plain, [0, 0.082, -0.29]);
  mesh(root, new THREE.BoxGeometry(0.13, 0.022, 0.22), plain, [0, 0.104, -0.3]);
  for (const side of [-1, 1])
    for (let i = 0; i < 4; i++) {
      const at: XYZ = [side * (0.085 + i * 0.008), 0.098, -0.17 - i * 0.065];
      mesh(root, new THREE.CylinderGeometry(0.011, 0.013, 0.01, 10), dark, at);
      for (const barrel of [-0.004, 0.004]) mesh(root, new THREE.BoxGeometry(0.0025, 0.0025, 0.026), dark, [at[0] + barrel, at[1] + 0.004, at[2] + 0.016]);
    }
  // The tower, raked back, and its two bridges side by side on top.
  const tower = new THREE.Shape([[-0.14, 0.1], [-0.27, 0.225], [-0.335, 0.225], [-0.38, 0.1]].map(([z, y]) => new THREE.Vector2(-z, y)));
  const fin = new THREE.ExtrudeGeometry(tower, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.004, bevelSegments: 1 });
  fin.translate(0, 0, -0.03);
  fin.rotateY(Math.PI / 2);
  mesh(root, fin, hull);
  for (const side of [-1, 1]) {
    mesh(root, new THREE.BoxGeometry(0.048, 0.026, 0.1), plain, [side * 0.034, 0.24, -0.3]);
    mesh(root, new THREE.BoxGeometry(0.036, 0.012, 0.06), plain, [side * 0.034, 0.258, -0.305]);
    mesh(root, new THREE.BoxGeometry(0.05, 0.005, 0.004), lit, [side * 0.034, 0.242, -0.249]);
  }
  for (let i = 0; i < 4; i++) mesh(root, new THREE.BoxGeometry(0.062, 0.002, 0.003), lit, [0, 0.13 + i * 0.022, -0.17 - i * 0.026]);
  // The stern: three great thrusters and four smaller ones.
  mesh(root, new THREE.BoxGeometry(0.3, 0.09, 0.03), dark, [0, 0.015, -0.47]);
  const nozzle = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, toneMapped: false });
  const thruster = (x: number, y: number, radius: number) => {
    mesh(root, new THREE.CylinderGeometry(radius, radius * 1.1, 0.05, 20), plain, [x, y, -0.495], [Math.PI / 2, 0, 0]);
    mesh(root, new THREE.CylinderGeometry(radius * 0.85, radius * 0.85, 0.004, 20), nozzle, [x, y, -0.521], [Math.PI / 2, 0, 0]);
    engine(root, glow, 0xbfe6ff, radius * 4, [x, y, -0.53]);
  };
  [-0.075, 0, 0.075].forEach((x) => thruster(x, 0.03, 0.033));
  [-0.135, -0.11, 0.11, 0.135].forEach((x) => thruster(x, -0.015, 0.014));
  return root;
}
