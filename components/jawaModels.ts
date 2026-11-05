import * as THREE from "three";
import { bakePart, part, pipe, rounded } from "./tatooineCharacters";
import { random } from "./landingKit";

function wovenCloth(){
  const canvas=document.createElement("canvas");canvas.width=canvas.height=256;const c=canvas.getContext("2d")!,rand=random(1977);
  c.fillStyle="#c4b49d";c.fillRect(0,0,256,256);
  for(let i=0;i<5000;i++){c.fillStyle=i%2?"#ddc59a18":"#24190e20";c.fillRect(rand()*256,rand()*256,.4+rand()*1.5,1+rand()*3);}
  for(let y=0;y<256;y+=3){c.fillStyle="#2b201017";c.fillRect(0,y,256,.6);}
  for(let x=0;x<256;x+=4){c.fillStyle="#f0ddba12";c.fillRect(x,0,.65,256);}
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=8;return map;
}

export function createJawa(color=0x947455){
  const group=new THREE.Group();group.name="jawa";group.userData.character=true;
  const clothMap=wovenCloth(),cloth=new THREE.MeshStandardMaterial({map:clothMap,bumpMap:clothMap,bumpScale:.004,color,roughness:1});
  const dark=new THREE.MeshStandardMaterial({color:0x080706,roughness:1}),leather=new THREE.MeshStandardMaterial({color:0x493020,roughness:.92});
  const buckle=new THREE.MeshStandardMaterial({color:0x88735a,roughness:.65,metalness:.4});
  const eye=new THREE.MeshBasicMaterial({color:0xf2bc51});
  cloth.userData.surfaceKind="cloth";
  leather.userData.surfaceKind="leather";
  buckle.userData.surfaceKind="metal";
  dark.userData.skipSurfaceDetail=true;
  const body=new THREE.Group();group.add(body);
  const robe=new THREE.CylinderGeometry(.19,.39,.79,48,14),p=robe.getAttribute("position");
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),y=p.getY(i),angle=Math.atan2(x,z),radius=Math.hypot(x,z);
    if(radius<.001)continue;const folds=(Math.sin(angle*11+.3)+.35*Math.sin(angle*19))*(.012+(.4-y)*.034);
    p.setXYZ(i,x*(1+folds/radius),y+(y<-.36?Math.sin(angle*9)*.012:0),z*(1+folds/radius));
  }
  robe.computeVertexNormals();part(body,robe,cloth,[0,.42,0]);
  part(body,new THREE.TorusGeometry(.207,.067,10,28),cloth,[0,.76,.012],[Math.PI/2,0,0]);
  part(body,new THREE.TorusGeometry(.23,.044,8,28),cloth,[0,.715,.02],[Math.PI/2,0,0]);
  part(body,rounded(.105,.72,.04,.01),leather,[0,.48,.29],[0,0,.66]);
  for(let i=0;i<4;i++){
    const x=-.19+i*.12,y=.69-i*.155;
    part(body,rounded(.12,.13,.063,.018),leather,[x,y,.31],[0,0,.1]);
    part(body,rounded(.126,.048,.015,.009),leather,[x,y+.048,.349],[0,0,.1]);
    part(body,new THREE.BoxGeometry(.035,.025,.012),buckle,[x,y+.025,.36]);
    for(const edge of[-1,1])for(let seam=0;seam<3;seam++){
      part(body,new THREE.BoxGeometry(.004,.009,.004),buckle,[x+edge*.049,y-.038+seam*.025,.345]);
    }
  }
  bakePart(body);
  const head=new THREE.Group();head.position.y=.88;group.add(head);
  const hood=new THREE.SphereGeometry(.25,32,20,Math.PI,Math.PI),hp=hood.getAttribute("position");
  for(let i=0;i<hp.count;i++){const y=hp.getY(i);hp.setXYZ(i,hp.getX(i),y*1.18+Math.max(0,y-.12)*.32,hp.getZ(i)-Math.max(0,y)*.2);}
  hood.computeVertexNormals();part(head,hood,cloth,[0,0,.08]);
  part(head,new THREE.TorusGeometry(.196,.066,12,32),cloth,[0,-.01,.078]).scale.set(1,1.13,.85);
  part(head,new THREE.SphereGeometry(.189,24,16),dark,[0,-.015,.058]).scale.set(1,1.13,.16);
  for(const side of[-1,1])part(head,new THREE.SphereGeometry(.018,12,10),eye,[side*.063,.018,.096]);
  // A rolled seam follows the hood opening and tucks into the neck wrap.
  for(const side of[-1,1]){
    pipe(head,[[side*.07,.225,.105],[side*.18,.135,.132],[side*.207,-.03,.128],[side*.14,-.19,.113]],.007,leather);
    for(let seam=0;seam<5;seam++){
      const angle=.22+seam*.34;
      part(head,new THREE.BoxGeometry(.014,.005,.005),leather,
        [side*Math.sin(angle)*.209,Math.cos(angle)*.227-.01,.137],[0,0,-side*angle]);
    }
  }
  bakePart(head);
  const arms:THREE.Group[]=[],legs:THREE.Group[]=[];
  for(const side of[-1,1]){
    const arm=new THREE.Group();arm.position.set(side*.265,.67,.015);group.add(arm);arms.push(arm);
    part(arm,new THREE.CylinderGeometry(.085,.125,.31,16,4),cloth,[side*.012,-.13,.025],[.12,0,side*.12]);
    part(arm,new THREE.TorusGeometry(.095,.022,8,20),cloth,[side*.02,-.276,.045],[Math.PI/2,0,0]);
    part(arm,new THREE.SphereGeometry(.052,12,8),leather,[side*.018,-.295,.06]).scale.set(1,.84,1);
    for(let finger=0;finger<4;finger++){
      part(arm,new THREE.CapsuleGeometry(.009,.031,3,6),leather,
        [side*.018-.027+finger*.018,-.329,.087],[-.7,0,0]);
    }
    part(arm,new THREE.CapsuleGeometry(.012,.024,3,6),leather,[-side*.028,-.297,.095],[.2,0,-side*.65]);
    if(side===1){part(arm,new THREE.CylinderGeometry(.012,.012,.15,8),buckle,[side*.018,-.29,.105],[Math.PI/2,0,0]);}
    bakePart(arm);
    const leg=new THREE.Group();leg.position.set(side*.13,.16,0);group.add(leg);legs.push(leg);
    part(leg,rounded(.15,.095,.26,.025),leather,[0,-.1,.075]);bakePart(leg);
  }
  return {group,head,arms,legs};
}

export function createSandcrawler(){
  const group=new THREE.Group();group.name="jawa-sandcrawler";
  const canvas=document.createElement("canvas");canvas.width=canvas.height=1024;const c=canvas.getContext("2d")!,rand=random(171977);
  c.fillStyle="#8b4e2c";c.fillRect(0,0,1024,1024);
  for(let i=0;i<1100;i++){
    const x=rand()*1024,y=rand()*1024,w=2+rand()*28,h=3+rand()*65;c.fillStyle=i%4?"#351d1228":"#ceb58665";
    c.beginPath();c.moveTo(x,y);c.lineTo(x+w,y+3);c.lineTo(x+w*.7,y+h);c.lineTo(x-1,y+h*.75);c.fill();
  }
  for(let i=0;i<140;i++){const x=rand()*1024,y=rand()*1024;c.fillStyle="#311d1738";c.fillRect(x,y,1+rand()*3,30+rand()*240);}
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
  const rust=new THREE.MeshStandardMaterial({map,roughness:.86,metalness:.32});
  const plates=[0x92765b,0xbf8b5c,0x8a6548,0xb27340].map(color=>new THREE.MeshStandardMaterial({map,color,roughness:.88,metalness:.25}));
  const dark=new THREE.MeshStandardMaterial({color:0x302b23,roughness:.9,metalness:.3}),edge=new THREE.MeshStandardMaterial({color:0x6b4a31,roughness:.8,metalness:.5});
  const amber=new THREE.MeshBasicMaterial({color:0xc9a85d});
  const profile=new THREE.Shape();profile.moveTo(-8.5,3.2);profile.lineTo(-8.3,12.8);profile.lineTo(4.5,15.3);profile.lineTo(8.8,16.2);profile.lineTo(10,14.9);profile.lineTo(8.8,3.2);profile.closePath();
  const hull=new THREE.ExtrudeGeometry(profile,{depth:8.2,bevelEnabled:false});hull.rotateY(Math.PI/2);hull.translate(-4.1,0,0);
  const hp=hull.getAttribute("position"),hn=hull.getAttribute("normal"),uv=hull.getAttribute("uv");
  for(let i=0;i<hp.count;i++)uv.setXY(i,Math.abs(hn.getX(i))>.5?(hp.getZ(i)+10)/20:(hp.getX(i)+4.1)/8.2,hp.getY(i)/17);
  part(group,hull,rust);
  for(const side of[-1,1]){
    for(let row=0;row<3;row++)for(let col=0;col<4;col++){
      const y=4.7+row*3.05,z=-5.5+col*3.45;
      part(group,new THREE.BoxGeometry(.1,2.75,3.15),plates[(row+col)%4],[side*4.17,y,z]);
      for(const dz of[-1.32,1.32])for(const dy of[-1.1,1.1])part(group,new THREE.SphereGeometry(.045,6,4),edge,[side*4.24,y+dy,z+dz]);
    }
    for(const z of[-7.4,-3.9,-.4,3.1,6.6])part(group,new THREE.BoxGeometry(.2,10.7,.14),edge,[side*4.28,8.45,z]);
    for(const y of[3.4,7.7,12.4])part(group,new THREE.BoxGeometry(.16,.16,16),edge,[side*4.28,y,0]);
    for(const center of[-4.3,4.3]){
      const track=part(group,new THREE.CapsuleGeometry(1.34,4.4,6,16),dark,[side*4,1.42,center],[Math.PI/2,0,0]);track.scale.x=.64;
      for(let link=0;link<40;link++){
        const a=link/40*Math.PI*2,dy=Math.cos(a)*1.36,dz=-Math.sin(a)*3.35;
        part(group,new THREE.BoxGeometry(1.82,.13,.47),link%2?edge:dark,[side*4,1.42+Math.sin(a)*1.36,center+Math.cos(a)*3.35],[Math.atan2(-dy,dz),0,0]);
      }
      for(let wheel=0;wheel<5;wheel++){
        const z=center-2.15+wheel*1.075;
        part(group,new THREE.CylinderGeometry(.69,.69,.12,16),edge,[side*4.97,1.38,z],[0,0,Math.PI/2]);
        part(group,new THREE.CylinderGeometry(.22,.22,.14,12),dark,[side*5.04,1.38,z],[0,0,Math.PI/2]);
      }
    }
    for(let vent=0;vent<5;vent++)part(group,new THREE.BoxGeometry(.1,.09,1.5),dark,[side*4.3,5.8+vent*.22,5.8]);
  }
  for(let pane=0;pane<8;pane++){
    part(group,rounded(.82,.55,.1,.02),dark,[-3.3+pane*.94,14.7,-10.06]);
    part(group,new THREE.BoxGeometry(.63,.32,.115),amber,[-3.3+pane*.94,14.72,-10.08]);
  }
  part(group,rounded(5.3,5.5,.16,.04),dark,[0,6,-9.2],[-.103,0,0]);
  part(group,new THREE.BoxGeometry(4.2,.16,6.4),edge,[0,1.66,-11.55],[-Math.atan2(3.2,5.5),0,0]);
  for(let tread=0;tread<11;tread++)part(group,new THREE.BoxGeometry(4.1,.06,.11),dark,[0,.2+tread*.28,-14.05+tread*.48],[-.52,0,0]);
  pipe(group,[[-3.5,4,-9],[-3.5,10,-9.6],[-3.5,13.7,-9.7]],.075,edge);
  bakePart(group);return group;
}
