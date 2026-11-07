import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type HyperspacePhase = "arrive" | "jump";
type Obstacle = { position: THREE.Vector3; radius: number };
type Vec3 = [number, number, number];

const ARRIVAL = 0.6,
  CHARGE = 0.45,
  STRETCH = 0.32;

function random(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const axisToZ = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  Math.PI / 2,
);
// Scale applies in the primitive's own axes, before alongZ turns its Y axis into the bow.
function part(
  geometry: THREE.BufferGeometry,
  position: Vec3,
  options: { scale?: Vec3; rotation?: Vec3; alongZ?: boolean } = {},
) {
  const rotation = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(...(options.rotation ?? [0, 0, 0])),
  );
  if (options.alongZ) rotation.multiply(axisToZ);
  return geometry.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      rotation,
      new THREE.Vector3(...(options.scale ?? [1, 1, 1])),
    ),
  );
}
function lathe(profile: [number, number][], segments: number) {
  return new THREE.LatheGeometry(
    profile.map(([radius, height]) => new THREE.Vector2(radius, height)),
    segments,
  );
}
// Half a dagger hull: a flat base and a spine rising from the bow to the stern.
function wedge(nose: number, stern: number, half: number, rise: number, base: number) {
  const bow = [0, base, nose],
    port = [-half, base, -stern],
    starboard = [half, base, -stern],
    spine = [0, base + rise, -stern];
  const faces = [
    [bow, spine, port],
    [bow, starboard, spine],
    [port, spine, starboard],
    [bow, port, starboard],
  ].map((face) => (rise > 0 ? face : [face[0], face[2], face[1]]));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(faces.flat(2), 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}
// Merge parts into one draw call, with panels projected from above on every part.
function bake(geometries: THREE.BufferGeometry[]) {
  const prepared = geometries.map((geometry) => {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    for (const name of Object.keys(flat.attributes))
      if (name !== "position" && name !== "normal") flat.deleteAttribute(name);
    if (!flat.getAttribute("normal")) flat.computeVertexNormals();
    return flat;
  });
  const merged = mergeGeometries(prepared, false);
  prepared.forEach((geometry) => geometry.dispose());
  if (!merged) return null;
  const position = merged.getAttribute("position");
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    uv[i * 2] = position.getX(i) * 0.16;
    uv[i * 2 + 1] = position.getZ(i) * 0.16;
  }
  merged.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return merged;
}
function platingTexture(seed: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!,
    rand = random(seed);
  ctx.fillStyle = "#b4b9be";
  ctx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 16; row++) {
    let x = -rand() * 20;
    while (x < 256) {
      const width = 8 + Math.floor(rand() * 34),
        tone = 150 + Math.floor(rand() * 70);
      ctx.fillStyle = `rgb(${tone - 2},${tone + 2},${tone + 7})`;
      ctx.fillRect(x + 1, row * 16 + 1, width - 1, 15);
      if (rand() > 0.7) {
        ctx.fillStyle = "#666d75";
        ctx.fillRect(x + 2, row * 16 + 4, width * 0.6, 3);
      }
      x += width;
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}
function glowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!,
    gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.2, "rgba(255,255,255,.8)");
  gradient.addColorStop(0.5, "rgba(255,255,255,.2)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

type Hull = {
  plating: THREE.BufferGeometry[];
  machinery: THREE.BufferGeometry[];
  windows: THREE.BufferGeometry[];
  thrusters: THREE.BufferGeometry[];
  engines: { position: Vec3; size: number }[];
  engineColor: number;
  hullColor: number;
  chrome?: boolean;
  nose: number;
  tail: number;
};

// A dagger-shaped capital ship: stepped decks, a T-shaped command tower with twin domes.
function destroyerHull(): Hull {
  const rand = random(1983);
  const nose = 8,
    stern = 6,
    half = 4.2,
    rise = 1,
    drop = 0.7;
  const deck = (z: number) => 0.12 + (rise * (nose - z)) / (nose + stern);
  const tower = deck(-3.6);
  const trench = new THREE.ExtrudeGeometry(
    new THREE.Shape([
      new THREE.Vector2(0, -nose * 0.985),
      new THREE.Vector2(-half * 0.985, stern * 0.99),
      new THREE.Vector2(half * 0.985, stern * 0.99),
    ]),
    { depth: 0.24, bevelEnabled: false },
  )
    .rotateX(-Math.PI / 2)
    .translate(0, -0.12, 0);
  const greebles = Array.from({ length: 170 }, () => {
    const side = rand() < 0.5 ? -1 : 1;
    let u = rand(),
      v = rand();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const height = 0.03 + rand() * 0.1;
    return part(
      new THREE.BoxGeometry(0.08 + rand() * 0.3, height, 0.1 + rand() * 0.45),
      [
        v * side * half,
        0.12 + u * rise + height * 0.3,
        nose - (u + v) * (nose + stern),
      ],
    );
  });
  const edgeLights = [-1, 1].flatMap((side) =>
    Array.from({ length: 34 }, (_, i) => i)
      .filter(() => rand() > 0.3)
      .map((i) => {
        const t = 0.06 + (i / 33) * 0.9;
        return part(
          new THREE.BoxGeometry(0.05, 0.04, 0.14),
          [side * half * 0.985 * t + side * 0.012, 0, nose * 0.985 * (1 - t) - stern * 0.99 * t],
          { rotation: [0, Math.atan2(side * half, -(nose + stern)), 0] },
        );
      }),
  );
  const rowLights = (count: number, width: number, y: number, z: number) =>
    Array.from({ length: count }, (_, i) => i)
      .filter(() => rand() > 0.25)
      .map((i) =>
        part(new THREE.BoxGeometry(0.06, 0.04, 0.03), [
          -width / 2 + (i / (count - 1)) * width,
          y,
          z,
        ]),
      );
  return {
    plating: [
      wedge(nose, stern, half, rise, 0.12),
      wedge(nose, stern, half, -drop, -0.12),
      part(new THREE.BoxGeometry(0.34, 0.12, 6.5), [0, deck(1.2) + 0.03, 1.2], {
        rotation: [Math.atan(rise / (nose + stern)), 0, 0],
      }),
      // Each tier reaches down into the sloping deck so no edge floats above it.
      part(new THREE.BoxGeometry(3.2, 0.75, 3.8), [0, tower - 0.15, -3.6]),
      part(new THREE.BoxGeometry(2.4, 0.36, 2.8), [0, tower + 0.4, -4]),
      part(new THREE.BoxGeometry(1.6, 0.3, 2), [0, tower + 0.7, -4.4]),
      ...[-1, 1].map((side) =>
        part(new THREE.BoxGeometry(0.9, 0.6, 2.2), [side * 1.9, tower - 0.3, -3.9]),
      ),
      part(new THREE.BoxGeometry(0.42, 0.9, 0.55), [0, tower + 1.25, -4.75]),
      part(new THREE.BoxGeometry(2.4, 0.3, 0.7), [0, tower + 1.62, -4.75]),
      part(new THREE.BoxGeometry(0.9, 0.16, 0.45), [0, tower + 1.84, -4.8]),
      ...[-1, 1].map((side) =>
        part(new THREE.SphereGeometry(0.24, 14, 10), [side * 1, tower + 1.92, -4.75]),
      ),
      ...greebles,
    ],
    machinery: [
      trench,
      part(new THREE.BoxGeometry(3.4, 0.9, 0.5), [0, 0.1, -stern - 0.2]),
      ...[-1.1, 0, 1.1].map((x) =>
        part(new THREE.CylinderGeometry(x ? 0.3 : 0.36, 0.38, 0.4, 14), [x, 0.15, -stern - 0.6], {
          alongZ: true,
        }),
      ),
      ...[-2, 2].map((x) =>
        part(new THREE.CylinderGeometry(0.2, 0.24, 0.3, 12), [x, 0.05, -stern - 0.5], {
          alongZ: true,
        }),
      ),
    ],
    windows: [
      ...edgeLights,
      ...rowLights(15, 2.8, tower + 0.05, -1.69),
      ...rowLights(9, 2.1, tower + 0.4, -2.59),
      ...rowLights(8, 2.1, tower + 1.62, -4.39),
    ],
    thrusters: [],
    engines: [
      { position: [0, 0.15, -stern - 0.85], size: 1.35 },
      { position: [-1.1, 0.15, -stern - 0.85], size: 1.1 },
      { position: [1.1, 0.15, -stern - 0.85], size: 1.1 },
      { position: [-2, 0.05, -stern - 0.7], size: 0.7 },
      { position: [2, 0.05, -stern - 0.7], size: 0.7 },
    ],
    engineColor: 0xa8d4ff,
    hullColor: 0xdfe4ec,
    nose,
    tail: stern + 0.85,
  };
}

// A battered disc freighter: twin forward mandibles, an offset cockpit and a glowing stern.
function freighterHull(): Hull {
  const rand = random(1977);
  const radius = 2.05;
  const surface = (r: number) => 0.4 * (1 - Math.pow(r / radius, 1.6));
  const arc = 2.3,
    centre = arc / 2;
  const greebles = Array.from({ length: 60 }, () => {
    const r = 0.65 + rand() * 1.2,
      angle = rand() * Math.PI * 2,
      height = 0.03 + rand() * 0.07;
    return part(
      new THREE.BoxGeometry(0.1 + rand() * 0.25, height, 0.1 + rand() * 0.3),
      [Math.cos(angle) * r, surface(r) + height * 0.3, Math.sin(angle) * r],
      { rotation: [0, -angle, 0] },
    );
  });
  return {
    plating: [
      lathe(
        [
          [0.001, 0.42],
          [0.7, 0.38],
          [1.7, 0.16],
          [radius, 0.05],
          [radius + 0.03, -0.05],
          [1.7, -0.14],
          [0.7, -0.3],
          [0.001, -0.34],
        ],
        48,
      ),
      ...[-1, 1].map((side) =>
        part(new THREE.BoxGeometry(0.62, 0.22, 1.7), [side * 0.62, 0.02, 2.35]),
      ),
      part(new THREE.BoxGeometry(0.34, 0.22, 0.9), [-1.62, 0.02, 1.05], {
        rotation: [0, 0.5, 0],
      }),
      part(new THREE.CylinderGeometry(0.2, 0.22, 0.9, 14), [-1.95, 0.02, 1.4], {
        alongZ: true,
      }),
      part(new THREE.CylinderGeometry(0.55, 0.6, 0.16, 24), [0, 0.43, 0]),
      part(new THREE.CylinderGeometry(0.18, 0.2, 0.14, 14), [0, 0.56, 0]),
      part(
        lathe(
          [
            [0.001, -0.06],
            [0.24, -0.04],
            [0.42, 0.06],
          ],
          20,
        ),
        [0.75, 0.48, -0.25],
        { rotation: [-0.45, 0, 0.3] },
      ),
      ...greebles,
    ],
    machinery: [
      part(new THREE.BoxGeometry(0.5, 0.12, 1.3), [0, 0.02, 1.95]),
      part(new THREE.CylinderGeometry(0.07, 0.09, 0.22, 10), [0.75, 0.38, -0.25]),
      part(new THREE.SphereGeometry(0.2, 14, 10), [-1.95, 0.02, 1.86], {
        scale: [1, 1, 0.8],
      }),
      ...[-1, 1].map((side) =>
        part(new THREE.BoxGeometry(0.05, 0.05, 0.4), [side * 0.08, 0.66, 0.2]),
      ),
    ],
    windows: [
      ...[-0.1, 0, 0.1].map((x) =>
        part(new THREE.BoxGeometry(0.06, 0.04, 0.03), [-1.95 + x, 0.1, 2.04]),
      ),
    ],
    thrusters: [
      new THREE.TorusGeometry(radius - 0.02, 0.05, 6, 48, arc)
        .rotateX(Math.PI / 2)
        .rotateY(centre + Math.PI / 2),
    ],
    engines: Array.from({ length: 5 }, (_, i) => {
      const angle = -Math.PI / 2 + (i / 4 - 0.5) * arc * 0.9;
      return {
        position: [Math.cos(angle) * (radius + 0.05), 0, Math.sin(angle) * (radius + 0.05)],
        size: 0.55,
      };
    }),
    engineColor: 0xc4e6ff,
    hullColor: 0xc4c6bd,
    nose: 3.2,
    tail: radius + 0.1,
  };
}

// A polished silver interceptor: needle bow, swept arms and two spiked engine nacelles.
function fighterHull(): Hull {
  return {
    plating: [
      part(
        lathe(
          [
            [0.001, -1.7],
            [0.26, -1.6],
            [0.32, -1],
            [0.3, -0.2],
            [0.22, 0.5],
            [0.12, 1.2],
            [0.07, 1.9],
            [0.03, 2.6],
            [0.001, 3.1],
          ],
          20,
        ),
        [0, 0, 0],
        { alongZ: true, scale: [1, 1, 0.75] },
      ),
      part(new THREE.SphereGeometry(0.13, 12, 8), [0, 0.28, -0.75]),
      ...[-1, 1].flatMap((side) => [
        part(new THREE.BoxGeometry(1.3, 0.05, 0.55), [side * 0.8, -0.02, -0.9], {
          rotation: [0, side * 0.25, 0],
        }),
        part(new THREE.CylinderGeometry(0.22, 0.22, 1.4, 16), [side * 1.45, 0, -1], {
          alongZ: true,
        }),
        part(new THREE.ConeGeometry(0.1, 1.2, 12), [side * 1.45, 0, 0.3], {
          alongZ: true,
        }),
        part(new THREE.BoxGeometry(0.04, 0.04, 0.9), [side * 1.45, -0.26, -0.9]),
      ]),
    ],
    machinery: [
      part(new THREE.SphereGeometry(0.24, 16, 10), [0, 0.2, -0.1], {
        scale: [0.9, 0.7, 1.6],
      }),
      ...[-1, 1].map((side) =>
        part(new THREE.CylinderGeometry(0.17, 0.2, 0.18, 16), [side * 1.45, 0, -1.78], {
          alongZ: true,
        }),
      ),
    ],
    windows: [-1, 1].flatMap((side) =>
      [0.1, 0.32, 0.54].map((z) =>
        part(new THREE.BoxGeometry(0.03, 0.02, 0.14), [side * 0.29, 0.06, z - 0.6]),
      ),
    ),
    thrusters: [],
    engines: [
      { position: [-1.45, 0, -1.95], size: 0.6 },
      { position: [1.45, 0, -1.95], size: 0.6 },
    ],
    engineColor: 0xffb27a,
    hullColor: 0xdfe2e4,
    chrome: true,
    nose: 3.1,
    tail: 1.95,
  };
}

type Vessel = {
  root: THREE.Group;
  body: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  engines: { sprite: THREE.Sprite; size: number }[];
  nose: number;
  tail: number;
  arriveAt: number;
  jumpAt: number;
  landed: boolean;
  gone: boolean;
};
function buildVessel(
  hull: Hull,
  glow: THREE.Texture,
  plating: THREE.Texture,
  reflections: THREE.Texture,
  offset: Vec3,
) {
  const root = new THREE.Group(),
    body = new THREE.Group();
  root.position.set(...offset);
  root.add(body);
  const shell = new THREE.MeshStandardMaterial({
      color: hull.hullColor,
      emissive: 0x8ec4ff,
      emissiveIntensity: 0,
      ...(hull.chrome
        ? { metalness: 0.9, roughness: 0.26, envMap: reflections }
        : { map: plating, metalness: 0.3, roughness: 0.76, flatShading: true }),
    }),
    machinery = new THREE.MeshStandardMaterial({
      color: 0x474e4b,
      roughness: 0.6,
      metalness: 0.5,
      emissive: 0x8ec4ff,
      emissiveIntensity: 0,
      flatShading: true,
    });
  (
    [
      [hull.plating, shell],
      [hull.machinery, machinery],
      [hull.windows, new THREE.MeshBasicMaterial({ color: 0xffe3b8 })],
      [hull.thrusters, new THREE.MeshBasicMaterial({ color: hull.engineColor })],
    ] as const
  ).forEach(([geometries, material]) => {
    const merged = geometries.length ? bake([...geometries]) : null;
    if (merged) body.add(new THREE.Mesh(merged, material));
    else material.dispose();
  });
  const engines = hull.engines.map(({ position, size }) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glow,
        color: hull.engineColor,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    sprite.position.set(...position);
    body.add(sprite);
    return { sprite, size };
  });
  return {
    root,
    body,
    materials: [shell, machinery],
    engines,
    nose: hull.nose,
    tail: hull.tail,
  };
}

type Plan = {
  vessels: { hull: () => Hull; offset: Vec3; arriveAt: number; jumpAt: number }[];
  cruise: number;
  // Where the bow lands and how far it drifts, in half-widths of the view.
  entry: number;
  travel: number;
  lane: [number, number];
  approach: number | null;
  // Roll towards the viewer, so decks read in a three-quarter view.
  bank: number;
  size: number;
};
const plans: Plan[] = [
  {
    vessels: [{ hull: destroyerHull, offset: [0, 0, 0], arriveAt: 0, jumpAt: 0 }],
    cruise: 11,
    entry: 0.4,
    travel: 0.6,
    lane: [0.02, 0.12],
    approach: -0.4,
    bank: 0.5,
    size: 1.25,
  },
  {
    vessels: [{ hull: freighterHull, offset: [0, 0, 0], arriveAt: 0, jumpAt: 0 }],
    cruise: 6.5,
    entry: 0.75,
    travel: 1.3,
    lane: [0.05, 0.3],
    approach: null,
    bank: 0.75,
    size: 1.3,
  },
  {
    vessels: [{ hull: fighterHull, offset: [0, 0, 0], arriveAt: 0, jumpAt: 0 }],
    cruise: 5,
    entry: 0.8,
    travel: 1.4,
    lane: [0.15, 0.42],
    approach: null,
    bank: 0.3,
    size: 1.25,
  },
];

// Ships drop out of hyperspace, cross the view, then jump away. Passes are galactic events now: the
// director decides when one happens, so that it never runs over another event, and asks for it.
export type TrafficKind = "destroyer" | "freighter" | "fighter";
const KINDS: TrafficKind[] = ["destroyer", "freighter", "fighter"];
export function createSpaceTraffic(
  renderer: THREE.WebGLRenderer,
  onPhase: (phase: HyperspacePhase) => void,
) {
  const group = new THREE.Group();
  const glow = glowTexture(),
    plating = platingTexture(1138);
  const pmrem = new THREE.PMREMGenerator(renderer),
    room = new RoomEnvironment();
  const reflections = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  const flights = plans.map((plan) => {
    const formation = new THREE.Group();
    const vessels: Vessel[] = plan.vessels.map(({ hull, offset, arriveAt, jumpAt }) => {
      const vessel = {
        ...buildVessel(hull(), glow, plating, reflections, offset),
        arriveAt,
        jumpAt: plan.cruise + jumpAt,
        landed: false,
        gone: false,
      };
      formation.add(vessel.root);
      return vessel;
    });
    const extent = new THREE.Box3()
      .setFromObject(formation)
      .getBoundingSphere(new THREE.Sphere()).radius;
    formation.visible = false;
    group.add(formation);
    return { formation, vessels, plan, extent };
  });
  const flashes = Array.from({ length: 3 }, () => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glow,
        color: 0xe6f2ff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    sprite.visible = false;
    group.add(sprite);
    return { sprite, age: 0, peak: 1 };
  });
  const flash = (at: THREE.Vector3, peak: number) => {
    const item = flashes.find((candidate) => !candidate.sprite.visible);
    if (!item) return;
    item.sprite.position.copy(at);
    item.age = 0;
    item.peak = peak;
    item.sprite.visible = true;
  };
  const start = new THREE.Vector3(),
    direction = new THREE.Vector3(),
    forward = new THREE.Vector3(),
    right = new THREE.Vector3(),
    up = new THREE.Vector3(),
    probe = new THREE.Vector3(),
    segment = new THREE.Line3(),
    nosePoint = new THREE.Vector3();
  let queued: number | null = null,
    flight: (typeof flights)[number] | null = null,
    clock = -1,
    scale = 1,
    speed = 0,
    jumpAnnounced = false;
  const finish = () => {
    clock = -1;
    if (flight) flight.formation.visible = false;
    flight = null;
  };
  const launch = (camera: THREE.PerspectiveCamera, obstacles: Obstacle[], index: number) => {
    const current = flights[index],
      plan = current.plan;
    forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // Pass in front of any world that fills the view, keeping a constant on-screen size.
    const nominal = THREE.MathUtils.clamp(26 / (tanHalf * camera.aspect), 40, 90);
    let depth = nominal;
    obstacles.forEach(({ position, radius }) => {
      probe.copy(position).project(camera);
      if (probe.z < 1 && Math.abs(probe.x) < 1.3 && Math.abs(probe.y) < 1.3)
        depth = Math.min(
          depth,
          Math.max(18, camera.position.distanceTo(position) - radius - 8),
        );
    });
    scale = (depth / nominal) * (camera.aspect < 0.8 ? 0.7 : 1) * plan.size;
    const halfHeight = depth * tanHalf,
      halfWidth = halfHeight * camera.aspect;
    for (let attempt = 0; attempt < 8; attempt++) {
      const from = Math.random() < 0.5 ? -1 : 1;
      const lane = THREE.MathUtils.lerp(plan.lane[0], plan.lane[1], Math.random());
      start
        .copy(camera.position)
        .addScaledVector(forward, depth)
        .addScaledVector(right, from * plan.entry * halfWidth)
        .addScaledVector(up, lane * halfHeight);
      direction
        .copy(right)
        .multiplyScalar(-from)
        .addScaledVector(forward, plan.approach ?? (Math.random() - 0.5) * 0.6)
        .addScaledVector(up, (Math.random() - 0.5) * 0.08)
        .normalize();
      const length = plan.travel * halfWidth;
      segment.start.copy(start).addScaledVector(direction, -current.extent * scale);
      segment.end
        .copy(start)
        .addScaledVector(direction, length + current.extent * scale);
      const clear = obstacles.every(
        ({ position, radius }) =>
          segment.closestPointToPoint(position, true, probe).distanceTo(position) >
          radius + current.extent * scale * 0.7,
      );
      speed = length / plan.cruise;
      if (clear) break;
    }
    const formation = current.formation;
    formation.position.copy(start);
    formation.up.copy(up);
    formation.scale.setScalar(scale);
    formation.lookAt(probe.copy(start).add(direction));
    formation.updateMatrixWorld(true);
    formation.worldToLocal(probe.copy(camera.position));
    formation.rotateZ(Math.sign(-probe.x || 1) * plan.bank);
    current.vessels.forEach((vessel) => {
      vessel.landed = false;
      vessel.gone = false;
      vessel.root.visible = false;
    });
    formation.visible = true;
    flight = current;
    clock = 0;
    jumpAnnounced = false;
    onPhase("arrive");
  };
  return {
    group,
    // A ship for the galactic events (a fleet, a wreck), on the same hulls as passing traffic.
    /** Sends a ship of this kind across the view as soon as the sky is clear. */
    request: (kind: TrafficKind) => {
      queued = KINDS.indexOf(kind);
    },
    fleetShip: (kind: TrafficKind) =>
      buildVessel((kind === "destroyer" ? destroyerHull : kind === "freighter" ? freighterHull : fighterHull)(), glow, plating, reflections, [0, 0, 0]).root,
    glow,
    tick: (
      dt: number,
      camera: THREE.PerspectiveCamera,
      state: { active: boolean; travel: boolean },
      obstacles: Obstacle[],
    ) => {
      flashes.forEach((item) => {
        if (!item.sprite.visible) return;
        item.age += dt;
        const rise = Math.min(1, item.age / 0.06),
          fade = Math.max(0, 1 - (item.age - 0.06) / 0.34);
        item.sprite.material.opacity = item.age < 0.06 ? 1 : fade;
        item.sprite.scale.setScalar(item.peak * scale * (rise + item.age * 1.6));
        if (fade <= 0) item.sprite.visible = false;
      });
      if (!state.active) {
        if (flight) finish();
        return;
      }
      if (!flight) {
        if (queued !== null && dt > 0 && !state.travel) {
          launch(camera, obstacles, queued);
          queued = null;
        }
        return;
      }
      const { formation, vessels, plan } = flight;
      clock += dt;
      formation.position.addScaledVector(direction, speed * dt);
      if (!jumpAnnounced && clock >= plan.cruise) {
        jumpAnnounced = true;
        onPhase("jump");
      }
      vessels.forEach((vessel) => {
        if (vessel.gone) return;
        const arrival = (clock - vessel.arriveAt) / ARRIVAL;
        if (arrival < 0) return;
        vessel.root.visible = true;
        const length = vessel.nose + vessel.tail;
        let stretch = 1,
          surge = 0,
          heat = 0,
          thrust = 0.8,
          flare = 1;
        if (arrival < 1) {
          // Dropping out: a long streak collapses into the hull from behind.
          const settle = 1 - Math.pow(1 - arrival, 3);
          stretch = 1 + Math.pow(1 - settle, 2) * 45;
          surge = -(1 - settle) * 70;
          heat = Math.pow(1 - settle, 1.5) * 2.2;
          vessel.body.position.z = -vessel.nose * (stretch - 1);
        } else {
          if (!vessel.landed) {
            vessel.landed = true;
            vessel.root.localToWorld(nosePoint.set(0, 0, vessel.nose));
            flash(nosePoint, length * 0.2);
          }
          const jump = clock - vessel.jumpAt;
          if (jump > 0) {
            const charge = Math.min(1, jump / CHARGE);
            thrust = 0.8 + charge * 0.2;
            flare = 1 + charge * 0.9;
            const leap = (jump - CHARGE) / STRETCH;
            if (leap > 0) {
              stretch = 1 + Math.pow(Math.min(1, leap), 2.2) * 70;
              surge = Math.pow(Math.min(1, leap), 3) * 25;
              heat = Math.min(1, leap * 1.6) * 2.5;
            }
            if (leap >= 1) {
              vessel.root.localToWorld(nosePoint.set(0, 0, vessel.nose));
              flash(nosePoint, length * 0.3);
              vessel.gone = true;
              vessel.root.visible = false;
            }
          }
          vessel.body.position.z = vessel.tail * (stretch - 1);
        }
        // Stretching thins the hull into a needle of light.
        const thin = 1 / (1 + (stretch - 1) * 0.07);
        vessel.body.scale.set(thin, thin, stretch);
        vessel.body.position.z += surge;
        vessel.materials.forEach((material) => {
          material.emissiveIntensity = heat;
        });
        vessel.engines.forEach(({ sprite, size }) => {
          sprite.material.opacity = thrust;
          sprite.scale.set(size * flare, size * flare, 1);
        });
      });
      if (vessels.every((vessel) => vessel.gone)) finish();
    },
    reset: () => {
      queued = null;
      finish();
      flashes.forEach((item) => (item.sprite.visible = false));
    },
  };
}
