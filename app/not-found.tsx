import type { Metadata } from "next";
import LostSector from "../components/notFound/LostSector";

export const metadata: Metadata = {
  title: "Secteur non cartographié · ORBITAL",
  robots: { index: false },
};

// Exported as 404.html: a lost jump into an asteroid field, with the way home.
export default function NotFound() {
  return <LostSector />;
}
