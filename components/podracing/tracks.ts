import type { PodBranch, PodHazard, PodRaider, PodTrack, PodTrackFrame, PodTrackId } from "./types";

type Knot = readonly [x: number, y: number, z: number];
type Sector = readonly [start: number, kind: PodTrackFrame["sector"], halfWidth: number];
type Layout = {
  name: string;
  description: string;
  light: PodTrack["light"];
  knots: readonly Knot[];
  sectors: readonly Sector[];
  branches: readonly (readonly [start: number, end: number, offset: number, width: number, gain: number])[];
  hazards: readonly (readonly [fraction: number, side: number, kind: PodHazard["kind"]])[];
  pads: readonly (readonly [fraction: number, side: number])[];
  raiders: readonly (readonly [fraction: number, side: -1 | 1])[];
};

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const mix = (from: number, to: number, fraction: number) => from + (to - from) * fraction;
const smooth = (value: number) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};
const angle = (value: number) => Math.atan2(Math.sin(value), Math.cos(value));
const wrap = (value: number, length: number) => ((value % length) + length) % length;

export function branchOffset(branch: PodBranch, distance: number) {
  if (distance <= branch.start || distance >= branch.end) return 0;
  const position = (distance - branch.start) / (branch.end - branch.start);
  return branch.offset * smooth(Math.min(position, 1 - position) / 0.4);
}

export function hazardLane(hazard: PodHazard, time: number) {
  return hazard.lane + hazard.swing * Math.sin(time * hazard.rate + hazard.phase);
}

// Cubic interpolation through the survey points. The arc-length table below means the
// simulator moves in metres instead of slowing down between widely spaced control points.
function coordinate(a: number, b: number, c: number, d: number, t: number) {
  return b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
}
function pointAt(knots: readonly Knot[], segment: number, t: number): Knot {
  const n = knots.length;
  const a = knots[(segment + n - 1) % n];
  const b = knots[segment % n];
  const c = knots[(segment + 1) % n];
  const d = knots[(segment + 2) % n];
  return [
    coordinate(a[0], b[0], c[0], d[0], t),
    Math.max(0, coordinate(a[1], b[1], c[1], d[1], t)),
    coordinate(a[2], b[2], c[2], d[2], t),
  ];
}

function createTrack(id: PodTrackId, layout: Layout): PodTrack {
  const points: { at: Knot; distance: number }[] = [{ at: layout.knots[0], distance: 0 }];
  let length = 0;
  for (let segment = 0; segment < layout.knots.length; segment++) {
    for (let i = 1; i <= 64; i++) {
      const previous = points[points.length - 1].at;
      const at = pointAt(layout.knots, segment, i / 64);
      length += Math.hypot(at[0] - previous[0], at[1] - previous[1], at[2] - previous[2]);
      points.push({ at, distance: length });
    }
  }
  const count = Math.ceil(length / 3);
  const spacing = length / count;
  let index = 1;
  const centre = Array.from({ length: count }, (_, i): Knot => {
    const distance = i * spacing;
    while (points[index].distance < distance) index++;
    const a = points[index - 1];
    const b = points[index];
    const t = (distance - a.distance) / (b.distance - a.distance);
    return [mix(a.at[0], b.at[0], t), mix(a.at[1], b.at[1], t), mix(a.at[2], b.at[2], t)];
  });
  const headings = centre.map((_, i) => {
    const previous = centre[(i + count - 2) % count];
    const next = centre[(i + 2) % count];
    return Math.atan2(next[0] - previous[0], next[2] - previous[2]);
  });
  const curves = headings.map((_, i) => {
    const previous = headings[(i + count - 3) % count];
    const next = headings[(i + 3) % count];
    return clamp(angle(next - previous) / (6 * spacing), -0.032, 0.032);
  });
  const sample = (distance: number): PodTrackFrame => {
    const at = wrap(distance, length);
    const row = at / spacing;
    const i = Math.floor(row) % count;
    const j = (i + 1) % count;
    const t = row - Math.floor(row);
    const a = centre[i];
    const b = centre[j];
    const fraction = at / length;
    let s = layout.sectors.length - 1;
    while (fraction < layout.sectors[s][0]) s--;
    const [start, sector, width] = layout.sectors[s];
    const previousWidth = layout.sectors[(s + layout.sectors.length - 1) % layout.sectors.length][2];
    return {
      x: mix(a[0], b[0], t),
      y: mix(a[1], b[1], t),
      z: mix(a[2], b[2], t),
      heading: headings[i] + angle(headings[j] - headings[i]) * t,
      width: mix(previousWidth, width, smooth((at - start * length) / 42)),
      curve: mix(curves[i], curves[j], t),
      sector,
    };
  };
  const branches = layout.branches.map(([start, end, offset, width, gain]) => ({
    start: start * length, end: end * length, offset, width, gain,
  }));
  const hazards: PodHazard[] = layout.hazards.map(([fraction, side, kind], i) => {
    const distance = fraction * length;
    const width = sample(distance).width;
    return {
      id: `${id}-${kind}-${i}`,
      distance,
      lane: side * width * (kind === "sweeper" ? 0.58 : 0.52),
      radius: kind === "rock" ? 1.65 : kind === "scrap" ? 1.9 : 1.55,
      swing: kind === "sweeper" ? width * 0.39 : 0,
      rate: 0.53 + i * 0.033,
      phase: 0.71 + i * 1.13,
      kind,
    };
  });
  const pads = layout.pads.map(([fraction, side]) => {
    const start = fraction * length;
    return { start, end: start + 38, lane: sample(start).width * side * 0.52, width: 2.3 };
  });
  const raiders: PodRaider[] = layout.raiders.map(([fraction, side]) => ({ distance: fraction * length, side }));
  return { id, name: layout.name, description: layout.description, light: layout.light, length, sample, branches, hazards, pads, raiders };
}

export const tracks: Record<PodTrackId, PodTrack> = {
  boonta: createTrack("boonta", {
    name: "Boonta Eve Classic",
    description: "Les tribunes de Mos Espa, les mesas de la vallée et les arches étroites du canyon.",
    light: "day",
    raiders: [[.25, -1], [.43, 1], [.52, -1], [.8, 1]],
    knots: [[0, 0, 0], [0, 0, 172], [3, 2, 336], [93, 11, 434], [263, 27, 441], [412, 34, 339], [446, 23, 184], [378, 14, 56], [411, 7, -87], [320, 2, -224], [161, 0, -322], [-21, 4, -331], [-120, 7, -229], [-63, 3, -123], [0, 0, -78]],
    sectors: [[0, "stadium", 21], [.14, "mesas", 16], [.35, "canyon", 9.6], [.57, "tunnel", 10.5], [.67, "dunes", 17], [.91, "stadium", 21]],
    branches: [[.354, .518, 14.6, 4.4, .13], [.691, .867, -19, 4.8, .15]],
    hazards: [[.205, 1, "rock"], [.293, -1, "scrap"], [.405, -1, "rock"], [.521, 1, "sweeper"], [.609, -1, "scrap"], [.765, 1, "rock"], [.856, -1, "sweeper"]],
    pads: [[.085, 0], [.325, -1], [.681, 1], [.895, 0]],
  }),
  jawa: createTrack("jawa", {
    name: "La Faille des Jawas",
    description: "Un tracé au couchant entre épaves, galeries creusées et raccourcis sous les arches.",
    light: "sunset",
    raiders: [[.2, 1], [.47, -1], [.6, 1], [.8, -1]],
    knots: [[0, 0, 0], [0, 3, 144], [-72, 9, 273], [-221, 24, 330], [-375, 31, 248], [-413, 21, 102], [-326, 7, -13], [-271, 2, -133], [-350, 17, -271], [-237, 22, -402], [-69, 13, -435], [84, 9, -352], [140, 16, -216], [63, 7, -111], [0, 0, -76]],
    sectors: [[0, "stadium", 19], [.11, "mesas", 15], [.28, "tunnel", 9.6], [.4, "canyon", 10], [.67, "dunes", 16], [.92, "stadium", 19]],
    branches: [[.283, .447, -13.5, 4.35, .14], [.52, .674, 15.2, 4.6, .14]],
    hazards: [[.169, -1, "scrap"], [.251, 1, "scrap"], [.34, 1, "sweeper"], [.463, -1, "rock"], [.572, -1, "scrap"], [.675, 1, "sweeper"], [.784, -1, "rock"], [.885, 1, "scrap"]],
    pads: [[.105, 1], [.436, 0], [.73, -1], [.905, 0]],
  }),
  dune: createTrack("dune", {
    name: "Les Dunes de Minuit",
    description: "Des crêtes éclairées par les balises, une descente dans le canyon et un long sprint nocturne.",
    light: "night",
    raiders: [[.26, 1], [.41, -1], [.55, 1], [.84, -1]],
    knots: [[0, 2, 0], [0, 8, 165], [73, 23, 322], [242, 39, 419], [407, 49, 331], [476, 39, 173], [387, 21, 43], [323, 7, -94], [428, 14, -237], [340, 32, -395], [150, 38, -468], [-53, 24, -405], [-152, 11, -245], [-62, 5, -119], [0, 2, -72]],
    sectors: [[0, "stadium", 20], [.12, "dunes", 19], [.34, "mesas", 14], [.47, "canyon", 9.7], [.63, "tunnel", 10.8], [.72, "dunes", 19], [.91, "stadium", 20]],
    branches: [[.226, .393, 18.8, 4.9, .15], [.473, .632, -14.8, 4.4, .13]],
    hazards: [[.194, 1, "sweeper"], [.278, -1, "rock"], [.385, 1, "scrap"], [.539, 1, "sweeper"], [.586, -1, "rock"], [.682, 1, "scrap"], [.782, -1, "sweeper"], [.872, 1, "rock"]],
    pads: [[.078, -1], [.222, 0], [.455, 1], [.749, 0]],
  }),
};
