import * as THREE from "three";
import { createPadLife, type PadEvent } from "./coruscantLife";
import {
  createTerminals,
  glowTexture,
  parkShip,
  random,
  type Spot,
  type Zone,
} from "./landingKit";
import type { Landing } from "./universe";

const PAD_RADIUS = 16;
const HAZE_LOW = new THREE.Color(0.4, 0.22, 0.12),
  HAZE_HIGH = new THREE.Color(0.2, 0.15, 0.15);
const FOG_DENSITY = 0.0021;

// Facades light their own windows from world position, so towers of any height stay crisp.
const buildingVertex = `
 varying vec3 vWorld;varying vec3 vNormal;varying float vSeed;
 void main(){
  #ifdef USE_INSTANCING
   mat4 placed=modelMatrix*instanceMatrix;
  #else
   mat4 placed=modelMatrix;
  #endif
  vec4 world=placed*vec4(position,1.0);
  vWorld=world.xyz;
  vNormal=normalize(mat3(placed)*normal);
  vSeed=fract(sin(dot(placed[3].xz,vec2(12.9898,78.233)))*43758.5453);
  gl_Position=projectionMatrix*viewMatrix*world;
 }`;
const buildingFragment = `
 uniform vec3 hazeLow;uniform vec3 hazeHigh;uniform float fogDensity;
 varying vec3 vWorld;varying vec3 vNormal;varying float vSeed;
 float hash(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}
 void main(){
  vec3 n=normalize(vNormal);
  vec3 color=vec3(.032,.037,.05)*(.7+vSeed*.6)*(.85+.3*n.y);
  if(abs(n.y)<.5){
   float along=vWorld.x*n.z-vWorld.z*n.x;
   vec2 cell=vec2(along/1.5,vWorld.y/2.4);
   vec2 id=floor(cell),f=fract(cell);
   float pane=step(.18,f.x)*step(f.x,.82)*step(.28,f.y)*step(f.y,.78);
   float lit=step(.6-vSeed*.28,hash(id+vSeed*91.0));
   vec3 tint=mix(vec3(1.0,.62,.3),vec3(.55,.78,1.0),step(.84,hash(id.yx+vSeed*13.0)));
   vec3 near=pane*lit*tint*(.5+hash(id*1.7)*.65);
   // Far away, windows blend into their average glow instead of shimmering.
   float detail=1.0-smoothstep(.35,1.0,max(fwidth(cell.x),fwidth(cell.y)));
   vec3 far=vec3(.62,.4,.24)*(.12+vSeed*.14);
   color+=mix(far,near,detail);
   color+=vec3(.9,.5,.25)*.06*step(.96,fract(vWorld.y/36.0));
  }
  float distance=length(vWorld-cameraPosition);
  float fog=1.0-exp(-fogDensity*fogDensity*distance*distance);
  vec3 haze=mix(hazeLow,hazeHigh,smoothstep(-160.0,140.0,vWorld.y));
  gl_FragColor=vec4(mix(color,haze,fog),1.0);
 }`;
function buildingMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      hazeLow: { value: HAZE_LOW },
      hazeHigh: { value: HAZE_HIGH },
      fogDensity: { value: FOG_DENSITY },
    },
    vertexShader: buildingVertex,
    fragmentShader: buildingFragment,
  });
}
function skyDome() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(1800, 48, 24),
    new THREE.ShaderMaterial({
      uniforms: { hazeHigh: { value: HAZE_HIGH } },
      vertexShader: `varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform vec3 hazeHigh;varying vec3 vDirection;
       void main(){
        float h=normalize(vDirection).y;
        vec3 zenith=vec3(.018,.03,.07),dusk=vec3(.42,.24,.15),glow=vec3(.34,.17,.09);
        vec3 c=h>0.0?mix(dusk,zenith,pow(h,.42)):mix(dusk,glow,pow(-h,.5));
        c+=vec3(.3,.13,.05)*exp(-pow(h*10.0,2.0))*.6;
        gl_FragColor=vec4(mix(c,hazeHigh,exp(-pow(h*5.0,2.0))*.35),1.0);
       }`,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
}
// Top-cap UVs map world z to the canvas width and world x to its height, hence the turn.
function padTexture(label: string) {
  const size = 1024,
    canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!,
    rand = random(5127),
    centre = size / 2,
    edge = size / 2;
  ctx.fillStyle = "#353b40";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const tone = 44 + Math.floor(rand() * 24);
    ctx.fillStyle = `rgba(${tone},${tone + 4},${tone + 8},.55)`;
    ctx.fillRect(rand() * size, rand() * size, 6 + rand() * 40, 6 + rand() * 40);
  }
  ctx.translate(centre, centre);
  ctx.strokeStyle = "#11151880";
  ctx.lineWidth = 3;
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * edge * 0.2, Math.sin(angle) * edge * 0.2);
    ctx.lineTo(Math.cos(angle) * edge, Math.sin(angle) * edge);
    ctx.stroke();
  }
  [0.2, 0.42, 0.78].forEach((r) => {
    ctx.beginPath();
    ctx.arc(0, 0, edge * r, 0, Math.PI * 2);
    ctx.stroke();
  });
  for (let i = 0; i < 64; i++) {
    ctx.fillStyle = i % 2 ? "#d68a3c" : "#1b1f22";
    ctx.beginPath();
    ctx.arc(0, 0, edge * 0.97, (i / 64) * Math.PI * 2, ((i + 1) / 64) * Math.PI * 2);
    ctx.arc(0, 0, edge * 0.9, ((i + 1) / 64) * Math.PI * 2, (i / 64) * Math.PI * 2, true);
    ctx.fill();
  }
  ctx.strokeStyle = "#d8d2c0cc";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(0, 0, edge * 0.55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, edge * 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#d8d2c0b0";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 150px Arial, Helvetica, sans-serif";
  ctx.fillText("3-7", 0, edge * 0.7);
  ctx.font = "28px SFMono-Regular, Consolas, monospace";
  ctx.fillText(label, 0, edge * 0.82);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
export function createCoruscantZone(
  landing: Landing,
  notify: (event: PadEvent) => void,
): Zone {
  const group = new THREE.Group();
  const rand = random(3700);
  const glow = glowTexture();
  group.add(skyDome());
  group.add(new THREE.HemisphereLight(0x45578a, 0x9a5226, 1.1));
  const key = new THREE.DirectionalLight(0xffc49a, 1.6);
  key.position.set(-160, 110, 140);
  group.add(key);
  const padLight = new THREE.PointLight(0xffa25e, 40, 34, 2);
  padLight.position.set(0, 7, 0);
  group.add(padLight);

  // The city: thousands of towers falling away into haze below the platform.
  const towers: { x: number; z: number; w: number; d: number; top: number }[] = [];
  for (let gx = -620; gx <= 620; gx += 19)
    for (let gz = -620; gz <= 620; gz += 19) {
      const x = gx + (rand() - 0.5) * 9,
        z = gz + (rand() - 0.5) * 9,
        reach = Math.hypot(x, z);
      if (reach < 46 || reach > 640) continue;
      const megatower = reach > 220 && rand() < 0.008;
      towers.push({
        x,
        z,
        w: 7 + rand() * 10,
        d: 7 + rand() * 10,
        // Most rooftops sit below the platform, so the view opens onto the skyline.
        top: megatower ? 60 + rand() * 140 : -150 + Math.pow(rand(), 2.2) * 185,
      });
      if (rand() < 0.18)
        towers.push({
          x,
          z,
          w: 3 + rand() * 3,
          d: 3 + rand() * 3,
          top: towers[towers.length - 1].top + 12 + rand() * 30,
        });
    }
  // A few slender spires close enough to frame the platform.
  for (let i = 0; i < 8; i++) {
    const angle = rand() * Math.PI * 2,
      reach = 70 + rand() * 110;
    towers.push({
      x: Math.cos(angle) * reach,
      z: Math.sin(angle) * reach,
      w: 6 + rand() * 6,
      d: 6 + rand() * 6,
      top: 20 + rand() * 110,
    });
  }
  const base = -420;
  const city = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    buildingMaterial(),
    towers.length,
  );
  const dummy = new THREE.Object3D();
  towers.forEach((tower, i) => {
    dummy.position.set(tower.x, (tower.top + base) / 2, tower.z);
    dummy.scale.set(tower.w, tower.top - base, tower.d);
    dummy.updateMatrix();
    city.setMatrixAt(i, dummy.matrix);
  });
  city.frustumCulled = false;
  group.add(city);
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(12.5, 15, -base, 48, 1, true),
    buildingMaterial(),
  );
  plinth.position.y = base / 2 - 0.8;
  group.add(plinth);

  // Air traffic lanes: streams of head and tail lights crossing the skyline.
  const lanes = Array.from({ length: 26 }, () => {
    // Lanes keep their distance, so their lights read as far traffic rather than glare.
    const angle = rand() * Math.PI,
      offset = (rand() < 0.5 ? -1 : 1) * (90 + rand() * 260),
      direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const side = new THREE.Vector3(-direction.z, 0, direction.x);
    return {
      direction,
      origin: side.multiplyScalar(offset).setY(-70 + rand() * 120),
      length: 1400,
    };
  });
  const lights = lanes.flatMap((lane, index) =>
    Array.from({ length: 26 }, (_, i) => ({
      lane: index,
      track: i % 2 ? 1 : -1,
      offset: rand() * lane.length,
      speed: 26 + rand() * 22,
    })),
  );
  const trafficPositions = new Float32Array(lights.length * 3),
    trafficColors = new Float32Array(lights.length * 3);
  lights.forEach((light, i) => {
    const color = light.track > 0 ? [1, 0.86, 0.62] : [1, 0.3, 0.22];
    trafficColors.set(color, i * 3);
  });
  const trafficGeometry = new THREE.BufferGeometry();
  trafficGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(trafficPositions, 3),
  );
  trafficGeometry.setAttribute("color", new THREE.BufferAttribute(trafficColors, 3));
  const traffic = new THREE.Points(
    trafficGeometry,
    new THREE.PointsMaterial({
      map: glow,
      size: 2.6,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  traffic.frustumCulled = false;
  group.add(traffic);

  // The landing platform.
  const metal = new THREE.MeshStandardMaterial({
    color: 0x3a4045,
    roughness: 0.6,
    metalness: 0.55,
  });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(PAD_RADIUS, PAD_RADIUS + 0.5, 0.8, 96), [
    metal,
    new THREE.MeshStandardMaterial({
      map: padTexture(landing.pad),
      roughness: 0.72,
      metalness: 0.35,
    }),
    metal,
  ]);
  pad.position.y = -0.4;
  group.add(pad);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(PAD_RADIUS - 0.05, 0.05, 6, 160),
    new THREE.MeshBasicMaterial({ color: 0xffa354 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.02;
  group.add(rim);
  const rail = new THREE.Mesh(
    new THREE.TorusGeometry(PAD_RADIUS - 0.45, 0.045, 6, 160),
    metal,
  );
  rail.rotation.x = Math.PI / 2;
  rail.position.y = 1.05;
  group.add(rail);
  const posts = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1.05, 6),
    metal,
    48,
  );
  for (let i = 0; i < 48; i++) {
    const angle = (i / 48) * Math.PI * 2;
    dummy.position.set(
      Math.cos(angle) * (PAD_RADIUS - 0.45),
      0.52,
      Math.sin(angle) * (PAD_RADIUS - 0.45),
    );
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    posts.setMatrixAt(i, dummy.matrix);
  }
  group.add(posts);
  const beacons = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2;
    const beacon = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glow,
        color: 0xffb066,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    beacon.position.set(Math.cos(angle) * 8.9, 0.08, Math.sin(angle) * 8.9);
    beacon.scale.setScalar(0.55);
    group.add(beacon);
    return beacon;
  });
  // Floodlights flank the terminals rather than standing behind them.
  [1.25, 1.9, 4.45, 4.97].forEach((angle) => {
    const pole = new THREE.Group();
    pole.position.set(Math.cos(angle) * 14.6, 0, Math.sin(angle) * 14.6);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 10), metal);
    stem.position.y = 3;
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.4), metal);
    lamp.position.y = 6.1;
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glow,
        color: 0xffd7a8,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    halo.position.y = 5.95;
    halo.scale.setScalar(2.4);
    pole.add(stem, lamp, halo);
    pole.lookAt(0, 0, 0);
    group.add(pole);
  });

  // Cargo and fuel, kept off the walking ring between the terminals.
  const crateMaterial = new THREE.MeshStandardMaterial({
    color: 0x4c5446,
    roughness: 0.8,
    metalness: 0.2,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: 0xb4632f,
    roughness: 0.7,
    metalness: 0.25,
  });
  const circles: Spot[] = [];
  [
    [0, 13.3],
    [Math.PI, 13.3],
  ].forEach(([angle, reach], cluster) => {
    const x = Math.cos(angle) * reach,
      z = Math.sin(angle) * reach;
    for (let i = 0; i < 4; i++) {
      const size = 0.9 + rand() * 0.6;
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size),
        i % 3 === cluster ? accent : crateMaterial,
      );
      crate.position.set(
        x + (rand() - 0.5) * 2,
        size / 2 + (i === 3 ? 1.1 : 0),
        z + (rand() - 0.5) * 2,
      );
      crate.rotation.y = rand() * Math.PI;
      group.add(crate);
    }
    circles.push({ x, z, r: 2.2 });
  });

  const stations = createTerminals(landing, metal, circles);
  group.add(stations.group);
  const parking = parkShip(metal);
  group.add(parking.ship);
  const life = createPadLife({ glow, engines: parking.exhausts, notify });
  group.add(life.group);

  let chase = 0;
  return {
    group,
    fog: new THREE.FogExp2(HAZE_HIGH.clone().lerp(HAZE_LOW, 0.4), FOG_DENSITY),
    exposure: 1.15,
    walkRadius: PAD_RADIUS - 1.1,
    terminals: stations.terminals,
    ship: parking.ship,
    shipRest: parking.shipRest,
    colliders: { circles, footprint: parking.footprint, movers: life.movers },
    setViewport: life.setViewport,
    // Beside the ship's nose, turned so it sits left and a terminal glows on the right.
    spawn: { position: new THREE.Vector3(7, 0, 11.5), yaw: 0.25 },
    setThrust: (level: number) => {
      life.settle(level < 0.05);
      parking.setThrust(level);
    },
    tick: (
      dt: number,
      elapsed: number,
      reduced: boolean,
      walker: { x: number; z: number },
    ) => {
      life.tick(dt, elapsed, reduced, walker);
      const motion = reduced ? 0 : 1;
      lights.forEach((light, i) => {
        const lane = lanes[light.lane];
        light.offset = (light.offset + light.track * light.speed * dt * motion + lane.length) % lane.length;
        const along = light.offset - lane.length / 2;
        trafficPositions[i * 3] =
          lane.origin.x + lane.direction.x * along - lane.direction.z * light.track * 2.5;
        trafficPositions[i * 3 + 1] = lane.origin.y;
        trafficPositions[i * 3 + 2] =
          lane.origin.z + lane.direction.z * along + lane.direction.x * light.track * 2.5;
      });
      trafficGeometry.getAttribute("position").needsUpdate = true;
      // Landing lights chase around the circle.
      chase += dt * motion * 9;
      beacons.forEach((beacon, i) => {
        const wave = (((chase - i) % 24) + 24) % 24;
        beacon.material.opacity = 0.35 + 0.65 * Math.max(0, 1 - wave / 4);
      });
      stations.tick(elapsed, reduced);
    },
  };
}
