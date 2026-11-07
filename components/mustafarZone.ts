import * as THREE from "three";
import { createDrift } from "./jedi/orderEscapeWorld";
import { LAVA_LEVEL, VOLCANOES, lavaFragment, lavaVertex, rockHeight } from "./jedi/vaderChamber";
import { createSaber } from "./jedi/cloneTrooperModel";
import { createTerminals, glowTexture, parkShip, type Reveal, type Spot, type Zone, type ZoneAction } from "./landingKit";
import type { PadEvent } from "./coruscantLife";
import type { Landing } from "./universe";

// Mustafar, the hidden world: the ship sets down on a platform of the old refinery, above a sea of
// lava. A bridge leads to the facility's deck and a collector arm runs out over the fire to the end
// platform, where the Force still remembers the duel that was fought there.

const LAVA_Y = -9;
const PAD_R = 15.5;
const END = new THREE.Vector3(66, 0, -55);
const END_R = 7.5;
type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };
const BRIDGE: Rect = { minX: -2, maxX: 2, minZ: -47, maxZ: -14 };
const DECK: Rect = { minX: -22, maxX: 22, minZ: -66, maxZ: -46 };
const ARM: Rect = { minX: 21, maxX: 60, minZ: -57, maxZ: -53 };
const RECTS = [BRIDGE, DECK, ARM];

const nearestOnRect = (rect: Rect, x: number, z: number): [number, number] => [THREE.MathUtils.clamp(x, rect.minX, rect.maxX), THREE.MathUtils.clamp(z, rect.minZ, rect.maxZ)];
const nearestOnCircle = (cx: number, cz: number, r: number, x: number, z: number): [number, number] => {
  const d = Math.hypot(x - cx, z - cz);
  return d <= r ? [x, z] : [cx + ((x - cx) / d) * r, cz + ((z - cz) / d) * r];
};
// Keeps the visitor on the walkways: to the nearest point of whichever part is closest.
function keepOnWalkways(walker: { x: number; z: number }) {
  const options = [nearestOnCircle(0, 0, PAD_R, walker.x, walker.z), nearestOnCircle(END.x, END.z, END_R, walker.x, walker.z), ...RECTS.map((rect) => nearestOnRect(rect, walker.x, walker.z))];
  let best = options[0],
    distance = Infinity;
  for (const option of options) {
    const d = Math.hypot(option[0] - walker.x, option[1] - walker.z);
    if (d < distance) {
      distance = d;
      best = option;
    }
  }
  walker.x = best[0];
  walker.z = best[1];
}

export function createMustafarZone(landing: Landing, _notify: (event: PadEvent) => void, _reveal: Reveal): Zone {
  const group = new THREE.Group();
  const glow = glowTexture();
  // All the light comes up from the lava: the sky is only ash.
  const below = new THREE.HemisphereLight(0x8a5a48, 0xff6a26, 1.5);
  const sun = new THREE.DirectionalLight(0xffb98a, 1.5);
  sun.position.set(-30, 40, 30);
  group.add(below, sun, sun.target);
  const fog = new THREE.FogExp2(0x2c0f09, 0.0045);

  // The lava sea and the black land round it, out to the volcanoes.
  const uniforms = { time: { value: 0 }, calm: { value: 0.3 }, fury: { value: 0 }, volcano: { value: VOLCANOES.map(([x, z, peak, spread]) => new THREE.Vector4(x, z, peak, spread)) } };
  const land = new THREE.PlaneGeometry(2300, 2300, 280, 280);
  land.rotateX(-Math.PI / 2);
  {
    const position = land.getAttribute("position");
    const heights = new Float32Array(position.count);
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i),
        z = position.getZ(i);
      // A clear sea round the refinery, closed in by higher ground further out.
      const r = Math.hypot(x - 20, z + 30);
      const open = THREE.MathUtils.smoothstep(r, 130, 320);
      const rim = THREE.MathUtils.smoothstep(r, 560, 1050) * 120;
      const height = rockHeight(x, z) * open + rim;
      heights[i] = height;
      position.setY(i, LAVA_Y + Math.max(0, height - LAVA_LEVEL));
    }
    land.setAttribute("aHeight", new THREE.BufferAttribute(heights, 1));
    land.computeVertexNormals();
  }
  const ground = new THREE.Mesh(land, new THREE.ShaderMaterial({ uniforms, vertexShader: lavaVertex, fragmentShader: lavaFragment, fog: false, toneMapped: false }));
  ground.frustumCulled = false;
  group.add(ground);
  // An ash sky, lit from underneath.
  const skyCanvas = document.createElement("canvas");
  skyCanvas.width = 1024;
  skyCanvas.height = 512;
  const paint = skyCanvas.getContext("2d")!;
  const gradient = paint.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, "#050203");
  gradient.addColorStop(0.42, "#1b0706");
  gradient.addColorStop(0.5, "#6e1e0a");
  gradient.addColorStop(0.55, "#2a0d08");
  paint.fillStyle = gradient;
  paint.fillRect(0, 0, 1024, 512);
  let seed = 19;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 240; i++) {
    const x = rand() * 1024,
      y = 30 + rand() * 220,
      r = 24 + rand() * 90;
    const puff = paint.createRadialGradient(x, y, 0, x, y, r);
    puff.addColorStop(0, `rgba(${14 + y * 0.12},${6 + y * 0.02},6,${0.14 + rand() * 0.22})`);
    puff.addColorStop(1, "rgba(0,0,0,0)");
    paint.fillStyle = puff;
    paint.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const skyMap = new THREE.CanvasTexture(skyCanvas);
  skyMap.colorSpace = THREE.SRGBColorSpace;
  skyMap.wrapS = THREE.RepeatWrapping;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1250, 32, 18), new THREE.MeshBasicMaterial({ map: skyMap, side: THREE.BackSide, fog: false, toneMapped: false }));
  group.add(sky);

  // The refinery: black metal on heavy legs, with hazard lamps and a lit edge along every walkway.
  const steel = new THREE.MeshStandardMaterial({ color: 0x2b2a2c, roughness: 0.55, metalness: 0.75 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x151416, roughness: 0.7, metalness: 0.6 });
  const edge = new THREE.MeshBasicMaterial({ color: 0xffb066, toneMapped: false });
  const add = (mesh: THREE.Mesh) => {
    group.add(mesh);
    return mesh;
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material = steel) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    return add(mesh);
  };
  const pad = add(new THREE.Mesh(new THREE.CylinderGeometry(PAD_R + 0.5, PAD_R - 2, 1.2, 48), steel));
  pad.position.y = -0.6;
  // The landing markings, lit by the lava's glow.
  for (const radius of [5.6, 9.6]) {
    const circle = add(new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.1, 64), new THREE.MeshBasicMaterial({ color: 0xc8682a, toneMapped: false })));
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = 0.02;
  }
  const padDeck = add(new THREE.Mesh(new THREE.CircleGeometry(PAD_R + 0.3, 56), new THREE.MeshStandardMaterial({ color: 0x4a4644, roughness: 0.62, metalness: 0.5 })));
  padDeck.rotation.x = -Math.PI / 2;
  padDeck.position.y = 0.01;
  const padRing = add(new THREE.Mesh(new THREE.TorusGeometry(PAD_R + 0.2, 0.05, 6, 64), edge));
  padRing.rotation.x = Math.PI / 2;
  padRing.position.y = 0.05;
  const endDisc = add(new THREE.Mesh(new THREE.CylinderGeometry(END_R + 0.5, END_R - 1.4, 1, 36), steel));
  endDisc.position.set(END.x, -0.5, END.z);
  const endRing = add(new THREE.Mesh(new THREE.TorusGeometry(END_R + 0.2, 0.04, 6, 48), edge));
  endRing.rotation.x = Math.PI / 2;
  endRing.position.set(END.x, 0.05, END.z);
  const slab = (rect: Rect) => box(rect.maxX - rect.minX + 0.5, 0.7, rect.maxZ - rect.minZ + 0.5, (rect.minX + rect.maxX) / 2, -0.35, (rect.minZ + rect.maxZ) / 2);
  RECTS.forEach(slab);
  // Rails along the bridge and the arm, posts and a thin glowing line.
  const rail = (x1: number, z1: number, x2: number, z2: number) => {
    const length = Math.hypot(x2 - x1, z2 - z1);
    const yaw = Math.atan2(x2 - x1, z2 - z1);
    const bar = box(0.07, 0.07, length, (x1 + x2) / 2, 1.05, (z1 + z2) / 2, dark);
    bar.rotation.y = yaw;
    const line = box(0.04, 0.04, length, (x1 + x2) / 2, 0.45, (z1 + z2) / 2, edge);
    line.rotation.y = yaw;
    for (let k = 0; k <= Math.floor(length / 4); k++) {
      const t = k / Math.max(1, Math.floor(length / 4));
      box(0.08, 1.05, 0.08, THREE.MathUtils.lerp(x1, x2, t), 0.52, THREE.MathUtils.lerp(z1, z2, t), dark);
    }
  };
  for (const x of [BRIDGE.minX - 0.1, BRIDGE.maxX + 0.1]) rail(x, BRIDGE.maxZ, x, BRIDGE.minZ);
  for (const z of [ARM.minZ - 0.1, ARM.maxZ + 0.1]) rail(ARM.minX, z, ARM.maxX, z);
  // Legs down into the lava, under everything.
  for (const [x, z, r] of [
    [0, -22, 0.9],
    [0, -36, 0.9],
    [-12, 8, 1.3],
    [12, 8, 1.3],
    [0, -10, 1.3],
    [-14, -56, 1.5],
    [14, -56, 1.5],
    [38, -55, 0.9],
    [54, -55, 0.9],
    [END.x, END.z, 1.6],
  ] as const) {
    const leg = add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.5, 14, 14), dark));
    leg.position.set(x, -7, z);
  }
  // The facility, closed and dark, its windows lit by what burns below.
  box(44, 16, 8, 0, 8, -70, dark);
  box(30, 8, 10, 0, 19, -71, steel);
  const windows = new THREE.MeshBasicMaterial({ color: 0xff9248, toneMapped: false });
  for (let i = 0; i < 9; i++) box(2.6, 2, 0.1, -19.5 + i * 4.9, 11.4, -65.9, windows);
  box(7, 6, 0.3, 0, 3, -65.8, steel);
  box(0.12, 6, 0.1, 0, 3, -65.6, edge);
  // The collector arms, reaching out over the sea, with their red beacons.
  const collectors: THREE.Group[] = [];
  for (const [x, z, yaw] of [
    [-20, -64, Math.PI * 0.8],
    [20, -66, -Math.PI * 0.72],
  ] as const) {
    const arm = new THREE.Group();
    arm.position.set(x, 13, z);
    arm.rotation.y = yaw;
    group.add(arm);
    const boom = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 62), dark);
    boom.position.z = 31;
    arm.add(boom);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 1.2, 7, 12), steel);
    head.position.set(0, -3.6, 62);
    arm.add(head);
    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff3a22, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    beacon.position.set(0, 1.4, 62);
    beacon.scale.setScalar(4);
    arm.add(beacon);
    collectors.push(arm);
  }
  // Geysers of lava round the walkways, and the ash and sparks in the air.
  const geysers = [
    [-30, -24, 14],
    [26, -24, 18],
    [44, -24, 16],
    [36, -82, 22],
    [-44, -60, 24],
    [84, -38, 18],
  ].map(([x, z, size], i) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff7a2c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
    sprite.position.set(x, LAVA_Y + size * 0.6, z);
    group.add(sprite);
    return { sprite, size, phase: i * 1.9 };
  });
  const plume = createDrift(glow, 30, 0x0c0808, 0.6);
  plume.group.traverse((item) => {
    if (item instanceof THREE.Sprite) item.material.fog = false;
  });
  group.add(plume.group);
  const embers = createDrift(glow, 40, 0xff9a4c, 0.85, THREE.AdditiveBlending);
  group.add(embers.group);
  const SPARKS = 320;
  const sparkPositions = new Float32Array(SPARKS * 3);
  const sparkMotion = Array.from({ length: SPARKS }, () => ({ x: 0, y: 0, z: 0, age: Math.random() * 5, life: 1 }));
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
  const eruption = new THREE.Points(sparkGeometry, new THREE.PointsMaterial({ map: glow, color: 0xff8a2c, size: 8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
  eruption.frustumCulled = false;
  group.add(eruption);

  // The Force's memory of the duel, at the end of the arm: two blue shades and their blades.
  const echo = new THREE.Group();
  echo.position.copy(END);
  echo.visible = false;
  group.add(echo);
  const shade = new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const fighters = [-1, 1].map((side) => {
    const figure = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 1.05, 4, 12), shade);
    body.position.y = 0.95;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), shade);
    skull.position.y = 1.75;
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.95, 14, 1, true), shade);
    robe.position.y = 0.48;
    figure.add(body, skull, robe);
    const saber = createSaber(0x5ab0ff, 1);
    saber.setExtended(1);
    saber.group.position.set(0, 1.2, 0.26);
    figure.add(saber.group);
    figure.position.x = side * 1.5;
    figure.rotation.y = -side * (Math.PI / 2);
    echo.add(figure);
    return { figure, saber: saber.group, side };
  });
  const sparkle = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xcdeaff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  sparkle.position.y = 1.5;
  sparkle.scale.setScalar(1.5);
  echo.add(sparkle);
  const marker = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.03, 6, 40), new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.7, toneMapped: false }));
  marker.rotation.x = Math.PI / 2;
  marker.position.set(END.x, 0.05, END.z);
  group.add(marker);
  let echoLeft = 0;
  const actions: ZoneAction[] = [
    {
      id: "duel-echo",
      label: "Ressentir l’écho de la Force",
      position: END.clone(),
      objects: [marker],
      approach: { position: new THREE.Vector3(END.x - 5.5, 0, END.z + 1.5), lookAt: END.clone() },
      path: [new THREE.Vector3(0, 0, -14), new THREE.Vector3(0, 0, -48), new THREE.Vector3(21, 0, -55), new THREE.Vector3(58, 0, -55)],
      says: { who: "L’écho de la Force", lines: ["« Tu étais l’Élu ! »", "Ici, deux frères se sont affrontés. La Force ne l’a jamais oublié."] },
      activate: () => {
        echoLeft = 11;
      },
    },
  ];

  const circles: Spot[] = [];
  const parking = parkShip();
  group.add(parking.ship);
  const terminals = createTerminals(landing, steel, circles);
  group.add(terminals.group);
  const craterPoint = new THREE.Vector3();
  const craterTop = (i: number, out: THREE.Vector3) => {
    const [x, z, peak] = VOLCANOES[i];
    return out.set(x, LAVA_Y + peak * 0.8, z);
  };
  let time = 0;
  return {
    group,
    fog,
    exposure: 1.05,
    walkRadius: 95,
    arrival: { from: new THREE.Vector3(34, 26, 52), to: new THREE.Vector3(15, 7, 25) },
    terminals: terminals.terminals,
    ship: parking.ship,
    shipRest: parking.shipRest,
    colliders: { circles, footprint: parking.footprint, movers: [] },
    actions,
    constrainWalk: keepOnWalkways,
    spawn: { position: new THREE.Vector3(-1.2, 0, -8.5), yaw: 0 },
    setViewport: () => undefined,
    setThrust: (thrust) => parking.setThrust(thrust),
    tick: (dt, elapsed, reduced, walker) => {
      time = elapsed;
      uniforms.time.value = reduced ? 40 : elapsed;
      if (!reduced) skyMap.offset.x = elapsed * 0.003;
      geysers.forEach(({ sprite, size, phase }) => {
        const beat = reduced ? 0.6 : 0.5 + Math.sin(elapsed * 0.9 + phase) * 0.35 + Math.sin(elapsed * 2.7 + phase) * 0.12;
        sprite.material.opacity = Math.max(0, beat);
        sprite.scale.set(size * 0.55, size * (0.8 + beat), 1);
      });
      collectors.forEach((arm, i) => {
        const beacon = arm.children[2] as THREE.Sprite;
        beacon.material.opacity = reduced || Math.sin(elapsed * 2 + i * 2) > 0 ? 1 : 0.15;
      });
      plume.tick(dt, (out) => {
        craterTop(Math.floor(Math.random() * 3), out);
        out.x += (Math.random() - 0.5) * 26;
        return 90 + Math.random() * 110;
      });
      embers.tick(dt, (out) => {
        out.set(walker.x + (Math.random() - 0.5) * 26, 0.5 + Math.random() * 7, walker.z + (Math.random() - 0.5) * 26);
        return 0.05 + Math.random() * 0.07;
      });
      eruption.visible = !reduced;
      if (!reduced) {
        sparkMotion.forEach((spark, i) => {
          spark.age += dt;
          if (spark.age >= spark.life) {
            craterTop(i % 3, craterPoint);
            spark.age = 0;
            spark.life = 2.8 + Math.random() * 2.2;
            sparkPositions[i * 3] = craterPoint.x;
            sparkPositions[i * 3 + 1] = craterPoint.y;
            sparkPositions[i * 3 + 2] = craterPoint.z;
            spark.x = (Math.random() - 0.5) * 42;
            spark.z = (Math.random() - 0.5) * 42;
            spark.y = 46 + Math.random() * 70;
          }
          spark.y -= 32 * dt;
          sparkPositions[i * 3] += spark.x * dt;
          sparkPositions[i * 3 + 1] += spark.y * dt;
          sparkPositions[i * 3 + 2] += spark.z * dt;
        });
        sparkGeometry.getAttribute("position").needsUpdate = true;
      }
      // The shades of the duel, circling and striking, then fading out.
      echoLeft = Math.max(0, echoLeft - dt);
      echo.visible = echoLeft > 0;
      marker.visible = echoLeft === 0;
      if (echo.visible) {
        const fade = Math.min(1, echoLeft / 1.6, (11 - echoLeft) / 1.2);
        shade.opacity = 0.34 * fade * (reduced ? 1 : 0.86 + Math.sin(time * 19) * 0.14);
        echo.rotation.y = reduced ? 0 : time * 0.45;
        fighters.forEach(({ figure, saber, side }) => {
          const swing = reduced ? 0.6 : Math.sin(time * 5.2 + (side > 0 ? Math.PI : 0));
          saber.rotation.set(0.9 + swing * 0.8, 0, side * 0.2);
          figure.position.x = side * (1.25 + (reduced ? 0 : Math.sin(time * 1.6) * 0.3));
          figure.scale.setScalar(Math.max(0.01, fade));
        });
        sparkle.material.opacity = reduced ? 0 : Math.max(0, Math.sin(time * 10.4)) * fade;
      }
    },
  };
}
