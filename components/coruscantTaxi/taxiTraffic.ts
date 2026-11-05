import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CORUSCANT_LANDMARKS } from "../coruscantSkyline";
import { SENATE, TEMPLE, type Trip } from "./taxiPlaces";

// Coruscant's air traffic. Lanes are polylines: streams that follow each trip on both sides,
// cross-streams the taxi dives under or over, and long skylanes above the rooftops. Vehicles are
// three instanced models (speeder, taxi, transport) with glowing head and tail lights; a few
// companions keep pace around the taxi, overtaking it or flashing past the other way.

export type Lane = { points: THREE.Vector3[]; dist: number[]; length: number; speed: [number, number]; count: number };
export type Passing = (pan: number, level: number) => void;

const UP = new THREE.Vector3(0, 1, 0);

function lane(points: THREE.Vector3[], speed: [number, number], density: number): Lane {
  const dist = [0];
  for (let i = 1; i < points.length; i++) dist.push(dist[i - 1] + points[i].distanceTo(points[i - 1]));
  const length = dist[dist.length - 1];
  return { points, dist, length, speed, count: Math.max(2, Math.round(length * density)) };
}

// Obstacles a lane must not cross: the sculpted towers near the pad, the pad, both monuments.
function blocked(p: THREE.Vector3) {
  if (Math.hypot(p.x, p.z) < 46 && p.y > -60) return true;
  if (CORUSCANT_LANDMARKS.some((mark) => Math.hypot(p.x - mark.x, p.z - mark.z) < mark.r + 10 && p.y < 150)) return true;
  if (Math.max(Math.abs(p.x - TEMPLE.x), Math.abs(p.z - TEMPLE.z)) < 235 && p.y < 290) return true;
  // The Senate, and the two masts that rise past its dome.
  if (Math.hypot(p.x - SENATE.x, p.z - SENATE.z) < 255 && p.y < (Math.hypot(p.x - SENATE.x, p.z - SENATE.z) < 190 ? 175 : 110)) return true;
  return false;
}
// Split a polyline where it meets an obstacle, keeping the long free stretches.
function clip(points: THREE.Vector3[], minimum = 90) {
  const runs: THREE.Vector3[][] = [];
  let run: THREE.Vector3[] = [];
  points.forEach((point) => {
    if (blocked(point)) {
      if (run.length) runs.push(run);
      run = [];
    } else run.push(point);
  });
  if (run.length) runs.push(run);
  return runs.filter((item) => item.length > 1 && item[0].distanceTo(item[item.length - 1]) > minimum);
}

/** The air lanes seen from the landing platform: rings and crossings at several altitudes, and
 *  short hops that start and end at the great towers, so traffic visibly leaves and enters them. */
export function padLanes(seed = 8123) {
  let s = seed;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const lanes: Lane[] = [];
  const add = (points: THREE.Vector3[], speed: [number, number], density: number, minimum = 70) =>
    clip(points, minimum).forEach((run) => lanes.push(lane(run, speed, density)));
  // Rings around the district: the nearer ones low and slow, the far ones high and fast.
  [
    [88, -26, 26, 36],
    [118, 22, 30, 42],
    [165, -52, 34, 48],
    [215, 46, 38, 54],
    [280, -8, 42, 60],
    [360, 86, 46, 66],
    [440, -96, 42, 60],
  ].forEach(([radius, height, slow, fast], ring) => {
    [-1, 1].forEach((way) => {
      const points: THREE.Vector3[] = [];
      for (let a = 0; a <= 360; a += 3) {
        const angle = (a * way * Math.PI) / 180 + ring * 1.3;
        const reach = radius + way * 5 + Math.sin(angle * 3 + ring) * 12;
        points.push(new THREE.Vector3(Math.cos(angle) * reach, height + way * 4 + Math.sin(angle * 2 + ring) * 5, Math.sin(angle) * reach));
      }
      add(points, [slow, fast], 1 / 85);
    });
  });
  // Straight corridors crossing the view from horizon to horizon.
  for (let i = 0; i < 14; i++) {
    const angle = rand() * Math.PI * 2,
      direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)),
      across = new THREE.Vector3(-direction.z, 0, direction.x),
      centre = across.clone().multiplyScalar(110 + rand() * 300).setY(-90 + rand() * 190);
    [-1, 1].forEach((way) => {
      const points: THREE.Vector3[] = [];
      for (let d = -760; d <= 760; d += 12) points.push(centre.clone().addScaledVector(direction, d * way).addScaledVector(across, way * 4));
      add(points, [44, 70], 1 / 130, 120);
    });
  }
  // Hops between the towers: these lanes stop at the walls instead of being cut by the obstacle test.
  const marks = CORUSCANT_LANDMARKS.filter((mark) => Math.hypot(mark.x, mark.z) < 520);
  for (let i = 0; i < Math.min(12, marks.length); i++) {
    const from = marks[i],
      to = marks[(i + 1 + Math.floor(rand() * 3)) % marks.length];
    if (from === to) continue;
    const span = Math.hypot(to.x - from.x, to.z - from.z) || 1,
      ux = (to.x - from.x) / span,
      uz = (to.z - from.z) / span,
      height = -40 + rand() * 90;
    const points: THREE.Vector3[] = [];
    for (let k = 0; k <= 24; k++) {
      const t = k / 24,
        d = from.r + (span - from.r - to.r) * t;
      points.push(new THREE.Vector3(from.x + ux * d, height + Math.sin(t * Math.PI) * 24, from.z + uz * d));
    }
    if (points.every((point) => Math.hypot(point.x, point.z) > 46)) lanes.push(lane(points, [24, 34], 1 / 70));
  }
  return lanes;
}

export function buildLanes(trips: Trip[], seed = 4417) {
  let s = seed;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const lanes: Lane[] = [];
  const tangent = new THREE.Vector3(),
    right = new THREE.Vector3();
  trips.forEach((trip) => {
    // Streams alongside the trip, one each way, kept clear of the places at either end.
    [
      [15, 6, 1],
      [-15, -7, -1],
    ].forEach(([lateral, vertical, way]) => {
      const points: THREE.Vector3[] = [];
      for (let d = trip.length * 0.16; d < trip.length * 0.8; d += 6) {
        const u = d / trip.length;
        trip.curve.getTangentAt(u, tangent);
        right.crossVectors(tangent, UP).normalize();
        points.push(trip.curve.getPointAt(u).addScaledVector(right, lateral).addScaledVector(UP, vertical));
      }
      if (way < 0) points.reverse();
      clip(points).forEach((run) => lanes.push(lane(run, [30, 44], 1 / 55)));
    });
    // Two cross-streams, one above the trip and one below it.
    [
      [0.34, 10],
      [0.52, -11],
    ].forEach(([u, rise]) => {
      const centre = trip.curve.getPointAt(u);
      trip.curve.getTangentAt(u, tangent);
      right.crossVectors(tangent, UP).normalize();
      [-1, 1].forEach((way) => {
        const points: THREE.Vector3[] = [];
        for (let d = -360; d <= 360; d += 8) points.push(centre.clone().addScaledVector(right, d * way).addScaledVector(tangent, way * 3.5).setY(centre.y + rise + way * 1.6));
        clip(points).forEach((run) => lanes.push(lane(run, [46, 62], 1 / 34)));
      });
    });
  });
  // Skylanes above the rooftops, crossing the whole district.
  for (let i = 0; i < 16; i++) {
    const angle = rand() * Math.PI,
      direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)),
      across = new THREE.Vector3(-direction.z, 0, direction.x),
      centre = new THREE.Vector3(-300 + rand() * 900, 78 + rand() * 80, -1100 + rand() * 1000).addScaledVector(across, (rand() - 0.5) * 300);
    [-1, 1].forEach((way) => {
      const points: THREE.Vector3[] = [];
      for (let d = -1300; d <= 1300; d += 20) points.push(centre.clone().addScaledVector(direction, d * way).addScaledVector(across, way * 3));
      clip(points, 200).forEach((run) => lanes.push(lane(run, [34, 52], 1 / 160)));
    });
  }
  return lanes;
}

// Vehicle models, built facing +Z with their colours baked into the vertices.
function tinted(geometry: THREE.BufferGeometry, color: number, at: [number, number, number], scale?: [number, number, number]) {
  if (scale) geometry.scale(...scale);
  geometry.translate(...at);
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.deleteAttribute("uv");
  const c = new THREE.Color(color),
    count = g.getAttribute("position").count,
    colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}
const capsule = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 4, 12).rotateX(Math.PI / 2);
const MODELS = {
  speeder: () =>
    mergeGeometries([
      tinted(capsule(0.5, 2.6), 0xffffff, [0, 0.5, 0], [1.25, 0.5, 1]),
      tinted(new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x0b1016, [0, 0.66, 0.35], [1, 0.8, 1.6]),
      tinted(new THREE.CylinderGeometry(0.2, 0.24, 1.3, 10).rotateX(Math.PI / 2), 0x555b63, [0.82, 0.48, -1.0]),
      tinted(new THREE.CylinderGeometry(0.2, 0.24, 1.3, 10).rotateX(Math.PI / 2), 0x555b63, [-0.82, 0.48, -1.0]),
    ]),
  taxi: () =>
    mergeGeometries([
      tinted(new THREE.BoxGeometry(2.3, 0.62, 5.5), 0xe9a62b, [0, 0.5, 0]),
      tinted(new THREE.BoxGeometry(2.3, 0.45, 1.3), 0xe9a62b, [0, 1.0, 2.1]),
      tinted(new THREE.BoxGeometry(2.3, 0.42, 1.2), 0xe9a62b, [0, 1.0, -2.2]),
      tinted(new THREE.BoxGeometry(0.28, 0.5, 3.0), 0xe9a62b, [1.0, 1.0, 0]),
      tinted(new THREE.BoxGeometry(0.28, 0.5, 3.0), 0xe9a62b, [-1.0, 1.0, 0]),
      tinted(new THREE.BoxGeometry(1.7, 0.1, 3.0), 0x1a1d22, [0, 0.85, 0]),
      tinted(new THREE.BoxGeometry(0.06, 0.34, 1.5).rotateZ(-0.75), 0x2a2e33, [1.35, 1.3, -2.7]),
      tinted(new THREE.BoxGeometry(0.06, 0.34, 1.5).rotateZ(0.75), 0x2a2e33, [-1.35, 1.3, -2.7]),
      tinted(new THREE.BoxGeometry(1.5, 0.07, 0.06), 0xff3a2e, [0, 0.92, -2.78]),
    ]),
  // A long freighter of containers, and a small official shuttle with its two short wings.
  cargo: () =>
    mergeGeometries([
      tinted(new THREE.BoxGeometry(2.4, 2.1, 13), 0xffffff, [0, 1.2, -1]),
      tinted(new THREE.BoxGeometry(2.46, 0.2, 13.06), 0x2a2e33, [0, 1.4, -1]),
      tinted(new THREE.BoxGeometry(2, 1.5, 2.2), 0x4a5058, [0, 1.3, 6.5]),
      tinted(new THREE.BoxGeometry(1.5, 0.6, 0.8), 0x0b1016, [0, 1.7, 7.5]),
    ]),
  shuttle: () =>
    mergeGeometries([
      tinted(capsule(0.95, 4.2), 0xffffff, [0, 1, 0], [1, 0.85, 1]),
      tinted(new THREE.BoxGeometry(1.1, 0.5, 1.4), 0x0b1016, [0, 1.45, 2]),
      tinted(new THREE.BoxGeometry(6.4, 0.12, 1.5), 0xffffff, [0, 0.9, -0.8]),
      tinted(new THREE.BoxGeometry(0.12, 2.2, 1.7).rotateX(0.32), 0xffffff, [0, 2.4, -2.2]),
      tinted(new THREE.BoxGeometry(1.5, 0.08, 0.5), 0xc9a65a, [0, 1.02, 3.1]),
      tinted(new THREE.BoxGeometry(6.5, 0.1, 0.22), 0xc9a65a, [0, 0.93, -0.1]),
      tinted(new THREE.CylinderGeometry(0.28, 0.34, 1.6, 10).rotateX(Math.PI / 2), 0x555b63, [2.6, 0.9, -1.2]),
      tinted(new THREE.CylinderGeometry(0.28, 0.34, 1.6, 10).rotateX(Math.PI / 2), 0x555b63, [-2.6, 0.9, -1.2]),
    ]),
  transport: () =>
    mergeGeometries([
      tinted(new THREE.BoxGeometry(2.6, 2.2, 9.5), 0xffffff, [0, 1.3, 0]),
      tinted(new THREE.BoxGeometry(2.66, 0.5, 8.6), 0x101820, [0, 1.75, 0.2]),
      tinted(capsule(1.1, 0.6), 0xffffff, [0, 1.3, 4.9], [1.1, 0.95, 1]),
      tinted(new THREE.BoxGeometry(3.6, 0.5, 2.4), 0x484e57, [0, 0.4, -3.6]),
    ]),
};
type Kind = keyof typeof MODELS;
/** One vehicle's model, for events that fly their own (a chase, an official shuttle). */
export const vehicleGeometry = (kind: Kind) => MODELS[kind]();
const PAINT = [0xe8ecef, 0x9fb4c8, 0x6c7a8a, 0xb84a3a, 0x3d6f9c, 0xd8d0bc, 0x2f3338, 0x8f5fb0];

type Vehicle = { kind: Kind; slot: number; lane: number; d: number; speed: number; companion?: { lateral: number; vertical: number; rel: number; speed: number; way: number } };

export function createTraffic(lanes: Lane[], glow: THREE.Texture, quality: number) {
  const group = new THREE.Group();
  group.name = "air-traffic";
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.45, roughness: 0.42 });
  let s = 9127;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const thin = quality < 2 ? 0.55 : 1;
  const vehicles: Vehicle[] = [];
  const counts: Record<Kind, number> = { speeder: 0, taxi: 0, transport: 0, cargo: 0, shuttle: 0 };
  const pick = (): Kind => {
    const r = rand();
    return r < 0.5 ? "speeder" : r < 0.78 ? "taxi" : r < 0.88 ? "transport" : r < 0.95 ? "cargo" : "shuttle";
  };
  lanes.forEach((item, index) => {
    const count = Math.max(1, Math.round(item.count * thin));
    for (let i = 0; i < count; i++) {
      const kind = pick();
      vehicles.push({ kind, slot: counts[kind]++, lane: index, d: ((i + rand() * 0.6) / count) * item.length, speed: item.speed[0] + rand() * (item.speed[1] - item.speed[0]) });
    }
  });
  // Companions: same-way lanes either side, above and below, and an oncoming lane.
  const companionLayout: [number, number, number][] = [
    [-9, 0, 1],
    [9, 1, 1],
    [-6, 7, 1],
    [7, -8, 1],
    [-12, -4, 1],
    [12, 6, 1],
    [-18, 3, -1],
    [-20, -2, -1],
    [18, -6, -1],
    [0, 12, 1],
    [0, -13, -1],
    [-24, 9, 1],
  ];
  companionLayout.forEach(([lateral, vertical, way], i) =>
    [0, 1].forEach((k) => {
      const kind = pick();
      const vehicle: Vehicle = { kind, slot: counts[kind]++, lane: -1, d: 0, speed: 0, companion: { lateral, vertical, way, rel: (k ? 1 : -1) * (40 + i * 13), speed: way > 0 ? (k ? -10 : 9) - rand() * 6 : 34 + rand() * 12 } };
      vehicles.push(vehicle);
    }),
  );
  const meshes = (Object.keys(MODELS) as Kind[]).reduce(
    (all, kind) => {
      const mesh = new THREE.InstancedMesh(MODELS[kind](), material, Math.max(1, counts[kind]));
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < counts[kind]; i++) mesh.setColorAt(i, new THREE.Color(kind === "taxi" ? 0xffffff : PAINT[Math.floor(rand() * PAINT.length)]));
      group.add(mesh);
      all[kind] = mesh;
      return all;
    },
    {} as Record<Kind, THREE.InstancedMesh>,
  );
  // Head and tail lights: one pair per vehicle.
  // Each vehicle has its own place in the order that traffic thins out, so density changes never
  // make a whole stream vanish, and a size that eases in and out instead of a pop.
  const order = vehicles.map(() => rand());
  const presence = vehicles.map(() => 1);
  let density = 1,
    frame = 0;
  const lightPositions = new Float32Array(vehicles.length * 6),
    lightColors = new Float32Array(vehicles.length * 6);
  vehicles.forEach((_, i) => {
    lightColors.set([1, 0.9, 0.72, 1, 0.24, 0.16], i * 6);
  });
  const lightGeometry = new THREE.BufferGeometry();
  lightGeometry.setAttribute("position", new THREE.BufferAttribute(lightPositions, 3).setUsage(THREE.DynamicDrawUsage));
  lightGeometry.setAttribute("color", new THREE.BufferAttribute(lightColors, 3));
  const lights = new THREE.Points(lightGeometry, new THREE.PointsMaterial({ map: glow, size: 2.2, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  lights.frustumCulled = false;
  group.add(lights);

  const at = new THREE.Vector3(),
    ahead = new THREE.Vector3(),
    heading = new THREE.Vector3(),
    side = new THREE.Vector3(),
    matrix = new THREE.Matrix4(),
    look = new THREE.Matrix4(),
    scale = new THREE.Vector3(),
    quaternion = new THREE.Quaternion(),
    hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const sample = (item: Lane, d: number, out: THREE.Vector3) => {
    let lo = 0,
      hi = item.dist.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (item.dist[mid] > d) hi = mid;
      else lo = mid;
    }
    const span = item.dist[hi] - item.dist[lo] || 1;
    return out.lerpVectors(item.points[lo], item.points[hi], (d - item.dist[lo]) / span);
  };
  const place = (vehicle: Vehicle, index: number, position: THREE.Vector3, forward: THREE.Vector3, size: number) => {
    const mesh = meshes[vehicle.kind];
    if (size <= 0.01) {
      mesh.setMatrixAt(vehicle.slot, hidden);
      lightPositions.fill(-99999, index * 6, index * 6 + 6);
      return;
    }
    look.lookAt(ahead.copy(position).add(forward), position, UP);
    quaternion.setFromRotationMatrix(look);
    matrix.compose(position, quaternion, scale.setScalar(size));
    mesh.setMatrixAt(vehicle.slot, matrix);
    const length = vehicle.kind === "cargo" ? 8 : vehicle.kind === "transport" ? 5.4 : vehicle.kind === "taxi" ? 2.9 : 2.0;
    lightPositions.set([position.x + forward.x * length * size, position.y + 0.6 * size, position.z + forward.z * length * size], index * 6);
    lightPositions.set([position.x - forward.x * length * size, position.y + 0.7 * size, position.z - forward.z * length * size], index * 6 + 3);
  };
  const taxiFrame = { right: new THREE.Vector3(), tangent: new THREE.Vector3() };
  const near = new Set<Vehicle>();

  return {
    group,
    // The share of traffic in the air, 0 to 1: a storm, an alert, the rhythm of the city.
    setDensity: (level: number) => {
      density = level;
    },
    // Moves every vehicle; companions follow the taxi's trip around its position.
    tick: (dt: number, reduced: boolean, taxi: { trip: Trip | null; s: number; speed: number; camera?: THREE.Camera; viewer?: THREE.Vector3 }, passing?: Passing) => {
      const step = reduced ? 0 : dt;
      frame++;
      vehicles.forEach((vehicle, index) => {
        if (vehicle.companion) {
          const c = vehicle.companion;
          const trip = taxi.trip;
          if (!trip) return place(vehicle, index, at, heading, 0);
          const relSpeed = c.way > 0 ? c.speed : -(c.speed + taxi.speed);
          c.rel += relSpeed * step;
          // Off the far end of the group: come back from the other side.
          if (c.rel > 260) c.rel = -240;
          if (c.rel < -260) c.rel = 240;
          const d = taxi.s + c.rel;
          // Calm near the destinations and the pad.
          const calm = Math.min(1, Math.max(0, Math.min(d - 120, trip.length - 260 - d) / 80));
          if (d < 0 || d > trip.length || calm <= 0) return place(vehicle, index, at, heading, 0);
          const u = d / trip.length;
          trip.curve.getPointAt(u, at);
          trip.curve.getTangentAt(u, taxiFrame.tangent);
          taxiFrame.right.crossVectors(taxiFrame.tangent, UP).normalize();
          at.addScaledVector(taxiFrame.right, c.lateral).addScaledVector(UP, c.vertical);
          heading.copy(taxiFrame.tangent).multiplyScalar(c.way);
          place(vehicle, index, at, heading, calm);
          // A whoosh as it passes close to the passenger.
          const gap = taxi.camera ? at.distanceTo(taxi.camera.position) : Infinity;
          if (gap < 16 && !near.has(vehicle) && taxi.camera) {
            near.add(vehicle);
            side.copy(at).applyMatrix4(taxi.camera.matrixWorldInverse);
            passing?.(THREE.MathUtils.clamp(side.x / 12, -1, 1), Math.min(1, (16 - gap) / 10) * (c.way < 0 ? 1 : 0.7));
          } else if (gap > 24) near.delete(vehicle);
          return;
        }
        const item = lanes[vehicle.lane];
        vehicle.d = (vehicle.d + vehicle.speed * step) % item.length;
        // Far away a vehicle moves a few pixels at most: place it one frame in three.
        if (taxi.viewer && (frame + index) % 3 !== 0) {
          const bucket = item.points[Math.floor((vehicle.d / item.length) * (item.points.length - 1))];
          if (bucket.distanceToSquared(taxi.viewer) > 490000) return;
        }
        presence[index] += ((order[index] < density ? 1 : 0) - presence[index]) * (1 - Math.exp(-dt * 1.2));
        sample(item, vehicle.d, at);
        sample(item, Math.min(item.length, vehicle.d + 4), ahead);
        heading.subVectors(ahead, at);
        if (heading.lengthSq() < 0.0001) heading.set(0, 0, 1);
        heading.normalize();
        // Vehicles grow in and out at the ends of a lane, so nothing pops.
        const fade = Math.min(1, vehicle.d / 40, (item.length - vehicle.d) / 40);
        place(vehicle, index, at, heading, Math.max(0, fade) * presence[index]);
      });
      (Object.keys(meshes) as Kind[]).forEach((kind) => (meshes[kind].instanceMatrix.needsUpdate = true));
      lightGeometry.getAttribute("position").needsUpdate = true;
    },
  };
}
