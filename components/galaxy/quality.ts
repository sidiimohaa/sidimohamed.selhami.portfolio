import { getBridgeSettings, guessQuality, softwareRendering } from "../graphicsQuality";

// How much of the living city a device can carry, from the same graphics setting as the rest of
// the site. Automatic quality can still step down from here while the visitor is on the pad.

export type LivingProfile = { name: "low" | "medium" | "high" | "ultra"; traffic: number; rain: number; boards: number; neon: number };
const profiles: Record<LivingProfile["name"], LivingProfile> = {
  low: { name: "low", traffic: 0.3, rain: 500, boards: 3, neon: 60 },
  medium: { name: "medium", traffic: 0.6, rain: 1200, boards: 5, neon: 130 },
  high: { name: "high", traffic: 0.85, rain: 2000, boards: 7, neon: 220 },
  ultra: { name: "ultra", traffic: 1, rain: 2800, boards: 7, neon: 320 },
};

export function livingProfile(): LivingProfile {
  if (typeof window === "undefined" || softwareRendering()) return { ...profiles.low, traffic: 0.15, rain: 200 };
  const { quality } = getBridgeSettings();
  const chosen = quality === "auto" ? guessQuality() : quality;
  return chosen === "ultra" ? profiles.ultra : chosen === "high" ? profiles.high : chosen === "medium" ? profiles.medium : profiles.low;
}
