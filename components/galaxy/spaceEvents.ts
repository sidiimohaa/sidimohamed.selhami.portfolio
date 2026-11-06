import * as THREE from "three";
import { tieGeometry } from "../tieModel";
import { galaxyAudio } from "./audio";
import type { ActiveEvent } from "./director";
import { eventById } from "./catalog";
import { hideSignalMarker, showSignalMarker } from "./signalMarker";
import { clearOf, type Obstacle } from "./spacePlacement";
import { galaxy } from "./store";

// What can cross the visitor's path in open space. Everything is set out ahead of the ship when
// its event starts, far enough to come out of the dark or out of hyperspace, never in front of
// the camera nor inside a world. The ship cannot be damaged in free flight, so a close call is a
// sound and a burst.
//
// Motion follows a clock of its own, advanced every frame: the director's only ticks once a second.
// The ships are built once and kept, a few at a time when the scene is idle, so that an event never
// stalls the flight when it starts. An event interrupted by a trip is set out again on arrival.

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

export function createSpaceEvents(options: { glow: THREE.Texture; ship: Ship; asteroids: number; obstacles: () => Obstacle[] }) {
  const { glow, ship } = options;
  const group = new THREE.Group();
  group.name = "space-events";
  // The wrecks the visitor has just reached, told apart from those whose signal simply ended.
  const eventFound = new Set<string>();
  let wasTravelling = false;
  // Seconds each running event has been on, from its key.
  const ages = new Map<number, number>();
  const seen = new Map<number, string>();
  const forward = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  const frame = (camera: THREE.Camera) => {
    camera.getWorldDirection(forward);
    right.crossVectors(forward, camera.up).normalize();
    up.crossVectors(right, forward).normalize();
  };
  // Beyond this after a trip, something has been left behind and is set out again.
  const OUT_OF_REACH = 560;
  const scratch = new THREE.Vector3();

  // One of each hull, cloned as needed: clones share geometry and materials.
  const hulls: Partial<Record<"destroyer" | "freighter" | "fighter", THREE.Object3D>> = {};
  const hullOf = (kind: "destroyer" | "freighter" | "fighter") => (hulls[kind] ??= ship(kind));

  // F, I: something adrift with a beacon, to fly up to.
  type Derelict = { root: THREE.Group; beacon: THREE.Sprite; lingering: boolean };
  const makeDerelict = (kind: "freighter" | "fighter", color: number): Derelict => {
    const root = new THREE.Group();
    const hull = hullOf(kind).clone();
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
    return { root, beacon, lingering: false };
  };
  const derelicts: Record<string, Derelict> = {};
  const derelictOf = (id: string) => (derelicts[id] ??= id === "space-distress" ? makeDerelict("fighter", 0xff5040) : makeDerelict("freighter", 0x9fe6ff));
  const setOutDerelict = (item: Derelict, camera: THREE.Camera) => {
    frame(camera);
    const side = Math.random() < 0.5 ? -1 : 1;
    item.root.position.copy(camera.position).addScaledVector(forward, 210).addScaledVector(right, side * (50 + Math.random() * 50)).addScaledVector(up, -12 + Math.random() * 30);
    clearOf(item.root.position, options.obstacles(), 40);
    item.root.visible = true;
    item.lingering = false;
  };

  // G: a patrol in formation, kept between passes.
  let patrol: { root: THREE.Group; from: THREE.Vector3; to: THREE.Vector3; key: number } | null = null;
  const makePatrol = () => {
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
    root.visible = false;
    group.add(root);
    return { root, from: new THREE.Vector3(), to: new THREE.Vector3(), key: -1 };
  };
  const setOutPatrol = (camera: THREE.Camera, key: number) => {
    patrol ??= makePatrol();
    frame(camera);
    const side = Math.random() < 0.5 ? -1 : 1;
    const centre = camera.position.clone().addScaledVector(forward, 160).addScaledVector(up, 18 * side);
    clearOf(centre, options.obstacles(), 60);
    patrol.from.copy(centre).addScaledVector(right, -460 * side).addScaledVector(forward, 120);
    patrol.to.copy(centre).addScaledVector(right, 460 * side).addScaledVector(forward, -40);
    patrol.key = key;
  };

  // H: an asteroid field, kept round the ship for as long as it lasts: rocks left behind come back
  // ahead, so the visitor really is flying through it.
  const rocks = new THREE.InstancedMesh(rock(1.7), new THREE.MeshStandardMaterial({ color: 0x6d6459, roughness: 0.97, metalness: 0.03, flatShading: true, transparent: true, opacity: 0 }), options.asteroids);
  rocks.visible = false;
  rocks.frustumCulled = false;
  rocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(rocks);
  const fieldItems = Array.from({ length: options.asteroids }, () => ({ at: new THREE.Vector3(), spin: new THREE.Vector3(), rot: new THREE.Euler(), size: 1, drift: new THREE.Vector3(), broken: false, grown: 1 }));
  const dummy = new THREE.Object3D();
  let fieldLevel = 0;
  const FIELD_REACH = 330;
  const setRock = (item: (typeof fieldItems)[number], ahead: boolean, camera: THREE.Camera) => {
    const a = Math.random() * Math.PI * 2,
      r = 26 + Math.pow(Math.random(), 0.7) * 170;
    const depth = ahead ? 190 + Math.random() * 120 : 70 + Math.random() * 240;
    item.at.copy(camera.position).addScaledVector(forward, depth).addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r * 0.45);
    clearOf(item.at, options.obstacles(), 16);
    item.spin.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.9);
    item.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    item.size = 1.2 + Math.pow(Math.random(), 2.4) * 13;
    item.drift.copy(right).multiplyScalar((Math.random() - 0.5) * 3).addScaledVector(up, (Math.random() - 0.5) * 1.5);
    item.broken = false;
    item.grown = ahead ? 0 : 1;
  };
  const burst = sprite(glow, 0xffc08a, 1);
  burst.visible = false;
  group.add(burst);
  let burstAge = 1;

  // J: a fleet out of hyperspace, built once and kept.
  type Fleet = { root: THREE.Group; from: THREE.Vector3; to: THREE.Vector3; flash: THREE.Sprite[]; ships: THREE.Object3D[]; rest: THREE.Vector3[]; key: number };
  let fleet: Fleet | null = null;
  const makeFleet = (): Fleet => {
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
    const rest: THREE.Vector3[] = [];
    const ships = layout.map(([kind, x, y, z]) => {
      const vessel = hullOf(kind).clone();
      vessel.position.set(x, y, z);
      rest.push(vessel.position.clone());
      vessel.scale.multiplyScalar(kind === "destroyer" ? 6 : kind === "freighter" ? 5 : 6);
      // Engines lit: the traffic system normally drives these, here they just burn.
      vessel.traverse((item) => {
        if (item instanceof THREE.Sprite) {
          item.visible = true;
          item.material.opacity = 0.85;
        }
      });
      vessel.visible = false;
      root.add(vessel);
      const light = sprite(glow, 0xcfe6ff, 1);
      light.position.set(x, y, z);
      light.visible = false;
      root.add(light);
      flash.push(light);
      return vessel;
    });
    root.visible = false;
    group.add(root);
    return { root, from: new THREE.Vector3(), to: new THREE.Vector3(), flash, ships, rest, key: -1 };
  };
  const setOutFleet = (camera: THREE.Camera, key: number) => {
    fleet ??= makeFleet();
    frame(camera);
    const centre = camera.position.clone().addScaledVector(forward, 270).addScaledVector(up, 38);
    clearOf(centre, options.obstacles(), 190);
    fleet.from.copy(centre).addScaledVector(right, -210).addScaledVector(forward, 60);
    fleet.to.copy(centre).addScaledVector(right, 210).addScaledVector(forward, -30);
    fleet.root.position.copy(fleet.from);
    fleet.root.lookAt(fleet.to);
    fleet.key = key;
  };

  let stopped = false;
  let ready = false;
  return {
    group,
    /** Whether something is moving, for the profile that only draws on demand. */
    animating: () => ages.size > 0 || fieldLevel > 0.01 || burst.visible,
    /** Builds everything ahead of time, one piece per idle moment, then compiles it unseen. */
    prepare(renderer: THREE.WebGLRenderer, camera: THREE.Camera, scene: THREE.Scene) {
      const steps = [() => hullOf("fighter"), () => hullOf("freighter"), () => hullOf("destroyer"), () => (patrol ??= makePatrol()), () => (fleet ??= makeFleet()), () => derelictOf("space-distress"), () => derelictOf("space-wreck")];
      const next = () => {
        if (stopped) return;
        const step = steps.shift();
        if (step) {
          step();
          window.setTimeout(next, 180);
          return;
        }
        ready = true;
        void renderer.compileAsync(group, camera, scene).catch(() => undefined);
      };
      window.setTimeout(next, 2500);
    },
    isReady: () => ready,
    stop: () => {
      stopped = true;
      hideSignalMarker();
    },
    tick(dt: number, elapsed: number, reduced: boolean, camera: THREE.PerspectiveCamera, runs: ActiveEvent[], travelling = false) {
      const has = (id: string) => runs.find((run) => run.id === id);
      const justArrived = wasTravelling && !travelling;
      wasTravelling = travelling;
      const keys = new Set(runs.map((run) => run.key));
      for (const key of ages.keys()) if (!keys.has(key)) ages.delete(key);
      for (const run of runs) ages.set(run.key, (ages.get(run.key) ?? 0) + dt);
      const ageOf = (run: ActiveEvent) => ages.get(run.key) ?? 0;
      for (const [key, id] of seen) {
        if (keys.has(key)) continue;
        seen.delete(key);
        const item = derelicts[id];
        // Found, a wreck stays where it is until the visitor has flown on.
        if (item) {
          if (eventFound.has(id)) {
            eventFound.delete(id);
            item.lingering = true;
          } else item.root.visible = false;
        }
      }

      // Newly started: set the scene ahead of the ship, unless a trip is under way.
      if (!travelling) {
        for (const run of runs) {
          if (seen.has(run.key)) continue;
          seen.set(run.key, run.id);
          frame(camera);
          if (run.id === "space-distress" || run.id === "space-wreck") setOutDerelict(derelictOf(run.id), camera);
          if (run.id === "space-asteroids") fieldItems.forEach((item) => setRock(item, false, camera));
          if (run.id === "space-patrol") setOutPatrol(camera, run.key);
          if (run.id === "space-fleet") setOutFleet(camera, run.key);
        }
      }

      // F, I: drift, blink, and report when the visitor has come close. The marker points the way.
      let signal: { position: THREE.Vector3; text: string } | null = null;
      for (const id of ["space-distress", "space-wreck"]) {
        const item = derelicts[id];
        if (!item) continue;
        if (item.lingering) {
          item.beacon.visible = false;
          if (item.root.position.distanceTo(camera.position) > 320) {
            item.lingering = false;
            item.root.visible = false;
            item.beacon.visible = true;
          }
          continue;
        }
        const run = has(id);
        if (!run || !seen.has(run.key)) continue;
        if (travelling) {
          item.root.visible = false;
          continue;
        }
        const away = item.root.position.distanceTo(camera.position);
        if (!item.root.visible || (justArrived && away > OUT_OF_REACH)) setOutDerelict(item, camera);
        item.beacon.visible = true;
        item.root.rotation.y += dt * 0.05;
        item.root.rotation.z += dt * 0.03;
        item.beacon.material.opacity = reduced ? 0.8 : 0.25 + 0.75 * (Math.sin(elapsed * 4.2) > 0 ? 1 : 0);
        if (away < 62) {
          eventFound.add(id);
          galaxy().found(id);
        } else if (dt > 0) signal = { position: item.root.position, text: `${eventById(id)?.title ?? "Signal"} · ${Math.round(away * 10)} km` };
      }
      if (signal) {
        const { position, text } = signal as { position: THREE.Vector3; text: string };
        scratch.copy(position).applyMatrix4(camera.matrixWorldInverse);
        const behind = scratch.z > 0;
        scratch.copy(position).project(camera);
        showSignalMarker(scratch.x, scratch.y, behind, text);
      } else hideSignalMarker();

      // G: the patrol crosses in one long pass, and leaves when its event ends.
      const patrolRun = has("space-patrol");
      if (patrol) {
        const showing = patrolRun && !travelling && seen.has(patrolRun.key);
        patrol.root.visible = !!showing;
        if (showing) {
          // Left far behind by a trip: it comes round again from here.
          if (justArrived && patrol.root.position.distanceTo(camera.position) > OUT_OF_REACH) setOutPatrol(camera, patrolRun.key);
          const life = THREE.MathUtils.clamp(ageOf(patrolRun) / (patrolRun.endsAt - patrolRun.startedAt), 0, 1);
          patrol.root.position.lerpVectors(patrol.from, patrol.to, life);
          patrol.root.lookAt(patrol.to);
          if (!reduced) patrol.root.rotateZ(Math.sin(elapsed * 0.7) * 0.06);
        }
      }

      // H: rocks fade out of the dark; those that come too close burst.
      const field = has("space-asteroids");
      fieldLevel += ((field && !travelling ? 1 : 0) - fieldLevel) * (1 - Math.exp(-dt * 0.9));
      rocks.visible = fieldLevel > 0.01;
      (rocks.material as THREE.MeshStandardMaterial).opacity = fieldLevel;
      if (rocks.visible) {
        frame(camera);
        fieldItems.forEach((item, i) => {
          if (!reduced) {
            item.at.addScaledVector(item.drift, dt);
            item.rot.x += item.spin.x * dt;
            item.rot.y += item.spin.y * dt;
            item.rot.z += item.spin.z * dt;
          }
          item.grown = Math.min(1, item.grown + dt * 0.5);
          const away = item.at.distanceTo(camera.position);
          if (field && away > FIELD_REACH) setRock(item, true, camera);
          else if (!item.broken && away < item.size + 5) {
            item.broken = true;
            burst.position.copy(item.at);
            burst.visible = true;
            burstAge = 0;
            galaxyAudio.thunder(0.25);
          }
          dummy.position.copy(item.at);
          dummy.rotation.copy(item.rot);
          dummy.scale.setScalar(item.broken ? 0 : item.size * item.grown);
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

      // J: each ship drops out of hyperspace in a flash, the fleet crosses, then each jumps away.
      const fleetRun = has("space-fleet");
      if (fleet) {
        const showing = fleetRun && !travelling && seen.has(fleetRun.key);
        fleet.root.visible = !!showing;
        if (showing) {
          if (justArrived && fleet.root.position.distanceTo(camera.position) > OUT_OF_REACH) setOutFleet(camera, fleetRun.key);
          const span = fleetRun.endsAt - fleetRun.startedAt,
            life = ageOf(fleetRun);
          fleet.root.position.lerpVectors(fleet.from, fleet.to, Math.min(1, life / span));
          fleet.ships.forEach((vessel, i) => {
            const arrive = 0.3 + i * 0.28,
              leave = span - 4 + i * 0.28;
            vessel.visible = life > arrive && life < leave;
            // Coming out of the jump, then going back into it, along the line of flight.
            const coming = THREE.MathUtils.clamp((life - arrive) / 0.32, 0, 1),
              going = THREE.MathUtils.clamp((life - leave + 0.4) / 0.4, 0, 1);
            const shift = reduced ? 0 : Math.pow(1 - coming, 3) * -420 + Math.pow(going, 3) * 520;
            vessel.position.copy(fleet!.rest[i]).setZ(fleet!.rest[i].z + shift);
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
