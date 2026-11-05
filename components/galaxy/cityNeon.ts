import * as THREE from "three";
import { cityUniforms } from "./cityEnv";

// The neon of the city-planet: saturated blade signs and discs on the towers (invented glyphs, one
// instanced draw), tubes up their corners, and holographic globes with text running round them.
// It all follows the hour and the power: faint by day, blazing at night, dead in an outage.

// `round` towers narrow as they rise: signs stand off them, but tubes would hang in the air.
export type NeonTower = { x: number; z: number; w: number; d: number; top: number; round?: boolean };
const SIGN_COLOURS = ["#ff2fa8", "#2fe9ff", "#8dff3f", "#ffc02e", "#a765ff", "#ff4a35", "#ff7ad9", "#46ffd0"];
const TUBE_COLOURS = [0xff2fa8, 0x2fe9ff, 0x8dff3f, 0xffc02e, 0xa765ff, 0xff4a35, 0x46ffd0];

const COLUMNS = 8;
const ROWS = 2;
// Cells of the sign sheet: the first row are tall blades, the second round and wide signs.
function signSheet() {
  const canvas = document.createElement("canvas");
  canvas.width = 1536;
  canvas.height = 1024;
  const c = canvas.getContext("2d");
  const cellW = canvas.width / COLUMNS,
    cellH = canvas.height / ROWS;
  let s = 41;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  if (!c) return canvas;
  const rounded = (x: number, y: number, w: number, h: number, r: number) => (c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h));
  c.lineCap = "round";
  c.lineJoin = "round";
  // A neon tube: a wide coloured glow, then the colour, then a near-white core.
  const tube = (colour: string, width: number, draw: () => void) => {
    c.shadowColor = colour;
    c.shadowBlur = width * 3.2;
    c.strokeStyle = colour;
    c.lineWidth = width;
    c.beginPath();
    draw();
    c.stroke();
    c.shadowBlur = 0;
    c.strokeStyle = "rgba(255,255,255,.82)";
    c.lineWidth = width * 0.34;
    c.beginPath();
    draw();
    c.stroke();
  };
  // An invented glyph: a few strokes on a small grid, so it reads as writing, not as noise.
  const glyph = (x: number, y: number, size: number, colour: string, width: number) => {
    const points = Array.from({ length: 3 + Math.floor(rand() * 3) }, () => [x + Math.floor(rand() * 3) * size * 0.5, y + Math.floor(rand() * 4) * size * 0.34]);
    tube(colour, width, () => {
      points.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
    });
  };
  SIGN_COLOURS.forEach((colour, i) => {
    const left = i * cellW,
      middle = left + cellW / 2;
    // Blades: a frame and a column of glyphs, or a string of beads.
    if (i % 4 === 3) {
      for (let b = 0; b < 12; b++) {
        const y = 40 + b * 37,
          r = b % 3 === 0 ? 13 : 8;
        tube(colour, 5, () => c.arc(middle, y, r, 0, Math.PI * 2));
      }
    } else {
      tube(colour, 6, () => rounded(left + 26, 18, cellW - 52, cellH - 36, 22));
      for (let g = 0; g < 7; g++) glyph(left + 58, 40 + g * 64, 72, g % 3 === 2 ? "#ffffff" : colour, 6);
    }
    // Second row: rings and ovals, a bar with glyphs, an arrow, a sunburst.
    const top = cellH,
      centreY = top + cellH / 2;
    if (i % 4 === 0) {
      tube(colour, 9, () => c.ellipse(middle, centreY, cellW * 0.32, cellH * 0.4, 0, 0, Math.PI * 2));
      tube(colour, 5, () => c.ellipse(middle, centreY, cellW * 0.2, cellH * 0.27, 0, 0, Math.PI * 2));
      glyph(middle - 34, centreY - 42, 70, "#ffffff", 5);
    } else if (i % 4 === 1) {
      tube(colour, 7, () => rounded(left + 20, centreY - 170, cellW - 40, 340, 16));
      for (let g = 0; g < 4; g++) glyph(left + 58, centreY - 150 + g * 78, 76, colour, 6);
    } else if (i % 4 === 2) {
      tube(colour, 10, () => {
        c.moveTo(middle - 55, centreY + 150);
        c.lineTo(middle + 45, centreY);
        c.lineTo(middle - 55, centreY - 150);
      });
      tube(colour, 5, () => c.arc(middle, centreY, 88, 0, Math.PI * 2));
    } else {
      for (let ray = 0; ray < 12; ray++) {
        const a = (ray / 12) * Math.PI * 2;
        tube(colour, 5, () => {
          c.moveTo(middle + Math.cos(a) * 42, centreY + Math.sin(a) * 42);
          c.lineTo(middle + Math.cos(a) * (ray % 2 ? 78 : 105), centreY + Math.sin(a) * (ray % 2 ? 78 : 105));
        });
      }
      tube("#ffffff", 5, () => c.arc(middle, centreY, 28, 0, Math.PI * 2));
    }
  });
  return canvas;
}

const signVertex = /* glsl */ `
  attribute vec4 cell;attribute float phase;
  varying vec2 vUv;varying float vPhase;varying vec3 vWorld;
  void main(){
    vUv=cell.xy+uv*cell.zw;
    vPhase=phase;
    vec4 world=modelMatrix*instanceMatrix*vec4(position,1.0);
    vWorld=world.xyz;
    gl_Position=projectionMatrix*viewMatrix*world;
  }`;
const signFragment = /* glsl */ `
  uniform sampler2D sheet;uniform float time,cityNight,cityDay,power,fogDensity;uniform vec4 cityOutage;uniform vec3 tint;
  varying vec2 vUv;varying float vPhase;varying vec3 vWorld;
  float flash(float t){return fract(sin(t*12.9898)*43758.5453);}
  void main(){
    vec4 s=texture2D(sheet,vUv);
    // Now and then a sign stutters, as old transformers do; most of them simply hum.
    float beat=floor(time*9.0+vPhase*61.0);
    float bad=step(.985-vPhase*.03,flash(floor(time*.35+vPhase*23.0)));
    float stutter=mix(1.0,step(.42,flash(beat)),bad);
    float hum=.93+.07*sin(time*(6.0+vPhase*7.0)+vPhase*40.0);
    float cut=step(.001,cityOutage.w)*step(distance(vWorld.xz,cityOutage.xy),cityOutage.z)*step(fract(vPhase*7.3),cityOutage.w*1.05);
    float level=mix(.62,1.0,cityNight)*(1.0-cityDay*.72)*hum*stutter*power*(1.0-cut);
    float far=length(vWorld-cameraPosition);
    float air=exp(-fogDensity*fogDensity*far*far*.55);
    gl_FragColor=vec4(s.rgb*s.a*tint*level*air,s.a*level*air);
  }`;

const globeVertex = /* glsl */ `
  varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;
  void main(){
    vUv=uv;
    vec4 at=modelViewMatrix*vec4(position,1.0);
    vNormal=normalize(normalMatrix*normal);
    vView=normalize(-at.xyz);
    gl_Position=projectionMatrix*at;
  }`;
const globeFragment = /* glsl */ `
  uniform sampler2D words;uniform float time,offset,level;uniform vec3 tone;
  varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;
  void main(){
    float facing=abs(dot(normalize(vNormal),normalize(vView)));
    float rim=pow(1.0-facing,2.2);
    // Meridians and parallels, thin as a projected wireframe, under the running text.
    float grid=smoothstep(.965,1.0,abs(sin(vUv.x*62.83)))*.16+smoothstep(.97,1.0,abs(sin(vUv.y*31.4)))*.16;
    vec2 band=vec2(fract(vUv.x*2.0+time*.035+offset),(vUv.y-.34)/.32);
    float text=step(0.0,band.y)*step(band.y,1.0)*texture2D(words,band).r;
    float scan=.86+.14*sin(vUv.y*340.0-time*5.0);
    vec3 c=tone*(rim*.95+grid+.05)+mix(tone,vec3(1.0),.55)*text*1.1;
    float a=clamp(rim*.8+grid+text+.05,0.0,1.0)*scan*level;
    gl_FragColor=vec4(c*a,a);
  }`;

function runningWords(line: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 128;
  const c = canvas.getContext("2d");
  if (c) {
    c.fillStyle = "#000";
    c.fillRect(0, 0, 2048, 128);
    c.fillStyle = "#fff";
    c.font = "bold 84px Arial, Helvetica, sans-serif";
    c.textBaseline = "middle";
    const width = c.measureText(line).width || 1;
    for (let x = 0; x < 2048; x += width) c.fillText(line, x, 66);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

export function createCityNeon(options: {
  glow: THREE.Texture;
  towers: NeonTower[];
  signs: number;
  tubes: number;
  fogDensity: number;
  // On the pad every sign faces the visitor's side; along the taxi routes they face any way.
  faceOrigin?: boolean;
  globes?: { x: number; y: number; z: number; r: number; tone: number; line: string }[];
  // Slim masts rising from below round the platform, each carrying a tall sign close to the visitor.
  masts?: { angle: number; radius: number; height: number; width: number; base: number; column: number }[];
  seed?: number;
}) {
  const { glow, towers, signs, tubes, fogDensity, faceOrigin = false, globes = [], masts = [] } = options;
  const group = new THREE.Group();
  group.name = "city-neon";
  let s = options.seed ?? 7771;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

  const sheet = new THREE.CanvasTexture(signSheet());
  sheet.colorSpace = THREE.NoColorSpace;
  sheet.anisotropy = 4;
  const signMaterial = new THREE.ShaderMaterial({
    uniforms: {
      sheet: { value: sheet },
      time: { value: 0 },
      power: { value: 1 },
      fogDensity: { value: fogDensity },
      tint: { value: new THREE.Color(1, 1, 1) },
      cityDay: cityUniforms.cityDay,
      cityNight: cityUniforms.cityNight,
      cityOutage: cityUniforms.cityOutage,
    },
    vertexShader: signVertex,
    fragmentShader: signFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
  // Only what rises high enough to be seen carries a sign.
  const usable = towers.filter((tower) => tower.top > -60 && tower.w > 5);
  const towerSigns = usable.length ? signs : 0;
  const count = towerSigns + masts.length;
  const plane = new THREE.PlaneGeometry(1, 1);
  const cells = new Float32Array(count * 4),
    phases = new Float32Array(count);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = plane.index;
  geometry.setAttribute("position", plane.getAttribute("position"));
  geometry.setAttribute("uv", plane.getAttribute("uv"));
  geometry.setAttribute("normal", plane.getAttribute("normal"));
  const board = new THREE.InstancedMesh(geometry, signMaterial, Math.max(1, count));
  const dummy = new THREE.Object3D();
  for (let i = 0; i < towerSigns; i++) {
    const tower = usable[Math.floor(rand() * usable.length)];
    const wide = rand() < 0.3;
    const column = Math.floor(rand() * COLUMNS);
    cells.set([column / COLUMNS, wide ? 0 : 0.5, 1 / COLUMNS, 0.5], i * 4);
    phases[i] = rand();
    // A face of the tower: the one turned towards the origin, or any of them.
    const towards = Math.abs(tower.x) > Math.abs(tower.z);
    const alongX = faceOrigin ? towards : rand() < 0.5;
    const sign = faceOrigin ? -Math.sign(alongX ? tower.x : tower.z) || 1 : rand() < 0.5 ? 1 : -1;
    const across = (rand() - 0.5) * 0.7;
    const height = wide ? 11 + rand() * 15 : 20 + rand() * 34;
    const width = wide ? height * 0.74 : height * 0.25;
    const y = tower.top - height * 0.6 - rand() * Math.min(60, Math.max(0, tower.top + 60) * 0.5);
    // Blades stand off the wall edge-on to the street's length, as such signs do; the rest lie flat on it.
    const blade = !wide && rand() < 0.5;
    if (alongX) dummy.position.set(tower.x + sign * (tower.w / 2 + (blade ? width * 0.5 : 0.3)), y, tower.z + across * tower.d);
    else dummy.position.set(tower.x + across * tower.w, y, tower.z + sign * (tower.d / 2 + (blade ? width * 0.5 : 0.3)));
    dummy.rotation.set(0, (alongX ? Math.PI / 2 : 0) + (blade ? Math.PI / 2 : 0), 0);
    dummy.scale.set(width, height, 1);
    dummy.updateMatrix();
    board.setMatrixAt(i, dummy.matrix);
  }
  // The masts' signs come last, turned to face the platform.
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x14171b, roughness: 0.55, metalness: 0.7 });
  masts.forEach((mast, m) => {
    const i = towerSigns + m,
      x = Math.cos(mast.angle) * mast.radius,
      z = Math.sin(mast.angle) * mast.radius;
    cells.set([mast.column / COLUMNS, 0.5, 1 / COLUMNS, 0.5], i * 4);
    phases[i] = rand();
    dummy.position.set(x, mast.base + mast.height / 2, z);
    dummy.rotation.set(0, Math.atan2(-x, -z), 0);
    dummy.scale.set(mast.width, mast.height, 1);
    dummy.updateMatrix();
    board.setMatrixAt(i, dummy.matrix);
    // Behind the sign, so it reads against something rather than hanging in the air.
    const back = 0.28;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, mast.height + mast.base + 60, 8), poleMaterial);
    pole.position.set(x + (x / mast.radius) * back, (mast.base + mast.height - 60) / 2, z + (z / mast.radius) * back);
    group.add(pole);
  });
  geometry.setAttribute("cell", new THREE.InstancedBufferAttribute(cells, 4));
  geometry.setAttribute("phase", new THREE.InstancedBufferAttribute(phases, 1));
  board.count = count;
  board.frustumCulled = false;
  group.add(board);

  // Tubes up the corners of the towers, and a ring round the crown of some.
  const tubeMaterial = new THREE.MeshBasicMaterial({ toneMapped: false });
  const squareTowers = usable.filter((tower) => !tower.round);
  const lines = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), tubeMaterial, Math.max(1, squareTowers.length ? tubes : 0));
  const tone = new THREE.Color();
  if (squareTowers.length)
    for (let i = 0; i < tubes; i++) {
      const tower = squareTowers[Math.floor(rand() * squareTowers.length)];
      tone.setHex(TUBE_COLOURS[Math.floor(rand() * TUBE_COLOURS.length)]);
      if (i % 4 === 3) {
        const y = tower.top - 0.4 - rand() * 14;
        const front = rand() < 0.5;
        dummy.position.set(tower.x + (front ? 0 : Math.sign(rand() - 0.5) * (tower.w / 2 + 0.2)), y, tower.z + (front ? Math.sign(rand() - 0.5) * (tower.d / 2 + 0.2) : 0));
        dummy.scale.set(front ? tower.w : 0.5, 0.5, front ? 0.5 : tower.d);
      } else {
        const corner = Math.floor(rand() * 4);
        const length = 18 + rand() * 62;
        dummy.position.set(tower.x + ((corner & 1) * 2 - 1) * (tower.w / 2 + 0.1), tower.top - length / 2 - rand() * 6, tower.z + ((corner & 2) - 1) * (tower.d / 2 + 0.1));
        dummy.scale.set(0.5, length, 0.5);
      }
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      lines.setMatrixAt(i, dummy.matrix);
      lines.setColorAt(i, tone);
    }
  lines.frustumCulled = false;
  group.add(lines);

  // Holographic globes hanging in the air, text running round their middle.
  const globeMeshes = globes.map((spec, i) => {
    const material = new THREE.ShaderMaterial({
      uniforms: { words: { value: runningWords(spec.line) }, time: { value: 0 }, offset: { value: i * 0.37 }, level: { value: 1 }, tone: { value: new THREE.Color(spec.tone) } },
      vertexShader: globeVertex,
      fragmentShader: globeFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(spec.r, 40, 24), material);
    mesh.position.set(spec.x, spec.y, spec.z);
    mesh.rotation.y = i * 2.1;
    group.add(mesh);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: spec.tone, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.copy(mesh.position);
    halo.scale.setScalar(spec.r * 5);
    group.add(halo);
    return { mesh, material, halo };
  });

  let clock = 0;
  return {
    group,
    // Clicking a globe that carries the portfolio's name opens its dossiers, like the boards.
    globes: globeMeshes.map(({ mesh }) => mesh as THREE.Object3D),
    tick(dt: number, reduced: boolean, power: number, alert: boolean) {
      if (!reduced) clock += dt;
      const day = cityUniforms.cityDay.value,
        night = cityUniforms.cityNight.value;
      const level = THREE.MathUtils.lerp(0.62, 1, night) * (1 - day * 0.72) * power;
      signMaterial.uniforms.time.value = clock;
      signMaterial.uniforms.power.value = power;
      signMaterial.uniforms.tint.value.setRGB(1, alert ? 0.4 : 1, alert ? 0.34 : 1);
      tubeMaterial.color.setScalar(level);
      if (alert) tubeMaterial.color.setRGB(level, level * 0.4, level * 0.34);
      globeMeshes.forEach(({ mesh, material, halo }, i) => {
        material.uniforms.time.value = clock;
        material.uniforms.level.value = level * (reduced ? 1 : 0.9 + 0.1 * Math.sin(clock * 3.3 + i));
        halo.material.opacity = 0.16 * level;
        if (!reduced) {
          mesh.rotation.y += dt * 0.08;
          mesh.position.y += Math.sin(clock * 0.5 + i) * dt * 0.12;
        }
      });
    },
  };
}
