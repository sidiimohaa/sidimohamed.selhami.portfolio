import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildingMaterial, HAZE_HIGH, padTexture } from "../coruscantZone";
import { createCoruscantSkyline, CORUSCANT_LANDMARKS } from "../coruscantSkyline";
import { parkShip } from "../landingKit";
import { ESPLANADE, PLAZA, SENATE, SENATE_FACING, TEMPLE, type Trip } from "./taxiPlaces";
import type { Lane } from "./taxiTraffic";
import { createTaxiStand } from "./taxiModel";

// The city the taxi crosses: a sunset sky, thousands of towers whose windows the shader lights,
// carved into canyons around every trip and stream of traffic, sky bridges overhead, holographic
// signs and neon along the corridors, and pad 3-7 with the X-wing where the journey starts.

export const SUN = new THREE.Vector3(-0.85, 0.07, -0.5).normalize();
const CITY_HAZE = 0.0015;

function sky() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(3800, 48, 24),
    new THREE.ShaderMaterial({
      uniforms: { hazeHigh: { value: HAZE_HIGH }, sun: { value: SUN } },
      vertexShader: `varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform vec3 hazeHigh;uniform vec3 sun;varying vec3 vDirection;
       void main(){
        vec3 d=normalize(vDirection);
        float h=d.y;
        float sunset=pow(max(0.0,dot(normalize(d.xz+vec2(.0001)),normalize(sun.xz))),4.0);
        vec3 zenith=vec3(.025,.038,.115);
        vec3 horizon=mix(vec3(.21,.15,.32),vec3(.66,.28,.12),sunset);
        vec3 c=h>0.0?mix(horizon,zenith,pow(h,.48)):mix(horizon,hazeHigh,pow(-h,.45));
        float band=exp(-pow((h-.16)*9.0,2.0));
        float cloud=.5+.5*sin(d.x*18.0+d.z*13.0+sin(d.z*27.0)*.7);
        c+=vec3(.055,.025,.095)*band*cloud;
        c+=vec3(.16,.055,.018)*sunset*exp(-pow(h*9.0,2.0));
        float streak=exp(-pow((h-.06)*26.0,2.0))*(.55+.45*sin(d.x*70.0+d.z*41.0+sin(d.x*13.0)*2.0));
        c+=vec3(.3,.1,.04)*streak*sunset*.55;
        float s=max(0.0,dot(d,sun));
        c+=vec3(1.0,.62,.3)*pow(s,1400.0)*7.0;
        c+=vec3(1.0,.46,.18)*pow(s,70.0)*.6;
        c+=vec3(.85,.32,.12)*pow(s,7.0)*.2;
        gl_FragColor=vec4(c,1.0);
       }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
}

// Glowing signs in invented brands, with a line of alien glyphs.
const SIGNS: { title: string; sub: string; color: string }[] = [
  { title: "HOLONET", sub: "INFOS EN CONTINU", color: "#7fe6ff" },
  { title: "CAFÉ NOVA", sub: "OUVERT TOUTE LA NUIT", color: "#ff6fd2" },
  { title: "EXPRESS 3-7", sub: "LIGNE AÉRIENNE ➜", color: "#ffb35c" },
  { title: "ORBITAL", sub: "UN PORTFOLIO À EXPLORER", color: "#bfe8ff" },
  { title: "SKYRACE", sub: "GRANDE COURSE CE SOIR", color: "#7dffb0" },
  { title: "HÔTEL ZÉNITH", sub: "VUE SUR LE SÉNAT", color: "#ffd27a" },
  { title: "DROÏDES & CIE", sub: "RÉPARATION EXPRESS", color: "#ff9a5c" },
  { title: "", sub: "", color: "#ff7da8" },
];
function signTexture(sign: (typeof SIGNS)[number], seed: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 224;
  const c = canvas.getContext("2d")!;
  let s = seed;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  c.fillStyle = "rgba(0,0,0,0)";
  c.clearRect(0, 0, 512, 224);
  c.strokeStyle = sign.color;
  c.shadowColor = sign.color;
  c.shadowBlur = 14;
  c.lineWidth = 5;
  c.strokeRect(10, 10, 492, 204);
  c.fillStyle = sign.color;
  c.textAlign = "center";
  const glyphs = (y: number, size: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const x = 256 - (count * size * 0.9) / 2 + i * size * 0.9;
      c.beginPath();
      for (let k = 0; k < 3; k++) {
        c.moveTo(x + rand() * size * 0.6, y + rand() * size);
        c.lineTo(x + rand() * size * 0.6, y + rand() * size);
      }
      c.lineWidth = 4;
      c.stroke();
    }
  };
  if (sign.title) {
    c.font = "bold 76px Arial, Helvetica, sans-serif";
    c.fillText(sign.title, 256, 112, 470);
    c.font = "26px SFMono-Regular, Consolas, monospace";
    c.fillText(sign.sub, 256, 156, 460);
    glyphs(170, 26, 12);
  } else {
    glyphs(40, 52, 7);
    glyphs(120, 40, 9);
  }
  // Scanlines.
  c.shadowBlur = 0;
  c.globalCompositeOperation = "destination-out";
  c.fillStyle = "rgba(0,0,0,.35)";
  for (let y = 0; y < 224; y += 4) c.fillRect(0, y, 512, 1.5);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

type Sample = { x: number; y: number; z: number; clear: number; trip: boolean };

export function createTaxiCity(trips: Trip[], lanes: Lane[], glow: THREE.Texture, quality: number) {
  const group = new THREE.Group();
  group.name = "taxi-city";
  let s = 7321;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const dome = sky();
  group.add(dome);
  group.add(new THREE.HemisphereLight(0x5a6aa0, 0xa0562a, 1.15));
  const sun = new THREE.DirectionalLight(0xffc49a, 2.1);
  sun.position.copy(SUN).multiplyScalar(600);
  group.add(sun, sun.target);

  // Everything the towers must keep clear of, hashed on a 50 m grid.
  const CELL = 50;
  const grid = new Map<string, Sample[]>();
  const file = (sample: Sample) => {
    const key = `${Math.floor(sample.x / CELL)},${Math.floor(sample.z / CELL)}`;
    const list = grid.get(key) ?? [];
    list.push(sample);
    grid.set(key, list);
  };
  trips.forEach((trip) => {
    for (let d = 0; d <= trip.length; d += 6) {
      const p = trip.curve.getPointAt(Math.min(1, d / trip.length));
      file({ x: p.x, y: p.y, z: p.z, clear: 30, trip: true });
    }
  });
  lanes.forEach((item) => item.points.forEach((p) => file({ x: p.x, y: p.y, z: p.z, clear: 12, trip: false })));
  const around = (x: number, z: number) => {
    const cx = Math.floor(x / CELL),
      cz = Math.floor(z / CELL),
      found: Sample[] = [];
    for (let i = -2; i <= 2; i++) for (let k = -2; k <= 2; k++) found.push(...(grid.get(`${cx + i},${cz + k}`) ?? []));
    return found;
  };

  // Towers.
  const step = quality >= 2 ? 22 : 28;
  const base = -650;
  const towers: { x: number; z: number; w: number; d: number; top: number; wall: number }[] = [];
  const along = (x: number, z: number) => (x - SENATE.x) * SENATE_FACING.x + (z - SENATE.z) * SENATE_FACING.z;
  const across = (x: number, z: number) => Math.abs((x - SENATE.x) * SENATE_FACING.z - (z - SENATE.z) * SENATE_FACING.x);
  const keepOut = (x: number, z: number) =>
    Math.hypot(x, z) < 62 ||
    CORUSCANT_LANDMARKS.some((mark) => Math.hypot(x - mark.x, z - mark.z) < mark.r + 12) ||
    Math.max(Math.abs(x - TEMPLE.x), Math.abs(z - TEMPLE.z)) < 222 ||
    Math.hypot(x - SENATE.x, z - SENATE.z) < ESPLANADE + 8 ||
    (along(x, z) > 60 && along(x, z) < PLAZA.to + 30 && across(x, z) < 42);
  const fit = (x: number, z: number, w: number, d: number, top: number) => {
    let ceiling = Infinity,
      wall = -Infinity;
    around(x, z).forEach((sample) => {
      const gap = Math.hypot(Math.max(0, Math.abs(sample.x - x) - w / 2), Math.max(0, Math.abs(sample.z - z) - d / 2));
      if (gap < sample.clear) ceiling = Math.min(ceiling, sample.y - (sample.trip ? 26 : 14));
      else if (sample.trip && gap < 95 && sample.y < 60) wall = Math.max(wall, sample.y);
    });
    return { top: Math.min(top, ceiling), wall, ceiling };
  };
  for (let gx = -1400; gx <= 1500; gx += step)
    for (let gz = -1800; gz <= 560; gz += step) {
      const x = gx + (rand() - 0.5) * step * 0.4,
        z = gz + (rand() - 0.5) * step * 0.4;
      if (keepOut(x, z)) continue;
      const w = 8 + rand() * 11,
        d = 8 + rand() * 11;
      let top = rand() < 0.012 && Math.hypot(x, z) > 260 ? 60 + rand() * 170 : -170 + Math.pow(rand(), 2) * 200;
      const fitted = fit(x, z, w, d, top);
      // Beside a corridor the towers rise into canyon walls, still clear of every route.
      if (fitted.wall > -Infinity && rand() < 0.82) top = Math.max(top, fitted.wall + 16 + rand() * 75);
      top = Math.min(top, fitted.ceiling);
      if (top < base + 40) continue;
      towers.push({ x, z, w, d, top, wall: fitted.wall });
      if (rand() < 0.2) {
        const crown = Math.min(top + 10 + rand() * 32, fitted.ceiling);
        if (crown > top + 4) towers.push({ x: x + (rand() - 0.5) * 3, z: z + (rand() - 0.5) * 3, w: w * 0.45, d: d * 0.45, top: crown, wall: -Infinity });
      }
    }
  const material = buildingMaterial(CITY_HAZE);
  const city = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, towers.length);
  const dummy = new THREE.Object3D();
  towers.forEach((tower, i) => {
    dummy.position.set(tower.x, (tower.top + base) / 2, tower.z);
    dummy.scale.set(tower.w, tower.top - base, tower.d);
    dummy.updateMatrix();
    city.setMatrixAt(i, dummy.matrix);
  });
  city.frustumCulled = false;
  group.add(city);
  group.add(createCoruscantSkyline(buildingMaterial(CITY_HAZE)));

  // Neon running up the canyon walls.
  const walls = towers.filter((tower) => tower.wall > -Infinity && tower.top > tower.wall + 10);
  const neonCount = Math.min(walls.length, quality >= 2 ? 520 : 300);
  const neon = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), Math.max(1, neonCount));
  const palette = [0x7fe6ff, 0xff6fd2, 0xffb35c, 0x9d8bff, 0x7dffb0, 0xffe2a8];
  for (let i = 0; i < neonCount; i++) {
    const tower = walls[Math.floor(rand() * walls.length)];
    const from = Math.max(base + 60, tower.wall - 50),
      to = Math.min(tower.top - 2, tower.wall + 60);
    const corner = Math.floor(rand() * 4);
    dummy.position.set(tower.x + ((corner & 1) * 2 - 1) * (tower.w / 2 + 0.15), (from + to) / 2, tower.z + ((corner & 2) - 1) * (tower.d / 2 + 0.15));
    dummy.scale.set(0.35, Math.max(1, to - from), 0.35);
    dummy.updateMatrix();
    neon.setMatrixAt(i, dummy.matrix);
    neon.setColorAt(i, new THREE.Color(palette[Math.floor(rand() * palette.length)]));
  }
  neon.frustumCulled = false;
  group.add(neon);

  // Sky bridges across the corridors, above or below the trip, never in another route's way.
  const bridges: THREE.BufferGeometry[] = [],
    strips: THREE.BufferGeometry[] = [];
  const tangent = new THREE.Vector3();
  trips.forEach((trip) => {
    for (let d = trip.length * 0.16; d < trip.length * 0.8; d += 140 + rand() * 80) {
      const u = d / trip.length,
        p = trip.curve.getPointAt(u);
      trip.curve.getTangentAt(u, tangent);
      const y = p.y + (rand() < 0.5 ? 14 : -16),
        yaw = Math.atan2(tangent.x, tangent.z) + Math.PI / 2,
        span = 150;
      const dx = Math.sin(yaw),
        dz = Math.cos(yaw);
      let clear = !CORUSCANT_LANDMARKS.some((mark) => Math.hypot(p.x - mark.x, p.z - mark.z) < span / 2 + mark.r);
      for (let k = -span / 2; k <= span / 2 && clear; k += 6)
        around(p.x + dx * k, p.z + dz * k).forEach((sample) => {
          if (Math.hypot(sample.x - p.x - dx * k, sample.z - p.z - dz * k) < 10 && Math.abs(sample.y - y) < (sample.trip ? 10 : 6)) clear = false;
        });
      if (!clear || keepOut(p.x, p.z)) continue;
      const matrix = new THREE.Matrix4().compose(new THREE.Vector3(p.x, y, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(1, 1, 1));
      bridges.push(new THREE.BoxGeometry(7, 3.2, span).applyMatrix4(matrix));
      [-1, 1].forEach((side) => strips.push(new THREE.BoxGeometry(0.3, 0.25, span).translate(side * 3.2, -1.65, 0).applyMatrix4(matrix)));
    }
  });
  if (bridges.length) {
    group.add(new THREE.Mesh(mergeGeometries(bridges), material));
    group.add(new THREE.Mesh(mergeGeometries(strips), new THREE.MeshBasicMaterial({ color: 0xffd9a8, toneMapped: false })));
  }

  // Holographic signs facing the corridors.
  const signMaterials = SIGNS.map(
    (sign, i) =>
      new THREE.MeshBasicMaterial({ map: signTexture(sign, 900 + i * 37), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  );
  const signs: THREE.BufferGeometry[][] = SIGNS.map(() => []);
  trips.forEach((trip) => {
    for (let d = trip.length * 0.12; d < trip.length * 0.84; d += 70 + rand() * 60) {
      const u = d / trip.length,
        p = trip.curve.getPointAt(u);
      trip.curve.getTangentAt(u, tangent);
      const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
      const at = p.clone().addScaledVector(right, (rand() < 0.5 ? -1 : 1) * (31 + rand() * 12)).setY(p.y + rand() * 18 - 3);
      if (keepOut(at.x, at.z)) continue;
      const width = 14 + rand() * 12;
      const plane = new THREE.PlaneGeometry(width, width * 0.44);
      const look = new THREE.Matrix4().lookAt(at, p.clone().addScaledVector(tangent, -40).setY(at.y), new THREE.Vector3(0, 1, 0));
      // lookAt aims +Z away from the corridor; turned round, the sign's face looks at it. A
      // second face, back to back, keeps the lettering the right way round from behind.
      const turn = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromRotationMatrix(look));
      const back = plane.clone();
      plane.rotateY(Math.PI);
      [plane, back].forEach((face) => {
        face.applyMatrix4(turn);
        face.translate(at.x, at.y, at.z);
      });
      signs[Math.floor(rand() * SIGNS.length)].push(plane, back);
    }
  });
  signs.forEach((list, i) => list.length && group.add(new THREE.Mesh(mergeGeometries(list), signMaterials[i])));

  // Pad 3-7, as the visitor left it.
  const metal = new THREE.MeshStandardMaterial({ color: 0x3a4045, roughness: 0.6, metalness: 0.55 });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(16, 16.5, 0.8, 96), [metal, new THREE.MeshStandardMaterial({ map: padTexture("PLATEFORME 3-7"), roughness: 0.72, metalness: 0.35 }), metal]);
  pad.position.y = -0.4;
  group.add(pad);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(12.5, 15, -base, 48, 1, true), material);
  plinth.position.y = base / 2 - 0.8;
  group.add(plinth);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(15.95, 0.05, 6, 160), new THREE.MeshBasicMaterial({ color: 0xffa354 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.02;
  group.add(rim);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(15.55, 0.045, 6, 160), metal);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = 1.05;
  group.add(rail);
  const beacons = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2;
    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffb066, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    beacon.position.set(Math.cos(angle) * 8.9, 0.08, Math.sin(angle) * 8.9);
    beacon.scale.setScalar(0.55);
    group.add(beacon);
    return beacon;
  });
  const parked = parkShip(metal);
  group.add(parked.ship);
  const stand = createTaxiStand(glow);
  group.add(stand.group);

  let chase = 0;
  return {
    group,
    tick: (dt: number, elapsed: number, reduced: boolean, camera: THREE.Camera) => {
      dome.position.copy(camera.position);
      chase += reduced ? 0 : dt * 9;
      beacons.forEach((beacon, i) => (beacon.material.opacity = 0.35 + 0.65 * Math.max(0, 1 - ((((chase - i) % 24) + 24) % 24) / 4)));
      if (!reduced) signMaterials.forEach((sign, i) => (sign.opacity = 0.82 + Math.sin(elapsed * (3 + i) + i) * 0.06 + (Math.sin(elapsed * 37 + i * 5) > 0.97 ? -0.4 : 0)));
      stand.tick(elapsed, reduced);
    },
  };
}
