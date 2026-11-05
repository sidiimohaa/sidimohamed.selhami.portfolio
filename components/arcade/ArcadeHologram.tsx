"use client";
import { forwardRef, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Lock, Play, X } from "lucide-react";
import { arcadeGames, gameById, type ArcadeGame, type ArcadeGameId } from "./catalog";
import { achievements, cosmetics, equip, equippedValue, grades, noteSecret, purchase, useArcade, type CosmeticKind, type ResultSummary } from "./arcadeStore";
import { droidLines, launchLine, resultLine, suggestion } from "./droid";
import type { ArcadeAudio } from "./arcadeAudio";

// The Galactic Arcade hologram: catalogue, mission briefings, the launch sequence, results, the
// pilot profile, achievements, rewards and a code terminal. Projected over the dashboard on wide
// screens (see CockpitMap), shown as a flat panel on phones.

type Tab = "catalog" | "profile" | "achievements" | "rewards" | "terminal";
type View = { kind: "boot" } | { kind: "tabs" } | { kind: "detail"; id: ArcadeGameId } | { kind: "launch"; id: ArcadeGameId } | { kind: "result" };
const tabs: { id: Tab; label: string }[] = [
  { id: "catalog", label: "Simulations" },
  { id: "profile", label: "Pilot profile" },
  { id: "achievements", label: "Achievements" },
  { id: "rewards", label: "Récompenses" },
  { id: "terminal", label: "Terminal" },
];
const statusLabel = { available: "DISPONIBLE", locked: "VERROUILLÉ", soon: "À VENIR" } as const;
const kindLabel: Record<CosmeticKind, string> = { holo: "Couleur d’hologramme", theme: "Thème de console", title: "Titre honorifique", accent: "Éclairage du cockpit", engine: "Réacteurs du vaisseau" };
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
const CLASSIC = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight"];

// Animated previews, one per simulation, drawn as light line art.
function Preview({ id }: { id: ArcadeGameId }) {
  return (
    <svg className={`arcade-preview arcade-preview-${id}`} viewBox="0 0 160 90" aria-hidden="true">
      {id === "space-battle" && (
        <>
          {[0, 1].map((i) => (
            <g key={i} className="pv-tie" style={{ animationDelay: `${i * -1.6}s` }}>
              <circle cx="0" cy="0" r="5" />
              <path d="M-11 -9 L-8 0 L-11 9 M11 -9 L8 0 L11 9 M-8 0 H-5 M5 0 H8" />
            </g>
          ))}
          <path className="pv-laser" d="M30 80 L70 40 M130 80 L95 42" />
        </>
      )}
      {id === "asteroid-survival" &&
        [0, 1, 2, 3].map((i) => <path key={i} className="pv-rock" style={{ animationDelay: `${i * -0.8}s`, transformOrigin: `${40 + i * 25}px 45px` }} d={`M${40 + i * 25 - 6} 42 l4 -5 l6 1 l3 6 l-3 6 l-7 1 z`} />)}
      {id === "imperial-hacking" && (
        <>
          <path d="M10 45 H45 V20 H90 V60 H125 V35 H150" />
          <path className="pv-pulse" d="M10 45 H45 V20 H90 V60 H125 V35 H150" />
          {[45, 90, 125].map((x) => <rect key={x} x={x - 4} y={x === 90 ? 56 : x === 45 ? 16 : 31} width="8" height="8" />)}
        </>
      )}
      {id === "speeder-racing" &&
        [0, 1, 2, 3, 4, 5].map((i) => <rect key={i} className="pv-trunk" style={{ animationDelay: `${i * -0.33}s` }} x={i % 2 ? 108 : 44} y="10" width="6" height="70" />)}
      {id === "podracing" && (
        <>
          <path d="M8 72l28-23 22 15m47-9 23-27 24 38M40 36l13-13 12 3 2 23-13 13-12-3zM94 36l13-13 12 3 2 23-13 13-12-3z" />
          <path className="pv-pulse" d="M65 41l8-3 5 7 7-8 11 4" />
          <path d="M51 61l19 12m39-12L90 73M70 73l3-9h14l3 9-6 8h-8z" />
          <circle cx="28" cy="22" r="7" />
          <circle cx="40" cy="12" r="4" />
        </>
      )}
      {id === "defense-of-hoth" && (
        <>
          <g className="pv-atat">
            <rect x="60" y="28" width="34" height="14" rx="2" />
            <rect x="94" y="32" width="12" height="8" rx="1" />
            <path className="pv-legs" d="M64 42 V70 M72 42 V70 M82 42 V70 M90 42 V70" />
          </g>
          <path d="M0 72 H160" />
          <path className="pv-snow" d="M10 10 l1 1 M40 22 l1 1 M90 8 l1 1 M130 18 l1 1 M150 40 l1 1 M20 50 l1 1 M120 55 l1 1" />
        </>
      )}
    </svg>
  );
}

function Difficulty({ level }: { level: number }) {
  return (
    <span className="arcade-difficulty" aria-label={`Difficulté ${level} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} data-on={i <= level} />
      ))}
    </span>
  );
}

type Props = {
  mode: "holo" | "flat";
  reduced: boolean;
  audio: ArcadeAudio | null;
  result: ResultSummary | null;
  onLaunch: (id: ArcadeGameId) => void;
  onClose: () => void;
  onDismissResult: () => void;
  style?: React.CSSProperties;
};

export const ArcadeHologram = forwardRef<HTMLElement, Props>(function ArcadeHologram({ mode, reduced, audio, result, onLaunch, onClose, onDismissResult, style }, ref) {
  const { data, grade } = useArcade();
  const [view, setView] = useState<View>(() => (result ? { kind: "result" } : { kind: "boot" }));
  const [tab, setTab] = useState<Tab>("catalog");
  const [line, setLine] = useState(droidLines.boot);
  const [code, setCode] = useState("");
  const [terminalReply, setTerminalReply] = useState("Saisissez un code d’accès.");
  const [retro, setRetro] = useState(false);
  const [classic, setClassic] = useState(false);
  const [secret, setSecret] = useState(false);
  const idle = useRef(0);
  const taps = useRef<number[]>([]);
  const launchTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(launchTimer.current), []);
  const close = () => {
    window.clearTimeout(launchTimer.current);
    onClose();
  };
  const say = (text: string) => setLine(text);
  // Boot: lines appear, then the droid presents the console.
  useEffect(() => {
    if (view.kind !== "boot") return;
    audio?.ui("boot");
    const timer = window.setTimeout(() => {
      setView({ kind: "tabs" });
      say(droidLines.open);
    }, reduced ? 200 : 1700);
    return () => window.clearTimeout(timer);
    // The boot runs once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A finished run: the report, and the droid's reaction with a suggestion for the next one.
  useEffect(() => {
    if (!result) return;
    setView({ kind: "result" });
    const others = arcadeGames.filter((game) => game.status === "available").map((game) => game.id);
    say(resultLine(result, suggestion(result.result.gameId, others)));
    if (result.achievements.length) window.setTimeout(() => audio?.ui("unlock"), 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);
  // The impatient droid: a remark after half a minute in the catalogue without a choice.
  useEffect(() => {
    if (view.kind !== "tabs" || tab !== "catalog") return;
    idle.current = 0;
    let count = 0;
    const timer = window.setInterval(() => {
      idle.current += 1;
      if (idle.current >= 30) {
        idle.current = 0;
        say(droidLines.impatient[count++ % droidLines.impatient.length]);
      }
    }, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.kind, tab]);
  // The classic arcade cabinet: a secret combination of arrow keys while the console is open.
  useEffect(() => {
    let typed: string[] = [];
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") window.clearTimeout(launchTimer.current);
      if (event.target instanceof HTMLInputElement) return;
      typed = [...typed, event.key].slice(-CLASSIC.length);
      if (typed.join() === CLASSIC.join()) {
        typed = [];
        setClassic((on) => !on);
        audio?.ui("coin");
        if (noteSecret("classic")) say("Mode borne d’arcade activé. Insérez une pièce, Commandant. Je plaisante : c’est gratuit.");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const tapLogo = () => {
    const now = performance.now();
    taps.current = [...taps.current.filter((t) => now - t < 2000), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      setClassic((on) => !on);
      audio?.ui("coin");
      noteSecret("classic");
    }
  };
  const launch = (game: ArcadeGame) => {
    if (game.status !== "available") {
      audio?.ui("error");
      say(droidLines.locked);
      return;
    }
    audio?.ui("select");
    setView({ kind: "launch", id: game.id });
    say(launchLine(game.id));
    window.clearTimeout(launchTimer.current);
    launchTimer.current = window.setTimeout(() => onLaunch(game.id), reduced ? 300 : 2600);
  };
  const submitCode = () => {
    const value = code.trim();
    setCode("");
    if (value === "1977") {
      setRetro((on) => !on);
      audio?.ui("unlock");
      noteSecret("1977");
      setTerminalReply("CODE 1977 ACCEPTÉ · THÈME RÉTRO TEMPORAIRE " + (retro ? "DÉSACTIVÉ" : "ACTIVÉ"));
      say("Thème rétro activé. Ah, la belle époque des effets spéciaux.");
    } else if (value === "1138") {
      setSecret(true);
      audio?.ui("unlock");
      noteSecret("1138");
      setTerminalReply("CODE 1138 ACCEPTÉ · TRANSMISSION ARCHIVÉE");
      say("Archive 1138 déverrouillée. Je ne sais pas ce que c’est, mais c’est magnifique.");
    } else {
      audio?.ui("error");
      setTerminalReply(`CODE ${value || "VIDE"} · ACCÈS REFUSÉ`);
    }
  };
  const theme = retro ? "retro" : equippedValue(data, "theme");
  const holo = equippedValue(data, "holo");
  const title = equippedValue(data, "title");
  const wonGames = arcadeGames.filter((game) => data.stats[game.id].wins > 0).length;
  const unlockedCount = Object.keys(data.unlocked).length;
  const progress = Math.round(((wonGames + unlockedCount) / (arcadeGames.length + achievements.length)) * 100);

  return (
    <section
      ref={ref}
      className={`arcade arcade-${mode} arcade-theme-${theme} ${classic ? "arcade-classic" : ""}`}
      style={{ ...style, ["--arcade-holo" as string]: holo }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="arcade-title"
    >
      <div className="arcade-sweep" aria-hidden="true" />
      {!reduced && <div className="arcade-particles" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ ["--i" as string]: i }} />)}</div>}
      <header className="arcade-head">
        <button className="arcade-logo" onClick={tapLogo} aria-label="Galactic Arcade">
          <span aria-hidden="true">◈</span>
        </button>
        <div>
          <h3 id="arcade-title">{classic ? "GALACTIC ARCADE · INSERT COIN" : "Galactic Arcade"}</h3>
          <p>Centre de simulation et d’entraînement galactique</p>
        </div>
        <div className="arcade-wallet" aria-label={`${data.credits} crédits galactiques, grade ${grade.title}`}>
          <strong>{data.credits.toLocaleString("fr-FR")}</strong>
          <span>CRÉDITS</span>
          <small>{grade.title.toUpperCase()}</small>
        </div>
        <button className="arcade-close" onClick={close} aria-label="Fermer Galactic Arcade">
          <X size={16} />
          <span>FERMER</span>
        </button>
      </header>
      <p className="arcade-droid" aria-live="polite">
        <span className="arcade-droid-icon" aria-hidden="true" />
        {line}
      </p>
      <AnimatePresence mode="wait">
        {view.kind === "boot" && (
          <motion.div key="boot" className="arcade-boot mono" exit={{ opacity: 0 }} role="status">
            <span>INITIALISATION DU CENTRE DE SIMULATION…</span>
            <span>CHARGEMENT DES PROGRAMMES · {arcadeGames.length} ENREGISTRÉS</span>
            <span>SYNCHRONISATION DU PROFIL PILOTE</span>
          </motion.div>
        )}
        {view.kind === "tabs" && (
          <motion.div key="tabs" className="arcade-body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="arcade-tabs" role="tablist" aria-label="Sections de Galactic Arcade">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={tab === item.id}
                  onClick={() => {
                    setTab(item.id);
                    audio?.ui("select");
                    if (item.id === "rewards") say(droidLines.rewards);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="arcade-panel" role="tabpanel" tabIndex={0}>
              {tab === "catalog" && (
                <ul className="arcade-grid">
                  {arcadeGames.map((game) => {
                    const stats = data.stats[game.id];
                    const best = game.scoring === "time" ? (stats.bestTime !== null ? `${stats.bestTime.toFixed(2)} s` : "—") : stats.best !== null ? stats.best.toLocaleString("fr-FR") : "—";
                    return (
                      <li key={game.id} className="arcade-card" data-status={game.status} onMouseEnter={() => audio?.ui("hover")}>
                        <Preview id={game.id} />
                        <div className="arcade-card-copy">
                          <span className="arcade-card-number mono">{game.number} · {game.planet.toUpperCase()}</span>
                          <strong>{game.name}</strong>
                          <p>{game.description}</p>
                          <dl>
                            <div>
                              <dt>Difficulté</dt>
                              <dd>
                                <Difficulty level={game.difficulty} />
                              </dd>
                            </div>
                            <div>
                              <dt>Durée</dt>
                              <dd>{game.duration}</dd>
                            </div>
                            <div>
                              <dt>{game.scoring === "time" ? "Meilleur temps" : "Record"}</dt>
                              <dd>{best}</dd>
                            </div>
                          </dl>
                          <span className="arcade-status mono">{statusLabel[game.status]}</span>
                        </div>
                        <div className="arcade-card-actions">
                          <button className="arcade-button" onClick={() => launch(game)} disabled={game.status !== "available"}>
                            {game.status === "available" ? <Play size={13} /> : <Lock size={13} />}
                            {game.status === "available" ? "LANCER LA SIMULATION" : statusLabel[game.status]}
                          </button>
                          <button className="arcade-link" onClick={() => (setView({ kind: "detail", id: game.id }), audio?.ui("select"))}>
                            RÈGLES ET STATISTIQUES
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {tab === "profile" && (
                <div className="arcade-profile">
                  <div className="arcade-grade">
                    <span className="mono">GRADE</span>
                    <strong>{grade.title}</strong>
                    <em>{title}</em>
                  </div>
                  <dl className="arcade-figures">
                    <div><dt>Crédits</dt><dd>{data.credits.toLocaleString("fr-FR")}</dd></div>
                    <div><dt>Simulations réussies</dt><dd>{wonGames} / {arcadeGames.length}</dd></div>
                    <div><dt>Succès</dt><dd>{unlockedCount} / {achievements.length}</dd></div>
                    <div><dt>Temps en simulation</dt><dd>{clock(data.playSeconds)}</dd></div>
                    <div><dt>Progression globale</dt><dd>{progress} %</dd></div>
                  </dl>
                  <div className="arcade-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progression globale"><i style={{ width: `${progress}%` }} /></div>
                  <table className="arcade-records">
                    <thead><tr><th>Simulation</th><th>Record</th><th>Dernier</th><th>Parties</th><th>Victoires</th><th>Date du record</th></tr></thead>
                    <tbody>
                      {arcadeGames.map((game) => {
                        const s = data.stats[game.id];
                        const best = game.scoring === "time" ? (s.bestTime !== null ? `${s.bestTime.toFixed(2)} s` : "—") : s.best?.toLocaleString("fr-FR") ?? "—";
                        const last = s.last === null ? "—" : game.scoring === "time" ? `${s.last.toFixed(2)} s` : s.last.toLocaleString("fr-FR");
                        return <tr key={game.id}><td>{game.name}</td><td>{best}</td><td>{last}</td><td>{s.plays}</td><td>{s.wins}</td><td>{s.recordAt ? new Date(s.recordAt).toLocaleDateString("fr-FR") : "—"}</td></tr>;
                      })}
                    </tbody>
                  </table>
                  <ol className="arcade-grades">
                    {grades.map((item) => <li key={item.id} data-current={item.id === grade.id}><strong>{item.title}</strong><span>{item.rule}</span></li>)}
                  </ol>
                </div>
              )}
              {tab === "achievements" && (
                <ul className="arcade-achievements">
                  {achievements.map((item) => {
                    const at = data.unlocked[item.id];
                    return (
                      <li key={item.id} data-unlocked={!!at}>
                        <span className="arcade-ach-icon" aria-hidden="true">{item.icon}</span>
                        <strong>{item.name}</strong>
                        <p>{item.description}</p>
                        <small className="mono">{at ? `DÉBLOQUÉ LE ${new Date(at).toLocaleDateString("fr-FR")}` : "VERROUILLÉ"}</small>
                      </li>
                    );
                  })}
                </ul>
              )}
              {tab === "rewards" && (
                <div className="arcade-shop">
                  <p className="arcade-note">Les crédits galactiques se gagnent en jouant. Aucun achat réel : tout se débloque dans les simulations.</p>
                  {(Object.keys(kindLabel) as CosmeticKind[]).map((kind) => (
                    <section key={kind}>
                      <h4>{kindLabel[kind]}</h4>
                      <ul>
                        {cosmetics.filter((item) => item.kind === kind).map((item) => {
                          const owned = data.owned.includes(item.id),
                            on = data.equipped[kind] === item.id;
                          return (
                            <li key={item.id} data-on={on}>
                              {(kind === "holo" || kind === "accent" || (kind === "engine" && item.value.startsWith("#"))) && <i className="arcade-swatch" style={{ background: item.value }} />}
                              <span>{item.name}</span>
                              {on ? (
                                <small className="mono">ÉQUIPÉ</small>
                              ) : owned ? (
                                <button className="arcade-link" onClick={() => (equip(item.id), audio?.ui("select"))}>ÉQUIPER</button>
                              ) : (
                                <button className="arcade-button small" disabled={data.credits < item.price} onClick={() => { if (purchase(item.id)) audio?.ui("coin"); else audio?.ui("error"); }}>
                                  {item.price} CR
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
              {tab === "terminal" && (
                <div className="arcade-terminal">
                  <p className="mono">TERMINAL DE MAINTENANCE · ACCÈS RESTREINT</p>
                  <form onSubmit={(event) => { event.preventDefault(); submitCode(); }}>
                    <label htmlFor="arcade-code" className="mono">CODE</label>
                    <input id="arcade-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="off" placeholder="••••" />
                    <button className="arcade-button" type="submit">VALIDER</button>
                  </form>
                  <p className="arcade-terminal-reply mono" role="status">{terminalReply}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
        {view.kind === "detail" && (() => {
          const game = gameById(view.id), s = data.stats[game.id];
          return (
            <motion.div key="detail" className="arcade-body arcade-detail" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <button className="arcade-link" onClick={() => (setView({ kind: "tabs" }), audio?.ui("back"))}><ArrowLeft size={13} /> RETOUR AU CATALOGUE</button>
              <div className="arcade-detail-grid">
                <div>
                  <span className="arcade-card-number mono">{game.number} · {game.location.toUpperCase()}</span>
                  <h4>{game.name}</h4>
                  <p>{game.description}</p>
                  <h5>Règles</h5>
                  <ul>{game.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
                  <h5>Commandes</h5>
                  <ul>{game.controls.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div>
                  <Preview id={game.id} />
                  <dl className="arcade-figures">
                    <div><dt>Record</dt><dd>{game.scoring === "time" ? (s.bestTime !== null ? `${s.bestTime.toFixed(2)} s` : "—") : s.best?.toLocaleString("fr-FR") ?? "—"}</dd></div>
                    <div><dt>Dernière partie</dt><dd>{s.last === null ? "—" : game.scoring === "time" ? `${s.last.toFixed(2)} s` : s.last.toLocaleString("fr-FR")}</dd></div>
                    <div><dt>Parties</dt><dd>{s.plays}</dd></div>
                    <div><dt>Victoires</dt><dd>{s.wins}</dd></div>
                  </dl>
                  <button className="arcade-button" onClick={() => launch(game)} disabled={game.status !== "available"}><Play size={13} /> LANCER LA SIMULATION</button>
                </div>
              </div>
            </motion.div>
          );
        })()}
        {view.kind === "launch" && (() => {
          const game = gameById(view.id);
          return (
            <motion.div key="launch" className="arcade-body arcade-launch" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="status">
              <Preview id={game.id} />
              <span className="mono">PROGRAMME {game.number} VALIDÉ</span>
              <h4>{game.transition.title}</h4>
              <ul>{game.transition.lines.map((item, i) => <li key={item} style={{ animationDelay: `${0.4 + i * 0.55}s` }}>{item}</li>)}</ul>
              <div className="arcade-launch-bar"><i /></div>
            </motion.div>
          );
        })()}
        {view.kind === "result" && result && (() => {
          const game = gameById(result.result.gameId);
          const total = result.credits.reduce((sum, item) => sum + item.amount, 0);
          return (
            <motion.div key="result" className="arcade-body arcade-result" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <span className="mono">{game.name.toUpperCase()} · RAPPORT DE SIMULATION</span>
              <h4 data-won={result.result.won}>{result.result.won ? "MISSION ACCOMPLIE" : "MISSION ÉCHOUÉE"}</h4>
              <dl className="arcade-figures">
                <div><dt>Score</dt><dd>{result.result.score.toLocaleString("fr-FR")}</dd></div>
                {result.result.time !== undefined && <div><dt>Temps</dt><dd>{result.result.time.toFixed(2)} s</dd></div>}
                <div><dt>Durée</dt><dd>{clock(result.result.seconds)}</dd></div>
                <div><dt>Crédits gagnés</dt><dd>+{total}</dd></div>
              </dl>
              {result.record && <p className="arcade-record mono">NOUVEAU RECORD PERSONNEL</p>}
              {result.credits.length > 0 && <ul className="arcade-credits">{result.credits.map((item) => <li key={item.label}><span>{item.label}</span><b>+{item.amount} CR</b></li>)}</ul>}
              {result.achievements.map((item) => (
                <motion.div key={item.id} className="arcade-unlock" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                  <span aria-hidden="true">{item.icon}</span>
                  <div><small className="mono">SUCCÈS DÉBLOQUÉ</small><strong>{item.name}</strong><p>{item.description}</p></div>
                </motion.div>
              ))}
              {result.grade.from.id !== result.grade.to.id && <p className="arcade-record mono">NOUVEAU GRADE : {result.grade.to.title.toUpperCase()}</p>}
              <div className="arcade-result-actions">
                <button className="arcade-button" onClick={() => { onDismissResult(); launch(game); }}><Play size={13} /> REJOUER</button>
                <button className="arcade-link" onClick={() => { onDismissResult(); setView({ kind: "tabs" }); setTab("catalog"); audio?.ui("back"); }}>AUTRE SIMULATION</button>
                <button className="arcade-link" onClick={() => { onDismissResult(); close(); }}>REPRENDRE L’EXPLORATION</button>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
      <AnimatePresence>
        {secret && (
          <motion.div className="arcade-secret" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSecret(false)} role="dialog" aria-label="Archive 1138">
            <div className="arcade-secret-holo" aria-hidden="true">
              <i /><i /><i />
              <span>1138</span>
            </div>
            <p className="mono">ARCHIVE 1138 · TOUCHER POUR FERMER</p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
});
