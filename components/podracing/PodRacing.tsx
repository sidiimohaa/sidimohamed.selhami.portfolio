"use client";

import { adjustCredits, getArcade, onArcadeChange } from "../arcade/arcadeStore";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, ChevronRight, Flag, Pause, Play,
  RotateCcw, Settings2, Thermometer, Trophy, Volume2, VolumeX, Wrench, Zap,
} from "lucide-react";
import { moduleTraits, podModuleIds, podModules, podPaintIds, podPaints, type PodModuleId, type PodPaintId } from "./modules";
import PodPreview from "./PodPreview";
import { mountPodRace } from "./runtime";
import { courseGuidance, nearbyStandings } from "./raceGuidance";
import { branchOffset, tracks } from "./tracks";
import {
  boardFor, buyModule, buyPaint, buyUpgrade, challenges, clockLabel, emptyProfile, fitModule, fitPaint, loadProfile, maxUpgrade, medalNames, medalTime, podTrackIds, registerRace,
  saveProfile, scoreRound, upgradeCost, upgrades, type ChallengeId, type CupEntry, type PodProfile, type RaceAward,
} from "./progression";
import {
  neutralInput, upgradeKeys, type PodDifficulty, type PodInput, type PodMode, type PodRaceState, type PodResult,
  type PodStage, type PodStageOptions, type PodTrack, type PodTrackId,
} from "./types";
import styles from "./PodRacing.module.css";

type Props = { reduced: boolean; sound: boolean; onQuit: () => void; onResult?: (result: PodResult) => void };
type Tab = "race" | "hangar" | "records";
type Quality = "auto" | "low" | "high";
type CameraView = "chase" | "cockpit";
type Control = "left" | "right" | "throttle" | "brake" | "boost" | "drift" | "repair";
type Run = { options: PodStageOptions; round: number; cup: CupEntry[]; challenge?: ChallengeId };
type Outcome = { result: PodResult; award: RaceAward; cup: CupEntry[]; challengePassed: boolean };

const modes: { id: PodMode; name: string; description: string }[] = [
  { id: "classic", name: "Boonta Eve Classic", description: "Deux tours face à six rivaux. Gérez vos moteurs jusqu’à l’arrivée." },
  { id: "arcade", name: "Mode arcade", description: "Deux tours, chocs moins sévères et mini-turbos plus puissants." },
  { id: "time", name: "Contre-la-montre", description: "Un tour en solo. Battez votre record et affrontez votre propre fantôme." },
  { id: "championship", name: "Championnat", description: "Trois circuits, un tour par manche. Les points déterminent le classement final." },
  { id: "challenge", name: "Défis", description: "Un tour en solo avec un objectif de pilotage et une prime à gagner." },
];
const difficulties: { id: PodDifficulty; label: string }[] = [{ id: "rookie", label: "Recrue" }, { id: "pilot", label: "Pilote" }, { id: "ace", label: "As" }];
const qualityNames: Record<Quality, string> = { auto: "Auto", low: "Éco", high: "Haute" };
const controlKeys: Record<string, Control> = {
  arrowleft: "left", a: "left", q: "left", arrowright: "right", d: "right",
  arrowup: "throttle", z: "throttle", w: "throttle", arrowdown: "brake", s: "brake",
  " ": "boost", shift: "drift", r: "repair",
};
const percent = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 100);

function PodIllustration() {
  return (
    <svg className={styles.podArt} viewBox="0 0 620 230" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="pod-hull" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#426879" /><stop offset="1" stopColor="#101c28" />
        </linearGradient>
        <linearGradient id="pod-engine" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#766249" /><stop offset=".5" stopColor="#302b25" /><stop offset="1" stopColor="#151a20" />
        </linearGradient>
      </defs>
      <g stroke="#bca17d" strokeOpacity=".18">
        <path d="M1 190H619M35 209H585M75 161H545M120 130H500M0 69H620M145 224L258 77M475 224L362 77" />
        <circle cx="310" cy="111" r="91" strokeDasharray="4 12" />
      </g>
      <path d="M130 92L238 165M490 92L382 165" stroke="#7d929e" strokeWidth="2" />
      <path d="M127 103L232 178M493 103L388 178" stroke="#3a5864" strokeWidth="2" />
      {[0, 1].map((side) => (
        <g key={side} transform={side ? "translate(620 0) scale(-1 1)" : undefined}>
          <path d="M40 76L73 47H174L195 63V106L169 126H73L40 102Z" fill="url(#pod-engine)" stroke="#b19573" />
          <path d="M89 47L101 30H149L162 47M89 126L100 139H152L164 126" stroke="#8c765d" strokeWidth="2" />
          <path d="M74 55H164L183 68V105L164 117H74M103 54V117M126 54V117M149 54V117M171 59V111" stroke="#b09879" strokeOpacity=".54" />
          <ellipse cx="67" cy="87" rx="23" ry="32" fill="#171b20" stroke="#c9a477" strokeWidth="2" />
          <ellipse cx="65" cy="87" rx="15" ry="23" stroke="#ed9d56" strokeWidth="3" />
          <ellipse cx="65" cy="87" rx="8" ry="15" fill="#ca5b2d" />
          <path d="M182 77L197 82V100L182 104" stroke="#ffc37f" strokeWidth="2" />
        </g>
      ))}
      <path d="M192 88L227 83L249 95L268 82L292 95L313 84L331 93L349 80L375 94L400 86L428 91" stroke="#a59dff" strokeOpacity=".35" strokeWidth="11" />
      <path d="M192 88L227 83L249 95L268 82L292 95L313 84L331 93L349 80L375 94L400 86L428 91" stroke="#c5c9ff" strokeWidth="2.3" />
      <path d="M231 173L254 147L277 138H344L368 147L390 173L372 203L342 217H275L246 201Z" fill="url(#pod-hull)" stroke="#9ebfd1" strokeWidth="1.5" />
      <path d="M257 157L276 145H344L365 158L355 186H266Z" fill="#131f2b" stroke="#b0d1df" />
      <path d="M281 150H338L343 173H274Z" fill="#263c4c" stroke="#668a9b" />
      <path d="M242 184L268 198H353L379 184M272 208H350" stroke="#c1b48f" strokeWidth="2" />
      <path d="M292 152V168M326 152V168" stroke="#f2ae63" strokeWidth="3" />
    </svg>
  );
}

function CourseMap({ track, hud, small = false, raiders = false }: { track: PodTrack; hud?: PodRaceState | null; small?: boolean; raiders?: boolean }) {
  const map = useMemo(() => {
    const frames = Array.from({ length: 129 }, (_, i) => track.sample((i / 128) * track.length));
    const xs = frames.map((p) => p.x);
    const zs = frames.map((p) => p.z);
    const loX = Math.min(...xs), hiX = Math.max(...xs), loZ = Math.min(...zs), hiZ = Math.max(...zs);
    const scale = 112 / Math.max(hiX - loX, hiZ - loZ, 1);
    const point = (x: number, z: number) => [66 + (x - (loX + hiX) / 2) * scale, 66 - (z - (loZ + hiZ) / 2) * scale];
    const at = (distance: number, lane = 0) => {
      const p = track.sample(distance);
      return point(p.x + Math.cos(p.heading) * lane, p.z - Math.sin(p.heading) * lane);
    };
    const path = (points: number[][]) => points.map((p, i) => `${i ? "L" : "M"}${p.map((v) => v.toFixed(1)).join(" ")}`).join(" ");
    return {
      at,
      road: path(frames.map((p) => point(p.x, p.z))) + "Z",
      branches: track.branches.map((branch) => path(Array.from({ length: 24 }, (_, i) => {
        const distance = branch.start + (branch.end - branch.start) * i / 23;
        return at(distance, branchOffset(branch, distance));
      }))),
    };
  }, [track]);
  const [sx, sy] = map.at(0);
  const [px, py] = hud ? map.at(hud.player.distance, hud.player.lane) : [sx, sy];
  return (
    <svg className={small ? styles.mapSmall : styles.map} viewBox="0 0 132 132" aria-label={`Tracé de ${track.name}`} role="img">
      <path d={map.road} className={styles.mapShadow} />
      <path d={map.road} className={styles.mapRoad} />
      {map.branches.map((path, i) => <path key={i} d={path} className={styles.mapBranch} />)}
      <rect x={sx - 2} y={sy - 2} width="4" height="4" rx=".5" className={styles.mapStart} />
      {hud?.opponents.map((opponent) => {
        const [x, y] = map.at(opponent.distance, opponent.lane);
        return <circle key={opponent.id} cx={x} cy={y} r="1.9" className={styles.mapRival} />;
      })}
      {raiders && track.raiders.map((raider, i) => {
        const [x, y] = map.at(raider.distance);
        return <path key={i} d={`M${x} ${y - 2.6}L${x + 2.3} ${y + 1.5}H${x - 2.3}Z`} className={styles.mapRaider} />;
      })}
      {hud && <circle cx={px} cy={py} r="3.2" className={styles.mapPilot} />}
    </svg>
  );
}

function Meter({ value, kind, label }: { value: number; kind: "heat" | "health" | "boost" | "drift"; label: string }) {
  const level = percent(value);
  return <span className={styles.meter} data-kind={kind} data-hot={kind === "heat" && level >= 82} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={level}>
    <i style={{ width: `${level}%` }} />
  </span>;
}

function EngineHud({ side, health, heat }: { side: string; health: number; heat: number }) {
  return <div className={styles.engine}>
    <span>{side} <strong>{percent(health)}%</strong></span>
    <Meter kind="health" value={health} label={`Intégrité moteur ${side}`} />
    <span className={styles.temp}><Thermometer size={11} /> <Meter kind="heat" value={heat} label={`Température moteur ${side}`} /></span>
  </div>;
}

export default function PodRacing({ reduced, sound, onQuit, onResult }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const mount = useRef<HTMLDivElement>(null);
  const stage = useRef<PodStage | null>(null);
  const profileRef = useRef<PodProfile>(emptyProfile());
  const [profile, setProfile] = useState(profileRef.current);
  const [tab, setTab] = useState<Tab>("race");
  const [mode, setMode] = useState<PodMode>("classic");
  const [difficulty, setDifficulty] = useState<PodDifficulty>("pilot");
  const [trackId, setTrackId] = useState<PodTrackId>("boonta");
  const [challengeId, setChallengeId] = useState<ChallengeId>("clean");
  const [showGhost, setShowGhost] = useState(true);
  const [quality, setQuality] = useState<Quality>("auto");
  const [camera, setCamera] = useState<CameraView>("chase");
  const [muted, setMuted] = useState(!sound);
  const [autoThrottle, setAutoThrottle] = useState(false);
  const autoThrottleRef = useRef(false);
  const [run, setRun] = useState<Run | null>(null);
  const [hud, setHud] = useState<PodRaceState | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  const heldKeys = useRef(new Map<string, Control>());
  const heldPointers = useRef(new Map<number, Control>());
  const live = useRef({ run, outcome, paused, failed, onQuit, onResult, camera, quality, muted });
  live.current = { run, outcome, paused, failed, onQuit, onResult, camera, quality, muted };

  useEffect(() => {
    // Credits live in the arcade's wallet: the profile only mirrors that balance, including what the
    // arcade pays at the end of a race.
    profileRef.current = { ...loadProfile(), credits: getArcade().credits };
    setProfile(profileRef.current);
    saveProfile(profileRef.current);
    let automatic = matchMedia("(pointer: coarse)").matches;
    try {
      const saved = localStorage.getItem("orbital-pod-auto-throttle");
      if (saved !== null) automatic = saved === "1";
    } catch { /* Touch defaults still work when storage is unavailable. */ }
    autoThrottleRef.current = automatic;
    setAutoThrottle(automatic);
    root.current?.focus({ preventScroll: true });
    return onArcadeChange(() => {
      const credits = getArcade().credits;
      if (credits === profileRef.current.credits) return;
      profileRef.current = { ...profileRef.current, credits };
      setProfile(profileRef.current);
      saveProfile(profileRef.current);
    });
  }, []);

  function updateProfile(next: PodProfile) {
    const spent = next.credits - profileRef.current.credits;
    profileRef.current = next;
    setProfile(next);
    saveProfile(next);
    adjustCredits(spent);
  }

  function clearControls() {
    heldKeys.current.clear();
    heldPointers.current.clear();
    stage.current?.setInput(neutralInput);
  }

  function syncControls() {
    const held = new Set([...heldKeys.current.values(), ...heldPointers.current.values()]);
    const input: PodInput = {
      steer: Number(held.has("right")) - Number(held.has("left")),
      throttle: (autoThrottleRef.current || held.has("throttle")) && !held.has("brake"), brake: held.has("brake"),
      boost: held.has("boost"), drift: held.has("drift"), repair: held.has("repair"),
    };
    stage.current?.setInput(input);
  }

  function changeAutoThrottle(value: boolean) {
    autoThrottleRef.current = value;
    setAutoThrottle(value);
    try { localStorage.setItem("orbital-pod-auto-throttle", value ? "1" : "0"); } catch { /* Keep the choice for this session. */ }
    if (!live.current.paused) syncControls();
  }

  function pause(value: boolean) {
    clearControls();
    live.current.paused = value;
    stage.current?.setPaused(value);
    setPaused(value);
    if (!value) syncControls();
  }

  function hangar() {
    clearControls();
    setRun(null);
    setHud(null);
    setOutcome(null);
    setPaused(false);
    setFailed(false);
    setTab("race");
  }

  function prepare(next: Run) {
    clearControls();
    setOutcome(null);
    setPaused(false);
    setFailed(false);
    setHud(null);
    setRun(next);
  }

  function start() {
    const id = mode === "championship" ? podTrackIds[0] : trackId;
    const active = profileRef.current;
    const selectedDifficulty = mode === "time" || mode === "challenge" ? "pilot" : difficulty;
    prepare({
      options: {
        track: tracks[id], mode, difficulty: selectedDifficulty, upgrades: { ...active.upgrades },
        laps: mode === "classic" || mode === "arcade" ? 2 : 1,
        // Fitted pod; raiders everywhere but the time trial, where a clean clock is the point.
        pod: { module: active.pod.module, color: podPaints[active.pod.paint].color },
        raiders: mode !== "time",
        ghost: mode === "time" && showGhost ? active.records[id]?.ghost : undefined,
        reduced, sound: !muted,
      },
      round: 0, cup: [], challenge: mode === "challenge" ? challengeId : undefined,
    });
  }

  function nextRound() {
    if (!run || !outcome || run.round >= podTrackIds.length - 1) return;
    const round = run.round + 1;
    prepare({ ...run, round, cup: outcome.cup, options: { ...run.options, track: tracks[podTrackIds[round]], sound: !muted } });
  }

  useEffect(() => {
    const element = mount.current;
    if (!run || !element) return;
    let active = true;
    let settled = false;
    const instance = mountPodRace(element, { ...run.options, sound: !live.current.muted }, {
      onState: (state) => { if (active) setHud(state); },
      onFinish: (result) => {
        if (!active || settled) return;
        settled = true;
        clearControls();
        const cup = run.options.mode === "championship" ? scoreRound(run.cup, result.standings, result.finished) : [];
        const cupIndex = cup.findIndex((entry) => entry.id === "player");
        const lastRound = run.round === podTrackIds.length - 1;
        const championshipPlace = lastRound && cupIndex !== -1 ? cupIndex + 1 : undefined;
        const { profile: updated, award } = registerRace(profileRef.current, result, {
          track: run.options.track.id, trial: run.options.mode === "time", challenge: run.challenge, championshipPlace,
        });
        updateProfile(updated);
        const challengePassed = challenges.find((challenge) => challenge.id === run.challenge)?.passed(result) ?? false;
        setOutcome({ result, award, cup, challengePassed });
        live.current.onResult?.(result);
      },
    });
    stage.current = instance;
    if (instance) {
      instance.setCamera(live.current.camera);
      instance.setQuality(live.current.quality);
      instance.setPaused(live.current.paused);
      if (!live.current.paused) syncControls();
    } else setFailed(true);
    return () => {
      active = false;
      clearControls();
      instance?.dispose();
      if (stage.current === instance) stage.current = null;
    };
  }, [run]);

  useEffect(() => { stage.current?.setSound(!muted); }, [muted]);
  useEffect(() => { stage.current?.setQuality(quality); }, [quality]);
  useEffect(() => { stage.current?.setCamera(camera); }, [camera]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const focus = root.current?.querySelector<HTMLElement>("[data-pod-autofocus]");
      (focus ?? root.current)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [run, paused, outcome, failed]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const down = event.type === "keydown";
      const name = event.key.toLowerCase();
      const current = live.current;
      if (name === "escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!down || event.repeat) return;
        if (!current.run) current.onQuit();
        else if (current.outcome || current.failed) hangar();
        else pause(!current.paused);
        return;
      }
      if (!current.run || current.outcome || current.failed) return;
      if (name === "c" && !current.paused) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (down && !event.repeat) setCamera((value) => value === "chase" ? "cockpit" : "chase");
        return;
      }
      const binding = controlKeys[name];
      if (!binding) return;
      const keyId = event.code || name;
      if (current.paused) {
        if (!down) heldKeys.current.delete(keyId);
        return;
      }
      if (name === " " && event.target instanceof HTMLButtonElement) {
        if (!down) {
          heldKeys.current.delete(keyId);
          syncControls();
        }
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (down) heldKeys.current.set(keyId, binding);
      else heldKeys.current.delete(keyId);
      syncControls();
    };
    const blur = () => {
      const current = live.current;
      if (current.run && !current.outcome && !current.failed && !current.paused) pause(true);
    };
    const visibility = () => { if (document.hidden) blur(); };
    window.addEventListener("keydown", key, true);
    window.addEventListener("keyup", key, true);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("keyup", key, true);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
      clearControls();
    };
  }, []);

  const press = (control: Control) => {
    const release = (event: PointerEvent<HTMLButtonElement>) => {
      heldPointers.current.delete(event.pointerId);
      syncControls();
    };
    return {
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        root.current?.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        heldPointers.current.set(event.pointerId, control);
        syncControls();
      },
      onPointerUp: release, onPointerCancel: release, onLostPointerCapture: release,
    };
  };

  const chosenTrack = tracks[mode === "championship" ? "boonta" : trackId];
  const track = run?.options.track ?? chosenTrack;
  const chosenMode = modes.find((option) => option.id === mode)!;
  const canAdvance = !!outcome && run?.options.mode === "championship" && run.round < podTrackIds.length - 1;
  const raceRecord = run ? profile.records[run.options.track.id] : undefined;
  const guidance = hud ? courseGuidance(track, hud) : null;
  const standings = hud ? nearbyStandings(hud) : [];

  return (
    <div ref={root} tabIndex={-1} className={`arcade-game pod-racing ${styles.root}`} aria-label="Podracing de Tatooine">
      {!run ? (
        <div className={styles.hangar}>
          <header className={styles.header}>
            <div className={styles.brand}><Flag size={18} /><span>GALACTIC ARCADE <i /> TATOOINE</span></div>
            <div className={styles.headerActions}>
              <span className={styles.credits}><b>{profile.credits.toLocaleString("fr-FR")}</b> CR</span>
              <button type="button" className={styles.iconButton} onClick={() => setMuted(!muted)} aria-label={muted ? "Activer le son" : "Couper le son"}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>
              <button type="button" className={styles.backButton} onClick={onQuit}><ArrowLeft size={16} /> Arcade</button>
            </div>
          </header>
          <main className={styles.menu}>
            <div className={styles.hero}>
              <div className={styles.heroTitle}><p className={styles.kicker}>SIMULATION 06 / MOS ESPA</p><h2>PODRACING</h2><p>Deux turbines. Une ligne d’arrivée.</p></div>
              <PodIllustration />
            </div>
            <nav className={styles.tabs} aria-label="Navigation du hangar">
              <button type="button" aria-pressed={tab === "race"} onClick={() => setTab("race")}><Flag size={16} /> Course</button>
              <button type="button" aria-pressed={tab === "hangar"} onClick={() => setTab("hangar")}><Wrench size={16} /> Atelier</button>
              <button type="button" aria-pressed={tab === "records"} onClick={() => setTab("records")}><Trophy size={16} /> Records</button>
            </nav>
            {tab === "race" && <div className={styles.raceMenu}>
              <section className={styles.menuPanel} aria-label="Format de course">
                <h3>Programme</h3>
                <div className={styles.modeList}>{modes.map((option, index) => (
                  <button type="button" key={option.id} aria-pressed={mode === option.id} onClick={() => setMode(option.id)}>
                    <span className={styles.index}>0{index + 1}</span><span>{option.name}</span><ChevronRight size={15} />
                  </button>
                ))}</div>
                <p className={styles.muted}>{chosenMode.description}</p>
                {mode !== "time" && mode !== "challenge" && <div className={styles.segment} aria-label="Difficulté">
                  {difficulties.map((option) => <button type="button" key={option.id} aria-pressed={difficulty === option.id} onClick={() => setDifficulty(option.id)}>{option.label}</button>)}
                </div>}
                {mode === "challenge" && <div className={styles.challengeList}>{challenges.map((option) => (
                  <button type="button" key={option.id} aria-pressed={challengeId === option.id} onClick={() => setChallengeId(option.id)}>
                    <strong>{option.name}</strong><small>{option.goal} {profile.challenges.includes(option.id) ? "Prime obtenue." : `+ ${option.credits} CR`}</small>
                  </button>
                ))}</div>}
              </section>
              <section className={styles.menuPanel} aria-label="Circuit de Tatooine">
                <h3>{mode === "championship" ? "Les trois manches" : "Sélection du circuit"}</h3>
                <div className={styles.courseGrid}>{podTrackIds.map((id, index) => (
                  <button key={id} type="button" disabled={mode === "championship"} aria-pressed={mode === "championship" || id === trackId} onClick={() => setTrackId(id)} className={styles.courseCard}>
                    <CourseMap track={tracks[id]} />
                    <span><small>0{index + 1} / {Math.round(tracks[id].length / 100) / 10} KM</small><strong>{tracks[id].name}</strong></span>
                  </button>
                ))}</div>
                <p className={styles.muted}>{mode === "championship" ? "Boonta, le circuit des Jawas, puis les dunes de nuit. Chaque arrivée rapporte des points." : chosenTrack.description}</p>
                {mode === "time" && <label className={styles.check}>
                  <input type="checkbox" checked={showGhost} disabled={!profile.records[trackId]?.ghost.length} onChange={(event) => setShowGhost(event.target.checked)} />
                  {profile.records[trackId]?.ghost.length ? `Fantôme du record · ${clockLabel(profile.records[trackId]!.time)}` : "Un premier chrono valide débloque le fantôme"}
                </label>}
                <label className={styles.check}>
                  <input type="checkbox" checked={autoThrottle} onChange={(event) => changeAutoThrottle(event.target.checked)} />
                  Accélération automatique · le frein reste prioritaire
                </label>
                <div className={styles.launchLine}>
                  <button type="button" className={styles.secondary} onClick={() => setQuality((q) => q === "auto" ? "low" : q === "low" ? "high" : "auto")}><Settings2 size={15} /> Qualité {qualityNames[quality]}</button>
                  <button type="button" className={styles.primary} onClick={start}><Play size={17} fill="currentColor" /> {mode === "championship" ? "Lancer la manche 1" : "Prendre le départ"}</button>
                </div>
              </section>
            </div>}
            {tab === "hangar" && <section className={styles.workshop} aria-label="Améliorations du pod">
              <div className={styles.sectionLead}><h3>Modules de course</h3><p className={styles.muted}>Chaque pilote de la grille court sur son propre module. Achetez celui de votre choix, chacun échange quelques pour cent d’une qualité contre une autre.</p></div>
              <div className={styles.garage}>
                <div className={styles.stand}>
                  <PodPreview module={profile.pod.module} color={podPaints[profile.pod.paint].color} reduced={reduced} className={styles.preview} />
                  <strong>{podModules[profile.pod.module].name}</strong>
                  <small>{podPaints[profile.pod.paint].name}</small>
                  <div className={styles.paints} role="group" aria-label="Peinture du pod">{podPaintIds.map((id: PodPaintId) => {
                    const paint = podPaints[id];
                    const owned = profile.owned.paints.includes(id);
                    return <button type="button" key={id} aria-pressed={profile.pod.paint === id} disabled={!owned && profile.credits < paint.cost}
                      title={owned ? paint.name : `${paint.name} · ${paint.cost} CR`} aria-label={owned ? paint.name : `Acheter ${paint.name}, ${paint.cost} crédits`}
                      data-owned={owned} style={{ background: `#${paint.color.toString(16).padStart(6, "0")}` }}
                      onClick={() => updateProfile(owned ? fitPaint(profileRef.current, id) : buyPaint(profileRef.current, id))}>{!owned && <small>{paint.cost}</small>}</button>;
                  })}</div>
                </div>
                <div className={styles.moduleGrid}>{podModuleIds.map((id: PodModuleId) => {
                  const item = podModules[id];
                  const owned = profile.owned.modules.includes(id);
                  const fitted = profile.pod.module === id;
                  return <article key={id} className={styles.part} data-fitted={fitted}>
                    <div><h4>{item.name}</h4><small className={styles.pilot}>Le pod de {item.pilot}</small><p>{item.lore}</p></div>
                    <p className={styles.traits}>{moduleTraits(item).join(" · ") || "Équilibré"}</p>
                    <button type="button" className={styles.secondary} disabled={fitted || (!owned && profile.credits < item.cost)}
                      onClick={() => updateProfile(owned ? fitModule(profileRef.current, id) : buyModule(profileRef.current, id))}>{fitted ? "Monté sur votre pod" : owned ? "Monter ce module" : `Acheter · ${item.cost} CR`}</button>
                  </article>;
                })}</div>
              </div>
              <div className={styles.sectionLead}><h3>Atelier du pod</h3><p className={styles.muted}>Les crédits remportés en course financent les pièces. Les gains s’appliquent dès le prochain départ.</p></div>
              <div className={styles.upgradeGrid}>{upgradeKeys.map((key) => {
                const level = profile.upgrades[key];
                const part = upgrades[key];
                const cost = upgradeCost(key, level);
                const maxed = level >= maxUpgrade;
                return <article key={key} className={styles.part}>
                  <div><h4>{part.name}</h4><p>{part.description}</p></div>
                  <div className={styles.levels} aria-label={`Niveau ${level} sur ${maxUpgrade}`}>{Array.from({ length: maxUpgrade }, (_, i) => <i key={i} data-active={i < level} />)}</div>
                  <div className={styles.comparison}><b>{part.value(level)}</b>{!maxed && <><ChevronRight size={13} /><strong>{part.value(level + 1)}</strong></>}</div>
                  <button type="button" className={styles.secondary} disabled={maxed || profile.credits < cost} onClick={() => updateProfile(buyUpgrade(profileRef.current, key))}>{maxed ? "Niveau maximal" : `Installer · ${cost} CR`}</button>
                </article>;
              })}</div>
            </section>}
            {tab === "records" && <section className={styles.workshop} aria-label="Records du pilote">
              <div className={styles.sectionLead}><h3>Carnet du pilote</h3><p className={styles.muted}>{profile.starts} résultats · {profile.wins} victoires · {profile.championships} championnats remportés</p></div>
              <div className={styles.recordGrid}>{podTrackIds.map((id) => <article key={id} className={styles.part}>
                <CourseMap track={tracks[id]} small /><h4>{tracks[id].name}</h4>
                <span className={styles.medal} data-level={profile.medals[id] ?? 0}><Trophy size={13} /> {profile.medals[id] ? `Médaille ${medalNames[profile.medals[id]!]}` : "Pas encore de médaille"}</span>
                <small>Meilleur tour : Bronze {clockLabel(medalTime(id, 1))} · Argent {clockLabel(medalTime(id, 2))} · Or {clockLabel(medalTime(id, 3))}</small>
                <strong className={styles.recordTime}>{profile.records[id] ? clockLabel(profile.records[id]!.time) : "—"}</strong>
                <small>{profile.records[id]?.ghost.length ? "Fantôme enregistré" : "Record en contre-la-montre"}</small>
                <ol className={styles.board} aria-label={`Tableau des meilleurs tours, ${tracks[id].name}`}>{boardFor(profile, id).map((row, index) => (
                  <li key={`${row.name}-${row.time}`} data-player={row.player}>
                    <span>{index + 1}</span><b>{row.name}</b><small>{podModules[row.module].name}</small><span>{clockLabel(row.time)}</span>
                  </li>
                ))}</ol>
              </article>)}</div>
              <div className={styles.badges}>{challenges.map((challenge) => <span key={challenge.id} data-complete={profile.challenges.includes(challenge.id)}><Trophy size={14} />{challenge.name} <small>{profile.challenges.includes(challenge.id) ? "Validé" : "À relever"}</small></span>)}</div>
            </section>}
            <p className={styles.guide}><kbd>Z / W / ↑</kbd> Accélérer <kbd>Q / A / ←</kbd> Gauche <kbd>D / →</kbd> Droite <kbd>S / ↓</kbd> Freiner <kbd>Espace</kbd> Boost <kbd>Maj</kbd> Déraper <kbd>R</kbd> Réparer <kbd>C</kbd> Caméra</p>
          </main>
        </div>
      ) : (
        <div className={styles.race}>
          <div ref={mount} className={styles.canvas} aria-hidden="true" />
          {hud?.player.boosting && !reduced && <div className={styles.boostFx} aria-hidden="true" />}
          <div className={styles.raceHud} inert={paused || !!outcome || failed}>
            <div className={styles.raceTop}>
              <div className={styles.raceLabel}><p className={styles.kicker}>TATOOINE / {run.options.mode === "championship" ? `MANCHE ${run.round + 1}/3` : "COURSE"}</p><strong>{track.name}</strong></div>
              <div className={styles.timing}>
                <div><span>POSITION</span><b>{hud?.position ?? "—"}<small>/{(hud?.opponents.length ?? 0) + 1}</small></b></div>
                <div><span>TOUR</span><b>{hud?.lap ?? 1}<small>/{run.options.laps}</small></b></div>
                <div><span>CHRONO</span><b>{clockLabel(hud?.time ?? 0)}</b></div>
              </div>
              <div className={styles.raceControls} onClick={(event) => {
                // Pointer users return to the driving keys; keyboard users keep button focus.
                if (event.detail > 0 && !live.current.paused) root.current?.focus({ preventScroll: true });
              }}>
                <button type="button" className={styles.iconButton} aria-label={camera === "chase" ? "Vue cockpit" : "Vue extérieure"} onClick={() => setCamera(camera === "chase" ? "cockpit" : "chase")}><Camera size={18} /></button>
                <button type="button" className={styles.iconButton} aria-label={muted ? "Activer le son" : "Couper le son"} onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
                <button type="button" className={styles.iconButton} aria-label="Pause" onClick={() => pause(true)}><Pause size={18} /></button>
              </div>
            </div>
            {guidance && <div className={styles.routeGuide} data-sharp={guidance.sharp}>
              <span className={styles.routeArrow} aria-hidden="true">{guidance.direction === "left" ? <ArrowLeft /> : guidance.direction === "right" ? <ArrowRight /> : <ArrowUp />}</span>
              <div><small>{guidance.sectorLabel}</small><strong>{guidance.turnLabel}</strong>
                <span>{guidance.direction === "straight" ? "Gardez votre trajectoire" : guidance.distance < 15 ? "MAINTENANT" : `DANS ${Math.round(guidance.distance / 10) * 10} M`}</span></div>
            </div>}
            {standings.length > 1 && <ol className={styles.liveStandings} aria-label="Classement et écarts en mètres">
              {standings.map((entry) => <li key={entry.id} data-player={entry.id === "player"}>
                <span>{entry.position.toString().padStart(2, "0")}</span><b>{entry.name}</b><small>{entry.gapLabel}</small>
              </li>)}
            </ol>}
            {hud?.phase === "countdown" && <div className={styles.countdown}><span>MOTEURS AU RALENTI</span><strong>{Math.max(1, Math.ceil(hud.countdown))}</strong><small>{autoThrottle ? "Accélération automatique activée" : "Maintenez l’accélérateur au départ"}</small></div>}
            {hud?.phase === "racing" && hud.time < 0.7 && <div className={styles.countdown} aria-hidden="true"><strong>GO</strong></div>}
            {!hud && !failed && <div className={styles.countdown} role="status"><span>MISE EN GRILLE</span></div>}
            {hud?.alert && <p className={styles.alert} role="status">{hud.alert}</p>}
            <div className={styles.raceBottom}>
              <div className={styles.engineCluster}>
                <p className={styles.kicker}>TURBINES</p>
                <div className={styles.enginePair}>
                  <EngineHud side="G" health={hud?.player.health[1] ?? 1} heat={hud?.player.heat[1] ?? 0} />
                  <EngineHud side="D" health={hud?.player.health[0] ?? 1} heat={hud?.player.heat[0] ?? 0} />
                </div>
                <small>{hud?.player.repairing ? "RÉPARATION EN COURS" : "R · RÉPARER"}</small>
                {autoThrottle && <span className={styles.autoBadge}>ACCÉLÉRATION AUTO</span>}
              </div>
              <div className={styles.speedCluster}>
                <div className={styles.speed}><strong>{Math.round((hud?.player.speed ?? 0) * 3.6)}</strong><span>KM/H</span></div>
                <div className={styles.boost}><Zap size={13} /><Meter value={hud?.player.boost ?? 1} kind="boost" label="Réserve de boost" /></div>
                <div className={styles.drift}><span>{hud?.player.miniTurbo ? "MINI-TURBO" : hud?.player.slipstream && hud.player.slipstream > 0.4 ? "ASPIRATION" : "DÉRAPAGE"}</span><Meter value={hud?.player.driftCharge ?? 0} kind="drift" label="Charge de dérapage" /></div>
              </div>
              <div className={styles.navigation}><CourseMap track={track} hud={hud} small raiders={run.options.raiders} />
                <div className={styles.lapProgress} role="progressbar" aria-label="Progression du tour" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent(guidance?.progress ?? 0)}><i style={{ width: `${percent(guidance?.progress ?? 0)}%` }} /></div>
                <small>{run.options.mode === "time" && raceRecord ? `RECORD ${clockLabel(raceRecord.time)}` : `TOUR ${percent(guidance?.progress ?? 0)} %`}</small></div>
            </div>
            <div className={styles.touch}>
              <div>
                <button type="button" aria-label="Tourner à gauche" {...press("left")}><ArrowLeft /></button>
                <button type="button" aria-label="Tourner à droite" {...press("right")}><ArrowRight /></button>
                <button type="button" aria-label="Déraper" {...press("drift")}>DRIFT</button>
              </div>
              <div>
                <button type="button" aria-label="Réparer" {...press("repair")}><Wrench /></button>
                <button type="button" aria-label="Boost" {...press("boost")}><Zap /></button>
                <button type="button" aria-label="Freiner" {...press("brake")}><ArrowDown /></button>
                <button type="button" aria-label="Accélérer" {...press("throttle")}><ArrowUp /></button>
              </div>
            </div>
          </div>
          {(paused || failed || outcome) && <div className={styles.shade}>
            <section className={styles.dialog} aria-label={failed ? "Erreur de simulation" : outcome ? "Résultats de la course" : "Course en pause"}>
              <p className={styles.kicker}>GALACTIC ARCADE / {track.name}</p>
              {failed ? <>
                <h2>Simulation indisponible</h2><p>Le moteur 3D n’a pas pu démarrer sur cet appareil.</p>
                <button type="button" data-pod-autofocus className={styles.primary} onClick={hangar}><ArrowLeft size={16} /> Retour au hangar</button>
              </> : outcome ? <>
                <h2>{outcome.result.finished ? "Arrivée" : "Pod hors service"}</h2>
                <div className={styles.resultMetrics}>
                  <div><span>CHRONO</span><strong>{clockLabel(outcome.result.time)}</strong></div>
                  <div><span>POSITION</span><strong>{outcome.result.finished ? `#${outcome.result.position}` : "DNF"}</strong></div>
                  <div><span>CRÉDITS</span><strong>+{outcome.award.credits}</strong></div>
                </div>
                <p className={styles.muted}>{outcome.result.crashes} chocs · {outcome.result.miniTurbos} mini-turbos · {outcome.result.shortcuts} raccourcis · {outcome.result.dodges} tirs évités{outcome.result.bestLap ? ` · Tour ${clockLabel(outcome.result.bestLap)}` : ""}</p>
                {outcome.award.medal > 0 && <p className={styles.medal} data-level={outcome.award.medal}><Trophy size={14} /> Médaille {medalNames[outcome.award.medal]}{outcome.award.improved ? " · Nouvelle médaille sur ce circuit" : ""}</p>}
                {outcome.award.rank !== null && <p className={styles.muted}>Tableau de Mos Espa : {outcome.award.rank}ᵉ place avec ce tour</p>}
                {outcome.award.record && <p className={styles.success}>Nouveau record personnel · Fantôme sauvegardé</p>}
                {run.challenge && <p className={outcome.challengePassed ? styles.success : styles.muted}>{outcome.challengePassed ? outcome.award.challenge ? "Défi validé · Prime créditée" : "Défi validé · Prime déjà obtenue" : "Objectif du défi non atteint"}</p>}
                {outcome.cup.length > 0 ? <div className={styles.standings}>
                  <h3>{canAdvance ? `Général après la manche ${run.round + 1}` : "Classement final du championnat"}</h3>
                  {outcome.cup.map((entry, index) => <div key={entry.id} data-player={entry.id === "player"}><span>{index + 1}</span><b>{entry.name}</b><span>{entry.points} PTS</span></div>)}
                </div> : outcome.result.standings.length > 1 && <div className={styles.standings}>
                  <h3>Classement de la course</h3>
                  {outcome.result.standings.map((entry) => <div key={entry.id} data-player={entry.id === "player"}><span>{entry.position}</span><b>{entry.name}</b><span>{entry.time === null ? "—" : clockLabel(entry.time)}</span></div>)}
                </div>}
                <div className={styles.dialogActions}>
                  <button type="button" className={styles.secondary} onClick={hangar}><ArrowLeft size={16} /> Hangar</button>
                  {canAdvance ? <button type="button" data-pod-autofocus className={styles.primary} onClick={nextRound}>Manche suivante <ChevronRight size={16} /></button>
                    : <button type="button" data-pod-autofocus className={styles.primary} onClick={start}><RotateCcw size={15} /> Rejouer</button>}
                </div>
              </> : <>
                <h2>Course en pause</h2>
                <p>Le chrono et les moteurs sont à l’arrêt.</p>
                <label className={styles.check}><input type="checkbox" checked={autoThrottle} onChange={(event) => changeAutoThrottle(event.target.checked)} /> Accélération automatique</label>
                <div className={styles.dialogActions}>
                  <button type="button" className={styles.secondary} onClick={hangar}><ArrowLeft size={16} /> Hangar</button>
                  <button type="button" className={styles.secondary} onClick={() => prepare({ ...run })}><RotateCcw size={16} /> Recommencer</button>
                  <button type="button" data-pod-autofocus className={styles.primary} onClick={() => pause(false)}><Play size={16} /> Reprendre</button>
                </div>
              </>}
            </section>
          </div>}
        </div>
      )}
    </div>
  );
}
