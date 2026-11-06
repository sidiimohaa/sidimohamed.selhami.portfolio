import * as THREE from "three";

// The way out, once the record has been read: the visitor's fighter leaves the bay past the station,
// a flight of TIE fighters comes to intercept it, and the hyperdrive cuts in. It cannot be lost: the
// shields only ever run down to the jump, which comes when the TIEs are gone or the time is up.

type TieParts = { hull: THREE.BufferGeometry; panels: THREE.BufferGeometry; glass: THREE.BufferGeometry; materials: [THREE.Material, THREE.Material, THREE.Material] };
export type EscapeStatus = { kills: number; goal: number; shield: number; jumping: boolean; done: boolean };

const GOAL = 5,
  TIME_LIMIT = 26,
  JUMP = 1.9;

export function createEscapeRun(camera: THREE.PerspectiveCamera, tie: TieParts, ship: THREE.Object3D, globe: THREE.Object3D, sounds: { shot: () => void; blast: () => void; jump: () => void }) {
  const group = new THREE.Group();
  group.name = "escape-run";
  group.visible = false;
  const shipHome = new THREE.Vector3(0, -4.8, -25);
  const aim = new THREE.Vector2();
  const ray = new THREE.Raycaster();
  const redBolt: THREE.Material = new THREE.MeshBasicMaterial({ color: 0xff5a4a, toneMapped: false });
  const greenBolt: THREE.Material = new THREE.MeshBasicMaterial({ color: 0x66ff88, toneMapped: false });
  const boltShape = new THREE.BoxGeometry(0.16, 0.16, 7);
  const bolts = Array.from({ length: 40 }, () => {
    const mesh = new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(boltShape, redBolt);
    mesh.visible = false;
    group.add(mesh);
    return { mesh, velocity: new THREE.Vector3(), life: 0 };
  });
  const shoot = (from: THREE.Vector3, to: THREE.Vector3, material: THREE.Material, speed: number) => {
    const bolt = bolts.find((item) => !item.mesh.visible);
    if (!bolt) return;
    bolt.mesh.material = material;
    bolt.mesh.visible = true;
    bolt.mesh.position.copy(from);
    bolt.mesh.lookAt(to);
    bolt.velocity.copy(to).sub(from).normalize().multiplyScalar(speed);
    bolt.life = 1.4;
  };
  const fireball = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const blasts = Array.from({ length: 6 }, () => {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), fireball.clone());
    mesh.visible = false;
    group.add(mesh);
    return { mesh, t: 0 };
  });
  const fighters = Array.from({ length: 6 }, () => {
    const body = new THREE.Group();
    body.add(new THREE.Mesh(tie.hull, tie.materials[0]), new THREE.Mesh(tie.panels, tie.materials[1]), new THREE.Mesh(tie.glass, tie.materials[2]));
    body.visible = false;
    group.add(body);
    return { body, alive: false, t: 0, duration: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), weave: 0, phase: 0, cooldown: 0 };
  });
  // The jump: streaks of light drawn out from a point ahead.
  const streakCount = 500;
  const streakPositions = new Float32Array(streakCount * 6);
  const streakSeeds: { x: number; y: number; z: number }[] = [];
  let seed = 1977;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < streakCount; i++) {
    const a = rnd() * Math.PI * 2,
      r = 12 + rnd() * 120;
    streakSeeds.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, z: -40 - rnd() * 500 });
  }
  const streakGeometry = new THREE.BufferGeometry();
  streakGeometry.setAttribute("position", new THREE.BufferAttribute(streakPositions, 3));
  const streaks = new THREE.LineSegments(streakGeometry, new THREE.LineBasicMaterial({ color: 0xdfeaff, transparent: true, opacity: 0, toneMapped: false }));
  streaks.frustumCulled = false;
  group.add(streaks);

  let clock = 0,
    kills = 0,
    shield = 1,
    jumpAt = -1,
    spawned = 0,
    nextSpawn = 1,
    fireClock = 0,
    gun = 0,
    jumpSounded = false,
    done = false,
    firing = false;
  const point = new THREE.Vector3(),
    tmp = new THREE.Vector3(),
    tip = new THREE.Vector3(),
    defaultFov = camera.fov;
  const spawn = () => {
    const fighter = fighters.find((item) => !item.alive);
    if (!fighter) return;
    fighter.alive = true;
    fighter.t = 0;
    fighter.duration = 5 + rnd() * 2.2;
    const side = spawned % 2 ? 1 : -1;
    fighter.from.set(side * (50 + rnd() * 200), -30 + rnd() * 140, -700);
    fighter.to.set(-side * (10 + rnd() * 26), -10 + rnd() * 22, 18);
    fighter.weave = 14 + rnd() * 22;
    fighter.phase = rnd() * 6;
    fighter.cooldown = 1 + rnd();
    fighter.body.visible = true;
    spawned++;
  };
  const boom = (at: THREE.Vector3) => {
    const blast = blasts.find((item) => !item.mesh.visible);
    if (!blast) return;
    blast.mesh.visible = true;
    blast.mesh.position.copy(at);
    blast.t = 0;
  };
  return {
    group,
    /** Sets the ship up for the flight. `aim` follows the pointer until the jump. */
    start: () => {
      group.visible = true;
      clock = 0;
      kills = 0;
      shield = 1;
      jumpAt = -1;
      spawned = 0;
      nextSpawn = 0.8;
      done = false;
      ship.position.copy(shipHome);
      ship.rotation.set(0, 0, 0);
      camera.position.set(0, 0, 0);
      camera.rotation.set(0, 0, 0);
      globe.position.set(-520, -90, -760);
      globe.visible = true;
    },
    setAim: (x: number, y: number) => aim.set(x, y),
    setFiring: (value: boolean) => (firing = value),
    skipToJump: () => {
      if (jumpAt < 0) jumpAt = clock;
    },
    tick: (dt: number, time: number, reduced: boolean): EscapeStatus => {
      clock += dt;
      // The station falls astern.
      globe.position.z = -760 + clock * 3;
      globe.rotation.y = time * 0.01;
      if (jumpAt < 0 && (kills >= GOAL || clock > TIME_LIMIT)) jumpAt = clock;
      if (jumpAt < 0) {
        if (clock > nextSpawn && spawned < 12) {
          spawn();
          nextSpawn = clock + 2.1;
        }
        // The fighter drifts under the pointer; camera tilts a touch with it.
        ship.position.x = THREE.MathUtils.damp(ship.position.x, aim.x * 8, 3, dt);
        ship.position.y = THREE.MathUtils.damp(ship.position.y, shipHome.y + aim.y * 3.5, 3, dt);
        ship.rotation.z = THREE.MathUtils.damp(ship.rotation.z, -aim.x * 0.5, 3, dt);
        ship.rotation.x = THREE.MathUtils.damp(ship.rotation.x, -aim.y * 0.2, 3, dt);
        camera.rotation.set(aim.y * 0.05, -aim.x * 0.06, 0);
        camera.updateMatrixWorld();
        // Guns: four alternating bolts converging on the point under the pointer.
        fireClock -= dt;
        if (firing && fireClock <= 0) {
          fireClock = 0.14;
          sounds.shot();
          gun = (gun + 1) % 4;
          ray.setFromCamera(aim, camera);
          point.copy(ray.ray.origin).addScaledVector(ray.ray.direction, 500);
          // The four wingtip cannons, in turn.
          tip.copy(ship.position).add(tmp.set(gun % 2 ? 5.4 : -5.4, gun < 2 ? 1.6 : -1.6, -7));
          shoot(tip, point, redBolt, 700);
          // Generous aim: whoever is near the line of fire is hit.
          for (const fighter of fighters) {
            if (!fighter.alive) continue;
            const miss = ray.ray.distanceToPoint(fighter.body.position);
            const toFighter = fighter.body.position.z;
            if (toFighter < -30 && miss < 11) {
              fighter.alive = false;
              fighter.body.visible = false;
              kills++;
              sounds.blast();
              boom(fighter.body.position);
              break;
            }
          }
        }
      }
      fighters.forEach((fighter) => {
        if (!fighter.alive) return;
        fighter.t += dt / fighter.duration;
        if (fighter.t >= 1) {
          fighter.alive = false;
          fighter.body.visible = false;
          return;
        }
        fighter.body.position.lerpVectors(fighter.from, fighter.to, fighter.t * fighter.t);
        fighter.body.position.x += Math.sin(clock * 1.3 + fighter.phase) * fighter.weave;
        fighter.body.position.y += Math.cos(clock * 1.1 + fighter.phase) * fighter.weave * 0.4;
        fighter.body.lookAt(ship.position);
        fighter.body.rotateZ(Math.sin(clock + fighter.phase) * 0.5);
        fighter.cooldown -= dt;
        if (fighter.cooldown <= 0 && fighter.body.position.z > -420 && jumpAt < 0) {
          fighter.cooldown = 1.1 + rnd() * 0.9;
          tmp.copy(ship.position).add(point.set((rnd() - 0.5) * 10, (rnd() - 0.5) * 7, (rnd() - 0.5) * 4));
          shoot(fighter.body.position, tmp, greenBolt, 420);
          shield = Math.max(0.1, shield - 0.05);
        }
      });
      bolts.forEach((bolt) => {
        if (!bolt.mesh.visible) return;
        bolt.life -= dt;
        bolt.mesh.position.addScaledVector(bolt.velocity, dt);
        if (bolt.life <= 0) bolt.mesh.visible = false;
      });
      blasts.forEach((blast) => {
        if (!blast.mesh.visible) return;
        blast.t += dt;
        blast.mesh.scale.setScalar(4 + blast.t * 26);
        (blast.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - blast.t * 2.2);
        if (blast.t > 0.46) blast.mesh.visible = false;
      });
      // The jump itself.
      const jumping = jumpAt >= 0;
      if (jumping) {
        const t = clock - jumpAt;
        if (!jumpSounded) {
          jumpSounded = true;
          sounds.jump();
        }
        fighters.forEach((fighter) => (fighter.body.visible = fighter.alive = false));
        const stretch = THREE.MathUtils.smootherstep(t, 0.5, JUMP);
        (streaks.material as THREE.LineBasicMaterial).opacity = THREE.MathUtils.smoothstep(t, 0.2, 0.7);
        streakSeeds.forEach((star, i) => {
          const near = star.z + stretch * 300;
          streakPositions.set([star.x, star.y, star.z, star.x, star.y, near], i * 6);
        });
        streakGeometry.getAttribute("position").needsUpdate = true;
        if (!reduced) {
          camera.fov = defaultFov + stretch * 28;
          camera.updateProjectionMatrix();
          ship.position.z = shipHome.z - stretch * stretch * 700;
        }
        if (t >= JUMP) done = true;
      }
      return { kills, goal: GOAL, shield, jumping, done };
    },
    dispose: () => {
      redBolt.dispose();
      greenBolt.dispose();
      fireball.dispose();
      blasts.forEach((blast) => (blast.mesh.material as THREE.Material).dispose());
      camera.fov = defaultFov;
    },
  };
}
export type EscapeRun = ReturnType<typeof createEscapeRun>;
