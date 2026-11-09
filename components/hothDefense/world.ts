import * as THREE from "three";
import { createATAT } from "../atatModel";
import { createProbeDroid } from "../probeDroid";
import { createSandtrooper } from "../stormtrooperModel";
import { bakePart, part, rounded } from "../tatooineCharacters";
import type { DefenseEvent, DefenseState, EnemyKind } from "./types";
import { BOSS_SCALE } from "./simulation";
import { ATAT_SCALE } from "../atatModel";

const GROUND = -8, MAX_BOLTS = 96, MAX_DEBRIS = 200, MAX_SMOKE = 12;
type Actor = {
  root: THREE.Group; visual: THREE.Group; kind: EnemyKind;
  walker?: ReturnType<typeof createATAT>; markers: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[];
  hit: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  deadAge: number;
};
type Debris = { age: number; life: number; p: THREE.Vector3; v: THREE.Vector3; size: number; hot: boolean };

/** The battlefield is placed beyond the existing cockpit's windscreen; it owns no camera or renderer. */
export function createHothDefenseWorld() {
  const group = new THREE.Group(); group.name = "defense-of-hoth-battlefield";
  let seed = 1980;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const snow = new THREE.MeshStandardMaterial({ color: 0xdce8ed, roughness: .97 });
  const ice = new THREE.MeshStandardMaterial({ color: 0x9bb8ca, roughness: .72, metalness: .08 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x687984, roughness: .7, metalness: .42 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x273945, roughness: .68, metalness: .3 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xc8f4ff, toneMapped: false });
  const amber = new THREE.MeshBasicMaterial({ color: 0xffca86, toneMapped: false });

  // A cold horizon, with the light source carried by the cloud layer rather than a flat blue void.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(540, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: "varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: `varying vec3 v;
      void main(){
        vec3 n=normalize(v);float h=smoothstep(-.1,.65,n.y);
        vec3 c=mix(vec3(.77,.84,.87),vec3(.35,.47,.58),h);
        float sun=pow(max(0.,dot(n,normalize(vec3(-.45,.38,-1.)))),32.);
        gl_FragColor=vec4(c+sun*vec3(.18,.16,.12),1.);
        #include <colorspace_fragment>
      }`,
    toneMapped: false,
  }));
  sky.name = "hoth-blizzard-sky"; group.add(sky);
  const hemi = new THREE.HemisphereLight(0xc5deef, 0x586572, 1.1);
  const sun = new THREE.DirectionalLight(0xe4eef4, 1.65); sun.position.set(-80, 110, 30);
  group.add(hemi, sun);

  const painted = document.createElement("canvas"); painted.width = painted.height = 256;
  const c = painted.getContext("2d")!; c.fillStyle = "#e5eef2"; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1500; i++) { c.fillStyle = i % 3 ? "#ffffff29" : "#6d87921a"; c.fillRect(rand() * 256, rand() * 256, .5 + rand() * 2, .5 + rand() * 2); }
  for (let i = 0; i < 80; i++) {
    const x = rand() * 256, y = rand() * 256;
    c.strokeStyle = "#8ea6b416"; c.lineWidth = .5;
    c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + 12, y + 1, x + 25, y - 3, x + 45, y - 1); c.stroke();
  }
  const snowMap = new THREE.CanvasTexture(painted); snowMap.colorSpace = THREE.SRGBColorSpace;
  snowMap.wrapS = snowMap.wrapT = THREE.RepeatWrapping; snowMap.repeat.set(50, 50); snowMap.anisotropy = 4;
  snow.map = snowMap; snow.bumpMap = snowMap; snow.bumpScale = .1;

  const groundGeo = new THREE.PlaneGeometry(950, 850, 112, 100).rotateX(-Math.PI / 2);
  const vertices = groundGeo.getAttribute("position"), colors: number[] = [];
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), z = vertices.getZ(i) - 200;
    const far = THREE.MathUtils.smoothstep(-z, 145, 340);
    const height = (Math.sin(x * .035 + z * .013) * 2.5 + Math.sin(z * .055) * 1.7) * far;
    vertices.setXYZ(i, x, GROUND + height, z);
    const tint = .89 + (Math.sin(x * .09 + z * .07) + Math.sin(x * .023 - z * .038)) * .025;
    colors.push(tint, tint + .025, Math.min(1, tint + .05));
  }
  groundGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3)); groundGeo.computeVertexNormals();
  const terrainMaterial = snow.clone(); terrainMaterial.vertexColors = true;
  const terrain = new THREE.Mesh(groundGeo, terrainMaterial); terrain.name = "hoth-battle-snowfield"; terrain.receiveShadow = true; group.add(terrain);

  const landscape = new THREE.Group(); landscape.name = "echo-base-installations"; group.add(landscape);
  // Connected mountain masses: broad shoulders, secondary summits and broken crags.
  // Separate depth layers disappear gradually into the white-out; isolated repeated cones do not.
  const hash = (x: number) => { const n = Math.sin(x * 127.1) * 43758.5453; return n - Math.floor(n); };
  const ridgeNoise = (x: number) => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return THREE.MathUtils.lerp(hash(i), hash(i + 1), u);
  };
  for (let layer = 0; layer < 3; layer++) {
    const across = 176, depth = 10, positions: number[] = [], tints: number[] = [], uv: number[] = [], indices: number[] = [];
    const offset = layer * 28.7, front = -260 - layer * 82;
    const peaks = Array.from({ length: 13 }, (_, i) => ({ x: -550 + i * 91 + (hash(i * 7 + offset) - .5) * 55, width: 40 + hash(i * 11 + offset) * 65, height: 42 + hash(i * 23 + offset) * 95 }));
    for (let row = 0; row <= depth; row++) for (let column = 0; column <= across; column++) {
      const x = -620 + column / across * 1240;
      const ridge = peaks.reduce((height, peak) => Math.max(height, peak.height * Math.exp(-Math.pow(Math.abs((x - peak.x) / peak.width), 1.45))), 0);
      const crest = .43 + (ridgeNoise(x * .009 + offset) - .5) * .18;
      const v = row / depth;
      const slope = v < crest ? v / crest : (1 - v) / (1 - crest);
      const crag = (ridgeNoise(x * .08 + row * .25 + offset) - .5) * 12 + (ridgeNoise(x * .21 + offset) - .5) * 5;
      const height = Math.max(0, ridge * Math.pow(Math.max(0, slope), .78) + crag * Math.sin(v * Math.PI));
      const z = front - v * 122 - ridgeNoise(x * .015 + offset) * 20;
      positions.push(x, GROUND - 2 + height, z); uv.push(column / across, v);
      const rock = Math.max(0, Math.sin(x * .045 + row * 1.3 + offset)) * .14 * Math.sin(v * Math.PI);
      const shade = .86 + layer * .035 - rock;
      tints.push(shade - .045, shade, Math.min(1, shade + .045));
    }
    for (let row = 0; row < depth; row++) for (let column = 0; column < across; column++) {
      const a = row * (across + 1) + column, b = a + 1, c = a + across + 1, d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(tints, 3)); geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const massif = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xd2e0e9, vertexColors: true, roughness: 1 }));
    massif.name = `hoth-mountain-ridge-${layer}`; landscape.add(massif);
  }
  // The ice wall is kept well left of the combat lane, so it frames instead of hiding targets.
  for (let i = 0; i < 9; i++) {
    const h = 25 + rand() * 12;
    const cliff = part(landscape, rounded(16, h, 13, 2), ice, [-160 + i * 12, GROUND + h / 2, -56 - rand() * 8]);
    cliff.rotation.y = rand() * .15; cliff.rotation.z = (rand() - .5) * .035;
  }
  // Echo Base, to the left of the battlefield: the shield generator's tall tower and the great ion
  // cannon rise above the dashboard, power units and trenches at their feet. The attack target is [-26,4,-80].
  const base = new THREE.Group(); base.position.set(-26, GROUND, -80); landscape.add(base);
  const hull = new THREE.MeshStandardMaterial({ color: 0xb4c2ca, roughness: .55, metalness: .35 });
  part(base, new THREE.SphereGeometry(7.5, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), snow, [6, 0, 4]).scale.set(1.25, .5, 1);
  part(base, rounded(7.2, 3.2, 1.3, .5), ice, [6, 1.5, 10.6]);
  part(base, rounded(5.7, 2.6, .2, .5), dark, [6, 1.25, 11.3]);
  for (const x of [3.6, 8.4]) part(base, new THREE.BoxGeometry(.1, 1.8, .08), glow, [x, 1.3, 11.45]);
  // Shield generator: a tapering lattice tower carrying the projector dish.
  part(base, new THREE.CylinderGeometry(1.1, 2.6, 22, 12), hull, [0, 11, 0]);
  for (let i = 0; i < 6; i++) part(base, new THREE.TorusGeometry(2.4 - i * .24, .12, 6, 18), dark, [0, 2 + i * 3.6, 0], [Math.PI / 2, 0, 0]);
  part(base, new THREE.CylinderGeometry(4.2, 1.2, 1.6, 24), hull, [0, 22.6, 0], [.18, 0, .1]);
  part(base, new THREE.CylinderGeometry(3.9, 3.9, .12, 24), snow, [0, 23.55, .1], [.18, 0, .1]);
  part(base, new THREE.CylinderGeometry(3.8, 3.8, .2, 24), dark, [0, 23.4, .1], [.18, 0, .1]);
  part(base, new THREE.CylinderGeometry(.18, .3, 3, 8), steel, [0, 25, .3]);
  part(base, new THREE.SphereGeometry(.4, 10, 8), amber, [0, 26.6, .3]);
  // Ion cannon: a great sphere on its armoured plinth, its barrel raised towards the sky.
  part(base, new THREE.CylinderGeometry(4.4, 5.4, 4, 18), dark, [-11, 2, -6]);
  part(base, new THREE.SphereGeometry(5.6, 28, 18), hull, [-11, 8.6, -6]);
  part(base, new THREE.SphereGeometry(5.7, 28, 8, 0, Math.PI * 2, 0, .7), snow, [-11, 8.6, -6]);
  part(base, new THREE.TorusGeometry(5.65, .22, 8, 32), dark, [-11, 8.6, -6], [Math.PI / 2, 0, 0]);
  part(base, new THREE.CylinderGeometry(.9, 1.3, 9, 14), steel, [-11, 14, -3.4], [-.55, 0, 0]);
  part(base, new THREE.CylinderGeometry(1.15, 1.15, .5, 14), dark, [-11, 17.7, -1.1], [-.55, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const x = 9 + i * 2.7;
    part(base, new THREE.CylinderGeometry(1.1, 1.3, 1.6, 16), steel, [x, .8, -4.5]);
    part(base, new THREE.SphereGeometry(1.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), snow, [x, 1.6, -4.5]);
    for (const y of [.3, .7, 1.1]) part(base, new THREE.TorusGeometry(1.27, .07, 5, 16), dark, [x, y, -4.5], [Math.PI / 2, 0, 0]);
  }
  // Trenches facing the plain, with rebel gun emplacements.
  for (let i = 0; i < 5; i++) {
    part(base, rounded(6, 1.1, 1.4, .3), snow, [-14 + i * 7, .4, -14 - (i % 2) * 1.5]);
    part(base, new THREE.CylinderGeometry(.14, .2, 2.4, 8), dark, [-12 + i * 7, 1.4, -15.2], [Math.PI / 2 - .25, 0, 0]);
  }
  for (const [x, z] of [[-35, -28], [34, -40], [48, -60]]) {
    part(landscape, rounded(6, .9, 3.3, .2), steel, [x, GROUND + .45, z]);
    part(landscape, new THREE.CylinderGeometry(.3, .42, 3.5, 10), dark, [x, GROUND + 2.3, z]);
    const gun = part(landscape, new THREE.CylinderGeometry(.12, .2, 4, 10), steel, [x, GROUND + 4.2, z + 1], [Math.PI / 2 - .18, 0, 0]);
    gun.rotation.z = x < 0 ? -.15 : .2;
  }
  for (let i = 0; i < 12; i++) {
    const x = -42 + i * 8;
    // Defences flank the clear firing lane rather than creating a wall in front of the pilot.
    if (Math.abs(x) < 21) continue;
    part(landscape, rounded(5.5, .8, 1.5, .3), snow, [x, GROUND + .25, -35 - (i % 2) * 9]);
  }
  bakePart(landscape);

  const shield = new THREE.Mesh(new THREE.SphereGeometry(17, 28, 16), new THREE.MeshBasicMaterial({ color: 0x79cfee, transparent: true, opacity: .025, depthWrite: false, wireframe: true, toneMapped: false }));
  shield.position.set(-26, GROUND + 1, -80); shield.scale.y = .9; shield.name = "echo-base-shield"; group.add(shield);

  // A fixed snow budget: the same buffers are moved in place, with no per-frame allocation.
  const snowCount = 800, snowPositions = new Float32Array(snowCount * 3), snowSeeds = new Float32Array(snowCount);
  for (let i = 0; i < snowCount; i++) {
    snowPositions[i * 3] = rand() * 220 - 110; snowPositions[i * 3 + 1] = rand() * 65 + GROUND;
    snowPositions[i * 3 + 2] = -12 - rand() * 255; snowSeeds[i] = rand();
  }
  const initialSnowPositions = snowPositions.slice();
  const snowGeometry = new THREE.BufferGeometry(); snowGeometry.setAttribute("position", new THREE.BufferAttribute(snowPositions, 3)); snowGeometry.setAttribute("size", new THREE.BufferAttribute(snowSeeds, 1));
  const snowMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, toneMapped: false,
    vertexShader: `attribute float size;varying float a;void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp((70.+size*85.)/max(1.,-p.z),1.,6.);a=.18+size*.32;gl_Position=projectionMatrix*p;}`,
    fragmentShader: `varying float a;void main(){float d=length(gl_PointCoord-.5);float o=1.-smoothstep(.1,.5,d);gl_FragColor=vec4(.84,.94,1.,o*a);}`,
  });
  const snowfall = new THREE.Points(snowGeometry, snowMaterial); snowfall.frustumCulled = false; snowfall.name = "hoth-battle-blizzard"; group.add(snowfall);
  // A subset of the same snow particles leaves thin, wind-driven trails.
  // No additional snow simulation or particle pool is allocated.
  const streakPositions = new Float32Array(48 * 6), streakGeometry = new THREE.BufferGeometry();
  streakGeometry.setAttribute("position", new THREE.BufferAttribute(streakPositions, 3));
  const streaks = new THREE.LineSegments(streakGeometry, new THREE.LineBasicMaterial({ color: 0x829eae, transparent: true, opacity: .21, depthWrite: false }));
  streaks.frustumCulled = false; streaks.name = "hoth-blizzard-wind-streaks"; group.add(streaks);
  const placeStreaks = () => {
    for (let i = 0; i < 48; i++) {
      const particle = i * 11, at = i * 6, p = particle * 3, length = 1.4 + snowSeeds[particle] * 2.6;
      streakPositions[at] = snowPositions[p]; streakPositions[at + 1] = snowPositions[p + 1]; streakPositions[at + 2] = snowPositions[p + 2];
      streakPositions[at + 3] = snowPositions[p] - length; streakPositions[at + 4] = snowPositions[p + 1] + length * .2; streakPositions[at + 5] = snowPositions[p + 2] - .15;
    }
    streakGeometry.attributes.position.needsUpdate = true;
  };
  placeStreaks();

  const templates = new THREE.Group(); templates.visible = false; group.add(templates);
  const probe = createProbeDroid().group; probe.scale.setScalar(3); templates.add(probe);
  const makeVehicle = (heavy: boolean) => {
    const root = new THREE.Group(), armor = new THREE.MeshStandardMaterial({ color: heavy ? 0x7c8a91 : 0x616e77, roughness: .62, metalness: .38 });
    part(root, rounded(heavy ? 6.4 : 3.8, 1.25, heavy ? 8 : 5, .35), armor, [0, 1.45, 0]);
    part(root, rounded(heavy ? 4.5 : 2.9, .75, heavy ? 4.5 : 2.7, .22), armor, [0, 2.4, -.4]);
    part(root, rounded(heavy ? 3.9 : 2.1, .18, .12, .03), dark, [0, 2.62, heavy ? 1.87 : 1.02]);
    for (const x of [-1, 1]) {
      const side = x * (heavy ? 2.9 : 1.8);
      part(root, rounded(.7, .8, heavy ? 8.3 : 5.1, .3), dark, [side, .65, 0]);
      for (let i = 0; i < (heavy ? 7 : 4); i++) part(root, new THREE.CylinderGeometry(.42, .42, .1, 10), steel, [side + x * .36, .6, (i - (heavy ? 3 : 1.5)) * 1.05], [0, 0, Math.PI / 2]);
      part(root, new THREE.CylinderGeometry(.12, .16, heavy ? 4.5 : 2.9, 10), armor, [x * .6, 2.55, heavy ? 3.7 : 2.5], [Math.PI / 2, 0, 0]);
      part(root, new THREE.CylinderGeometry(.18, .18, .14, 10), dark, [x * .6, 2.55, heavy ? 5.93 : 3.96], [Math.PI / 2, 0, 0]);
      part(root, new THREE.BoxGeometry(.12, .1, .05), amber, [x * (heavy ? 2.2 : 1.3), 1.65, heavy ? 4.06 : 2.56]);
    }
    part(root, new THREE.CylinderGeometry(.025, .04, heavy ? 2.8 : 1.8, 6), dark, [1, heavy ? 3.9 : 3.3, -1]);
    bakePart(root); templates.add(root); return root;
  };
  const scout = makeVehicle(false), tank = makeVehicle(true);
  const actors = new Map<number, Actor>(), pools: Record<EnemyKind, Actor[]> = { probe: [], scout: [], tank: [], atat: [] };
  const markerGeometry = new THREE.RingGeometry(.8, 1, 32);
  const getActor = (kind: EnemyKind): Actor => {
    const reused = pools[kind].pop(); if (reused) { reused.root.visible = true; reused.deadAge = 0; return reused; }
    const root = new THREE.Group(); root.name = `battle-enemy-${kind}`; group.add(root);
    const walker = kind === "atat" ? createATAT() : undefined;
    walker?.root.scale.setScalar(BOSS_SCALE);
    const visual = walker?.root ?? (kind === "probe" ? probe : kind === "scout" ? scout : tank).clone(true);
    root.add(visual);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd7a3, transparent: true, opacity: 0, wireframe: true, depthWrite: false, toneMapped: false })); root.add(hit);
    const markers = kind === "atat" ? Array.from({ length: 4 }, () => {
      const marker = new THREE.Mesh(markerGeometry, new THREE.MeshBasicMaterial({ color: 0xffbd6a, transparent: true, opacity: .75, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
      root.add(marker); return marker;
    }) : [];
    return { root, visual, kind, walker, hit, markers, deadAge: 0 };
  };

  const boltGeometry = new THREE.CylinderGeometry(.055, .055, 1, 6);
  const bolts = new THREE.InstancedMesh(boltGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), MAX_BOLTS);
  bolts.instanceMatrix.setUsage(THREE.DynamicDrawUsage); bolts.frustumCulled = false; bolts.count = 0; bolts.name = "hoth-live-projectiles"; group.add(bolts);
  const dummy = new THREE.Object3D(), axis = new THREE.Vector3(0, 1, 0), direction = new THREE.Vector3(), color = new THREE.Color();

  const debrisMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.14, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), MAX_DEBRIS);
  debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); debrisMesh.frustumCulled = false; debrisMesh.count = 0; group.add(debrisMesh);
  const debris: Debris[] = Array.from({ length: MAX_DEBRIS }, () => ({ age: 10, life: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), size: 1, hot: false }));
  let debrisCursor = 0;
  const smokeCanvas = document.createElement("canvas"); smokeCanvas.width = smokeCanvas.height = 64;
  const sc = smokeCanvas.getContext("2d")!, grad = sc.createRadialGradient(32, 32, 1, 32, 32, 32);
  grad.addColorStop(0, "#dce6edcc"); grad.addColorStop(.3, "#68717b88"); grad.addColorStop(1, "#353f4900"); sc.fillStyle = grad; sc.fillRect(0, 0, 64, 64);
  const smokeMap = new THREE.CanvasTexture(smokeCanvas);
  const smoke = Array.from({ length: MAX_SMOKE }, () => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeMap, color: 0x606874, transparent: true, depthWrite: false, opacity: 0 })); sprite.visible = false; group.add(sprite);
    return { sprite, age: 10, life: 4, size: 4 };
  });
  let smokeCursor = 0;
  const impactFlash = new THREE.PointLight(0xffae68, 0, 35, 2); group.add(impactFlash);
  const ionPulse = new THREE.Mesh(new THREE.RingGeometry(.94, 1, 64), new THREE.MeshBasicMaterial({ color: 0x79eaff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  ionPulse.position.set(0, 1, -35); ionPulse.visible = false; group.add(ionPulse);
  let pulseAge = 10;
  const scatter = (position: [number, number, number], big: boolean) => {
    const count = big ? 38 : 9;
    for (let i = 0; i < count; i++) {
      const bit = debris[debrisCursor++ % MAX_DEBRIS]; bit.age = 0; bit.life = (big ? 1.4 : .35) + rand() * 1.2;
      bit.p.set(...position); bit.v.set((rand() - .5) * (big ? 14 : 5), 2 + rand() * (big ? 13 : 5), (rand() - .5) * (big ? 14 : 5));
      bit.size = (big ? 1.5 : .45) + rand() * 2; bit.hot = i % 3 !== 0;
    }
    if (big) {
      const puff = smoke[smokeCursor++ % MAX_SMOKE]; puff.age = 0; puff.life = 4.5; puff.size = 3.5 + rand() * 3;
      puff.sprite.visible = true; puff.sprite.position.set(...position); puff.sprite.material.rotation = rand() * Math.PI;
    }
    impactFlash.position.set(...position); impactFlash.intensity = big ? 80 : 20;
  };

  // AT-ATs on the horizon, plodding through the blizzard as grey silhouettes: scenery only.
  const horizon = ([[-150, -310, .3], [170, -350, -.22]] as const).map(([x, z, turn], i) => {
    const walker = createATAT();
    walker.root.name = `hoth-horizon-walker-${i}`;
    walker.root.position.set(x, GROUND, z); walker.root.rotation.y = turn; walker.root.scale.setScalar(ATAT_SCALE);
    group.add(walker.root);
    return { walker, x, z, turn, offset: i * 1.7 };
  });
  // Sparks thrown from the dashboard when the ship itself is hit.
  const MAX_SPARKS = 48;
  const sparkMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.02, 0), new THREE.MeshBasicMaterial({ color: 0xffc070, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), MAX_SPARKS);
  sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); sparkMesh.frustumCulled = false; sparkMesh.count = 0; sparkMesh.name = "cockpit-damage-sparks"; group.add(sparkMesh);
  const sparks = Array.from({ length: MAX_SPARKS }, () => ({ age: 10, life: .6, p: new THREE.Vector3(), v: new THREE.Vector3() }));
  let sparkCursor = 0;
  const spark = () => {
    const side = rand() < .5 ? -1 : 1;
    for (let i = 0; i < 14; i++) {
      const bit = sparks[sparkCursor++ % MAX_SPARKS]; bit.age = 0; bit.life = .35 + rand() * .5;
      bit.p.set(side * (.6 + rand() * .7), 1.0 + rand() * .15, -1.55 + rand() * .2);
      bit.v.set((rand() - .5) * 2.4 - side * .6, 1 + rand() * 2.2, .4 + rand() * 1.4);
    }
  };

  const trooper = createSandtrooper(); trooper.group.name = "hoth-slipping-stormtrooper"; trooper.group.position.set(40, GROUND, -96); trooper.group.scale.setScalar(2); group.add(trooper.group);
  let quality = 2, fxTime = 0, lastTime = 0, shieldHit = 0;
  const cameraPoint = new THREE.Vector3(0, 1.55, 2.9);
  const resetEffects = () => {
    for (const bit of debris) bit.age = 10;
    for (const bit of sparks) bit.age = 10;
    for (const puff of smoke) { puff.age = 10; puff.sprite.visible = false; }
    impactFlash.intensity = 0; shieldHit = 0; fxTime = 0; pulseAge = 10; ionPulse.visible = false;
    snowPositions.set(initialSnowPositions); snowGeometry.attributes.position.needsUpdate = true; placeStreaks();
    actors.forEach(actor => { actor.root.visible = false; pools[actor.kind].push(actor); }); actors.clear();
  };

  return {
    group,
    setQuality: (level: number) => {
      quality = THREE.MathUtils.clamp(level, 0, 2);
      snowGeometry.setDrawRange(0, quality === 2 ? 800 : quality === 1 ? 400 : 180);
      streakGeometry.setDrawRange(0, quality === 2 ? 96 : quality === 1 ? 48 : 24);
      terrainMaterial.bumpScale = quality > 0 ? .1 : 0;
    },
    update: (state: DefenseState, events: DefenseEvent[], dt: number, reduced: boolean) => {
      if (state.time < lastTime) resetEffects(); lastTime = state.time;
      const frozen = state.phase === "paused" || state.phase === "briefing";
      const step = frozen ? 0 : Math.min(.1, Math.max(0, dt));
      if (!reduced) fxTime += step;
      if (!reduced && step) {
        const count = quality === 2 ? 800 : quality === 1 ? 400 : 180;
        const wind = 8 + (state.wave === 3 ? 8 : 0);
        for (let i = 0; i < count; i++) {
          const at = i * 3;
          snowPositions[at] += step * (wind + snowSeeds[i] * 7);
          snowPositions[at + 1] -= step * (4 + snowSeeds[i] * 3);
          if (snowPositions[at] > 110) snowPositions[at] = -110;
          if (snowPositions[at + 1] < GROUND) snowPositions[at + 1] = 57;
        }
        snowGeometry.attributes.position.needsUpdate = true;
        placeStreaks();
      }
      const seen = new Set<number>();
      state.enemies.forEach(enemy => {
        let actor = actors.get(enemy.id);
        if (actor && actor.kind !== enemy.kind) {
          actor.root.visible = false; pools[actor.kind].push(actor); actors.delete(enemy.id); actor = undefined;
        }
        if (!actor && enemy.alive) { actor = getActor(enemy.kind); actors.set(enemy.id, actor); }
        if (!actor) return; seen.add(enemy.id);
        if (!enemy.alive && enemy.kind !== "atat") { actor.root.visible = false; actors.delete(enemy.id); pools[actor.kind].push(actor); return; }
        actor.root.position.set(...enemy.position);
        if (actor.walker) {
          actor.walker.pose(reduced ? 0 : state.time, () => GROUND);
          actor.walker.body.position.y -= 7.5 * enemy.collapse;
          actor.walker.body.rotation.z = enemy.alive ? .025 * enemy.collapse : 0;
          if (enemy.collapse > 0) actor.walker.legs.forEach((leg, i) => {
            leg.hip.rotation.x += (i % 2 ? -.8 : .8) * enemy.collapse;
            leg.knee.rotation.x += 1.1 * enemy.collapse;
          });
          if (!enemy.alive) {
            actor.deadAge += step;
            const fall = THREE.MathUtils.smoothstep(actor.deadAge, 0, 2.6);
            actor.visual.rotation.z = reduced ? .65 : fall * .65;
            actor.visual.position.y = reduced ? -3 : -fall * 3;
          } else { actor.visual.rotation.z = 0; actor.visual.position.y = 0; }
        } else {
          actor.visual.rotation.y = Math.atan2(-enemy.position[0] * .2, 100);
          if (enemy.kind === "probe") { actor.visual.rotation.z = reduced ? 0 : Math.sin(state.time * 1.2 + enemy.id) * .09; }
        }
        actor.hit.scale.setScalar(enemy.kind === "atat" ? 8 * BOSS_SCALE : enemy.radius * 1.15);
        actor.hit.position.y = enemy.kind === "atat" ? (13 - 7.5 * enemy.collapse) * BOSS_SCALE : enemy.kind === "probe" ? 0 : 1.7;
        actor.hit.material.opacity = enemy.flash * .45;
        actor.hit.visible = enemy.alive && enemy.flash > .01;
        actor.markers.forEach((marker, i) => {
          const wp = enemy.weakpoints[i]; marker.visible = !!wp && enemy.alive && wp.hp > 0;
          if (!wp) return;
          marker.position.set(wp.position[0] - enemy.position[0], wp.position[1] - enemy.position[1], wp.position[2] - enemy.position[2]);
          marker.lookAt(cameraPoint); marker.scale.setScalar(wp.radius * 1.13);
          marker.material.color.setHex(wp.vulnerable ? 0xffc579 : 0x6f91a6);
          marker.material.opacity = wp.vulnerable ? .65 + (reduced ? 0 : Math.sin(state.time * 3) * .13) : .22;
        });
      });
      actors.forEach((actor, id) => { if (!seen.has(id)) { actor.root.visible = false; pools[actor.kind].push(actor); actors.delete(id); } });
      let activeBolts = 0;
      state.projectiles.forEach(bolt => {
        if (!bolt.active || activeBolts >= MAX_BOLTS) return;
        dummy.position.set(...bolt.position);
        direction.set(...bolt.velocity).normalize(); dummy.quaternion.setFromUnitVectors(axis, direction);
        dummy.scale.set(1, bolt.owner === "player" ? 4.8 : 3.5, 1); dummy.updateMatrix();
        bolts.setMatrixAt(activeBolts, dummy.matrix); bolts.setColorAt(activeBolts, color.setHex(bolt.owner === "player" ? 0x80ffc3 : 0xff544c)); activeBolts++;
      });
      bolts.count = activeBolts; bolts.instanceMatrix.needsUpdate = true; if (bolts.instanceColor) bolts.instanceColor.needsUpdate = true;
      events.forEach(event => {
        if ((event.type === "hit" || event.type === "explosion") && event.position) scatter(event.position, event.type === "explosion");
        if (event.type === "explosion" && event.position && (event.amount ?? 0) >= 4) {
          scatter([event.position[0], event.position[1] + 9, event.position[2] + 3], true);
          scatter([event.position[0] + 3, event.position[1] + 5, event.position[2] - 3], true);
        }
        if (event.type === "damage" && event.target === "base") shieldHit = 1;
        if (event.type === "damage" && event.target === "ship" && !reduced) spark();
        if (event.type === "special") { pulseAge = 0; ionPulse.visible = true; shieldHit = .5; }
      });
      if (pulseAge < 1.2) {
        pulseAge += step;
        ionPulse.scale.setScalar(reduced ? 28 : 2 + pulseAge * 70);
        ionPulse.material.opacity = Math.max(0, 1 - pulseAge / 1.2) * .45;
      } else ionPulse.visible = false;
      let visibleDebris = 0;
      for (const bit of debris) {
        if (bit.age >= bit.life) continue;
        bit.age += step; const fade = Math.max(0, 1 - bit.age / bit.life);
        if (!reduced) { bit.v.y -= step * 13; bit.p.addScaledVector(bit.v, step); if (bit.p.y < GROUND + .1) { bit.p.y = GROUND + .1; bit.v.y = Math.abs(bit.v.y) * .2; bit.v.x *= .95; bit.v.z *= .95; } }
        dummy.position.copy(bit.p); dummy.rotation.set(bit.age * 2, bit.age * 3, bit.age); dummy.scale.setScalar(bit.size * fade); dummy.updateMatrix();
        debrisMesh.setMatrixAt(visibleDebris, dummy.matrix); debrisMesh.setColorAt(visibleDebris, color.setHex(bit.hot ? (fade > .6 ? 0xffd58d : 0xbc6d39) : 0x647583)); visibleDebris++;
      }
      debrisMesh.count = visibleDebris; debrisMesh.instanceMatrix.needsUpdate = true; if (debrisMesh.instanceColor) debrisMesh.instanceColor.needsUpdate = true;
      smoke.forEach(puff => {
        if (puff.age >= puff.life) { puff.sprite.visible = false; return; }
        puff.age += step; const p = puff.age / puff.life;
        puff.sprite.material.opacity = Math.sin(p * Math.PI) * .4;
        puff.sprite.scale.setScalar(puff.size * (1 + p * 1.7));
        if (!reduced) { puff.sprite.position.x += step * 1.3; puff.sprite.position.y += step * .9; }
      });
      impactFlash.intensity *= Math.exp(-step * 12);
      shieldHit *= Math.exp(-step * 5); shield.material.opacity = .018 + shieldHit * .2;
      shield.material.color.setHex(state.base < 25 ? 0xff6c61 : 0x79cfee);
      // The horizon walkers keep plodding forward, looping back once they near the battle.
      horizon.forEach(item => {
        item.walker.root.visible = quality > 0;
        if (!item.walker.root.visible) return;
        if (!reduced) {
          item.walker.root.position.x += Math.sin(item.turn) * step * .55;
          item.walker.root.position.z += Math.cos(item.turn) * step * .55;
          if (item.walker.root.position.z > item.z + 60) item.walker.root.position.set(item.x, GROUND, item.z);
        }
        item.walker.pose(reduced ? 0 : fxTime * .6 + item.offset, () => GROUND);
      });
      let visibleSparks = 0;
      for (const bit of sparks) {
        if (bit.age >= bit.life) continue;
        bit.age += step; bit.v.y -= step * 6; bit.p.addScaledVector(bit.v, step);
        dummy.position.copy(bit.p); dummy.rotation.set(bit.age * 9, bit.age * 7, 0); dummy.scale.setScalar(Math.max(0, 1 - bit.age / bit.life) * 1.4); dummy.updateMatrix();
        sparkMesh.setMatrixAt(visibleSparks++, dummy.matrix);
      }
      sparkMesh.count = visibleSparks; sparkMesh.instanceMatrix.needsUpdate = true;
      // A distant, brief pratfall; no hitbox and no bearing on the objective.
      const slip = state.time - 44;
      trooper.group.visible = state.time > 38 && state.time < 57;
      trooper.tick(reduced ? 0 : fxTime, slip < 0, reduced);
      if (slip < 0 || reduced) { trooper.group.position.set(40, GROUND, -96); trooper.group.rotation.z = 0; trooper.arms.forEach(arm => arm.rotation.z = 0); }
      else {
        const t = THREE.MathUtils.smoothstep(slip, 0, 1);
        trooper.group.position.set(40 + Math.min(slip, 7) * 1.1, GROUND + .15 * t, -96);
        trooper.group.rotation.z = -t * Math.PI * .48;
        trooper.arms[0].rotation.z = t * 1.3; trooper.arms[1].rotation.z = -t * 1.3;
      }
    },
    dispose: () => {
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
      geometries.add(markerGeometry);
      group.traverse(object => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line || object instanceof THREE.Sprite)) return;
        if (!(object instanceof THREE.Sprite)) geometries.add(object.geometry);
        const list = Array.isArray(object.material) ? object.material : [object.material];
        list.forEach(material => { materials.add(material); Object.values(material).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); }); });
      });
      materials.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose()); geometries.forEach(geometry => geometry.dispose());
      group.removeFromParent(); group.clear(); actors.clear();
    },
  };
}
