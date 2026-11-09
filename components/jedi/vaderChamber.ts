import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { chosenTier } from "../render/pipeline";
import { createDrift } from "./orderEscapeWorld";

// Vader's fortress on Mustafar: a black hall on a mirror floor, its great window looking out over a
// valley of rivers of lava, erupting volcanoes and the old refinery, a bacta tank in each alcove, and
// his medical chamber at the centre. Its dome lifts on a hinge, its front sinks into the floor, and a
// boom carries the helmet down from above.

const POD = new THREE.Vector3(0, 0, -4);
const POD_R = 1.3;
const POD_Y = 1.25;
const WALL_X = 8;
const BACK_Z = -12.5;
const SLOPE = 0.1;

// The valley outside: three volcanoes on a slope that climbs away from the fortress. Each is a bump
// in the same height field, with a crater at its top, so the rock, the channels and the fire agree.
export const VOLCANOES: [number, number, number, number][] = [
  [-300, -560, 88, 92],
  [120, -760, 128, 118],
  [420, -470, 66, 66],
];
export const LAVA_LEVEL = 5;
const smooth = (t: number) => t * t * (3 - 2 * t);
function valueNoise(x: number, y: number) {
  const hash = (a: number, b: number) => {
    const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = smooth(x - ix),
    fy = smooth(y - iy);
  const top = hash(ix, iy) * (1 - fx) + hash(ix + 1, iy) * fx,
    low = hash(ix, iy + 1) * (1 - fx) + hash(ix + 1, iy + 1) * fx;
  return top * (1 - fy) + low * fy;
}
function ridges(x: number, z: number) {
  let value = 0,
    amplitude = 0.5,
    scale = 0.0085;
  for (let i = 0; i < 5; i++) {
    value += amplitude * valueNoise(x * scale + i * 3.1, z * scale - i * 1.7);
    amplitude *= 0.5;
    scale *= 2.06;
  }
  return value;
}
// Height above the local lava level.
export function rockHeight(x: number, z: number) {
  let height = (ridges(x, z) - 0.47) * 88 + Math.max(0, Math.abs(x) - 300) * 0.26;
  for (const [vx, vz, peak, spread] of VOLCANOES) {
    const r = Math.hypot(x - vx, z - vz);
    const cone = peak * Math.exp(-(r * r) / (2 * spread * spread));
    const crater = r < spread * 0.2 ? (1 - r / (spread * 0.2)) * peak * 0.2 : 0;
    height = Math.max(height, height * 0.35 + cone - crater + (ridges(x * 2.4, z * 2.4) - 0.5) * cone * 0.26);
  }
  return height;
}

export const lavaVertex = `attribute float aHeight;varying vec3 vWorld;varying float vHeight;
void main(){vec4 w=modelMatrix*vec4(position,1.0);vWorld=w.xyz;vHeight=aHeight;gl_Position=projectionMatrix*viewMatrix*w;}`;
export const lavaFragment = `
uniform float time;uniform float calm;uniform float fury;uniform vec4 volcano[3];varying vec3 vWorld;varying float vHeight;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=0.5;}return v;}
void main(){
  vec2 p=vWorld.xz*0.02;
  vec3 n=normalize(cross(dFdx(vWorld),dFdy(vWorld)));if(n.y<0.0)n=-n;
  float warp=fbm(p+vec2(time*0.016,-time*0.024));
  float crust=fbm(p*5.0+warp*2.2-vec2(0.0,time*0.06));
  // Lava fills everything below its level, cracked by a moving crust.
  float pool=1.0-smoothstep(${(LAVA_LEVEL - 2).toFixed(1)},${(LAVA_LEVEL + 3).toFixed(1)},vHeight+(crust-0.5)*7.0);
  float heat=pool*(0.48+smoothstep(0.32,0.7,crust)*0.72);
  // And runs down the volcanoes in streams, from each crater.
  float glowFromCrater=0.0;
  for(int i=0;i<3;i++){
    vec2 d=vWorld.xz-volcano[i].xy;float r=length(d),s=volcano[i].w,a=atan(d.y,d.x);
    float streak=pow(noise(vec2(a*15.0+float(i)*4.0,r*0.022-time*0.07)),6.0)*4.2;
    heat=max(heat,streak*smoothstep(s*1.75,s*0.5,r));
    float mouth=smoothstep(s*0.3,s*0.1,r);heat=max(heat,mouth*(0.7+crust*0.5));
    glowFromCrater+=smoothstep(s*2.2,s*0.4,r);
  }
  heat=clamp(heat*(1.0+fury*0.5),0.0,1.25)*(1.0-calm*0.86);
  // Black basalt, lit from below by whatever burns near it, and catching the sky on its upper faces.
  float nearFire=(1.0-smoothstep(0.0,34.0,vHeight))*0.85+glowFromCrater*0.32;
  vec3 rock=mix(vec3(0.018,0.014,0.016),vec3(0.07,0.045,0.04),crust);
  rock*=0.45+0.75*clamp(n.y,0.0,1.0);
  rock+=vec3(0.36,0.065,0.018)*nearFire*(0.35+0.65*(1.0-n.y))*(1.0-calm*0.7);
  rock=mix(rock,rock+vec3(0.19,0.13,0.07)*clamp(n.y,0.0,1.0),calm);
  vec3 lava=mix(vec3(0.72,0.06,0.008),vec3(1.0,0.46,0.05),smoothstep(0.3,0.8,heat));
  lava=mix(lava,vec3(1.0,0.86,0.42),smoothstep(0.9,1.2,heat));
  vec3 color=rock+lava*heat*1.35;
  float dist=length(vWorld-cameraPosition);
  vec3 horizon=mix(vec3(0.26,0.06,0.03)*(1.0+fury*0.5),vec3(0.66,0.46,0.27),calm);
  gl_FragColor=vec4(mix(color,horizon,smoothstep(520.0,1000.0,dist)*0.6),1.0);
}`;

function paint(width: number, height: number, draw: (c: CanvasRenderingContext2D, rand: () => number) => void, seed = 1977) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  draw(canvas.getContext("2d")!, rand);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export type ChamberState = { jedi: number; sith: number; reveal: number; open: number; steam: boolean; camera: THREE.Vector3; lash: number };

export function createVaderChamber(glow: THREE.Texture) {
  const group = new THREE.Group();
  group.name = "vader-chamber";
  const black = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.42, metalness: 0.72 });
  const darker = new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.55, metalness: 0.6 });
  const shell = new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.16, metalness: 0.55, side: THREE.DoubleSide });
  const add = <T extends THREE.Object3D>(item: T, parent: THREE.Object3D = group) => {
    parent.add(item);
    return item;
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material = black) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    return add(mesh);
  };

  // The floor: a true mirror where the machine can afford it, under a dark tinted polish.
  const floorLength = 32;
  const floorZ = BACK_Z + floorLength / 2;
  let mirror: Reflector | null = null;
  if (chosenTier() >= 2) {
    mirror = new Reflector(new THREE.PlaneGeometry(WALL_X * 2, floorLength), { textureWidth: 1024, textureHeight: 1024, color: 0x8d8d92, clipBias: 0.002 });
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.set(0, 0, floorZ);
    add(mirror);
  }
  const floorMap = paint(512, 512, (c) => {
    c.fillStyle = "#17171b";
    c.fillRect(0, 0, 512, 512);
    c.fillStyle = "#040405";
    for (let i = 0; i <= 512; i += 128) {
      c.fillRect(i - 1, 0, 3, 512);
      c.fillRect(0, i - 1, 512, 3);
    }
  });
  floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping;
  floorMap.repeat.set(4, 8);
  const polish = new THREE.Mesh(new THREE.PlaneGeometry(WALL_X * 2, floorLength), new THREE.MeshStandardMaterial({ map: floorMap, roughness: 0.2, metalness: 0.55, transparent: !!mirror, opacity: mirror ? 0.66 : 1 }));
  polish.rotation.x = -Math.PI / 2;
  polish.position.set(0, 0.004, floorZ);
  add(polish);
  box(WALL_X * 2 + 2, 0.4, floorLength, 0, 11.2, floorZ, darker);

  // The side walls: great leaning buttresses between red strips of light.
  const strips: THREE.MeshBasicMaterial[] = [];
  for (const side of [-1, 1]) {
    box(0.5, 11.4, floorLength, side * (WALL_X + 0.25), 5.7, floorZ, darker);
    for (let i = 0; i < 7; i++) {
      const z = BACK_Z + 2.6 + i * 4.2;
      const buttress = box(1.2, 11.4, 1.1, side * (WALL_X - 0.5), 5.7, z);
      buttress.rotation.z = side * 0.035;
      box(0.9, 1, 1.5, side * (WALL_X - 0.6), 0.5, z, darker);
      const strip = new THREE.MeshBasicMaterial({ color: 0x220405, toneMapped: false });
      strips.push(strip);
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.06, 6.4, 0.16), strip);
      light.position.set(side * (WALL_X - 1.14), 4.3, z);
      add(light);
    }
  }
  // The back wall, cut open by the window, with a fan of black mullions.
  for (const side of [-1, 1]) box(1.6, 11.4, 0.7, side * (WALL_X - 0.8), 5.7, BACK_Z);
  box(WALL_X * 2, 2.1, 0.7, 0, 10.05, BACK_Z);
  box(WALL_X * 2, 0.7, 0.7, 0, 0.35, BACK_Z);
  for (const [x, lean] of [
    [0, 0],
    [-2.3, 0.1],
    [2.3, -0.1],
    [-4.6, 0.2],
    [4.6, -0.2],
  ] as const) {
    const bar = box(0.2, 9.4, 0.28, x, 5, BACK_Z);
    bar.rotation.z = lean;
  }

  // Outside: a valley of black rock and rivers of lava, rising away towards the volcanoes.
  const lavaUniforms = {
    time: { value: 0 },
    calm: { value: 0 },
    fury: { value: 0 },
    volcano: { value: VOLCANOES.map(([x, z, peak, spread]) => new THREE.Vector4(x, z + BACK_Z, peak, spread)) },
  };
  const valley = new THREE.PlaneGeometry(1500, 960, 240, 170);
  valley.rotateX(-Math.PI / 2);
  valley.translate(0, 0, BACK_Z - 485);
  {
    const position = valley.getAttribute("position");
    const heights = new Float32Array(position.count);
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i),
        z = position.getZ(i),
        height = rockHeight(x, z - BACK_Z);
      heights[i] = height;
      // Only what stands above the lava is raised: the rivers stay flat.
      position.setY(i, -30 + (BACK_Z - z) * SLOPE + Math.max(height, LAVA_LEVEL));
    }
    valley.setAttribute("aHeight", new THREE.BufferAttribute(heights, 1));
    valley.computeVertexNormals();
  }
  const plain = new THREE.Mesh(valley, new THREE.ShaderMaterial({ uniforms: lavaUniforms, vertexShader: lavaVertex, fragmentShader: lavaFragment, fog: false, toneMapped: false }));
  plain.frustumCulled = false;
  add(plain);
  // Spires of basalt close under the window, black against the fire.
  const basalt = new THREE.MeshStandardMaterial({ color: 0x0d0a0a, roughness: 0.9, flatShading: true, fog: false, emissive: 0x2a0702, emissiveIntensity: 0.55 });
  for (const [x, z, width, height] of [
    [-92, -60, 15, 52],
    [-128, -96, 22, 78],
    [104, -70, 18, 56],
    [150, -112, 25, 84],
    [-210, -160, 30, 100],
    [230, -176, 30, 106],
  ] as const) {
    const cone = new THREE.ConeGeometry(width, height, 7, 5);
    const position = cone.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
      const jag = 1 + (valueNoise(position.getX(i) * 0.3 + x, position.getY(i) * 0.22 + z) - 0.5) * 0.75;
      position.setX(i, position.getX(i) * jag);
      position.setZ(i, position.getZ(i) * jag);
    }
    cone.computeVertexNormals();
    const spire = new THREE.Mesh(cone, basalt);
    spire.position.set(x, height / 2 - 34, z + BACK_Z);
    add(spire);
  }
  // The refinery of the Separatists' last stand: a tower and its long collector arms over the lava.
  const refinery = new THREE.Group();
  refinery.position.set(205, -26, BACK_Z - 300);
  refinery.scale.setScalar(0.72);
  add(refinery);
  const iron = new THREE.MeshStandardMaterial({ color: 0x14100f, roughness: 0.6, metalness: 0.6, fog: false, emissive: 0x1a0502, emissiveIntensity: 0.5 });
  const piece = (w: number, h: number, d: number, x: number, y: number, z: number, roll = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), iron);
    mesh.position.set(x, y, z);
    mesh.rotation.z = roll;
    refinery.add(mesh);
  };
  piece(22, 58, 22, 0, 22, 0);
  piece(40, 7, 34, 0, 52, 0);
  piece(14, 13, 14, 0, 62, 0);
  piece(92, 3.2, 5, -58, 42, 7, 0.14);
  piece(92, 3.2, 5, -58, 30, -7, -0.1);
  piece(3.4, 22, 3.4, -100, 37, 7);
  piece(3.4, 28, 3.4, -100, 20, -7);
  const beacons: THREE.Sprite[] = [];
  for (const [x, y, z] of [
    [0, 72, 0],
    [-100, 49, 7],
    [-100, 35, -7],
  ] as const) {
    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff3a22, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
    beacon.position.set(x, y, z);
    beacon.scale.setScalar(9);
    refinery.add(beacon);
    beacons.push(beacon);
  }
  const skyMap = paint(2048, 720, (c, rand) => {
    const sky = c.createLinearGradient(0, 0, 0, 720);
    sky.addColorStop(0, "#080304");
    sky.addColorStop(0.5, "#260907");
    sky.addColorStop(0.84, "#8a260d");
    sky.addColorStop(1, "#ee7726");
    c.fillStyle = sky;
    c.fillRect(0, 0, 2048, 720);
    // Banks of ash, lit from below.
    for (let i = 0; i < 260; i++) {
      const x = rand() * 2048,
        y = 40 + rand() * 560,
        r = 40 + rand() * 190;
      const puff = c.createRadialGradient(x, y, 0, x, y, r);
      puff.addColorStop(0, `rgba(${8 + y * 0.075},${4 + y * 0.013},${5},${0.1 + rand() * 0.22})`);
      puff.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = puff;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  const skyMaterial = new THREE.MeshBasicMaterial({ map: skyMap, fog: false, toneMapped: false });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2400, 840), skyMaterial);
  sky.position.set(0, 430, BACK_Z - 960);
  // A second layer of cloud drifting across the first.
  const cloudMap = paint(1024, 360, (c, rand) => {
    for (let i = 0; i < 90; i++) {
      const x = rand() * 1024,
        y = 30 + rand() * 280,
        r = 30 + rand() * 90;
      const puff = c.createRadialGradient(x, y, 0, x, y, r);
      puff.addColorStop(0, `rgba(16,7,7,${0.2 + rand() * 0.3})`);
      puff.addColorStop(1, "rgba(16,7,7,0)");
      c.fillStyle = puff;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  cloudMap.wrapS = THREE.RepeatWrapping;
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(2200, 620), new THREE.MeshBasicMaterial({ map: cloudMap, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
  clouds.position.set(0, 470, BACK_Z - 880);
  add(clouds);
  // Great columns of ash climbing from the craters.
  const plume = createDrift(glow, 34, 0x0d0808, 0.62);
  plume.group.traverse((item) => {
    if (item instanceof THREE.Sprite) item.material.fog = false;
  });
  add(plume.group);
  // Burning rock thrown out of the craters, falling back under its own weight.
  const SPARKS = 360;
  const sparkPositions = new Float32Array(SPARKS * 3);
  const sparkMotion = Array.from({ length: SPARKS }, () => ({ x: 0, y: 0, z: 0, age: Math.random() * 5, life: 1 }));
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
  const eruption = new THREE.Points(sparkGeometry, new THREE.PointsMaterial({ map: glow, color: 0xff8a2c, size: 7, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
  eruption.frustumCulled = false;
  add(eruption);
  const craterTop = (i: number, out: THREE.Vector3) => {
    const [x, z, peak] = VOLCANOES[i];
    return out.set(x, -30 + -z * SLOPE + peak * 0.82, z + BACK_Z);
  };
  const craterPoint = new THREE.Vector3();
  // Lightning in the ash, far off.
  const skyBolt = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(14 * 2 * 3), 3)), new THREE.LineBasicMaterial({ color: 0xffd8c8, transparent: true, fog: false, depthWrite: false, toneMapped: false }));
  skyBolt.visible = false;
  skyBolt.frustumCulled = false;
  add(skyBolt);
  let nextBolt = 3,
    boltUntil = 0;
  add(sky);
  const fountains = [
    ...VOLCANOES.map(([x, z, peak, spread]) => [x, -30 + -z * SLOPE + peak * 0.95, z, spread * 0.82]),
    [-40, 2, -210, 22],
    [-168, 8, -290, 30],
  ].map(([x, y, z, size], i) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff6a1c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
    sprite.position.set(x, y, z + BACK_Z);
    sprite.scale.set(size * 0.8, size * 1.8, 1);
    add(sprite);
    return { sprite, size, phase: i * 1.7 };
  });
  const shaft = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 11),
    new THREE.MeshBasicMaterial({ map: glow, color: 0xff4d1c, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }),
  );
  shaft.position.set(0, 4.6, BACK_Z + 0.8);
  add(shaft);

  // The bacta tanks in their alcoves, lit from within.
  const fluid = new THREE.MeshBasicMaterial({ color: 0x4f9f88, transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false });
  const bubbles: THREE.Sprite[] = [];
  for (const side of [-1, 1]) {
    const x = side * (WALL_X - 2.1),
      z = -8.6;
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 3.3, 28, 1, true), fluid);
    tank.position.set(x, 1.95, z);
    add(tank);
    for (const y of [0.17, 3.72]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.36, 28), black);
      cap.position.set(x, y, z);
      add(cap);
    }
    for (let i = 0; i < 7; i++) {
      const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xbff5de, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
      bubble.position.set(x + (i % 3) * 0.2 - 0.2, 0.4 + (i / 7) * 3, z + (i % 2) * 0.25 - 0.12);
      bubble.scale.setScalar(0.07 + (i % 3) * 0.03);
      bubble.userData.base = bubble.position.x;
      add(bubble);
      bubbles.push(bubble);
    }
  }

  // The medical chamber: a black sphere on a heavy pedestal, plated, riveted and fed by hoses. Its
  // dome lifts on a hinge to show a padded grey interior, a swivelling seat and two surgical arms.
  const pod = new THREE.Group();
  pod.position.copy(POD);
  add(pod);
  const hull = paint(1024, 512, (c) => {
    c.fillStyle = "#121318";
    c.fillRect(0, 0, 1024, 512);
    c.strokeStyle = "#040405";
    c.lineWidth = 4;
    for (let y = 64; y < 512; y += 96) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(1024, y);
      c.stroke();
    }
    for (let row = 0; row < 6; row++)
      for (let x = (row % 2) * 40; x < 1024; x += 80) {
        const y = 64 + row * 96;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x, y + 96);
        c.stroke();
        c.fillStyle = "#3a3d44";
        c.beginPath();
        c.arc(x + 12, y + 12, 3.2, 0, Math.PI * 2);
        c.fill();
      }
  });
  hull.wrapS = THREE.RepeatWrapping;
  const plated = new THREE.MeshStandardMaterial({ map: hull, roughness: 0.2, metalness: 0.7, side: THREE.DoubleSide });
  const padding = paint(512, 256, (c) => {
    c.fillStyle = "#6e7279";
    c.fillRect(0, 0, 512, 256);
    for (let row = 0; row < 4; row++)
      for (let column = 0; column < 12; column++) {
        const x = column * 42.6 + (row % 2) * 21,
          y = row * 64;
        const cushion = c.createRadialGradient(x + 21, y + 32, 3, x + 21, y + 32, 30);
        cushion.addColorStop(0, "#a2a7ae");
        cushion.addColorStop(1, "#51555b");
        c.fillStyle = cushion;
        c.fillRect(x + 2, y + 2, 39, 60);
      }
  });
  padding.wrapS = THREE.RepeatWrapping;
  const padded = new THREE.MeshStandardMaterial({ map: padding, roughness: 0.78, metalness: 0.1, side: THREE.BackSide });
  const backHalf = new THREE.Mesh(new THREE.SphereGeometry(POD_R, 48, 14, Math.PI, Math.PI, Math.PI / 2, Math.PI / 2), plated);
  backHalf.position.y = POD_Y;
  pod.add(backHalf);
  const backLining = new THREE.Mesh(new THREE.SphereGeometry(POD_R - 0.03, 40, 12, Math.PI, Math.PI, Math.PI / 2, Math.PI / 2), padded);
  backLining.position.y = POD_Y;
  pod.add(backLining);
  const frontHalf = new THREE.Mesh(new THREE.SphereGeometry(POD_R, 48, 14, 0, Math.PI, Math.PI / 2, Math.PI / 2), plated);
  frontHalf.position.y = POD_Y;
  pod.add(frontHalf);
  const hinge = new THREE.Group();
  hinge.position.set(0, POD_Y, -POD_R);
  pod.add(hinge);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(POD_R, 48, 18, 0, Math.PI * 2, 0, Math.PI / 2), plated);
  dome.position.z = POD_R;
  hinge.add(dome);
  const lining = new THREE.Mesh(new THREE.SphereGeometry(POD_R - 0.04, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2), padded);
  lining.position.z = POD_R;
  hinge.add(lining);
  // The jagged teeth round the lip of the dome, a bright pressure ring, and the great hinge.
  const teeth = new THREE.ConeGeometry(0.07, 0.17, 4);
  for (let i = 0; i < 26; i++) {
    const angle = (i / 26) * Math.PI * 2;
    const tooth = new THREE.Mesh(teeth, shell);
    tooth.position.set(Math.sin(angle) * POD_R, -0.06, POD_R + Math.cos(angle) * POD_R);
    tooth.rotation.x = Math.PI;
    hinge.add(tooth);
  }
  const pressure = new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false });
  const pressureRing = new THREE.Mesh(new THREE.TorusGeometry(POD_R - 0.035, 0.014, 6, 64), pressure);
  pressureRing.rotation.x = Math.PI / 2;
  pressureRing.position.set(0, 0.01, POD_R);
  hinge.add(pressureRing);
  const hingeBar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 18), shell);
  hingeBar.rotation.z = Math.PI / 2;
  hinge.add(hingeBar);
  const collarRing = new THREE.Mesh(new THREE.TorusGeometry(POD_R + 0.02, 0.05, 8, 56), shell);
  collarRing.rotation.x = Math.PI / 2;
  collarRing.position.y = POD_Y;
  pod.add(collarRing);
  // The pedestal and the hoses that feed the sphere from hatches in the floor.
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(POD_R * 0.82, POD_R * 1.08, 0.2, 40), shell);
  pedestal.position.y = 0.1;
  pod.add(pedestal);
  const hoseMaterial = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.45, metalness: 0.3 });
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI * (1.06 + (i / 5) * 0.88);
    const out = 2.5 + (i % 2) * 0.55;
    const hose = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(angle) * 1.02, 0.42, Math.sin(angle) * 1.02),
        new THREE.Vector3(Math.cos(angle) * 1.5, 0.16, Math.sin(angle) * 1.5),
        new THREE.Vector3(Math.cos(angle) * out, 0.06, Math.sin(angle) * out),
      ]),
      14,
      0.038,
      8,
    );
    pod.add(new THREE.Mesh(hose, hoseMaterial));
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.05, 14), shell);
    hatch.position.set(Math.cos(angle) * out, 0.03, Math.sin(angle) * out);
    pod.add(hatch);
  }
  // Two monitoring consoles, with a life-support trace and a row of lamps.
  const traces: { texture: THREE.CanvasTexture; c: CanvasRenderingContext2D; x: number }[] = [];
  for (const side of [-1, 1]) {
    const column = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.3, 0.34), black);
    column.position.set(side * 2.2, 0.65, -0.55);
    column.rotation.y = -side * 0.35;
    pod.add(column);
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "#020805";
    c.fillRect(0, 0, 128, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    traces.push({ texture, c, x: 0 });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.2), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    screen.position.set(side * 2.2 + -side * 0.06, 1.1, -0.55 + 0.176);
    screen.rotation.y = -side * 0.35;
    pod.add(screen);
    for (let i = 0; i < 5; i++) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.022, 0.012), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff3030 : 0x35d070, toneMapped: false }));
      lamp.position.set(side * 2.2 - side * 0.06 - 0.1 + i * 0.05, 0.9, -0.55 + 0.18);
      lamp.rotation.y = -side * 0.35;
      pod.add(lamp);
    }
  }
  // The seat, which turns with him.
  const seat = new THREE.Group();
  pod.add(seat);
  const seatBlack = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.5, metalness: 0.45 });
  const seatPart = (w: number, h: number, d: number, x: number, y: number, z: number, tilt = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), seatBlack);
    mesh.position.set(x, y, z);
    mesh.rotation.x = tilt;
    seat.add(mesh);
  };
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.22, 0.4, 16), shell);
  post.position.y = 0.3;
  seat.add(post);
  seatPart(0.62, 0.1, 0.56, 0, 0.5, 0.02);
  seatPart(0.56, 0.72, 0.1, 0, 0.86, -0.31, -0.1);
  for (const side of [-1, 1]) {
    seatPart(0.08, 0.06, 0.46, side * 0.33, 0.74, 0.02);
    seatPart(0.06, 0.24, 0.06, side * 0.33, 0.62, -0.12);
  }
  // Two surgical arms folded out from the back of the dome, tools glinting at their tips.
  const surgeons = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.52, POD_Y + 0.56, -0.5);
    pod.add(shoulder);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.5, 10), seatBlack);
    upper.position.y = -0.25;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.5;
    shoulder.add(elbow);
    elbow.add(new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 8), seatBlack));
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.42, 10), seatBlack);
    fore.position.y = -0.21;
    elbow.add(fore);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0xcfd4da, roughness: 0.2, metalness: 0.95 }));
    tip.position.y = -0.47;
    tip.rotation.x = Math.PI;
    elbow.add(tip);
    return { shoulder, elbow, side };
  });
  const inlay = new THREE.Mesh(new THREE.RingGeometry(POD_R + 0.7, POD_R + 0.78, 64), new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.8, toneMapped: false }));
  inlay.rotation.x = -Math.PI / 2;
  inlay.position.y = 0.012;
  pod.add(inlay);
  const podLight = new THREE.PointLight(0xdfe6f0, 0, 5, 2);
  podLight.position.set(0, 2.1, 0.25);
  pod.add(podLight);

  // The boom that lowers the helmet from the ceiling.
  const boom = new THREE.Group();
  boom.position.copy(POD);
  add(boom);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1, 10), darker);
  boom.add(rod);
  const claw = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.022, 8, 18), black);
  claw.rotation.x = Math.PI / 2;
  boom.add(claw);

  // Steam from the chamber, ash in the hall.
  const steam = createDrift(glow, 22, 0xcfd3da, 0.24);
  add(steam.group);
  const ash = createDrift(glow, 26, 0xff7a3a, 0.75, THREE.AdditiveBlending);
  add(ash.group);

  // Banners of the Empire, unrolled for the new lord.
  const crest = paint(256, 1024, (c) => {
    c.fillStyle = "#6e0b10";
    c.fillRect(0, 0, 256, 1024);
    c.fillStyle = "#3a0408";
    c.fillRect(0, 0, 18, 1024);
    c.fillRect(238, 0, 18, 1024);
    c.strokeStyle = "#0a0304";
    c.lineWidth = 12;
    c.beginPath();
    c.arc(128, 300, 80, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(128, 300, 30, 0, Math.PI * 2);
    c.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      c.beginPath();
      c.moveTo(128 + Math.cos(a) * 30, 300 + Math.sin(a) * 30);
      c.lineTo(128 + Math.cos(a) * 80, 300 + Math.sin(a) * 80);
      c.stroke();
    }
  });
  const banners: THREE.Mesh[] = [];
  for (const side of [-1, 1])
    for (const z of [-7.3, -3.1, 1.1]) {
      const geometry = new THREE.PlaneGeometry(2, 8.5);
      geometry.translate(0, -4.25, 0);
      const banner = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: crest, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x40060a, emissiveIntensity: 0.6 }));
      banner.position.set(side * (WALL_X - 1.26), 9.9, z);
      banner.rotation.y = -side * (Math.PI / 2);
      banner.scale.y = 0.001;
      banner.visible = false;
      add(banner);
      banners.push(banner);
    }

  // The lightning of whoever kneels here: from the visitor's two hands out into the hall.
  const arcs = Array.from({ length: 5 }, () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(16 * 2 * 3), 3));
    const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xcfc4ff, toneMapped: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    line.visible = false;
    line.frustumCulled = false;
    add(line);
    return line;
  });
  const arcFlash = new THREE.PointLight(0xa890ff, 0, 16, 1.6);
  add(arcFlash);

  // The hall's own light.
  const ambient = new THREE.HemisphereLight(0x3a1412, 0x030101, 0.75);
  const lavaLight = new THREE.DirectionalLight(0xff5a22, 1.1);
  lavaLight.position.set(0, 3, -14);
  const rim = new THREE.SpotLight(0xff4a22, 160, 26, 0.5, 0.65, 1.3);
  rim.position.set(0, 7.5, BACK_Z + 1);
  rim.target.position.set(0, 1.4, -2);
  const windowGlow = new THREE.PointLight(0xff4418, 34, 24, 1.8);
  windowGlow.position.set(0, 3.5, BACK_Z + 3.5);
  const dawn = new THREE.DirectionalLight(0xffdca6, 0);
  dawn.position.set(-2, 6, -14);
  const dawnFront = new THREE.PointLight(0xffe3b5, 0, 26, 1.4);
  dawnFront.position.set(-1, 6, 4);
  add(ambient);
  add(lavaLight);
  add(rim);
  add(rim.target);
  add(windowGlow);
  add(dawn);
  add(dawnFront);

  const stripRed = new THREE.Color(0xff3a3a),
    stripBlue = new THREE.Color(0xa8d8ff),
    stripNow = new THREE.Color(),
    white = new THREE.Color(0xffffff),
    from = new THREE.Vector3(),
    to = new THREE.Vector3(),
    point = new THREE.Vector3(),
    across = new THREE.Vector3();
  const zigzag = (line: THREE.LineSegments, a: THREE.Vector3, b: THREE.Vector3) => {
    const position = line.geometry.getAttribute("position") as THREE.BufferAttribute;
    const segments = position.count / 2;
    point.copy(a);
    for (let i = 0; i < segments; i++) {
      position.setXYZ(i * 2, point.x, point.y, point.z);
      const k = (i + 1) / segments;
      const swing = Math.sin(k * Math.PI) * 0.42;
      across.lerpVectors(a, b, k);
      if (i < segments - 1) across.set(across.x + (Math.random() - 0.5) * swing * 2, across.y + (Math.random() - 0.5) * swing * 2, across.z + (Math.random() - 0.5) * swing);
      point.copy(across);
      position.setXYZ(i * 2 + 1, point.x, point.y, point.z);
    }
    position.needsUpdate = true;
  };
  const zigzagWide = (line: THREE.LineSegments, a: THREE.Vector3, b: THREE.Vector3, swing: number) => {
    const position = line.geometry.getAttribute("position") as THREE.BufferAttribute;
    const segments = position.count / 2;
    point.copy(a);
    for (let i = 0; i < segments; i++) {
      position.setXYZ(i * 2, point.x, point.y, point.z);
      across.lerpVectors(a, b, (i + 1) / segments);
      point.set(across.x + (Math.random() - 0.5) * swing, across.y, across.z);
      position.setXYZ(i * 2 + 1, point.x, point.y, point.z);
    }
    position.needsUpdate = true;
  };
  const ARC_TARGETS: [number, number, number][] = [
    [-5.2, 3.2, -3],
    [5, 2.4, -1.5],
    [-2.4, 0.6, -5],
    [2.7, 6, -8],
    [0, 8, -11],
  ];
  return {
    group,
    // The head under the helmet: pale skin crossed with old burns.
    scarredHead() {
      const map = paint(256, 256, (c, rand) => {
        c.fillStyle = "#a18c7e";
        c.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 40; i++) {
          c.strokeStyle = i % 3 ? "rgba(112,62,58,.75)" : "rgba(235,214,200,.6)";
          c.lineWidth = 1 + rand() * 3;
          c.beginPath();
          let x = rand() * 256,
            y = rand() * 256;
          c.moveTo(x, y);
          for (let k = 0; k < 4; k++) {
            x += (rand() - 0.5) * 70;
            y += (rand() - 0.5) * 70;
            c.lineTo(x, y);
          }
          c.stroke();
        }
      });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.128, 28, 20), new THREE.MeshStandardMaterial({ map, roughness: 0.75 }));
      head.scale.set(0.96, 1.12, 1.04);
      return head;
    },
    setPod(open: number, front: number, seatYaw: number, away: number) {
      hinge.rotation.x = -open * 1.82;
      seat.rotation.y = seatYaw;
      // The arms stand ready round the head while the helmet comes down, then fold away.
      surgeons.forEach(({ shoulder, elbow, side }) => {
        shoulder.visible = open > 0.3;
        shoulder.rotation.z = side * (0.28 + away * 0.75);
        shoulder.rotation.x = -0.3 + away * 0.9;
        elbow.rotation.z = -side * (0.9 - away * 0.55);
        elbow.rotation.x = -0.3 - away * 0.6;
      });
      pressure.color.setHex(open > 0.02 ? 0xff5040 : 0x400808);
      frontHalf.position.y = POD_Y - front * 1.4;
      frontHalf.visible = front < 0.995;
      collarRing.visible = front < 0.2;
      podLight.intensity = open * (1 - front * 0.7) * 3.2;
    },
    setHelmetArm(tipY: number, away: number) {
      const end = tipY + away * 6.5;
      const top = 11;
      boom.visible = away < 0.995 && end < top;
      rod.scale.y = Math.max(0.01, top - end);
      rod.position.y = (top + end) / 2;
      claw.position.y = end;
    },
    tick(dt: number, time: number, still: boolean, state: ChamberState) {
      const { jedi, sith, reveal, camera, steam: steaming, lash } = state;
      lavaUniforms.time.value = still ? 40 : time;
      lavaUniforms.calm.value = jedi;
      lavaUniforms.fury.value = sith;
      // Out of the window: ash rising, rock flying, cloud crossing, lightning now and then.
      if (!still) cloudMap.offset.x = time * 0.006;
      plume.tick(dt, (out) => {
        craterTop(Math.floor(Math.random() * 3), out);
        out.x += (Math.random() - 0.5) * 24;
        out.y += Math.random() * 40;
        return 90 + Math.random() * 110;
      });
      plume.group.visible = jedi < 0.98;
      eruption.visible = !still && jedi < 0.98;
      if (eruption.visible) {
        const rate = 1 + sith * 1.4;
        sparkMotion.forEach((spark, i) => {
          spark.age += dt * rate;
          if (spark.age >= spark.life) {
            craterTop(i % 3, craterPoint);
            spark.age = 0;
            spark.life = 2.8 + Math.random() * 2.2;
            sparkPositions[i * 3] = craterPoint.x;
            sparkPositions[i * 3 + 1] = craterPoint.y;
            sparkPositions[i * 3 + 2] = craterPoint.z;
            spark.x = (Math.random() - 0.5) * 42;
            spark.z = (Math.random() - 0.5) * 42;
            spark.y = 46 + Math.random() * 72;
          }
          spark.y -= 32 * dt * rate;
          sparkPositions[i * 3] += spark.x * dt * rate;
          sparkPositions[i * 3 + 1] += spark.y * dt * rate;
          sparkPositions[i * 3 + 2] += spark.z * dt * rate;
        });
        sparkGeometry.getAttribute("position").needsUpdate = true;
      }
      beacons.forEach((beacon, i) => (beacon.material.opacity = (still ? 0.8 : Math.sin(time * 2.1 + i * 1.7) > 0 ? 1 : 0.2) * (1 - jedi)));
      if (!still && time > nextBolt && jedi < 0.5) {
        nextBolt = time + 2.4 + Math.random() * 5.5;
        boltUntil = time + 0.18;
        from.set((Math.random() - 0.5) * 900, 460, BACK_Z - 820);
        to.set(from.x + (Math.random() - 0.5) * 220, 130, BACK_Z - 780);
        zigzagWide(skyBolt, from, to, 34);
      }
      skyBolt.visible = time < boltUntil;
      // Life support, traced by the two consoles in time with his breath.
      if (!still)
        traces.forEach((trace) => {
          trace.x = (trace.x + 1) % 128;
          const y = 32 + Math.sin(time * 1.5) * 14 + Math.sin(time * 9) * 3;
          trace.c.fillStyle = "#020805";
          trace.c.fillRect(trace.x, 0, 4, 64);
          trace.c.fillStyle = "#4dffa0";
          trace.c.fillRect(trace.x, y, 2, 2);
          trace.texture.needsUpdate = true;
        });
      // The ash lifts: the same sky, driven towards a pale gold dawn.
      skyMaterial.color.setRGB((1 + jedi * 1.2) * (1 + sith * 0.3), (1 + jedi * 3.4) * (1 + sith * 0.3), (1 + jedi * 5.5) * (1 + sith * 0.3));
      fountains.forEach(({ sprite, size, phase }) => {
        const beat = still ? 0.7 : 0.55 + Math.sin(time * 0.8 + phase) * 0.35 + Math.sin(time * 2.3 + phase) * 0.1;
        sprite.material.opacity = beat * (1 - jedi) * (0.65 + sith * 0.35);
        sprite.scale.set(size * 0.8 * (1 + sith * 0.8), size * 1.8 * (1 + sith * 1.4) * (0.75 + beat * 0.4), 1);
      });
      (shaft.material as THREE.MeshBasicMaterial).opacity = (0.09 + sith * 0.09) * reveal + jedi * 0.1;
      (shaft.material as THREE.MeshBasicMaterial).color.setHex(jedi > 0.5 ? 0xffdca6 : 0xff4d1c);
      stripNow.copy(stripRed).lerp(stripBlue, jedi).multiplyScalar((0.12 + 0.88 * reveal) * (still ? 0.9 : 0.86 + Math.sin(time * 1.8) * 0.1) * (1 + sith * 0.4));
      strips.forEach((strip) => strip.color.copy(stripNow));
      (inlay.material as THREE.MeshBasicMaterial).color.copy(stripNow);
      ambient.intensity = 0.75 + jedi * 0.5;
      ambient.color.setHex(jedi > 0.5 ? 0x8a8074 : 0x3a1412);
      lavaLight.intensity = 1.1 * (1 - jedi) * reveal * (1 + sith * 0.8);
      rim.intensity = (160 + sith * 160) * (1 - jedi * 0.9) * reveal;
      windowGlow.intensity = (34 + sith * 40) * (1 - jedi) * reveal;
      dawn.intensity = jedi * 2.4;
      dawnFront.intensity = jedi * 42;
      if (!still)
        bubbles.forEach((bubble, i) => {
          bubble.position.y += dt * (0.25 + (i % 3) * 0.12);
          if (bubble.position.y > 3.4) bubble.position.y = 0.45;
          bubble.position.x = (bubble.userData.base as number) + Math.sin(time * 2 + i) * 0.03;
        });
      steam.group.visible = steaming && !still;
      if (steam.group.visible)
        steam.tick(dt, (out) => {
          const angle = Math.random() * Math.PI * 2;
          out.set(POD.x + Math.cos(angle) * 1.2, 0.2 + Math.random() * 0.9, POD.z + Math.sin(angle) * 1.2);
          return 1.2 + Math.random() * 1.8;
        });
      ash.tick(dt, (out) => {
        out.set(camera.x + (Math.random() - 0.5) * 12, Math.random() * 5, camera.z - 4.5 - Math.random() * 8);
        return 0.035 + Math.random() * 0.045;
      });
      // Banners unroll one after the other; the lightning arcs from the kneeling visitor's hands.
      banners.forEach((banner, i) => {
        const k = THREE.MathUtils.smootherstep(sith * 2.4, i * 0.14, 0.6 + i * 0.14);
        banner.visible = k > 0.002;
        banner.scale.y = Math.max(k, 0.001);
      });
      const strike = lash > 0.1 && !still;
      arcs.forEach((line, i) => {
        line.visible = strike && Math.sin(time * (9 + i * 2.7) + i * 1.9) > -0.1;
        if (!line.visible) return;
        from.set(camera.x + (i % 2 ? 0.55 : -0.55), camera.y - 0.12, camera.z - 0.5);
        to.set(...ARC_TARGETS[i]);
        zigzag(line, from, to);
      });
      arcFlash.position.set(camera.x + Math.sin(time * 19) * 2, camera.y + 1.1, camera.z - 2.4);
      arcFlash.intensity = strike ? (Math.sin(time * 37) > 0.2 ? 14 : 3) : 0;
      if (arcFlash.intensity > 10) (arcs[0].material as THREE.LineBasicMaterial).color.copy(white);
    },
    dispose() {
      mirror?.dispose();
    },
  };
}
