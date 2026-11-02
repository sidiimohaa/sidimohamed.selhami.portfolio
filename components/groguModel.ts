import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { bakePart, part, pipe } from "./tatooineCharacters";

type XYZ = [number, number, number];

function woolFinish() {
  const canvas=document.createElement("canvas");canvas.width=canvas.height=128;
  const c=canvas.getContext("2d")!;c.fillStyle="#c8b99b";c.fillRect(0,0,128,128);
  let seed=50;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  for(let i=0;i<700;i++){c.fillStyle=i%3?"#fff3d015":"#463b2818";c.fillRect(rand()*128,rand()*128,.5,1+rand()*2);}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;return texture;
}

/** Rounded leaf volume with a raised inner ear, rather than a flat triangle. */
export function earGeometry(side:number,inset=false) {
  const outline:XYZ[]=[[.107,.02,-.005],[.151,.046,0],[.227,.071,-.008],[.312,.075,-.032],[.28,.023,-.006],[.22,-.023,.015],[.153,-.033,.031],[.112,-.011,.031]];
  const center=new THREE.Vector3(.192,.016,.034),positions:number[]=[],uvs:number[]=[],indices:number[]=[];
  const point=(p:THREE.Vector3)=>{positions.push(side*p.x,p.y,p.z);uvs.push((side*p.x+.32)/.64,(p.y+.13)/.26);};
  point(center.clone().setZ(inset?.044:.034));
  for(const tuple of outline){const p=new THREE.Vector3(...tuple);if(inset)p.lerp(center,.23).setZ(p.z+.009);point(p);}
  for(let i=0;i<outline.length;i++){const a=1+i,b=1+(i+1)%outline.length;indices.push(...(side===1?[0,b,a]:[0,a,b]));}
  if(!inset){
    const rear=positions.length/3;point(center.clone().setZ(-.029));
    for(const tuple of outline)point(new THREE.Vector3(...tuple).add(new THREE.Vector3(0,0,-.015)));
    for(let i=0;i<outline.length;i++){
      const a=rear+1+i,b=rear+1+(i+1)%outline.length,fa=1+i,fb=1+(i+1)%outline.length;
      indices.push(...(side===1?[rear,a,b,fa,fb,a,fb,b,a]:[rear,b,a,fa,a,fb,fb,a,b]));
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

/** Grogu sits directly on the booth cushion; coordinates face +Z with the floor at Y=0. */
export function createSeatedGrogu(seatHeight=.55) {
  const group=new THREE.Group();group.name="cantina-grogu";
  const skin=new THREE.MeshStandardMaterial({color:0x8caa7d,roughness:.83,metalness:.01});
  const innerEar=new THREE.MeshStandardMaterial({color:0xa59c84,roughness:.92,side:THREE.DoubleSide});
  const eyes=new THREE.MeshStandardMaterial({color:0x0b100a,roughness:.14,metalness:.14});
  const robeMap=woolFinish(),robe=new THREE.MeshStandardMaterial({color:0x9e8d70,map:robeMap,bumpMap:robeMap,bumpScale:.0025,roughness:1});
  const fur=new THREE.MeshStandardMaterial({color:0xc7bca4,roughness:1});
  const sphere=(p:THREE.Group,r:number,mat:THREE.Material,at:XYZ,scale:XYZ=[1,1,1],segments=20)=>{const mesh=part(p,new THREE.SphereGeometry(r,segments,14),mat,at);mesh.scale.set(...scale);return mesh;};

  const body=new THREE.Group();group.add(body);
  const fabric=new THREE.CylinderGeometry(.095,.14,.235,32,8),fp=fabric.getAttribute("position");
  for(let i=0;i<fp.count;i++){
    const x=fp.getX(i),z=fp.getZ(i),y=fp.getY(i),r=Math.hypot(x,z);if(r<.005)continue;
    const fold=1+Math.sin(Math.atan2(x,z)*11+.3)*(.018+(.12-y)*.13);fp.setXYZ(i,x*fold,y,z*fold);
  }
  fabric.computeVertexNormals();part(body,fabric,robe,[0,seatHeight+.13,.012]);
  part(body,new THREE.TorusGeometry(.129,.013,8,30),fur,[0,seatHeight+.025,.012],[Math.PI/2,0,0]).scale.z=.9;
  part(body,new THREE.TorusGeometry(.106,.036,12,32),fur,[0,seatHeight+.255,.015],[Math.PI/2,0,0]);
  // A second folded lip gives the oversized collar its soft, layered edge.
  pipe(body,[[-.105,seatHeight+.251,.081],[-.054,seatHeight+.232,.12],[0,seatHeight+.226,.128],[.055,seatHeight+.232,.12],[.105,seatHeight+.251,.081]],.012,fur);
  sphere(body,.047,robe,[-.067,seatHeight+.025,.102],[1,.55,1.25]);sphere(body,.047,robe,[.067,seatHeight+.025,.102],[1,.55,1.25]);
  bakePart(body);

  const head=new THREE.Group();head.name="grogu-head";head.position.set(0,seatHeight+.405,.015);group.add(head);
  sphere(head,.124,skin,[0,0,0],[1.17,.96,.98],32);
  sphere(head,.06,skin,[0,-.065,.042],[1.24,.57,1.13]);
  for(const side of[-1,1]){
    sphere(head,.031,skin,[side*.081,-.032,.089],[1.25,.85,.8]);
    const eye=sphere(head,.035,eyes,[side*.058,.009,.111],[1.2,.87,.58],24);eye.rotation.z=-side*.11;
    pipe(head,[[side*.018,.025,.117],[side*.046,.044,.126],[side*.078,.043,.119],[side*.104,.022,.099]],.008,skin);
    pipe(head,[[side*.02,-.006,.121],[side*.049,-.021,.132],[side*.077,-.018,.124],[side*.099,-.002,.11]],.005,skin);
  }
  sphere(head,.014,skin,[0,-.021,.13],[1.1,.64,.82]);
  pipe(head,[[-.025,-.054,.114],[0,-.058,.126],[.025,-.054,.114]],.0027,eyes);
  for(let wrinkle=0;wrinkle<3;wrinkle++){
    const y=.064+wrinkle*.015,w=.064-wrinkle*.012;
    pipe(head,[[-w,y,.088],[0,y+.008,.103],[w,y,.088]],.0025,skin);
  }
  // A few sparse wisps catch the warm cantina light over the crown.
  for(let i=0;i<4;i++)pipe(head,[[-.036+i*.022,.111,-.015],[-.04+i*.023,.132,-.018],[-.046+i*.025,.137,-.025]],.0009,fur);
  bakePart(head);

  const ears:THREE.Group[]=[];
  for(const side of[-1,1]){
    const ear=new THREE.Group();ear.name=side<0?"grogu-ear-left":"grogu-ear-right";head.add(ear);ears.push(ear);
    part(ear,earGeometry(side),skin);part(ear,earGeometry(side,true),innerEar);bakePart(ear);
  }
  const arms:THREE.Group[]=[];
  for(const side of[-1,1]){
    const arm=new THREE.Group();arm.position.set(side*.108,seatHeight+.216,.017);group.add(arm);
    arms.push(arm);
    const from=new THREE.Vector3(0,0,0),to=new THREE.Vector3(-side*.026,-.09,.071),sleeve=part(arm,new THREE.CylinderGeometry(.042,.052,from.distanceTo(to),16),robe);
    sleeve.position.copy(to).multiplyScalar(.5);sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),from.sub(to).normalize());
    part(arm,new THREE.TorusGeometry(.043,.01,7,18),fur,[-side*.026,-.087,.071],[-.65,0,0]);
    sphere(arm,.026,skin,[-side*.027,-.098,.09],[1,.68,.9]);
    for(let finger=0;finger<3;finger++)sphere(arm,.008,skin,[-side*.027+(finger-1)*.012,-.104,.111],[.8,.85,1.4],10);
    bakePart(arm);
  }
  group.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    const original=object.geometry;object.geometry=mergeVertices(original,1e-5);original.dispose();
  });
  const setForcePose=(amount:number)=>{
    const reach=THREE.MathUtils.clamp(amount,0,1);
    arms[0].rotation.set(-reach*1.08,0,-reach*.08);
    arms[1].rotation.set(-reach*.18,0,0);
  };
  return{group,head,arms,setForcePose,tick:(time:number,reduced:boolean)=>{
    const t=reduced?0:time;
    head.rotation.y=reduced?0:Math.sin(t*.37)*.13;
    head.rotation.z=reduced?0:Math.sin(t*.26+.8)*.035;
    head.rotation.x=reduced?0:Math.sin(t*.41)*.022;
    ears.forEach((ear,i)=>ear.rotation.z=reduced?0:Math.sin(t*.52+i*1.6)*.014);
    setForcePose(0);
  }};
}
