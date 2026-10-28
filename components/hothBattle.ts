import * as THREE from "three";
import { glowTexture } from "./landingKit";
import { bakePart, part, rounded } from "./tatooineCharacters";
import { ATAT_SCALE, ATAT_SPEED, createATAT } from "./atatModel";

// The battle out on the plain, seen through the hangar mouth: giant walkers advance through
// the storm, trench guns and snowspeeders answer, and bolts burst in plumes of snow.
type Height = (x: number, z: number) => number;
const SHOT = { empire: 0xff4b43, rebels: 0xff5a3c };

// A two-seat airspeeder, also parked in the hangar.
export function createSnowspeeder() {
  const root = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0xc9c6bb, roughness: 0.55, metalness: 0.3 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0xb6542e, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c3034, roughness: 0.6, metalness: 0.5 });
  const shape = new THREE.Shape();
  shape.moveTo(-1.5, -2.2);
  shape.lineTo(1.5, -2.2);
  shape.lineTo(1.1, 1.4);
  shape.lineTo(0, 2.3);
  shape.lineTo(-1.1, 1.4);
  shape.closePath();
  part(root, new THREE.ExtrudeGeometry(shape, { depth: 0.55, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 }), paint, [0, 0.9, 0], [Math.PI / 2, 0, 0]);
  part(root, rounded(2.6, 0.05, 0.3, 0.02), stripe, [0, 0.98, 1.2]);
  part(root, new THREE.SphereGeometry(0.55, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), dark, [0, 0.95, -0.2]).scale.set(1, 0.6, 1.5);
  for (const side of [-1, 1]) {
    part(root, new THREE.CylinderGeometry(0.32, 0.36, 1.9, 14), paint, [side * 1.55, 0.6, -1.2], [Math.PI / 2, 0, 0]);
    part(root, new THREE.CylinderGeometry(0.22, 0.22, 0.06, 14), dark, [side * 1.55, 0.6, -2.16], [Math.PI / 2, 0, 0]);
  }
  bakePart(root);
  return root;
}

export function createHothBattle(heightAt: Height) {
  const group = new THREE.Group();
  group.name = "hoth-battle";
  const glow = glowTexture();
  const at = new THREE.Vector3();

  // Bolts and blasts are pooled; both stay bright through the storm.
  const bolts = Array.from({ length: 28 }, () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 8),
      new THREE.MeshBasicMaterial({ color: SHOT.empire, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    );
    mesh.visible = false;
    group.add(mesh);
    return { mesh, from: new THREE.Vector3(), to: new THREE.Vector3(), age: 0, length: 1, live: false };
  });
  const blasts = Array.from({ length: 12 }, () => {
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffc27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    const plume = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xeef3f7, transparent: true, depthWrite: false }));
    flash.visible = plume.visible = false;
    group.add(flash, plume);
    return { flash, plume, age: 9, size: 1 };
  });
  const fire = (from: THREE.Vector3, to: THREE.Vector3, color: number) => {
    const bolt = bolts.find((b) => !b.live);
    if (!bolt) return;
    bolt.from.copy(from);
    bolt.to.copy(to);
    bolt.length = from.distanceTo(to);
    bolt.age = 0;
    bolt.live = true;
    bolt.mesh.material.color.setHex(color);
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

  // Three walkers advance on the base and fade back into the storm when they get close.
  const walkers = [
    { x: -95, start: 290, phase: 0 },
    { x: 15, start: 360, phase: 1.7 },
    { x: 120, start: 330, phase: 3.1 },
  ].map((spec) => {
    const model = createATAT();
    model.root.rotation.y = Math.PI;
    model.root.scale.setScalar(ATAT_SCALE);
    group.add(model.root);
    return { ...model, ...spec, z: spec.start, next: 2 + spec.phase };
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
    new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    [generatorAt.x, generatorAt.y + 14.2, generatorAt.z],
    [Math.PI / 2, 0, 0],
  );

  // Two snowspeeders circle the walkers, banking hard and strafing.
  const speeders = [0, 1].map((i) => {
    const model = createSnowspeeder();
    model.scale.setScalar(1.6);
    const trail = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff8a5c, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    trail.position.set(0, 0.6, -2.4);
    trail.scale.setScalar(2.2);
    model.add(trail);
    group.add(model);
    return { model, target: i, angle: i * Math.PI, next: 3 + i * 2 };
  });
  const pointA = new THREE.Vector3(),
    pointB = new THREE.Vector3(),
    muzzle = new THREE.Vector3();
  let clock = 0;
  return {
    group,
    tick: (dt: number, reduced: boolean) => {
      if (reduced) dt = 0;
      clock += dt;
      walkers.forEach((walker) => {
        if (dt) {
          walker.z -= dt * ATAT_SPEED;
        }
        if (walker.z < NEAR) walker.z = FAR;
        const fade = THREE.MathUtils.smoothstep(walker.z, NEAR, NEAR + 25) * (1 - THREE.MathUtils.smoothstep(walker.z, FAR - 30, FAR));
        walker.materials.forEach((material) => {
          material.transparent = fade < 0.999;
          material.opacity = fade;
          material.depthWrite = fade > 0.5;
        });
        const x = walker.x + Math.sin(walker.z * 0.01) * 6;
        walker.root.position.set(x, heightAt(x, walker.z), walker.z);
        walker.pose(clock + walker.phase * 1.5, heightAt);
        walker.head.rotation.y = Math.sin(clock * 0.2 + walker.phase) * 0.25;
        // Fire from the chin guns at the trench line.
        if (dt && fade > 0.6 && (walker.next -= dt) <= 0) {
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
        if (walker.z > FAR - 40) return;
        pointB.copy(walker.root.position).add(at.set((Math.random() - 0.5) * 10, 12 + Math.random() * 8, (Math.random() - 0.5) * 8));
        fire(gun.muzzle, pointB, SHOT.rebels);
      });
      speeders.forEach((speeder, i) => {
        const walker = walkers[(speeder.target + i) % walkers.length];
        speeder.angle += dt * 0.32;
        const cx = walker.root.position.x,
          cz = walker.root.position.z;
        const u = Math.sin(speeder.angle),
          v = Math.cos(speeder.angle);
        speeder.model.position.set(cx + u * 55, heightAt(cx, cz) + 16 + Math.sin(speeder.angle * 2) * 5, cz + v * 32);
        speeder.model.rotation.set(0, Math.atan2(v * 55, -u * 32), -0.55);
        if (dt && (speeder.next -= dt) <= 0) {
          speeder.next = 2 + Math.random() * 2.5;
          pointB.copy(walker.root.position).setY(walker.root.position.y + 15);
          muzzle.copy(speeder.model.position);
          fire(muzzle, pointB, SHOT.rebels);
        }
        if (Math.sin(speeder.angle) > 0.999) speeder.target = (speeder.target + 1) % walkers.length;
      });
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
        if (blast.age > 3) return;
        blast.age += dt;
        const flash = Math.max(0, 1 - blast.age / 0.5),
          plume = Math.max(0, 1 - blast.age / 3);
        blast.flash.material.opacity = flash;
        blast.flash.scale.setScalar((4 + blast.age * 22) * blast.size);
        blast.plume.material.opacity = plume * 0.55 * blast.size;
        blast.plume.scale.setScalar((3 + blast.age * 6) * blast.size);
        blast.plume.position.y += dt * 1.2;
        blast.flash.visible = flash > 0;
        blast.plume.visible = plume > 0 && blast.size > 0.6;
      });
      ring.material.opacity = 0.55 + Math.sin(clock * 3) * 0.15;
    },
  };
}
