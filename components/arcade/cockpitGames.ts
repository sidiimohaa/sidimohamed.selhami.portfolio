import * as THREE from "three";
import { tieGeometry } from "../tieModel";
import type { ArcadeAudio } from "./arcadeAudio";
import type { GameResult } from "./arcadeStore";

// Space Battle and Asteroid Survival, flown from the X-wing's own cockpit: the dashboard stays where
// it is while TIE fighters or an asteroid field are added outside the canopy. CockpitMap ticks the
// runtime from its frame loop after placing the camera; the runtime owns everything it adds and
// gives the camera back as it found it when disposed.

export type CockpitGameKind = "space-battle" | "asteroid-survival";
export type CockpitGamePhase = "intro" | "playing" | "paused" | "won" | "lost";
export type CockpitGameView = {
  kind: CockpitGameKind;
  phase: CockpitGamePhase;
  time: number;
  score: number;
  shields: number;
  hull: number;
  wave: number;
  waves: number;
  remaining: number;
  torpedoes: number;
  nearMisses: number;
  combo: number;
  goal: number;
  canExtract: boolean;
  dodge: number;
  banner: string | null;
  subtitle: string | null;
  message: string;
  locked: boolean;
  aim: [number, number];
  hurt: number;
};

const SHIP = new THREE.Vector3(0, 1.4, 1.2);
const WAVES = [
  { count: 4, elite: 0 },
  { count: 6, elite: 0 },
  { count: 5, elite: 2 },
];
const ASTEROID_GOAL = 90,
  ASTEROID_MASTER = 180;
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const radio = [
  "Rouge Deux : chasseurs TIE en approche, droit devant !",
  "Rouge Trois : une deuxième escadrille arrive, restez concentré !",
  "Rouge Leader : des TIE d’élite ! Gardez vos torpilles pour eux.",
];

// Lumpy rocks: an icosphere pushed in and out by smooth waves, so shared edges never crack apart.
function rockGeometry(seed: number) {
  const geometry = new THREE.IcosahedronGeometry(1, 2);
  const position = geometry.getAttribute("position");
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    const lumps = 1 + 0.22 * Math.sin(v.x * 3.1 + seed) * Math.cos(v.y * 2.7 - seed * 1.7) + 0.13 * Math.sin(v.z * 5.3 + seed * 2.3) + 0.07 * Math.cos((v.x + v.y) * 7.1 + seed);
    v.multiplyScalar(lumps);
    v.y *= 0.78 + (seed % 3) * 0.08;
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function glowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const c = canvas.getContext("2d")!;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,255,255,.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

type Fighter = {
  group: THREE.Group;
  alive: boolean;
  elite: boolean;
  hp: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  target: THREE.Vector3;
  mode: "approach" | "strafe";
  nextShot: number;
  seed: number;
  flash: number;
  passed: boolean;
};
type Bolt = { mesh: THREE.Mesh; active: boolean; enemy: boolean; vel: THREE.Vector3; ttl: number; impact: number; travelled: number; fighter: Fighter | null; hits: boolean; damage: number };
type Torpedo = { mesh: THREE.Group; active: boolean; vel: THREE.Vector3; target: Fighter | null; ttl: number };
type Blast = { group: THREE.Group; core: THREE.Mesh; fire: THREE.Mesh; debris: THREE.Mesh[]; velocity: THREE.Vector3[]; age: number; life: number; size: number; active: boolean; rocky: boolean };
type Rock = { mesh: THREE.Mesh; active: boolean; pos: THREE.Vector3; r: number; speed: number; spin: THREE.Vector3; checked: boolean };

export function createCockpitGame(options: {
  kind: CockpitGameKind;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  reduced: boolean;
  audio: ArcadeAudio | null;
  // The equipped engine colour: it tints the streaks of space dust rushing past the canopy.
  trail: string;
  onView: (view: CockpitGameView) => void;
  onFinish: (result: GameResult) => void;
}) {
  const { kind, scene, camera, audio, onView, onFinish } = options;
  const space = kind === "space-battle";
  const prior = { fov: camera.fov };
  const owned: { geometries: THREE.BufferGeometry[]; materials: THREE.Material[]; textures: THREE.Texture[] } = { geometries: [], materials: [], textures: [] };
  const keep = <T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(item: T) => {
    if (item instanceof THREE.BufferGeometry) owned.geometries.push(item);
    else if (item instanceof THREE.Material) owned.materials.push(item);
    else owned.textures.push(item);
    return item;
  };
  const world = new THREE.Group();
  const fieldInverse = new THREE.Matrix4();
  world.name = `arcade-${kind}`;
  // The field rolls around the line of sight when the ship banks, so the dashboard stays still.
  const field = new THREE.Group();
  field.position.set(0, SHIP.y, 0);
  world.add(field);
  scene.add(world);
  const toWorld = (v: THREE.Vector3, out: THREE.Vector3) => out.copy(v).applyMatrix4(field.matrixWorld);
  const toField = (v: THREE.Vector3, out: THREE.Vector3) => out.copy(v).applyMatrix4(fieldInverse);
  const sun = new THREE.DirectionalLight(0xfff0d8, space ? 2.2 : 2.6);
  sun.position.set(60, 40, 10);
  const rim = new THREE.DirectionalLight(0x6f9cff, 0.9);
  rim.position.set(-40, -20, -60);
  const flashLight = new THREE.PointLight(0xffa860, 0, 140, 1.4);
  world.add(sun, rim, flashLight);
  const glow = keep(glowTexture());

  // Space dust streaking past: the sense of speed, tinted with the equipped engine trail.
  const DUST = options.reduced ? 120 : 320;
  const dust = new Float32Array(DUST * 3),
    dustLines = new Float32Array(DUST * 6);
  const placeDust = (i: number, z: number) => {
    let x = 0,
      y = 0;
    do {
      x = rand(-60, 60);
      y = rand(-36, 36);
    } while (Math.hypot(x, y) < 6);
    dust.set([x, y, z], i * 3);
  };
  for (let i = 0; i < DUST; i++) placeDust(i, rand(-220, 10));
  const dustGeometry = keep(new THREE.BufferGeometry());
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustLines, 3));
  const trailColor = options.trail.startsWith("#") ? options.trail : "#a9cfff";
  const dustMaterial = keep(new THREE.LineBasicMaterial({ color: trailColor, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  const dustMesh = new THREE.LineSegments(dustGeometry, dustMaterial);
  dustMesh.frustumCulled = false;
  field.add(dustMesh);

  // Explosions: a white core, an orange ball of fire and tumbling debris, from a small pool.
  const debrisGeometry = keep(new THREE.BoxGeometry(0.5, 0.25, 0.7));
  const rubbleGeometry = keep(new THREE.IcosahedronGeometry(0.4, 0));
  const debrisMaterial = keep(new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.7, metalness: 0.4 }));
  const rockDebrisMaterial = keep(new THREE.MeshStandardMaterial({ color: 0x5d544b, roughness: 0.95, flatShading: true }));
  const sphere = keep(new THREE.SphereGeometry(1, 16, 12));
  const blasts: Blast[] = Array.from({ length: 10 }, () => {
    const group = new THREE.Group();
    const core = new THREE.Mesh(sphere, keep(new THREE.MeshBasicMaterial({ color: 0xfff4d6, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
    const fire = new THREE.Mesh(sphere, keep(new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
    const debris = Array.from({ length: 9 }, () => new THREE.Mesh(debrisGeometry, debrisMaterial));
    group.add(core, fire, ...debris);
    group.visible = false;
    field.add(group);
    return { group, core, fire, debris, velocity: debris.map(() => new THREE.Vector3()), age: 0, life: 1, size: 1, active: false, rocky: false };
  });
  const explode = (where: THREE.Vector3, size: number, rocky = false, spark = false) => {
    const blast = blasts.find((item) => !item.active) ?? blasts[0];
    blast.active = true;
    blast.age = 0;
    blast.size = size;
    blast.rocky = rocky;
    blast.life = 0.9 + size * 0.35;
    blast.group.position.copy(where);
    blast.group.visible = true;
    (blast.fire.material as THREE.MeshBasicMaterial).color.set(rocky ? 0x9a8670 : 0xff7a2a);
    (blast.core.material as THREE.MeshBasicMaterial).color.set(rocky ? 0xd8cbb8 : 0xfff4d6);
    blast.debris.forEach((piece, i) => {
      piece.visible = !spark;
      piece.material = rocky ? rockDebrisMaterial : debrisMaterial;
      piece.geometry = rocky ? rubbleGeometry : debrisGeometry;
      piece.position.set(0, 0, 0);
      piece.scale.setScalar(rocky ? size * rand(0.6, 1.6) : rand(0.6, 1.3));
      blast.velocity[i].set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(8, 22) * size);
    });
    if (spark) return;
    toWorld(where, flashLight.position);
    flashLight.intensity = rocky ? 400 : 1200 * size;
    audio?.explosion(size);
  };

  // --- Space Battle ---
  const tie = space ? tieGeometry() : null;
  if (tie) [tie.hull, tie.panels, tie.glass].forEach(keep);
  const tieHull = keep(new THREE.MeshStandardMaterial({ color: 0x8f969d, roughness: 0.48, metalness: 0.55 }));
  const eliteHull = keep(new THREE.MeshStandardMaterial({ color: 0x585d64, roughness: 0.45, metalness: 0.6, emissive: 0x220406 }));
  const tiePanels = keep(new THREE.MeshStandardMaterial({ color: 0x1a1f26, roughness: 0.6, metalness: 0.4 }));
  const tieGlass = keep(new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: 0.1, metalness: 0.9, emissive: 0x0b1d12 }));
  const fighters: Fighter[] = tie
    ? Array.from({ length: 8 }, (_, i) => {
        const group = new THREE.Group();
        group.add(new THREE.Mesh(tie.hull, tieHull), new THREE.Mesh(tie.panels, tiePanels), new THREE.Mesh(tie.glass, tieGlass));
        group.visible = false;
        field.add(group);
        return { group, alive: false, elite: false, hp: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), target: new THREE.Vector3(), mode: "approach", nextShot: 0, seed: i * 1.7, flash: 0, passed: false };
      })
    : [];
  const boltGeometry = keep(new THREE.CylinderGeometry(0.07, 0.07, 5, 6).rotateX(Math.PI / 2));
  const redBolt = keep(new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const greenBolt = keep(new THREE.MeshBasicMaterial({ color: 0x4dff73, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const bolts: Bolt[] = space
    ? Array.from({ length: 48 }, () => {
        const mesh = new THREE.Mesh(boltGeometry, redBolt);
        mesh.visible = false;
        field.add(mesh);
        return { mesh, active: false, enemy: false, vel: new THREE.Vector3(), ttl: 0, impact: Infinity, travelled: 0, fighter: null, hits: false, damage: 0 };
      })
    : [];
  const torpedoes: Torpedo[] = space
    ? Array.from({ length: 3 }, () => {
        const mesh = new THREE.Group();
        mesh.add(new THREE.Mesh(sphere, keep(new THREE.MeshBasicMaterial({ color: 0xe8f4ff, toneMapped: false }))));
        mesh.children[0].scale.setScalar(0.22);
        const halo = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glow, color: 0x7fc4ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
        halo.scale.setScalar(3.2);
        mesh.add(halo);
        mesh.visible = false;
        field.add(mesh);
        return { mesh, active: false, vel: new THREE.Vector3(), target: null, ttl: 0 };
      })
    : [];

  // --- Asteroid Survival ---
  const rockShapes = space ? [] : [0, 1, 2, 3, 4].map((seed) => keep(rockGeometry(seed * 1.9 + 0.4)));
  const rockMaterials = space ? [] : [0x6f665d, 0x5a524a, 0x7b6b58].map((color) => keep(new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.04, flatShading: true })));
  const rocks: Rock[] = space
    ? []
    : Array.from({ length: options.reduced ? 45 : 70 }, (_, i) => {
        const mesh = new THREE.Mesh(rockShapes[i % rockShapes.length], rockMaterials[i % rockMaterials.length]);
        mesh.visible = false;
        field.add(mesh);
        return { mesh, active: false, pos: new THREE.Vector3(), r: 1, speed: 0, spin: new THREE.Vector3(), checked: false };
      });
  const craft = { x: 0, y: 0, vx: 0, vy: 0 };
  const held = { left: false, right: false, up: false, down: false };

  // --- Shared state ---
  let phase: CockpitGamePhase = "intro",
    resumeTo: CockpitGamePhase = "intro",
    time = 0,
    clock = 0,
    score = 0,
    shields = 100,
    hull = 100,
    lastHit = -10,
    hitsTaken = 0,
    hullTouched = false,
    hurt = 0,
    shake = 0,
    message = space ? "Visez avec la souris ou le doigt, tirez en maintenant le clic." : "Manœuvrez avec la souris, le doigt ou les touches directionnelles.",
    messageUntil = 6,
    banner: string | null = space ? "SPACE BATTLE" : "ASTEROID SURVIVAL",
    subtitle: string | null = "PRÉPAREZ-VOUS",
    bannerUntil = 2.6,
    firing = false,
    fireClock = 0,
    cannon = 0,
    shots = 0,
    landed = 0,
    torpedoCount = 3,
    locked: Fighter | null = null,
    wave = 0,
    toSpawn = 0,
    eliteToSpawn = 0,
    spawnClock = 0,
    waveDelay = -1,
    rockClock = 0,
    nearMisses = 0,
    combo = 0,
    dodgeReady = 0,
    goalReached = false,
    warned = false,
    uiClock = 1,
    disposed = false,
    pointerActive = false;
  const aim = new THREE.Vector2(0, 0.05);
  const raycaster = new THREE.Raycaster(),
    hitSphere = new THREE.Sphere(),
    tmp = new THREE.Vector3(),
    tmp2 = new THREE.Vector3(),
    from = new THREE.Vector3(),
    ship = new THREE.Vector3().copy(SHIP).sub(field.position);
  const say = (text: string, seconds = 4) => {
    message = text;
    messageUntil = clock + seconds;
  };
  const show = (title: string | null, sub: string | null = null, seconds = 2.4) => {
    banner = title;
    subtitle = sub;
    bannerUntil = clock + seconds;
  };

  const publish = () =>
    onView({
      kind,
      phase,
      time,
      score: Math.round(score),
      shields: Math.round(shields),
      hull: Math.round(hull),
      wave,
      waves: WAVES.length,
      remaining: fighters.filter((f) => f.alive).length + toSpawn,
      torpedoes: torpedoCount,
      nearMisses,
      combo,
      goal: ASTEROID_GOAL,
      canExtract: !space && goalReached && phase === "playing",
      dodge: Math.max(0, dodgeReady - time),
      banner: clock < bannerUntil ? banner : null,
      subtitle: clock < bannerUntil ? subtitle : null,
      message: clock < messageUntil ? message : "",
      locked: !!locked,
      aim: [aim.x, aim.y],
      hurt,
    });

  const finish = (won: boolean) => {
    if (phase === "won" || phase === "lost") return;
    firing = false;
    phase = won ? "won" : "lost";
    if (space) {
      if (won) score += hull * 10 + shields * 5 + Math.round((landed / Math.max(1, shots)) * 1000);
      show(won ? "MISSION ACCOMPLIE" : "VAISSEAU DÉTRUIT", won ? "Les trois vagues sont neutralisées" : "La coque a cédé", 99);
    } else {
      show(won ? "MISSION ACCOMPLIE" : "VAISSEAU DÉTRUIT", won ? `${Math.floor(time)} secondes dans le champ` : "Le champ d’astéroïdes a eu raison de vous", 99);
    }
    if (won) audio?.success();
    else audio?.fail();
    audio?.engine(0);
    publish();
    const survived = Math.floor(time);
    onFinish(
      space
        ? { gameId: "space-battle", score: Math.round(score), won, perfect: won && hitsTaken === 0, seconds: Math.round(time), hullLost: hullTouched }
        : { gameId: "asteroid-survival", score: Math.round(score), won, perfect: won && hitsTaken === 0, seconds: survived, survived },
    );
  };

  const damage = (amount: number) => {
    hitsTaken++;
    lastHit = time;
    const absorbed = Math.min(shields, amount);
    shields -= absorbed;
    const through = amount - absorbed;
    if (through > 0) {
      hull = Math.max(0, hull - through);
      hullTouched = true;
    }
    hurt = 1;
    shake = Math.max(shake, 0.4 + Math.min(0.6, amount / 60));
    combo = 0;
    audio?.damage();
    if (hull > 0 && hull < 35 && !warned) {
      warned = true;
      say("R2 signale des dégâts critiques sur la coque !", 4);
      audio?.alarm();
    }
    if (hull <= 0) {
      explode(tmp.copy(ship).add(new THREE.Vector3(0, 0, -6)), 1.6);
      finish(!space && time >= ASTEROID_GOAL);
    }
  };

  // Space Battle pieces.
  const approachTarget = (f: Fighter) => f.target.set(rand(-28, 28), rand(-14, 16), rand(-75, -42));
  const spawnFighter = (elite: boolean) => {
    const f = fighters.find((item) => !item.alive);
    if (!f) return false;
    f.alive = true;
    f.elite = elite;
    f.hp = elite ? 5 : 2;
    f.mode = "approach";
    f.passed = false;
    f.pos.set(rand(-90, 90), rand(-40, 40), rand(-270, -220));
    f.vel.set(0, 0, 30);
    approachTarget(f);
    f.nextShot = time + rand(2, 4);
    f.flash = 0;
    (f.group.children[0] as THREE.Mesh).material = elite ? eliteHull : tieHull;
    f.group.scale.setScalar(elite ? 1.08 : 1);
    f.group.visible = true;
    return true;
  };
  const startWave = (n: number) => {
    wave = n;
    toSpawn = WAVES[n - 1].count;
    eliteToSpawn = WAVES[n - 1].elite;
    toSpawn += eliteToSpawn;
    spawnClock = 0.5;
    show(`VAGUE ${n} / ${WAVES.length}`, n === 3 ? "Escadrille d’élite détectée" : `${toSpawn} chasseurs impériaux`, 2.6);
    say(radio[n - 1], 4.5);
    audio?.alarm();
  };
  const bolt = (enemy: boolean, origin: THREE.Vector3, direction: THREE.Vector3, speed: number) => {
    const b = bolts.find((item) => !item.active);
    if (!b) return null;
    b.active = true;
    b.enemy = enemy;
    b.mesh.material = enemy ? greenBolt : redBolt;
    b.mesh.visible = true;
    b.mesh.position.copy(origin);
    b.vel.copy(direction).normalize().multiplyScalar(speed);
    b.mesh.lookAt(tmp2.copy(origin).add(b.vel));
    b.ttl = 2.2;
    b.travelled = 0;
    b.impact = Infinity;
    b.fighter = null;
    b.hits = false;
    b.damage = 0;
    return b;
  };
  const hurtFighter = (f: Fighter, amount: number, torpedo = false) => {
    if (!f.alive) return;
    f.hp -= amount;
    f.flash = 1;
    audio?.hit();
    if (f.hp > 0) explode(f.pos, 0.3, false, true);
    if (f.hp <= 0) {
      f.alive = false;
      f.group.visible = false;
      explode(f.pos, f.elite ? 1.5 : 1.1);
      score += (f.elite ? 250 : 100) * (1 + (wave - 1) * 0.25) + (torpedo ? 50 : 0);
      if (locked === f) locked = null;
    }
  };
  const fireCannons = () => {
    raycaster.setFromCamera(aim, camera);
    let nearest = Infinity,
      victim: Fighter | null = null;
    for (const f of fighters) {
      if (!f.alive) continue;
      toWorld(f.pos, hitSphere.center);
      hitSphere.radius = 3.6;
      if (raycaster.ray.intersectSphere(hitSphere, tmp)) {
        const d = tmp.distanceTo(camera.position);
        if (d < nearest) {
          nearest = d;
          victim = f;
        }
      }
    }
    const reach = Number.isFinite(nearest) ? nearest : 260;
    const point = toField(tmp2.copy(raycaster.ray.direction).multiplyScalar(reach).add(camera.position), tmp);
    // The four wing cannons fire in turn, from the tips of the S-foils.
    const tips: [number, number][] = [
      [-4.4, -0.9],
      [4.4, 0.9],
      [-4.4, 0.9],
      [4.4, -0.9],
    ];
    const [x, y] = tips[cannon++ % 4];
    from.set(x, y, 0.2);
    const b = bolt(false, from, tmp2.copy(point).sub(from), 280);
    shots++;
    if (b && victim) {
      b.fighter = victim;
      b.impact = from.distanceTo(point);
    }
    audio?.laser();
  };
  const launchTorpedo = () => {
    if (phase !== "playing" || !space) return;
    if (torpedoCount <= 0) {
      say("Plus de torpilles à protons.", 2);
      audio?.ui("error");
      return;
    }
    const t = torpedoes.find((item) => !item.active);
    if (!t) return;
    torpedoCount--;
    t.active = true;
    t.target = locked;
    t.ttl = 3.4;
    t.mesh.visible = true;
    t.mesh.position.set(0, -0.6, -1);
    raycaster.setFromCamera(aim, camera);
    t.vel.copy(raycaster.ray.direction).transformDirection(fieldInverse).multiplyScalar(60);
    say(locked ? "Torpille à protons lancée sur la cible verrouillée !" : "Torpille lancée sans verrouillage.", 2.5);
    audio?.torpedo();
  };

  // Asteroid Survival pieces.
  const spawnRock = () => {
    const rock = rocks.find((item) => !item.active);
    if (!rock) return;
    const level = Math.min(1, time / 170);
    rock.active = true;
    rock.checked = false;
    rock.r = 1.4 + Math.random() ** 2 * (5 + level * 2.5);
    const aimed = Math.random() < 0.3 + level * 0.25;
    rock.pos.set(craft.x + (aimed ? rand(-4, 4) : rand(-38, 38)), craft.y + (aimed ? rand(-3, 3) : rand(-22, 22)), rand(-250, -215));
    rock.speed = THREE.MathUtils.lerp(46, 88, Math.min(1, time / 180)) * rand(0.85, 1.15);
    rock.spin.set(rand(-1, 1), rand(-1, 1), rand(-1, 1));
    rock.mesh.scale.setScalar(rock.r);
    rock.mesh.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
    rock.mesh.visible = true;
  };
  const dodge = () => {
    if (space || phase !== "playing" || time < dodgeReady) return;
    const dx = (held.right ? 1 : 0) - (held.left ? 1 : 0) || Math.sign(craft.vx) || 1;
    const dy = (held.up ? 1 : 0) - (held.down ? 1 : 0);
    craft.vx += dx * 38;
    craft.vy += dy * 26;
    dodgeReady = time + 3;
    audio?.boost();
  };

  const pause = () => {
    if (phase !== "playing" && phase !== "intro") return;
    resumeTo = phase;
    phase = "paused";
    firing = false;
    audio?.engine(0);
    publish();
  };
  const resume = () => {
    if (phase !== "paused") return;
    phase = resumeTo;
    publish();
  };
  const blur = () => pause();
  const visibility = () => {
    if (document.hidden) pause();
  };
  window.addEventListener("blur", blur);
  document.addEventListener("visibilitychange", visibility);

  const reset = () => {
    fighters.forEach((f) => ((f.alive = false), (f.group.visible = false)));
    bolts.forEach((b) => ((b.active = false), (b.mesh.visible = false)));
    torpedoes.forEach((t) => ((t.active = false), (t.mesh.visible = false)));
    rocks.forEach((r) => ((r.active = false), (r.mesh.visible = false)));
    blasts.forEach((b) => ((b.active = false), (b.group.visible = false)));
    phase = "intro";
    time = score = hitsTaken = shots = landed = nearMisses = combo = wave = toSpawn = eliteToSpawn = 0;
    shields = hull = 100;
    hullTouched = warned = goalReached = firing = false;
    torpedoCount = 3;
    waveDelay = -1;
    dodgeReady = 0;
    craft.x = craft.y = craft.vx = craft.vy = 0;
    held.left = held.right = held.up = held.down = false;
    lastHit = -10;
    locked = null;
    clock = 0;
    messageUntil = 0;
    show(space ? "SPACE BATTLE" : "ASTEROID SURVIVAL", "PRÉPAREZ-VOUS", 2.6);
    publish();
  };

  publish();

  return {
    pause,
    resume,
    togglePause: () => (phase === "paused" ? resume() : pause()),
    restart: reset,
    extract: () => {
      if (!space && goalReached && phase === "playing") finish(true);
    },
    setAim: (x: number, y: number) => {
      aim.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1));
      pointerActive = true;
    },
    releaseAim: () => {
      pointerActive = false;
    },
    setFiring: (on: boolean) => {
      firing = on && space;
    },
    torpedo: launchTorpedo,
    dodge,
    /** Keyboard: arrows or WASD / ZQSD move the sights (Space Battle) or the ship (asteroids). */
    key: (key: string, pressed: boolean) => {
      const k = key.length === 1 ? key.toLowerCase() : key;
      const dir = ({ ArrowLeft: "left", a: "left", q: "left", ArrowRight: "right", d: "right", ArrowUp: "up", w: "up", z: "up", ArrowDown: "down", s: "down" } as Record<string, keyof typeof held>)[k];
      if (dir) {
        held[dir] = pressed;
        if (pressed) pointerActive = false;
      }
      if (space && (k === "Enter" || k === "f")) firing = pressed && phase === "playing";
      if (pressed && k === " ") {
        if (space) launchTorpedo();
        else dodge();
      }
    },
    tick: (dt: number, reduced: boolean) => {
      if (disposed) return;
      const frozen = phase === "paused";
      const step = frozen ? 0 : dt;
      clock += step;
      camera.fov = THREE.MathUtils.damp(camera.fov, camera.aspect < 0.8 ? 80 : 60, 6, dt);
      camera.updateProjectionMatrix();

      if (phase === "intro" && clock >= 2.6) {
        phase = "playing";
        if (space) startWave(1);
        else {
          say("R2 : champ dense droit devant. Mieux vaut ne pas calculer nos chances.", 4.5);
          audio?.alarm();
        }
      }
      const playing = phase === "playing";
      const before = time;
      if (playing) time += step;

      // Keyboard aim for the battle: the sights drift while a key is held.
      if (space && (held.left || held.right || held.up || held.down)) {
        aim.x = THREE.MathUtils.clamp(aim.x + ((held.right ? 1 : 0) - (held.left ? 1 : 0)) * step * 1.3, -1, 1);
        aim.y = THREE.MathUtils.clamp(aim.y + ((held.up ? 1 : 0) - (held.down ? 1 : 0)) * step * 1.3, -1, 1);
      }

      // The ship: banks with lateral motion; in the asteroid field it actually moves.
      if (!space) {
        let ix = (held.right ? 1 : 0) - (held.left ? 1 : 0),
          iy = (held.up ? 1 : 0) - (held.down ? 1 : 0);
        if (!ix && !iy && pointerActive) {
          ix = Math.abs(aim.x) > 0.08 ? aim.x : 0;
          iy = Math.abs(aim.y) > 0.08 ? aim.y : 0;
        }
        if (!playing) ix = iy = 0;
        craft.vx = THREE.MathUtils.damp(craft.vx, ix * 26, 3.5, step);
        craft.vy = THREE.MathUtils.damp(craft.vy, iy * 18, 3.5, step);
        craft.x = THREE.MathUtils.clamp(craft.x + craft.vx * step, -46, 46);
        craft.y = THREE.MathUtils.clamp(craft.y + craft.vy * step, -26, 26);
      }
      field.rotation.z = THREE.MathUtils.damp(field.rotation.z, reduced ? 0 : space ? -aim.x * 0.05 : craft.vx * 0.012, 4, dt);
      field.updateMatrixWorld();
      fieldInverse.copy(field.matrixWorld).invert();

      // The view follows the sights a little, and shakes on impact.
      if (!reduced) {
        if (space) {
          camera.rotateY(-aim.x * 0.07);
          camera.rotateX(aim.y * 0.045);
        } else camera.rotateX(-craft.vy * 0.002);
        if (shake > 0) {
          camera.position.x += Math.sin(clock * 47) * shake * 0.03;
          camera.position.y += Math.cos(clock * 53) * shake * 0.025;
        }
      }
      camera.updateMatrixWorld();
      shake = THREE.MathUtils.damp(shake, 0, 4, step);
      hurt = THREE.MathUtils.damp(hurt, 0, 3, step);
      if (playing && time - lastHit > (space ? 4 : 3)) shields = Math.min(100, shields + step * (space ? 4 : 5));

      // Dust: faster in the asteroid field, where speed grows with time.
      const pace = space ? 34 : THREE.MathUtils.lerp(46, 88, Math.min(1, time / 180));
      for (let i = 0; i < DUST; i++) {
        let z = dust[i * 3 + 2] + pace * step;
        if (z > 10) {
          placeDust(i, -220);
          z = -220;
        }
        dust[i * 3 + 2] = z;
        const x = dust[i * 3] - (space ? 0 : craft.x * 0.3),
          y = dust[i * 3 + 1] - (space ? 0 : craft.y * 0.3),
          len = reduced ? 0.6 : pace * 0.05;
        dustLines.set([x, y, z, x, y, z - len], i * 6);
      }
      dustGeometry.getAttribute("position").needsUpdate = true;

      if (space) {
        // Waves and spawning.
        if (playing) {
          if (toSpawn > 0 && (spawnClock -= step) <= 0) {
            const elite = toSpawn <= eliteToSpawn;
            if (spawnFighter(elite)) {
              toSpawn--;
              if (elite) eliteToSpawn--;
            }
            spawnClock = 1.1;
          }
          if (wave > 0 && toSpawn === 0 && !fighters.some((f) => f.alive)) {
            if (wave >= WAVES.length) finish(true);
            else if (waveDelay < 0) {
              waveDelay = 2.8;
              say(`Vague ${wave} neutralisée. Bien joué, pilote.`, 2.6);
              audio?.ui("unlock");
            } else if ((waveDelay -= step) <= 0) {
              waveDelay = -1;
              startWave(wave + 1);
            }
          }
          if (firing && (fireClock -= step) <= 0) {
            fireCannons();
            fireClock = 0.13;
          }
        }
        // Fighters: they close in weaving, make a firing pass over the cockpit, then loop round.
        locked = null;
        raycaster.setFromCamera(aim, camera);
        let best = 0.1;
        for (const f of fighters) {
          if (!f.alive) continue;
          const speed = f.mode === "strafe" ? 72 : f.elite ? 54 : 44;
          tmp.copy(f.target);
          if (f.mode === "approach" && !reduced) tmp.add(tmp2.set(Math.sin(time * 1.1 + f.seed) * 14, Math.cos(time * 0.9 + f.seed) * 8, 0));
          tmp.sub(f.pos).normalize().multiplyScalar(speed);
          f.vel.lerp(tmp, 1 - Math.exp(-1.7 * step));
          f.pos.addScaledVector(f.vel, step);
          if (f.mode === "approach" && f.pos.distanceTo(f.target) < 20) {
            f.mode = "strafe";
            f.target.set((Math.random() < 0.5 ? -1 : 1) * rand(9, 24), rand(-8, 12), 70);
          }
          if (f.mode === "strafe" && !f.passed && f.pos.z > -6) {
            f.passed = true;
            if (Math.hypot(f.pos.x, f.pos.y) < 40) {
              audio?.whoosh();
              audio?.scream();
            }
          }
          if (f.mode === "strafe" && f.pos.z > 30) {
            f.mode = "approach";
            f.passed = false;
            f.pos.set(rand(-90, 90), rand(-40, 40), rand(-260, -220));
            f.vel.set(0, 0, 30);
            approachTarget(f);
          }
          f.group.position.copy(f.pos);
          f.group.lookAt(toWorld(tmp2.copy(f.pos).add(f.vel), tmp2));
          f.group.rotateZ(reduced ? 0 : Math.sin(time * 0.8 + f.seed) * 0.4);
          f.flash = THREE.MathUtils.damp(f.flash, 0, 10, step);

          // Return fire: some bolts are on target, most streak past the canopy.
          const distance = f.pos.distanceTo(ship);
          if (playing && f.pos.z < -20 && distance < 150 && time > f.nextShot) {
            f.nextShot = time + rand(1.6, 3.2) / (1 + (wave - 1) * 0.25) / (f.elite ? 1.25 : 1);
            const hits = Math.random() < 0.17 + (wave - 1) * 0.06 + (f.elite ? 0.1 : 0);
            tmp.copy(ship).add(hits ? tmp2.set(rand(-0.5, 0.5), rand(-0.4, 0.4), 0) : tmp2.set(rand(-1, 1), rand(-1, 1), 0).normalize().multiplyScalar(rand(5, 10)));
            from.copy(f.pos);
            const b = bolt(true, from, tmp.clone().sub(from), 150);
            if (b) {
              b.hits = hits;
              b.impact = from.distanceTo(tmp);
              b.damage = f.elite ? 13 : 9;
            }
            audio?.enemyLaser();
          }
          // The sights lock on the fighter closest to the line of fire.
          toWorld(f.pos, tmp).sub(camera.position);
          const along = tmp.length();
          const angle = tmp.normalize().angleTo(raycaster.ray.direction);
          if (along < 230 && angle < best) {
            best = angle;
            locked = f;
          }
        }
        for (const b of bolts) {
          if (!b.active) continue;
          const move = b.vel.length() * step;
          b.mesh.position.addScaledVector(b.vel, step);
          b.travelled += move;
          b.ttl -= step;
          if (b.travelled >= b.impact) {
            if (b.enemy) {
              b.impact = Infinity;
              if (b.hits) {
                if (playing) damage(b.damage);
                b.active = false;
                b.mesh.visible = false;
                continue;
              }
            } else if (b.fighter) {
              if (b.fighter.alive) {
                landed++;
                hurtFighter(b.fighter, 1);
              }
              b.active = false;
              b.mesh.visible = false;
              continue;
            }
          }
          if (b.ttl <= 0) {
            b.active = false;
            b.mesh.visible = false;
          }
        }
        for (const t of torpedoes) {
          if (!t.active) continue;
          t.ttl -= step;
          if (t.target?.alive) {
            tmp.copy(t.target.pos).sub(t.mesh.position).normalize().multiplyScalar(115);
            t.vel.lerp(tmp, 1 - Math.exp(-5 * step));
          } else t.vel.multiplyScalar(1 + step * 0.8);
          t.mesh.position.addScaledVector(t.vel, step);
          const reached = t.target?.alive && t.mesh.position.distanceTo(t.target.pos) < 4.5;
          if (reached || t.ttl <= 0) {
            t.active = false;
            t.mesh.visible = false;
            explode(t.mesh.position, 1.8);
            for (const f of fighters) if (f.alive && f.pos.distanceTo(t.mesh.position) < (f === t.target ? 6 : 18)) hurtFighter(f, f === t.target ? 99 : 3, true);
          }
        }
        audio?.engine(playing ? 0.05 : 0.02, 48);
      } else {
        // The asteroid field thickens and speeds up; a near miss pays, contact hurts.
        if (playing) {
          score += step * 10;
          const interval = THREE.MathUtils.lerp(0.85, 0.2, Math.min(1, time / 170));
          if ((rockClock -= step) <= 0) {
            spawnRock();
            if (time > 60 && Math.random() < 0.3) spawnRock();
            rockClock = interval * rand(0.7, 1.3);
          }
          if (!goalReached && time >= ASTEROID_GOAL) {
            goalReached = true;
            show("OBJECTIF ATTEINT", "Continuez pour le record ou retirez-vous", 3.5);
            say("Mission validée ! Tenez jusqu’à trois minutes pour entrer dans la légende.", 5);
            audio?.ui("unlock");
          }
          if (before < 60 && time >= 60) say("La densité du champ augmente. Restez concentré.", 3.5);
          if (before < 150 && time >= 150) say("Encore trente secondes, Commandant !", 3.5);
          if (time >= ASTEROID_MASTER) finish(true);
        }
        for (const rock of rocks) {
          if (!rock.active) continue;
          rock.pos.z += rock.speed * step;
          rock.mesh.rotation.x += rock.spin.x * step * 0.6;
          rock.mesh.rotation.y += rock.spin.y * step * 0.6;
          rock.mesh.position.set(rock.pos.x - craft.x, rock.pos.y - craft.y, rock.pos.z);
          if (!rock.checked && rock.pos.z >= SHIP.z - rock.r * 0.4) {
            rock.checked = true;
            const d = Math.hypot(rock.pos.x - craft.x, rock.pos.y - craft.y);
            if (playing && d < rock.r * 0.8 + 1.7) {
              explode(tmp.set(rock.pos.x - craft.x, rock.pos.y - craft.y, -5), Math.min(1.6, rock.r / 4), true);
              audio?.crash();
              rock.active = false;
              rock.mesh.visible = false;
              damage(14 + rock.r * 5);
              continue;
            } else if (playing && d < rock.r + 7) {
              nearMisses++;
              combo = Math.min(10, combo + 1);
              score += 25 * combo;
              audio?.whoosh();
              if (combo >= 3) say(`Passage au ras ! Combo ×${combo}`, 1.4);
            }
          }
          if (rock.pos.z > 14) {
            rock.active = false;
            rock.mesh.visible = false;
          }
        }
        audio?.engine(playing ? 0.05 + Math.min(0.04, Math.hypot(craft.vx, craft.vy) * 0.002) : 0.02, 52 + Math.hypot(craft.vx, craft.vy) * 1.2);
      }

      for (const blast of blasts) {
        if (!blast.active) continue;
        blast.age += step;
        const k = blast.age / blast.life;
        if (k >= 1) {
          blast.active = false;
          blast.group.visible = false;
          continue;
        }
        const s = blast.size;
        blast.core.scale.setScalar(s * (0.6 + k * 2.2) * (blast.rocky ? 0.45 : 1));
        blast.fire.scale.setScalar(s * (1 + k * 5));
        (blast.core.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - k * 2.2);
        (blast.fire.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.85 * (1 - k));
        blast.debris.forEach((piece, i) => {
          piece.position.addScaledVector(blast.velocity[i], step);
          piece.rotation.x += step * 4;
          piece.rotation.y += step * 3;
        });
      }
      flashLight.intensity = THREE.MathUtils.damp(flashLight.intensity, 0, 6, step);
      if ((uiClock += dt) >= 0.08) {
        uiClock = 0;
        publish();
      }
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      firing = false;
      audio?.engine(0);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
      world.removeFromParent();
      owned.geometries.forEach((item) => item.dispose());
      owned.materials.forEach((item) => item.dispose());
      owned.textures.forEach((item) => item.dispose());
      camera.fov = prior.fov;
      camera.updateProjectionMatrix();
    },
  };
}
export type CockpitGameRuntime = ReturnType<typeof createCockpitGame>;
