import type { Metadata } from "next";
import LostSectors from "../components/notFound/LostSectors";

export const metadata: Metadata = {
  title: "Secteur non cartographié · ORBITAL",
  robots: { index: false },
};

// Exported as 404.html: one of several lost sectors, in rotation, always with the way home.
export default function NotFound() {
  return <LostSectors />;
}
