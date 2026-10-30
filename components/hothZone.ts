import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createPadLife, type PadEvent } from "./coruscantLife";
import { createHothBattle, createSnowspeeder } from "./hothBattle";
import { createBriefingTable } from "./hothBriefing";
import { createTerminals, glowTexture, parkShip, random, type Spot, type Zone } from "./landingKit";
import { createShipModel } from "./shipModel";
import { createHothGlacier } from "./hothGlacier";
import { createHothTauntauns } from "./hothTauntauns";
import type { Landing } from "./universe";

// Echo Base's main hangar: a vaulted glacier cavern, open at +z onto
// the plain. The ship enters and leaves through the carved mouth in the great ice wall.
const SIDE = 24,
  BACK = -26,
  MOUTH = 34,
  ROOF = 22;
const SKY = new THREE.Color(0xd3dde6);

const smooth = (value: number, from: number, to: number) => {
  const t = THREE.MathUtils.clamp((value - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
};
// Flat in the canyon, a glacier plateau around it that drops away at the mouth, then a rolling
// plain rising into far mountains.
export function hothHeight(x: number, z: number) {
  const ridge = ROOF - 1 + Math.sin(x * 0.07) * 1.5 + Math.sin(z * 0.05 + x * 0.03) * 2 + Math.sin(x * 0.23 + z * 0.17) * 0.6;
  const jitter = Math.sin(z * 0.41 + x * 0.2) * 0.8 + Math.sin(z * 1.3 + x) * 0.3 + Math.sin(x * 0.37 + z * 0.1) * 0.6;
  const outside = Math.max(Math.abs(x) - SIDE, BACK - z) + jitter;
  const cliff = ridge * smooth(outside, -0.5, 2.5) * (1 - smooth(z, MOUTH - 4, MOUTH + 18));
  const plain =
    (Math.sin(x * 0.013 + z * 0.007) * 3 + Math.sin(x * 0.031 - z * 0.019) * 1.2 + 4.2) * smooth(z, MOUTH + 8, 160) +
    smooth(Math.hypot(x, z), 520, 1100) * (60 + Math.sin(x * 0.006) * 30 + Math.sin(x * 0.017 + z * 0.004) * 14);
  return Math.max(cliff, plain);
}

// A grid dense around the base and stretching out geometrically towards the horizon.
function axis(near: number, step: number, far: number) {
  const values: number[] = [];
  for (let v = -near; v <= near + 1e-6; v += step) values.push(v);
  let reach = near,
    grow = step;
  while (reach < far) {
    grow *= 1.12;
    reach += grow;
    values.push(reach);
    values.unshift(-reach);
  }
  return values;
}
function terrain(material: THREE.Material) {
  const xs = axis(120, 1.5, 1300),
    zs = axis(120, 1.5, 1300).map((z) => z + 10);
  const positions: number[] = [],
    uvs: number[] = [],
    index: number[] = [];
  zs.forEach((z) =>
    xs.forEach((x) => {
      positions.push(x, hothHeight(x, z), z);
      uvs.push(x / 9, z / 9);
    }),
  );
  for (let j = 0; j < zs.length - 1; j++)
    for (let i = 0; i < xs.length - 1; i++) {
      const a = j * xs.length + i,
        b = a + 1,
        c = a + xs.length,
        d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  // Snow on the flats, blue ice on the cliffs, grey rock on the far peaks.
  const normals = geometry.getAttribute("normal"),
    colors: number[] = [];
  const snow = new THREE.Color(0xf2f6fa),
    ice = new THREE.Color(0x8fb6d0),
    rock = new THREE.Color(0x6d7884),
    tint = new THREE.Color();
  for (let i = 0; i < normals.count; i++) {
    const up = normals.getY(i),
      height = positions[i * 3 + 1];
    tint.copy(snow).lerp(ice, smooth(0.85, 0.35, up));
    if (height > 45) tint.lerp(rock, smooth(0.7, 0.45, up) * 0.7);
    colors.push(tint.r, tint.g, tint.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Mesh(geometry, material);
}

function canvasTexture(size: number, paint: (c: CanvasRenderingContext2D) => void, repeat = true) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  paint(canvas.getContext("2d")!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}
function snowTexture() {
  const rand = random(5);
  return canvasTexture(256, (c) => {
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      c.fillStyle = rand() < 0.5 ? "rgba(150,175,200,.18)" : "rgba(255,255,255,.5)";
      c.fillRect(rand() * 256, rand() * 256, 1 + rand() * 2, 1 + rand() * 2);
    }
    c.strokeStyle = "rgba(140,165,190,.1)";
    for (let y = 0; y < 256; y += 11) {
      c.beginPath();
      for (let x = 0; x <= 256; x += 8) c.lineTo(x, y + Math.sin(x * 0.04 + y) * 3);
      c.stroke();
    }
  });
}

function vaultHeight(x:number,z:number) {
  const angle=Math.acos(THREE.MathUtils.clamp(x/(SIDE+1.2),-1,1));
  return ROOF-3+16*Math.pow(Math.sin(angle),.85)
    +Math.sin(z*.21+angle*3)*.65+Math.sin(z*.62-angle*7)*.22;
}
function iceVault() {
  const across=72,along=46,positions:number[]=[],colors:number[]=[],indices:number[]=[];
  const pale=new THREE.Color(0xbad2e2),blue=new THREE.Color(0x81a8c2),color=new THREE.Color();
  for(let j=0;j<=along;j++)for(let i=0;i<=across;i++){
    const angle=i/across*Math.PI,z=THREE.MathUtils.lerp(BACK-1,MOUTH+1.5,j/along);
    const x=Math.cos(angle)*(SIDE+1.2),y=vaultHeight(x,z);
    positions.push(x,y,z);
    color.copy(pale).lerp(blue,.16+.12*Math.sin(angle*6+z*.14));
    colors.push(color.r,color.g,color.b);
  }
  for(let j=0;j<along;j++)for(let i=0;i<across;i++){
    const a=j*(across+1)+i,b=a+1,c=a+across+1,d=c+1;
    indices.push(a,c,b,b,c,d);
  }
  // A thick, uneven lip makes the mouth read as carved glacier, not a thin roof panel.
  const rimStart=positions.length/3;
  for(let i=0;i<=across;i++)for(const edge of[0,1]){
    const x=Math.cos(i/across*Math.PI)*(SIDE+1.2),z=MOUTH+1.5;
    positions.push(x*(edge?1.035:1),vaultHeight(x,z)+(edge?2.2+Math.sin(i*.41)*.35:0),z+edge*.65);
    colors.push(pale.r,pale.g,pale.b);
  }
  for(let i=0;i<across;i++){const a=rimStart+i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.72,metalness:0,side:THREE.DoubleSide}));
  mesh.name="hoth-ice-vault";return mesh;
}
// Packed snow over the pad, with worn markings and the hangar number.
function floorMarkings(label: string) {
  return canvasTexture(
    1024,
    (c) => {
      c.translate(512, 512);
      c.strokeStyle = "rgba(230,150,60,.75)";
      c.lineWidth = 14;
      c.setLineDash([60, 30]);
      c.beginPath();
      c.arc(0, 0, 440, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      c.strokeStyle = "rgba(60,80,100,.45)";
      c.lineWidth = 5;
      c.beginPath();
      c.arc(0, 0, 400, 0, Math.PI * 2);
      c.stroke();
      c.rotate(Math.PI);
      c.fillStyle = "rgba(60,80,100,.4)";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = "bold 160px Arial, Helvetica, sans-serif";
      c.fillText("1", 0, -300);
      c.font = "26px SFMono-Regular, Consolas, monospace";
      c.fillText(label, 0, -200);
    },
    false,
  );
}
function skyDome() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(1900, 32, 16),
    new THREE.ShaderMaterial({
      vertexShader: `varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `varying vec3 vDirection;
       void main(){
        vec3 n=normalize(vDirection);float h=n.y;
        vec3 zenith=vec3(.56,.63,.71),horizon=vec3(.84,.88,.92);
        vec3 c=h>0.0?mix(horizon,zenith,pow(h,.7)):horizon;
        gl_FragColor=vec4(c,1.0);
       }`,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
}

// Falling snow around the visitor, driven entirely on the GPU and thinner under the roof.
function snowfall(count: number) {
  const rand = random(11);
  const geometry = new THREE.BufferGeometry();
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) seeds[i] = rand();
  geometry.setAttribute("position", new THREE.BufferAttribute(seeds, 3));
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, origin: { value: new THREE.Vector3() }, scale: { value: 1 } },
    vertexShader: `uniform float time;uniform vec3 origin;uniform float scale;varying float vAlpha;
      const vec3 box=vec3(60.0,34.0,60.0);
      void main(){
        vec3 drift=vec3(2.6,-2.2,-3.4)*time+vec3(sin(time*.7+position.y*40.0),0.0,cos(time*.5+position.x*30.0))*1.2;
        vec3 p=mod(position*box+drift-origin+box*.5,box)-box*.5+origin;
        p.y+=10.0;
        // Windblown snow thins underneath the natural ice vault.
        float ceiling=${ROOF-3}.0+16.0*pow(sqrt(max(0.0,1.0-p.x*p.x/${(SIDE+1.2)**2})),.85);
        float covered=step(abs(p.x),${SIDE - 1}.0)*step(p.z,${MOUTH - 4}.0)*step(${BACK}.0,p.z)*step(p.y,ceiling);
        vAlpha=mix(.85,.12,covered);
        vec4 view=modelViewMatrix*vec4(p,1.0);
        gl_Position=projectionMatrix*view;
        gl_PointSize=min(18.0,scale*(2.0+fract(position.z*91.0)*2.5)*(26.0/-view.z));
      }`,
    fragmentShader: `varying float vAlpha;void main(){vec2 c=gl_PointCoord-.5;float d=dot(c,c);if(d>.25)discard;gl_FragColor=vec4(1.0,1.0,1.0,vAlpha*(1.0-d*4.0));}`,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, material };
}

export function createHothZone(landing: Landing, notify: (event: PadEvent) => void): Zone {
  const group = new THREE.Group();
  const rand = random(1980);
  const glow = glowTexture();
  group.add(skyDome());
  const ambient = new THREE.HemisphereLight(0xe6eef6, 0x8ea3b5, 1.55);
  const daylight = new THREE.DirectionalLight(0xf2f6ff, 1.35);
  daylight.position.set(30, 70, 90);
  const lamps = new THREE.DirectionalLight(0xffe2b8, 0.45);
  lamps.position.set(-10, 60, -10);
  group.add(ambient, daylight, lamps);

  const grain = snowTexture();
  const snow = new THREE.MeshStandardMaterial({ map: grain, vertexColors: true, roughness: 0.88 });
  group.add(terrain(snow));
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(15.5, 64),
    new THREE.MeshStandardMaterial({ map: floorMarkings(landing.pad), transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.02, 2);
  group.add(floor);

  // Static structure is baked into one mesh per material.
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const dummy = new THREE.Object3D();
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, at: [number, number, number], rotation: [number, number, number] = [0, 0, 0]) => {
    dummy.position.set(...at);
    dummy.rotation.set(...rotation);
    dummy.updateMatrix();
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.deleteAttribute("uv");
    g.applyMatrix4(dummy.matrix);
    const list = batches.get(material) ?? [];
    list.push(g);
    batches.set(material, list);
  };
  const steel = new THREE.MeshStandardMaterial({ color: 0x5d646b, roughness: 0.5, metalness: 0.7 });
  const panel = new THREE.MeshStandardMaterial({ color: 0x8a9298, roughness: 0.6, metalness: 0.45 });
  const hazard = new THREE.MeshStandardMaterial({ color: 0xd09a2c, roughness: 0.6 });
  const darkness = new THREE.MeshStandardMaterial({ color: 0x14191d, roughness: 0.9 });
  const lampGlass = new THREE.MeshStandardMaterial({ color: 0xfff4dc, emissive: 0xffe9c4, emissiveIntensity: 2.2 });
  const ice = new THREE.MeshStandardMaterial({ color: 0xc4dbea, roughness: 0.28, metalness: 0.05, emissive: 0x16344a, emissiveIntensity: 0.25 });

  // Ice shelves overhang both walls, dripping with icicles.
  for (const side of [-1, 1]) {
    const shelf = new THREE.BoxGeometry(9, 3.2, MOUTH - BACK - 6, 9, 3, 40);
    const p = shelf.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      p.setXYZ(i, x + Math.sin(z * 0.6 + y) * 0.35, y + Math.sin(z * 0.37 + x * 1.3) * 0.5 - (x * side < -3 ? 0.5 : 0), z);
    }
    shelf.computeVertexNormals();
    add(shelf, ice, [side * (SIDE - 3.5), ROOF - 4.2, (MOUTH + BACK) / 2 + 1]);
    for (let n = 0; n < 34; n++) {
      const length = 0.8 + rand() * 2.6;
      add(new THREE.ConeGeometry(0.12 + rand() * 0.25, length, 6), ice, [side * (SIDE - 7.6 - rand() * 1.4), ROOF - 5.8 - length / 2, BACK + 4 + rand() * (MOUTH - BACK - 10)], [Math.PI, 0, 0]);
    }
  }
  group.add(iceVault());
  const glacier=createHothGlacier({side:SIDE,back:BACK,mouth:MOUTH,vaultHeight});
  group.add(glacier.group);
  for(let i=0;i<64;i++){
    const x=(rand()<.5?-1:1)*(7+rand()*16),z=BACK+3+rand()*(MOUTH-BACK-3),length=.4+rand()*1.8;
    add(new THREE.ConeGeometry(.08+rand()*.18,length,7),ice,[x,vaultHeight(x,z)-length/2,z],[Math.PI,rand()*Math.PI,(rand()-.5)*.14]);
  }
  // Small side-mounted work lamps leave the ceiling clear and the central volume open.
  for(const side of[-1,1])for(const z of[-12,22]){
    const x=side*(SIDE-3.1);
    add(new THREE.BoxGeometry(.22,3.4,.22),steel,[x,1.7,z]);
    add(new THREE.BoxGeometry(.9,.2,.55),steel,[x-side*.3,3.5,z]);
    add(new THREE.BoxGeometry(.65,.05,.36),lampGlass,[x-side*.3,3.38,z]);
    const light=new THREE.PointLight(0xffd5a2,16,10,2);light.position.set(x-side*.45,3.3,z);group.add(light);
  }
  // Blast doors built into the walls, and a lit command gallery across the back.
  const doors: [number, number, number][] = [
    [-SIDE + 1.2, -12, Math.PI / 2],
    [-SIDE + 1.2, 14, Math.PI / 2],
    [SIDE - 1.2, -4, -Math.PI / 2],
    [SIDE - 1.2, 20, -Math.PI / 2],
    [0, BACK + 2.6, 0],
  ];
  doors.forEach(([x, z, turn]) => {
    const wide = turn ? 6 : 9;
    const frame = new THREE.Group();
    frame.position.set(x, 0, z);
    frame.rotation.y = turn;
    frame.updateMatrixWorld();
    const place = (geometry: THREE.BufferGeometry, material: THREE.Material, local: [number, number, number]) => {
      const p = new THREE.Vector3(...local).applyMatrix4(frame.matrixWorld);
      add(geometry, material, [p.x, p.y, p.z], [0, turn, 0]);
    };
    place(new THREE.BoxGeometry(wide + 2, 7, 2.4), panel, [0, 3.5, -0.6]);
    place(new THREE.BoxGeometry(wide, 5, 0.3), darkness, [0, 2.5, 0.65]);
    place(new THREE.BoxGeometry(wide / 2 - 0.1, 5, 0.25), panel, [-wide / 4 - 0.6, 2.5, 0.75]);
    for (let s = 0; s < 6; s++) place(new THREE.BoxGeometry(wide / 6 - 0.15, 0.3, 0.1), s % 2 ? darkness : hazard, [-wide / 2 + (s + 0.5) * (wide / 6), 5.3, 0.82]);
    place(new THREE.BoxGeometry(wide - 0.6, 0.12, 0.1), lampGlass, [0, 6.1, 0.82]);
  });
  add(new THREE.BoxGeometry(22, 2.2, 1.6), panel, [0, 9.5, BACK + 0.2]);
  add(new THREE.BoxGeometry(20, 1.2, 0.2), lampGlass, [0, 9.6, BACK + 1.05]);

  // Hangar clutter: fuel tanks, crates, cables and power units along the walls.
  const circles: Spot[] = [];
  const crate = new THREE.MeshStandardMaterial({ color: 0x6f7880, roughness: 0.75, metalness: 0.3 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xb6542e, roughness: 0.7 });
  (
    [
      [-19, -18],
      [19.5, 6],
      [-19.5, 4],
      [-12, -21.5],
      [19, 28],
    ] as const
  ).forEach(([x, z], cluster) => {
    for (let i = 0; i < 4; i++) {
      const size = 0.9 + rand() * 0.7;
      add(new THREE.BoxGeometry(size, size, size), i % 3 === cluster % 2 ? orange : crate, [x + (rand() - 0.5) * 2.4, size / 2 + (i === 3 ? 1.1 : 0), z + (rand() - 0.5) * 2.4], [0, rand() * Math.PI, 0]);
    }
    add(new THREE.CylinderGeometry(0.7, 0.7, 2.2, 16), steel, [x + 1.6, 1.1, z - 1.8]);
    circles.push({ x, z, r: 2.4 });
  });
  for (const [x, z] of [
    [-6, -16],
    [6, -16],
  ]) {
    add(new THREE.BoxGeometry(1.6, 1.3, 1), panel, [x, 0.65, z]);
    add(new THREE.BoxGeometry(1.2, 0.2, 0.05), lampGlass, [x, 1.1, z + 0.52]);
    circles.push({ x, z, r: 1.1 });
  }
  batches.forEach((list, material) => {
    const geometry = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (geometry) group.add(new THREE.Mesh(geometry, material));
  });

  // A second X-wing in for repairs at the back, and a snowspeeder by the mouth.
  const spare = createShipModel();
  spare.rotation.set(-Math.PI / 2, 0, 0);
  spare.scale.setScalar(3.4);
  const hangar = new THREE.Group();
  hangar.add(spare);
  spare.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(spare);
  spare.position.y = 1.15 - bounds.min.y;
  for (const [x, z] of [
    [0, bounds.min.z + 1.6],
    [-1.3, bounds.max.z - 1.6],
    [1.3, bounds.max.z - 1.6],
  ]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.2, 8), steel);
    strut.position.set(x, 0.6, z);
    hangar.add(strut);
  }
  hangar.position.set(14.5, 0, -15);
  hangar.rotation.y = Math.PI * 0.8;
  group.add(hangar);
  circles.push({ x: 14.5, z: -15, r: 5.6 });
  const parked = createSnowspeeder();
  parked.position.set(-15.5, 0, 22);
  parked.rotation.y = 0.7;
  group.add(parked);
  circles.push({ x: -15.5, z: 22, r: 2.6 });

  const tauntauns = createHothTauntauns(circles);
  group.add(tauntauns.group);

  const metal = steel;
  const stations = createTerminals(landing, metal, circles);
  group.add(stations.group);
  const table = createBriefingTable(landing, { x: 0, z: 18, facing: Math.PI });
  group.add(table.group);
  circles.push(...table.colliders);
  const parking = parkShip(metal);
  group.add(parking.ship);
  const life = createPadLife({ glow, engines: parking.exhausts, notify, guard: false, drone: false, taxi: false, ground: "snow", steam: 0xeef3f7 });
  group.add(life.group);

  const battle = createHothBattle(hothHeight);
  group.add(battle.group);
  // Storm: falling snow, gusts of spindrift across the mouth and a fog that breathes.
  const flakes = snowfall(4200);
  group.add(flakes.points);
  const gusts = Array.from({ length: 14 }, (_, i) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xf4f8fb, transparent: true, opacity: 0, depthWrite: false }));
    group.add(sprite);
    return { sprite, age: i * 0.6, life: 6, x: 0, z: 0, size: 6 };
  });
  const fog = new THREE.FogExp2(SKY, 0.0017);
  let clock = 0;
  return {
    group,
    fog,
    exposure: 0.95,
    walkRadius: 50,
    // The wide view reveals the wall's scale before following the craft through its opening.
    arrival: { from: new THREE.Vector3(110,65,440), to: new THREE.Vector3(11,7,65), shipFrom:new THREE.Vector3(0,12,160),shipYaw:0,reveal:2.1 },
    constrainWalk: (walker) => {
      walker.x = THREE.MathUtils.clamp(walker.x, -SIDE + 3.5, SIDE - 3.5);
      walker.z = THREE.MathUtils.clamp(walker.z, BACK + 4, MOUTH + 12);
    },
    terminals: stations.terminals,
    ship: parking.ship,
    shipRest: parking.shipRest,
    colliders: { circles, footprint: parking.footprint, movers: life.movers },
    setViewport: (height) => {
      life.setViewport(height);
      flakes.material.uniforms.scale.value = height / 900;
    },
    // Beside the ship's nose, looking past the briefing table to the mouth and the battle.
    spawn: { position: new THREE.Vector3(4.5, 0, 10), yaw: Math.atan2(6.5, -30) },
    setThrust: (level) => {
      life.settle(level < 0.05);
      parking.setThrust(level);
    },
    tick: (dt, elapsed, reduced, walker) => {
      life.tick(dt, elapsed, reduced, walker);
      stations.tick(elapsed, reduced);
      table.tick(elapsed, reduced, stations.terminals);
      battle.tick(dt, reduced);
      tauntauns.tick(dt, reduced);
      const daylightMix=smooth(walker.z,16,46),blend=1-Math.exp(-dt*3);
      ambient.intensity+=((1.05+daylightMix*.5)-ambient.intensity)*blend;
      if (!reduced) clock += dt;
      flakes.points.visible = !reduced;
      flakes.material.uniforms.time.value = clock;
      flakes.material.uniforms.origin.value.set(walker.x, 0, walker.z);
      fog.density = 0.0017 * (1 + (reduced ? 0 : Math.sin(clock * 0.21) * 0.12 + Math.sin(clock * 0.53) * 0.06));
      gusts.forEach((gust) => {
        if (reduced) {
          gust.sprite.visible = false;
          return;
        }
        gust.age += dt;
        if (gust.age > gust.life) {
          gust.age = 0;
          gust.life = 4 + Math.random() * 4;
          gust.x = -40 + Math.random() * 20;
          gust.z = MOUTH - 6 + Math.random() * 40;
          gust.size = 5 + Math.random() * 7;
        }
        const t = gust.age / gust.life;
        gust.sprite.visible = true;
        gust.sprite.position.set(gust.x + gust.age * 9, 1 + t * 2, gust.z - gust.age * 2);
        gust.sprite.scale.set(gust.size * (1 + t), gust.size * 0.45 * (1 + t), 1);
        gust.sprite.material.opacity = Math.sin(t * Math.PI) * 0.22;
      });
    },
  };
}
