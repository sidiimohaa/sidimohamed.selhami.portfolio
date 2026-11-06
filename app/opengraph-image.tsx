import { ImageResponse } from "next/og";
import { identity } from "../components/deathStar/cvData";

// The card shown when the site's link is shared. Drawn here rather than captured, so it needs no
// browser, stays sharp and uses no image from the films.

export const alt = `ORBITAL, le portfolio de ${identity.name}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// A fixed starfield: the same on every build.
const stars = Array.from({ length: 150 }, (_, i) => {
  const a = (i * 2654435761) >>> 0,
    b = (i * 40503 + 9973) * 2654435761 >>> 0;
  return { x: a % 1200, y: b % 630, size: i % 11 === 0 ? 3 : i % 3 === 0 ? 2 : 1, opacity: 0.3 + ((a >> 8) % 70) / 100 };
});

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", background: "linear-gradient(115deg, #03050c 0%, #070c1c 58%, #150d14 100%)", color: "#f4efe4", fontFamily: "sans-serif" }}>
      {stars.map((star, i) => (
        <div key={i} style={{ position: "absolute", left: star.x, top: star.y, width: star.size, height: star.size, borderRadius: 9, background: "#ffffff", opacity: star.opacity }} />
      ))}
      {/* A desert world rising from the right edge, lit from the left. */}
      <div style={{ position: "absolute", left: 780, top: 40, width: 760, height: 760, borderRadius: 380, background: "radial-gradient(circle at 24% 30%, #f6d9a4 0%, #d99a5b 30%, #8d5230 56%, #2c1712 80%, #0a0709 100%)", boxShadow: "-10px -6px 70px rgba(255,190,120,.42)" }} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 76px", width: 780 }}>
        <div style={{ display: "flex", fontSize: 25, letterSpacing: 7, color: "#ffc98a" }}>PORTFOLIO 3D À EXPLORER</div>
        <div style={{ display: "flex", fontSize: 128, fontWeight: 700, letterSpacing: 10, marginTop: 14 }}>ORBITAL</div>
        <div style={{ display: "flex", fontSize: 40, marginTop: 20 }}>{identity.name}</div>
        <div style={{ display: "flex", fontSize: 28, lineHeight: 1.35, marginTop: 14, color: "#c7ccd8" }}>Recherche une alternance d’assistant marketing digital pour 2026-2027</div>
      </div>
    </div>,
    size,
  );
}
