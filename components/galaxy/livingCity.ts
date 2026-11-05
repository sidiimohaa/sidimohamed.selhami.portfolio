import * as THREE from "three";
import { CORUSCANT_LANDMARKS } from "../coruscantSkyline";
import { padLanes, createTraffic } from "../coruscantTaxi/taxiTraffic";
import type { Spot } from "../landingKit";
import { createCityEvents, type CityEffects } from "./cityEvents";
import { createCityHolograms } from "./cityHolograms";
import { createCityNeon, type NeonTower } from "./cityNeon";
import { identity } from "../deathStar/cvData";
import { livingOn } from "./flags";
import { livingProfile } from "./quality";
import { galaxy } from "./store";

// Everything alive around Coruscant's landing platform, assembled here so the zone itself only has
// to place it and tick it. Each system has its own switch (see flags.ts) and stands on its own.

const PLATFORM = new THREE.Vector3(-30, -1.2, 27);

export function createLivingCity({ glow, circles, towers, fogDensity }: { glow: THREE.Texture; circles: Spot[]; towers: NeonTower[]; fogDensity: number }) {
  const profile = livingProfile();
  const group = new THREE.Group();
  group.name = "living-city";
  const traffic = livingOn("cityTraffic") ? createTraffic(padLanes(), glow, 2) : null;
  if (traffic) group.add(traffic.group);
  const holograms = livingOn("cityHolograms") ? createCityHolograms(glow, profile.boards, circles) : null;
  if (holograms) group.add(holograms.group);
  // Neon on the towers in view, the great landmarks taking several signs each, masts close round the
  // platform, and two holographic globes over the void.
  const near = [
    ...towers.filter((tower) => Math.hypot(tower.x, tower.z) < 420),
    ...Array.from({ length: 5 }, () => CORUSCANT_LANDMARKS.map((mark) => ({ x: mark.x, z: mark.z, w: mark.r * 1.05, d: mark.r * 1.05, top: mark.top * 0.72, round: true }))).flat(),
  ];
  const neon = livingOn("cityNeon")
    ? createCityNeon({
        glow,
        towers: near,
        signs: profile.neon,
        tubes: profile.neon,
        fogDensity,
        faceOrigin: true,
        masts: [
          { angle: -2.25, radius: 19.5, height: 9, width: 2.3, base: 1.6, column: 0 },
          { angle: -1.0, radius: 22, height: 10, width: 2.5, base: 1.2, column: 1 },
          { angle: -0.15, radius: 19.5, height: 8, width: 2, base: 2.2, column: 3 },
          { angle: 0.8, radius: 22, height: 10, width: 2.5, base: 1.4, column: 2 },
          { angle: 1.75, radius: 20, height: 9.5, width: 2.4, base: 1.8, column: 4 },
          { angle: 3.05, radius: 22.5, height: 11, width: 2.8, base: 1.1, column: 6 },
        ],
        globes: [
          { x: 13, y: 33, z: -76, r: 8, tone: 0xff2fa8, line: `${identity.name.toUpperCase()}  ·  GALACTIC DEVELOPER DATABASE  ·  ` },
          { x: -88, y: 25, z: 22, r: 7, tone: 0x2fe9ff, line: "ACCESS GRANTED  ·  TOUCHER POUR CONSULTER  ·  " },
        ],
      })
    : null;
  if (neon) group.add(neon.group);
  if (neon && holograms?.database) holograms.database.action.objects.push(...neon.globes);
  const events = livingOn("events") ? createCityEvents({ glow, rain: profile.rain, platform: PLATFORM }) : null;
  if (events) group.add(events.group);
  const viewer = new THREE.Vector3();
  // Automatic quality steps this down on a device that keeps missing frames.
  let load = 1;
  let effects: CityEffects | null = null;
  return {
    group,
    cycle: livingOn("cityCycle"),
    database: holograms?.database ?? null,
    fogScale: () => effects?.fog ?? 1,
    setQuality: (level: number) => {
      load = level >= 2 ? 1 : level === 1 ? 0.65 : 0.35;
    },
    tick(dt: number, elapsed: number, reduced: boolean, walker: { x: number; z: number; yaw?: number }) {
      viewer.set(walker.x, 1.7, walker.z);
      effects = events ? events.tick(dt, elapsed, reduced, viewer, walker.yaw ?? 0, galaxy().activeAt("coruscant")) : null;
      if (traffic) {
        // Rush and lull: the city's own rhythm, on top of what an event asks of it.
        const rhythm = 0.82 + 0.18 * Math.sin(elapsed * 0.05);
        traffic.setDensity(profile.traffic * load * rhythm * (effects?.traffic ?? 1));
        traffic.tick(dt, reduced, { trip: null, s: 0, speed: 0, viewer });
      }
      holograms?.tick(dt, elapsed, reduced, effects?.power ?? 1, effects?.alert ?? false);
      neon?.tick(dt, reduced, effects?.power ?? 1, effects?.alert ?? false);
    },
  };
}
