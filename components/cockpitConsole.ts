import * as THREE from "three";

// The dashboard's instrument plate, built as a real console in relief: grids of backlit square
// keys, four throttle levers in their slots, a small green readout, round lamps, knobs and toggle
// switches. It sits on the angled plate of cockpitModel (same centre, same tilt) and lives a little:
// keys pulse at their own pace, the readout ticks over, and the red alert sets everything flashing.

// The plate of cockpitModel: centre, tilt, and its size in its own plane.
const PLATE = { x: 0, y: 0.455, z: -1.325, tilt: -0.6, w: 3.36, h: 0.72 };

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The painted plate under the controls: grey panels, orange pinstripes, lever slots, labels. */
function plateTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = Math.round((2048 * PLATE.h) / PLATE.w);
  const g = canvas.getContext("2d")!;
  const W = canvas.width,
    H = canvas.height;
  const px = (x: number) => ((x + PLATE.w / 2) / PLATE.w) * W;
  const py = (y: number) => (1 - (y + PLATE.h / 2) / PLATE.h) * H;
  g.fillStyle = "#1a1f23";
  g.fillRect(0, 0, W, H);
  // Panels: slightly different greys, outlined in orange like the reference consoles.
  const panels: [number, number, string][] = [
    [-1.64, -0.96, "#2a3035"],
    [-0.92, -0.5, "#23292d"],
    [-0.46, 0.46, "#2c3237"],
    [0.5, 0.94, "#23292d"],
    [0.98, 1.64, "#2a3035"],
  ];
  for (const [from, to, color] of panels) {
    g.fillStyle = color;
    g.fillRect(px(from), py(0.33), px(to) - px(from), py(-0.33) - py(0.33));
    g.strokeStyle = "#b8562c";
    g.lineWidth = 3;
    g.strokeRect(px(from) + 6, py(0.33) + 6, px(to) - px(from) - 12, py(-0.33) - py(0.33) - 12);
    // Panel screws.
    g.fillStyle = "#565d61";
    for (const [sx, sy] of [[from + 0.03, 0.3], [to - 0.03, 0.3], [from + 0.03, -0.3], [to - 0.03, -0.3]]) {
      g.beginPath();
      g.arc(px(sx), py(sy), 5, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Lever slots in the centre panel.
  g.fillStyle = "#07090b";
  for (const x of LEVERS) g.fillRect(px(x) - 9, py(0.24), 18, py(-0.24) - py(0.24));
  g.strokeStyle = "#4a5156";
  g.lineWidth = 2;
  for (const x of LEVERS) for (let k = -4; k <= 4; k++) {
    g.beginPath();
    g.moveTo(px(x) - 26, py(k * 0.05));
    g.lineTo(px(x) - 14, py(k * 0.05));
    g.stroke();
  }
  // Small stencilled labels.
  g.fillStyle = "#8d9498";
  g.font = "600 20px ui-monospace, Menlo, monospace";
  g.textAlign = "center";
  const labels: [number, string][] = [[-1.3, "DÉFLECTEURS"], [-0.71, "ASTRONAV"], [0, "PROPULSION SUBLUMINIQUE"], [0.72, "HYPERDRIVE"], [1.31, "SYSTÈMES"]];
  for (const [x, text] of labels) g.fillText(text, px(x), py(-0.29));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** The little green readout, redrawn now and then. */
function readoutTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 192;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const g = canvas.getContext("2d")!;
  const draw = (percent: number, value: number, alert: boolean) => {
    g.fillStyle = "#03110a";
    g.fillRect(0, 0, 256, 192);
    const ink = alert ? "#ff5a42" : "#7dffb0";
    g.fillStyle = ink;
    g.strokeStyle = ink;
    g.font = "600 30px ui-monospace, Menlo, monospace";
    g.fillText(`${percent} %`, 26, 52);
    for (let i = 0; i < 6; i++) {
      g.globalAlpha = i < Math.round(percent / 17) ? 1 : 0.2;
      g.fillRect(132 + i * 18, 30, 12, 26);
    }
    g.globalAlpha = 1;
    g.lineWidth = 3;
    g.strokeRect(22, 82, 212, 52);
    g.font = "600 34px ui-monospace, Menlo, monospace";
    g.fillText(`+${String(value).padStart(5, "0")}`, 46, 122);
    g.font = "500 18px ui-monospace, Menlo, monospace";
    g.globalAlpha = 0.7;
    g.fillText(alert ? "ALERTE" : "NAV · OK", 26, 172);
    g.globalAlpha = 1;
    texture.needsUpdate = true;
  };
  return { texture, draw };
}

const LEVERS = [-0.3, -0.1, 0.1, 0.3];

type Key = { x: number; y: number; color: THREE.Color; phase: number; rate: number; steady: boolean };

export function createCockpitConsole() {
  const group = new THREE.Group();
  group.name = "cockpit-console";
  group.position.set(PLATE.x, PLATE.y, PLATE.z);
  group.rotation.x = PLATE.tilt;
  const rand = seeded(2187);

  // The painted plate, just above cockpitModel's own, which it covers.
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(PLATE.w, PLATE.h),
    new THREE.MeshStandardMaterial({ map: plateTexture(), roughness: 0.8, metalness: 0.35 }),
  );
  plate.position.z = 0.004;
  group.add(plate);

  const dark = new THREE.MeshStandardMaterial({ color: 0x101417, roughness: 0.7, metalness: 0.4 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa3a8, roughness: 0.35, metalness: 0.9 });

  // Backlit square keys: blue, white and the odd orange, in grids on the outer panels.
  const blue = new THREE.Color(0x3d8bff),
    white = new THREE.Color(0xdfe9f2),
    orange = new THREE.Color(0xff7a2e);
  const keys: Key[] = [];
  const grid = (x0: number, y0: number, columns: number, rows: number, step: number) => {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < columns; c++) {
        if (rand() < 0.14) continue;
        const pick = rand();
        keys.push({
          x: x0 + c * step,
          y: y0 - r * step * 0.82,
          color: (pick < 0.5 ? blue : pick < 0.88 ? white : orange).clone(),
          phase: rand() * Math.PI * 2,
          rate: 0.3 + rand() * 1.4,
          steady: rand() < 0.55,
        });
      }
  };
  grid(-1.55, 0.22, 7, 4, 0.085);
  grid(1.06, 0.22, 7, 4, 0.085);
  grid(0.56, 0.24, 2, 3, 0.085);
  const keyMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.062, 0.048, 0.016),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    keys.length,
  );
  const bezelMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.074, 0.06, 0.01), dark, keys.length);
  const matrix = new THREE.Matrix4(),
    tint = new THREE.Color();
  keys.forEach((key, i) => {
    bezelMesh.setMatrixAt(i, matrix.makeTranslation(key.x, key.y, 0.009));
    keyMesh.setMatrixAt(i, matrix.makeTranslation(key.x, key.y, 0.018));
    keyMesh.setColorAt(i, key.color);
  });
  group.add(bezelMesh, keyMesh);

  // Round lamps: two big orange ones on the hyperdrive panel, small ones scattered.
  const lamps: { mesh: THREE.Mesh; color: THREE.Color; phase: number }[] = [];
  const lamp = (x: number, y: number, radius: number, color: number) => {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.25, radius * 1.3, 0.014, 24), dark);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, y, 0.011);
    const material = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), material);
    cap.rotation.x = Math.PI / 2;
    cap.scale.y = 0.45;
    cap.position.set(x, y, 0.017);
    group.add(ring, cap);
    lamps.push({ mesh: cap, color: new THREE.Color(color), phase: rand() * Math.PI * 2 });
  };
  lamp(0.78, 0.17, 0.045, 0xff6a2a);
  lamp(0.78, 0.02, 0.045, 0xff6a2a);
  lamp(-0.4, 0.27, 0.02, 0x4ab8ff);
  lamp(0.4, 0.27, 0.02, 0xff3b2a);
  lamp(-1.6, -0.2, 0.018, 0xff3b2a);
  lamp(1.6, -0.2, 0.018, 0x4ab8ff);

  // Four throttle levers in their slots, each at its own setting.
  const levers: { pivot: THREE.Group; base: number; phase: number }[] = [];
  const grip = new THREE.MeshStandardMaterial({ color: 0x2b3034, roughness: 0.6, metalness: 0.5 });
  const band = new THREE.MeshBasicMaterial({ color: 0xff7a2e, toneMapped: false });
  for (const x of LEVERS) {
    const pivot = new THREE.Group();
    const base = -0.14 + rand() * 0.28;
    pivot.position.set(x, base, 0.01);
    const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.02), metal);
    carriage.position.z = 0.01;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, 0.16, 10), metal);
    shaft.rotation.x = Math.PI / 2 - 0.35;
    shaft.position.set(0, 0.025, 0.085);
    const knob = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.05, 4, 10), grip);
    knob.rotation.x = Math.PI / 2 - 0.35;
    knob.position.set(0, 0.052, 0.165);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.0175, 0.0175, 0.008, 12), band);
    ring.rotation.x = Math.PI / 2 - 0.35;
    ring.position.set(0, 0.06, 0.188);
    pivot.add(carriage, shaft, knob, ring);
    group.add(pivot);
    levers.push({ pivot, base, phase: rand() * Math.PI * 2 });
  }

  // The little green readout in its tilted hood, on the astronav panel.
  const readout = readoutTexture();
  const hood = new THREE.Group();
  hood.position.set(-0.71, 0.05, 0.02);
  hood.rotation.x = 0.35;
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.06), dark);
  shell.position.z = 0.03;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.18), new THREE.MeshBasicMaterial({ map: readout.texture, toneMapped: false }));
  glass.position.z = 0.061;
  hood.add(shell, glass);
  group.add(hood);
  readout.draw(31, 7165, false);

  // Knobs and toggle switches.
  for (const [x, y] of [[-0.86, -0.2], [-0.56, -0.2], [0.6, -0.2], [0.68, -0.2]] as const) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.03, 16), metal);
    knob.rotation.x = Math.PI / 2;
    knob.position.set(x, y, 0.02);
    group.add(knob);
  }
  for (let i = 0; i < 4; i++) {
    const toggle = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.05, 0.014), metal);
    toggle.position.set(0.79 + i * 0.035, -0.2, 0.03);
    toggle.rotation.x = i % 2 ? 0.5 : -0.5;
    group.add(toggle);
  }

  let readoutAt = -1,
    wasAlert = false;
  return {
    group,
    /** Keys pulse, levers drift a hair, the readout ticks over; the red alert flashes it all. */
    tick(age: number, alert: number, reduced: boolean) {
      const t = reduced ? 0 : age;
      const flash = alert > 0 && (reduced || Math.sin(age * 14) > 0);
      keys.forEach((key, i) => {
        const level = key.steady ? 0.9 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * key.rate + key.phase));
        tint.copy(key.color).multiplyScalar(level);
        if (alert > 0) tint.setRGB(flash ? 1.4 : 0.25, 0.08, 0.05);
        keyMesh.setColorAt(i, tint);
      });
      if (keyMesh.instanceColor) keyMesh.instanceColor.needsUpdate = true;
      for (const { mesh, color, phase } of lamps) {
        const material = mesh.material as THREE.MeshBasicMaterial;
        if (alert > 0) material.color.setRGB(flash ? 1.5 : 0.3, 0.1, 0.06);
        else material.color.copy(color).multiplyScalar(0.75 + 0.25 * Math.sin(t * 1.3 + phase));
      }
      for (const lever of levers) lever.pivot.position.y = lever.base + Math.sin(t * 0.25 + lever.phase) * 0.012;
      const isAlert = alert > 0;
      if (isAlert !== wasAlert || age - readoutAt > 1.6) {
        readoutAt = age;
        wasAlert = isAlert;
        readout.draw(isAlert ? 99 : 28 + Math.round(6 * (0.5 + 0.5 * Math.sin(age * 0.3))), 7165 + Math.floor(age * 3) % 900, isAlert);
      }
    },
  };
}
