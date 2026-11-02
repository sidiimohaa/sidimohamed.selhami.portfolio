"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Download, Home, Mail, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import * as THREE from "three";
import { createCockpitModel } from "../cockpitModel";
import { createCockpitSystems } from "../cockpitSystems";
import { createStarfield } from "../spaceAmbience";
import { createArcadeAudio, type ArcadeAudio } from "../arcade/arcadeAudio";
import { equippedValue, getArcade, recordResult, type GameResult, type ResultSummary } from "../arcade/arcadeStore";
import type { CockpitGameRuntime, CockpitGameView } from "../arcade/cockpitGames";
import { CV_PDF, identity } from "../deathStar/cvData";

const ArcadeGameHUD = dynamic(() => import("../arcade/ArcadeGameHUD"), { ssr: false });

// The 404 page: a hyperspace jump that goes wrong drops the X-wing into an uncharted asteroid
// field. The visitor can fly Galactic Arcade's Asteroid Survival from the cockpit to find the way
// back (the run counts in the arcade), or go straight home; the CV and contact stay one click away.

type Phase = "jump" | "briefing" | "playing" | "result";
const mail = `mailto:${identity.email}?subject=${encodeURIComponent("Contact depuis ORBITAL")}`;
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;

// The jump that fails: streaks rush outwards, stutter, then snap into still stars.
function JumpIntro({ reduced, onDone }: { reduced: boolean; onDone: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const [alarm, setAlarm] = useState(false);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ctx = element.getContext("2d", { alpha: false })!;
    const DURATION = reduced ? 0.9 : 3.4;
    let width = 1,
      height = 1,
      frame = 0,
      start = performance.now(),
      alarmed = false;
    const stars = Array.from({ length: 420 }, () => ({ angle: Math.random() * Math.PI * 2, depth: 0.05 + Math.random() * 0.95, tint: Math.random() }));
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio, 2);
      width = element.clientWidth;
      height = element.clientHeight;
      element.width = width * ratio;
      element.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      ctx.fillStyle = "#02060b";
      ctx.fillRect(0, 0, width, height);
      const cx = width / 2,
        cy = height / 2,
        reach = Math.hypot(cx, cy);
      // Speed builds, falters around the failure, then drops to nothing.
      const speed = reduced ? 0 : t < 1.4 ? t / 1.4 : t < 2.1 ? 1 - (t - 1.4) * 0.4 + Math.sin(t * 60) * 0.25 : Math.max(0, 0.72 - (t - 2.1) * 1.4);
      const shake = !reduced && t > 1.5 && t < 2.3 ? (Math.random() - 0.5) * 14 : 0;
      stars.forEach((star) => {
        const r = (star.depth * 0.9 + 0.08) * reach;
        const tail = speed * reach * 0.42 * star.depth;
        const x = cx + shake + Math.cos(star.angle) * r,
          y = cy + shake + Math.sin(star.angle) * r;
        ctx.strokeStyle = star.tint > 0.85 ? "rgba(255,190,150,.9)" : "rgba(190,225,255,.85)";
        ctx.lineWidth = 0.6 + star.depth * 1.4;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(star.angle) * tail, y - Math.sin(star.angle) * tail);
        ctx.lineTo(x + 0.6, y + 0.6);
        ctx.stroke();
      });
      if (!reduced && t > 1.5 && t < 2.4 && Math.sin(t * 40) > 0.4) {
        ctx.fillStyle = "rgba(255,60,40,.12)";
        ctx.fillRect(0, 0, width, height);
      }
      if (t > (reduced ? 0 : 1.55) && !alarmed) {
        alarmed = true;
        setAlarm(true);
      }
      if (t >= DURATION) {
        done.current();
        return;
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [reduced]);
  return (
    <div className="lost-jump" role="status" aria-live="polite">
      <canvas ref={canvas} aria-hidden="true" />
      <div className={`lost-jump-alarm ${alarm ? "is-on" : ""}`}>
        <span className="mono">ALERTE NAVIGATION</span>
        <strong>SAUT INTERROMPU</strong>
        <em className="mono">ERREUR 404 · COORDONNÉES INTROUVABLES</em>
      </div>
      <button className="lost-skip mono" onClick={() => done.current()}>
        PASSER
      </button>
    </div>
  );
}

export default function LostSector() {
  const mount = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("jump");
  const [reduced, setReduced] = useState(false);
  const [path, setPath] = useState("");
  const [graphics, setGraphics] = useState(true);
  const [sound, setSound] = useState(false);
  const [view, setView] = useState<CockpitGameView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ResultSummary | null>(null);
  const runtime = useRef<CockpitGameRuntime | null>(null);
  const audio = useRef<ArcadeAudio | null>(null);
  const scene = useRef<{ start: () => Promise<void>; stop: () => void } | null>(null);
  const finishTimer = useRef(0);
  const live = useRef({ reduced });
  live.current = { reduced };

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setPath(decodeURIComponent(window.location.pathname));
  }, []);

  // The cockpit and its starfield, loaded behind the failed jump.
  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      setGraphics(false);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 600 ? 1.75 : 2));
    renderer.setClearColor(0x03080e, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.setAttribute("aria-hidden", "true");
    el.append(renderer.domElement);
    const world = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, 1, 0.05, 600);
    const cockpit = createCockpitModel();
    const systems = createCockpitSystems();
    cockpit.add(systems.group);
    const stars = createStarfield(renderer.getPixelRatio());
    world.add(cockpit, stars.points);
    world.add(new THREE.HemisphereLight(0x8da9c9, 0x151b26, 1.5));
    const key = new THREE.DirectionalLight(0xd3c4ad, 2.6);
    key.position.set(-2, 4, 4);
    world.add(key);
    // Warning lights: the cabin glows red until the visitor takes the controls.
    const alert = new THREE.PointLight(0xff4a3a, 4, 7, 2);
    alert.position.set(0, 2.2, 1.2);
    world.add(alert);
    const fill = new THREE.PointLight(0x709cc6, 4, 7, 2);
    fill.position.set(1.6, 2.2, 1.4);
    world.add(fill);
    const eye = new THREE.Vector3(0, 1.55, 2.9),
      look = new THREE.Vector3(0, 1.35, -3.4);
    const resize = () => {
      const w = el.clientWidth || window.innerWidth,
        h = el.clientHeight || window.innerHeight;
      camera.aspect = w / Math.max(h, 1);
      if (!runtime.current) camera.fov = camera.aspect < 0.8 ? 58 : 52;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    let generation = 0,
      removed = false;
    scene.current = {
      start: async () => {
        const token = ++generation;
        const module = await import("../arcade/cockpitGames");
        if (removed || token !== generation) return;
        runtime.current?.dispose();
        runtime.current = module.createCockpitGame({
          kind: "asteroid-survival",
          scene: world,
          camera,
          reduced: live.current.reduced,
          audio: audio.current,
          trail: equippedValue(getArcade(), "engine"),
          onView: setView,
          onFinish: (result: GameResult) => {
            const saved = recordResult(result);
            window.clearTimeout(finishTimer.current);
            finishTimer.current = window.setTimeout(
              () => {
                scene.current?.stop();
                setSummary(saved);
                setPhase("result");
              },
              live.current.reduced ? 900 : 2600,
            );
          },
        });
      },
      stop: () => {
        generation++;
        runtime.current?.dispose();
        runtime.current = null;
        setView(null);
        resize();
      },
    };
    let frame = 0,
      last = performance.now(),
      age = 0;
    const animate = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      age += dt;
      const still = live.current.reduced;
      // At rest the cockpit drifts a little; in the game the runtime moves the ship.
      camera.position.set(still || runtime.current ? 0 : Math.sin(age * 0.4) * 0.03, eye.y, eye.z);
      camera.lookAt(look);
      camera.updateMatrixWorld();
      alert.intensity = runtime.current ? 0 : still ? 2 : 2 + Math.max(0, Math.sin(age * 4)) * 4;
      systems.tick(age, 0, still);
      stars.tick(age, still);
      runtime.current?.tick(dt, still);
      renderer.render(world, camera);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      removed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.clearTimeout(finishTimer.current);
      runtime.current?.dispose();
      runtime.current = null;
      scene.current = null;
      world.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material;
        if (material) (Array.isArray(material) ? material : [material]).forEach((item) => item.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    audio.current?.setEnabled(sound);
  }, [sound]);
  useEffect(() => () => audio.current?.dispose(), []);

  const play = async () => {
    if (!scene.current) return;
    if (!audio.current) audio.current = createArcadeAudio();
    audio.current.setEnabled(sound);
    setSummary(null);
    setError(null);
    setPhase("playing");
    setLoading(true);
    try {
      await scene.current.start();
    } catch {
      setError("La simulation n’a pas pu se charger. Revenez au briefing, ou rentrez directement.");
    } finally {
      setLoading(false);
    }
  };
  const backToBriefing = () => {
    window.clearTimeout(finishTimer.current);
    scene.current?.stop();
    setPhase("briefing");
  };

  const result = summary?.result;
  const earned = summary?.credits.reduce((sum, item) => sum + item.amount, 0) ?? 0;
  return (
    <main className="lost-sector" data-phase={phase}>
      <div ref={mount} className="lost-stage" />
      <div className="lost-vignette" aria-hidden="true" />
      <header className="lost-head">
        <a className="lost-logo" href="/" aria-label="Revenir à l’accueil d’ORBITAL">
          ORBITAL<sup>404</sup>
        </a>
        <button className="lost-sound" onClick={() => setSound((on) => !on)} aria-pressed={sound} aria-label={sound ? "Couper le son" : "Activer le son"}>
          {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      </header>

      {phase === "briefing" && (
        <section className="lost-card" aria-labelledby="lost-title">
          <span className="mono">ERREUR 404 · SECTEUR NON CARTOGRAPHIÉ</span>
          <h1 id="lost-title">Cette page s’est perdue dans un champ d’astéroïdes.</h1>
          <p>
            Votre saut vers <code>{path || "cette adresse"}</code> n’a mené nulle part : la page n’existe pas, ou plus. Pour retrouver la route, traversez le champ… ou rentrez directement.
          </p>
          <div className="lost-actions">
            {graphics && (
              <button className="is-primary" onClick={play}>
                <Play size={16} /> Traverser le champ d’astéroïdes
              </button>
            )}
            <a href="/">
              <Home size={16} /> Retour à ORBITAL
            </a>
          </div>
          {graphics && <p className="lost-hint mono">SOURIS, DOIGT OU ZQSD · ESPACE : POUSSÉE · ÉCHAP : PAUSE · SURVIVEZ 90 S</p>}
          <nav className="lost-links" aria-label="Accès directs">
            <a href={CV_PDF} download>
              <Download size={14} /> Télécharger mon CV
            </a>
            <a href={mail}>
              <Mail size={14} /> Me contacter
            </a>
          </nav>
        </section>
      )}

      {phase === "playing" && (
        <ArcadeGameHUD
          view={view}
          loading={loading}
          error={error}
          quitLabel="RETOUR AU BRIEFING"
          onAim={(x, y) => runtime.current?.setAim(x, y)}
          onRelease={() => runtime.current?.releaseAim()}
          onFire={(held) => runtime.current?.setFiring(held)}
          onTorpedo={() => runtime.current?.torpedo()}
          onDodge={() => runtime.current?.dodge()}
          onKey={(key, pressed) => runtime.current?.key(key, pressed)}
          onTogglePause={() => runtime.current?.togglePause()}
          onResume={() => runtime.current?.resume()}
          onRestart={() => runtime.current?.restart()}
          onExtract={() => runtime.current?.extract()}
          onQuit={backToBriefing}
        />
      )}

      {phase === "result" && result && (
        <section className="lost-card" aria-labelledby="lost-result">
          <span className="mono">{result.won ? "ROUTE RETROUVÉE" : "COQUE DÉTRUITE"}</span>
          <h1 id="lost-result">{result.won ? "Vous êtes sorti du champ. Cap sur ORBITAL." : "Le champ a eu raison de la coque."}</h1>
          <dl className="lost-score">
            <div>
              <dt>Score</dt>
              <dd>{result.score.toLocaleString("fr-FR")}</dd>
            </div>
            <div>
              <dt>Survie</dt>
              <dd>{clock(result.survived ?? result.seconds)}</dd>
            </div>
            <div>
              <dt>Crédits</dt>
              <dd>+{earned.toLocaleString("fr-FR")}</dd>
            </div>
          </dl>
          <p className="lost-note">
            {summary?.record ? "Nouveau record ! " : ""}Ce vol compte dans la Galactic Arcade, accessible depuis le cockpit d’ORBITAL.
          </p>
          <div className="lost-actions">
            <a className={result.won ? "is-primary" : ""} href="/">
              <Home size={16} /> Retour à ORBITAL
            </a>
            <button className={result.won ? "" : "is-primary"} onClick={play}>
              <RotateCcw size={16} /> Rejouer
            </button>
          </div>
          <nav className="lost-links" aria-label="Accès directs">
            <a href={CV_PDF} download>
              <Download size={14} /> Télécharger mon CV
            </a>
            <a href={mail}>
              <Mail size={14} /> Me contacter
            </a>
          </nav>
        </section>
      )}

      {phase === "jump" && <JumpIntro reduced={reduced} onDone={() => setPhase("briefing")} />}
    </main>
  );
}
