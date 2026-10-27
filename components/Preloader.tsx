"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, useMotionValue } from "motion/react";
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

// A single diffuse exit glow, rather than a repeating flash.
const easing = { i: { x: 0.67, y: 0.67 }, o: { x: 0.33, y: 0.33 } };
const exitLight = {
  v: "5.7.4",
  fr: 30,
  ip: 0,
  op: 54,
  w: 400,
  h: 400,
  nm: "Hyperspace exit light",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "Arrival glow",
      sr: 1,
      ks: {
        o: {
          a: 1,
          k: [
            { t: 0, s: [0], ...easing },
            { t: 12, s: [14], ...easing },
            { t: 30, s: [8], ...easing },
            { t: 54, s: [0] },
          ],
        },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [200, 200, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [20, 20, 100], ...easing },
            { t: 24, s: [180, 180, 100], ...easing },
            { t: 54, s: [220, 220, 100] },
          ],
        },
      },
      shapes: [
        {
          ty: "gr",
          it: [
            {
              ty: "el",
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [190, 130] },
              d: 1,
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.6, 0.77, 1, 1] },
              o: { a: 0, k: 100 },
              r: 1,
            },
            {
              ty: "tr",
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
            },
          ],
        },
      ],
      ip: 0,
      op: 54,
      st: 0,
      bm: 0,
    },
  ],
};
function smoothstep(from: number, to: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}
export default function Preloader({
  ready,
  reduced,
  onComplete,
}: {
  ready: boolean;
  reduced: boolean;
  onComplete: () => void;
}) {
  const root = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(ready),
    completeRef = useRef(onComplete);
  const [exiting, setExiting] = useState(false);
  const opacity = useMotionValue(1);
  readyRef.current = ready;
  completeRef.current = onComplete;
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
    );
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
        now - start > (reduced ? 400 : 950)
      ) {
        exitAt = now;
        setExiting(true);
      }
      const phase =
        exitAt === null
          ? 0
          : Math.min(1, (now - exitAt) / (reduced ? 450 : 1850));
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
            ctx.fillStyle = `rgba(208,225,241,${star.brightness * 0.78})`;
            ctx.beginPath();
            ctx.arc(x, y, Math.max(0.45, thickness * 0.7), 0, Math.PI * 2);
            ctx.fill();
          } else {
            const gradient = ctx.createLinearGradient(tailX, tailY, x, y);
            gradient.addColorStop(0, "rgba(76,133,196,0)");
            gradient.addColorStop(
              0.5,
              `rgba(132,183,233,${star.brightness * 0.4})`,
            );
            gradient.addColorStop(
              1,
              `rgba(231,243,255,${star.brightness * 0.95})`,
            );
            ctx.strokeStyle = gradient;
            ctx.lineWidth = thickness;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
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
      {exiting && !reduced && (
        <Lottie
          className="hyperspace-bloom"
          animationData={exitLight}
          loop={false}
          aria-hidden="true"
        />
      )}
      <div className="hyperspace-caption mono">
        <i aria-hidden="true" />
        {exiting ? "RETOUR EN ESPACE RÉEL" : "SORTIE D’HYPERESPACE"}
      </div>
    </motion.div>
  );
}
