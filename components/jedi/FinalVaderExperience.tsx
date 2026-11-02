"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, RotateCcw, X } from "lucide-react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { choosePath, type Path } from "../jediProgression";
import { createStage } from "./stage";
import { createDarkLord } from "./vaderModel";

// The Chosen One's reward: an Imperial corridor, a dark armoured figure revealed by red light and
// a mechanical breath, then the choice between the two paths. The choice is remembered but never
// costs any XP or mission; the scene can be replayed from the rewards.

type Phase = "reveal" | "choice" | "jedi" | "sith";

// A synthesised respirator: filtered noise swelling in and out, nothing sampled.
function startBreathing() {
  if (typeof AudioContext === "undefined") return () => {};
  const context = new AudioContext();
  const length = context.sampleRate * 2;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const noise = context.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  const band = context.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 1.4;
  const valve = context.createBiquadFilter();
  valve.type = "peaking";
  valve.frequency.value = 340;
  valve.gain.value = 9;
  const gain = context.createGain();
  gain.gain.value = 0;
  noise.connect(band).connect(valve).connect(gain).connect(context.destination);
  noise.start();
  const cycle = 4.2;
  const schedule = (from: number) => {
    for (let n = 0; n < 12; n++) {
      const t = from + n * cycle;
      // In: a rising hiss. Out: a lower, rougher exhale.
      band.frequency.setValueAtTime(900, t);
      band.frequency.linearRampToValueAtTime(1500, t + 1.5);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.5);
      gain.gain.linearRampToValueAtTime(0.16, t + 1.4);
      gain.gain.linearRampToValueAtTime(0, t + 1.75);
      band.frequency.setValueAtTime(520, t + 2);
      band.frequency.linearRampToValueAtTime(380, t + 3.6);
      gain.gain.setValueAtTime(0, t + 2);
      gain.gain.linearRampToValueAtTime(0.26, t + 2.4);
      gain.gain.linearRampToValueAtTime(0.12, t + 3.4);
      gain.gain.linearRampToValueAtTime(0, t + 3.8);
    }
  };
  schedule(context.currentTime + 0.6);
  return () => {
    gain.gain.cancelScheduledValues(context.currentTime);
    gain.gain.setTargetAtTime(0, context.currentTime, 0.1);
    window.setTimeout(() => context.close(), 400);
  };
}


export default function FinalVaderExperience({ reduced, sound, onClose }: { reduced: boolean; sound: boolean; onClose: () => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("reveal");
  const [run, setRun] = useState(0);
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const choiceRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (phase === "choice") choiceRef.current?.focus();
  }, [phase]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  useEffect(() => {
    if (!sound) return;
    return startBreathing();
  }, [sound, run]);
  useEffect(() => {
    if (phase !== "reveal") return;
    const timer = window.setTimeout(() => setPhase("choice"), reduced ? 600 : 7000);
    return () => window.clearTimeout(timer);
  }, [phase, reduced, run]);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    let built = false;
    const lights: { red: THREE.SpotLight; fill: THREE.PointLight; blue: THREE.PointLight; gold: THREE.PointLight } = {} as never;
    const strips: THREE.MeshBasicMaterial[] = [];
    let lord: ReturnType<typeof createDarkLord>;
    let bolt: THREE.LineSegments;
    let backdrop: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    const goldTint = new THREE.Color(0xdab45e),
      crimson = new THREE.Color(0xff2a2a);
    const stage = createStage(
      el,
      (dt, time) => {
        if (!built) return;
        const current = phaseRef.current;
        const reveal = reduced ? 1 : THREE.MathUtils.smoothstep(time, 1.5, 6);
        stage!.camera.position.set(Math.sin(time * 0.1) * (reduced ? 0 : 0.15), 1.55, THREE.MathUtils.lerp(9, 2.7, reduced ? 1 : THREE.MathUtils.smoothstep(time, 0, 7)));
        stage!.camera.lookAt(0, 1.4, -1.2);
        const jedi = current === "jedi" ? 1 : 0,
          sith = current === "sith" ? 1 : 0;
        lights.red.intensity += ((sith ? 520 : jedi ? 30 : 360 * reveal) - lights.red.intensity) * Math.min(1, dt * 2);
        lights.fill.intensity += ((sith ? 30 : jedi ? 6 : 18 * reveal) - lights.fill.intensity) * Math.min(1, dt * 2);
        backdrop.material.opacity = (jedi ? 0.15 : 0.85) * reveal;
        backdrop.material.color.lerp(jedi ? goldTint : crimson, Math.min(1, dt * 2));
        lights.blue.intensity += ((jedi ? 40 : 0) - lights.blue.intensity) * Math.min(1, dt * 2);
        lights.gold.intensity += ((jedi ? 22 : 0) - lights.gold.intensity) * Math.min(1, dt * 2);
        strips.forEach((strip, i) => {
          const tint = jedi ? new THREE.Color(0x9fd4ff) : new THREE.Color(0xff3a3a);
          strip.color.lerp(tint.multiplyScalar(0.25 + reveal * 0.75 * (reduced ? 1 : 0.85 + Math.sin(time * 2 + i) * 0.15)), Math.min(1, dt * 3));
        });
        lord.blade.material.opacity = 0.5 + (reduced ? 0 : Math.sin(time * 40) * 0.05);
        // The dark side answers with lightning.
        bolt.visible = !!sith && !reduced && Math.sin(time * 7.3) > 0.55;
        if (bolt.visible) {
          const p = bolt.geometry.getAttribute("position") as THREE.BufferAttribute;
          let x = (Math.random() - 0.5) * 3,
            y = 4,
            z = -1 - Math.random() * 3;
          for (let i = 0; i < p.count / 2; i++) {
            p.setXYZ(i * 2, x, y, z);
            x += (Math.random() - 0.5) * 0.6;
            y -= 0.35;
            z += (Math.random() - 0.5) * 0.3;
            p.setXYZ(i * 2 + 1, x, y, z);
          }
          p.needsUpdate = true;
        }
      },
      { fov: 45, exposure: 1 },
    );
    if (!stage) return;
    const { scene } = stage;
    scene.background = new THREE.Color(0x020203);
    scene.fog = new THREE.FogExp2(0x050304, 0.06);
    // A faint studio reflection so the helmet and armour read glossy, not flat black.
    const pmrem = new THREE.PMREMGenerator(stage.renderer),
      room = new RoomEnvironment();
    const reflections = pmrem.fromScene(room, 0.04);
    scene.environment = reflections.texture;
    scene.environmentIntensity = 0.55;
    pmrem.dispose();
    room.dispose();
    // A long corridor of black panels, the floor polished, with light strips down both walls.
    const panel = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.4, metalness: 0.7 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(5, 30), new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.18, metalness: 0.8 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -5;
    scene.add(floor);
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.4, 30), panel);
      wall.position.set(side * 2.4, 2.2, -5);
      scene.add(wall);
      for (let i = 0; i < 12; i++) {
        const material = new THREE.MeshBasicMaterial({ color: 0x220405 });
        strips.push(material);
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.6, 0.12), material);
        strip.position.set(side * 2.24, 1.9, 8 - i * 2.4);
        scene.add(strip);
      }
    }
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 30), panel);
    ceiling.position.set(0, 4.4, -5);
    scene.add(ceiling);
    lord = createDarkLord();
    lord.group.position.set(0, 0, -1.2);
    scene.add(lord.group);
    // A red glow behind him cuts out his silhouette; a spot from above and behind rims the armour.
    const halo = document.createElement("canvas");
    halo.width = halo.height = 128;
    const hc = halo.getContext("2d")!,
      hg = hc.createRadialGradient(64, 64, 0, 64, 64, 64);
    hg.addColorStop(0, "rgba(255,255,255,1)");
    hg.addColorStop(0.4, "rgba(255,255,255,.35)");
    hg.addColorStop(1, "rgba(255,255,255,0)");
    hc.fillStyle = hg;
    hc.fillRect(0, 0, 128, 128);
    backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(halo), color: 0xff2a2a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    );
    backdrop.position.set(0, 1.6, -4.5);
    scene.add(backdrop);
    const red = new THREE.SpotLight(0xff2a2a, 0, 14, 0.7, 0.6, 1.4);
    red.position.set(0, 4.2, -4);
    red.target = lord.group;
    scene.add(red, new THREE.HemisphereLight(0x261012, 0x000000, 0.4));
    const fill = new THREE.PointLight(0xff4444, 0, 8, 2);
    fill.position.set(0.6, 1.6, 1.4);
    const blue = new THREE.PointLight(0x5aaeff, 0, 12, 1.6);
    blue.position.set(-1.5, 3, 1);
    const gold = new THREE.PointLight(0xdab45e, 0, 10, 1.6);
    gold.position.set(1.5, 2.6, 0);
    scene.add(fill, blue, gold);
    // A faint cold glint from the front picks out the helmet's dome and the eye lenses.
    const glint = new THREE.PointLight(0x9fb8ff, 2.5, 3.5, 2);
    glint.position.set(0.45, 2.15, -0.35);
    scene.add(glint);
    Object.assign(lights, { red, fill, blue, gold });
    const boltGeometry = new THREE.BufferGeometry();
    boltGeometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(10 * 2 * 3), 3));
    bolt = new THREE.LineSegments(boltGeometry, new THREE.LineBasicMaterial({ color: 0xd8c8ff }));
    bolt.visible = false;
    scene.add(bolt);
    built = true;
    return () => {
      reflections.dispose();
      stage.dispose();
    };
  }, [reduced, run]);

  const choose = useCallback((path: Path) => {
    choosePath(path);
    setPhase(path);
  }, []);
  const replay = () => {
    setPhase("reveal");
    setRun((value) => value + 1);
  };

  return (
    <motion.div className={`reward-scene vader-scene phase-${phase}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0.15 : 1.2 }} role="dialog" aria-modal="true" aria-label="La rencontre avec Dark Vador">
      <div key={run} ref={mount} className="reward-scene-canvas" />
      {phase === "jedi" && !reduced && <i className="vader-fx vader-fx-light" aria-hidden="true" />}
      {phase === "sith" && !reduced && <i className="vader-fx vader-fx-dark" aria-hidden="true" />}
      <header className="reward-scene-head">
        <p className="jedi-eyebrow">LA DESTINÉE · RENCONTRE AVEC DARK VADOR</p>
        <button className="jedi-close" onClick={onClose} aria-label="Quitter la scène finale">
          <X size={16} />
          <span>QUITTER</span>
        </button>
      </header>
      <AnimatePresence mode="wait">
        {phase === "reveal" && (
          <motion.button key="skip" className="rank-cinematic-skip" onClick={() => setPhase("choice")} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            PASSER <ChevronRight size={13} aria-hidden="true" />
          </motion.button>
        )}
        {phase === "choice" && (
          <motion.div key="choice" className="vader-choice" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
            <h2>QUEL CHEMIN CHOISIREZ‑VOUS&nbsp;?</h2>
            <div>
              <button ref={choiceRef} className="vader-path jedi" onClick={() => choose("jedi")}>
                REJOINDRE LES JEDI
              </button>
              <button className="vader-path sith" onClick={() => choose("sith")}>
                REJOINDRE LES SITH
              </button>
            </div>
          </motion.div>
        )}
        {(phase === "jedi" || phase === "sith") && (
          <motion.div key="outcome" className="vader-outcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? 0 : 0.8, duration: 1 }} role="status">
            <h2>{phase === "jedi" ? "LA LUMIÈRE VOUS GUIDE" : "LE CÔTÉ OBSCUR VOUS ACCUEILLE"}</h2>
            <p>
              {phase === "jedi"
                ? "Vous avez résisté à la tentation. Votre maîtrise de la Force éclaire désormais toute la galaxie. Que la Force soit avec vous."
                : "Vous avez embrassé la colère et la puissance. Rien, désormais, ne résiste à votre volonté."}
            </p>
            <div>
              <button className="jedi-link" onClick={replay}>
                <RotateCcw size={11} aria-hidden="true" /> REVOIR LA SCÈNE
              </button>
              <button className="jedi-button" onClick={onClose}>
                REVENIR AU VAISSEAU
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
