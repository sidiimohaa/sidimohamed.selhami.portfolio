import * as THREE from "three";
import { glowTexture, type Spot } from "./landingKit";
import { bakePart, part, pipe, rounded } from "./tatooineCharacters";
import { createTauntaun } from "./tauntaunModel";

/** The patrol animals wait in a small service pen on the right of Echo Base's mouth. */
export function createHothTauntauns(circles: Spot[]) {
  const group = new THREE.Group(); group.name = "hoth-tauntaun-pen";
  const metal = new THREE.MeshStandardMaterial({ color: 0x666e70, roughness: .72, metalness: .45 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x333d3e, roughness: .8, metalness: .25 });
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 160;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#303d40"; c.fillRect(0, 0, 512, 160);
  c.strokeStyle = "#929f9f"; c.lineWidth = 5; c.strokeRect(8, 8, 496, 144);
  c.fillStyle = "#c3d2d0"; c.font = "bold 43px Arial"; c.fillText("TAUNTAUNS", 28, 72);
  c.font = "23px monospace"; c.fillText("ECHO // PATROUILLE 02", 28, 119);
  const signMap = new THREE.CanvasTexture(canvas); signMap.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.MeshStandardMaterial({ map: signMap, roughness: .75 });
  const structure = new THREE.Group(); group.add(structure);
  // U-shaped rail, plus two short front sections: the centre entrance stays open.
  const sections = [
    [[11.5, 31.8], [20.1, 31.8]], [[20.1, 31.8], [20.1, 40.6]],
    [[20.1, 40.6], [11.5, 40.6]], [[11.5, 31.8], [11.5, 34.1]], [[11.5, 37.8], [11.5, 40.6]],
  ];
  for (const [[ax, az], [bx, bz]] of sections) {
    const length = Math.hypot(bx - ax, bz - az), count = Math.ceil(length / 1.5);
    for (let i = 0; i <= count; i++) {
      const t = i / count, x = THREE.MathUtils.lerp(ax, bx, t), z = THREE.MathUtils.lerp(az, bz, t);
      part(structure, new THREE.CylinderGeometry(.055, .075, 1.12, 8), metal, [x, .56, z]);
      part(structure, new THREE.CylinderGeometry(.095, .095, .045, 8), dark, [x, 1.13, z]);
      circles.push({ x, z, r: .39 });
    }
    for (const y of [.48, .96]) pipe(structure, [[ax, y, az], [bx, y, bz]], .034, metal);
  }
  // Low feed bin and a rolled weather cover stay inside the pen rather than the central taxiway.
  part(structure, rounded(.75, .42, 1.15, .08), metal, [18.9, .21, 39.3]);
  part(structure, rounded(.62, .035, .98, .04), dark, [18.9, .43, 39.3]);
  circles.push({ x: 18.9, z: 39.3, r: .66 });
  part(structure, rounded(.08, .33, .98, .02), metal, [11.5, .76, 32.8]);
  part(structure, new THREE.PlaneGeometry(.92, .28), sign, [11.45, .76, 32.8], [0, -Math.PI / 2, 0]);
  bakePart(structure);

  const glow = glowTexture();
  const animals = [[14.5, 34.5, -2.2, 1], [17.8, 37.6, -2.05, .93]].map(([x, z, yaw, scale], index) => {
    const model = createTauntaun(index);
    model.root.position.set(x, 0, z); model.root.rotation.y = yaw; model.root.scale.setScalar(scale);
    group.add(model.root);
    circles.push({ x, z, r: .93 * scale });
    // Its tail follows behind the body, low enough to be a physical obstacle.
    circles.push({ x: x - Math.sin(yaw) * 1.6 * scale, z: z - Math.cos(yaw) * 1.6 * scale, r: .35 });
    const breath = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xf2f8ff, transparent: true, depthWrite: false, opacity: 0 }));
    model.root.getObjectByName("tauntaun-head")!.add(breath);
    return { ...model, breath, index };
  });
  let clock = 0;
  return { group, tick: (dt: number, reduced: boolean) => {
    if (!reduced) clock += dt;
    animals.forEach(animal => {
      animal.tick(clock, reduced);
      const p = (clock / 4.1 + animal.index * .43) % 1;
      animal.breath.visible = !reduced;
      animal.breath.position.set(.03 + p * .09, -.09 - p * .1, .53 + p * .75);
      animal.breath.scale.setScalar(.08 + p * .4);
      animal.breath.material.opacity = reduced ? 0 : Math.sin(p * Math.PI) ** 2 * .25;
    });
  } };
}
