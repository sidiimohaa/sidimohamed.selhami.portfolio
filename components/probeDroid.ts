import * as THREE from "three";
import { bakePart, part, rounded } from "./tatooineCharacters";

export function createProbeDroid(){
  const group=new THREE.Group();group.name="coruscant-probe-droid";
  const shell=new THREE.MeshStandardMaterial({color:0x272e34,roughness:.42,metalness:.7});
  const black=new THREE.MeshStandardMaterial({color:0x0b1014,roughness:.58,metalness:.45});
  const edge=new THREE.MeshStandardMaterial({color:0x565c61,roughness:.5,metalness:.8});
  const lens=new THREE.MeshStandardMaterial({color:0xa71312,emissive:0xe12b1b,emissiveIntensity:1.1,roughness:.22,metalness:.3});
  const body=new THREE.Group();group.add(body);
  part(body,new THREE.LatheGeometry([[.06,.2],[.26,.18],[.42,.08],[.46,-.035],[.4,-.11],[.24,-.15],[.19,-.27],[.11,-.32]].map(p=>new THREE.Vector2(p[0],p[1])).reverse(),40),shell);
  part(body,new THREE.CylinderGeometry(.2,.2,.025,28),black,[0,.18,0]);
  for(const y of[-.065,-.035])part(body,new THREE.TorusGeometry(.445,.012,6,40),edge,[0,y,0],[Math.PI/2,0,0]);
  for(let vent=0;vent<24;vent++){
    const a=vent/24*Math.PI*2;
    part(body,new THREE.BoxGeometry(.012,.043,.03),black,[Math.sin(a)*.413,.065,Math.cos(a)*.413],[0,a,0]);
  }
  for(const [angle,radius] of[[0,.092],[-.7,.041],[.72,.04],[1.65,.031],[-1.8,.025]]){
    const r=.44,x=Math.sin(angle)*r,z=Math.cos(angle)*r;
    part(body,new THREE.TorusGeometry(radius+.013,.012,8,20),black,[x,-.01,z],[0,angle,0]);
    const eye=part(body,new THREE.SphereGeometry(radius,16,12),lens,[x,-.01,z],[0,angle,0]);eye.scale.set(1,1,.35);
  }
  for(const [x,z,height] of[[-.19,.02,.36],[.14,-.1,.25],[.02,-.18,.18]])part(body,new THREE.CylinderGeometry(.008,.014,height,7),edge,[x,.2+height/2,z],[.07,0,x*.3]);
  for(const angle of[-1.1,1.1,2.7])part(body,rounded(.075,.018,.025,.004),edge,[Math.sin(angle)*.45,-.07,Math.cos(angle)*.45],[0,angle,0]);
  bakePart(body);
  const arms:{upper:THREE.Group;lower:THREE.Group;offset:number}[]=[];
  for(let i=0;i<5;i++){
    const a=i/5*Math.PI*2,upper=new THREE.Group();upper.position.set(Math.sin(a)*.22,-.18,Math.cos(a)*.22);upper.rotation.y=a;group.add(upper);
    part(upper,new THREE.SphereGeometry(.049,12,8),edge);
    part(upper,new THREE.CylinderGeometry(.028,.019,.23,10),shell,[0,-.12,.04],[-.32,0,0]);
    part(upper,new THREE.BoxGeometry(.035,.18,.022),edge,[.027,-.12,.035],[-.32,0,0]);bakePart(upper);
    const lower=new THREE.Group();lower.position.set(0,-.23,.08);upper.add(lower);
    part(lower,new THREE.SphereGeometry(.035,10,8),black);
    part(lower,new THREE.CylinderGeometry(.016,.013,.28,8),black,[0,-.15,0]);
    for(const side of[-1,1])part(lower,new THREE.CylinderGeometry(.008,.005,.09,6),edge,[side*.024,-.32,0],[0,0,side*.35]);
    bakePart(lower);arms.push({upper,lower,offset:a});
  }
  return {group,tick:(time:number,reduced:boolean)=>{
    arms.forEach((arm,i)=>{arm.upper.rotation.x=.08+(reduced?0:Math.sin(time*1.2+arm.offset)*.09);arm.lower.rotation.x=.25+i%2*.3+(reduced?0:Math.sin(time*.9+arm.offset)*.1);});
    lens.emissiveIntensity=reduced?1:1+Math.sin(time*1.6)*.12;
  }};
}
