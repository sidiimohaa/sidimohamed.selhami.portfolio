"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Play, RotateCcw } from "lucide-react";
import { createArcadeAudio, type ArcadeAudio } from "../arcade/arcadeAudio";
import { recordResult, type GameResult, type ResultSummary } from "../arcade/arcadeStore";
import type { CockpitGameRuntime, CockpitGameView } from "../arcade/cockpitGames";
import { LostCard, LostHeader, type Collection } from "./LostFrame";

const ArcadeGameHUD = dynamic(() => import("../arcade/ArcadeGameHUD"), { ssr: false });

// The 404 page: a hyperspace jump that goes wrong drops the X-wing into an uncharted asteroid
// field. The visitor can fly Galactic Arcade's Asteroid Survival from the cockpit to find the way
// back (the run counts in the arcade), or go straight home; the CV and contact stay one click away.

type Phase = "jump" | "briefing" | "playing" | "result";
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

export default function LostSector({ collection }: { collection?: Collection }) {
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

  // The cockpit and its starfield, loaded behind the failed jump. three.js comes with them, after
  // the briefing is already readable.
  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    let removed = false,
      created: { dispose: () => void } | null = null;
    import("./lostScene")
      .then(({ createLostScene }) => {
        if (removed) return;
        const lost = createLostScene(el, {
          runtime,
          audio,
          reduced: () => live.current.reduced,
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
        if (!lost) {
          setGraphics(false);
          return;
        }
        created = lost;
        scene.current = lost;
      })
      .catch(() => {
        if (!removed) setGraphics(false);
      });
    return () => {
      removed = true;
      window.clearTimeout(finishTimer.current);
      created?.dispose();
      scene.current = null;
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
      <LostHeader sound={sound} onSound={() => setSound((on) => !on)} collection={collection} />

      {phase === "briefing" && (
        <LostCard
          kicker="ERREUR 404 · SECTEUR NON CARTOGRAPHIÉ"
          title="Cette page s’est perdue dans un champ d’astéroïdes."
          path={path}
          primary={
            graphics ? (
              <button className="is-primary" onClick={play}>
                <Play size={16} /> Traverser le champ d’astéroïdes
              </button>
            ) : undefined
          }
          extra={graphics ? <p className="lost-hint mono">SOURIS, DOIGT OU ZQSD · ESPACE : POUSSÉE · ÉCHAP : PAUSE · SURVIVEZ 90 S</p> : undefined}
        >
          <p>Votre saut n’a mené nulle part : la page n’existe pas, ou plus. Pour retrouver la route, traversez le champ… ou rentrez directement.</p>
        </LostCard>
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
        <LostCard
          kicker={result.won ? "ROUTE RETROUVÉE" : "COQUE DÉTRUITE"}
          title={result.won ? "Vous êtes sorti du champ. Cap sur ORBITAL." : "Le champ a eu raison de la coque."}
          titleId="lost-result"
          path={path}
          homePrimary={result.won}
          primary={
            <button className={result.won ? "" : "is-primary"} onClick={play}>
              <RotateCcw size={16} /> Rejouer
            </button>
          }
        >
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
        </LostCard>
      )}

      {phase === "jump" && <JumpIntro reduced={reduced} onDone={() => setPhase("briefing")} />}
    </main>
  );
}
