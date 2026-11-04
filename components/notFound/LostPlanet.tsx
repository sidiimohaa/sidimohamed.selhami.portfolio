"use client";
import { useEffect, useRef, useState } from "react";
import { LostCard, LostHeader, type Collection } from "./LostFrame";

// The 404 as a celestial body: three rocky digits drifting apart inside a ring of debris. Dragging
// spins the ring and tilts it; it keeps turning slowly on its own unless motion is reduced.

function random(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export default function LostPlanet({ collection }: { collection?: Collection }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [path, setPath] = useState("");
  useEffect(() => {
    setPath(decodeURIComponent(window.location.pathname) || "/");
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d")!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rand = random(404);
    // A speckled rock texture, drawn once and used as the digits' fill.
    const grain = document.createElement("canvas");
    grain.width = grain.height = 160;
    const g = grain.getContext("2d")!;
    g.fillStyle = "#6f6a62";
    g.fillRect(0, 0, 160, 160);
    for (let i = 0; i < 1400; i++) {
      const tone = 70 + rand() * 90;
      g.fillStyle = `rgba(${tone},${tone * 0.95},${tone * 0.88},${0.25 + rand() * 0.4})`;
      const size = rand() < 0.08 ? 3 + rand() * 6 : 1 + rand() * 2;
      g.beginPath();
      g.arc(rand() * 160, rand() * 160, size, 0, Math.PI * 2);
      g.fill();
    }
    const rock = ctx.createPattern(grain, "repeat")!;
    const debris = Array.from({ length: 150 }, () => ({
      angle: rand() * Math.PI * 2,
      reach: 1 + (rand() - 0.5) * 0.22,
      lift: (rand() - 0.5) * 0.05,
      size: 1 + Math.pow(rand(), 3) * 6,
      tone: 120 + rand() * 90,
      spin: rand() * Math.PI,
    }));
    const pieces = [
      { char: "4", x: -1, drift: [-1, -0.4], turn: -0.12 },
      { char: "0", x: 0, drift: [0, 0.5], turn: 0.08 },
      { char: "4", x: 1, drift: [1, -0.2], turn: 0.15 },
    ];
    let width = 1,
      height = 1,
      ratio = 1,
      frame = 0,
      last = performance.now(),
      age = 0,
      spin = 0,
      velocity = reduced ? 0 : 0.12,
      tilt = 0.32,
      dragging: { x: number; y: number } | null = null;
    const resize = () => {
      ratio = Math.min(window.devicePixelRatio, 2);
      width = el.clientWidth;
      height = el.clientHeight;
      el.width = Math.round(width * ratio);
      el.height = Math.round(height * ratio);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    const drawDebris = (cx: number, cy: number, radius: number, front: boolean) => {
      for (const bit of debris) {
        const angle = bit.angle + spin;
        const depth = Math.sin(angle);
        if (front !== depth > 0) continue;
        const x = cx + Math.cos(angle) * radius * 1.75 * bit.reach,
          y = cy + depth * radius * 1.75 * bit.reach * tilt + bit.lift * radius;
        const shade = bit.tone * (0.55 + 0.45 * (depth * 0.5 + 0.5));
        ctx.fillStyle = `rgb(${shade},${shade * 0.94},${shade * 0.86})`;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(bit.spin + spin * 2);
        const s = bit.size * (0.8 + 0.3 * depth) * (radius / 120);
        ctx.fillRect(-s / 2, -s / 2, s, s * 0.8);
        ctx.restore();
      }
    };
    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      age += dt;
      if (!dragging) velocity += ((reduced ? 0 : 0.12) - velocity) * Math.min(1, dt * 0.8);
      spin += velocity * dt;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const compact = width < 640;
      const cx = width / 2,
        cy = height * (compact ? 0.27 : 0.3),
        radius = Math.min(width * (compact ? 0.2 : 0.11), height * 0.16);
      // A faint glow behind the wreck.
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2.6);
      halo.addColorStop(0, "rgba(255,170,110,.18)");
      halo.addColorStop(1, "rgba(255,170,110,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(cx - radius * 3, cy - radius * 3, radius * 6, radius * 6);
      drawDebris(cx, cy, radius, false);
      const separation = reduced ? 0.04 : 0.04 + Math.sin(age * 0.5) * 0.015;
      ctx.font = `800 ${radius * 1.5}px Arial Black, Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const piece of pieces) {
        ctx.save();
        ctx.translate(cx + piece.x * radius * 0.92 + piece.drift[0] * radius * separation, cy + piece.drift[1] * radius * separation * 2);
        ctx.rotate(piece.turn + (reduced ? 0 : Math.sin(age * 0.4 + piece.x) * 0.02));
        ctx.shadowColor = "rgba(0,0,0,.6)";
        ctx.shadowBlur = radius * 0.12;
        ctx.fillStyle = rock;
        ctx.fillText(piece.char, 0, 0);
        ctx.shadowBlur = 0;
        // Light from the upper left, shadow to the lower right: the same glyph again, with a
        // gradient fill, so the shading never spills outside the rock.
        const light = ctx.createLinearGradient(-radius * 0.5, -radius * 0.7, radius * 0.5, radius * 0.7);
        light.addColorStop(0, "rgba(255,230,200,.35)");
        light.addColorStop(0.5, "rgba(0,0,0,0)");
        light.addColorStop(1, "rgba(10,6,20,.55)");
        ctx.fillStyle = light;
        ctx.fillText(piece.char, 0, 0);
        ctx.restore();
      }
      drawDebris(cx, cy, radius, true);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    const down = (event: PointerEvent) => {
      dragging = { x: event.clientX, y: event.clientY };
      el.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - dragging.x,
        dy = event.clientY - dragging.y;
      dragging = { x: event.clientX, y: event.clientY };
      velocity = dx * 0.06;
      spin += dx * 0.01;
      tilt = Math.min(0.75, Math.max(0.08, tilt + dy * 0.004));
    };
    const up = () => {
      dragging = null;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, []);
  return (
    <main className="lost-sector lost-planet">
      <div className="lost-starfield" aria-hidden="true" />
      <canvas ref={canvas} className="lost-planet-canvas" aria-label="Le chiffre 404 en astre brisé, glissez pour faire tourner son anneau" role="img" />
      <LostHeader collection={collection} />
      <LostCard kicker="ERREUR 404 · OBJET CÉLESTE NON RÉPERTORIÉ" title="Cette page est devenue un astre." path={path} code={false}>
        <p>
          À ces coordonnées, il ne reste qu’un petit monde brisé en trois chiffres : la page n’existe pas, ou plus. Faites tourner son anneau, puis rentrez à bon port.
        </p>
        <p className="lost-hint mono">GLISSEZ SUR L’ASTRE POUR FAIRE TOURNER L’ANNEAU</p>
      </LostCard>
    </main>
  );
}
