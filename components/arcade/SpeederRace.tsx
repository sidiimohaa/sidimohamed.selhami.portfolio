"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import { createStage } from "../jedi/stage";
import { CHECKPOINTS, HALF, TRACK, centre, createEndorTrack } from "./speederWorld";
import { SPEED_TARGET, type GameResult } from "./arcadeStore";
import type { ArcadeAudio } from "./arcadeAudio";

// Speeder Bike Racing: a chase-camera run through the forest of Endor on its own WebGL stage.
// Steer between the redwoods, boost when the meter allows, pass the three beacons and reach the
// Ewok village. Three violent crashes wreck the bike.

type Props = { reduced: boolean; audio: ArcadeAudio | null; trail: string; best: number | null; onFinish: (result: GameResult) => void; onQuit: () => void };
type Phase = "countdown" | "racing" | "finished" | "wrecked";
type Hud = { phase: Phase; paused: boolean; time: number; count: number; speed: number; boost: number; boosting: boolean; crashes: number; progress: number; split: string | null; message: string; hurt: number };

const blank: Hud = { phase: "countdown", paused: false, time: 0, count: 3, speed: 0, boost: 1, boosting: false, crashes: 0, progress: 0, split: null, message: "", hurt: 0 };
const timeLabel = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, "0")}`;
const LEFT = ["ArrowLeft", "a", "q"],
  RIGHT = ["ArrowRight", "d"],
  BOOST = ["Shift", " ", "ArrowUp", "w", "z"];

export default function SpeederRace({ reduced, audio, trail, best, onFinish, onQuit }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<Hud>(blank);
  const [failed, setFailed] = useState(false);
  const control = useRef({ left: false, right: false, boost: false, pointer: null as number | null, paused: false, restart: 0 });
  const live = useRef({ audio, onFinish, reduced });
  live.current = { audio, onFinish, reduced };

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    let track: ReturnType<typeof createEndorTrack> | null = null;
    const s = {
      phase: "countdown" as Phase,
      count: 3.4,
      time: 0,
      d: 0,
      x: centre(0),
      camX: centre(0),
      vx: 0,
      speed: 0,
      boost: 1,
      boosting: false,
      crashes: 0,
      invuln: 0,
      shake: 0,
      hurt: 0,
      next: 0,
      obstacle: 0,
      split: null as string | null,
      splitUntil: 0,
      message: "",
      messageUntil: 0,
      clock: 0,
      beep: 4,
      restart: 0,
      ui: 1,
    };
    const say = (text: string, seconds = 2.5) => {
      s.message = text;
      s.messageUntil = s.clock + seconds;
    };
    const reset = () => {
      Object.assign(s, { phase: "countdown", count: 3.4, time: 0, d: 0, x: centre(0), camX: centre(0), vx: 0, speed: 0, boost: 1, boosting: false, crashes: 0, invuln: 0, shake: 0, hurt: 0, next: 0, obstacle: 0, split: null, splitUntil: 0, message: "", messageUntil: 0, beep: 4 });
      control.current.paused = false;
    };
    const finish = (won: boolean) => {
      const { audio, onFinish } = live.current;
      s.phase = won ? "finished" : "wrecked";
      if (won) audio?.success();
      else audio?.fail();
      const t = Math.round(s.time * 100) / 100;
      const score = won ? Math.max(500, Math.round(12000 - t * 100) - s.crashes * 400) : Math.round((Math.min(s.d, TRACK) / TRACK) * 2000);
      onFinish({ gameId: "speeder-racing", score, won, perfect: won && s.crashes === 0, seconds: Math.round(t), time: won ? t : undefined });
    };
    const crash = (text: string) => {
      s.crashes++;
      s.speed = 6;
      s.shake = 1;
      s.hurt = 1;
      s.invuln = 1.4;
      live.current.audio?.crash();
      if (s.crashes >= 3) {
        say("Speeder hors service !", 4);
        finish(false);
      } else say(`${text} Collisions : ${s.crashes}/3`, 2.4);
    };
    const look = new THREE.Vector3();
    const stage = createStage(
      el,
      (dt) => {
        if (!track) return;
        const c = control.current;
        const { audio, reduced } = live.current;
        if (c.restart !== s.restart) {
          s.restart = c.restart;
          reset();
        }
        const step = c.paused ? 0 : dt;
        s.clock += step;
        if (s.phase === "countdown") {
          s.count -= step;
          const n = Math.ceil(s.count - 0.4);
          if (n !== s.beep && n >= 0) {
            s.beep = n;
            if (n > 0) audio?.ui("select");
            else audio?.boost();
          }
          if (s.count <= 0.4) s.phase = "racing";
        }
        const racing = s.phase === "racing";
        if (racing) s.time += step;
        let steer = (c.right ? 1 : 0) - (c.left ? 1 : 0);
        if (!steer && c.pointer !== null) steer = THREE.MathUtils.clamp(c.pointer * 1.8, -1, 1);
        if (!racing) steer = 0;
        s.boosting = racing && c.boost && s.boost > 0.02;
        if (s.boosting) s.boost = Math.max(0, s.boost - step * 0.32);
        else s.boost = Math.min(1, s.boost + step * 0.11);
        const target = racing ? (s.boosting ? 52 : 33) : 0;
        s.speed = THREE.MathUtils.damp(s.speed, target, racing ? (s.boosting ? 1.6 : 1.1) : 1.4, step);
        s.vx = THREE.MathUtils.damp(s.vx, steer * 17, 6, step);
        const before = s.d;
        s.d += s.speed * step;
        s.x += s.vx * step;
        // The corridor's walls of trunks, then the trunks in the way.
        const offset = s.x - centre(s.d);
        if (Math.abs(offset) > HALF - 0.7) {
          s.x = centre(s.d) + Math.sign(offset) * (HALF - 2.4);
          s.vx = -Math.sign(offset) * 4;
          if (racing && s.invuln <= 0) crash("Les arbres du bord !");
        }
        const obstacles = track.obstacles;
        while (s.obstacle < obstacles.length && obstacles[s.obstacle].d <= s.d) {
          const o = obstacles[s.obstacle++];
          if (racing && o.d > before - 0.001 && s.invuln <= 0 && Math.abs(s.x - o.x) < o.r * 1.3 + 0.5) {
            s.x = o.x + (Math.sign(s.x - o.x) || 1) * (o.r * 1.45 + 0.9);
            crash("Collision avec un tronc !");
          }
        }
        if (racing && s.next < CHECKPOINTS.length && s.d >= CHECKPOINTS[s.next]) {
          track.flashGate(s.next);
          s.split = `POINT DE PASSAGE ${s.next + 1}/${CHECKPOINTS.length} · ${s.time.toFixed(2)} s`;
          s.splitUntil = s.clock + 2.5;
          s.next++;
          audio?.ui("unlock");
        }
        if (racing && s.d >= TRACK) {
          track.flashGate(CHECKPOINTS.length);
          say("Arrivée au village ewok !", 5);
          finish(true);
        }
        s.invuln = Math.max(0, s.invuln - step);
        s.shake = THREE.MathUtils.damp(s.shake, 0, 3, step);
        s.hurt = THREE.MathUtils.damp(s.hurt, 0, 2.5, step);
        const thrust = s.boosting ? 1 : (s.speed / 52) * 0.45;
        track.place(
          s.x,
          s.d,
          -Math.atan2(s.vx, Math.max(8, s.speed)),
          reduced ? 0 : -s.vx * 0.035 + (s.invuln > 0 ? Math.sin(s.clock * 30) * 0.08 : 0),
          s.boosting && !reduced ? -0.04 : 0,
          reduced ? 0 : Math.sin(s.clock * 2.3) * 0.05,
          thrust,
        );
        track.tick(step);
        // Chase camera: low behind the bike, wider and shakier at speed.
        const camera = stage!.camera;
        const portrait = camera.aspect < 0.8;
        s.camX = THREE.MathUtils.damp(s.camX, s.x, 5, dt);
        camera.position.set(s.camX, portrait ? 3.4 : 2.6, -s.d + (portrait ? 8.2 : 6.2));
        if (!reduced && s.shake > 0.01) camera.position.add(look.set(Math.sin(s.clock * 41), Math.cos(s.clock * 37), 0).multiplyScalar(s.shake * 0.25));
        camera.lookAt(look.set(s.x + s.vx * 0.12, 1.4, -s.d - 14));
        const fov = (portrait ? 82 : 68) + (reduced ? 0 : Math.max(0, s.speed - 33) * 0.45 + (s.boosting ? 4 : 0));
        camera.fov = THREE.MathUtils.damp(camera.fov, fov, 4, dt);
        camera.updateProjectionMatrix();
        audio?.engine(c.paused ? 0 : 0.06 + thrust * 0.05, 40 + s.speed * 1.5);
        if ((s.ui += dt) >= 0.1) {
          s.ui = 0;
          setHud({
            phase: s.phase,
            paused: c.paused,
            time: s.time,
            count: Math.ceil(s.count - 0.4),
            speed: Math.round(s.speed * 3.6),
            boost: s.boost,
            boosting: s.boosting,
            crashes: s.crashes,
            progress: Math.min(1, s.d / TRACK),
            split: s.clock < s.splitUntil ? s.split : null,
            message: s.clock < s.messageUntil ? s.message : "",
            hurt: s.hurt,
          });
        }
      },
      { fov: 68, exposure: 1.05 },
    );
    if (!stage) {
      setFailed(true);
      return;
    }
    stage.camera.far = 260;
    track = createEndorTrack(stage.scene, { trail, reduced: live.current.reduced });
    const blur = () => (control.current.paused = true);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("blur", blur);
      live.current.audio?.engine(0);
      track?.dispose();
      stage.dispose();
    };
    // The stage is built once per race; restarts reset it in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard: steer, boost, and Escape to pause rather than leave the cockpit.
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const k = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const down = event.type === "keydown";
      if (k === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (down && !event.repeat) {
          control.current.paused = !control.current.paused;
          setHud((h) => ({ ...h, paused: control.current.paused }));
        }
        return;
      }
      const element = event.target instanceof Element ? event.target : null;
      if (element?.closest("button") && [" ", "Enter"].includes(k)) return;
      if (LEFT.includes(k)) control.current.left = down;
      else if (RIGHT.includes(k)) control.current.right = down;
      else if (BOOST.includes(k)) control.current.boost = down;
      else return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener("keydown", key, true);
    window.addEventListener("keyup", key, true);
    return () => {
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("keyup", key, true);
    };
  }, []);

  const hold = (flag: "left" | "right" | "boost") => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      control.current[flag] = true;
    },
    onPointerUp: () => (control.current[flag] = false),
    onPointerCancel: () => (control.current[flag] = false),
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
  });
  const steerFrom = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    control.current.pointer = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  };
  const setPaused = (paused: boolean) => {
    control.current.paused = paused;
    setHud((h) => ({ ...h, paused }));
  };
  const restart = () => {
    control.current.restart++;
    control.current.paused = false;
    setHud(blank);
  };
  const ended = hud.phase === "finished" || hud.phase === "wrecked";

  return (
    <div className="race-overlay arcade-game" role="dialog" aria-modal="true" aria-label="Speeder Bike Racing sur Endor">
      <div
        ref={mount}
        className="race-canvas"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          steerFrom(event);
        }}
        onPointerMove={(event) => {
          if (event.buttons) steerFrom(event);
        }}
        onPointerUp={() => (control.current.pointer = null)}
        onPointerCancel={() => (control.current.pointer = null)}
      />
      {!reduced && <div className="race-speedlines" style={{ opacity: hud.boosting ? 0.7 : Math.max(0, (hud.speed - 120) / 200) }} aria-hidden="true" />}
      {hud.hurt > 0.02 && <div className="arcade-hud-hurt" style={{ opacity: hud.hurt * 0.8 }} aria-hidden="true" />}
      <div className="race-hud">
        <div className="race-top">
          <div className="race-info">
            <span className="race-time">{timeLabel(hud.time)}</span>
            <span>
              MEILLEUR {best !== null ? `${best.toFixed(2)} s` : "—"} · SPEED DEMON &lt; {SPEED_TARGET} s
            </span>
            <span className={hud.crashes ? "race-warn" : ""}>COLLISIONS {hud.crashes}/3</span>
          </div>
          <div className="race-progress" aria-label={`Progression ${Math.round(hud.progress * 100)} %`}>
            <i style={{ width: `${hud.progress * 100}%` }} />
            {CHECKPOINTS.map((d) => (
              <b key={d} style={{ left: `${(d / TRACK) * 100}%` }} />
            ))}
          </div>
          <div className="arcade-hud-controls">
            <button onClick={() => setPaused(!hud.paused)} aria-label={hud.paused ? "Reprendre" : "Mettre en pause"} disabled={ended}>
              {hud.paused ? <Play size={14} /> : <Pause size={14} />}
              <span>PAUSE</span>
            </button>
            <button onClick={onQuit} aria-label="Quitter la course">
              <X size={14} />
              <span>QUITTER</span>
            </button>
          </div>
        </div>
        {hud.phase === "countdown" && hud.count > 0 && (
          <div className="arcade-hud-banner race-count" role="status">
            {hud.count}
            <small>Q/D ou ←/→ pour diriger · Maj ou Espace pour le boost</small>
          </div>
        )}
        {hud.phase === "racing" && hud.time < 1 && <div className="arcade-hud-banner race-count">GO !</div>}
        {hud.split && <p className="race-split mono">{hud.split}</p>}
        {hud.message && <p className="arcade-hud-message">{hud.message}</p>}
        {ended && (
          <div className="arcade-hud-banner" role="status">
            {hud.phase === "finished" ? "ARRIVÉE" : "SPEEDER HORS SERVICE"}
            <small>{hud.phase === "finished" ? `${hud.time.toFixed(2)} s · ${hud.crashes} collision${hud.crashes > 1 ? "s" : ""}` : "Trois collisions de trop"}</small>
          </div>
        )}
        <div className="race-speed">
          {hud.speed}
          <small> KM/H</small>
        </div>
        <div className="race-boost">
          <span>BOOST {hud.boosting ? "ACTIF" : ""}</span>
          <i>
            <b style={{ width: `${hud.boost * 100}%` }} />
          </i>
        </div>
        <div className="race-touch">
          <div>
            <button {...hold("left")} aria-label="Gauche">
              ◀
            </button>
            <button {...hold("right")} aria-label="Droite">
              ▶
            </button>
          </div>
          <button {...hold("boost")} aria-label="Boost">
            BOOST
          </button>
        </div>
      </div>
      {hud.paused && !ended && (
        <div className="arcade-hud-end">
          <section role="dialog" aria-label="Pause">
            <h2>PAUSE</h2>
            <div>
              <button className="arcade-button" onClick={() => setPaused(false)}>
                <Play size={13} /> REPRENDRE
              </button>
              <button className="arcade-button" onClick={restart}>
                <RotateCcw size={13} /> RECOMMENCER
              </button>
              <button className="arcade-button" onClick={onQuit}>
                <X size={13} /> RETOUR À LA CONSOLE
              </button>
            </div>
          </section>
        </div>
      )}
      {failed && (
        <div className="arcade-hud-end">
          <section role="status">
            <h2>SIMULATION INDISPONIBLE</h2>
            <p>Le rendu 3D n’est pas disponible sur cet appareil.</p>
            <button className="arcade-button" onClick={onQuit}>
              RETOUR À LA CONSOLE
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
