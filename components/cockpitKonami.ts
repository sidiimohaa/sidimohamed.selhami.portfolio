import * as THREE from "three";

// The cockpit's hidden code: ↑ ↑ ↓ ↓ ← → ← → B A.
// The radar shows it to whoever watches the sweep: ten faint contacts on its outer ring, which glow
// for a moment each time the beam passes over them. Every right key lights a dashboard button and
// moves the flight stick. The whole code sounds the red alert, then the X-wing makes an unplanned
// jump to hyperspace and comes out in intergalactic space, facing a real supercluster (a different
// one at each jump).

export const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"] as const;
const GLYPHS = ["▲", "▲", "▼", "▼", "◀", "▶", "◀", "▶", "B", "A"];

export type WarpPhase = "idle" | "alert" | "jump" | "arrived" | "return";

// Timeline of the outbound jump, in seconds from the last key.
const ALERT = 2.8,
  SPOOL = 1.8,
  TUNNEL = 3.8,
  EXIT = 0.9;
// Back home, without the alarm.
const BACK_SPOOL = 1.2,
  BACK_TUNNEL = 2.6;

// The radar screen (the left instrument pod of cockpitSystems): same size and placement.
const RADAR = { w: 0.64, h: 0.39, x: -1.63, y: 0.9, z: -1.47 + 0.04, rx: -0.34, ry: 0.12 };
// Where the glyphs sit around the radar's outer ring (in the shader's p space), in sweep order.
const RING = 0.76,
  FIRST = Math.PI * 0.5,
  STEP = (Math.PI * 2) / GLYPHS.length;

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function glyphTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 780;
  const g = canvas.getContext("2d")!;
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = "#fff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  GLYPHS.forEach((glyph, i) => {
    const angle = FIRST + i * STEP;
    const x = (Math.cos(angle) * RING * 0.5 + 0.5) * canvas.width,
      y = (1 - (Math.sin(angle) * RING * 0.5 + 0.5)) * canvas.height;
    g.font = glyph.length === 1 && /[AB]/.test(glyph) ? "700 54px ui-monospace, Menlo, monospace" : "700 44px ui-monospace, Menlo, monospace";
    g.fillText(glyph, x, y);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

/** The radar overlay that reads out the code, with the pilot's progress on it. */
function createRadarCode() {
  const uniforms = {
    map: { value: glyphTexture() },
    time: { value: 0 },
    progress: { value: 0 },
    alarm: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      uniform sampler2D map;uniform float time;uniform float progress;uniform float alarm;
      varying vec2 vUv;
      const float TAU=6.28318530718;
      void main(){
        float mask=texture2D(map,vUv).a;
        if(mask<.01) discard;
        vec2 p=(vUv-.5)*2.0;
        float a=atan(p.y,p.x);
        // Same beam as the radar: it turns at .6 rad/s; a contact glows after it and fades out.
        float behind=mod(time*.6-a,TAU);
        float glow=exp(-behind*1.6);
        float index=floor(mod(a-${FIRST.toFixed(5)}+${(STEP / 2).toFixed(5)},TAU)/${STEP.toFixed(5)});
        float lit=step(index+.5,progress);
        vec3 phosphor=vec3(.48,.77,.66);
        vec3 amber=vec3(1.,.66,.28);
        vec3 red=vec3(1.,.16,.1);
        vec3 color=phosphor*(.07+glow*1.15);
        color=mix(color,amber*1.25,lit);
        color=mix(color,red*(.6+.6*step(.0,sin(time*14.))),alarm);
        gl_FragColor=vec4(color*mask,1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(RADAR.w, RADAR.h), material);
  mesh.position.set(RADAR.x, RADAR.y, RADAR.z);
  mesh.rotation.set(RADAR.rx, RADAR.ry, 0);
  mesh.translateZ(0.003);
  mesh.renderOrder = 2;
  return { mesh, uniforms };
}

/** A flight stick on the right side console, on its middle panel: it answers each key of the code. */
function createStick() {
  const group = new THREE.Group();
  group.position.set(1.78, 0.465, -0.06);
  group.scale.setScalar(1.35);
  const metal = new THREE.MeshStandardMaterial({ color: 0x6d777c, metalness: 0.8, roughness: 0.42 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x141b20, metalness: 0.45, roughness: 0.8 });
  const grip = new THREE.MeshStandardMaterial({ color: 0x1c1f22, roughness: 0.92 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.05, 20), dark);
  group.add(base);
  const boot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), grip);
  boot.position.y = 0.02;
  group.add(boot);
  const pivot = new THREE.Group();
  pivot.position.y = 0.04;
  group.add(pivot);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.22, 10), metal);
  shaft.position.y = 0.11;
  pivot.add(shaft);
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.09, 4, 10), grip);
  handle.position.set(0, 0.27, 0.01);
  handle.rotation.x = -0.18;
  pivot.add(handle);
  // Thumb buttons on top: B on the left, A on the right.
  const buttonB = new THREE.MeshBasicMaterial({ color: 0x5a1a14, toneMapped: false });
  const buttonA = new THREE.MeshBasicMaterial({ color: 0x5a3a14, toneMapped: false });
  const thumbB = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 10), buttonB);
  thumbB.position.set(-0.014, 0.335, 0.004);
  const thumbA = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 10), buttonA);
  thumbA.position.set(0.014, 0.335, 0.004);
  pivot.add(thumbB, thumbA);
  const tilt = { x: 0, z: 0, vx: 0, vz: 0 };
  const thumbs = { b: 0, a: 0 };
  return {
    group,
    push(key: string) {
      // A shove in the key's direction; a spring brings the stick back.
      if (key === "ArrowUp") tilt.vx -= 4.2;
      if (key === "ArrowDown") tilt.vx += 4.2;
      if (key === "ArrowLeft") tilt.vz += 4.2;
      if (key === "ArrowRight") tilt.vz -= 4.2;
      if (key === "b") thumbs.b = 1;
      if (key === "a") thumbs.a = 1;
    },
    tick(dt: number, shake: number, reduced: boolean) {
      if (reduced) {
        tilt.x = tilt.z = tilt.vx = tilt.vz = 0;
      } else {
        for (const [p, v] of [["x", "vx"], ["z", "vz"]] as const) {
          tilt[v] += (-tilt[p] * 70 - tilt[v] * 7) * dt;
          tilt[p] += tilt[v] * dt;
        }
      }
      const jitter = reduced ? 0 : shake * 0.06;
      pivot.rotation.x = THREE.MathUtils.clamp(tilt.x, -0.45, 0.45) + (Math.random() - 0.5) * jitter;
      pivot.rotation.z = THREE.MathUtils.clamp(tilt.z, -0.45, 0.45) + (Math.random() - 0.5) * jitter;
      thumbs.b = Math.max(0, thumbs.b - dt * 1.4);
      thumbs.a = Math.max(0, thumbs.a - dt * 1.4);
      thumbB.position.y = 0.335 - thumbs.b * 0.006;
      thumbA.position.y = 0.335 - thumbs.a * 0.006;
      buttonB.color.setRGB(0.35 + thumbs.b * 0.65 + shake * 0.4, 0.1 + thumbs.b * 0.2, 0.08);
      buttonA.color.setRGB(0.35 + thumbs.a * 0.65, 0.22 + thumbs.a * 0.45, 0.08);
    },
  };
}

/** Lamps over the dashboard's button rows: one more lights up with each right key. */
function createLamps() {
  const spots: THREE.Vector3[] = [];
  // The twenty caps along the top of the dashboard (cockpitModel), then the overhead bay.
  for (let i = 0; i < 20; i++) spots.push(new THREE.Vector3(-1.62 + i * 0.17, 0.937, -1.77));
  for (let i = 0; i < 16; i++) spots.push(new THREE.Vector3(-1.33 + i * 0.177, 3.093, -0.72));
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.074, 0.03, 0.06),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    spots.length,
  );
  mesh.frustumCulled = false;
  const matrix = new THREE.Matrix4(),
    color = new THREE.Color();
  // The order the code lights them in: from the centre outward, alternating sides.
  const order = [9, 10, 8, 11, 7, 12, 6, 13, 5, 14];
  const level = new Float32Array(spots.length);
  return {
    mesh,
    tick(progress: number, alarm: number, age: number, reduced: boolean) {
      const blink = reduced ? 1 : Math.sin(age * 14) > 0 ? 1 : 0.15;
      spots.forEach((spot, i) => {
        const rank = order.indexOf(i);
        const target = alarm > 0 ? (i % 2 === Math.floor(age * 7) % 2 || reduced ? alarm : alarm * 0.2) : rank >= 0 && rank < progress ? 1 : 0;
        level[i] = THREE.MathUtils.damp(level[i], target, 18, 1 / 60);
        const on = level[i];
        matrix.makeScale(on > 0.02 ? 1 : 0.0001, 1, 1).setPosition(spot);
        mesh.setMatrixAt(i, matrix);
        if (alarm > 0) color.setRGB(1.6 * on * blink, 0.12 * on, 0.08 * on);
        else if (rank >= 8) color.setRGB(0.4 * on, 1.5 * on, 0.7 * on);
        else color.setRGB(0.55 * on, 1.1 * on, 1.6 * on);
        mesh.setColorAt(i, color);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
}

/** Star streaks: points that stretch into lines, then rush past the canopy. */
function createStreaks(pixelRatio: number) {
  const rand = seeded(1138);
  const count = 2200;
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0], 3));
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2;
    // Most streaks well off the axis, so the centre of the view stays a deep tunnel.
    const radius = 4 + Math.pow(rand(), 0.6) * 70;
    seeds[i * 4] = Math.cos(angle) * radius;
    seeds[i * 4 + 1] = Math.sin(angle) * radius;
    seeds[i * 4 + 2] = rand() * 600;
    seeds[i * 4 + 3] = rand();
  }
  geometry.setAttribute("seed", new THREE.InstancedBufferAttribute(seeds, 4));
  geometry.instanceCount = count;
  const uniforms = {
    travel: { value: 0 },
    stretch: { value: 0 },
    opacity: { value: 0 },
    pixelRatio: { value: pixelRatio },
  };
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      vertexShader: `
        attribute vec4 seed;uniform float travel;uniform float stretch;
        varying float vAlong;varying float vTone;varying float vFar;
        void main(){
          float z=mod(seed.z+travel*(.75+seed.w*.5),600.0)-570.0;
          vec3 head=vec3(seed.xy,z);
          vec3 tail=head-vec3(0.,0.,stretch*(.6+seed.w*.8)+.05);
          vec4 h=modelViewMatrix*vec4(head,1.),t=modelViewMatrix*vec4(tail,1.);
          vec3 along=h.xyz-t.xyz;
          vec3 mid=mix(t.xyz,h.xyz,position.y);
          vec3 side=normalize(cross(along,mid));
          float width=-mid.z*.0042*(.7+seed.w);
          mid+=side*position.x*width;
          vAlong=position.y;vTone=seed.w;vFar=clamp(-h.z/570.,0.,1.);
          gl_Position=projectionMatrix*vec4(mid,1.);
        }`,
      fragmentShader: `
        uniform float opacity;varying float vAlong;varying float vTone;varying float vFar;
        void main(){
          vec3 cold=vec3(.62,.8,1.),white=vec3(1.);
          vec3 color=mix(cold,white,vAlong*vAlong)*mix(2.2,1.,vTone);
          float alpha=opacity*pow(vAlong,1.3)*(1.-vFar*.4);
          gl_FragColor=vec4(color*alpha,alpha);
        }`,
    }),
  );
  mesh.frustumCulled = false;
  mesh.visible = false;
  return { mesh, uniforms };
}

/** The hyperspace tunnel: blue-white currents swirling round the ship. */
function createTunnel() {
  const uniforms = { time: { value: 0 }, opacity: { value: 0 } };
  const geometry = new THREE.CylinderGeometry(26, 26, 640, 48, 1, true);
  geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      vertexShader: `varying vec2 vUv;varying float vZ;void main(){vUv=uv;vZ=(modelMatrix*vec4(position,1.)).z;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `
        uniform float time;uniform float opacity;varying vec2 vUv;varying float vZ;
        float hash(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
        void main(){
          float u=vUv.x+time*.05,v=vUv.y*7.-time*3.2;
          float n=noise(vec2(u*38.,v))*.6+noise(vec2(u*90.,v*2.3))*.4;
          float streak=pow(n,3.)*3.2;
          float band=.5+.5*sin(u*6.28318*3.+v*.6);
          vec3 color=mix(vec3(.16,.38,1.),vec3(.85,.95,1.),min(streak,1.))*(streak+.45+.35*band);
          // Full beyond the canopy, fading out right beside it so the cockpit stays readable.
          float depth=smoothstep(-6.,-70.,vZ)*(.75+.25*smoothstep(-60.,-400.,vZ));
          float alpha=opacity*depth;
          gl_FragColor=vec4(color*alpha,alpha);
        }`,
    }),
  );
  mesh.position.z = -250;
  // The far end of the tunnel: a white-hot light the ship is falling toward.
  const end = new THREE.Mesh(
    new THREE.CircleGeometry(27, 48),
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `
        uniform float time;uniform float opacity;varying vec2 vUv;
        void main(){
          vec2 p=vUv*2.-1.;float r=length(p),a=atan(p.y,p.x);
          float rays=.75+.25*sin(a*23.+time*5.)*sin(a*7.-time*3.);
          float fall=pow(max(0.,1.-r),1.4);
          vec3 color=mix(vec3(1.),vec3(.35,.6,1.),smoothstep(0.,1.,r))*fall*1.9*rays;
          gl_FragColor=vec4(color*opacity,opacity*fall);
        }`,
    }),
  );
  end.position.z = -566;
  const group = new THREE.Group();
  group.add(mesh, end);
  group.visible = false;
  return { mesh: group, uniforms };
}

type Vec3 = [number, number, number];

/** A real supercluster the jump can come out at, and how its web looks from there. */
export type Supercluster = {
  id: string;
  name: string;
  eyebrow: string;
  description: string;
  access: string;
  /** R-X7's remark on arrival. */
  droid: string;
  seed: number;
  /** How the knots are laid out: a loose web, a long chain, a flat wall, or one dominant cluster. */
  layout: "web" | "chain" | "wall" | "compact";
  knots: number;
  /** The heaviest knots: position and mass. */
  cores: [Vec3, number][];
  /** Share of galaxies in the knots, and of ellipticals there. */
  knotShare: number;
  ellipticals: number;
  /** Sky glow: filament veil, hot gas at the core, and where both meet. */
  veil: Vec3;
  heart: Vec3;
  blend: Vec3;
  /** Large neighbours close enough to show their arms: x, y, z, size, axis ratio. */
  neighbours: [number, number, number, number, number][];
};

export const SUPERCLUSTERS: Supercluster[] = [
  {
    id: "shapley",
    name: "Superamas de Shapley",
    eyebrow: "?? / Espace intergalactique",
    description:
      "À environ 650 millions d’années-lumière, la plus grande concentration de galaxies de notre voisinage cosmique. Ici, aucune étoile, aucune planète : chaque point de lumière est une galaxie entière.",
    access: "Hors des cartes de l’Empire",
    droid: "R-X7 : bip… bou-oup ? Aucune étoile, aucune planète. Nous sommes très, très loin de chez nous.",
    seed: 650,
    layout: "web",
    knots: 18,
    cores: [[[30, 40, -430], 3.2]],
    knotShare: 0.38,
    ellipticals: 0.72,
    veil: [0.16, 0.2, 0.42],
    heart: [1, 0.7, 0.42],
    blend: [0.55, 0.42, 0.75],
    neighbours: [
      [-190, 95, -300, 64, 0.62],
      [240, -70, -330, 42, 0.3],
      [-60, -150, -360, 30, 0.8],
      [330, 150, -380, 26, 0.5],
    ],
  },
  {
    id: "coma",
    name: "Superamas de Coma",
    eyebrow: "?? / Constellation de la Chevelure de Bérénice",
    description:
      "À environ 300 millions d’années-lumière, il réunit les amas de Coma et du Lion. L’amas de Coma compte à lui seul plus d’un millier de galaxies, surtout de vieilles elliptiques dorées.",
    access: "Amas de Coma droit devant",
    droid: "R-X7 : bip-bip ! Ce gros essaim doré, ce sont des galaxies… des milliers. Je recalcule. Encore. Et encore.",
    seed: 300,
    layout: "compact",
    knots: 11,
    cores: [
      [[-30, 20, -360], 7],
      [[260, 90, -470], 2.4],
    ],
    knotShare: 0.6,
    ellipticals: 0.85,
    veil: [0.2, 0.17, 0.12],
    heart: [1, 0.78, 0.45],
    blend: [0.7, 0.55, 0.35],
    neighbours: [
      [-260, -110, -320, 46, 0.35],
      [190, -150, -300, 34, 0.7],
    ],
  },
  {
    id: "hercules",
    name: "Superamas d’Hercule",
    eyebrow: "?? / Grande Muraille CfA2",
    description:
      "À environ 500 millions d’années-lumière, il fait partie de la Grande Muraille CfA2, l’une des premières structures géantes cartographiées. Ses amas s’accrochent les uns aux autres le long de filaments bleutés.",
    access: "Le long de la Grande Muraille",
    droid: "R-X7 : bou-ouip… deux amas jumeaux, reliés par des ponts de galaxies. Personne de chez nous n’a jamais vu ça d’aussi près.",
    seed: 500,
    layout: "web",
    knots: 20,
    cores: [
      [[-170, 30, -410], 3],
      [[150, -20, -440], 2.8],
    ],
    knotShare: 0.34,
    ellipticals: 0.6,
    veil: [0.1, 0.26, 0.34],
    heart: [0.6, 0.85, 1],
    blend: [0.35, 0.6, 0.7],
    neighbours: [
      [-40, 160, -300, 52, 0.5],
      [310, 120, -350, 30, 0.25],
      [-330, -140, -340, 36, 0.75],
    ],
  },
  {
    id: "perseus-pisces",
    name: "Chaîne de Persée-Poissons",
    eyebrow: "?? / Constellations de Persée et des Poissons",
    description:
      "À environ 250 millions d’années-lumière, une longue chaîne d’amas de galaxies qui s’étire sur des centaines de millions d’années-lumière : l’une des plus grandes structures de notre voisinage.",
    access: "Une chaîne d’amas, d’un bout à l’autre du ciel",
    droid: "R-X7 : bip ! On dirait un collier jeté en travers de l’univers. Je l’ajoute à ma collection de cartes impossibles.",
    seed: 250,
    layout: "chain",
    knots: 16,
    cores: [[[60, 30, -400], 3.6]],
    knotShare: 0.42,
    ellipticals: 0.68,
    veil: [0.12, 0.14, 0.4],
    heart: [1, 0.48, 0.36],
    blend: [0.7, 0.35, 0.55],
    neighbours: [
      [-220, 150, -310, 58, 0.45],
      [230, -160, -320, 40, 0.8],
    ],
  },
  {
    id: "horologium",
    name: "Superamas de l’Horloge-Réticule",
    eyebrow: "?? / Ciel austral",
    description:
      "À environ 700 millions d’années-lumière, dans le ciel de l’hémisphère sud, l’un des plus vastes superamas de l’univers proche : un enchevêtrement dense de filaments et d’amas.",
    access: "Ciel austral, hors de toute route connue",
    droid: "R-X7 : biiip… tant de filaments ! On dirait le câblage de mon processeur, en beaucoup, beaucoup plus grand.",
    seed: 700,
    layout: "web",
    knots: 26,
    cores: [
      [[-40, -30, -450], 2.8],
      [[220, 110, -480], 2.2],
      [[-280, 120, -470], 2],
    ],
    knotShare: 0.3,
    ellipticals: 0.65,
    veil: [0.22, 0.12, 0.36],
    heart: [0.95, 0.6, 0.85],
    blend: [0.6, 0.35, 0.8],
    neighbours: [
      [160, -150, -300, 44, 0.55],
      [-180, -90, -330, 28, 0.3],
    ],
  },
  {
    id: "saraswati",
    name: "Superamas Saraswati",
    eyebrow: "?? / Constellation des Poissons",
    description:
      "À environ 4 milliards d’années-lumière, l’un des plus grands superamas connus, découvert en 2017 par des astronomes indiens. La lumière que vous voyez est partie quand la Terre était encore jeune.",
    access: "Le plus lointain de tous les sauts",
    droid: "R-X7 : bou… ouip. Quatre milliards d’années-lumière. Même mes sauvegardes ont le vertige.",
    seed: 4000,
    layout: "wall",
    knots: 22,
    cores: [[[0, 10, -500], 3]],
    knotShare: 0.36,
    ellipticals: 0.7,
    veil: [0.25, 0.12, 0.1],
    heart: [1, 0.55, 0.3],
    blend: [0.8, 0.4, 0.3],
    neighbours: [[-150, 170, -320, 40, 0.6]],
  },
];

const VISIT_KEY = "orbital-supercluster-v1";
/** Each jump comes out at the next supercluster, Shapley first. */
function nextSupercluster() {
  let index = 0;
  try {
    index = (Number(localStorage.getItem(VISIT_KEY)) || 0) % SUPERCLUSTERS.length;
    localStorage.setItem(VISIT_KEY, String(index + 1));
  } catch {
    index = Math.floor(Math.random() * SUPERCLUSTERS.length);
  }
  return SUPERCLUSTERS[index];
}

/**
 * A supercluster seen from intergalactic space: a web of galaxies along filaments,
 * dense knots where they meet, empty voids between them. No planet, no star of our own: only
 * galaxies, thousands of them, ellipticals gold in the cores and blue spirals along the threads.
 */
function createSupercluster(pixelRatio: number, profile: Supercluster) {
  const rand = seeded(profile.seed);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(rand() * Math.PI * 2);
  // Knots of the web, in front of the canopy; the first ones are the cores of the supercluster.
  const nodes: THREE.Vector3[] = profile.cores.map(([at]) => new THREE.Vector3(...at));
  const place = (t: number) => {
    if (profile.layout === "chain") {
      // Strung along a long arc across the whole view.
      const x = -560 + t * 1120;
      return new THREE.Vector3(x, Math.sin(t * 5.2) * 90 - x * 0.18 + gauss() * 22, -300 - Math.cos(t * 3.1) * 110 + gauss() * 30);
    }
    if (profile.layout === "wall") {
      // A broad, flat sheet tilted across the view.
      const x = (rand() * 2 - 1) * 540;
      return new THREE.Vector3(x, x * 0.22 + gauss() * 55, -380 + gauss() * 80);
    }
    return new THREE.Vector3((rand() * 2 - 1) * 460, (rand() * 2 - 1) * 260, -250 - rand() * 300);
  };
  for (let tries = 0; nodes.length < profile.knots && tries < 4000; tries++) {
    const node = place(rand());
    if (nodes.every((other) => other.distanceTo(node) > (profile.layout === "chain" ? 70 : 110))) nodes.push(node);
  }
  const mass = nodes.map((_, i) => (i < profile.cores.length ? profile.cores[i][1] : 0.5 + rand()));
  const links: [number, number][] = [];
  nodes.forEach((node, i) => {
    nodes
      .map((other, j) => ({ j, d: node.distanceTo(other) }))
      .filter(({ j }) => j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
      .forEach(({ j }) => {
        if (!links.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) links.push([i, j]);
      });
  });
  const count = 16000;
  const positions = new Float32Array(count * 3),
    tints = new Float32Array(count * 3),
    shapes = new Float32Array(count * 4); // size (px), kind, angle, axis ratio
  const point = new THREE.Vector3(),
    across = new THREE.Vector3();
  const warm = new THREE.Color(1, 0.82, 0.58),
    blue = new THREE.Color(0.62, 0.78, 1),
    white = new THREE.Color(0.95, 0.93, 0.9),
    tint = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const pick = rand();
    let inKnot = false;
    if (pick < profile.knotShare) {
      // In a knot: a cluster of galaxies, mostly ellipticals.
      let n = 0;
      let total = mass.reduce((s, m) => s + m, 0) * rand();
      while ((total -= mass[n]) > 0 && n < nodes.length - 1) n++;
      const spread = 16 + mass[n] * (profile.layout === "compact" ? 12 : 9);
      point.set(gauss(), gauss(), gauss()).multiplyScalar(spread * Math.pow(rand(), 0.7)).add(nodes[n]);
      inKnot = true;
    } else if (pick < 0.94) {
      // Along a filament.
      const [a, b] = links[Math.floor(rand() * links.length)];
      point.lerpVectors(nodes[a], nodes[b], rand());
      across.set(gauss(), gauss(), gauss()).multiplyScalar(9 + rand() * 6);
      point.add(across);
    } else {
      // A few loners out in the voids.
      point.set((rand() * 2 - 1) * 560, (rand() * 2 - 1) * 330, -220 - rand() * 360);
    }
    point.toArray(positions, i * 3);
    const big = rand();
    const size = big > 0.99 ? 14 + rand() * 22 : big > 0.88 ? 4.5 + rand() * 7 : 1.2 + rand() * 1.8;
    const elliptical = inKnot ? rand() < profile.ellipticals : rand() < 0.22;
    const kind = size < 3 ? 0 : elliptical ? 1 : 2;
    tint.copy(elliptical ? warm : blue).lerp(white, rand() * 0.5);
    const brightness = (0.6 + Math.pow(rand(), 2) * 1.1) * (size < 3 ? 1 : 1.25);
    tints[i * 3] = tint.r * brightness;
    tints[i * 3 + 1] = tint.g * brightness;
    tints[i * 3 + 2] = tint.b * brightness;
    shapes[i * 4] = size;
    shapes[i * 4 + 1] = kind;
    shapes[i * 4 + 2] = rand() * Math.PI;
    shapes[i * 4 + 3] = kind === 2 ? 0.18 + rand() * 0.82 : 0.55 + rand() * 0.45;
  }
  // A handful of large neighbours, close enough to show their arms.
  profile.neighbours.forEach(([x, y, z, size, ratio], k) => {
    const i = count - 1 - k;
    positions.set([x, y, z], i * 3);
    tints.set([0.82, 0.88, 1], i * 3);
    shapes.set([size, 2, rand() * Math.PI, ratio], i * 4);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("tint", new THREE.BufferAttribute(tints, 3));
  geometry.setAttribute("shape", new THREE.BufferAttribute(shapes, 4));
  const uniforms = { opacity: { value: 0 }, pixelRatio: { value: pixelRatio }, time: { value: 0 } };
  const galaxies = new THREE.Points(
    geometry,
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      vertexShader: `
        attribute vec3 tint;attribute vec4 shape;uniform float pixelRatio;
        varying vec3 vTint;varying vec4 vShape;
        void main(){
          vec4 mv=modelViewMatrix*vec4(position,1.);
          gl_PointSize=shape.x*pixelRatio*(380./-mv.z)*(shape.y>.5?2.2:1.);
          vTint=tint;vShape=shape;
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader: `
        uniform float opacity;varying vec3 vTint;varying vec4 vShape;
        void main(){
          vec2 q=gl_PointCoord*2.-1.;
          float c=cos(vShape.z),s=sin(vShape.z);
          q=vec2(c*q.x-s*q.y,s*q.x+c*q.y);
          q.y/=max(vShape.w,.08);
          float r=length(q);
          if(r>1.) discard;
          float light;
          vec3 color=vTint;
          if(vShape.y<.5){
            light=exp(-r*r*7.);
          }else if(vShape.y<1.5){
            // Elliptical: a bright core and a smooth, wide halo.
            light=exp(-pow(r,.5)*5.2)*2.4;
            color*=mix(vec3(1.15,1.,.85),vec3(1.),r);
          }else{
            // Spiral: a gold bulge, blue arms winding out, a dark lane between them.
            float th=atan(q.y,q.x);
            float arms=.5+.5*cos(2.*(th-log(max(r,.02))*2.6));
            float disk=exp(-r*3.6)*(.28+.9*pow(arms,2.6));
            float bulge=exp(-r*r*60.)*1.6;
            light=disk+bulge;
            color=mix(vec3(.62,.78,1.)*vTint*1.2,vec3(1.,.86,.62),bulge/(light+.001));
          }
          light*=smoothstep(1.,.7,r);
          float alpha=light*opacity;
          gl_FragColor=vec4(color*alpha,alpha);
        }`,
    }),
  );
  galaxies.frustumCulled = false;
  // The faint glow of the web itself: hot gas in the core, a veil along the filaments.
  const core = nodes[0].clone().normalize();
  const skyUniforms = {
    opacity: { value: 0 },
    core: { value: core },
    veil: { value: new THREE.Vector3(...profile.veil) },
    heart: { value: new THREE.Vector3(...profile.heart) },
    blend: { value: new THREE.Vector3(...profile.blend) },
    offset: { value: profile.seed * 0.0137 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(585, 48, 24),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      vertexShader: `varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `
        uniform float opacity;uniform vec3 core;uniform vec3 veil;uniform vec3 heart;uniform vec3 blend;uniform float offset;varying vec3 vDir;
        float hash(vec3 p){return fract(sin(dot(p,vec3(17.1,113.7,71.3)))*43758.5453);}
        float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
        void main(){
          vec3 d=normalize(vDir);
          float n=0.,amp=.55;vec3 p=d*3.2+offset;
          for(int i=0;i<5;i++){n+=amp*(1.-abs(noise(p)*2.-1.));p*=2.03;amp*=.5;}
          float web=pow(n,5.)*1.15;
          float glow=exp(-pow(acos(clamp(dot(d,core),-1.,1.)),2.)*22.);
          vec3 color=veil*web+heart*glow*.34+blend*web*glow*1.2;
          float front=smoothstep(.15,-.5,d.z);
          gl_FragColor=vec4(color*opacity*front,1.);
        }`,
    }),
  );
  const group = new THREE.Group();
  group.add(sky, galaxies);
  group.visible = false;
  return {
    group,
    uniforms,
    skyUniforms,
    dispose() {
      galaxies.geometry.dispose();
      (galaxies.material as THREE.Material).dispose();
      sky.geometry.dispose();
      (sky.material as THREE.Material).dispose();
    },
  };
}

function createWarpAudio() {
  let context: AudioContext | null = null;
  const ready = () => {
    if (typeof AudioContext === "undefined") return null;
    if (!context) context = new AudioContext();
    if (context.state === "suspended") void context.resume();
    return context;
  };
  const noise = (ctx: AudioContext, seconds: number) => {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    return source;
  };
  return {
    key(index: number) {
      const ctx = ready();
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 520 + index * 70;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.03, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.1);
    },
    alarm(seconds: number) {
      const ctx = ready();
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator(),
        gain = ctx.createGain(),
        filter = ctx.createBiquadFilter();
      osc.type = "sawtooth";
      filter.type = "lowpass";
      filter.frequency.value = 1800;
      // A two-tone klaxon, the classic warship alarm.
      for (let k = 0; k < seconds / 0.7; k++) {
        osc.frequency.setValueAtTime(660, t + k * 0.7);
        osc.frequency.setValueAtTime(495, t + k * 0.7 + 0.35);
      }
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.05, t + 0.05);
      gain.gain.setValueAtTime(0.05, t + seconds - 0.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
      osc.connect(filter).connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + seconds + 0.05);
    },
    jump(spool: number, tunnel: number) {
      const ctx = ready();
      if (!ctx) return;
      const t = ctx.currentTime;
      // The motivator spools up...
      const whine = ctx.createOscillator(),
        whineGain = ctx.createGain();
      whine.type = "sawtooth";
      whine.frequency.setValueAtTime(70, t);
      whine.frequency.exponentialRampToValueAtTime(720, t + spool);
      whine.frequency.exponentialRampToValueAtTime(90, t + spool + 0.4);
      const whineFilter = ctx.createBiquadFilter();
      whineFilter.type = "lowpass";
      whineFilter.frequency.setValueAtTime(300, t);
      whineFilter.frequency.exponentialRampToValueAtTime(3200, t + spool);
      whineGain.gain.setValueAtTime(0.0001, t);
      whineGain.gain.exponentialRampToValueAtTime(0.06, t + spool * 0.9);
      whineGain.gain.exponentialRampToValueAtTime(0.0001, t + spool + 0.5);
      whine.connect(whineFilter).connect(whineGain).connect(ctx.destination);
      whine.start(t);
      whine.stop(t + spool + 0.6);
      // ...then the punch into hyperspace...
      const boom = ctx.createOscillator(),
        boomGain = ctx.createGain();
      boom.frequency.setValueAtTime(140, t + spool);
      boom.frequency.exponentialRampToValueAtTime(28, t + spool + 1.2);
      boomGain.gain.setValueAtTime(0.0001, t + spool);
      boomGain.gain.exponentialRampToValueAtTime(0.22, t + spool + 0.03);
      boomGain.gain.exponentialRampToValueAtTime(0.0001, t + spool + 1.4);
      boom.connect(boomGain).connect(ctx.destination);
      boom.start(t + spool);
      boom.stop(t + spool + 1.5);
      // ...and the roar of the tunnel.
      const rush = noise(ctx, tunnel + 0.6),
        rushFilter = ctx.createBiquadFilter(),
        rushGain = ctx.createGain();
      rushFilter.type = "bandpass";
      rushFilter.Q.value = 0.7;
      rushFilter.frequency.setValueAtTime(380, t + spool);
      rushFilter.frequency.linearRampToValueAtTime(900, t + spool + tunnel);
      rushGain.gain.setValueAtTime(0.0001, t + spool);
      rushGain.gain.exponentialRampToValueAtTime(0.09, t + spool + 0.15);
      rushGain.gain.setValueAtTime(0.09, t + spool + tunnel - 0.3);
      rushGain.gain.exponentialRampToValueAtTime(0.0001, t + spool + tunnel + 0.5);
      rush.connect(rushFilter).connect(rushGain).connect(ctx.destination);
      rush.start(t + spool);
    },
    arrive() {
      const ctx = ready();
      if (!ctx) return;
      const t = ctx.currentTime;
      // A slow, open chord: the silence of intergalactic space.
      [110, 164.8, 220, 329.6].forEach((frequency, i) => {
        const osc = ctx.createOscillator(),
          gain = ctx.createGain();
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.022 / (1 + i * 0.4), t + 1.6);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 7);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 7.1);
      });
    },
    dispose() {
      void context?.close();
      context = null;
    },
  };
}

export type WarpFrame = {
  /** Red alert level, 0 to 1, for the cabin lights and the screen overlay. */
  alert: number;
  /** White flash at the jump and the exit, 0 to 1. */
  flash: number;
  /** Extra field of view, in degrees. */
  fov: number;
  /** Camera shake amount. */
  shake: number;
  /** True while the home sky (stars and hologram) must not be seen. */
  away: boolean;
};

export function createCockpitKonami(pixelRatio: number, onPhase: (phase: WarpPhase, destination: Supercluster) => void) {
  const group = new THREE.Group();
  group.name = "cockpit-konami";
  const radar = createRadarCode();
  const stick = createStick();
  const lamps = createLamps();
  const streaks = createStreaks(pixelRatio);
  const tunnel = createTunnel();
  let destination = SUPERCLUSTERS[0];
  let cluster = createSupercluster(pixelRatio, destination);
  const alarmLight = new THREE.PointLight(0xff2a14, 0, 9, 1.6);
  alarmLight.position.set(0, 2.4, 0.6);
  group.add(radar.mesh, stick.group, lamps.mesh, streaks.mesh, tunnel.mesh, cluster.group, alarmLight);
  const audio = createWarpAudio();
  let progress = 0,
    phase: WarpPhase = "idle",
    clock = 0,
    travel = 0,
    sound = false;
  const setPhase = (next: WarpPhase) => {
    phase = next;
    clock = 0;
    onPhase(next, destination);
  };
  const frame: WarpFrame = { alert: 0, flash: 0, fov: 0, shake: 0, away: false };
  return {
    group,
    get phase() {
      return phase;
    },
    setSound(on: boolean) {
      sound = on;
    },
    /** A key of the code; returns true when it completes the code. */
    key(key: string) {
      if (phase !== "idle") return false;
      const expected = KONAMI[progress];
      if (key === expected) {
        stick.push(key);
        progress++;
        if (sound) audio.key(progress);
        if (progress === KONAMI.length) {
          // Where this jump comes out: a new supercluster, built now, before the flash.
          destination = nextSupercluster();
          group.remove(cluster.group);
          cluster.dispose();
          cluster = createSupercluster(pixelRatio, destination);
          group.add(cluster.group);
          setPhase("alert");
          if (sound) {
            audio.alarm(ALERT);
            window.setTimeout(() => phase === "alert" && audio.jump(SPOOL, TUNNEL), ALERT * 1000);
          }
          return true;
        }
      } else {
        // A wrong key restarts the code; the first ↑ of a fresh try still counts.
        progress = key === KONAMI[0] ? 1 : 0;
        if (progress) stick.push(key);
      }
      return false;
    },
    /** Back to the home galaxy, from the supercluster. */
    home() {
      if (phase !== "arrived") return;
      setPhase("return");
      if (sound) audio.jump(BACK_SPOOL, BACK_TUNNEL);
    },
    tick(dt: number, age: number, reduced: boolean): WarpFrame {
      clock += dt;
      radar.uniforms.time.value = reduced ? 0 : age;
      frame.alert = frame.flash = frame.fov = frame.shake = 0;
      let streak = 0,
        stretch = 0,
        speed = 0,
        tube = 0,
        clusterLevel = phase === "arrived" ? 1 : 0;
      if (phase === "alert") {
        const t = clock / ALERT;
        frame.alert = Math.min(1, clock * 3);
        frame.shake = 0.25 + t * 0.35;
        if (clock >= ALERT) setPhase("jump");
      } else if (phase === "jump" || phase === "return") {
        const outbound = phase === "jump";
        const spool = reduced ? 0.3 : outbound ? SPOOL : BACK_SPOOL,
          run = reduced ? 0.5 : outbound ? TUNNEL : BACK_TUNNEL,
          exit = reduced ? 0.4 : EXIT;
        if (clock < spool) {
          // The stars stretch into lines; the cabin rumbles; the view narrows before the punch.
          const k = clock / spool;
          frame.alert = outbound ? 1 - k : 0;
          streak = reduced ? 0 : Math.min(1, k * 2);
          stretch = 0.3 + Math.pow(k, 3) * 60;
          speed = Math.pow(k, 2) * 40;
          frame.fov = -6 * THREE.MathUtils.smoothstep(k, 0, 1);
          frame.shake = 0.3 + k * 0.6;
          if (!outbound) clusterLevel = 1 - k;
        } else if (clock < spool + run) {
          const k = (clock - spool) / run;
          frame.flash = Math.max(0, 1 - (clock - spool) / 0.28);
          frame.away = true;
          streak = reduced ? 0 : 1;
          stretch = 90;
          speed = 520;
          tube = reduced ? 0 : Math.min(1, (clock - spool) * 2.5) * (1 - THREE.MathUtils.smoothstep(k, 0.85, 1));
          frame.fov = 10 - THREE.MathUtils.smoothstep(k, 0, 0.2) * 3;
          frame.shake = 0.9 - k * 0.3;
        } else if (clock < spool + run + exit) {
          // Out of hyperspace: the streaks snap back to points and the view settles.
          const k = (clock - spool - run) / exit;
          frame.flash = Math.max(0, 1 - k * 2.4) * 0.85;
          frame.away = outbound;
          streak = reduced ? 0 : 1 - k;
          stretch = 90 * Math.pow(1 - k, 3);
          speed = 520 * Math.pow(1 - k, 2);
          frame.fov = 7 * Math.pow(1 - k, 2);
          frame.shake = 0.6 * (1 - k);
          clusterLevel = outbound ? THREE.MathUtils.smoothstep(k, 0.2, 1) * 0.7 : 0;
        } else {
          if (outbound) {
            setPhase("arrived");
            if (sound) audio.arrive();
          } else setPhase("idle");
          progress = 0;
        }
      }
      if (phase === "arrived") {
        frame.away = true;
        // The supercluster comes up slowly, as the eye adapts to the dark.
        clusterLevel = Math.min(1, 0.7 + clock / 4);
      }
      travel += speed * dt;
      streaks.uniforms.travel.value = travel;
      streaks.uniforms.stretch.value = stretch;
      streaks.uniforms.opacity.value = streak;
      streaks.mesh.visible = streak > 0.001;
      tunnel.uniforms.time.value = age;
      tunnel.uniforms.opacity.value = tube;
      tunnel.mesh.visible = tube > 0.001;
      cluster.uniforms.opacity.value = clusterLevel;
      cluster.skyUniforms.opacity.value = clusterLevel;
      cluster.uniforms.time.value = age;
      cluster.group.visible = clusterLevel > 0.001;
      radar.uniforms.progress.value = phase === "idle" ? progress : KONAMI.length;
      radar.uniforms.alarm.value = frame.alert;
      lamps.tick(phase === "idle" ? progress : 0, frame.alert, age, reduced);
      const pulse = reduced ? 0.6 : 0.5 + 0.5 * Math.sin(age * 9);
      alarmLight.intensity = frame.alert * (3 + pulse * 11);
      if (reduced) frame.shake = 0;
      stick.tick(dt, frame.shake, reduced);
      return frame;
    },
    dispose() {
      audio.dispose();
      cluster.dispose();
      radar.uniforms.map.value.dispose();
    },
  };
}
