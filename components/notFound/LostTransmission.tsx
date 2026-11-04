"use client";
import { useEffect, useState } from "react";
import { destinations, destinationSlug, planetReferenceStyle } from "../universe";
import { LostCard, LostHeader, type Collection } from "./LostFrame";

// A lost transmission: the astromech's hologram tries to decode the address, the signal breaks up,
// and a small star map offers a course to each destination instead.

const glyphs = "▚▞▙▟░▒▓ΣΔΞ#%<>/01";
const noise = (length: number) => Array.from({ length }, () => glyphs[Math.floor(Math.random() * glyphs.length)]).join("");

export default function LostTransmission({ collection }: { collection?: Collection }) {
  const [path, setPath] = useState("");
  const [shown, setShown] = useState("");
  const [lost, setLost] = useState(false);
  useEffect(() => {
    const address = decodeURIComponent(window.location.pathname) || "/";
    setPath(address);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(address);
      setLost(true);
      return;
    }
    // Character by character, the address resolves out of noise, then the carrier drops.
    let step = 0,
      end: number | undefined;
    const timer = window.setInterval(() => {
      step++;
      const solid = Math.min(address.length, Math.floor(step / 2));
      setShown(address.slice(0, solid) + noise(Math.max(0, address.length - solid)));
      if (solid >= address.length) {
        window.clearInterval(timer);
        end = window.setTimeout(() => setLost(true), 500);
      }
    }, 55);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(end);
    };
  }, []);
  return (
    <main className="lost-sector lost-transmission">
      <div className="lost-starfield" aria-hidden="true" />
      <LostHeader collection={collection} />
      <LostCard
        className="lost-card-tall"
        kicker="ERREUR 404 · TRANSMISSION PERDUE"
        title="Le message s’est perdu en route."
        path={path}
        coords={false}
        extra={
          <nav className="lost-map" aria-label="Destinations d’ORBITAL">
            {destinations.map((world) => (
              <a key={world.name} href={`/?cap=${destinationSlug(world)}`}>
                <i style={planetReferenceStyle(world)} aria-hidden="true" />
                <span>
                  <b>{world.name}</b>
                  <small>{world.category}</small>
                </span>
              </a>
            ))}
          </nav>
        }
      >
        <figure className="lost-holo" data-lost={lost} aria-hidden="true">
          <svg viewBox="0 0 120 140">
            <ellipse cx="60" cy="132" rx="34" ry="5" />
            <path d="M34 60 A26 26 0 0 1 86 60 Z" />
            <rect x="36" y="60" width="48" height="50" rx="4" />
            <rect x="46" y="40" width="10" height="8" rx="2" />
            <circle cx="68" cy="47" r="3" />
            <path d="M42 72 H78 M42 82 H66 M42 92 H74" />
            <path d="M30 66 L24 70 L24 120 L36 128 M90 66 L96 70 L96 120 L84 128" />
          </svg>
          <figcaption className="mono">
            <span>{lost ? "SIGNAL PERDU" : "DÉCODAGE DES COORDONNÉES"}</span>
            <code>{shown || " "}</code>
          </figcaption>
        </figure>
        <p>
          Le droïde a tenté de décoder ces coordonnées, mais la transmission s’est interrompue : la page n’existe pas, ou plus. Choisissez une destination, le pilote automatique vous y conduit.
        </p>
      </LostCard>
    </main>
  );
}
