import type { Metadata } from "next";
import Link from "next/link";
import {
  CV_PDF,
  certificationLine,
  certifications,
  education,
  experiences,
  identity,
  interests,
  languages,
  projects,
  skillTree,
  statusLabel,
} from "../../components/deathStar/cvData";
import "../profil.css";

const description = `${identity.name} — ${identity.title}. ${identity.search} Profil, compétences, projets, expériences, formation, CV et contact.`;

export const metadata: Metadata = {
  title: `${identity.name} · Profil et CV · ORBITAL`,
  description,
  alternates: { canonical: "/profil" },
  openGraph: { type: "profile", locale: "fr_FR", siteName: "ORBITAL", url: "/profil", title: `${identity.name} · ${identity.title}`, description },
};

const mail = `mailto:${identity.email}?subject=${encodeURIComponent("Votre profil – alternance marketing digital")}`;

// The whole record as one plain page: no WebGL, no script needed to read it, quick on any
// connection. It is what a recruiter in a hurry, a screen reader or a search engine gets, and
// where the 3D experience sends anyone whose browser cannot draw it. Same data as the station.
export default function Profile() {
  // The most recent first, as a recruiter reads a CV.
  const studies = [...education].reverse();
  return (
    <main className="profil">
      <div className="profil-page">
        <header className="profil-head">
          <p className="profil-brand">ORBITAL · DOSSIER DU PILOTE</p>
          <h1>{identity.name}</h1>
          <p className="profil-title">
            {identity.title} · {identity.program}, {identity.school}
          </p>
          <p className="profil-pitch">{identity.search}</p>
          <nav className="profil-actions" aria-label="Actions principales">
            <a className="profil-action is-primary" href={CV_PDF} download>
              Télécharger le CV (PDF)
            </a>
            <a className="profil-action" href={mail}>
              M’écrire
            </a>
            <a className="profil-action" href={identity.linkedin} target="_blank" rel="noopener noreferrer">
              LinkedIn
            </a>
            <Link className="profil-action is-ghost" href="/">
              Explorer la galaxie en 3D →
            </Link>
          </nav>
        </header>

        <nav className="profil-toc" aria-label="Sommaire">
          <a href="#profil">Profil</a>
          <a href="#competences">Compétences</a>
          <a href="#projets">Projets</a>
          <a href="#experiences">Expériences</a>
          <a href="#formation">Formation</a>
          <a href="#contact">Contact</a>
        </nav>

        <section id="profil" aria-labelledby="profil-titre">
          <h2 id="profil-titre">Profil</h2>
          <p className="profil-lead">{identity.summary}</p>
          <p>{identity.ambition}</p>
          <dl className="profil-facts">
            <div>
              <dt>Alternance recherchée</dt>
              <dd>{identity.title}</dd>
            </div>
            <div>
              <dt>Période</dt>
              <dd>{identity.schoolYear}</dd>
            </div>
            <div>
              <dt>Rythme</dt>
              <dd>{identity.rhythm}</dd>
            </div>
            <div>
              <dt>Lieu et mobilité</dt>
              <dd>
                {identity.location} · {identity.mobility}
              </dd>
            </div>
            <div>
              <dt>Langues</dt>
              <dd>{languages.join(" · ")}</dd>
            </div>
            <div>
              <dt>Centres d’intérêt</dt>
              <dd>{interests.join(" · ")}</dd>
            </div>
          </dl>
        </section>

        <section id="competences" aria-labelledby="competences-titre">
          <h2 id="competences-titre">Compétences</h2>
          <div className="profil-grid">
            {skillTree.map((category) => (
              <article key={category.id} className="profil-card" style={{ ["--accent" as string]: category.color }}>
                <h3>{category.name}</h3>
                <ul>
                  {category.skills.map((skill) => (
                    <li key={skill.id}>
                      <strong>{skill.name}</strong>
                      <span className="profil-status" data-status={skill.status}>
                        {statusLabel[skill.status]}
                      </span>
                      <p>{skill.description}</p>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <h3 className="profil-sub">Certifications</h3>
          <ul className="profil-list">
            {certifications.map((item) => (
              <li key={item.id}>
                {certificationLine(item)} <span>— {item.french}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="projets" aria-labelledby="projets-titre">
          <h2 id="projets-titre">Projets</h2>
          {projects.map((project) => (
            <article key={project.id} className="profil-project">
              <h3>{project.title}</h3>
              <p className="profil-kind">{project.kind}</p>
              <dl>
                <div>
                  <dt>Contexte</dt>
                  <dd>
                    {project.goal} {project.problem}
                  </dd>
                </div>
                <div>
                  <dt>Action</dt>
                  <dd>
                    {project.solution} {project.contribution}
                  </dd>
                </div>
                <div>
                  <dt>Résultat</dt>
                  <dd>{project.result}</dd>
                </div>
              </dl>
              <ul className="profil-chips" aria-label="Outils">
                {project.stack.map((tool) => (
                  <li key={tool}>{tool}</li>
                ))}
              </ul>
              {project.link && (
                <a className="profil-link" href={project.link.href} target="_blank" rel="noopener noreferrer">
                  {project.link.label} →
                </a>
              )}
            </article>
          ))}
        </section>

        <section id="experiences" aria-labelledby="experiences-titre">
          <h2 id="experiences-titre">Expériences</h2>
          {experiences.map((job) => (
            <article key={job.id} className="profil-entry">
              <h3>
                {job.role} · {job.company}
              </h3>
              <p className="profil-kind">
                {[job.contract, job.period, job.duration, job.place].filter(Boolean).join(" · ")}
              </p>
              {job.missions.length > 0 && (
                <ul>
                  {job.missions.map((mission) => (
                    <li key={mission}>{mission}</li>
                  ))}
                </ul>
              )}
              {job.credentials?.map((credential) => <p key={credential}>{credential}</p>)}
            </article>
          ))}
        </section>

        <section id="formation" aria-labelledby="formation-titre">
          <h2 id="formation-titre">Formation</h2>
          {studies.map((step) => (
            <article key={step.id} className="profil-entry">
              <h3>{step.title}</h3>
              <p className="profil-kind">
                {[step.school, step.place, step.period, step.status].filter(Boolean).join(" · ")}
              </p>
              <ul>
                {step.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section id="contact" aria-labelledby="contact-titre">
          <h2 id="contact-titre">Contact</h2>
          <p className="profil-lead">{identity.search}</p>
          <ul className="profil-contact">
            <li>
              E-mail : <a href={mail}>{identity.email}</a>
            </li>
            <li>
              LinkedIn :{" "}
              <a href={identity.linkedin} target="_blank" rel="noopener noreferrer">
                {identity.name}
              </a>
            </li>
            <li>
              CV :{" "}
              <a href={CV_PDF} download>
                télécharger le PDF
              </a>
            </li>
          </ul>
        </section>

        <footer className="profil-foot">
          <Link href="/">← Retour à ORBITAL, le portfolio en 3D</Link>
          <p>
            Projet de fan non officiel, sans lien avec Lucasfilm ou Disney. <Link href="/mentions-legales">Mentions légales</Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
