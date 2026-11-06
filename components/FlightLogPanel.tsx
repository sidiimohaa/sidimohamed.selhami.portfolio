"use client";
import { forwardRef, useEffect, useState } from "react";
import { Compass, Gamepad2, ScrollText, X } from "lucide-react";
import { useFlightLog } from "./flightLog";
import { useGalaxy } from "./galaxy/store";
import { useJediProgression } from "./jediProgression";
import { useArcade, achievements } from "./arcade/arcadeStore";
import { arcadeGames } from "./arcade/catalog";
import { loadDossier } from "./deathStar/dossierProgress";
import { SECTIONS } from "./deathStar/cvData";
import { destinations } from "./universe";

// The pilot's log, opened from the dashboard: where the visitor has been, how long they have flown,
// their Jedi missions, their arcade standing and how much of the record they have read, with
// the next course to set.

type Props = {
  mode: "holo" | "flat";
  reduced: boolean;
  onClose: () => void;
  onLaunch: (index: number) => void;
  onArcade: () => void;
  onJournal: () => void;
  style?: React.CSSProperties;
};

const duration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return "moins d’une minute";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${(minutes % 60).toString().padStart(2, "0")}`;
};

export const FlightLogPanel = forwardRef<HTMLElement, Props>(function FlightLogPanel({ mode, onClose, onLaunch, onArcade, onJournal, style }, ref) {
  const log = useFlightLog();
  const activity = useGalaxy().record();
  const { count, total, rank } = useJediProgression();
  const { data, grade } = useArcade();
  const [dossier, setDossier] = useState(0);
  useEffect(() => setDossier(loadDossier().seen.length), []);
  const visited = destinations.filter((item) => log.orbits.includes(item.name)).length;
  const wins = arcadeGames.filter((game) => data.stats[game.id].wins > 0).length;
  const unlocked = Object.keys(data.unlocked).length;
  const records = arcadeGames.filter((game) => data.stats[game.id].plays > 0);
  const nextIndex = destinations.findIndex((item) => !log.orbits.includes(item.name));
  const next = nextIndex >= 0 ? destinations[nextIndex] : null;
  const status = (name: string, index: number) => {
    if (index === 3 && log.docked) return "Station accostée";
    if (log.landings.includes(name)) return "Atterrissage effectué";
    if (log.orbits.includes(name)) return "Visitée en orbite";
    return "Pas encore visitée";
  };

  return (
    <section ref={ref} className={`flight-log flight-log-${mode}`} style={style} role="dialog" aria-modal="true" aria-labelledby="flight-log-title">
      <header className="flight-log-head">
        <div>
          <span className="mono">X-WING · JOURNAL DU PILOTE</span>
          <h3 id="flight-log-title">Carnet de vol</h3>
          <p>
            {log.since ? `Premier vol le ${new Date(log.since).toLocaleDateString("fr-FR")}` : "Premier vol aujourd’hui"} · {log.visits || 1} visite{log.visits > 1 ? "s" : ""}
          </p>
        </div>
        <button className="flight-log-close" onClick={onClose} aria-label="Fermer le carnet de vol">
          <X size={16} />
          <span>FERMER</span>
        </button>
      </header>
      <div className="flight-log-body">
        <dl className="flight-log-figures">
          <div>
            <dt>Planètes visitées</dt>
            <dd>
              {visited}/{destinations.length}
            </dd>
          </div>
          <div>
            <dt>Atterrissages</dt>
            <dd>{log.landings.length}</dd>
          </div>
          <div>
            <dt>Temps de vol</dt>
            <dd>{duration(log.seconds)}</dd>
          </div>
          <div>
            <dt>Missions Jedi</dt>
            <dd>
              {count}/{total} <small>{rank.title}</small>
            </dd>
          </div>
          <div>
            <dt>Événements observés</dt>
            <dd>
              {activity.seen} <small>{activity.discoveries.length} découverte{activity.discoveries.length > 1 ? "s" : ""}</small>
            </dd>
          </div>
          <div>
            <dt>Galactic Arcade</dt>
            <dd>
              {data.credits.toLocaleString("fr-FR")} CR <small>{grade.title}</small>
            </dd>
          </div>
          <div>
            <dt>Dossier CV consulté</dt>
            <dd>
              {dossier}/{SECTIONS.length}
            </dd>
          </div>
        </dl>

        {next ? (
          <div className="flight-log-next">
            <span className="mono">PROCHAIN CAP SUGGÉRÉ</span>
            <strong>{next.name}</strong>
            <p>{next.summary}</p>
            <button onClick={() => onLaunch(nextIndex)}>
              <Compass size={14} /> Mettre le cap sur {next.name}
            </button>
          </div>
        ) : (
          <div className="flight-log-next">
            <span className="mono">EXPLORATION</span>
            <strong>Toute la galaxie a été visitée.</strong>
            <p>{log.docked ? "Il reste peut-être des secrets dans les missions Jedi." : "L’Étoile de la Mort attend encore votre accostage : le dossier du pilote y est archivé."}</p>
          </div>
        )}

        <section>
          <h4>Destinations</h4>
          <ul className="flight-log-places">
            {destinations.map((item, index) => (
              <li key={item.name} data-state={log.orbits.includes(item.name) ? "done" : "todo"}>
                <span>
                  <strong>{index === 3 ? "Étoile de la Mort" : item.name}</strong>
                  <small>
                    {item.category} · {status(item.name, index)}
                  </small>
                </span>
                <button onClick={() => onLaunch(index)} aria-label={`Mettre le cap sur ${item.name}`}>
                  <Compass size={13} /> CAP
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h4>Simulations</h4>
          <p className="flight-log-note">
            {wins}/{arcadeGames.length} simulations réussies · {unlocked}/{achievements.length} succès débloqués
          </p>
          {records.length > 0 ? (
            <ul className="flight-log-records">
              {records.map((game) => {
                const stats = data.stats[game.id];
                const best = game.scoring === "time" ? (stats.bestTime !== null ? `${stats.bestTime.toFixed(2)} s` : "—") : (stats.best ?? 0).toLocaleString("fr-FR");
                return (
                  <li key={game.id}>
                    <span>{game.name}</span>
                    <b>{best}</b>
                    <small>
                      {stats.plays} partie{stats.plays > 1 ? "s" : ""}
                    </small>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="flight-log-note">Aucune simulation jouée pour l’instant.</p>
          )}
        </section>

        <div className="flight-log-actions">
          <button onClick={onArcade}>
            <Gamepad2 size={14} /> Ouvrir Galactic Arcade
          </button>
          <button onClick={onJournal}>
            <ScrollText size={14} /> Journal de missions
          </button>
        </div>
      </div>
    </section>
  );
});
