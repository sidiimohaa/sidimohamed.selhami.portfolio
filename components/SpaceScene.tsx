"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { destinations } from "./universe";
import { createPlanetLayers } from "./planetMaterial";
import { createShipModel } from "./shipModel";
import { equippedValue, getArcade, onArcadeChange } from "./arcade/arcadeStore";
import { createNebula, createShootingStars } from "./spaceAmbience";
import { createSpaceDust, createStarLayers, createSun } from "./deepSpace";
import { qualityProfiles, type QualityId } from "./graphicsQuality";
import { createSpaceTraffic, type HyperspacePhase } from "./spaceTraffic";
import { livingOn } from "./galaxy/flags";
import { livingProfile } from "./galaxy/quality";
import { createSpaceEvents } from "./galaxy/spaceEvents";
import { galaxy } from "./galaxy/store";
import { createApproachFlight } from "./approachFlight";
export type FlightState = {
  flying: boolean;
  boost: boolean;
  destination: number;
  travel: boolean;
  arrived: boolean;
  reduced: boolean;
  paused: boolean;
  hidden: boolean;
  resetKey: number;
  droidSignal: number;
  // The graphics profile in force (resolution, star density, dust, flare).
  quality: QualityId;
  // The slow idle sway of the ship, which the visitor can switch off.
  sway: boolean;
  // Photo mode: the interface is hidden and the field of view can be set by hand.
  photo: boolean;
  fov: number | null;
  // Changing these keys asks for a capture of the frame, or ends the approach flight at once.
  captureKey: number;
  skipKey: number;
};
export type FlightTelemetry = {
  throttle: number;
  boost: boolean;
  manual: boolean;
  target: number | null;
  approachProgress: number;
  // Distance from the ship to each world's surface, in scene units.
  distances: number[];
};
type Props = {
  onFlight: (telemetry: FlightTelemetry) => void;
  onApproachComplete: () => void;
  onDroid: () => void;
  onHyperspace: (phase: HyperspacePhase) => void;
  state: FlightState;
  onSelect: (index: number) => void;
  onReady: () => void;
  onUnsupported: () => void;
  // Average frame rate over the last few seconds of drawing, for the automatic graphics profile.
  onPerformance?: (fps: number) => void;
  onCapture?: (image: Blob | null) => void;
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
function beaconTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d")!,
    g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.18, "rgba(255,255,255,.75)");
  g.addColorStop(0.5, "rgba(255,255,255,.12)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
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
  onFlight,
  onApproachComplete,
  onDroid,
  onHyperspace,
  onReady,
  onUnsupported,
  onPerformance,
  onCapture,
}: Props) {
  const mount = useRef<HTMLDivElement>(null),
    live = useRef(state);
  live.current = state;
  const markers = useRef<(HTMLButtonElement | null)[]>([]);
  const distanceLabels = useRef<(HTMLElement | null)[]>([]),
    joystick = useRef<HTMLDivElement>(null),
    joystickThumb = useRef<HTMLElement>(null),
    droidButton = useRef<HTMLButtonElement>(null);
  const hovered = useRef<number | null>(null),
    flightCallback = useRef(onFlight),
    approachCallback = useRef(onApproachComplete),
    hyperspaceCallback = useRef(onHyperspace),
    performanceCallback = useRef(onPerformance),
    captureCallback = useRef(onCapture);
  performanceCallback.current = onPerformance;
  captureCallback.current = onCapture;
  flightCallback.current = onFlight;
  approachCallback.current = onApproachComplete;
  hyperspaceCallback.current = onHyperspace;
  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    let disposed = false;
    const referenceTextures = new Set<THREE.Texture>();
    let quality = state.quality,
      profile = qualityProfiles[quality] ?? qualityProfiles.high;
    let renderer: THREE.WebGLRenderer;
    try {
      // Opaque: the sky dome covers every pixel, so a transparent canvas only cost compositing.
      renderer = new THREE.WebGLRenderer({
        alpha: false,
        antialias: profile.antialias,
        powerPreference: "high-performance",
      });
    } catch {
      onUnsupported();
      onReady();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, profile.pixelRatio));
    renderer.setClearColor(0x020407, 1);
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
    const rand = random(74);
    const nebula = createNebula(renderer, profile.sky);
    scene.add(nebula.dome);
    // Three star shells at different depths, dust around the hull and the sun along the key light.
    const starLayers = createStarLayers(renderer.getPixelRatio(), profile.stars);
    scene.add(starLayers.group);
    const dust = createSpaceDust(qualityProfiles.ultra.dust, renderer.getPixelRatio());
    scene.add(dust.points);
    const sunBody = createSun(sun.position);
    scene.add(sunBody.group);
    const shootingStars = createShootingStars();
    scene.add(shootingStars.group);
    const planets: THREE.Group[] = [];
    // The procedural surfaces only show if a reference image fails to load, so they are painted
    // then: computing all of them up front stalled the loading screen for about half a second.
    const fallbacks: (() => void)[] = [];
    const addPlanet = (
      kind: "sand" | "green" | "moon",
      radius: number,
      pos: number[],
      atmosphere: number,
    ) => {
      const g = new THREE.Group();
      g.position.set(pos[0], pos[1], pos[2]);
      const material = new THREE.MeshStandardMaterial({
        color: kind === "sand" ? 0xb08a62 : kind === "green" ? 0x3a5a50 : 0x7d807a,
        roughness: 1,
        metalness: 0,
      });
      const surface = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), material);
      fallbacks[planets.length] = () => {
        const t = planetTexture(kind);
        material.color.set(0xffffff);
        material.map = material.bumpMap = t;
        material.bumpScale = kind === "sand" ? 0.095 : 0.06;
        material.needsUpdate = true;
      };
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
    addPlanet("moon", 2.4, [10, 13, -44], 0xcfe6f5);
    const radii = [3.85, 2.1, 1.6, 3.3, 2.4];
    const planetLayers: ReturnType<typeof createPlanetLayers>[] = [];
    const loadingManager = new THREE.LoadingManager();
    // Compile every shader before revealing the scene, without blocking the loading screen.
    loadingManager.onLoad = () => {
      if (disposed) return;
      renderer
        .compileAsync(scene, camera)
        .catch(() => undefined)
        .then(() => {
          if (!disposed) onReady();
        });
    };
    const textureLoader = new THREE.TextureLoader(loadingManager);
    destinations.forEach((destination, index) => {
      textureLoader.load(
        destination.image,
        (texture) => {
          if (disposed) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          referenceTextures.add(texture);
          // Upload each image as it arrives rather than all of them on the first frame.
          renderer.initTexture(texture);
          dirtyFrames = Math.max(dirtyFrames, 2);
          const layered = createPlanetLayers(
            texture,
            destination.reference,
            radii[index],
            index,
            camera.position.clone().sub(planets[index].position),
          );
          planets[index].children.forEach((child) => {
            child.visible = false;
          });
          planets[index].add(...layered.layers);
          planetLayers[index] = layered;
        },
        undefined,
        () => {
          // The geometric/procedural world remains visible if an asset cannot load.
          if (!disposed) fallbacks[index]?.();
        },
      );
    });
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
    const debris = Array.from({ length: 75 }, () => ({
      angle: rand() * Math.PI * 2,
      reach: 6.4 + (rand() - 0.5) * 1.2,
      lift: (rand() - 0.5) * 0.3,
      tumble: new THREE.Euler(rand() * 5, rand() * 5, rand() * 5),
      spin: (rand() - 0.5) * 0.8,
      drift: 0.018 + rand() * 0.014,
      size: 0.15 + rand() * 0.7,
    }));
    const placeDebris = (dt: number) => {
      debris.forEach((rock, i) => {
        rock.angle += dt * rock.drift;
        rock.tumble.x += dt * rock.spin;
        rock.tumble.y += dt * rock.spin * 0.6;
        dummy.position.set(
          15 + Math.cos(rock.angle) * rock.reach,
          3.5 + Math.sin(rock.angle) * 1.5 + rock.lift,
          -17 + Math.sin(rock.angle) * 3.5,
        );
        dummy.rotation.copy(rock.tumble);
        dummy.scale.setScalar(rock.size);
        dummy.updateMatrix();
        rocks.setMatrixAt(i, dummy.matrix);
      });
      rocks.instanceMatrix.needsUpdate = true;
    };
    placeDebris(0);
    scene.add(rocks);
    // Patrol beacons circling the station, hidden by it on the far side of their orbits.
    const beaconGlow = beaconTexture();
    const patrols = [
      { reach: 4.5, tilt: 0.5, yaw: 0.3, speed: 0.32, angle: 0.4 },
      { reach: 5.1, tilt: -0.35, yaw: -0.6, speed: -0.24, angle: 2.6 },
      { reach: 4.2, tilt: 1.1, yaw: 1.4, speed: 0.4, angle: 4.4 },
    ].map((orbit) => {
      const beacon = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: beaconGlow,
          color: 0xd8f0e6,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      beacon.scale.setScalar(0.32);
      scene.add(beacon);
      const plane = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(orbit.tilt, orbit.yaw, 0),
      );
      return { ...orbit, beacon, plane };
    });
    const placePatrols = (dt: number) => {
      patrols.forEach((patrol, index) => {
        patrol.angle += dt * patrol.speed;
        patrol.beacon.position
          .set(
            Math.cos(patrol.angle) * patrol.reach,
            0,
            Math.sin(patrol.angle) * patrol.reach,
          )
          .applyQuaternion(patrol.plane)
          .add(deathStar.position);
        patrol.beacon.material.opacity =
          0.45 +
          0.55 * Math.pow(Math.max(0, Math.sin(elapsed * 2.1 + index * 2)), 14);
      });
    };
    const traffic = createSpaceTraffic(renderer, (phase) =>
      hyperspaceCallback.current(phase),
    );
    scene.add(traffic.group);
    const spaceEvents = livingOn("events") && livingOn("spaceEvents")
      ? createSpaceEvents({ glow: traffic.glow, ship: traffic.fleetShip, asteroids: Math.round(60 + livingProfile().traffic * 120) })
      : null;
    if (spaceEvents) scene.add(spaceEvents.group);
    // Development only: runs the events forward, to check them by hand.
    if (process.env.NODE_ENV !== "production" && spaceEvents)
      (window as unknown as { __orbitalSpace?: object }).__orbitalSpace = {
        advance: (seconds = 1) => {
          for (let i = 0; i < seconds * 30; i++) spaceEvents.tick(1 / 30, i / 30, false, camera, galaxy().activeAt("space"));
        },
        camera,
        group: spaceEvents.group,
      };
    const obstacles = planets.map((planet, index) => ({
      position: planet.position,
      radius: radii[index],
    }));
    const ship = createShipModel();
    const shipBounds = new THREE.Box3().setFromObject(ship);
    const exhausts: THREE.Sprite[] = [];
    const engineCores = new Set<THREE.MeshStandardMaterial>();
    ship.traverse((object) => {
      if (object instanceof THREE.Sprite && object.name === "engine")
        exhausts.push(object);
      if (
        object instanceof THREE.Mesh &&
        object.material instanceof THREE.MeshStandardMaterial &&
        object.material.name === "reactor-core"
      )
        engineCores.add(object.material);
    });
    // The engine trail bought in Galactic Arcade tints the exhaust glow.
    const tintEngines = () => {
      const trail = equippedValue(getArcade(), "engine");
      exhausts.forEach((engine) => engine.material.color.set(trail.startsWith("#") ? trail : 0xff8fc2));
    };
    tintEngines();
    const stopTint = onArcadeChange(tintEngines);
    ship.position.set(0, -1.55, 25);
    ship.rotation.set(-1.04, 0, 0);
    ship.scale.setScalar(0.585);
    scene.add(ship);
    const droidHead = ship.getObjectByName("astromech-head");
    const droidRest = droidHead?.rotation.z ?? 0;
    let droidAt = -Infinity,
      lastDroidSignal = state.droidSignal;
    const droidEyeMaterials = new Set<THREE.MeshStandardMaterial>();
    droidHead?.traverse((object) => {
      if (
        object instanceof THREE.Mesh &&
        object.material instanceof THREE.MeshStandardMaterial &&
        object.material.name === "droid-eye"
      )
        droidEyeMaterials.add(object.material);
    });
    const light = new THREE.PointLight(0xf476aa, 0.65, 3);
    light.position.set(0.5, -3.7, 6);
    scene.add(light);
    const steer = { x: 0, y: 0 },
      anchor = { x: 0, y: 0 };
    const keys = new Set<string>();
    const touches = new Set<number>();
    const velocity = new THREE.Vector3();
    const heading = { yaw: 0, pitch: 0 };
    // Manual flight, as on autopilot: the controls ease in and out, the craft banks into turns and
    // the chase view trails its heading. The stick holds the eased controls.
    const view = { yaw: 0, pitch: 0 },
      stick = { x: 0, y: 0 };
    let bank = 0,
      steered = false;
    const flightRotation = new THREE.Euler(0, 0, 0, "YXZ"),
      flightQuaternion = new THREE.Quaternion();
    const bodyBase = new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.04, 0, 0));
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
        joystick.current?.classList.remove("is-active");
        if (joystickThumb.current)
          joystickThumb.current.style.transform = "translate(0px,0px)";
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
        if (joystickThumb.current)
          joystickThumb.current.style.transform = `translate(${steer.x * 26}px,${-steer.y * 26}px)`;
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
        if (
          (e.pointerType === "touch" || el.clientWidth < 600) &&
          joystick.current
        ) {
          joystick.current.style.transform = `translate(${anchor.x - 44}px,${anchor.y - 44}px)`;
          joystick.current.classList.add("is-active");
        }
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
    el.addEventListener("lostpointercapture", cancelLostPointer);
    window.addEventListener("blur", blur);
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    // On-demand drawing (software profile): a few frames after any change, then none at rest.
    let dirtyFrames = 4;
    const resize = () => {
      const w = el.clientWidth,
        h = el.clientHeight;
      renderer.setSize(w, h);
      // Resizing clears the canvas: draw again even when nothing moves.
      dirtyFrames = Math.max(dirtyFrames, 2);
      camera.aspect = w / h;
      camera.fov = w / h < 0.8 ? 52 : 50;
      // On narrow screens, step back until every world fits inside the frame.
      const halfWidth =
        Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
      const fit = Math.max(
        ...planets.map(
          (planet, i) =>
            planet.position.z +
            (Math.abs(planet.position.x) + radii[i] + 1.5) / halfWidth,
        ),
      );
      const nextZ = w / h < 0.8 ? Math.max(66, fit) : 32;
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
    let frame = 0,
      last = performance.now(),
      elapsed = 0;
    const projected = new THREE.Vector3();
    const safePosition = new THREE.Vector3();
    const collisionNormal = new THREE.Vector3();
    const targetVelocity = new THREE.Vector3();
    let approach: ReturnType<typeof createApproachFlight> | null = null;
    let approachDestination = -1;
    const cameraAttitude = new THREE.Euler(0, 0, 0, "YXZ");
    const identity = new THREE.Quaternion();
    let settling = false;
    const shipOffset = new THREE.Vector3();
    const shipPosition = new THREE.Vector3();
    const engineOffset = new THREE.Vector3();
    const shipCorner = new THREE.Vector3();
    const shipRect = { left: 0, right: 0, top: 0, bottom: 0 };
    const distanceFormat = new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: 0,
    });
    let lastTelemetry = 0,
      lastManual = false,
      lastTarget: number | null = null,
      lastBoost = false;
    const distances = destinations.map(() => 0);
    let lastCapture = state.captureKey,
      lastSkip = state.skipKey;
    // Frame-rate sampling for the automatic profile: only while space is actually being flown.
    let sampleFrames = 0,
      sampleTime = 0;
    let lastDrawn = 0;
    let lastSignature = "";
    // Time spent preparing and drawing each frame: with a software renderer the draw call itself
    // runs on the processor, so a slow average reveals it whatever the driver claims.
    let workFrames = 0,
      workTime = 0,
      firstFrameAt = 0,
      slowWindows = 0;
    const animate = (now: number) => {
      // The software profile draws about fifteen frames a second; the time step follows, so the
      // flight keeps its speed.
      if (profile.frameInterval && now - lastDrawn < profile.frameInterval) {
        frame = requestAnimationFrame(animate);
        return;
      }
      if (profile.onDemand) {
        const s = live.current;
        const signature = `${s.flying}|${s.boost}|${s.destination}|${s.travel}|${s.arrived}|${s.paused}|${s.hidden}|${s.photo}|${s.fov}|${s.resetKey}|${s.quality}|${s.droidSignal}|${s.captureKey}|${s.skipKey}|${hovered.current}`;
        const moving =
          keys.size > 0 ||
          touches.size > 0 ||
          dragging ||
          velocity.lengthSq() > 1e-6 ||
          s.travel ||
          settling ||
          Math.abs(stick.x) + Math.abs(stick.y) + Math.abs(bank) > 0.001 ||
          elapsed - droidAt < 1.5;
        if (signature !== lastSignature) dirtyFrames = Math.max(dirtyFrames, 3);
        lastSignature = signature;
        if (!moving && dirtyFrames <= 0) {
          last = now;
          frame = requestAnimationFrame(animate);
          return;
        }
        dirtyFrames = Math.max(0, dirtyFrames - 1);
      }
      lastDrawn = now;
      const raw = now - last,
        dt = Math.min(raw / 1000, profile.frameInterval ? 0.1 : 0.05);
      last = now;
      const s = live.current;
      // While the visitor is on a planet's surface, space keeps its state but stops drawing.
      if (s.hidden) {
        keys.clear();
        release();
        velocity.set(0, 0, 0);
        frame = requestAnimationFrame(animate);
        return;
      }
      elapsed += dt;
      if (s.quality !== quality) {
        dirtyFrames = 4;
        quality = s.quality;
        profile = qualityProfiles[quality] ?? qualityProfiles.high;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, profile.pixelRatio));
        starLayers.setPixelRatio(renderer.getPixelRatio());
        dust.setPixelRatio(renderer.getPixelRatio());
        resize();
      }
      // A long gap (a background tab, a dropped frame burst) is not a measure of the GPU.
      if (!s.paused && !document.hidden && raw < 250) {
        sampleFrames++;
        sampleTime += raw;
        if (sampleTime > 5000) {
          performanceCallback.current?.((sampleFrames * 1000) / sampleTime);
          sampleFrames = 0;
          sampleTime = 0;
        }
      } else sampleFrames = sampleTime = 0;
      if (s.resetKey !== lastReset) {
        camera.position.set(0, 0, baseZ);
        heading.yaw = view.yaw = 0;
        heading.pitch = view.pitch = 0;
        stick.x = stick.y = bank = 0;
        camera.quaternion.identity();
        flightQuaternion.identity();
        ship.position.set(0, -shipHeight, baseZ - shipDistance);
        ship.rotation.set(-1.04, 0, 0);
        velocity.set(0, 0, 0);
        keys.clear();
        release();
        lastReset = s.resetKey;
        hovered.current = null;
        droidAt = -Infinity;
        lastDroidSignal = s.droidSignal;
        approach = null;
        settling = false;
        camera.fov = camera.aspect < 0.8 ? 52 : 50;
        camera.updateProjectionMatrix();
        traffic.reset();
        shootingStars.reset();
      }
      const fast = s.boost || keys.has("shift") || touches.size > 1;
      let dx = 0,
        dy = 0,
        thrusting = false;
      steered = false;
      if (s.paused) {
        keys.clear();
        release();
        velocity.set(0, 0, 0);
      }
      if (!s.travel) lastSkip = s.skipKey;
      if (!s.travel && approach) {
        settling = !approach.completed && !s.reduced;
        approach = null;
      }
      if (s.travel) {
        if (!approach || approachDestination !== s.destination) {
          keys.clear();
          release();
          approachDestination = s.destination;
          approach = createApproachFlight({
            camera,
            ship,
            destination: planets[s.destination].position,
            radius: radii[s.destination],
            shipDistance,
            shipHeight,
            reduced: s.reduced,
            obstacles: planets.map((planet, index) => ({
              position: planet.position,
              radius: radii[index],
            })),
          });
          settling = false;
        }
        const wasComplete = approach.completed;
        // Skipping the trip plays the rest of the approach in a single step.
        if (s.skipKey !== lastSkip) {
          lastSkip = s.skipKey;
          approach.update(3600);
        } else if (!s.paused) approach.update(dt);
        cameraAttitude.setFromQuaternion(camera.quaternion, "YXZ");
        heading.yaw = view.yaw = cameraAttitude.y;
        heading.pitch = view.pitch = cameraAttitude.x;
        stick.x = stick.y = bank = 0;
        flightRotation.set(heading.pitch, heading.yaw, 0, "YXZ");
        flightQuaternion.setFromEuler(flightRotation);
        velocity.set(0, 0, 0);
        if (!wasComplete && approach.completed) approachCallback.current();
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
        steered = true;
        // Turns build up and settle rather than starting and stopping dead.
        const ease = 1 - Math.exp(-dt * (s.reduced ? 12 : 5));
        stick.x += (dx - stick.x) * ease;
        stick.y += (dy - stick.y) * ease;
        heading.yaw -= stick.x * dt * 0.5;
        heading.yaw = Math.atan2(Math.sin(heading.yaw), Math.cos(heading.yaw));
        heading.pitch = THREE.MathUtils.clamp(
          heading.pitch + stick.y * dt * 0.36,
          -0.85,
          0.85,
        );
        // The craft banks into the turn and swings out across the frame; the view catches up.
        bank = THREE.MathUtils.damp(bank, s.reduced ? 0 : -stick.x * 0.42, 6, dt);
        const follow = s.reduced ? 1 : 1 - Math.exp(-dt * 4);
        view.yaw +=
          Math.atan2(Math.sin(heading.yaw - view.yaw), Math.cos(heading.yaw - view.yaw)) * follow;
        view.pitch += (heading.pitch - view.pitch) * follow;
        viewRotation.set(view.pitch, view.yaw, bank * 0.08, "YXZ");
        camera.quaternion.setFromEuler(viewRotation);
        flightRotation.set(heading.pitch, heading.yaw, 0, "YXZ");
        flightQuaternion.setFromEuler(flightRotation);
        forward.set(0, 0, -1).applyQuaternion(flightQuaternion);
        const speed = active ? (fast ? 16 : 5.5) : 0;
        thrusting = active;
        targetVelocity.copy(forward).multiplyScalar(speed);
        // Thrust builds up; releasing the controls brakes to a stop in about a second, with no
        // automatic cruise.
        velocity.lerp(targetVelocity, 1 - Math.exp(-dt * (active ? 2.4 : 3.5)));
        if (!active && velocity.lengthSq() < 0.0004) velocity.set(0, 0, 0);
        camera.position.addScaledVector(velocity, dt);
        // Test the ship's actual forward position, rather than the camera behind it.
        shipOffset
          .set(0, -shipHeight, -shipDistance)
          .applyQuaternion(flightQuaternion);
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
      // Manual flight keeps the established foreground framing, along the flight heading.
      // The autopilot owns its craft pose.
      if (!s.travel) {
        if (!s.flying) flightQuaternion.copy(camera.quaternion);
        shipOffset
          .set(stick.x * 0.12, -shipHeight + stick.y * 0.08, -shipDistance)
          .applyQuaternion(flightQuaternion);
        shipPosition.copy(camera.position).add(shipOffset);
        if (settling) ship.position.lerp(shipPosition, 1 - Math.exp(-dt * 9));
        else ship.position.copy(shipPosition);
        // Nose into the turn and bank about the flight axis, as the autopilot does.
        // At rest the craft rides a slow swell, unless the visitor switched it off.
        const swell = s.sway && !s.reduced && !s.paused ? 1 : 0;
        modelRotation.set(
          stick.y * 0.1 + Math.sin(elapsed * 0.45) * 0.012 * swell,
          -stick.x * 0.12,
          bank + Math.sin(elapsed * 0.32 + 1.1) * 0.022 * swell,
          "YXZ",
        );
        modelQuaternion.setFromEuler(modelRotation).multiply(bodyBase);
        modelQuaternion.premultiply(flightQuaternion);
        if (settling) {
          ship.quaternion.slerp(modelQuaternion, 1 - Math.exp(-dt * 9));
          if (
            ship.position.distanceToSquared(shipPosition) < 0.000001 &&
            ship.quaternion.angleTo(modelQuaternion) < 0.001
          )
            settling = false;
        } else ship.quaternion.copy(modelQuaternion);
        // The view widens a touch with speed, as on autopilot.
        const baseFov =
          s.photo && s.fov
            ? s.fov
            : (camera.aspect < 0.8 ? 52 : 50) +
              (s.reduced ? 0 : Math.min(1, velocity.length() / 16) * 3);
        if (camera.fov !== baseFov) {
          camera.fov = THREE.MathUtils.damp(camera.fov, baseFov, settling ? 9 : 3, dt);
          if (Math.abs(camera.fov - baseFov) < 0.001) camera.fov = baseFov;
          camera.updateProjectionMatrix();
        }
        // Clear only the cinematic roll; the pilot retains the current direction.
        cameraAttitude.setFromQuaternion(camera.quaternion, "YXZ");
        if (!steered && Math.abs(cameraAttitude.z) > 0.00001) {
          viewRotation.set(view.pitch, view.yaw, 0, "YXZ");
          identity.setFromEuler(viewRotation);
          camera.quaternion.slerp(identity, 1 - Math.exp(-dt * 9));
        }
      }
      engineOffset.set(0, -0.35, 1.1).applyQuaternion(camera.quaternion);
      light.position.copy(ship.position).add(engineOffset);
      const enginePower = s.paused
        ? 0
        : s.travel
          ? (approach?.power ?? 0)
          : thrusting
            ? 1
            : Math.min(1, velocity.length() / 5.5) * 0.6;
      const engineActive = enginePower > 0.02;
      engineCores.forEach((material) => {
        material.emissiveIntensity = 0.65 + enginePower * (fast ? 1.15 : 0.7);
      });
      light.intensity = 0.55 + enginePower * 0.8;
      exhausts.forEach((engine, i) => {
        const pulse =
          s.reduced || !engineActive
            ? 1
            : 1 + Math.sin(elapsed * 16 + i) * 0.09;
        if (engine instanceof THREE.Sprite)
          engine.material.opacity = 0.22 + enginePower * 0.58;
        engine.scale.set(
          0.32 * pulse,
          (0.25 + enginePower * (s.travel ? 0.33 : fast ? 0.41 : 0.17)) * pulse,
          0.32,
        );
      });
      planetLayers.forEach((layer, index) => {
        projected.copy(camera.position).sub(planets[index].position);
        layer.faceViewer(projected);
        if (!s.paused) layer.tick(dt, s.reduced);
      });
      const lively = s.paused || s.reduced ? 0 : dt;
      placeDebris(lively);
      placePatrols(lively);
      starLayers.update(camera, elapsed, s.reduced);
      dust.update(camera, s.reduced ? profile.dust * 0.5 : profile.dust);
      sunBody.update(camera, profile.flare);
      nebula.dome.position.copy(camera.position);
      shootingStars.tick(
        lively,
        camera,
        s.flying && !s.travel && !s.paused && !s.reduced,
      );
      traffic.tick(
        s.paused ? 0 : dt,
        camera,
        { active: s.flying && !s.reduced, travel: s.travel },
        obstacles,
      );
      spaceEvents?.tick(s.paused ? 0 : dt, elapsed, s.reduced, camera, galaxy().activeAt("space"));
      if (s.droidSignal !== lastDroidSignal) {
        lastDroidSignal = s.droidSignal;
        droidAt = elapsed;
      }
      const droidAge = elapsed - droidAt,
        droidActive = droidAge < 1.5;
      if (droidHead)
        droidHead.rotation.z =
          droidRest +
          (droidActive && !s.reduced
            ? Math.sin((droidAge / 1.5) * Math.PI * 2) *
              Math.sin((droidAge / 1.5) * Math.PI) *
              0.65
            : 0);
      droidEyeMaterials.forEach((material) => {
        material.emissiveIntensity = droidActive ? 1.1 : 0.22;
      });
      ship.updateMatrixWorld(true);
      // The ship's screen footprint, so planet labels can step around it.
      shipRect.left = shipRect.top = Infinity;
      shipRect.right = shipRect.bottom = -Infinity;
      for (let corner = 0; corner < 8; corner++) {
        shipCorner
          .set(
            corner & 1 ? shipBounds.max.x : shipBounds.min.x,
            corner & 2 ? shipBounds.max.y : shipBounds.min.y,
            corner & 4 ? shipBounds.max.z : shipBounds.min.z,
          )
          .applyMatrix4(ship.matrixWorld)
          .project(camera);
        const x = (shipCorner.x * 0.5 + 0.5) * el.clientWidth,
          y = (-shipCorner.y * 0.5 + 0.5) * el.clientHeight;
        shipRect.left = Math.min(shipRect.left, x);
        shipRect.right = Math.max(shipRect.right, x);
        shipRect.top = Math.min(shipRect.top, y);
        shipRect.bottom = Math.max(shipRect.bottom, y);
      }
      if (droidButton.current && droidHead) {
        droidHead.getWorldPosition(projected).project(camera);
        const button = droidButton.current;
        const visible = !s.paused && !s.travel && s.flying;
        button.style.visibility = visible ? "visible" : "hidden";
        button.disabled = !visible;
        button.style.transform = `translate(${(projected.x * 0.5 + 0.5) * el.clientWidth - 18}px,${(-projected.y * 0.5 + 0.5) * el.clientHeight - 18}px)`;
        button.dataset.active = String(droidActive);
      }
      let aimed: number | null = null,
        closest = 0.42;
      if (!s.paused && !s.travel && s.flying) {
        planets.forEach((planet, index) => {
          projected.copy(planet.position).project(camera);
          if (projected.z <= -1 || projected.z >= 1) return;
          if (hovered.current === index) {
            aimed = index;
            return;
          }
          if (hovered.current !== null) return;
          const angle = Math.hypot(projected.x * camera.aspect, projected.y);
          if (angle < closest) {
            closest = angle;
            aimed = index;
          }
        });
      }
      planets.forEach((planet, index) => {
        const marker = markers.current[index];
        if (!marker) return;
        projected.copy(planet.position).project(camera);
        const distance = camera.position.distanceTo(planet.position);
        const visible =
          projected.z < 1 &&
          projected.z > -1 &&
          Math.abs(projected.x) < 1.2 &&
          Math.abs(projected.y) < 1.2 &&
          !s.paused &&
          !s.travel &&
          s.flying;
        marker.style.visibility = visible ? "visible" : "hidden";
        marker.disabled = !visible;
        marker.dataset.targeted = String(visible && index === aimed);
        const size = THREE.MathUtils.clamp(
          (radii[index] * el.clientHeight) /
            (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance),
          36,
          260,
        );
        marker.style.width = `${size}px`;
        marker.style.height = `${size}px`;
        const centerX = (projected.x * 0.5 + 0.5) * el.clientWidth,
          centerY = (-projected.y * 0.5 + 0.5) * el.clientHeight;
        marker.style.transform = `translate(${centerX - size / 2}px,${centerY - size / 2}px)`;
        marker.dataset.orbiting = String(s.arrived && index === s.destination);
        // Lift the label above the world when it would sit on the ship or below the screen.
        const compact = el.clientWidth < 600,
          labelTop = centerY + size / 2 + (compact ? 12 : 18),
          labelBottom = labelTop + (compact ? 36 : 46),
          labelHalf = compact ? 56 : 70,
          margin = marker.dataset.label === "above" ? 14 : 0;
        const crowded =
          (centerX + labelHalf > shipRect.left - margin &&
            centerX - labelHalf < shipRect.right + margin &&
            labelBottom > shipRect.top - margin &&
            labelTop < shipRect.bottom + margin) ||
          labelBottom > el.clientHeight - 8 + margin;
        marker.dataset.label = crowded ? "above" : "below";
        const label = distanceLabels.current[index];
        if (label) {
          const range = Math.max(
            0,
            ship.position.distanceTo(planet.position) - radii[index],
          );
          distances[index] = range;
          const text = `DISTANCE · ${distanceFormat.format(Math.round(range * 10) * 10)} km`;
          if (label.textContent !== text) label.textContent = text;
        }
      });
      if (
        now - lastTelemetry > 100 ||
        lastManual !== thrusting ||
        lastTarget !== aimed ||
        lastBoost !== fast
      ) {
        flightCallback.current({
          throttle: s.paused
            ? 0
            : s.travel
              ? (approach?.power ?? 0)
              : Math.min(1, velocity.length() / 16),
          boost: fast && thrusting,
          manual: thrusting,
          target: aimed,
          approachProgress: approach?.progress ?? 0,
          distances,
        });
        lastTelemetry = now;
        lastManual = thrusting;
        lastTarget = aimed;
        lastBoost = fast;
      }
      renderer.render(scene, camera);
      // The first second and a half (shader compilation, texture uploads) is not counted, and two
      // slow windows in a row are needed, so a real graphics card is never mistaken for software.
      firstFrameAt ||= now;
      if (now - firstFrameAt > 1500) {
        workFrames++;
        workTime += performance.now() - now;
        if (workFrames >= 6) {
          const average = workTime / workFrames;
          slowWindows = average > 80 ? slowWindows + 1 : 0;
          // Report it as the frame rate it allows: under twelve the profile drops to Minimal.
          if (slowWindows >= 2) {
            performanceCallback.current?.(1000 / average);
            slowWindows = 0;
          }
          workFrames = workTime = 0;
        }
      }
      // The drawing buffer is read in the same task as the render, before the browser clears it.
      if (s.captureKey !== lastCapture) {
        lastCapture = s.captureKey;
        renderer.domElement.toBlob((image) => captureCallback.current?.(image), "image/png");
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      stopTint();
      disposed = true;
      referenceTextures.forEach((texture) => texture.dispose());
      nebula.dispose();
      sunBody.dispose();
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", cancelLostPointer);
      el.removeEventListener("lostpointercapture", cancelLostPointer);
      window.removeEventListener("blur", blur);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      scene.traverse((o) => {
        if (
          o instanceof THREE.Mesh ||
          o instanceof THREE.Points ||
          o instanceof THREE.Line ||
          o instanceof THREE.Sprite
        ) {
          if (!(o instanceof THREE.Sprite)) o.geometry.dispose();
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
      inert={state.paused || state.hidden}
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
          onPointerEnter={() => {
            hovered.current = index;
          }}
          onPointerLeave={() => {
            if (hovered.current === index) hovered.current = null;
          }}
          onFocus={() => {
            hovered.current = index;
          }}
          onBlur={() => {
            if (hovered.current === index) hovered.current = null;
          }}
          data-destination={index}
          aria-describedby={`planet-range-${index}`}
        >
          <span>
            {destination.name}
            <small>{destination.category}</small>
            <em
              id={`planet-range-${index}`}
              ref={(element) => {
                distanceLabels.current[index] = element;
              }}
              className="planet-distance"
            />
          </span>
        </button>
      ))}
      <button
        ref={droidButton}
        className="droid-hit"
        aria-label="Parler à l’astromécano R-X7"
        onClick={onDroid}
      >
        <span>ASTROMÉCANO</span>
      </button>
      <div ref={joystick} className="touch-joystick" aria-hidden="true">
        <i ref={joystickThumb} />
      </div>
    </div>
  );
}
