import * as THREE from "three";
import { bakePart, part, pipe, rounded } from "./tatooineCharacters";

export type ResidentKind = "kx" | "b1" | "b2" | "tusken" | "toydarian" | "gungan";
type XYZ = [number, number, number];

function surface(color: number, metalness = .25, roughness = .68) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}
function shapePlate(points: [number, number][], depth: number) {
  const s = new THREE.Shape(); points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();
  return new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:1});
}
function bar(root: THREE.Group, a: XYZ, b: XYZ, r: number, material: THREE.Material, endRadius = r) {
  const from = new THREE.Vector3(...a), span = new THREE.Vector3(...b).sub(from);
  const m=part(root,new THREE.CylinderGeometry(endRadius,r,span.length(),10),material);
  m.position.copy(from).addScaledVector(span,.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),span.normalize());return m;
}
const box=(root:THREE.Group,w:number,h:number,d:number,mat:THREE.Material,at:XYZ,r=.008)=>part(root,rounded(w,h,d,r),mat,at);
const ball=(root:THREE.Group,r:number,mat:THREE.Material,at:XYZ,scale:XYZ=[1,1,1])=>part(root,new THREE.SphereGeometry(r,16,12),mat,at).scale.set(...scale);
const axle=(root:THREE.Group,r:number,w:number,mat:THREE.Material,at:XYZ)=>part(root,new THREE.CylinderGeometry(r,r,w,16),mat,at,[0,0,Math.PI/2]);

/** Reconditioned port workers and civilian travellers, all modelled facing +Z. */
export function createResidentModel(kind: ResidentKind) {
  const group=new THREE.Group();group.name=`mos-eisley-resident-${kind}`;group.userData.character=true;
  const figure=new THREE.Group();group.add(figure);
  const head=new THREE.Group(),arms:THREE.Group[]=[],legs:THREE.Group[]=[],wings:THREE.Group[]=[];
  const black=surface(0x151b1d,.35,.72),steel=surface(0x8c9697,.75,.38),leather=surface(0x56402b,.03,.93);
  const eye=new THREE.MeshBasicMaterial({color:kind==="b2"?0xdb6951:0xe3dfb2});
  const paint=surface(kind==="kx"?0x252c2f:kind==="b1"?0xa75b43:0x68777c,.47,.61);
  const skin=surface(kind==="gungan"?0xa97b55:0x7b8864,.02,.88);
  const cloth=surface(kind==="tusken"?0x9b8665:0x625443,.01,.96);
  black.userData.surfaceKind = "metal";
  steel.userData.surfaceKind = "metal";
  paint.userData.surfaceKind = "metal";
  leather.userData.surfaceKind = "leather";
  skin.userData.surfaceKind = "skin";
  cloth.userData.surfaceKind = "cloth";
  const crease = surface(kind === "gungan" ? 0x79533b : 0x505e40, .01, .86);
  crease.userData.surfaceKind = "skin";
  const iris = surface(0xa89149, .05, .38);
  iris.userData.skipSurfaceDetail = true;
  const pupil = surface(0x111816, 0, .2);
  pupil.userData.skipSurfaceDetail = true;
  const torso=new THREE.Group();figure.add(torso);

  if(kind==="kx"||kind==="b1"||kind==="b2"){
    const heavy=kind==="b2",thin=kind==="b1",hipY=thin?.85:heavy?.83:.92;
    if(kind==="kx"){
      const profile=[[.105,1.17],[.2,1.19],[.29,1.43],[.3,1.57],[.19,1.69],[.1,1.68]].map(p=>new THREE.Vector2(...p as [number,number]));
      part(torso,new THREE.LatheGeometry(profile,24),paint).scale.z=.7;
      box(torso,.135,.24,.018,black,[0,1.4,.196]);box(torso,.098,.14,.025,steel,[0,1.37,.21]);
      for(let i=0;i<4;i++)box(torso,.056,.007,.018,black,[.013,1.33+i*.022,.229],.001);
      box(torso,.13,.3,.1,black,[0,1.05,0]);
      for(const side of[-1,1])bar(torso,[side*.13,1.25,0],[side*.085,.94,.02],.018,steel);
      box(torso,.31,.13,.19,paint,[0,.925,0],.025);
      bar(torso,[0,1.68,0],[0,1.82,0],.04,black);
      for(let i=0;i<4;i++)part(torso,new THREE.TorusGeometry(.043,.006,5,16),steel,[0,1.71+i*.025,0],[Math.PI/2,0,0]);
      head.position.y=1.91;ball(head,.139,paint,[0,0,0],[.95,1.17,.86]);
      for(const side of[-1,1]){part(head,new THREE.CircleGeometry(.029,16),black,[side*.057,.012,.116]);part(head,new THREE.CircleGeometry(.014,12),eye,[side*.057,.012,.118]);}
      box(head,.11,.049,.055,steel,[0,-.117,.085]);for(let i=0;i<6;i++)box(head,.008,.045,.018,black,[-.045+i*.018,-.115,.119],.001);
    }else if(thin){
      box(torso,.285,.305,.16,paint,[0,1.285,0],.03);box(torso,.17,.14,.022,black,[0,1.29,.092]);
      box(torso,.145,.119,.025,paint,[0,1.293,.107]);box(torso,.033,.06,.025,steel,[0,1.29,.126]);
      bar(torso,[0,.99,0],[0,1.13,0],.031,black);
      for(const side of[-1,1])bar(torso,[side*.092,1.15,0],[side*.053,.875,.025],.016,paint);
      axle(torso,.075,.26,paint,[0,.85,0]);bar(torso,[0,1.45,-.02],[0,1.635,-.01],.026,steel);
      box(torso,.19,.25,.1,paint,[0,1.3,-.14]);
      for(const side of[-1,1])bar(torso,[side*.07,1.4,-.15],[side*.07,1.88,-.15],.008,steel);
      head.position.y=1.71;
      const skull=shapePlate([[-.09,-.095],[-.084,.074],[.025,.128],[.145,.07],[.267,-.104],[.226,-.146],[.116,-.102]],.11);skull.rotateY(-Math.PI/2);skull.translate(.055,0,0);part(head,skull,paint);
      for(const side of[-1,1])box(head,.018,.022,.036,black,[side*.057,-.074,.207],.003);
      box(head,.056,.018,.018,steel,[0,-.127,.257]);
    }else{
      ball(torso,.32,paint,[0,1.407,0],[1.13,1.05,.72]);
      part(torso,shapePlate([[-.33,.18],[-.12,.26],[.12,.26],[.33,.18],[.26,-.12],[0,-.21],[-.26,-.12]],.045),paint,[0,1.39,.16]);
      box(torso,.17,.105,.022,black,[0,1.565,.214],.015);
      for(let i=0;i<3;i++)box(torso,.1,.012,.014,steel,[0,1.542+i*.024,.23],.002);
      part(torso,new THREE.CircleGeometry(.017,12),eye,[.2,1.5,.238]);
      const abdomen=part(torso,new THREE.CylinderGeometry(.18,.14,.27,20),black,[0,1.044,0]);abdomen.scale.z=.72;
      for(let i=0;i<7;i++)part(torso,new THREE.TorusGeometry(.177-i*.004,.009,5,20),black,[0,1.155-i*.032,0],[Math.PI/2,0,0]).scale.y=.72;
      box(torso,.3,.12,.23,paint,[0,.87,0],.025);head.position.y=1.744;
      ball(head,.096,paint,[0,0,0],[.92,.83,.86]);box(head,.075,.014,.016,black,[0,-.012,.08],.003);
    }
    bakePart(torso);bakePart(head);figure.add(head);
    for(const side of[-1,1]){
      const leg=new THREE.Group();leg.position.set(side*(heavy?.145:thin?.083:.112),hipY,0);figure.add(leg);legs.push(leg);
      axle(leg,heavy?.1:.067,heavy?.16:.11,black,[0,0,0]);
      bar(leg,[0,-.05,0],[0,-hipY*.48,.02],heavy?.081:thin?.031:.057,paint,heavy?.064:thin?.028:.04);
      axle(leg,heavy?.078:.05,heavy?.18:.11,steel,[0,-hipY*.48,.02]);
      bar(leg,[0,-hipY*.54,.018],[0,-hipY+.1,0],heavy?.062:thin?.027:.036,paint,heavy?.083:thin?.031:.05);
      if(!thin){box(leg,.025,hipY*.32,.03,black,[side*.04,-hipY*.74,.048]);bar(leg,[side*.044,-.15,-.045],[side*.035,-hipY*.43,-.045],.009,steel);}
      box(leg,heavy?.21:thin?.095:.145,.075,heavy?.27:thin?.22:.265,paint,[0,-hipY+.04,.07],.012);bakePart(leg);
      const shoulder=heavy?.375:thin?.22:.322,sy=thin?1.397:heavy?1.567:1.595;
      const arm=new THREE.Group();arm.position.set(side*shoulder,sy,0);figure.add(arm);arms.push(arm);
      axle(arm,heavy?.12:thin?.065:.106,heavy?.19:.14,black,[0,0,0]);
      if(!thin)ball(arm,heavy?.145:.125,paint,[side*.018,-.015,0],[.82,1.12,1]);
      bar(arm,[side*.01,-.075,0],[side*.025,-.34,.012],heavy?.09:thin?.029:.052,paint);
      axle(arm,heavy?.071:.045,.13,steel,[side*.025,-.36,.012]);
      bar(arm,[side*.025,-.39,.014],[side*.012,-.69,.055],heavy?.079:thin?.025:.04,paint,heavy?.055:thin?.023:.032);
      if(kind==="kx")part(arm,new THREE.TorusGeometry(.108,.008,5,20),surface(0x9e8b4e,.4),[side*.06,0,0],[0,Math.PI/2,0]);
      box(arm,heavy?.09:.065,.083,.063,black,[side*.012,-.741,.055]);
      for(const dx of[-.027,0,.027])bar(arm,[side*.012+dx,-.758,.055],[side*.012+dx,-.815,.078],thin?.006:.009,steel);
      bakePart(arm);
    }
  }else if(kind==="tusken"){
    const robe=new THREE.CylinderGeometry(.235,.355,1.31,32,8),p=robe.getAttribute("position");
    for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),y=p.getY(i),r=Math.hypot(x,z);if(r>.01){const f=1+Math.sin(Math.atan2(x,z)*15)*(.018+(.66-y)*.025);p.setXYZ(i,x*f,y,z*f);}}robe.computeVertexNormals();part(torso,robe,cloth,[0,.704,0]);
    const wrap=part(torso,new THREE.CylinderGeometry(.26,.39,1.17,24,1,true,Math.PI*.1,Math.PI*1.8),surface(0xb5a587,.01,.97),[0,.75,-.025]);wrap.material.side=THREE.DoubleSide;
    for(const side of[-1,1])box(torso,.057,.6,.035,leather,[side*.04,1.15,.227],.006).rotation.z=side*.68;
    for(let i=0;i<5;i++)box(torso,.072,.09,.045,leather,[-.16+i*.08,.91,.272],.009);
    bakePart(torso);head.position.y=1.58;
    part(head,new THREE.CylinderGeometry(.147,.161,.293,24),cloth,[0,.006,0]);
    for(let i=0;i<8;i++)part(head,new THREE.TorusGeometry(.153,.01,6,24),cloth,[0,-.121+i*.035,0],[Math.PI/2,0,i*.07]);
    box(head,.25,.125,.045,leather,[0,-.008,.134],.015);
    for(const side of[-1,1]){
      part(head,new THREE.CylinderGeometry(.036,.041,.064,16),steel,[side*.073,.019,.172],[Math.PI/2,0,0]);
      part(head,new THREE.CircleGeometry(.025,12),black,[side*.073,.019,.206]);
      bar(head,[side*.14,.126,0],[side*.16,.19,0],.008,steel);
    }
    part(head,new THREE.CylinderGeometry(.054,.054,.055,16),leather,[0,-.086,.172],[Math.PI/2,0,0]);
    box(head,.045,.027,.017,steel,[0,-.084,.207]);
    ball(head,.145,cloth,[0,.137,-.006],[1,.45,1]);
    for (const side of [-1,1]) {
      pipe(head, [[side*.105,-.058,.14],[side*.153,-.115,.128],[side*.11,-.164,.035]], .016, leather);
      part(head,new THREE.TorusGeometry(.032,.005,5,16),steel,[side*.073,.019,.207]);
      box(head,.022,.01,.005,steel,[side*.073,.039,.21],.001);
    }
    for (let slat=0; slat<4; slat++) box(head,.006,.035,.006,black,[-.018+slat*.012,-.084,.219],.001);
    bakePart(head);figure.add(head);
    for(const side of[-1,1]){
      const arm=new THREE.Group();arm.position.set(side*.24,1.25,0);figure.add(arm);arms.push(arm);
      bar(arm,[0,0,0],[side*.055,-.43,.045],.09,cloth,.115);ball(arm,.054,leather,[side*.055,-.46,.065]);bakePart(arm);
      const leg=new THREE.Group();leg.position.set(side*.125,.13,0);figure.add(leg);legs.push(leg);box(leg,.15,.085,.28,leather,[0,-.085,.07],.022);bakePart(leg);
    }
    // The gaderffii rests beside the traveller, with its point in the sand.
    const staff=new THREE.Group();figure.add(staff);bar(staff,[.34,.055,.11],[.34,1.73,.11],.014,leather);
    box(staff,.085,.095,.035,steel,[.34,1.63,.11]);part(staff,new THREE.ConeGeometry(.037,.17,4),steel,[.34,.095,.11],[Math.PI,0,0]);bakePart(staff);
  }else if(kind==="toydarian"){
    const pale=surface(0xa39b6b,.01,.83);pale.userData.surfaceKind="skin";ball(torso,.272,skin,[0,.695,0],[1,1.19,.82]);ball(torso,.235,pale,[0,.664,.103],[.91,1.08,.58]);
    for(const side of[-1,1]){
      box(torso,.12,.245,.09,leather,[side*.163,.947,.091],.026).rotation.z=-side*.22;
      box(torso,.07,.12,.05,leather,[side*.205,.69,.15],.015);
    }
    pipe(torso,[[-.24,.68,.11],[0,.64,.235],[.24,.68,.11]],.012,leather);bakePart(torso);
    head.position.y=1.175;ball(head,.153,skin,[0,0,0],[.91,1.12,.93]);
    pipe(head,[[0,-.015,.107],[0,-.08,.202],[0,-.19,.209]],.041,skin);
    for(const side of[-1,1]){
      ball(head,.034,crease,[side*.079,.037,.111],[1.1,.92,.8]);
      ball(head,.027,iris,[side*.078,.035,.132],[1,.88,.65]);
      ball(head,.012,pupil,[side*.078,.035,.148],[.8,1,.45]);
      pipe(head,[[side*.044,.054,.129],[side*.076,.067,.127],[side*.108,.049,.115]],.011,skin);
      ball(head,.04,pale,[side*.069,-.047,.125],[1,.7,.5]);
      pipe(head,[[side*.099,-.054,.127],[side*.082,-.076,.14],[side*.049,-.094,.151]],.0035,crease);
      part(head,new THREE.ConeGeometry(.018,.058,10),pale,[side*.07,-.089,.13],[0,0,-side*.3]);
    }
    box(head,.074,.012,.016,crease,[0,-.105,.14],.004);
    ball(head,.042,pale,[0,-.126,.125],[1,.48,.55]);
    for (let fold=0; fold<3; fold++) {
      const y=-.068-fold*.03, z=.197+fold*.005;
      pipe(head,[[-.028,y,z],[0,y-.006,z+.007],[.028,y,z]],.0028,crease);
    }
    for (const side of [-1,1]) ball(head,.009,crease,[side*.018,-.186,.236],[.7,.55,.5]);
    bakePart(head);figure.add(head);
    for(const side of[-1,1]){
      const arm=new THREE.Group();arm.position.set(side*.225,.969,0);figure.add(arm);arms.push(arm);
      bar(arm,[0,0,0],[side*.11,-.2,.01],.046,skin,.035);bar(arm,[side*.11,-.2,.01],[side*.15,-.4,.08],.035,skin,.025);
      for(let i=0;i<3;i++)bar(arm,[side*.15+(i-1)*.018,-.4,.08],[side*.15+(i-1)*.028,-.468,.106],.008,skin);bakePart(arm);
      const leg=new THREE.Group();leg.position.set(side*.123,.43,0);figure.add(leg);legs.push(leg);
      bar(leg,[0,0,0],[side*.02,-.2,.01],.049,skin,.035);ball(leg,.06,skin,[side*.02,-.224,.05],[1,.5,1.5]);
      for(let i=0;i<3;i++)bar(leg,[side*.02+(i-1)*.028,-.24,.075],[side*.02+(i-1)*.04,-.24,.13],.01,black);bakePart(leg);
      const wing=new THREE.Group();wing.position.set(side*.2,.994,-.105);figure.add(wing);wings.push(wing);
      const w=shapePlate([[0,0],[side*.07,.14],[side*.31,.34],[side*.2,.08],[side*.12,-.15]],.007);part(wing,w,skin);
      for(let i=0;i<3;i++)bar(wing,[0,0,.01],[side*(.12+i*.075),.02+i*.115,.012],.006,pale);bakePart(wing);
    }
  }else{
    const trousers=surface(0x4a4436,.01,.98),innerEar=surface(0x925c46,.01,.94),pale=surface(0xc0ae83,.01,.82);
    trousers.userData.surfaceKind="cloth";
    innerEar.userData.surfaceKind="skin";
    pale.userData.surfaceKind="skin";
    box(torso,.32,.37,.2,trousers,[0,1.227,0],.045);
    for(const side of[-1,1])box(torso,.105,.32,.057,leather,[side*.121,1.238,.088],.015).rotation.z=side*.12;
    bar(torso,[0,1.389,0],[0,1.59,.01],.069,pale,.057);
    box(torso,.33,.15,.22,trousers,[0,1.019,.012],.03);pipe(torso,[[-.16,1.095,.1],[0,1.05,.139],[.16,1.095,.1]],.015,leather);bakePart(torso);
    head.position.y=1.684;ball(head,.13,skin,[0,0,0],[.87,1.15,1.03]);ball(head,.099,pale,[0,-.051,.13],[1.1,.55,1.32]);
    pipe(head,[[-.088,-.075,.175],[-.051,-.089,.22],[0,-.091,.236],[.051,-.089,.22],[.088,-.075,.175]],.0035,crease);
    ball(head,.074,pale,[0,-.089,.148],[1.05,.32,1.11]);
    for (const side of [-1,1]) {
      ball(head,.017,skin,[side*.042,-.021,.217],[1,.6,.55]);
      ball(head,.006,crease,[side*.042,-.019,.226],[1,.65,.4]);
      pipe(head,[[side*.102,-.04,.08],[side*.097,-.063,.118],[side*.079,-.073,.16]],.004,crease);
    }
    for(const side of[-1,1]){
      bar(head,[side*.061,.08,.008],[side*.071,.208,.026],.023,skin,.019);
      ball(head,.034,pale,[side*.071,.208,.034]);
      ball(head,.02,iris,[side*.071,.209,.06],[1,1,.48]);
      ball(head,.01,pupil,[side*.071,.209,.07],[.7,1,.4]);
      pipe(head,[[side*.047,.223,.046],[side*.071,.239,.048],[side*.096,.221,.041]],.006,skin);
      const ear=shapePlate([[side*.105,.07],[side*.167,.087],[side*.202,-.1],[side*.18,-.43],[side*.095,-.31]],.024);part(head,ear,skin,[0,0,-.04]);
      const inset=shapePlate([[side*.13,.042],[side*.157,.026],[side*.179,-.13],[side*.167,-.355],[side*.119,-.265]],.006);part(head,inset,innerEar,[0,0,-.01]);
      pipe(head,[[side*.138,.008,.001],[side*.16,-.116,.002],[side*.15,-.28,.001]],.0045,crease);
      pipe(head,[[side*.15,-.05,.002],[side*.177,-.12,.001],[side*.169,-.19,.001]],.003,pale);
    }
    bakePart(head);figure.add(head);
    for(const side of[-1,1]){
      const arm=new THREE.Group();arm.position.set(side*.225,1.375,0);figure.add(arm);arms.push(arm);
      bar(arm,[0,0,0],[side*.039,-.254,0],.049,skin,.042);bar(arm,[side*.039,-.254,0],[side*.026,-.462,.041],.042,skin,.032);
      for(let i=0;i<3;i++)bar(arm,[side*.026+(i-1)*.023,-.46,.041],[side*.026+(i-1)*.032,-.55,.073],.009,skin);bakePart(arm);
      const leg=new THREE.Group();leg.position.set(side*.105,.975,0);figure.add(leg);legs.push(leg);
      bar(leg,[0,-.03,0],[side*.018,-.43,0],.085,trousers,.065);bar(leg,[side*.018,-.43,0],[side*.022,-.86,.016],.065,trousers,.055);
      ball(leg,.075,pale,[side*.022,-.918,.078],[1.1,.6,1.67]);
      for(let i=0;i<3;i++)ball(leg,.03,skin,[side*.022+(i-1)*.046,-.927,.169],[.75,.58,1]);bakePart(leg);
    }
  }
  const tick=(time:number,reduced:boolean)=>{
    const t=reduced?0:time;
    head.rotation.y=reduced?0:Math.sin(t*.48)*.13;
    arms.forEach((a,i)=>{a.rotation.x=reduced?0:Math.sin(t*.72+i*2)*.055;a.rotation.z=(i?1:-1)*(kind==="kx"?.035:.015);});
    if(kind==="kx")arms.forEach((a,i)=>{a.rotation.x=-.24+(reduced?0:Math.sin(t*.42+i)*.04);a.rotation.z=(i?1:-1)*.1;});
    if(kind==="b1")arms[0].rotation.x=-.18;
    if(kind==="b2")arms[1].rotation.x=-.31;
    if(kind==="tusken")arms[1].rotation.x=-.14;
    if(kind==="toydarian"){
      figure.position.y=reduced?0:Math.sin(t*1.7)*.025;
      wings.forEach((w,i)=>w.rotation.y=(i?1:-1)*(.25+(reduced?0:Math.sin(t*22)*.18)));
    }
  };
  tick(0,true);
  return {group,head,arms,legs,tick};
}
