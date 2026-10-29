import * as THREE from "three";
import { createResidentModel, type ResidentKind } from "./tatooineResidentModels";

type LocalSpot = {u:number;v:number;r:number};

/** Small civilian moments placed outside the street's shared pedestrian/speeder lane. */
export function createTatooineResidents(heightAtLocal:(u:number,v:number)=>number){
  const group=new THREE.Group();group.name="mos-eisley-diverse-residents";
  const specs:{kind:ResidentKind;u:number;v:number;facing:number;r:number}[]=[
    {kind:"kx",u:-4.8,v:33,facing:Math.PI/2,r:.44},
    {kind:"b1",u:4.8,v:32.8,facing:-Math.PI/2-.3,r:.34},
    {kind:"b2",u:4.9,v:47,facing:-Math.PI/2,r:.47},
    {kind:"tusken",u:-4.4,v:50,facing:Math.PI/2-.35,r:.42},
    {kind:"toydarian",u:4.4,v:59,facing:-Math.PI/2-.2,r:.38},
    {kind:"gungan",u:4.7,v:66,facing:-Math.PI/2+.2,r:.37},
  ];
  const residents=specs.map((spec,index)=>{
    const model=createResidentModel(spec.kind);model.group.position.set(spec.u,heightAtLocal(spec.u,spec.v),spec.v);model.group.rotation.y=spec.facing;group.add(model.group);
    return {...spec,model,phase:index*1.73,age:0};
  });
  // Stationary actors have true collision circles; hovering wings stay above shoulder height.
  const colliders:LocalSpot[]=specs.map(({u,v,r})=>({u,v,r}));
  const movers:LocalSpot[]=[];
  return {group,colliders,movers,tick:(dt:number,_time:number,reduced:boolean,visitor:{u:number;v:number})=>{
    if(dt<=0)return;
    for(const resident of residents){
      const near=Math.hypot(visitor.u-resident.u,visitor.v-resident.v)<1.7;
      if(!near&&!reduced)resident.age+=dt;
      const previousYaw=resident.model.head.rotation.y;
      resident.model.tick(resident.age+resident.phase,reduced);
      // A nearby visitor pauses work and receives a small look, without a sudden body turn.
      if(!reduced&&dt&&near){
        const angle=Math.atan2(visitor.u-resident.u,visitor.v-resident.v)-resident.facing;
        const desired=THREE.MathUtils.clamp(Math.atan2(Math.sin(angle),Math.cos(angle)),-.42,.42);
        resident.model.head.rotation.y=previousYaw+(desired-previousYaw)*(1-Math.exp(-dt*3));
      }
    }
  }};
}
