import * as THREE from "three";

// The flight log, set into the centre of the dashboard where the training switch used to be:
// a green phosphor readout that sums up the visit at a glance, and opens the full log.

export type FlightLogLine = { planets: string; missions: string; credits: string };

export function createFlightLogConsole(pilot: THREE.Vector3) {
  const group = new THREE.Group();
  group.name = "cockpit-flight-log";
  group.position.set(-0.2, 1.16, 0.75);
  group.lookAt(pilot);
  const steel = new THREE.MeshStandardMaterial({ color: 0x3b464d, metalness: 0.72, roughness: 0.42 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x101417, metalness: 0.5, roughness: 0.5 });
  group.add(new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.21, 0.075), steel));
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.165, 0.02), dark);
  bezel.position.z = 0.045;
  group.add(bezel);
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 176;
  const c = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const screenMaterial = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.57, 0.157), screenMaterial);
  screen.position.z = 0.056;
  group.add(screen);
  const ledMaterial = new THREE.MeshBasicMaterial({ color: 0x5dff9a, toneMapped: false });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), ledMaterial);
  led.position.set(0.3, -0.083, 0.045);
  group.add(led);
  const draw = (line: FlightLogLine) => {
    c.fillStyle = "#04120b";
    c.fillRect(0, 0, 640, 176);
    c.strokeStyle = "rgba(120,255,170,.12)";
    for (let y = 0; y < 176; y += 5) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(640, y);
      c.stroke();
    }
    c.shadowColor = "rgba(110,255,160,.8)";
    c.shadowBlur = 12;
    c.fillStyle = "#b9ffd2";
    c.font = "bold 44px SFMono-Regular, Consolas, monospace";
    c.textAlign = "center";
    c.fillText("CARNET DE VOL", 320, 64);
    c.fillStyle = "#6fe39a";
    c.font = "22px SFMono-Regular, Consolas, monospace";
    c.fillText(`${line.planets} · ${line.missions} · ${line.credits}`, 320, 118);
    c.shadowBlur = 0;
    c.fillStyle = "rgba(111,227,154,.55)";
    c.font = "16px SFMono-Regular, Consolas, monospace";
    c.fillText("TOUCHER POUR OUVRIR LE JOURNAL DU PILOTE", 320, 154);
    texture.needsUpdate = true;
  };
  draw({ planets: "PLANÈTES —", missions: "MISSIONS —", credits: "— CR" });
  let hover = false;
  return {
    group,
    anchor: screen,
    update: draw,
    setHover: (value: boolean) => (hover = value),
    tick: (time: number, reduced: boolean, active: boolean) => {
      const glow = active ? 1.3 : hover ? 1.18 : reduced ? 1 : 0.94 + Math.sin(time * 1.1) * 0.04;
      screenMaterial.color.setScalar(glow);
      ledMaterial.color.setHex(reduced || Math.sin(time * 2.4) > -0.6 ? 0x5dff9a : 0x1d5a35);
    },
  };
}
