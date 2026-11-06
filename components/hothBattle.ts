import * as THREE from "three";
import { glowTexture } from "./landingKit";
import { bakePart, part, rounded } from "./tatooineCharacters";
import { ATAT_SCALE, ATAT_SPEED, createATAT } from "./atatModel";

// The battle out on the plain, seen through the hangar mouth: giant walkers advance through
// the storm, trench guns and snowspeeders answer, and bolts burst in plumes of snow. Now and
// then a snowspeeder wraps its tow cable round a walker's legs and brings it down.
type Height = (x: number, z: number) => number;
// Bolt colours as fans usually describe the battle: red-orange from the walkers' chin guns,
// bright red from the rebel speeders and trench guns, each with a white-hot core.
const SHOT = { empire: 0xff5a26, rebels: 0xff1f3a };

// A wedge-shaped two-seat airspeeder in the spirit of the films' snowspeeders: flat tapered hull,
// forward cockpit, two big engine pods at the back, split air brakes and nose cannons.
export function createSnowspeeder() {
  const root = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0xdcd8cd, roughness: 0.55, metalness: 0.28 });
  const panel = new THREE.MeshStandardMaterial({ color: 0x9a9fa2, roughness: 0.6, metalness: 0.35 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0xc8612f, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x272c30, roughness: 0.6, metalness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1c2a33, roughness: 0.15, metalness: 0.7 });
  const lift = 0.75;
  // A box reshaped into a tapered wedge: narrow and thin at the nose, wide and deep at the back.
  const wedge = (front: [number, number, number, number], back: [number, number, number, number]) => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const p = geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const [halfWidth, bottom, top, z] = p.getZ(i) > 0 ? front : back;
      p.setXYZ(i, Math.sign(p.getX(i)) * halfWidth, (p.getY(i) > 0 ? top : bottom) + lift, z);
    }
    geometry.computeVertexNormals();
    return geometry;
  };
  part(root, wedge([0.38, -0.05, 0.12, 2.6], [1.75, -0.32, 0.38, -2]), paint);
  part(root, wedge([0.3, 0.1, 0.24, 1.6], [0.95, 0.3, 0.62, -1.95]), panel);
  // Orange markings along the leading edges, and grey access panels.
  for (const side of [-1, 1]) {
    part(root, rounded(0.16, 0.03, 1.7, 0.01), stripe, [side * 0.78, lift + 0.27, 0.6], [0, side * -0.29, 0]);
    part(root, rounded(0.5, 0.02, 0.6, 0.01), panel, [side * 1.2, lift + 0.36, -1.1]);
  }
  // Cockpit canopy, its frame, and the rear gunner's hatch.
  part(root, rounded(0.78, 0.34, 1.25, 0.12), glass, [0, lift + 0.4, 0.75], [-0.14, 0, 0]);
  for (const z of [0.35, 0.8, 1.25]) part(root, rounded(0.82, 0.035, 0.05, 0.01), dark, [0, lift + 0.55 - (z - 0.35) * 0.12, z]);
  part(root, rounded(0.6, 0.05, 0.5, 0.05), dark, [0, lift + 0.64, -0.55]);
  // Engine pods with dark intakes and exhaust rings.
  for (const side of [-1, 1]) {
    part(root, new THREE.CylinderGeometry(0.42, 0.45, 2.05, 20), paint, [side * 1.6, lift + 0.05, -0.95], [Math.PI / 2, 0, 0]);
    part(root, new THREE.CylinderGeometry(0.33, 0.33, 0.06, 20), dark, [side * 1.6, lift + 0.05, 0.09], [Math.PI / 2, 0, 0]);
    part(root, new THREE.TorusGeometry(0.4, 0.05, 6, 20), panel, [side * 1.6, lift + 0.05, -1.95]);
    part(root, rounded(0.1, 0.5, 0.9, 0.03), panel, [side * 1.6, lift + 0.5, -1.2]);
    // The split air brakes on each wing's trailing edge.
    part(root, rounded(0.75, 0.04, 0.42, 0.01), panel, [side * 0.95, lift + 0.27, -2.12], [-0.28, 0, 0]);
    part(root, rounded(0.75, 0.04, 0.42, 0.01), panel, [side * 0.95, lift - 0.24, -2.12], [0.28, 0, 0]);
    // Laser cannons either side of the nose.
    part(root, new THREE.CylinderGeometry(0.05, 0.06, 1.4, 10), dark, [side * 0.52, lift + 0.02, 2.55], [Math.PI / 2, 0, 0]);
  }
  // The harpoon gun and tow cable reel under the tail.
  part(root, new THREE.CylinderGeometry(0.09, 0.11, 0.6, 12), dark, [0, lift - 0.4, -1.75], [Math.PI / 2, 0, 0]);
  bakePart(root);
  // Glowing exhausts, kept separate so they can pulse.
  const exhaust = new THREE.MeshBasicMaterial({ color: 0xff8a5c, toneMapped: false });
  for (const side of [-1, 1]) part(root, new THREE.CircleGeometry(0.3, 20), exhaust, [side * 1.6, lift + 0.05, -1.99], [0, Math.PI, 0]);
  return root;
}

export function createHothBattle(heightAt: Height) {
  const group = new THREE.Group();
  group.name = "hoth-battle";
  const glow = glowTexture();
  const at = new THREE.Vector3();

  // Bolts and blasts are pooled; both stay bright through the storm.
  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false } as const;
  const bolts = Array.from({ length: 32 }, () => {
    const mesh = new THREE.Group();
    const halo = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 9), new THREE.MeshBasicMaterial({ color: SHOT.empire, opacity: 0.55, ...additive }));
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, ...additive }));
    mesh.add(halo, core);
    mesh.visible = false;
    group.add(mesh);
    return { mesh, halo, core, from: new THREE.Vector3(), to: new THREE.Vector3(), age: 0, length: 1, live: false };
  });
  const blasts = Array.from({ length: 14 }, () => {
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffc27a, ...additive }));
    const plume = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xeef3f7, transparent: true, depthWrite: false }));
    flash.visible = plume.visible = false;
    group.add(flash, plume);
    return { flash, plume, age: 9, size: 1 };
  });
  const white = new THREE.Color(0xffffff);
  const fire = (from: THREE.Vector3, to: THREE.Vector3, color: number) => {
    const bolt = bolts.find((b) => !b.live);
    if (!bolt) return;
    bolt.from.copy(from);
    bolt.to.copy(to);
    bolt.length = from.distanceTo(to);
    bolt.age = 0;
    bolt.live = true;
    bolt.halo.material.color.setHex(color);
    bolt.core.material.color.setHex(color).lerp(white, 0.75);
    bolt.mesh.visible = true;
    bolt.mesh.position.copy(from);
    bolt.mesh.lookAt(to);
  };
  const burst = (point: THREE.Vector3, size: number) => {
    const blast = blasts.reduce((oldest, b) => (b.age > oldest.age ? b : oldest), blasts[0]);
    blast.age = 0;
    blast.size = size;
    blast.flash.position.copy(point).setY(point.y + 1.5);
    blast.plume.position.copy(point).setY(point.y + 2);
    blast.flash.visible = blast.plume.visible = true;
  };

  // Three walkers advance on the base and fade back into the storm when they get close. Each sits
  // in a holder (position and heading) with a tilt pivot under the outer edge of its feet, so it
  // can topple sideways.
  const PIVOT = (2.85 + 1.3) * ATAT_SCALE;
  const walkers = [
    { x: -95, start: 290, phase: 0 },
    { x: 15, start: 360, phase: 1.7 },
    { x: 120, start: 330, phase: 3.1 },
  ].map((spec) => {
    const model = createATAT();
    model.root.scale.setScalar(ATAT_SCALE);
    const holder = new THREE.Group(),
      tilt = new THREE.Group();
    holder.rotation.y = Math.PI;
    holder.add(tilt);
    tilt.add(model.root);
    group.add(holder);
    return { ...model, ...spec, holder, tilt, z: spec.start, next: 2 + spec.phase, fade: 1, state: "walking" as "walking" | "tangled" | "falling" | "down", fall: 0, side: 1, since: 0 };
  });
  const NEAR = 205,
    FAR = 400;

  // The rebel trench and its guns, with the shield generator behind them.
  const snow = new THREE.MeshStandardMaterial({ color: 0xdfe8ef, roughness: 0.95 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x59616a, roughness: 0.6, metalness: 0.6 });
  const defences = new THREE.Group();
  group.add(defences);
  for (let x = -130; x <= 130; x += 10) {
    const y = heightAt(x, 150);
    part(defences, rounded(10.4, 1.4, 1.6, 0.4), snow, [x, y + 0.5, 151.5]);
  }
  const guns = [-90, -45, 0, 45, 90].map((x, i) => {
    const y = heightAt(x, 148);
    part(defences, new THREE.CylinderGeometry(1.3, 1.6, 1.6, 12), steel, [x, y + 0.8, 148]);
    part(defences, rounded(0.5, 0.5, 3, 0.1), steel, [x, y + 1.9, 149.4], [0.2, 0, 0]);
    return { muzzle: new THREE.Vector3(x, y + 2.1, 150.8), next: 1 + i * 0.9 };
  });
  const generatorAt = new THREE.Vector3(-95, heightAt(-95, 112), 112);
  part(defences, new THREE.CylinderGeometry(4, 5, 14, 20), steel, [generatorAt.x, generatorAt.y + 7, generatorAt.z]);
  part(defences, new THREE.SphereGeometry(6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), steel, [generatorAt.x, generatorAt.y + 14, generatorAt.z]);
  bakePart(defences);
  const ring = part(
    group,
    new THREE.TorusGeometry(6.4, 0.25, 8, 48),
    new THREE.MeshBasicMaterial({ color: 0x8fd8ff, opacity: 0.7, ...additive }),
    [generatorAt.x, generatorAt.y + 14.2, generatorAt.z],
    [Math.PI / 2, 0, 0],
  );

  // Two snowspeeders circle the walkers, banking hard and strafing.
  const speeders = [0, 1].map((i) => {
    const model = createSnowspeeder();
    model.scale.setScalar(1.6);
    for (const side of [-1, 1]) {
      const trail = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff8a5c, opacity: 0.8, ...additive }));
      trail.position.set(side * 1.6, 0.8, -2.3);
      trail.scale.setScalar(1.4);
      model.add(trail);
    }
    group.add(model);
    return { model, target: i, angle: i * Math.PI, next: 3 + i * 2, blend: 1 };
  });

  // The tow cable: a line wound round the walker's legs, attached to its tilt pivot so it falls
  // with it, plus a free length back to the speeder while it is still flying the loops.
  const CABLE = 96;
  const cable = new THREE.Line(
    new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(CABLE * 3), 3)),
    new THREE.LineBasicMaterial({ color: 0x2b3136 }),
  );
  cable.frustumCulled = false;
  cable.visible = false;
  let wound = 0;
  // The scripted run: one speeder leaves its orbit, flies three tight loops, cuts free and climbs away.
  const run = { walker: -1, speeder: 0, angle: 0, next: 35 };
  const LOOPS = 3,
    LOOP_SPEED = 2.1;
  const local = new THREE.Vector3(),
    pointA = new THREE.Vector3(),
    pointB = new THREE.Vector3(),
    muzzle = new THREE.Vector3(),
    orbit = new THREE.Vector3();
  let clock = 0;

  const startRun = () => {
    // The closest walker that will stay in full view for the whole sequence.
    const candidates = walkers.filter((w) => w.state === "walking" && w.z > NEAR + 75 && w.z < FAR - 45);
    if (!candidates.length) {
      run.next = clock + 10;
      return;
    }
    const target = candidates.reduce((a, b) => (a.z < b.z ? a : b));
    run.walker = walkers.indexOf(target);
    run.angle = 0;
    target.state = "tangled";
    target.side = Math.random() < 0.5 ? -1 : 1;
    target.since = clock;
    target.tilt.position.x = target.side * PIVOT;
    target.root.position.x = -target.side * PIVOT;
    target.tilt.add(cable);
    wound = 0;
    cable.geometry.setDrawRange(0, 0);
    cable.visible = true;
    speeders[run.speeder].blend = 0;
  };

  return {
    group,
    /** Where the walkers are, for the base's radar. */
    blips: () => walkers.map((walker) => ({ x: walker.x, z: walker.z, down: walker.state !== "walking" })),
    /** The whole battle as it stands, for the tactical hologram. */
    mapData: () => ({
      walkers: walkers.map((walker) => ({ x: walker.holder.position.x, y: walker.holder.position.y, z: walker.holder.position.z, fade: walker.fade, tilt: walker.tilt.rotation.z, yaw: walker.holder.rotation.y })),
      speeders: speeders.map((speeder) => ({ x: speeder.model.position.x, y: speeder.model.position.y, z: speeder.model.position.z, quaternion: speeder.model.quaternion })),
      generator: generatorAt,
    }),
    tick: (dt: number, reduced: boolean) => {
      if (reduced) dt = 0;
      clock += dt;
      if (dt && run.walker < 0 && clock > run.next) startRun();
      walkers.forEach((walker) => {
        if (walker.state === "walking" && dt) walker.z -= dt * ATAT_SPEED;
        if (walker.state === "walking" && walker.z < NEAR) walker.z = FAR;
        // Walking fades in from the storm and out near the trench; a fallen walker fades once it has lain a while.
        const lying = walker.state === "down" ? clock - walker.since : 0;
        walker.fade =
          walker.state === "down"
            ? 1 - THREE.MathUtils.smoothstep(lying, 22, 26)
            : THREE.MathUtils.smoothstep(walker.z, NEAR, NEAR + 25) * (1 - THREE.MathUtils.smoothstep(walker.z, FAR - 30, FAR));
        walker.materials.forEach((material) => {
          material.transparent = walker.fade < 0.999;
          material.opacity = walker.fade;
          material.depthWrite = walker.fade > 0.5;
        });
        const x = walker.x + Math.sin(walker.z * 0.01) * 6;
        walker.holder.position.set(x, heightAt(x, walker.z), walker.z);
        walker.holder.updateMatrixWorld(true);
        if (walker.state === "walking") {
          walker.pose(clock + walker.phase * 1.5, heightAt);
          walker.head.rotation.y = Math.sin(clock * 0.2 + walker.phase) * 0.25;
        } else if (walker.state === "tangled") {
          // Legs locked by the cable: the walker sways as it tries to step.
          walker.tilt.rotation.z = Math.sin((clock - walker.since) * 2.4) * 0.012;
        } else if (walker.state === "falling") {
          walker.fall += dt / 2.4;
          const t = Math.min(1, walker.fall);
          walker.tilt.rotation.z = -walker.side * (Math.PI / 2 - 0.12) * t * t;
          if (t >= 1) {
            walker.state = "down";
            walker.since = clock;
            // The crash: a line of blasts along the hull and a wall of snow.
            walker.root.updateWorldMatrix(true, false);
            for (const z of [-8, -2, 4, 10]) burst(pointA.set(0, 16, z).applyMatrix4(walker.root.matrixWorld).setY(walker.holder.position.y), 2.6);
          }
        } else if (lying > 26) {
          // Gone into the storm: a fresh walker takes its place at the back.
          walker.state = "walking";
          walker.tilt.rotation.z = 0;
          walker.tilt.position.x = walker.root.position.x = 0;
          walker.fall = 0;
          walker.z = FAR;
          if (cable.parent === walker.tilt) {
            walker.tilt.remove(cable);
            cable.visible = false;
          }
          run.next = clock + 120;
        }
        // Fire from the chin guns at the trench line.
        if (walker.state === "walking" && dt && walker.fade > 0.6 && (walker.next -= dt) <= 0) {
          walker.next = 2.5 + Math.random() * 3;
          walker.head.updateWorldMatrix(true, false);
          muzzle.copy(walker.muzzle).applyMatrix4(walker.head.matrixWorld);
          const tx = THREE.MathUtils.clamp(x + (Math.random() - 0.5) * 120, -130, 130);
          pointA.set(tx, heightAt(tx, 140) + 0.5, 135 + Math.random() * 30);
          fire(muzzle, pointA, SHOT.empire);
        }
      });
      guns.forEach((gun) => {
        if (!dt || (gun.next -= dt) > 0) return;
        gun.next = 1.8 + Math.random() * 2.5;
        const walker = walkers[Math.floor(Math.random() * walkers.length)];
        if (walker.state !== "walking" || walker.z > FAR - 40) return;
        pointB.copy(walker.holder.position).add(at.set((Math.random() - 0.5) * 10, 12 + Math.random() * 8, (Math.random() - 0.5) * 8));
        fire(gun.muzzle, pointB, SHOT.rebels);
      });
      speeders.forEach((speeder, i) => {
        const roaming = walkers[(speeder.target + i) % walkers.length];
        speeder.angle += dt * 0.32;
        const cx = roaming.holder.position.x,
          cz = roaming.holder.position.z;
        const u = Math.sin(speeder.angle),
          v = Math.cos(speeder.angle);
        orbit.set(cx + u * 55, heightAt(cx, cz) + 16 + Math.sin(speeder.angle * 2) * 5, cz + v * 32);
        const tangled = run.walker >= 0 && i === run.speeder ? walkers[run.walker] : null;
        if (tangled && tangled.state === "tangled") {
          // Tight loops round the legs, low over the snow, trailing cable.
          run.angle += dt * LOOP_SPEED;
          const a = run.angle;
          local.set(Math.sin(a) * 10.5, 5.5, Math.cos(a) * 13.5);
          pointB.copy(local).applyMatrix4(tangled.holder.matrixWorld);
          speeder.blend = Math.min(1, speeder.blend + dt * 0.7);
          speeder.model.position.lerpVectors(speeder.model.position, pointB, speeder.blend);
          speeder.model.rotation.set(0, tangled.holder.rotation.y + Math.atan2(Math.cos(a) * 10.5, -Math.sin(a) * 13.5), -0.85);
          // Each new turn of cable is laid round the legs at a slowly rising height.
          const turns = Math.min(CABLE - 2, Math.floor((a / (Math.PI * 2 * LOOPS)) * (CABLE - 2)));
          const position = cable.geometry.getAttribute("position") as THREE.BufferAttribute;
          for (; wound <= turns; wound++) {
            const b = (wound / (CABLE - 2)) * Math.PI * 2 * LOOPS;
            pointA.set(Math.sin(b) * 4.6, 3.5 + (wound / CABLE) * 3, Math.cos(b) * 7.4);
            pointA.x -= tangled.tilt.position.x;
            position.setXYZ(wound, pointA.x, pointA.y, pointA.z);
          }
          // The free end runs back to the harpoon under the speeder's tail.
          tangled.tilt.worldToLocal(pointA.copy(speeder.model.position));
          position.setXYZ(wound, pointA.x, pointA.y, pointA.z);
          cable.geometry.setDrawRange(0, wound + 1);
          position.needsUpdate = true;
          if (a > Math.PI * 2 * LOOPS) {
            // Cut free: the cable stays round the legs and the walker starts to topple.
            cable.geometry.setDrawRange(0, wound);
            tangled.state = "falling";
            tangled.fall = 0;
            speeder.blend = 0;
          }
          return;
        }
        // Back on patrol, easing out of the loops onto the orbit.
        speeder.blend = Math.min(1, speeder.blend + dt * 0.4);
        speeder.model.position.lerp(orbit, speeder.blend);
        speeder.model.rotation.set(0, Math.atan2(v * 55, -u * 32), -0.55);
        if (dt && speeder.blend > 0.95 && (speeder.next -= dt) <= 0) {
          speeder.next = 2 + Math.random() * 2.5;
          if (roaming.state === "walking") {
            pointB.copy(roaming.holder.position).setY(roaming.holder.position.y + 15);
            muzzle.copy(speeder.model.position);
            fire(muzzle, pointB, SHOT.rebels);
          }
        }
        if (Math.sin(speeder.angle) > 0.999) speeder.target = (speeder.target + 1) % walkers.length;
      });
      if (run.walker >= 0 && walkers[run.walker].state === "walking") run.walker = -1;
      bolts.forEach((bolt) => {
        if (!bolt.live) return;
        bolt.age += dt * 160;
        const t = bolt.age / bolt.length;
        if (t >= 1) {
          bolt.live = false;
          bolt.mesh.visible = false;
          // Ground hits throw up snow; hits on a walker only flash.
          burst(bolt.to, bolt.to.y < heightAt(bolt.to.x, bolt.to.z) + 3 ? 1 : 0.5);
          return;
        }
        bolt.mesh.position.lerpVectors(bolt.from, bolt.to, t);
      });
      blasts.forEach((blast) => {
        if (blast.age > 3.5) return;
        blast.age += dt;
        const flash = Math.max(0, 1 - blast.age / 0.5),
          plume = Math.max(0, 1 - blast.age / 3.5);
        blast.flash.material.opacity = flash;
        blast.flash.scale.setScalar((4 + blast.age * 22) * blast.size);
        blast.plume.material.opacity = plume * 0.55 * Math.min(1, blast.size);
        blast.plume.scale.setScalar((3 + blast.age * 6) * blast.size);
        blast.plume.position.y += dt * 1.2;
        blast.flash.visible = flash > 0;
        blast.plume.visible = plume > 0 && blast.size > 0.6;
      });
      ring.material.opacity = 0.55 + Math.sin(clock * 3) * 0.15;
    },
  };
}
