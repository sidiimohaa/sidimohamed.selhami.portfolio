import * as THREE from "three";

// Two physical controls. On the dashboard, the "Journal de missions" module: a lit push button with
// a status lamp. Hanging from the cockpit ceiling, a switch under a red safety cover that should not
// be lifted. Each faces the pilot; HTML buttons are laid over them for input.

const label = (lines: string[], color: string, width = 256, height = 64) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const c = canvas.getContext("2d")!;
  c.fillStyle = color;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = `bold ${Math.round(height / (lines.length + 1.4))}px SFMono-Regular, Consolas, monospace`;
  lines.forEach((line, i) => c.fillText(line, width / 2, (height / (lines.length + 1)) * (i + 1)));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

export function createMissionConsole(pilot: THREE.Vector3) {
  const group = new THREE.Group();
  group.name = "cockpit-mission-console";
  const graphite = new THREE.MeshStandardMaterial({ color: 0x1d252b, roughness: 0.55, metalness: 0.6 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8e9ba0, roughness: 0.3, metalness: 0.9 });

  // --- Journal de missions ---
  const journal = new THREE.Group();
  journal.position.set(0.8, 1.02, -1.58);
  group.add(journal);
  journal.lookAt(pilot);
  journal.scale.setScalar(1.5);
  journal.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.17, 0.09), graphite));
  const bezel = new THREE.MeshStandardMaterial({ color: 0x0d2232, emissive: 0x2f8fd8, emissiveIntensity: 0.9, roughness: 0.4 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.075, 0.012), bezel);
  frame.position.set(-0.04, -0.02, 0.048);
  journal.add(frame);
  const capMaterial = new THREE.MeshStandardMaterial({ color: 0x15344a, emissive: 0x4aaaf4, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.2 });
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.225, 0.055, 0.03), capMaterial);
  cap.position.set(-0.04, -0.02, 0.062);
  journal.add(cap);
  const text = new THREE.Mesh(
    new THREE.PlaneGeometry(0.21, 0.05),
    new THREE.MeshBasicMaterial({ map: label(["JOURNAL", "DE MISSIONS"], "#dff2ff"), transparent: true, depthWrite: false }),
  );
  text.position.set(-0.04, -0.02, 0.0775);
  journal.add(text);
  const caption = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.03),
    new THREE.MeshBasicMaterial({ map: label(["ARCHIVES · ORDRE JEDI"], "#7fb6d6", 256, 32), transparent: true, depthWrite: false }),
  );
  caption.position.set(-0.01, 0.055, 0.046);
  journal.add(caption);
  // The lamp lights up when a mission has been completed since the last look at the journal.
  const lampMaterial = new THREE.MeshStandardMaterial({ color: 0x0c1a24, emissive: 0x78c6ff, emissiveIntensity: 0, roughness: 0.2 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.017, 12, 8), lampMaterial);
  lamp.position.set(0.14, -0.02, 0.05);
  journal.add(lamp);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 6, 16), steel);
  ring.position.set(0.14, -0.02, 0.047);
  journal.add(ring);
  const glow = new THREE.PointLight(0x4aaaf4, 0.4, 1.4, 2);
  glow.position.set(-0.04, 0, 0.2);
  journal.add(glow);

  // --- The covered switch ---
  const guard = new THREE.Group();
  guard.position.set(-0.86, 2.84, -0.86);
  group.add(guard);
  guard.lookAt(pilot);
  guard.scale.setScalar(1.5);
  // Its bracket, up to the overhead bay.
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.05), graphite);
  bracket.position.set(0, 0.145, -0.02);
  guard.add(bracket);
  guard.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.17, 0.09), graphite));
  const hazard = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.03),
    new THREE.MeshBasicMaterial({ map: label(["NE PAS SOULEVER"], "#e0b25a", 256, 40), transparent: true, depthWrite: false }),
  );
  hazard.position.set(0, 0.062, 0.046);
  guard.add(hazard);
  const toggle = new THREE.Group();
  toggle.position.set(0, -0.02, 0.05);
  guard.add(toggle);
  toggle.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 10).rotateX(Math.PI / 2).translate(0, 0, 0.02), steel));
  const tipMaterial = new THREE.MeshStandardMaterial({ color: 0x3a1214, emissive: 0xd93645, emissiveIntensity: 0.2 });
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), tipMaterial);
  tip.position.z = 0.047;
  toggle.add(tip);
  // The red cover is hinged along its top edge.
  const hinge = new THREE.Group();
  hinge.position.set(0, 0.03, 0.05);
  guard.add(hinge);
  const coverMaterial = new THREE.MeshStandardMaterial({ color: 0xa3222c, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.88 });
  const cover = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.06), coverMaterial);
  cover.position.set(0, -0.05, 0.03);
  hinge.add(cover);
  const danger = new THREE.PointLight(0xd93645, 0, 1.2, 2);
  danger.position.set(0, 0, 0.2);
  guard.add(danger);

  const state = { hover: false, press: -1, alert: false, open: false, coverOpen: false, sith: false };
  return {
    group,
    journalAnchor: journal,
    guardAnchor: guard,
    setHover: (hover: boolean) => (state.hover = hover),
    press: () => (state.press = 0),
    setAlert: (alert: boolean) => (state.alert = alert),
    setOpen: (open: boolean) => (state.open = open),
    setCover: (open: boolean) => (state.coverOpen = open),
    setSith: (sith: boolean) => (state.sith = sith),
    tick: (dt: number, time: number, reduced: boolean) => {
      // The cap sinks for a moment when pressed, like a real mechanical key.
      let depth = 0;
      if (state.press >= 0) {
        state.press += dt;
        depth = Math.sin(Math.min(1, state.press / 0.22) * Math.PI) * 0.016;
        if (state.press > 0.22) state.press = -1;
      }
      cap.position.z = 0.062 - depth;
      text.position.z = 0.0775 - depth;
      const target = state.open ? 2.2 : state.hover ? 1.5 : 0.35 + (reduced ? 0 : Math.sin(time * 1.6) * 0.08);
      capMaterial.emissiveIntensity += (target - capMaterial.emissiveIntensity) * Math.min(1, dt * 8);
      bezel.emissiveIntensity = 0.7 + capMaterial.emissiveIntensity * 0.4;
      glow.intensity = 0.25 + capMaterial.emissiveIntensity * 0.6;
      lampMaterial.emissiveIntensity = state.alert ? (reduced ? 2 : 1.2 + Math.max(0, Math.sin(time * 5)) * 2) : 0;
      // The cover swings up on its hinge; the switch flips down for the dark side.
      const lift = state.coverOpen ? -1.9 : 0;
      hinge.rotation.x += (lift - hinge.rotation.x) * Math.min(1, dt * (reduced ? 60 : 7));
      const flip = state.sith ? -0.55 : 0.55;
      toggle.rotation.x += (flip - toggle.rotation.x) * Math.min(1, dt * (reduced ? 60 : 12));
      tipMaterial.emissiveIntensity = state.sith ? 2.2 : 0.2;
      danger.intensity = state.sith ? 0.9 : state.coverOpen ? 0.3 : 0;
    },
  };
}
