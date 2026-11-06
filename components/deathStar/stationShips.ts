import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// The Imperial-class Star Destroyer on station off the bay. Local +X is the bow, +Y the deck. It is
// painted with its own light, so it stays readable from the bay whatever the room's lights are doing.

const LIGHT = new THREE.Vector3(0.25, 0.85, -0.45).normalize();

function platingTexture() {
  const size = 1024,
    canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#c9ced4";
  c.fillRect(0, 0, size, size);
  let seed = 1701;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 520; i++) {
    const v = Math.round(176 + rnd() * 46);
    c.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    c.fillRect(rnd() * size, rnd() * size, 12 + rnd() * 120, 8 + rnd() * 46);
  }
  c.fillStyle = "rgba(40,44,50,.55)";
  for (let i = 0; i < 16; i++) c.fillRect(0, (i / 16) * size, size, 2);
  for (let i = 0; i < 24; i++) c.fillRect((i / 24) * size, 0, 2, size);
  c.fillStyle = "rgba(30,33,38,.34)";
  for (let i = 0; i < 700; i++) c.fillRect(rnd() * size, rnd() * size, 2 + rnd() * 5, 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

export function createStarDestroyer() {
  const parts: THREE.BufferGeometry[] = [];
  // Colours each flat face from its own slope, and lays the plating flat from above.
  const finish = (geometry: THREE.BufferGeometry, tone: number) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    g.computeVertexNormals();
    const p = g.getAttribute("position"),
      n = g.getAttribute("normal"),
      colors = new Float32Array(p.count * 3),
      uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const light = (0.26 + 0.82 * Math.max(0, n.getX(i) * LIGHT.x + n.getY(i) * LIGHT.y + n.getZ(i) * LIGHT.z)) * tone;
      colors.set([light, light, light * 1.03], i * 3);
      const side = Math.abs(n.getY(i)) < 0.5;
      uv.set([p.getX(i) / 42, (side ? p.getY(i) * 3 : p.getZ(i)) / 42], i * 2);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    parts.push(g);
  };
  const facets = (points: THREE.Vector3[], faces: number[][], tone = 1) => {
    const position: number[] = [];
    faces.forEach(([a, b, c]) => [a, b, c].forEach((i) => position.push(points[i].x, points[i].y, points[i].z)));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
    finish(g, tone);
  };
  const block = (w: number, h: number, d: number, x: number, y: number, z: number, tone = 1) => finish(new THREE.BoxGeometry(w, h, d).translate(x, y, z), tone);
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  // A dagger: bow at +X, ridge along the middle, sloping to the two edges.
  const dagger = (front: number, back: number, halfWidth: number, ridge: number, base: number, tone = 1) => {
    const n = V(front, base, 0),
      l = V(back, base, -halfWidth),
      r = V(back, base, halfWidth),
      t = V(back, base + ridge, 0);
    facets([n, l, r, t], [[0, 1, 3], [0, 3, 2], [1, 2, 3]], tone);
  };

  // The upper hull, the dark trench that runs round it, then the lower hull with its keel.
  dagger(84, -80, 48, 15, 1.6);
  const trench = V(-80, 0, 0);
  facets([V(81, 1.7, 0), V(-79, 1.7, -45.5), V(-79, 1.7, 45.5), V(81, -1.6, 0), V(-79, -1.6, -45.5), V(-79, -1.6, 45.5)], [[0, 1, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2], [1, 2, 5], [1, 5, 4]], 0.22);
  facets([V(84, -1.6, 0), V(-80, -1.6, -48), V(-80, -1.6, 48), trench.clone().setY(-13)], [[0, 3, 1], [0, 2, 3], [1, 3, 2]], 0.72);
  // The stepped city of decks on top.
  dagger(30, -80, 24, 4, 14 - 7, 1.06);
  dagger(4, -80, 17, 3.5, 11, 1.1);
  dagger(-24, -80, 11, 3, 14.5, 1.14);
  // The command tower: its base, neck, the T of the bridge and the two shield domes.
  block(26, 5, 15, -66, 19.5, 0, 1.08);
  block(14, 4, 9, -69, 24, 0);
  block(6, 7, 3.4, -71, 29, 0);
  block(5, 2.4, 25, -71, 33.2, 0, 1.16);
  block(5.4, 0.5, 10, -68.7, 33, 0, 0.3);
  [-9.5, 9.5].forEach((z) => finish(new THREE.SphereGeometry(2.1, 14, 10).translate(-71, 36, z), 1.2));
  // The gun batteries along the deck edges, and scattered greebles along the terraces.
  let seed = 327;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 110; i++) {
    const x = -76 + rnd() * 130;
    const k = (84 - x) / 164;
    const side = rnd() < 0.5 ? -1 : 1,
      z = side * k * 48 * (0.15 + rnd() * 0.72);
    const y = 1.6 + 15 * k * (1 - Math.abs(z) / (k * 48));
    block(1 + rnd() * 2.6, 0.5 + rnd() * 1.1, 0.8 + rnd() * 1.8, x, y + 0.4, z, 0.9 + rnd() * 0.3);
  }
  [-1, 1].forEach((side) => {
    for (let i = 0; i < 4; i++) {
      const x = -68 + i * 13,
        z = side * (23 - i * 2.2);
      block(3, 1.4, 3, x, 8.2 + i * 0.1, z, 1.1);
      block(3.8, 0.28, 0.28, x + 2.6, 8.6 + i * 0.1, z + 0.5, 0.6);
      block(3.8, 0.28, 0.28, x + 2.6, 8.6 + i * 0.1, z - 0.5, 0.6);
    }
  });
  // The hangar bay in the belly and the engine block at the stern.
  block(26, 0.3, 11, -36, -9.7, 0, 0.32);
  block(4, 22, 48, -82, 0, 0, 0.5);
  const map = platingTexture();
  const hull = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshBasicMaterial({ map, vertexColors: true }));
  const group = new THREE.Group();
  group.name = "star-destroyer";
  group.add(hull);
  // Three main engines and four smaller, burning blue.
  const flame = new THREE.MeshBasicMaterial({ color: 0x8fcbff, toneMapped: false });
  const halo = new THREE.MeshBasicMaterial({ color: 0x4aa8ff, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const halos: THREE.Mesh[] = [];
  [[0, 0, 9], [0, -15, 7], [0, 15, 7], [7, -8, 3.2], [7, 8, 3.2], [-7, -8, 3.2], [-7, 8, 3.2]].forEach(([y, z, r]) => {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 24), flame);
    disc.position.set(-84.2, y, z);
    disc.rotation.y = -Math.PI / 2;
    const glow = new THREE.Mesh(new THREE.CircleGeometry(r * 1.35, 24), halo);
    glow.position.set(-84.6, y, z);
    glow.rotation.y = -Math.PI / 2;
    group.add(disc, glow);
    halos.push(glow);
  });
  // Lit windows along the trench and the tower.
  const windows: number[] = [];
  for (let i = 0; i < 420; i++) {
    const k = rnd();
    const side = rnd() < 0.5 ? -1 : 1;
    windows.push(82 - k * 160, 0.1 + rnd() * 1.2, side * (k * 46.2));
  }
  for (let i = 0; i < 60; i++) windows.push(-71 + (rnd() - 0.5) * 5.2, 33 + rnd() * 1.1, (rnd() - 0.5) * 24);
  const windowGeometry = new THREE.BufferGeometry();
  windowGeometry.setAttribute("position", new THREE.Float32BufferAttribute(windows, 3));
  group.add(new THREE.Points(windowGeometry, new THREE.PointsMaterial({ color: 0xfff0cf, size: 0.5, sizeAttenuation: true, toneMapped: false })));
  return {
    group,
    tick: (time: number, reduced: boolean) => {
      if (!reduced) halo.opacity = 0.14 + Math.sin(time * 3.1) * 0.03;
    },
  };
}
