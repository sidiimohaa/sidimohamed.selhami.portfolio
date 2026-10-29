import * as THREE from "three";
import { bakePart, part, pipe, rounded } from "./tatooineCharacters";

type XYZ = [number, number, number];

function chippedPaint() {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#d8cfb9"; c.fillRect(0, 0, 512, 512);
  let seed = 3494; const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 700; i++) {
    const x = rand() * 512, y = rand() * 512, w = 1 + rand() * 9, h = 1 + rand() * 5;
    c.fillStyle = i % 3 ? "#4d443228" : "#f5e5b2a0";
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y - 1); c.lineTo(x + w * .8, y + h); c.lineTo(x + 1, y + h * .6); c.fill();
  }
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; return map;
}

function materials(color: number) {
  const map = chippedPaint();
  return {
    paint: new THREE.MeshStandardMaterial({ color, map, roughness: .61, metalness: .25 }),
    cream: new THREE.MeshStandardMaterial({ color: 0xe5d4b3, map, roughness: .68, metalness: .15 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x252a27, roughness: .82 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x7b827d, roughness: .47, metalness: .72 }),
    signal: new THREE.MeshBasicMaterial({ color: 0x9acbd2 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xa4c3c5, transparent: true, opacity: .29, roughness: .18, metalness: .12, side: THREE.DoubleSide, depthWrite: false }),
  };
}

function hullShape() {
  const s = new THREE.Shape(); s.moveTo(-.77, -1.52); s.lineTo(.77, -1.52); s.lineTo(.83, .68);
  s.bezierCurveTo(.83, 1.29, .55, 1.68, 0, 1.68); s.bezierCurveTo(-.55, 1.68, -.83, 1.29, -.83, .68); s.closePath(); return s;
}

function extrudeHull(parent: THREE.Group, shape: THREE.Shape, height: number, top: number, material: THREE.Material) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: true, bevelSize: .035, bevelThickness: .025, bevelSegments: 2, curveSegments: 24 });
  g.rotateX(Math.PI / 2); g.translate(0, top, 0);
  const p = g.getAttribute("position"), uv = g.getAttribute("uv");
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 1.3) / 2.6, (p.getZ(i) + 1.8) / 3.6);
  return part(parent, g, material);
}

function engine(parent: THREE.Group, at: XYZ, radius: number, length: number, mats: ReturnType<typeof materials>) {
  const [x, y, z] = at;
  part(parent, new THREE.CylinderGeometry(radius * .91, radius, length, 24), mats.steel, [x, y, z], [Math.PI / 2, 0, 0]);
  part(parent, new THREE.CylinderGeometry(radius * 1.04, radius * 1.04, length * .58, 24), mats.paint, [x, y, z + length * .05], [Math.PI / 2, 0, 0]);
  for (const dz of [-length / 2, length / 2]) {
    part(parent, new THREE.TorusGeometry(radius * .98, .025, 8, 24), mats.cream, [x, y, z + dz]);
    part(parent, new THREE.CircleGeometry(radius * .79, 24), mats.dark, [x, y, z + dz + Math.sign(dz) * .007], [0, dz < 0 ? Math.PI : 0, 0]);
    part(parent, new THREE.TorusGeometry(radius * .56, .018, 6, 20), mats.steel, [x, y, z + dz + Math.sign(dz) * .012]);
  }
}

function windscreen(parent: THREE.Group, mats: ReturnType<typeof materials>, width: number, y: number, z: number) {
  const p: number[] = [], uv: number[] = [], indices: number[] = [], top: XYZ[] = [];
  const rows = 4, columns = 24;
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
    const u = col / columns, v = row / rows, angle = (u * 2 - 1) * 1.05;
    const x = Math.sin(angle) / Math.sin(1.05) * width / 2, dz = .22 * Math.cos(angle) - v * .09;
    p.push(x, y + v * .29, z + dz); uv.push(u, v);
    if (row === rows) top.push([x, y + .29, z + dz]);
    if (row < rows && col < columns) { const a = row * (columns + 1) + col; indices.push(a, a + 1, a + columns + 1, a + 1, a + columns + 2, a + columns + 1); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals();
  part(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(top.map(p=>new THREE.Vector3(...p))), 32, .012, 5, false), mats.steel);
  for (const side of [-1, 1]) pipe(parent, [[side * width / 2, y, z + .11], [side * width / 2, y + .29, z + .02]], .014, mats.steel);
  return new THREE.Mesh(g, mats.glass);
}

/** X-34 proportions stay inside the existing traffic and checkpoint collider envelope. */
export function createLandspeeder(color = 0xae6555) {
  const group = new THREE.Group(); group.name = "x34-landspeeder";
  const m = materials(color), shape = hullShape();
  const cockpit = new THREE.Path(); cockpit.absellipse(0, -.53, .676, .63, 0, Math.PI * 2, true, 0); shape.holes.push(cockpit);
  extrudeHull(group, shape, .32, .75, m.paint);
  part(group, rounded(1.32, .09, 1.29, .04), m.dark, [0, .49, -.53]);
  const hood = new THREE.Shape(); hood.moveTo(-.69, .18); hood.lineTo(.69, .18); hood.lineTo(.69, .7);
  hood.bezierCurveTo(.69, 1.22, .43, 1.49, 0, 1.49); hood.bezierCurveTo(-.43, 1.49, -.69, 1.22, -.69, .7); hood.closePath();
  extrudeHull(group, hood, .028, .782, m.cream);
  pipe(group, [[-.55,.801,.28],[-.58,.801,.9],[-.34,.801,1.32],[0,.801,1.4],[.34,.801,1.32],[.58,.801,.9],[.55,.801,.28]], .014, m.paint);
  const grilleCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-.86,0,-.05),new THREE.Vector3(-.86,0,.74),new THREE.Vector3(-.62,0,1.46),new THREE.Vector3(0,0,1.735),new THREE.Vector3(.62,0,1.46),new THREE.Vector3(.86,0,.74),new THREE.Vector3(.86,0,-.05)]);
  const points = grilleCurve.getPoints(48), p: number[] = [], uv: number[] = [], ix: number[] = [];
  points.forEach((v,i)=>{p.push(v.x,.435,v.z,v.x,.615,v.z);uv.push(i/48,0,i/48,1);if(i<48){const a=i*2;ix.push(a,a+2,a+1,a+1,a+2,a+3);}});
  const grille = new THREE.BufferGeometry();grille.setAttribute("position",new THREE.Float32BufferAttribute(p,3));grille.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));grille.setIndex(ix);grille.computeVertexNormals();
  part(group,grille,m.dark);
  for(let line=0;line<6;line++)part(group,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(v.x,.45+line*.028,v.z+.005))),48,.005,4,false),m.steel);
  for(const x of[-.34,.34]){
    part(group,rounded(.53,.13,.56,.055),m.dark,[x,.646,-.56]);
    part(group,rounded(.53,.4,.12,.05),m.dark,[x,.87,-.96],[-.09,0,0]);
    for(const dx of[-.19,.19])part(group,new THREE.BoxGeometry(.018,.28,.015),m.steel,[x+dx,.88,-.89]);
  }
  part(group,rounded(1.22,.13,.18,.025),m.paint,[0,.795,.055]);
  part(group,rounded(.3,.08,.014,.008),m.dark,[-.34,.867,.094],[-.35,0,0]);
  for(let i=0;i<3;i++)part(group,new THREE.BoxGeometry(.04,.015,.01),m.signal,[-.42+i*.07,.868,.105]);
  part(group,new THREE.TorusGeometry(.12,.015,6,20),m.dark,[-.34,.87,-.12],[.5,0,0]);
  for(const side of[-1,1]){
    part(group,rounded(.23,.1,.67,.04),m.cream,[side*.88,.71,-.81]);
    engine(group,[side*1.01,.7,-1.02],.23,1.24,m);
  }
  part(group,rounded(.24,.38,.33,.045),m.paint,[0,.91,-1.36]);engine(group,[0,1.19,-1.15],.205,1.06,m);
  const glass = windscreen(group,m,1.32,.81,.2);
  bakePart(group);group.add(glass);return group;
}

/** A second, fork-nosed local speeder breaks up the traffic silhouettes. */
export function createDesertSpeeder(color = 0xd7aa3e) {
  const group=new THREE.Group();group.name="forked-desert-speeder";const m=materials(color);
  const shape=new THREE.Shape();
  [[-.73,-1.55],[.73,-1.55],[.87,-.25],[.82,.6],[.62,1.68],[.34,1.5],[.25,.45],[-.25,.45],[-.34,1.5],[-.62,1.68],[-.82,.6],[-.87,-.25]].forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();
  const hole=new THREE.Path();hole.absellipse(0,-.55,.55,.58,0,Math.PI*2,true);shape.holes.push(hole);
  extrudeHull(group,shape,.3,.76,m.paint);
  part(group,rounded(1.08,.1,1.15,.03),m.dark,[0,.49,-.55]);
  part(group,rounded(.57,.12,.5,.05),m.dark,[0,.66,-.61]);part(group,rounded(.58,.42,.1,.04),m.cream,[0,.89,-1.02]);
  part(group,rounded(.83,.15,.19,.025),m.steel,[0,.81,.02]);
  part(group,rounded(.27,.065,.025,.005),m.signal,[0,.9,.12]);
  for(const side of[-1,1]){
    pipe(group,[[side*.74,.8,-1.15],[side*.76,.8,-.2],[side*.64,.8,.7],[side*.48,.8,1.45]],.045,m.cream);
    pipe(group,[[side*.57,.81,-1.12],[side*.6,.81,-.15],[side*.5,.81,.6],[side*.43,.81,1.38]],.018,m.steel);
    part(group,rounded(.27,.07,.15,.025),m.steel,[side*.57,.68,1.48]);
    part(group,rounded(.16,.035,.02,.005),m.signal,[side*.57,.7,1.57]);
    engine(group,[side*.64,.75,-1.16],.255,1.0,m);
    for(let vent=0;vent<5;vent++)part(group,new THREE.BoxGeometry(.09,.02,.035),m.dark,[side*.72,.827,-.9+vent*.11]);
  }
  pipe(group,[[-.12,.87,-.2],[0,.91,-.13],[.12,.87,-.2]],.016,m.dark);
  const glass=windscreen(group,m,1.0,.82,.1);bakePart(group);group.add(glass);return group;
}
