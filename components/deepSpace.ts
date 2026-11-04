import * as THREE from "three";
import { Lensflare, LensflareElement } from "three/examples/jsm/objects/Lensflare.js";

// The depth of open space: three star shells at different distances that slide at different rates
// as the ship travels, dust motes drifting past the hull, and the system's sun with its flare.

function random(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// The galactic plane, shared with the nebula sky so the dense band of stars follows the milky glow.
export const galacticNormal = new THREE.Vector3(0.28, 0.9, -0.33).normalize();
const bandU = new THREE.Vector3().crossVectors(galacticNormal, new THREE.Vector3(0, 0, 1)).normalize();
const bandV = new THREE.Vector3().crossVectors(galacticNormal, bandU);

// Stellar colours from hot blue giants to cool red dwarfs, with the white and yellow majority.
const starTints = [
  { share: 0.1, color: [0.66, 0.77, 1] },
  { share: 0.32, color: [0.9, 0.94, 1] },
  { share: 0.3, color: [1, 0.97, 0.9] },
  { share: 0.18, color: [1, 0.87, 0.7] },
  { share: 0.1, color: [1, 0.72, 0.55] },
];

type Shell = {
  count: number;
  near: number;
  far: number;
  band: number;
  size: [number, number];
  brightness: [number, number];
  flareEvery: number;
  // How much of the ship's travel the shell follows: 1 would pin it to the camera.
  follow: number;
  twinkle: number;
};

const shells: Shell[] = [
  // The far field: dense, faint and almost fixed.
  { count: 7200, near: 255, far: 300, band: 0.55, size: [0.85, 1.5], brightness: [0.16, 0.5], flareEvery: 0, follow: 0.985, twinkle: 0.05 },
  // The middle field, which carries most of the visible stars.
  { count: 3300, near: 185, far: 235, band: 0.35, size: [1.05, 2.4], brightness: [0.3, 0.92], flareEvery: 230, follow: 0.94, twinkle: 0.08 },
  // A few close, bright stars that drift visibly against the rest.
  { count: 280, near: 120, far: 150, band: 0.15, size: [1.8, 3.4], brightness: [0.62, 1], flareEvery: 38, follow: 0.86, twinkle: 0.04 },
];

function buildShell(shell: Shell, share: number, pixelRatio: number, seed: number) {
  const rand = random(seed);
  const count = Math.max(40, Math.round(shell.count * share));
  const positions = new Float32Array(count * 3),
    tints = new Float32Array(count * 3),
    sizes = new Float32Array(count),
    phases = new Float32Array(count),
    flares = new Float32Array(count);
  const direction = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    if (rand() < shell.band) {
      // A Gaussian spread around the galactic plane.
      const angle = rand() * Math.PI * 2,
        spread = Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(rand() * Math.PI * 2) * 0.09;
      direction
        .copy(bandU)
        .multiplyScalar(Math.cos(angle))
        .addScaledVector(bandV, Math.sin(angle))
        .addScaledVector(galacticNormal, spread)
        .normalize();
    } else {
      const z = rand() * 2 - 1,
        phi = rand() * Math.PI * 2,
        ring = Math.sqrt(1 - z * z);
      direction.set(ring * Math.cos(phi), z, ring * Math.sin(phi));
    }
    direction.multiplyScalar(shell.near + rand() * (shell.far - shell.near)).toArray(positions, i * 3);
    const flare = shell.flareEvery && i % shell.flareEvery === 7 ? 1 : 0;
    // Most stars are faint: a steep power curve keeps the bright ones rare.
    const brightness = flare ? 0.95 : shell.brightness[0] + Math.pow(rand(), 2.4) * (shell.brightness[1] - shell.brightness[0]);
    let pick = rand(),
      tint = starTints[0].color;
    for (const option of starTints) {
      tint = option.color;
      if ((pick -= option.share) <= 0) break;
    }
    tints[i * 3] = tint[0] * brightness;
    tints[i * 3 + 1] = tint[1] * brightness;
    tints[i * 3 + 2] = tint[2] * brightness;
    sizes[i] = flare ? 12 + rand() * 9 : shell.size[0] + Math.pow(rand(), 6) * (shell.size[1] - shell.size[0]);
    phases[i] = rand();
    flares[i] = flare;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("tint", new THREE.BufferAttribute(tints, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("flare", new THREE.BufferAttribute(flares, 1));
  const uniforms = {
    time: { value: 0 },
    twinkle: { value: shell.twinkle },
    pixelRatio: { value: pixelRatio },
  };
  const points = new THREE.Points(
    geometry,
    new THREE.ShaderMaterial({
      uniforms,
      // No air in space: the shimmer stays a few percent, just enough to keep the field alive.
      vertexShader: `attribute vec3 tint;attribute float size;attribute float phase;attribute float flare;
       uniform float time;uniform float twinkle;uniform float pixelRatio;
       varying vec3 vTint;varying float vFlare;
       void main(){
        float shimmer=sin(time*(.35+phase*1.4)+phase*40.0)+sin(time*(1.7+phase*1.1)+phase*17.0)*.5;
        vTint=tint*(1.0+shimmer*twinkle*(1.0-flare*.6));
        vFlare=flare;
        gl_PointSize=size*pixelRatio;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
       }`,
      fragmentShader: `varying vec3 vTint;varying float vFlare;
       void main(){
        vec2 p=gl_PointCoord*2.0-1.0;float d=length(p);
        if(d>1.0)discard;
        float soft=smoothstep(1.0,.15,d);
        float spikes=(max(0.0,1.0-abs(p.x)*16.0)+max(0.0,1.0-abs(p.y)*16.0))*pow(1.0-d,2.4)*.55;
        float glow=exp(-d*d*40.0)+exp(-d*5.5)*.22+spikes;
        gl_FragColor=vec4(vTint,mix(soft,glow,vFlare));
       }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  points.frustumCulled = false;
  points.renderOrder = -1;
  return { points, uniforms, follow: shell.follow };
}

export function createStarLayers(pixelRatio: number, share: number) {
  const group = new THREE.Group();
  const layers = shells.map((shell, index) => buildShell(shell, share, pixelRatio, 74 + index * 911));
  layers.forEach((layer) => group.add(layer.points));
  return {
    group,
    // Each shell follows the camera at its own rate: the close stars slide against the far field.
    update: (camera: THREE.Camera, elapsed: number, reduced: boolean) => {
      layers.forEach((layer, index) => {
        layer.points.position.copy(camera.position).multiplyScalar(layer.follow);
        layer.uniforms.time.value = elapsed;
        layer.uniforms.twinkle.value = reduced ? 0 : shells[index].twinkle;
      });
    },
    setPixelRatio: (ratio: number) => layers.forEach((layer) => (layer.uniforms.pixelRatio.value = ratio)),
  };
}

// Fine dust in a box that tiles around the camera: motes stream past when the ship moves and
// hang still when it stops, which is what tells the eye that the ship is travelling.
export function createSpaceDust(capacity: number, pixelRatio: number) {
  const rand = random(4242);
  const span = 46;
  const count = Math.max(1, capacity);
  const positions = new Float32Array(count * 3),
    sizes = new Float32Array(count),
    tones = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (rand() - 0.5) * span;
    positions[i * 3 + 1] = (rand() - 0.5) * span;
    positions[i * 3 + 2] = (rand() - 0.5) * span;
    sizes[i] = 0.5 + Math.pow(rand(), 3) * 1.6;
    tones[i] = rand();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("tone", new THREE.BufferAttribute(tones, 1));
  const uniforms = {
    origin: { value: new THREE.Vector3() },
    span: { value: span },
    pixelRatio: { value: pixelRatio },
    opacity: { value: 1 },
  };
  const points = new THREE.Points(
    geometry,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `attribute float size;attribute float tone;
       uniform vec3 origin;uniform float span;uniform float pixelRatio;
       varying float vFade;varying float vTone;
       void main(){
        vec3 offset=mod(position-origin+span*.5,span)-span*.5;
        float reach=length(offset);
        vFade=smoothstep(span*.5,span*.28,reach)*smoothstep(.8,3.0,reach);
        vTone=tone;
        vec4 view=viewMatrix*vec4(origin+offset,1.0);
        gl_PointSize=clamp(size*pixelRatio*(16.0/max(.5,-view.z)),0.0,6.0*pixelRatio);
        gl_Position=projectionMatrix*view;
       }`,
      fragmentShader: `uniform float opacity;varying float vFade;varying float vTone;
       void main(){
        float d=length(gl_PointCoord*2.0-1.0);
        if(d>1.0)discard;
        vec3 color=mix(vec3(.62,.72,.82),vec3(.86,.78,.66),vTone);
        gl_FragColor=vec4(color,smoothstep(1.0,.1,d)*vFade*.32*opacity);
       }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  points.frustumCulled = false;
  return {
    points,
    update: (camera: THREE.Camera, visible: number) => {
      uniforms.origin.value.copy(camera.position);
      geometry.setDrawRange(0, Math.min(count, Math.max(0, Math.round(visible))));
      points.visible = visible > 0;
    },
    setPixelRatio: (ratio: number) => (uniforms.pixelRatio.value = ratio),
  };
}

function flareTexture(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size = 128) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  draw(canvas.getContext("2d")!, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// The system's star, set at infinity in the same direction as the key light, with a restrained
// flare: a warm core, a wide halo and a few faint ghosts across the frame.
export function createSun(direction: THREE.Vector3) {
  const group = new THREE.Group();
  const offset = direction.clone().normalize().multiplyScalar(280);
  const halo = flareTexture((ctx, size) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,250,236,1)");
    g.addColorStop(0.08, "rgba(255,236,200,.95)");
    g.addColorStop(0.22, "rgba(255,196,130,.32)");
    g.addColorStop(0.55, "rgba(255,150,90,.07)");
    g.addColorStop(1, "rgba(255,140,80,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }, 256);
  const ghost = flareTexture((ctx, size) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.32, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.7, "rgba(255,255,255,.22)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
  const disk = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: halo,
      color: 0xfff1dc,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    }),
  );
  disk.scale.setScalar(34);
  group.add(disk);
  const flare = new Lensflare();
  flare.addElement(new LensflareElement(halo, 420, 0, new THREE.Color(0xffe6c4)));
  flare.addElement(new LensflareElement(ghost, 60, 0.42, new THREE.Color(0x7fb8ff)));
  flare.addElement(new LensflareElement(ghost, 90, 0.66, new THREE.Color(0xb48cff)));
  flare.addElement(new LensflareElement(ghost, 44, 0.86, new THREE.Color(0x8fe4ff)));
  flare.addElement(new LensflareElement(ghost, 130, 1.08, new THREE.Color(0xffc48a)));
  group.add(flare);
  return {
    group,
    update: (camera: THREE.Camera, flareOn: boolean) => {
      group.position.copy(camera.position).add(offset);
      flare.visible = flareOn;
    },
    dispose: () => {
      halo.dispose();
      ghost.dispose();
      flare.dispose();
    },
  };
}
