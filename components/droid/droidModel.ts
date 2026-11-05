import * as THREE from "three";
import { softBeam } from "../render/softBeam";
import { bakePart, part, rounded } from "../tatooineCharacters";

// R-X7: an astromech of its own, not a copy. A squat barrel in worn off-white, a faceted gunmetal
// head with one large optic and an orange sensor beside it, two antennas, and an orange band. Facing
// +Z, feet at y = 0, about 1.25 tall. Baked by material, so it draws in about a dozen calls.

function wornHull() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const c = canvas.getContext("2d");
  if (c) {
    c.fillStyle = "#dcd8cc";
    c.fillRect(0, 0, 512, 256);
    // Panels round the barrel, a holographic-blue bay and the orange band.
    c.fillStyle = "#c3c1b8";
    for (let x = 0; x < 512; x += 64) c.fillRect(x + 6, 34, 50, 74);
    c.fillStyle = "#26566f";
    c.fillRect(214, 120, 84, 62);
    c.fillRect(22, 120, 52, 62);
    c.fillRect(438, 120, 52, 62);
    c.fillStyle = "#c9782f";
    c.fillRect(0, 14, 512, 11);
    c.fillRect(214, 192, 84, 9);
    c.strokeStyle = "rgba(40,44,48,.75)";
    c.lineWidth = 2;
    for (let x = 0; x < 512; x += 64) c.strokeRect(x + 6, 34, 50, 74);
    c.strokeRect(214, 120, 84, 62);
    c.strokeRect(22, 120, 52, 62);
    c.strokeRect(438, 120, 52, 62);
    for (let x = 100; x < 200; x += 20) c.strokeRect(x, 130, 12, 44);
    for (let x = 320; x < 420; x += 20) c.strokeRect(x, 130, 12, 44);
    // Scratches and grime: short, faint, mostly towards the foot.
    let s = 77;
    const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 220; i++) {
      const y = Math.pow(rand(), 0.6) * 256;
      c.strokeStyle = rand() < 0.6 ? "rgba(70,62,50,.22)" : "rgba(255,255,255,.3)";
      c.lineWidth = 0.6 + rand() * 0.8;
      c.beginPath();
      const x = rand() * 512;
      c.moveTo(x, y);
      c.lineTo(x + (rand() - 0.5) * 22, y + (rand() - 0.5) * 9);
      c.stroke();
    }
    const grime = c.createLinearGradient(0, 170, 0, 256);
    grime.addColorStop(0, "rgba(60,50,38,0)");
    grime.addColorStop(1, "rgba(60,50,38,.42)");
    c.fillStyle = grime;
    c.fillRect(0, 170, 512, 86);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createDroidModel() {
  const root = new THREE.Group();
  root.name = "r-x7";
  const hull = new THREE.MeshStandardMaterial({ map: wornHull(), metalness: 0.28, roughness: 0.52 });
  const white = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, metalness: 0.3, roughness: 0.5 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x7f888e, metalness: 0.85, roughness: 0.36 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23282c, metalness: 0.6, roughness: 0.5 });
  const dome = new THREE.MeshStandardMaterial({ color: 0x8e979d, metalness: 0.82, roughness: 0.3, flatShading: true });
  const orange = new THREE.MeshStandardMaterial({ color: 0xd4792a, metalness: 0.3, roughness: 0.45 });
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x7fe6ff, toneMapped: false });
  const sensorMaterial = new THREE.MeshBasicMaterial({ color: 0xff9a3c, toneMapped: false });
  const ledMaterials = [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color: 0x7fe6ff, toneMapped: false }));

  // The body sways as one piece on its legs.
  const body = new THREE.Group();
  body.position.y = 0.3;
  root.add(body);
  const shell = new THREE.Group();
  body.add(shell);
  part(shell, new THREE.CylinderGeometry(0.31, 0.3, 0.6, 28, 1, true), hull, [0, 0.3, 0]);
  part(shell, new THREE.CylinderGeometry(0.3, 0.2, 0.09, 28), dark, [0, -0.045, 0]);
  part(shell, new THREE.CylinderGeometry(0.325, 0.325, 0.035, 28), metal, [0, 0.61, 0]);
  // Shoulder housings the side legs hang from.
  for (const side of [-1, 1]) {
    part(shell, new THREE.CylinderGeometry(0.095, 0.095, 0.05, 16), metal, [side * 0.335, 0.4, 0], [0, 0, Math.PI / 2]);
    part(shell, new THREE.CylinderGeometry(0.05, 0.05, 0.06, 12), orange, [side * 0.365, 0.4, 0], [0, 0, Math.PI / 2]);
  }
  bakePart(shell);

  // Legs and feet stay planted.
  const legs = new THREE.Group();
  root.add(legs);
  for (const side of [-1, 1]) {
    part(legs, rounded(0.085, 0.42, 0.13, 0.02), white, [side * 0.385, 0.36, 0], [0, 0, side * 0.03]);
    part(legs, rounded(0.05, 0.3, 0.08, 0.012), metal, [side * 0.385, 0.34, 0.075]);
    part(legs, rounded(0.15, 0.1, 0.27, 0.025), dark, [side * 0.39, 0.05, 0.01]);
    part(legs, new THREE.BoxGeometry(0.155, 0.018, 0.1), orange, [side * 0.39, 0.09, 0.08]);
  }
  part(legs, rounded(0.11, 0.2, 0.11, 0.02), metal, [0, 0.13, 0]);
  part(legs, rounded(0.16, 0.08, 0.2, 0.02), dark, [0, 0.04, 0]);
  bakePart(legs);

  // The head turns on the collar.
  const head = new THREE.Group();
  head.position.y = 0.625;
  body.add(head);
  const headShell = new THREE.Group();
  head.add(headShell);
  part(headShell, new THREE.SphereGeometry(0.3, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), dome, [0, 0.03, 0]);
  part(headShell, new THREE.CylinderGeometry(0.305, 0.305, 0.045, 28), white, [0, 0.02, 0]);
  part(headShell, new THREE.CylinderGeometry(0.1, 0.13, 0.03, 12), orange, [0, 0.31, 0]);
  // The socket of the large optic, and the small housing beside it.
  part(headShell, new THREE.CylinderGeometry(0.083, 0.095, 0.07, 18), dark, [0.03, 0.17, 0.235], [Math.PI / 2 - 0.42, 0, 0]);
  part(headShell, rounded(0.08, 0.06, 0.05, 0.012), dark, [-0.145, 0.15, 0.225], [-0.35, -0.42, 0]);
  part(headShell, rounded(0.2, 0.035, 0.03, 0.008), dark, [0.04, 0.052, 0.29]);
  part(headShell, rounded(0.03, 0.09, 0.025, 0.006), metal, [0.26, 0.13, 0.12], [0, 1, 0]);
  bakePart(headShell);
  const eye = part(head, new THREE.CircleGeometry(0.058, 20), eyeMaterial, [0.03, 0.185, 0.272], [-0.42, 0, 0]);
  const sensor = part(head, new THREE.CircleGeometry(0.019, 12), sensorMaterial, [-0.158, 0.158, 0.252], [-0.35, -0.42, 0]);
  ledMaterials.forEach((material, i) => part(head, new THREE.CircleGeometry(0.009, 8), material, [-0.02 + i * 0.05, 0.052, 0.307]));

  // Antennas, each on its own pivot so they lag behind the head.
  const antennas = [
    { x: -0.11, z: -0.09, height: 0.3 },
    { x: 0.13, z: -0.12, height: 0.2 },
  ].map(({ x, z, height }) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.27, z);
    head.add(pivot);
    part(pivot, new THREE.CylinderGeometry(0.006, 0.011, height, 6), metal, [0, height / 2, 0]);
    part(pivot, new THREE.SphereGeometry(0.018, 8, 6), orange, [0, height, 0]);
    return pivot;
  });

  // The light from the optic, and the beam it sweeps with when scanning.
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 64;
  const g = glowCanvas.getContext("2d");
  if (g) {
    const fall = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    fall.addColorStop(0, "rgba(255,255,255,1)");
    fall.addColorStop(0.3, "rgba(255,255,255,.35)");
    fall.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = fall;
    g.fillRect(0, 0, 64, 64);
  }
  const glow = new THREE.CanvasTexture(glowCanvas);
  const eyeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x7fe6ff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  eyeGlow.position.set(0.03, 0.19, 0.29);
  eyeGlow.scale.setScalar(0.3);
  head.add(eyeGlow);
  const beamMaterial = softBeam(new THREE.MeshBasicMaterial({ color: 0x7fe6ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
  const beam = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.3, 20, 1, true), beamMaterial);
  beam.rotation.x = -Math.PI / 2 - 0.3;
  beam.position.set(0.03, 0.0, 0.88);
  beam.visible = false;
  head.add(beam);

  // The holographic ring it stands on, which ties it to the ship's interface.
  const pad = new THREE.Mesh(new THREE.CircleGeometry(0.72, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glow, color: 0x4fc8ff, transparent: true, opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  pad.position.y = 0.004;
  root.add(pad);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.515, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8fe4ff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  ring.position.y = 0.006;
  root.add(ring);

  return { root, body, head, antennas, eye, sensor, eyeMaterial, sensorMaterial, ledMaterials, eyeGlow, beam, beamMaterial, pad, ring };
}
