"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { destinations } from "./universe";
export type FlightState = {
  flying: boolean;
  boost: boolean;
  destination: number;
  travel: boolean;
  reduced: boolean;
  paused: boolean;
  resetKey: number;
};
type Props = {
  state: FlightState;
  onSelect: (index: number) => void;
  onReady: () => void;
  onUnsupported: () => void;
};
function random(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function planetTexture(kind: "sand" | "green" | "moon") {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(1024, 512);
  const rand = random(42);
  const lattice = Array.from({ length: 256 * 128 }, () => rand());
  const noise = (x: number, y: number) => {
    const ix = Math.floor(x),
      iy = Math.floor(y),
      fx = x - ix,
      fy = y - iy,
      u = fx * fx * (3 - 2 * fx),
      v = fy * fy * (3 - 2 * fy);
    const at = (a: number, b: number) =>
      lattice[(((b % 128) + 128) % 128) * 256 + (((a % 256) + 256) % 256)];
    return (
      (at(ix, iy) * (1 - u) + at(ix + 1, iy) * u) * (1 - v) +
      (at(ix, iy + 1) * (1 - u) + at(ix + 1, iy + 1) * u) * v
    );
  };
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 1024; x++) {
      let n = 0,
        amp = 0.52;
      for (let i = 0; i < 6; i++) {
        const f = Math.pow(2, i);
        n += noise((x / 42) * f, (y / 42) * f) * amp;
        amp *= 0.51;
      }
      const grain = (rand() - 0.5) * 5;
      const band = Math.sin(y * 0.028 + n * 9) * 0.07;
      const h = n + band;
      let c: number[];
      if (kind === "sand") {
        const ridge = Math.sin(h * 32 + noise(x / 90, y / 55) * 3) * 3;
        c = [99 + h * 91 + ridge, 79 + h * 73 + ridge, 60 + h * 55 + ridge];
      } else if (kind === "green") {
        const land = THREE.MathUtils.smoothstep(h, 0.44, 0.57);
        c = [
          25 + h * 40 + land * 20,
          42 + h * 45 + land * 15,
          47 + h * 45 - land * 30,
        ];
        const cloud = Math.max(0, noise(x / 90 + 20, y / 30 + 40) - 0.54) * 1.8;
        c = c.map((k) => k * (1 - cloud) + 165 * cloud);
      } else c = [64 + h * 104, 66 + h * 100, 63 + h * 89];
      const p = (y * 1024 + x) * 4;
      img.data[p] = c[0] + grain;
      img.data[p + 1] = c[1] + grain;
      img.data[p + 2] = c[2] + grain;
      img.data[p + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  if (kind !== "green") {
    for (let i = 0; i < 110; i++) {
      const cx = rand() * 1024,
        cy = 45 + rand() * 422,
        r = 2 + Math.pow(rand(), 2) * 25;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, 0.7);
      const crater = ctx.createRadialGradient(
        -r * 0.15,
        -r * 0.15,
        r * 0.15,
        0,
        0,
        r,
      );
      crater.addColorStop(0, "rgba(29,24,19,.13)");
      crater.addColorStop(0.65, "rgba(29,24,19,.07)");
      crater.addColorStop(0.82, "rgba(224,207,177,.12)");
      crater.addColorStop(1, "rgba(90,75,55,0)");
      ctx.fillStyle = crater;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!,
    g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,225,170,1)");
  g.addColorStop(0.14, "rgba(255,154,77,.9)");
  g.addColorStop(0.45, "rgba(255,88,27,.23)");
  g.addColorStop(1, "rgba(255,70,20,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function shipModel() {
  const group = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({
    color: 0xb8bcaf,
    roughness: 0.48,
    metalness: 0.7,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: 0x343c3b,
    roughness: 0.48,
    metalness: 0.75,
  });
  const red = new THREE.MeshStandardMaterial({
    color: 0x9d523b,
    roughness: 0.6,
    metalness: 0.45,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x132128,
    roughness: 0.12,
    metalness: 0.9,
  });
  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material = hull,
  ) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    o.position.set(x, y, z);
    group.add(o);
    return o;
  };
  const shape = new THREE.Shape();
  shape.moveTo(-0.16, -0.8);
  shape.lineTo(-0.24, 0.05);
  shape.lineTo(-0.1, 1.75);
  shape.lineTo(0.1, 1.75);
  shape.lineTo(0.24, 0.05);
  shape.lineTo(0.16, -0.8);
  shape.closePath();
  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.06,
      bevelThickness: 0.05,
    }),
    hull,
  );
  group.add(body);
  const cockpit = box(0.25, 0.59, 0.15, 0, 0.22, 0.3, glass);
  cockpit.rotation.x = -0.13;
  box(0.29, 0.055, 0.03, 0, 0.45, 0.39);
  box(0.3, 0.05, 0.03, 0, 0.1, 0.39);
  box(0.05, 0.8, 0.01, -0.1, 1, 0.29, red);
  box(0.05, 0.8, 0.01, 0.1, 1, 0.29, red);
  const droidWhite = new THREE.MeshStandardMaterial({
    color: 0xcbd1c7,
    metalness: 0.45,
    roughness: 0.55,
  });
  const droidBlue = new THREE.MeshStandardMaterial({
    color: 0x31566f,
    metalness: 0.5,
    roughness: 0.45,
  });
  const droidBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.12, 12),
    droidWhite,
  );
  droidBody.rotation.x = Math.PI / 2;
  droidBody.position.set(0, -0.32, 0.35);
  group.add(droidBody);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    droidWhite,
  );
  dome.rotation.x = Math.PI / 2;
  dome.position.set(0, -0.32, 0.41);
  group.add(dome);
  const blueBand = new THREE.Mesh(
    new THREE.TorusGeometry(0.081, 0.012, 6, 24),
    droidBlue,
  );
  blueBand.position.set(0, -0.32, 0.415);
  group.add(blueBand);
  const droidEye = new THREE.Mesh(
    new THREE.SphereGeometry(0.017, 8, 6),
    droidBlue,
  );
  droidEye.position.set(0, -0.39, 0.445);
  group.add(droidEye);
  const glow = glowTexture();
  for (const side of [-1, 1])
    for (const top of [-1, 1]) {
      const wingShape = new THREE.Shape();
      wingShape.moveTo(side * 0.15, -0.1);
      wingShape.lineTo(side * 1.25, -0.42);
      wingShape.lineTo(side * 1.37, -0.88);
      wingShape.lineTo(side * 0.18, -0.62);
      const wing = new THREE.Mesh(
        new THREE.ExtrudeGeometry(wingShape, {
          depth: 0.04,
          bevelEnabled: false,
        }),
        hull,
      );
      wing.position.z = top * 0.18;
      wing.rotation.y = side * top * 0.17;
      group.add(wing);
      const marking = box(
        0.38,
        0.13,
        0.045,
        side * 0.98,
        -0.55,
        top * 0.37,
        red,
      );
      marking.rotation.z = -side * 0.25;
      const engine = new THREE.Mesh(
        new THREE.CylinderGeometry(0.125, 0.145, 0.85, 12),
        trim,
      );
      engine.position.set(side * 0.63, -0.52, top * 0.25);
      group.add(engine);
      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 0.13, 12),
        hull,
      );
      rim.position.set(side * 0.63, -0.82, top * 0.25);
      group.add(rim);
      const fire = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glow,
          color: 0xffb27a,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      fire.position.set(side * 0.63, -1.03, top * 0.25);
      fire.scale.set(0.65, 0.8, 0.65);
      fire.name = "engine";
      group.add(fire);
      const cannon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.035, 1.3, 6),
        trim,
      );
      cannon.position.set(side * 1.32, -0.04, top * 0.38);
      group.add(cannon);
      box(0.1, 0.28, 0.13, side * 1.32, -0.45, top * 0.38);
    }
  box(0.26, 0.24, 0.16, 0, -0.66, 0.3, trim);
  return group;
}
function deathStarModel(radius: number) {
  const group = new THREE.Group();
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;
  const rand = random(1138);
  ctx.fillStyle = "#7a817e";
  ctx.fillRect(0, 0, 2048, 1024);
  // Rectangular armor plates and narrow service corridors follow the latitude grid.
  for (let row = 0; row < 64; row++) {
    let x = -rand() * 48;
    while (x < 2048) {
      const width = 12 + Math.floor(rand() * 66);
      const tone = 96 + Math.floor(rand() * 48);
      ctx.fillStyle = `rgb(${tone},${tone + 5},${tone + 3})`;
      ctx.fillRect(x + 1, row * 16 + 1, width - 2, 14);
      if (rand() > 0.58) {
        ctx.fillStyle = "#434b49";
        ctx.fillRect(x + 3, row * 16 + 3, width * 0.65, 2);
      }
      if (rand() > 0.83) {
        ctx.fillStyle = "#b6bba9";
        ctx.fillRect(x + 4, row * 16 + 8, 2, 1);
      }
      x += width;
    }
  }
  ctx.fillStyle = "#202826";
  ctx.fillRect(0, 506, 2048, 12);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const dishDirection = new THREE.Vector3(-0.32, 0.42, 0.85).normalize();
  const armor = new THREE.MeshStandardMaterial({
    map: texture,
    bumpMap: texture,
    bumpScale: 0.035,
    roughness: 0.84,
    metalness: 0.32,
  });
  armor.onBeforeCompile = (shader) => {
    shader.uniforms.dishDirection = { value: dishDirection };
    shader.vertexShader =
      "varying vec3 stationPosition;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nstationPosition = position;",
      );
    shader.fragmentShader =
      "varying vec3 stationPosition; uniform vec3 dishDirection;\n" +
      shader.fragmentShader.replace(
        "#include <clipping_planes_fragment>",
        "#include <clipping_planes_fragment>\nif(dot(normalize(stationPosition),dishDirection) > 0.925) discard;",
      );
  };
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 128, 96),
    armor,
  );
  group.add(shell);
  const trench = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.999, 0.028, 8, 192),
    new THREE.MeshStandardMaterial({ color: 0x171f1d, roughness: 1 }),
  );
  trench.rotation.x = Math.PI / 2;
  group.add(trench);
  const metal = new THREE.MeshStandardMaterial({
    color: 0x717c77,
    roughness: 0.72,
    metalness: 0.4,
    side: THREE.DoubleSide,
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x414c47,
    roughness: 0.88,
    metalness: 0.3,
    side: THREE.DoubleSide,
  });
  const dish = new THREE.Group();
  dish.position.copy(dishDirection).multiplyScalar(radius * 0.925);
  dish.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dishDirection);
  const dishRadius = radius * 0.381;
  const depth = radius * 0.14;
  const profile = Array.from({ length: 25 }, (_, i) => {
    const r = i / 24;
    return new THREE.Vector2(
      Math.max(0.001, r * dishRadius),
      -depth * (1 - r * r),
    );
  });
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(profile, 96), darkMetal);
  bowl.rotation.x = Math.PI / 2;
  dish.add(bowl);
  for (const fraction of [0.29, 0.57, 0.81, 1]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(
        dishRadius * fraction,
        fraction === 1 ? 0.035 : 0.012,
        6,
        96,
      ),
      metal,
    );
    ring.position.z = -depth * (1 - fraction * fraction) + 0.01;
    dish.add(ring);
  }
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const points = profile.map(
      (p) =>
        new THREE.Vector3(
          p.x * Math.cos(angle),
          p.x * Math.sin(angle),
          p.y + 0.015,
        ),
    );
    dish.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: 0x7b8680 }),
      ),
    );
  }
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.032, 12, 8),
    new THREE.MeshStandardMaterial({
      color: 0x819780,
      emissive: 0x374c35,
      emissiveIntensity: 0.4,
      metalness: 0.5,
      roughness: 0.5,
    }),
  );
  core.position.z = -depth + 0.035;
  dish.add(core);
  group.add(dish);
  return group;
}

export default function SpaceScene({
  state,
  onSelect,
  onReady,
  onUnsupported,
}: Props) {
  const mount = useRef<HTMLDivElement>(null),
    live = useRef(state);
  live.current = state;
  const markers = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      onUnsupported();
      onReady();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x080d0d, 0.0025);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 650);
    camera.position.set(0, 0, 32);
    scene.add(new THREE.AmbientLight(0x9bafa8, 0.19));
    const sun = new THREE.DirectionalLight(0xffe2bf, 2.8);
    sun.position.set(-24, 24, 30);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x7b9da6, 0.3);
    rim.position.set(6, -5, 8);
    scene.add(rim);
    const rand = random(74),
      starsGeo = new THREE.BufferGeometry(),
      coords = [],
      colors = [];
    for (let i = 0; i < 4200; i++) {
      coords.push(
        (rand() - 0.5) * 460,
        (rand() - 0.5) * 320,
        (rand() - 0.5) * 500,
      );
      const t = 0.35 + rand() * 0.65;
      colors.push(t, t * 0.97, t * 0.85);
    }
    starsGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(coords, 3),
    );
    starsGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const stars = new THREE.Points(
      starsGeo,
      new THREE.PointsMaterial({
        size: 0.06,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
      }),
    );
    scene.add(stars);
    const planets: THREE.Group[] = [];
    const addPlanet = (
      kind: "sand" | "green" | "moon",
      radius: number,
      pos: number[],
      atmosphere: number,
    ) => {
      const g = new THREE.Group();
      g.position.set(pos[0], pos[1], pos[2]);
      const t = planetTexture(kind);
      const surface = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 96, 64),
        new THREE.MeshStandardMaterial({
          map: t,
          bumpMap: t,
          bumpScale: kind === "sand" ? 0.095 : 0.06,
          roughness: 1,
          metalness: 0,
        }),
      );
      surface.rotation.z = -0.15;
      g.add(surface);
      const air = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.018, 64, 40),
        new THREE.ShaderMaterial({
          uniforms: { glowColor: { value: new THREE.Color(atmosphere) } },
          vertexShader:
            "varying vec3 vNormal; varying vec3 vPosition; void main(){vNormal=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.0);vPosition=p.xyz;gl_Position=projectionMatrix*p;}",
          fragmentShader:
            "uniform vec3 glowColor;varying vec3 vNormal;varying vec3 vPosition;void main(){float r=1.0-max(0.0,dot(normalize(vNormal),normalize(-vPosition)));float f=pow(r,5.0);gl_FragColor=vec4(glowColor,f*0.23);}",
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      g.add(air);
      scene.add(g);
      planets.push(g);
      return g;
    };
    addPlanet("sand", 3.85, [15, 4, -18], 0xd9b78a);
    addPlanet("green", 2.1, [-18, -4, -26], 0x8abdb1);
    addPlanet("moon", 1.6, [22, -8, -40], 0xa4b2b4);
    const deathStar = deathStarModel(3.3);
    deathStar.position.set(-12, 10, -22);
    scene.add(deathStar);
    planets.push(deathStar);
    const radii = [3.85, 2.1, 1.6, 3.3];
    // Two distant suns: a quiet nod to Tatooine's binary sunset.
    const sunGlow = glowTexture();
    [
      [20, 10, -36],
      [21.1, 10.35, -37],
    ].forEach((position, index) => {
      const twinSun = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: sunGlow,
          color: index ? 0xffb999 : 0xffd4a3,
          transparent: true,
          opacity: 0.6,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      twinSun.position.set(position[0], position[1], position[2]);
      twinSun.scale.setScalar(index ? 0.5 : 0.65);
      scene.add(twinSun);
    });
    const orbitGeo = new THREE.BufferGeometry();
    const orbitPoints = [];
    for (let i = 0; i <= 256; i++) {
      const a = (i / 256) * Math.PI * 2;
      orbitPoints.push(
        new THREE.Vector3(
          15 + Math.cos(a) * 6.4,
          3.5 + Math.sin(a) * 1.5,
          -17 + Math.sin(a) * 3.5,
        ),
      );
    }
    orbitGeo.setFromPoints(orbitPoints);
    scene.add(
      new THREE.Line(
        orbitGeo,
        new THREE.LineBasicMaterial({
          color: 0x77847c,
          transparent: true,
          opacity: 0.13,
        }),
      ),
    );
    const rocks = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.1, 0),
      new THREE.MeshStandardMaterial({ color: 0x79766b, roughness: 1 }),
      75,
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 75; i++) {
      const angle = rand() * Math.PI * 2,
        r = 6.4 + (rand() - 0.5) * 1.2;
      dummy.position.set(
        15 + Math.cos(angle) * r,
        3.5 + Math.sin(angle) * 1.5 + (rand() - 0.5) * 0.3,
        -17 + Math.sin(angle) * 3.5,
      );
      dummy.rotation.set(rand() * 5, rand() * 5, rand() * 5);
      dummy.scale.setScalar(0.15 + rand() * 0.7);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }
    scene.add(rocks);
    const ship = shipModel();
    ship.position.set(0, -1.55, 25);
    ship.rotation.set(-1.04, 0, 0);
    ship.scale.setScalar(0.65);
    scene.add(ship);
    const light = new THREE.PointLight(0xff9f50, 2, 4);
    light.position.set(0.5, -3.7, 6);
    scene.add(light);
    const steer = { x: 0, y: 0 },
      anchor = { x: 0, y: 0 };
    const keys = new Set<string>();
    const touches = new Set<number>();
    const velocity = new THREE.Vector3();
    const heading = { yaw: 0, pitch: 0 };
    const viewRotation = new THREE.Euler(0, 0, 0, "YXZ");
    const modelRotation = new THREE.Euler(-1.04, 0, 0, "YXZ");
    const modelQuaternion = new THREE.Quaternion();
    const forward = new THREE.Vector3();
    let shipDistance = 7,
      shipHeight = 1.55;
    let dragging = false,
      baseZ = 32,
      lastReset = state.resetKey;
    const keydown = (e: KeyboardEvent) => {
      if (live.current.paused || live.current.travel) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key))
        e.preventDefault();
      keys.add(e.key.toLowerCase());
    };
    const keyup = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const release = (e?: PointerEvent) => {
      if (e) touches.delete(e.pointerId);
      else touches.clear();
      if (!e || touches.size === 0) {
        dragging = false;
        steer.x = 0;
        steer.y = 0;
      }
    };
    const blur = () => {
      keys.clear();
      release();
    };
    const pointerMove = (e: PointerEvent) => {
      if (dragging) {
        const reach = Math.min(el.clientWidth, el.clientHeight) * 0.21;
        steer.x = THREE.MathUtils.clamp((e.clientX - anchor.x) / reach, -1, 1);
        steer.y = THREE.MathUtils.clamp((anchor.y - e.clientY) / reach, -1, 1);
      }
    };
    const pointerDown = (e: PointerEvent) => {
      if (
        live.current.paused ||
        live.current.travel ||
        (e.target as HTMLElement).closest('button,a,input,[role="dialog"]')
      )
        return;
      if (!dragging) {
        anchor.x = e.clientX;
        anchor.y = e.clientY;
      }
      touches.add(e.pointerId);
      dragging = true;
      el.setPointerCapture(e.pointerId);
    };
    const cancelLostPointer = (e: PointerEvent) => release(e);
    window.addEventListener("pointermove", pointerMove);
    window.addEventListener("pointerdown", pointerDown);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", cancelLostPointer);
    window.addEventListener("blur", blur);
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    const resize = () => {
      const w = el.clientWidth,
        h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.fov = w / h < 0.8 ? 52 : 50;
      const nextZ = w / h < 0.8 ? 66 : 32;
      camera.position.z += nextZ - baseZ;
      baseZ = nextZ;
      camera.updateProjectionMatrix();
      // Preserve the foreground framing in portrait without clipping the wings.
      shipDistance = w / h < 0.8 ? 10 : 7;
      shipHeight =
        shipDistance *
        Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
        0.48;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    onReady();
    let frame = 0,
      last = performance.now(),
      elapsed = 0;
    const projected = new THREE.Vector3();
    const safePosition = new THREE.Vector3();
    const collisionNormal = new THREE.Vector3();
    const targetVelocity = new THREE.Vector3();
    const flightTarget = new THREE.Vector3();
    const shipOffset = new THREE.Vector3();
    const shipPosition = new THREE.Vector3();
    const engineOffset = new THREE.Vector3();
    const animate = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += dt;
      const s = live.current;
      if (s.resetKey !== lastReset) {
        camera.position.set(0, 0, baseZ);
        heading.yaw = 0;
        heading.pitch = 0;
        camera.quaternion.identity();
        ship.position.set(0, -shipHeight, baseZ - shipDistance);
        ship.rotation.set(-1.04, 0, 0);
        velocity.set(0, 0, 0);
        keys.clear();
        release();
        lastReset = s.resetKey;
      }
      const fast = s.boost || keys.has("shift") || touches.size > 1;
      let dx = 0,
        dy = 0,
        thrusting = false;
      if (s.paused) {
        keys.clear();
        release();
        velocity.set(0, 0, 0);
      }
      if (s.travel) {
        const target = planets[s.destination];
        const k = s.reduced ? 1 : 1 - Math.exp(-dt * 1.2);
        camera.position.lerp(
          flightTarget.set(
            target.position.x,
            target.position.y + 2,
            target.position.z + radii[s.destination] + 25,
          ),
          k,
        );
        heading.yaw = THREE.MathUtils.lerp(heading.yaw, 0, k);
        heading.pitch = THREE.MathUtils.lerp(heading.pitch, -0.055, k);
        viewRotation.set(heading.pitch, heading.yaw, 0, "YXZ");
        camera.quaternion.setFromEuler(viewRotation);
        velocity.set(0, 0, 0);
      } else if (s.flying && !s.paused) {
        dx = THREE.MathUtils.clamp(
          steer.x +
            (keys.has("arrowright") || keys.has("d") ? 1 : 0) -
            (keys.has("arrowleft") || keys.has("a") || keys.has("q") ? 1 : 0),
          -1,
          1,
        );
        dy = THREE.MathUtils.clamp(
          steer.y +
            (keys.has("arrowup") || keys.has("w") || keys.has("z") ? 1 : 0) -
            (keys.has("arrowdown") || keys.has("s") ? 1 : 0),
          -1,
          1,
        );
        const active = Math.abs(dx) + Math.abs(dy) > 0.05 || fast;
        heading.yaw -= dx * dt * 0.38;
        heading.yaw = Math.atan2(Math.sin(heading.yaw), Math.cos(heading.yaw));
        heading.pitch = THREE.MathUtils.clamp(
          heading.pitch + dy * dt * 0.3,
          -0.85,
          0.85,
        );
        viewRotation.set(heading.pitch, heading.yaw, 0, "YXZ");
        camera.quaternion.setFromEuler(viewRotation);
        forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
        const speed = active ? (fast ? 16 : 5.5) : 0;
        thrusting = active;
        targetVelocity.copy(forward).multiplyScalar(speed);
        // Releasing the controls stops immediately: no automatic cruise or coasting.
        if (active) velocity.lerp(targetVelocity, 1 - Math.exp(-dt * 2.4));
        else velocity.set(0, 0, 0);
        camera.position.addScaledVector(velocity, dt);
        // Test the ship's actual forward position, rather than the camera behind it.
        shipOffset
          .set(0, -shipHeight, -shipDistance)
          .applyQuaternion(camera.quaternion);
        safePosition.copy(camera.position).add(shipOffset);
        planets.forEach((planet, i) => {
          collisionNormal.copy(safePosition).sub(planet.position);
          const distance = collisionNormal.length(),
            minimum = radii[i] + 1.6;
          if (distance < minimum) {
            collisionNormal.normalize();
            camera.position.addScaledVector(
              collisionNormal,
              minimum - distance,
            );
            velocity.addScaledVector(
              collisionNormal,
              Math.max(0, -velocity.dot(collisionNormal)),
            );
          }
        });
      }
      // Keep the existing model close to the camera, looking into the scene.
      shipOffset
        .set(dx * 0.12, -shipHeight + dy * 0.08, -shipDistance)
        .applyQuaternion(camera.quaternion);
      shipPosition.copy(camera.position).add(shipOffset);
      ship.position.copy(shipPosition);
      modelRotation.set(-1.04 + dy * 0.06, -dx * 0.1, -dx * 0.26, "YXZ");
      modelQuaternion.setFromEuler(modelRotation);
      ship.quaternion.copy(camera.quaternion).multiply(modelQuaternion);
      engineOffset.set(0, -0.35, 1.1).applyQuaternion(camera.quaternion);
      light.position.copy(ship.position).add(engineOffset);
      ship.children
        .filter((c) => c.name === "engine")
        .forEach((engine, i) => {
          const engineActive = !s.paused && (thrusting || s.travel);
          const pulse =
            s.reduced || !engineActive
              ? 1
              : 1 + Math.sin(elapsed * 16 + i) * 0.09;
          if (engine instanceof THREE.Sprite)
            engine.material.opacity = engineActive ? 1 : 0.35;
          engine.scale.set(
            0.65 * pulse,
            (engineActive ? (fast ? 1.5 : 0.8) : 0.5) * pulse,
            0.65,
          );
        });
      if (!s.reduced && !s.paused) {
        planets[0].children[0].rotation.y += dt * 0.014;
        planets[1].children[0].rotation.y += dt * 0.025;
      }
      // Retain a little translational parallax while recycling the distant star volume.
      stars.position.copy(camera.position).multiplyScalar(0.92);
      planets.forEach((planet, i) => {
        const marker = markers.current[i];
        if (!marker) return;
        projected.copy(planet.position).project(camera);
        const distance = camera.position.distanceTo(planet.position);
        const visible =
          projected.z < 1 &&
          projected.z > -1 &&
          Math.abs(projected.x) < 1.2 &&
          Math.abs(projected.y) < 1.2 &&
          !s.paused &&
          !s.travel;
        marker.style.visibility = visible ? "visible" : "hidden";
        marker.disabled = !visible;
        const size = THREE.MathUtils.clamp(
          (radii[i] * el.clientHeight) /
            (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance),
          36,
          260,
        );
        marker.style.width = `${size}px`;
        marker.style.height = `${size}px`;
        marker.style.transform = `translate(${(projected.x * 0.5 + 0.5) * el.clientWidth - size / 2}px,${(-projected.y * 0.5 + 0.5) * el.clientHeight - size / 2}px)`;
      });
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", cancelLostPointer);
      window.removeEventListener("blur", blur);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      scene.traverse((o) => {
        if (
          o instanceof THREE.Mesh ||
          o instanceof THREE.Points ||
          o instanceof THREE.Line
        ) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            Object.values(m).forEach((v) => {
              if (v instanceof THREE.Texture) v.dispose();
            });
            m.dispose();
          });
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [onReady, onUnsupported]);
  return (
    <div
      ref={mount}
      className="space-canvas"
      role="group"
      aria-label="Espace en trois dimensions, glissez ou utilisez les flèches pour voyager"
    >
      {destinations.map((destination, index) => (
        <button
          key={destination.name}
          ref={(element) => {
            markers.current[index] = element;
          }}
          className="planet-hit"
          aria-label={`Approcher ${destination.name}`}
          onClick={() => onSelect(index)}
        >
          <span>
            {destination.name}
            <small>{destination.category}</small>
          </span>
        </button>
      ))}
    </div>
  );
}
