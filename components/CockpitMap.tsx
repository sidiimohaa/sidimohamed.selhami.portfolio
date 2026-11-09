"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { createFlightLogConsole } from "./flightLogConsole";
import { FlightLogPanel } from "./FlightLogPanel";
import { setMonitorOpen } from "./galaxy/store";
import { useFlightLog } from "./flightLog";
import type { HothDefenseRuntime } from "./hothDefense/runtime";
import type { DefenseView } from "./hothDefense/types";
import defenseStyles from "./hothDefense/CockpitDefense.module.css";
const HothDefenseHUD = dynamic(() => import("./hothDefense/HothDefenseHUD"), { ssr: false });
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  Gamepad2,
  MapPin,
  Navigation,
  Orbit,
  Volume2,
  VolumeX,
  X,
  Radar,
} from "lucide-react";
import * as THREE from "three";
import { createCockpitGrogu } from "./cockpitGrogu";
import { createDroidVoice } from "./droid/droidSounds";
import { createCockpitModel } from "./cockpitModel";
import { MUSTAFAR } from "./cockpitProjection";
import { createCockpitSystems } from "./cockpitSystems";
import { createCockpitProjection } from "./cockpitProjection";
import { createMissionConsole } from "./cockpitMissionConsole";
import { createCockpitKonami, SUPERCLUSTERS, type Supercluster, type WarpPhase } from "./cockpitKonami";
import { CockpitMissionTerminal } from "./jedi/JediArchives";
import { holoMatrix } from "./jedi/holoProjection";
import { missions, OVERLAYS, setSithMode, startMission, unlockSecret, useJediProgression } from "./jediProgression";
import { createStarfield } from "./spaceAmbience";
import { destinations, landings, planetReferenceStyle } from "./universe";
import { createArcadeConsole } from "./arcade/arcadeConsole3D";
import { ArcadeHologram } from "./arcade/ArcadeHologram";
import { createArcadeAudio, type ArcadeAudio } from "./arcade/arcadeAudio";
import { equippedValue, recordResult, useArcade, type GameResult, type ResultSummary } from "./arcade/arcadeStore";
import { gameById, type ArcadeGameId } from "./arcade/catalog";
import type { PodResult } from "./podracing/types";
import type { CockpitGameKind, CockpitGameRuntime, CockpitGameView } from "./arcade/cockpitGames";
const ArcadeGameHUD = dynamic(() => import("./arcade/ArcadeGameHUD"), { ssr: false });
const ImperialHacking = dynamic(() => import("./arcade/ImperialHacking"), { ssr: false });
const SpeederRace = dynamic(() => import("./arcade/SpeederRace"), { ssr: false });
const PodRacing = dynamic(() => import("./podracing/PodRacing"), { ssr: false });

function recordPodResult(result: PodResult) {
  const won = result.finished && result.position === 1 && result.standings.length > 1;
  recordResult({
    gameId: "podracing",
    score: Math.round(result.topSpeed * 3.6 + result.miniTurbos * 30 + result.shortcuts * 60 + result.nearMisses * 15 + (won ? 500 : 0)),
    won,
    perfect: won && result.crashes === 0,
    seconds: Math.round(result.time),
  });
}

type Props = {
  initialSelection: number;
  reduced: boolean;
  sound: boolean;
  onToggleSound: () => void;
  onSelectionCue: () => void;
  onClose: () => void;
  onLaunch: (index: number) => void;
  // Open straight onto the mission journal (from the progression widget).
  initialJournal?: boolean;
  onCombatChange?: (active: boolean) => void;
  onExperience: (experience: "temple" | "destiny") => void;
  onLandMustafar: () => void;
};

// What R-X7 shouts when the hidden code sets off the red alert: a different line each time.
const ALERT_LINES = [
  "BIP-BIIIP ! Séquence non autorisée sur la console de vol ! Le motivateur d’hyperpropulsion s’emballe tout seul, accrochez-vous !",
  "Bou-ouiiip ! Qui a touché au manche ? Les coordonnées du saut ne figurent sur aucune carte de la galaxie !",
  "BIP BIP BIP ! Le calculateur de navigation vient de viser au-delà de la galaxie. Je ne peux plus l’arrêter !",
  "Vrrr… bip ?! Un vieux code d’essai des ingénieurs d’Incom vient de se réveiller. Saut hyperspatial imminent !",
  "BIIIP ! Toutes les lumières sont rouges, même celles que je ne connaissais pas ! Bouclez votre harnais, pilote !",
];

// Where the lever was left, for the rest of the visit.
let hologramOnThisVisit = true;
// The worlds the pilot has already asked the hologram about, during this visit.
const consultedWorlds = new Set<number>();

// The hidden world, on the piece of the map that R-X7 has been keeping. It is not a destination of
// the flight: its only way in is the fortress, once all ten secrets have been found.
const PIECE_KEY = "orbital-galaxy-piece-v1";
const PIECE_SECONDS = 3.4;
const pieceAlreadyShown = () => {
  try {
    return localStorage.getItem(PIECE_KEY) === "1";
  } catch {
    return false;
  }
};
const mustafar = {
  name: "Mustafar",
  label: "Mustafar",
  number: "??",
  category: "La destinée",
  description: "Absente de toutes les cartes de l’Empire, une planète de feu où une forteresse domine les rivières de lave. Celui qui vous y attend sait que vous avez tout découvert.",
  style: { backgroundImage: "radial-gradient(circle at 38% 32%, #ffc27a, #d2401b 38%, #3a0d07 74%, #120403)", backgroundSize: "100% 100%" },
};

export default function CockpitMap({
  initialSelection,
  reduced,
  sound,
  onToggleSound,
  onSelectionCue,
  onClose,
  onLaunch,
  initialJournal = false,
  onExperience,
  onLandMustafar,
  onCombatChange,
}: Props) {
  const [selected, setSelected] = useState(initialSelection);
  useEffect(() => {
    consultedWorlds.add(initialSelection);
  }, [initialSelection]);
  const [graphics, setGraphics] = useState(false);
  const { progress } = useJediProgression();
  const [journal, setJournal] = useState(initialJournal);
  const [coverOpen, setCoverOpen] = useState(false);
  const [defense, setDefense] = useState(false), [defenseLoading, setDefenseLoading] = useState(false);
  const [defenseError, setDefenseError] = useState<string | null>(null);
  const [defenseView, setDefenseView] = useState<DefenseView | null>(null);
  const [defenseVolume, setDefenseVolume] = useState(.55);
  // The flight log, on the centre console where the training switch used to be.
  const [flightLog, setFlightLog] = useState(false);
  const logButton = useRef<HTMLButtonElement>(null);
  const logScreen = useRef<HTMLElement>(null);
  const logApi = useRef<ReturnType<typeof createFlightLogConsole> | null>(null);
  const log = useFlightLog();
  const defenseRuntime = useRef<HothDefenseRuntime | null>(null);
  const defenseRequest = useRef(0);
  const defenseApi = useRef<{ load: () => Promise<void>; stop: () => void } | null>(null);
  // Galactic Arcade: the console hologram, the simulation being played and its last result.
  const { data: arcadeData } = useArcade();
  const [arcade, setArcade] = useState(false);
  const [arcadeGame, setArcadeGame] = useState<ArcadeGameId | null>(null);
  const [arcadeResult, setArcadeResult] = useState<ResultSummary | null>(null);
  const [gameView, setGameView] = useState<CockpitGameView | null>(null);
  const [gameLoading, setGameLoading] = useState(false);
  const [gameError, setGameError] = useState<string | null>(null);
  const [arcadeToast, setArcadeToast] = useState<ResultSummary["achievements"] | null>(null);
  const arcadeButton = useRef<HTMLButtonElement>(null);
  const arcadeScreen = useRef<HTMLElement>(null);
  const arcadeAudio = useRef<ArcadeAudio | null>(null);
  const gameRuntime = useRef<CockpitGameRuntime | null>(null);
  const arcadeApi = useRef<{ load: (kind: CockpitGameKind) => Promise<void>; stop: () => void; press: () => void; hover: (on: boolean) => void } | null>(null);
  const defenseFromArcade = useRef(false);
  const finishTimer = useRef(0);
  const toastTimer = useRef(0);
  const holoColor = equippedValue(arcadeData, "holo"),
    accent = equippedValue(arcadeData, "accent"),
    trail = equippedValue(arcadeData, "engine");
  // Narrow screens get the journal as a flat panel; wide ones get it as a hologram in the cockpit.
  const [compact, setCompact] = useState(false);
  const journalButton = useRef<HTMLButtonElement>(null);
  const guardButton = useRef<HTMLButtonElement>(null);
  const groguButton = useRef<HTMLButtonElement>(null);
  const groguApi = useRef<ReturnType<typeof createCockpitGrogu> | null>(null);
  const [groguHolds, setGroguHolds] = useState(false);
  // The hidden code (↑ ↑ ↓ ↓ ← → ← → B A): red alert, then a jump to another galaxy.
  const [warp, setWarp] = useState<WarpPhase>("idle");
  const [warpTo, setWarpTo] = useState<Supercluster>(SUPERCLUSTERS[0]);
  const [alertLine, setAlertLine] = useState(ALERT_LINES[0]);
  const konamiApi = useRef<ReturnType<typeof createCockpitKonami> | null>(null);
  const warpAlert = useRef<HTMLDivElement>(null);
  const warpFlash = useRef<HTMLDivElement>(null);
  const leverButton = useRef<HTMLButtonElement>(null);
  const leverSound = useRef<() => void>(() => undefined);
  const [hologram, setHologram] = useState(hologramOnThisVisit);
  const holoShown = hologram && !groguHolds;
  const holoLive = useRef({ on: hologram, shown: holoShown });
  holoLive.current = { on: hologram, shown: holoShown };
  const terminal = useRef<HTMLElement>(null);
  const controlsApi = useRef<ReturnType<typeof createMissionConsole> | null>(null);
  const mount = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const markers = useRef<(HTMLButtonElement | null)[]>([]);
  const onGameFinish = useRef<(result: GameResult) => void>(() => undefined);
  const live = useRef({ selected, reduced, onClose, journal, progress, coverOpen, compact, defense, defenseView, sound, defenseVolume, onCombatChange, arcade, arcadeGame, holoColor, accent, trail, flightLog });
  live.current = { selected, reduced, onClose, journal, progress, coverOpen, compact, defense, defenseView, sound, defenseVolume, onCombatChange, arcade, arcadeGame, holoColor, accent, trail, flightLog };
  const closeJournal = () => {
    setJournal(false);
    requestAnimationFrame(() => journalButton.current?.focus());
  };
  const closeRef = useRef(closeJournal);
  closeRef.current = closeJournal;
  const closeArcade = () => {
    arcadeAudio.current?.ui("back");
    setArcade(false);
    setArcadeResult(null);
    requestAnimationFrame(() => (arcadeButton.current ?? close.current)?.focus());
  };
  const closeArcadeRef = useRef(closeArcade);
  closeArcadeRef.current = closeArcade;
  const closeFlightLog = () => {
    setFlightLog(false);
    requestAnimationFrame(() => (logButton.current ?? close.current)?.focus());
  };
  const closeLogRef = useRef(closeFlightLog);
  closeLogRef.current = closeFlightLog;

  const onMustafar = selected === MUSTAFAR;
  const current = onMustafar ? null : destinations[selected];
  const accessibleSurface = !!current && !!landings[current.name];
  // All ten secrets found: R-X7 projects the last piece of the map, once, and Mustafar is on it.
  const allFound = progress.found.length >= missions.length;
  const [pieceState, setPieceState] = useState<"none" | "projecting" | "placed">("none");
  const pieceJustLanded = useRef(false);
  const pieceLive = useRef(pieceState);
  pieceLive.current = pieceState;
  const fragments = missions.map((mission) => progress.found.includes(mission.id));
  const fragmentsLive = useRef(fragments);
  fragmentsLive.current = fragments;
  const worlds = pieceState === "placed" ? destinations.length + 1 : destinations.length;
  // The moment the piece lands, the view goes to the world on it.
  useEffect(() => {
    if (pieceState === "placed" && pieceJustLanded.current) {
      pieceJustLanded.current = false;
      setSelected(MUSTAFAR);
    }
    if (pieceState === "projecting") pieceJustLanded.current = true;
  }, [pieceState]);
  useEffect(() => {
    if (!allFound) return;
    if (pieceAlreadyShown() || reduced) {
      setPieceState("placed");
      return;
    }
    const start = window.setTimeout(() => setPieceState("projecting"), 1800);
    return () => window.clearTimeout(start);
  }, [allFound, reduced]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (live.current.defense || live.current.arcadeGame) {
        if (event.key !== "Tab") return;
      }
      if (event.key === "Escape") {
        if (document.querySelector(OVERLAYS)) return;
        event.preventDefault();
        if (live.current.flightLog) closeLogRef.current();
        else if (live.current.arcade) closeArcadeRef.current();
        else if (live.current.journal) closeRef.current();
        else live.current.onClose();
      }
      if (event.key !== "Tab") return;
      // While the journal is open, focus stays inside it.
      const scope = live.current.defense
        ? dialog.current?.querySelector<HTMLElement>(".hoth-defense")
        : live.current.arcadeGame
          ? dialog.current?.querySelector<HTMLElement>(".arcade-game")
          : live.current.flightLog && logScreen.current
            ? logScreen.current
            : live.current.arcade && arcadeScreen.current
            ? arcadeScreen.current
            : live.current.journal && terminal.current
              ? terminal.current
              : dialog.current;
      const elements = Array.from(
        scope?.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([tabindex="-1"]),a[href],input:not([disabled]),[tabindex="0"]',
        ) ?? [],
      ).filter(element => element.getClientRects().length > 0 && !element.closest("[inert]"));
      const first = elements[0],
        last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    // Capture, so the journal answers Escape before the experience closes the whole map.
    window.addEventListener("keydown", keyboard, true);
    return () => {
      window.removeEventListener("keydown", keyboard, true);
      const target =
        previous?.isConnected &&
        previous !== document.body &&
        !previous.closest("[inert]")
          ? previous
          : document.querySelector<HTMLButtonElement>(".map-trigger");
      target?.focus();
    };
  }, []);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, window.innerWidth < 600 ? 1.75 : 2),
    );
    renderer.setClearColor(0x03080e, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.setAttribute("aria-hidden", "true");
    el.append(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, 1, 0.05, 600);
    const cockpit = createCockpitModel();
    const systems = createCockpitSystems();
    cockpit.add(systems.group);
    const projection = createCockpitProjection();
    // Switched off until the lever strikes it: the projection's own power starts at 1.
    projection.setPower(0);
    const stars = createStarfield(renderer.getPixelRatio());
    const pilotEye = new THREE.Vector3(0, 1.55, 2.9);
    const logConsole = createFlightLogConsole(pilotEye);
    logApi.current = logConsole;
    scene.add(logConsole.group);
    const arcadeConsole = createArcadeConsole(pilotEye);
    scene.add(arcadeConsole.group);
    const controls = createMissionConsole(pilotEye);
    controlsApi.current = controls;
    scene.add(cockpit, projection.group, stars.points, controls.group);
    // A fan of light from the journal module up to the holographic screen while it is open.
    const beamGeometry = new THREE.BufferGeometry();
    beamGeometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    beamGeometry.setIndex([0, 1, 2, 1, 3, 2]);
    const beam = new THREE.Mesh(
      beamGeometry,
      new THREE.MeshBasicMaterial({ color: 0x4aaaf4, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    );
    beam.frustumCulled = false;
    scene.add(beam);
    // What the metal reflects: a dark hold with the bright canopy ahead and overhead, a warm
    // instrument glow low on the left and a cold strip on the right, for crisp, contrasted highlights.
    const studio = new THREE.Scene();
    studio.add(new THREE.Mesh(new THREE.SphereGeometry(20, 24, 12), new THREE.MeshBasicMaterial({ color: 0x06090d, side: THREE.BackSide })));
    for (const [w, h, x, y, z, color, power] of [
      [16, 8, 0, 6, -10, 0x9fb8d8, 2.2],
      [12, 2, 0, 12, 0, 0xdfe8f0, 3],
      [3, 1.2, -9, 0.5, 1, 0xff9a4a, 2.4],
      [1, 7, 9, 3, 0, 0x7fb0d8, 2.6],
      [6, 1, 0, -2, 9, 0x2a3440, 1],
    ] as const) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide }));
      panel.position.set(x, y, z);
      panel.lookAt(0, 0, 0);
      studio.add(panel);
    }
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(studio, 0.02, 0.1, 50);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.55;
    studio.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    });
    pmrem.dispose();
    const sky = new THREE.HemisphereLight(0x8da9c9, 0x151b26, 1.5);
    scene.add(sky);
    const key = new THREE.DirectionalLight(0xd3c4ad, 2.6);
    key.position.set(-2, 4, 4);
    scene.add(key);
    const projectorLight = new THREE.PointLight(0x47ccff, 8, 8, 2);
    projectorLight.position.set(0, 1.1, -2.03);
    scene.add(projectorLight);
    const amber = new THREE.PointLight(0xff7b35, 2.5, 5, 2);
    amber.position.set(-1.6, 0.8, 0.3);
    scene.add(amber);
    const grogu = createCockpitGrogu();
    groguApi.current = grogu;
    scene.add(grogu.group);
    const droidVoice = createDroidVoice();
    // R-X7 sounds the alarm before the alarm does, and has something to say on arrival.
    const droidTimers: number[] = [];
    const konami = createCockpitKonami(renderer.getPixelRatio(), (phase, destination) => {
      setWarp(phase);
      setWarpTo(destination);
      if (phase === "alert") setAlertLine(ALERT_LINES[Math.floor(Math.random() * ALERT_LINES.length)]);
      if (!live.current.sound) return;
      if (phase === "alert") {
        droidVoice.play("error");
        droidTimers.push(window.setTimeout(() => droidVoice.play("chirp"), 700), window.setTimeout(() => droidVoice.play("error"), 1600));
      }
      if (phase === "arrived") droidTimers.push(window.setTimeout(() => droidVoice.play("think"), 1400));
    });
    konami.setSound(live.current.sound);
    konamiApi.current = konami;
    scene.add(konami.group);
    let pieceAmount = 0,
      pieceDone = false;
    let jolt = 0,
      holoFold = 0,
      holoStarted = false;
    const leverVoice = droidVoice;
    leverSound.current = () => {
      if (live.current.sound) leverVoice.play("servo");
    };
    if (process.env.NODE_ENV !== "production") (window as unknown as { __cockpitGrogu?: unknown }).__cockpitGrogu = grogu;
    const fill = new THREE.PointLight(0x709cc6, 5, 7, 2);
    fill.position.set(1.6, 2.2, 1.4);
    scene.add(fill);
    let generation = 0, removed = false;
    const stopDefense = () => {
      generation++;
      defenseRuntime.current?.dispose(); defenseRuntime.current = null;
      projection.group.visible = stars.points.visible = controls.group.visible = logConsole.group.visible = true;
      beam.visible = true;
      camera.fov = camera.aspect < .8 ? 58 : 52;
      camera.updateProjectionMatrix();
    };
    defenseApi.current = {
      load: async () => {
        const token = ++generation;
        const module = await import("./hothDefense/runtime");
        if (removed || token !== generation) return;
        projection.group.visible = stars.points.visible = controls.group.visible = logConsole.group.visible = false;
        beam.visible = false;
        defenseRuntime.current = module.createHothDefenseRuntime({ scene, camera, renderer, reduced: live.current.reduced, sound: live.current.sound, volume: live.current.defenseVolume, onView: setDefenseView });
      },
      stop: stopDefense,
    };
    // The arcade's cockpit simulations take over the view the same way, keeping the starfield.
    let gameGeneration = 0;
    const stopGame = () => {
      gameGeneration++;
      gameRuntime.current?.dispose();
      gameRuntime.current = null;
      projection.group.visible = stars.points.visible = controls.group.visible = logConsole.group.visible = true;
      beam.visible = true;
      camera.fov = camera.aspect < 0.8 ? 58 : 52;
      camera.updateProjectionMatrix();
    };
    arcadeApi.current = {
      load: async (kind) => {
        const token = ++gameGeneration;
        const module = await import("./arcade/cockpitGames");
        if (removed || token !== gameGeneration) return;
        projection.group.visible = controls.group.visible = logConsole.group.visible = false;
        beam.visible = false;
        gameRuntime.current = module.createCockpitGame({
          kind,
          scene,
          camera,
          reduced: live.current.reduced,
          audio: arcadeAudio.current,
          trail: live.current.trail,
          onView: setGameView,
          onFinish: (result) => onGameFinish.current(result),
        });
      },
      stop: stopGame,
      press: () => arcadeConsole.press(),
      hover: (on) => arcadeConsole.setHover(on),
    };
    let consoleTint = "",
      cabinTint = "";
    const look = new THREE.Vector3(0, 1.35, -3.4);
    const head = { x: 0, y: 0 },
      lean = { x: 0, y: 0 };
    const shell = dialog.current;
    const pointerMove = (event: PointerEvent) => {
      if (
        live.current.defense ||
        live.current.arcadeGame ||
        event.pointerType !== "mouse" ||
        (event.target as HTMLElement).closest("button,a")
      )
        return;
      const bounds = el.getBoundingClientRect();
      head.x = THREE.MathUtils.clamp(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -1,
        1,
      );
      head.y = THREE.MathUtils.clamp(
        1 - ((event.clientY - bounds.top) / bounds.height) * 2,
        -1,
        1,
      );
    };
    const pointerLeave = () => {
      head.x = 0;
      head.y = 0;
    };
    shell?.addEventListener("pointermove", pointerMove, { passive: true });
    shell?.addEventListener("pointerleave", pointerLeave);
    const projected = new THREE.Vector3();
    let width = 1,
      height = 1;
    // The journal's screen: a quad in front of the pilot, sized so it projects to a comfortable
    // reading area from the resting head position, and tilted slightly back like a real display.
    const rest = new THREE.PerspectiveCamera();
    const quad = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const screenSize = { w: 1, h: 1 };
    const layoutScreen = () => {
      rest.fov = camera.fov;
      rest.aspect = camera.aspect;
      rest.near = 0.05;
      rest.far = 600;
      rest.position.copy(pilotEye);
      rest.lookAt(0, 1.35, -3.4);
      rest.updateProjectionMatrix();
      rest.updateMatrixWorld();
      const w = Math.min(1080, width * 0.9),
        h = Math.min(700, height * 0.8),
        left = (width - w) / 2,
        top = Math.max(64, (height - h) / 2 - height * 0.03);
      screenSize.w = w;
      screenSize.h = h;
      const forward = new THREE.Vector3();
      rest.getWorldDirection(forward);
      const corners: [number, number][] = [
        [left, top],
        [left + w, top],
        [left, top + h],
        [left + w, top + h],
      ];
      corners.forEach(([x, y], i) => {
        const direction = new THREE.Vector3((x / width) * 2 - 1, 1 - (y / height) * 2, 0.5).unproject(rest).sub(pilotEye).normalize();
        quad[i].copy(pilotEye).addScaledVector(direction, 1.9 / direction.dot(forward));
      });
      const centre = quad.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(0.25);
      const axis = quad[1].clone().sub(quad[0]).normalize();
      quad.forEach((p) => p.sub(centre).applyAxisAngle(axis, -0.08).add(centre));
    };
    const resize = () => {
      width = el.clientWidth;
      height = el.clientHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.fov = camera.aspect < 0.8 ? 58 : 52;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      projection.setCompact(camera.aspect < 0.8);
      setCompact(camera.aspect < 0.95 || width < 720);
      layoutScreen();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    let frame = 0,
      age = 0,
      last = performance.now(),
      activated = false,
      openedAt = -1,
      openedFor = "";
    const anchor = new THREE.Vector3(),
      corner = new THREE.Vector3(),
      from = new THREE.Vector3(),
      across = new THREE.Vector3();
    const toScreen = (point: THREE.Vector3): [number, number] => {
      corner.copy(point).project(camera);
      return [(corner.x * 0.5 + 0.5) * width, (-corner.y * 0.5 + 0.5) * height];
    };
    const placeOver = (button: HTMLElement | null, object: THREE.Object3D, w: number, h: number) => {
      if (!button) return;
      object.getWorldPosition(anchor);
      const [x, y] = toScreen(anchor);
      button.style.transform = `translate(${x - w / 2}px,${y - h / 2}px)`;
    };
    const animate = (now: number) => {
      // The first frame's timestamp can come before the end of this setup: a negative step would
      // run the hologram's switch-off backwards and flash the whole map on at entry.
      const dt = THREE.MathUtils.clamp((now - last) / 1000, 0, 0.05);
      last = now;
      // The speeder race draws its own forest: the cockpit rests underneath.
      if (live.current.arcadeGame === "speeder-racing" || live.current.arcadeGame === "podracing") {
        frame = requestAnimationFrame(animate);
        return;
      }
      age += dt;
      const enter = live.current.reduced
        ? 1
        : THREE.MathUtils.smootherstep(age / 1.2, 0, 1);
      lean.x = THREE.MathUtils.damp(
        lean.x,
        live.current.reduced ? 0 : head.x,
        5,
        dt,
      );
      lean.y = THREE.MathUtils.damp(
        lean.y,
        live.current.reduced ? 0 : head.y,
        5,
        dt,
      );
      camera.position.set(
        lean.x * 0.028 * enter,
        THREE.MathUtils.lerp(2.3, 1.55, enter),
        THREE.MathUtils.lerp(6.5, 2.9, enter),
      );
      look.x = lean.x * 0.14 * enter;
      look.y = 1.35 + lean.y * 0.06 * enter;
      camera.lookAt(look);
      camera.updateMatrixWorld();
      projection.setFragments(fragmentsLive.current);
      if (pieceLive.current === "projecting") {
        pieceAmount = Math.min(1, pieceAmount + dt / PIECE_SECONDS);
        if (pieceAmount >= 1 && !pieceDone) {
          pieceDone = true;
          try {
            localStorage.setItem(PIECE_KEY, "1");
          } catch {
            // It will simply be projected again next time.
          }
          setPieceState("placed");
        }
      } else if (pieceLive.current === "placed") pieceAmount = 1;
      projection.setPiece(pieceAmount);
      projection.tick(age, live.current.selected, live.current.reduced);
      systems.tick(age, live.current.selected, live.current.reduced);
      const { journal: journalOpen, progress: book, coverOpen: lifted, compact: flat } = live.current;
      controls.setAlert(book.unseen.length > 0);
      controls.setOpen(journalOpen);
      controls.setSith(book.sith);
      controls.setCover(lifted);
      controls.tick(dt, age, live.current.reduced);
      placeOver(journalButton.current, controls.journalAnchor, 150, 70);
      placeOver(guardButton.current, controls.guardAnchor, 76, 70);
      placeOver(groguButton.current, grogu.anchor, 196, 38);
      placeOver(leverButton.current, grogu.leverAnchor, 84, 84);
      // The stowaway only comes when nothing else is open, and the ball coming off shakes the ship.
      const calm = !live.current.journal && !live.current.arcade && !live.current.flightLog && !live.current.defense && !live.current.arcadeGame && konami.phase === "idle";
      if (grogu.tick(dt, live.current.reduced, calm, holoLive.current.shown) === "pulled") {
        setGroguHolds(true);
        jolt = 1.5;
        if (live.current.sound) droidVoice.play("error");
      }
      if (jolt > 0) {
        jolt = Math.max(0, jolt - dt);
        const flicker = !live.current.reduced && jolt > 0 && Math.sin(age * 44) > 0;
        amber.intensity = jolt > 0 ? (flicker ? 9 : 4) : 2.5;
        if (!live.current.reduced) {
          camera.position.x += (Math.random() - 0.5) * 0.022 * jolt;
          camera.position.y += (Math.random() - 0.5) * 0.022 * jolt;
        }
      }
      // The hidden code's alert and jump: cabin lights, shake, field of view, flashes.
      const warpFrame = konami.tick(dt, age, live.current.reduced);
      if (!live.current.defense && !live.current.arcadeGame) {
        if (warpFrame.shake > 0) {
          camera.position.x += (Math.random() - 0.5) * 0.03 * warpFrame.shake;
          camera.position.y += (Math.random() - 0.5) * 0.03 * warpFrame.shake;
        }
        const fov = (camera.aspect < 0.8 ? 58 : 52) + warpFrame.fov;
        if (Math.abs(camera.fov - fov) > 0.001) {
          camera.fov = fov;
          camera.updateProjectionMatrix();
        }
        stars.points.visible = !warpFrame.away;
      }
      sky.intensity = 1.5 * (1 - 0.6 * warpFrame.alert);
      key.intensity = 2.6 * (1 - 0.65 * warpFrame.alert);
      if (warpAlert.current) warpAlert.current.style.opacity = String(warpFrame.alert);
      if (warpFlash.current) warpFlash.current.style.opacity = String(warpFrame.flash);
      placeOver(logButton.current, logConsole.anchor, 172, 52);
      logConsole.tick(age, live.current.reduced, live.current.flightLog);
      placeOver(arcadeButton.current, arcadeConsole.anchor, 124, 54);
      if (consoleTint !== live.current.holoColor) arcadeConsole.setAccent((consoleTint = live.current.holoColor));
      if (cabinTint !== live.current.accent && !live.current.defense) fill.color.set((cabinTint = live.current.accent));
      arcadeConsole.setActive(live.current.arcade || !!live.current.arcadeGame, age);
      arcadeConsole.tick(dt, age, live.current.reduced);
      // A hologram (the journal, or the arcade) unfolds upward from its module, then holds,
      // following the head's movement.
      const panel = flat
        ? null
        : journalOpen
          ? { id: "journal", element: terminal.current, origin: controls.journalAnchor as THREE.Object3D, color: "#4aaaf4" }
          : live.current.arcade
            ? { id: "arcade", element: arcadeScreen.current, origin: arcadeConsole.anchor as THREE.Object3D, color: live.current.holoColor }
            : live.current.flightLog
              ? { id: "log", element: logScreen.current, origin: logConsole.anchor as THREE.Object3D, color: "#6fe39a" }
              : null;
      if (panel) {
        if (openedFor !== panel.id) {
          openedFor = panel.id;
          openedAt = age;
          beam.material.color.set(panel.color);
        }
        const unfold = live.current.reduced ? 1 : THREE.MathUtils.smootherstep((age - openedAt) / 0.65, 0, 1);
        panel.origin.getWorldPosition(from);
        across.copy(quad[1]).sub(quad[0]).normalize().multiplyScalar(0.18);
        const points = quad.map((target, i) => {
          const base = from.clone().addScaledVector(across, i % 2 ? 1 : -1);
          const k = i < 2 ? unfold : Math.min(1, unfold * 1.35);
          return base.lerp(target, k);
        });
        const screen = panel.element;
        if (screen) {
          const projected = points.map(toScreen);
          screen.style.width = `${screenSize.w}px`;
          screen.style.height = `${screenSize.h}px`;
          screen.style.transform = holoMatrix(screenSize.w, screenSize.h, projected);
          screen.style.opacity = unfold < 0.04 ? "0" : "1";
        }
        const position = beam.geometry.getAttribute("position") as THREE.BufferAttribute;
        [from.clone().addScaledVector(across, -0.4), from.clone().addScaledVector(across, 0.4), points[2], points[3]].forEach((p, i) => position.setXYZ(i, p.x, p.y, p.z));
        position.needsUpdate = true;
        beam.material.opacity = 0.05 + (1 - unfold) * 0.2 + (live.current.reduced ? 0 : Math.sin(age * 3) * 0.01);
      } else {
        openedAt = -1;
        openedFor = "";
        beam.material.opacity = 0;
        // Back to the flat panel (the window got narrower): drop the hologram's projection.
        for (const screen of [terminal.current, arcadeScreen.current, logScreen.current]) {
          if (screen?.style.transform) {
            screen.style.transform = screen.style.opacity = screen.style.width = screen.style.height = "";
          }
        }
      }
      // The lever strikes the hologram up over two seconds, or lets it collapse into its projector.
      // It also lights up each time the pilot enters, once the cockpit has settled.
      // The red alert of the hidden code shuts it down too, until the ship is back home.
      const holoTarget = holoLive.current.shown && age > 0.9 && konami.phase === "idle" ? 1 : 0;
      if (live.current.reduced) holoFold = holoLive.current.shown ? 1 : 0;
      else holoFold = THREE.MathUtils.clamp(holoFold + (holoTarget ? dt / 2.3 : -dt / 0.6), 0, 1);
      const pinned = process.env.NODE_ENV !== "production" ? (window as unknown as { __holoPower?: number }).__holoPower : undefined;
      if (pinned !== undefined) holoFold = pinned;
      if (holoFold > 0 && !holoStarted && holoTarget) {
        holoStarted = true;
        if (live.current.sound) droidVoice.play("wake");
      }
      if (holoFold === 0) holoStarted = false;
      projection.setPower(holoFold);
      if (!live.current.defense && !live.current.arcadeGame) {
        projection.group.visible = holoFold > 0.001 && !warpFrame.away && !(jolt > 0.9 && !live.current.reduced && Math.sin(age * 44) > 0);
      }
      const strike = holoFold > 0 && holoFold < 0.4 ? Math.sin((holoFold / 0.4) * Math.PI) * 26 : 0;
      projectorLight.intensity = (live.current.reduced ? 8 : 8 + Math.sin(age * 0.9) * 0.25) * holoFold + strike;
      stars.tick(age, true);
      projection.group.updateMatrixWorld(true);
      projection.planets.forEach((planet, index) => {
        const marker = markers.current[index];
        if (!marker || !marker.isConnected) return;
        planet.getWorldPosition(projected);
        const distance = camera.position.distanceTo(projected);
        projected.project(camera);
        const radius = Number(planet.userData.radius ?? 0.4);
        const diameter = THREE.MathUtils.clamp(
          (radius * height) /
            (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance),
          42,
          180,
        );
        marker.style.opacity = String(projection.appeared(index));
        marker.style.width = `${diameter}px`;
        marker.style.height = `${diameter}px`;
        marker.style.transform = `translate(${(projected.x * 0.5 + 0.5) * width - diameter / 2}px,${(-projected.y * 0.5 + 0.5) * height - diameter / 2}px)`;
      });
      defenseRuntime.current?.tick(document.hidden ? 0 : dt, live.current.reduced);
      gameRuntime.current?.tick(document.hidden ? 0 : dt, live.current.reduced);
      renderer.render(scene, camera);
      if (!activated) {
        activated = true;
        setGraphics(true);
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      removed = true;
      stopDefense(); defenseApi.current = null;
      stopGame(); arcadeApi.current = null;
      konami.dispose(); konamiApi.current = null;
      droidTimers.forEach((timer) => window.clearTimeout(timer));
      live.current.onCombatChange?.(false);
      cancelAnimationFrame(frame);
      observer.disconnect();
      shell?.removeEventListener("pointermove", pointerMove);
      shell?.removeEventListener("pointerleave", pointerLeave);
      projection.dispose();
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.Points ||
          object instanceof THREE.Line
        ) {
          geometries.add(object.geometry);
          const items = Array.isArray(object.material)
            ? object.material
            : [object.material];
          items.forEach((material) => materials.add(material));
        }
      });
      materials.forEach((material) => {
        Object.values(material).forEach((value) => {
          if (value instanceof THREE.Texture) textures.add(value);
        });
        material.dispose();
      });
      textures.forEach((texture) => texture.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  const loadDefense = async () => {
    const request = ++defenseRequest.current;
    setDefenseLoading(true); setDefenseError(null); setDefenseView(null);
    try {
      if (!graphics || !defenseApi.current) throw new Error("Le simulateur nécessite le rendu 3D du cockpit.");
      await defenseApi.current.load();
    } catch {
      if (request === defenseRequest.current) setDefenseError("Le simulateur n’a pas pu se charger. Retournez au cockpit puis réessayez.");
    } finally { if (request === defenseRequest.current) setDefenseLoading(false); }
  };
  const enterDefense = () => {
    if (defense) return;
    setDefense(true); onCombatChange?.(true); void loadDefense();
  };
  const restartDefense = () => {
    if (defenseRuntime.current) defenseRuntime.current.restart();
    else void loadDefense();
  };
  const leaveDefense = () => {
    defenseRequest.current++;
    defenseApi.current?.stop();
    setDefense(false); setDefenseLoading(false); setDefenseError(null); setDefenseView(null);
    onCombatChange?.(false);
    // Launched from Galactic Arcade: back to its console, with the report if a run finished.
    if (defenseFromArcade.current) {
      defenseFromArcade.current = false;
      setArcade(true);
    } else requestAnimationFrame(() => (arcadeButton.current ?? close.current)?.focus());
  };
  useEffect(() => { defenseRuntime.current?.setSound(sound); konamiApi.current?.setSound(sound); }, [sound]);
  // The hidden code is typed anywhere in the cockpit, while no console or simulation is open.
  useEffect(() => {
    const typed = (event: KeyboardEvent) => {
      const now = live.current;
      if (event.repeat || now.defense || now.arcadeGame || now.arcade || now.journal || now.flightLog) return;
      if (event.target instanceof Element && event.target.closest("input,textarea,select,[contenteditable]")) return;
      konamiApi.current?.key(event.key.length === 1 ? event.key.toLowerCase() : event.key);
    };
    window.addEventListener("keydown", typed);
    return () => window.removeEventListener("keydown", typed);
  }, []);
  useEffect(() => { defenseRuntime.current?.setVolume(defenseVolume); }, [defenseVolume]);
  useEffect(() => {
    if (!defense) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Tab") return;
      if (event.key === "Escape") {
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.type === "keydown" && !event.repeat) {
          if (defenseRuntime.current) defenseRuntime.current.togglePause(); else leaveDefense();
        }
        return;
      }
      const element = event.target instanceof Element ? event.target : null;
      if (element?.closest("input,select,textarea")) return;
      if (element?.closest("button,a") && [" ", "Enter"].includes(event.key)) return;
      const pressed = event.type === "keydown";
      if ([" ", "Enter", "r", "R", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.key === "Enter") defenseRuntime.current?.setFiring(pressed);
        if (!pressed || event.repeat) return;
        if (event.key === " ") defenseRuntime.current?.special();
        if (event.key.toLowerCase() === "r") defenseRuntime.current?.cool();
        if (event.key === "ArrowLeft") defenseRuntime.current?.nudge(-.05, 0);
        if (event.key === "ArrowRight") defenseRuntime.current?.nudge(.05, 0);
        if (event.key === "ArrowUp") defenseRuntime.current?.nudge(0, .05);
        if (event.key === "ArrowDown") defenseRuntime.current?.nudge(0, -.05);
      }
    };
    window.addEventListener("keydown", key, true); window.addEventListener("keyup", key, true);
    return () => { window.removeEventListener("keydown", key, true); window.removeEventListener("keyup", key, true); defenseRuntime.current?.setFiring(false); };
  }, [defense]);

  // --- Galactic Arcade ---
  const ensureArcadeAudio = () => {
    if (!arcadeAudio.current) arcadeAudio.current = createArcadeAudio();
    arcadeAudio.current.setEnabled(sound);
    return arcadeAudio.current;
  };
  const showAchievements = (summary: ResultSummary) => {
    if (!summary.achievements.length) return;
    window.clearTimeout(toastTimer.current);
    setArcadeToast(summary.achievements);
    toastTimer.current = window.setTimeout(() => setArcadeToast(null), 5000);
  };
  const openArcade = () => {
    if (arcade) {
      closeArcade();
      return;
    }
    ensureArcadeAudio().ui("select");
    arcadeApi.current?.press();
    setJournal(false);
    setFlightLog(false);
    setArcadeResult(null);
    window.setTimeout(() => setArcade(true), reduced ? 0 : 200);
  };
  const loadCockpitGame = async (kind: CockpitGameKind) => {
    setGameLoading(true);
    try {
      if (!graphics || !arcadeApi.current) throw new Error("WebGL");
      await arcadeApi.current.load(kind);
    } catch {
      setGameError("La simulation n’a pas pu se charger. Revenez à la console puis réessayez.");
    } finally {
      setGameLoading(false);
    }
  };
  const launchArcade = (id: ArcadeGameId) => {
    const game = gameById(id);
    ensureArcadeAudio();
    setArcade(false);
    setArcadeResult(null);
    if (game.mode === "defense") {
      defenseFromArcade.current = true;
      enterDefense();
      return;
    }
    setArcadeGame(id);
    setGameView(null);
    setGameError(null);
    onCombatChange?.(true);
    if (game.mode === "cockpit") void loadCockpitGame(id as CockpitGameKind);
  };
  const endArcadeGame = (summary: ResultSummary | null) => {
    window.clearTimeout(finishTimer.current);
    arcadeApi.current?.stop();
    setArcadeGame(null);
    setGameView(null);
    setGameLoading(false);
    setGameError(null);
    onCombatChange?.(false);
    setArcadeResult(summary);
    setArcade(true);
  };
  // A finished run is saved at once; the end banner stays up a moment before the report.
  onGameFinish.current = (result: GameResult) => {
    const summary = recordResult(result);
    showAchievements(summary);
    window.clearTimeout(finishTimer.current);
    finishTimer.current = window.setTimeout(() => endArcadeGame(summary), reduced ? 900 : 2600);
  };
  // Defense of Hoth keeps its own simulator; its runs count in the arcade wherever it was launched.
  const defensePhase = useRef<string | null>(null);
  useEffect(() => {
    const phase = defenseView?.phase ?? null;
    const previous = defensePhase.current;
    defensePhase.current = phase;
    if (!defenseView || phase === previous || !previous || previous === "victory" || previous === "defeat") return;
    if (phase !== "victory" && phase !== "defeat") return;
    const won = phase === "victory";
    const summary = recordResult({ gameId: "defense-of-hoth", score: defenseView.score, won, perfect: won && defenseView.totalDamage === 0, seconds: Math.round(defenseView.time) });
    showAchievements(summary);
    if (defenseFromArcade.current) setArcadeResult(summary);
    // Only the phase change matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defenseView]);
  useEffect(() => {
    arcadeAudio.current?.setEnabled(sound);
  }, [sound]);
  useEffect(
    () => () => {
      window.clearTimeout(finishTimer.current);
      window.clearTimeout(toastTimer.current);
      arcadeAudio.current?.dispose();
    },
    [],
  );

  const openFlightLog = () => {
    if (flightLog) return closeFlightLog();
    setArcade(false);
    setJournal(false);
    onSelectionCue();
    window.setTimeout(() => setFlightLog(true), reduced ? 0 : 160);
  };
  // The console's readout follows the log, the Jedi missions and the arcade.
  useEffect(() => {
    const visited = destinations.filter((item) => log.orbits.includes(item.name)).length;
    logApi.current?.update({ planets: `PLANÈTES ${visited}/${destinations.length}`, missions: `MISSIONS ${progress.found.length}/10`, credits: `${arcadeData.credits.toLocaleString("fr-FR")} CR` });
  }, [log, progress, arcadeData, graphics]);

  const openJournal = () => {
    setArcade(false);
    setFlightLog(false);
    controlsApi.current?.press();
    onSelectionCue();
    window.setTimeout(() => setJournal(true), reduced ? 0 : 180);
  };
  // First press lifts the safety cover; the switch under it flips the cockpit to the dark side.
  const useGuard = () => {
    if (!coverOpen) {
      setCoverOpen(true);
      return;
    }
    const sith = !progress.sith;
    setSithMode(sith);
    onSelectionCue();
    if (sith) unlockSecret("sith-mode");
  };

  const choose = (index: number, focus = false) => {
    setSelected(index);
    // The cartographer's mission: the visitor has asked the hologram about every world on it.
    if (index < destinations.length) {
      startMission("star-map");
      consultedWorlds.add(index);
      if (consultedWorlds.size === destinations.length) unlockSecret("star-map");
    }
    if (index !== selected) onSelectionCue();
    if (focus) markers.current[index]?.focus();
  };

  return (
    <motion.section
      ref={dialog}
      className={`cockpit-map ${defense || arcadeGame ? defenseStyles.combat : ""}`}
      data-graphics={graphics}
      data-journal={journal}
      data-arcade={arcade || flightLog}
      data-sith={progress.sith}
      data-warp={warp}
      role="dialog"
      aria-modal="true"
      aria-labelledby={defense || arcadeGame ? undefined : "cockpit-title"}
      aria-label={defense ? "Défense de Hoth" : arcadeGame ? gameById(arcadeGame).name : undefined}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.15 : 0.5 }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="cockpit-fallback" aria-hidden="true" />
      <div ref={mount} className="cockpit-canvas" />
      <div className="cockpit-vignette" aria-hidden="true" />
      <div ref={warpAlert} className="cockpit-warp-alert" aria-hidden="true" />
      <div ref={warpFlash} className="cockpit-warp-flash" aria-hidden="true" />
      {warp === "alert" && (
        <div className="cockpit-warp-banner" role="alert">
          <strong>ALERTE ROUGE</strong>
          <span>Saut hyperspatial non programmé · coordonnées inconnues</span>
        </div>
      )}
      {warp === "alert" && (
        <p className="cockpit-warp-droid" role="status">
          R-X7 : {alertLine}
        </p>
      )}
      {warp === "arrived" && <p className="cockpit-warp-droid is-calm" role="status">{warpTo.droid}</p>}
      {warp === "arrived" && (
        <div className="cockpit-readout-shell cockpit-warp-readout">
          <motion.section
            className="cockpit-readout"
            role="status"
            aria-atomic="true"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduced ? 0 : 1.2, duration: reduced ? 0 : 0.4 }}
          >
            <div
              className="cockpit-preview cockpit-warp-preview"
              role="img"
              aria-label={`Vue en couleur : ${warpTo.name}`}
              style={{ "--warp-heart": `rgb(${warpTo.heart.map((c) => Math.round(c * 255)).join(",")})` } as CSSProperties}
            />
            <div className="cockpit-planet-copy">
              <p className="cockpit-eyebrow">{warpTo.eyebrow}</p>
              <h3>{warpTo.name}</h3>
              <p className="cockpit-description">{warpTo.description}</p>
              <span className="cockpit-access">
                <Orbit size={11} /> {warpTo.access}
              </span>
            </div>
            <div className="cockpit-launches">
              <button className="cockpit-launch" onClick={() => konamiApi.current?.home()}>
                <Navigation size={14} />
                <span>RENTRER DANS LA GALAXIE</span>
                <ArrowUpRight size={15} />
              </button>
            </div>
          </motion.section>
        </div>
      )}
      {!defense && !arcadeGame && graphics && !compact && (
        <button
          ref={arcadeButton}
          className="cockpit-arcade-button"
          onClick={openArcade}
          onPointerEnter={() => arcadeApi.current?.hover(true)}
          onPointerLeave={() => arcadeApi.current?.hover(false)}
          onFocus={() => arcadeApi.current?.hover(true)}
          onBlur={() => arcadeApi.current?.hover(false)}
          aria-haspopup="dialog"
          aria-expanded={arcade}
          aria-label="Galactic Arcade, centre de simulation"
        >
          <span>GALACTIC ARCADE</span>
        </button>
      )}
      {arcadeGame && gameById(arcadeGame).mode === "cockpit" && (
        <ArcadeGameHUD
          view={gameView}
          loading={gameLoading}
          error={gameError}
          onAim={(x, y) => gameRuntime.current?.setAim(x, y)}
          onRelease={() => gameRuntime.current?.releaseAim()}
          onFire={(held) => gameRuntime.current?.setFiring(held)}
          onTorpedo={() => gameRuntime.current?.torpedo()}
          onDodge={() => gameRuntime.current?.dodge()}
          onKey={(key, pressed) => gameRuntime.current?.key(key, pressed)}
          onTogglePause={() => gameRuntime.current?.togglePause()}
          onResume={() => gameRuntime.current?.resume()}
          onRestart={() => gameRuntime.current?.restart()}
          onExtract={() => gameRuntime.current?.extract()}
          onQuit={() => endArcadeGame(null)}
        />
      )}
      {arcadeGame === "imperial-hacking" && <ImperialHacking reduced={reduced} audio={arcadeAudio.current} onFinish={(result) => onGameFinish.current(result)} onQuit={() => endArcadeGame(null)} />}
      {arcadeGame === "podracing" && (
        <PodRacing reduced={reduced} sound={sound} onQuit={() => endArcadeGame(null)} onResult={recordPodResult} />
      )}
      {arcadeGame === "speeder-racing" && (
        <SpeederRace reduced={reduced} audio={arcadeAudio.current} trail={trail.startsWith("#") ? trail : "#ffb36b"} best={arcadeData.stats["speeder-racing"].bestTime} onFinish={(result) => onGameFinish.current(result)} onQuit={() => endArcadeGame(null)} />
      )}
      {arcadeToast && (
        <div className="arcade-toast" role="status">
          <span aria-hidden="true">{arcadeToast[0].icon}</span>
          <div>
            <small>SUCCÈS DÉBLOQUÉ</small>
            <strong>{arcadeToast.map((item) => item.name).join(" · ")}</strong>
          </div>
        </div>
      )}
      {!defense && !arcadeGame && !arcade && graphics && (
        <button
          ref={logButton}
          className="cockpit-log-button"
          onClick={openFlightLog}
          onPointerEnter={() => logApi.current?.setHover(true)}
          onPointerLeave={() => logApi.current?.setHover(false)}
          onFocus={() => logApi.current?.setHover(true)}
          onBlur={() => logApi.current?.setHover(false)}
          aria-haspopup="dialog"
          aria-expanded={flightLog}
          aria-label="Carnet de vol du pilote"
        >
          <span>CARNET DE VOL</span>
        </button>
      )}
      {defense && <HothDefenseHUD view={defenseView} loading={defenseLoading} error={defenseError} sound={sound} volume={defenseVolume}
        onStart={() => defenseRuntime.current?.start()} onPause={() => defenseRuntime.current?.pause()} onResume={() => defenseRuntime.current?.resume()}
        onRestart={restartDefense} onExit={leaveDefense}
        onSpecial={() => defenseRuntime.current?.special()} onCool={() => defenseRuntime.current?.cool()} onZoom={() => defenseRuntime.current?.toggleZoom()}
        onToggleSound={() => { defenseRuntime.current?.setSound(!sound); onToggleSound(); }} onVolume={setDefenseVolume}
        onAim={(x,y) => defenseRuntime.current?.setAim(x,y)} onFire={held => defenseRuntime.current?.setFiring(held)} />}

      {!defense && !arcadeGame && !arcade && (
        <button className="cockpit-activity-button mono" style={{ position: "absolute", right: 16, top: 72, zIndex: 6 }} onClick={() => setMonitorOpen(true)} aria-label="Moniteur d’activité galactique">
          <Radar size={15} aria-hidden="true" /> ACTIVITÉ
        </button>
      )}
      <header className="cockpit-titlebar">
        <div>
          <p className="cockpit-eyebrow">ASTRONAVIGATION</p>
          <h2 id="cockpit-title">Cockpit du X‑wing</h2>
        </div>
        <div className="cockpit-controls">
          <button
            className="cockpit-audio"
            onClick={onToggleSound}
            aria-pressed={sound}
            aria-label={
              sound ? "Couper l’ambiance sonore" : "Activer l’ambiance sonore"
            }
          >
            {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          {(compact || !graphics) && (
            <>
              <button
                className="cockpit-guard-flat"
                data-open={coverOpen}
                data-sith={progress.sith}
                onClick={useGuard}
                aria-label={coverOpen ? (progress.sith ? "Revenir du côté lumineux" : "Basculer l’interrupteur sous le capot") : "Soulever le capot de sécurité"}
              />
              <button className="cockpit-journal-flat" onClick={openJournal} aria-haspopup="dialog">
                <span>JOURNAL DE MISSIONS</span>
                {progress.unseen.length > 0 && <i className="jedi-alert-dot" aria-label="nouvelle mission terminée" />}
              </button>
              <button className="cockpit-arcade-flat" onClick={openArcade} aria-haspopup="dialog" aria-expanded={arcade} aria-label="Galactic Arcade, centre de simulation">
                <Gamepad2 size={16} />
              </button>
            </>
          )}
          <button
            ref={close}
            className="cockpit-close"
            onClick={onClose}
            aria-label="Quitter le cockpit"
          >
            <X size={17} />
            <span>RETOUR</span>
            <kbd>ÉCHAP</kbd>
          </button>
        </div>
      </header>
      <motion.div
        className="cockpit-targets"
        role="group"
        aria-label="Destinations holographiques"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduced ? 0 : 0.55, duration: 0.35 }}
      >
        {destinations.map((planet, index) => (
          <button
            key={planet.name}
            ref={(element) => {
              markers.current[index] = element;
            }}
            className="holo-destination"
            hidden={!holoShown}
            aria-label={`Sélectionner ${planet.name}`}
            aria-pressed={selected === index}
            aria-controls="cockpit-planet-details"
            tabIndex={selected === index ? 0 : -1}
            onClick={() => choose(index)}
            onKeyDown={(event) => {
              const step =
                event.key === "ArrowRight" || event.key === "ArrowDown"
                  ? 1
                  : event.key === "ArrowLeft" || event.key === "ArrowUp"
                    ? -1
                    : 0;
              if (step) {
                event.preventDefault();
                choose((index + step + worlds) % worlds, true);
              }
              if (event.key === "Home" || event.key === "End") {
                event.preventDefault();
                choose(event.key === "Home" ? 0 : worlds - 1, true);
              }
            }}
          >
            <span
              className="holo-fallback-globe"
              style={planetReferenceStyle(planet)}
              aria-hidden="true"
            />
            <span className="holo-name">
              {index === 3 ? "Étoile de la Mort" : planet.name}
            </span>
          </button>
        ))}
        {pieceState === "placed" && (
          <button
            key="mustafar"
            ref={(element) => {
              markers.current[MUSTAFAR] = element;
            }}
            className="holo-destination is-hidden-world"
            hidden={!holoShown}
            aria-label="Sélectionner Mustafar, le monde caché"
            aria-pressed={onMustafar}
            aria-controls="cockpit-planet-details"
            tabIndex={onMustafar ? 0 : -1}
            onClick={() => choose(MUSTAFAR)}
            onKeyDown={(event) => {
              const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
              if (step) {
                event.preventDefault();
                choose((MUSTAFAR + step + worlds) % worlds, true);
              }
            }}
          >
            <span className="holo-fallback-globe" style={mustafar.style} aria-hidden="true" />
            <span className="holo-name">Mustafar</span>
          </button>
        )}
        {holoShown && (
          <p className="holo-fragments mono" aria-label={`Carte de la galaxie : ${progress.found.length} fragments sur ${missions.length}`}>
            {pieceState === "placed" ? "CARTE COMPLÈTE" : `FRAGMENTS DE CARTE ${progress.found.length}/${missions.length}`}
          </p>
        )}
        {pieceState === "projecting" && (
          <p className="holo-piece-note" role="status">
            R-X7 : bip-boup ! J’ai toujours gardé la dernière pièce de la carte. La voici.
          </p>
        )}
      </motion.div>
      {graphics && !defense && !arcadeGame && (
        <div className="cockpit-instruments">
          {groguHolds ? (
            <>
              <button
                ref={groguButton}
                className="cockpit-grogu-button"
                onClick={() => {
                  groguApi.current?.take();
                  setGroguHolds(false);
                }}
              >
                REPRENDRE LE POMMEAU
              </button>
              <p className="cockpit-grogu-note" role="status">
                R-X7 : bip ! Votre passager clandestin vient d’arracher le pommeau : le système orbital s’est éteint.
              </p>
            </>
          ) : (
            <button
              ref={leverButton}
              className="cockpit-lever-button"
              aria-pressed={hologram}
              aria-label={hologram ? "Éteindre le système orbital holographique" : "Allumer le système orbital holographique"}
              title={hologram ? "Éteindre le système orbital" : "Allumer le système orbital"}
              onClick={() => {
                hologramOnThisVisit = !hologram;
                setHologram(!hologram);
                leverSound.current();
              }}
            />
          )}
        </div>
      )}
      {graphics && !compact && (
        <div className="cockpit-instruments">
          <button
            ref={journalButton}
            className="cockpit-mission-button"
            onClick={openJournal}
            onPointerEnter={() => controlsApi.current?.setHover(true)}
            onPointerLeave={() => controlsApi.current?.setHover(false)}
            onFocus={() => controlsApi.current?.setHover(true)}
            onBlur={() => controlsApi.current?.setHover(false)}
            aria-haspopup="dialog"
            aria-expanded={journal}
            aria-label={`Journal de missions${progress.unseen.length ? ", nouvelle transmission reçue" : ""}`}
          >
            <span className="cockpit-mission-caption">JOURNAL DE MISSIONS</span>
            {progress.unseen.length > 0 && <span className="cockpit-mission-alert">NOUVELLE TRANSMISSION REÇUE</span>}
          </button>
          <button
            ref={guardButton}
            className="cockpit-guard-button"
            onClick={useGuard}
            aria-pressed={coverOpen ? progress.sith : undefined}
            aria-label={coverOpen ? (progress.sith ? "Revenir du côté lumineux" : "Basculer l’interrupteur sous le capot") : "Soulever le capot de sécurité"}
          />
        </div>
      )}
      <AnimatePresence>
        {journal && (
          <motion.div
            key="journal"
            className={`cockpit-journal-layer ${compact || !graphics ? "flat" : "holo"}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.1 : 0.25 }}
          >
            <CockpitMissionTerminal
              ref={terminal}
              mode={compact || !graphics ? "flat" : "holo"}
              reduced={reduced}
              onClose={closeJournal}
              onLaunch={onExperience}
              style={compact || !graphics ? undefined : { opacity: 0 }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {flightLog && (
          <motion.div
            key="log"
            className={`cockpit-log-layer ${compact || !graphics ? "flat" : "holo"}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.1 : 0.25 }}
          >
            <FlightLogPanel
              ref={logScreen}
              mode={compact || !graphics ? "flat" : "holo"}
              reduced={reduced}
              onClose={closeFlightLog}
              onLaunch={(index) => {
                setFlightLog(false);
                onLaunch(index);
              }}
              onArcade={() => {
                setFlightLog(false);
                openArcade();
              }}
              onJournal={() => {
                setFlightLog(false);
                openJournal();
              }}
              style={compact || !graphics ? undefined : { opacity: 0 }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {arcade && (
          <motion.div
            key="arcade"
            className={`cockpit-arcade-layer ${compact || !graphics ? "flat" : "holo"}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.1 : 0.25 }}
          >
            <ArcadeHologram
              ref={arcadeScreen}
              mode={compact || !graphics ? "flat" : "holo"}
              reduced={reduced}
              audio={arcadeAudio.current}
              result={arcadeResult}
              onLaunch={launchArcade}
              onClose={closeArcade}
              onDismissResult={() => setArcadeResult(null)}
              style={compact || !graphics ? undefined : { opacity: 0 }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="cockpit-readout-shell">
        <motion.section
          className="cockpit-readout"
          id="cockpit-planet-details"
          aria-live="polite"
          aria-atomic="true"
          inert={!holoShown}
          initial={{ opacity: 0, y: 14 }}
          animate={holoShown ? { opacity: 1, y: 0 } : { opacity: 0, y: 46 }}
          transition={{ delay: reduced || !holoShown ? 0 : 1.5, duration: reduced ? 0 : 0.4 }}
        >
          <motion.div
            key={current?.name ?? mustafar.name}
            className="cockpit-preview"
            role="img"
            aria-label={`Vue en couleur : ${current?.name ?? mustafar.name}`}
            style={current ? planetReferenceStyle(current) : mustafar.style}
            initial={{ opacity: 0.3 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduced ? 0 : 0.25 }}
          />
          <div className="cockpit-planet-copy">
            <p className="cockpit-eyebrow">
              {(current ?? mustafar).number} / {(current ?? mustafar).category}
            </p>
            <h3>{(current ?? mustafar).name}</h3>
            <p className="cockpit-description">{(current ?? mustafar).description}</p>
            <span className="cockpit-access">
              {accessibleSurface ? <MapPin size={11} /> : <Orbit size={11} />}{" "}
              {onMustafar
                ? "La forteresse de Dark Vador"
                : accessibleSurface
                  ? "Zone d’atterrissage accessible"
                  : "Exploration en orbite"}
            </span>
          </div>
          <div className="cockpit-launches">
            {onMustafar && (
              <button className="cockpit-launch" onClick={onLandMustafar}>
                <Navigation size={14} />
                <span>SE POSER SUR MUSTAFAR</span>
                <ArrowUpRight size={15} />
              </button>
            )}
            <button className="cockpit-launch" onClick={() => (onMustafar ? onExperience("destiny") : onLaunch(selected))}>
              <Navigation size={14} />
              <span>{onMustafar ? "ENTRER DANS LA FORTERESSE" : "REJOINDRE L’ORBITE"}</span>
              <ArrowUpRight size={15} />
            </button>
          </div>
        </motion.section>
      </div>
    </motion.section>
  );
}
