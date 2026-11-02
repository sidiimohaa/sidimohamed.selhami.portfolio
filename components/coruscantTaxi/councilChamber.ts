import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { COUNCIL, COUNCIL_FACING, COUNCIL_FLOOR } from "./taxiPlaces";
import { createWalkArea } from "./walkArea";

// The Council chamber in the crown of the Temple spire: a round room of warm stone, a polished
// mosaic floor, twelve red seats along tall windows open on the sunset city, and a door to the
// landing platform. The Council sits in holograms; four of them each guard a holocron, one per
// chapter of the visitor's reading. Local +Z points out through the door to the platform.

export type CouncilTopic = "vision" | "quete" | "orientation" | "projets";
export const COUNCIL_TOPICS: CouncilTopic[] = ["vision", "quete", "orientation", "projets"];
const WALL = 10.6,
  HEIGHT = 9.6,
  SEATS = 12,
  SEAT_RING = 8.5;
// Seats go round the room from just past the door, leaving the doorway free.
const seatAngle = (i: number) => THREE.MathUtils.degToRad(26 + (i * 308) / (SEATS - 1));
// The seats whose members hold a holocron: two on each side of the room.
const TOPIC_SEATS: Record<CouncilTopic, number> = { vision: 4, quete: 7, orientation: 2, projets: 9 };
const PRESENT = [1, 2, 4, 5, 7, 9, 10];

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
  ring(1, "#d6a37c");
  ring(0.985, "#5a2a1a");
  ring(0.965, "#e3b892");
  // A fan of five slender leaves.
  const fan = (radius: number, length: number, width: number, angle: number, color: string) => {
    c.save();
    c.rotate(angle);
    c.translate(0, radius * R);
    c.fillStyle = color;
    for (let k = -2; k <= 2; k++) {
      c.save();
      c.rotate(k * 0.26);
      c.beginPath();
      c.moveTo(0, 0);
      c.bezierCurveTo(width * R, length * R * 0.35, width * R * 0.6, length * R * 0.8, 0, length * R);
      c.bezierCurveTo(-width * R * 0.6, length * R * 0.8, -width * R, length * R * 0.35, 0, 0);
      c.fill();
      c.restore();
    }
    c.restore();
  };
  for (let i = 0; i < 28; i++) fan(0.66, 0.24, 0.035, (i / 28) * Math.PI * 2, "#4a2216");
  for (let i = 0; i < 28; i++) fan(0.7, 0.13, 0.02, ((i + 0.5) / 28) * Math.PI * 2, "#8a4a30");
  c.lineWidth = 7;
  c.strokeStyle = "#5a2a1a";
  [0.6, 0.57].forEach((r) => {
    c.beginPath();
    c.arc(0, 0, r * R, 0, Math.PI * 2);
    c.stroke();
  });
  ring(0.5, "#c98f68");
  ring(0.44, "#6e2e1d");
  ring(0.42, "#7c3a24");
  // The medallion: an inner flower of leaves round a small disc.
  for (let i = 0; i < 16; i++) fan(0.06, 0.32, 0.04, (i / 16) * Math.PI * 2, "#b9714b");
  for (let i = 0; i < 16; i++) fan(0.08, 0.2, 0.025, ((i + 0.5) / 16) * Math.PI * 2, "#e0a77d");
  ring(0.07, "#5a2a1a");
  ring(0.05, "#d6a37c");
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

const hologramVertex = `varying vec3 vNormal;varying vec3 vView;varying float vY;
 void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vNormal=normalize(normalMatrix*normal);vView=normalize(-mv.xyz);vY=position.y;gl_Position=projectionMatrix*mv;}`;
const hologramFragment = `uniform float time;uniform float reveal;uniform float focus;uniform vec3 color;varying vec3 vNormal;varying vec3 vView;varying float vY;
 void main(){
  float fres=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),1.5);
  float scan=.62+.38*sin(vY*70.0-time*5.0);
  float flick=.88+.12*sin(time*23.0+vY*4.0);
  float a=(.2+fres*.8)*scan*flick*reveal*(.8+focus*.6);
  gl_FragColor=vec4(color*(.7+fres*.8+focus*.5),a);
 }`;

// A seated, hooded figure, facing +Z, for the hologram members.
function memberGeometry() {
  const robe = new THREE.LatheGeometry(
    [
      [0.5, 0],
      [0.48, 0.15],
      [0.36, 0.55],
      [0.3, 0.8],
      [0.27, 0.86],
      [0.1, 0.92],
      [0, 0.93],
    ].map(([r, y]) => new THREE.Vector2(r, y)),
    18,
  );
  robe.scale(1, 1, 0.8);
  robe.translate(0, 0.5, -0.05);
  const lap = new THREE.BoxGeometry(0.62, 0.22, 0.55);
  lap.translate(0, 0.6, 0.22);
  const head = new THREE.SphereGeometry(0.13, 14, 10);
  head.translate(0, 1.55, 0.02);
  const hood = new THREE.SphereGeometry(0.19, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6);
  hood.rotateX(-0.35);
  hood.translate(0, 1.56, -0.04);
  return mergeGeometries([robe, lap, head, hood].map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => (g.deleteAttribute("uv"), g)));
}

export function createCouncilChamber(glow: THREE.Texture) {
  const group = new THREE.Group();
  group.name = "council-chamber";
  group.position.set(COUNCIL.x, COUNCIL_FLOOR, COUNCIL.z);
  const yaw = Math.atan2(COUNCIL_FACING.x, COUNCIL_FACING.z);
  group.rotation.y = yaw;
  const stone = new THREE.MeshStandardMaterial({ color: 0xc8a684, roughness: 0.62, metalness: 0.08, side: THREE.DoubleSide });
  const plaster = new THREE.MeshStandardMaterial({ color: 0xb48c6c, roughness: 0.8, metalness: 0.02, side: THREE.DoubleSide });
  const velvet = new THREE.MeshStandardMaterial({ color: 0x8c2d22, roughness: 0.86, metalness: 0.02 });
  const shell = new THREE.MeshStandardMaterial({ color: 0xa7a19a, roughness: 0.4, metalness: 0.35 });
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
  const floor = new THREE.Mesh(new THREE.CircleGeometry(WALL, 96), new THREE.MeshStandardMaterial({ map: mosaicTexture(), roughness: 0.3, metalness: 0.12 }));
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
  }
  // Pillars between the bays, leaning in at the top, with warm light along their inner edges.
  for (let b = 0; b < 8; b++) {
    const a = b * BAY + BAY / 2;
    const x = Math.sin(a),
      z = Math.cos(a);
    put(stone, new THREE.BoxGeometry(1.0, HEIGHT - 2.2, 1.1), x * (WALL - 0.3), (HEIGHT - 2.2) / 2, z * (WALL - 0.3), a);
    put(stone, new THREE.BoxGeometry(0.9, 2.6, 1.0), x * (WALL - 0.75), HEIGHT - 1.3, z * (WALL - 0.75), a, -0.32);
    [-1, 1].forEach((side) => put(warm, new THREE.BoxGeometry(0.05, HEIGHT - 2.6, 0.05), x * (WALL - 0.86) + Math.cos(a) * side * 0.5, (HEIGHT - 2.6) / 2 + 0.2, z * (WALL - 0.86) - Math.sin(a) * side * 0.5, a));
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
    const kind = i % 3;
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
      if (kind === 2) put(shell, new THREE.CapsuleGeometry(0.47, 0.05, 6, 16).scale(1, 0.4, 0.5), ...local(0, 0.5 + tall + 0.05, -0.43), turn);
      [-1, 1].forEach((side) => put(shell, new THREE.BoxGeometry(0.16, 0.36, 0.86), ...local(side * 0.54, 0.58, 0), turn));
    }
  }
  batches.forEach((list, material) => group.add(new THREE.Mesh(mergeGeometries(list), material)));

  // The Council, in holograms, in seven of the seats.
  const memberShape = memberGeometry();
  const members = PRESENT.map((seat) => {
    const material = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, reveal: { value: 0 }, focus: { value: 0 }, color: { value: new THREE.Color(0x8fd8ff) } },
      vertexShader: hologramVertex,
      fragmentShader: hologramFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(memberShape, material);
    const a = seatAngle(seat);
    mesh.position.set(Math.sin(a) * (SEAT_RING - 0.05), 0.02, Math.cos(a) * (SEAT_RING - 0.05));
    mesh.rotation.y = a + Math.PI;
    group.add(mesh);
    return { seat, material, delay: seat * 0.13 };
  });

  // Holocrons: an amber cube floating before each speaking member.
  const topics = COUNCIL_TOPICS.map((id) => {
    const seat = TOPIC_SEATS[id],
      a = seatAngle(seat);
    const holder = new THREE.Group();
    holder.position.set(Math.sin(a) * (SEAT_RING - 1.5), 1.55, Math.cos(a) * (SEAT_RING - 1.5));
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), new THREE.MeshBasicMaterial({ color: 0xffb35c, transparent: true, opacity: 0.55, toneMapped: false }));
    cube.rotation.set(Math.PI / 4, 0, Math.PI / 4);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(cube.geometry), new THREE.LineBasicMaterial({ color: 0xffe2b0, toneMapped: false }));
    cube.add(edges);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffb35c, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(1.1);
    // A larger invisible sphere makes the holocron easy to click or tap.
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.topic = id;
    holder.add(cube, halo, hit);
    group.add(holder);
    return { id, seat, holder, cube, halo, hit, world: new THREE.Vector3() };
  });
  const light = new THREE.PointLight(0xffc690, 26, 24, 1.6);
  light.position.set(0, 6.5, 0);
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
  walk.setBlocks([{ x: 0, z: 27, hx: 1.5, hz: 3.4 }]);

  let reveal = 0,
    target = 0,
    focused: CouncilTopic | null = null;
  return {
    group,
    walk,
    topics,
    pickables: topics.map((topic) => topic.hit),
    // A spot in the room, in world space: local x and z, at eye height.
    point: (x: number, z: number, y = 0) => new THREE.Vector3(x, y, z).applyMatrix4(group.matrixWorld),
    seatWorld: (topic: CouncilTopic) => {
      const a = seatAngle(TOPIC_SEATS[topic]);
      return new THREE.Vector3(Math.sin(a) * SEAT_RING, 1.3, Math.cos(a) * SEAT_RING).applyMatrix4(group.matrixWorld);
    },
    setPresence: (on: boolean) => (target = on ? 1 : 0),
    focus: (topic: CouncilTopic | null) => (focused = topic),
    tick: (dt: number, elapsed: number, reduced: boolean) => {
      reveal = reduced ? target : THREE.MathUtils.damp(reveal, target, 1.6, dt);
      members.forEach((member) => {
        const u = member.material.uniforms;
        u.time.value = elapsed;
        u.reveal.value = THREE.MathUtils.clamp(reveal * 1.6 - member.delay * reveal, 0, 1);
        const speaking = focused !== null && TOPIC_SEATS[focused] === member.seat;
        u.focus.value = THREE.MathUtils.damp(u.focus.value, speaking ? 1 : 0, 4, dt);
      });
      topics.forEach((topic, i) => {
        const spin = reduced ? 0 : elapsed * 0.8 + i;
        topic.cube.rotation.y = spin;
        topic.holder.position.y = 1.55 + (reduced ? 0 : Math.sin(elapsed * 1.4 + i) * 0.06);
        const lit = focused === topic.id ? 1 : 0.55;
        topic.halo.material.opacity = THREE.MathUtils.damp(topic.halo.material.opacity, lit * reveal, 4, dt);
        (topic.cube.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.5 * reveal;
      });
    },
  };
}
export type CouncilChamber = ReturnType<typeof createCouncilChamber>;
