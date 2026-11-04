// Art direction per destination: the colour grade applied after rendering and the surface detail
// added to every architectural material. One entry per place, so each world reads at a glance.

export type LookId = "hoth" | "tatooine" | "coruscant" | "endor" | "deathstar" | "taxi";

export type Grade = {
  // Lift (shadows), gamma (mid-tones) and gain (highlights), per channel, in display space.
  lift: [number, number, number];
  gamma: [number, number, number];
  gain: [number, number, number];
  // Colour pushed into the shadows and into the highlights (split toning).
  shadowTint: [number, number, number];
  highlightTint: [number, number, number];
  contrast: number;
  saturation: number;
  // Darkening of the frame's corners, 0 for none; kept very light so interfaces stay clear.
  vignette: number;
  // Bloom: only what is brighter than the threshold (display luminance) glows.
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  // Ambient occlusion radius in metres and its strength (Ultra only).
  aoRadius: number;
  aoStrength: number;
};

export type Detail = {
  // Height of the main walking level, and how far up the darkening at the foot of walls reaches.
  groundY: number;
  contactHeight: number;
  contactStrength: number;
  // Fine surface grain: noise frequency per metre and the relief it gives through the normal.
  grain: number;
  bump: number;
  // Variation of roughness and of base colour across a surface, 0 to 1.
  roughVar: number;
  albedoVar: number;
  // Dirt colour mixed into crevices, the foot of walls and vertical streaks.
  grime: [number, number, number];
  streaks: number;
  // Deposit settled on upward faces (sand, frost, leaf litter) and how much of it.
  top: [number, number, number];
  topAmount: number;
  // Panel joints drawn on large metal surfaces, with the panel size in metres.
  seams: boolean;
  panel: [number, number];
};

export type Look = { grade: Grade; detail: Detail };

const neutral: Grade = {
  lift: [0, 0, 0],
  gamma: [1, 1, 1],
  gain: [1, 1, 1],
  shadowTint: [0, 0, 0],
  highlightTint: [0, 0, 0],
  contrast: 1,
  saturation: 1,
  vignette: 0.12,
  bloomStrength: 0.25,
  bloomRadius: 0.35,
  bloomThreshold: 0.9,
  aoRadius: 0.6,
  aoStrength: 0.8,
};

export const looks: Record<LookId, Look> = {
  // Cold, clean light: blue shadows, a slightly lifted white, little saturation. The cold reads
  // in the shadows more than in the highlights.
  hoth: {
    grade: {
      ...neutral,
      lift: [-0.03, -0.018, 0.0],
      gamma: [0.96, 0.99, 1.04],
      gain: [0.98, 1.0, 1.04],
      shadowTint: [-0.016, -0.002, 0.03],
      highlightTint: [-0.006, 0.0, 0.01],
      contrast: 1.14,
      saturation: 0.9,
      bloomStrength: 0.2,
      bloomThreshold: 0.93,
      aoRadius: 0.8,
    },
    detail: {
      groundY: 0,
      contactHeight: 0.9,
      contactStrength: 0.35,
      grain: 7,
      bump: 0.012,
      roughVar: 0.35,
      albedoVar: 0.07,
      grime: [0.26, 0.29, 0.33],
      streaks: 0.25,
      top: [0.86, 0.91, 0.97],
      topAmount: 0.45,
      seams: true,
      panel: [1.6, 1.1],
    },
  },
  // Hard sun and warm bounce: amber highlights against slightly teal shadows, dense mid-tones.
  tatooine: {
    grade: {
      ...neutral,
      lift: [0.012, 0.006, 0.0],
      gamma: [1.02, 1, 0.97],
      gain: [1.04, 1.0, 0.93],
      shadowTint: [-0.008, 0.004, 0.014],
      highlightTint: [0.03, 0.012, -0.02],
      contrast: 1.09,
      saturation: 1.04,
      bloomStrength: 0.22,
      bloomThreshold: 0.92,
      aoRadius: 0.9,
    },
    detail: {
      groundY: 0,
      contactHeight: 1.1,
      contactStrength: 0.4,
      grain: 5,
      bump: 0.018,
      roughVar: 0.3,
      albedoVar: 0.11,
      grime: [0.33, 0.23, 0.15],
      streaks: 0.45,
      top: [0.78, 0.62, 0.42],
      topAmount: 0.28,
      seams: false,
      panel: [2, 1.2],
    },
  },
  // Dusk over the city-planet: violet-blue shadows, amber highlights, lights that glow.
  coruscant: {
    grade: {
      ...neutral,
      lift: [0.006, 0.006, 0.022],
      gamma: [1.01, 0.99, 1.0],
      gain: [1.04, 1.0, 0.97],
      shadowTint: [0.004, -0.002, 0.026],
      highlightTint: [0.028, 0.01, -0.016],
      contrast: 1.08,
      saturation: 1.07,
      bloomStrength: 0.42,
      bloomRadius: 0.45,
      bloomThreshold: 0.82,
      aoRadius: 0.7,
    },
    detail: {
      groundY: 0,
      contactHeight: 0.7,
      contactStrength: 0.3,
      grain: 9,
      bump: 0.008,
      roughVar: 0.4,
      albedoVar: 0.1,
      grime: [0.18, 0.17, 0.19],
      streaks: 0.35,
      top: [0.3, 0.29, 0.3],
      topAmount: 0.12,
      seams: true,
      panel: [2.4, 1.2],
    },
  },
  // Green, humid shade with warm shafts of sun: teal-green shadows, gold highlights.
  endor: {
    grade: {
      ...neutral,
      lift: [0.0, 0.01, 0.006],
      gamma: [0.99, 1.02, 0.98],
      gain: [1.03, 1.01, 0.93],
      shadowTint: [-0.012, 0.012, 0.004],
      highlightTint: [0.024, 0.014, -0.022],
      contrast: 1.06,
      saturation: 0.96,
      vignette: 0.16,
      bloomStrength: 0.26,
      bloomThreshold: 0.88,
      aoRadius: 1.1,
      aoStrength: 0.9,
    },
    detail: {
      groundY: 0,
      contactHeight: 0.9,
      contactStrength: 0.4,
      grain: 4,
      bump: 0.022,
      roughVar: 0.25,
      albedoVar: 0.2,
      grime: [0.14, 0.13, 0.08],
      streaks: 0.3,
      top: [0.2, 0.25, 0.1],
      topAmount: 0.35,
      seams: false,
      panel: [2, 1.2],
    },
  },
  // Imperial steel: cold and nearly colourless, deep blacks, the red lights left to glow.
  deathstar: {
    grade: {
      ...neutral,
      lift: [0.0, 0.004, 0.012],
      gamma: [0.99, 1.0, 1.02],
      gain: [0.99, 1.0, 1.03],
      shadowTint: [-0.006, 0.0, 0.018],
      highlightTint: [0.0, 0.004, 0.012],
      contrast: 1.1,
      saturation: 0.9,
      vignette: 0.14,
      bloomStrength: 0.34,
      bloomThreshold: 0.84,
      aoRadius: 0.7,
    },
    detail: {
      groundY: 0,
      contactHeight: 0.8,
      contactStrength: 0.4,
      grain: 10,
      bump: 0.006,
      roughVar: 0.45,
      albedoVar: 0.08,
      grime: [0.06, 0.065, 0.075],
      streaks: 0.15,
      top: [0, 0, 0],
      topAmount: 0,
      seams: true,
      panel: [1.8, 1.2],
    },
  },
  // The air taxi above Coruscant: the city's grade, with a little more glow for the traffic.
  taxi: {
    grade: {
      ...neutral,
      lift: [0.006, 0.006, 0.022],
      gamma: [1.01, 0.99, 1.0],
      gain: [1.04, 1.0, 0.97],
      shadowTint: [0.004, -0.002, 0.026],
      highlightTint: [0.028, 0.01, -0.016],
      contrast: 1.08,
      saturation: 1.07,
      bloomStrength: 0.48,
      bloomRadius: 0.5,
      bloomThreshold: 0.8,
      aoRadius: 0.7,
    },
    detail: {
      groundY: -1000,
      contactHeight: 0,
      contactStrength: 0,
      grain: 9,
      bump: 0.008,
      roughVar: 0.4,
      albedoVar: 0.1,
      grime: [0.18, 0.17, 0.19],
      streaks: 0.35,
      top: [0.3, 0.29, 0.3],
      topAmount: 0.1,
      seams: true,
      panel: [2.4, 1.2],
    },
  },
};

export const lookFor = (planet: string): LookId =>
  planet === "Hoth" ? "hoth" : planet === "Tatooine" ? "tatooine" : planet === "Endor" ? "endor" : "coruscant";

// Image-based light per world: the sky, the horizon and the ground that reflections and diffuse
// bounce pick up, with a hot spot where the sun is. Replaces a neutral studio room, so metal and
// glass reflect the world they stand in.
export type Sky = { top: number; horizon: number; ground: number; sun: number; sunDir: [number, number, number]; intensity: number };

export const skies: Record<Exclude<LookId, "taxi" | "deathstar">, Sky> = {
  hoth: { top: 0x9db3cb, horizon: 0xe4edf5, ground: 0xc4d2df, sun: 0xffffff, sunDir: [30, 70, 90], intensity: 0.5 },
  tatooine: { top: 0x6f9ccc, horizon: 0xf0c08a, ground: 0xb7834f, sun: 0xfff0d0, sunDir: [0.02, 0.139, -0.99], intensity: 0.5 },
  coruscant: { top: 0x261f4a, horizon: 0xc8743e, ground: 0x17121c, sun: 0xffb27a, sunDir: [-160, 110, 140], intensity: 0.38 },
  endor: { top: 0x9fbd96, horizon: 0x5f7044, ground: 0x2a2317, sun: 0xffe2a8, sunDir: [-34, 110, -20], intensity: 0.42 },
};
