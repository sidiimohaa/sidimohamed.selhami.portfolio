import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// The forest of Endor for Speeder Bike Racing: a winding corridor between giant redwoods, trunks
// in the way, checkpoint beacons, an Ewok village at the finish, and the Imperial 74-Z speeder bike
// the pilot rides. The course runs along -z; `centre(d)` is the corridor's middle at distance d.

export const TRACK = 2400;
export const CHECKPOINTS = [600, 1200, 1800];
export const HALF = 9;
export const centre = (d: number) => 14 * Math.sin(d * 0.009) + 5 * Math.sin(d * 0.023 + 1.3);
export type Obstacle = { d: number; x: number; r: number };

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function canvasTexture(width: number, height: number, paint: (c: CanvasRenderingContext2D) => void, repeat: [number, number]) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext("2d")!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = 4;
  return texture;
}

function barkTexture() {
  return canvasTexture(
    128,
    512,
    (c) => {
      c.fillStyle = "#4b2b1c";
      c.fillRect(0, 0, 128, 512);
      for (let i = 0; i < 90; i++) {
        const x = Math.random() * 128,
          w = 1 + Math.random() * 5;
        c.fillStyle = Math.random() < 0.5 ? `rgba(28,14,8,${0.3 + Math.random() * 0.4})` : `rgba(140,82,52,${0.15 + Math.random() * 0.25})`;
        c.fillRect(x, 0, w, 512);
      }
      for (let i = 0; i < 40; i++) {
        c.fillStyle = `rgba(20,10,6,${0.3 + Math.random() * 0.3})`;
        c.fillRect(Math.random() * 128, Math.random() * 512, 2 + Math.random() * 6, 20 + Math.random() * 60);
      }
    },
    [2, 6],
  );
}
function groundTexture() {
  // Forest floor: brown needles and leaf litter, fine and low in contrast, with a little moss.
  return canvasTexture(
    256,
    256,
    (c) => {
      c.fillStyle = "#3b2f20";
      c.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 2600; i++) {
        const tone = Math.random();
        c.strokeStyle = tone < 0.2 ? `rgba(78,92,46,${0.2 + Math.random() * 0.25})` : tone < 0.75 ? `rgba(104,78,50,${0.2 + Math.random() * 0.3})` : `rgba(28,21,13,${0.25 + Math.random() * 0.3})`;
        c.lineWidth = 1 + Math.random() * 1.5;
        const x = Math.random() * 256,
          y = Math.random() * 256,
          a = Math.random() * Math.PI,
          l = 2 + Math.random() * 6;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        c.stroke();
      }
    },
    [60, 480],
  );
}
function shaftTexture() {
  return canvasTexture(
    32,
    256,
    (c) => {
      const g = c.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, "rgba(255,240,200,0.9)");
      g.addColorStop(1, "rgba(255,240,200,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, 32, 256);
      const side = c.createLinearGradient(0, 0, 32, 0);
      side.addColorStop(0, "rgba(0,0,0,1)");
      side.addColorStop(0.5, "rgba(0,0,0,0)");
      side.addColorStop(1, "rgba(0,0,0,1)");
      c.globalCompositeOperation = "destination-out";
      c.fillStyle = side;
      c.fillRect(0, 0, 32, 256);
    },
    [1, 1],
  );
}
function glowTexture() {
  return canvasTexture(
    64,
    64,
    (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.35, "rgba(255,255,255,.45)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
    },
    [1, 1],
  );
}

// A fern: seven drooping fronds round a centre.
function fernGeometry() {
  const fronds: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const shape = new THREE.PlaneGeometry(0.34, 1.5, 1, 4);
    const p = shape.getAttribute("position");
    for (let j = 0; j < p.count; j++) {
      const y = p.getY(j) + 0.75;
      p.setXYZ(j, p.getX(j) * (1 - y / 1.7), Math.sin(y * 1.4) * 0.55 - y * y * 0.12, y);
    }
    shape.rotateY((i / 7) * Math.PI * 2 + Math.random() * 0.4);
    fronds.push(shape);
  }
  const merged = mergeGeometries(fronds)!;
  merged.computeVertexNormals();
  return merged;
}

export function createSpeederBike(trail: string) {
  const bike = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xc8cbc6, roughness: 0.55, metalness: 0.35 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x55595c, roughness: 0.6, metalness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d2023, roughness: 0.7, metalness: 0.4 });
  const camo = new THREE.MeshStandardMaterial({ color: 0x4d5a39, roughness: 0.95 });
  const camoDark = new THREE.MeshStandardMaterial({ color: 0x3a3426, roughness: 0.95 });
  const exhaust = new THREE.MeshBasicMaterial({ color: trail, toneMapped: false });
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    bike.add(mesh);
    return mesh;
  };
  add(new THREE.BoxGeometry(0.44, 0.36, 1.9), white, 0, 0, 0.2);
  add(new THREE.BoxGeometry(0.38, 0.22, 0.7), white, 0, 0.12, -0.7, 0.35);
  add(new THREE.BoxGeometry(0.46, 0.08, 1.7), dark, 0, -0.2, 0.25);
  add(new THREE.CylinderGeometry(0.27, 0.32, 0.95, 14).rotateX(Math.PI / 2), grey, 0, 0.04, 1.3);
  for (const x of [-0.12, 0.12]) add(new THREE.CylinderGeometry(0.08, 0.1, 0.18, 10).rotateX(Math.PI / 2), dark, x, 0.04, 1.83);
  for (const x of [-0.12, 0.12]) add(new THREE.CircleGeometry(0.075, 12), exhaust, x, 0.04, 1.925);
  // The long steering forks and the vanes at their tips.
  for (const x of [-0.17, 0.17]) {
    add(new THREE.BoxGeometry(0.06, 0.06, 2.7), grey, x, -0.08, -1.95);
    add(new THREE.BoxGeometry(0.035, 0.6, 0.95), white, x * 1.35, -0.08, -3.1);
  }
  add(new THREE.BoxGeometry(0.5, 0.03, 0.5), white, 0, -0.08, -3.05);
  add(new THREE.BoxGeometry(0.74, 0.04, 0.04), dark, 0, 0.36, -0.36);
  add(new THREE.BoxGeometry(0.34, 0.1, 0.62), camoDark, 0, 0.24, 0.48);
  for (const x of [-0.3, 0.3]) add(new THREE.BoxGeometry(0.14, 0.05, 0.3), dark, x, -0.12, 0.2);
  // The rider, leaning into the handlebar in Endor camouflage.
  for (const x of [-0.16, 0.16]) {
    add(new THREE.BoxGeometry(0.13, 0.5, 0.14), camoDark, x, 0.26, 0.2, -1.05);
    add(new THREE.BoxGeometry(0.12, 0.42, 0.13), camoDark, x * 1.45, 0.04, 0.02, 0.35);
    add(new THREE.BoxGeometry(0.09, 0.42, 0.09), camo, x * 1.6, 0.66, -0.18, -1.15);
  }
  add(new THREE.BoxGeometry(0.42, 0.56, 0.28), camo, 0, 0.72, 0.28, -0.75);
  add(new THREE.SphereGeometry(0.16, 14, 10), camo, 0, 1.0, -0.05);
  add(new THREE.BoxGeometry(0.2, 0.05, 0.05), dark, 0, 0.98, -0.2);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: trail, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.position.set(0, 0.04, 2.05);
  bike.add(glow);
  // Lights the ground behind the bike, not the engine itself.
  const light = new THREE.PointLight(trail, 1.5, 6, 2);
  light.position.set(0, -0.8, 3.2);
  bike.add(light);
  return { bike, glow, light };
}

export function createEndorTrack(scene: THREE.Scene, options: { trail: string; reduced: boolean }) {
  const root = new THREE.Group();
  scene.add(root);
  scene.background = new THREE.Color(0x7d9478);
  scene.fog = new THREE.FogExp2(0x7d9478, 0.0125);
  root.add(new THREE.HemisphereLight(0xd8e8c8, 0x352a1a, 1.5));
  const sun = new THREE.DirectionalLight(0xffe2b4, 2.2);
  sun.position.set(30, 80, 20);
  root.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(320, TRACK + 520), new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -TRACK / 2);
  root.add(ground);

  // Redwoods: walls along both sides of the corridor, forest beyond, and the odd trunk in the way.
  const trunks: { x: number; z: number; r: number }[] = [];
  for (let d = -90; d < TRACK + 160; d += rand(2.4, 4.6)) {
    for (const side of [-1, 1]) {
      const near = Math.random() < 0.45;
      const lateral = near ? HALF + rand(0.8, 2.6) : HALF + 3 + Math.random() ** 1.4 * 62;
      const r = near ? rand(0.8, 1.6) : rand(0.8, 2.2) + (lateral > 30 ? rand(0, 1.8) : 0);
      trunks.push({ x: centre(d) + side * (lateral + r), z: -d, r });
    }
  }
  const obstacles: Obstacle[] = [];
  for (let d = 90; d < TRACK - 60; d += rand(26, 52)) {
    const c = centre(d);
    if (d > 900 && Math.random() < 0.38) {
      const a = c + rand(-7, -1.5);
      const b = Math.min(c + 7.5, a + rand(5.6, 8));
      obstacles.push({ d, x: a, r: rand(0.8, 1.3) }, { d, x: b, r: rand(0.8, 1.3) });
    } else obstacles.push({ d, x: c + rand(-6.5, 6.5), r: rand(0.85, 1.5) });
  }
  for (const o of obstacles) trunks.push({ x: o.x, z: -o.d, r: o.r });
  const bark = new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 0.95, color: 0xb88a70 });
  const trunkGeometry = new THREE.CylinderGeometry(0.86, 1, 70, 12, 1, true).translate(0, 35, 0);
  const flareGeometry = new THREE.CylinderGeometry(1, 1.65, 2.6, 12, 1, true).translate(0, 1.3, 0);
  const trunkMesh = new THREE.InstancedMesh(trunkGeometry, bark, trunks.length);
  const flareMesh = new THREE.InstancedMesh(flareGeometry, bark, trunks.length);
  const m = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    s = new THREE.Vector3(),
    p = new THREE.Vector3();
  trunks.forEach((t, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
    trunkMesh.setMatrixAt(i, m.compose(p.set(t.x, 0, t.z), q, s.set(t.r, 1, t.r)));
    flareMesh.setMatrixAt(i, m.compose(p.set(t.x, 0, t.z), q, s.set(t.r, 1, t.r)));
  });
  root.add(trunkMesh, flareMesh);

  // Ferns and undergrowth.
  const fernCount = options.reduced ? 500 : 1100;
  const ferns = new THREE.InstancedMesh(fernGeometry(), new THREE.MeshStandardMaterial({ color: 0x46702e, roughness: 0.9, side: THREE.DoubleSide }), fernCount);
  for (let i = 0; i < fernCount; i++) {
    const d = rand(-60, TRACK + 120);
    const lateral = Math.random() < 0.3 ? rand(4, HALF + 2) : rand(HALF, 50);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6);
    const k = rand(0.8, 2.2);
    ferns.setMatrixAt(i, m.compose(p.set(centre(d) + (Math.random() < 0.5 ? -1 : 1) * lateral, 0, -d), q, s.set(k, k * rand(0.7, 1.1), k)));
  }
  root.add(ferns);

  // Shafts of sunlight through the canopy.
  const shaftMaterial = new THREE.MeshBasicMaterial({ map: shaftTexture(), color: 0xfff0c8, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const shaftGeometry = new THREE.PlaneGeometry(5, 60).translate(0, -30, 0);
  for (let i = 0; i < 26; i++) {
    const d = rand(0, TRACK);
    const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
    shaft.position.set(centre(d) + rand(-30, 30), 52, -d);
    shaft.rotation.set(0, rand(0, Math.PI), 0.32);
    root.add(shaft);
  }

  // Checkpoint beacons and the finish arch.
  const gates = [...CHECKPOINTS, TRACK].map((d, i) => {
    const finish = i === CHECKPOINTS.length;
    const colour = finish ? 0xffc85a : 0x6fd8ff;
    const gate = new THREE.Group();
    const post = new THREE.MeshBasicMaterial({ color: colour, toneMapped: false });
    const band = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (const side of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6, 10), post);
      pole.position.set(side * (HALF - 0.4), 3, 0);
      gate.add(pole);
    }
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 - 0.8, finish ? 1.4 : 0.6), band);
    bar.position.y = 5.4;
    const veil = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 - 0.8, 5.4), new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    veil.position.y = 2.7;
    gate.add(bar, veil);
    gate.position.set(centre(d), 0, -d);
    gate.rotation.y = -Math.atan(centre(d + 1) - centre(d));
    root.add(gate);
    return { gate, band, veil: veil.material as THREE.MeshBasicMaterial, flash: 0 };
  });

  // The Ewok village round the finish: platforms, huts and rope bridges high in the trees.
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.95 });
  const thatch = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 1 });
  const huts: [number, number][] = [];
  for (const [dd, side, h] of [
    [-20, -1, 9],
    [10, 1, 11],
    [45, -1, 13],
    [70, 1, 8],
    [95, -1, 10],
  ] as const) {
    const d = TRACK + dd,
      x = centre(d) + side * (HALF + 6),
      z = -d;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 70, 12, 1, true).translate(0, 35, 0), bark);
    hub.position.set(x, 0, z);
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.35, 16), wood);
    deck.position.set(x, h, z);
    const hut = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 2.2, 10), wood);
    hut.position.set(x + side * 3.4, h + 1.2, z);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.3, 1.8, 10), thatch);
    roof.position.set(x + side * 3.4, h + 3.1, z);
    root.add(hub, deck, hut, roof);
    huts.push([x, h]);
  }
  for (let i = 0; i < huts.length - 1; i++) {
    const [x1, h1] = huts[i],
      [x2, h2] = huts[i + 1];
    const d1 = TRACK + [-20, 10, 45, 70, 95][i],
      d2 = TRACK + [-20, 10, 45, 70, 95][i + 1];
    const a = new THREE.Vector3(x1, h1, -d1),
      b = new THREE.Vector3(x2, h2, -d2);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, a.distanceTo(b)), wood);
    bridge.position.copy(a).add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, -0.6, 0));
    bridge.lookAt(b);
    root.add(bridge);
  }

  const { bike, glow, light } = createSpeederBike(options.trail);
  root.add(bike);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.4, 20), new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(0.7, 2.2, 1);
  root.add(shadow);

  return {
    obstacles: obstacles.sort((a, b) => a.d - b.d),
    bike,
    place: (x: number, d: number, yaw: number, roll: number, pitch: number, bob: number, thrust: number) => {
      bike.position.set(x, 1.15 + bob, -d);
      bike.rotation.set(pitch, yaw, roll, "YXZ");
      shadow.position.set(x, 0.03, -d + 0.2);
      glow.scale.setScalar(0.32 + thrust * 0.55);
      light.intensity = 1 + thrust * 3;
    },
    flashGate: (index: number) => {
      if (gates[index]) gates[index].flash = 1;
    },
    tick: (dt: number) => {
      for (const g of gates) {
        g.flash = Math.max(0, g.flash - dt * 1.5);
        g.band.opacity = 0.22 + g.flash * 0.6;
        g.veil.opacity = 0.05 + g.flash * 0.3;
      }
    },
    dispose: () => {
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>(),
        textures = new Set<THREE.Texture>();
      root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => materials.add(material));
      });
      materials.forEach((material) => {
        Object.values(material).forEach((value) => value instanceof THREE.Texture && textures.add(value));
        material.dispose();
      });
      textures.forEach((texture) => texture.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      trunkMesh.dispose();
      flareMesh.dispose();
      ferns.dispose();
      root.removeFromParent();
    },
  };
}
