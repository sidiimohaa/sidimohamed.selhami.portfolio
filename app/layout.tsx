import type { Metadata } from "next";
import { Oxanium } from "next/font/google";
import "./globals.css";
import { education, identity, languages, skillTree } from "../components/deathStar/cvData";
// The instrument typeface: self-hosted at build time, so nothing is fetched from a font host.
// Not preloaded: the instruments only appear once the 3D scene is up.
const hud = Oxanium({ subsets: ["latin"], weight: ["400", "600"], variable: "--hud-font", display: "swap", preload: false });
const description =
  "Pilotez un vaisseau à travers une galaxie en 3D pour découvrir le parcours de Sidi-Mohamed Selhami, en recherche d’une alternance d’assistant marketing digital pour 2026-2027.";
const site = "https://sidimohamedselhami-portfolio.vercel.app";
// Who this site is about, for search engines: taken from the CV data, nothing added.
const person = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: identity.name,
  jobTitle: identity.title,
  description: identity.summary,
  url: site,
  mainEntityOfPage: `${site}/profil`,
  email: `mailto:${identity.email}`,
  sameAs: [identity.linkedin],
  address: { "@type": "PostalAddress", addressLocality: "Gradignan", addressCountry: "FR" },
  affiliation: { "@type": "CollegeOrUniversity", name: identity.school },
  alumniOf: [...new Set(education.filter((step) => step.status !== "En cours").map((step) => step.school))].map((name) => ({ "@type": "EducationalOrganization", name })),
  knowsLanguage: languages,
  knowsAbout: skillTree.map((category) => category.name),
  seeks: { "@type": "Demand", name: identity.search },
};
export const metadata: Metadata = {
  metadataBase: new URL(site),
  alternates: { canonical: "/" },
  title: "ORBITAL — Un portfolio à explorer",
  description,
  icons: { icon: "/icon.svg" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "ORBITAL",
    url: "/",
    title: "ORBITAL — Le portfolio 3D de Sidi-Mohamed Selhami",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "ORBITAL — Le portfolio 3D de Sidi-Mohamed Selhami",
    description,
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={hud.variable}>
      <body>
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(person).replace(/</g, "\\u003c") }} />
      </body>
    </html>
  );
}
