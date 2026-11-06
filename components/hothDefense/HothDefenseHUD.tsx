"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import { ArrowLeft, Crosshair, Pause, Play, RotateCcw, Snowflake, Volume2, VolumeX, Zap, ZoomIn } from "lucide-react";
import type { DefenseView, WeakpointId } from "./types";
import styles from "./HothDefenseHUD.module.css";

type Props = {
  view: DefenseView | null; loading: boolean; error: string | null; sound: boolean; volume: number;
  onStart: () => void; onPause: () => void; onResume: () => void; onRestart: () => void; onExit: () => void;
  onSpecial: () => void; onCool: () => void; onZoom: () => void; onToggleSound: () => void; onVolume: (n: number) => void;
  onAim: (x: number, y: number) => void; onFire: (held: boolean) => void;
};
const weakLabels: Record<WeakpointId, string> = { "left-leg": "Jambe gauche", "right-leg": "Jambe droite", weapons: "Canons", command: "Commande" };
const percent = (n: number) => Math.max(0, Math.min(100, n));
const clock = (time: number) => `${Math.floor(time / 60).toString().padStart(2, "0")}:${Math.floor(time % 60).toString().padStart(2, "0")}`;

function Meter({ label, value, hot = false }: { label: string; value: number; hot?: boolean }) {
  return <div className={`${styles.meter} ${hot ? styles.hot : ""}`}>
    <span>{label}<b>{Math.round(value)}%</b></span>
    <div role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${percent(value)}%` }} /></div>
  </div>;
}

/** Transparent controls over the cockpit viewport; the Three.js scene remains underneath. */
export default function HothDefenseHUD(props: Props) {
  const { view, loading, error, sound, volume, onStart, onPause, onResume, onRestart, onExit, onSpecial, onCool, onZoom, onToggleSound, onVolume, onAim, onFire } = props;
  const root = useRef<HTMLDivElement>(null);
  const live = useRef({ onFire, onZoom }); live.current = { onFire, onZoom };
  const zoomHeld = useRef(false), zoomPointer = useRef<number | null>(null), firePointer = useRef<number | null>(null);
  const phase = view?.phase ?? "briefing", combat = phase === "playing" || phase === "transition";
  const release = () => { firePointer.current = null; zoomPointer.current = null; live.current.onFire(false); if (zoomHeld.current) { zoomHeld.current = false; live.current.onZoom(); } };
  const finishPointer = (event: PointerEvent<HTMLElement>) => {
    event.stopPropagation();
    if (firePointer.current === event.pointerId) { firePointer.current = null; onFire(false); }
    if (zoomPointer.current === event.pointerId && zoomHeld.current) { zoomPointer.current = null; zoomHeld.current = false; onZoom(); }
  };
  useEffect(() => {
    if (loading) return;
    const frame = requestAnimationFrame(() => {
      const target = root.current?.querySelector<HTMLElement>(combat ? "[data-defense-aim]" : "[data-defense-primary]");
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [phase, loading]);
  useEffect(() => { if (!combat || loading || error) release(); }, [combat, loading, error]);
  useEffect(() => { const blur = () => release(); window.addEventListener("blur", blur); return () => { window.removeEventListener("blur", blur); release(); }; }, []);
  const aim = (event: PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    onAim(Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1)), Math.max(-1, Math.min(1, 1 - (event.clientY - bounds.top) / bounds.height * 2)));
  };
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation(); event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); aim(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (event.pointerType === "mouse" && event.button === 0) { firePointer.current = event.pointerId; onFire(true); }
    if (event.pointerType === "mouse" && event.button === 2 && !zoomHeld.current) { zoomHeld.current = true; zoomPointer.current = event.pointerId; onZoom(); }
  };
  const cooling = Math.max(0, Math.ceil((view?.coolingReadyAt ?? 0) - (view?.time ?? 0))), special = Math.max(0, Math.ceil((view?.specialReadyAt ?? 0) - (view?.time ?? 0)));
  const accuracy = view?.shots ? Math.round(view.hits / view.shots * 100) : 0;
  return <div ref={root} className={`hoth-defense ${styles.root}`} onPointerDown={e => e.stopPropagation()} onPointerMove={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onContextMenu={e => e.preventDefault()}>
    {combat && <div className={styles.aimSurface} tabIndex={0} role="application" data-defense-aim aria-label="Zone de visée. Souris ou doigt pour viser. Au clavier : flèches pour viser, Entrée pour tirer, Espace pour l’impulsion et R pour refroidir."
      onPointerDown={pointerDown} onPointerMove={event => { event.stopPropagation(); aim(event); }}
      onPointerUp={finishPointer} onPointerCancel={finishPointer} onLostPointerCapture={finishPointer} />}

    {view && <div className={styles.effects} aria-hidden="true">
      {/* Explosions flare on the canopy glass; a hit on the ship flashes red; cracks spread as the shields fail. */}
      <i className={styles.glare} style={{ opacity: view.glare * .55 }} />
      <i className={styles.hurt} style={{ opacity: view.hurt * .7 }} />
      {(view.alarm || view.critical) && <i className={`${styles.alarmEdge} ${view.critical ? styles.criticalEdge : ""}`} />}
      <svg className={styles.cracks} viewBox="0 0 1000 600" preserveAspectRatio="none">
        {view.shields < 70 && <path d="M712 118 L748 162 L739 198 L781 236 M748 162 L792 170 L826 152 M739 198 L708 226" />}
        {view.shields < 45 && <path d="M262 132 L238 176 L250 214 L212 248 M238 176 L196 182 L170 168 M250 214 L284 246 L276 280" />}
        {view.shields < 25 && <path d="M520 70 L498 112 L516 150 L492 196 L508 232 M498 112 L462 120 M516 150 L556 158 L590 146 M492 196 L456 214" />}
      </svg>
    </div>}
    {view?.alarm && <p className={styles.alarmBanner} role="status"><b>ALERTE</b> MODE COMBAT · SYSTÈMES DE CIBLAGE EN LIGNE</p>}

    <header className={styles.header}>
      <div className={styles.callSign}><span className={styles.signal} /> BASE ÉCHO <small>CANAL DÉFENSE 03</small></div>
      <div className={styles.headerControls}>
        <button type="button" onClick={onToggleSound} aria-label={sound ? "Couper le son du combat" : "Activer le son du combat"} aria-pressed={sound}>{sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
        <label className={styles.volume}>Volume<input type="range" aria-label="Volume du combat" min={0} max={1} step={.05} value={volume} onChange={event => onVolume(Number(event.target.value))} /></label>
        {combat && <button type="button" onClick={() => { release(); onPause(); }} aria-label="Mettre le combat en pause"><Pause size={17} /></button>}
        <button type="button" onClick={() => { release(); onExit(); }} aria-label="Quitter la défense de Hoth"><ArrowLeft size={17} /><span className={styles.exitLabel}>QUITTER</span></button>
      </div>
    </header>

    {combat && view && <>
      <div className={styles.status}>
        <Meter label="BASE ÉCHO" value={view.base} hot={view.base < 30} />
        <Meter label="BOUCLIERS" value={view.shields} hot={view.shields < 30} />
        <Meter label={view.overheated ? "SURCHAUFFE" : "CHALEUR"} value={view.heat} hot={view.heat > 75 || view.overheated} />
      </div>
      <div className={styles.score}><span>VAGUE <b>{Math.max(1, view.wave)} / 3</b></span><strong>{view.score.toLocaleString("fr-FR")} <small>PTS</small></strong><span>×{view.multiplier} <i /> {clock(view.time)}</span></div>
      <div className={`${styles.reticle} ${view.target ? styles.locked : ""} ${view.overheated ? styles.reticleHot : ""}`} style={{ left: `${(view.aim[0] * .5 + .5) * 100}%`, top: `${(-view.aim[1] * .5 + .5) * 100}%` }} aria-hidden="true"><i /><i /><i /><i />{view.target && <span>{view.target}</span>}</div>
      {view.overheated && <p className={styles.warning} role="status">CANONS EN SURCHAUFFE · LAISSEZ REFROIDIR</p>}
      {phase === "transition" && <div className={styles.transition} role="status"><span>TRANSMISSION TACTIQUE</span><strong>{view.wave === 3 ? "CONTACT LOURD" : `VAGUE ${Math.max(1, view.wave)}`}</strong><p>{view.message}</p></div>}
      {view.boss && <aside className={styles.boss} aria-label="Points faibles du marcheur AT-AT"><div>AT-AT <b>{Math.round(view.boss.hp / view.boss.maxHp * 100)}%</b></div><div className={styles.bossTrack}><i style={{ width: `${view.boss.hp / view.boss.maxHp * 100}%` }} /></div><ul>{view.boss.weakpoints.map(point => <li key={point.id} className={point.hp === 0 ? styles.destroyed : !point.vulnerable ? styles.protected : ""}><span>{weakLabels[point.id]}</span><i><b style={{ width: `${point.hp / point.maxHp * 100}%` }} /></i><small>{point.hp === 0 ? "HS" : !point.vulnerable ? "VERROUILLÉ" : "VULNÉRABLE"}</small></li>)}</ul></aside>}
      <aside className={styles.radar} aria-label={`${view.enemies.length} contacts sur le radar`}><div className={styles.radarDisk}><i className={styles.radarRing} /><i className={styles.radarCenter} />{view.enemies.map(enemy => <b key={enemy.id} className={enemy.kind === "atat" ? styles.radarBoss : ""} style={{ left: `${50 + Math.max(-44, Math.min(44, enemy.x / 40 * 44))}%`, top: `${89 + Math.max(-76, Math.min(0, enemy.z / 140 * 76))}%` }} />)}</div><span>RADAR · {view.enemies.length} CONTACTS</span></aside>
      <p className={styles.radio} aria-live="polite"><span>COMLINK</span>{view.message}</p>
      <div className={styles.actions}>
        <button type="button" onClick={onZoom} aria-pressed={view.zoom}><ZoomIn size={15} /><span>ZOOM <kbd>CLIC DROIT</kbd></span></button>
        <button type="button" onClick={onCool} disabled={cooling > 0 || phase !== "playing"}><Snowflake size={15} /><span>REFROIDIR <kbd>{cooling ? `${cooling}s` : "R"}</kbd></span></button>
        <button type="button" onClick={onSpecial} disabled={special > 0 || phase !== "playing"}><Zap size={15} /><span>IMPULSION <kbd>{special ? `${special}s` : "ESPACE"}</kbd></span></button>
      </div>
      <button type="button" className={styles.touchFire} aria-label="Maintenir pour tirer" disabled={phase !== "playing"} aria-disabled={view.overheated || phase !== "playing"}
        onPointerDown={event => { event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); firePointer.current = event.pointerId; onFire(true); }}
        onPointerUp={finishPointer} onPointerCancel={finishPointer} onLostPointerCapture={finishPointer}
        onKeyDown={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); event.stopPropagation(); onFire(true); } }}
        onKeyUp={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); event.stopPropagation(); onFire(false); } }}><Crosshair size={26} /><span>TIR</span></button>
    </>}

    {(!combat || error || loading) && <div className={styles.shade}><section className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="hoth-defense-title">
      <span className={styles.eyebrow}>ALLIANCE REBELLE · BASE ÉCHO</span>
      <h2 id="hoth-defense-title">{error ? "Liaison interrompue" : loading ? "Connexion au poste de tir" : phase === "paused" ? "Combat en pause" : phase === "victory" ? "MISSION ACCOMPLIE" : phase === "defeat" ? "MISSION ÉCHOUÉE" : "Défense de Hoth"}</h2>
      {error ? <p>{error}</p> : loading ? <p>Établissement du canal tactique…</p> : phase === "briefing" ? <>
        <p>Une offensive impériale approche. Depuis votre cockpit, protégez la Base Écho et les boucliers du vaisseau pendant trois vagues.</p>
        <ol className={styles.briefing}><li><b>01</b> Interceptez les sondes.</li><li><b>02</b> Repoussez les véhicules au sol.</li><li><b>03</b> Neutralisez les articulations et les canons de l’AT-AT, puis sa commande.</li></ol>
        <p className={styles.tip}>Surveillez la chaleur des canons. Gardez l’impulsion ionique pour les moments critiques.</p>
        <div className={styles.keys}><span><kbd>SOURIS</kbd> Viser</span><span><kbd>CLIC GAUCHE</kbd> Tir continu</span><span><kbd>CLIC DROIT</kbd> Zoom</span><span><kbd>R</kbd> Refroidir</span><span><kbd>ESPACE</kbd> Impulsion</span><span><kbd>ÉCHAP</kbd> Pause</span></div>
        <p className={styles.mobileTip}>Sur écran tactile : glissez pour viser, maintenez TIR pour tirer.</p>
        {view && view.record.best > 0 && <p className={styles.best}>RECORD · {view.record.best.toLocaleString("fr-FR")} PTS {view.record.badge ? "· DÉFENSEUR DE HOTH" : ""}</p>}
      </> : phase === "paused" ? <p>La bataille attend votre retour. Les tirs et les ennemis sont suspendus.</p> : view && <>
        <p>{view.message}</p>
        <div className={styles.results}><div><span>SCORE</span><strong>{view.score.toLocaleString("fr-FR")}</strong></div><div><span>PRÉCISION</span><strong>{accuracy}%</strong></div><div><span>CIBLES</span><strong>{view.kills}</strong></div><div><span>TEMPS</span><strong>{clock(view.time)}</strong></div></div>
        {phase === "victory" && <div className={styles.badge}><span>✦</span><div>DÉFENSEUR DE HOTH<strong>{view.rank ?? "Mission accomplie"}</strong>{view.totalDamage === 0 && <small>DÉFENSE PARFAITE · AUCUN DÉGÂT</small>}</div></div>}
        {phase === "victory" && view.totalDamage === 0 && <div className={styles.mystery} role="status"><span>TRANSMISSION INCONNUE · CANAL 1138</span><p>« Votre maîtrise a été remarquée, pilote. D’autres batailles vous attendent au-delà de cette planète gelée. »</p></div>}
        <p className={styles.best}>RECORD · {Math.max(view.score, view.record.best).toLocaleString("fr-FR")} PTS</p>
      </>}
      <div className={styles.panelActions}>
        {!error && !loading && phase === "briefing" && <button type="button" className={styles.primary} data-defense-primary onClick={onStart}><Crosshair size={16} /> PRENDRE LE POSTE DE TIR</button>}
        {!error && !loading && phase === "paused" && <button type="button" className={styles.primary} data-defense-primary onClick={onResume}><Play size={16} /> REPRENDRE</button>}
        {!loading && (error || phase === "victory" || phase === "defeat" || phase === "paused") && <button type="button" className={phase === "paused" ? undefined : styles.primary} data-defense-primary={phase === "paused" ? undefined : true} onClick={onRestart}><RotateCcw size={16} /> {phase === "paused" ? "RECOMMENCER" : "REJOUER"}</button>}
        <button type="button" onClick={() => { release(); onExit(); }}><ArrowLeft size={16} /> RETOUR AU COCKPIT</button>
      </div>
    </section></div>}
  </div>;
}
