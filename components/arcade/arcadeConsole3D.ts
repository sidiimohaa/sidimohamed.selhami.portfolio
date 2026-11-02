import * as THREE from "three";

// The Galactic Arcade console, set into the dashboard beside the Defense of Hoth panel: a metal
// housing, a screen with the arcade's name and a controller glyph, a row of LEDs that chase
// slowly while idle and light one by one when the console boots, and three lit push buttons.

function screenTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 192;
  const c = canvas.getContext("2d")!;
  const bg = c.createLinearGradient(0, 0, 0, 192);
  bg.addColorStop(0, "#071a2a");
  bg.addColorStop(1, "#0b2c44");
  c.fillStyle = bg;
  c.fillRect(0, 0, 512, 192);
  c.strokeStyle = "rgba(120,198,255,.12)";
  for (let y = 0; y < 192; y += 6) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(512, y);
    c.stroke();
  }
  c.strokeStyle = "rgba(120,198,255,.7)";
  c.lineWidth = 3;
  c.strokeRect(8, 8, 496, 176);
  // Controller glyph.
  c.save();
  c.translate(78, 96);
  c.strokeStyle = "#9fdcff";
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(-44, -14);
  c.quadraticCurveTo(-52, 30, -32, 30);
  c.quadraticCurveTo(-20, 30, -12, 14);
  c.lineTo(12, 14);
  c.quadraticCurveTo(20, 30, 32, 30);
  c.quadraticCurveTo(52, 30, 44, -14);
  c.quadraticCurveTo(40, -26, 24, -26);
  c.lineTo(-24, -26);
  c.quadraticCurveTo(-40, -26, -44, -14);
  c.stroke();
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(-28, -8);
  c.lineTo(-28, 6);
  c.moveTo(-35, -1);
  c.lineTo(-21, -1);
  c.stroke();
  c.fillStyle = "#9fdcff";
  for (const [x, y] of [[24, -6], [32, 2]]) {
    c.beginPath();
    c.arc(x, y, 4, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
  c.fillStyle = "#e4f5ff";
  c.font = "bold 40px SFMono-Regular, Consolas, monospace";
  c.textBaseline = "middle";
  c.fillText("GALACTIC", 150, 74);
  c.fillText("ARCADE", 150, 120);
  c.fillStyle = "#78c6ff";
  c.font = "16px SFMono-Regular, Consolas, monospace";
  c.fillText("CENTRE DE SIMULATION", 152, 160);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createArcadeConsole(pilot: THREE.Vector3) {
  const group = new THREE.Group();
  group.name = "cockpit-galactic-arcade";
  // To the right of the mission journal module, clear of it from the pilot's seat.
  group.position.set(0.86, 1.2, 0.74);
  group.lookAt(pilot);
  group.scale.setScalar(0.8);
  const metal = new THREE.MeshStandardMaterial({ color: 0x8e9ba2, roughness: 0.3, metalness: 0.9 });
  const graphite = new THREE.MeshStandardMaterial({ color: 0x1b242a, roughness: 0.5, metalness: 0.6 });
  group.add(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.24, 0.07), graphite));
  // A bright metal bezel round the screen.
  for (const [w, h, x, y] of [
    [0.44, 0.012, 0, 0.088],
    [0.44, 0.012, 0, -0.068],
    [0.012, 0.168, -0.214, 0.01],
    [0.012, 0.168, 0.214, 0.01],
  ]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), metal);
    bar.position.set(x, y, 0.04);
    group.add(bar);
  }
  const screenMaterial = new THREE.MeshBasicMaterial({ map: screenTexture(), toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.155), screenMaterial);
  screen.position.set(0, 0.01, 0.0365);
  group.add(screen);
  // A thin bright scan bar sweeping down the screen.
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.012), new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.18, depthWrite: false, toneMapped: false }));
  scan.position.z = 0.037;
  group.add(scan);
  const leds = Array.from({ length: 7 }, (_, i) => {
    const material = new THREE.MeshBasicMaterial({ color: 0x163447, toneMapped: false });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), material);
    led.position.set(-0.18 + i * 0.06, -0.095, 0.037);
    group.add(led);
    return material;
  });
  const buttons = [0xd93645, 0xffb347, 0x4cd17a].map((color, i) => {
    const material = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: color, emissiveIntensity: 0.35, roughness: 0.4 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.014, 14).rotateX(Math.PI / 2), material);
    cap.position.set(0.237, 0.07 - i * 0.045, 0.04);
    group.add(cap);
    return material;
  });
  const glow = new THREE.PointLight(0x78c6ff, 0.3, 1.2, 2);
  glow.position.set(0, 0, 0.25);
  group.add(glow);

  const state = { hover: false, active: false, since: 0, press: -1, accent: new THREE.Color(0x78c6ff) };
  const on = new THREE.Color(),
    off = new THREE.Color(0x163447);
  return {
    group,
    anchor: screen,
    setHover: (hover: boolean) => (state.hover = hover),
    setActive: (active: boolean, time: number) => {
      if (active !== state.active) state.since = time;
      state.active = active;
    },
    setAccent: (hex: string) => state.accent.set(hex),
    press: () => (state.press = 0),
    tick: (dt: number, time: number, reduced: boolean) => {
      // The face pushes in a few millimetres when pressed.
      if (state.press >= 0) {
        state.press += dt;
        group.scale.z = 0.8 * (1 - Math.sin(Math.min(1, state.press / 0.2) * Math.PI) * 0.25);
        if (state.press > 0.2) state.press = -1;
      }
      const boot = state.active ? Math.min(1, (time - state.since) / 1.2) : 0;
      leds.forEach((material, i) => {
        const idle = reduced ? 0.25 : Math.max(0, Math.cos((time * 1.6 - i * 0.55) % (Math.PI * 2))) ** 6;
        const lit = state.active ? (boot * leds.length > i ? 1 : 0) : idle * 0.8;
        on.copy(state.accent);
        material.color.copy(off).lerp(on, lit);
      });
      buttons.forEach((material, i) => (material.emissiveIntensity = state.active ? 1.4 : reduced ? 0.35 : 0.3 + Math.max(0, Math.sin(time * 1.3 + i * 2)) * 0.25));
      const bright = state.active ? 1.25 : state.hover ? 1.15 : 0.82 + (reduced ? 0 : Math.sin(time * 0.9) * 0.05);
      screenMaterial.color.setScalar(bright);
      scan.position.y = reduced ? -0.2 : 0.085 - ((time * 0.12) % 1) * 0.16;
      scan.visible = !reduced;
      glow.color.copy(state.accent);
      glow.intensity = state.active ? 1.4 : state.hover ? 0.9 : 0.3;
    },
  };
}
