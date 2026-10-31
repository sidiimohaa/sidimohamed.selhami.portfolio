"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  Volume2,
  VolumeX,
  X,
  RotateCcw,
  Navigation,
  CircleHelp,
  Map,
  PlaneLanding,
  Briefcase,
} from "lucide-react";
import Preloader from "./Preloader";
import { createFlightAudio, type FlightAudio } from "./flightAudio";
import type { FlightTelemetry } from "./SpaceScene";
import type { HyperspacePhase } from "./spaceTraffic";
import type { SurfaceCue } from "./LandingScene";
const SpaceScene = dynamic(() => import("./SpaceScene"), { ssr: false });
const LandingScene = dynamic(() => import("./LandingScene"), { ssr: false });
const CockpitMap = dynamic(() => import("./CockpitMap"), { ssr: false });
import { destinations, landings, planetReferenceStyle } from "./universe";
import { addFlightTime, logDocking, logLanding, logOrbit } from "./flightLog";
import {
  getProgress,
  markRankCelebrated,
  onProgress,
  rankFor,
  ranks,
  unlockSecret,
  useJediProgression,
  type Mission,
  type MissionId,
  type Rank,
  OVERLAYS,
} from "./jediProgression";
import {
  ArchivesDossier,
  HyperspaceJump,
  ImperialTransmission,
  JediProgressWidget,
  RankUpCinematic,
  SecretDiscoveryToast,
} from "./jedi/JediOverlays";
const TempleRoom = dynamic(() => import("./jedi/TempleRoom"), { ssr: false });
const FinalVaderExperience = dynamic(() => import("./jedi/FinalVaderExperience"), { ssr: false });
const DeathStarStation = dynamic(() => import("./deathStar/DeathStarStation"), { ssr: false });

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
    [combat, setCombat] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    [sound, setSound] = useState(false),
    [travel, setTravel] = useState(false),
    [arrived, setArrived] = useState(false),
    [unsupported, setUnsupported] = useState(false),
    [resetKey, setResetKey] = useState(0),
    [droidSignal, setDroidSignal] = useState(0),
    [surface, setSurface] = useState<number | null>(null),
    // The Jedi progression's screens: toasts, rank ceremonies, mission scenes and rewards.
    [toasts, setToasts] = useState<{ mission: Mission; total: number }[]>([]),
    [ceremonies, setCeremonies] = useState<Rank[]>([]),
    [journalFirst, setJournalFirst] = useState(false),
    [reward, setReward] = useState<"temple" | "destiny" | null>(null),
    [jumping, setJumping] = useState(false),
    [transmission, setTransmission] = useState<"order-66" | "archives" | null>(null),
    // Inside the Death Star: the professional record, walked through or in Recruiter mode.
    [station, setStation] = useState<"explore" | "recruiter" | null>(null);
  const { progress } = useJediProgression();
  const audio = useRef<FlightAudio | null>(null),
    timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const current = destinations[destination],
    landing = landings[current.name],
    ground = surface !== null ? destinations[surface] : null,
    groundLanding = ground ? landings[ground.name] : undefined;
  const lastSix = useRef(0);
  const guidance = useRef<number | null>(null),
    approachProgress = useRef<HTMLElement>(null),
    arrivedRef = useRef(arrived);
  arrivedRef.current = arrived;
  // Holding the boost for four seconds of thrust breaks into hyperspace (mission 02).
  const boostSince = useRef<number | null>(null);
  const onFlight = useCallback((flight: FlightTelemetry) => {
    guidance.current = flight.target;
    if (flight.boost && flight.manual) {
      const now = performance.now();
      boostSince.current ??= now;
      if (now - boostSince.current > 4000) {
        boostSince.current = null;
        setJumping(true);
        audio.current?.jump();
      }
    } else boostSince.current = null;
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
  // Every unlock and rank change, wherever it happens, comes through the shared progression.
  useEffect(() => {
    const pending = getProgress(),
      reached = rankFor(pending.found.length);
    // A ceremony interrupted by a reload plays once more on the next visit.
    if (ranks.indexOf(reached) > ranks.findIndex((rank) => rank.id === pending.celebrated)) setCeremonies([reached]);
    return onProgress((event) => {
      if (event.type === "unlock") {
        setToasts((queue) => [...queue, { mission: event.mission, total: event.total }]);
        audio.current?.chime();
      } else setCeremonies((queue) => [...queue.filter((rank) => rank.id !== event.to.id), event.to]);
    });
  }, []);
  const dismissToast = useCallback(() => setToasts((queue) => queue.slice(1)), []);
  // The save happens outside the state update: a store write while React renders warns.
  const ceremonyQueue = useRef(ceremonies);
  ceremonyQueue.current = ceremonies;
  const finishCeremony = useCallback(() => {
    const done = ceremonyQueue.current[0];
    if (done) markRankCelebrated(done.id);
    setCeremonies((queue) => queue.slice(1));
  }, []);
  const finishJump = useCallback(() => {
    setJumping(false);
    unlockSecret("hyperspace");
  }, []);
  const closeTransmission = useCallback(() => setTransmission(null), []);
  const onSecret = useCallback((id: MissionId) => {
    unlockSecret(id);
    // The forgotten console opens its dossier as it is found.
    if (id === "forgotten-archives") setTransmission("archives");
  }, []);
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
  // The flight log: worlds reached in orbit, landings, and time spent flying with the page open.
  useEffect(() => {
    if (arrived) logOrbit(destinations[destination].name);
  }, [arrived, destination]);
  useEffect(() => {
    if (surface !== null) logLanding(destinations[surface].name);
  }, [surface]);
  useEffect(() => {
    if (loading) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) addFlightTime(15);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [loading]);
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
    else if (cue === "speeder-arrive" || cue === "speeder-leave") voice?.speeder(cue === "speeder-arrive" ? "arrive" : "leave");
  }, []);
  // The cantina band follows the visitor; kept so it resumes when sound is switched on.
  const heard = useRef({ level: 0, inside: false });
  const onSurfaceMusic = useCallback((level: number, inside: boolean) => {
    heard.current = { level, inside };
    audio.current?.cantina(level, inside);
  }, []);
  const soundscape = groundLanding?.soundscape ?? null;
  useEffect(() => {
    audio.current?.setEnabled(sound && !combat);
    audio.current?.ambience(sound && !combat ? soundscape : null);
  }, [soundscape, sound, combat]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.querySelector(".hoth-defense, .arcade-game, .arcade, .death-star-station")) { lastSix.current = 0; return; }
      // Escape is taken by an overlay or the mission journal first when one is open.
      if (e.key === "Escape" && !e.defaultPrevented && !document.querySelector(OVERLAYS)) {
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
        // In orbit of a world with a landing zone, E takes the ship down; at the Death Star, E docks.
        if (arrivedRef.current && landing && aimed === destination) land();
        else if (arrivedRef.current && destination === 3 && aimed === destination) enterStation("explore");
        else launch(aimed);
      }
      if (e.key === "Shift") setBoost(true);
      // Typing the two sixes of the order opens an Imperial transmission (mission 08).
      // The physical 6 key, so it works with or without Shift on any keyboard layout.
      const six = e.key === "6" || e.code === "Digit6" || e.code === "Numpad6";
      if (six && !e.repeat && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        const now = performance.now();
        if (now - lastSix.current < 1200) {
          lastSix.current = 0;
          setTransmission("order-66");
          unlockSecret("order-66");
        } else lastSix.current = now;
      }
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
    if (!helpOpen) return;
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
  }, [helpOpen]);
  const toggleSound = () => {
    if (typeof AudioContext === "undefined") return;
    if (!audio.current) {
      audio.current = createFlightAudio();
      audio.current.cantina(heard.current.level, heard.current.inside);
    }
    const enabled = !sound;
    audio.current.setEnabled(enabled && !combat);
    setSound(enabled);
  };
  const openMap = (journal = false) => {
    setJournalFirst(journal);
    timers.current.forEach(clearTimeout);
    setTravel(false);
    setArrived(false);
    setHelpOpen(false);
    audio.current?.flight({ throttle: 0, boost: false });
    audio.current?.chime();
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
  const enterStation = (start: "explore" | "recruiter") => {
    timers.current.forEach(clearTimeout);
    setHelpOpen(false);
    setBoost(false);
    setCombat(true);
    setStation(start);
    if (start === "explore") logDocking();
  };
  const leaveStation = () => {
    setStation(null);
    setCombat(false);
    setArrived(true);
  };
  const replayArrival = () => {
    reset();
    setLoading(true);
  };
  const cancelApproach = () => {
    timers.current.forEach(clearTimeout);
    setTravel(false);
  };
  const paused = loading || mapOpen || helpOpen || surface !== null || reward !== null || station !== null;
  return (
    <main
      aria-busy={loading}
      data-side={progress.sith ? "sith" : "light"}
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
          hidden: surface !== null || mapOpen || station !== null,
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
          paused={mapOpen || helpOpen || reward !== null}
          hidden={mapOpen || reward !== null}
          onCue={onSurfaceCue}
          onMusic={onSurfaceMusic}
          onSecret={onSecret}
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
      <header
        className="header"
        inert={loading || mapOpen || station !== null}
        style={mapOpen || station ? { visibility: "hidden" } : undefined}
      >
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
          <JediProgressWidget onOpenJournal={() => openMap(true)} hidden={loading} />
          <button
            className="map-trigger"
            onClick={() => openMap()}
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
          <CockpitMap
            onCombatChange={setCombat}
            initialSelection={destination}
            reduced={reduced}
            sound={sound}
            onToggleSound={toggleSound}
            onSelectionCue={() => audio.current?.chime()}
            onClose={() => setMapOpen(false)}
            onLaunch={launch}
            initialJournal={journalFirst}
            onExperience={(experience) => {
              setMapOpen(false);
              setReward(experience);
            }}
          />
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
            <div className="transmission-identity">
              <div
                className="transmission-portrait"
                style={planetReferenceStyle(current)}
                role="img"
                aria-label={current.name}
              />
              <div>
                <span className="transmission-channel mono">
                  TRANSMISSION REÇUE
                </span>
                <h2 id="orbit-title">{current.name}</h2>
              </div>
            </div>
            <p>{current.description}</p>
            <span className="orbit-note mono">
              {landing
                ? "ZONE D’ATTERRISSAGE DÉGAGÉE · E POUR ATTERRIR"
                : destination === 3
                  ? "BAIE D’ARRIMAGE OUVERTE · E POUR ACCOSTER"
                  : "L’EXPLORATION DE CE MONDE SE PRÉPARE"}
            </span>
            {destination === 3 && (
              <div className="station-actions">
                <button className="land-button mono" onClick={() => enterStation("explore")}>
                  <PlaneLanding size={13} /> ACCOSTER LA STATION
                </button>
                <button className="land-button mono recruiter" onClick={() => enterStation("recruiter")}>
                  <Briefcase size={13} /> MODE RECRUTEUR
                </button>
              </div>
            )}
            {landing && (
              <button className="land-button mono" onClick={land}>
                <PlaneLanding size={13} /> ATTERRIR SUR{" "}
                {current.name.toUpperCase()}
              </button>
            )}
            <div className="orbit-actions">
              <button className="text-button" onClick={() => openMap()}>
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
      <AnimatePresence>
        {jumping && <HyperspaceJump key="jump" reduced={reduced} onDone={finishJump} />}
      </AnimatePresence>
      <AnimatePresence>
        {transmission === "order-66" && <ImperialTransmission key="order" onClose={closeTransmission} reduced={reduced} />}
        {transmission === "archives" && <ArchivesDossier key="archives" onClose={closeTransmission} />}
      </AnimatePresence>
      <AnimatePresence>
        {reward === "temple" && <TempleRoom key="temple" reduced={reduced} onClose={() => setReward(null)} />}
        {reward === "destiny" && <FinalVaderExperience key="destiny" reduced={reduced} sound={sound} onClose={() => setReward(null)} />}
      </AnimatePresence>
      {station && <DeathStarStation key="station" start={station} reduced={reduced} sound={sound} onClose={leaveStation} />}
      <div className="jedi-toasts">
        <AnimatePresence>
          {toasts[0] && !combat && <SecretDiscoveryToast key={toasts[0].mission.id} mission={toasts[0].mission} total={toasts[0].total} reduced={reduced} onDone={dismissToast} />}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {ceremonies[0] && !loading && !combat && <RankUpCinematic key={ceremonies[0].id} to={ceremonies[0]} reduced={reduced} onDone={finishCeremony} />}
      </AnimatePresence>
      {unsupported && (
        <div className="webgl-note mono">
          MODE VISUEL SIMPLIFIÉ — LA NAVIGATION RESTE DISPONIBLE
        </div>
      )}
    </main>
  );
}
