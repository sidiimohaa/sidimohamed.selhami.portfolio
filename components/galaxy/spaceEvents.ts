import * as THREE from "three";
import { tieGeometry } from "../tieModel";
import type { ActiveEvent } from "./director";
import { eventById } from "./catalog";
import { createRepublicCruiser } from "./republicCruiser";
import { createFederationBattleship, createGrievousFlagship, createVultureDroid } from "./separatistShips";
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

export function createSpaceEvents(options: { glow: THREE.Texture; ship: Ship; obstacles: () => Obstacle[] }) {
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

  // J, K: ships that drop out of hyperspace in formation, cross ahead of the visitor, then jump
  // away one by one. Each formation is built once and kept.
  type Member = { make: () => THREE.Object3D; at: [number, number, number]; arrive: number; leave: number; flash: number };
  type Formation = { root: THREE.Group; from: THREE.Vector3; to: THREE.Vector3; ships: THREE.Object3D[]; flash: THREE.Sprite[]; members: Member[]; key: number; reach: number; ahead: number; sweep: number };
  const tieParts = () => {
    const parts = tieGeometry();
    return {
      parts,
      hull: new THREE.MeshStandardMaterial({ color: 0x8c9196, metalness: 0.5, roughness: 0.45 }),
      panels: new THREE.MeshStandardMaterial({ color: 0x1a1d22, metalness: 0.4, roughness: 0.6 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x0a1118, metalness: 0.8, roughness: 0.2 }),
    };
  };
  let ties: ReturnType<typeof tieParts> | null = null;
  const tie = () => {
    ties ??= tieParts();
    const fighter = new THREE.Group();
    fighter.add(new THREE.Mesh(ties.parts.hull, ties.hull), new THREE.Mesh(ties.parts.panels, ties.panels), new THREE.Mesh(ties.parts.glass, ties.glass));
    fighter.scale.setScalar(1.1);
    return fighter;
  };
  const destroyer = () => {
    const vessel = hullOf("destroyer").clone();
    vessel.scale.multiplyScalar(6);
    // Engines lit: the traffic system normally drives these, here they just burn.
    vessel.traverse((item) => {
      if (item instanceof THREE.Sprite) {
        item.visible = true;
        item.material.opacity = 0.85;
      }
    });
    return vessel;
  };
  // Rolled towards the viewer, so a ring or a deck reads from above rather than edge on.
  const scaled = (make: () => THREE.Object3D, size: number, roll = 0) => () => {
    const vessel = make();
    vessel.scale.setScalar(size);
    vessel.rotation.z = roll;
    return vessel;
  };
  const makeFormation = (members: Member[], reach: number, ahead: number, sweep: number): Formation => {
    const root = new THREE.Group();
    const flash: THREE.Sprite[] = [];
    const ships = members.map(({ make, at }) => {
      const vessel = make();
      vessel.position.set(...at);
      vessel.visible = false;
      root.add(vessel);
      const light = sprite(glow, 0xcfe6ff, 1);
      light.position.set(...at);
      light.visible = false;
      root.add(light);
      flash.push(light);
      return vessel;
    });
    root.visible = false;
    group.add(root);
    return { root, from: new THREE.Vector3(), to: new THREE.Vector3(), ships, flash, members, key: -1, reach, ahead, sweep };
  };
  // J: an Imperial fleet, three Star Destroyers and their TIE escort.
  let fleet: Formation | null = null;
  const makeFleet = () =>
    makeFormation(
      [
        { make: destroyer, at: [0, 0, 0], arrive: 0.3, leave: 4, flash: 1 },
        { make: destroyer, at: [-150, -30, -110], arrive: 0.6, leave: 3.7, flash: 1 },
        { make: destroyer, at: [160, 26, -130], arrive: 0.9, leave: 3.4, flash: 1 },
        ...([[-40, 22, 120], [-22, 28, 132], [30, 18, 128], [48, 24, 140], [-70, -12, 60], [76, -8, 70]] as [number, number, number][]).map((at, i) => ({ make: tie, at, arrive: 1.6 + i * 0.12, leave: 2.6 - i * 0.1, flash: 0.3 })),
      ],
      190,
      270,
      210,
    );
  // K: a Trade Federation battleship under vulture droid escort, General Grievous's flagship on its
  // heels, and then a Republic cruiser on his: the Separatists jump away in a hurry and leave it alone.
  let convoy: Formation | null = null;
  const makeConvoy = () =>
    makeFormation(
      [
        { make: scaled(() => createFederationBattleship(glow), 72, -0.42), at: [30, -6, 120], arrive: 0.4, leave: 18, flash: 2.4 },
        ...([[-50, 22, 210], [-34, 32, 224], [-20, -24, 200], [64, 26, 236], [-70, 6, 150], [-58, -12, 168]] as [number, number, number][]).map((at, i) => ({
          make: scaled(() => createVultureDroid(glow), 5),
          at,
          arrive: 2.2 + i * 0.1,
          leave: 17 - i * 0.08,
          flash: 0.3,
        })),
        // He comes out of the jump last, close behind the convoy: a long dagger on its heels.
        { make: scaled(() => createGrievousFlagship(glow), 140, -0.3), at: [-40, 16, -60], arrive: 6, leave: 16, flash: 1.8 },
        { make: scaled(() => createRepublicCruiser(glow), 140, -0.32), at: [-30, 52, -150], arrive: 24, leave: 3, flash: 2 },
      ],
      230,
      330,
      110,
    );
  const setOut = (formation: Formation, camera: THREE.Camera, key: number) => {
    frame(camera);
    // In front of any world in view rather than behind it: the whole formation is brought nearer
    // and shrunk alike, so that it keeps its size on screen.
    let near = 1;
    for (const { position, radius } of options.obstacles()) {
      scratch.copy(position).project(camera);
      if (scratch.z < 1 && Math.abs(scratch.x) < 1.2 && Math.abs(scratch.y) < 1.2)
        near = Math.min(near, (camera.position.distanceTo(position) - radius - 12) / (formation.ahead + formation.reach));
    }
    near = THREE.MathUtils.clamp(near, 0.2, 1);
    formation.root.scale.setScalar(near);
    const centre = camera.position.clone().addScaledVector(forward, formation.ahead * near).addScaledVector(up, 38 * near);
    if (near === 1) clearOf(centre, options.obstacles(), formation.reach);
    formation.from.copy(centre).addScaledVector(right, -formation.sweep * near).addScaledVector(forward, 60 * near);
    formation.to.copy(centre).addScaledVector(right, formation.sweep * near).addScaledVector(forward, -30 * near);
    formation.root.position.copy(formation.from);
    formation.root.lookAt(formation.to);
    formation.key = key;
  };
  // Each ship drops out of hyperspace in a flash, the formation crosses, then each jumps away.
  const runFormation = (formation: Formation, run: ActiveEvent | undefined, travelling: boolean, justArrived: boolean, camera: THREE.Camera, life: number, reduced: boolean) => {
    const showing = run && !travelling && seen.has(run.key);
    formation.root.visible = !!showing;
    if (!showing) return;
    if (justArrived && formation.root.position.distanceTo(camera.position) > OUT_OF_REACH) setOut(formation, camera, run.key);
    const span = run.endsAt - run.startedAt;
    formation.root.position.lerpVectors(formation.from, formation.to, Math.min(1, life / span));
    formation.ships.forEach((vessel, i) => {
      const member = formation.members[i];
      const arrive = member.arrive,
        leave = span - member.leave;
      vessel.visible = life > arrive && life < leave;
      // Coming out of the jump, then going back into it, along the line of flight.
      const coming = THREE.MathUtils.clamp((life - arrive) / 0.32, 0, 1),
        going = THREE.MathUtils.clamp((life - leave + 0.4) / 0.4, 0, 1);
      const shift = reduced ? 0 : Math.pow(1 - coming, 3) * -420 + Math.pow(going, 3) * 520;
      vessel.position.set(member.at[0], member.at[1], member.at[2] + shift);
      const age = life < arrive + 1 ? life - arrive : life - leave;
      const light = formation.flash[i];
      light.visible = !reduced && age >= 0 && age < 0.45;
      if (light.visible) {
        light.scale.setScalar((36 + age * 120) * member.flash);
        light.material.opacity = 1 - age / 0.45;
      }
    });
  };

  let stopped = false;
  let ready = false;
  return {
    group,
    /** Whether something is moving, for the profile that only draws on demand. */
    animating: () => ages.size > 0,
    /** Builds everything ahead of time, one piece per idle moment, then compiles it unseen. */
    prepare(renderer: THREE.WebGLRenderer, camera: THREE.Camera, scene: THREE.Scene) {
      const steps = [() => hullOf("fighter"), () => hullOf("freighter"), () => hullOf("destroyer"), () => (patrol ??= makePatrol()), () => (fleet ??= makeFleet()), () => (convoy ??= makeConvoy()), () => derelictOf("space-distress"), () => derelictOf("space-wreck")];
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
          if (run.id === "space-patrol") setOutPatrol(camera, run.key);
          if (run.id === "space-fleet") setOut((fleet ??= makeFleet()), camera, run.key);
          if (run.id === "space-convoy") setOut((convoy ??= makeConvoy()), camera, run.key);
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

      // J, K: the fleet and the convoy.
      const fleetRun = has("space-fleet"),
        convoyRun = has("space-convoy");
      if (fleet) runFormation(fleet, fleetRun, travelling, justArrived, camera, fleetRun ? ageOf(fleetRun) : 0, reduced);
      if (convoy) runFormation(convoy, convoyRun, travelling, justArrived, camera, convoyRun ? ageOf(convoyRun) : 0, reduced);
    },
  };
}
