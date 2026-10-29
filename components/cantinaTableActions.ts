import * as THREE from "three";
import { bakePart, part } from "./tatooineCharacters";
import type { Landing } from "./universe";

type Grogu = {
  group: THREE.Group;
  head: THREE.Group;
  setForcePose?: (amount: number) => void;
};

const TABLE_REST = new THREE.Vector3(-8.02, .795, 67.14);
const GROGU_HOVER = new THREE.Vector3(-7.94, .975, 66.48);
const BENCH_REST = new THREE.Vector3(-7.73, .552, 66.36);
const LIFT = .65, CROSS = 1.1, HOLD = 1.4, LOWER = .65;
const DURATION = LIFT + CROSS + HOLD + CROSS + LOWER;
const ease = (t: number) => {
  const u = THREE.MathUtils.clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
};

/** Objects and gestures at Din and Grogu's table, in the district's local coordinates. */
export function createCantinaTableActions(grogu: Grogu) {
  const group = new THREE.Group(); group.name = "cantina-table-interactions";
  const steel = new THREE.MeshStandardMaterial({ color: 0x68747b, metalness: .77, roughness: .36 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b2930, metalness: .4, roughness: .57 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x78d6f2, toneMapped: false });

  const puck = new THREE.Group(); puck.name = "cantina-bounty-puck";
  puck.position.set(-8.55, .795, 67.45); group.add(puck);
  part(puck, new THREE.CylinderGeometry(.057,.063,.022,24),dark,[0,.011,0]);
  part(puck, new THREE.CylinderGeometry(.052,.057,.012,24),steel,[0,.028,0]);
  part(puck, new THREE.TorusGeometry(.037,.003,6,28),glow,[0,.035,0],[Math.PI/2,0,0]);
  part(puck, new THREE.CylinderGeometry(.014,.014,.003,16),glow,[0,.037,0]);
  for(let i=0;i<4;i++){
    const angle=i*Math.PI/2;
    const slot=part(puck,new THREE.BoxGeometry(.013,.003,.006),dark,[Math.sin(angle)*.042,.036,Math.cos(angle)*.042]);
    slot.rotation.y=angle;
  }
  bakePart(puck);
  const puckObjects:THREE.Object3D[]=[];puck.traverse(o=>{if(o instanceof THREE.Mesh)puckObjects.push(o);});

  // The puck projects the chosen project as a bounty dossier, turned towards the visitor's seat.
  const projection = new THREE.Group(); projection.name="bounty-puck-projection";
  projection.position.copy(puck.position); projection.rotation.y=1.78; projection.visible=false; group.add(projection);
  const holo={transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,side:THREE.DoubleSide} as const;
  const beamMaterial=new THREE.MeshBasicMaterial({color:0x4fc5eb,opacity:.09,...holo});
  part(projection,new THREE.CylinderGeometry(.24,.03,.27,24,1,true),beamMaterial,[0,.175,0]).scale.z=.25;
  const canvas=document.createElement("canvas");canvas.width=640;canvas.height=400;
  const dossier=new THREE.CanvasTexture(canvas);dossier.colorSpace=THREE.SRGBColorSpace;dossier.anisotropy=8;
  const card=part(projection,new THREE.PlaneGeometry(.5,.3125),new THREE.MeshBasicMaterial({map:dossier,color:0xa8e4ff,opacity:.9,...holo}),[0,.47,0]) as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
  const emblem=part(projection,new THREE.IcosahedronGeometry(.03,0),new THREE.MeshBasicMaterial({color:0xffb36b,wireframe:true,opacity:.8,...holo}),[.2,.66,0]);
  const wrap=(c:CanvasRenderingContext2D,text:string,width:number)=>{
    const lines:string[]=[];let line="";
    for(const word of text.split(" ")){const next=line?`${line} ${word}`:word;if(c.measureText(next).width>width&&line){lines.push(line);line=word;}else line=next;}
    if(line)lines.push(line);return lines;
  };
  const present=(project:Landing["terminals"][number],index:number,count:number)=>{
    const c=canvas.getContext("2d")!;
    c.clearRect(0,0,640,400);
    c.fillStyle="rgba(60,160,220,.16)";c.fillRect(0,0,640,400);
    c.strokeStyle="#9fe6ff";c.lineWidth=5;c.strokeRect(10,10,620,380);
    // A target reticle stands in for the bounty's portrait.
    c.strokeStyle="#ffb36b";c.lineWidth=4;
    c.beginPath();c.arc(108,152,62,0,Math.PI*2);c.stroke();
    c.beginPath();c.arc(108,152,24,0,Math.PI*2);c.stroke();
    for(const [x,y,dx,dy] of [[108,70,0,1],[108,234,0,-1],[26,152,1,0],[190,152,-1,0]]){c.beginPath();c.moveTo(x,y);c.lineTo(x+dx*30,y+dy*30);c.stroke();}
    c.fillStyle="#ffb36b";c.font="26px SFMono-Regular, Consolas, monospace";
    c.fillText(`PRIME 0${index+1}/0${count}`,210,64);
    c.fillStyle="#e9f9ff";c.font="bold 46px Arial, Helvetica, sans-serif";
    wrap(c,project.heading,400).slice(0,2).forEach((line,i)=>c.fillText(line,210,120+i*50));
    c.fillStyle="#bfeeff";c.font="24px Arial, Helvetica, sans-serif";
    wrap(c,project.body,580).slice(0,2).forEach((line,i)=>c.fillText(line,30,282+i*32));
    c.fillStyle="#7fd0f0";c.font="22px SFMono-Regular, Consolas, monospace";
    if(project.meta)c.fillText(project.meta.toUpperCase(),210,224);
    c.fillText("DOSSIER COMPLET TRANSMIS",30,370);
    c.fillStyle="rgba(0,0,0,.32)";for(let y=0;y<400;y+=5)c.fillRect(0,y,640,2);
    dossier.needsUpdate=true;
  };

  const bowl = new THREE.Group(); bowl.name="grogu-force-bowl"; bowl.position.copy(TABLE_REST); group.add(bowl);
  const ceramic=new THREE.MeshStandardMaterial({color:0xa98b60,roughness:.63,metalness:.09});
  const rim=new THREE.MeshStandardMaterial({color:0x645846,roughness:.54,metalness:.25});
  const food=new THREE.MeshStandardMaterial({color:0x6b7051,roughness:.95});
  const profile=[[0,.003],[.042,.003],[.062,.023],[.072,.06],[.071,.068],[.063,.068],[.057,.03],[.039,.015],[0,.015]].map(([r,y])=>new THREE.Vector2(r,y));
  part(bowl,new THREE.LatheGeometry(profile,24),ceramic);
  part(bowl,new THREE.TorusGeometry(.068,.003,6,28),rim,[0,.066,0],[Math.PI/2,0,0]);
  for(let i=0;i<5;i++){
    const angle=i*2.4;
    part(bowl,new THREE.IcosahedronGeometry(.013+(i%2)*.003,1),food,[Math.sin(angle)*.032,.049+(i%2)*.008,Math.cos(angle)*.032]);
  }
  bakePart(bowl);
  const groguObjects:THREE.Object3D[]=[];
  grogu.group.traverse(o=>{if(o instanceof THREE.Mesh)groguObjects.push(o);});
  bowl.traverse(o=>{if(o instanceof THREE.Mesh)groguObjects.push(o);});

  let clock=0,startedAt=0,active=false,projectionUntil=-1;
  const origin=TABLE_REST.clone(),raisedOrigin=TABLE_REST.clone();
  const settleOnBench=()=>{
    active=false;bowl.position.copy(BENCH_REST);bowl.rotation.set(0,0,0);grogu.setForcePose?.(0);
  };
  const actions=[
    {
      id:"bounty" as const,
      label:"Palet de prime",
      position:new THREE.Vector3(-8.55,.92,67.45),
      objects:puckObjects,
      present,
      activate:(_reduced:boolean)=>{projectionUntil=clock+14;projection.visible=true;},
    },
    {
      id:"grogu" as const,
      label:"Grogu · la Force",
      position:new THREE.Vector3(-7.94,.99,66.2),
      objects:groguObjects,
      activate:(reduced:boolean)=>{
        if(reduced){settleOnBench();return;}
        if(active)return;
        origin.copy(bowl.position);raisedOrigin.copy(origin).setY(GROGU_HOVER.y);
        startedAt=clock;active=true;
      },
    },
  ];

  return {group,actions,tick:(time:number,reduced:boolean)=>{
    clock=time;projection.visible=time<projectionUntil;
    if(projection.visible){
      // Flickers in, then holds with a faint shimmer, and fades over its last second.
      const fade=Math.min(1,projectionUntil-time),flicker=reduced?1:.92+Math.sin(time*23)*.05+(Math.sin(time*7.3)>.96?-.25:0);
      card.material.opacity=.9*fade*flicker;beamMaterial.opacity=.09*fade*flicker;
      card.position.y=.47+(reduced?0:Math.sin(time*1.6)*.006);
      emblem.rotation.y=reduced?0:time*1.4;
    }
    grogu.setForcePose?.(0);
    if(!active)return;
    if(reduced){settleOnBench();return;}
    const age=Math.max(0,time-startedAt),backAt=LIFT+CROSS+HOLD,downAt=backAt+CROSS;
    let reach=1;
    if(age<LIFT){
      const t=ease(age/LIFT);bowl.position.lerpVectors(origin,raisedOrigin,t);reach=t;
    }else if(age<LIFT+CROSS){
      const u=(age-LIFT)/CROSS;bowl.position.lerpVectors(raisedOrigin,GROGU_HOVER,ease(u));bowl.position.y+=Math.sin(u*Math.PI)*.035;
    }else if(age<backAt){
      bowl.position.copy(GROGU_HOVER);bowl.position.y+=Math.sin((age-LIFT-CROSS)*3)*.006;
    }else if(age<downAt){
      const u=(age-backAt)/CROSS;bowl.position.lerpVectors(GROGU_HOVER,raisedOrigin,ease(u));bowl.position.y+=Math.sin(u*Math.PI)*.035;
    }else if(age<DURATION){
      const t=ease((age-downAt)/LOWER);bowl.position.lerpVectors(raisedOrigin,origin,t);reach=1-t;
    }else{
      active=false;bowl.position.copy(origin);bowl.rotation.set(0,0,0);return;
    }
    bowl.rotation.set(0,Math.sin(age*.9)*.07*reach,Math.sin(age*2.1)*.035*reach);
    grogu.setForcePose?.(reach);
  }};
}
