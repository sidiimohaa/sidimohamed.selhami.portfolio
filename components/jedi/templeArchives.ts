import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { education } from "../deathStar/cvData";
import { chosenTier } from "../render/pipeline";
import { createSaber } from "./cloneTrooperModel";
import { createDrift, holobooks, stoneMap } from "./orderEscapeWorld";

// The Jedi Archives, as the reward for reaching Master: long walls of glowing tapes under a vaulted
// roof, a gallery above them, the bronze busts of the Lost Twenty, and a great window of evening light
// at the far end, with Yoda waiting in front of it. Four relics stand along the aisle, and each comes
// alive when it is chosen.

const NEAR_Z = 11;
const FAR_Z = -18;
const WALL_X = 5.1;
const BAY = 3.3;
export const YODA_SPOT = new THREE.Vector3(0, 0, -8);
export const RELIC_SPOTS = {
  archives: new THREE.Vector3(2.5, 0, -2.6),
  kyber: new THREE.Vector3(-2.5, 0, -2.6),
  council: new THREE.Vector3(2.95, 0, -5.9),
  holocron: new THREE.Vector3(-2.95, 0, -5.9),
};
export type RelicId = keyof typeof RELIC_SPOTS;

export function createTempleArchives(glow: THREE.Texture) {
  const group = new THREE.Group();
  group.name = "jedi-archives";
  const length = NEAR_Z - FAR_Z,
    middle = (NEAR_Z + FAR_Z) / 2;
  const map = stoneMap();
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const stone = new THREE.MeshStandardMaterial({ color: 0xb79f7e, map, roughness: 0.72 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a2c20, map, roughness: 0.82 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0xa97c43, roughness: 0.36, metalness: 0.8 });
  const warm = new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false });
  const add = <T extends THREE.Object3D>(item: T) => {
    group.add(item);
    return item;
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material = stone) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    return add(mesh);
  };
  // A polished floor: a true mirror where the machine can afford it, with a dark runner down the aisle.
  let mirror: Reflector | null = null;
  if (chosenTier() >= 2) {
    mirror = new Reflector(new THREE.PlaneGeometry(WALL_X * 2, length), { textureWidth: 1024, textureHeight: 1024, color: 0x8f8a82, clipBias: 0.002 });
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.set(0, 0, middle);
    add(mirror);
  }
  const floorMap = map.clone();
  floorMap.repeat.set(3, 9);
  floorMap.needsUpdate = true;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(WALL_X * 2, length), new THREE.MeshStandardMaterial({ color: 0x6a533b, map: floorMap, roughness: 0.3, metalness: 0.2, transparent: !!mirror, opacity: mirror ? 0.7 : 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.004, middle);
  add(floor);
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(2.3, length), new THREE.MeshStandardMaterial({ color: 0x4a2d1c, roughness: 0.4, transparent: !!mirror, opacity: mirror ? 0.72 : 1 }));
  runner.rotation.x = -Math.PI / 2;
  runner.position.set(0, 0.008, middle);
  add(runner);
  for (const side of [-1, 1]) {
    const inlay = new THREE.Mesh(new THREE.PlaneGeometry(0.06, length), new THREE.MeshBasicMaterial({ color: 0xc89a5c, toneMapped: false }));
    inlay.rotation.x = -Math.PI / 2;
    inlay.position.set(side * 1.2, 0.012, middle);
    add(inlay);
  }

  // The walls of tapes: two storeys of them, bay after bay, a gallery running along the upper one.
  const tapes = holobooks();
  tapes.wrapS = tapes.wrapT = THREE.RepeatWrapping;
  tapes.repeat.set(0.62, 1);
  const shelves = new THREE.MeshBasicMaterial({ map: tapes, toneMapped: false });
  const bays = Math.ceil(length / BAY);
  const bustSpots: THREE.Vector3[] = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i <= bays; i++) {
      const z = NEAR_Z - i * BAY;
      for (const [y, h] of [
        [2.35, 4.1],
        [6.55, 3.3],
      ]) {
        const rack = new THREE.Mesh(new THREE.PlaneGeometry(BAY - 0.55, h), shelves);
        rack.position.set(side * WALL_X, y, z - BAY / 2);
        rack.rotation.y = -side * (Math.PI / 2);
        add(rack);
      }
      // Pilasters between the bays, each with its warm lamp, and a bust before it.
      box(0.62, 9.4, 0.62, side * (WALL_X - 0.2), 4.7, z);
      box(0.88, 0.5, 0.88, side * (WALL_X - 0.24), 0.25, z, dark);
      box(0.1, 1.5, 0.16, side * (WALL_X - 0.53), 6.6, z, warm);
      if (z < NEAR_Z - 1 && z > FAR_Z + 1) bustSpots.push(new THREE.Vector3(side * (WALL_X - 1.02), 0, z));
    }
    box(0.5, 0.25, length, side * (WALL_X - 0.08), 4.6, middle, dark);
    box(1, 0.16, length, side * (WALL_X - 0.55), 4.72, middle, stone);
    box(0.08, 0.72, length, side * (WALL_X - 1.02), 5.16, middle, bronze);
    box(1.2, 0.5, length, side * (WALL_X + 0.4), 0.25, middle, dark);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(length, 10), dark);
    back.position.set(side * (WALL_X + 0.1), 5, middle);
    back.rotation.y = -side * (Math.PI / 2);
    add(back);
  }
  // The vault, with a rib over every bay and a long skylight down its spine.
  const vault = new THREE.Mesh(new THREE.CylinderGeometry(WALL_X + 0.1, WALL_X + 0.1, length, 32, 1, true, Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: 0x57412d, map, roughness: 0.84, side: THREE.BackSide }));
  vault.rotation.x = Math.PI / 2;
  vault.position.set(0, 9.2, middle);
  add(vault);
  for (let i = 0; i <= bays; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(WALL_X - 0.05, 0.13, 8, 32, Math.PI), dark);
    rib.position.set(0, 9.2, NEAR_Z - i * BAY);
    add(rib);
  }
  const skylight = new THREE.Mesh(new THREE.PlaneGeometry(0.9, length), new THREE.MeshBasicMaterial({ color: 0xffdca8, toneMapped: false }));
  skylight.rotation.x = Math.PI / 2;
  skylight.position.set(0, 14.2, middle);
  add(skylight);

  // The bronze busts of the Lost Twenty, one look-alike after another down the aisle.
  const transform = (geometry: THREE.BufferGeometry, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz)));
  // Each has a real face: brow, nose, jaw and ears, over a robed chest cut square at the bottom. Every
  // other one is bearded, so that the row does not read as one man repeated.
  const headParts = () => [
    transform(new THREE.SphereGeometry(0.155, 20, 16), 0, 2.33, 0, 0.92, 1.16, 1.04),
    transform(new THREE.SphereGeometry(0.11, 16, 12), 0, 2.2, 0.035, 1, 0.9, 1),
    transform(new THREE.SphereGeometry(0.1, 14, 8), 0, 2.365, 0.1, 1.05, 0.2, 0.55),
    transform(new THREE.BoxGeometry(0.036, 0.09, 0.05), 0, 2.31, 0.155),
    transform(new THREE.SphereGeometry(0.02, 8, 6), 0, 2.27, 0.172, 1.2, 0.8, 1),
    transform(new THREE.SphereGeometry(0.028, 8, 6), -0.145, 2.32, -0.01, 0.5, 1.2, 0.8),
    transform(new THREE.SphereGeometry(0.028, 8, 6), 0.145, 2.32, -0.01, 0.5, 1.2, 0.8),
    transform(new THREE.CylinderGeometry(0.07, 0.085, 0.16, 12), 0, 2.08, 0),
    // Shoulders, and the folds of the robe crossing on the chest.
    transform(new THREE.SphereGeometry(0.3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.86, 0, 1, 0.56, 0.56),
    transform(new THREE.CylinderGeometry(0.3, 0.27, 0.12, 20), 0, 1.8, 0, 1, 1, 0.56),
    transform(new THREE.BoxGeometry(0.03, 0.16, 0.022), -0.04, 1.92, 0.155),
    transform(new THREE.BoxGeometry(0.03, 0.16, 0.022), 0.04, 1.92, 0.155),
  ];
  const plainBust = mergeGeometries(headParts())!;
  const beardedBust = mergeGeometries([...headParts(), transform(new THREE.SphereGeometry(0.09, 14, 10), 0, 2.17, 0.085, 1, 1.3, 0.7)])!;
  const bronzeBust = new THREE.MeshStandardMaterial({ color: 0x8f6f45, roughness: 0.72, metalness: 0.32 });
  const evenBusts = new THREE.InstancedMesh(plainBust, bronzeBust, Math.ceil(bustSpots.length / 2));
  const oddBusts = new THREE.InstancedMesh(beardedBust, bronzeBust, Math.floor(bustSpots.length / 2));
  const columns = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.3, 1.74, 18), stone, bustSpots.length);
  const matrix = new THREE.Matrix4();
  const quarter = new THREE.Quaternion();
  bustSpots.forEach((spot, index) => {
    // Each faces the aisle.
    quarter.setFromAxisAngle(new THREE.Vector3(0, 1, 0), spot.x > 0 ? -Math.PI / 2 : Math.PI / 2);
    matrix.compose(spot, quarter, new THREE.Vector3(1, 1, 1));
    (index % 2 ? oddBusts : evenBusts).setMatrixAt(Math.floor(index / 2), matrix);
    matrix.makeTranslation(spot.x, 0.87, spot.z);
    columns.setMatrixAt(index, matrix);
  });
  evenBusts.frustumCulled = oddBusts.frustumCulled = false;
  add(evenBusts);
  add(oddBusts);
  columns.frustumCulled = false;
  add(columns);

  // The far wall: a tall window of evening light over the city, and a low dais in front of it.
  const lightMap = (() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 512;
    const c = canvas.getContext("2d")!;
    const sky = c.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, "#ffd9a0");
    sky.addColorStop(0.55, "#ffbf7a");
    sky.addColorStop(1, "#f08f4e");
    c.fillStyle = sky;
    c.fillRect(0, 0, 256, 512);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  })();
  box(WALL_X * 2 + 1, 15, 0.7, 0, 7.5, FAR_Z - 0.35, dark);
  const windowPane = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 9.6), new THREE.MeshBasicMaterial({ map: lightMap, color: 0xb8b0a4, toneMapped: false, fog: false }));
  windowPane.position.set(0, 5.2, FAR_Z + 0.02);
  add(windowPane);
  for (const x of [-1.47, 0, 1.47]) box(0.13, 9.6, 0.1, x, 5.2, FAR_Z + 0.08, dark);
  for (const y of [2.3, 4.8, 7.3]) box(4.4, 0.13, 0.1, 0, y, FAR_Z + 0.08, dark);
  const shaft = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 12), new THREE.MeshBasicMaterial({ color: 0xffb873, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
  shaft.position.set(0, 3.6, (FAR_Z + YODA_SPOT.z) / 2 + 2);
  shaft.rotation.x = -1.1;
  add(shaft);
  const dais = add(new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.95, 0.36, 40), stone));
  dais.position.set(YODA_SPOT.x, 0.18, YODA_SPOT.z);
  const daisEdge = add(new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.022, 6, 64), new THREE.MeshBasicMaterial({ color: 0xc89a5c, toneMapped: false })));
  daisEdge.rotation.x = Math.PI / 2;
  daisEdge.position.set(YODA_SPOT.x, 0.37, YODA_SPOT.z);

  // Warm from the window and the roof, blue from the tapes.
  add(new THREE.HemisphereLight(0xffe2b8, 0x2a1b10, 0.95));
  const evening = new THREE.DirectionalLight(0xffc48a, 1.5);
  evening.position.set(0, 8, FAR_Z);
  evening.target.position.set(0, 0, 4);
  add(evening);
  add(evening.target);
  const fromWindow = new THREE.PointLight(0xffb36e, 40, 16, 1.7);
  fromWindow.position.set(0, 4, YODA_SPOT.z - 2.5);
  add(fromWindow);
  for (const [x, z] of [
    [-3.6, 2],
    [3.6, 2],
    [-3.6, -6],
    [3.6, -6],
  ]) {
    const tapeLight = new THREE.PointLight(0x5fb4ff, 7, 7, 1.8);
    tapeLight.position.set(x, 2.4, z);
    add(tapeLight);
  }
  const motes = createDrift(glow, 28, 0xffe6bf, 0.5, THREE.AdditiveBlending);
  add(motes.group);
  return {
    group,
    tick(dt: number) {
      motes.tick(dt, (out) => {
        out.set((Math.random() - 0.5) * 8, 0.4 + Math.random() * 5, 4 - Math.random() * 15);
        return 0.03 + Math.random() * 0.04;
      });
    },
    dispose() {
      mirror?.dispose();
    },
  };
}

const additive = (color: number, opacity: number) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
const pedestalMaterial = () => new THREE.MeshStandardMaterial({ color: 0x8f7a5e, roughness: 0.6 });
const smooth = (value: number, from: number, to: number) => THREE.MathUtils.smoothstep(value, from, to);

function pedestal(group: THREE.Group, height: number) {
  const stone = pedestalMaterial();
  const trim = new THREE.MeshStandardMaterial({ color: 0xa97c43, roughness: 0.36, metalness: 0.8 });
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.16, 28), stone);
  foot.position.y = 0.08;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, height - 0.26, 22), stone);
  shaft.position.y = height / 2;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.1, 28), trim);
  top.position.y = height - 0.05;
  group.add(foot, shaft, top);
}

// The holocron: bronze edges and glowing panels. Chosen, its faces open like petals and its gatekeeper
// rises from the light inside.
function createHolocron(glow: THREE.Texture) {
  const group = new THREE.Group();
  group.position.copy(RELIC_SPOTS.holocron);
  pedestal(group, 0.98);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#07243e";
  c.fillRect(0, 0, 128, 128);
  c.strokeStyle = "#8ed8ff";
  c.lineWidth = 3;
  c.strokeRect(18, 18, 92, 92);
  c.beginPath();
  c.moveTo(64, 18);
  c.lineTo(64, 110);
  c.moveTo(18, 64);
  c.lineTo(110, 64);
  c.moveTo(34, 34);
  c.lineTo(94, 94);
  c.moveTo(94, 34);
  c.lineTo(34, 94);
  c.stroke();
  c.strokeStyle = "#c89a5c";
  c.lineWidth = 8;
  c.strokeRect(4, 4, 120, 120);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const faceMaterial = new THREE.MeshStandardMaterial({ map, emissive: 0x4ab4ff, emissiveMap: map, emissiveIntensity: 1.1, roughness: 0.3, metalness: 0.5, side: THREE.DoubleSide });
  const cube = new THREE.Group();
  cube.position.y = 1.36;
  group.add(cube);
  const S = 0.17;
  // Each face hangs from its lower edge, so that opening it lets it fall outwards.
  const faces = [0, 1, 2, 3].map((quarter) => {
    const side = new THREE.Group();
    side.rotation.y = (quarter * Math.PI) / 2;
    cube.add(side);
    const hinge = new THREE.Group();
    hinge.position.set(0, -S, S);
    side.add(hinge);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(S * 2, S * 2), faceMaterial);
    face.position.y = S;
    hinge.add(face);
    return hinge;
  });
  const floorFace = new THREE.Mesh(new THREE.PlaneGeometry(S * 2, S * 2), faceMaterial);
  floorFace.rotation.x = Math.PI / 2;
  floorFace.position.y = -S;
  cube.add(floorFace);
  const lid = new THREE.Group();
  lid.position.y = S;
  cube.add(lid);
  const lidFace = new THREE.Mesh(new THREE.PlaneGeometry(S * 2, S * 2), faceMaterial);
  lidFace.rotation.x = -Math.PI / 2;
  lid.add(lidFace);
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x9fe0ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  core.scale.setScalar(0.5);
  cube.add(core);
  // The gatekeeper: a small hooded shade of light.
  const shade = additive(0x8fd8ff, 0.35);
  const sleeve = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.15, 10, 1, true), shade);
  const keeper = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 14, 1, true), shade);
  robe.position.y = 0.16;
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 10), shade);
  hood.position.y = 0.36;
  const sleeveTwo = sleeve.clone();
  sleeve.position.set(-0.075, 0.2, 0.03);
  sleeve.rotation.z = 0.5;
  sleeveTwo.position.set(0.075, 0.2, 0.03);
  sleeveTwo.rotation.z = -0.5;
  keeper.add(robe, hood, sleeve, sleeveTwo);
  keeper.position.y = 1.2;
  group.add(keeper);
  const light = new THREE.PointLight(0x6fc4ff, 1.2, 4, 2);
  light.position.y = 1.5;
  group.add(light);
  return {
    group,
    tick(k: number, time: number, reduced: boolean) {
      const spin = reduced ? 0.5 : time * 0.42;
      cube.rotation.y = spin * (1 - k * 0.8);
      cube.rotation.x = (reduced ? 0.3 : Math.sin(time * 0.6) * 0.14) * (1 - k);
      cube.position.y = 1.36 + (reduced ? 0 : Math.sin(time * 1.4) * 0.02) + k * 0.1;
      faces.forEach((hinge) => (hinge.rotation.x = k * 1.95));
      lid.position.y = S + k * 0.45;
      lid.rotation.y = k * 1.2;
      (core.material as THREE.SpriteMaterial).opacity = k * 0.95;
      core.scale.setScalar(0.3 + k * 0.5);
      faceMaterial.emissiveIntensity = 1.1 + k * 0.6;
      keeper.visible = k > 0.25;
      keeper.position.y = 1.2 + smooth(k, 0.25, 1) * 0.42;
      keeper.scale.setScalar(Math.max(0.01, smooth(k, 0.25, 1)));
      keeper.rotation.y = reduced ? 0 : time * 0.4;
      shade.opacity = (reduced ? 0.34 : 0.3 + Math.sin(time * 17) * 0.05) * smooth(k, 0.25, 1);
      light.intensity = 1.2 + k * 5;
    },
  };
}

// The kyber crystal: it lifts and sings, the hilt closes round it, and the blade lights.
function createKyber(glow: THREE.Texture) {
  const group = new THREE.Group();
  group.position.copy(RELIC_SPOTS.kyber);
  pedestal(group, 0.98);
  const crystalGeometry = new THREE.OctahedronGeometry(0.075, 0);
  crystalGeometry.scale(1, 2.3, 1);
  const crystal = new THREE.Mesh(crystalGeometry, new THREE.MeshStandardMaterial({ color: 0x8fdcff, emissive: 0x3fb4ff, emissiveIntensity: 1.5, roughness: 0.08, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.94 }));
  group.add(crystal);
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x62c4ff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  group.add(aura);
  // The two halves of the hilt, waiting on either side.
  const steel = new THREE.MeshStandardMaterial({ color: 0xaeb4ba, roughness: 0.26, metalness: 0.92, side: THREE.DoubleSide });
  const black = new THREE.MeshStandardMaterial({ color: 0x16181b, roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide });
  const halves = [-1, 1].map((side) => {
    const half = new THREE.Group();
    half.rotation.y = side > 0 ? 0 : Math.PI;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.34, 18, 1, false, 0, Math.PI), steel);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.041, 0.16, 18, 1, true, 0, Math.PI), black);
    grip.position.y = -0.06;
    const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.04, 0.05, 18, 1, true, 0, Math.PI), steel);
    shroud.position.y = 0.17;
    half.add(body, grip, shroud);
    group.add(half);
    return { half, side };
  });
  const saber = createSaber(0x4aa6ff, 1.05);
  saber.group.children[0].visible = false;
  saber.setExtended(0);
  group.add(saber.group);
  const light = new THREE.PointLight(0x62b4ff, 1, 4.5, 2);
  group.add(light);
  return {
    group,
    tick(k: number, time: number, reduced: boolean) {
      const lift = smooth(k, 0, 0.35);
      const y = THREE.MathUtils.lerp(1.2, 1.5, lift) + (reduced ? 0 : Math.sin(time * 1.5) * 0.012);
      crystal.position.y = y;
      crystal.rotation.y = reduced ? 0.4 : time * (0.5 + k * 2.2);
      aura.position.y = y;
      const pulse = reduced ? 1 : 1 + Math.sin(time * 6) * 0.08 * (0.3 + k);
      aura.scale.setScalar((0.45 + lift * 0.3) * pulse);
      const close = smooth(k, 0.3, 0.7);
      halves.forEach(({ half, side }) => {
        half.visible = k > 0.28;
        half.position.set(side * (0.42 * (1 - close)), y, 0);
      });
      const blade = smooth(k, 0.72, 0.92);
      saber.group.position.y = y + 0.19;
      saber.setExtended(blade);
      light.position.y = y + blade * 0.5;
      light.intensity = 1 + lift * 2 + blade * 5;
    },
  };
}

// A seat of the High Council: a padded egg of pale wood. Chosen, it lights, and the eleven other seats
// rise round it in light.
function createCouncilSeat(glow: THREE.Texture) {
  const group = new THREE.Group();
  group.position.copy(RELIC_SPOTS.council);
  group.rotation.y = -0.72;
  const wood = new THREE.MeshStandardMaterial({ color: 0xcfb78e, roughness: 0.55, side: THREE.DoubleSide });
  const padding = new THREE.MeshStandardMaterial({ color: 0x7c5230, roughness: 0.82 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc89a5c, roughness: 0.3, metalness: 0.85 });
  const egg = (scale: number, material: THREE.Material) => {
    const geometry = new THREE.SphereGeometry(0.62 * scale, 28, 20, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.86);
    geometry.scale(1, 1.32, 1);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 1.03 * scale;
    return mesh;
  };
  group.add(egg(1, wood));
  const lining = new THREE.Mesh(new THREE.SphereGeometry(0.58, 24, 16, Math.PI / 2 + 1.05, Math.PI * 2 - 2.1, 0.1, Math.PI * 0.72), padding);
  lining.geometry.scale(1, 1.32, 1);
  lining.position.y = 1.03;
  (lining.material as THREE.MeshStandardMaterial).side = THREE.BackSide;
  group.add(lining);
  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.48, 0.14, 24), padding);
  cushion.position.set(0, 0.56, 0.02);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.44, 0.36, 24), gold);
  foot.position.y = 0.18;
  group.add(cushion, foot);
  // The seats of the others, round this one, in light.
  const hologram = new THREE.LineBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const ring = new THREE.Group();
  ring.position.y = 1.8;
  group.add(ring);
  const shape = new THREE.SphereGeometry(0.11, 9, 6, Math.PI / 2 + 0.9, Math.PI * 2 - 1.8, 0, Math.PI * 0.88);
  shape.scale(1, 1.32, 1);
  const small = new THREE.WireframeGeometry(shape);
  shape.dispose();
  const others = Array.from({ length: 11 }, (_, i) => {
    const seat = new THREE.LineSegments(small, hologram);
    const angle = (i / 11) * Math.PI * 2;
    seat.position.set(Math.cos(angle) * 0.72, 0, Math.sin(angle) * 0.72);
    seat.rotation.y = -angle - Math.PI / 2;
    ring.add(seat);
    return seat;
  });
  const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  glowSprite.position.set(0, 1.2, 0.2);
  glowSprite.scale.setScalar(1.8);
  group.add(glowSprite);
  const light = new THREE.PointLight(0xffd9a0, 0.5, 5, 2);
  light.position.set(0, 1.6, 0.8);
  group.add(light);
  return {
    group,
    tick(k: number, time: number, reduced: boolean) {
      ring.visible = k > 0.05;
      ring.rotation.y = reduced ? 0 : time * 0.16;
      ring.scale.setScalar(Math.max(0.01, smooth(k, 0.05, 0.8)));
      others.forEach((seat, i) => {
        seat.position.y = reduced ? 0 : Math.sin(time * 1.1 + i) * 0.03;
      });
      hologram.opacity = 0.85 * k * (reduced ? 1 : 0.88 + Math.sin(time * 13) * 0.12);
      (glowSprite.material as THREE.SpriteMaterial).opacity = k * 0.4;
      light.intensity = 0.5 + k * 5;
    },
  };
}

// The archive table: closed, a soft cone of light. Chosen, the pilot's studies rise out of it as pages
// of light and turn slowly round it.
function createArchiveTable(glow: THREE.Texture) {
  const group = new THREE.Group();
  group.position.copy(RELIC_SPOTS.archives);
  const stone = pedestalMaterial();
  const trim = new THREE.MeshStandardMaterial({ color: 0xa97c43, roughness: 0.36, metalness: 0.8 });
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.56, 0.86, 28), stone);
  foot.position.y = 0.43;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.72, 0.13, 40), trim);
  top.position.y = 0.92;
  const emitter = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.02, 40), new THREE.MeshBasicMaterial({ color: 0x4fb4f0, toneMapped: false }));
  emitter.position.y = 0.995;
  group.add(foot, top, emitter);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.72, 1.4, 32, 1, true), additive(0x5fbcff, 0.05));
  cone.rotation.x = Math.PI;
  cone.position.y = 1.7;
  group.add(cone);
  const pages = education.map((item, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 150;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "rgba(10,48,82,.72)";
    c.fillRect(0, 0, 720, 150);
    c.strokeStyle = "#8ed8ff";
    c.lineWidth = 3;
    c.strokeRect(3, 3, 714, 144);
    c.fillStyle = "#e6f6ff";
    // Whole titles, in whatever size fits: nothing from the record is cut off.
    let size = 32;
    c.font = `600 ${size}px Arial, Helvetica, sans-serif`;
    while (c.measureText(item.title).width > 672 && size > 15) {
      size -= 1;
      c.font = `600 ${size}px Arial, Helvetica, sans-serif`;
    }
    c.textBaseline = "middle";
    c.fillText(item.title, 24, 54);
    c.fillStyle = "#8ed8ff";
    c.font = "24px Arial, Helvetica, sans-serif";
    c.fillText(item.period, 24, 106);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const page = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    group.add(page);
    return { page, index };
  });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x62c4ff, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  halo.position.y = 1.12;
  halo.scale.set(1.8, 0.7, 1);
  group.add(halo);
  const light = new THREE.PointLight(0x62b4ff, 1, 4.5, 2);
  light.position.y = 1.6;
  group.add(light);
  return {
    group,
    tick(k: number, time: number, reduced: boolean) {
      (cone.material as THREE.MeshBasicMaterial).opacity = 0.05 + k * 0.1;
      pages.forEach(({ page, index }) => {
        const share = index / Math.max(1, pages.length);
        const rise = smooth(k, share * 0.5, share * 0.5 + 0.5);
        const angle = (reduced ? 0 : time * 0.2) + share * Math.PI * 2;
        page.position.set(Math.cos(angle) * 0.3 * rise, 1.05 + rise * (0.5 + index * 0.36), Math.sin(angle) * 0.3 * rise);
        page.scale.set(1.5 * rise + 0.001, 0.31 * rise + 0.001, 1);
        (page.material as THREE.SpriteMaterial).opacity = rise * (reduced ? 1 : 0.9 + Math.sin(time * 11 + index) * 0.1);
      });
      light.intensity = 1 + k * 4;
    },
  };
}

export function createTempleRelics(glow: THREE.Texture) {
  const relics = {
    archives: createArchiveTable(glow),
    kyber: createKyber(glow),
    council: createCouncilSeat(glow),
    holocron: createHolocron(glow),
  };
  const group = new THREE.Group();
  Object.values(relics).forEach((relic) => group.add(relic.group));
  return { group, relics };
}

// Yoda's meditation cushion and his gimer stick, for the dais.
export function createYodaSeat() {
  const group = new THREE.Group();
  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.2, 28), new THREE.MeshStandardMaterial({ color: 0x8a3f2a, roughness: 0.9 }));
  cushion.position.y = 0.46;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.018, 6, 40), new THREE.MeshStandardMaterial({ color: 0xc89a5c, roughness: 0.4, metalness: 0.8 }));
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.46;
  const stick = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.36, 0.56, 0.24), new THREE.Vector3(0.38, 0.8, 0.22), new THREE.Vector3(0.35, 1.06, 0.25), new THREE.Vector3(0.38, 1.2, 0.2)]), 14, 0.013, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 0.9 }),
  );
  group.add(cushion, band, stick);
  return group;
}
