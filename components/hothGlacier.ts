import * as THREE from "three";
import { random } from "./landingKit";

type GlacierOptions={side:number;back:number;mouth:number;vaultHeight:(x:number,z:number)=>number};

/** A solid glacier envelope, with an arched opening and a hollow hangar at its foot. */
export function createHothGlacier({side,back,mouth,vaultHeight}:GlacierOptions) {
  const group=new THREE.Group();group.name="hoth-great-ice-wall";
  const halfWidth=780,rear=-145,front=mouth+6,portal=side+2.3,inner=side+1.2;
  const topAt=(x:number)=>202+Math.sin(x*.009)*5+Math.sin(x*.031+1.4)*2;
  const faceAt=(x:number,y:number)=>front+Math.sin(x*.16)*1.1+Math.sin(x*.53)*.35+Math.sin(y*.075+x*.014)*.6;
  const roofAt=(x:number)=>vaultHeight(x/portal*inner,mouth+1.5)+.4;
  const canvas=document.createElement("canvas");canvas.width=canvas.height=1024;
  const c=canvas.getContext("2d")!,rand=random(702017);
  c.fillStyle="#b4cfde";c.fillRect(0,0,1024,1024);
  for(let i=0;i<430;i++){
    const x=rand()*1024,y=rand()*1024,w=.8+rand()*7,h=60+rand()*900;
    const streak=c.createLinearGradient(x,y,x+w,y);
    streak.addColorStop(0,"#426d891c");streak.addColorStop(.5,i%3?"#edf7ff50":"#4b799b35");streak.addColorStop(1,"#b6d4e700");
    c.fillStyle=streak;c.fillRect(x,y,w,h);if(y+h>1024)c.fillRect(x,y-1024,w,h);
  }
  for(let i=0;i<20;i++){
    const y=i*51;c.strokeStyle=i%3?"#e7f3fb2b":"#527e9c21";c.lineWidth=1+rand()*2;c.beginPath();
    for(let x=0;x<=1024;x+=8){const v=y+Math.sin(x*.014+i)*3;if(x)c.lineTo(x,v);else c.moveTo(x,v);}c.stroke();
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=8;
  const ice=new THREE.MeshStandardMaterial({map,bumpMap:map,bumpScale:.5,vertexColors:true,roughness:.57,metalness:0,side:THREE.DoubleSide});
  const snow=new THREE.MeshStandardMaterial({color:0xd8e7ef,roughness:.9,side:THREE.DoubleSide});
  const foot=new THREE.Color(0x6c94ae),crest=new THREE.Color(0xc9dfea),tint=new THREE.Color();
  function surface(name:string,minX:number,maxX:number,columns:number,rows:number,low:(x:number)=>number,high:(x:number)=>number,position:(x:number,y:number)=>[number,number,number],material:THREE.Material=ice){
    const p:number[]=[],uv:number[]=[],color:number[]=[],indices:number[]=[];
    for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
      const x=THREE.MathUtils.lerp(minX,maxX,i/columns),y=THREE.MathUtils.lerp(low(x),high(x),j/rows);
      p.push(...position(x,y));uv.push(x/84,y/185);
      tint.copy(foot).lerp(crest,THREE.MathUtils.clamp(y/205,0,1));color.push(tint.r,tint.g,tint.b);
    }
    for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){const a=j*(columns+1)+i,b=a+1,d=a+columns+1;indices.push(a,b,d,b,d+1,d);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(p,3));geometry.setAttribute("normal",new THREE.Float32BufferAttribute(new Float32Array(p.length),3));
    geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute("color",new THREE.Float32BufferAttribute(color,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;group.add(mesh);return mesh;
  }
  // Independent wings avoid bridging triangles across the entrance.
  surface("glacier-west-face",-halfWidth,-portal,160,38,()=>-.1,topAt,(x,y)=>[x,y,faceAt(x,y)]);
  surface("glacier-east-face",portal,halfWidth,160,38,()=>-.1,topAt,(x,y)=>[x,y,faceAt(x,y)]);
  surface("glacier-over-entrance",-portal,portal,72,40,roofAt,topAt,(x,y)=>[x,y,faceAt(x,y)]);
  surface("glacier-rear",-halfWidth,halfWidth,160,12,()=>0,topAt,(x,y)=>[x,y,rear]);
  surface("cavern-rear-wall",-inner,inner,64,16,()=>0,x=>vaultHeight(x,back-1),(x,y)=>[x,y,back-1]);
  // Snow lies on top of the wall; the volume reaches far behind the chamber.
  surface("glacier-snow-crest",-halfWidth,halfWidth,160,5,()=>0,()=>1,(x,t)=>[x,topAt(x)+.18,THREE.MathUtils.lerp(rear,faceAt(x,topAt(x)),t)],snow);
  for(const sideSign of[-1,1])surface("glacier-end",rear,front+2,1,8,()=>0,()=>topAt(sideSign*halfWidth),(z,y)=>[sideSign*halfWidth,y,z]);
  // The carved arch reveals several metres of glacier between the facade and the vault.
  const rp:number[]=[],ruv:number[]=[],ri:number[]=[];
  const archSteps=80;
  for(let i=0;i<=archSteps;i++)for(const edge of[0,1]){
    const x=THREE.MathUtils.lerp(-portal,portal,i/archSteps),ix=x/portal*inner;
    rp.push(edge?ix:x,edge?vaultHeight(ix,mouth+1.5):roofAt(x),edge?mouth+1.5:faceAt(x,roofAt(x)));ruv.push(x/12,edge);
  }
  for(let i=0;i<archSteps;i++){const a=i*2;ri.push(a,a+1,a+2,a+1,a+3,a+2);}
  for(const sideSign of[-1,1]){
    const a=rp.length/3,x=sideSign*portal,ix=sideSign*inner,h=roofAt(x);
    rp.push(x,0,faceAt(x,0),x,h,faceAt(x,h),ix,0,mouth+1.5,ix,vaultHeight(ix,mouth+1.5),mouth+1.5);
    ruv.push(0,0,0,1,1,0,1,1);ri.push(a,a+1,a+2,a+1,a+3,a+2);
  }
  const reveal=new THREE.BufferGeometry();reveal.setAttribute("position",new THREE.Float32BufferAttribute(rp,3));reveal.setAttribute("uv",new THREE.Float32BufferAttribute(ruv,2));reveal.setIndex(ri);reveal.computeVertexNormals();
  const cutIce=new THREE.MeshStandardMaterial({map,bumpMap:map,bumpScale:.28,color:0xb6d3e2,roughness:.65,side:THREE.DoubleSide});
  const arch=new THREE.Mesh(reveal,cutIce);arch.name="glacier-carved-entrance";group.add(arch);
  return {group,portalHalfWidth:portal,front,roofAt,topAt};
}
