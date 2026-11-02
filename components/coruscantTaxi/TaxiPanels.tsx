"use client";
import { forwardRef } from "react";
import { Download, ExternalLink, Linkedin, Mail, X } from "lucide-react";
import { CV_PDF, education, experiences, identity, projects, skillTree, statusLabel } from "../deathStar/cvData";
import type { CouncilTopic } from "./councilChamber";

// What the Council and the Senate show. Everything comes from the CV data used by the Death
// Star dossier; the Council speaks of direction (vision, the search, the path, the major
// projects), the Senate of substance (experience, skills, structured projects) and its vote.

export type SenateTopic = "experiences" | "competences" | "dossiers" | "motion";
export type TaxiTopic = CouncilTopic | SenateTopic;

export const topicLabel: Record<TaxiTopic, string> = {
  vision: "Vision",
  quete: "La quête",
  orientation: "Orientation",
  projets: "Projets majeurs",
  experiences: "Expériences",
  competences: "Compétences",
  dossiers: "Projets structurés",
  motion: "Soumettre la motion",
};
export const SENATE_TOPICS: SenateTopic[] = ["experiences", "competences", "dossiers", "motion"];

const mail = `mailto:${identity.email}?subject=${encodeURIComponent("Alternance 2026-2027 — depuis ORBITAL")}`;
function Contact() {
  return (
    <div className="taxi-panel-actions">
      <a className="is-primary" href={CV_PDF} download>
        <Download size={15} /> Télécharger le CV
      </a>
      <a href={identity.linkedin} target="_blank" rel="noreferrer">
        <Linkedin size={15} /> LinkedIn
      </a>
      <a href={mail}>
        <Mail size={15} /> {identity.email}
      </a>
    </div>
  );
}

function Body({ topic }: { topic: TaxiTopic }) {
  switch (topic) {
    case "vision":
      return (
        <>
          <p className="taxi-panel-lead">{identity.ambition}</p>
          <p>{identity.summary}</p>
          <ul className="taxi-chips">
            <li>{identity.title}</li>
            <li>{identity.program}</li>
            <li>{identity.school}</li>
          </ul>
        </>
      );
    case "quete":
      return (
        <>
          <p className="taxi-panel-lead">{identity.search}</p>
          <dl className="taxi-facts">
            <div>
              <dt>Poste visé</dt>
              <dd>{identity.title}</dd>
            </div>
            <div>
              <dt>Formation</dt>
              <dd>
                {identity.program}, {identity.school}
              </dd>
            </div>
            <div>
              <dt>Année</dt>
              <dd>{identity.schoolYear}</dd>
            </div>
            <div>
              <dt>Rythme</dt>
              <dd>{identity.rhythm}</dd>
            </div>
            <div>
              <dt>Lieu</dt>
              <dd>{identity.location}</dd>
            </div>
            <div>
              <dt>Mobilité</dt>
              <dd>{identity.mobility}</dd>
            </div>
          </dl>
          <Contact />
        </>
      );
    case "orientation":
      return (
        <>
          <p className="taxi-panel-lead">Du commerce et du terrain vers le marketing digital, l’IA et la data : le chemin, étape par étape.</p>
          <ol className="taxi-path">
            {education.map((item) => (
              <li key={item.id} data-current={item.status === "En cours" || undefined}>
                <span className="mono">{item.period}</span>
                <strong>{item.title}</strong>
                <small>
                  {item.school}
                  {item.place ? ` · ${item.place}` : ""}
                  {item.status ? ` · ${item.status}` : ""}
                </small>
              </li>
            ))}
            <li data-next>
              <span className="mono">2026-2027</span>
              <strong>Prochaine étape : l’alternance</strong>
              <small>{identity.search}</small>
            </li>
          </ol>
        </>
      );
    case "projets":
      return (
        <>
          {projects.map((project) => (
            <article key={project.id} className="taxi-card">
              <span className="mono">{project.kind}</span>
              <h4>{project.title}</h4>
              <p>{project.goal}</p>
              <p className="taxi-muted">{project.result}</p>
              {project.link && (
                <a className="taxi-link" href={project.link.href} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} /> {project.link.label}
                </a>
              )}
            </article>
          ))}
        </>
      );
    case "experiences":
      return (
        <>
          {experiences.map((item) => (
            <article key={item.id} className="taxi-card" data-highlight={item.highlight || undefined}>
              <span className="mono">
                {item.period}
                {item.duration ? ` · ${item.duration}` : ""}
              </span>
              <h4>
                {item.role} — {item.company}
              </h4>
              <small className="taxi-muted">
                {item.contract} · {item.place}
              </small>
              <ul>
                {item.missions.map((mission) => (
                  <li key={mission}>{mission}</li>
                ))}
              </ul>
            </article>
          ))}
        </>
      );
    case "competences":
      return (
        <>
          <p className="taxi-legend">
            <i data-status="confirmed" /> {statusLabel.confirmed} <i data-status="growing" /> {statusLabel.growing} <i data-status="interest" /> {statusLabel.interest}
          </p>
          {skillTree.map((category) => (
            <section key={category.id} className="taxi-skills" style={{ "--accent": category.color } as React.CSSProperties}>
              <h4>
                <b>{category.letter}</b> {category.name}
              </h4>
              <ul>
                {category.skills.map((skill) => (
                  <li key={skill.id} data-status={skill.status} title={statusLabel[skill.status]}>
                    {skill.name}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      );
    case "dossiers":
      return (
        <>
          {projects.map((project) => (
            <article key={project.id} className="taxi-card">
              <h4>{project.title}</h4>
              <dl className="taxi-facts">
                <div>
                  <dt>Objectif</dt>
                  <dd>{project.goal}</dd>
                </div>
                <div>
                  <dt>Problème</dt>
                  <dd>{project.problem}</dd>
                </div>
                <div>
                  <dt>Solution</dt>
                  <dd>{project.solution}</dd>
                </div>
                <div>
                  <dt>Ma contribution</dt>
                  <dd>{project.contribution}</dd>
                </div>
                <div>
                  <dt>Résultat</dt>
                  <dd>{project.result}</dd>
                </div>
                <div>
                  <dt>Outils</dt>
                  <dd>{project.stack.join(" · ")}</dd>
                </div>
              </dl>
            </article>
          ))}
        </>
      );
    case "motion":
      return (
        <>
          <p className="taxi-panel-lead">
            Motion soumise au vote : accueillir {identity.name} en alternance ({identity.schoolYear.toLowerCase()}).
          </p>
          <p>
            {identity.search} {identity.program}, {identity.school} ; rythme : {identity.rhythm.toLowerCase()}.
          </p>
          <p className="taxi-muted">L’hémicycle s’est prononcé. La suite se décide en dehors de cette salle.</p>
          <Contact />
        </>
      );
  }
}

const kicker: Record<TaxiTopic, string> = {
  vision: "CONSEIL JEDI · CE QUI ME GUIDE",
  quete: "CONSEIL JEDI · LA RECHERCHE EN COURS",
  orientation: "CONSEIL JEDI · LE CHEMIN PARCOURU",
  projets: "CONSEIL JEDI · CE QUE J’AI CONSTRUIT",
  experiences: "SÉNAT GALACTIQUE · SÉANCE DES EXPÉRIENCES",
  competences: "SÉNAT GALACTIQUE · SÉANCE DES COMPÉTENCES",
  dossiers: "SÉNAT GALACTIQUE · DOSSIERS EN COMMISSION",
  motion: "SÉNAT GALACTIQUE · MOTION ADOPTÉE",
};

export const TaxiPanel = forwardRef<HTMLElement, { topic: TaxiTopic; onClose: () => void }>(function TaxiPanel({ topic, onClose }, ref) {
  const senate = !["vision", "quete", "orientation", "projets"].includes(topic);
  return (
    <section ref={ref} className={`taxi-panel ${senate ? "is-senate" : "is-council"}`} role="dialog" aria-modal="false" aria-labelledby="taxi-panel-title">
      <header>
        <span className="mono">{kicker[topic]}</span>
        <h3 id="taxi-panel-title">{topic === "motion" ? "Motion adoptée" : topicLabel[topic]}</h3>
        <button className="taxi-panel-close" onClick={onClose} aria-label="Fermer le panneau">
          <X size={16} />
        </button>
      </header>
      <div className="taxi-panel-body">
        <Body topic={topic} />
      </div>
    </section>
  );
});
