"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Volume2,
  VolumeX,
  Plus,
  X,
  ChevronRight,
  RotateCcw,
  MoveUp,
  MoveDown,
  MoveLeft,
  MoveRight,
  Navigation,
  Check,
} from "lucide-react";
import Preloader from "./Preloader";
const SpaceScene = dynamic(() => import("./SpaceScene"), { ssr: false });
const destinations = [
  {
    name: "Tatooine",
    category: "Les projets",
    tag: "CRÉATION & EXPLORATION",
    number: "01",
    color: "#bb9573",
    className: "sand",
    description:
      "Des idées qui prennent forme. Des expériences qui ouvrent de nouveaux horizons.",
    coordinates: "23.42 / 06.18",
    distance: "12 400",
  },
  {
    name: "Endor",
    category: "Les passions",
    tag: "CURIOSITÉ & INSPIRATION",
    number: "02",
    color: "#96aa8c",
    className: "forest",
    description:
      "Ce qui m’anime, m’inspire et nourrit chaque nouvelle aventure.",
    coordinates: "08.71 / 42.06",
    distance: "8 200",
  },
  {
    name: "Coruscant",
    category: "Le contact",
    tag: "RENCONTRES & CONNEXIONS",
    number: "03",
    color: "#aaaebd",
    className: "city",
    description:
      "Toutes les grandes aventures commencent par une première connexion.",
    coordinates: "00.00 / 00.00",
    distance: "21 700",
  },
];
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
    [flying, setFlying] = useState(false),
    [boost, setBoost] = useState(false),
    [destination, setDestination] = useState(0),
    [mapOpen, setMapOpen] = useState(false),
    [aboutOpen, setAboutOpen] = useState(false),
    [sound, setSound] = useState(false),
    [travel, setTravel] = useState(false),
    [arrived, setArrived] = useState(false),
    [unsupported, setUnsupported] = useState(false),
    [distance, setDistance] = useState(12400),
    [copied, setCopied] = useState(false);
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
  useEffect(() => {
    if (!flying) return;
    const id = setInterval(
      () => setDistance((d) => Math.max(320, d - (boost ? 34 : 3))),
      150,
    );
    return () => clearInterval(id);
  }, [flying, boost]);
  const launch = useCallback(
    (index: number) => {
      timers.current.forEach(clearTimeout);
      setDestination(index);
      setDistance(Number(destinations[index].distance.replace(/ /g, "")));
      setMapOpen(false);
      setArrived(false);
      setFlying(true);
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
        setAboutOpen(false);
        setArrived(false);
        setTravel(false);
      }
      if (
        e.key.toLowerCase() === "e" &&
        flying &&
        !travel &&
        !mapOpen &&
        !aboutOpen &&
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
  }, [flying, destination, travel, mapOpen, aboutOpen, arrived, launch]);
  useEffect(() => {
    if (!mapOpen && !aboutOpen && !arrived) return;
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
  }, [mapOpen, aboutOpen, arrived]);
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
  const changeDestination = (dir: number) => {
    setDestination((d) => {
      const next = (d + dir + 3) % 3;
      setDistance(Number(destinations[next].distance.replace(/ /g, "")));
      return next;
    });
  };
  const reset = () => {
    timers.current.forEach(clearTimeout);
    setFlying(false);
    setTravel(false);
    setArrived(false);
    setBoost(false);
    setDestination(0);
    setDistance(12400);
  };
  const mobileDirection = (key: string, pressed: boolean) => {
    window.dispatchEvent(
      new KeyboardEvent(pressed ? "keydown" : "keyup", { key, bubbles: true }),
    );
  };
  return (
    <main
      aria-busy={loading}
      className={`experience ${flying ? "is-flying" : ""} ${travel ? "is-travelling" : ""}`}
    >
      <div className="space-haze" />
      <div className="star-backup" />
      {unsupported && <div className="fallback-planet" />}
      <SpaceScene
        state={{ flying, boost, destination, travel, reduced }}
        onReady={onReady}
        onUnsupported={onUnsupported}
      />
      <div className="vignette" />
      <div className="grain" />
      <AnimatePresence>
        {loading && <Preloader progress={progress} reduced={reduced} />}
      </AnimatePresence>
      <header className="header">
        <button
          className="brand"
          onClick={reset}
          aria-label="Orbital, revenir au départ"
        >
          <OrbitalLogo />
          <span>
            ORBITAL<sup>®</sup>
            <small>UN PORTFOLIO À EXPLORER</small>
          </span>
        </button>
        <nav aria-label="Navigation principale">
          <button
            className={!mapOpen ? "nav-link active" : "nav-link"}
            onClick={() => {
              setMapOpen(false);
              reset();
            }}
          >
            L’EXPÉRIENCE<span>01</span>
          </button>
          <button
            className={mapOpen ? "nav-link active" : "nav-link"}
            onClick={openMap}
          >
            CARTE STELLAIRE<span>02</span>
          </button>
        </nav>
        <div className="header-right">
          <span className="system-status">
            <i /> SYSTÈMES EN LIGNE
          </span>
          <button
            className={`sound-button ${sound ? "on" : ""}`}
            aria-label={
              sound ? "Couper l’ambiance sonore" : "Activer l’ambiance sonore"
            }
            aria-pressed={sound}
            onClick={toggleSound}
          >
            {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
        </div>
      </header>
      <div className="edge-label mono">SECTEUR 07 — BORDURE EXTÉRIEURE</div>
      <AnimatePresence mode="wait">
        {!flying ? (
          <motion.section
            className="hero"
            key="intro"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: loading ? 0 : 1, y: loading ? 25 : 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.8 }}
          >
            <p className="eyebrow">
              <span className="little-star">✳</span> L’AVENTURE COMMENCE ICI
            </p>
            <h1>
              CHAQUE IDÉE
              <br />
              EST UN NOUVEL
              <br />
              <span>UNIVERS.</span>
              <span className="heading-star">✳</span>
            </h1>
            <p className="hero-description">
              Création, exploration et un peu de poussière d’étoiles.
              <br />
              Bienvenue dans mon univers. À vous de le découvrir.
            </p>
            <button className="primary-cta" onClick={() => setFlying(true)}>
              <span>PRENDRE LES COMMANDES</span>
              <ArrowUpRight size={20} />
            </button>
            <p className="cta-note mono">
              <i /> AUCUN PERMIS INTERGALACTIQUE REQUIS
            </p>
          </motion.section>
        ) : (
          <motion.section
            key="flight"
            className="flight-heading"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <p className="eyebrow">
              <i className="live-dot" /> MODE EXPLORATION
            </p>
            <h1>
              À VOUS
              <br />
              L’UNIVERS.
            </h1>
            <p>
              Choisissez votre planète.
              <br />
              Laissez la curiosité vous guider.
            </p>
            <button className="text-button" onClick={reset}>
              <RotateCcw size={13} /> REVENIR AU POINT DE DÉPART
            </button>
          </motion.section>
        )}
      </AnimatePresence>
      <div className="planet-tag planet-tag-main">
        <span className="tag-node" />
        <div>
          <span className="mono">01 / TERRITOIRE CRÉATIF</span>
          <button onClick={() => launch(0)}>
            TATOOINE <ArrowUpRight size={12} />
          </button>
        </div>
      </div>
      <button
        className="planet-tag planet-tag-secondary"
        onClick={() => launch(1)}
      >
        <span className="tag-node" />
        <span>
          <span className="mono">02 / LES PASSIONS</span>
          <strong>
            ENDOR <ArrowUpRight size={11} />
          </strong>
        </span>
      </button>
      <div className="reticle" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <span>+</span>
      </div>
      <div className="coordinates mono">
        <Plus size={10} />
        <span>
          X {flying ? (23.42 - distance / 10000).toFixed(2) : "23.42"}
          <br />Y 06.18
          <br />Z 91.07
        </span>
      </div>
      <div className="ship-label mono">
        <span className="label-line" />
        <span>
          VOTRE VAISSEAU
          <br />
          <b>EXPLORER — X.01</b>
        </span>
      </div>
      <div className="sector-scale" aria-hidden="true">
        <span>+ 90</span>
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <span>− 90</span>
      </div>
      <div className="bottom-dashboard">
        <div className="flight-controls">
          <span className="mini-label mono">
            {flying ? "PILOTAGE MANUEL" : "PRÊT POUR LE DÉCOLLAGE"}
          </span>
          <div className="control-row">
            <div className="key-cluster" aria-hidden="true">
              <kbd>↑</kbd>
              <div>
                <kbd>←</kbd>
                <kbd>↓</kbd>
                <kbd>→</kbd>
              </div>
            </div>
            <p>
              {flying
                ? "Flèches ou ZQSD pour piloter"
                : "Un vaisseau. Mille possibilités."}
              <span>
                {flying
                  ? "Glissez pour diriger · Maj pour accélérer"
                  : "Prenez les commandes pour explorer."}
              </span>
            </p>
          </div>
        </div>
        <div className="dashboard-middle">
          <span className="mini-label mono">
            {flying ? "VITESSE DE CROISIÈRE" : "AU-DELÀ DES PIXELS"}
          </span>
          <span className="explore-word">
            {flying ? (
              <>
                <b>{boost ? "1 280" : "240"}</b> <small>KM / S</small>
              </>
            ) : (
              <>
                L’imagination pour seule limite.
                <span className="small-orbit">✳</span>
              </>
            )}
          </span>
          <div className="speed-bars" aria-hidden="true">
            {Array.from({ length: 32 }, (_, i) => (
              <i
                key={i}
                className={i < (flying ? (boost ? 32 : 17) : 6) ? "lit" : ""}
              />
            ))}
          </div>
        </div>
        <div className="destination-card">
          <div className="destination-heading mono">
            <span>PROCHAINE DESTINATION</span>
            <span>{current.number} / 03</span>
          </div>
          <div className="destination-row">
            <button
              className="destination-name"
              onClick={() => launch(destination)}
            >
              <span>{current.name.toUpperCase()}</span>
              <small>
                {current.category} <ArrowUpRight size={12} />
              </small>
            </button>
            <div className={`mini-planet ${current.className}`} />
            <div className="destination-arrows">
              <button
                onClick={() => changeDestination(-1)}
                aria-label="Destination précédente"
              >
                <ArrowLeft size={15} />
              </button>
              <button
                onClick={() => changeDestination(1)}
                aria-label="Destination suivante"
              >
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
      <footer className="footer mono">
        <span>
          © {new Date().getFullYear()} ORBITAL
          <span className="footer-separator">/</span> PORTFOLIO INTERACTIF
        </span>
        <button onClick={() => setAboutOpen(true)}>
          À PROPOS DE CET UNIVERS <Plus size={12} />
        </button>
        <span className="footer-end">
          CONÇU SUR TERRE <span className="little-star">✳</span>
        </span>
      </footer>
      {flying && !travel && (
        <div className="mobile-steering" aria-label="Commandes tactiles">
          {[
            ["ArrowLeft", MoveLeft],
            ["ArrowUp", MoveUp],
            ["ArrowDown", MoveDown],
            ["ArrowRight", MoveRight],
          ].map(([key, Icon]) => {
            const I = Icon as typeof MoveLeft;
            return (
              <button
                key={key as string}
                aria-label={`Piloter ${key}`}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  mobileDirection(key as string, true);
                }}
                onPointerUp={() => mobileDirection(key as string, false)}
                onPointerCancel={() => mobileDirection(key as string, false)}
              >
                <I size={18} />
              </button>
            );
          })}
        </div>
      )}
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
              <p className="eyebrow">TROIS MONDES. UN MÊME UNIVERS.</p>
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
                  Ce monde est encore en formation.
                  <br />
                  Son histoire s’écrira bientôt.
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
        {aboutOpen && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAboutOpen(false)}
          >
            <motion.section
              className="about modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="about-title"
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-top mono">
                <span>TRANSMISSION / ORIGINE TERRE</span>
                <button
                  className="close-button"
                  aria-label="Fermer à propos"
                  onClick={() => setAboutOpen(false)}
                >
                  <X size={20} />
                </button>
              </div>
              <OrbitalLogo />
              <p className="eyebrow">LE PORTFOLIO DEVIENT UN VOYAGE</p>
              <h2 id="about-title">
                LA CURIOSITÉ
                <br />
                COMME BOUSSOLE.
              </h2>
              <p>
                ORBITAL est un terrain d’exploration personnel, inspiré des
                galaxies de Star Wars. Chaque planète accueillera une facette de
                mon univers : mes projets, mes passions, et les rencontres à
                venir.
              </p>
              <p>
                Pour l’instant, place au voyage. Prenez les commandes, suivez
                les signaux et profitez de la vue.
              </p>
              <div className="about-tech mono">
                NEXT.JS · REACT · THREE.JS · MOTION
                <br />
                TAILWIND CSS · LOTTIE · LUCIDE
              </div>
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href);
                    setCopied(true);
                    timers.current.push(
                      setTimeout(() => setCopied(false), 2000),
                    );
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? <Check size={14} /> : <Plus size={14} />}{" "}
                {copied
                  ? "COORDONNÉES COPIÉES"
                  : "COPIER LES COORDONNÉES DE CET UNIVERS"}
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
