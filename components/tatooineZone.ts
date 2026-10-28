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
import { createSurfaceNavigator } from "./surfaceNavigation";
import { createTatooineDistrict, districtCoordinates, TATOOINE_GATE } from "./tatooineDistrict";

const BAY_RADIUS = 16.6,
  WALL_RADIUS = 17,
  WALL_HEIGHT = 3.2,
  // The gate opens where the arrival view is clear of the ship: its centre and half-width,
  // as angles around the bay (cylinder convention, 0 towards +Z).
  GATE_AT = TATOOINE_GATE,
  GATE = 0.32;
const SPAWN = new THREE.Vector3(7, 0, 11.5);
// Twin suns setting through the gate as seen from the arrival spot, the larger one higher.
const SUN = new THREE.Vector3(0.02, 0.139, -0.99).normalize(),
  SECOND = new THREE.Vector3(0.16, 0.105, -0.987).normalize();
const HAZE = new THREE.Color(0.85, 0.66, 0.46);

const smooth = (value: number, from: number, to: number) => {
  const t = THREE.MathUtils.clamp((value - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
};
// Flat where people built, dunes rolling away beyond the town, rising towards the horizon.
function groundHeight(x: number, z: number) {
  const reach = Math.hypot(x, z);
  const dunes =
    Math.sin(x * 0.011 + z * 0.004) * 9 +
    Math.sin(x * 0.0042 - z * 0.012 + 1.3) * 15 +
    Math.sin(x * 0.023 + z * 0.017 + 4) * 3;
  return (dunes * 0.7 + 14) * smooth(reach, 80, 220) + smooth(reach, 300, 1100) * 45 - 0.06;
}
function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number] = [0, 0, 0],
) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  return item;
}
function canvasTexture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext("2d")!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}
// Sun-baked plaster: soft blotches, hairline cracks and grime gathering at the foot.
function plaster(seed: number) {
  const rand = random(seed);
  return canvasTexture(512, 256, (ctx) => {
    ctx.fillStyle = "#dcbc93";
    ctx.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 160; i++) {
      const x = rand() * 512,
        y = rand() * 256,
        r = 10 + rand() * 50;
      const blotch = ctx.createRadialGradient(x, y, 0, x, y, r);
      const tone = rand() < 0.5 ? "120,88,56" : "245,226,196";
      blotch.addColorStop(0, `rgba(${tone},${0.05 + rand() * 0.08})`);
      blotch.addColorStop(1, `rgba(${tone},0)`);
      ctx.fillStyle = blotch;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.strokeStyle = "rgba(90,62,40,.35)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      let x = rand() * 512,
        y = rand() * 256;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let step = 0; step < 6; step++) ctx.lineTo((x += (rand() - 0.5) * 30), (y += rand() * 14));
      ctx.stroke();
    }
    const grime = ctx.createLinearGradient(0, 180, 0, 256);
    grime.addColorStop(0, "rgba(110,76,46,0)");
    grime.addColorStop(1, "rgba(110,76,46,.35)");
    ctx.fillStyle = grime;
    ctx.fillRect(0, 180, 512, 76);
  });
}
function sand() {
  const rand = random(77);
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = "#d7a76c";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) {
      ctx.fillStyle = rand() < 0.5 ? "rgba(160,112,64,.28)" : "rgba(246,214,166,.3)";
      ctx.fillRect(rand() * 256, rand() * 256, 1 + rand(), 1 + rand());
    }
    ctx.strokeStyle = "rgba(150,104,60,.12)";
    for (let y = 0; y < 256; y += 9) {
      ctx.beginPath();
      for (let x = 0; x <= 256; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.05 + y) * 2.5);
      ctx.stroke();
    }
  });
}
// Packed sand, oil stains and a faded bay number. Top-cap UVs run sideways, hence the turn.
function bayFloor(label: string) {
  const rand = random(94);
  const texture = canvasTexture(1024, 1024, (ctx) => {
    ctx.fillStyle = "#b98c5a";
    ctx.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 600; i++) {
      const x = rand() * 1024,
        y = rand() * 1024,
        r = 8 + rand() * 60;
      const patch = ctx.createRadialGradient(x, y, 0, x, y, r);
      const tone = rand() < 0.5 ? "150,108,66" : "210,168,116";
      patch.addColorStop(0, `rgba(${tone},${0.08 + rand() * 0.08})`);
      patch.addColorStop(1, `rgba(${tone},0)`);
      ctx.fillStyle = patch;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 16; i++) {
      const x = 320 + rand() * 384,
        y = 320 + rand() * 384,
        r = 20 + rand() * 70;
      const stain = ctx.createRadialGradient(x, y, 0, x, y, r);
      stain.addColorStop(0, "rgba(58,40,26,.3)");
      stain.addColorStop(1, "rgba(58,40,26,0)");
      ctx.fillStyle = stain;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.translate(512, 512);
    ctx.strokeStyle = "rgba(236,214,174,.32)";
    ctx.lineWidth = 14;
    ctx.setLineDash([46, 22]);
    ctx.beginPath();
    ctx.arc(0, 0, 282, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 258, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "rgba(238,220,186,.34)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 190px Arial, Helvetica, sans-serif";
    ctx.fillText("94", 0, 370);
    ctx.font = "28px SFMono-Regular, Consolas, monospace";
    ctx.fillText(label, 0, 462);
  });
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}
function skyDome() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(1800, 48, 24),
    new THREE.ShaderMaterial({
      uniforms: { sunA: { value: SUN }, sunB: { value: SECOND } },
      vertexShader: `varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform vec3 sunA;uniform vec3 sunB;varying vec3 vDirection;
       void main(){
        vec3 n=normalize(vDirection);float h=n.y;
        vec3 zenith=vec3(.36,.52,.68),horizon=vec3(.95,.78,.56),below=vec3(.86,.66,.46);
        vec3 c=h>0.0?mix(horizon,zenith,pow(h,.55)):mix(horizon,below,pow(-h,.5));
        float a=max(dot(n,sunA),0.0),b=max(dot(n,sunB),0.0);
        c+=vec3(1.0,.86,.62)*(pow(a,24.0)*.22+pow(a,600.0)*.25);
        c+=vec3(1.0,.62,.36)*(pow(b,30.0)*.16+pow(b,800.0)*.2);
        gl_FragColor=vec4(c,1.0);
       }`,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
}

// A sun with a crisp disc and a short corona, so the two suns read apart.
function sunTexture() {
  return canvasTexture(128, 128, (ctx) => {
    const disc = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    disc.addColorStop(0, "rgba(255,255,255,1)");
    disc.addColorStop(0.24, "rgba(255,255,255,1)");
    disc.addColorStop(0.3, "rgba(255,255,255,.4)");
    disc.addColorStop(0.55, "rgba(255,255,255,.08)");
    disc.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = disc;
    ctx.fillRect(0, 0, 128, 128);
  });
}

export function createTatooineZone(landing: Landing, notify: (event: PadEvent) => void): Zone {
  const group = new THREE.Group();
  const rand = random(1977);
  const glow = glowTexture(),
    sunlight = sunTexture();
  group.add(skyDome());
  (
    [
      [SUN, 0xfff4dc, 110],
      [SECOND, 0xffb878, 75],
    ] as const
  ).forEach(([direction, color, size]) => {
    const disc = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunlight,
        color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    disc.position.copy(direction).multiplyScalar(1500);
    disc.scale.setScalar(size);
    group.add(disc);
  });
  const ambient=new THREE.HemisphereLight(0xb4c8dc,0xc8925a,1.35);
  group.add(ambient);
  const sun = new THREE.DirectionalLight(0xffdcae, 2.6);
  sun.position.copy(SUN).multiplyScalar(300);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-100,right:100,top:100,bottom:-100,near:1,far:550});
  sun.shadow.bias=-.0002;sun.shadow.normalBias=.045;
  const second = new THREE.DirectionalLight(0xff9a5c, 0.9);
  second.position.copy(SECOND).multiplyScalar(300);
  group.add(sun, second);

  // The desert floor.
  const dunes = new THREE.PlaneGeometry(2400, 2400, 240, 240).rotateX(-Math.PI / 2);
  const position = dunes.getAttribute("position");
  for (let i = 0; i < position.count; i++)
    position.setY(i, groundHeight(position.getX(i), position.getZ(i)));
  dunes.computeVertexNormals();
  const grain = sand();
  grain.repeat.set(140, 140);
  group.add(new THREE.Mesh(dunes, new THREE.MeshStandardMaterial({ map: grain, roughness: 0.96 })));

  // The docking bay: a ring of adobe with one wide gate towards the suns.
  const metal = new THREE.MeshStandardMaterial({ color: 0x77726a, roughness: 0.55, metalness: 0.6 });
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(BAY_RADIUS, BAY_RADIUS, 0.1, 96), [
    metal,
    new THREE.MeshStandardMaterial({ map: bayFloor(landing.pad), roughness: 0.92 }),
    metal,
  ]);
  floor.position.y = -0.05;
  group.add(floor);
  const wallSkin = plaster(17);
  wallSkin.repeat.set(10, 1);
  const wall = new THREE.MeshStandardMaterial({ map: wallSkin, roughness: 0.95, side: THREE.DoubleSide });
  const arcStart = GATE_AT + GATE,
    arcLength = Math.PI * 2 - GATE * 2;
  const inner = mesh(
    new THREE.CylinderGeometry(WALL_RADIUS, WALL_RADIUS, WALL_HEIGHT, 120, 1, true, arcStart, arcLength),
    wall,
    [0, WALL_HEIGHT / 2, 0],
  );
  const outer = mesh(
    new THREE.CylinderGeometry(
      WALL_RADIUS + 1,
      WALL_RADIUS + 1.5,
      WALL_HEIGHT + 0.2,
      120,
      1,
      true,
      arcStart,
      arcLength,
    ),
    wall,
    [0, (WALL_HEIGHT + 0.2) / 2, 0],
  );
  // A rounded crown along the top; torus angles start a quarter turn before cylinder ones.
  const crown = mesh(
    new THREE.TorusGeometry(WALL_RADIUS + 0.5, 0.55, 8, 120, arcLength)
      .rotateX(-Math.PI / 2)
      .rotateY(arcStart - Math.PI / 2),
    wall,
    [0, WALL_HEIGHT, 0],
  );
  group.add(inner, outer, crown);
  [GATE_AT - GATE, GATE_AT + GATE].forEach((angle) => {
    const x = Math.sin(angle) * (WALL_RADIUS + 0.5),
      z = Math.cos(angle) * (WALL_RADIUS + 0.5);
    group.add(
      mesh(new THREE.CylinderGeometry(0.8, 0.95, 3.8, 16), wall, [x, 1.9, z]),
      mesh(new THREE.SphereGeometry(0.8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), wall, [x, 3.8, z]),
    );
  });
  // Doorways, pipes and lamps along the inside of the wall.
  const shade = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 });
  [0.9, 1.9, 3.9, 5.3].forEach((angle) => {
    const door = mesh(new THREE.BoxGeometry(1.3, 2.2, 0.12), shade, [
      Math.sin(angle) * (WALL_RADIUS - 0.05),
      1.1,
      Math.cos(angle) * (WALL_RADIUS - 0.05),
    ]);
    door.lookAt(0, 1.1, 0);
    group.add(door);
  });
  [2.35, 2.55].forEach((y) =>
    group.add(
      mesh(
        new THREE.TorusGeometry(WALL_RADIUS - 0.15, 0.06, 6, 120, arcLength)
          .rotateX(-Math.PI / 2)
          .rotateY(arcStart - Math.PI / 2),
        metal,
        [0, y, 0],
      ),
    ),
  );
  [0.45, 1.3, GATE_AT - 0.4, GATE_AT + 0.4, 3.9, 4.9, 5.85].forEach((angle) => {
    const at: [number, number, number] = [
      Math.sin(angle) * (WALL_RADIUS - 0.25),
      2.8,
      Math.cos(angle) * (WALL_RADIUS - 0.25),
    ];
    const lamp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glow,
        color: 0xffc98a,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    lamp.position.set(...at);
    lamp.scale.setScalar(0.9);
    group.add(mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), metal, at), lamp);
  });
  const circles: Spot[] = [];
  for (const angle of [GATE_AT-GATE,GATE_AT+GATE]) circles.push({x:Math.sin(angle)*17.5,z:Math.cos(angle)*17.5,r:.95});
  const generator = mesh(new THREE.BoxGeometry(1.4, 1.2, 0.9), metal, [
    Math.sin(4.55) * 15.6,
    0.6,
    Math.cos(4.55) * 15.6,
  ]);
  generator.lookAt(0, 0.6, 0);
  group.add(generator);
  circles.push({ x: generator.position.x, z: generator.position.z, r: 0.9 });

  // Mos Eisley around the bay: domed huts, blocks and towers, leaving the views open.
  const townSkin = plaster(29);
  const adobe = new THREE.MeshStandardMaterial({ map: townSkin, roughness: 0.95 });
  const pieces: Record<"dome" | "drum" | "block" | "door", THREE.Matrix4[]> = {
    dome: [],
    drum: [],
    block: [],
    door: [],
  };
  const dummy = new THREE.Object3D();
  const place = (
    kind: keyof typeof pieces,
    at: [number, number, number],
    scale: [number, number, number],
    yaw = 0,
  ) => {
    dummy.position.set(...at);
    dummy.scale.set(...scale);
    dummy.rotation.set(0, yaw, 0);
    dummy.updateMatrix();
    pieces[kind].push(dummy.matrix.clone());
  };
  const taken: Spot[] = [{ x: 0, z: 0, r: 19.5 }];
  const sightline = new THREE.Vector2(SUN.x + SECOND.x, SUN.z + SECOND.z).normalize();
  for (let attempt = 0; attempt < 400 && taken.length < 90; attempt++) {
    const angle = rand() * Math.PI * 2,
      reach = 24 + Math.pow(rand(), 0.8) * 48;
    const x = Math.cos(angle) * reach,
      z = Math.sin(angle) * reach;
    const district = districtCoordinates(x,z);
    if (district.v>18 && district.v<83 && Math.abs(district.u)<31) continue;
    if (Math.abs(x)<9 && z<-19) continue;
    // Keep the view from the arrival spot through the gate to the suns clear, and the
    // arrival camera's line of sight too.
    const along = (x - SPAWN.x) * sightline.x + (z - SPAWN.z) * sightline.y,
      across = Math.abs((x - SPAWN.x) * sightline.y - (z - SPAWN.z) * sightline.x);
    if (along > 0 && across < 12 + along * 0.2) continue;
    if (angle > 0.7 && angle < 1.4) continue;
    const roll = rand(),
      size = roll < 0.6 ? 2.5 + rand() * 3 : roll < 0.9 ? 2.5 + rand() * 2 : 1.4 + rand();
    if (taken.some((spot) => Math.hypot(spot.x - x, spot.z - z) < spot.r + size + 1.5)) continue;
    taken.push({ x, z, r: size * (roll < .6 ? 1.04 : roll < .9 ? 1.5 : 1.15) });
    const facing = Math.atan2(-x, -z),
      doorAt = (depth: number): [number, number, number] => [
        x - (x / reach) * depth,
        1.05,
        z - (z / reach) * depth,
      ];
    if (roll < 0.6) {
      const height = 1.6 + rand() * 1.6;
      place("drum", [x, height / 2, z], [size, height, size]);
      place("dome", [x, height, z], [size, size * 0.85, size]);
      place("door", doorAt(size * 0.98), [1.2, 2.1, 0.3], facing);
    } else if (roll < 0.9) {
      const height = 3 + rand() * 3,
        width = size * 2,
        depth = size * (1.4 + rand() * 0.8);
      place("block", [x, height / 2, z], [width, height, depth], facing);
      if (rand() < 0.5) place("dome", [x, height, z], [size * 0.7, size * 0.6, size * 0.7]);
      place("door", doorAt(depth / 2), [1.2, 2.1, 0.3], facing);
    } else {
      const height = 7 + rand() * 4;
      place("drum", [x, height / 2, z], [size, height, size]);
      place("dome", [x, height, z], [size * 1.15, size, size * 1.15]);
      place("door", doorAt(size * 0.98), [1, 2, 0.3], facing);
    }
  }
  (
    [
      ["dome", new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), adobe],
      ["drum", new THREE.CylinderGeometry(1, 1.04, 1, 24), adobe],
      ["block", new THREE.BoxGeometry(1, 1, 1), adobe],
      ["door", new THREE.BoxGeometry(1, 1, 1), shade],
    ] as const
  ).forEach(([kind, geometry, material]) => {
    const instances = new THREE.InstancedMesh(geometry, material, pieces[kind].length);
    pieces[kind].forEach((matrix, i) => instances.setMatrixAt(i, matrix));
    group.add(instances);
  });

  // Moisture vaporators dotted around the outskirts, and one inside the bay.
  const vaporator = (x: number, z: number) => {
    const tower = new THREE.Group();
    tower.position.set(x, Math.max(0, groundHeight(x, z)), z);
    tower.add(
      mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.9, 12), metal, [0, 0.45, 0]),
      mesh(new THREE.CylinderGeometry(0.17, 0.2, 3.4, 10), metal, [0, 2.6, 0]),
      mesh(new THREE.CylinderGeometry(0.32, 0.17, 0.3, 12), metal, [0, 4.35, 0]),
      mesh(new THREE.ConeGeometry(0.1, 0.5, 8), metal, [0, 4.75, 0]),
    );
    [1.3, 2, 2.7, 3.4].forEach((y) => {
      const ring = mesh(new THREE.TorusGeometry(0.26, 0.04, 6, 16), metal, [0, y, 0]);
      ring.rotation.x = Math.PI / 2;
      tower.add(ring);
    });
    [0, 2.1, 4.2].forEach((angle) => {
      const fin = mesh(new THREE.BoxGeometry(0.04, 0.7, 0.5), metal, [
        Math.cos(angle) * 0.25,
        1.4,
        Math.sin(angle) * 0.25,
      ]);
      fin.rotation.y = -angle;
      tower.add(fin);
    });
    group.add(tower);
  };
  for (let placed = 0, attempt = 0; placed < 10 && attempt < 200; attempt++) {
    const angle = rand() * Math.PI * 2,
      reach = 28 + rand() * 120,
      x = Math.cos(angle) * reach,
      z = Math.sin(angle) * reach;
    const district = districtCoordinates(x,z);
    if(district.v>18 && district.v<83 && Math.abs(district.u)<31)continue;
    if (taken.some((spot) => Math.hypot(spot.x - x, spot.z - z) < spot.r + 2)) continue;
    taken.push({ x, z, r: 1 });
    vaporator(x, z);
    placed++;
  }
  vaporator(Math.cos(1.75) * 15.2, Math.sin(1.75) * 15.2);
  circles.push({ x: Math.cos(1.75) * 15.2, z: Math.sin(1.75) * 15.2, r: 0.7 });

  // A broken range of mesas fading into the haze on the horizon.
  const rock = new THREE.MeshStandardMaterial({ color: 0xa8653d, roughness: 1 });
  for (let i = 0; i < 16; i++) {
    const angle = rand() * Math.PI * 2,
      reach = 700 + rand() * 350,
      top = 25 + rand() * 70,
      height = 25 + rand() * 45,
      x = Math.cos(angle) * reach,
      z = Math.sin(angle) * reach;
    const mesa = mesh(new THREE.CylinderGeometry(top, top * 1.4, height, 6 + Math.floor(rand() * 4)), rock, [
      x,
      groundHeight(x, z) + height / 2 - 10,
      z,
    ]);
    mesa.rotation.y = rand() * Math.PI;
    mesa.scale.set(1, 1, 0.6 + rand() * 0.6);
    group.add(mesa);
  }

  // Cargo stacked between the terminals, as on every pad.
  const crate = new THREE.MeshStandardMaterial({ color: 0x7a6a52, roughness: 0.85, metalness: 0.15 }),
    accent = new THREE.MeshStandardMaterial({ color: 0xa8572c, roughness: 0.75, metalness: 0.2 });
  [0, Math.PI].forEach((angle, cluster) => {
    const x = Math.cos(angle) * 13.3,
      z = Math.sin(angle) * 13.3;
    for (let i = 0; i < 4; i++) {
      const size = 0.9 + rand() * 0.6;
      const box = mesh(new THREE.BoxGeometry(size, size, size), i % 3 === cluster ? accent : crate, [
        x + (rand() - 0.5) * 2,
        size / 2 + (i === 3 ? 1.1 : 0),
        z + (rand() - 0.5) * 2,
      ]);
      box.rotation.y = rand() * Math.PI;
      group.add(box);
    }
    circles.push({ x, z, r: 2.2 });
  });

  const stations = createTerminals(landing, metal, circles);
  group.add(stations.group);
  const parking = parkShip(metal);
  group.add(parking.ship);
  const life = createPadLife({
    glow,
    engines: parking.exhausts,
    notify,
    guard: false,
    drone: false,
    taxi: false,
    ground: "sand",
    steam: 0xe2ddd4,
  });
  group.add(life.group);

  const district = createTatooineDistrict(adobe,groundHeight);
  group.add(district.group);
  circles.push(...taken.slice(1),...district.colliders);
  const blockedByWall=(x:number,z:number)=>{
    const radius=Math.hypot(x,z),angle=Math.atan2(x,z)-GATE_AT;
    const turn=Math.atan2(Math.sin(angle),Math.cos(angle));
    return radius>16.3 && radius<19 && Math.abs(turn)>GATE-.065;
  };
  const routeTo=createSurfaceNavigator(76,(x,z)=>{
    if(Math.hypot(x,z)>75.8 || blockedByWall(x,z) || district.isBlocked(x,z))return false;
    if(circles.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+.349))return false;
    const b=parking.footprint;
    return !(x>b.minX-.05 && x<b.maxX+.05 && z>b.minZ-.05 && z<b.maxZ+.05);
  });
  group.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    const materials=Array.isArray(object.material)?object.material:[object.material];
    object.receiveShadow=true;
    object.castShadow=materials.every(m=>m instanceof THREE.MeshStandardMaterial&&!m.transparent)&&object.geometry.type!=="PlaneGeometry";
  });

  return {
    group,
    fog: new THREE.FogExp2(HAZE, 0.0016),
    exposure: 1,
    walkRadius: 76,
    explorePoint:district.explorePoint,
    interior:district.interior,
    routeTo,
    constrainWalk:(walker)=>{
      district.constrain(walker);
      if(!blockedByWall(walker.x,walker.z))return;
      const reach=Math.hypot(walker.x,walker.z),edge=reach<17.65?16.29:19.01;
      walker.x*=edge/reach;walker.z*=edge/reach;
    },
    terminals: stations.terminals,
    ship: parking.ship,
    shipRest: parking.shipRest,
    colliders: { circles, footprint: parking.footprint, movers: [...life.movers,...district.movers] },
    setViewport: life.setViewport,
    // Beside the ship's nose, the gate and its twin suns on the right of the view.
    spawn: { position: SPAWN.clone(), yaw: 0.25 },
    setThrust: (level: number) => {
      life.settle(level < 0.05);
      parking.setThrust(level);
    },
    tick: (dt, elapsed, reduced, walker) => {
      life.tick(dt, elapsed, reduced, walker);
      district.tick(dt,reduced,walker);
      const indoors=district.interior.contains(walker.x,walker.z),blend=1-Math.exp(-dt*4);
      ambient.intensity+=((indoors?.32:1.35)-ambient.intensity)*blend;
      second.intensity+=((indoors?.1:.9)-second.intensity)*blend;
      stations.tick(elapsed, reduced);
    },
  };
}
