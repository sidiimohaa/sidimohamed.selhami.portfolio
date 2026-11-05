import * as THREE from "three";
import type { ZoneTerminal } from "./landingKit";
import { softBeam } from "./render/softBeam";
import { bakePart, part } from "./tatooineCharacters";
import type { Landing } from "./universe";

// The briefing table: a holographic schematic of a battle station turns above a round projector,
// like the rebels' attack plans. Its marked targets are the diplomas: each one lights up as its
// terminal is approached, and touching its callout walks to that terminal.
const RADIUS = 1.2,
  CENTRE = 2.6;
const CYAN = 0x8fdcff;
// Where each target sits on the station (latitude, longitude from the front), and its callout.
const TARGETS = [
  { lat: 0.55, lon: -0.85, card: [-2.05, 3.25] },
  { lat: -0.45, lon: -0.6, card: [-2.05, 2.05] },
  { lat: 0.5, lon: 0.7, card: [2.05, 3.25] },
  { lat: -0.55, lon: 0.9, card: [2.05, 2.05] },
] as const;

function canvasPlane(width: number, height: number, pixels: [number, number], paint: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  [canvas.width, canvas.height] = pixels;
  const c = canvas.getContext("2d")!;
  paint(c);
  c.fillStyle = "rgba(0,0,0,.3)";
  for (let y = 0; y < pixels[1]; y += 5) c.fillRect(0, y, pixels[0], 2);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map, color: 0x9fdcff, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  );
  // A dark glass behind the light keeps the text legible against the bright snow.
  const backing = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color: 0x041822, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
  backing.position.z = -0.01;
  backing.renderOrder = -1;
  plane.add(backing);
  return plane;
}
function wrap(c: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (c.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
const onSphere = (lat: number, lon: number, radius = RADIUS) =>
  new THREE.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)).multiplyScalar(radius);

// The station's wireframe: parallels, meridians, the equatorial trench and the dish.
function schematic() {
  const points: number[] = [];
  const loop = (at: (t: number) => THREE.Vector3, segments = 72) => {
    for (let i = 0; i < segments; i++) {
      const a = at(i / segments),
        b = at((i + 1) / segments);
      points.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  };
  for (let lat = -75; lat <= 75; lat += 15) {
    if (lat === 0) continue;
    const l = THREE.MathUtils.degToRad(lat);
    loop((t) => onSphere(l, t * Math.PI * 2));
  }
  for (let lon = 0; lon < 360; lon += 15) {
    const l = THREE.MathUtils.degToRad(lon);
    loop((t) => onSphere(-Math.PI / 2 + t * Math.PI, l), 36);
  }
  const lines = new THREE.BufferGeometry();
  lines.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  // The trench and the dish get their own, brighter lines.
  const bright: number[] = [];
  const brightLoop = (at: (t: number) => THREE.Vector3, segments = 96) => {
    for (let i = 0; i < segments; i++) {
      const a = at(i / segments),
        b = at((i + 1) / segments);
      bright.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  };
  for (const offset of [-0.035, 0.035]) brightLoop((t) => onSphere(offset, t * Math.PI * 2, RADIUS * 0.97));
  const dish = onSphere(0.55, -0.35).normalize();
  const side = new THREE.Vector3().crossVectors(dish, new THREE.Vector3(0, 1, 0)).normalize(),
    up = new THREE.Vector3().crossVectors(side, dish);
  for (const angle of [0.08, 0.16, 0.24]) {
    brightLoop((t) => {
      const a = t * Math.PI * 2;
      return dish
        .clone()
        .multiplyScalar(Math.cos(angle) * RADIUS * (1 - angle * 0.4))
        .addScaledVector(side, Math.sin(angle) * Math.cos(a) * RADIUS)
        .addScaledVector(up, Math.sin(angle) * Math.sin(a) * RADIUS);
    }, 48);
  }
  const accents = new THREE.BufferGeometry();
  accents.setAttribute("position", new THREE.Float32BufferAttribute(bright, 3));
  return { lines, accents };
}

export function createBriefingTable(landing: Landing, at: { x: number; z: number; facing: number }) {
  const group = new THREE.Group();
  group.name = "hoth-briefing";
  group.position.set(at.x, 0, at.z);
  group.rotation.y = at.facing;
  const metal = new THREE.MeshStandardMaterial({ color: 0x7d868e, roughness: 0.45, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a424a, roughness: 0.6, metalness: 0.5 });
  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } as const;
  // A round projector table, its rim lit from inside.
  const table = new THREE.Group();
  group.add(table);
  part(table, new THREE.CylinderGeometry(1.6, 1.75, 0.8, 48), metal, [0, 0.4, 0]);
  part(table, new THREE.CylinderGeometry(1.2, 1.3, 0.3, 48), dark, [0, 0.12, 0]);
  part(table, new THREE.CylinderGeometry(0.5, 0.6, 0.12, 32), dark, [0, 0.86, 0]);
  bakePart(table);
  part(group, new THREE.TorusGeometry(1.5, 0.04, 8, 72), new THREE.MeshBasicMaterial({ color: CYAN }), [0, 0.82, 0], [Math.PI / 2, 0, 0]);
  const beam = part(group, new THREE.CylinderGeometry(1.35, 0.45, CENTRE - RADIUS - 0.85, 40, 1, true), softBeam(new THREE.MeshBasicMaterial({ color: 0x4fb8e8, opacity: 0.07, side: THREE.DoubleSide, ...additive })), [0, 0.86 + (CENTRE - RADIUS - 0.85) / 2, 0]);

  // The schematic turns gently back and forth so every target stays on the visible face.
  const station = new THREE.Group();
  station.position.y = CENTRE;
  group.add(station);
  const { lines, accents } = schematic();
  const wire = new THREE.LineSegments(lines, new THREE.LineBasicMaterial({ color: CYAN, opacity: 0.32, ...additive }));
  const trench = new THREE.LineSegments(accents, new THREE.LineBasicMaterial({ color: 0xc8f0ff, opacity: 0.85, ...additive }));
  const shell = new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 0.99, 48, 24), new THREE.MeshBasicMaterial({ color: 0x1d6f99, opacity: 0.06, side: THREE.DoubleSide, ...additive }));
  // A darker core so the wireframe reads against the snow behind it.
  const core = new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 0.96, 48, 24), new THREE.MeshBasicMaterial({ color: 0x072231, transparent: true, opacity: 0.4, depthWrite: false }));
  core.renderOrder = -1;
  station.add(core, shell, wire, trench);
  // A scan ring sweeps up and down the station.
  const scan = new THREE.Mesh(new THREE.TorusGeometry(1, 0.008, 4, 96), new THREE.MeshBasicMaterial({ color: 0xe9f9ff, opacity: 0.7, ...additive }));
  scan.rotation.x = Math.PI / 2;
  station.add(scan);

  // Header: what the plans really show.
  const count = landing.terminals.length;
  const header = canvasPlane(3.4, 0.5, [1360, 200], (c) => {
    c.strokeStyle = "#9fe6ff";
    c.lineWidth = 4;
    c.strokeRect(8, 8, 1344, 184);
    c.fillStyle = "#e9f9ff";
    c.font = "bold 64px Arial, Helvetica, sans-serif";
    c.textAlign = "center";
    c.fillText("PLANS · PARCOURS DE FORMATION", 680, 98);
    c.fillStyle = "#7fd0f0";
    c.font = "32px SFMono-Regular, Consolas, monospace";
    const ongoing = landing.terminals.filter((item) => item.status === "progress").length,
      done = count - ongoing;
    c.fillText(`${done} OBJECTIF${done > 1 ? "S" : ""} ATTEINT${done > 1 ? "S" : ""}${ongoing ? ` · ${ongoing} EN COURS` : ""}`, 680, 156);
  });
  header.position.y = CENTRE + RADIUS + 0.65;
  group.add(header);

  // One target and one callout per diploma, joined by a leader line.
  const marker = new THREE.MeshBasicMaterial({ color: 0xffd28a, opacity: 0.9, side: THREE.DoubleSide, ...additive });
  const targets = landing.terminals.slice(0, TARGETS.length).map((diploma, index) => {
    const spot = TARGETS[index];
    const point = onSphere(spot.lat, spot.lon, RADIUS * 1.01);
    const reticle = new THREE.Group();
    reticle.position.copy(point);
    reticle.lookAt(point.clone().multiplyScalar(2));
    reticle.add(
      new THREE.Mesh(new THREE.RingGeometry(0.1, 0.13, 4, 1, Math.PI / 4), marker.clone()),
      new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), marker.clone()),
    );
    station.add(reticle);
    const card = canvasPlane(1.5, 0.75, [640, 320], (c) => {
      c.strokeStyle = "#9fe6ff";
      c.lineWidth = 4;
      c.strokeRect(6, 6, 628, 308);
      c.fillStyle = "#ffd28a";
      c.font = "26px SFMono-Regular, Consolas, monospace";
      c.fillText(`OBJECTIF 0${index + 1} · ${diploma.status === "progress" ? "EN COURS" : "ATTEINT ✓"}`, 30, 50);
      c.fillStyle = "#e9f9ff";
      c.font = "bold 58px Arial, Helvetica, sans-serif";
      c.fillText(diploma.label.toUpperCase(), 30, 120);
      c.font = "bold 34px Arial, Helvetica, sans-serif";
      wrap(c, diploma.heading, 580)
        .slice(0, 2)
        .forEach((line, i) => c.fillText(line, 30, 172 + i * 40));
      c.fillStyle = "#7fd0f0";
      c.font = "22px SFMono-Regular, Consolas, monospace";
      if (diploma.meta) c.fillText(wrap(c, diploma.meta.toUpperCase(), 580)[0], 30, 278);
    });
    card.position.set(spot.card[0], spot.card[1], 0);
    card.userData.terminal = index;
    group.add(card);
    const leader = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: 0xffd28a, opacity: 0.6, ...additive }),
    );
    group.add(leader);
    return { reticle, card, leader, point, anchor: new THREE.Vector3(spot.card[0] - Math.sign(spot.card[0]) * 0.75, spot.card[1], 0), flash: 0 };
  });
  // A bright run, like the attack path, travels from one target to the next.
  const run = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, ...additive }));
  station.add(run);
  const from = new THREE.Vector3(),
    to = new THREE.Vector3(),
    world = new THREE.Vector3();
  return {
    group,
    colliders: [{ x: at.x, z: at.z, r: 1.95 }],
    tick: (time: number, reduced: boolean, terminals: ZoneTerminal[]) => {
      const flicker = reduced ? 1 : 0.94 + Math.sin(time * 7) * 0.04 + (Math.sin(time * 31) > 0.97 ? -0.18 : 0);
      station.rotation.y = reduced ? 0 : Math.sin(time * 0.15) * 0.35;
      station.position.y = CENTRE + (reduced ? 0 : Math.sin(time * 1.1) * 0.03);
      wire.material.opacity = 0.32 * flicker;
      shell.material.opacity = 0.06 * flicker;
      header.material.opacity = 0.85 * flicker;
      beam.material.opacity = 0.07 * flicker;
      const sweep = reduced ? 0 : Math.sin(time * 0.6);
      scan.position.y = sweep * RADIUS;
      scan.scale.setScalar(Math.max(0.05, Math.sqrt(1 - sweep * sweep) * RADIUS));
      // The run spends two and a half seconds on each leg, then the target it reaches flashes.
      const legs = targets.length;
      const progress = reduced ? 0 : (((time / 2.5) % legs) + legs) % legs,
        leg = Math.floor(progress),
        t = THREE.MathUtils.smootherstep(progress - leg, 0, 1);
      from.copy(targets[leg].point).normalize();
      to.copy(targets[(leg + 1) % legs].point).normalize();
      const angle = from.angleTo(to);
      run.position
        .copy(from)
        .multiplyScalar(Math.sin((1 - t) * angle))
        .addScaledVector(to, Math.sin(t * angle))
        .divideScalar(Math.max(Math.sin(angle), 1e-4))
        .multiplyScalar(RADIUS * 1.02);
      run.visible = !reduced;
      if (!reduced && t > 0.97) targets[(leg + 1) % legs].flash = 1;
      group.updateMatrixWorld();
      targets.forEach((target, i) => {
        const focus = terminals[i]?.focus ?? 0;
        target.flash = Math.max(0, target.flash - 0.03);
        const glow = 0.35 + focus * 0.65 + target.flash * 0.4;
        target.reticle.scale.setScalar(1 + focus * 0.8 + target.flash * 0.6);
        target.reticle.rotation.z = reduced ? 0 : time * 0.8;
        target.reticle.children.forEach((child) => ((child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = Math.min(1, glow + 0.3)));
        target.card.material.opacity = (0.55 + focus * 0.45) * flicker;
        // Redraw the leader from the callout's inner edge to the target as the station turns.
        world.copy(target.point);
        target.reticle.parent!.localToWorld(world);
        group.worldToLocal(world);
        const position = target.leader.geometry.getAttribute("position") as THREE.BufferAttribute;
        position.setXYZ(0, target.anchor.x, target.anchor.y, target.anchor.z);
        position.setXYZ(1, world.x, world.y, world.z);
        position.needsUpdate = true;
        target.leader.material.opacity = 0.35 + focus * 0.6;
      });
    },
  };
}
