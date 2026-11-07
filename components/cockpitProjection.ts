import * as THREE from "three";
import { glowTexture } from "./landingKit";
import { destinations } from "./universe";

// Where each world lies in the galaxy, as a distance from the centre (1 is the rim) and an angle:
// Coruscant in the Core, the others out towards the Outer Rim, and Mustafar in the missing piece.
const PLACES: [number, number][] = [
  [0.84, -2.55],
  [0.9, 2.05],
  [0.31, 1.95],
  [0.55, 1.05],
  [0.93, -0.2],
  [0.88, -1.08],
];
export const MUSTAFAR = 5;
const BASE_RADIUS = 0.42;
const SMALL_RADIUS = 0.1;
const CHOSEN_RADIUS = 0.15;
const SECTORS = 10;
const STARS = 7600;
const PIECE_STARS = 620;
const PIECE = { r: 0.88, angle: -1.08, size: 0.2 };
const LAYOUTS = {
  wide: { center: new THREE.Vector3(0, 2.34, -4), radius: 2.05, tilt: 0.4 },
  tall: { center: new THREE.Vector3(0, 2.72, -4), radius: 1.32, tilt: 0.5 },
};

const inPiece = (x: number, z: number) => Math.hypot(x - Math.cos(PIECE.angle) * PIECE.r, z - Math.sin(PIECE.angle) * PIECE.r) < PIECE.size;
// The stars of the spiral: two arms and a bright core, cut into ten fragments that follow the arms,
// plus the stars of the missing piece, which arrive from outside the galaxy when R-X7 projects it.
function galaxyGeometry() {
  const count = STARS + PIECE_STARS;
  const positions = new Float32Array(count * 3),
    offsets = new Float32Array(count * 3),
    sectors = new Float32Array(count),
    seeds = new Float32Array(count),
    heat = new Float32Array(count);
  let seed = 1977;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
  let written = 0;
  while (written < STARS) {
    const core = written < STARS * 0.17;
    const r = core ? Math.pow(rand(), 1.6) * 0.2 : 0.1 + Math.pow(rand(), 0.75) * 0.9;
    const arm = Math.floor(rand() * 2) * Math.PI;
    const angle = core ? rand() * Math.PI * 2 : arm + r * 5.4 + gauss() * (0.5 - r * 0.22);
    const x = Math.cos(angle) * r,
      z = Math.sin(angle) * r;
    if (inPiece(x, z)) continue;
    positions.set([x, gauss() * (core ? 0.07 * (1 - r * 3) : 0.022), z], written * 3);
    const turn = ((angle - r * 1.7) / (Math.PI * 2)) % 1;
    sectors[written] = Math.floor((turn + 1) % 1 * SECTORS) % SECTORS;
    seeds[written] = rand();
    heat[written] = core ? 1 - r * 3.5 : 0;
    written++;
  }
  for (let i = STARS; i < count; i++) {
    const angle = rand() * Math.PI * 2,
      r = Math.sqrt(rand()) * PIECE.size;
    positions.set([Math.cos(PIECE.angle) * PIECE.r + Math.cos(angle) * r, gauss() * 0.022, Math.sin(PIECE.angle) * PIECE.r + Math.sin(angle) * r], i * 3);
    offsets.set([(rand() - 0.2) * 1.4, 0.4 + rand() * 1.1, rand() * 1.5], i * 3);
    sectors[i] = SECTORS;
    seeds[i] = rand();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aOffset", new THREE.BufferAttribute(offsets, 3));
  geometry.setAttribute("aSector", new THREE.BufferAttribute(sectors, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute("aHeat", new THREE.BufferAttribute(heat, 1));
  return geometry;
}
const galaxyVertex = `
 uniform float lit[${SECTORS}];uniform float piece;uniform float time;uniform float scale;uniform float power;
 attribute vec3 aOffset;attribute float aSeed;attribute float aHeat;attribute float aSector;
 varying float vLit;varying float vHeat;varying float vTwinkle;varying float vReveal;varying float vFront;
 void main(){
  bool last=aSector>${SECTORS - 0.5};
  vLit=last?piece:lit[int(aSector+0.5)];
  vHeat=aHeat;
  vTwinkle=0.72+0.28*sin(time*(1.2+aSeed*2.6)+aSeed*40.0);
  vec3 p=position+(last?aOffset*(1.0-piece)*(1.0-piece):vec3(0.0));
  // Lighting up: the spiral winds out of the core, and a bright front runs through it to the rim.
  float open=smoothstep(0.14,1.0,power);
  float reach=length(position.xz);
  float front=open*1.2;
  vReveal=1.0-smoothstep(front-0.2,front,reach);
  vFront=exp(-pow((reach-front+0.06)/0.09,2.0))*(1.0-smoothstep(0.86,1.0,power));
  // The missing piece is nowhere to be seen until R-X7 sends it.
  if(last){vReveal*=piece;vFront*=piece;}
  float wound=(1.0-open)*(1.0-open)*3.2;
  float c=cos(wound),s=sin(wound);
  p.xz=mat2(c,-s,s,c)*p.xz*(0.03+0.97*open);
  p.y*=open;
  vec4 view=modelViewMatrix*vec4(p,1.0);
  gl_Position=projectionMatrix*view;
  gl_PointSize=(1.0+aSeed*1.9+aHeat*1.5)*scale*(1.0+vLit*0.3+vFront*1.6)/max(0.2,-view.z)*15.0;
 }`;
const galaxyFragment = `
 uniform float flicker;
 varying float vLit;varying float vHeat;varying float vTwinkle;varying float vReveal;varying float vFront;
 void main(){
  float d=length(gl_PointCoord-0.5)*2.0;
  float dot=pow(max(0.0,1.0-d),1.7);
  vec3 cold=mix(vec3(0.2,0.33,0.42),vec3(0.46,0.88,1.0),vLit);
  vec3 color=mix(cold,vec3(1.0,0.93,0.78),vHeat*(0.2+vLit*0.42));
  color=mix(color,vec3(0.82,0.96,1.0),vFront);
  gl_FragColor=vec4(color,dot*vTwinkle*(0.48+vLit*0.52)*max(vReveal,vFront)*flicker+dot*vFront*0.7*flicker);
  if(gl_FragColor.a<0.004)discard;
 }`;

const vertex = `
 varying vec3 vNormal;
 varying vec3 vViewNormal;
 varying vec3 vViewPosition;
 varying vec3 vLocal;
 void main(){
  vNormal=normalize(normal);
  vLocal=position;
  vViewNormal=normalize(normalMatrix*normal);
  vec4 view=modelViewMatrix*vec4(position,1.0);
  vViewPosition=view.xyz;
  gl_Position=projectionMatrix*view;
 }`;

const surfaceFragment = `
 uniform sampler2D image;
 uniform vec2 imageCenter;
 uniform vec2 imageRadius;
 uniform float ready;
 uniform float time;
 uniform float focus;
 uniform float gain;
 uniform vec3 tint;
 varying vec3 vNormal;
 varying vec3 vViewNormal;
 varying vec3 vViewPosition;
 varying vec3 vLocal;
 float hash(vec3 p){return fract(sin(dot(p,vec3(41.3,289.1,117.7)))*43758.5453);}
 void main(){
  vec3 n=normalize(vNormal);
  vec2 uv=imageCenter+n.xy*imageRadius*.992;
  vec3 reference=texture2D(image,uv).rgb;
  float relief=clamp(sqrt(max(0.0,dot(reference,vec3(.2126,.7152,.0722))))*gain,0.0,1.0);
  float technical=.24+.25*sin(n.x*13.0+n.z*5.0)*sin(n.y*19.0-n.z*7.0);
  relief=mix(technical,relief,ready);
  float face=max(0.0,dot(normalize(vViewNormal),normalize(-vViewPosition)));
  float rim=pow(1.0-face,2.7);
  float band=.72+.28*smoothstep(.18,.68,fract(gl_FragCoord.y*.27-time*.22));
  float sweep=pow(max(0.0,cos(n.y*5.0-time*.55)),24.0)*.15;
  float detail=smoothstep(.025,.72,relief);
  float grain=.91+.09*hash(floor(n*170.0)+floor(time*6.0));
  float alpha=(.15+detail*.44+rim*.42+sweep)*band*grain;
  vec3 color=tint*(.5+detail*.68+rim*.32)+vec3(.12,.2,.23)*rim;
  color*=1.0+focus*.18;
  gl_FragColor=vec4(color,min(.84,alpha));
  #include <colorspace_fragment>
 }`;

const atmosphereFragment = `
 uniform vec3 tint;
 uniform float focus;
 varying vec3 vViewNormal;
 varying vec3 vViewPosition;
 void main(){
  float face=max(0.0,dot(normalize(vViewNormal),normalize(-vViewPosition)));
  float rim=pow(1.0-face,4.5);
  gl_FragColor=vec4(tint,rim*(.2+focus*.17));
 }`;

function circle(radius: number, segments = 96) {
  const points = Array.from({ length: segments }, (_, index) => {
    const angle = (index / segments) * Math.PI * 2;
    return new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      0,
    );
  });
  return new THREE.BufferGeometry().setFromPoints(points);
}

/** A self-contained projection; the parent supplies its cockpit, camera and controls. */
export function createCockpitProjection() {
  const group = new THREE.Group();
  group.name = "cockpit-stellar-projection";
  const emitter = new THREE.Vector3(0, 0.78, -2.03);
  const cyan = new THREE.Color(0x58d2ff);
  const violet = new THREE.Color(0xb99cff);
  const ember = new THREE.Color(0xff6a2c);
  const blaze = new THREE.Color(0xffb15a);
  const fallback = new THREE.DataTexture(
    new Uint8Array([190, 215, 230, 255]),
    1,
    1,
  );
  fallback.colorSpace = THREE.SRGBColorSpace;
  fallback.needsUpdate = true;
  const textures = new Set<THREE.Texture>([fallback]);
  let disposed = false;
  const loader = new THREE.TextureLoader();
  const makeUniforms = (centerX: number, centerY: number, radiusX: number, radiusY: number, gain: number) => ({
    image: { value: fallback as THREE.Texture },
    imageCenter: { value: new THREE.Vector2(centerX, centerY) },
    imageRadius: { value: new THREE.Vector2(radiusX, radiusY) },
    ready: { value: 0 },
    time: { value: 0 },
    focus: { value: 0 },
    gain: { value: gain },
    tint: { value: cyan.clone() },
  });
  const uniforms = destinations.map((destination, index) => {
    const frame = destination.reference;
    const values = makeUniforms(frame.centerX / frame.width, 1 - frame.centerY / frame.height, frame.radius / frame.width, frame.radius / frame.height, index === 2 ? 2.35 : 1.1);
    loader.load(
      destination.image,
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        textures.add(texture);
        values.image.value = texture;
        values.ready.value = 1;
      },
      undefined,
      () => {
        // The procedural globe and its meridians remain available offline.
      },
    );
    return values;
  });
  // Mustafar is not in the catalogue of destinations: its cracked surface is painted here.
  {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "#1a1412";
    c.fillRect(0, 0, 512, 512);
    let seed = 66;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    c.lineCap = "round";
    for (let river = 0; river < 42; river++) {
      let x = rand() * 512,
        y = rand() * 512,
        heading = rand() * Math.PI * 2;
      c.strokeStyle = `rgba(255,255,255,${0.45 + rand() * 0.55})`;
      c.lineWidth = 1 + rand() * 6;
      c.beginPath();
      c.moveTo(x, y);
      for (let step = 0; step < 16; step++) {
        heading += (rand() - 0.5) * 1.1;
        x += Math.cos(heading) * 24;
        y += Math.sin(heading) * 24;
        c.lineTo(x, y);
      }
      c.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.add(texture);
    const values = makeUniforms(0.5, 0.5, 0.5, 0.5, 1.5);
    values.image.value = texture;
    values.ready.value = 1;
    values.tint.value.copy(ember);
    uniforms.push(values);
  }

  // The galaxy itself, tilted towards the pilot and turning very slowly.
  const galaxyUniforms = {
    lit: { value: new Array<number>(SECTORS).fill(0.15) },
    piece: { value: 0 },
    time: { value: 0 },
    scale: { value: 1 },
    power: { value: 1 },
    flicker: { value: 1 },
  };
  const galaxy = new THREE.Group();
  const disk = new THREE.Points(
    galaxyGeometry(),
    new THREE.ShaderMaterial({ uniforms: galaxyUniforms, vertexShader: galaxyVertex, fragmentShader: galaxyFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }),
  );
  disk.frustumCulled = false;
  galaxy.add(disk);
  // The rings of the galactic grid, and the broken outline of the piece that is missing.
  const ringMaterial = new THREE.LineBasicMaterial({ color: 0x4fb4dc, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const rings = [0.25, 0.55, 1].map((r) => {
    const ring = new THREE.LineLoop(circle(r, 96), ringMaterial);
    ring.rotation.x = Math.PI / 2;
    galaxy.add(ring);
    return ring;
  });
  const gapMaterial = new THREE.LineDashedMaterial({ color: 0xff9860, dashSize: 0.028, gapSize: 0.026, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false });
  const gap = new THREE.LineLoop(circle(PIECE.size, 44), gapMaterial);
  gap.rotation.x = Math.PI / 2;
  gap.position.set(Math.cos(PIECE.angle) * PIECE.r, 0, Math.sin(PIECE.angle) * PIECE.r);
  gap.computeLineDistances();
  galaxy.add(gap);
  group.add(galaxy);

  const meridians: THREE.Group[] = [];
  const halos: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>[] =
    [];
  const grids: THREE.LineDashedMaterial[] = [];
  const names = [...destinations.map((destination) => destination.className), "mustafar"];
  const planets = names.map((name, index) => {
    const root = new THREE.Group();
    const radius = BASE_RADIUS;
    root.name = `hologram-${name}`;
    root.userData.radius = SMALL_RADIUS;
    const material = new THREE.ShaderMaterial({
      uniforms: uniforms[index],
      vertexShader: vertex,
      fragmentShader: surfaceFragment,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    root.add(
      new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), material),
    );
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.037, 64, 40),
      new THREE.ShaderMaterial({
        uniforms: { tint: uniforms[index].tint, focus: uniforms[index].focus },
        vertexShader: vertex,
        fragmentShader: atmosphereFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        fog: false,
      }),
    );
    root.add(atmosphere);
    const grid = new THREE.Group();
    const lineMaterial = new THREE.LineDashedMaterial({
      color: 0x8bdeff,
      dashSize: radius * 0.095,
      gapSize: radius * 0.07,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const gridPoints: number[] = [];
    const appendRing = (
      ring: THREE.BufferGeometry,
      rotation: THREE.Euler,
      y = 0,
    ) => {
      const transform = new THREE.Matrix4().makeRotationFromEuler(rotation);
      transform.setPosition(0, y, 0);
      ring.applyMatrix4(transform);
      const position = ring.getAttribute("position");
      for (let segment = 0; segment < position.count; segment++) {
        const next = (segment + 1) % position.count;
        gridPoints.push(
          position.getX(segment),
          position.getY(segment),
          position.getZ(segment),
          position.getX(next),
          position.getY(next),
          position.getZ(next),
        );
      }
      ring.dispose();
    };
    for (let meridian = 0; meridian < 3; meridian++) {
      appendRing(
        circle(radius * 1.008, 72),
        new THREE.Euler(0, (meridian * Math.PI) / 3, 0),
      );
    }
    for (const latitude of [-0.5, 0.5]) {
      appendRing(
        circle(radius * Math.sqrt(1 - latitude * latitude) * 1.008, 72),
        new THREE.Euler(Math.PI / 2, 0, 0),
        radius * latitude,
      );
    }
    const gridGeometry = new THREE.BufferGeometry();
    gridGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(gridPoints, 3),
    );
    const gridLines = new THREE.LineSegments(gridGeometry, lineMaterial);
    gridLines.computeLineDistances();
    grid.add(gridLines);
    root.add(grid);
    meridians.push(grid);
    grids.push(lineMaterial);
    const halo = new THREE.LineLoop(
      circle(radius * 1.19),
      new THREE.LineBasicMaterial({
        color: 0xb6b1ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    halo.rotation.set(0.35, -0.18, 0);
    root.add(halo);
    halos.push(halo);
    // Worlds are always drawn over the stars, whose light would otherwise wash them out.
    root.traverse((item) => (item.renderOrder = 5));
    group.add(root);
    return root;
  });

  // The light of the projector, spreading up from the emitter into the galaxy.
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(1, 1, 40, 1, true),
    new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      uniforms: { fade: { value: 1 } },
      fragmentShader: `uniform float fade;varying vec2 vUv;void main(){gl_FragColor=vec4(.18,.64,.9,.045*fade*pow(vUv.y,1.6));}`,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  beam.name = "hologram-projector-beam";
  group.add(beam);
  // Lighting up: a flash at the emitter, then a thin column of light that climbs to the galaxy's core.
  const glow = glowTexture();
  textures.add(glow);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x9fe4ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  flash.position.copy(emitter);
  group.add(flash);
  const coreFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xd8f4ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  group.add(coreFlash);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.05, 1, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xbdeeff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }));
  group.add(column);
  // A ring marks the chosen world where it lies.
  const pin = new THREE.LineLoop(circle(0.2, 40), new THREE.LineBasicMaterial({ color: 0xd8c8ff, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
  group.add(pin);
  // The ray R-X7 projects to fill the missing piece, from behind the pilot.
  const rayGeometry = new THREE.BufferGeometry();
  const rayPoints = new Float32Array(6);
  rayGeometry.setAttribute("position", new THREE.BufferAttribute(rayPoints, 3));
  const ray = new THREE.LineSegments(rayGeometry, new THREE.LineBasicMaterial({ color: 0xffc18a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  ray.frustumCulled = false;
  group.add(ray);

  const up = new THREE.Vector3(0, 1, 0);
  let layout = LAYOUTS.wide;
  let compact: boolean | null = null;
  function setCompact(value: boolean) {
    if (value === compact) return;
    compact = value;
    layout = value ? LAYOUTS.tall : LAYOUTS.wide;
    const direction = layout.center.clone().sub(emitter);
    const distance = direction.length();
    beam.geometry.dispose();
    beam.geometry = new THREE.ConeGeometry(layout.radius * 0.72, distance, 40, 1, true);
    beam.position.copy(emitter).add(layout.center).multiplyScalar(0.5);
    beam.quaternion.setFromUnitVectors(up, direction.clone().normalize().negate());
    column.position.copy(emitter).add(layout.center).multiplyScalar(0.5);
    column.scale.y = distance;
    column.quaternion.setFromUnitVectors(up, direction.normalize());
    coreFlash.position.copy(layout.center);
    galaxy.position.copy(layout.center);
    galaxy.rotation.set(layout.tilt, 0, 0);
    galaxy.scale.setScalar(layout.radius);
  }
  setCompact(false);

  const places = PLACES.map(([r, angle]) => new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r));
  const spot = new THREE.Vector3(),
    tipLocal = new THREE.Vector3();
  const appeared = PLACES.map(() => 1);
  const lit = new Array<number>(SECTORS).fill(0);
  let hasMustafar = false,
    pieceAmount = 0,
    power = 1,
    last = -1;
  const bell = (value: number, from: number, peak: number, to: number) => THREE.MathUtils.smoothstep(value, from, peak) * (1 - THREE.MathUtils.smoothstep(value, peak, to));
  return {
    group,
    planets: planets as THREE.Object3D[],
    setCompact,
    // Which of the ten fragments the visitor has found, in the order of the missions.
    setFragments(found: boolean[]) {
      found.slice(0, SECTORS).forEach((on, index) => (lit[index] = on ? 1 : 0));
    },
    // 0 is the gap; 1 is the piece in place, with Mustafar on it. Between the two, R-X7 is projecting.
    setPiece(amount: number) {
      pieceAmount = amount;
      hasMustafar = amount >= 0.72;
    },
    // 0 is dark, 1 is fully lit; the parent runs it forwards to switch on and backwards to switch off.
    setPower(value: number) {
      power = value;
    },
    // How far a world's marker should show, as the lighting front reaches it.
    appeared: (index: number) => appeared[index] ?? 1,
    tick(elapsed: number, selected: number, reduced: boolean) {
      const dt =
        last < 0 ? 1 / 60 : THREE.MathUtils.clamp(elapsed - last, 0, 0.05);
      last = elapsed;
      galaxy.rotation.y = reduced ? 0 : elapsed * 0.006;
      galaxy.updateMatrix();
      // The tube strikes: it stutters while the power comes up, then holds steady.
      const flicker = reduced || power >= 0.5 ? 1 : 0.55 + 0.45 * Math.sign(Math.sin(elapsed * 61) + Math.sin(elapsed * 23));
      flash.material.opacity = bell(power, 0, 0.1, 0.42) * flicker;
      flash.scale.setScalar(0.4 + power * 2.2);
      (column.material as THREE.MeshBasicMaterial).opacity = bell(power, 0.03, 0.2, 0.62) * 0.85 * flicker;
      coreFlash.material.opacity = bell(power, 0.14, 0.26, 0.68) * 0.95 * flicker;
      coreFlash.scale.setScalar(0.4 + bell(power, 0.14, 0.3, 0.8) * 2.3);
      (beam.material as THREE.ShaderMaterial).uniforms.fade.value = THREE.MathUtils.smoothstep(power, 0.3, 1);
      const open = THREE.MathUtils.smoothstep(power, 0.14, 1);
      ringMaterial.opacity = 0.16 * open;
      rings.forEach((ring) => ring.scale.setScalar(Math.max(0.01, open)));
      galaxyUniforms.power.value = power;
      galaxyUniforms.flicker.value = flicker;
      galaxyUniforms.time.value = reduced ? 0 : elapsed;
      galaxyUniforms.piece.value = pieceAmount;
      galaxyUniforms.scale.value = compact ? 0.82 : 1;
      galaxyUniforms.lit.value.forEach((value, index) => {
        galaxyUniforms.lit.value[index] = reduced ? lit[index] : THREE.MathUtils.damp(value, lit[index], 2.2, dt);
      });
      gap.visible = pieceAmount < 0.99 && power > 0.86;
      gapMaterial.opacity = (reduced ? 0.8 : 0.55 + Math.sin(elapsed * 2.4) * 0.25) * (1 - pieceAmount);
      if (!reduced && pieceAmount > 0 && pieceAmount < 1) gapMaterial.opacity = 0.9 * (1 - pieceAmount);

      uniforms.forEach((values, index) => {
        const target = selected === index ? 1 : 0;
        values.focus.value = reduced
          ? target
          : THREE.MathUtils.damp(values.focus.value, target, 5, dt);
        values.time.value = reduced ? 0 : elapsed;
        if (index === MUSTAFAR) values.tint.value.copy(ember).lerp(blaze, values.focus.value * 0.6);
        else values.tint.value.copy(cyan).lerp(violet, values.focus.value * 0.68);
        grids[index].opacity = 0.075 + values.focus.value * 0.055;
        halos[index].material.opacity = values.focus.value * 0.58;
        const scale = reduced ? 1 : 1 + Math.sin(elapsed * 1.4) * 0.012;
        halos[index].scale.setScalar(scale);
        if (!reduced)
          meridians[index].rotation.y = elapsed * (0.09 + index * 0.008);
        // Each world stays at its place in the galaxy, and flares up as the lighting front reaches it.
        const planet = planets[index];
        const reach = PLACES[index][0];
        const pop = reduced ? 1 : THREE.MathUtils.smoothstep(power, 0.2 + reach * 0.62, 0.34 + reach * 0.62);
        appeared[index] = pop;
        planet.visible = pop > 0.01 && (index !== MUSTAFAR || hasMustafar);
        spot.copy(places[index]).applyMatrix4(galaxy.matrix);
        planet.position.copy(spot);
        const small = index === MUSTAFAR ? SMALL_RADIUS * 1.15 : SMALL_RADIUS;
        const size = THREE.MathUtils.lerp(small, CHOSEN_RADIUS, THREE.MathUtils.smoothstep(values.focus.value, 0, 1));
        planet.scale.setScalar((size / BASE_RADIUS) * pop * (1 + Math.sin(pop * Math.PI) * 0.7));
        planet.userData.radius = size;
        if (selected === index) {
          pin.position.copy(spot);
          pin.visible = pop > 0.9;
          pin.rotation.set(layout.tilt + Math.PI / 2, 0, 0);
          pin.scale.setScalar(reduced ? 1 : 1 + Math.sin(elapsed * 3) * 0.1);
        }
      });
      // The projection from R-X7, only while the piece is arriving.
      const projecting = pieceAmount > 0 && pieceAmount < 1;
      ray.visible = projecting;
      if (projecting) {
        tipLocal.copy(places[MUSTAFAR]).applyMatrix4(galaxy.matrix);
        rayPoints.set([1.4, -0.4, 3.6], 0);
        tipLocal.toArray(rayPoints, 3);
        rayGeometry.getAttribute("position").needsUpdate = true;
        ray.material.opacity = Math.sin(pieceAmount * Math.PI) * 0.9;
      }
    },
    dispose() {
      disposed = true;
      textures.forEach((texture) => texture.dispose());
      textures.clear();
    },
  };
}
