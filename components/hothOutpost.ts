import * as THREE from "three";
import { galaxy } from "./galaxy/store";
import { glowTexture, type Spot, type ZoneAction } from "./landingKit";
import { softBeam } from "./render/softBeam";
import { bakePart, part } from "./tatooineCharacters";
import type { Landing } from "./universe";
import { snowCover } from "./weathering";

// A relay post abandoned before the blizzards, half buried east of the hangar's mouth. A console in
// the base picks up its automatic distress signal: a red beacon lights up, the way out along the
// glacier opens, and inside the post a console still holds the last operator's log.

const EVENT = "hoth-distress";
type Height = (x: number, z: number) => number;
type Walker = { x: number; z: number };

const POST = { minX: 31.5, maxX: 42.5, minZ: 53.4, maxZ: 62.6, midZ: 58 };
const DOOR = { minZ: 57.1, maxZ: 58.9, height: 2.3 };
// Where the base's console stands, inside the mouth and clear of the tauntaun pen.
const CONSOLE = { x: 7.6, z: 29 };
const smooth = (value: number, from: number, to: number) => {
  const t = THREE.MathUtils.clamp((value - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
};

function screen(lines: string[], tone: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 288;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#04090d";
  c.fillRect(0, 0, 512, 288);
  c.strokeStyle = tone;
  c.lineWidth = 4;
  c.strokeRect(10, 10, 492, 268);
  c.fillStyle = tone;
  c.font = "bold 38px monospace";
  c.fillText(lines[0], 30, 70);
  c.font = "25px monospace";
  lines.slice(1).forEach((line, i) => c.fillText(line, 30, 126 + i * 38));
  c.fillStyle = "rgba(0,0,0,.3)";
  for (let y = 0; y < 288; y += 4) c.fillRect(0, y, 512, 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createHothOutpost(ground: Height, landing: Landing) {
  const group = new THREE.Group();
  group.name = "hoth-relay-post";
  const glow = glowTexture();
  const circles: Spot[] = [{ x: CONSOLE.x, z: CONSOLE.z, r: 0.55 }];

  // The floor sits just above the snow under its whole footprint.
  let floorY = 0;
  for (let x = POST.minX; x <= POST.maxX; x += 1) for (let z = POST.minZ; z <= POST.maxZ; z += 1) floorY = Math.max(floorY, ground(x, z));
  floorY += 0.08;

  const hull = snowCover(new THREE.MeshStandardMaterial({ color: 0x59636b, roughness: 0.78, metalness: 0.4 }), 0.9);
  const lining = new THREE.MeshStandardMaterial({ color: 0x38424a, roughness: 0.82, metalness: 0.25, side: THREE.BackSide });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c2125, roughness: 0.75, metalness: 0.5 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x4b555c, roughness: 0.6, metalness: 0.6 });
  const crate = new THREE.MeshStandardMaterial({ color: 0x47483f, roughness: 0.85 });
  const rust = new THREE.MeshStandardMaterial({ color: 0x6d4a35, roughness: 0.9, metalness: 0.3 });
  const snow = new THREE.MeshStandardMaterial({ color: 0xe6eef5, roughness: 0.92 });
  const ice = new THREE.MeshStandardMaterial({ color: 0xcfe6f4, roughness: 0.2, metalness: 0.02, emissive: 0x1a3a50, emissiveIntensity: 0.35 });
  const hazard = new THREE.MeshStandardMaterial({ color: 0x8f6f1e, roughness: 0.7 });

  const shell = new THREE.Group();
  group.add(shell);
  const length = POST.maxX - POST.minX,
    radius = (POST.maxZ - POST.minZ) / 2,
    midX = (POST.minX + POST.maxX) / 2;
  // An arched hut lying east to west, its roof half lost under the drifts.
  const arch = (r: number, material: THREE.Material) => {
    const geometry = new THREE.CylinderGeometry(r, r, length, 32, 1, true, 0, Math.PI).rotateZ(Math.PI / 2);
    geometry.scale(1, 0.8, 1);
    return part(shell, geometry, material, [midX, floorY, POST.midZ]);
  };
  arch(radius, hull);
  arch(radius - 0.12, lining);
  part(shell, new THREE.PlaneGeometry(length, radius * 2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x20262a, roughness: 0.7, metalness: 0.5 }), [midX, floorY + 0.01, POST.midZ]);
  // End walls, the west one with its doorway.
  const end = (x: number, door: boolean) => {
    if (!door) {
      const shape = new THREE.Shape();
      shape.absarc(0, 0, radius, 0, Math.PI, false);
      const wall = new THREE.ShapeGeometry(shape, 24).scale(1, 0.8, 1).rotateY(Math.PI / 2);
      part(shell, wall, dark, [x, floorY, POST.midZ]).material = new THREE.MeshStandardMaterial({ color: 0x262d32, roughness: 0.8, metalness: 0.35, side: THREE.DoubleSide });
      return;
    }
    const shape = new THREE.Shape();
    shape.absarc(0, 0, radius, 0, Math.PI, false);
    const hole = new THREE.Path();
    hole.moveTo(DOOR.minZ - POST.midZ, 0.02);
    hole.lineTo(DOOR.maxZ - POST.midZ, 0.02);
    hole.lineTo(DOOR.maxZ - POST.midZ, DOOR.height / 0.8);
    hole.lineTo(DOOR.minZ - POST.midZ, DOOR.height / 0.8);
    hole.closePath();
    shape.holes.push(hole);
    const wall = new THREE.ShapeGeometry(shape, 24).scale(1, 0.8, 1).rotateY(Math.PI / 2);
    part(shell, wall, new THREE.MeshStandardMaterial({ color: 0x4a545b, roughness: 0.75, metalness: 0.4, side: THREE.DoubleSide }), [x, floorY, POST.midZ]);
  };
  end(POST.minX + 0.02, true);
  end(POST.maxX - 0.02, false);
  // The door frame, its hazard bands, and the blast door jammed a third of the way open.
  for (const z of [DOOR.minZ - 0.08, DOOR.maxZ + 0.08]) part(shell, new THREE.BoxGeometry(0.24, DOOR.height + 0.1, 0.16), steel, [POST.minX, floorY + DOOR.height / 2, z]);
  part(shell, new THREE.BoxGeometry(0.24, 0.16, DOOR.maxZ - DOOR.minZ + 0.32), steel, [POST.minX, floorY + DOOR.height + 0.08, POST.midZ]);
  for (let i = 0; i < 5; i++) part(shell, new THREE.BoxGeometry(0.03, 0.1, 0.22), i % 2 ? dark : hazard, [POST.minX - 0.13, floorY + DOOR.height + 0.08, POST.midZ - 0.8 + i * 0.4]);
  part(shell, new THREE.BoxGeometry(0.12, DOOR.height, 0.72), dark, [POST.minX + 0.14, floorY + DOOR.height / 2, DOOR.minZ - 0.28]);

  // Drifts banked along both flanks and over the east end, and tongue of snow blown in at the door.
  const mound = (x: number, z: number, sx: number, sy: number, sz: number) => part(shell, new THREE.SphereGeometry(1, 20, 10), snow, [x, floorY - 0.25, z]).scale.set(sx, sy, sz);
  [
    [34, 51, 4.8, 2.1, 2.4],
    [40.5, 50.9, 5.4, 2.9, 2.7],
    [33.5, 64.9, 4.6, 2.2, 2.4],
    [40, 65.2, 5.8, 3, 2.9],
    [45.6, 58, 2.9, 3, 6.2],
  ].forEach(([x, z, sx, sy, sz]) => mound(x, z, sx, sy, sz));
  part(shell, new THREE.SphereGeometry(1, 16, 8), snow, [POST.minX + 1.2, floorY - 0.02, POST.midZ - 0.1]).scale.set(1.9, 0.14, 0.95);
  part(shell, new THREE.SphereGeometry(1, 16, 8), snow, [POST.minX - 1.2, ground(POST.minX - 1.2, POST.midZ) - 0.05, POST.midZ]).scale.set(2.3, 0.35, 1.5);

  // Inside: panelled walls behind the racks, boxes that fell when the roof shook, and hanging ice.
  for (const z of [POST.minZ + 0.62, POST.maxZ - 0.62]) part(shell, new THREE.BoxGeometry(length - 0.1, 2, 0.08), new THREE.MeshStandardMaterial({ color: 0x2f373d, roughness: 0.8, metalness: 0.35 }), [midX, floorY + 1, z]);
  for (const z of [POST.minZ + 1.15, POST.maxZ - 1.15]) {
    for (let x = POST.minX + 1.1; x < POST.maxX - 0.8; x += 2.3) {
      part(shell, new THREE.BoxGeometry(0.08, 2, 0.06), steel, [x, floorY + 1, z + (z < POST.midZ ? 0.42 : -0.42)]);
      for (const y of [0.55, 1.25, 1.9]) part(shell, new THREE.BoxGeometry(2.25, 0.05, 0.84), dark, [x + 1.15, floorY + y, z]);
      part(shell, new THREE.BoxGeometry(0.72, 0.42, 0.6), crate, [x + 0.68, floorY + 0.79, z]);
      part(shell, new THREE.BoxGeometry(0.5, 0.3, 0.56), rust, [x + 1.62, floorY + 1.43, z]);
    }
  }
  part(shell, new THREE.BoxGeometry(0.8, 0.5, 0.7), crate, [36.2, floorY + 0.26, 56.1], [0.22, 0.5, 0.1]);
  part(shell, new THREE.BoxGeometry(0.6, 0.42, 0.6), rust, [38.5, floorY + 0.22, 59.9], [0, -0.7, 0.28]);
  for (let i = 0; i < 16; i++) {
    const x = POST.minX + 1.4 + ((i * 7.1) % 9),
      z = POST.midZ - 2.6 + ((i * 3.7) % 5.2),
      d = Math.abs(z - POST.midZ),
      roof = floorY + Math.sqrt(Math.max(0, radius * radius - d * d)) * 0.8 - 0.14,
      drop = 0.22 + (i % 5) * 0.12;
    part(shell, new THREE.ConeGeometry(0.03 + (i % 3) * 0.018, drop, 6), ice, [x, roof - drop / 2, z], [Math.PI, 0, 0]);
  }

  // The console at the far end, and the panel over it that still has power.
  part(shell, new THREE.BoxGeometry(0.7, 1, 2), steel, [POST.maxX - 0.55, floorY + 0.5, POST.midZ]);
  part(shell, new THREE.BoxGeometry(0.42, 0.06, 2), dark, [POST.maxX - 0.74, floorY + 1.03, POST.midZ], [0, 0, 0.35]);
  for (let i = 0; i < 7; i++) part(shell, new THREE.BoxGeometry(0.03, 0.05, 0.08), hazard, [POST.maxX - 0.84, floorY + 1.02, POST.midZ - 0.72 + i * 0.24]);
  bakePart(shell);

  const signalMap = screen(["POSTE RELAIS 7", "SIGNAL AUTOMATIQUE", "ÉQUIPAGE : ÉVACUÉ", "JOURNAL DISPONIBLE"], "#ff9c7c");
  const readMap = screen(["POSTE RELAIS 7", "JOURNAL TRANSMIS", "À LA BASE ÉCHO", "FIN D'ÉMISSION"], "#8fe7c8");
  const panelMaterial = new THREE.MeshBasicMaterial({ map: signalMap, toneMapped: false });
  part(group, new THREE.PlaneGeometry(1.5, 0.84), panelMaterial, [POST.maxX - 0.3, floorY + 1.85, POST.midZ], [0, -Math.PI / 2, 0]);
  const panelGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff7a5c, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
  panelGlow.position.set(POST.maxX - 0.6, floorY + 1.8, POST.midZ);
  panelGlow.scale.set(3.4, 2.4, 1);
  group.add(panelGlow);

  // Emergency strips along the ceiling, stuttering on what is left of the batteries.
  const stripMaterial = new THREE.MeshBasicMaterial({ color: 0xffa070 });
  const stripHeight = floorY + 2.75;
  for (const z of [POST.midZ - 1.2, POST.midZ + 1.2]) part(group, new THREE.BoxGeometry(length - 2, 0.03, 0.05), stripMaterial, [midX, stripHeight, z]);
  const strips = [36, 40].map((x) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff8a58, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
    sprite.position.set(x, stripHeight - 0.2, POST.midZ);
    sprite.scale.set(6, 2.6, 1);
    group.add(sprite);
    return sprite;
  });

  // Outside: a snapped antenna with a red beacon, and the shaft of light that marks it from afar.
  const mast = new THREE.Group();
  mast.position.set(POST.maxX - 3, floorY + radius * 0.8 - 0.1, POST.midZ + 1);
  mast.rotation.set(0.2, 0, -0.14);
  group.add(mast);
  part(mast, new THREE.CylinderGeometry(0.05, 0.1, 5.2, 8), steel, [0, 2.6, 0]);
  part(mast, new THREE.CylinderGeometry(0.72, 0.1, 0.34, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0x8b949a, roughness: 0.55, metalness: 0.5, side: THREE.DoubleSide }), [0.34, 4.1, 0], [0, 0, -1.1]);
  for (const y of [1.6, 2.6, 3.5]) part(mast, new THREE.BoxGeometry(0.7, 0.03, 0.03), steel, [0, y, 0], [0, y, 0]);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3b24 }));
  lamp.position.y = 5.25;
  mast.add(lamp);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff4630, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.y = 5.25;
  halo.scale.setScalar(6);
  mast.add(halo);
  const beamMaterial = softBeam(new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }), 10);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.1, 90, 18, 1, true), beamMaterial);
  beam.position.set(POST.maxX - 3, floorY + 45, POST.midZ + 1);
  group.add(beam);
  const doorLamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff4630, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  doorLamp.position.set(POST.minX - 0.25, floorY + DOOR.height + 0.3, POST.midZ);
  doorLamp.scale.setScalar(1.6);
  group.add(doorLamp);

  // The console in the base that picks the signal up.
  const station = new THREE.Group();
  station.position.set(CONSOLE.x, 0, CONSOLE.z);
  station.rotation.y = Math.PI * 1.08;
  group.add(station);
  part(station, new THREE.BoxGeometry(0.9, 1, 0.5), steel, [0, 0.5, 0]);
  part(station, new THREE.BoxGeometry(0.92, 0.06, 0.58), dark, [0, 1.02, 0.02], [0.3, 0, 0]);
  part(station, new THREE.CylinderGeometry(0.02, 0.03, 1.1, 6), dark, [0.34, 1.55, -0.14]);
  const stationScreenMaterial = new THREE.MeshBasicMaterial({ map: screen(["COMMS ÉCHO", "BALAYAGE EN COURS", "SIGNAL FAIBLE : EST"], "#7fd6ff"), toneMapped: false });
  part(station, new THREE.PlaneGeometry(0.78, 0.44), stationScreenMaterial, [0, 1.3, 0.1], [-0.2, 0, 0]);
  const stationLamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff5840, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  stationLamp.position.set(0.34, 2.12, -0.14);
  stationLamp.scale.setScalar(0.5);
  station.add(stationLamp);

  const pick = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const stationPick = part(group, new THREE.BoxGeometry(1.2, 2, 1), pick, [CONSOLE.x, 1, CONSOLE.z]);
  const consolePick = part(group, new THREE.BoxGeometry(0.9, 1.8, 2.2), pick, [POST.maxX - 0.6, floorY + 1, POST.midZ]);

  // Once found in an earlier visit it stays lit: the post is still out there.
  const known = () => galaxy().record().discoveries.some((item) => item.id === EVENT);
  let open = false;
  let read = false;
  let revision = 0;
  const signal: ZoneAction = {
    id: "hoth-signal",
    label: "Capter le signal",
    position: new THREE.Vector3(CONSOLE.x, 1.2, CONSOLE.z),
    objects: [stationPick],
    approach: { position: new THREE.Vector3(CONSOLE.x + 0.2, 0, CONSOLE.z - 1.6), lookAt: new THREE.Vector3(CONSOLE.x, 1.2, CONSOLE.z) },
    activate: () => {
      if (!open) galaxy().trigger(EVENT);
      setOpen();
    },
  };
  const setOpen = () => {
    if (open) return;
    open = true;
    revision++;
    signal.activate = () => {};
    aim(false);
  };
  // From here on the same button walks the visitor out to the post, and back from it. The way out
  // ends well inside, facing the console, close enough for the log's own button to appear.
  const way = [new THREE.Vector3(12.5, 0, 44.5), new THREE.Vector3(17, 0, 47.4), new THREE.Vector3(24, 0, 52), new THREE.Vector3(29.5, 0, POST.midZ)];
  const aim = (out: boolean) => {
    signal.label = out ? "Retour à la base" : "Rejoindre le poste";
    signal.position = out ? new THREE.Vector3(CONSOLE.x, 1.2, CONSOLE.z) : new THREE.Vector3(POST.maxX - 0.3, floorY + 1.85, POST.midZ);
    signal.path = out ? [...way].reverse().concat(new THREE.Vector3(CONSOLE.x + 0.2, 0, CONSOLE.z + 1.6)) : [...way, new THREE.Vector3(POST.maxX - 4.8, 0, POST.midZ)];
    signal.approach = { position: signal.path[signal.path.length - 1], lookAt: signal.position };
    revision++;
  };
  let wasOut = false;
  const log: ZoneAction = {
    id: "hoth-post-log",
    label: "Lire le journal",
    hidden: true,
    position: new THREE.Vector3(POST.maxX - 0.8, floorY + 1.25, POST.midZ),
    objects: [consolePick],
    approach: { position: new THREE.Vector3(POST.maxX - 2.2, 0, POST.midZ), lookAt: new THREE.Vector3(POST.maxX, floorY + 1.5, POST.midZ) },
    dossiers: { eyebrow: "POSTE RELAIS 7 · JOURNAL RÉCUPÉRÉ", projects: landing.terminals },
    activate: () => {
      // The signal may have died down since it was picked up; the log is still there to read.
      galaxy().trigger(EVENT);
      galaxy().found(EVENT);
      if (read) return;
      read = true;
      panelMaterial.map = readMap;
      panelMaterial.needsUpdate = true;
      panelGlow.material.color.setHex(0x7fe6c4);
    },
  };

  // The world's deposit of snow belongs outdoors: nothing under this roof takes it.
  group.traverse((object) => {
    const material = (object as THREE.Mesh).material as THREE.Material | undefined;
    if (material && !Array.isArray(material) && material !== snow && material !== hull) material.userData.indoors = true;
  });

  // Solid walls of the post: a visitor walks in through the door and nowhere else.
  const walls = [
    { minX: POST.minX - 0.1, maxX: POST.maxX + 0.2, minZ: POST.minZ - 0.4, maxZ: POST.minZ + 1.65 },
    { minX: POST.minX - 0.1, maxX: POST.maxX + 0.2, minZ: POST.maxZ - 1.65, maxZ: POST.maxZ + 0.4 },
    { minX: POST.maxX - 0.95, maxX: POST.maxX + 0.2, minZ: POST.minZ, maxZ: POST.maxZ },
    { minX: POST.minX - 0.1, maxX: POST.minX + 0.3, minZ: POST.minZ, maxZ: DOOR.minZ },
    { minX: POST.minX - 0.1, maxX: POST.minX + 0.3, minZ: DOOR.maxZ, maxZ: POST.maxZ },
  ];
  const insideRoom = (walker: Walker) => walker.x > POST.minX + 0.2 && walker.x < POST.maxX && walker.z > POST.minZ && walker.z < POST.maxZ;
  const eastOfMouth = (x: number) => 46 + 4 * smooth(x, 16, 22);
  let clock = 0;

  return {
    group,
    circles,
    actions: [signal, log],
    actionsKey: () => revision,
    contains: insideRoom,
    /** The way along the glacier to the post, once the signal has been picked up. */
    constrain(walker: Walker) {
      if (!open) return false;
      if (!((walker.z > 46 && walker.x > 6) || walker.x > 20.5)) return false;
      walker.x = THREE.MathUtils.clamp(walker.x, 6, 46);
      walker.z = THREE.MathUtils.clamp(walker.z, eastOfMouth(walker.x), 66);
      for (const wall of walls) {
        const a = wall.minX - 0.35,
          b = wall.maxX + 0.35,
          c = wall.minZ - 0.35,
          d = wall.maxZ + 0.35;
        if (walker.x <= a || walker.x >= b || walker.z <= c || walker.z >= d) continue;
        const out = [walker.x - a, b - walker.x, walker.z - c, d - walker.z],
          side = out.indexOf(Math.min(...out));
        if (side === 0) walker.x = a;
        else if (side === 1) walker.x = b;
        else if (side === 2) walker.z = c;
        else walker.z = d;
      }
      return true;
    },
    floorAt(walker: Walker) {
      if (walker.z <= 46 && walker.x <= 20.5) return 0;
      if (insideRoom(walker)) return floorY;
      // Up the drift at the door, rather than a step.
      const outside = ground(walker.x, walker.z);
      const nearDoor = Math.abs(walker.z - POST.midZ) < 2.4 ? smooth(walker.x, POST.minX - 2.4, POST.minX + 0.2) : 0;
      return THREE.MathUtils.lerp(outside, floorY, nearDoor);
    },
    tick(dt: number, reduced: boolean, walker: Walker) {
      if (!open && (known() || galaxy().activeAt("hoth").some((run) => run.id === EVENT))) setOpen();
      const out = walker.x > 20.5 || walker.z > 46.5;
      if (open && out !== wasOut) {
        wasOut = out;
        aim(out);
      }
      if (!reduced) clock += dt;
      const blink = reduced ? 1 : Math.pow(0.5 + 0.5 * Math.sin(clock * 3.1), 3);
      const lit = open ? 1 : 0;
      halo.material.opacity = lit * (0.25 + blink * 0.65);
      lamp.visible = open;
      doorLamp.material.opacity = lit * (0.15 + blink * 0.5);
      beamMaterial.opacity = lit * (0.05 + blink * 0.05);
      beam.visible = open;
      stationLamp.material.opacity = open ? 0.25 : 0.25 + blink * 0.65;
      // The strips catch and die in bursts, like a failing cell.
      const stutter = reduced ? 0.8 : Math.sin(clock * 37) * Math.sin(clock * 5.3) > 0.45 ? 0.18 : 0.72 + Math.sin(clock * 1.7) * 0.2;
      stripMaterial.color.setRGB(stutter, stutter * 0.62, stutter * 0.42);
      strips.forEach((sprite) => (sprite.material.opacity = 0.22 * stutter));
    },
  };
}
