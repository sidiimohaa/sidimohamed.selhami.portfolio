"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue } from "motion/react";
import { Briefcase, FastForward, Volume2, VolumeX } from "lucide-react";
import { identity } from "./deathStar/cvData";

function smoothstep(from: number, to: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}
export default function Preloader({
  ready,
  progress,
  reduced,
  onComplete,
  onRecruiter,
  sound,
  onToggleSound,
  onExit,
}: {
  ready: boolean;
  // Share of the scene that is loaded, 0..1.
  progress: number;
  onRecruiter: () => void;
  reduced: boolean;
  onComplete: () => void;
  sound: boolean;
  onToggleSound: () => void;
  onExit: () => void;
}) {
  const root = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(ready),
    completeRef = useRef(onComplete),
    exitRef = useRef(onExit);
  const [exiting, setExiting] = useState(false);
  // "Passer l'intro": the drop out of hyperspace is cut short as soon as the scene is ready.
  const skip = useRef(false),
    [skipped, setSkipped] = useState(false);
  const opacity = useMotionValue(1);
  readyRef.current = ready;
  completeRef.current = onComplete;
  exitRef.current = onExit;
  useEffect(() => {
    const element = canvas.current,
      overlay = root.current;
    if (!element || !overlay) return;
    const ctx = element.getContext("2d", { alpha: false });
    let width = 1,
      height = 1,
      frame = 0,
      exitAt: number | null = null,
      finished = false;
    const start = performance.now();
    let last = start;
    let seed = 1977;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const stars = Array.from(
      { length: window.innerWidth < 600 ? 320 : 620 },
      () => ({
        x: (rand() - 0.5) * 2400,
        y: (rand() - 0.5) * 1600,
        z: 35 + rand() * 1765,
        brightness: 0.35 + rand() * 0.65,
      }),
    ).map((star) => ({
      ...star,
      // Colours are fixed per star, so they are built once rather than every frame.
      dot: `rgba(208,225,241,${star.brightness * 0.78})`,
      tail: `rgba(132,183,233,${star.brightness * 0.35})`,
      head: `rgba(231,243,255,${star.brightness * 0.95})`,
    }));
    const resize = () => {
      width = Math.max(1, overlay.clientWidth);
      height = Math.max(1, overlay.clientHeight);
      const dpr = Math.min(devicePixelRatio, 1.5);
      element.width = Math.round(width * dpr);
      element.height = Math.round(height * dpr);
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(overlay);
    resize();
    const animate = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (
        exitAt === null &&
        readyRef.current &&
        (skip.current || now - start > (reduced ? 400 : 950))
      ) {
        exitAt = now;
        setExiting(true);
        exitRef.current();
      }
      const phase =
        exitAt === null
          ? 0
          : Math.min(1, (now - exitAt) / (skip.current ? 260 : reduced ? 450 : 1850));
      const speed = reduced
        ? 0
        : 1350 * Math.pow(1 - smoothstep(0, 0.7, phase), 2);
      opacity.set(1 - smoothstep(reduced ? 0 : 0.54, 1, phase));
      if (ctx) {
        ctx.fillStyle = "#050a10";
        ctx.fillRect(0, 0, width, height);
        const cx = width * 0.5,
          cy = height * 0.44,
          focal = Math.max(width, height) * 0.72;
        const halo = ctx.createRadialGradient(
          cx,
          cy,
          0,
          cx,
          cy,
          Math.max(width, height) * 0.6,
        );
        halo.addColorStop(
          0,
          `rgba(59,103,147,${reduced ? 0.04 : 0.13 * (1 - phase)})`,
        );
        halo.addColorStop(0.35, `rgba(23,51,77,${0.08 * (1 - phase)})`);
        halo.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, width, height);
        for (const star of stars) {
          star.z -= speed * dt;
          if (star.z < 28) star.z = 1800;
          const x = cx + (star.x / star.z) * focal,
            y = cy + (star.y / star.z) * focal;
          if (
            x < -width * 0.3 ||
            x > width * 1.3 ||
            y < -height * 0.3 ||
            y > height * 1.3
          )
            continue;
          const depth = star.z + speed * (0.17 + star.brightness * 0.1);
          const tailX = cx + (star.x / depth) * focal,
            tailY = cy + (star.y / depth) * focal;
          const length = Math.hypot(x - tailX, y - tailY);
          const thickness =
            Math.min(1.9, 0.45 + 260 / star.z) * star.brightness;
          if (length < 1.7 || reduced) {
            ctx.fillStyle = star.dot;
            ctx.beginPath();
            ctx.arc(x, y, Math.max(0.45, thickness * 0.7), 0, Math.PI * 2);
            ctx.fill();
          } else {
            // A dim tail and a bright head: two plain strokes instead of a gradient per star,
            // which kept the streaks smooth only on fast machines.
            const midX = (tailX + x) * 0.5,
              midY = (tailY + y) * 0.5;
            ctx.lineWidth = thickness;
            ctx.lineCap = "round";
            ctx.strokeStyle = star.tail;
            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(midX, midY);
            ctx.stroke();
            ctx.strokeStyle = star.head;
            ctx.beginPath();
            ctx.moveTo(midX, midY);
            ctx.lineTo(x, y);
            ctx.stroke();
          }
        }
      }
      if (phase === 1) {
        finished = true;
        completeRef.current();
        return;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      if (!finished) opacity.set(1);
    };
  }, [reduced, opacity]);
  // The bar never runs backwards, and reads full once the scene is ready.
  const shown = ready ? 1 : Math.min(0.97, Math.max(0.04, progress));
  const percent = Math.round(shown * 100);
  const stage = exiting
    ? "RETOUR EN ESPACE RÉEL"
    : ready
      ? "SORTIE D’HYPERESPACE"
      : progress < 0.85
        ? "CHARGEMENT DES MONDES"
        : "CALIBRAGE DES INSTRUMENTS";
  return (
    <motion.div
      ref={root}
      className="preloader hyperspace-preloader"
      role="status"
      aria-label="Sortie d’hyperespace"
      style={{ opacity }}
      exit={{ opacity: 0, transition: { duration: 0.08 } }}
    >
      <canvas ref={canvas} className="hyperspace-canvas" aria-hidden="true" />
      {exiting && !reduced && <div className="hyperspace-bloom" aria-hidden="true" />}
      <div className="loader-card">
        <p className="loader-brand">ORBITAL · PORTFOLIO 3D</p>
        <p className="loader-name">{identity.name}</p>
        <p className="loader-pitch">{identity.search}</p>
        <div
          className="loader-progress"
          role="progressbar"
          aria-label="Chargement de la galaxie"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <i style={{ transform: `scaleX(${shown})` }} />
        </div>
        <p className="loader-stage">
          <span>{stage}</span>
          <b>{percent} %</b>
        </p>
        <div className="loader-actions">
          <button className="loader-button is-primary" onClick={onRecruiter}>
            <Briefcase size={15} aria-hidden="true" /> MODE RECRUTEUR
          </button>
          <button
            className="loader-button"
            data-sound-toggle
            aria-pressed={sound}
            onClick={onToggleSound}
          >
            {sound ? <Volume2 size={15} aria-hidden="true" /> : <VolumeX size={15} aria-hidden="true" />}
            {sound ? "SON ACTIF" : "ACTIVER LE SON"}
          </button>
          <button
            className="loader-button"
            disabled={skipped}
            onClick={() => {
              skip.current = true;
              setSkipped(true);
            }}
          >
            <FastForward size={15} aria-hidden="true" /> {skipped ? "UN INSTANT…" : "PASSER L’INTRO"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
