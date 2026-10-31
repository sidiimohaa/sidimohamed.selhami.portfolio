"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import type { ArcadeAudio } from "./arcadeAudio";
import type { GameResult } from "./arcadeStore";

// Imperial Hacking: three security layers of an Imperial maintenance terminal, shown as a red
// hologram over the cockpit. Reconnect a power circuit by rotating its modules, decode a word with
// the cipher table, then repeat the firewall's node sequence, all before the alert goes off.
// Wrong letters and wrong nodes are errors: they cost time and points.

type Props = { reduced: boolean; audio: ArcadeAudio | null; onFinish: (result: GameResult) => void; onQuit: () => void };

const TOTAL = 150,
  PENALTY = 5;
const COLS = 5,
  ROWS = 4;
const N = 1,
  E = 2,
  S = 4,
  W = 8;
const rotate = (mask: number) => ((mask << 1) | (mask >> 3)) & 15;
const shuffle = <T,>(list: T[]) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const step: Record<number, [number, number, number]> = { [N]: [0, -1, S], [E]: [1, 0, W], [S]: [0, 1, N], [W]: [-1, 0, E] };
const sideName: Record<number, string> = { [N]: "haut", [E]: "droite", [S]: "bas", [W]: "gauche" };

// A circuit with a guaranteed solution: a random path from the source to the terminal, the other
// modules filled at random, then every module turned a random number of times.
function makeCircuit() {
  const start = Math.floor(Math.random() * ROWS),
    end = Math.floor(Math.random() * ROWS);
  const key = (c: number, r: number) => r * COLS + c;
  const seen = new Set<number>(),
    path: [number, number][] = [];
  const walk = (c: number, r: number): boolean => {
    path.push([c, r]);
    seen.add(key(c, r));
    if (c === COLS - 1 && r === end) return true;
    for (const [dc, dr] of shuffle([[1, 0], [1, 0], [0, 1], [0, -1], [-1, 0]] as [number, number][])) {
      const nc = c + dc,
        nr = r + dr;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS || seen.has(key(nc, nr))) continue;
      if (walk(nc, nr)) return true;
    }
    path.pop();
    return false;
  };
  walk(0, start);
  const solution = Array.from({ length: COLS * ROWS }, () => [5, 3, 7, 3, 10, 6][Math.floor(Math.random() * 6)]);
  path.forEach(([c, r], i) => {
    let mask = 0;
    for (const [oc, or] of [path[i - 1], path[i + 1]].filter(Boolean)) {
      if (oc > c) mask |= E;
      if (oc < c) mask |= W;
      if (or > r) mask |= S;
      if (or < r) mask |= N;
    }
    if (i === 0) mask |= W;
    if (i === path.length - 1) mask |= E;
    solution[key(c, r)] = mask;
  });
  let tiles = solution;
  do tiles = solution.map((mask) => Array.from({ length: Math.floor(Math.random() * 4) }).reduce<number>((m) => rotate(m), mask));
  while (connect(tiles, start, end).solved);
  return { tiles, start, end };
}
function connect(tiles: number[], start: number, end: number) {
  const lit = new Set<number>();
  const first = start * COLS;
  if (tiles[first] & W) {
    const queue = [first];
    lit.add(first);
    while (queue.length) {
      const k = queue.shift()!,
        c = k % COLS,
        r = Math.floor(k / COLS);
      for (const bit of [N, E, S, W]) {
        if (!(tiles[k] & bit)) continue;
        const [dc, dr, back] = step[bit];
        const nc = c + dc,
          nr = r + dr,
          n = nr * COLS + nc;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS || lit.has(n) || !(tiles[n] & back)) continue;
        lit.add(n);
        queue.push(n);
      }
    }
  }
  const last = end * COLS + COLS - 1;
  return { lit, solved: lit.has(last) && !!(tiles[last] & E) };
}

// An alien script: each letter is three or four strokes on a 3×3 grid of points.
const STROKES: [number, number, number, number][] = [];
for (let y = 0; y < 3; y++) for (let x = 0; x < 2; x++) STROKES.push([x, y, x + 1, y]);
for (let x = 0; x < 3; x++) for (let y = 0; y < 2; y++) STROKES.push([x, y, x, y + 1]);
for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) STROKES.push([x, y, x + 1, y + 1], [x + 1, y, x, y + 1]);
function makeScript() {
  const used = new Set<string>();
  const script: Record<string, [number, number, number, number][]> = {};
  for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    let strokes: number[] = [];
    do strokes = shuffle(STROKES.map((_, i) => i)).slice(0, 3 + Math.floor(Math.random() * 2)).sort((a, b) => a - b);
    while (used.has(strokes.join()));
    used.add(strokes.join());
    script[letter] = strokes.map((i) => STROKES[i]);
  }
  return script;
}
function Glyph({ strokes }: { strokes: [number, number, number, number][] }) {
  return (
    <svg viewBox="-2 -2 24 24" width="26" height="26" aria-hidden="true" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none">
      {strokes.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1 * 10} y1={y1 * 10} x2={x2 * 10} y2={y2 * 10} />
      ))}
    </svg>
  );
}
const WORDS = ["REBELLE", "STATION", "SECTEUR", "CRISTAL", "SCARIF", "ALLIANCE", "HANGAR"];

type Stage = "brief" | "circuit" | "cipher" | "firewall" | "won" | "lost";

export default function ImperialHacking({ reduced, audio, onFinish, onQuit }: Props) {
  const [stage, setStage] = useState<Stage>("brief");
  const [paused, setPaused] = useState(false);
  const [left, setLeft] = useState(TOTAL);
  const [errors, setErrors] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [run, setRun] = useState(0);
  const elapsed = useRef(0);
  const done = useRef(false);
  // Layer 1: the circuit.
  const [circuit, setCircuit] = useState(() => makeCircuit());
  const powered = useMemo(() => connect(circuit.tiles, circuit.start, circuit.end), [circuit]);
  // Layer 2: the cipher.
  const script = useMemo(() => makeScript(), [run]);
  const word = useMemo(() => WORDS[Math.floor(Math.random() * WORDS.length)], [run]);
  const keypad = useMemo(() => {
    const letters = [...new Set(word)];
    const decoys = shuffle([..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].filter((l) => !letters.includes(l))).slice(0, Math.max(0, 12 - letters.length));
    return shuffle([...letters, ...decoys]);
  }, [word]);
  const [decoded, setDecoded] = useState(0);
  // Layer 3: the firewall sequence.
  const [round, setRound] = useState(0);
  const [sequence, setSequence] = useState<number[]>([]);
  const [shown, setShown] = useState<number | null>(null);
  const [showing, setShowing] = useState(false);
  const [typed, setTyped] = useState(0);
  const lengths = [4, 5, 6];
  const playing = stage === "circuit" || stage === "cipher" || stage === "firewall";

  const penalise = (text: string) => {
    setErrors((n) => n + 1);
    setLeft((t) => Math.max(0, t - PENALTY));
    setFeedback(`${text} · −${PENALTY} s`);
    audio?.ui("error");
  };
  const end = (won: boolean, finalErrors = errors) => {
    if (done.current) return;
    done.current = true;
    setStage(won ? "won" : "lost");
    if (won) audio?.success();
    else audio?.fail();
    const cleared = { circuit: 0, cipher: 1, firewall: 2, brief: 0, won: 3, lost: 0 }[stage];
    const score = won ? Math.max(100, 2000 + Math.round(left) * 15 + (finalErrors === 0 ? 1000 : 0) - finalErrors * 100) : cleared * 400;
    onFinish({ gameId: "imperial-hacking", score, won, perfect: won && finalErrors === 0, seconds: Math.round(elapsed.current), errors: finalErrors });
  };
  const endRef = useRef(end);
  endRef.current = end;

  // The countdown runs while a layer is open and the game isn't paused.
  useEffect(() => {
    if (!playing || paused) return;
    const timer = window.setInterval(() => {
      elapsed.current += 0.1;
      setLeft((t) => Math.max(0, t - 0.1));
    }, 100);
    return () => window.clearInterval(timer);
  }, [playing, paused]);
  useEffect(() => {
    if (playing && left <= 0) endRef.current(false);
  }, [left, playing]);
  // Leaving the window pauses the infiltration.
  useEffect(() => {
    const blur = () => setPaused(true);
    window.addEventListener("blur", blur);
    return () => window.removeEventListener("blur", blur);
  }, []);
  // Escape pauses instead of closing the cockpit.
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat && playing) setPaused((p) => !p);
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [playing]);

  // The firewall shows its sequence node by node, then waits for the pilot.
  useEffect(() => {
    if (stage !== "firewall" || !showing || paused) return;
    let i = 0,
      on = true;
    setShown(null);
    const tick = window.setInterval(
      () => {
        if (on) {
          setShown(sequence[i]);
          audio?.ui("hover");
        } else {
          setShown(null);
          i++;
          if (i >= sequence.length) {
            window.clearInterval(tick);
            setShowing(false);
            setFeedback("À vous : reproduisez la séquence.");
          }
        }
        on = !on;
      },
      reduced ? 650 : 420,
    );
    return () => window.clearInterval(tick);
  }, [stage, showing, sequence, paused, reduced, audio]);

  const begin = () => {
    audio?.ui("select");
    setStage("circuit");
    setFeedback("Faites pivoter les modules pour relier la source au terminal.");
  };
  const restart = () => {
    done.current = false;
    elapsed.current = 0;
    setRun((n) => n + 1);
    setCircuit(makeCircuit());
    setDecoded(0);
    setRound(0);
    setTyped(0);
    setSequence([]);
    setErrors(0);
    setLeft(TOTAL);
    setPaused(false);
    setStage("brief");
    setFeedback("");
  };
  const turn = (index: number) => {
    if (stage !== "circuit" || paused) return;
    const tiles = circuit.tiles.map((mask, i) => (i === index ? rotate(mask) : mask));
    const next = { ...circuit, tiles };
    setCircuit(next);
    audio?.ui("hover");
    if (connect(tiles, next.start, next.end).solved) {
      audio?.ui("unlock");
      setFeedback("Circuit rétabli. Couche 2 : décryptage.");
      window.setTimeout(() => setStage((s) => (s === "circuit" ? "cipher" : s)), reduced ? 200 : 900);
    }
  };
  const pick = (letter: string) => {
    if (stage !== "cipher" || paused || decoded >= word.length) return;
    if (letter !== word[decoded]) {
      penalise(`« ${letter} » ne correspond pas`);
      return;
    }
    audio?.ui("select");
    const next = decoded + 1;
    setDecoded(next);
    setFeedback("");
    if (next >= word.length) {
      audio?.ui("unlock");
      setFeedback(`Code « ${word} » accepté. Couche 3 : pare-feu.`);
      window.setTimeout(() => {
        setStage((s) => (s === "cipher" ? "firewall" : s));
        startRound(0);
      }, reduced ? 200 : 1000);
    }
  };
  const startRound = (n: number) => {
    setRound(n);
    setTyped(0);
    setSequence(Array.from({ length: lengths[n] }, () => Math.floor(Math.random() * 9)));
    setShowing(true);
    setFeedback("Observez la séquence du pare-feu…");
  };
  const press = (node: number) => {
    if (stage !== "firewall" || showing || paused) return;
    if (node !== sequence[typed]) {
      penalise("Nœud incorrect, la séquence recommence");
      setTyped(0);
      window.setTimeout(() => setShowing(true), 600);
      return;
    }
    audio?.ui("select");
    setShown(node);
    window.setTimeout(() => setShown((s) => (s === node ? null : s)), 180);
    const next = typed + 1;
    setTyped(next);
    if (next >= sequence.length) {
      if (round + 1 >= lengths.length) end(true);
      else {
        audio?.ui("unlock");
        setFeedback(`Nœud ${round + 1} contourné.`);
        window.setTimeout(() => startRound(round + 1), reduced ? 300 : 900);
      }
    }
  };

  const layer = { circuit: 1, cipher: 2, firewall: 3 }[stage as "circuit"] ?? 0;
  const urgent = left < 30;

  return (
    <div className="arcade-overlay arcade-game" role="dialog" aria-modal="true" aria-labelledby="hack-title">
      <section className={`hack ${urgent ? "urgent" : ""}`}>
        <header>
          <div>
            <span>ÉTOILE NOIRE · NIVEAU 5 · TERMINAL TK-421</span>
            <strong id="hack-title">IMPERIAL HACKING</strong>
          </div>
          <div className="hack-status" aria-live="off">
            <span>COUCHE {Math.max(1, layer)}/3</span>
            <span>ERREURS {errors}</span>
            <span className={urgent ? "hack-alert" : ""}>ALERTE DANS {Math.floor(left / 60)}:{Math.floor(left % 60).toString().padStart(2, "0")}</span>
          </div>
          <div className="hack-controls">
            {playing && (
              <button onClick={() => setPaused((p) => !p)} aria-label={paused ? "Reprendre" : "Mettre en pause"}>
                {paused ? <Play size={14} /> : <Pause size={14} />}
              </button>
            )}
            <button onClick={onQuit} aria-label="Quitter la simulation">
              <X size={14} />
            </button>
          </div>
        </header>
        <div className="hack-bar" aria-hidden="true">
          <i style={{ width: `${(left / TOTAL) * 100}%` }} />
        </div>

        {stage === "brief" && (
          <div className="hack-brief">
            <h3>Infiltration du réseau impérial</h3>
            <p>Un terminal de maintenance oublié vous donne accès au réseau de la station. Trois couches de sécurité vous séparent des plans : un circuit d’alimentation, un code chiffré et le pare-feu.</p>
            <p>Vous avez {TOTAL / 60 >= 2 ? "deux minutes et demie" : `${TOTAL} secondes`} avant que l’alerte ne se déclenche. Chaque erreur coûte {PENALTY} secondes.</p>
            <button className="hack-action" onClick={begin}>
              COMMENCER L’INFILTRATION
            </button>
          </div>
        )}

        {paused && playing && (
          <div className="hack-brief">
            <h3>Infiltration en pause</h3>
            <p>Le compte à rebours est suspendu.</p>
            <div className="hack-row">
              <button className="hack-action" onClick={() => setPaused(false)}>
                <Play size={13} /> REPRENDRE
              </button>
              <button className="hack-action" onClick={restart}>
                <RotateCcw size={13} /> RECOMMENCER
              </button>
              <button className="hack-action" onClick={onQuit}>
                <X size={13} /> RETOUR À LA CONSOLE
              </button>
            </div>
          </div>
        )}

        {!paused && stage === "circuit" && (
          <div className="hack-layer">
            <h3>Couche 1 · Circuit d’alimentation</h3>
            <p>Touchez un module pour le faire pivoter. Reliez la source (à gauche) au terminal (à droite).</p>
            <div className="hack-grid" style={{ gridTemplateColumns: `24px repeat(${COLS}, auto) 24px` }}>
              {Array.from({ length: ROWS }).map((_, r) => (
                <div key={r} className="hack-grid-row">
                  <span className="hack-end" data-on={r === circuit.start} aria-hidden="true">
                    {r === circuit.start ? "▶" : ""}
                  </span>
                  {Array.from({ length: COLS }).map((__, c) => {
                    const index = r * COLS + c,
                      mask = circuit.tiles[index];
                    return (
                      <button
                        key={c}
                        className="hack-tile"
                        data-live={powered.lit.has(index)}
                        onClick={() => turn(index)}
                        aria-label={`Module ligne ${r + 1}, colonne ${c + 1}, relié vers ${[N, E, S, W].filter((b) => mask & b).map((b) => sideName[b]).join(", ")}${powered.lit.has(index) ? ", alimenté" : ""}`}
                      >
                        <svg viewBox="0 0 100 100" aria-hidden="true">
                          {mask & N ? <line x1="50" y1="50" x2="50" y2="0" /> : null}
                          {mask & E ? <line x1="50" y1="50" x2="100" y2="50" /> : null}
                          {mask & S ? <line x1="50" y1="50" x2="50" y2="100" /> : null}
                          {mask & W ? <line x1="50" y1="50" x2="0" y2="50" /> : null}
                          <circle cx="50" cy="50" r="9" />
                        </svg>
                      </button>
                    );
                  })}
                  <span className="hack-end" data-on={r === circuit.end && powered.solved} aria-hidden="true">
                    {r === circuit.end ? "◆" : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!paused && stage === "cipher" && (
          <div className="hack-layer">
            <h3>Couche 2 · Décryptage</h3>
            <p>Traduisez le code chiffré grâce à la table de correspondance, lettre par lettre.</p>
            <div className="hack-word" aria-label={`Mot chiffré de ${word.length} lettres, ${decoded} décodées`}>
              {[...word].map((letter, i) => (
                <span key={i} data-done={i < decoded} data-current={i === decoded}>
                  <Glyph strokes={script[letter]} />
                  <b>{i < decoded ? letter : "·"}</b>
                </span>
              ))}
            </div>
            <div className="hack-cipher" aria-label="Table de correspondance">
              {[...keypad].sort().map((letter) => (
                <span key={letter}>
                  <Glyph strokes={script[letter]} />
                  <b>{letter}</b>
                </span>
              ))}
            </div>
            <div className="hack-keys">
              {keypad.map((letter) => (
                <button key={letter} onClick={() => pick(letter)}>
                  {letter}
                </button>
              ))}
            </div>
          </div>
        )}

        {!paused && stage === "firewall" && (
          <div className="hack-layer">
            <h3>Couche 3 · Pare-feu · nœud {round + 1}/3</h3>
            <p>{showing ? "Mémorisez les nœuds qui s’allument." : `Reproduisez la séquence : ${typed}/${sequence.length}`}</p>
            <div className="hack-nodes" aria-busy={showing}>
              {Array.from({ length: 9 }).map((_, i) => (
                <button key={i} data-flash={shown === i} disabled={showing} onClick={() => press(i)} aria-label={`Nœud ${i + 1}`}>
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        {(stage === "won" || stage === "lost") && (
          <div className="hack-brief" role="status">
            <h3>{stage === "won" ? "ACCÈS ACCORDÉ" : "INTRUSION DÉTECTÉE"}</h3>
            <p>{stage === "won" ? (errors === 0 ? "Aucune trace laissée dans le réseau. Un vrai fantôme." : `Plans téléchargés avec ${errors} erreur${errors > 1 ? "s" : ""}.`) : "Les troupes de sécurité remontent votre signal. Déconnexion d’urgence."}</p>
          </div>
        )}

        <p className="hack-feedback" role="status">
          {feedback}
        </p>
      </section>
    </div>
  );
}
