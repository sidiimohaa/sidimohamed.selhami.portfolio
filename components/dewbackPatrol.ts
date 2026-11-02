import * as THREE from "three";
import { bakePart, createSandtrooper, part, pipe, rounded } from "./tatooineCharacters";
type XYZ = [number, number, number];

function scaleTexture() {
  const canvas=document.createElement("canvas");canvas.width=canvas.height=512;const c=canvas.getContext("2d")!;
  c.fillStyle="#b2bd94";c.fillRect(0,0,512,512);let seed=1979;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  for(let row=-1;row<39;row++)for(let col=-1;col<35;col++){
    const x=col*16+(row%2)*8,y=row*14,r=6+rand()*2;
    c.fillStyle=["#b2bd94","#9fac83","#c1c89d","#8d9c74"][Math.floor(rand()*4)];c.strokeStyle="#53624580";c.lineWidth=1.2;
    c.beginPath();for(let k=0;k<6;k++){const a=k*Math.PI/3;c.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r*.85);}c.closePath();c.fill();c.stroke();
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(2,1.5);map.anisotropy=8;return map;
}

/** Dewback with a low broad head, heavy belly and a seated sandtrooper. */
export function createDewbackModel() {
  const group=new THREE.Group();group.name="dewback";
  const map=scaleTexture();
  const hide=new THREE.MeshStandardMaterial({color:0x89956b,map,bumpMap:map,bumpScale:.042,roughness:.9});
  const belly=new THREE.MeshStandardMaterial({color:0xa2a27a,map,bumpMap:map,bumpScale:.018,roughness:.98});
  const dark=new THREE.MeshStandardMaterial({color:0x343b2a,roughness:.9});
  const leather=new THREE.MeshStandardMaterial({color:0x503c29,roughness:.89});
  const brass=new THREE.MeshStandardMaterial({color:0x8a8064,roughness:.65,metalness:.45});
  const eye=new THREE.MeshStandardMaterial({color:0xc8ac53,roughness:.3});
  const body=new THREE.Group();body.name="dewback-body";group.add(body);
  part(body,new THREE.SphereGeometry(1,32,22),hide,[0,1.3,-.15]).scale.set(.85,.73,1.56);
  part(body,new THREE.SphereGeometry(1,28,18),belly,[0,1.02,.06]).scale.set(.76,.57,1.29);
  part(body,new THREE.SphereGeometry(1,24,18),hide,[0,1.34,1.02]).scale.set(.67,.65,.76);
  for(const z of[-1.12,-.66,-.2,.26,.72]){
    const s=part(body,new THREE.SphereGeometry(.16,12,8),hide,[0,1.99-Math.abs(z+.1)*.09,z]);s.scale.set(1,.3,1.3);
  }
  // A fitted leather pad, raised saddle pommel, straps, stirrups and field bags.
  part(body,rounded(.72,.14,.94,.08),leather,[0,2.01,.08]);
  part(body,rounded(.68,.17,.15,.045),leather,[0,2.14,.51]);
  part(body,rounded(.67,.19,.15,.05),leather,[0,2.13,-.41]);
  for(const side of[-1,1]){
    pipe(body,[[side*.3,2.03,.18],[side*.72,1.78,.18],[side*.78,1.2,.18],[side*.58,.75,.18]],.032,leather);
    part(body,rounded(.34,.47,.43,.07),leather,[side*.85,1.77,-.55],[0,0,side*.12]);
    part(body,rounded(.36,.09,.44,.035),leather,[side*.86,2.0,-.55],[0,0,side*.12]);
    for(const z of[-.68,-.4])part(body,rounded(.035,.24,.025,.003),brass,[side*1.02,1.78,z]);
    part(body,new THREE.TorusGeometry(.12,.017,6,18),brass,[side*.87,1.4,.28],[0,Math.PI/2,0]).scale.y=1.3;
  }
  bakePart(body);
  const head=new THREE.Group();head.name="dewback-head";head.position.set(0,1.0,1.48);body.add(head);
  part(head,new THREE.SphereGeometry(1,32,20),hide,[0,.02,.52]).scale.set(.54,.43,.79);
  part(head,new THREE.SphereGeometry(1,24,14),belly,[0,-.225,.66]).scale.set(.46,.18,.58);
  for(const side of[-1,1]){
    part(head,new THREE.SphereGeometry(.105,16,10),hide,[side*.458,.185,.48]).scale.set(1,.63,1.3);
    part(head,new THREE.SphereGeometry(.049,16,10),eye,[side*.495,.174,.535]).scale.set(.45,.8,1);
    part(head,new THREE.SphereGeometry(.027,12,8),dark,[side*.51,.178,.55]).scale.set(.37,1,1);
    part(head,new THREE.SphereGeometry(.033,12,8),dark,[side*.244,-.018,1.238]).scale.set(1,.48,.2);
    pipe(head,[[side*.48,-.18,.35],[side*.43,-.238,.88],[side*.22,-.255,1.2],[0,-.25,1.245]],.012,dark);
    pipe(head,[[side*.43,.31,.1],[side*.53,.14,.27],[side*.51,-.12,.53],[side*.38,-.29,.62]],.025,leather);
    part(head,new THREE.TorusGeometry(.075,.013,6,20),brass,[side*.51,-.16,.63],[0,Math.PI/2,0]);
  }
  for(const z of[.04,.18,.32])pipe(head,[[-.47,-.03,z],[-.5,.13,z],[0,.4,z],[.5,.13,z],[.47,-.03,z]],.011,dark);
  bakePart(head);
  const legs=[[-.65,.93],[.65,.93],[-.65,-.99],[.65,-.99]].map(([x,z],i)=>{
    const hip=new THREE.Group();hip.position.set(x,1.12,z);group.add(hip);const side=Math.sign(x);
    part(hip,new THREE.SphereGeometry(1,20,14),hide,[side*.065,-.23,0]).scale.set(.29,.39,.36);
    part(hip,new THREE.CylinderGeometry(.245,.195,.39,16),hide,[side*.11,-.42,.025]);bakePart(hip);
    const knee=new THREE.Group();knee.position.set(side*.14,-.52,.04);hip.add(knee);
    part(knee,new THREE.SphereGeometry(.195,16,12),hide,[0,0,0]);
    part(knee,new THREE.CylinderGeometry(.183,.155,.35,16),hide,[0,-.18,.08]);bakePart(knee);
    const foot=new THREE.Group();foot.position.set(0,-.465,.15);knee.add(foot);
    part(foot,new THREE.SphereGeometry(1,20,12),hide,[0,-.015,.035]).scale.set(.26,.12,.35);
    for(let toe=0;toe<3;toe++){
      part(foot,new THREE.SphereGeometry(.093,12,8),hide,[-.17+toe*.17,-.025,.24]).scale.set(.8,.7,1.35);
      part(foot,new THREE.ConeGeometry(.035,.16,10),dark,[-.17+toe*.17,-.025,.375],[Math.PI/2,0,0]);
    }bakePart(foot);return {hip,knee,foot,phase:[0,.5,.75,.25][i]};
  });
  const tail:THREE.Group[]=[];let parent:THREE.Group=body;
  for(let i=0;i<4;i++){
    const segment=new THREE.Group();segment.position.set(0,i?-.14:1.22,i?-.39:-1.23);parent.add(segment);
    const radius=[.4,.29,.17,.075][i];
    part(segment,new THREE.CylinderGeometry(radius*.48,radius,.5,16),hide,[0,-.05,-.25],[-Math.PI/2-.18,0,0]);
    bakePart(segment);tail.push(segment);parent=segment;
  }
  const rider=createSandtrooper();rider.group.name="dewback-sandtrooper";rider.group.position.set(0,1.41,.32);body.add(rider.group);
  rider.blaster.visible=false;
  // Leather reins reach the rider's hands; the long patrol prod is held at the left glove.
  for(const side of[-1,1])pipe(body,[[side*.126,2.42,.62],[side*.27,2.2,1.0],[side*.46,1.22,2.11]],.012,leather);
  const pole=new THREE.Group();body.add(pole);
  pipe(pole,[[-.13,2.43,.38],[-.97,4.17,.79]],.015,dark);
  part(pole,new THREE.CylinderGeometry(.023,.023,.14,10),brass,[-.97,4.17,.79],[.2,0,.45]);bakePart(pole);
  pole.position.set(0,-.03,.24);
  const inverseHip=new THREE.Quaternion(),calfPose=new THREE.Quaternion(),calfEuler=new THREE.Euler();
  function tick(time:number,reduced:boolean){
    const cycle=reduced?0:time*.38;
    body.position.y=Math.sin(cycle*Math.PI*4)*.018;
    body.rotation.z=Math.sin(cycle*Math.PI*2)*.012;
    head.rotation.x=reduced?0:Math.sin(cycle*Math.PI*4)*.025;
    head.rotation.y=reduced?0:Math.sin(time*.18)*.055;
    for(const leg of legs){
      const phase=(cycle+leg.phase)%1,wave=Math.sin(phase*Math.PI*2);
      leg.hip.rotation.x=reduced?0:wave*.16;
      leg.knee.rotation.x=reduced?0:Math.max(0,-wave)*.22;
      leg.foot.rotation.x=-leg.hip.rotation.x-leg.knee.rotation.x;
    }
    tail.forEach((segment,i)=>segment.rotation.y=reduced?0:Math.sin(time*.65-i*.7)*.07);
    rider.tick(time,false,reduced);
    rider.legs.forEach((leg,i)=>{
      const side=i?1:-1;
      leg.position.x=side*.26;
      // Thighs point forward and slightly down over the saddle. The shins have their
      // own downward pose instead of inheriting the spread of the whole thigh.
      leg.rotation.set(-1.0,0,side*.75);
      inverseHip.copy(leg.quaternion).invert();
      calfEuler.set(.12,0,side*.36);calfPose.setFromEuler(calfEuler);
      rider.knees[i].quaternion.copy(inverseHip).multiply(calfPose);
    });
    rider.arms.forEach(arm=>arm.rotation.x=-.15);
  }
  tick(0,true);return {group,body,head,legs,rider,tick};
}

export function createDewbackPatrol(parent:THREE.Group,heightAt:(u:number,v:number)=>number){
  const root=new THREE.Group();root.name="dewback-patrol";const model=createDewbackModel();root.add(model.group);parent.add(root);let angle=1.2,elapsed=0;
  return (time:number,dt:number,reduced:boolean)=>{
    if(!reduced&&dt>0){const pace=Math.hypot(22*Math.cos(angle),6*Math.sin(angle));angle+=dt*1.1/pace;elapsed+=dt;}
    const u=8+22*Math.sin(angle),v=95+6*Math.cos(angle);
    root.position.set(u,heightAt(u,v),v);root.rotation.y=Math.atan2(22*Math.cos(angle),-6*Math.sin(angle));
    model.tick(elapsed,reduced);
  };
}
