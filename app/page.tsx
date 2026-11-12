import Experience from "@/components/Experience";
import { CV_PDF, identity } from "@/components/deathStar/cvData";
export default function Page() {
  return (
    <>
      {/* Without scripts there is no galaxy to fly: the essentials and the way to the text version. */}
      <noscript>
        <div className="noscript-card">
          <h1>{identity.name}</h1>
          <p>
            {identity.title} · {identity.program}, {identity.school}
          </p>
          <p>{identity.search}</p>
          <p>
            <a href="/profil">Lire le profil complet</a> · <a href={CV_PDF}>Télécharger le CV (PDF)</a> ·{" "}
            <a href={`mailto:${identity.email}`}>{identity.email}</a>
          </p>
          <p>ORBITAL est un portfolio en 3D : activez JavaScript pour l’explorer.</p>
        </div>
      </noscript>
      <Experience />
    </>
  );
}
