import type { Metadata } from "next";
import Link from "next/link";
import { identity } from "../../components/deathStar/cvData";
import "../legal.css";

export const metadata: Metadata = {
  title: "Mentions légales · ORBITAL",
  description: "Projet de fan non officiel, éditeur, hébergeur et données personnelles du portfolio ORBITAL.",
};

// Plain HTML on purpose: readable without WebGL, by a person or a search engine, on any device.
export default function LegalNotice() {
  return (
    <main className="legal">
      <div className="legal-page">
        <Link className="legal-back" href="/">
          ← Retour à ORBITAL
        </Link>
        <h1>Mentions légales</h1>

        <section>
          <h2>Projet de fan non officiel</h2>
          <p>
            ORBITAL est le portfolio personnel de {identity.name}, conçu comme un hommage à l’univers Star Wars. C’est un <strong>projet de fan non officiel</strong> : il n’est ni affilié à Lucasfilm Ltd. LLC ou à The Walt Disney Company, ni approuvé, parrainé ou soutenu par elles.
          </p>
          <p>
            Star Wars, ses personnages, vaisseaux, lieux et noms sont des marques et des œuvres protégées appartenant à leurs titulaires respectifs, qui en conservent tous les droits. Ce site ne vend rien et ne contient aucune publicité.
          </p>
          <p>
            Tout titulaire de droits qui souhaite le retrait d’un contenu peut écrire à <a href={`mailto:${identity.email}`}>{identity.email}</a> : la demande sera traitée dans les meilleurs délais.
          </p>
        </section>

        <section>
          <h2>Éditeur du site</h2>
          <p>
            {identity.name}, particulier, {identity.location}.
            <br />
            Responsable de la publication : {identity.name}.
            <br />
            Contact : <a href={`mailto:${identity.email}`}>{identity.email}</a>
          </p>
        </section>

        <section>
          <h2>Hébergeur</h2>
          <p>
            Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis.
            <br />
            Contact : <a href="https://vercel.com/contact" rel="noopener noreferrer">vercel.com/contact</a>
          </p>
        </section>

        <section>
          <h2>Données personnelles</h2>
          <p>Ce site ne demande aucun compte. Il ne dépose aucun cookie, ne contient aucune publicité et n’utilise aucun outil de mesure d’audience.</p>
          <p>
            <strong>Votre progression</strong> (missions, réglages, scores, sections consultées) reste dans le stockage local de votre navigateur. Elle n’est pas envoyée à l’éditeur, et vous pouvez l’effacer à tout moment en supprimant les données de ce site dans votre navigateur.
          </p>
          <p>
            <strong>La conversation avec R-X7.</strong> Lorsque le service d’intelligence artificielle est actif, vos messages passent par le serveur du site puis sont transmis à OpenAI pour obtenir une réponse, avec demande de ne pas les conserver pour cet usage. Le site ne les enregistre pas. Lorsque le service n’est pas actif, R-X7 répond depuis ses archives locales, sans rien transmettre. N’écrivez pas de données personnelles dans cette conversation.
          </p>
          <p>
            <strong>Sécurité.</strong> L’adresse IP sert temporairement, en mémoire, à limiter les abus de cette conversation. L’hébergeur peut aussi traiter des données techniques de connexion, selon <a href="https://vercel.com/legal/privacy-policy" rel="noopener noreferrer">sa propre politique de confidentialité</a>.
          </p>
          <p>
            Conformément au RGPD, vous pouvez exercer vos droits d’accès, de rectification et d’effacement en écrivant à <a href={`mailto:${identity.email}`}>{identity.email}</a>, et saisir la <a href="https://www.cnil.fr" rel="noopener noreferrer">CNIL</a> en cas de difficulté.
          </p>
        </section>

        <section>
          <h2>Contenus personnels</h2>
          <p>Les textes de présentation et le CV de {identity.name} ne peuvent pas être réutilisés sans son accord.</p>
        </section>
      </div>
    </main>
  );
}
