import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { COUNCIL, COUNCIL_FACING, COUNCIL_FLOOR } from "./taxiPlaces";
import { createWalkArea } from "./walkArea";
import { createCouncilMembers } from "./councilMembers";
import { createCertVault } from "./certVault";

// The Council chamber in the crown of the Temple spire: a round room of pale stone and fluted metal
// columns, a golden mosaic floor, twelve seats along tall round-cornered windows open on the sunset
// city, and a door to the landing platform. Ten members of the Council sit here and two attend by
// hologram; four of them each guard a holocron, one per chapter of the visitor's reading. In the
// middle of the floor, the vault of holocrons keeps the pilot's certifications. Local +Z points out
// through the door to the platform.

type SeatedTopic = "vision" | "quete" | "orientation" | "projets";
export type CouncilTopic = SeatedTopic | "certifs";
export const COUNCIL_TOPICS: CouncilTopic[] = ["vision", "quete", "orientation", "projets", "certifs"];
const SEATED_TOPICS: SeatedTopic[] = ["vision", "quete", "orientation", "projets"];
const WALL = 10.6,
  HEIGHT = 9.6,
  SEATS = 12,
  SEAT_RING = 8.5;
// Seats go round the room from just past the door, leaving the doorway free.
const seatAngle = (i: number) => THREE.MathUtils.degToRad(26 + (i * 308) / (SEATS - 1));
// The seats whose members hold a holocron: two on each side of the room.
const TOPIC_SEATS: Record<SeatedTopic, number> = { vision: 4, quete: 7, orientation: 2, projets: 9 };
// Each seat's shape: 0 an armchair, 1 an egg pod, 2 a tall-backed throne.
const SEAT_KIND = [0, 2, 0, 1, 0, 1, 2, 0, 2, 1, 0, 2];
const CUSHION = [0.56, 0.58, 0.56];
const HOLOCRON_Y = 1.0;

function mosaicTexture() {
  const size = 2048,
    canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const c = canvas.getContext("2d")!;
  const R = size / 2;
  c.translate(R, R);
  const ring = (r: number, color: string) => {
    c.fillStyle = color;
    c.beginPath();
    c.arc(0, 0, r * R, 0, Math.PI * 2);
    c.fill();
  };
  ring(1, "#b98f55");
  ring(0.985, "#5a2f1a");
  ring(0.968, "#ecd7a2");
  ring(0.9, "#e2c07c");
  // A fan of five slender leaves, its tips pointing away from the centre.
  const fan = (radius: number, length: number, width: number, angle: number, color: string) => {
    c.save();
    c.rotate(angle);
    c.translate(0, radius * R);
    c.fillStyle = color;
    for (let k = -2; k <= 2; k++) {
      c.save();
      c.rotate(k * 0.27);
      const l = length * (1 - Math.abs(k) * 0.14);
      c.beginPath();
      c.moveTo(0, 0);
      c.bezierCurveTo(width * R, l * R * 0.35, width * R * 0.6, l * R * 0.8, 0, l * R);
      c.bezierCurveTo(-width * R * 0.6, l * R * 0.8, -width * R, l * R * 0.35, 0, 0);
      c.fill();
      c.restore();
    }
    c.restore();
  };
  for (let i = 0; i < 26; i++) fan(0.67, 0.25, 0.027, (i / 26) * Math.PI * 2, "#6d4a26");
  c.lineWidth = 6;
  c.strokeStyle = "#7a4a26";
  [0.62, 0.59].forEach((r) => {
    c.beginPath();
    c.arc(0, 0, r * R, 0, Math.PI * 2);
    c.stroke();
  });
  ring(0.46, "#c28f54");
  ring(0.44, "#8a4632");
  ring(0.415, "#9c563c");
  // The medallion: an inner flower of pale leaves round a small disc.
  for (let i = 0; i < 16; i++) fan(0.06, 0.32, 0.04, (i / 16) * Math.PI * 2, "#e2bb8a");
  for (let i = 0; i < 16; i++) fan(0.08, 0.2, 0.025, ((i + 0.5) / 16) * Math.PI * 2, "#f3dcb4");
  ring(0.07, "#5a2a1a");
  ring(0.05, "#e2c07c");
  // Polish: faint radial sheen and wear.
  const sheen = c.createRadialGradient(0, 0, 0, 0, 0, R);
  sheen.addColorStop(0, "rgba(255,230,200,.08)");
  sheen.addColorStop(1, "rgba(0,0,0,.12)");
  c.fillStyle = sheen;
  c.beginPath();
  c.arc(0, 0, R, 0, Math.PI * 2);
  c.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// One of the great columns: a drum with vertical flutes, flaring where it meets floor and ceiling.
function flutedColumn(height: number) {
  const sides = 48,
    rows = 26,
    position: number[] = [],
    index: number[] = [];
  const radius = (t: number) => {
    const foot = Math.pow(Math.max(0, 1 - t / 0.14), 2) * 0.3,
      head = Math.pow(Math.max(0, (t - 0.72) / 0.28), 2) * 0.62;
    return 0.46 + foot + head;
  };
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    for (let side = 0; side <= sides; side++) {
      const a = (side / sides) * Math.PI * 2,
        r = radius(t) * (1 + 0.055 * Math.cos(a * 10) * (1 - Math.max(0, (t - 0.72) / 0.28)));
      position.push(Math.sin(a) * r, t * height, Math.cos(a) * r);
      if (row < rows && side < sides) {
        const here = row * (sides + 1) + side,
          up = here + sides + 1;
        index.push(here, here + 1, up, here + 1, up + 1, up);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}
// A soft dark pool under each seat, to set it on the floor.
function contactShadow() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const c = canvas.getContext("2d")!;
  const soft = c.createRadialGradient(64, 64, 16, 64, 64, 64);
  soft.addColorStop(0, "rgba(30,14,6,.62)");
  soft.addColorStop(1, "rgba(30,14,6,0)");
  c.fillStyle = soft;
  c.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

export function createCouncilChamber(glow: THREE.Texture) {
  const group = new THREE.Group();
  group.name = "council-chamber";
  group.position.set(COUNCIL.x, COUNCIL_FLOOR, COUNCIL.z);
  const yaw = Math.atan2(COUNCIL_FACING.x, COUNCIL_FACING.z);
  group.rotation.y = yaw;
  const stone = new THREE.MeshStandardMaterial({ color: 0xc4bcaa, roughness: 0.56, metalness: 0.12, side: THREE.DoubleSide });
  const plaster = new THREE.MeshStandardMaterial({ color: 0xaca494, roughness: 0.76, metalness: 0.05, side: THREE.DoubleSide });
  const column = new THREE.MeshStandardMaterial({ color: 0xaaa9a0, roughness: 0.32, metalness: 0.62 });
  const velvet = new THREE.MeshStandardMaterial({ color: 0x7d2a20, roughness: 0.86, metalness: 0.02, side: THREE.DoubleSide });
  const shell = new THREE.MeshStandardMaterial({ color: 0xa5a29a, roughness: 0.48, metalness: 0.22, side: THREE.DoubleSide });
  const warm = new THREE.MeshBasicMaterial({ color: 0xffd7a0, toneMapped: false });
  const glass = new THREE.MeshStandardMaterial({ color: 0xffd9b0, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide });
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const put = (material: THREE.Material, geometry: THREE.BufferGeometry, x = 0, y = 0, z = 0, turn = 0, tilt = 0) => {
    geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, turn, 0, "YXZ")), new THREE.Vector3(1, 1, 1)));
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (!g.getAttribute("uv")) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute("position").count * 2), 2));
    const list = batches.get(material) ?? [];
    list.push(g);
    batches.set(material, list);
  };
  // Floor.
  const floor = new THREE.Mesh(new THREE.CircleGeometry(WALL, 96), new THREE.MeshStandardMaterial({ map: mosaicTexture(), color: 0xc2b7a6, roughness: 0.46, metalness: 0.06 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  group.add(floor);
  // Eight bays; the one facing +Z holds the door, the others are windows over a low sill.
  const BAY = Math.PI / 4,
    DOOR = 2.8 / WALL;
  for (let b = 0; b < 8; b++) {
    const centre = b * BAY;
    const from = centre - BAY / 2;
    if (b === 0) {
      // Door bay: wall either side of the doorway and a lintel above it.
      [
        [from, BAY / 2 - DOOR / 2],
        [centre + DOOR / 2, BAY / 2 - DOOR / 2],
      ].forEach(([start, length]) => put(stone, new THREE.CylinderGeometry(WALL, WALL, HEIGHT, 8, 1, true, start, length), 0, HEIGHT / 2));
      put(stone, new THREE.CylinderGeometry(WALL, WALL, HEIGHT - 3.6, 6, 1, true, centre - DOOR / 2, DOOR), 0, 3.6 + (HEIGHT - 3.6) / 2);
      [-1, 1].forEach((side) => put(warm, new THREE.BoxGeometry(0.08, 3.5, 0.08), Math.sin(centre + (side * DOOR) / 2) * (WALL - 0.05), 1.75, Math.cos(centre + (side * DOOR) / 2) * (WALL - 0.05)));
      put(warm, new THREE.BoxGeometry(2.8, 0.08, 0.08), 0, 3.56, WALL - 0.05);
      continue;
    }
    put(stone, new THREE.CylinderGeometry(WALL, WALL, 0.95, 12, 1, true, from, BAY), 0, 0.475);
    put(stone, new THREE.RingGeometry(WALL - 0.45, WALL + 0.05, 12, 1, from - Math.PI / 2, BAY).rotateX(-Math.PI / 2), 0, 0.95);
    put(glass, new THREE.CylinderGeometry(WALL + 0.02, WALL + 0.02, HEIGHT - 1.95, 12, 1, true, from, BAY), 0, 0.95 + (HEIGHT - 1.95) / 2);
    put(stone, new THREE.CylinderGeometry(WALL, WALL, 1.0, 12, 1, true, from, BAY), 0, HEIGHT - 0.5);
    // Round the window's four corners with curved fillets on the wall.
    const edge = 0.5 / WALL,
      round = 1.15;
    [
      [from + edge, 0.95, 1, 1],
      [from + BAY - edge, 0.95, -1, 1],
      [from + edge, HEIGHT - 1, 1, -1],
      [from + BAY - edge, HEIGHT - 1, -1, -1],
    ].forEach(([angle, y, across, up]) => {
      const onWall = (s: number, h: number) => [Math.sin(s) * WALL, h, Math.cos(s) * WALL];
      const arc = Array.from({ length: 9 }, (_, k) => {
        const t = (k / 8) * (Math.PI / 2);
        return onWall(angle + (across * round * (1 - Math.sin(t))) / WALL, y + up * round * (1 - Math.cos(t)));
      });
      const corner = onWall(angle, y),
        position: number[] = [],
        normal: number[] = [];
      for (let k = 0; k < 8; k++) {
        [corner, arc[k], arc[k + 1]].forEach((p) => {
          position.push(p[0], p[1], p[2]);
          normal.push(-p[0] / WALL, 0, -p[2] / WALL);
        });
      }
      const fillet = new THREE.BufferGeometry();
      fillet.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
      fillet.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
      put(stone, fillet);
    });
  }
  // Columns between the bays, with a slit of warm light down either side of each.
  const columnShape = flutedColumn(HEIGHT + 0.2);
  for (let b = 0; b < 8; b++) {
    const a = b * BAY + BAY / 2;
    const x = Math.sin(a),
      z = Math.cos(a);
    put(column, columnShape.clone(), x * (WALL - 0.38), 0, z * (WALL - 0.38), a);
    [-1, 1].forEach((side) => put(warm, new THREE.BoxGeometry(0.035, HEIGHT - 3.9, 0.035), x * (WALL - 0.62) + Math.cos(a) * side * 0.5, (HEIGHT - 3.9) / 2 + 1.5, z * (WALL - 0.62) - Math.sin(a) * side * 0.5, a));
  }
  // Ceiling: a shallow dome with a lit ring and eight ribs.
  const dome = new THREE.SphereGeometry(WALL + 0.1, 48, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(1, 0.34, 1);
  put(plaster, dome, 0, HEIGHT);
  put(warm, new THREE.TorusGeometry(WALL - 0.4, 0.05, 6, 96).rotateX(Math.PI / 2), 0, HEIGHT - 0.05);
  for (let b = 0; b < 8; b++) {
    const rib = new THREE.TorusGeometry(WALL, 0.12, 6, 20, Math.PI / 2);
    rib.scale(1, 0.34, 1);
    rib.rotateY(-Math.PI / 2);
    put(stone, rib, 0, HEIGHT, 0, b * BAY + BAY / 2);
  }
  put(warm, new THREE.CircleGeometry(0.9, 32).rotateX(Math.PI / 2), 0, HEIGHT + 3.55);

  // Seats: armchairs, egg pods and tall-backed thrones, in turn, all facing the centre.
  const seatGroups: THREE.Vector3[] = [];
  for (let i = 0; i < SEATS; i++) {
    const a = seatAngle(i),
      x = Math.sin(a) * SEAT_RING,
      z = Math.cos(a) * SEAT_RING,
      turn = a + Math.PI;
    seatGroups.push(new THREE.Vector3(x, 0, z));
    const local = (dx: number, dy: number, dz: number) => {
      const c = Math.cos(turn),
        s = Math.sin(turn);
      return [x + dx * c + dz * s, dy, z - dx * s + dz * c] as const;
    };
    const kind = SEAT_KIND[i];
    put(shell, new THREE.BoxGeometry(1.1, 0.34, 0.95), ...local(0, 0.17, 0), turn);
    if (kind === 1) {
      const egg = new THREE.SphereGeometry(0.72, 24, 16, Math.PI * 0.2, Math.PI * 1.6, 0, Math.PI * 0.72);
      // The opening, at -X as built, turned to face the room.
      egg.rotateY(Math.PI / 2);
      egg.scale(1, 1.05, 0.9);
      put(shell, egg, ...local(0, 0.98, -0.08), turn);
      const lining = new THREE.SphereGeometry(0.64, 24, 16, Math.PI * 0.25, Math.PI * 1.5, 0, Math.PI * 0.7);
      lining.rotateY(Math.PI / 2);
      lining.scale(1, 1.05, 0.9);
      put(velvet, lining, ...local(0, 0.98, -0.08), turn);
      put(velvet, new THREE.CylinderGeometry(0.5, 0.5, 0.16, 20), ...local(0, 0.5, 0.05), turn);
    } else {
      put(velvet, new THREE.BoxGeometry(0.92, 0.2, 0.82), ...local(0, 0.46, 0.02), turn);
      const tall = kind === 2 ? 1.5 : 0.95;
      put(velvet, new THREE.BoxGeometry(0.92, tall, 0.2), ...local(0, 0.5 + tall / 2, -0.4), turn, -0.1);
      // A chunky shell behind the cushions, and wide flat armrests.
      put(shell, new THREE.BoxGeometry(1.12, tall + 0.32, 0.16), ...local(0, 0.34 + (tall + 0.32) / 2, -0.53), turn, -0.1);
      if (kind === 2) put(shell, new THREE.CapsuleGeometry(0.56, 0.02, 6, 16).rotateZ(Math.PI / 2).scale(1, 0.18, 0.2), ...local(0, 0.66 + tall, -0.58), turn);
      [-1, 1].forEach((side) => {
        put(shell, new THREE.BoxGeometry(0.2, 0.42, 0.9), ...local(side * 0.56, 0.42, 0), turn);
        put(velvet, new THREE.BoxGeometry(0.17, 0.06, 0.8), ...local(side * 0.56, 0.66, 0), turn);
      });
    }
  }
  batches.forEach((list, material) => group.add(new THREE.Mesh(mergeGeometries(list), material)));

  // Seated firmly on the floor.
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.3, 2.3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: contactShadow(), transparent: true, depthWrite: false }), SEATS);
  const poolMatrix = new THREE.Matrix4();
  for (let i = 0; i < SEATS; i++) {
    const a = seatAngle(i);
    pools.setMatrixAt(i, poolMatrix.makeTranslation(Math.sin(a) * SEAT_RING, 0.022, Math.cos(a) * SEAT_RING));
  }
  group.add(pools);

  // The Council: in the flesh, but for the two who attend by hologram.
  const members = createCouncilMembers().map((figure) => {
    const a = seatAngle(figure.seat);
    figure.group.position.set(Math.sin(a) * SEAT_RING, CUSHION[SEAT_KIND[figure.seat]], Math.cos(a) * SEAT_RING);
    figure.group.rotation.y = a + Math.PI;
    group.add(figure.group);
    return { ...figure, delay: figure.seat * 0.05, forward: a + Math.PI };
  });
  // Scratch vectors for the heads, which follow the visitor and whoever is speaking.
  const lookAt = new THREE.Vector3(),
    speakerAt = new THREE.Vector3();

  // Holocrons: an amber cube floating before each speaking member.
  const topics = SEATED_TOPICS.map((id) => {
    const seat = TOPIC_SEATS[id],
      a = seatAngle(seat);
    const holder = new THREE.Group();
    holder.position.set(Math.sin(a) * (SEAT_RING - 1.75), HOLOCRON_Y, Math.cos(a) * (SEAT_RING - 1.75));
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial({ color: 0xffb35c, transparent: true, opacity: 0.55, toneMapped: false }));
    cube.rotation.set(Math.PI / 4, 0, Math.PI / 4);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(cube.geometry), new THREE.LineBasicMaterial({ color: 0xffe2b0, toneMapped: false }));
    cube.add(edges);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffb35c, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(0.7);
    // A larger invisible sphere makes the holocron easy to click or tap.
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.topic = id;
    holder.add(cube, halo, hit);
    group.add(holder);
    return { id, seat, holder, cube, halo, hit, world: new THREE.Vector3() };
  });
  const vault = createCertVault(glow);
  group.add(vault.group);
  const light = new THREE.PointLight(0xffd8ae, 40, 30, 1.3);
  light.position.set(0, 5.6, 0);
  group.add(light);
  group.updateMatrixWorld(true);
  topics.forEach((topic) => topic.holder.getWorldPosition(topic.world));

  // Walkable: the room inside the seats, the doorway, the bridge and the platform, less the taxi.
  const walk = createWalkArea(group.position, yaw, [
    { kind: "disc", x: 0, z: 0, r: 7.2 },
    { kind: "rect", x: 0, z: 9.4, hx: 1.05, hz: 2.4 },
    { kind: "rect", x: 0, z: 14.4, hx: 1.45, hz: 4.6 },
    { kind: "disc", x: 0, z: 25.5, r: 6.9 },
  ]);
  walk.setBlocks([
    { x: 0, z: 27, hx: 1.5, hz: 3.4 },
    { x: 0, z: 0, hx: 0.55, hz: 0.55 },
  ]);

  let reveal = 0,
    target = 0,
    focused: CouncilTopic | null = null;
  return {
    group,
    walk,
    topics,
    pickables: [...topics.map((topic) => topic.hit), vault.hit],
    // A spot in the room, in world space: local x and z, at eye height.
    point: (x: number, z: number, y = 0) => new THREE.Vector3(x, y, z).applyMatrix4(group.matrixWorld),
    seatWorld: (topic: CouncilTopic) => {
      if (topic === "certifs") return vault.centre.clone().applyMatrix4(group.matrixWorld);
      const a = seatAngle(TOPIC_SEATS[topic]);
      return new THREE.Vector3(Math.sin(a) * SEAT_RING, 1.3, Math.cos(a) * SEAT_RING).applyMatrix4(group.matrixWorld);
    },
    setPresence: (on: boolean) => (target = on ? 1 : 0),
    focus: (topic: CouncilTopic | null) => {
      focused = topic;
      vault.setOpen(topic === "certifs");
    },
    tick: (dt: number, elapsed: number, reduced: boolean, viewer?: THREE.Vector3) => {
      reveal = reduced ? target : THREE.MathUtils.damp(reveal, target, 1.6, dt);
      if (viewer) group.worldToLocal(lookAt.copy(viewer));
      const speakerSeat = focused === null || focused === "certifs" ? -1 : TOPIC_SEATS[focused];
      if (speakerSeat >= 0) {
        const a = seatAngle(speakerSeat);
        speakerAt.set(Math.sin(a) * SEAT_RING, 1.3, Math.cos(a) * SEAT_RING);
      }
      // When the vault opens, the whole Council turns to look at it.
      const watching = focused === "certifs";
      vault.tick(dt, elapsed, reduced, reveal);
      members.forEach((member) => {
        const speaking = speakerSeat === member.seat;
        if (member.hologram) {
          const u = member.hologram.uniforms;
          u.time.value = elapsed;
          u.reveal.value = THREE.MathUtils.clamp(reveal * 1.6 - member.delay * reveal, 0, 1);
          u.focus.value = THREE.MathUtils.damp(u.focus.value, speaking ? 1 : 0, 4, dt);
        }
        // While the visitor is in the room, heads turn: to the visitor, or to the member speaking.
        // Outside it they rest, facing the centre.
        const p = member.group.position,
          aim = watching ? vault.centre : speakerSeat >= 0 && !speaking ? speakerAt : lookAt;
        const dx = aim.x - p.x,
          dz = aim.z - p.z;
        let yaw = 0,
          pitch = 0;
        if (reveal > 0.3 && viewer) {
          yaw = THREE.MathUtils.clamp(THREE.MathUtils.euclideanModulo(Math.atan2(dx, dz) - member.forward + Math.PI, Math.PI * 2) - Math.PI, -0.75, 0.75);
          pitch = THREE.MathUtils.clamp(-Math.atan2(aim.y - p.y - 0.85, Math.hypot(dx, dz)), -0.2, 0.25);
        }
        const idle = reduced ? 0 : Math.sin(elapsed * 0.31 + member.phase) * 0.05;
        member.yaw = reduced ? yaw : THREE.MathUtils.damp(member.yaw, yaw, 2.2, dt);
        member.pitch = reduced ? pitch : THREE.MathUtils.damp(member.pitch, pitch, 2.2, dt);
        member.head.rotation.set(member.pitch, member.yaw + idle, 0, "YXZ");
        // A slow breath.
        member.trunk.scale.y = reduced ? 1 : 1 + Math.sin(elapsed * 0.9 + member.phase) * 0.006;
      });
      topics.forEach((topic, i) => {
        const spin = reduced ? 0 : elapsed * 0.8 + i;
        topic.cube.rotation.y = spin;
        topic.holder.position.y = HOLOCRON_Y + (reduced ? 0 : Math.sin(elapsed * 1.4 + i) * 0.06);
        const lit = focused === topic.id ? 1 : 0.55;
        topic.halo.material.opacity = THREE.MathUtils.damp(topic.halo.material.opacity, lit * reveal, 4, dt);
        (topic.cube.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.5 * reveal;
      });
    },
  };
}
export type CouncilChamber = ReturnType<typeof createCouncilChamber>;
