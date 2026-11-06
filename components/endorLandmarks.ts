import * as THREE from "three";
import { random, type Spot } from "./landingKit";
import { speederBike } from "./endorLife";
import { SKY_WINDOW } from "./endorForest";
import { bakePart, part, rounded } from "./tatooineCharacters";

// Landmarks round Endor's clearing, after the reference pictures: the battle station hanging pale
// in the sky beyond the take-off corridor, the Imperial bunker swallowed by moss at the end of a
// dirt path from the clearing, and wrecked speeder bikes with scout helmets along that path.
export const BUNKER = new THREE.Vector3(0, 0, -46);
export const WRECKS = [new THREE.Vector3(-2.6, 0, -30), new THREE.Vector3(3, 0, -35.5)];

// The battle station as it looks by day: a pale, hazy disc with its dish and equatorial trench.
function stationTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const c = canvas.getContext("2d")!,
    rand = random(1983);
  c.save();
  c.beginPath();
  c.arc(256, 256, 240, 0, Math.PI * 2);
  c.clip();
  const shade = c.createRadialGradient(200, 190, 40, 256, 256, 250);
  shade.addColorStop(0, "#e4eaee");
  shade.addColorStop(0.75, "#b9c4cc");
  shade.addColorStop(1, "#8d9aa4");
  c.fillStyle = shade;
  c.fillRect(0, 0, 512, 512);
  // Panel blocks, faint at this distance.
  for (let i = 0; i < 900; i++) {
    c.fillStyle = rand() < 0.5 ? "rgba(90,104,116,.18)" : "rgba(255,255,255,.12)";
    c.fillRect(rand() * 512, rand() * 512, 3 + rand() * 14, 2 + rand() * 4);
  }
  c.fillStyle = "rgba(70,84,96,.55)";
  c.fillRect(0, 262, 512, 7);
  // The dish, set in the upper hemisphere.
  const dish = c.createRadialGradient(176, 166, 4, 170, 160, 62);
  dish.addColorStop(0, "#c7d0d6");
  dish.addColorStop(0.6, "#8c99a3");
  dish.addColorStop(1, "#b2bdc5");
  c.fillStyle = dish;
  c.beginPath();
  c.arc(170, 160, 60, 0, Math.PI * 2);
  c.fill();
  c.restore();
  // Soft edge, so it sits in the haze rather than being cut out of it.
  const edge = c.createRadialGradient(256, 256, 226, 256, 256, 246);
  edge.addColorStop(0, "rgba(0,0,0,0)");
  edge.addColorStop(1, "rgba(0,0,0,1)");
  c.globalCompositeOperation = "destination-out";
  c.fillStyle = edge;
  c.fillRect(0, 0, 512, 512);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

// Packed earth with roots across it, fading out at the edges.
function trailTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 512;
  const c = canvas.getContext("2d")!,
    rand = random(7);
  for (let i = 0; i < 1400; i++) {
    const x = 64 + (rand() - 0.5) * 120 * Math.sqrt(rand());
    c.fillStyle = rand() < 0.5 ? "rgba(92,66,40,.5)" : "rgba(120,90,58,.45)";
    c.fillRect(x, rand() * 512, 2 + rand() * 5, 2 + rand() * 4);
  }
  c.strokeStyle = "rgba(60,40,24,.6)";
  c.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const y = rand() * 512;
    c.beginPath();
    c.moveTo(0, y);
    c.bezierCurveTo(40, y + 10, 90, y - 10, 128, y + 6);
    c.stroke();
  }
  const fade = c.createLinearGradient(0, 0, 128, 0);
  fade.addColorStop(0, "rgba(0,0,0,1)");
  fade.addColorStop(0.3, "rgba(0,0,0,0)");
  fade.addColorStop(0.7, "rgba(0,0,0,0)");
  fade.addColorStop(1, "rgba(0,0,0,1)");
  c.globalCompositeOperation = "destination-out";
  c.fillStyle = fade;
  c.fillRect(0, 0, 128, 512);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

// Weathered armoured concrete: panel seams, rain streaks and blotches.
function concreteTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d")!,
    rand = random(51);
  c.fillStyle = "#8a908a";
  c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 120; i++) {
    const r = 6 + rand() * 30;
    c.fillStyle = rand() < 0.6 ? "rgba(60,66,58,.12)" : "rgba(200,206,196,.1)";
    c.beginPath();
    c.arc(rand() * 256, rand() * 256, r, 0, Math.PI * 2);
    c.fill();
  }
  for (let i = 0; i < 60; i++) {
    c.fillStyle = "rgba(48,54,44,.18)";
    c.fillRect(rand() * 256, rand() * 120, 1 + rand() * 3, 40 + rand() * 120);
  }
  c.fillStyle = "rgba(40,44,40,.5)";
  for (let k = 0; k < 256; k += 64) {
    c.fillRect(k, 0, 2, 256);
    c.fillRect(0, k, 256, 2);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 2);
  return map;
}
// Moss hanging in ragged curtains, cut out by alpha.
function mossTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const c = canvas.getContext("2d")!,
    rand = random(52);
  c.clearRect(0, 0, 256, 128);
  for (let x = 0; x < 256; x += 3) {
    const drop = 30 + rand() * 90 * (0.5 + 0.5 * Math.sin(x * 0.05));
    c.fillStyle = rand() < 0.5 ? "#3e5a24" : "#4f6e2c";
    c.fillRect(x, 0, 3 + rand() * 3, drop);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}
// A scout trooper's helmet, left in the ferns.
function helmet() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xe6e4dc, roughness: 0.4, metalness: 0.1 });
  const black = new THREE.MeshStandardMaterial({ color: 0x111416, roughness: 0.3 });
  part(g, new THREE.SphereGeometry(0.17, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), white, [0, 0.1, 0]);
  part(g, rounded(0.3, 0.06, 0.2, 0.02), white, [0, 0.17, 0.06]);
  part(g, rounded(0.24, 0.06, 0.05, 0.02), black, [0, 0.08, 0.15]);
  part(g, new THREE.ConeGeometry(0.06, 0.12, 6), white, [0, 0.0, 0.16], [Math.PI / 2 + 0.3, 0, 0]);
  bakePart(g);
  return g;
}

export function createEndorLandmarks(colliders: Spot[]) {
  const group = new THREE.Group();
  group.name = "endor-landmarks";
  // The station, low over the forest beyond the take-off corridor, where the trees open.
  const station = new THREE.Sprite(new THREE.SpriteMaterial({ map: stationTexture(), color: 0xf2f6f8, transparent: true, opacity: 0.78, depthWrite: false, fog: false }));
  const elevation = THREE.MathUtils.degToRad(34),
    azimuth = SKY_WINDOW.azimuth;
  station.position.set(Math.sin(azimuth) * Math.cos(elevation) * 900, Math.sin(elevation) * 900, Math.cos(azimuth) * Math.cos(elevation) * 900);
  station.scale.setScalar(165);
  station.renderOrder = -1;
  group.add(station);

  // The trail from the clearing to the bunker.
  const trail = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 26).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: trailTexture(), transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),
  );
  trail.position.set(0, 0.012, -33);
  group.add(trail);

  // The bunker: sloped armoured walls, a recessed blast door, vents, and moss over everything.
  const concrete = new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.92, metalness: 0.08 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x2a2f31, roughness: 0.6, metalness: 0.6 });
  const moss = new THREE.MeshStandardMaterial({ color: 0x4a6a2a, roughness: 1 });
  const bunker = new THREE.Group();
  bunker.position.copy(BUNKER);
  group.add(bunker);
  const profile = new THREE.Shape();
  profile.moveTo(-7.5, 0);
  profile.lineTo(7.5, 0);
  profile.lineTo(5.8, 5.2);
  profile.lineTo(-5.8, 5.2);
  profile.closePath();
  part(bunker, new THREE.ExtrudeGeometry(profile, { depth: 11, bevelEnabled: false }), concrete, [0, 0, -5.5]);
  part(bunker, rounded(12.4, 0.6, 11.6, 0.15), concrete, [0, 5.4, 0]);
  // The front: a recessed doorway framed by angled buttresses.
  part(bunker, rounded(4.6, 3.6, 1.2, 0.1), darkSteel, [0, 1.8, 5.2]);
  part(bunker, rounded(3.6, 3, 0.2, 0.05), new THREE.MeshStandardMaterial({ color: 0x0c0f10, roughness: 1 }), [0, 1.5, 5.82]);
  for (const side of [-1, 1]) {
    part(bunker, rounded(1.2, 4.6, 1.6, 0.1), concrete, [side * 3.4, 2.3, 5.3], [0, 0, side * 0.12]);
    for (let v = 0; v < 3; v++) part(bunker, rounded(0.9, 0.18, 0.1, 0.03), darkSteel, [side * 5.4, 1.4 + v * 0.5, 5.56], [0, 0, side * -0.32]);
  }
  part(bunker, rounded(4, 0.5, 0.4, 0.08), concrete, [0, 3.95, 5.6]);
  // Moss in thick mats over the roof and spilling down the front.
  const rand = random(46);
  for (let i = 0; i < 14; i++)
    part(bunker, new THREE.SphereGeometry(1, 12, 8), moss, [(rand() - 0.5) * 11, 5.6, (rand() - 0.5) * 10]).scale.set(1.6 + rand() * 1.8, 0.35 + rand() * 0.3, 1.4 + rand() * 1.6);
  for (let i = 0; i < 26; i++) part(bunker, new THREE.IcosahedronGeometry(0.35 + rand() * 0.4, 0), moss, [(rand() - 0.5) * 12, 5.55, 5.4 + rand() * 0.5], [rand(), rand(), rand()]);
  bakePart(bunker);
  // Curtains of moss spilling over the roof edge and down the front.
  const curtain = new THREE.MeshStandardMaterial({ map: mossTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 });
  for (const [x, width, drop] of [[-4.8, 3, 2.6], [-1.2, 2.4, 1.4], [2.6, 3.4, 2.2], [5.6, 1.8, 3]]) {
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(width, drop), curtain);
    sheet.position.set(BUNKER.x + x, BUNKER.y + 5.6 - drop / 2, BUNKER.z + 5.66);
    group.add(sheet);
  }

  // Two speeder bikes wrecked along the trail, and scout helmets in the ferns.
  const wrecks = WRECKS.map((at, i) => {
    const { root } = speederBike(false);
    root.position.copy(at).setY(i ? 0.5 : 0.35);
    root.rotation.set(i ? -0.35 : 0.1, i ? 2.4 : -0.7, i ? 0.25 : 1.25);
    // Dead engines: no exhaust glow.
    root.traverse((o) => {
      if (o instanceof THREE.Sprite) o.visible = false;
    });
    group.add(root);
    colliders.push({ x: at.x, z: at.z, r: 1.6 });
    return root;
  });
  for (const [x, z, turn, tilt] of [
    [-0.9, -31.6, 0.4, 0.3],
    [1.6, -33.2, -1.2, 1.4],
    [-3.8, -28.4, 2.2, 0.2],
    [4.2, -37.4, 0.9, 1.6],
  ]) {
    const h = helmet();
    h.position.set(x, 0.05, z);
    h.rotation.set(tilt, turn, tilt * 0.5);
    group.add(h);
  }
  return { group, wrecks, station };
}
