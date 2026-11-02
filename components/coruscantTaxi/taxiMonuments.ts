import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { COUNCIL, COUNCIL_FACING, COUNCIL_FLOOR, ESPLANADE, PLAZA, SENATE, SENATE_DRUM, SENATE_FACING, SENATE_RIM, SENATE_STOP, TEMPLE } from "./taxiPlaces";

// The two monuments seen from the air. The Jedi Temple is a stepped ziggurat of warm stone with
// five spires; the Council meets in the crown of the spire that faces the pad, built by the
// chamber itself. The Senate is a blue-grey dome on a slender stem, reached by a plaza lined
// with statues. Static parts are merged per material.

type Batches = Map<THREE.Material, THREE.BufferGeometry[]>;
const put = (batches: Batches, material: THREE.Material, geometry: THREE.BufferGeometry, matrix?: THREE.Matrix4) => {
  if (matrix) geometry.applyMatrix4(matrix);
  const list = batches.get(material) ?? [];
  list.push(geometry.index ? geometry.toNonIndexed() : geometry);
  batches.set(material, list);
};
const flush = (batches: Batches, group: THREE.Group) =>
  batches.forEach((list, material) => {
    list.forEach((geometry) => {
      geometry.deleteAttribute("uv1");
      if (!geometry.getAttribute("uv")) geometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute("position").count * 2), 2));
    });
    const mesh = new THREE.Mesh(mergeGeometries(list), material);
    group.add(mesh);
  });
const lathe = (profile: [number, number][], segments = 48) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);
const at = (x: number, y: number, z: number, yaw = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(1, 1, 1));

function stoneTexture(base: string, line: string, lit: string, seed: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const c = canvas.getContext("2d")!;
  let s = seed;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  c.fillStyle = base;
  c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) {
    c.fillStyle = `rgba(0,0,0,${0.03 + rand() * 0.05})`;
    c.fillRect(rand() * 512, rand() * 512, 20 + rand() * 80, 6 + rand() * 20);
  }
  c.strokeStyle = line;
  c.lineWidth = 2;
  for (let y = 0; y < 512; y += 32) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(512, y);
    c.stroke();
  }
  // Narrow lit slits, the windows of the halls inside.
  for (let i = 0; i < 70; i++) {
    c.fillStyle = rand() < 0.7 ? lit : "rgba(20,14,10,.6)";
    c.fillRect(Math.floor(rand() * 32) * 16 + 4, Math.floor(rand() * 16) * 32 + 9, 5, 15);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

// The colonnade of lit bays that runs round the top of the Temple's podium.
function colonnadeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 64;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#4a3726";
  c.fillRect(0, 0, 512, 64);
  for (let i = 0; i < 16; i++) {
    const g = c.createLinearGradient(0, 8, 0, 60);
    g.addColorStop(0, "#ffe6b8");
    g.addColorStop(1, "#ffb066");
    c.fillStyle = g;
    c.fillRect(i * 32 + 9, 10, 14, 50);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(14, 1);
  return texture;
}

// Spire placement on the roof: the tall one in the middle, four around it.
export const TEMPLE_ROOF = 70;
const SPIRES: { dx: number; dz: number; r: number; top: number }[] = [
  { dx: 0, dz: 0, r: 13, top: 266 },
  { dx: 52, dz: 52, r: 12.5, top: COUNCIL_FLOOR + 56 },
  { dx: -52, dz: 52, r: 9, top: 226 },
  { dx: 52, dz: -52, r: 9, top: 226 },
  { dx: -52, dz: -52, r: 9, top: 226 },
];

export function createJediTemple(glow: THREE.Texture) {
  const group = new THREE.Group();
  group.name = "jedi-temple";
  const stoneMap = stoneTexture("#c9b08c", "rgba(80,58,36,.3)", "rgba(255,200,130,.9)", 11);
  stoneMap.repeat.set(8, 5);
  const stone = new THREE.MeshStandardMaterial({ color: 0xe0cba8, map: stoneMap, roughness: 0.8, metalness: 0.04, emissive: 0x3a2412, emissiveIntensity: 0.22 });
  const slope = new THREE.MeshStandardMaterial({ color: 0xe6d3b2, roughness: 0.74, metalness: 0.04, emissive: 0x3a2412, emissiveIntensity: 0.2 });
  const pylonMap = stoneTexture("#bba27f", "rgba(70,50,30,.35)", "rgba(255,206,140,.85)", 23);
  pylonMap.repeat.set(3, 8);
  const pylon = new THREE.MeshStandardMaterial({ color: 0xd2bc98, map: pylonMap, roughness: 0.82, metalness: 0.04, emissive: 0x3a2412, emissiveIntensity: 0.2 });
  const groove = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9, metalness: 0.02 });
  const spireMap = stoneTexture("#c8b291", "rgba(70,50,30,.25)", "rgba(255,206,140,.9)", 29);
  spireMap.repeat.set(6, 14);
  const spireStone = new THREE.MeshStandardMaterial({ color: 0xe0cdac, map: spireMap, roughness: 0.74, metalness: 0.05, emissive: 0x3a2412, emissiveIntensity: 0.2 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: 0.45, metalness: 0.7 });
  const warm = new THREE.MeshBasicMaterial({ color: 0xffc27a, toneMapped: false });
  const colonnade = new THREE.MeshBasicMaterial({ map: colonnadeTexture(), toneMapped: false });
  const batches: Batches = new Map();
  const { x, z } = TEMPLE;
  // Each face is built facing +Z, then turned a quarter at a time round the centre.
  const face = (k: number, m: THREE.Matrix4) => at(x, 0, z, (k * Math.PI) / 2).multiply(m);
  const local = (px: number, py: number, pz: number, yaw = 0, tilt = 0) =>
    new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, 0, "YXZ")), new THREE.Vector3(1, 1, 1));

  // The podium the Temple stands on, with a lit colonnade round its top.
  put(batches, stone, new THREE.BoxGeometry(410, 360, 410), at(x, -240, z));
  for (let k = 0; k < 4; k++) put(batches, colonnade, new THREE.PlaneGeometry(410, 14), face(k, local(0, -69, 205.3)));
  // The core block, then on every face: corner pylons, a central spine and two sloped facades
  // between them, each scored with dark grooves.
  put(batches, stone, new THREE.BoxGeometry(300, 122, 300), at(x, -1, z));
  const RISE = 122,
    OUT = 34,
    lean = Math.atan2(OUT, RISE),
    length = Math.hypot(OUT, RISE);
  const wedge = new THREE.Shape();
  wedge.moveTo(0, 0);
  wedge.lineTo(OUT, 0);
  wedge.lineTo(0, RISE);
  wedge.closePath();
  for (let k = 0; k < 4; k++) {
    put(batches, pylon, new THREE.BoxGeometry(64, 136, 64), face(k, local(152, 8, 152)));
    put(batches, pylon, new THREE.BoxGeometry(46, 136, 40), face(k, local(0, 8, 170)));
    [-1, 1].forEach((side) => {
      // A triangular prism lying along the face, its slope leaning back from the base to the core.
      const prism = new THREE.ExtrudeGeometry(wedge, { depth: 97, bevelEnabled: false });
      prism.rotateY(-Math.PI / 2);
      prism.translate(side < 0 ? -23 : 120, 0, 0);
      put(batches, slope, prism, face(k, local(0, -60, 150)));
      [0.3, 0.68].forEach((t) => {
        const along = side * (23 + 97 * t);
        put(batches, groove, new THREE.BoxGeometry(6, length, 0.8), face(k, local(along, 1, 150 + OUT / 2 + 0.5, 0, -lean)));
      });
    });
    // Lit slits up the spine.
    put(batches, warm, new THREE.BoxGeometry(3, 110, 0.4), face(k, local(0, 4, 190.3)));
  }
  // The grand stair down the front of the podium, towards the pad.
  for (let i = 0; i < 12; i++) put(batches, stone, new THREE.BoxGeometry(64 - i * 2, 6, 10), face(0, local(0, -63 - i * 6, 206 + i * 8)));
  // The roof: a raised terrace the spires stand on.
  put(batches, stone, new THREE.BoxGeometry(236, 8, 236), at(x, TEMPLE_ROOF - 4, z));
  put(batches, warm, new THREE.BoxGeometry(237, 0.6, 237), at(x, TEMPLE_ROOF - 2.5, z));

  // Spires: slim shafts with a swelling near the top, then a long cone. The Council's spire stops
  // at the chamber floor; the chamber and its bronze cap are its crown.
  SPIRES.forEach(({ dx, dz, r, top }, i) => {
    const council = i === 1;
    const H = top - TEMPLE_ROOF;
    const profile: [number, number][] = council
      ? [
          [r, TEMPLE_ROOF],
          [r * 0.95, TEMPLE_ROOF + 24],
          [r * 0.88, 140],
          [r * 0.92, COUNCIL_FLOOR - 4],
          [r * 0.96, COUNCIL_FLOOR - 0.2],
          [0, COUNCIL_FLOOR - 0.1],
        ]
      : [
          [r * 1.08, TEMPLE_ROOF],
          [r * 0.86, TEMPLE_ROOF + 8],
          [r * 0.78, TEMPLE_ROOF + H * 0.72],
          [r * 0.96, TEMPLE_ROOF + H * 0.75],
          [r * 0.96, TEMPLE_ROOF + H * 0.86],
          [r * 0.62, TEMPLE_ROOF + H * 0.9],
          [r * 0.24, TEMPLE_ROOF + H * 0.97],
          [0, top],
        ];
    put(batches, spireStone, lathe(profile), at(x + dx, 0, z + dz));
    // Bands round the shaft.
    (council ? [96, 124, 150] : [TEMPLE_ROOF + H * 0.2, TEMPLE_ROOF + H * 0.4, TEMPLE_ROOF + H * 0.65]).forEach((y) =>
      put(batches, bronze, new THREE.TorusGeometry(r * (council ? 0.94 : 0.98) + 0.4, 0.5, 6, 40).rotateX(Math.PI / 2), at(x + dx, y, z + dz)),
    );
    // Vertical ribs.
    const ribs = council ? COUNCIL_FLOOR - TEMPLE_ROOF - 6 : H * 0.42;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      put(batches, spireStone, new THREE.BoxGeometry(0.8, ribs, 1.4), at(x + dx + Math.cos(a) * (r * 0.92), TEMPLE_ROOF + ribs / 2, z + dz + Math.sin(a) * (r * 0.92), -a));
    }
  });
  // Above the Council chamber: a bronze cap and the needle.
  const needle = lathe([
    [10.9, 0],
    [10.2, 1.6],
    [8.2, 3.4],
    [4.2, 6],
    [2.2, 12],
    [0.5, 40],
    [0, 46],
  ]);
  put(batches, bronze, needle, at(COUNCIL.x, COUNCIL_FLOOR + 9.6, COUNCIL.z));

  // The platform: a disc on a bracket, joined to the chamber door by a bridge.
  const platform = new THREE.Group();
  const facing = Math.atan2(COUNCIL_FACING.x, COUNCIL_FACING.z);
  platform.position.set(COUNCIL.x, COUNCIL_FLOOR, COUNCIL.z);
  platform.rotation.y = facing;
  const deck = new THREE.MeshStandardMaterial({ color: 0xcab79a, roughness: 0.62, metalness: 0.12 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(7.6, 7.2, 0.8, 48), deck);
  disc.position.set(0, -0.4, 25.5);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.6, 9), deck);
  bridge.position.set(0, -0.3, 14.4);
  const bracket = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 0.6, 14, 24), spireStone);
  bracket.position.set(0, -7.6, 25.5);
  const strut = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 15), spireStone);
  strut.position.set(0, -4.5, 18);
  strut.rotation.x = -0.32;
  platform.add(disc, bridge, bracket, strut);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(7.45, 0.06, 6, 96), warm);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, 0.02, 25.5);
  platform.add(rim);
  [-1, 1].forEach((side) => {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 8.6), warm);
    edge.position.set(side * 1.75, 0.02, 14.4);
    platform.add(edge);
  });
  const lamps: THREE.Sprite[] = [];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffc27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    lamp.position.set(Math.sin(a) * 6.9, 0.1, 25.5 + Math.cos(a) * 6.9);
    lamp.scale.setScalar(0.5);
    platform.add(lamp);
    lamps.push(lamp);
  }
  group.add(platform);
  // Beacons on every spire tip.
  SPIRES.forEach(({ dx, dz, top }) => {
    const tip = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffd9a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    tip.position.set(x + dx, top + 1, z + dz);
    tip.scale.setScalar(8);
    group.add(tip);
  });
  flush(batches, group);
  let chase = 0;
  return {
    group,
    tick: (dt: number, reduced: boolean) => {
      chase += reduced ? 0 : dt * 6;
      lamps.forEach((lamp, k) => (lamp.material.opacity = reduced ? 0.8 : 0.35 + 0.65 * Math.max(0, 1 - ((((chase - k) % 16) + 16) % 16) / 4)));
    },
  };
}

// A robed figure of stone for the plaza, facing +Z.
function statue(height: number) {
  const s = height / 26;
  const robe = lathe(
    [
      [3.4, 0],
      [3.2, 2],
      [2.5, 9],
      [2.2, 15],
      [2.7, 18.5],
      [2.4, 20],
      [1.0, 21],
      [0, 21.2],
    ].map(([r, y]) => [r * s, y * s]) as [number, number][],
    20,
  );
  const head = new THREE.SphereGeometry(1.4 * s, 16, 12);
  head.translate(0, 22.4 * s, 0.35 * s);
  // A hood falling onto broad shoulders, so the figure reads as robed rather than turned.
  const hood = new THREE.ConeGeometry(2.6 * s, 5.4 * s, 18, 1, true);
  hood.translate(0, 21.6 * s, -0.25 * s);
  const mantle = new THREE.SphereGeometry(3.1 * s, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.45);
  mantle.scale(1, 0.7, 0.8);
  mantle.translate(0, 18.6 * s, 0);
  const arm = new THREE.CylinderGeometry(0.7 * s, 0.6 * s, 7 * s, 10);
  arm.rotateX(-1.1);
  arm.translate(1.9 * s, 15.2 * s, 2.6 * s);
  const staff = new THREE.CylinderGeometry(0.28 * s, 0.28 * s, 24 * s, 8);
  staff.translate(2.6 * s, 12 * s, 5 * s);
  const plinth = new THREE.BoxGeometry(8.4 * s, 4 * s, 8.4 * s);
  plinth.translate(0, -2 * s, 0);
  return [robe, head, hood, mantle, arm, staff, plinth].map((geometry) => (geometry.index ? geometry.toNonIndexed() : geometry));
}

// Rows of lit windows for the Senate's drum, on a transparent ground.
function windowBand() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const c = canvas.getContext("2d")!;
  let s = 71;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let row = 0; row < 14; row++)
    for (let col = 0; col < 96; col++) {
      if (rand() < 0.35) continue;
      const tint = rand();
      c.fillStyle = tint < 0.55 ? "rgba(214,240,214,.85)" : tint < 0.85 ? "rgba(255,214,150,.85)" : "rgba(150,210,255,.8)";
      c.fillRect(col * 10.6 + 2, row * 18 + 4, 6, 10);
    }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(6, 1);
  return texture;
}
// The crown of trapezoid lights round the top of the drum, under the overhang.
function crownBand() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 64;
  const c = canvas.getContext("2d")!;
  for (let i = 0; i < 8; i++) {
    const x = i * 64;
    const g = c.createLinearGradient(0, 6, 0, 58);
    g.addColorStop(0, "rgba(255,236,200,.95)");
    g.addColorStop(1, "rgba(255,190,120,.35)");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x + 14, 8);
    c.lineTo(x + 50, 8);
    c.lineTo(x + 58, 56);
    c.lineTo(x + 6, 56);
    c.closePath();
    c.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(10, 1);
  return texture;
}

export function createSenate(glow: THREE.Texture) {
  const group = new THREE.Group();
  group.name = "galactic-senate";
  const shellMap = stoneTexture("#9aa1aa", "rgba(40,46,58,.35)", "rgba(0,0,0,0)", 41);
  shellMap.repeat.set(24, 3);
  const shell = new THREE.MeshStandardMaterial({ color: 0xb2b8c0, map: shellMap, roughness: 0.48, metalness: 0.45, emissive: 0x1a2232, emissiveIntensity: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3b4350, roughness: 0.5, metalness: 0.6 });
  const pale = new THREE.MeshStandardMaterial({ color: 0xd8d2c6, roughness: 0.7, metalness: 0.05, emissive: 0x2a2018, emissiveIntensity: 0.25 });
  const tileMap = stoneTexture("#9aa0aa", "rgba(40,46,58,.5)", "rgba(0,0,0,0)", 7);
  tileMap.repeat.set(4, 12);
  const paving = new THREE.MeshStandardMaterial({ color: 0xb6bcc6, map: tileMap, roughness: 0.55, metalness: 0.2 });
  const cool = new THREE.MeshBasicMaterial({ color: 0xcfe6ff, toneMapped: false });
  const warm = new THREE.MeshBasicMaterial({ color: 0xffcf8a, toneMapped: false });
  const lit = (map: THREE.Texture) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const batches: Batches = new Map();
  const { x, z } = SENATE;
  const D = SENATE_DRUM,
    R = SENATE_RIM;
  const facing = Math.atan2(SENATE_FACING.x, SENATE_FACING.z);

  // The drum, the shallow underside of the saucer, its rim, and the flat dome.
  put(
    batches,
    shell,
    lathe(
      [
        [96, -420],
        [88, -200],
        [D + 4, -70],
        [D, -40],
        [D, 56],
        [D + 6, 58],
        [100, 59.6],
        [120, 61.6],
        [R, 63.5],
        [R + 2.2, 67.5],
        [R, 71.5],
        [128, 75],
        [110, 82],
        [82, 89],
        [46, 95.5],
        [0, 98],
      ],
      128,
    ),
    at(x, 0, z),
  );
  // Windows up the drum, the crown of lights under the overhang, rings of light round the saucer.
  put(batches, lit(windowBand()), new THREE.CylinderGeometry(D + 0.35, D + 0.35, 42, 128, 1, true), at(x, 27, z));
  put(batches, lit(crownBand()), new THREE.CylinderGeometry(D + 0.4, D + 0.4, 5, 128, 1, true), at(x, 51.5, z));
  put(batches, cool, new THREE.TorusGeometry(R + 2.3, 0.35, 6, 192).rotateX(Math.PI / 2), at(x, 67.5, z));
  put(batches, warm, new THREE.TorusGeometry(112, 0.3, 6, 160).rotateX(Math.PI / 2), at(x, 60.4, z));
  put(batches, cool, new THREE.TorusGeometry(92, 0.25, 6, 160).rotateX(Math.PI / 2), at(x, 58.9, z));
  put(batches, dark, new THREE.TorusGeometry(D + 0.6, 0.8, 6, 128).rotateX(Math.PI / 2), at(x, 55.6, z));
  // Buttresses leaning out from the drum, from the plaza to the overhang.
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const strut = new THREE.BoxGeometry(3.4, 58, 4);
    strut.rotateX(0.16);
    put(batches, dark, strut, at(x + Math.sin(a) * (D + 3.4), 28, z + Math.cos(a) * (D + 3.4), a));
  }
  // The esplanade the Senate stands on, hiding the shaft below; the walkway runs across it.
  const deckMap = stoneTexture("#aab0b9", "rgba(40,46,58,.4)", "rgba(0,0,0,0)", 13);
  deckMap.repeat.set(28, 28);
  put(
    batches,
    new THREE.MeshStandardMaterial({ color: 0xc4cad2, map: deckMap, roughness: 0.55, metalness: 0.2, emissive: 0x1d2430, emissiveIntensity: 0.6 }),
    new THREE.CylinderGeometry(ESPLANADE, ESPLANADE, 8, 128),
    at(x, -3.5, z),
  );
  put(batches, shell, new THREE.CylinderGeometry(ESPLANADE - 30, ESPLANADE, 413, 96, 1, true), at(x, -213.5, z));
  put(batches, lit(windowBand()), new THREE.CylinderGeometry(ESPLANADE + 0.3, ESPLANADE + 0.3, 7, 160, 1, true), at(x, -3.6, z));
  put(batches, warm, new THREE.TorusGeometry(ESPLANADE, 0.35, 6, 256).rotateX(Math.PI / 2), at(x, 0.6, z));
  // Rings and spokes of light across the esplanade, and low pavilions round its edge.
  [118, 160].forEach((r, i) => put(batches, i ? cool : warm, new THREE.TorusGeometry(r, 0.25, 6, 192).rotateX(Math.PI / 2), at(x, 0.58, z)));
  const clear = (a: number) => Math.abs(Math.atan2(Math.sin(a - facing), Math.cos(a - facing))) > 0.3;
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    if (!clear(a)) continue;
    const spoke = new THREE.BoxGeometry(0.4, 0.1, ESPLANADE - D - 14);
    put(batches, warm, spoke, at(x + Math.sin(a) * (ESPLANADE + D) / 2, 0.56, z + Math.cos(a) * (ESPLANADE + D) / 2, a));
  }
  for (let k = 0; k < 14; k++) {
    const a = ((k + 0.5) / 14) * Math.PI * 2;
    if (!clear(a)) continue;
    const pavilion = new THREE.SphereGeometry(7, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    pavilion.scale(1, 0.55, 1);
    put(batches, shell, pavilion, at(x + Math.sin(a) * 140, 0.5, z + Math.cos(a) * 140));
    put(batches, cool, new THREE.TorusGeometry(7.05, 0.18, 6, 48).rotateX(Math.PI / 2), at(x + Math.sin(a) * 140, 1.2, z + Math.cos(a) * 140));
  }

  // The plaza: a long deck from the drum's doors out past the saucer's edge, on a pylon.
  const length = PLAZA.to - PLAZA.from,
    middle = (PLAZA.to + PLAZA.from) / 2;
  const placement = (lateral: number, distance: number, y: number, yaw = facing) =>
    at(x + SENATE_FACING.x * distance + Math.cos(facing) * lateral, y, z + SENATE_FACING.z * distance - Math.sin(facing) * lateral, yaw);
  put(batches, paving, new THREE.BoxGeometry(PLAZA.half * 2 + 8, 4, length), placement(0, middle, PLAZA.top - 2));
  put(batches, shell, new THREE.CylinderGeometry(9, 14, 420, 24), placement(0, PLAZA.to - 18, PLAZA.top - 212));
  [-1, 1].forEach((side) => put(batches, warm, new THREE.BoxGeometry(0.2, 0.12, length), placement(side * (PLAZA.half + 3.9), middle, PLAZA.top + 0.06)));
  put(batches, warm, new THREE.BoxGeometry(PLAZA.half * 2 + 8, 0.12, 0.2), placement(0, PLAZA.to - 0.1, PLAZA.top + 0.06));
  // Three lit doorways at the foot of the drum.
  [
    [0, 14, 12],
    [-21, 8, 9],
    [21, 8, 9],
  ].forEach(([lateral, width, height]) => {
    put(batches, warm, new THREE.PlaneGeometry(width, height), placement(lateral, D + 0.6, PLAZA.top + height / 2));
    [-1, 1].forEach((side) => put(batches, dark, new THREE.BoxGeometry(1.6, height + 2, 2), placement(lateral + side * (width / 2 + 0.8), D + 0.8, PLAZA.top + height / 2 + 1)));
  });
  // Slender statues on pedestals, a long row each side.
  const s = 11 / 26;
  for (let distance = 94; distance <= PLAZA.to - 6; distance += 12)
    [-1, 1].forEach((side) => {
      const yaw = facing - side * (Math.PI / 2);
      statue(11).forEach((geometry) => put(batches, pale, geometry, placement(side * (PLAZA.half + 1.5), distance, PLAZA.top + 4 * s, yaw)));
    });
  // Two tall masts framing the approach, rising past the dome.
  [-1, 1].forEach((side) => {
    put(batches, dark, new THREE.CylinderGeometry(2.2, 3.2, 176, 16), placement(side * 27, SENATE_STOP, 68));
    [56, 76, 98, 124, 144].forEach((y) => put(batches, shell, new THREE.CylinderGeometry(3.4, 3.4, 2.4, 16), placement(side * 27, SENATE_STOP, y)));
    put(batches, shell, new THREE.CylinderGeometry(4.6, 3.6, 7, 16), placement(side * 27, SENATE_STOP, 66));
  });
  flush(batches, group);
  [-1, 1].forEach((side) => {
    const tip = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffe2b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    tip.position.setFromMatrixPosition(placement(side * 27, SENATE_STOP, 158));
    tip.scale.setScalar(7);
    group.add(tip);
  });
  const portal = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffd39a, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  portal.position.setFromMatrixPosition(placement(0, D + 3, PLAZA.top + 6));
  portal.scale.set(30, 16, 1);
  group.add(portal);
  // Lamps along both sides of the walkway, out to the landing spot.
  for (let distance = PLAZA.from + 8; distance < PLAZA.to; distance += 9)
    [-1, 1].forEach((side) => {
      const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffd39a, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
      lamp.position.setFromMatrixPosition(placement(side * (PLAZA.half - 2.5), distance, PLAZA.top + 0.5));
      lamp.scale.setScalar(1.6);
      group.add(lamp);
    });
  return { group };
}
