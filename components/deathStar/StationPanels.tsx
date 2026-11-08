"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Download, FileText, Mail, Map, X } from "lucide-react";
import Linkedin from "../LinkedinIcon";
import { CV_PDF, certificationLine, certifications, education, experiences, identity, interests, languages, projects, skillTree, statusLabel, type Section } from "./cvData";
import { IMPERIAL_PRESENCES } from "./imperialRoster";

// The holographic sheets the station's consoles open: one per kind of terminal. Content comes
// from cvData only; the panels are ordinary HTML, readable by keyboard and screen readers.

export type PanelId = "accueil" | "experience" | "experiences" | "formation" | "skills" | "projects" | "code" | "bonus" | "transmission" | "vader" | "droid" | "secret" | "cell" | "presence";
type Props = {
  id: PanelId;
  focus?: string;
  reduced: boolean;
  onClose: () => void;
  onSeen: (section: Section) => void;
  onRecruiter: () => void;
  onPlan: () => void;
  onCode: (code: string) => boolean;
};

function Contact() {
  return (
    <div className="ds-holo-links">
      <a href={`mailto:${identity.email}`}>
        <Mail size={13} /> {identity.email}
      </a>
      <a href={identity.linkedin} target="_blank" rel="noopener noreferrer">
        <Linkedin size={13} /> LinkedIn
      </a>
      <a href={CV_PDF} download>
        <Download size={13} /> CV (PDF)
      </a>
    </div>
  );
}

export default function StationPanel({ id, focus, reduced, onClose, onSeen, onRecruiter, onPlan, onCode }: Props) {
  const close = useRef<HTMLButtonElement>(null);
  const [pick, setPick] = useState<string | undefined>(focus);
  const [code, setCode] = useState("");
  const [reply, setReply] = useState("Saisissez le code d’accès.");
  useEffect(() => setPick(focus), [focus, id]);
  // Coming from the route's certification system: show the certifications straight away.
  useEffect(() => {
    if (id === "formation" && focus === "certs") document.getElementById("ds-certifications")?.scrollIntoView({ block: "start" });
  }, [id, focus]);
  useEffect(() => {
    close.current?.focus();
    const seen: Partial<Record<PanelId, Section[]>> = { accueil: ["profil", "contact"], experience: ["experiences"], experiences: ["experiences"], formation: ["formations"], skills: ["competences"], projects: ["projets"], secret: ["contact"] };
    seen[id]?.forEach(onSeen);
  }, [id, onSeen]);

  const titles: Record<PanelId, string> = {
    accueil: "Archives impériales · Accueil",
    experience: "Archives · Expérience professionnelle",
    experiences: "Archives · Synthèse du parcours",
    formation: "Centre de formation · Parcours académique",
    skills: "Salle des compétences",
    projects: "Poste de commandement · Projets",
    code: "Terminal restreint",
    bonus: "Archive 1138 · Accès accordé",
    transmission: "Transmission interceptée",
    vader: "Observation",
    droid: "Contact inattendu",
    secret: "Message du Haut Commandement",
    cell: "Bloc de détention AA-23",
    presence: "Présence impériale",
  };

  let body: React.ReactNode = null;
  if (id === "accueil")
    body = (
      <>
        <p className="ds-holo-kicker">Personnel File Access Granted</p>
        <h2>{identity.name}</h2>
        <p className="ds-holo-sub">{identity.title}</p>
        <p className="ds-holo-sub">{identity.program} · {identity.school} · {identity.schoolYear}</p>
        <p>{identity.summary}</p>
        <p>{identity.ambition}</p>
        <div className="ds-holo-choices">
          <button onClick={onPlan}>
            <Map size={15} /> Explorer mon dossier
          </button>
          <button onClick={onRecruiter}>
            <FileText size={15} /> Consulter rapidement mon CV
          </button>
          <a href={CV_PDF} download>
            <Download size={15} /> Télécharger mon CV
          </a>
        </div>
        <Contact />
      </>
    );
  if (id === "experience" || id === "experiences") {
    const shown = id === "experience" ? experiences.filter((item) => item.id === (pick ?? experiences[0].id)) : experiences;
    body = (
      <>
        {id === "experience" && (
          <div className="ds-holo-tabs" role="tablist">
            {experiences.map((item) => (
              <button key={item.id} role="tab" aria-selected={item.id === (pick ?? experiences[0].id)} onClick={() => setPick(item.id)}>
                {item.company}
              </button>
            ))}
          </div>
        )}
        {id === "experiences" && <p>{identity.summary}</p>}
        {shown.map((item) => (
          <article key={item.id} className="ds-holo-card">
            <p className="ds-holo-kicker">{item.contract} · {item.period}{item.duration ? ` · ${item.duration}` : ""}</p>
            <h2>{item.company}</h2>
            <p className="ds-holo-sub">{item.role} · {item.place}</p>
            {item.missions.length > 0 && (
              <>
                <h3>Missions principales</h3>
                <ul>{item.missions.map((mission) => <li key={mission}>{mission}</li>)}</ul>
              </>
            )}
            {item.credentials && (
              <>
                <h3>Habilitation</h3>
                <ul>{item.credentials.map((line) => <li key={line}>{line}</li>)}</ul>
              </>
            )}
            {item.skills.length > 0 && (
              <>
                <h3>Compétences développées</h3>
                <p className="ds-tags">{item.skills.map((skill) => <span key={skill}>{skill}</span>)}</p>
              </>
            )}
          </article>
        ))}
      </>
    );
  }
  if (id === "formation") {
    const current = education.find((item) => item.id === pick) ?? education[education.length - 1];
    body = (
      <>
        <ol className="ds-timeline">
          {education.map((item) => (
            <li key={item.id}>
              <button aria-pressed={item.id === current.id} onClick={() => setPick(item.id)}>
                <span className="mono">{item.year}</span>
                {item.title}
              </button>
            </li>
          ))}
        </ol>
        <article className="ds-holo-card ds-document" key={current.id}>
          <p className="ds-holo-kicker">{current.period}{current.status ? ` · ${current.status}` : ""}</p>
          <h2>{current.title}</h2>
          <p className="ds-holo-sub">{current.school}{current.place ? ` · ${current.place}` : ""}</p>
          <ul>{current.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
        </article>
        {certifications.length > 0 && (
          <article className="ds-holo-card ds-document" id="ds-certifications">
            <p className="ds-holo-kicker">{certifications.length} badges · Google</p>
            <h2>Certifications en intelligence artificielle</h2>
            <ul>
              {certifications.map((item) => (
                <li key={item.id}>
                  {certificationLine(item)}
                  {item.program ? ` · module de ${certifications.find((parent) => parent.id === item.program)?.name}` : ""}
                </li>
              ))}
            </ul>
          </article>
        )}
      </>
    );
  }
  if (id === "skills") {
    const all = skillTree.flatMap((category) => category.skills.map((skill) => ({ ...skill, category })));
    const current = all.find((skill) => skill.id === pick) ?? (pick ? all.find((skill) => skill.category.id === pick) : undefined);
    body = (
      <>
        <p className="ds-legend">
          {(["confirmed", "growing", "interest"] as const).map((status) => (
            <span key={status} data-status={status}>{statusLabel[status]}</span>
          ))}
        </p>
        <div className="ds-skill-grid">
          {skillTree.map((category) => (
            <section key={category.id} style={{ ["--ds-accent" as string]: category.color }}>
              <h3><span className="mono">{category.letter}</span> {category.name}</h3>
              <div>
                {category.skills.map((skill) => (
                  <button key={skill.id} data-status={skill.status} aria-pressed={current?.id === skill.id} onClick={() => setPick(skill.id)}>
                    {skill.name}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        {current && (
          <article className="ds-holo-card" style={{ ["--ds-accent" as string]: current.category.color }} key={current.id}>
            <p className="ds-holo-kicker">{current.category.letter} · {current.category.name} · {statusLabel[current.status]}</p>
            <h2>{current.name}</h2>
            <p>{current.description}</p>
            <h3>Contexte d’acquisition</h3>
            <p>{current.context}</p>
            {current.proof.length > 0 && (
              <>
                <h3>Ce qui le démontre</h3>
                <p className="ds-tags">{current.proof.map((proof) => <span key={proof}>{proof}</span>)}</p>
              </>
            )}
          </article>
        )}
        {!current && <p className="ds-holo-hint">Sélectionnez une compétence, ici ou directement sur l’arbre holographique.</p>}
      </>
    );
  }
  if (id === "projects") {
    const current = projects.find((item) => item.id === pick) ?? projects[0];
    body = (
      <>
        <div className="ds-holo-tabs" role="tablist">
          {projects.map((item) => (
            <button key={item.id} role="tab" aria-selected={item.id === current.id} onClick={() => setPick(item.id)}>
              {item.title.split(" — ")[0]}
            </button>
          ))}
        </div>
        <article className="ds-holo-card" key={current.id}>
          <p className="ds-holo-kicker">{current.kind}</p>
          <h2>{current.title}</h2>
          <dl className="ds-facts">
            <div><dt>Objectif</dt><dd>{current.goal}</dd></div>
            <div><dt>Problème traité</dt><dd>{current.problem}</dd></div>
            <div><dt>Solution conçue</dt><dd>{current.solution}</dd></div>
            <div><dt>Technologies</dt><dd>{current.stack.join(" · ")}</dd></div>
            <div><dt>Ma contribution</dt><dd>{current.contribution}</dd></div>
            <div><dt>Résultat</dt><dd>{current.result}</dd></div>
          </dl>
          {current.link && (
            <a className="ds-link" href={current.link.href} target="_blank" rel="noopener noreferrer">
              {current.link.label} ↗
            </a>
          )}
        </article>
      </>
    );
  }
  if (id === "code")
    body = (
      <form
        className="ds-code"
        onSubmit={(event) => {
          event.preventDefault();
          if (!onCode(code.trim())) setReply(`CODE ${code.trim() || "VIDE"} · ACCÈS REFUSÉ`);
          setCode("");
        }}
      >
        <p>Ce terminal protège une archive classée. Un code à quatre chiffres est requis.</p>
        <label htmlFor="ds-code" className="mono">CODE D’ACCÈS</label>
        <div>
          <input id="ds-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="off" placeholder="••••" />
          <button type="submit">VALIDER</button>
        </div>
        <p className="mono" role="status">{reply}</p>
      </form>
    );
  if (id === "bonus")
    body = (
      <>
        <p className="ds-holo-kicker">Archive 1138 · Au-delà du CV</p>
        <h2>Ce qui me fait avancer</h2>
        <p>Centres d’intérêt : {interests.join(", ")}.</p>
        <p>Langues : {languages.join(", ")}.</p>
        <p>Une présentation interactive raconte mes passions, de l’infiniment grand à l’infiniment petit : l’espace, l’horlogerie, l’art et les livres.</p>
        <a className="ds-link" href="/passions/index.html" target="_blank" rel="noopener noreferrer">Ouvrir « Mes passions » ↗</a>
        <p className="ds-holo-kicker">Ce code ouvre aussi une porte : derrière vous, le bloc de détention AA-23 vient de se déverrouiller.</p>
      </>
    );
  if (id === "transmission")
    body = (
      <>
        <p className="ds-holo-kicker">Fréquence non répertoriée · source inconnue</p>
        <h2>« Ce dossier n’attendra pas longtemps. »</h2>
        <p>Message intercepté dans le réseau de maintenance : le candidat de ce dossier cherche une alternance d’assistant marketing digital pour l’année 2026-2027. Les services de recrutement sont priés d’agir avant qu’une autre flotte ne le recrute.</p>
        <Contact />
      </>
    );
  if (id === "cell")
    body = (
      <>
        <p className="ds-holo-kicker">Cellule 2187 · princesse Leia Organa</p>
        <h2>« Aidez-moi, recruteur. Vous êtes mon seul espoir. »</h2>
        <p>{identity.search} Le dossier complet attend au hangar, et personne n’a besoin de forcer une porte pour y répondre.</p>
        <Contact />
      </>
    );
  if (id === "vader")
    body = (
      <>
        <p className="ds-holo-kicker">Poste d’observation · secteur 7</p>
        <h2>Dark Vador</h2>
        <p>Immobile devant la baie, les mains dans le dos, le Seigneur Sith contemple les étoiles et ne se retourne pas. Seule sa respiration rompt le silence de la salle. Mieux vaut retourner à la lecture du dossier.</p>
      </>
    );
  if (id === "presence") {
    const actor = IMPERIAL_PRESENCES.find((entry) => entry.id === focus);
    if (actor) body = <><p className="ds-holo-kicker">{actor.location}</p><h2>{actor.name}</h2><p>{actor.description}</p><p className="ds-holo-sub">« {actor.transmission} »</p><div className="ds-holo-choices"><button onClick={onClose}>Reprendre l’exploration</button><button onClick={onPlan}><Map size={15} /> Voir les autres présences</button></div></>;
  }
  if (id === "droid")
    body = (
      <>
        <p className="ds-holo-kicker">Unité MSE-6 · niveau de priorité : faible</p>
        <h2>Bip ! Bip-bip !</h2>
        <p>Le petit droïde sursaute, fait demi-tour et repart à toute vitesse. Avant de filer, il a projeté un plan de la station : les archives sont à l’ouest du carrefour, la formation à l’est, les compétences au nord.</p>
      </>
    );
  if (id === "secret")
    body = (
      <>
        <p className="ds-holo-kicker">Dossier intégralement consulté</p>
        <h2>Vous avez tout lu.</h2>
        <p>Profil, expériences, formations, compétences, projets et contact : le Haut Commandement n’a plus qu’une recommandation. Il est temps d’entrer en contact.</p>
        <Contact />
      </>
    );

  return (
    <motion.section
      className={`ds-holo ds-holo-${id}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ds-holo-title"
      initial={reduced ? { opacity: 0 } : { opacity: 0, scaleY: 0.04, filter: "brightness(2.4)" }}
      animate={{ opacity: 1, scaleY: 1, filter: "brightness(1)" }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.15 : 0.42, ease: [0.2, 0.8, 0.2, 1] }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <header>
        <span id="ds-holo-title" className="mono">{titles[id].toUpperCase()}</span>
        <button ref={close} onClick={onClose} aria-label="Fermer l’hologramme">
          <X size={16} />
        </button>
      </header>
      <div className="ds-holo-body">{body}</div>
    </motion.section>
  );
}
