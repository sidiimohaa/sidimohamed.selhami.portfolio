import * as THREE from "three";
import { certifications, education, experiences, identity } from "./cvData";

// The hyperspace route: a star chart nine metres wide floating above a projector table in the middle of
// the archives. Every stage of the pilot's path is a star system, from the first internship in 2017
// to the Bachelor under way, in the order they happened and climbing from left to right, from the
// shop floor to digital work. A small ship flies the route, lighting each system as it passes; at the
// end, the route goes on in dashes to one last system still unnamed: the company of the alternance.
// Everything shown is read from cvData.

export type RouteKind = "stage" | "job" | "major" | "edu" | "cert" | "current" | "next";
export type RouteStop = { id: string; kind: RouteKind; years: string; title: string; sub: string; label: string };

const COLORS: Record<RouteKind, string> = {
  stage: "#ffc56b",
  job: "#ffc56b",
  major: "#ffd890",
  edu: "#7fd4ff",
  cert: "#b99bff",
  current: "#e8fbff",
  next: "#9ff0c4",
};
const SIZES: Record<RouteKind, number> = { stage: 0.07, job: 0.085, major: 0.13, edu: 0.095, cert: 0.1, current: 0.13, next: 0.1 };
const SHORT_TITLES: Record<string, string> = {
  brevet: "Brevet des collèges",
  bac: "Bac STMG mercatique",
  bts: "BTS MCO",
  prisma: "Formation aéroportuaire",
  bachelor: "Bachelor 3 IA & Data",
};

// The years of a period: "2021–25" for a span, "2019" for a single year.
const yearsOf = (period: string) => {
  const found = period.match(/\d{4}/g) ?? [];
  const first = found[0] ?? "",
    last = found[found.length - 1] ?? first;
  return first === last ? first : `${first}–${last.slice(2)}`;
};

// The stops, in the order they happened (a job by its start, a diploma by the year it was obtained).
const ORDER = ["exp:bobigny", "edu:brevet", "exp:easychauffage", "exp:narguilhouse", "edu:bac", "exp:leaderprice", "exp:aldi", "exp:bricoman", "edu:bts", "edu:prisma", "certs", "edu:bachelor", "next"];

export function routeStops(): RouteStop[] {
  const stops: RouteStop[] = [];
  for (const key of ORDER) {
    const [type, id] = key.split(":");
    if (type === "exp") {
      const item = experiences.find((entry) => entry.id === id);
      if (!item) continue;
      const kind: RouteKind = item.highlight ? "major" : item.contract === "Stage" ? "stage" : "job";
      stops.push({ id: `route:exp:${id}`, kind, years: yearsOf(item.period), title: item.company, sub: `${item.contract} · ${item.role}`, label: `${item.company} · ${item.role}` });
    } else if (type === "edu") {
      const item = education.find((entry) => entry.id === id);
      if (!item) continue;
      const current = item.status === "En cours";
      stops.push({ id: `route:edu:${id}`, kind: current ? "current" : "edu", years: current ? yearsOf(item.period) : item.year, title: SHORT_TITLES[id] ?? item.title, sub: current ? `${item.school} · en cours` : item.school, label: item.title });
    } else if (key === "certs" && certifications.length) {
      const dates = certifications.map((item) => item.date?.match(/\d{4}/)?.[0]).filter(Boolean);
      stops.push({ id: "route:certs", kind: "cert", years: dates[0] ?? "", title: "Certifications IA", sub: `${certifications.length} badges Google`, label: `Certifications Google sur l’IA (${certifications.length})` });
    } else if (key === "next") {
      const year = identity.schoolYear.match(/\d{4}/g) ?? [];
      stops.push({ id: "route:next", kind: "next", years: year.length > 1 ? `${year[0]}–${year[1].slice(2)}` : "", title: "Votre entreprise ?", sub: "Alternance recherchée", label: "Prochaine étape : l’alternance" });
    }
  }
  return stops;
}

function glowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const c = canvas.getContext("2d")!;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function label(stop: RouteStop) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 168;
  const c = canvas.getContext("2d")!;
  const color = COLORS[stop.kind];
  c.fillStyle = "rgba(4,18,34,.55)";
  c.fillRect(0, 0, 640, 168);
  c.fillStyle = color;
  c.fillRect(0, 0, 6, 168);
  c.textBaseline = "middle";
  c.font = "600 30px SFMono-Regular, Menlo, Consolas, monospace";
  c.fillText(stop.years, 24, 34);
  c.fillStyle = "#f2fbff";
  let size = 46;
  c.font = `700 ${size}px Arial, Helvetica, sans-serif`;
  while (c.measureText(stop.title).width > 596 && size > 22) c.font = `700 ${--size}px Arial, Helvetica, sans-serif`;
  c.fillText(stop.title, 24, 86);
  c.fillStyle = color;
  size = 28;
  c.font = `${size}px Arial, Helvetica, sans-serif`;
  while (c.measureText(stop.sub).width > 596 && size > 16) c.font = `${--size}px Arial, Helvetica, sans-serif`;
  c.fillText(stop.sub, 24, 136);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }));
  sprite.scale.set(1.25, 0.33, 1);
  return sprite;
}

function header(text: string, sub: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 150;
  const c = canvas.getContext("2d")!;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.shadowColor = "#4fb4ff";
  c.shadowBlur = 18;
  c.fillStyle = "#dff4ff";
  c.font = "700 64px Arial, Helvetica, sans-serif";
  c.fillText(text, 800, 54);
  c.shadowBlur = 0;
  c.fillStyle = "#7fc8ff";
  c.font = "30px SFMono-Regular, Menlo, Consolas, monospace";
  c.fillText(sub, 800, 118);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(6.4, 0.6), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
}

const additive = (color: number | string, opacity: number) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });

// The chart's frame: local +x runs along the route (left to right as seen from the door), +y up,
// +z towards the viewer. `at` is the table's centre on the floor, `facing` the chart's yaw.
export function createHyperspaceRoute(at: THREE.Vector3, facing: number) {
  const WIDTH = 8.6,
    BOTTOM = 2.95,
    HEIGHT = 3.5;
  const group = new THREE.Group();
  group.name = "hyperspace-route";
  group.position.copy(at);
  group.rotation.y = facing;
  const glow = glowTexture();
  glow.colorSpace = THREE.SRGBColorSpace;

  // The projector table: a bronze-dark drum, an emitter ring and a soft fan of light up to the chart.
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.45, metalness: 0.7 });
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.3, 0.95, 40), metal);
  drum.position.y = 0.475;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.035, 8, 64).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4fb4ff, toneMapped: false }));
  rim.position.y = 0.96;
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.95, 48).rotateX(-Math.PI / 2), additive(0x2f7fd0, 0.45));
  lens.position.y = 0.965;
  group.add(drum, rim, lens);
  const fanGeometry = new THREE.BufferGeometry();
  // Four triangles from the lens to the chart's lower edge and its corners: a pyramid of light.
  const bottomL = [-WIDTH / 2, BOTTOM, 0],
    bottomR = [WIDTH / 2, BOTTOM, 0];
  fanGeometry.setAttribute("position", new THREE.Float32BufferAttribute([-0.6, 0.97, 0.3, ...bottomL, ...bottomR, 0.6, 0.97, -0.3, ...bottomR, ...bottomL, -0.6, 0.97, 0.3, 0.6, 0.97, -0.3, ...bottomR], 3));
  const fanMaterial = new THREE.MeshBasicMaterial({ color: 0x5fbcff, transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
  const fan = new THREE.Mesh(fanGeometry, fanMaterial);
  group.add(fan);

  // The chart itself.
  const chart = new THREE.Group();
  chart.position.y = BOTTOM;
  group.add(chart);
  // A field of faint stars behind the route, and a thin frame with corner brackets.
  const starCount = 520,
    stars = new Float32Array(starCount * 3),
    seed = { v: 7 };
  const rand = () => ((seed.v = (seed.v * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < starCount; i++) stars.set([(rand() - 0.5) * WIDTH, rand() * HEIGHT, -0.15 - rand() * 0.5], i * 3);
  const starField = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(stars, 3)), new THREE.PointsMaterial({ color: 0x9fd8ff, size: 0.03, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  chart.add(starField);
  const frame: number[] = [];
  const L = 0.5,
    x0 = -WIDTH / 2 - 0.2,
    x1 = WIDTH / 2 + 0.2,
    y0 = -0.15,
    y1 = HEIGHT + 0.2;
  for (const [x, y, dx, dy] of [
    [x0, y0, 1, 1],
    [x1, y0, -1, 1],
    [x0, y1, 1, -1],
    [x1, y1, -1, -1],
  ])
    frame.push(x, y, 0, x + dx * L, y, 0, x, y, 0, x, y + dy * L, 0);
  const frameLines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(frame, 3)), new THREE.LineBasicMaterial({ color: 0x7fc8ff, transparent: true, opacity: 0.8, toneMapped: false }));
  chart.add(frameLines);
  const title = header("ROUTE HYPERSPATIALE", "DU TERRAIN AU DIGITAL · 2017 → AUJOURD’HUI");
  title.position.set(0, HEIGHT + 0.62, 0);
  chart.add(title);

  // The systems: rising from left to right, the captions alternating above and below.
  const stops = routeStops();
  const n = stops.length;
  const points = stops.map((stop, i) => {
    const t = i / Math.max(1, n - 1);
    return new THREE.Vector3(-WIDTH / 2 + 0.45 + t * (WIDTH - 0.9), 0.45 + Math.pow(t, 1.15) * (HEIGHT - 1.15) + (i % 2 ? 0.16 : -0.12), Math.sin(i * 1.7) * 0.25);
  });
  const ringGeometry = new THREE.TorusGeometry(1, 0.06, 6, 40);
  const coreGeometry = new THREE.SphereGeometry(1, 16, 12);
  const hitGeometry = new THREE.SphereGeometry(0.42, 8, 6);
  const systems = stops.map((stop, i) => {
    const color = new THREE.Color(COLORS[stop.kind]);
    const holder = new THREE.Group();
    holder.position.copy(points[i]);
    const size = SIZES[stop.kind];
    const core = new THREE.Mesh(coreGeometry, new THREE.MeshBasicMaterial({ color, transparent: stop.kind === "next", opacity: stop.kind === "next" ? 0.35 : 1, toneMapped: false }));
    core.scale.setScalar(size);
    const ring = new THREE.Mesh(ringGeometry, additive(color.getHex(), stop.kind === "next" ? 0.5 : 0.8));
    ring.scale.setScalar(size * 2.3);
    ring.rotation.x = 1.1;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    halo.scale.setScalar(size * 7);
    const caption = label(stop);
    caption.position.set(0.2, i % 2 ? 0.42 : -0.42, 0.05);
    const hit = new THREE.Mesh(hitGeometry, new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.interact = stop.id;
    holder.add(core, ring, halo, caption, hit);
    chart.add(holder);
    return { stop, holder, core, ring, halo, hit, flash: 0, base: size };
  });

  // The route: solid through the path travelled, dashed towards the system still to come.
  const travelled = new THREE.CatmullRomCurve3(points.slice(0, n - 1), false, "centripetal");
  const routeLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(travelled.getPoints(240)), new THREE.LineBasicMaterial({ color: 0x8fd4ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, toneMapped: false }));
  chart.add(routeLine);
  const ahead = new THREE.Line(new THREE.BufferGeometry().setFromPoints([points[n - 2], points[n - 1]]), new THREE.LineDashedMaterial({ color: 0x9ff0c4, dashSize: 0.12, gapSize: 0.1, transparent: true, opacity: 0.85, toneMapped: false }));
  ahead.computeLineDistances();
  chart.add(ahead);

  // The ship: a small bright dart with a fading trail.
  const ship = new THREE.Group();
  const dart = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 4).rotateZ(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe8fbff, toneMapped: false }));
  const shipGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x9fe0ff, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  shipGlow.scale.setScalar(0.55);
  ship.add(dart, shipGlow);
  chart.add(ship);
  const TRAIL = 40;
  const trailPositions = new Float32Array(TRAIL * 3),
    trailColors = new Float32Array(TRAIL * 3);
  const trail = new THREE.Line(
    new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(trailPositions, 3)).setAttribute("color", new THREE.Float32BufferAttribute(trailColors, 3)),
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  trail.frustumCulled = false;
  chart.add(trail);
  const history: THREE.Vector3[] = [];

  // Where each system sits along the travelled curve, so the ship knows when it passes one.
  const marks = points.slice(0, n - 1).map((point) => {
    let best = 0,
      bestD = Infinity;
    for (let s = 0; s <= 400; s++) {
      const d = travelled.getPointAt(s / 400).distanceTo(point);
      if (d < bestD) (bestD = d), (best = s / 400);
    }
    return best;
  });
  // The voyage: along the route, a pause at the Bachelor, the jump towards the next system, then home.
  const RUN = 22,
    HOLD = 2.4,
    JUMP = 1.2,
    REST = 1.6,
    CYCLE = RUN + HOLD + JUMP + REST;
  const tmp = new THREE.Vector3(),
    ahead3 = new THREE.Vector3();
  let clock = 0,
    nextMark = 0,
    visible = 0;

  const world = (index: number) => systems[index].holder.getWorldPosition(new THREE.Vector3());
  return {
    group,
    stops,
    // For the station's interactions: each system's id, label, clickable mesh and position.
    systems: () => systems.map((system, i) => ({ id: system.stop.id, label: system.stop.label, hit: system.hit, position: world(i) })),
    tick(dt: number, time: number, active: boolean, reduced: boolean) {
      visible = reduced ? (active ? 1 : 0.35) : THREE.MathUtils.damp(visible, active ? 1 : 0.35, 2, dt);
      fanMaterial.opacity = 0.03 + 0.04 * visible;
      if (!active && !reduced && visible < 0.36) return;
      clock = reduced ? RUN + 0.5 : (clock + dt) % CYCLE;
      let along = 0,
        jump = 0;
      if (clock < RUN) along = THREE.MathUtils.smootherstep(clock / RUN, 0, 1) * 0.999;
      else if (clock < RUN + HOLD) along = 0.999;
      else if (clock < RUN + HOLD + JUMP) {
        along = 0.999;
        jump = (clock - RUN - HOLD) / JUMP;
      } else along = -1;
      if (clock < 0.05) {
        nextMark = 0;
        history.length = 0;
      }
      if (along >= 0) {
        travelled.getPointAt(along, tmp);
        travelled.getTangentAt(along, ahead3);
        if (jump > 0) tmp.lerp(points[n - 1], THREE.MathUtils.smootherstep(jump, 0, 1)), ahead3.subVectors(points[n - 1], points[n - 2]).normalize();
        ship.position.copy(tmp);
        ship.rotation.z = Math.atan2(ahead3.y, ahead3.x);
        ship.visible = true;
        dart.scale.x = 1 + jump * 4 * (1 - jump);
        history.unshift(tmp.clone());
        if (history.length > TRAIL) history.length = TRAIL;
        while (nextMark < marks.length && along >= marks[nextMark] - 0.002) systems[nextMark++].flash = 1;
        if (jump > 0.95) systems[n - 1].flash = 1;
      } else {
        ship.visible = false;
        history.length = Math.max(0, history.length - 2);
      }
      for (let i = 0; i < TRAIL; i++) {
        const p = history[Math.min(i, history.length - 1)] ?? ship.position;
        trailPositions.set([p.x, p.y, p.z], i * 3);
        const fade = history.length ? (1 - i / TRAIL) * 0.9 : 0;
        trailColors.set([0.55 * fade, 0.85 * fade, fade], i * 3);
      }
      trail.geometry.getAttribute("position").needsUpdate = true;
      trail.geometry.getAttribute("color").needsUpdate = true;
      systems.forEach((system, i) => {
        system.flash = Math.max(0, system.flash - dt * 1.2);
        const pulse = system.stop.kind === "current" || system.stop.kind === "next" ? 0.5 + 0.5 * Math.sin(time * 3 + i) : 0;
        system.ring.rotation.z = reduced ? 0 : time * (0.4 + (i % 3) * 0.15);
        system.ring.scale.setScalar(system.base * (2.3 + system.flash * 1.6 + pulse * 0.5));
        system.halo.material.opacity = (0.45 + system.flash * 0.5 + pulse * 0.25) * visible;
      });
    },
  };
}
export type HyperspaceRoute = ReturnType<typeof createHyperspaceRoute>;
