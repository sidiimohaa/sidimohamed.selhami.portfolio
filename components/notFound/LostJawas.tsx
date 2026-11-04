"use client";
import { useEffect, useRef, useState } from "react";
import { Coins } from "lucide-react";
import { LostCard, LostHeader, type Collection } from "./LostFrame";

// The Jawas salvaged the page: a dusk over the Dune Sea, a sandcrawler, and a Jawa who will sell
// the page back for nothing. Buying it chatters "Utinni!" and heads home.

// A short Jawa chatter, synthesised: a few quick rising and falling chirps.
function chatter() {
  const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const start = context.currentTime + 0.02;
  [0, 0.11, 0.2, 0.34, 0.43].forEach((at, index) => {
    const tone = context.createOscillator(),
      level = context.createGain();
    tone.type = "square";
    const base = 620 + index * 90;
    tone.frequency.setValueAtTime(base, start + at);
    tone.frequency.exponentialRampToValueAtTime(index % 2 ? base * 0.62 : base * 1.7, start + at + 0.08);
    level.gain.setValueAtTime(0.0001, start + at);
    level.gain.exponentialRampToValueAtTime(0.07, start + at + 0.012);
    level.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.09);
    tone.connect(level).connect(context.destination);
    tone.start(start + at);
    tone.stop(start + at + 0.1);
  });
  window.setTimeout(() => context.close(), 900);
}

export default function LostJawas({ collection }: { collection?: Collection }) {
  const [path, setPath] = useState("");
  const [sound, setSound] = useState(false);
  const [bought, setBought] = useState(false);
  const leave = useRef(0);
  useEffect(() => {
    setPath(decodeURIComponent(window.location.pathname) || "/");
    return () => window.clearTimeout(leave.current);
  }, []);
  const buy = () => {
    if (bought) return;
    setBought(true);
    if (sound) chatter();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    leave.current = window.setTimeout(() => window.location.assign("/"), reduced ? 600 : 1600);
  };
  return (
    <main className="lost-sector lost-jawas" data-bought={bought}>
      <svg className="lost-dunes" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <circle className="lost-sun" cx="860" cy="250" r="26" />
        <circle className="lost-sun is-second" cx="924" cy="282" r="17" />
        <path className="lost-dune is-far" d="M0 420 Q220 360 430 400 T860 380 T1200 400 V600 H0 Z" />
        <g className="lost-crawler" transform="translate(800 300)">
          <path d="M20 90 L60 20 L250 20 L300 70 L300 110 L10 110 Z" />
          <path className="lost-crawler-top" d="M90 20 L110 0 L220 0 L240 20 Z" />
          <rect className="lost-crawler-tread" x="0" y="108" width="310" height="26" rx="10" />
          <path className="lost-crawler-lines" d="M70 40 H240 M60 60 H270 M50 80 H290" />
        </g>
        <path className="lost-dune" d="M0 470 Q260 420 520 460 T1040 450 T1200 460 V600 H0 Z" />
        <g className="lost-jawa" transform="translate(250 360)">
          <path className="lost-jawa-robe" d="M40 0 C18 4 10 30 12 56 L4 150 H86 L72 56 C74 26 64 4 40 0 Z" />
          <ellipse className="lost-jawa-face" cx="41" cy="40" rx="20" ry="17" />
          <circle className="lost-jawa-eye" cx="33" cy="40" r="4" />
          <circle className="lost-jawa-eye" cx="50" cy="40" r="4" />
          <g className="lost-jawa-page" transform="translate(70 70) rotate(-8)">
            <rect width="54" height="66" rx="3" />
            <text x="27" y="40" textAnchor="middle">
              404
            </text>
          </g>
        </g>
      </svg>
      {bought && (
        <p className="lost-bubble mono" role="status">
          UTINNI ! MARCHÉ CONCLU.
        </p>
      )}
      <LostHeader sound={sound} onSound={() => setSound((on) => !on)} collection={collection} />
      <LostCard
        kicker="ERREUR 404 · RÉCUPÉRÉE PAR LES JAWAS"
        title="Les Jawas ont récupéré cette page."
        path={path}
        primary={
          <button className="is-primary" onClick={buy} disabled={bought}>
            <Coins size={16} /> {bought ? "Retour vers ORBITAL…" : "Racheter la page · 0 crédit"}
          </button>
        }
      >
        <p>
          Cette page a été démontée et chargée dans un sandcrawler : elle n’existe plus à cette adresse. Bonne nouvelle, ils acceptent de vous revendre le chemin du retour.
        </p>
      </LostCard>
    </main>
  );
}
