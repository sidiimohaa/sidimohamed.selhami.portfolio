import * as THREE from "three";
import { createPadLife, type PadEvent } from "./coruscantLife";
import { createEndorForest } from "./endorForest";
import { BIKE_PATH, createEndorLife } from "./endorLife";
import { BUNKER, WRECKS, createEndorLandmarks } from "./endorLandmarks";
import { BRIDGE, DECK, RAMP, VILLAGE, bridgeHeight, createEndorVillage, rampPoint } from "./endorVillage";
import { glowTexture, parkShip, type Spot, type Zone, type ZoneAction } from "./landingKit";
import { createSurfaceNavigator } from "./surfaceNavigation";
import type { Landing } from "./universe";

// Endor: the ship sets down in a forest clearing below an Ewok village. Around the campfire an
// elder tells the visitor's passions, a salvaged holoprojector casting one hologram per chapter
// of the "Mes passions" presentation; a ramp coils up a trunk to the platforms and their rope bridge.
// A bright, sunlit haze between the trunks, as in the reference pictures.
const HAZE = new THREE.Color(0xb2bf9c);
// Far enough out to take in the whole ramp round the first village tree.
const WALK = 40;

export function createEndorZone(landing: Landing, notify: (event: PadEvent) => void): Zone {
  const group = new THREE.Group();
  const glow = glowTexture();
  // Late-afternoon sun slanting through the canopy gap, warm fill from the fire, green bounce.
  const sun = new THREE.DirectionalLight(0xffe2a8, 2.4);
  sun.position.set(-34, 110, -20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 260 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  const sky = new THREE.HemisphereLight(0xcfe0b0, 0x2c2418, 0.9);
  group.add(sun, sun.target, sky);

  const circles: Spot[] = [];
  const village = createEndorVillage(landing, circles);
  // Keep trees and ferns off the bikes' run, the trail, the wrecks and the bunker.
  const keepClear = [...BIKE_PATH.getSpacedPoints(160), ...WRECKS];
  for (let z = -20; z > -46; z -= 1.5) keepClear.push(new THREE.Vector3(0, 0, z));
  for (let x = -8; x <= 8; x += 2.5) for (let z = BUNKER.z - 6; z <= BUNKER.z + 7; z += 2.5) keepClear.push(new THREE.Vector3(x, 0, z));
  const forest = createEndorForest({ village: VILLAGE, keepClear });
  circles.push(...forest.colliders);
  const life = createEndorLife(notify);
  const landmarks = createEndorLandmarks(circles);
  group.add(forest.group, village.group, life.group, landmarks.group);

  const metal = new THREE.MeshStandardMaterial({ color: 0x6f6a60, roughness: 0.6, metalness: 0.6 });
  const parking = parkShip(metal);
  group.add(parking.ship);
  const crew = createPadLife({ glow, engines: parking.exhausts, notify, guard: false, drone: false, taxi: false, ground: "sand", steam: 0xd9ddd2 });
  group.add(crew.group);

  // Walking up there: the visitor's floor follows the ramp, platforms and bridge they are on.
  let level = 0;
  const last = { x: 5.5, z: 9.5 };
  const tree = RAMP.tree;
  const rampAt = (x: number, z: number) => {
    // The ramp's inner edge reaches under the platform's railing, so there is no gap to step over at the top.
    const r = Math.hypot(x - tree.x, z - tree.z);
    if (r < RAMP.inner - 0.5 || r > RAMP.outer) return null;
    const angle = Math.atan2(z - tree.z, x - tree.x);
    const p = (((angle - RAMP.start) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / RAMP.span;
    return p <= 1 ? p * tree.deck : null;
  };
  const decks = [VILLAGE[0], VILLAGE[1]];
  const surfaces = (x: number, z: number) => {
    const heights: number[] = [];
    const ramp = rampAt(x, z);
    // The low part of the ramp leaves no headroom to walk underneath.
    if (ramp === null || ramp > 2.4) heights.push(0);
    if (ramp !== null) heights.push(ramp);
    decks.forEach((deck, index) => {
      if (Math.hypot(x - deck.x, z - deck.z) > DECK - 0.35) return;
      if (village.deckObstacles.some((o) => o.deck === index && Math.hypot(x - o.x, z - o.z) < o.r)) return;
      heights.push(deck.deck);
    });
    const span = BRIDGE.to.clone().sub(BRIDGE.from).setY(0),
      t = THREE.MathUtils.clamp(((x - BRIDGE.from.x) * span.x + (z - BRIDGE.from.z) * span.z) / span.lengthSq(), 0, 1);
    if (Math.hypot(x - (BRIDGE.from.x + span.x * t), z - (BRIDGE.from.z + span.z * t)) < 0.7) heights.push(bridgeHeight(t));
    return heights;
  };
  const constrain = (walker: { x: number; z: number }) => {
    let best: number | null = null;
    for (const h of surfaces(walker.x, walker.z)) if (Math.abs(h - level) < 0.9 && (best === null || Math.abs(h - level) < Math.abs(best - level))) best = h;
    if (best === null) {
      // No ground to step on at this height: stay where you were (the railings, the ramp's edge).
      walker.x = last.x;
      walker.z = last.z;
      return;
    }
    level = best;
    last.x = walker.x;
    last.z = walker.z;
  };

  // Routes: along the ground with the navigator, and up or down by the ramp.
  const footprint = parking.footprint;
  const ground = createSurfaceNavigator(WALK, (x, z) => {
    if (Math.hypot(x, z) > WALK - 0.2) return false;
    if (rampAt(x, z) !== null) return false;
    if (circles.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + 0.35)) return false;
    return !(x > footprint.minX - 0.05 && x < footprint.maxX + 0.05 && z > footprint.minZ - 0.05 && z < footprint.maxZ + 0.05);
  });
  const bottom = rampPoint(-0.06, (RAMP.inner + RAMP.outer) / 2).setY(0);
  const top = new THREE.Vector3(tree.x + Math.cos(RAMP.start + RAMP.span) * (DECK - 1.6), tree.deck, tree.z + Math.sin(RAMP.start + RAMP.span) * (DECK - 1.6));
  const up = Array.from({ length: 30 }, (_, i) => rampPoint((i + 0.5) / 30));
  // Where on the ramp the visitor stands (0 at the bottom, 1 at the top), if they are on it.
  const onRamp = (x: number, z: number) => {
    const h = rampAt(x, z);
    return h !== null && Math.abs(h - level) < 1 ? h / tree.deck : null;
  };
  const span = BRIDGE.to.clone().sub(BRIDGE.from).setY(0);
  const bridgeT = (x: number, z: number) => THREE.MathUtils.clamp(((x - BRIDGE.from.x) * span.x + (z - BRIDGE.from.z) * span.z) / span.lengthSq(), 0, 1);
  const nearBridge = (x: number, z: number) => {
    const t = bridgeT(x, z);
    return Math.hypot(x - (BRIDGE.from.x + span.x * t), z - (BRIDGE.from.z + span.z * t)) < 1;
  };
  // From anywhere on the platforms or the bridge back to the ramp's top, round the trunk inside the huts.
  const toLanding = (from: THREE.Vector3) => {
    const points: THREE.Vector3[] = [];
    const onSecond = Math.hypot(from.x - VILLAGE[1].x, from.z - VILLAGE[1].z) < DECK + 0.5;
    if (onSecond) points.push(BRIDGE.to.clone(), BRIDGE.from.clone());
    else if (nearBridge(from.x, from.z) && bridgeT(from.x, from.z) > 0.02) points.push(BRIDGE.from.clone());
    const start = points.length ? BRIDGE.from : from;
    const a0 = Math.atan2(start.z - tree.z, start.x - tree.x),
      a1 = RAMP.start + RAMP.span;
    const turn = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0));
    for (let k = 1; k <= 8; k++) {
      const a = a0 + (turn * k) / 8;
      points.push(new THREE.Vector3(tree.x + Math.cos(a) * 5.4, tree.deck, tree.z + Math.sin(a) * 5.4));
    }
    points.push(rampPoint(0.995));
    return points;
  };
  const routeTo = (from: THREE.Vector3, to: THREE.Vector3) => {
    const goingUp = to.y > 1;
    if (level <= 1) return goingUp ? [...ground(from, bottom), ...up, top.clone()] : ground(from, to);
    // Already on the ramp: carry on up or down from where they stand.
    const p = onRamp(from.x, from.z);
    if (p !== null) {
      if (goingUp) return [...up.filter((point) => point.y > p * tree.deck), top.clone()];
      return [...up.filter((point) => point.y < p * tree.deck).reverse(), bottom.clone(), ...ground(bottom, to)];
    }
    if (goingUp) return [...toLanding(from), top.clone()];
    return [...toLanding(from), ...up.slice().reverse(), bottom.clone(), ...ground(bottom, to)];
  };

  // The elder: touching him (or the bar button) opens the whole presentation from its intro.
  const elderMeshes: THREE.Object3D[] = [];
  village.elder.root.traverse((o) => {
    if (o instanceof THREE.Mesh) elderMeshes.push(o);
  });
  const actions: ZoneAction[] = [
    {
      id: "elder",
      label: "Écouter l’ancien",
      position: village.elder.position,
      objects: elderMeshes,
      story: { title: "Mes passions" },
      activate: () => village.elder.speak(),
    },
  ];

  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh) return;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    object.castShadow = materials.every((m) => m instanceof THREE.MeshStandardMaterial && !m.transparent && m.alphaTest === 0);
  });
  return {
    group,
    fog: new THREE.FogExp2(HAZE, 0.0118),
    exposure: 1.05,
    walkRadius: WALK,
    // The arrival is watched from the take-off corridor, looking back over the fire into the clearing.
    arrival: { from: new THREE.Vector3(5, 13, 44), to: new THREE.Vector3(8, 4.5, 23.5) },
    terminals: village.terminals,
    ship: parking.ship,
    shipRest: parking.shipRest,
    colliders: { circles, footprint, movers: [...crew.movers, ...village.movers] },
    actions,
    actionApproach: { position: new THREE.Vector3(-1.9, 0, 15.4), lookAt: village.elder.position },
    routeTo,
    floorAt: () => level,
    constrainWalk: constrain,
    climb: {
      up: "MONTER AU VILLAGE ↑",
      down: "↓ REDESCENDRE",
      top,
      bottom,
      aloft: () => level > 1,
      place: (aloft) => {
        level = aloft ? tree.deck : 0;
        const spot = aloft ? top : bottom;
        last.x = spot.x;
        last.z = spot.z;
      },
    },
    setViewport: (height) => {
      crew.setViewport(height);
      life.setViewport(height);
    },
    // In front of the ship's nose, looking past the fire and the holoprojector to the village.
    spawn: { position: new THREE.Vector3(5.5, 0, 9.5), yaw: Math.atan2(5.5, -10.5) },
    setQuality: (quality) => {
      const size = quality > 1 ? 2048 : 1024;
      sun.castShadow = quality > 0;
      if (sun.shadow.mapSize.x !== size) {
        sun.shadow.mapSize.set(size, size);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
    },
    setThrust: (thrust) => {
      crew.settle(thrust < 0.05);
      parking.setThrust(thrust);
    },
    tick: (dt, elapsed, reduced, walker) => {
      crew.tick(dt, elapsed, reduced, walker);
      village.tick(dt, reduced);
      forest.tick(elapsed, reduced);
      life.tick(dt, reduced);
    },
  };
}
