"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import * as THREE from "three";
import { glowTexture } from "../landingKit";
import { temple } from "./rewardContent";
import { createStage } from "./stage";

// The Master's reward: a hidden hall of the Jedi Temple. Tall fluted columns, light falling from
// high windows, braziers, two hooded statues, and four relics to examine, each holding a page.

const RELIC_SPOTS: Record<string, [number, number, number]> = {
  archives: [-3.4, 1.3, -6],
  kyber: [0, 1.25, -9.4],
  council: [3.4, 1.3, -6],
  holocron: [0, 1.1, -2.6],
};

export default function TempleRoom({ reduced, onClose }: { reduced: boolean; onClose: () => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [relic, setRelic] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const focus = useRef<string | null>(null);
  focus.current = relic;
  useEffect(() => {
    close.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const glow = glowTexture();
    const flames: THREE.Sprite[] = [];
    const relics: { id: string; mesh: THREE.Object3D; light: THREE.PointLight }[] = [];
    const look = new THREE.Vector3(0, 1.6, -6),
      eye = new THREE.Vector3(0, 1.7, 4.5);
    let built = false;
    const stage = createStage(
      el,
      (dt, time) => {
        if (!built) return;
        const target = focus.current ? RELIC_SPOTS[focus.current] : null;
        const goalEye = target ? new THREE.Vector3(target[0] * 0.55, 1.65, target[2] + 3.2) : new THREE.Vector3(Math.sin(time * 0.07) * (reduced ? 0 : 0.8), 1.7, 3.8);
        const goalLook = target ? new THREE.Vector3(...target) : new THREE.Vector3(0, 2.2, -8);
        const ease = reduced ? 1 : 1 - Math.exp(-dt * 1.6);
        eye.lerp(goalEye, ease);
        look.lerp(goalLook, ease);
        stage!.camera.position.copy(eye);
        stage!.camera.lookAt(look);
        flames.forEach((flame, i) => {
          flame.material.opacity = 0.75 + (reduced ? 0 : Math.sin(time * 9 + i * 2) * 0.12);
          flame.scale.setScalar(0.7 + (reduced ? 0 : Math.sin(time * 7 + i) * 0.06));
        });
        relics.forEach((item, i) => {
          if (!reduced) {
            item.mesh.rotation.y = time * 0.5 + i;
            item.mesh.position.y = RELIC_SPOTS[item.id][1] + Math.sin(time * 1.2 + i) * 0.04;
          }
          item.light.intensity = focus.current === item.id ? 3.2 : 1.4;
        });
      },
      { fov: 55, exposure: 1.05 },
    );
    if (!stage) {
      setFallback(true);
      return;
    }
    const { scene } = stage;
    scene.background = new THREE.Color(0x0b0a0c);
    scene.fog = new THREE.FogExp2(0x15110d, 0.045);
    scene.add(new THREE.HemisphereLight(0xffe7c2, 0x1a140f, 0.55));
    const stone = new THREE.MeshStandardMaterial({ color: 0x8c7b66, roughness: 0.85 });
    const darkStone = new THREE.MeshStandardMaterial({ color: 0x4d4237, roughness: 0.9 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 26), new THREE.MeshStandardMaterial({ color: 0x3a3029, roughness: 0.35, metalness: 0.2 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -5;
    scene.add(floor);
    // A central runner of inlaid stone leading to the far wall.
    const runner = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 22), new THREE.MeshStandardMaterial({ color: 0x5b4c3e, roughness: 0.4, metalness: 0.15 }));
    runner.rotation.x = -Math.PI / 2;
    runner.position.set(0, 0.005, -5);
    scene.add(runner);
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 12, 26), darkStone);
      wall.position.set(side * 6.5, 6, -5);
      scene.add(wall);
      for (let i = 0; i < 5; i++) {
        const z = 2 - i * 3.2;
        const column = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 9, 20), stone);
        column.position.set(side * 4.6, 4.5, z);
        scene.add(column);
        for (const y of [0.25, 8.8]) {
          const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.2), stone);
          plinth.position.set(side * 4.6, y, z);
          scene.add(plinth);
        }
        // High windows let shafts of warm light into the hall.
        const shaft = new THREE.Mesh(
          new THREE.PlaneGeometry(1.4, 11),
          new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
        );
        shaft.position.set(side * 3.2, 5.4, z - 1.6);
        shaft.rotation.set(0, side * 0.5, side * 0.35);
        scene.add(shaft);
      }
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(14, 12, 0.6), darkStone);
    back.position.set(0, 6, -12);
    scene.add(back);
    // Two hooded statues flank the far wall.
    for (const side of [-1, 1]) {
      const statue = new THREE.Group();
      statue.position.set(side * 2.8, 0, -11);
      statue.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 3.6, 18), stone).translateY(2.3));
      statue.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), stone).translateY(4.35));
      statue.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.4), darkStone).translateY(0.25));
      const hands = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 8), stone);
      hands.position.set(0, 2.4, 0.55);
      statue.add(hands);
      scene.add(statue);
    }
    // Braziers along the runner.
    for (const [x, z] of [
      [-2, 0],
      [2, 0],
      [-2, -5.5],
      [2, -5.5],
    ]) {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.18, 0.3, 16), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.3, metalness: 0.8 }));
      bowl.position.set(x, 1.05, z);
      scene.add(bowl);
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 0.9, 10), darkStone);
      stand.position.set(x, 0.45, z);
      scene.add(stand);
      const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff9a40, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      flame.position.set(x, 1.35, z);
      scene.add(flame);
      flames.push(flame);
      const light = new THREE.PointLight(0xff9a50, 4, 7, 2);
      light.position.set(x, 1.6, z);
      scene.add(light);
    }
    // The relics: an archive tablet, a kyber crystal, a council seat's emblem and an holocron.
    const relicMaterial = (color: number) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.4 });
    const shapes: Record<string, THREE.BufferGeometry> = {
      archives: new THREE.BoxGeometry(0.5, 0.7, 0.06),
      kyber: new THREE.OctahedronGeometry(0.28),
      council: new THREE.TorusGeometry(0.28, 0.06, 10, 32),
      holocron: new THREE.BoxGeometry(0.34, 0.34, 0.34),
    };
    temple.relics.forEach((item, i) => {
      const color = [0x7fb6ff, 0x5fd0ff, 0xdab45e, 0x4aaaf4][i];
      const mesh = new THREE.Mesh(shapes[item.id], relicMaterial(color));
      mesh.position.set(...RELIC_SPOTS[item.id]);
      scene.add(mesh);
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, RELIC_SPOTS[item.id][1] - 0.35, 14), stone);
      pedestal.position.set(RELIC_SPOTS[item.id][0], (RELIC_SPOTS[item.id][1] - 0.35) / 2, RELIC_SPOTS[item.id][2]);
      scene.add(pedestal);
      const light = new THREE.PointLight(color, 1.4, 3.5, 2);
      light.position.set(RELIC_SPOTS[item.id][0], RELIC_SPOTS[item.id][1] + 0.4, RELIC_SPOTS[item.id][2] + 0.4);
      scene.add(light);
      relics.push({ id: item.id, mesh, light });
    });
    built = true;
    return () => stage.dispose();
  }, [reduced]);

  const current = temple.relics.find((item) => item.id === relic);
  return (
    <motion.div className="reward-scene temple-room" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0.15 : 0.8 }} role="dialog" aria-modal="true" aria-labelledby="temple-title">
      <div ref={mount} className="reward-scene-canvas" data-fallback={fallback} />
      <header className="reward-scene-head">
        <div>
          <p className="jedi-eyebrow">RÉCOMPENSE DU MAÎTRE JEDI</p>
          <h2 id="temple-title">La salle du temple</h2>
        </div>
        <button ref={close} className="jedi-close" onClick={onClose} aria-label="Quitter la salle du temple">
          <X size={16} />
          <span>QUITTER</span>
        </button>
      </header>
      <aside className="temple-relics">
        <p className="jedi-eyebrow">RELIQUES</p>
        <ul>
          {temple.relics.map((item) => (
            <li key={item.id}>
              <button className="jedi-tab-like" aria-pressed={relic === item.id} onClick={() => setRelic(relic === item.id ? null : item.id)}>
                {item.title}
              </button>
            </li>
          ))}
        </ul>
        <div className="temple-reading" aria-live="polite">
          {current ? (
            <>
              <strong>{current.title}</strong>
              <p>{current.text}</p>
            </>
          ) : (
            <p>« Il n’y a pas d’ignorance, il y a la connaissance. » Choisissez une relique pour l’examiner.</p>
          )}
        </div>
      </aside>
    </motion.div>
  );
}
