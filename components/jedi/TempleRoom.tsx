"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import * as THREE from "three";
import { createCouncilMember } from "../coruscantTaxi/councilMembers";
import { missions, useJediProgression } from "../jediProgression";
import { glowTexture } from "../landingKit";
import { createEscapeAudio } from "./orderEscapeWorld";
import { temple, yoda } from "./rewardContent";
import { createStage } from "./stage";
import { RELIC_SPOTS, YODA_SPOT, createTempleArchives, createTempleRelics, createYodaSeat, type RelicId } from "./templeArchives";

// The Master's reward: the Jedi Archives. Yoda waits at the far end of the aisle and speaks of each
// of the four relics as the visitor chooses them; each comes alive, and holds a page of the pilot's
// real record. Going to see him in person, he points the way to the secrets still to be found.

type Focus = RelicId | "yoda";

const IDLE_EYE = new THREE.Vector3(0, 1.5, 1.6);
const IDLE_GAZE = new THREE.Vector3(0, 1.42, YODA_SPOT.z);
// How far back to stand, and how high to look, to take each relic in.
const FRAMES: Record<RelicId, { back: number; look: number }> = {
  archives: { back: 4.3, look: 1.8 },
  kyber: { back: 3.6, look: 1.75 },
  council: { back: 3.6, look: 1.42 },
  holocron: { back: 3.1, look: 1.5 },
};

export default function TempleRoom({ reduced, sound, onClose }: { reduced: boolean; sound: boolean; onClose: () => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [relic, setRelic] = useState<Focus | null>(null);
  const [counsel, setCounsel] = useState(0);
  const { status } = useJediProgression();
  const missing = missions.filter((mission) => status(mission.id) !== "done");
  const [fallback, setFallback] = useState(false);
  const focus = useRef<Focus | null>(null);
  focus.current = relic;
  const audioRef = useRef<ReturnType<typeof createEscapeAudio>>(null);
  const toggle = useRef<(id: Focus) => void>(() => undefined);
  toggle.current = (id) => {
    const next = relic === id ? null : id;
    setRelic(next);
    if (next === "kyber") audioRef.current?.sing();
    if (next === "archives" || next === "council") audioRef.current?.chime();
    if (next === "holocron" || next === "yoda") audioRef.current?.chime();
  };
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
    audioRef.current = sound ? createEscapeAudio() : null;
    const glow = glowTexture();
    const tickRef = { current: (_dt: number, _time: number) => undefined as void };
    const stage = createStage(el, (dt, time) => tickRef.current(dt, time), { fov: 42, exposure: 1.02, look: "deathstar", adaptive: true });
    if (!stage) {
      setFallback(true);
      return;
    }
    const { scene, camera } = stage;
    camera.far = 200;
    camera.updateProjectionMatrix();
    scene.background = new THREE.Color(0x120c08);
    scene.fog = new THREE.FogExp2(0x21170f, 0.012);
    const hall = createTempleArchives(glow);
    const { group: relicGroup, relics } = createTempleRelics(glow);
    scene.add(hall.group, relicGroup);
    // Yoda, on his cushion, in front of the window.
    const seat = createYodaSeat();
    seat.position.copy(YODA_SPOT);
    scene.add(seat);
    const master = createCouncilMember("yoda");
    master.group.position.set(YODA_SPOT.x, 0.9, YODA_SPOT.z);
    master.group.scale.setScalar(0.7);
    scene.add(master.group);
    const onYoda = new THREE.SpotLight(0xffeccc, 9, 8, 0.5, 0.7, 1.4);
    const YODA_FACE = YODA_SPOT.clone().setY(1.35);
    onYoda.position.set(0.8, 3.6, YODA_SPOT.z + 3.2);
    onYoda.target.position.set(YODA_SPOT.x, 1, YODA_SPOT.z);
    scene.add(onYoda, onYoda.target);

    const amounts: Record<RelicId, number> = { archives: 0, kyber: 0, council: 0, holocron: 0 };
    const eye = new THREE.Vector3(0, 1.7, 8),
      gaze = IDLE_GAZE.clone(),
      goalEye = new THREE.Vector3(),
      goalGaze = new THREE.Vector3(),
      spot = new THREE.Vector3();
    const entered = { value: reduced ? 1 : 0 };
    tickRef.current = (dt, time) => {
      entered.value = Math.min(1, entered.value + dt / 4.5);
      const walkIn = THREE.MathUtils.smootherstep(entered.value, 0, 1);
      const chosen = focus.current;
      // Face to face with him, at his own height.
      if (chosen === "yoda") {
        goalEye.set(YODA_FACE.x + 0.4, 1.3, YODA_FACE.z + 2.75);
        goalGaze.copy(YODA_FACE);
      } else if (chosen) {
        const at = RELIC_SPOTS[chosen];
        goalEye.set(at.x * 0.3, 1.62, at.z + FRAMES[chosen].back);
        goalGaze.set(at.x, FRAMES[chosen].look, at.z);
      } else {
        goalEye.copy(IDLE_EYE);
        goalEye.z = THREE.MathUtils.lerp(9.5, IDLE_EYE.z, walkIn);
        if (!reduced) goalEye.x = Math.sin(time * 0.12) * 0.22;
        goalGaze.copy(IDLE_GAZE);
      }
      const ease = reduced ? 1 : 1 - Math.exp(-dt * 1.7);
      eye.lerp(goalEye, ease);
      gaze.lerp(goalGaze, ease);
      camera.position.copy(eye);
      camera.lookAt(gaze);
      (Object.keys(relics) as RelicId[]).forEach((id) => {
        const target = chosen === id ? 1 : 0;
        // Coming alive takes its time; going back to sleep is quicker.
        amounts[id] = reduced ? target : THREE.MathUtils.clamp(amounts[id] + (target ? dt / 2.6 : -dt / 0.8), 0, 1);
        relics[id].tick(amounts[id], time, reduced);
      });
      onYoda.intensity = THREE.MathUtils.damp(onYoda.intensity, chosen === "yoda" ? 22 : 9, 2.4, dt);
      // He follows the visitor with his eyes, and breathes.
      const dx = eye.x - master.group.position.x,
        dz = eye.z - master.group.position.z;
      master.head.rotation.y = THREE.MathUtils.damp(master.head.rotation.y, THREE.MathUtils.clamp(Math.atan2(dx, dz), -0.8, 0.8), 3, dt);
      master.head.rotation.x = THREE.MathUtils.damp(master.head.rotation.x, 0.08 + (reduced ? 0 : Math.sin(time * 0.5) * 0.02), 3, dt);
      if (!reduced) master.trunk.scale.y = 1 + Math.sin(time * 1.1) * 0.006;
      hall.tick(dt);
    };
    // A relic can also be chosen by clicking it in the room itself.
    const pick = (event: PointerEvent) => {
      const box = el.getBoundingClientRect();
      const x = event.clientX - box.left,
        y = event.clientY - box.top;
      let best: Focus | null = null,
        distance = 110;
      const consider = (id: Focus) => {
        spot.project(camera);
        const d = Math.hypot(((spot.x + 1) / 2) * box.width - x, ((1 - spot.y) / 2) * box.height - y);
        if (d < distance) {
          distance = d;
          best = id;
        }
      };
      (Object.keys(RELIC_SPOTS) as RelicId[]).forEach((id) => {
        spot.copy(RELIC_SPOTS[id]).setY(1.2);
        consider(id);
      });
      spot.copy(YODA_FACE);
      consider("yoda");
      if (best) toggle.current(best);
    };
    el.addEventListener("click", pick);
    if (process.env.NODE_ENV !== "production") (window as unknown as { __templeRoom?: unknown }).__templeRoom = { camera, scene, amounts };
    return () => {
      tickRef.current = () => undefined;
      el.removeEventListener("click", pick);
      audioRef.current?.close();
      audioRef.current = null;
      hall.dispose();
      stage.dispose();
      glow.dispose();
    };
  }, [reduced, sound]);

  const current = temple.relics.find((item) => item.id === relic);
  const advice = missing.length ? missing[counsel % missing.length].whisper : yoda.fulfilled;
  const line = relic === "yoda" ? advice : relic ? yoda[relic] : yoda.welcome;
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
              <button className="jedi-tab-like" aria-pressed={relic === item.id} onClick={() => toggle.current(item.id as RelicId)}>
                {item.title}
              </button>
            </li>
          ))}
          <li>
            <button className="jedi-tab-like temple-visit" aria-pressed={relic === "yoda"} onClick={() => toggle.current("yoda")}>
              Aller voir Maître Yoda
            </button>
          </li>
        </ul>
        <div className="temple-reading" aria-live="polite">
          {relic === "yoda" ? (
            <>
              <strong>Maître Yoda</strong>
              <p>{missing.length ? `${missing.length > 1 ? `${missing.length} secrets vous restent` : "Un secret vous reste"} à découvrir. Il peut vous mettre sur la voie.` : "Les dix secrets sont trouvés : il n’a plus rien à vous cacher."}</p>
              {missing.length > 1 && (
                <button className="jedi-tab-like temple-counsel" onClick={() => setCounsel((value) => value + 1)}>
                  Un autre conseil
                </button>
              )}
            </>
          ) : current ? (
            <>
              <strong>{current.title}</strong>
              <p>{current.text}</p>
            </>
          ) : (
            <p>Choisissez une relique, ici ou dans la salle, pour l’examiner.</p>
          )}
        </div>
      </aside>
      <AnimatePresence mode="wait">
        {!fallback && (
          <motion.p key={line} className="temple-yoda" role="status" initial={{ opacity: 0, y: reduced ? 0 : 6 }} animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0.1 : 0.5, delay: reduced || relic ? 0 : 1.6 } }} exit={{ opacity: 0, transition: { duration: reduced ? 0.05 : 0.18 } }}>
            <span className="mono">MAÎTRE YODA</span>
            « {line} »
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
