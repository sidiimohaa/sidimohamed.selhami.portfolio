"use client";
import { useEffect, useRef } from "react";

// Atmospheric entry, drawn over the start of a landing: re-entry heat with streaks rushing past,
// then layers of the planet's own clouds, until the descent breaks out above the landing zone.
export const ENTRY_SECONDS = 2.6;
const PALETTES: Record<string, { cloud: [number, number, number]; haze: string }> = {
  Tatooine: { cloud: [233, 210, 172], haze: "#e6cfa9" },
  Coruscant: { cloud: [132, 116, 158], haze: "#5f5379" },
  Hoth: { cloud: [241, 245, 249], haze: "#eaf0f5" },
};
const smoothstep = (from: number, to: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

// One soft, lumpy cloud puff, painted once and then stretched with drawImage.
function puff([r, g, b]: [number, number, number]) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const c = canvas.getContext("2d")!;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 9; i++) {
    const x = 34 + rand() * 60,
      y = 34 + rand() * 60,
      radius = 22 + rand() * 30;
    const blob = c.createRadialGradient(x, y, 0, x, y, radius);
    blob.addColorStop(0, `rgba(${r},${g},${b},.55)`);
    blob.addColorStop(1, `rgba(${r},${g},${b},0)`);
    c.fillStyle = blob;
    c.fillRect(0, 0, 128, 128);
  }
  return canvas;
}

export default function AtmosphereEntry({ planet, onDone }: { planet: string; onDone: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null),
    done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    const palette = PALETTES[planet] ?? { cloud: [205, 210, 216] as [number, number, number], haze: "#cfd4da" };
    const sprite = puff(palette.cloud);
    let seed = 1977;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const streaks = Array.from({ length: 110 }, () => ({ angle: rand() * Math.PI * 2, offset: rand(), width: 0.6 + rand() * 1.8 }));
    const clouds = Array.from({ length: 48 }, () => ({ angle: rand() * Math.PI * 2, spread: 0.15 + rand() * 0.85, offset: rand(), size: 0.7 + rand() * 0.8 }));
    let width = 1,
      height = 1;
    const resize = () => {
      width = Math.max(1, element.clientWidth);
      height = Math.max(1, element.clientHeight);
      const dpr = Math.min(devicePixelRatio, 1.5);
      element.width = Math.round(width * dpr);
      element.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    const start = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const t = Math.max(0, (now - start) / 1000);
      if (t >= ENTRY_SECONDS) {
        done.current();
        return;
      }
      const cx = width / 2,
        cy = height * 0.46,
        reach = Math.hypot(width, height) * 0.6;
      const heat = 1 - smoothstep(0.7, 1.35, t),
        cloud = smoothstep(0.45, 0.85, t) * (1 - smoothstep(1.55, 2.45, t)),
        cover = 1 - smoothstep(1.7, ENTRY_SECONDS, t);
      ctx.clearRect(0, 0, width, height);
      // The haze of the planet's air, thinning as the descent breaks through.
      ctx.globalAlpha = cover * (0.55 + cloud * 0.4);
      ctx.fillStyle = palette.haze;
      ctx.fillRect(0, 0, width, height);
      // Re-entry plasma: white-hot ahead, burning orange and red towards the edges.
      if (heat > 0) {
        const flicker = 0.9 + Math.sin(t * 47) * 0.05 + Math.sin(t * 113) * 0.05;
        const plasma = ctx.createRadialGradient(cx, cy, reach * 0.05, cx, cy, reach);
        plasma.addColorStop(0, "rgba(255,244,224,.95)");
        plasma.addColorStop(0.28, "rgba(255,166,84,.85)");
        plasma.addColorStop(0.62, "rgba(196,64,22,.75)");
        plasma.addColorStop(1, "rgba(40,10,4,.95)");
        ctx.globalAlpha = heat * flicker;
        ctx.fillStyle = plasma;
        ctx.fillRect(0, 0, width, height);
        // Heat streaks race outwards past the canopy.
        ctx.lineCap = "round";
        ctx.strokeStyle = "rgba(255,226,180,.8)";
        for (const streak of streaks) {
          const r = (streak.offset + t * 2.4) % 1,
            inner = reach * (0.12 + r * r * 0.9),
            outer = inner + reach * (0.04 + r * 0.22);
          ctx.globalAlpha = heat * r * 0.7;
          ctx.lineWidth = streak.width * (0.5 + r * 2);
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(streak.angle) * inner, cy + Math.sin(streak.angle) * inner);
          ctx.lineTo(cx + Math.cos(streak.angle) * outer, cy + Math.sin(streak.angle) * outer);
          ctx.stroke();
        }
      }
      // Banks of cloud rush at the viewer and part around them.
      if (cloud > 0) {
        for (const puffAt of clouds) {
          const depth = 1 - ((puffAt.offset + t * 1.25) % 1),
            near = 1 / Math.max(depth, 0.08);
          const x = cx + Math.cos(puffAt.angle) * puffAt.spread * reach * 0.35 * near,
            y = cy + Math.sin(puffAt.angle) * puffAt.spread * reach * 0.22 * near,
            size = reach * 0.32 * puffAt.size * near;
          ctx.globalAlpha = cloud * smoothstep(1, 0.75, depth) * smoothstep(0.05, 0.25, depth) * 0.9;
          ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
        }
      }
      ctx.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [planet]);
  return <canvas ref={canvas} className="surface-entry" aria-hidden="true" />;
}
