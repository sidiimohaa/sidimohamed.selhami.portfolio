import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { PodModuleId } from "./modules";
import { createPodModel } from "./podModel";
import { branchOffset, hazardLane } from "./tracks";
import type { GhostFrame, PodBranch, PodHazard, PodPad, PodRaceState, PodRaider, PodShot, PodTrack, PodTrackFrame, PodVehicle } from "./types";

const TAU = Math.PI * 2;
const hoverHeight = 2.4;

function random(seed: number) {
  let value = seed;
  return () => {
    value = (Math.imul(1664525, value) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function at(frame: PodTrackFrame, lane: number, height = 0) {
  return new THREE.Vector3(frame.x + Math.cos(frame.heading) * lane, frame.y + height, frame.z - Math.sin(frame.heading) * lane);
}

function buffer(positions: number[], colors: number[], indices: number[], uv?: number[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (colors.length) g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  if (uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function sandTexture() {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const rng = random(1977);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ripples = Math.sin(TAU * (y / size * 12 + Math.sin(x / size * TAU * 3) * .11)) * 6;
      const grain = Math.round(214 + rng() * 33 + ripples);
      const offset = 4 * (y * size + x);
      data[offset] = data[offset + 1] = data[offset + 2] = grain;
      data[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

const palettes = {
  day: { sky: 0x6996bc, horizon: 0xe4b98e, sun: 0xffe6be, sand: 0xbf9461, rock: 0x9f6647, light: 2.8 },
  sunset: { sky: 0x625a83, horizon: 0xe09b75, sun: 0xffc59b, sand: 0xaf7553, rock: 0x8a4e42, light: 2.35 },
  night: { sky: 0x152a52, horizon: 0x63728a, sun: 0xafcbff, sand: 0x9b8c85, rock: 0x695366, light: 1.85 },
};

function makeSky(track: PodTrack) {
  const palette = palettes[track.light];
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(300, 26, 14),
    new THREE.ShaderMaterial({
      uniforms: {
        zenith: { value: new THREE.Color(palette.sky) },
        horizon: { value: new THREE.Color(palette.horizon) },
        tint: { value: new THREE.Color(palette.sun) },
        night: { value: track.light === "night" ? 1 : 0 },
      },
      vertexShader: `varying vec3 d;void main(){
        d=position;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
        gl_Position.z=gl_Position.w*.999999;
      }`,
      fragmentShader: `varying vec3 d;uniform vec3 zenith;uniform vec3 horizon;uniform vec3 tint;uniform float night;
      float stars(vec3 p){
        vec3 r=floor(p*191.);
        return step(.996,fract(sin(dot(r,vec3(31.1,83.7,12.3)))*43758.5453));
      }
      float sun(vec3 p,vec3 at,float radius){
        float a=length(p-normalize(at));
        return (1.-smoothstep(radius,radius+.0025,a))*1.25+exp(-a*22.)*.32;
      }
      void main(){
        vec3 p=normalize(d);
        vec3 c=mix(horizon,zenith,pow(clamp(p.y*1.65+.12,0.,1.),.54));
        float lights=sun(p,vec3(.34,.28,.94),.026)+sun(p,vec3(.49,.215,.84),.017)*.8;
        c+=tint*(lights*(1.-.62*night));
        c+=vec3(.46,.59,.81)*stars(p)*night*smoothstep(.15,.65,p.y);
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
      side: THREE.BackSide, depthWrite: false,
    }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -100;
  return sky;
}

function desertGround(root: THREE.Group, track: PodTrack, material: THREE.Material, color: number) {
  const samples = Array.from({ length: 340 }, (_, i) => track.sample(i / 340 * track.length));
  const minX = Math.min(...samples.map((s) => s.x)) - 370;
  const maxX = Math.max(...samples.map((s) => s.x)) + 370;
  const minZ = Math.min(...samples.map((s) => s.z)) - 370;
  const maxZ = Math.max(...samples.map((s) => s.z)) + 370;
  const cols = Math.ceil((maxX - minX) / 12);
  const rows = Math.ceil((maxZ - minZ) / 12);
  const positions: number[] = [], colors: number[] = [], indices: number[] = [], uv: number[] = [];
  const sand = new THREE.Color(color);
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const x = THREE.MathUtils.lerp(minX, maxX, i / cols), z = THREE.MathUtils.lerp(minZ, maxZ, j / rows);
      let nearest = samples[0], best = Infinity;
      for (const sample of samples) {
        const d = (sample.x - x) ** 2 + (sample.z - z) ** 2;
        if (d < best) { nearest = sample; best = d; }
      }
      const ground = -7 + Math.sin(x * .018 + Math.cos(z * .008)) * 3 + Math.sin(z * .013 + x * .012) * 3.2;
      const ratio = THREE.MathUtils.smoothstep(Math.sqrt(best) - nearest.width, 25, 135);
      const y = THREE.MathUtils.lerp(nearest.y - 5.9, ground, ratio);
      const v = .83 + Math.sin(x * .027 + z * .015) * .06 + Math.sin(x * .092 - z * .023) * .052;
      positions.push(x, y, z);
      uv.push(x / 21, z / 22);
      colors.push(sand.r * v, sand.g * v, sand.b * v);
      if (i < cols && j < rows) {
        const n = j * (cols + 1) + i;
        indices.push(n, n + cols + 1, n + 1, n + 1, n + cols + 1, n + cols + 2);
      }
    }
  }
  const ground = new THREE.Mesh(buffer(positions, colors, indices, uv), material);
  ground.name = "pod-desert-terrain";
  root.add(ground);
}

function drawRibbon(track: PodTrack, material: THREE.Material, start: number, end: number, sand: number, branch?: PodBranch) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [], uv: number[] = [];
  const tint = new THREE.Color(branch ? new THREE.Color(sand).lerp(new THREE.Color(0xc48d56), .22) : sand);
  const count = Math.ceil((end - start) / 5);
  const columns = 9;
  for (let i = 0; i <= count; i++) {
    const d = THREE.MathUtils.lerp(start, end, i / count), frame = track.sample(d);
    const width = branch?.width ?? frame.width;
    const offset = branch ? branchOffset(branch, d) : 0;
    const edges = [-width-14, -width-5.5, -width, -width*.54, 0, width*.54, width, width+5.5, width+14];
    const slopes = [-6, -1.55, 0, 0, 0, 0, 0, -1.55, -6];
    const tones = [.82,.86,.94,1.04,1.08,1.04,.94,.86,.82];
    const trail = .033 * Math.sin(d * .042) + .022 * Math.cos(d * .118);
    for (let k = 0; k < columns; k++) {
      const p = at(frame, edges[k] + offset, slopes[k] + (branch ? .075 : .025));
      positions.push(p.x, p.y, p.z);
      uv.push(edges[k] / 10, d / 15);
      const value = tones[k] + trail;
      colors.push(tint.r * value, tint.g * value, tint.b * value);
      if (i < count && k < columns - 1) {
        const n = i * columns + k;
        indices.push(n,n+columns,n+1,n+1,n+columns,n+columns+1);
      }
    }
  }
  return new THREE.Mesh(buffer(positions,colors,indices,uv),material);
}

function routeMarks(root: THREE.Group, track: PodTrack, marks: PodPad[], material: THREE.Material, lift: number) {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const { start, end, lane, width } of marks) {
    const count = Math.ceil((end - start) / 3);
    const base = positions.length / 3;
    for (let i = 0; i <= count; i++) {
      const frame = track.sample(THREE.MathUtils.lerp(start, end, i / count));
      for (const side of [-1, 1]) {
        const point = at(frame, lane + width * side, lift);
        positions.push(point.x, point.y, point.z);
      }
      if (i < count) {
        const n = base + i * 2;
        indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
      }
    }
  }
  if (indices.length) root.add(new THREE.Mesh(buffer(positions, [], indices), material));
}

type Solid = { point: THREE.Vector3; scale: THREE.Vector3; heading: number };
function solid(list: Solid[], f: PodTrackFrame, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
  const point=at(f,x,y);
  point.x+=Math.sin(f.heading)*z;
  point.z+=Math.cos(f.heading)*z;
  list.push({point,scale:new THREE.Vector3(sx,sy,sz),heading:f.heading});
}
function solidBatch(root: THREE.Group, rows: Solid[], material: THREE.Material, geometry: THREE.BufferGeometry) {
  if (!rows.length) { geometry.dispose(); return; }
  const batch = new THREE.InstancedMesh(geometry, material, rows.length);
  const matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0,1,0);
  rows.forEach((row,i)=>batch.setMatrixAt(i,matrix.compose(row.point,q.setFromAxisAngle(up,row.heading),row.scale)));
  batch.computeBoundingSphere();
  root.add(batch);
}

function dome(radius: number, width: number) {
  return new THREE.SphereGeometry(1, 14, 7, 0, TAU, 0, Math.PI / 2).scale(width, radius, width);
}

function stadium(root: THREE.Group, track: PodTrack, stone: THREE.Material, trim: THREE.Material, dark: THREE.Material, light: THREE.Material, rng: () => number) {
  const bases: Solid[] = [], steps: Solid[] = [], trimBlocks: Solid[] = [], lights: Solid[] = [], crowd: Solid[][]=[[],[],[]];
  for (const distance of [-49,-20,10,40,70,100,130,160]) {
    const f=track.sample(distance);
    for(const side of [-1,1]){
      solid(bases,f,side*(f.width+3.5),.7,0,3,1.5,28);
      solid(trimBlocks,f,side*(f.width+2.1),1.5,0,.45,.4,28);
      for(let tier=0;tier<6;tier++){
        const x=side*(f.width+5.8+tier*1.48);
        const y=.7+tier*.79;
        solid(steps,f,x,y,0,2.0,1.4,28);
        solid(trimBlocks,f,x-side*.92,y+.66,0,.14,.14,28);
        for(let j=0;j<13;j++){
          if(rng()<.33) continue;
          solid(crowd[Math.floor(rng()*3)],f,x,y+1.03,-12+j*1.93,.40+rng()*.18,.48+rng()*.26,.38);
        }
      }
      if(distance===-49 || distance===40 || distance===130){
        const x=side*(f.width+10);
        solid(bases,f,x,3.6,0,5.1,7.3,5.5);
        solid(trimBlocks,f,x,7.23,0,5.55,.53,5.9);
        const cap=new THREE.Mesh(dome(2.3,2.55),stone); cap.position.copy(at(f,x,7.5)); root.add(cap);
        solid(lights,f,x,5.28,2.85,3.45,.24,.18);
      }
    }
  }
  // Gantry and black / white timing line.
  const f=track.sample(0);
  for (const side of [-1,1]) {
    solid(bases,f,side*(f.width+.55),5.4,0,2.7,11,4.25);
    solid(trimBlocks,f,side*(f.width+.55),10.9,0,3.15,.8,4.55);
    solid(lights,f,side*(f.width-.86),5.3,0,.17,4.1,.42);
  }
  solid(bases,f,0,11,0,f.width*2+1.5,2.1,3.25);
  solid(trimBlocks,f,0,10.06,.15,f.width*2,.26,3.1);
  solid(lights,f,0,10.35,-1.66,f.width*1.73,.32,.1);
  for(let i=0;i<9;i++){
    const x=(i-4)*(f.width/5);
    solid(lights,f,x,9.95,-1.37,.49,.36,.55);
  }
  for(let row=0;row<2;row++)for(let i=0;i<22;i++){
    const cell=(f.width*2)/22;
    solid((i+row)%2?trimBlocks:lights,f,-f.width+(i+.5)*cell,.066,(row-.5)*.85,cell,.05,.86);
  }
  solidBatch(root,bases,stone,new THREE.BoxGeometry(1,1,1));
  solidBatch(root,steps,stone,new THREE.BoxGeometry(1,1,1));
  solidBatch(root,trimBlocks,dark,new THREE.BoxGeometry(1,1,1));
  solidBatch(root,lights,light,new THREE.BoxGeometry(1,1,1));
  [0xd0955b,0x78473a,0x718188].forEach((color,i)=>solidBatch(root,crowd[i],new THREE.MeshStandardMaterial({color,roughness:.93}),new THREE.BoxGeometry(1,1,1)));
  const booth=new THREE.Mesh(new THREE.BoxGeometry(8,2.5,4.2),trim);
  booth.position.copy(at(f,-f.width-8,10.4)); booth.rotation.y=f.heading; root.add(booth);
}

function sideExtent(track: PodTrack, d: number, frame: PodTrackFrame, side: number) {
  let extent=frame.width;
  for (const branch of track.branches) {
    if (Math.sign(branch.offset)!==side || d<branch.start-20 || d>branch.end+20) continue;
    const local=Math.max(branch.start,Math.min(branch.end,d));
    const branchReach=Math.abs(branchOffset(branch,local));
    extent=Math.max(extent,branchReach+branch.width+1.3);
  }
  return extent;
}

type RockBuffers = { p: number[]; c: number[]; i: number[] };
function strata(buffers: RockBuffers, center: THREE.Vector3, sx: number, sy: number, sz: number, color: THREE.Color, rng: () => number) {
  const ring=9, layers=6, base=buffers.p.length/3;
  const skewX=(rng()-.5)*sx*.36,skewZ=(rng()-.5)*sz*.36;
  const phase=rng()*TAU;
  const facets=Array.from({length:ring},()=>.86+rng()*.23);
  const profile=[1,.97,.80,.83,.68,.25];
  for(let j=0;j<layers;j++)for(let k=0;k<ring;k++){
    const t=j/(layers-1),a=k/ring*TAU+phase;
    const taper=profile[j]*facets[k]*(.93+rng()*.12);
    const ledge=.89+Math.sin(j*2.4+k*.39)*.12+(rng()-.5)*.12;
    buffers.p.push(center.x+Math.cos(a)*sx*taper+skewX*t,center.y+sy*t+(j>0?Math.sin(a*2+phase)*sy*.034:0),center.z+Math.sin(a)*sz*taper+skewZ*t);
    buffers.c.push(color.r*ledge,color.g*ledge,color.b*ledge);
    if(j<layers-1){
      const v=base+j*ring+k,next=base+j*ring+(k+1)%ring;
      buffers.i.push(v,next,v+ring,next,next+ring,v+ring);
    }
  }
  const peak=buffers.p.length/3;
  buffers.p.push(center.x+skewX,center.y+sy*1.014,center.z+skewZ);
  buffers.c.push(color.r*.86,color.g*.86,color.b*.86);
  for(let k=0;k<ring;k++)buffers.i.push(base+(layers-1)*ring+k,base+(layers-1)*ring+(k+1)%ring,peak);
}

function rockScenery(root: THREE.Group, track: PodTrack, material: THREE.Material, tint: number, rng: () => number) {
  const color=new THREE.Color(tint);
  for(let start=0;start<track.length;start+=135){
    const geometry: RockBuffers={p:[],c:[],i:[]};
    for(let d=start+5;d<Math.min(start+135,track.length);d+=15+rng()*11){
      const f=track.sample(d);
      if(f.sector==="stadium"||f.sector==="tunnel") continue;
      for(const side of [-1,1]){
        if(f.sector==="dunes"&&rng()>.22) continue;
        const canyon=f.sector==="canyon";
        const radius=canyon?6+rng()*6:8+rng()*17;
        const ext=sideExtent(track,d,f,side);
        const lane=side*(ext+radius+(canyon?2.8+rng()*3:14+rng()*28));
        const center=at(f,lane,-6.5);
        strata(geometry,center,radius,canyon?21+rng()*20:15+rng()*35,10+rng()*11,color,rng);
        if(!canyon && rng()>.36) strata(geometry,at(f,lane+side*(radius+19),-9),radius*1.4,30+rng()*48,18+rng()*18,color,rng);
      }
    }
    if(geometry.i.length)root.add(new THREE.Mesh(buffer(geometry.p,geometry.c,geometry.i),material));
  }
  const skyline: RockBuffers={p:[],c:[],i:[]};
  const center=Array.from({length:96},(_,i)=>track.sample(i/96*track.length)).reduce((v,f)=>v.add(at(f,0)),new THREE.Vector3()).multiplyScalar(1/96);
  const distant=color.clone().lerp(new THREE.Color(0x89848a),.38);
  for(let i=0;i<28;i++){
    const a=i/28*TAU, radius=535+rng()*112;
    strata(skyline,new THREE.Vector3(center.x+Math.sin(a)*radius,-15,center.z+Math.cos(a)*radius),22+rng()*45,27+rng()*61,27+rng()*42,distant,rng);
  }
  root.add(new THREE.Mesh(buffer(skyline.p,skyline.c,skyline.i),material));
}

function tunnels(root: THREE.Group, track: PodTrack, material: THREE.Material, light: THREE.Material, tint: number) {
  const count=Math.ceil(track.length/6), step=track.length/count;
  const c=new THREE.Color(tint).multiplyScalar(.70);
  const markers: Solid[]=[];
  let run=0;
  while(run<count){
    if(track.sample(run*step).sector!=="tunnel"){run++;continue;}
    let last=run+1;
    while(last<count && track.sample(last*step).sector==="tunnel")last++;
    const n=14;
    const p:number[]=[],col:number[]=[],index:number[]=[];
    for(let j=run;j<=last;j++){
      const d=j*step, f=track.sample(d);
      const left=sideExtent(track,d,f,-1)+4.7,right=sideExtent(track,d,f,1)+4.7;
      for(let k=0;k<=n;k++){
        const a=k/n*Math.PI, offset=Math.cos(a);
        const v=at(f,offset*(offset<0?left:right),Math.sin(a)*(11.3+Math.sin(d*.073)*.82)-.95);
        p.push(v.x,v.y,v.z);
        const s=.76+.21*Math.sin(a)+Math.sin(d*.14+k*1.68)*.09;
        col.push(c.r*s,c.g*s,c.b*s);
        if(j<last&&k<n){const i=(j-run)*(n+1)+k;index.push(i,i+1,i+n+1,i+1,i+n+2,i+n+1);}
      }
      if((j-run)%3===0)for(const side of [-1,1])solid(markers,f,side*(sideExtent(track,d,f,side)+1.0),.55,0,.38,1.12,.67);
    }
    root.add(new THREE.Mesh(buffer(p,col,index),material));
    run=last;
  }
  solidBatch(root,markers,light,new THREE.BoxGeometry(1,1,1));
}

function rails(root: THREE.Group, track: PodTrack, sign: THREE.Material, chassis: THREE.Material, light: THREE.Material) {
  const signs: Solid[]=[], posts: Solid[]=[], lamps: Solid[]=[];
  for(let d=21;d<track.length;d+=37){
    const f=track.sample(d);
    if(f.sector==="stadium"||f.sector==="tunnel") continue;
    for (const side of [-1,1]){
      const x=side*(sideExtent(track,d,f,side)+.92);
      solid(posts,f,x,.49,0,.28,.98,.28);
      solid(lamps,f,x,1.05,0,.42,.19,.36);
    }
  }
  for(const branch of track.branches){
    for(const d of [branch.start+32,branch.start+54,branch.end-36]){
      const f=track.sample(d),side=Math.sign(branch.offset);
      const x=branchOffset(branch,d)+side*(branch.width+.65);
      solid(posts,f,x,.74,0,.25,1.48,.27);
      solid(signs,f,x,1.55,0,.84,.43,.21);
      solid(lamps,f,x,1.59,-.13,.46,.12,.13);
    }
  }
  solidBatch(root,posts,chassis,new THREE.BoxGeometry(1,1,1));
  solidBatch(root,signs,sign,new THREE.BoxGeometry(1,1,1));
  solidBatch(root,lamps,light,new THREE.BoxGeometry(1,1,1));
}

function buildHazard(hazard: PodHazard, rock: THREE.Material, metal: THREE.Material, stripe: THREE.Material) {
  const object=new THREE.Group();
  if(hazard.kind==="rock"){
    const geo: RockBuffers={p:[],c:[],i:[]};
    strata(geo,new THREE.Vector3(),hazard.radius*.98,hazard.radius*2.4,hazard.radius*.85,new THREE.Color(0x956653),random(hazard.id.length*137));
    object.add(new THREE.Mesh(buffer(geo.p,geo.c,geo.i),rock));
  }else{
    const body=new THREE.Mesh(new THREE.BoxGeometry(hazard.radius*1.74,1.32,hazard.radius*1.44),metal);
    body.position.y=hazard.kind==="sweeper"?1.66:.74;
    body.rotation.z=hazard.kind==="sweeper"?0:-.22;
    object.add(body);
    const plate=new THREE.Mesh(new THREE.BoxGeometry(hazard.radius*1.32,.29,.16),stripe);
    plate.position.set(0,body.position.y,-hazard.radius*.74);
    object.add(plate);
    const roof=new THREE.Mesh(new THREE.CylinderGeometry(.59,1.14,.52,8),metal);
    roof.position.y=body.position.y+.87;object.add(roof);
    for(const side of [-1,1]){
      const piston=new THREE.Mesh(new THREE.CylinderGeometry(.31,.42,1.68,10).rotateX(Math.PI/2),stripe);
      piston.position.set(side*hazard.radius*.69,body.position.y-.28,0); object.add(piston);
    }
  }
  return object;
}

function shadow() {
  const material=new THREE.ShaderMaterial({
    vertexShader:`varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`varying vec2 p;void main(){vec2 q=p-.5;float r=dot(q,q)*4.;gl_FragColor=vec4(.07,.045,.055,pow(clamp(1.-r,0.,1.),2.)*.46);}`,
    transparent:true,depthWrite:false,
  });
  const object=new THREE.Mesh(new THREE.PlaneGeometry(7.8,11.8),material);
  object.rotation.x=-Math.PI/2;
  object.renderOrder=2;
  return object;
}

function dustLayer(root: THREE.Group, color: number, rng: () => number) {
  const count=185;
  const positions=new Float32Array(count*3);
  const strength=new Float32Array(count);
  const scale=new Float32Array(count);
  const vx=new Float32Array(count), vz=new Float32Array(count), vy=new Float32Array(count);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("strength",new THREE.BufferAttribute(strength,1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("size",new THREE.BufferAttribute(scale,1).setUsage(THREE.DynamicDrawUsage));
  const material=new THREE.ShaderMaterial({
    uniforms:{dust:{value:new THREE.Color(color)}},
    vertexShader:`attribute float strength;attribute float size;varying float a;void main(){
      a=strength;vec4 p=modelViewMatrix*vec4(position,1.);
      gl_Position=projectionMatrix*p;
      gl_PointSize=clamp(size*850./max(1.,-p.z),1.,76.);
    }`,
    fragmentShader:`uniform vec3 dust;varying float a;void main(){
      float d=length(gl_PointCoord-.5)*2.;
      gl_FragColor=vec4(dust,a*.27*pow(max(0.,1.-d),1.6));
      #include <colorspace_fragment>
    }`,
    transparent:true,depthWrite:false,
  });
  const particles=new THREE.Points(geometry,material);particles.frustumCulled=false;
  root.add(particles);
  let cursor=0,spawn=0;
  return (dt:number, high:boolean, state:PodVehicle, frame:PodTrackFrame, reduced:boolean)=>{
    particles.visible=high&&!reduced;
    if(!particles.visible){ strength.fill(0);return; }
    for(let i=0;i<count;i++){
      if(strength[i]<=0)continue;
      positions[3*i]+=vx[i]*dt;positions[3*i+1]+=vy[i]*dt;positions[3*i+2]+=vz[i]*dt;
      scale[i]+=dt*1.6;strength[i]=Math.max(0,strength[i]-dt*.66);
    }
    spawn+=Math.min(2,state.speed*.014)*dt*22;
    while(spawn>=1){
      spawn-=1; const i=cursor++%count;
      const p=at(frame,state.lane+(rng()-.5)*4.9,.36+rng()*.76);
      const tail=2+rng()*4;
      positions.set([p.x-Math.sin(frame.heading)*tail,p.y,p.z-Math.cos(frame.heading)*tail],i*3);
      vx[i]=(rng()-.5)*4;vz[i]=(rng()-.5)*4;vy[i]=.45+rng()*1.32;
      scale[i]=.54+rng()*1.29;strength[i]=.45+rng()*.51;
    }
    geometry.attributes.position.needsUpdate=true;
    geometry.attributes.strength.needsUpdate=true;
    geometry.attributes.size.needsUpdate=true;
  };
}

/** The raiders' lookout: a rock beside the course with two robed figures and their long rifles. */
function tuskenPosts(root: THREE.Group, track: PodTrack, rock: THREE.Material, tint: number, rng: () => number) {
  const robe = new THREE.MeshStandardMaterial({ color: 0x9c8468, roughness: 1 });
  const wraps = new THREE.MeshStandardMaterial({ color: 0xc4ae8c, roughness: .95 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2c2825, metalness: .5, roughness: .6 });
  const parts = new Map<THREE.Material, THREE.BufferGeometry[]>([[robe, []], [wraps, []], [iron, []]]);
  const add = (material: THREE.Material, geometry: THREE.BufferGeometry, matrix: THREE.Matrix4, x: number, y: number, z: number, rx = 0, rz = 0) => {
    const local = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(1, 1, 1));
    parts.get(material)!.push(geometry.applyMatrix4(matrix.clone().multiply(local)));
  };
  const rocks: RockBuffers = { p: [], c: [], i: [] };
  const color = new THREE.Color(tint);
  const muzzles = track.raiders.map((raider: PodRaider) => {
    const frame = track.sample(raider.distance);
    const lane = raider.side * (sideExtent(track, raider.distance, frame, raider.side) + 7);
    strata(rocks, at(frame, lane, -6.5), 4.2, 14, 7, color, rng);
    const top = at(frame, lane, 7);
    // Facing the oncoming pods, standing a little taller than life so they read at racing speed.
    const facing = frame.heading + Math.PI;
    let muzzle = top;
    for (const offset of [-1.15, 1.15]) {
      const matrix = new THREE.Matrix4().compose(
        at(frame, lane + offset, 7),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, facing, 0)),
        new THREE.Vector3(2.1, 2.1, 2.1),
      );
      add(robe, new THREE.CylinderGeometry(.14, .4, 1.25, 8), matrix, 0, .62, 0);
      add(robe, new THREE.BoxGeometry(.2, .55, .2), matrix, -.24, 1.02, .16, -.9);
      add(robe, new THREE.BoxGeometry(.2, .55, .2), matrix, .24, 1.02, .16, -.9);
      add(wraps, new THREE.SphereGeometry(.21, 9, 7), matrix, 0, 1.42, 0);
      add(wraps, new THREE.ConeGeometry(.1, .2, 6), matrix, 0, 1.64, -.02);
      add(iron, new THREE.BoxGeometry(.3, .07, .08), matrix, 0, 1.46, .18);
      add(iron, new THREE.CylinderGeometry(.03, .035, .16, 6), matrix, -.06, 1.3, .2, 1.57);
      add(iron, new THREE.CylinderGeometry(.03, .035, .16, 6), matrix, .06, 1.3, .2, 1.57);
      add(iron, new THREE.BoxGeometry(.06, .06, 1.5), matrix, 0, 1.22, .62);
      muzzle = new THREE.Vector3(0, 1.22, 1.35).applyMatrix4(matrix);
    }
    return muzzle;
  });
  if (rocks.i.length) root.add(new THREE.Mesh(buffer(rocks.p, rocks.c, rocks.i), rock));
  for (const [material, geometries] of parts) {
    if (!geometries.length) continue;
    const merged = mergeGeometries(geometries);
    geometries.forEach((geometry) => geometry.dispose());
    if (merged) root.add(new THREE.Mesh(merged, material));
  }
  return muzzles;
}

/** What a shot shows: the mark where it will land, the tracer, then a burst of sand. */
function shotEffects(root: THREE.Group, track: PodTrack, muzzles: THREE.Vector3[], sandColor: number) {
  const mark = new THREE.MeshBasicMaterial({ color: 0xff5a36, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  // A mark on the ground nearly vanishes at a racing camera's low angle: a column shows it from afar.
  const column = new THREE.MeshBasicMaterial({ color: 0xff4a2a, transparent: true, opacity: .15, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
  const columnGeometry = new THREE.CylinderGeometry(1, 1, 18, 20, 1, true).translate(0, 9, 0);
  const tracer = new THREE.MeshBasicMaterial({ color: 0xffd08a, toneMapped: false });
  const flash = new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, depthWrite: false, toneMapped: false });
  const markGeometry = new THREE.RingGeometry(.72, 1, 36).rotateX(-Math.PI / 2);
  const tracerGeometry = new THREE.CylinderGeometry(.09, .09, 7, 6).rotateX(Math.PI / 2);
  const burstGeometry = new THREE.SphereGeometry(1, 12, 8);
  const slots = Array.from({ length: 6 }, () => {
    const ring = new THREE.Mesh(markGeometry, mark);
    const beam = new THREE.Mesh(columnGeometry, column);
    const bolt = new THREE.Mesh(tracerGeometry, tracer);
    const burst = new THREE.Mesh(burstGeometry, new THREE.MeshBasicMaterial({ color: sandColor, transparent: true, depthWrite: false }));
    const muzzle = new THREE.Mesh(burstGeometry, flash);
    ring.visible = beam.visible = bolt.visible = burst.visible = muzzle.visible = false;
    ring.renderOrder = 3;
    root.add(ring, beam, bolt, burst, muzzle);
    return { ring, beam, bolt, burst, muzzle, id: -1, age: 1 };
  });
  const from = new THREE.Vector3(), to = new THREE.Vector3();
  return (shots: PodShot[], time: number, dt: number, reduced: boolean) => {
    for (const slot of slots) {
      const shot = shots.find((candidate) => candidate.id === slot.id);
      if (slot.id !== -1 && !shot) {
        // Landed: the slot turns into a burst of sand where the shot came down.
        slot.id = -1;
        slot.age = 0;
        slot.burst.position.copy(slot.ring.position);
        slot.ring.visible = slot.beam.visible = slot.bolt.visible = slot.muzzle.visible = false;
      }
      if (slot.age < .5) {
        slot.age += dt;
        const k = Math.min(1, slot.age / .5);
        slot.burst.visible = true;
        slot.burst.scale.setScalar(reduced ? 3 : 1.2 + k * 4.5);
        (slot.burst.material as THREE.MeshBasicMaterial).opacity = (1 - k) * .75;
      } else slot.burst.visible = false;
    }
    for (const shot of shots) {
      let slot = slots.find((candidate) => candidate.id === shot.id);
      if (!slot) {
        slot = slots.find((candidate) => candidate.id === -1);
        if (!slot) continue;
        slot.id = shot.id;
      }
      const frame = track.sample(shot.distance);
      const k = THREE.MathUtils.clamp((time - shot.firedAt) / (shot.impactAt - shot.firedAt), 0, 1);
      to.copy(at(frame, shot.lane, .42));
      slot.ring.visible = true;
      slot.ring.position.copy(to);
      // The mark closes in on the pod's real danger zone as the shot arrives.
      slot.ring.scale.setScalar((shot.radius + 2.1) * (1 + (1 - k) * .9));
      mark.opacity = .95;
      slot.beam.visible = true;
      slot.beam.position.copy(to);
      slot.beam.scale.set(slot.ring.scale.x, 1, slot.ring.scale.x);
      from.copy(muzzles[shot.raider]);
      slot.muzzle.visible = !reduced && k < .12;
      slot.muzzle.position.copy(from);
      slot.muzzle.scale.setScalar(.9);
      slot.bolt.visible = true;
      slot.bolt.position.lerpVectors(from, to, k);
      slot.bolt.lookAt(to);
    }
  };
}

/** Same coordinates and obstacle motion as the fixed-step simulator. */
export function createPodWorld(scene: THREE.Scene, track: PodTrack, opponents: PodVehicle[], ghost: boolean, pod?: { module: PodModuleId; color: number }) {
  const root=new THREE.Group();
  root.name = "podracing-world";
  const oldFog = scene.fog;
  const palette=palettes[track.light];
  scene.fog=new THREE.FogExp2(palette.horizon,track.light==="night"?.0034:.00235);
  const rng=random(track.id==="boonta"?1977:track.id==="jawa"?1983:1980);
  const sky=makeSky(track);root.add(sky);
  const hemi=new THREE.HemisphereLight(track.light==="night"?0xb0cbff:0xffe5ce,0x9c7057,track.light==="night"?1.1:1.76);
  const sun=new THREE.DirectionalLight(palette.sun,palette.light);
  sun.position.set(-31,55,42);
  root.add(hemi,sun);
  const sand=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,map:sandTexture()});
  const rock=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.97,side:THREE.DoubleSide});
  const stone=new THREE.MeshStandardMaterial({color:track.light==="night"?0xb5a296:0xcab28f,roughness:.87});
  const casing=new THREE.MeshStandardMaterial({color:0x645d58,metalness:.34,roughness:.68});
  const dark=new THREE.MeshStandardMaterial({color:0x35312c,roughness:.81});
  const orange=new THREE.MeshStandardMaterial({color:0xe3a755,emissive:0x9e632e,emissiveIntensity:.48,roughness:.61});
  const lamp=new THREE.MeshBasicMaterial({color:track.light==="night"?0x8ef0fb:0xffd4a0,toneMapped:false});
  const strip=new THREE.MeshBasicMaterial({color:0x9af6f1,toneMapped:false});
  desertGround(root,track,sand,palette.sand);
  for(let d=0;d<track.length;d+=125)root.add(drawRibbon(track,sand,d,Math.min(track.length,d+125),palette.sand));
  for(const branch of track.branches)root.add(drawRibbon(track,sand,branch.start,branch.end,palette.sand,branch));
  routeMarks(root, track, track.pads, casing, .13);
  const litRungs: PodPad[] = [];
  for (const pad of track.pads) {
    for (let d = pad.start + 2; d < pad.end - 1; d += 4.8) {
      litRungs.push({ start: d, end: d + .78, lane: pad.lane, width: pad.width * .83 });
    }
  }
  routeMarks(root, track, litRungs, strip, .16);
  rockScenery(root,track,rock,palette.rock,rng);
  tunnels(root,track,rock,lamp,palette.rock);
  stadium(root,track,stone,casing,dark,lamp,rng);
  rails(root,track,orange,casing,lamp);
  const hazards=track.hazards.map((hazard)=>{
    const object=buildHazard(hazard,rock,casing,orange);
    const frame=track.sample(hazard.distance);
    root.add(object);
    return {hazard,object,frame};
  });

  const muzzles=tuskenPosts(root,track,rock,palette.rock,rng);
  const shots=shotEffects(root,track,muzzles,palette.sand);
  const player=createPodModel(pod?.color??0x326bc9,false,pod?.module);
  const rivals=opponents.map((vehicle)=>createPodModel(vehicle.color,false,vehicle.module));
  const ghostModel=ghost?createPodModel(0x79dfff,true):null;
  player.root.name = "podracing-player";
  root.add(player.root,...rivals.map((r)=>r.root));
  if(ghostModel){ghostModel.root.visible=false;root.add(ghostModel.root);}
  const shadows=Array.from({length:opponents.length+1},shadow);
  root.add(...shadows);
  const dust=dustLayer(root,palette.sand,rng);
  scene.add(root);
  let high=true,disposed=false;
  const place=(vehicle:PodVehicle,model:ReturnType<typeof createPodModel>,time:number,reduced:boolean,index:number,visible:boolean)=>{
    model.root.visible=visible;
    shadows[index].visible=visible;
    const f=track.sample(vehicle.distance);
    if(visible){
      const pitch=track.sample(vehicle.distance+2).y-track.sample(vehicle.distance-2).y;
      const bob=reduced?0:Math.sin(time*8.1+index*1.3)*.09;
      model.root.position.copy(at(f,vehicle.lane,hoverHeight+bob));
      model.root.rotation.set(-Math.atan2(pitch,4),f.heading+THREE.MathUtils.clamp(vehicle.lateral*.012,-.18,.18),reduced?0:vehicle.roll,"YXZ");
      model.update(vehicle,time,reduced);
      shadows[index].position.copy(at(f,vehicle.lane,.16));
      shadows[index].rotation.set(-Math.PI/2,0,f.heading);
    }
    return f;
  };
  return {
    update(state:PodRaceState,dt:number,reduced:boolean,ghostFrame?:GhostFrame){
      if(disposed)return;
      const time=state.time;
      const f=place(state.player,player,time,reduced,0,true);
      sky.position.set(f.x,f.y+4,f.z);
      state.opponents.forEach((vehicle,i)=>{
        const sample=track.sample(vehicle.distance);
        const near=(sample.x-f.x)**2+(sample.z-f.z)**2<(high?390:215)**2;
        if(rivals[i]) place(vehicle,rivals[i],time,reduced,i+1,near);
      });
      for(const {hazard,object,frame} of hazards){
        object.position.copy(at(frame,hazardLane(hazard,time),hazard.kind==="sweeper" && !reduced?Math.sin(time*3+hazard.phase)*.14:0));
        object.rotation.y=frame.heading+(hazard.kind==="sweeper" ? 0 : .38);
      }
      if(ghostModel){
        ghostModel.root.visible=!!ghostFrame;
        if(ghostFrame){
          const frame=track.sample(ghostFrame.distance);
          ghostModel.root.position.copy(at(frame,ghostFrame.lane,hoverHeight+.18));
          ghostModel.root.rotation.y=frame.heading;
        }
      }
      dust(dt,high,state.player,f,reduced);
      shots(state.shots,time,dt,reduced);
    },
    setQuality(quality:"low"|"high"){high=quality==="high";},
    dispose(){
      if(disposed)return;
      disposed=true;
      root.removeFromParent();
      scene.fog=oldFog;
      const geometry=new Set<THREE.BufferGeometry>();
      const materials=new Set<THREE.Material>();
      root.traverse((object)=>{
        if(object instanceof THREE.Mesh || object instanceof THREE.Points){
          if (object instanceof THREE.InstancedMesh) object.dispose();
          geometry.add(object.geometry);
          const list=Array.isArray(object.material)?object.material:[object.material];
          list.forEach((m)=>materials.add(m));
        }
      });
      const textures=new Set<THREE.Texture>();
      materials.forEach((material)=>{
        Object.values(material).forEach((value)=>{if(value instanceof THREE.Texture)textures.add(value);});
        material.dispose();
      });
      geometry.forEach((g)=>g.dispose());
      textures.forEach((t)=>t.dispose());
    },
  };
}
