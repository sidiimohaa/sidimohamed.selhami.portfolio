"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Radar, Radio, X } from "lucide-react";
import BountyProjectPanel from "../BountyProjectPanel";
import { getBridgeSettings } from "../graphicsQuality";
import { galaxyAudio } from "./audio";
import { setCityHour } from "./cityEnv";
import { placeNames, eventById, type EventChoice, type EventPlace, type GalacticEvent } from "./catalog";
import type { DirectorNotice } from "./director";
import { registerSignalMarker } from "./signalMarker";
import { enabledPlace, galaxy, galaxyBusy, projectFor, setMonitorOpen, useGalaxy, useMonitorOpen } from "./store";

// The interface of the living universe: the copilot's short notifications, and the Galactic
// Activity Monitor. Both are ordinary HTML above the scenes, and neither ever blocks anything.

const priorityNames = ["", "ROUTINE", "NOTABLE", "MAJEUR"];
const statusNames = { active: "EN COURS", found: "DÉCOUVERT", ended: "TERMINÉ", ignored: "IGNORÉ" };
const clock = (at: number) => new Date(at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

type Props = { place: EventPlace | null; blocked: boolean; suspended?: boolean; sound: boolean; reduced: boolean };

export default function GalaxyLayer({ place, blocked, suspended = false, sound, reduced }: Props) {
  const director = useGalaxy();
  const open = useMonitorOpen();
  const [notice, setNotice] = useState<DirectorNotice | null>(null);
  const queue = useRef<DirectorNotice[]>([]);
  const noticeClock = useRef({ key: "", remaining: 0 });
  const live = useRef({ place, blocked, suspended });
  live.current = { place, blocked, suspended };

  useEffect(() => galaxyAudio.setEnabled(sound), [sound]);
  // Development only: trigger any event, or set the hour, from the console.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") (window as unknown as { __galaxy?: object }).__galaxy = { director, setCityHour };
  }, [director]);

  // The director's clock: once a second, and only while the page is on screen.
  useEffect(() => {
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now(),
        dt = Math.min(5, (now - last) / 1000);
      last = now;
      if (document.hidden || live.current.suspended) return;
      director.tick(dt, { place: live.current.place, blocked: live.current.blocked || galaxyBusy(), enabled: enabledPlace });
      queue.current.push(...director.drainNotices());
      // Nothing is said over a trip or a cinematic, and what no longer applies is dropped: a signal
      // heard in space must not be announced on a planet, nor one that has already ended.
      queue.current = queue.current.filter((item) => item.event.place === live.current.place && (item.kind !== "start" || director.active().some((run) => run.key === item.key)));
      if (live.current.blocked || galaxyBusy()) return;
      setNotice((current) => {
        if (current || !queue.current.length) return current;
        const next = queue.current.shift()!;
        galaxyAudio.radio(next.event.priority === 3);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [director]);

  // Each notification stays long enough to read, a little longer if it asks something.
  useEffect(() => {
    if (!notice) return;
    const key = `${notice.key}-${notice.kind}`;
    if (noticeClock.current.key !== key) noticeClock.current = { key, remaining: notice.kind === "start" && notice.event.choices ? 12000 : 7500 };
    if (suspended) return;
    const began = performance.now();
    const id = window.setTimeout(() => setNotice(null), noticeClock.current.remaining);
    return () => {
      window.clearTimeout(id);
      noticeClock.current.remaining = Math.max(0, noticeClock.current.remaining - (performance.now() - began));
    };
  }, [notice, suspended]);

  const running = notice && director.active().find((run) => run.key === notice.key);
  const choices = notice?.kind === "start" && running && !running.choice ? notice.event.choices : undefined;
  const pick = (event: GalacticEvent, choice: EventChoice) => {
    director.choose(event.id, choice.id);
    queue.current.push(...director.drainNotices());
    setNotice(null);
  };
  const silent = !getBridgeSettings().copilot;

  return (
    <>
      {(place === "space" || place === "hoth") && !blocked && (
        <div ref={registerSignalMarker} className="galaxy-marker" aria-hidden="true" style={{ display: "none" }}>
          <i />
          <span />
        </div>
      )}
      <AnimatePresence>
        {notice && !open && !(silent && notice.kind !== "start") && (
          <motion.aside
            key={`${notice.key}-${notice.kind}`}
            className="galaxy-toast"
            data-priority={notice.event.priority}
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: reduced ? 0 : -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : -6 }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header className="mono">
              <Radio size={13} aria-hidden="true" />
              <span>{notice.event.title.toUpperCase()}</span>
              <button aria-label="Fermer la notification" onClick={() => setNotice(null)}>
                <X size={13} aria-hidden="true" />
              </button>
            </header>
            {!silent && <p>{notice.line}</p>}
            {choices && (
              <div className="galaxy-toast-actions">
                {choices.map((choice) => (
                  <button key={choice.id} className="mono" onClick={() => pick(notice.event, choice)}>
                    {choice.label}
                  </button>
                ))}
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>
      <AnimatePresence>{open && <ActivityMonitor key="monitor" reduced={reduced} />}</AnimatePresence>
    </>
  );
}

function ActivityMonitor({ reduced }: { reduced: boolean }) {
  const director = useGalaxy();
  const panel = useRef<HTMLElement>(null);
  const [project, setProject] = useState<ReturnType<typeof projectFor>>(null);
  const active = director.active();
  const record = director.record();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setMonitorOpen(false);
    };
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("keydown", key, true);
      previous?.focus?.({ preventScroll: true });
    };
  }, []);

  return (
    <motion.section
      ref={panel}
      className="galaxy-monitor"
      role="dialog"
      aria-modal="false"
      aria-label="Moniteur d’activité galactique"
      initial={{ opacity: 0, x: reduced ? 0 : 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: reduced ? 0 : 12 }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <header>
        <div>
          <p className="mono">HOLONET · CAPTEURS LONGUE PORTÉE</p>
          <h2>Activité galactique</h2>
        </div>
        <button aria-label="Fermer le moniteur" onClick={() => setMonitorOpen(false)}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <h3 className="mono">SIGNAUX ACTIFS · {active.length}</h3>
      {active.length === 0 && <p className="galaxy-empty">Aucun signal pour l’instant. La galaxie reste à l’écoute.</p>}
      <ul>
        {active.map((run) => {
          const event = eventById(run.id);
          if (!event) return null;
          return (
            <li key={run.key} data-priority={event.priority}>
              <div className="galaxy-row">
                <strong>{event.title}</strong>
                <span className="mono">{placeNames[run.place].toUpperCase()}</span>
              </div>
              <p>{event.summary}</p>
              <div className="galaxy-row">
                <span className="mono galaxy-tag">{priorityNames[event.priority]}</span>
                {!run.choice &&
                  event.choices?.map((choice) => (
                    <button key={choice.id} className="mono" onClick={() => director.choose(event.id, choice.id)}>
                      {choice.label}
                    </button>
                  ))}
              </div>
            </li>
          );
        })}
      </ul>

      <h3 className="mono">DÉCOUVERTES · {record.discoveries.length}</h3>
      {record.discoveries.length === 0 && <p className="galaxy-empty">Rien pour l’instant. Certains événements révèlent des archives si vous les suivez jusqu’au bout.</p>}
      <ul>
        {record.discoveries.map((item) => {
          const event = eventById(item.id);
          return (
            <li key={item.id}>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
              {event?.discovery?.project && projectFor(item.id) && (
                <button className="mono" onClick={() => setProject(projectFor(item.id))}>
                  OUVRIR LA FICHE
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <h3 className="mono">HISTORIQUE</h3>
      {record.log.length === 0 && <p className="galaxy-empty">Le journal est vide.</p>}
      <ol className="galaxy-history">
        {record.log.slice(0, 12).map((row, i) => (
          <li key={`${row.id}-${row.at}-${i}`}>
            <time className="mono">{clock(row.at)}</time>
            <span>{eventById(row.id)?.title ?? row.id}</span>
            <small className="mono">{statusNames[row.status]}</small>
          </li>
        ))}
      </ol>
      {project && <BountyProjectPanel project={project} eyebrow="ARCHIVE RÉCUPÉRÉE" onClose={() => setProject(null)} />}
    </motion.section>
  );
}

/** The header's button for the monitor, with a dot while something is going on. */
export function MonitorButton({ className }: { className: string }) {
  const director = useGalaxy();
  const count = director.active().length;
  return (
    <button
      className={className}
      data-tip="Activité galactique"
      aria-label={count ? `Activité galactique : ${count} signal${count > 1 ? "s" : ""} actif${count > 1 ? "s" : ""}` : "Activité galactique"}
      onClick={() => setMonitorOpen(true)}
    >
      <Radar size={15} aria-hidden="true" />
      {count > 0 && <i className="galaxy-dot" aria-hidden="true" />}
    </button>
  );
}
