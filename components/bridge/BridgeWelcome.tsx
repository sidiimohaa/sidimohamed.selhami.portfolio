"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Briefcase, Compass, Download, Gauge } from "lucide-react";
import { CV_PDF, identity } from "../deathStar/cvData";

// The welcome on the bridge once the ship drops out of hyperspace: the consoles come online one
// after the other, then three ways in. Every choice opens a part of the portfolio that exists.

const systems = ["RÉACTEURS IONIQUES", "NAVIGATION STELLAIRE", "COMMUNICATIONS", "ASTROMÉCANO COPILOTE", "ARCHIVES DU PILOTE"];

type Props = {
  reduced: boolean;
  onExplore: () => void;
  onCockpit: () => void;
  onPortfolio: () => void;
};

export default function BridgeWelcome({ reduced, onExplore, onCockpit, onPortfolio }: Props) {
  const [online, setOnline] = useState(reduced ? systems.length : 0);
  const first = useRef<HTMLButtonElement>(null);
  const exploreRef = useRef(onExplore);
  exploreRef.current = onExplore;
  useEffect(() => {
    if (reduced) return;
    const timers = systems.map((_, index) => window.setTimeout(() => setOnline(index + 1), 260 + index * 190));
    return () => timers.forEach(clearTimeout);
  }, [reduced]);
  const ready = online >= systems.length;
  useEffect(() => {
    if (ready) first.current?.focus({ preventScroll: true });
  }, [ready]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        exploreRef.current();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <motion.section
      className="bridge-welcome"
      role="dialog"
      aria-modal="false"
      aria-labelledby="bridge-welcome-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduced ? 0.1 : 0.35 } }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="bridge-panel">
        <div className="bridge-panel-top mono">
          <span>ORBITAL · SYSTÈMES DE BORD</span>
          <button className="bridge-skip mono" onClick={onExplore}>
            PASSER
          </button>
        </div>
        <ol className="bridge-boot mono" aria-label="Démarrage des systèmes">
          {systems.map((system, index) => (
            <li key={system} data-online={index < online}>
              <span>{system}</span>
              <em>{index < online ? "EN LIGNE" : "…"}</em>
            </li>
          ))}
        </ol>
        <motion.div
          className="bridge-greeting"
          initial={false}
          animate={{ opacity: ready ? 1 : 0, y: ready || reduced ? 0 : 8 }}
          transition={{ duration: reduced ? 0 : 0.45 }}
          aria-hidden={!ready}
        >
          <h2 id="bridge-welcome-title">Bienvenue à bord, commandant.</h2>
          <p>
            Vous pilotez le portfolio de <strong>{identity.name}</strong>, en {identity.program}. {identity.search}
          </p>
          <div className="bridge-choices">
            <button ref={first} className="bridge-choice" onClick={onExplore} disabled={!ready}>
              <Compass size={18} aria-hidden="true" />
              <span>
                <b>EXPLORER LA GALAXIE</b>
                <small>Vol libre vers les cinq destinations</small>
              </span>
            </button>
            <button className="bridge-choice" onClick={onCockpit} disabled={!ready}>
              <Gauge size={18} aria-hidden="true" />
              <span>
                <b>ACCÉDER AU COCKPIT</b>
                <small>Système orbital, missions et arcade</small>
              </span>
            </button>
            <button className="bridge-choice is-primary" onClick={onPortfolio} disabled={!ready}>
              <Briefcase size={18} aria-hidden="true" />
              <span>
                <b>DÉCOUVRIR MON PORTFOLIO</b>
                <small>Mode recruteur : CV, projets, compétences, contact</small>
              </span>
            </button>
          </div>
          <a className="bridge-cv mono" href={CV_PDF} download tabIndex={ready ? 0 : -1}>
            <Download size={13} aria-hidden="true" /> TÉLÉCHARGER LE CV (PDF)
          </a>
        </motion.div>
      </div>
    </motion.section>
  );
}
