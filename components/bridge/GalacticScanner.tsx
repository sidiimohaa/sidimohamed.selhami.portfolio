"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Navigation, Radar, X } from "lucide-react";
import { destinations, landings, planetReferenceStyle } from "../universe";
import { useFlightLog } from "../flightLog";
import { missions, useJediProgression } from "../jediProgression";

type Props = {
  // Distance from the ship to each world when the sweep started, in scene units.
  distances: number[];
  reduced: boolean;
  onApproach: (index: number) => void;
  onClose: () => void;
};

const format = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

// A holographic sweep of the sector: every destination with its range and what waits there,
// what the visitor has already explored, and one unidentified signal pointing at a hidden mission.
export default function GalacticScanner({ distances, reduced, onApproach, onClose }: Props) {
  const [sweeping, setSweeping] = useState(!reduced);
  const log = useFlightLog();
  const { progress, count, total } = useJediProgression();
  const panel = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!sweeping) return;
    const timer = window.setTimeout(() => setSweeping(false), 1500);
    return () => clearTimeout(timer);
  }, [sweeping]);
  useEffect(() => {
    if (!sweeping) panel.current?.querySelector<HTMLElement>(".scanner-contact button")?.focus({ preventScroll: true });
  }, [sweeping]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const order = destinations.map((_, index) => index).sort((a, b) => (distances[a] ?? 0) - (distances[b] ?? 0));
  const hidden = missions.filter((mission) => !progress.found.includes(mission.id));
  // The same unidentified signal for a whole visit, so it reads as a lead rather than noise.
  const signal = hidden.length ? hidden[(log.visits + count) % hidden.length] : null;
  return (
    <motion.div
      className="galactic-scanner"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {sweeping && <div className="scanner-sweep" aria-hidden="true" />}
      <motion.section
        ref={panel}
        className="scanner-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scanner-title"
        aria-busy={sweeping}
        initial={{ opacity: 0, y: reduced ? 0 : 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="modal-top mono">
          <span>
            <Radar size={13} aria-hidden="true" /> SCANNER GALACTIQUE
          </span>
          <button className="close-button" aria-label="Fermer le scanner" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <h2 id="scanner-title">{sweeping ? "Balayage du secteur…" : `${destinations.length} contacts identifiés`}</h2>
        {!sweeping && (
          <>
            <ul className="scanner-contacts">
              {order.map((index) => {
                const world = destinations[index];
                const visited = log.orbits.includes(world.name) || log.landings.includes(world.name);
                const access = landings[world.name] ? "ATTERRISSAGE" : index === 3 ? "ACCOSTAGE" : null;
                return (
                  <li key={world.name} className="scanner-contact">
                    <i className="scanner-portrait" style={planetReferenceStyle(world)} aria-hidden="true" />
                    <span>
                      <b>{world.name}</b>
                      <small>
                        {world.category} · {format.format(Math.round((distances[index] ?? 0) * 10) * 10)} km
                      </small>
                      <em className="mono">
                        {visited ? "EXPLORÉ" : "NON EXPLORÉ"}
                        {access ? ` · ${access}` : ""}
                      </em>
                    </span>
                    <button className="text-button" onClick={() => onApproach(index)} aria-label={`Approcher ${world.name}`}>
                      APPROCHER <Navigation size={12} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="scanner-signal">
              <span className="mono">
                MISSIONS SECRÈTES · {count}/{total}
              </span>
              {signal ? (
                <p>
                  <b className="mono">SIGNAL NON IDENTIFIÉ</b> « {signal.whisper} »
                </p>
              ) : (
                <p>Aucun signal inconnu : toutes les missions du secteur sont accomplies.</p>
              )}
            </div>
          </>
        )}
      </motion.section>
    </motion.div>
  );
}
