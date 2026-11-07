import * as THREE from "three";
import { createJediTemple } from "../coruscantTaxi/taxiMonuments";
import { TEMPLE } from "../coruscantTaxi/taxiPlaces";
import { createAnakin, createCloneArmy } from "./cloneTrooperModel";

// The places of the escape from the Jedi Temple on the night of Order 66. Inside, the great hall
// runs down -Z from the door at z = 0, with the side balcony on +X near its far end. Outside, the
// Temple itself burns above the Processional Way, on its own group so only one is ever drawn.

export const HALL_END = -128;
export const COLUMN_X = 6.2;
export const FALLING_COLUMN_Z = -63;
export const BALCONY = { from: -115.5, to: -107.5, wall: 10.4, edge: 25 };
export const ARCHIVES_FROM = -72;
export const GALLERY_Y = 5;
const SPAN = 7;

function canvasTexture(width: number, height: number, paint: (c: CanvasRenderingContext2D, rand: () => number) => void, seed = 66) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  paint(canvas.getContext("2d")!, rand);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export const stoneMap = () =>
  canvasTexture(512, 512, (c, rand) => {
    c.fillStyle = "#b09c80";
    c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) {
      c.fillStyle = i % 2 ? "rgba(60,44,28,.05)" : "rgba(255,238,205,.04)";
      c.fillRect(rand() * 512, rand() * 512, 1 + rand() * 18, 1 + rand() * 4);
    }
    c.fillStyle = "rgba(38,26,16,.55)";
    for (let y = 0; y < 512; y += 128) {
      c.fillRect(0, y, 512, 2);
      for (let x = y % 256 ? 128 : 0; x < 512; x += 256) c.fillRect(x, y, 2, 128);
    }
  });

// The city burning at dusk, on a cylinder round the whole scene.
export function burningSky(radius: number, height: number) {
  const map = canvasTexture(2048, 512, (c, rand) => {
    const sky = c.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, "#14080d");
    sky.addColorStop(0.42, "#4d1a14");
    sky.addColorStop(0.72, "#c4521f");
    sky.addColorStop(0.86, "#ffaa55");
    sky.addColorStop(1, "#3a170d");
    c.fillStyle = sky;
    c.fillRect(0, 0, 2048, 512);
    for (const [count, tone, low, chance] of [
      [90, "#54241b", 0.56, 0.1],
      [70, "#2a1310", 0.44, 0.2],
      [40, "#120809", 0.32, 0.3],
    ] as const)
      for (let i = 0; i < count; i++) {
        const w = 14 + rand() * 54,
          x = rand() * 2048,
          top = 512 * (low + rand() * 0.34);
        c.fillStyle = tone;
        c.fillRect(x, top, w, 512 - top);
        for (let y = top + 5; y < 512; y += 7)
          for (let wx = x + 3; wx < x + w - 3; wx += 6)
            if (rand() < chance) {
              c.fillStyle = "rgba(255,196,120,.8)";
              c.fillRect(wx, y, 2, 3);
            }
        c.fillStyle = tone;
      }
    // Columns of smoke leaning with the wind over the towers.
    for (let i = 0; i < 16; i++) {
      let x = rand() * 2048,
        y = 340 + rand() * 80;
      for (let k = 0; k < 40; k++) {
        const r = 8 + k * 2.2;
        const puff = c.createRadialGradient(x, y, 0, x, y, r);
        puff.addColorStop(0, "rgba(16,9,9,.28)");
        puff.addColorStop(1, "rgba(16,9,9,0)");
        c.fillStyle = puff;
        c.fillRect(x - r, y - r, r * 2, r * 2);
        y -= 8;
        x += 3 + rand() * 5;
      }
    }
  });
  map.wrapS = THREE.RepeatWrapping;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 40, 1, true), new THREE.MeshBasicMaterial({ map, side: THREE.BackSide, fog: false, toneMapped: false }));
  mesh.name = "burning-sky";
  return mesh;
}

// Fluted, by pushing every other edge of the cylinder inwards.
function flutedShaft(radius: number, height: number) {
  const geometry = new THREE.CylinderGeometry(radius * 0.94, radius, height, 40, 1, true);
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    if (Math.round(Math.atan2(position.getZ(i), position.getX(i)) / ((Math.PI * 2) / 40)) % 2 === 0) continue;
    position.setX(i, position.getX(i) * 0.91);
    position.setZ(i, position.getZ(i) * 0.91);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function holobooks() {
  return canvasTexture(
    512,
    512,
    (c, rand) => {
      c.fillStyle = "#050a12";
      c.fillRect(0, 0, 512, 512);
      for (let row = 0; row < 8; row++) {
        c.fillStyle = "#1a2433";
        c.fillRect(0, row * 64, 512, 7);
        for (let x = 3; x < 508; x += 11) {
          const lit = rand();
          c.fillStyle = lit < 0.12 ? "#0a1018" : `rgba(${34 + lit * 46},${92 + lit * 70},${190 + lit * 50},${0.34 + lit * 0.5})`;
          c.fillRect(x, row * 64 + 11, 7, 49);
        }
      }
    },
    1138,
  );
}

export function createTempleHall(glow: THREE.Texture) {
  const group = new THREE.Group();
  group.name = "temple-hall";
  const map = stoneMap();
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const stone = new THREE.MeshStandardMaterial({ color: 0xa8957a, map, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x4b3f33, map, roughness: 0.86 });
  const floorMap = map.clone();
  floorMap.repeat.set(4, 30);
  floorMap.needsUpdate = true;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(21, 150), new THREE.MeshStandardMaterial({ color: 0x4d4034, map: floorMap, roughness: 0.28, metalness: 0.25 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -66;
  group.add(floor);
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 150), new THREE.MeshStandardMaterial({ color: 0x5e2d22, roughness: 0.42, metalness: 0.12 }));
  runner.rotation.x = -Math.PI / 2;
  runner.position.set(0, 0.01, -66);
  group.add(runner);
  for (const side of [-1, 1]) {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 150), new THREE.MeshBasicMaterial({ color: 0xffc37a, toneMapped: false }));
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(side * 2.3, 0.015, -66);
    group.add(edge);
  }
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(21, 150), dark);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 22, -66);
  group.add(ceiling);
  const count = Math.floor(Math.abs(HALL_END) / SPAN);
  const instanced = (geometry: THREE.BufferGeometry, material: THREE.Material, n: number) => {
    const mesh = new THREE.InstancedMesh(geometry, material, n);
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  };
  const shaft = instanced(flutedShaft(0.95, 18), stone, count * 2),
    base = instanced(new THREE.CylinderGeometry(1.25, 1.42, 1, 24), dark, count * 2),
    capital = instanced(new THREE.CylinderGeometry(1.5, 1, 1.5, 24), dark, count * 2),
    pier = instanced(new THREE.BoxGeometry(1.4, 22, 4), stone, count * 2),
    beam = instanced(new THREE.BoxGeometry(20.8, 1, 1.4), dark, count),
    busts = instanced(new THREE.SphereGeometry(0.42, 14, 10), new THREE.MeshStandardMaterial({ color: 0xb79a63, roughness: 0.34, metalness: 0.55 }), count * 2),
    plinths = instanced(new THREE.CylinderGeometry(0.42, 0.55, 2.3, 12), dark, count * 2);
  const lamp = new THREE.MeshBasicMaterial({ color: 0xf2f6ff, toneMapped: false });
  const lamps = instanced(new THREE.BoxGeometry(0.08, 1.15, 0.2), lamp, count * 4);
  let lampIndex = 0;
  const matrix = new THREE.Matrix4();
  let index = 0;
  const flames: THREE.Sprite[] = [];
  for (let i = 0; i < count; i++) {
    const z = -3 - i * SPAN;
    matrix.makeTranslation(0, 21.4, z);
    beam.setMatrixAt(i, matrix);
    for (const side of [-1, 1]) {
      // The toppling column is built on its own, so there is a gap in the row for it.
      const skip = side === -1 && Math.abs(z - FALLING_COLUMN_Z) < 1;
      const hide = skip ? new THREE.Matrix4().makeScale(0, 0, 0) : null;
      shaft.setMatrixAt(index, hide ?? matrix.makeTranslation(side * COLUMN_X, 10, z));
      base.setMatrixAt(index, hide ?? matrix.makeTranslation(side * COLUMN_X, 0.5, z));
      capital.setMatrixAt(index, hide ?? matrix.makeTranslation(side * COLUMN_X, 19.5, z));
      // No pier or bust stands in the way out to the balcony.
      const opening = side === 1 && z + SPAN / 2 < BALCONY.to + 2 && z + SPAN / 2 > BALCONY.from - 2;
      pier.setMatrixAt(index, opening ? new THREE.Matrix4().makeScale(0, 0, 0) : matrix.makeTranslation(side * 10.6, 11, z + SPAN / 2));
      for (const y of [5.6, 7.1]) lamps.setMatrixAt(lampIndex++, opening ? new THREE.Matrix4().makeScale(0, 0, 0) : matrix.makeTranslation(side * 9.86, y, z + SPAN / 2));
      const archive = z < ARCHIVES_FROM;
      busts.setMatrixAt(index, archive && !opening ? matrix.makeTranslation(side * 4.5, 2.75, z + SPAN / 2) : new THREE.Matrix4().makeScale(0, 0, 0));
      plinths.setMatrixAt(index, archive && !opening ? matrix.makeTranslation(side * 4.5, 1.15, z + SPAN / 2) : new THREE.Matrix4().makeScale(0, 0, 0));
      index++;
    }
    if (i % 2 === 0 && z > ARCHIVES_FROM) {
      for (const side of [-1, 1]) {
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.2, 0.42, 14), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.3, metalness: 0.75 }));
        bowl.position.set(side * 4.5, 1.2, z);
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, 1.05, 10), dark);
        stand.position.set(side * 4.5, 0.52, z);
        const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff8a30, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
        flame.position.set(side * 4.5, 1.8, z);
        flame.scale.setScalar(1.8);
        flames.push(flame);
        group.add(bowl, stand, flame);
      }
    }
  }
  // The window walls: a sill and a lintel between the piers, open on the burning city in between.
  for (const side of [-1, 1]) {
    const cut = side === 1;
    const lengths: [number, number][] = cut ? [[3, BALCONY.to], [BALCONY.from, HALL_END - 4]] : [[3, HALL_END - 4]];
    for (const [from, to] of lengths) {
      const length = from - to;
      for (const [y, h] of [
        [2, 4],
        [20, 4],
      ]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(1, h, length), dark);
        wall.position.set(side * 10.6, y, (from + to) / 2);
        group.add(wall);
      }
    }
  }
  for (const z of [4, HALL_END]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(22, 22, 1), dark);
    wall.position.set(0, 11, z);
    group.add(wall);
  }
  // A great door at the far end, where the shadow will come from.
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 10), new THREE.MeshBasicMaterial({ color: 0x010204, fog: false }));
  portal.position.set(0, 5, HALL_END + 0.52);
  group.add(portal);
  // Its tall frame, and the pairs of white lamps that line the Temple's walls.
  for (const side of [-1, 1]) {
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 10.6, 0.6), stone);
    jamb.position.set(side * 4.45, 5.3, HALL_END + 0.7);
    group.add(jamb);
    for (const y of [5.6, 7.1]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 1.15), lamp);
      strip.position.set(side * 6.5, y, HALL_END + 0.55);
      group.add(strip);
    }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xdfeaff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    halo.position.set(side * 6.5, 6.35, HALL_END + 0.7);
    halo.scale.setScalar(3.6);
    group.add(halo);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.8, 0.6), stone);
  lintel.position.set(0, 10.4, HALL_END + 0.7);
  group.add(lintel);
  // Shafts of firelight through the windows, along the whole hall.
  const shaftMaterial = new THREE.MeshBasicMaterial({ color: 0xff9d57, transparent: true, opacity: 0.09, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
  for (let i = 0; i < count; i += 1) {
    for (const side of [-1, 1]) {
      if (side === 1 && -3 - i * SPAN - SPAN / 2 < BALCONY.to && -3 - i * SPAN - SPAN / 2 > BALCONY.from) continue;
      const light = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 19), shaftMaterial);
      light.position.set(side * 6.8, 7.4, -3 - i * SPAN - SPAN / 2);
      light.rotation.set(0, Math.PI / 2, side * -0.5);
      group.add(light);
    }
  }
  // The Archives: walls of glowing tapes and a gallery above them, from which the clones fire.
  const tapes = holobooks();
  tapes.wrapS = THREE.RepeatWrapping;
  tapes.repeat.set(5, 1);
  const shelves = new THREE.MeshBasicMaterial({ map: tapes, toneMapped: false });
  for (const side of [-1, 1]) {
    const length = side === 1 ? Math.abs(BALCONY.to - ARCHIVES_FROM) : Math.abs(HALL_END - ARCHIVES_FROM);
    const end = side === 1 ? BALCONY.to : HALL_END;
    const rack = new THREE.Mesh(new THREE.PlaneGeometry(length, 4.4), shelves);
    rack.position.set(side * 8.5, 2.3, (ARCHIVES_FROM + end) / 2);
    rack.rotation.y = -side * (Math.PI / 2);
    const gallery = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.45, length), stone);
    gallery.position.set(side * 8, GALLERY_Y - 0.22, (ARCHIVES_FROM + end) / 2);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, length), dark);
    rail.position.set(side * 6.8, GALLERY_Y + 0.35, (ARCHIVES_FROM + end) / 2);
    group.add(rack, gallery, rail);
  }
  // The balcony: where the hall opens on the night.
  const deck = new THREE.Mesh(new THREE.BoxGeometry(BALCONY.edge - BALCONY.wall, 0.6, BALCONY.to - BALCONY.from + 4), stone);
  deck.position.set((BALCONY.edge + BALCONY.wall) / 2, -0.3, (BALCONY.to + BALCONY.from) / 2);
  group.add(deck);
  // The column that comes down behind the visitor, hinged at its foot.
  const fallen = new THREE.Group();
  fallen.position.set(-COLUMN_X, 0, FALLING_COLUMN_Z);
  const fallingShaft = new THREE.Mesh(flutedShaft(0.95, 18), stone);
  fallingShaft.position.y = 10;
  const fallingBase = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.42, 1, 24), dark);
  fallingBase.position.y = 0.5;
  const fallingTop = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1, 1.5, 24), dark);
  fallingTop.position.y = 19.5;
  fallen.add(fallingShaft, fallingBase, fallingTop);
  group.add(fallen);
  return {
    group,
    column: fallen,
    tick(time: number, reduced: boolean) {
      flames.forEach((flame, i) => {
        flame.material.opacity = reduced ? 0.8 : 0.72 + Math.sin(time * 11 + i * 2.4) * 0.14;
        flame.scale.setScalar(reduced ? 1.8 : 1.7 + Math.sin(time * 8 + i) * 0.2);
      });
    },
  };
}

// Drifting smoke sprites that are re-laid ahead of whatever they follow.
export function createDrift(glow: THREE.Texture, count: number, tint: number, opacity: number, blending: THREE.Blending = THREE.NormalBlending) {
  const group = new THREE.Group();
  const sprites = Array.from({ length: count }, (_, i) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: tint, transparent: true, opacity: 0, depthWrite: false, blending }));
    group.add(sprite);
    return { sprite, age: (i / count) * 6, life: 6 + (i % 5), rise: 0.15 + (i % 3) * 0.14, size: 0 };
  });
  return {
    group,
    // spot() chooses where a puff is born; it is called each time one fades out.
    tick(dt: number, spot: (out: THREE.Vector3) => number) {
      for (const puff of sprites) {
        puff.age += dt;
        if (puff.age >= puff.life || puff.size === 0) {
          puff.age = puff.size === 0 ? puff.age : 0;
          puff.size = spot(puff.sprite.position);
        }
        const k = puff.age / puff.life;
        puff.sprite.position.y += puff.rise * dt * (puff.size > 20 ? 18 : 1);
        puff.sprite.scale.setScalar(puff.size * (0.7 + k * 0.9));
        puff.sprite.material.opacity = opacity * Math.sin(Math.PI * Math.min(1, k));
      }
    },
  };
}

// Outside: the Temple, its fires, and the army marching up the Processional Way towards it.
export const WAY_Y = -60;
export function createTempleExterior(glow: THREE.Texture) {
  const group = new THREE.Group();
  group.name = "temple-exterior";
  const temple = createJediTemple(glow);
  temple.group.position.set(-TEMPLE.x, 0, -TEMPLE.z);
  group.add(temple.group);
  const way = new THREE.Mesh(new THREE.BoxGeometry(150, 8, 1100), new THREE.MeshStandardMaterial({ color: 0x5c4c3c, roughness: 0.74 }));
  way.position.set(0, WAY_Y - 4, 205 + 550);
  group.add(way);
  for (const side of [-1, 1])
    for (let i = 0; i < 22; i++) {
      const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffb36a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      lamp.position.set(side * 72, WAY_Y + 3, 220 + i * 46);
      lamp.scale.setScalar(9);
      group.add(lamp);
    }
  const army = createCloneArmy(30, 44, [3.1, 3.3]);
  army.position.set(0, WAY_Y, 262);
  group.add(army);
  const leader = createAnakin();
  leader.group.position.set(0, WAY_Y, 240);
  leader.group.scale.setScalar(1.15);
  group.add(leader.group);
  // Great fires on the Temple's flanks, each feeding a column of smoke.
  const fires: [number, number, number][] = [
    [-130, 62, 165],
    [120, 40, 165],
    [-172, 20, 90],
    [175, 70, 40],
    [40, 120, 110],
    [-60, 150, 60],
  ];
  const fireSprites = fires.map(([x, y, z], i) => {
    const fire = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff6a22, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    fire.position.set(x, y, z);
    fire.scale.setScalar(70 + (i % 3) * 26);
    const light = new THREE.PointLight(0xff7428, 14000, 420, 2);
    light.position.set(x, y, z + 18);
    group.add(fire, light);
    return fire;
  });
  const smoke = createDrift(glow, 54, 0x14100f, 0.62);
  group.add(smoke.group);
  let next = 0;
  return {
    group,
    army,
    tick(dt: number, time: number, reduced: boolean) {
      temple.tick(dt, reduced);
      if (!reduced) army.position.z -= dt * 1.5;
      fireSprites.forEach((fire, i) => {
        fire.material.opacity = reduced ? 0.8 : 0.72 + Math.sin(time * 5 + i * 1.7) * 0.2;
      });
      smoke.tick(dt, (out) => {
        const fire = fires[next++ % fires.length];
        out.set(fire[0] + Math.random() * 30 - 15, fire[1] + Math.random() * 40, fire[2] + Math.random() * 20 - 10);
        return 80 + Math.random() * 90;
      });
    },
  };
}

// Everything here is synthesised: no recording from any film.
export function createEscapeAudio() {
  const Context = window.AudioContext;
  if (!Context) return null;
  const context = new Context();
  const master = context.createGain();
  master.gain.value = 0.5;
  master.connect(context.destination);
  const tone = (from: number, to: number, seconds: number, gain: number, type: OscillatorType = "sawtooth") => {
    const now = context.currentTime,
      osc = context.createOscillator(),
      level = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), now + seconds);
    level.gain.setValueAtTime(gain, now);
    level.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    osc.connect(level).connect(master);
    osc.start(now);
    osc.stop(now + seconds);
  };
  const noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noise = (seconds: number, gain: number, cutoff: number) => {
    const now = context.currentTime,
      source = context.createBufferSource(),
      filter = context.createBiquadFilter(),
      level = context.createGain();
    source.buffer = noiseBuffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, now);
    filter.frequency.exponentialRampToValueAtTime(40, now + seconds);
    level.gain.setValueAtTime(gain, now);
    level.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    source.connect(filter).connect(level).connect(master);
    source.start(now);
    source.stop(now + seconds);
  };
  // The saber's low hum, always there and rising as the blade moves.
  const hum = context.createOscillator(),
    second = context.createOscillator(),
    humLevel = context.createGain();
  hum.type = "sawtooth";
  second.type = "sine";
  hum.frequency.value = 86;
  second.frequency.value = 92;
  humLevel.gain.value = 0;
  const humFilter = context.createBiquadFilter();
  humFilter.type = "lowpass";
  humFilter.frequency.value = 260;
  hum.connect(humFilter);
  second.connect(humFilter);
  humFilter.connect(humLevel).connect(master);
  hum.start();
  second.start();
  return {
    bolt: () => tone(1500 + Math.random() * 500, 230, 0.2, 0.08),
    deflect: () => {
      tone(2400, 500, 0.12, 0.09, "square");
      noise(0.1, 0.1, 5000);
    },
    hit: () => noise(0.3, 0.3, 1200),
    push: () => {
      tone(180, 28, 0.9, 0.3, "sine");
      noise(0.8, 0.28, 900);
    },
    boom: () => {
      tone(70, 18, 2, 0.5, "sine");
      noise(1.8, 0.5, 700);
    },
    ignite: () => {
      tone(70, 320, 0.3, 0.2);
      noise(0.28, 0.14, 2600);
    },
    jump: () => noise(1.2, 0.16, 1400),
    // A held, pure note, as a kyber crystal is said to sing, and a short bright one for a holocron.
    sing: () => {
      tone(660, 660, 2.6, 0.055, "sine");
      tone(990, 993, 2.6, 0.032, "sine");
      tone(1320, 1326, 2.2, 0.018, "sine");
    },
    chime: () => {
      tone(880, 880, 0.9, 0.05, "sine");
      tone(1320, 1320, 0.7, 0.028, "sine");
    },
    setHum: (speed: number) => {
      humLevel.gain.setTargetAtTime(0.05 + Math.min(speed, 1) * 0.13, context.currentTime, 0.04);
      humFilter.frequency.setTargetAtTime(240 + Math.min(speed, 1) * 760, context.currentTime, 0.05);
    },
    humOff: () => humLevel.gain.setTargetAtTime(0, context.currentTime, 0.1),
    close: () => {
      humLevel.gain.setTargetAtTime(0, context.currentTime, 0.1);
      window.setTimeout(() => context.close(), 300);
    },
  };
}

// The double circle that shows where a blow will land.
let ringMap: THREE.Texture | null = null;
export function ringTexture() {
  if (ringMap) return ringMap;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const c = canvas.getContext("2d")!;
  c.strokeStyle = "#ffffff";
  c.lineWidth = 7;
  c.beginPath();
  c.arc(64, 64, 50, 0, Math.PI * 2);
  c.stroke();
  c.lineWidth = 3;
  c.beginPath();
  c.arc(64, 64, 34, 0, Math.PI * 2);
  c.stroke();
  ringMap = new THREE.CanvasTexture(canvas);
  return ringMap;
}
