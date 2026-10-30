"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, X } from "lucide-react";
import { XP_PER_MISSION, useJediProgression, type Mission, type Rank } from "../jediProgression";
import { RankBadge } from "./RankBadge";

// Everything the progression shows outside the cockpit terminal: the "mission accomplie" toast,
// the rank ceremonies, the discreet widget, and the screens a few missions open.

export function SecretDiscoveryToast({ mission, total, reduced, onDone }: { mission: Mission; total: number; reduced: boolean; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 4800);
    return () => window.clearTimeout(timer);
  }, [onDone]);
  return (
    <motion.div
      className="secret-toast"
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: reduced ? 0 : -18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : -10 }}
      transition={{ duration: reduced ? 0.15 : 0.45, ease: [0.2, 0.7, 0.2, 1] }}
    >
      <span className="secret-toast-sweep" aria-hidden="true" />
      {!reduced && (
        <span className="secret-toast-sparks" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <i key={i} style={{ "--i": i } as React.CSSProperties} />
          ))}
        </span>
      )}
      <strong>MISSION ACCOMPLIE</strong>
      <span>Un nouveau secret de la galaxie a été découvert.</span>
      <span className="secret-toast-line mono">
        MISSION {mission.number} · {mission.title.toUpperCase()} · {total} / 10
      </span>
      <b className="secret-toast-xp">+{XP_PER_MISSION} XP</b>
    </motion.div>
  );
}

const ceremony: Record<string, { message: string; lines?: string[] }> = {
  padawan: { message: "Votre apprentissage de la Force commence." },
  knight: { message: "Vous avez franchi une nouvelle étape dans la maîtrise de la Force." },
  master: { message: "Le Conseil reconnaît votre maîtrise de la Force." },
  chosen: { message: "", lines: ["LA PROPHÉTIE EST ACCOMPLIE", "VOUS ÊTES L’ÉLU"] },
};

export function RankUpCinematic({ to, reduced, onDone }: { to: Rank; reduced: boolean; onDone: () => void }) {
  const skip = useRef<HTMLButtonElement>(null);
  const chosen = to.id === "chosen";
  const [stage, setStage] = useState(0);
  useEffect(() => {
    skip.current?.focus();
    const length = reduced ? 3200 : chosen ? 10500 : 5600;
    const timers = [window.setTimeout(onDone, length)];
    if (chosen && !reduced) timers.push(window.setTimeout(() => setStage(1), 5600));
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDone();
    };
    window.addEventListener("keydown", key);
    return () => {
      timers.forEach(window.clearTimeout);
      window.removeEventListener("keydown", key);
    };
  }, [chosen, reduced, onDone]);
  const { message, lines } = ceremony[to.id];
  return (
    <motion.div
      className={`rank-cinematic rank-cinematic-${to.id}`}
      data-reduced={reduced}
      role="dialog"
      aria-modal="true"
      aria-label={`Nouveau rang : ${to.title}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.2 : 0.6 }}
    >
      {!reduced && (
        <div className="rank-cinematic-stage" aria-hidden="true">
          {to.id === "padawan" && <i className="rank-fx-halo" />}
          {to.id === "knight" && (
            <>
              <i className="rank-fx-sweep" />
              <i className="rank-fx-saber" />
            </>
          )}
          {to.id === "master" && <i className="rank-fx-gold" />}
          {chosen && (
            <>
              <i className="rank-fx-blue" />
              <i className="rank-fx-red" />
              <i className="rank-fx-wave" />
            </>
          )}
          {to.id !== "padawan" && (
            <span className={`rank-fx-particles ${to.id === "master" ? "orbit" : ""}`}>
              {Array.from({ length: to.id === "knight" ? 14 : 18 }, (_, i) => (
                <i key={i} style={{ "--i": i } as React.CSSProperties} />
              ))}
            </span>
          )}
        </div>
      )}
      <div className="rank-cinematic-copy">
        <motion.span
          className="rank-cinematic-badge"
          style={{ color: to.color }}
          initial={{ opacity: 0, scale: reduced ? 1 : 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: reduced ? 0 : chosen ? 3.6 : 0.9, duration: reduced ? 0.2 : 1.1, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <RankBadge rank={to.id} size={132} />
        </motion.span>
        <p className="rank-cinematic-eyebrow mono">NOUVEAU RANG</p>
        {lines ? (
          <AnimatePresence mode="wait">
            <motion.h2
              key={stage}
              initial={{ opacity: 0, letterSpacing: reduced ? "4px" : "18px" }}
              animate={{ opacity: 1, letterSpacing: "4px" }}
              exit={{ opacity: 0 }}
              transition={{ delay: reduced ? 0 : stage ? 0.2 : 4.2, duration: reduced ? 0.2 : 1.2 }}
            >
              {lines[stage]}
            </motion.h2>
          </AnimatePresence>
        ) : (
          <motion.h2
            initial={{ opacity: 0, letterSpacing: reduced ? "4px" : "18px" }}
            animate={{ opacity: 1, letterSpacing: "4px" }}
            transition={{ delay: reduced ? 0 : 1.4, duration: reduced ? 0.2 : 1.2 }}
          >
            {to.title.toUpperCase()}
          </motion.h2>
        )}
        {message && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? 0 : 2.2, duration: 0.8 }}>
            {message}
          </motion.p>
        )}
      </div>
      <button ref={skip} className="rank-cinematic-skip" onClick={onDone}>
        PASSER <ChevronRight size={13} aria-hidden="true" />
      </button>
    </motion.div>
  );
}

export function JediProgressWidget({ onOpenJournal, hidden }: { onOpenJournal: () => void; hidden?: boolean }) {
  const { rank, xp, maxXp, count, total, next, remainingToNext, progress } = useJediProgression();
  const [open, setOpen] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!shell.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", key);
    };
  }, [open]);
  if (hidden) return null;
  return (
    <div className="jedi-widget" ref={shell} onPointerDown={(event) => event.stopPropagation()}>
      <button
        className="jedi-widget-chip"
        style={{ color: rank.color }}
        aria-expanded={open}
        aria-label={`Progression Jedi : ${rank.title}, ${count} secrets sur ${total}`}
        onClick={() => setOpen(!open)}
      >
        <RankBadge rank={rank.id} size={20} />
        <span className="jedi-widget-gauge" aria-hidden="true">
          <i style={{ transform: `scaleX(${xp / maxXp})` }} />
        </span>
        <span className="jedi-widget-count mono">
          {count}/{total}
        </span>
        {progress.unseen.length > 0 && <i className="jedi-alert-dot" aria-hidden="true" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="jedi-widget-card" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
            <p className="jedi-eyebrow">PROFIL DU PILOTE</p>
            <strong style={{ color: rank.color }}>{rank.title.toUpperCase()}</strong>
            <span>
              {xp} / {maxXp} XP · {count} secret{count > 1 ? "s" : ""} sur {total}
            </span>
            <span className="jedi-widget-next">{next ? `Prochain rang : ${next.title}, encore ${remainingToNext}` : "Tous les secrets sont découverts."}</span>
            <button
              className="jedi-button"
              onClick={() => {
                setOpen(false);
                onOpenJournal();
              }}
            >
              OUVRIR LE JOURNAL DU COCKPIT
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// The jump to lightspeed: stars stretch into lines from the centre, then a white flash.
export function HyperspaceJump({ reduced, onDone }: { reduced: boolean; onDone: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current!;
    const c = el.getContext("2d")!;
    const ratio = Math.min(window.devicePixelRatio, 2);
    el.width = window.innerWidth * ratio;
    el.height = window.innerHeight * ratio;
    const stars = Array.from({ length: window.innerWidth < 700 ? 160 : 320 }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random() * 0.9 + 0.02, s: 0.6 + Math.random() }));
    const length = reduced ? 900 : 2600;
    const start = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const t = Math.min(1, (now - start) / length),
        w = el.width,
        h = el.height,
        reach = Math.hypot(w, h) / 2;
      c.fillStyle = `rgba(2,6,14,${reduced ? 0.9 : 0.35})`;
      c.fillRect(0, 0, w, h);
      const speed = reduced ? 0 : Math.pow(t, 2.2);
      c.lineCap = "round";
      stars.forEach((star) => {
        const r0 = star.r * reach * (0.5 + speed * 1.4),
          r1 = r0 + reach * speed * star.s * 0.9 + 2 * ratio;
        c.strokeStyle = `rgba(${200 + star.s * 30},${225 + star.s * 20},255,${0.4 + speed * 0.6})`;
        c.lineWidth = (0.6 + star.s * 0.9) * ratio;
        c.beginPath();
        c.moveTo(w / 2 + Math.cos(star.a) * r0, h / 2 + Math.sin(star.a) * r0);
        c.lineTo(w / 2 + Math.cos(star.a) * r1, h / 2 + Math.sin(star.a) * r1);
        c.stroke();
      });
      if (t > 0.82) {
        c.fillStyle = `rgba(235,245,255,${(t - 0.82) / 0.18})`;
        c.fillRect(0, 0, w, h);
      }
      if (t < 1) frame = requestAnimationFrame(draw);
      else onDone();
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [reduced, onDone]);
  return (
    <motion.div className="hyperspace-jump" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} role="status" aria-label="Saut en hyperespace">
      <canvas ref={canvas} aria-hidden="true" />
      <span className="hyperspace-jump-label mono">PASSAGE EN VITESSE LUMIÈRE</span>
    </motion.div>
  );
}

function Transmission({ tone, eyebrow, title, onClose, children }: { tone: "empire" | "archive"; eyebrow: string; title: string; onClose: () => void; children: React.ReactNode }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      previous?.focus?.();
    };
  }, [onClose]);
  return (
    <motion.div className={`holo-transmission holo-${tone}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={(event) => event.stopPropagation()}>
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="holo-transmission-title"
        initial={{ opacity: 0, scaleY: 0.04 }}
        animate={{ opacity: 1, scaleY: 1 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <span className="holo-transmission-scan" aria-hidden="true" />
        <header>
          <span className="mono">{eyebrow}</span>
          <button ref={close} onClick={onClose} aria-label="Fermer la transmission">
            <X size={16} />
          </button>
        </header>
        <h3 id="holo-transmission-title">{title}</h3>
        {children}
      </motion.section>
    </motion.div>
  );
}

export function ImperialTransmission({ onClose }: { onClose: () => void }) {
  return (
    <Transmission tone="empire" eyebrow="TRANSMISSION IMPÉRIALE · PRIORITÉ ABSOLUE" title="À tous les commandants" onClose={onClose}>
      <svg className="holo-figure" viewBox="0 0 120 140" aria-hidden="true">
        <path d="M60 10 C35 10 24 32 24 52 C24 62 28 70 30 78 C18 86 10 104 8 136 H112 C110 104 102 86 90 78 C92 70 96 62 96 52 C96 32 85 10 60 10 Z" />
        <path d="M44 58 C48 66 72 66 76 58 C74 74 66 82 60 82 C54 82 46 74 44 58 Z" opacity="0.5" />
      </svg>
      <p className="holo-quote">« Le moment est venu. Exécutez l’ordre 66. »</p>
      <p>Le code a été reconnu. Cette transmission n’aurait jamais dû vous parvenir, pilote : l’Empire écoute toujours.</p>
    </Transmission>
  );
}

export function ArchivesDossier({ onClose }: { onClose: () => void }) {
  return (
    <Transmission tone="archive" eyebrow="ARCHIVES OUBLIÉES · DOSSIER DU PILOTE" title="Dossier : le pilote de ce portfolio" onClose={onClose}>
      <dl className="holo-dossier">
        <div>
          <dt>Origine</dt>
          <dd>Texte provisoire — d’où vous venez, ce qui vous a mené jusqu’ici.</dd>
        </div>
        <div>
          <dt>Formation</dt>
          <dd>Texte provisoire — les étapes de votre parcours d’études.</dd>
        </div>
        <div>
          <dt>Premières missions</dt>
          <dd>Texte provisoire — premiers projets, stages ou expériences.</dd>
        </div>
        <div>
          <dt>Cap actuel</dt>
          <dd>Texte provisoire — ce que vous cherchez aujourd’hui (alternance, poste, collaboration).</dd>
        </div>
      </dl>
    </Transmission>
  );
}
