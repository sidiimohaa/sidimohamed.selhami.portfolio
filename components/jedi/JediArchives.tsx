"use client";
import { forwardRef, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Lock, RotateCcw, X } from "lucide-react";
import {
  markMissionsSeen,
  missions,
  ranks,
  resetAdventure,
  rewards,
  useJediProgression,
  type Mission,
  type MissionId,
  type Reward,
} from "../jediProgression";
import { MissionIcon, RankBadge } from "./RankBadge";
import { anecdote, skills } from "./rewardContent";

// The cockpit's mission computer: "Archives de l'Ordre Jedi", with the pilot's profile, the ten
// missions, the holocron collection and the rewards, all read from the shared progression.

type Tab = "profile" | "missions" | "holocrons" | "rewards";
const tabs: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profil du pilote" },
  { id: "missions", label: "Missions galactiques" },
  { id: "holocrons", label: "Holocrons" },
  { id: "rewards", label: "Récompenses" },
];
const statusLabel = { secret: "SECRET", started: "EN COURS", done: "TERMINÉE" } as const;

export function XPProgressBar({ xp, max, reduced }: { xp: number; max: number; reduced: boolean }) {
  return (
    <div className="xp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={xp} aria-label="Expérience">
      <motion.i
        initial={{ scaleX: reduced ? xp / max : 0 }}
        animate={{ scaleX: xp / max }}
        transition={{ duration: reduced ? 0 : 1.4, ease: [0.2, 0.7, 0.2, 1], delay: reduced ? 0 : 0.35 }}
      />
      {Array.from({ length: 9 }, (_, i) => (
        <b key={i} style={{ left: `${(i + 1) * 10}%` }} />
      ))}
    </div>
  );
}

export function JediProgressPanel({ reduced }: { reduced: boolean }) {
  const { xp, maxXp, count, total, percent, rank, next, remainingToNext } = useJediProgression();
  return (
    <div className="jedi-profile">
      <div className={`jedi-profile-badge rank-glow-${rank.id}`} style={{ color: rank.color }}>
        <RankBadge rank={rank.id} size={96} label={`Insigne : ${rank.title}`} />
      </div>
      <dl className="jedi-profile-stats">
        <div>
          <dt>Rang actuel</dt>
          <dd className="jedi-rank-title" style={{ color: rank.color }}>{rank.title.toUpperCase()}</dd>
        </div>
        <div>
          <dt>Expérience</dt>
          <dd>
            {xp} / {maxXp} XP
          </dd>
        </div>
        <div className="jedi-profile-bar">
          <XPProgressBar xp={xp} max={maxXp} reduced={reduced} />
        </div>
        <div>
          <dt>Secrets</dt>
          <dd>
            {count} / {total}
          </dd>
        </div>
        <div>
          <dt>Exploration galactique</dt>
          <dd>{percent} %</dd>
        </div>
        <div>
          <dt>Prochain rang</dt>
          <dd>{next ? `${next.title.toUpperCase()} · encore ${remainingToNext} secret${remainingToNext > 1 ? "s" : ""}` : "AUCUN · LA PROPHÉTIE EST ACCOMPLIE"}</dd>
        </div>
        <div>
          <dt>Secrets restants</dt>
          <dd>{total - count}</dd>
        </div>
      </dl>
      <ol className="jedi-rank-ladder" aria-label="Rangs">
        {ranks.map((item) => (
          <li key={item.id} data-reached={count >= item.min} style={{ color: count >= item.min ? item.color : undefined }}>
            <RankBadge rank={item.id} size={26} />
            <span>{item.title}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function MissionDetails({ mission, status }: { mission: Mission; status: "secret" | "started" | "done" }) {
  if (status === "secret")
    return (
      <div className="mission-body">
        <strong className="mission-classified">MISSION CLASSIFIÉE — ACCÈS RESTREINT</strong>
        <p className="mission-whisper">
          <span>Murmure de Yoda</span> « {mission.whisper} »
        </p>
      </div>
    );
  return (
    <div className="mission-body">
      <strong className="mission-title">{mission.title}</strong>
      <p>{status === "done" ? mission.description : "Mission révélée. Il reste à l’accomplir."}</p>
      {status === "started" && (
        <p className="mission-whisper">
          <span>Murmure de Yoda</span> « {mission.whisper} »
        </p>
      )}
    </div>
  );
}

export function MissionList({ fresh }: { fresh: MissionId[] }) {
  const { status } = useJediProgression();
  return (
    <ol className="mission-list">
      {missions.map((mission, index) => {
        const state = status(mission.id),
          isNew = fresh.includes(mission.id);
        return (
          <motion.li
            key={mission.id}
            className="mission"
            data-status={state}
            data-new={isNew}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.04 * index, duration: 0.3 }}
          >
            <span className="mission-number">
              <small>MISSION</small>
              {mission.number}
            </span>
            <span className="mission-icon">{state === "secret" ? <Lock size={16} aria-hidden="true" /> : <MissionIcon icon={mission.icon} />}</span>
            <MissionDetails mission={mission} status={state} />
            <span className="mission-meta">
              <span className="mission-status">{statusLabel[state]}</span>
              <span className="mission-id">ID {state === "secret" ? "••••-••" : mission.id.toUpperCase()}</span>
              <span className="mission-reward">+100 XP</span>
            </span>
            {isNew && <span className="mission-new">NOUVELLE TRANSMISSION</span>}
          </motion.li>
        );
      })}
    </ol>
  );
}

function Holocron({ lit }: { lit: boolean }) {
  return (
    <span className="holocron" data-lit={lit} aria-hidden="true">
      <span className="holocron-cube">
        {["front", "back", "left", "right", "top", "bottom"].map((face) => (
          <i key={face} className={`holocron-face ${face}`} />
        ))}
      </span>
    </span>
  );
}

export function HolocronCollection() {
  const { status } = useJediProgression();
  const [open, setOpen] = useState<MissionId | null>(null);
  const chosen = missions.find((mission) => mission.id === open && status(mission.id) === "done");
  return (
    <div className="holocrons">
      <ul className="holocron-grid">
        {missions.map((mission) => {
          const lit = status(mission.id) === "done";
          return (
            <li key={mission.id}>
              <button
                className="holocron-slot"
                data-lit={lit}
                disabled={!lit}
                aria-pressed={open === mission.id}
                aria-label={lit ? mission.holocron.name : "Holocron verrouillé"}
                onClick={() => setOpen(open === mission.id ? null : mission.id)}
              >
                <Holocron lit={lit} />
                <span>{lit ? mission.holocron.name : "Verrouillé"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="holocron-reading" aria-live="polite">
        {chosen ? (
          <>
            <strong>{chosen.holocron.name}</strong>
            <p>{chosen.holocron.lore}</p>
            <small>Récupéré lors de la mission {chosen.number} — {chosen.title}</small>
          </>
        ) : (
          <p>Choisissez un holocron illuminé pour lire ce qu’il renferme.</p>
        )}
      </div>
    </div>
  );
}

export function RewardGallery({ onOpen }: { onOpen: (reward: Reward) => void }) {
  const { unlocked, progress, count, total } = useJediProgression();
  return (
    <ul className="reward-grid">
      {rewards.map((reward) => {
        const rank = ranks.find((item) => item.id === reward.rank)!,
          open = unlocked(reward);
        const destiny = reward.id === "destiny";
        return (
          <li key={reward.id} className="reward" data-open={open}>
            <span className="reward-visual" style={{ color: open ? rank.color : undefined }}>
              <RankBadge rank={rank.id} size={44} />
            </span>
            <span className="reward-copy">
              <strong>{reward.title}</strong>
              <small>Rang requis : {rank.title}</small>
              <span>{reward.description}</span>
              {destiny && progress.path && <small className="reward-path">Chemin choisi : {progress.path === "jedi" ? "l’Ordre Jedi" : "les Sith"}</small>}
            </span>
            <span className="reward-action">
              {open ? (
                <button className="jedi-button" onClick={() => onOpen(reward)}>
                  {destiny ? (progress.path ? "REVOIR LA DESTINÉE" : "ACCÉDER À LA DESTINÉE") : reward.id === "temple" ? "ENTRER" : "CONSULTER"}
                </button>
              ) : (
                <span className="reward-locked">
                  <Lock size={12} aria-hidden="true" /> {destiny ? `${count} / ${total} MISSIONS` : "VERROUILLÉE"}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function RewardReading({ reward, onBack }: { reward: Reward; onBack: () => void }) {
  return (
    <div className="reward-reading">
      <button className="jedi-link" onClick={onBack}>
        ← RETOUR AUX RÉCOMPENSES
      </button>
      {reward.id === "anecdote" ? (
        <>
          <h4>{anecdote.title}</h4>
          {anecdote.paragraphs.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </>
      ) : (
        <>
          <h4>{skills.title}</h4>
          <div className="skills-grid">
            {skills.groups.map((group) => (
              <section key={group.name}>
                <h5>{group.name}</h5>
                <ul>
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type TerminalProps = {
  mode: "holo" | "flat";
  reduced: boolean;
  onClose: () => void;
  // The temple and the final encounter play outside the cockpit.
  onLaunch: (experience: "temple" | "destiny") => void;
  style?: React.CSSProperties;
};

export const CockpitMissionTerminal = forwardRef<HTMLElement, TerminalProps>(function CockpitMissionTerminal({ mode, reduced, onClose, onLaunch, style }, ref) {
  const { progress, rank } = useJediProgression();
  // Missions completed since the last visit stay highlighted for this whole consultation.
  const [fresh] = useState<MissionId[]>(() => progress.unseen);
  const [tab, setTab] = useState<Tab>(() => (progress.unseen.length ? "missions" : "profile"));
  const [reading, setReading] = useState<Reward | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [booted, setBooted] = useState(reduced);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    markMissionsSeen();
    if (reduced) return;
    const timer = window.setTimeout(() => setBooted(true), 900);
    return () => window.clearTimeout(timer);
  }, [reduced]);
  const open = (reward: Reward) => {
    if (reward.id === "temple" || reward.id === "destiny") onLaunch(reward.id);
    else setReading(reward);
  };
  return (
    <section
      ref={ref}
      className={`jedi-terminal jedi-terminal-${mode} rank-tone-${rank.id}`}
      style={style}
      role="dialog"
      aria-modal="true"
      aria-labelledby="jedi-terminal-title"
    >
      <div className="jedi-terminal-sweep" aria-hidden="true" />
      <header className="jedi-terminal-head">
        <div>
          <p className="jedi-eyebrow">ORDINATEUR DE BORD · JOURNAL DE MISSIONS</p>
          <h3 id="jedi-terminal-title">Archives de l’Ordre Jedi</h3>
        </div>
        <button className="jedi-close" onClick={onClose} aria-label="Fermer le journal de missions">
          <X size={16} />
          <span>FERMER</span>
        </button>
      </header>
      <AnimatePresence mode="wait">
        {!booted ? (
          <motion.div key="boot" className="jedi-boot mono" exit={{ opacity: 0 }} role="status">
            <span>LIAISON AVEC LES ARCHIVES…</span>
            <span>IDENTIFICATION DU PILOTE…</span>
            <span>CHARGEMENT DES DONNÉES</span>
          </motion.div>
        ) : (
          <motion.div key="content" className="jedi-terminal-body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <div className="jedi-tabs" role="tablist" aria-label="Sections du journal">
              {tabs.map((item, index) => (
                <button
                  key={item.id}
                  ref={(element) => {
                    tabRefs.current[index] = element;
                  }}
                  role="tab"
                  id={`jedi-tab-${item.id}`}
                  aria-selected={tab === item.id}
                  aria-controls={`jedi-panel-${item.id}`}
                  tabIndex={tab === item.id ? 0 : -1}
                  onClick={() => {
                    setTab(item.id);
                    setReading(null);
                  }}
                  onKeyDown={(event) => {
                    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
                    if (!step) return;
                    event.preventDefault();
                    const next = (index + step + tabs.length) % tabs.length;
                    setTab(tabs[next].id);
                    setReading(null);
                    tabRefs.current[next]?.focus();
                  }}
                >
                  {item.label}
                  {item.id === "missions" && fresh.length > 0 && <i className="jedi-tab-dot" aria-label="nouveau" />}
                </button>
              ))}
            </div>
            <div className="jedi-panel" role="tabpanel" id={`jedi-panel-${tab}`} aria-labelledby={`jedi-tab-${tab}`} tabIndex={0}>
              {tab === "profile" && <JediProgressPanel reduced={reduced} />}
              {tab === "missions" && <MissionList fresh={fresh} />}
              {tab === "holocrons" && <HolocronCollection />}
              {tab === "rewards" && (reading ? <RewardReading reward={reading} onBack={() => setReading(null)} /> : <RewardGallery onOpen={open} />)}
            </div>
            <footer className="jedi-terminal-foot">
              {confirming ? (
                <span className="jedi-confirm" role="alertdialog" aria-label="Confirmer la réinitialisation">
                  Effacer toute votre progression ?
                  <button
                    className="jedi-button danger"
                    onClick={() => {
                      resetAdventure();
                      setConfirming(false);
                      setTab("profile");
                    }}
                  >
                    OUI, TOUT EFFACER
                  </button>
                  <button className="jedi-link" onClick={() => setConfirming(false)}>
                    ANNULER
                  </button>
                </span>
              ) : (
                <button className="jedi-link" onClick={() => setConfirming(true)}>
                  <RotateCcw size={11} aria-hidden="true" /> RÉINITIALISER MON AVENTURE
                </button>
              )}
              <span className="mono">PROGRESSION ENREGISTRÉE SUR CET APPAREIL</span>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
});
