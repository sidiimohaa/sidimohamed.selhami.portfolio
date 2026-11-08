// The racing modules of the Mos Espa grid. Each one changes the silhouette of the pod and,
// for both the visitor and rival pilots, trades a few percent of one quality against another.

export type PodModuleId = "ulzer" | "mammoth" | "pedrovia" | "quadra" | "longtail" | "manta" | "gpe";
export type PodFins = "blade" | "split" | "tail" | "boom" | "wing" | "ring";
export type PodModuleStats = { speed: number; acceleration: number; handling: number; cooling: number; armor: number };
export type PodShape = {
  // Distance of the engines from the centre line, in metres before the model's own scale.
  spread: number;
  // Engine section (radial, plus horizontal widening and vertical flattening) and length factors.
  radial: number;
  widen: number;
  flat: number;
  length: number;
  // Two engines, or the four of a Quadra-Pod, stacked in pairs.
  engines: 2 | 4;
  hullWidth: number;
  hullLength: number;
  fins: PodFins;
};
export type PodModule = { id: PodModuleId; name: string; pilot: string; lore: string; cost: number; stats: PodModuleStats; shape: PodShape };

export const neutralStats: PodModuleStats = { speed: 1, acceleration: 1, handling: 1, cooling: 1, armor: 1 };
const shape = (values: Partial<PodShape>): PodShape => ({ spread: 2.55, radial: 1, widen: 1, flat: 1, length: 1, engines: 2, hullWidth: 1, hullLength: 1, fins: "blade", ...values });

export const podModules: Record<PodModuleId, PodModule> = {
  ulzer: {
    id: "ulzer", name: "Radon-Ulzer 620C", pilot: "Anakin Skywalker",
    lore: "Deux moteurs fins et une cabine minuscule, assemblés à Mos Espa avec des pièces de récupération.",
    cost: 0, stats: neutralStats, shape: shape({}),
  },
  mammoth: {
    id: "mammoth", name: "Plug-F Mammoth", pilot: "Sebulba",
    lore: "Deux moteurs énormes à ailettes en X. Solide et rapide, mais lourd à faire tourner.",
    cost: 900, stats: { ...neutralStats, speed: 1.04, acceleration: .95, handling: .94, armor: 1.12 },
    shape: shape({ spread: 3, radial: 1.5, length: 1.12, hullWidth: 1.3, hullLength: .92, fins: "split" }),
  },
  pedrovia: {
    id: "pedrovia", name: "Ord Pedrovia", pilot: "Gasgano",
    lore: "Les moteurs les plus longs de la grille. Une vitesse de pointe redoutable qui chauffe vite.",
    cost: 800, stats: { ...neutralStats, speed: 1.05, handling: .93, cooling: .92 },
    shape: shape({ spread: 2.35, radial: .72, length: 1.6, hullWidth: .82, hullLength: 1.22, fins: "tail" }),
  },
  quadra: {
    id: "quadra", name: "Balta-Trabaat BT310", pilot: "Ben Quadinaros",
    lore: "Quatre moteurs au lieu de deux : des relances vives et un refroidissement réparti.",
    cost: 750, stats: { ...neutralStats, speed: .98, acceleration: 1.1, cooling: 1.08, armor: .95 },
    shape: shape({ spread: 2.6, radial: .6, length: .95, engines: 4, hullWidth: 1.05, hullLength: .9 }),
  },
  longtail: {
    id: "longtail", name: "IPG-X1131 LongTail", pilot: "Teemto Pagalies",
    lore: "Des queues interminables qui stabilisent le pod en virage, au prix d’une structure fragile.",
    cost: 650, stats: { ...neutralStats, speed: 1.02, handling: 1.04, armor: .92 },
    shape: shape({ spread: 2.5, radial: .85, length: 1.2, hullWidth: .9, hullLength: 1.1, fins: "boom" }),
  },
  manta: {
    id: "manta", name: "Manta RamAir Mark IV", pilot: "Aldar Beedo",
    lore: "Des moteurs plats et larges, taillés comme des ailes. Le plus vif du plateau dans les courbes.",
    cost: 850, stats: { ...neutralStats, speed: 1.01, handling: 1.07, cooling: .96, armor: .94 },
    shape: shape({ spread: 2.9, widen: 1.35, flat: .5, length: .95, hullWidth: 1.2, hullLength: .95, fins: "wing" }),
  },
  gpe: {
    id: "gpe", name: "GPE-3130", pilot: "Mawhonic",
    lore: "Court et trapu, avec de larges entrées d’air. Il relance fort et encaisse bien la chaleur.",
    cost: 600, stats: { ...neutralStats, speed: .98, acceleration: 1.06, cooling: 1.06, armor: 1.05 },
    shape: shape({ spread: 2.45, radial: 1.18, length: .72, hullWidth: 1.1, hullLength: .85, fins: "ring" }),
  },
};
export const podModuleIds = Object.keys(podModules) as PodModuleId[];

export type PodPaintId = "azure" | "dug" | "hutt" | "naboo" | "jawa" | "tusken" | "sith" | "imperial";
export const podPaints: Record<PodPaintId, { name: string; color: number; cost: number }> = {
  azure: { name: "Bleu de Mos Espa", color: 0x326bc9, cost: 0 },
  dug: { name: "Orange Dug", color: 0xf58a39, cost: 150 },
  jawa: { name: "Rouille Jawa", color: 0x8a5a33, cost: 150 },
  tusken: { name: "Bandages Tusken", color: 0xb7a283, cost: 200 },
  hutt: { name: "Or des Hutt", color: 0xd9b24a, cost: 300 },
  naboo: { name: "Chrome de Naboo", color: 0xc9ccd6, cost: 350 },
  imperial: { name: "Gris impérial", color: 0x3a3d42, cost: 300 },
  sith: { name: "Rouge Sith", color: 0xa51f24, cost: 400 },
};
export const podPaintIds = Object.keys(podPaints) as PodPaintId[];

const traitNames: [keyof PodModuleStats, string][] = [["speed", "vitesse"], ["acceleration", "accélération"], ["handling", "maniabilité"], ["cooling", "refroidissement"], ["armor", "blindage"]];
/** Each difference from the balanced module, for example "+4 % vitesse". */
export const moduleTraits = (module: PodModule) =>
  traitNames.filter(([key]) => module.stats[key] !== 1).map(([key, label]) => {
    const change = Math.round((module.stats[key] - 1) * 100);
    return `${change > 0 ? "+" : "−"}${Math.abs(change)} % ${label}`;
  });
