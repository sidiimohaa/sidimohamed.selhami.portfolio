import * as THREE from "three";
import { certifications, type Certification } from "../deathStar/cvData";

// The vault of holocrons, in the middle of the Council chamber: the pilot's Google certifications on
// artificial intelligence. At rest, one blue holocron (Google AI Essentials) floats over a seal in the
// mosaic, with a smaller crystal (AI Fundamentals) beside it. Chosen, a pedestal rises from the floor,
// the holocron opens like a flower and lets out its five modules, which settle into a slowly turning
// wheel round it, facing the door, each projecting its name; the crystal climbs above the wheel and a
// shaft of light reaches the dome.

const BLUE = 0x7fd0ff;
const GOLD = 0xffdc9a;
const REST_Y = 1.1;
const OPEN_Y = 1.5;
const ORBIT = 1.2;
const CROWN = OPEN_Y + ORBIT + 0.62;
const PEDESTAL = 0.95;

const smooth = (k: number, from: number, to: number) => THREE.MathUtils.smoothstep(k, from, to);
const additive = (color: number, opacity: number) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });

function faceTexture(line: string, rim: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#06223a";
  c.fillRect(0, 0, 128, 128);
  c.strokeStyle = line;
  c.lineWidth = 3;
  c.strokeRect(20, 20, 88, 88);
  c.beginPath();
  c.arc(64, 64, 22, 0, Math.PI * 2);
  c.moveTo(64, 20);
  c.lineTo(64, 42);
  c.moveTo(64, 86);
  c.lineTo(64, 108);
  c.moveTo(20, 64);
  c.lineTo(42, 64);
  c.moveTo(86, 64);
  c.lineTo(108, 64);
  c.stroke();
  c.strokeStyle = rim;
  c.lineWidth = 9;
  c.strokeRect(4, 4, 120, 120);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

// A floating caption: the certification's name, and who issued it and when.
function caption(item: Certification, color: string, wide = false) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 150;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "rgba(6,30,52,.62)";
  c.fillRect(0, 0, 640, 150);
  c.strokeStyle = color;
  c.lineWidth = 3;
  c.strokeRect(3, 3, 634, 144);
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = "#eef9ff";
  let size = 44;
  const name = item.name.toUpperCase();
  c.font = `700 ${size}px Arial, Helvetica, sans-serif`;
  while (c.measureText(name).width > 600 && size > 18) c.font = `700 ${--size}px Arial, Helvetica, sans-serif`;
  c.fillText(name, 320, 58);
  c.fillStyle = color;
  c.font = "28px SFMono-Regular, Menlo, Consolas, monospace";
  const modules = certifications.filter((other) => other.program === item.id).length;
  c.fillText([item.issuer, item.date, modules ? `${modules} modules` : ""].filter(Boolean).join(" · ").toUpperCase(), 320, 112);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  sprite.scale.set(wide ? 1.15 : 0.95, wide ? 0.27 : 0.22, 1);
  sprite.renderOrder = 3;
  return sprite;
}

export function createCertVault(glow: THREE.Texture) {
  const group = new THREE.Group();
  group.name = "certification-vault";
  const owned: { dispose: () => void }[] = [];
  const master = certifications.find((item) => item.id === "essentials")!;
  const modules = certifications.filter((item) => item.program === master.id);
  const crystalItem = certifications.find((item) => !item.program && item.id !== master.id);

  // The seal in the mosaic: two rings and eight rays, brighter as the vault opens.
  const sealMaterial = additive(BLUE, 0.22);
  const seal = new THREE.Group();
  seal.add(new THREE.Mesh(new THREE.RingGeometry(0.62, 0.66, 64), sealMaterial), new THREE.Mesh(new THREE.RingGeometry(0.9, 0.92, 64), sealMaterial));
  for (let i = 0; i < 8; i++) {
    const ray = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.24), sealMaterial);
    const a = (i / 8) * Math.PI * 2;
    ray.position.set(Math.sin(a) * 0.78, Math.cos(a) * 0.78, 0);
    ray.rotation.z = -a;
    seal.add(ray);
  }
  seal.rotation.x = -Math.PI / 2;
  seal.position.y = 0.03;
  group.add(seal);

  // The pedestal waits under the floor.
  const stone = new THREE.MeshStandardMaterial({ color: 0xd9cbb2, roughness: 0.55 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0xb08546, roughness: 0.32, metalness: 0.85 });
  const pedestal = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, PEDESTAL - 0.12, 28), stone);
  shaft.position.y = (PEDESTAL - 0.12) / 2;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.48, 0.1, 32), bronze);
  foot.position.y = 0.05;
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.22, 0.12, 32), bronze);
  cup.position.y = PEDESTAL - 0.06;
  const emitter = new THREE.Mesh(new THREE.CircleGeometry(0.3, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: BLUE, toneMapped: false }));
  emitter.position.y = PEDESTAL + 0.002;
  pedestal.add(shaft, foot, cup, emitter);
  pedestal.position.y = -PEDESTAL - 0.05;
  group.add(pedestal);

  // The master holocron: four sides hinged at their lower edges, a floor and a lid, round a core of light.
  const S = 0.17;
  const faceMap = faceTexture("#9fe0ff", "#c99a58");
  const faceMaterial = new THREE.MeshStandardMaterial({ map: faceMap, emissive: 0x4ab4ff, emissiveMap: faceMap, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.5, side: THREE.DoubleSide });
  const holocron = new THREE.Group();
  holocron.position.y = REST_Y;
  group.add(holocron);
  const cube = new THREE.Group();
  holocron.add(cube);
  const hinges = [0, 1, 2, 3].map((quarter) => {
    const side = new THREE.Group();
    side.rotation.y = (quarter * Math.PI) / 2;
    cube.add(side);
    const hinge = new THREE.Group();
    hinge.position.set(0, -S, S);
    side.add(hinge);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(S * 2, S * 2), faceMaterial);
    face.position.y = S;
    hinge.add(face);
    return hinge;
  });
  const bottom = new THREE.Mesh(new THREE.PlaneGeometry(S * 2, S * 2), faceMaterial);
  bottom.rotation.x = Math.PI / 2;
  bottom.position.y = -S;
  const lid = new THREE.Mesh(new THREE.PlaneGeometry(S * 2, S * 2), faceMaterial);
  lid.rotation.x = -Math.PI / 2;
  lid.position.y = S;
  cube.add(bottom, lid);
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xbfeaff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  core.scale.setScalar(0.5);
  holocron.add(core);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: BLUE, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  halo.scale.setScalar(1.1);
  holocron.add(halo);
  const masterCaption = caption(master, "#8ed8ff", true);
  masterCaption.position.y = -0.42;
  holocron.add(masterCaption);

  // The five modules: small holocrons kept inside the master until it opens.
  const smallGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.15);
  const smallEdges = new THREE.EdgesGeometry(smallGeometry);
  const moduleMaterial = new THREE.MeshStandardMaterial({ map: faceMap, emissive: 0x3aa6ff, emissiveMap: faceMap, emissiveIntensity: 1.1, roughness: 0.35, metalness: 0.5 });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xd7f1ff, transparent: true, opacity: 0.8, toneMapped: false });
  const beamMaterial = new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const tethers = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(modules.length * 6), 3)), beamMaterial);
  tethers.frustumCulled = false;
  group.add(tethers);
  const satellites = modules.map((item, index) => {
    const holder = new THREE.Group();
    const box = new THREE.Mesh(smallGeometry, moduleMaterial);
    box.add(new THREE.LineSegments(smallEdges, edgeMaterial));
    const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: BLUE, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    spark.scale.setScalar(0.55);
    const label = caption(item, "#8ed8ff");
    label.position.y = 0.25;
    holder.add(box, spark, label);
    holder.visible = false;
    group.add(holder);
    return { holder, box, spark, label, phase: index };
  });

  // The crystal: AI Fundamentals, a pale gold octahedron that rises above the ring.
  const crystal = new THREE.Group();
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), new THREE.MeshStandardMaterial({ color: GOLD, emissive: 0xffb24a, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.92 }));
  gem.scale.y = 1.45;
  const gemGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffc77a, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  gemGlow.scale.setScalar(0.7);
  crystal.add(gem, gemGlow);
  const crystalCaption = crystalItem ? caption(crystalItem, "#ffd28a") : null;
  if (crystalCaption) {
    crystalCaption.position.y = 0.36;
    crystal.add(crystalCaption);
  }
  if (crystalItem) group.add(crystal);

  // A shaft of light up to the dome, and the light it sheds.
  const shaftOfLight = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.32, 8.2, 24, 1, true), additive(BLUE, 0));
  shaftOfLight.position.y = PEDESTAL + 4.1;
  group.add(shaftOfLight);
  const light = new THREE.PointLight(0x8fd2ff, 0, 9, 1.6);
  light.position.y = 1.6;
  group.add(light);

  // Easy to click or tap, open or closed.
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.6, 12), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 1.3;
  hit.userData.topic = "certifs";
  group.add(hit);

  owned.push(sealMaterial, stone, bronze, faceMap, faceMaterial, moduleMaterial, edgeMaterial, beamMaterial, smallGeometry, smallEdges);

  let target = 0,
    k = 0;
  const point = new THREE.Vector3();
  return {
    group,
    hit,
    // Where the eyes rest on it, in the chamber's frame.
    centre: new THREE.Vector3(0, OPEN_Y + 0.4, 0),
    setOpen: (on: boolean) => (target = on ? 1 : 0),
    tick(dt: number, elapsed: number, reduced: boolean, presence: number) {
      // About three seconds to open, a little less to close.
      k = reduced ? target : THREE.MathUtils.clamp(k + (target > k ? dt / 3 : -dt / 2.2), 0, 1);
      const rise = smooth(k, 0, 0.32),
        lift = smooth(k, 0.22, 0.5),
        bloom = smooth(k, 0.42, 0.66),
        release = smooth(k, 0.55, 0.88),
        words = smooth(k, 0.8, 1);
      const bob = reduced ? 0 : Math.sin(elapsed * 1.3) * 0.05;
      pedestal.position.y = (rise - 1) * (PEDESTAL + 0.05);
      sealMaterial.opacity = (0.14 + 0.5 * rise) * Math.max(presence, 0.35);
      holocron.position.y = THREE.MathUtils.lerp(REST_Y, OPEN_Y, lift) + bob * (1 - lift * 0.6);
      cube.rotation.y = reduced ? 0.6 : elapsed * (0.5 - 0.35 * bloom);
      cube.rotation.x = (1 - lift) * 0.5;
      cube.rotation.z = (1 - lift) * 0.5;
      hinges.forEach((hinge) => (hinge.rotation.x = bloom * 1.15));
      lid.position.y = S + bloom * 0.22;
      core.material.opacity = 0.35 + bloom * 0.4 + (reduced ? 0 : Math.sin(elapsed * 9) * 0.05 * bloom);
      core.scale.setScalar(0.4 + bloom * 0.45);
      halo.material.opacity = (0.35 + 0.3 * bloom) * Math.max(presence, 0.4);
      masterCaption.material.opacity = words;
      const spin = reduced ? 0 : elapsed * 0.1;
      const positions = tethers.geometry.getAttribute("position") as THREE.BufferAttribute;
      satellites.forEach((satellite, i) => {
        // The wheel stands upright, facing the door, so no caption ever hides another.
        const a = spin + (i / satellites.length) * Math.PI * 2 + Math.PI / 2;
        const out = smooth(release, i * 0.08, 0.6 + i * 0.08);
        satellite.holder.visible = release > 0.001;
        const sway = reduced ? 0 : Math.sin(elapsed * 0.7 + i * 1.3) * 0.05;
        point.set(Math.cos(a) * ORBIT * out, holocron.position.y + Math.sin(a) * ORBIT * out + sway * out, 0.42 * out);
        satellite.holder.position.copy(point);
        satellite.holder.scale.setScalar(0.2 + out * 0.8);
        satellite.box.rotation.set(reduced ? 0.5 : elapsed * 0.9 + i, reduced ? 0.7 : elapsed * 0.7 + i * 2, 0);
        satellite.spark.material.opacity = out * 0.45;
        satellite.label.material.opacity = words * smooth(out, 0.8, 1);
        positions.setXYZ(i * 2, 0, holocron.position.y, 0);
        positions.setXYZ(i * 2 + 1, point.x, point.y, point.z);
      });
      positions.needsUpdate = true;
      beamMaterial.opacity = release * 0.45;
      crystal.position.set(THREE.MathUtils.lerp(0.55, 0, release), THREE.MathUtils.lerp(REST_Y + 0.35, CROWN, release) + bob, THREE.MathUtils.lerp(-0.2, 0.42, release));
      gem.rotation.y = reduced ? 0.4 : elapsed * 0.8;
      gemGlow.material.opacity = 0.35 + release * 0.4;
      if (crystalCaption) crystalCaption.material.opacity = words;
      (shaftOfLight.material as THREE.MeshBasicMaterial).opacity = rise * bloom * 0.12;
      light.intensity = k * 14;
    },
    dispose: () => owned.forEach((item) => item.dispose()),
  };
}
