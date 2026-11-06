import type { Metadata } from "next";
import "./globals.css";
const description =
  "Pilotez un vaisseau à travers une galaxie en 3D pour découvrir le parcours de Sidi-Mohamed Selhami, en recherche d’une alternance d’assistant marketing digital pour 2026-2027.";
export const metadata: Metadata = {
  metadataBase: new URL("https://sidimohamedselhami-portfolio.vercel.app"),
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
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
