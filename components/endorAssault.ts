import * as THREE from "three";
import { galaxyAudio } from "./galaxy/audio";
import { galaxy } from "./galaxy/store";
import { glowTexture, type ZoneAction } from "./landingKit";
import { BUNKER } from "./endorLandmarks";

// The strike on the shield generator. The bunker's door opens onto its hall, built apart under the
// clearing; three charges go on the generator, the visitor is out on the clearing again when they
// blow, the shield falls, and in the sky the battle station explodes.

export const HALL = { minX: -7.4, maxX: 7.4, minZ: -29, maxZ: -13, floor: -14 };
export const HALL_ENTRY = { x: 0, z: -14.2, yaw: 0 };
export const WATCH = { x: 0, z: 7.5 };
const EVENT = "endor-shield";

export function createEndorAssault(station: THREE.Sprite) {
  const group = new THREE.Group();
  group.name = "endor-assault";
  const wall = new THREE.MeshStandardMaterial({ color: 0x5c6266, roughness: 0.62, metalness: 0.42 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1f22, roughness: 0.5, metalness: 0.55 });
  const lamp = new THREE.MeshBasicMaterial({ color: 0xe8f1ff, toneMapped: false });
  const red = new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false });
  const { minX, maxX, minZ, maxZ, floor } = HALL;
  const width = maxX - minX + 1,
    depth = maxZ - minZ + 1,
    midZ = (minZ + maxZ) / 2,
    H = 6.5;
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material = wall) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  box(width, 0.4, depth, 0, floor - 0.2, midZ, new THREE.MeshStandardMaterial({ color: 0x3d4347, roughness: 0.82, metalness: 0.15 }));
  box(width, 0.4, depth, 0, floor + H + 0.2, midZ);
  box(0.4, H, depth, minX - 0.7, floor + H / 2, midZ);
  box(0.4, H, depth, maxX + 0.7, floor + H / 2, midZ);
  box(width, H, 0.4, 0, floor + H / 2, minZ - 0.7);
  box(width, H, 0.4, 0, floor + H / 2, maxZ + 0.7);
  for (const x of [-4, 0, 4]) box(0.5, 0.05, depth - 2, x, floor + H - 0.03, midZ, lamp);
  // The generator: a great drum at the far end, ringed with blue power bands, and its panels.
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x3a4044, roughness: 0.4, metalness: 0.7 });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 3.2, H, 32), coreMat);
  core.position.set(0, floor + H / 2, minZ + 2.4);
  group.add(core);
  const power = new THREE.MeshBasicMaterial({ color: 0x6fc8ff, toneMapped: false });
  const bands = [0.9, 2.3, 3.7, 5.1].map((y) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.09, 6, 48), power);
    band.rotation.x = Math.PI / 2;
    band.position.set(0, floor + y, minZ + 2.4);
    group.add(band);
    return band;
  });
  for (const side of [-1, 1]) {
    for (const z of [-25, -21, -17]) {
      box(0.8, 2.3, 2.6, side * 6.9, floor + 1.15, z, dark);
      box(0.05, 0.7, 2, side * (6.47), floor + 1.65, z, new THREE.MeshBasicMaterial({ color: z === -21 ? 0xff7a5a : 0x6fc8ff, toneMapped: false }));
    }
  }
  box(0.1, 0.5, 0.1, -7, floor + 3, maxZ, red);
  box(0.1, 0.5, 0.1, 7, floor + 3, maxZ, red);
  // Lights are only on while the visitor is down here; each is warmed up with the scene.
  const lights = [new THREE.PointLight(0xdfe8ff, 42, 22, 1.5), new THREE.PointLight(0x6fc8ff, 22, 14, 1.6)];
  lights[0].position.set(0, floor + H - 0.6, midZ);
  lights[1].position.set(0, floor + 3, minZ + 6);
  lights.forEach((light) => {
    light.visible = false;
    group.add(light);
  });
  // The three places for a charge.
  const SPOTS = [
    new THREE.Vector3(-3.3, floor + 1.4, minZ + 4.9),
    new THREE.Vector3(3.3, floor + 1.4, minZ + 4.9),
    new THREE.Vector3(0, floor + 1.4, minZ + 5.8),
  ];
  const chargeGeometry = new THREE.BoxGeometry(0.5, 0.36, 0.2);
  const chargeShell = new THREE.MeshStandardMaterial({ color: 0x2a2e30, roughness: 0.5, metalness: 0.5 });
  const lampBlink = new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false });
  const charges = SPOTS.map((spot) => {
    const charge = new THREE.Group();
    charge.position.copy(spot);
    charge.add(new THREE.Mesh(chargeGeometry, chargeShell));
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.04), lampBlink);
    led.position.z = 0.12;
    charge.add(led);
    charge.visible = false;
    group.add(charge);
    return charge;
  });
  const chargeHit = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, H, 12), new THREE.MeshBasicMaterial({ visible: false }));
  chargeHit.position.copy(core.position);
  group.add(chargeHit);

  // Outside: the door, its fire and smoke once blown, then the sky.
  const glow = glowTexture();
  const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.1, 0.3), new THREE.MeshStandardMaterial({ color: 0x2c3234, roughness: 0.55, metalness: 0.6 }));
  doorLeaf.position.set(BUNKER.x, 1.55, BUNKER.z + 5.95);
  group.add(doorLeaf);
  const fire = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff8a3a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  fire.position.set(BUNKER.x, 2.2, BUNKER.z + 6.8);
  fire.scale.setScalar(8);
  fire.visible = false;
  group.add(fire);
  const smoke = Array.from({ length: 10 }, () => {
    const puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x24272a, transparent: true, depthWrite: false, opacity: 0 }));
    puff.visible = false;
    group.add(puff);
    return { puff, phase: Math.random() };
  });
  const skyFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xfff2c8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
  skyFlash.position.copy(station.position);
  skyFlash.visible = false;
  skyFlash.renderOrder = 2;
  group.add(skyFlash);
  const ringCanvas = document.createElement("canvas");
  ringCanvas.width = ringCanvas.height = 256;
  const rc = ringCanvas.getContext("2d")!;
  const gradient = rc.createRadialGradient(128, 128, 88, 128, 128, 126);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.55, "rgba(180,220,255,.9)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  rc.fillStyle = gradient;
  rc.fillRect(0, 0, 256, 256);
  const ringMap = new THREE.CanvasTexture(ringCanvas);
  ringMap.colorSpace = THREE.SRGBColorSpace;
  const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringMap, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
  ring.position.copy(station.position);
  ring.visible = false;
  group.add(ring);
  const shieldDome = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x7fc8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
  shieldDome.position.copy(station.position);
  shieldDome.scale.setScalar(station.scale.x * 2.5);
  shieldDome.visible = false;
  group.add(shieldDome);

  let placed = 0,
    phase: "shut" | "planting" | "armed" | "blown" | "done" = "shut",
    clock = 0,
    revision = 0;
  const stationOpacity = station.material.opacity;
  const bump = () => revision++;
  const chargeAction: ZoneAction = {
    id: "bunker-charge",
    label: "Poser une charge (1/3)",
    hidden: true,
    position: SPOTS[0].clone(),
    objects: [chargeHit],
    activate: () => {},
  };
  const handlers = {
    /** Set by the zone: everything that moves the visitor between the forest and the hall. */
    onCharge: () => {},
  };
  chargeAction.activate = () => {
    if (phase !== "planting" || placed >= 3) return;
    charges[placed].visible = true;
    galaxyAudio.radio(false);
    placed++;
    if (placed < 3) {
      chargeAction.label = `Poser une charge (${placed + 1}/3)`;
      chargeAction.position.copy(SPOTS[placed]);
    } else {
      phase = "armed";
      clock = 0;
      chargeAction.label = "Charges posées";
      galaxy().trigger(EVENT);
      handlers.onCharge();
    }
    bump();
  };
  return {
    group,
    chargeAction,
    handlers,
    door: doorLeaf,
    actionsKey: () => revision,
    canEnter: () => phase === "shut" || phase === "planting",
    open: () => {
      if (phase === "shut") {
        phase = "planting";
        placed = 0;
      }
      bump();
    },
    setInside: (inside: boolean) => {
      lights.forEach((light) => (light.visible = inside));
    },
    warm: (compile: () => void) => {
      lights.forEach((light) => (light.visible = true));
      compile();
      lights.forEach((light) => (light.visible = false));
      compile();
    },
    /** The visitor is out: the charges go up behind them. */
    detonate: () => {
      phase = "blown";
      clock = 0;
      bump();
    },
    phase: () => phase,
    tick: (dt: number, time: number, reduced: boolean, inside: boolean) => {
      clock += dt;
      if (inside) {
        bands.forEach((band, i) => (band.scale.setScalar(1 + (reduced ? 0 : Math.sin(time * 3 + i) * 0.006))));
        lampBlink.color.setHex(Math.sin(time * 8) > 0 ? 0xff3a2a : 0x4a0a06);
      }
      if (phase === "planting" || phase === "armed") doorLeaf.position.y = THREE.MathUtils.damp(doorLeaf.position.y, 4.6, 3, dt);
      if (phase !== "blown" && phase !== "done") return;
      // 0 s: the bunker goes up. 2.4 s: the shield fails. 5 s: the station explodes.
      const t = clock;
      if (t < 1 && !fire.visible) {
        fire.visible = true;
        doorLeaf.visible = false;
        smoke.forEach(({ puff }) => (puff.visible = true));
        galaxyAudio.thunder(0.9);
      }
      fire.material.opacity = reduced ? 0.6 : (0.8 + Math.sin(time * 11) * 0.15) * Math.min(1, t * 4) * Math.max(0.55, 1 - t * 0.04);
      fire.scale.setScalar(7 + Math.sin(time * 7) * 0.7);
      smoke.forEach(({ puff, phase: p }) => {
        const k = reduced ? p : (p + time * 0.08) % 1;
        puff.position.set(BUNKER.x + Math.sin(p * 9 + k * 3) * (1 + k * 3), 3 + k * 26, BUNKER.z + 6.5 + Math.cos(p * 7) * k * 2);
        puff.scale.setScalar(3 + k * 12);
        puff.material.opacity = Math.sin(k * Math.PI) * 0.5;
      });
      if (phase === "done") return;
      const shield = THREE.MathUtils.clamp((t - 2.4) / 1.4, 0, 1);
      shieldDome.visible = t > 2.2 && shield < 1;
      shieldDome.material.opacity = Math.sin(shield * Math.PI) * 0.55;
      if (t > 2.4 && t < 2.5) galaxyAudio.radio(true);
      const blast = t - 5;
      if (blast > 0) {
        if (!skyFlash.visible) {
          skyFlash.visible = ring.visible = true;
          galaxyAudio.thunder(1);
        }
        const k = station.scale.x;
        skyFlash.scale.setScalar(k * (0.6 + Math.min(blast, 1.1) * 2.6));
        skyFlash.material.opacity = Math.max(0, 1 - Math.max(0, blast - 0.5) * 0.45);
        ring.scale.setScalar(k * (0.6 + blast * 2.2));
        ring.material.opacity = Math.max(0, 0.85 - blast * 0.2);
        station.material.opacity = Math.max(0, stationOpacity * (1 - blast * 2.6));
        if (blast > 0.4) station.visible = false;
        if (blast > 4.2) {
          skyFlash.visible = ring.visible = false;
          phase = "done";
          galaxy().found(EVENT);
          bump();
        }
      }
    },
  };
}
