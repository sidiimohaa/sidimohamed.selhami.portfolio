"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
export type FlightState = {
  flying: boolean;
  boost: boolean;
  destination: number;
  travel: boolean;
  reduced: boolean;
};
type Props = {
  state: FlightState;
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
export default function SpaceScene({ state, onReady, onUnsupported }: Props) {
  const mount = useRef<HTMLDivElement>(null),
    live = useRef(state);
  live.current = state;
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
    scene.fog = new THREE.FogExp2(0x080d0d, 0.008);
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 180);
    camera.position.set(0, 0, 19);
    scene.add(new THREE.AmbientLight(0x9bafa8, 0.19));
    const sun = new THREE.DirectionalLight(0xffe2bf, 2.8);
    sun.position.set(-12, 11, 5);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x7b9da6, 0.3);
    rim.position.set(6, -5, 8);
    scene.add(rim);
    const rand = random(74),
      starsGeo = new THREE.BufferGeometry(),
      coords = [],
      colors = [];
    for (let i = 0; i < 2100; i++) {
      coords.push(
        (rand() - 0.5) * 155,
        (rand() - 0.5) * 100,
        -15 - rand() * 85,
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
        size: 0.035,
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
    addPlanet("sand", 3.85, [6.4, 2.15, -3], 0xd9b78a);
    addPlanet("green", 1.34, [0.8, -0.65, -5], 0x8abdb1);
    addPlanet("moon", 0.42, [-6.8, 3, -8], 0xa4b2b4);
    const orbitGeo = new THREE.BufferGeometry();
    const orbitPoints = [];
    for (let i = 0; i <= 256; i++) {
      const a = (i / 256) * Math.PI * 2;
      orbitPoints.push(
        new THREE.Vector3(
          6.4 + Math.cos(a) * 5.8,
          1.3 + Math.sin(a) * 1.5,
          -2 + Math.sin(a) * 2.8,
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
        r = 5.8 + (rand() - 0.5) * 1.2;
      dummy.position.set(
        6.4 + Math.cos(angle) * r,
        1.3 + Math.sin(angle) * 1.5 + (rand() - 0.5) * 0.3,
        -2 + Math.sin(angle) * 2.8,
      );
      dummy.rotation.set(rand() * 5, rand() * 5, rand() * 5);
      dummy.scale.setScalar(0.15 + rand() * 0.7);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }
    scene.add(rocks);
    const ship = shipModel();
    ship.position.set(0.65, -2.65, 5);
    ship.rotation.set(0.64, 0.22, -0.34);
    ship.scale.setScalar(0.8);
    scene.add(ship);
    const light = new THREE.PointLight(0xff9f50, 2, 4);
    light.position.set(0.5, -3.7, 6);
    scene.add(light);
    const pointer = { x: 0, y: 0 },
      input = { x: 0, y: 0 },
      keys = new Set<string>();
    let dragging = false;
    const keydown = (e: KeyboardEvent) => {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(
          e.key,
        ) &&
        live.current.flying
      )
        e.preventDefault();
      keys.add(e.key.toLowerCase());
    };
    const keyup = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const reset = () => {
      keys.clear();
      dragging = false;
    };
    const pointerMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
      if (dragging && live.current.flying) {
        input.x = pointer.x * 3;
        input.y = pointer.y * 2.2;
      }
    };
    const pointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button,a,input,[role="dialog"]'))
        return;
      dragging = true;
    };
    window.addEventListener("pointermove", pointerMove);
    window.addEventListener("pointerdown", pointerDown);
    window.addEventListener("pointerup", reset);
    window.addEventListener("blur", reset);
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    const resize = () => {
      const w = el.clientWidth,
        h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (w / h < 0.8) {
        planets[0].position.set(4.1, 3.1, -5);
        planets[0].scale.setScalar(0.82);
        ship.scale.setScalar(0.62);
      } else {
        planets[0].position.set(6.4, 2.15, -3);
        planets[0].scale.setScalar(1);
        ship.scale.setScalar(0.8);
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    onReady();
    let frame = 0,
      last = performance.now(),
      elapsed = 0,
      orbitDestination = -1;
    const animate = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += dt;
      const s = live.current;
      const moving = s.flying;
      const fast = s.boost || keys.has("shift");
      if (s.travel) orbitDestination = s.destination;
      if (!moving) {
        orbitDestination = -1;
        input.x = 0;
        input.y = 0;
      }
      if (moving) {
        const dx =
          (keys.has("arrowright") || keys.has("d") ? 1 : 0) -
          (keys.has("arrowleft") || keys.has("a") || keys.has("q") ? 1 : 0);
        const dy =
          (keys.has("arrowup") || keys.has("w") || keys.has("z") ? 1 : 0) -
          (keys.has("arrowdown") || keys.has("s") ? 1 : 0);
        input.x = THREE.MathUtils.clamp(
          input.x + dx * dt * 2.5,
          -(camera.aspect < 0.8 ? 1.6 : 3.4),
          camera.aspect < 0.8 ? 1.6 : 3.4,
        );
        input.y = THREE.MathUtils.clamp(input.y + dy * dt * 2, -1, 2);
        if (!s.reduced) stars.position.z += dt * (fast ? 12 : 2.2);
        if (stars.position.z > 22) stars.position.z = 0;
      }
      const lerp = 1 - Math.exp(-dt * 3);
      ship.position.x = THREE.MathUtils.lerp(
        ship.position.x,
        camera.position.x + (moving ? input.x : 0.65) + pointer.x * 0.09,
        lerp,
      );
      ship.position.y = THREE.MathUtils.lerp(
        ship.position.y,
        camera.position.y - 2.65 +
          (moving ? input.y : s.reduced ? 0 : Math.sin(elapsed * 0.7) * 0.06),
        lerp,
      );
      ship.position.z = camera.position.z - 14;
      ship.rotation.z = THREE.MathUtils.lerp(
        ship.rotation.z,
        -0.34 - (moving ? input.x * 0.12 : 0) + pointer.x * 0.045,
        lerp,
      );
      ship.rotation.x = 0.64 + pointer.y * 0.045;
      ship.children
        .filter((c) => c.name === "engine")
        .forEach((c, i) => {
          const pulse = s.reduced ? 1 : 1 + Math.sin(elapsed * 16 + i) * 0.09;
          c.scale.set(0.65 * pulse, (fast && moving ? 1.5 : 0.8) * pulse, 0.65);
        });
      if (!s.reduced) {
        planets[0].children[0].rotation.y += dt * 0.014;
        planets[1].children[0].rotation.y += dt * 0.025;
      }
      const orbitalTarget = orbitDestination < 0 ? null : planets[orbitDestination];
      const orbitalDepth = [16, 12, 11][orbitDestination] ?? 19;
      const cameraLerp = s.reduced ? 1 : 1 - Math.exp(-dt * 0.9);
      camera.position.z = THREE.MathUtils.lerp(
        camera.position.z,
        orbitalTarget ? orbitalDepth : 19,
        cameraLerp,
      );
      camera.position.x = THREE.MathUtils.lerp(
        camera.position.x,
        (orbitalTarget ? orbitalTarget.position.x * 0.7 : 0) + pointer.x * 0.12,
        cameraLerp,
      );
      camera.position.y = THREE.MathUtils.lerp(
        camera.position.y,
        (orbitalTarget ? orbitalTarget.position.y * 0.35 : 0) + pointer.y * 0.09,
        cameraLerp,
      );
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("pointerup", reset);
      window.removeEventListener("blur", reset);
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
  return <div ref={mount} className="space-canvas" aria-hidden="true" />;
}
