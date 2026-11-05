import * as THREE from "three";
import { startMission } from "./jediProgression";
import { glowTexture, type Reveal, type Spot, type ZoneAction } from "./landingKit";

// Three secret missions hidden on the landing zones: a forgotten archive console on Coruscant, an
// ancient holocron under the roots of an Endor giant, and a kyber crystal between Tatooine stones.
// Each one is clicked in the scene, or offered as a button once the visitor stands close to it.

const pickMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
const pick = (w: number, h: number, d: number, y: number) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pickMaterial);
  mesh.position.y = y;
  return mesh;
};

/** Coruscant: a dusty old terminal at the edge of the pad, its screen barely flickering. */
export function createForgottenConsole(reveal: Reveal, at: { x: number; z: number; facing: number }) {
  const group = new THREE.Group();
  group.name = "coruscant-forgotten-console";
  group.position.set(at.x, 0, at.z);
  group.rotation.y = at.facing;
  const shell = new THREE.MeshStandardMaterial({ color: 0x4b4e50, roughness: 0.85, metalness: 0.4 });
  const dust = new THREE.MeshStandardMaterial({ color: 0x6c6359, roughness: 1 });
  const screen = new THREE.MeshStandardMaterial({ color: 0x1a1308, emissive: 0xffa040, emissiveIntensity: 0.12, roughness: 0.3 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.95, 0.5), shell);
  base.position.y = 0.475;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.5, 0.18), shell);
  head.position.set(0, 1.18, -0.08);
  head.rotation.x = -0.35;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.36), screen);
  glass.position.set(0, 1.19, 0.015);
  glass.rotation.x = -0.35;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.02, 0.52), dust);
  lid.position.y = 0.96;
  // A cable hanging loose, and a crack across the screen.
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.3, 0.9, -0.2), new THREE.Vector3(0.45, 0.4, -0.35), new THREE.Vector3(0.62, 0.02, -0.1)]), 12, 0.02, 6),
    new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.6 }),
  );
  const crack = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.006), new THREE.MeshBasicMaterial({ color: 0xd9c9a8, transparent: true, opacity: 0.5 }));
  crack.position.set(0.02, 1.2, 0.02);
  crack.rotation.set(-0.35, 0, 0.6);
  const target = pick(0.9, 1.5, 0.8, 0.75);
  group.add(base, head, glass, lid, cable, crack, target);
  const light = new THREE.PointLight(0xffa040, 0.4, 3, 2);
  light.position.set(0, 1.3, 0.4);
  group.add(light);
  let waking = -1;
  const action: ZoneAction = {
    id: "forgotten-console",
    label: "Consulter la vieille console",
    hidden: true,
    position: new THREE.Vector3(at.x, 1.1, at.z),
    objects: [target],
    activate: () => {
      waking = 0;
    },
  };
  return {
    group,
    action,
    circle: { x: at.x, z: at.z, r: 0.6 } as Spot,
    tick: (dt: number, time: number, reduced: boolean) => {
      let glow = 0.12 + (reduced ? 0 : Math.max(0, Math.sin(time * 13) * Math.sin(time * 2.1)) * 0.25);
      if (waking >= 0) {
        // The screen stutters, then comes fully alive and hands over its dossier.
        waking += dt;
        glow = waking < 0.9 && !reduced ? (Math.sin(waking * 40) > 0 ? 1.4 : 0.2) : 1.6;
        if (waking > (reduced ? 0 : 0.9)) {
          reveal("forgotten-archives");
          waking = -2;
        }
      } else if (waking === -2) glow = 1.6;
      screen.emissiveIntensity = glow;
      light.intensity = 0.3 + glow * 1.2;
    },
  };
}

/** Endor: an ancient holocron in a nook of roots; touched once it rises, touched again it opens. */
export function createBuriedHolocron(reveal: Reveal, at: { x: number; z: number; facing: number }) {
  const group = new THREE.Group();
  group.name = "endor-buried-holocron";
  group.position.set(at.x, 0, at.z);
  group.rotation.y = at.facing;
  const bark = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 1 });
  // Arching roots make a hollow at the foot of the trunk.
  for (let i = 0; i < 5; i++) {
    const a = -0.9 + i * 0.45,
      curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.sin(a) * 0.3, 1.4, -0.9),
        new THREE.Vector3(Math.sin(a) * 0.9, 0.9, -0.2 + Math.cos(a) * 0.2),
        new THREE.Vector3(Math.sin(a) * 1.4, 0.15, 0.5 + Math.cos(a) * 0.3),
        new THREE.Vector3(Math.sin(a) * 1.7, -0.1, 0.9),
      ]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.12 - Math.abs(a) * 0.03, 7), bark));
  }
  const holocron = new THREE.Group();
  holocron.position.set(0, 0.22, 0.15);
  group.add(holocron);
  const frame = new THREE.MeshStandardMaterial({ color: 0x2a3640, roughness: 0.35, metalness: 0.8 });
  const core = new THREE.MeshStandardMaterial({ color: 0x1b4a73, emissive: 0x4aaaf4, emissiveIntensity: 0.6, roughness: 0.2, transparent: true, opacity: 0.85 });
  const coreMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), core);
  holocron.add(coreMesh);
  // The eight corner caps slide apart when it opens.
  const corners = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => new THREE.Vector3(x, y, z))));
  const caps = corners.map((direction) => {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.075), frame);
    cap.position.copy(direction).multiplyScalar(0.09);
    holocron.add(cap);
    return { cap, direction };
  });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x4aaaf4, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(0.9);
  holocron.add(halo);
  const light = new THREE.PointLight(0x4aaaf4, 1.2, 4, 2);
  holocron.add(light);
  const target = pick(0.9, 0.9, 0.9, 0.4);
  target.position.z = 0.15;
  group.add(target);
  let stage = 0,
    clock = 0;
  const action: ZoneAction = {
    id: "endor-holocron",
    label: "Toucher l’holocron",
    hidden: true,
    position: new THREE.Vector3(at.x, 0.4, at.z),
    objects: [target],
    activate: () => {
      if (stage === 0) {
        stage = 1;
        clock = 0;
        startMission("forbidden-holocron");
      } else if (stage === 1 && clock > 1) {
        stage = 2;
        clock = 0;
      }
    },
  };
  return {
    group,
    action,
    circle: { x: at.x, z: at.z, r: 0.9 } as Spot,
    tick: (dt: number, time: number, reduced: boolean) => {
      clock += dt;
      const rise = stage === 0 ? 0 : reduced ? 1 : THREE.MathUtils.smootherstep(Math.min(clock, 1) + (stage === 2 ? 1 : 0), 0, 1);
      holocron.position.y = 0.22 + rise * 0.95 + (reduced ? 0 : Math.sin(time * 1.4) * 0.03 * rise);
      if (!reduced) holocron.rotation.set(time * 0.3 * rise, time * 0.6, 0);
      const open = stage === 2 ? (reduced ? 1 : THREE.MathUtils.smootherstep(clock, 0, 1.2)) : 0;
      caps.forEach(({ cap, direction }) => cap.position.copy(direction).multiplyScalar(0.09 + open * 0.12));
      core.emissiveIntensity = 0.6 + rise * 0.8 + open * 2.5;
      halo.material.opacity = 0.35 + rise * 0.25 + open * 0.4;
      light.intensity = 1.2 + rise * 1.5 + open * 3;
      if (stage === 2 && clock > (reduced ? 0 : 1.2)) {
        reveal("forbidden-holocron");
        stage = 3;
      }
    },
  };
}

/** Tatooine: a small blue crystal glinting low between a few stones near the bay wall. */
export function createKyberCrystal(reveal: Reveal, at: { x: number; y: number; z: number }) {
  const group = new THREE.Group();
  group.name = "tatooine-kyber";
  group.position.set(at.x, at.y, at.z);
  const stone = new THREE.MeshStandardMaterial({ color: 0x9a6a45, roughness: 1 });
  for (const [x, z, s] of [
    [-0.35, 0.05, 0.32],
    [0.32, -0.12, 0.27],
    [0.05, -0.38, 0.22],
    [0.42, 0.3, 0.17],
  ]) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), stone);
    rock.position.set(x, s * 0.45, z);
    rock.rotation.set(x * 3, z * 5, 0.4);
    rock.scale.y = 0.7;
    group.add(rock);
  }
  // Unlit, so it stays a clear blue even in full desert sun.
  const crystalMaterial = new THREE.MeshBasicMaterial({ color: 0x5cc8ff });
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), crystalMaterial);
  crystal.scale.set(0.7, 1.6, 0.7);
  crystal.position.set(0, 0.1, 0);
  crystal.rotation.z = 0.3;
  group.add(crystal);
  const glow = glowTexture();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x2f9bff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(0.85);
  halo.position.y = 0.12;
  group.add(halo);
  // A thin glint that flashes now and then, to catch the eye of someone looking down.
  const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xcfeeff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glint.position.y = 0.16;
  group.add(glint);
  const light = new THREE.PointLight(0x5ab8ff, 0.8, 2.5, 2);
  light.position.y = 0.3;
  group.add(light);
  const target = pick(1, 0.6, 1, 0.25);
  group.add(target);
  let taken = -1;
  const action: ZoneAction = {
    id: "kyber-crystal",
    label: "Ramasser la lueur bleue",
    hidden: true,
    position: new THREE.Vector3(at.x, at.y + 0.15, at.z),
    objects: [target],
    activate: () => {
      if (taken < 0) taken = 0;
    },
  };
  return {
    group,
    action,
    circle: { x: at.x, z: at.z, r: 0.7 } as Spot,
    // Its small glow on the stones only matters up close, and a lamp is paid for on every pixel.
    setLit: (on: boolean) => {
      light.visible = on;
    },
    tick: (dt: number, time: number, reduced: boolean) => {
      const pulse = reduced ? 1 : 0.8 + Math.sin(time * 2.2) * 0.2 + Math.max(0, Math.sin(time * 0.7)) * 0.2;
      if (taken >= 0) {
        // It floats up, sings brighter and spins, as if it had chosen the visitor.
        taken += dt;
        const rise = reduced ? 1 : THREE.MathUtils.smootherstep(taken, 0, 1.4);
        crystal.position.y = 0.1 + rise * 1.2;
        if (!reduced) crystal.rotation.y = taken * 4;
        crystalMaterial.color.setHex(0x5cc8ff).lerp(new THREE.Color(0xe6f6ff), rise * 0.6);
        halo.position.y = glint.position.y = crystal.position.y;
        halo.material.opacity = 0.55 + rise * 0.35;
        halo.scale.setScalar(0.85 + rise * 0.6);
        light.position.y = crystal.position.y + 0.2;
        light.intensity = 0.8 + rise * 3;
        if (taken > (reduced ? 0 : 1.4) && taken - dt <= (reduced ? 0 : 1.4)) reveal("kyber-crystal");
        return;
      }
      halo.material.opacity = 0.5 * pulse;
      light.intensity = 0.8 * pulse;
      const flash = reduced ? 0 : Math.max(0, Math.sin(time * 1.7)) ** 24;
      glint.material.opacity = flash * 0.9;
      glint.scale.set(0.06 + flash * 0.5, 0.06 + flash * 0.5, 1);
    },
  };
}
