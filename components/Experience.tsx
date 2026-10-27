"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  ArrowRight,
  Volume2,
  VolumeX,
  X,
  ChevronRight,
  RotateCcw,
  Navigation,
  CircleHelp,
  Map,
} from "lucide-react";
import Preloader from "./Preloader";
const SpaceScene = dynamic(() => import("./SpaceScene"), { ssr: false });
import { destinations } from "./universe";

function OrbitalLogo() {
  return (
    <svg viewBox="0 0 46 46" fill="none" aria-hidden="true">
      <circle cx="23" cy="23" r="12" stroke="currentColor" strokeWidth="1.5" />
      <ellipse
        cx="23"
        cy="23"
        rx="23"
        ry="7"
        transform="rotate(-45 23 23)"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="35" cy="10" r="2.4" fill="currentColor" />
    </svg>
  );
}
export default function Experience() {
  const reduced = !!useReducedMotion(),
    [ready, setReady] = useState(false),
    [progress, setProgress] = useState(0),
    [loading, setLoading] = useState(true),
    [boost, setBoost] = useState(false),
    [destination, setDestination] = useState(0),
    [mapOpen, setMapOpen] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    [sound, setSound] = useState(false),
    [travel, setTravel] = useState(false),
    [arrived, setArrived] = useState(false),
    [unsupported, setUnsupported] = useState(false),
    [resetKey, setResetKey] = useState(0);
  const audio = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null),
    timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const current = destinations[destination];
  const onReady = useCallback(() => setReady(true), []),
    onUnsupported = useCallback(() => setUnsupported(true), []);
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(
      () =>
        setProgress((p) => {
          const t = (performance.now() - start) / 26;
          return Math.min(ready ? 100 : 92, Math.max(p, Math.floor(t)));
        }),
      40,
    );
    return () => clearInterval(id);
  }, [ready]);
  useEffect(() => {
    if (progress === 100) {
      const id = setTimeout(() => setLoading(false), 400);
      return () => clearTimeout(id);
    }
  }, [progress]);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      void audio.current?.ctx.close();
    },
    [],
  );
  const launch = useCallback(
    (index: number) => {
      timers.current.forEach(clearTimeout);
      setDestination(index);
      setMapOpen(false);
      setArrived(false);
      setTravel(true);
      timers.current.push(
        setTimeout(
          () => {
            setTravel(false);
            setArrived(true);
          },
          reduced ? 650 : 3200,
        ),
      );
    },
    [reduced],
  );
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        timers.current.forEach(clearTimeout);
        setMapOpen(false);
        setHelpOpen(false);
        setArrived(false);
        setTravel(false);
      }
      if (
        e.key.toLowerCase() === "e" &&
        !loading &&
        !travel &&
        !mapOpen &&
        !helpOpen &&
        !arrived
      )
        launch(destination);
      if (e.key === "Shift") setBoost(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Shift") setBoost(false);
    };
    const blur = () => setBoost(false);
    window.addEventListener("keydown", handler);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [loading, destination, travel, mapOpen, helpOpen, arrived, launch]);
  useEffect(() => {
    if (!mapOpen && !helpOpen && !arrived) return;
    const old = document.activeElement as HTMLElement;
    const modal = document.querySelector<HTMLElement>('[role="dialog"]');
    modal?.querySelector<HTMLElement>("button")?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !modal) return;
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>('button,a,[tabindex="0"]'),
      );
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", trap);
    return () => {
      window.removeEventListener("keydown", trap);
      old?.focus();
    };
  }, [mapOpen, helpOpen, arrived]);
  const toggleSound = () => {
    if (!audio.current) {
      const ctx = new AudioContext(),
        gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      [54, 81, 109].forEach((f, i) => {
        const oscillator = ctx.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.value = f + i * 0.35;
        oscillator.connect(gain);
        oscillator.start();
      });
      audio.current = { ctx, gain };
    }
    void audio.current.ctx.resume();
    audio.current.gain.gain.setTargetAtTime(
      sound ? 0 : 0.022,
      audio.current.ctx.currentTime,
      0.4,
    );
    setSound(!sound);
  };
  const openMap = () => {
    timers.current.forEach(clearTimeout);
    setTravel(false);
    setArrived(false);
    setMapOpen(true);
  };
  const reset = () => {
    timers.current.forEach(clearTimeout);
    setTravel(false);
    setArrived(false);
    setMapOpen(false);
    setHelpOpen(false);
    setBoost(false);
    setDestination(0);
    setResetKey((key) => key + 1);
  };
  const paused = loading || mapOpen || helpOpen || arrived;
  return (
    <main
      aria-busy={loading}
      className={`experience open-space ${travel ? "is-travelling" : ""}`}
    >
      <div className="space-haze" />
      <div className="star-backup" />
      {unsupported && <div className="fallback-planet" />}
      <SpaceScene
        state={{
          flying: !loading,
          boost,
          destination,
          travel,
          reduced,
          paused,
          resetKey,
        }}
        onSelect={launch}
        onReady={onReady}
        onUnsupported={onUnsupported}
      />
      <div className="vignette" />
      <div className="grain" />
      <AnimatePresence>
        {loading && <Preloader progress={progress} reduced={reduced} />}
      </AnimatePresence>
      <h1 className="sr-only">
        ORBITAL — Explorez mon univers en vaisseau spatial
      </h1>
      <header className="header">
        <button
          className="brand"
          onClick={reset}
          aria-label="Orbital, revenir au départ"
        >
          <OrbitalLogo />
          <span>
            ORBITAL<sup>®</sup>
          </span>
        </button>
        <nav aria-label="Navigation principale" className="minimal-nav">
          <button
            className="map-trigger"
            onClick={openMap}
            aria-label="Ouvrir la carte stellaire"
          >
            <Map size={15} />
            <span>CARTE STELLAIRE</span>
          </button>
          <button
            className="sound-button"
            onClick={reset}
            aria-label="Revenir au point de départ"
          >
            <RotateCcw size={15} />
          </button>
          <button
            className={`sound-button ${sound ? "on" : ""}`}
            aria-label={
              sound ? "Couper l’ambiance sonore" : "Activer l’ambiance sonore"
            }
            aria-pressed={sound}
            onClick={toggleSound}
          >
            {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            className="sound-button"
            aria-label="Afficher les commandes"
            onClick={() => setHelpOpen(true)}
          >
            <CircleHelp size={16} />
          </button>
        </nav>
      </header>
      <AnimatePresence>
        {travel && (
          <motion.div
            className="travel-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="travel-lines" />
            <div>
              <Navigation size={22} />
              <p>SAUT HYPERSPATIAL</p>
              <h2>{current.name.toUpperCase()}</h2>
              <span className="mono">CALCUL DE LA TRAJECTOIRE EN COURS</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {mapOpen && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMapOpen(false)}
          >
            <motion.section
              className="star-map modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="map-title"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-top mono">
                <span>NAVIGATION / CARTE STELLAIRE</span>
                <button
                  className="close-button"
                  onClick={() => setMapOpen(false)}
                  aria-label="Fermer la carte"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="eyebrow">L’ESPACE EST À VOUS.</p>
              <h2 id="map-title">OÙ ALLONS-NOUS ?</h2>
              <p className="modal-intro">
                Choisissez un signal. Je vous emmène en orbite.
              </p>
              <div className="map-planets">
                {destinations.map((p, i) => (
                  <button
                    className="map-destination"
                    key={p.name}
                    onClick={() => launch(i)}
                  >
                    <span className="map-index mono">
                      {p.number} <ArrowUpRight size={16} />
                    </span>
                    <div className={`map-globe ${p.className}`} />
                    <span className="map-category mono">{p.tag}</span>
                    <strong>{p.name}</strong>
                    <span className="map-desc">{p.description}</span>
                    <span className="map-bottom mono">
                      {p.category}
                      <ChevronRight size={15} />
                    </span>
                  </button>
                ))}
              </div>
              <div className="map-note mono">
                <i /> LES PLANÈTES SONT EN COURS DE FORMATION. EXPLORATION EN
                ORBITE DISPONIBLE.
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {arrived && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setArrived(false)}
          >
            <motion.section
              className="arrival modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="arrival-title"
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-top mono">
                <span>
                  <i className="live-dot" /> MISE EN ORBITE RÉUSSIE
                </span>
                <button
                  className="close-button"
                  onClick={() => setArrived(false)}
                  aria-label="Fermer la destination"
                >
                  <X size={20} />
                </button>
              </div>
              <div
                className={`arrival-planet map-globe ${current.className}`}
              />
              <p className="eyebrow">{current.tag}</p>
              <h2 id="arrival-title">{current.name.toUpperCase()}</h2>
              <p>{current.description}</p>
              <div className="arrival-message">
                <span className="mono">
                  TRANSMISSION REÇUE / {current.number}
                </span>
                <p>
                  {destination === 3 ? (
                    <>
                      La station reste silencieuse.
                      <br />
                      Poursuivez votre exploration en orbite.
                    </>
                  ) : (
                    <>
                      Ce monde est encore en formation.
                      <br />
                      Son histoire s’écrira bientôt.
                    </>
                  )}
                </p>
              </div>
              <button className="primary-cta" onClick={openMap}>
                <span>EXPLORER UNE AUTRE PLANÈTE</span>
                <ArrowUpRight size={18} />
              </button>
              <button className="text-button" onClick={() => setArrived(false)}>
                POURSUIVRE LE VOL <ArrowRight size={14} />
              </button>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {helpOpen && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setHelpOpen(false)}
          >
            <motion.section
              className="help modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="help-title"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-top mono">
                <span>VOL LIBRE</span>
                <button
                  className="close-button"
                  aria-label="Fermer les commandes"
                  onClick={() => setHelpOpen(false)}
                >
                  <X size={20} />
                </button>
              </div>
              <h2 id="help-title">À votre rythme.</h2>
              <p>
                Le vaisseau reste immobile au repos. Maintenez une commande pour
                voyager ; relâchez pour vous arrêter.
              </p>
              <dl className="help-controls">
                <div>
                  <dt>Diriger</dt>
                  <dd>Maintenez et glissez à la souris ou au doigt</dd>
                </div>
                <div>
                  <dt>Voyager</dt>
                  <dd>Maintenez les flèches, ZQSD ou WASD</dd>
                </div>
                <div>
                  <dt>Accélérer</dt>
                  <dd>Maintenez Maj ou deux doigts</dd>
                </div>
                <div>
                  <dt>Approcher</dt>
                  <dd>Cliquez sur une planète ou ouvrez la carte</dd>
                </div>
                <div>
                  <dt>Fermer</dt>
                  <dd>Échap</dd>
                </div>
              </dl>
              <button className="text-button" onClick={reset}>
                <RotateCcw size={13} /> REVENIR AU POINT DE DÉPART
              </button>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
      {unsupported && (
        <div className="webgl-note mono">
          MODE VISUEL SIMPLIFIÉ — LA NAVIGATION RESTE DISPONIBLE
        </div>
      )}
    </main>
  );
}
