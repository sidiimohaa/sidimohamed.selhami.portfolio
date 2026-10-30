import * as THREE from "three";

/** A physical, pilot-facing training switch on the existing centre console. */
export function createDefenseConsole() {
  const group = new THREE.Group(); group.name = "cockpit-defense-of-hoth-switch";
  group.position.set(-.2, 1.16, .75);
  group.lookAt(0, 1.55, 2.9);
  const steel = new THREE.MeshStandardMaterial({ color: 0x3b464d, metalness: .72, roughness: .42 });
  const cap = new THREE.MeshStandardMaterial({ color: 0x311b20, emissive: 0xc83b47, emissiveIntensity: .35, metalness: .3, roughness: .4 });
  group.add(new THREE.Mesh(new THREE.BoxGeometry(.65, .2, .075), steel));
  const button = new THREE.Mesh(new THREE.BoxGeometry(.59, .15, .035), cap);
  button.position.z = .05; group.add(button);
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 128;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#f9e5dc"; c.font = "bold 35px monospace"; c.textAlign = "center";
  c.fillText("DEFENSE OF HOTH", 256, 54);
  c.fillStyle = "#f29a91"; c.font = "20px monospace"; c.fillText("SIMULATEUR · BASE ECHO", 256, 91);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(.56, .14), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
  label.position.z = .071; group.add(label);
  return { group, anchor: label, tick: (time: number, reduced: boolean, active: boolean) => {
    cap.emissiveIntensity = active ? .8 : reduced ? .35 : .34 + Math.sin(time * 1.2) * .06;
  } };
}
