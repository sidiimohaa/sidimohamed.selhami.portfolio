"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, Globe, Linkedin, Mail, Rocket, X } from "lucide-react";
import { CV_PDF, SECTIONS, certifications, education, experiences, identity, interests, languages, projects, sectionLabel, skillTree, statusLabel, type Section } from "./cvData";

// The recruiter's view of the record: every essential in a few clicks, readable without the 3D
// station, by keyboard and on a phone. The station's CV terminal opens the same component on the
// complete CV, all sections one after the other.

type Props = {
  view: "sections" | "complete";
  initial?: Section;
  title?: string;
  onSeen: (section: Section) => void;
  onClose: () => void;
  onExit: () => void;
  // Back into the 3D station, when it is available.
  onExplore?: () => void;
};

function Actions({ onExit }: { onExit: () => void }) {
  return (
    <div className="ds-actions">
      <a className="ds-action primary" href={CV_PDF} download>
        <Download size={14} /> Télécharger mon CV
      </a>
      <a className="ds-action" href={identity.linkedin} target="_blank" rel="noopener noreferrer">
        <Linkedin size={14} /> LinkedIn
      </a>
      <a className="ds-action" href={`mailto:${identity.email}?subject=${encodeURIComponent("Votre profil – alternance marketing digital")}`}>
        <Mail size={14} /> M’envoyer un e-mail
      </a>
      <button className="ds-action" onClick={onExit}>
        <Globe size={14} /> Revenir à la galaxie
      </button>
    </div>
  );
}

function Block({ id, onSeen, children }: { id: Section; onSeen: (section: Section) => void; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  // A section counts as consulted once a good part of it has been on screen.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      onSeen(id);
      return;
    }
    const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && onSeen(id), { threshold: 0.35 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [id, onSeen]);
  return (
    <section ref={ref} id={`ds-${id}`} className="ds-block" aria-labelledby={`ds-${id}-title`}>
      <h3 id={`ds-${id}-title`}>
        <span className="mono">{String(SECTIONS.indexOf(id) + 1).padStart(2, "0")}</span> {sectionLabel[id]}
      </h3>
      {children}
    </section>
  );
}

function Content({ id }: { id: Section }) {
  if (id === "profil")
    return (
      <>
        <p className="ds-lead">{identity.summary}</p>
        <p>{identity.ambition}</p>
        <p className="ds-search">{identity.search}</p>
        <dl className="ds-facts">
          <div><dt>Formation</dt><dd>{identity.program} · {identity.school}</dd></div>
          <div><dt>Année</dt><dd>{identity.schoolYear}</dd></div>
          <div><dt>Rythme</dt><dd>{identity.rhythm}</dd></div>
          <div><dt>Mobilité</dt><dd>{identity.location} · {identity.mobility}</dd></div>
          <div><dt>Langues</dt><dd>{languages.join(" · ")}</dd></div>
          <div><dt>Centres d’intérêt</dt><dd>{interests.join(" · ")}</dd></div>
        </dl>
      </>
    );
  if (id === "experiences")
    return (
      <ol className="ds-list">
        {experiences.map((item) => (
          <li key={item.id} className={item.highlight ? "highlight" : ""}>
            <header>
              <strong>{item.role}</strong>
              <span>{item.company} · {item.place}</span>
              <small className="mono">{item.contract} · {item.period}{item.duration ? ` · ${item.duration}` : ""}</small>
            </header>
            <ul>{item.missions.map((mission) => <li key={mission}>{mission}</li>)}</ul>
            <p className="ds-tags">{item.skills.map((skill) => <span key={skill}>{skill}</span>)}</p>
          </li>
        ))}
      </ol>
    );
  if (id === "formations")
    return (
      <>
        <ol className="ds-list">
          {[...education].reverse().map((item) => (
            <li key={item.id}>
              <header>
                <strong>{item.title}</strong>
                <span>{item.school}{item.place ? ` · ${item.place}` : ""}</span>
                <small className="mono">{item.period}{item.status ? ` · ${item.status}` : ""}</small>
              </header>
              <ul>{item.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
            </li>
          ))}
        </ol>
        {certifications.length > 0 && (
          <>
            <h4>Certifications</h4>
            <ul className="ds-plain">{certifications.map((item) => <li key={item.name}>{item.name} · {item.issuer} · {item.date}</li>)}</ul>
          </>
        )}
      </>
    );
  if (id === "competences")
    return (
      <>
        <p className="ds-legend">
          {(["confirmed", "growing", "interest"] as const).map((status) => (
            <span key={status} data-status={status}>{statusLabel[status]}</span>
          ))}
        </p>
        <div className="ds-skills">
          {skillTree.map((category) => (
            <section key={category.id} style={{ ["--ds-accent" as string]: category.color }}>
              <h4><span className="mono">{category.letter}</span> {category.name}</h4>
              <ul>
                {category.skills.map((skill) => (
                  <li key={skill.id} data-status={skill.status}>
                    <strong>{skill.name}</strong>
                    <small>{statusLabel[skill.status]}</small>
                    <p>{skill.description} <em>{skill.context}</em></p>
                    {skill.proof.length > 0 && <p className="ds-proof">Preuves : {skill.proof.join(" · ")}</p>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </>
    );
  if (id === "projets")
    return (
      <ol className="ds-list">
        {projects.map((item) => (
          <li key={item.id}>
            <header>
              <strong>{item.title}</strong>
              <small className="mono">{item.kind}</small>
            </header>
            <dl className="ds-facts">
              <div><dt>Objectif</dt><dd>{item.goal}</dd></div>
              <div><dt>Problème</dt><dd>{item.problem}</dd></div>
              <div><dt>Solution</dt><dd>{item.solution}</dd></div>
              <div><dt>Technologies</dt><dd>{item.stack.join(" · ")}</dd></div>
              <div><dt>Ma contribution</dt><dd>{item.contribution}</dd></div>
              <div><dt>Résultat</dt><dd>{item.result}</dd></div>
            </dl>
            {item.link && <a className="ds-link" href={item.link.href} target="_blank" rel="noopener noreferrer">{item.link.label} ↗</a>}
          </li>
        ))}
      </ol>
    );
  return (
    <dl className="ds-facts ds-contact">
      <div><dt>E-mail</dt><dd><a href={`mailto:${identity.email}`}>{identity.email}</a></dd></div>
      <div><dt>LinkedIn</dt><dd><a href={identity.linkedin} target="_blank" rel="noopener noreferrer">Sidi-Mohamed Selhami ↗</a></dd></div>
      <div><dt>Localisation</dt><dd>{identity.location}</dd></div>
      <div><dt>CV</dt><dd><a href={CV_PDF} download>Télécharger le PDF</a></dd></div>
    </dl>
  );
}

export default function RecruiterMode({ view, initial = "profil", title = "Mode Recruteur", onSeen, onClose, onExit, onExplore }: Props) {
  const [section, setSection] = useState<Section>(initial);
  const [layout, setLayout] = useState(view);
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => previous?.focus?.();
  }, []);
  const pick = (id: Section) => {
    setSection(id);
    if (layout === "complete") document.getElementById(`ds-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    else panel.current?.scrollTo({ top: 0 });
  };
  return (
    <div className="ds-recruiter" role="dialog" aria-modal="true" aria-labelledby="ds-recruiter-title">
      <div className="ds-sheet">
        <header className="ds-head">
          <div>
            <span className="mono">ARCHIVES IMPÉRIALES · {title.toUpperCase()}</span>
            <h2 id="ds-recruiter-title">{identity.name}</h2>
            <p>{identity.title} · {identity.program}, {identity.school}</p>
          </div>
          <div className="ds-head-actions">
            {onExplore && (
              <button className="ds-ghost" onClick={onExplore}>
                <Rocket size={14} /> Explorer la station
              </button>
            )}
            <button ref={closeButton} className="ds-ghost" onClick={onClose} aria-label="Fermer">
              {onExplore ? <X size={16} /> : <ArrowLeft size={16} />}
              <span>{onExplore ? "Fermer" : "Retour"}</span>
            </button>
          </div>
        </header>
        <Actions onExit={onExit} />
        <div className="ds-body">
          <nav className="ds-nav" aria-label="Sections du CV">
            {SECTIONS.map((id) => (
              <button key={id} aria-current={section === id ? "true" : undefined} onClick={() => pick(id)}>
                {sectionLabel[id]}
              </button>
            ))}
            <button className="ds-layout" onClick={() => setLayout(layout === "complete" ? "sections" : "complete")}>
              {layout === "complete" ? "Vue par sections" : "CV complet"}
            </button>
          </nav>
          <div ref={panel} className="ds-panel" tabIndex={0}>
            {layout === "complete"
              ? SECTIONS.map((id) => (
                  <Block key={id} id={id} onSeen={onSeen}>
                    <Content id={id} />
                  </Block>
                ))
              : (
                  <Block key={section} id={section} onSeen={onSeen}>
                    <Content id={section} />
                  </Block>
                )}
          </div>
        </div>
      </div>
    </div>
  );
}
