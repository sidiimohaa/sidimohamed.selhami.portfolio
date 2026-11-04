"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { pickSector, type SectorPick } from "./lostRotation";
import { LostHeader } from "./LostFrame";

// The 404 alternates between lost sectors. The browser picks one on arrival and only that scene's
// code is downloaded.
const variants = {
  asteroids: dynamic(() => import("./LostSector"), { ssr: false }),
  transmission: dynamic(() => import("./LostTransmission"), { ssr: false }),
  jawas: dynamic(() => import("./LostJawas"), { ssr: false }),
  planet: dynamic(() => import("./LostPlanet"), { ssr: false }),
};

export default function LostSectors() {
  const [pick, setPick] = useState<SectorPick | null>(null);
  useEffect(() => setPick(pickSector()), []);
  if (!pick)
    return (
      <main className="lost-sector" aria-busy="true">
        <LostHeader />
      </main>
    );
  const Variant = variants[pick.id];
  return <Variant collection={pick} />;
}
