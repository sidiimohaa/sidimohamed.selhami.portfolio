import * as THREE from "three";
import { CORUSCANT_LANDMARKS } from "../coruscantSkyline";
import { identity } from "../deathStar/cvData";
import { landings } from "../universe";
import type { Spot, ZoneAction } from "../landingKit";
import { cityUniforms } from "./cityEnv";

// Holographic boards hung on the great towers around the pad. Most sell things in-universe; the
// database ones present the portfolio, and clicking them opens a real project card from the kiosk
// at the edge of the platform, with the same text as everywhere else in the portfolio.

type Page = { kicker: string; title: string; line: string; tone: string; own?: boolean };
const projects = landings.Tatooine?.terminals ?? [];

const adverts: Page[] = [
  { kicker: "HOLONET", title: "LIAISON NABOO", line: "Départs chaque cycle · Quai 40", tone: "#2fe9ff" },
  { kicker: "NIVEAU 1313", title: "NE DESCENDEZ PAS", line: "Conseil de la Sécurité de Coruscant", tone: "#ff5a35" },
  { kicker: "OUTLANDER CLUB", title: "CE SOIR", line: "Sabacc · Musique live", tone: "#ff2fa8" },
  { kicker: "COMMERCE", title: "DROÏDES RÉVISÉS", line: "Garantie trois cycles standards", tone: "#ffc02e" },
  { kicker: "SÉNAT GALACTIQUE", title: "SESSION OUVERTE", line: "La Rotonde · Accès réservé", tone: "#a98bff" },
  { kicker: "MARCHÉ DE NUIT", title: "NIVEAU 900", line: "Épices · Pièces · Kyber synthétique", tone: "#8dff3f" },
];
const database = (): Page[] => [
  { kicker: "GALACTIC DEVELOPER DATABASE", title: "ACCESS GRANTED", line: "Toucher pour consulter une fiche", tone: "#46ffe0", own: true },
  ...projects.slice(0, 4).map((project): Page => ({ kicker: "FICHE PROJET", title: project.heading.toUpperCase(), line: project.body, tone: "#46ffe0", own: true })),
  { kicker: "PROFIL", title: identity.name.toUpperCase(), line: identity.title, tone: "#46ffe0", own: true },
];

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// A projected sheet of light: nothing behind the glowing lines, cut corners, a column of invented
// glyphs down the side, and a title that burns white at the core of its colour.
function paint(page: Page) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 432;
  const c = canvas.getContext("2d")!;
  let seed = page.title.length * 97 + page.kicker.length;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const wash = c.createLinearGradient(0, 0, 768, 432);
  wash.addColorStop(0, `${page.tone}38`);
  wash.addColorStop(0.55, `${page.tone}12`);
  wash.addColorStop(1, `${page.tone}2c`);
  const outline = () => {
    c.beginPath();
    c.moveTo(44, 12);
    c.lineTo(756, 12);
    c.lineTo(756, 388);
    c.lineTo(724, 420);
    c.lineTo(12, 420);
    c.lineTo(12, 44);
    c.closePath();
  };
  outline();
  c.fillStyle = wash;
  c.fill();
  c.strokeStyle = page.tone;
  c.shadowColor = page.tone;
  c.shadowBlur = 22;
  c.lineWidth = 6;
  outline();
  c.stroke();
  c.shadowBlur = 0;
  c.strokeStyle = "rgba(255,255,255,.75)";
  c.lineWidth = 1.6;
  outline();
  c.stroke();
  // Glyph column.
  c.shadowColor = page.tone;
  c.shadowBlur = 10;
  c.strokeStyle = page.tone;
  c.lineWidth = 4;
  c.lineCap = "round";
  for (let g = 0; g < 6; g++) {
    const y = 38 + g * 62;
    c.beginPath();
    for (let k = 0; k < 3; k++) {
      c.moveTo(34 + Math.floor(rand() * 3) * 16, y + Math.floor(rand() * 3) * 20);
      c.lineTo(34 + Math.floor(rand() * 3) * 16, y + Math.floor(rand() * 3) * 20);
    }
    c.stroke();
  }
  c.shadowBlur = 0;
  c.fillStyle = `${page.tone}66`;
  c.fillRect(96, 30, 3, 372);
  // Words.
  const left = 118,
    width = 610;
  c.fillStyle = page.tone;
  c.shadowColor = page.tone;
  c.shadowBlur = 12;
  c.font = "bold 28px SFMono-Regular, Consolas, monospace";
  c.fillText(page.kicker, left, 72);
  let size = 84;
  c.font = `900 ${size}px Arial, Helvetica, sans-serif`;
  while (size > 38 && wrap(c, page.title, width).length > 2) c.font = `900 ${(size -= 6)}px Arial, Helvetica, sans-serif`;
  const titles = wrap(c, page.title, width).slice(0, 2);
  titles.forEach((line, i) => {
    const y = 112 + size + i * (size + 8);
    c.shadowColor = page.tone;
    c.shadowBlur = 26;
    c.fillStyle = page.tone;
    c.fillText(line, left, y);
    c.shadowBlur = 6;
    c.fillStyle = "#ffffff";
    c.fillText(line, left, y);
  });
  c.shadowBlur = 8;
  c.fillStyle = page.tone;
  c.font = "30px Arial, Helvetica, sans-serif";
  wrap(c, page.line, width).slice(0, 2).forEach((line, i) => c.fillText(line, left, 352 + i * 36));
  c.shadowBlur = 0;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 8;
  return texture;
}

const holoVertex = /* glsl */ `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const holoFragment = /* glsl */ `
  uniform sampler2D map;uniform float time,level,glitch,seed;uniform vec3 tint;
  varying vec2 vUv;
  float noise(float t){return fract(sin(t*91.17)*43758.5453);}
  void main(){
    vec2 uv=vUv;
    // A switching page tears sideways in bands; at rest only a slight drift remains.
    float band=floor(uv.y*26.0+time*7.0);
    uv.x+=(noise(band+seed)-.5)*glitch*.09+sin(uv.y*9.0+time*1.3+seed)*.0012;
    // The projector's colours sit a hair apart at the edges of what it draws.
    float split=.0016+glitch*.008;
    vec3 c=vec3(texture2D(map,uv+vec2(split,0.0)).r,texture2D(map,uv).g,texture2D(map,uv-vec2(split,0.0)).b);
    float a=texture2D(map,uv).a;
    float scan=.84+.16*sin(vUv.y*420.0-time*6.0);
    // A slow brighter band climbs the sheet, like the beam refreshing it.
    float sweep=exp(-pow((fract(time*.11+seed)-vUv.y)*11.0,2.0))*.4;
    vec3 lit=c*a*tint*(scan+sweep);
    gl_FragColor=vec4(lit*level,a*level);
  }`;

export function createCityHolograms(glow: THREE.Texture, count: number, circles: Spot[]) {
  const group = new THREE.Group();
  group.name = "city-holograms";
  const own = projects.length ? database() : [];
  const ownTextures = own.map(paint);
  const adTextures = adverts.map(paint);
  // The nearest great towers, each board on the wall that faces the platform.
  const marks = [...CORUSCANT_LANDMARKS].sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z)).slice(0, count);
  const boards = marks.map((mark, index) => {
    const reach = Math.hypot(mark.x, mark.z) || 1;
    const showsPortfolio = own.length > 0 && index % 3 === 0;
    const tone = new THREE.Color(showsPortfolio ? "#46ffe0" : adverts[index % adverts.length].tone);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: showsPortfolio ? ownTextures[0] : adTextures[index % adTextures.length] },
        time: { value: 0 },
        level: { value: 1 },
        glitch: { value: 0 },
        seed: { value: index * 1.37 },
        tint: { value: new THREE.Color(1, 1, 1) },
      },
      vertexShader: holoVertex,
      fragmentShader: holoFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    const scale = 0.1 * Math.max(190, reach) * (showsPortfolio ? 1.2 : 1);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.78 * scale, scale), material);
    const out = mark.r + 1.5 + scale * 0.14;
    mesh.position.set(mark.x - (mark.x / reach) * out, 14 + (index % 3) * 13, mark.z - (mark.z / reach) * out);
    mesh.lookAt(0, mesh.position.y * 0.55, 0);
    group.add(mesh);
    // The light the sheet throws into the haze round it, and the rails that project it.
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: tone, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.copy(mesh.position);
    halo.scale.set(3.4 * scale, 2.5 * scale, 1);
    group.add(halo);
    const rail = new THREE.MeshBasicMaterial({ color: tone, toneMapped: false });
    const rails = [0.53, -0.53].map((y) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.84 * scale, 0.012 * scale, 0.012 * scale), rail);
      bar.position.y = y * scale;
      mesh.add(bar);
      return bar;
    });
    rails.forEach((bar) => {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.018 * scale, 0.018 * scale, scale * 0.16), new THREE.MeshStandardMaterial({ color: 0x20252b, roughness: 0.6, metalness: 0.6 }));
      strut.position.set(0, 0, -scale * 0.08);
      bar.add(strut);
    });
    return { mesh, material, halo, rail, showsPortfolio, page: index, base: 1, clock: index * 1.7, burst: 0 };
  });

  // The kiosk at the edge of the platform that opens the database's project cards.
  let database_: { action: ZoneAction; circle: Spot; tick: (elapsed: number, reduced: boolean) => void } | null = null;
  if (own.length) {
    const candidates = Array.from({ length: 48 }, (_, i) => (i / 48) * Math.PI * 2);
    const clearance = (angle: number) => Math.min(...circles.map((spot) => Math.hypot(Math.cos(angle) * 14.2 - spot.x, Math.sin(angle) * 14.2 - spot.z) - spot.r));
    const angle = candidates.reduce((best, next) => (clearance(next) > clearance(best) ? next : best), candidates[0]);
    const x = Math.cos(angle) * 14.2,
      z = Math.sin(angle) * 14.2;
    const kiosk = new THREE.Group();
    kiosk.position.set(x, 0, z);
    kiosk.lookAt(0, 0, 0);
    const metal = new THREE.MeshStandardMaterial({ color: 0x31363f, metalness: 0.7, roughness: 0.4 });
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 1.05, 12), metal);
    foot.position.y = 0.52;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(1.42, 0.8),
      new THREE.MeshBasicMaterial({ map: ownTextures[0], transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    );
    face.position.set(0, 1.62, 0.02);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x8ffff0, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.y = 1.62;
    halo.scale.set(2.6, 1.8, 1);
    kiosk.add(foot, face, halo);
    group.add(kiosk);
    database_ = {
      circle: { x, z, r: 0.5 },
      action: {
        id: "database",
        label: "Base de données",
        position: new THREE.Vector3(x, 1.4, z),
        objects: [face, foot, ...boards.filter((board) => board.showsPortfolio).map((board) => board.mesh)],
        approach: { position: new THREE.Vector3(x * 0.83, 0, z * 0.83), lookAt: new THREE.Vector3(x, 1.6, z) },
        dossiers: { eyebrow: "GALACTIC DEVELOPER DATABASE", projects },
        activate: () => {},
      },
      tick: (elapsed, reduced) => {
        (face.material as THREE.MeshBasicMaterial).opacity = reduced ? 0.95 : 0.86 + Math.sin(elapsed * 5.3) * 0.06;
      },
    };
  }

  return {
    group,
    database: database_,
    // power: 1 normally; below that the boards stutter or die, in an outage or a storm.
    tick(dt: number, elapsed: number, reduced: boolean, power: number, alert: boolean) {
      database_?.tick(elapsed, reduced);
      const dimmed = 1 - cityUniforms.cityDay.value * 0.45;
      boards.forEach((board) => {
        board.clock += reduced ? 0 : dt;
        if (board.clock > 9) {
          board.clock = 0;
          board.page++;
          const pool = board.showsPortfolio ? ownTextures : adTextures;
          board.material.uniforms.map.value = pool[board.page % pool.length];
          if (!board.showsPortfolio) {
            const tone = adverts[board.page % adverts.length].tone;
            board.halo.material.color.set(tone);
            board.rail.color.set(tone);
          }
          board.burst = 0.45;
        }
        board.burst = Math.max(0, board.burst - dt);
        // Holograms switch with a short tear; without power they gutter out.
        const gutter = power < 1 && !reduced ? (Math.random() < 0.07 ? 0.15 : power) : power;
        const uniforms = board.material.uniforms;
        uniforms.time.value = reduced ? 0 : elapsed;
        uniforms.glitch.value = reduced ? 0 : Math.min(1, board.burst * 3 + (1 - Math.min(1, gutter)) * 0.8);
        uniforms.level.value = board.base * dimmed * (reduced ? power : gutter) * (board.burst > 0 ? 0.7 + Math.random() * 0.3 : 1);
        uniforms.tint.value.setRGB(1, alert ? 0.42 : 1, alert ? 0.38 : 1);
        board.halo.material.opacity = 0.12 * dimmed * gutter;
      });
    },
  };
}
