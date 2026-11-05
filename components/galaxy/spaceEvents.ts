import * as THREE from "three";
import { tieGeometry } from "../tieModel";
import { galaxyAudio } from "./audio";
import type { ActiveEvent } from "./director";
import { galaxy } from "./store";

// What can cross the visitor's path in open space. Everything is set out ahead of the ship when
// its event starts, far enough to come out of the dark or out of hyperspace, never in front of
// the camera. The ship cannot be damaged in free flight, so a close call is a sound and a burst.

type Ship = (kind: "destroyer" | "freighter" | "fighter") => THREE.Object3D;

function sprite(glow: THREE.Texture, color: number, size: number) {
  const item = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  item.scale.setScalar(size);
  return item;
}

function rock(seed: number) {
  const geometry = new THREE.IcosahedronGeometry(1, 2);
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const noise = (x: number, y: number, z: number) => Math.sin(x * 3.1 + seed) * Math.sin(y * 2.7 + seed * 2) * Math.sin(z * 3.3 + seed * 3);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const k = 0.78 + noise(x, y, z) * 0.42;
    position.setXYZ(i, x * k, y * k * 0.85, z * k);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function createSpaceEvents(options: { glow: THREE.Texture; ship: Ship; asteroids: number }) {
  const { glow, ship } = options;
  const group = new THREE.Group();
  group.name = "space-events";
  const seen = new Map<number, string>();
  const forward = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  const frame = (camera: THREE.Camera) => {
    camera.getWorldDirection(forward);
    right.crossVectors(forward, camera.up).normalize();
    up.crossVectors(right, forward).normalize();
  };

  // F, I: something adrift with a beacon, to fly up to.
  const makeDerelict = (kind: "freighter" | "fighter", color: number) => {
    const root = new THREE.Group();
    const hull = ship(kind);
    hull.rotation.set(0.5, 1.1, 0.9);
    hull.scale.setScalar(kind === "fighter" ? 4 : 2.4);
    hull.traverse((item) => {
      if (item instanceof THREE.Sprite) item.visible = false;
    });
    root.add(hull);
    const debris = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1), new THREE.MeshStandardMaterial({ color: 0x5c6066, metalness: 0.5, roughness: 0.7, flatShading: true }), 26);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 26; i++) {
      dummy.position.set((Math.random() - 0.5) * 42, (Math.random() - 0.5) * 22, (Math.random() - 0.5) * 42);
      dummy.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      dummy.scale.setScalar(0.25 + Math.random() * 1.1);
      dummy.updateMatrix();
      debris.setMatrixAt(i, dummy.matrix);
    }
    root.add(debris);
    const beacon = sprite(glow, color, 16);
    beacon.position.y = 7;
    root.add(beacon);
    root.visible = false;
    group.add(root);
    return { root, beacon };
  };
  const derelicts: Record<string, ReturnType<typeof makeDerelict>> = {};
  const derelictOf = (id: string) => (derelicts[id] ??= id === "space-distress" ? makeDerelict("fighter", 0xff5040) : makeDerelict("freighter", 0x9fe6ff));

  // G: a patrol in formation.
  let patrol: { root: THREE.Group; from: THREE.Vector3; to: THREE.Vector3 } | null = null;
  const makePatrol = (camera: THREE.Camera) => {
    const parts = tieGeometry();
    const hull = new THREE.MeshStandardMaterial({ color: 0x8c9196, metalness: 0.5, roughness: 0.45 });
    const panels = new THREE.MeshStandardMaterial({ color: 0x1a1d22, metalness: 0.4, roughness: 0.6 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0a1118, metalness: 0.8, roughness: 0.2 });
    const root = new THREE.Group();
    [[0, 0, 0], [-16, 3, -12], [16, -3, -12], [0, 8, -24]].forEach(([x, y, z]) => {
      const fighter = new THREE.Group();
      fighter.add(new THREE.Mesh(parts.hull, hull), new THREE.Mesh(parts.panels, panels), new THREE.Mesh(parts.glass, glass));
      fighter.position.set(x, y, z);
      fighter.scale.setScalar(2);
      root.add(fighter);
    });
    group.add(root);
    frame(camera);
    const side = Math.random() < 0.5 ? -1 : 1;
    const centre = camera.position.clone().addScaledVector(forward, 160).addScaledVector(up, 18 * side);
    const from = centre.clone().addScaledVector(right, -460 * side).addScaledVector(forward, 120);
    const to = centre.clone().addScaledVector(right, 460 * side).addScaledVector(forward, -40);
    return { root, from, to };
  };

  // H: an asteroid cluster.
  const rocks = new THREE.InstancedMesh(rock(1.7), new THREE.MeshStandardMaterial({ color: 0x6d6459, roughness: 0.97, metalness: 0.03, flatShading: true }), options.asteroids);
  rocks.visible = false;
  rocks.frustumCulled = false;
  rocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(rocks);
  const fieldItems = Array.from({ length: options.asteroids }, () => ({ at: new THREE.Vector3(), spin: new THREE.Vector3(), rot: new THREE.Euler(), size: 1, drift: new THREE.Vector3(), broken: false }));
  const dummy = new THREE.Object3D();
  let fieldLevel = 0;
  const burst = sprite(glow, 0xffc08a, 1);
  burst.visible = false;
  group.add(burst);
  let burstAge = 1;

  // J: a fleet out of hyperspace.
  let fleet: { root: THREE.Group; from: THREE.Vector3; to: THREE.Vector3; flash: THREE.Sprite[]; ships: THREE.Object3D[] } | null = null;
  const makeFleet = (camera: THREE.Camera) => {
    frame(camera);
    const root = new THREE.Group();
    const layout: [("destroyer" | "freighter" | "fighter"), number, number, number][] = [
      ["destroyer", 0, 0, 0],
      ["destroyer", -150, -30, -110],
      ["destroyer", 160, 26, -130],
      ["freighter", -70, 34, 90],
      ["freighter", 80, -36, 80],
      ["fighter", -30, 16, 150],
      ["fighter", 34, 12, 160],
    ];
    const flash: THREE.Sprite[] = [];
    const ships = layout.map(([kind, x, y, z]) => {
      const vessel = ship(kind);
      vessel.position.set(x, y, z);
      vessel.scale.multiplyScalar(kind === "destroyer" ? 6 : kind === "freighter" ? 5 : 6);
      // Engines lit: the traffic system normally drives these, here they just burn.
      vessel.traverse((item) => {
        if (item instanceof THREE.Sprite) {
          item.visible = true;
          item.material.opacity = 0.85;
        }
      });
      root.add(vessel);
      const light = sprite(glow, 0xcfe6ff, 1);
      light.position.set(x, y, z);
      light.visible = false;
      root.add(light);
      flash.push(light);
      return vessel;
    });
    group.add(root);
    const centre = camera.position.clone().addScaledVector(forward, 270).addScaledVector(up, 38);
    const from = centre.clone().addScaledVector(right, -210).addScaledVector(forward, 60);
    const to = centre.clone().addScaledVector(right, 210).addScaledVector(forward, -30);
    root.position.copy(from);
    root.lookAt(to);
    return { root, from, to, flash, ships };
  };
  const release = (object: THREE.Object3D) => {
    group.remove(object);
    object.traverse((item) => {
      const mesh = item as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
  };

  return {
    group,
    tick(dt: number, elapsed: number, reduced: boolean, camera: THREE.PerspectiveCamera, runs: ActiveEvent[]) {
      const has = (id: string) => runs.find((run) => run.id === id);
      const now = galaxy().now();
      const keys = new Set(runs.map((run) => run.key));
      for (const [key, id] of seen) {
        if (keys.has(key)) continue;
        seen.delete(key);
        if (derelicts[id]) derelicts[id].root.visible = false;
      }

      // Newly started: set the scene ahead of the ship.
      for (const run of runs) {
        if (seen.has(run.key)) continue;
        seen.set(run.key, run.id);
        frame(camera);
        if (run.id === "space-distress" || run.id === "space-wreck") {
          const item = derelictOf(run.id);
          const side = Math.random() < 0.5 ? -1 : 1;
          item.root.position.copy(camera.position).addScaledVector(forward, 210).addScaledVector(right, side * (50 + Math.random() * 50)).addScaledVector(up, -12 + Math.random() * 30);
          item.root.visible = true;
        }
        if (run.id === "space-asteroids") {
          const centre = camera.position.clone().addScaledVector(forward, 250);
          fieldItems.forEach((item) => {
            const a = Math.random() * Math.PI * 2,
              r = 30 + Math.pow(Math.random(), 0.7) * 170;
            item.at.copy(centre).addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r * 0.45).addScaledVector(forward, (Math.random() - 0.5) * 240);
            item.spin.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.9);
            item.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
            item.size = 1.2 + Math.pow(Math.random(), 2.4) * 13;
            item.drift.copy(right).multiplyScalar((Math.random() - 0.5) * 3).addScaledVector(up, (Math.random() - 0.5) * 1.5);
            item.broken = false;
          });
        }
        if (run.id === "space-patrol" && !patrol) patrol = makePatrol(camera);
        if (run.id === "space-fleet" && !fleet) fleet = makeFleet(camera);
      }

      // F, I: drift, blink, and report when the visitor has come close.
      for (const id of ["space-distress", "space-wreck"]) {
        const item = derelicts[id];
        const run = has(id);
        if (!item || !run) continue;
        item.root.rotation.y += dt * 0.05;
        item.root.rotation.z += dt * 0.03;
        item.beacon.material.opacity = reduced ? 0.8 : 0.25 + 0.75 * (Math.sin(elapsed * 4.2) > 0 ? 1 : 0);
        if (item.root.position.distanceTo(camera.position) < 62) {
          galaxy().found(id);
          item.root.visible = false;
        }
      }

      // G: the patrol crosses in one long pass, and leaves when its event ends.
      const patrolRun = has("space-patrol");
      if (patrol) {
        const life = patrolRun ? (now - patrolRun.startedAt) / (patrolRun.endsAt - patrolRun.startedAt) : 2;
        if (life > 1.02) {
          release(patrol.root);
          patrol = null;
        } else {
          patrol.root.position.lerpVectors(patrol.from, patrol.to, Math.min(1, life));
          patrol.root.lookAt(patrol.to);
        }
      }

      // H: rocks ease in and out of the dark; those that come too close burst.
      const field = has("space-asteroids");
      fieldLevel += ((field ? 1 : 0) - fieldLevel) * (1 - Math.exp(-dt * 0.45));
      rocks.visible = fieldLevel > 0.01;
      if (rocks.visible) {
        fieldItems.forEach((item, i) => {
          if (!reduced) {
            item.at.addScaledVector(item.drift, dt);
            item.rot.x += item.spin.x * dt;
            item.rot.y += item.spin.y * dt;
            item.rot.z += item.spin.z * dt;
          }
          if (!item.broken && item.at.distanceTo(camera.position) < item.size + 5) {
            item.broken = true;
            burst.position.copy(item.at);
            burst.visible = true;
            burstAge = 0;
            galaxyAudio.thunder(0.25);
          }
          dummy.position.copy(item.at);
          dummy.rotation.copy(item.rot);
          dummy.scale.setScalar(item.broken ? 0 : item.size * fieldLevel);
          dummy.updateMatrix();
          rocks.setMatrixAt(i, dummy.matrix);
        });
        rocks.instanceMatrix.needsUpdate = true;
      }
      if (burst.visible) {
        burstAge += dt;
        burst.scale.setScalar(reduced ? 18 : 6 + burstAge * 60);
        burst.material.opacity = Math.max(0, 1 - burstAge / 0.6);
        if (burstAge > 0.6) burst.visible = false;
      }

      // J: flashes on arrival, the long crossing, flashes again as each ship jumps away.
      const fleetRun = has("space-fleet");
      if (fleet) {
        const span = fleetRun ? fleetRun.endsAt - fleetRun.startedAt : 1;
        const life = fleetRun ? now - fleetRun.startedAt : span + 99;
        if (life > span + 1) {
          release(fleet.root);
          fleet = null;
        } else {
          fleet.root.position.lerpVectors(fleet.from, fleet.to, Math.min(1, life / span));
          fleet.ships.forEach((vessel, i) => {
            const arrive = 0.3 + i * 0.28,
              leave = span - 4 + i * 0.28;
            vessel.visible = life > arrive && life < leave;
            const age = life < arrive + 1 ? life - arrive : life - leave;
            const light = fleet!.flash[i];
            light.visible = !reduced && age >= 0 && age < 0.45;
            if (light.visible) {
              light.scale.setScalar(36 + age * 120);
              light.material.opacity = 1 - age / 0.45;
            }
          });
        }
      }
    },
  };
}
