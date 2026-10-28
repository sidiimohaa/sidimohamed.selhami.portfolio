"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  Volume2,
  VolumeX,
  X,
  ChevronRight,
  RotateCcw,
  Navigation,
  CircleHelp,
  Map,
  PlaneLanding,
} from "lucide-react";
import Preloader from "./Preloader";
import { createFlightAudio, type FlightAudio } from "./flightAudio";
import type { FlightTelemetry } from "./SpaceScene";
import type { HyperspacePhase } from "./spaceTraffic";
import type { SurfaceCue } from "./LandingScene";
const SpaceScene = dynamic(() => import("./SpaceScene"), { ssr: false });
const LandingScene = dynamic(() => import("./LandingScene"), { ssr: false });
import { destinations, landings, planetReferenceStyle } from "./universe";

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
    [loading, setLoading] = useState(true),
    [boost, setBoost] = useState(false),
    [destination, setDestination] = useState(0),
    [mapOpen, setMapOpen] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    [sound, setSound] = useState(false),
    [travel, setTravel] = useState(false),
    [arrived, setArrived] = useState(false),
    [unsupported, setUnsupported] = useState(false),
    [resetKey, setResetKey] = useState(0),
    [droidSignal, setDroidSignal] = useState(0),
    [surface, setSurface] = useState<number | null>(null);
  const audio = useRef<FlightAudio | null>(null),
    timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const current = destinations[destination],
    landing = landings[current.name],
    ground = surface !== null ? destinations[surface] : null,
    groundLanding = ground ? landings[ground.name] : undefined;
  const guidance = useRef<number | null>(null),
    approachProgress = useRef<HTMLElement>(null),
    arrivedRef = useRef(arrived);
  arrivedRef.current = arrived;
  const onFlight = useCallback((flight: FlightTelemetry) => {
    guidance.current = flight.target;
    audio.current?.flight(flight);
    if (approachProgress.current)
      approachProgress.current.style.transform = `scaleX(${flight.approachProgress})`;
    if (flight.manual && arrivedRef.current) setArrived(false);
  }, []);
  const onDroid = useCallback(() => {
    setDroidSignal((value) => value + 1);
    audio.current?.droid();
  }, []);
  const onExitSound = useCallback(() => audio.current?.exit(), []);
  const onHyperspace = useCallback((phase: HyperspacePhase) => {
    if (phase === "arrive") audio.current?.exit(0.5);
    else audio.current?.jump();
  }, []);
  const onReady = useCallback(() => setReady(true), []),
    onUnsupported = useCallback(() => setUnsupported(true), []);
  const completeArrival = useCallback(() => setLoading(false), []);
  const completeApproach = useCallback(() => {
    setTravel(false);
    setArrived(true);
  }, []);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      audio.current?.dispose();
    },
    [],
  );
  const launch = useCallback(
    (index: number) => {
      timers.current.forEach(clearTimeout);
      setSurface(null);
      setDestination(index);
      setMapOpen(false);
      setArrived(false);
      setTravel(true);
      // The flight animation signals arrival after braking, rather than a wall-clock timer.
      if (unsupported) timers.current.push(setTimeout(completeApproach, 650));
    },
    [unsupported, completeApproach],
  );
  const land = useCallback(() => {
    timers.current.forEach(clearTimeout);
    setArrived(false);
    setTravel(false);
    setMapOpen(false);
    setSurface(destination);
    audio.current?.exit(0.8);
  }, [destination]);
  const takeOff = useCallback(() => {
    setSurface(null);
    setArrived(true);
  }, []);
  const onSurfaceCue = useCallback((cue: SurfaceCue) => {
    const voice = audio.current;
    if (cue === "terminal") voice?.chime();
    else if (cue === "takeoff") voice?.jump();
    else if (cue === "step") voice?.step();
    else if (cue === "droid") voice?.droid();
    else voice?.speeder(cue === "speeder-arrive" ? "arrive" : "leave");
  }, []);
  const soundscape = groundLanding?.soundscape ?? null;
  useEffect(() => {
    audio.current?.ambience(sound ? soundscape : null);
  }, [soundscape, sound]);
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
        surface === null
      ) {
        const focused = (document.activeElement as HTMLElement | null)?.dataset
          .destination;
        const aimed =
          focused !== undefined
            ? Number(focused)
            : (guidance.current ?? destination);
        // In orbit of a world with a landing zone, E takes the ship down.
        if (arrivedRef.current && landing && aimed === destination) land();
        else launch(aimed);
      }
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
  }, [
    loading,
    destination,
    travel,
    mapOpen,
    helpOpen,
    surface,
    landing,
    land,
    launch,
  ]);
  useEffect(() => {
    if (!mapOpen && !helpOpen) return;
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
  }, [mapOpen, helpOpen]);
  const toggleSound = () => {
    if (typeof AudioContext === "undefined") return;
    if (!audio.current) audio.current = createFlightAudio();
    const enabled = !sound;
    audio.current.setEnabled(enabled);
    setSound(enabled);
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
    setSurface(null);
    setDestination(0);
    setResetKey((key) => key + 1);
  };
  const replayArrival = () => {
    reset();
    setLoading(true);
  };
  const cancelApproach = () => {
    timers.current.forEach(clearTimeout);
    setTravel(false);
  };
  const paused = loading || mapOpen || helpOpen || surface !== null;
  return (
    <main
      aria-busy={loading}
      className={`experience open-space ${travel ? "is-travelling" : ""} ${ground ? "on-surface" : ""}`}
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
          arrived,
          reduced,
          paused,
          hidden: surface !== null,
          resetKey,
          droidSignal,
        }}
        onSelect={launch}
        onFlight={onFlight}
        onApproachComplete={completeApproach}
        onDroid={onDroid}
        onHyperspace={onHyperspace}
        onReady={onReady}
        onUnsupported={onUnsupported}
      />
      {ground && groundLanding && (
        <LandingScene
          planet={ground.name}
          landing={groundLanding}
          reduced={reduced}
          paused={mapOpen || helpOpen}
          onCue={onSurfaceCue}
          onTakeoff={takeOff}
        />
      )}
      <div className="vignette" />
      <div className="grain" />
      <AnimatePresence>
        {loading && (
          <Preloader
            ready={ready}
            reduced={reduced}
            onComplete={completeArrival}
            sound={sound}
            onToggleSound={toggleSound}
            onExit={onExitSound}
          />
        )}
      </AnimatePresence>
      <h1 className="sr-only">
        ORBITAL — Explorez mon univers en vaisseau spatial
      </h1>
      <header className="header" inert={loading}>
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
            onClick={() => {
              cancelApproach();
              setHelpOpen(true);
            }}
          >
            <CircleHelp size={16} />
          </button>
        </nav>
      </header>
      <AnimatePresence>
        {travel && (
          <motion.div
            className="course-badge"
            role="status"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Navigation size={12} />
            <span>EN APPROCHE · {current.name.toUpperCase()}</span>
            <button aria-label="Annuler l’approche" onClick={cancelApproach}>
              <X size={13} />
            </button>
            <i
              ref={approachProgress}
              className="course-progress"
              style={{ transform: `scaleX(${unsupported ? 1 : 0})` }}
            />
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
                    <div
                      className={`map-globe has-reference ${p.className}`}
                      style={planetReferenceStyle(p)}
                    />
                    <span className="map-category mono">{p.tag}</span>
                    <strong>{p.name}</strong>
                    <span className="map-desc">{p.summary}</span>
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
          <motion.aside
            className="orbit-card"
            role="region"
            aria-labelledby="orbit-title"
            aria-live="polite"
            initial={{ opacity: 0, y: reduced ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : 8 }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="orbit-card-top mono">
              <span>
                <i className="live-dot" /> EN ORBITE · {current.number}
              </span>
              <button
                className="close-button"
                aria-label="Fermer la transmission"
                onClick={() => setArrived(false)}
              >
                <X size={15} />
              </button>
            </div>
            <h2 id="orbit-title">{current.name}</h2>
            <p>{current.description}</p>
            <span className="orbit-note mono">
              {landing
                ? "ZONE D’ATTERRISSAGE DÉGAGÉE · E POUR ATTERRIR"
                : destination === 3
                  ? "TRANSMISSION DE LA STATION"
                  : "L’EXPLORATION DE CE MONDE SE PRÉPARE"}
            </span>
            {landing && (
              <button className="land-button mono" onClick={land}>
                <PlaneLanding size={13} /> ATTERRIR SUR{" "}
                {current.name.toUpperCase()}
              </button>
            )}
            <div className="orbit-actions">
              <button className="text-button" onClick={openMap}>
                CHANGER DE CAP <ArrowUpRight size={12} />
              </button>
              <button className="text-button" onClick={() => setArrived(false)}>
                POURSUIVRE LE VOL
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      <span className="sr-only" role="status">
        {droidSignal > 0 ? "L’astromécano vous salue." : ""}
      </span>
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
                  <dd>Visez une planète puis E, ou ouvrez la carte</dd>
                </div>
                <div>
                  <dt>Atterrir</dt>
                  <dd>
                    En orbite de Coruscant ou de Tatooine, bouton Atterrir ou E
                  </dd>
                </div>
                <div>
                  <dt>Marcher</dt>
                  <dd>
                    Au sol, flèches ou ZQSD (Maj pour courir), ou glisser à
                    gauche au doigt
                  </dd>
                </div>
                <div>
                  <dt>Regarder</dt>
                  <dd>Au sol, glisser à la souris, ou à droite au doigt</dd>
                </div>
                <div>
                  <dt>Fermer</dt>
                  <dd>Échap</dd>
                </div>
              </dl>
              <p className="help-audio-note">
                Activez le son pour entendre les moteurs, la sortie
                d’hyperespace et votre compagnon de bord.
              </p>
              <div className="help-actions">
                <button className="text-button" onClick={reset}>
                  <RotateCcw size={13} /> REVENIR AU DÉPART
                </button>
                <button className="text-button" onClick={replayArrival}>
                  REJOUER L’ARRIVÉE <Navigation size={12} />
                </button>
              </div>
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
