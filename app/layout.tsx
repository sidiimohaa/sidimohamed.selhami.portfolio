import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ORBITAL — Un portfolio à explorer",
  description:
    "Les idées n’ont pas de frontières. Prenez les commandes et explorez un univers de projets, de passions et de nouvelles connexions.",
  icons: { icon: "/icon.svg" },
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
