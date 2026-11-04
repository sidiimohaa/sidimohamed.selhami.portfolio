"use client";
import type { ReactNode } from "react";
import { Coins, Crosshair, Download, Globe, Home, Lock, Mail, Radio, Volume2, VolumeX, type LucideIcon } from "lucide-react";
import { CV_PDF, identity } from "../deathStar/cvData";
import { sectorIds, type SectorPick, type SectorId } from "./lostRotation";

// What every lost sector shares: the way home, the missing address read as coordinates, the CV and
// the contact, and the collection of lost sectors found so far. Only the scene and its story change.

export const lostMail = `mailto:${identity.email}?subject=${encodeURIComponent("Contact depuis ORBITAL")}`;

export type Collection = SectorPick;

const sectorMeta: Record<SectorId, { label: string; Icon: LucideIcon }> = {
  asteroids: { label: "Champ d’astéroïdes", Icon: Crosshair },
  transmission: { label: "Transmission perdue", Icon: Radio },
  jawas: { label: "Les Jawas", Icon: Coins },
  planet: { label: "Planète 404", Icon: Globe },
};

// The collection as four beacons: a found sector can be revisited, an unknown one stays locked.
function LostBeacons({ collection }: { collection: Collection }) {
  const complete = collection.found >= collection.total;
  return (
    <nav className="lost-beacons" aria-label={`Secteurs perdus explorés : ${collection.found} sur ${collection.total}`}>
      {sectorIds.map((id) => {
        const { label, Icon } = sectorMeta[id];
        if (!collection.seen.includes(id))
          return (
            <span key={id} className="lost-beacon is-locked" data-tip="Secteur non découvert" aria-label="Secteur non découvert">
              <Lock size={13} aria-hidden="true" />
            </span>
          );
        return (
          <a
            key={id}
            className="lost-beacon"
            href={`?secteur=${id}`}
            data-tip={label}
            aria-label={id === collection.id ? `${label}, secteur actuel` : `Revoir le secteur ${label}`}
            aria-current={id === collection.id ? "page" : undefined}
          >
            <Icon size={14} aria-hidden="true" />
          </a>
        );
      })}
      <em className="mono" data-complete={complete}>
        {complete ? "COLLECTION COMPLÈTE" : `${collection.found}/${collection.total}`}
      </em>
    </nav>
  );
}

export function LostHeader({ sound, onSound, collection }: { sound?: boolean; onSound?: () => void; collection?: Collection }) {
  return (
    <header className="lost-head">
      <a className="lost-logo" href="/" aria-label="Revenir à l’accueil d’ORBITAL">
        ORBITAL<sup>404</sup>
      </a>
      <div className="lost-head-tools">
        {collection && <LostBeacons collection={collection} />}
        {onSound && (
          <button className="lost-sound" onClick={onSound} aria-pressed={sound} aria-label={sound ? "Couper le son" : "Activer le son"}>
            {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        )}
      </div>
    </header>
  );
}

export function LostLinks() {
  return (
    <nav className="lost-links" aria-label="Accès directs">
      <a href={CV_PDF} download>
        <Download size={14} /> Télécharger mon CV
      </a>
      <a href={lostMail}>
        <Mail size={14} /> Me contacter
      </a>
    </nav>
  );
}

type CardProps = {
  kicker: string;
  title: string;
  // The address that led nowhere, shown as the coordinates the jump was aimed at.
  path: string;
  children: ReactNode;
  primary?: ReactNode;
  extra?: ReactNode;
  // The way home is the main action unless the variant offers its own.
  homePrimary?: boolean;
  // The large 404 numeral, left out where the scene already spells it.
  code?: boolean;
  // The coordinates line, left out where the scene already reads the address.
  coords?: boolean;
  className?: string;
  titleId?: string;
};

export function LostCard({ kicker, title, path, children, primary, extra, homePrimary, code = true, coords = true, className, titleId = "lost-title" }: CardProps) {
  return (
    <section className={`lost-card ${className ?? ""}`} aria-labelledby={titleId}>
      <div className="lost-card-head">
        {code && (
          <b className="lost-code" aria-hidden="true">
            404
          </b>
        )}
        <span className="mono">{kicker}</span>
      </div>
      <h1 id={titleId}>{title}</h1>
      {coords && (
        <p className="lost-coords mono">
          <span>COORDONNÉES</span>
          <code>{path || "/"}</code>
          <em>INTROUVABLES</em>
        </p>
      )}
      {children}
      {extra}
      <div className="lost-actions">
        {primary}
        <a href="/" className={homePrimary || !primary ? "is-primary" : ""}>
          <Home size={16} /> Retour à ORBITAL
        </a>
      </div>
      <LostLinks />
    </section>
  );
}
