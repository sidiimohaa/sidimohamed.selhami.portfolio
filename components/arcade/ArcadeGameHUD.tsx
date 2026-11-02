"use client";
import { useEffect, useRef } from "react";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import type { CockpitGameView } from "./cockpitGames";

// The heads-up display for the two simulations flown from the cockpit: shields and hull, score,
// the sights, radio chatter, and the pause screen. Pointer and keyboard input go straight to the
// runtime through the callbacks.

type Props = {
  view: CockpitGameView | null;
  loading: boolean;
  error: string | null;
  onAim: (x: number, y: number) => void;
  onRelease: () => void;
  onFire: (held: boolean) => void;
  onTorpedo: () => void;
  onDodge: () => void;
  onKey: (key: string, pressed: boolean) => void;
  onTogglePause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onExtract: () => void;
  onQuit: () => void;
  // Where quitting leads, for the pause screen (the arcade console by default).
  quitLabel?: string;
};

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
const KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "a", "d", "w", "s", "q", "z", "f", " ", "Enter"];

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className={value < 25 ? "low" : ""}>
      <span>
        {label}
        <em>{value} %</em>
      </span>
      <i>
        <b style={{ width: `${value}%` }} />
      </i>
    </div>
  );
}

export default function ArcadeGameHUD({ view, loading, error, onAim, onRelease, onFire, onTorpedo, onDodge, onKey, onTogglePause, onResume, onRestart, onExtract, onQuit, quitLabel = "RETOUR À LA CONSOLE" }: Props) {
  const area = useRef<HTMLDivElement>(null);
  const live = useRef({ onKey, onTogglePause });
  live.current = { onKey, onTogglePause };
  const space = view?.kind === "space-battle";

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Tab") return;
      const element = event.target instanceof Element ? event.target : null;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.type === "keydown" && !event.repeat) live.current.onTogglePause();
        return;
      }
      if (element?.closest("button,a") && [" ", "Enter"].includes(event.key)) return;
      const k = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (!KEYS.includes(k)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.type === "keydown" && event.repeat && k === " ") return;
      live.current.onKey(k, event.type === "keydown");
    };
    window.addEventListener("keydown", key, true);
    window.addEventListener("keyup", key, true);
    return () => {
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("keyup", key, true);
    };
  }, []);

  const point = (event: React.PointerEvent) => {
    const bounds = area.current?.getBoundingClientRect();
    if (!bounds) return;
    onAim(((event.clientX - bounds.left) / bounds.width) * 2 - 1, 1 - ((event.clientY - bounds.top) / bounds.height) * 2);
  };

  return (
    <section className="arcade-hud arcade-game" aria-label={space ? "Space Battle" : "Asteroid Survival"}>
      <div
        ref={area}
        className="arcade-hud-aim"
        onPointerMove={(event) => {
          // A finger only steers while it touches the glass; a mouse steers by hovering.
          if (event.pointerType === "mouse" || event.buttons) point(event);
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          point(event);
          if (space && event.button === 0) onFire(true);
        }}
        onPointerUp={() => {
          onFire(false);
          if (!space) onRelease();
        }}
        onPointerCancel={() => {
          onFire(false);
          onRelease();
        }}
        onContextMenu={(event) => event.preventDefault()}
      />
      {view && (
        <>
          <div className="arcade-hud-top">
            <div className="arcade-hud-meters">
              <Meter label="BOUCLIERS" value={view.shields} />
              <Meter label="COQUE" value={view.hull} />
              {space && (
                <div>
                  <span>
                    TORPILLES À PROTONS<em>{"●".repeat(view.torpedoes)}{"○".repeat(3 - view.torpedoes)}</em>
                  </span>
                </div>
              )}
              {!space && (
                <div>
                  <span>
                    POUSSÉE D’URGENCE<em>{view.dodge > 0 ? `${view.dodge.toFixed(1)} s` : "PRÊTE"}</em>
                  </span>
                </div>
              )}
            </div>
            <div className="arcade-hud-score" aria-live="off">
              <strong>{view.score.toLocaleString("fr-FR")}</strong>
              <span className="mono">
                {space ? `VAGUE ${Math.max(1, view.wave)}/${view.waves} · ${view.remaining} TIE` : `${clock(view.time)} · OBJECTIF ${view.goal} s`}
              </span>
              {!space && view.combo > 1 && <span className="mono">COMBO ×{view.combo}</span>}
            </div>
            <div className="arcade-hud-controls">
              <button onClick={onTogglePause} aria-label={view.phase === "paused" ? "Reprendre" : "Mettre en pause"}>
                {view.phase === "paused" ? <Play size={14} /> : <Pause size={14} />}
                <span>PAUSE</span>
              </button>
              <button onClick={onQuit} aria-label="Quitter la simulation">
                <X size={14} />
                <span>QUITTER</span>
              </button>
            </div>
          </div>
          {space && <div className={`arcade-hud-reticle ${view.locked ? "locked" : ""}`} style={{ left: `${(view.aim[0] * 0.5 + 0.5) * 100}%`, top: `${(-view.aim[1] * 0.5 + 0.5) * 100}%` }} aria-hidden="true" />}
          {view.message && <p className="arcade-hud-message">{view.message}</p>}
          {view.banner && (
            <div className="arcade-hud-banner" role="status">
              {view.banner}
              {view.subtitle && <small>{view.subtitle}</small>}
            </div>
          )}
          {view.phase === "playing" && (
            <div className="arcade-hud-actions">
              {space ? (
                <button onClick={onTorpedo} disabled={view.torpedoes === 0}>
                  TORPILLE {view.locked ? "· CIBLE VERROUILLÉE" : ""} <kbd>ESPACE</kbd>
                </button>
              ) : (
                <button onClick={onDodge} disabled={view.dodge > 0}>
                  POUSSÉE <kbd>ESPACE</kbd>
                </button>
              )}
              {view.canExtract && <button onClick={onExtract}>SE RETIRER ET VALIDER</button>}
            </div>
          )}
          {space && view.phase === "playing" && (
            <button
              className="arcade-hud-fire"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                onFire(true);
              }}
              onPointerUp={() => onFire(false)}
              onPointerCancel={() => onFire(false)}
              aria-label="Tirer"
            >
              FEU
            </button>
          )}
          {view.hurt > 0.02 && <div className="arcade-hud-hurt" style={{ opacity: view.hurt }} aria-hidden="true" />}
          {view.phase === "paused" && (
            <div className="arcade-hud-end">
              <section role="dialog" aria-label="Pause">
                <h2>PAUSE</h2>
                <div>
                  <button className="arcade-button" onClick={onResume}>
                    <Play size={13} /> REPRENDRE
                  </button>
                  <button className="arcade-button" onClick={onRestart}>
                    <RotateCcw size={13} /> RECOMMENCER
                  </button>
                  <button className="arcade-button" onClick={onQuit}>
                    <X size={13} /> {quitLabel}
                  </button>
                </div>
              </section>
            </div>
          )}
        </>
      )}
      {(loading || error) && (
        <div className="arcade-hud-end">
          <section role="status">
            <h2>{error ? "SIMULATION INDISPONIBLE" : "CHARGEMENT DE LA SIMULATION…"}</h2>
            {error && <p>{error}</p>}
            {error && (
              <button className="arcade-button" onClick={onQuit}>
                {quitLabel}
              </button>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
