import * as THREE from "three";
import { createPadLife, type PadEvent } from "./coruscantLife";
import {
  createCoruscantSkyline,
  CORUSCANT_LANDMARKS,
} from "./coruscantSkyline";
import { createCoruscantCargo } from "./coruscantCargo";
import { createCityCrowns } from "./coruscantCrowns";
import {
  createTerminals,
  glowTexture,
  parkShip,
  random,
  type Reveal,
  type Spot,
  type Zone,
  type ZoneAction,
} from "./landingKit";
import { createForgottenConsole } from "./zoneSecrets";
import type { Landing } from "./universe";
import { CITY_SKY_GLSL, advanceCity, cityBuildingUniforms, cityFogColor, cityHaze, lightCity, setCityHour, setCityStorm } from "./galaxy/cityEnv";
import { createLivingCity } from "./galaxy/livingCity";
import { createTaxiStand, STAND } from "./coruscantTaxi/taxiModel";

const PAD_RADIUS = 16;
export const HAZE_LOW = new THREE.Color(0.44, 0.2, 0.105),
  HAZE_HIGH = new THREE.Color(0.135, 0.12, 0.22);
const FOG_DENSITY = 0.0021;

// Facades light their own windows from world position, so towers of any height stay crisp.
const buildingVertex = `
 // Set on the parts of a crown that carry no windows (masts, ducts, parapets); 0 everywhere else.
 attribute float plain;
 varying vec3 vWorld;varying vec3 vNormal;varying float vSeed;varying float vPlain;
 void main(){
  vPlain=plain;
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
 uniform float cityDay,cityNight,cityStorm,cityFlash;uniform vec4 cityOutage;
 varying vec3 vWorld;varying vec3 vNormal;varying float vSeed;varying float vPlain;
 float hash(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}
 // One wall, in metres along it and up it. Each tower draws its own kind of facade: punched
 // windows, tall strips of glass between piers, long ribbons, or dark glass with a few lights.
 // Piers and belt courses stand proud of the wall. rgb is the light of the windows, a the relief.
 vec4 facade(vec2 p){
  vec2 cell=p/vec2(1.0,1.4);
  vec2 id=floor(cell),f=fract(cell);
  float style=fract(vSeed*7.31);
  float hour=1.0+cityNight*.25-cityDay*.72;
  float dark=.64-vSeed*.24-cityNight*.14+cityDay*.2;
  float bay=4.0+floor(fract(vSeed*3.7)*4.0);
  float pier=step(mod(id.x,bay),.5);
  float floorOf=mod(id.y,14.0);
  float belt=step(floorOf,.5);
  // The floor above each belt is a sky lobby: one unbroken line of warm light.
  float lobby=step(.5,floorOf)*step(floorOf,1.5);
  float pane,lit;
  if(style<.46){
   pane=step(.29,f.x)*step(f.x,.71)*step(.34,f.y)*step(f.y,.65);
   lit=step(dark,hash(id+vSeed*91.0));
  }else if(style<.74){
   pane=step(.16,f.x)*step(f.x,.84)*step(.05,f.y)*step(f.y,.95);
   lit=step(dark+.06,hash(vec2(id.x,floor(id.y/3.0))+vSeed*57.0));
  }else if(style<.92){
   pane=step(.02,f.x)*step(f.x,.98)*step(.3,f.y)*step(f.y,.72);
   lit=step(dark-.03,hash(vec2(floor(id.x/4.0),id.y)+vSeed*23.0));
  }else{
   pane=step(.2,f.x)*step(f.x,.8)*step(.2,f.y)*step(f.y,.8);
   lit=step(.9-cityNight*.05,hash(id+vSeed*91.0));
  }
  vec3 tint=mix(vec3(.58,.72,1.0),vec3(1.0,.66,.34),step(.78,hash(id.yx+vSeed*13.0)));
  vec3 near=pane*lit*tint*(.5+hash(id*1.7)*.65)*hour*(1.0-pier)*(1.0-belt);
  near=mix(near,vec3(1.0,.8,.56)*step(.06,f.x)*step(f.x,.94)*step(.28,f.y)*step(f.y,.74)*.62*hour*(1.0-pier),lobby*step(.3,vSeed));
  // Too far to tell one window from the next, a wall is its average glow.
  float detail=1.0-smoothstep(.35,1.0,max(fwidth(cell.x),fwidth(cell.y)));
  vec3 far=vec3(.39,.43,.61)*(.06+vSeed*.08)*(1.0+cityNight*.25-cityDay*.5);
  return vec4(mix(far,near,detail),(pier*.55+belt*.7)*detail);
 }
 void main(){
  vec3 n=normalize(vNormal);
  // Two families of stone and steel, so neighbours do not share one grey.
  vec3 body=mix(vec3(1.06,.95,.86),vec3(.84,.94,1.1),step(.5,fract(vSeed*5.3)));
  vec3 color=vec3(.032,.037,.05)*body*(.7+vSeed*.6)*(.85+.3*n.y);
  // By day the walls catch the sun; at any hour a sector can lose its power, tower by tower.
  color+=cityDay*vec3(.3,.3,.33)*body*(.45+.55*max(0.0,dot(n,normalize(vec3(-.45,.6,.4)))))*(.7+vSeed*.6);
  float cut=step(.001,cityOutage.w)*step(distance(vWorld.xz,cityOutage.xy),cityOutage.z)*step(vSeed,cityOutage.w*1.05);
  if(abs(n.y)<.5&&vPlain<.5){
   // Blend two world projections so windows remain legible on curved shoulders.
   vec2 weight=pow(abs(n.xz),vec2(6.0));
   weight/=max(.0001,weight.x+weight.y);
   vec4 wall=facade(vWorld.zy)*weight.x+facade(vWorld.xy)*weight.y;
   // In full daylight the walls are bright already: the relief is a nuance, not a white grid.
   color*=1.0+wall.a*(1.9-cityDay*1.35);
   color+=wall.rgb*(1.0-cut);
   color+=vec3(.9,.5,.25)*.06*step(.96,fract(vWorld.y/36.0))*(1.0-cut)*(1.0-cityDay);
  }else if(n.y>.5&&vPlain<.5){
   // Roofs seen from above: plant in lighter blocks, and here and there a lit skylight.
   vec2 r=vWorld.xz/2.6;
   vec2 rid=floor(r),rf=fract(r);
   float seen=1.0-smoothstep(.3,.9,max(fwidth(r.x),fwidth(r.y)));
   float block=step(.2,rf.x)*step(rf.x,.8)*step(.2,rf.y)*step(rf.y,.8);
   color+=vec3(.014,.016,.02)*block*step(.66,hash(rid+vSeed*5.0))*seen*(1.0+cityDay*4.0);
   color+=vec3(.5,.64,.95)*.42*block*step(.94,hash(rid.yx+vSeed*17.0))*seen*(1.0-cut)*(1.0-cityDay*.85);
  }
  // At dusk the walls turned to the sunset glow, and the others take the cold of the sky: it is
  // this, more than anything, that gives each tower its volume.
  vec3 west=normalize(vec3(-.85,.14,-.5));
  float dusk=(1.0-cityDay)*(1.0-cityNight*.82)*(1.0-cityStorm*.7);
  float lit=max(0.0,dot(n,west));
  color+=hazeLow*lit*lit*.5*dusk*(.55+vSeed*.5);
  color+=hazeHigh*max(0.0,-dot(n,west))*.12*dusk;
  // By night a little of the sky's blue rests on what faces up.
  color+=vec3(.012,.016,.03)*max(0.0,n.y)*cityNight;
  float distance=length(vWorld-cameraPosition);
  float fog=1.0-exp(-fogDensity*fogDensity*distance*distance);
  vec3 direction=normalize(vWorld-cameraPosition);
  float sunset=pow(max(0.0,dot(normalize(direction.xz+vec2(.0001)),normalize(vec2(-.85,-.5)))),4.0);
  vec3 haze=mix(hazeHigh,hazeLow,sunset*.78);
  haze=mix(haze,hazeHigh,smoothstep(-160.0,140.0,vWorld.y)*.35);
  color+=vec3(.22,.24,.3)*cityFlash*(.35+.65*n.y*n.y);
  gl_FragColor=vec4(mix(color,haze+vec3(.2,.22,.28)*cityFlash,fog),1.0);
 }`;
// Also lights the city the air taxi crosses, with thinner haze for its longer views.
export function buildingMaterial(fogDensity = FOG_DENSITY) {
  return new THREE.ShaderMaterial({
    uniforms: {
      hazeLow: cityHaze.low,
      hazeHigh: cityHaze.high,
      fogDensity: { value: fogDensity },
      ...cityBuildingUniforms(),
    },
    vertexShader: buildingVertex,
    fragmentShader: buildingFragment,
  });
}
function skyDome() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(1800, 48, 24),
    new THREE.ShaderMaterial({
      uniforms: { hazeHigh: cityHaze.high, ...cityBuildingUniforms() },
      vertexShader: `varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform vec3 hazeHigh;varying vec3 vDirection;
       ${CITY_SKY_GLSL}
       void main(){
        vec3 direction=normalize(vDirection);
        float h=direction.y;
        float sunset=pow(max(0.0,dot(normalize(direction.xz+vec2(.0001)),normalize(vec2(-.85,-.5)))),4.0);
        vec3 zenith=vec3(.025,.038,.115);
        vec3 horizon=mix(vec3(.21,.15,.32),vec3(.62,.265,.12),sunset);
        vec3 c=h>0.0?mix(horizon,zenith,pow(h,.48)):mix(horizon,hazeHigh,pow(-h,.45));
        float violetBand=exp(-pow((h-.16)*9.0,2.0));
        float cloud=.5+.5*sin(direction.x*18.0+direction.z*13.0+sin(direction.z*27.0)*.7);
        c+=vec3(.055,.025,.095)*violetBand*cloud;
        c+=vec3(.16,.055,.018)*sunset*exp(-pow(h*9.0,2.0));
        gl_FragColor=vec4(citySky(c,h),1.0);
       }`,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
}
// Top-cap UVs map world z to the canvas width and world x to its height, hence the turn.
export function padTexture(label: string) {
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
    ctx.fillRect(
      rand() * size,
      rand() * size,
      6 + rand() * 40,
      6 + rand() * 40,
    );
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
    ctx.arc(
      0,
      0,
      edge * 0.97,
      (i / 64) * Math.PI * 2,
      ((i + 1) / 64) * Math.PI * 2,
    );
    ctx.arc(
      0,
      0,
      edge * 0.9,
      ((i + 1) / 64) * Math.PI * 2,
      (i / 64) * Math.PI * 2,
      true,
    );
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
  reveal: Reveal,
): Zone {
  const group = new THREE.Group();
  const rand = random(3700);
  const glow = glowTexture();
  group.add(skyDome());
  const skyLight = new THREE.HemisphereLight(0x45578a, 0x9a5226, 1.1);
  group.add(skyLight);
  const key = new THREE.DirectionalLight(0xffc49a, 1.6);
  key.position.set(-160, 110, 140);
  group.add(key);
  const padLight = new THREE.PointLight(0xffa25e, 40, 34, 2);
  padLight.position.set(0, 7, 0);
  group.add(padLight);

  // The city: thousands of towers falling away into haze below the platform.
  const towers: { x: number; z: number; w: number; d: number; top: number }[] =
    [];
  for (let gx = -620; gx <= 620; gx += 19)
    for (let gz = -620; gz <= 620; gz += 19) {
      const x = gx + (rand() - 0.5) * 9,
        z = gz + (rand() - 0.5) * 9,
        reach = Math.hypot(x, z);
      if (reach < 56 || reach > 640) continue;
      if (
        CORUSCANT_LANDMARKS.some(
          (landmark) =>
            Math.hypot(x - landmark.x, z - landmark.z) < landmark.r + 12,
        )
      )
        continue;
      // Districts: rooftops rise and fall over a few hundred metres, so the skyline has hills
      // and hollows. Derived from the place itself, so the random sequence is left untouched.
      const district =
        (Math.sin(x * 0.011 + 1.3) * Math.cos(z * 0.013 - 0.7) + Math.sin((x + z) * 0.006 + 2.1) * 0.6) * 22;
      const landmarkRoll = Math.sin(gx * 12.9898 + gz * 78.233) * 43758.5453;
      const megatower = reach > 220 && (rand() < 0.008 || landmarkRoll - Math.floor(landmarkRoll) < 0.006);
      towers.push({
        x,
        z,
        w: 7 + rand() * 10,
        d: 7 + rand() * 10,
        // Most rooftops sit below the platform, so the view opens onto the skyline.
        top: megatower ? 60 + rand() * 140 : Math.min(40, -150 + Math.pow(rand(), 2.2) * 185 + district),
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
  // Crowns on the roofs: terraces, spires, domes, blades and plant, with their obstacle lights.
  const crowns = createCityCrowns({ towers, material: city.material, fogDensity: FOG_DENSITY, pixelRatio: 1 });
  group.add(crowns.group);
  group.add(createCoruscantSkyline(buildingMaterial()));
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
  trafficGeometry.setAttribute(
    "color",
    new THREE.BufferAttribute(trafficColors, 3),
  );
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
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(PAD_RADIUS, PAD_RADIUS + 0.5, 0.8, 96),
    [
      metal,
      new THREE.MeshStandardMaterial({
        map: padTexture(landing.pad),
        roughness: 0.72,
        metalness: 0.35,
      }),
      metal,
    ],
  );
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
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.12, 6, 10),
      metal,
    );
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
  const cargo = createCoruscantCargo();
  const circles: Spot[] = cargo.colliders;
  group.add(cargo.group);

  const stations = createTerminals(landing, metal, circles);
  group.add(stations.group);
  const parking = parkShip();
  group.add(parking.ship);
  const life = createPadLife({ glow, engines: parking.exhausts, notify });
  group.add(life.group);
  // The air taxi post at the edge of the pad: calling the taxi leads to Coruscant's monuments.
  const stand = createTaxiStand(glow);
  group.add(stand.group);
  circles.push({ x: STAND.x, z: STAND.z, r: 0.45 });
  const taxiCall: ZoneAction = {
    id: "taxi",
    label: "Taxi aérien",
    position: new THREE.Vector3(STAND.x, 1.2, STAND.z),
    objects: [...stand.pickables, ...life.taxi.objects],
    approach: { position: new THREE.Vector3(0.9, 0, -12.3), lookAt: new THREE.Vector3(0, 1.2, -18.8) },
    boards: true,
    activate: () => life.taxi.summon(),
  };
  // Mission 04: a forgotten console tucked behind the west cargo, turned towards the pad.
  const archive = createForgottenConsole(reveal, { x: -13.9, z: -3.6, facing: Math.atan2(13.9, 3.6) });
  group.add(archive.group);
  circles.push(archive.circle);

  // The living city around the pad: traffic, holograms, the hour and the events.
  const living = createLivingCity({ glow, circles, towers, fogDensity: FOG_DENSITY });
  group.add(living.group);
  if (living.database) circles.push(living.database.circle);
  const fog = new THREE.FogExp2(HAZE_HIGH.clone().lerp(HAZE_LOW, 0.4), FOG_DENSITY);

  // Development only: sets the hour (0 dusk, 0.3 night, 0.75 day) and the storm, to compare
  // renders of the city at a fixed moment.
  if (process.env.NODE_ENV !== "production")
    (window as unknown as { __orbitalCity?: object }).__orbitalCity = { hour: setCityHour, storm: setCityStorm };
  let chase = 0;
  return {
    group,
    fog,
    exposure: 1.15,
    walkRadius: PAD_RADIUS - 1.1,
    terminals: stations.terminals,
    actions: living.database ? [taxiCall, archive.action, living.database.action] : [taxiCall, archive.action],
    board: { ready: life.taxi.ready, seat: life.taxi.seat, release: life.taxi.release },
    ship: parking.ship,
    shipRest: parking.shipRest,
    colliders: { circles, footprint: parking.footprint, movers: life.movers },
    setViewport: (height: number) => {
      life.setViewport(height);
      crowns.setViewport(height);
    },
    setQuality: living.setQuality,
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
      archive.tick(dt, elapsed, reduced);
      advanceCity(dt, { cycle: living.cycle, reduced });
      lightCity(key, skyLight, { sun: 1.6, sky: 1.1 });
      living.tick(dt, elapsed, reduced, walker);
      crowns.tick(elapsed, reduced);
      fog.color.copy(cityFogColor);
      fog.density = FOG_DENSITY * living.fogScale();
      stand.setState(life.taxi.phase());
      stand.tick(elapsed, reduced);
      const motion = reduced ? 0 : 1;
      lights.forEach((light, i) => {
        const lane = lanes[light.lane];
        light.offset =
          (light.offset +
            light.track * light.speed * dt * motion +
            lane.length) %
          lane.length;
        const along = light.offset - lane.length / 2;
        trafficPositions[i * 3] =
          lane.origin.x +
          lane.direction.x * along -
          lane.direction.z * light.track * 2.5;
        trafficPositions[i * 3 + 1] = lane.origin.y;
        trafficPositions[i * 3 + 2] =
          lane.origin.z +
          lane.direction.z * along +
          lane.direction.x * light.track * 2.5;
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
