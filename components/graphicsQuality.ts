import { useSyncExternalStore } from "react";

// Bridge settings shared by the space scene and the interface: the graphics profile, the visitor's
// own motion and audio preferences. Saved in the browser; everything works when storage is blocked.

// "lite" is never offered in the settings: it is chosen automatically when WebGL runs without a
// graphics card, where every frame is drawn by the processor.
export type QualityId = "ultra" | "high" | "medium" | "eco" | "lite";
export type QualityChoice = QualityId | "auto";

export type QualityProfile = {
  label: string;
  // Upper bound of the device pixel ratio used by the space renderer.
  pixelRatio: number;
  // Share of the star layers drawn (1 draws every star).
  stars: number;
  // Number of dust motes drifting around the ship.
  dust: number;
  // The sun's lens flare.
  flare: boolean;
  // Resolution of each face of the baked nebula sky.
  sky: number;
  // Multisampling, decided when the renderer is created.
  antialias: boolean;
  // Minimum time between two drawn frames, in milliseconds (0 draws every frame).
  frameInterval: number;
  // Draw only when something moves (flight, a trip, input, a change of state): at rest the
  // picture stays as it is and the processor is left alone.
  onDemand: boolean;
};

export const qualityOrder: QualityId[] = ["ultra", "high", "medium", "eco"];

export const qualityProfiles: Record<QualityId, QualityProfile> = {
  // The nebula is soft enough that a 512 sky is indistinguishable from larger ones on High, and it
  // is baked faster. The flare reads the frame back for its occlusion test, so Medium goes without.
  ultra: { label: "Ultra", pixelRatio: 2.25, stars: 1, dust: 900, flare: true, sky: 768, antialias: true, frameInterval: 0, onDemand: false },
  high: { label: "Élevé", pixelRatio: 2, stars: 1, dust: 600, flare: true, sky: 512, antialias: true, frameInterval: 0, onDemand: false },
  medium: { label: "Moyen", pixelRatio: 1.5, stars: 0.7, dust: 320, flare: false, sky: 384, antialias: true, frameInterval: 0, onDemand: false },
  eco: { label: "Économie", pixelRatio: 1, stars: 0.45, dust: 0, flare: false, sky: 256, antialias: true, frameInterval: 0, onDemand: false },
  // Software rendering: fewer pixels, no multisampling, a tiny sky bake, at most about fifteen
  // frames a second, and none at all while nothing moves.
  lite: { label: "Minimal", pixelRatio: 0.75, stars: 0.3, dust: 0, flare: false, sky: 128, antialias: false, frameInterval: 66, onDemand: true },
};

export type BridgeSettings = {
  version: 1;
  quality: QualityChoice;
  // Reduces animations on top of the system preference, never below it.
  reduceMotion: boolean;
  // The ship's slow idle sway in open space.
  shipSway: boolean;
  // The astromech copilot's transmissions.
  copilot: boolean;
};

const KEY = "orbital-bridge-settings-v1";
const defaults: BridgeSettings = { version: 1, quality: "auto", reduceMotion: false, shipSway: true, copilot: true };
let settings: BridgeSettings = defaults,
  loaded = false;
const listeners = new Set<() => void>();

const choices: QualityChoice[] = ["auto", ...qualityOrder];

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Partial<BridgeSettings> | null;
    if (saved && saved.version === 1)
      settings = {
        ...defaults,
        quality: choices.includes(saved.quality as QualityChoice) ? (saved.quality as QualityChoice) : "auto",
        reduceMotion: saved.reduceMotion === true,
        shipSway: saved.shipSway !== false,
        copilot: saved.copilot !== false,
      };
  } catch {
    settings = defaults;
  }
}

export function getBridgeSettings() {
  load();
  return settings;
}

export function updateBridgeSettings(change: Partial<Omit<BridgeSettings, "version">>) {
  load();
  settings = { ...settings, ...change };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // The setting still applies for this visit.
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useBridgeSettings = () => useSyncExternalStore(subscribe, getBridgeSettings, () => defaults);

// WebGL drawn by the processor instead of a graphics card (SwiftShader, llvmpipe, Microsoft Basic
// Render): headless test browsers, some virtual desktops and machines without a usable GPU.
// ?lite forces the answer, to check the light mode on any machine.
let software: boolean | null = null;
export function softwareRendering(): boolean {
  if (software !== null) return software;
  if (typeof document === "undefined") return false;
  software = false;
  try {
    if (new URLSearchParams(window.location.search).has("lite")) return (software = true);
    const strict = document.createElement("canvas").getContext("webgl", { failIfMajorPerformanceCaveat: true });
    if (!strict) {
      // WebGL that only exists without the performance guarantee is a software implementation.
      const loose = document.createElement("canvas").getContext("webgl");
      software = !!loose;
      loose?.getExtension("WEBGL_lose_context")?.loseContext();
      return software;
    }
    const info = strict.getExtension("WEBGL_debug_renderer_info");
    const name = info ? String(strict.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
    strict.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    software = false;
  }
  return software;
}

// A first guess from the hardware, before any frame is measured: phones and small machines start
// on Medium, everything else on High. Ultra is only ever chosen by the visitor.
export function guessQuality(): QualityId {
  if (typeof window === "undefined") return "high";
  if (softwareRendering()) return "lite";
  const nav = navigator as Navigator & { deviceMemory?: number };
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  if ((nav.deviceMemory ?? 8) <= 2 || (nav.hardwareConcurrency ?? 8) <= 2) return "eco";
  if (coarse || small || (nav.deviceMemory ?? 8) <= 4 || (nav.hardwareConcurrency ?? 8) <= 4) return "medium";
  return "high";
}

// One step down the visible profiles; the software profile is already the floor.
export const lowerQuality = (quality: QualityId): QualityId =>
  qualityOrder.includes(quality) ? qualityOrder[Math.min(qualityOrder.length - 1, qualityOrder.indexOf(quality) + 1)] : quality;
