import * as THREE from "three";
import { softBeam } from "./render/softBeam";
import { part } from "./tatooineCharacters";

// A holographic plan of the quarter, drawn in the district's (u, v) frame: forward (+v) is up and
// the viewer's right is -u, as seen by someone walking out of the bay.
const WIDTH = 1.1,
  HEIGHT = 2.1,
  PIXELS = { x: 560, y: 1072 },
  SPAN = 112,
  NEAR = -6,
  METRE = PIXELS.y / SPAN;
const toCanvas = (u: number, v: number) => ({ x: PIXELS.x / 2 - u * METRE, y: PIXELS.y - (v - NEAR) * METRE });

function plan(shops: number[][]) {
  const canvas = document.createElement("canvas");
  canvas.width = PIXELS.x;
  canvas.height = PIXELS.y;
  const c = canvas.getContext("2d")!;
  const glow = c.createLinearGradient(0, 0, 0, PIXELS.y);
  glow.addColorStop(0, "rgba(60,160,220,.2)");
  glow.addColorStop(1, "rgba(60,160,220,.06)");
  c.fillStyle = glow;
  c.fillRect(0, 0, PIXELS.x, PIXELS.y);
  c.strokeStyle = "rgba(159,230,255,.12)";
  c.lineWidth = 1;
  for (let x = 0; x <= PIXELS.x; x += 10 * METRE) {
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, PIXELS.y);
    c.stroke();
  }
  for (let y = PIXELS.y; y >= 0; y -= 10 * METRE) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(PIXELS.x, y);
    c.stroke();
  }
  c.strokeStyle = "#9fe6ff";
  c.lineWidth = 3;
  const circle = (u: number, v: number, r: number, fill = true) => {
    const p = toCanvas(u, v);
    c.fillStyle = "rgba(159,230,255,.14)";
    c.beginPath();
    c.arc(p.x, p.y, r * METRE, 0, Math.PI * 2);
    if (fill) c.fill();
    c.stroke();
  };
  const rect = (u0: number, v0: number, u1: number, v1: number) => {
    const a = toCanvas(u0, v0),
      b = toCanvas(u1, v1);
    c.fillStyle = "rgba(159,230,255,.14)";
    c.beginPath();
    c.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    c.fill();
    c.stroke();
  };
  const label = (text: string, u: number, v: number, size = 22, align: CanvasTextAlign = "center") => {
    const p = toCanvas(u, v);
    c.font = `bold ${size}px Arial, Helvetica, sans-serif`;
    c.textAlign = align;
    c.textBaseline = "middle";
    c.fillStyle = "#e9f9ff";
    c.fillText(text, p.x, p.y);
  };
  // The bay, its gate opening towards the street.
  const bay = toCanvas(0, 0);
  c.lineWidth = 6;
  c.beginPath();
  c.arc(bay.x, bay.y, 17.5 * METRE, -Math.PI / 2 + 0.32, -Math.PI / 2 - 0.32 + Math.PI * 2);
  c.stroke();
  c.lineWidth = 3;
  label("BAIE 94", 0, 7, 32);
  label("VOTRE VAISSEAU", 0, 1.5, 18);
  // The speeder lane, then the buildings either side of it.
  c.setLineDash([14, 12]);
  c.beginPath();
  const laneStart = toCanvas(0, 20),
    laneEnd = toCanvas(0, 88);
  c.moveTo(laneStart.x, laneStart.y);
  c.lineTo(laneEnd.x, laneEnd.y);
  c.stroke();
  c.setLineDash([]);
  shops.forEach(([u, v, r]) => circle(u, v, r));
  rect(-22.3, 53.7, -4.7, 71.3);
  circle(-13.5, 62.5, 8.7, false);
  circle(-10.5, 74.6, 2.8);
  label("CANTINA ♪", -13.5, 62.5, 30);
  circle(-7.2, 46.8, 2.4, false);
  label("MARCHÉ", -7.4, 50.3, 20);
  label("JAWA", -7.4, 47.9, 20);
  rect(2.5, 21.3, 5.5, 21.9);
  label("CONTRÔLE", 6.5, 25.2, 20);
  rect(-24.7, 94, -17.3, 106);
  label("SANDCRAWLER", -21, 90.5, 19);
  label("SPEEDERS", 0, 84, 17);
  // Title and legend.
  c.fillStyle = "#9fe6ff";
  c.font = "26px SFMono-Regular, Consolas, monospace";
  c.textAlign = "left";
  c.fillText("MOS EISLEY · SECTEUR 94", 36, 52);
  c.fillStyle = "rgba(4,20,32,.55)";
  c.fillRect(24, PIXELS.y - 70, 250, 46);
  c.fillStyle = "#ffb36b";
  c.beginPath();
  c.arc(48, PIXELS.y - 47, 9, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#e9f9ff";
  c.font = "22px SFMono-Regular, Consolas, monospace";
  c.fillText("VOUS ÊTES ICI", 68, PIXELS.y - 40);
  c.strokeStyle = "#9fe6ff";
  c.lineWidth = 4;
  c.strokeRect(10, 10, PIXELS.x - 20, PIXELS.y - 20);
  c.fillStyle = "rgba(0,0,0,.3)";
  for (let y = 0; y < PIXELS.y; y += 6) c.fillRect(0, y, PIXELS.x, 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function createDistrictMap(shops: number[][], at: { u: number; v: number; facing: number }) {
  const group = new THREE.Group();
  group.name = "district-holomap";
  group.position.set(at.u, 0, at.v);
  group.rotation.y = at.facing;
  const metal = new THREE.MeshStandardMaterial({ color: 0x6f6a60, roughness: 0.55, metalness: 0.6 });
  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide } as const;
  part(group, new THREE.CylinderGeometry(0.3, 0.45, 0.95, 18), metal, [0, 0.47, 0]);
  part(group, new THREE.TorusGeometry(0.28, 0.03, 6, 28), new THREE.MeshBasicMaterial({ color: 0x8fdcff }), [0, 0.97, 0], [Math.PI / 2, 0, 0]);
  const beam = part(group, new THREE.CylinderGeometry(0.75, 0.26, 0.25, 24, 1, true), softBeam(new THREE.MeshBasicMaterial({ color: 0x4fb8e8, opacity: 0.12, ...additive })), [0, 1.08, 0]);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(WIDTH, HEIGHT),
    new THREE.MeshBasicMaterial({ map: plan(shops), color: 0x9fdcff, opacity: 0.8, ...additive }),
  );
  screen.position.y = 2.2;
  screen.rotation.x = -0.12;
  group.add(screen);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.028, 18), new THREE.MeshBasicMaterial({ color: 0xffb36b, opacity: 1, ...additive }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.05, 28), new THREE.MeshBasicMaterial({ color: 0xffb36b, opacity: 0.7, ...additive }));
  dot.position.z = ring.position.z = 0.006;
  screen.add(dot, ring);
  return {
    group,
    collider: { u: at.u, v: at.v, r: 0.55 },
    tick: (time: number, reduced: boolean, walker: { u: number; v: number }) => {
      const x = THREE.MathUtils.clamp((-walker.u * METRE) / PIXELS.x, -0.47, 0.47) * WIDTH,
        y = THREE.MathUtils.clamp(((walker.v - NEAR) * METRE) / PIXELS.y - 0.5, -0.47, 0.47) * HEIGHT;
      dot.position.x = ring.position.x = x;
      dot.position.y = ring.position.y = y;
      const pulse = reduced ? 0.5 : (time * 0.8) % 1;
      ring.scale.setScalar(1 + pulse * 1.6);
      ring.material.opacity = 0.7 * (1 - pulse);
      const flicker = reduced ? 1 : 0.94 + Math.sin(time * 7) * 0.04 + (Math.sin(time * 29) > 0.97 ? -0.18 : 0);
      screen.material.opacity = 0.8 * flicker;
      beam.material.opacity = 0.12 * flicker;
      screen.position.y = 2.2 + (reduced ? 0 : Math.sin(time * 1.3) * 0.02);
    },
  };
}
