import * as THREE from "three";
import { bakePart, part, pipe, rounded } from "./tatooineCharacters";

type XYZ = [number, number, number];
const TOP = .805, TAU = Math.PI * 2;
const smooth = (t: number) => { const u = THREE.MathUtils.clamp(t, 0, 1); return u * u * (3 - 2 * u); };

/** A compact holotable: eight different creatures and a short, replayable move. */
export function createDejarikTable() {
  const group = new THREE.Group(); group.name = "cantina-dejarik";
  const chassis = new THREE.Group(); group.add(chassis);
  const steel = new THREE.MeshStandardMaterial({ color: 0x49494d, metalness: .76, roughness: .34 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14191c, metalness: .53, roughness: .45 });
  const black = new THREE.MeshStandardMaterial({ color: 0x20272b, metalness: .3, roughness: .47 });
  const white = new THREE.MeshStandardMaterial({ color: 0xd5d3ba, metalness: .23, roughness: .48 });
  const cyan = new THREE.MeshBasicMaterial({ color: 0x63c9ec, toneMapped: false });
  const button = new THREE.MeshStandardMaterial({ color: 0x8a999b, metalness: .65, roughness: .34 });
  part(chassis, new THREE.CylinderGeometry(.32, .39, .07, 40), dark, [0,.035,0]);
  part(chassis, new THREE.CylinderGeometry(.21,.29,.54,32), steel, [0,.34,0]);
  for (let i=0;i<12;i++) {
    const a=i*TAU/12;
    part(chassis, rounded(.027,.29,.012,.005),dark,[Math.sin(a)*.24,.36,Math.cos(a)*.24],[0,a,0]);
  }
  part(chassis, new THREE.CylinderGeometry(.59,.47,.13,48),dark,[0,.67,0]);
  part(chassis, new THREE.CylinderGeometry(.65,.63,.085,64),steel,[0,.751,0]);
  part(chassis, new THREE.CylinderGeometry(.592,.592,.014,64),black,[0,.795,0]);
  for (const [radius,y,tube] of [[.633,.79,.015],[.64,.732,.013],[.598,.802,.006]] as const)
    part(chassis,new THREE.TorusGeometry(radius,tube,6,64),steel,[0,y,0],[Math.PI/2,0,0]);
  // Concentric chequered wedges, rather than a square checkerboard pasted over a disk.
  for (let ring=0;ring<2;ring++) for (let sector=0;sector<12;sector++) {
    part(chassis,new THREE.RingGeometry(ring*.294,(ring+1)*.294,4,1,sector*TAU/12,TAU/12),
      (ring+sector)%2 ? black : white,[0,TOP,0],[-Math.PI/2,0,0]);
  }
  // The console runs round the near rim, where the visitor can actually reach it.
  for(let i=0;i<9;i++){
    const a=-.64+i*.16;
    part(chassis,new THREE.SphereGeometry(.012,10,6),dark,[Math.sin(a)*.637,.77,Math.cos(a)*.637]);
    part(chassis,new THREE.SphereGeometry(.008,10,6),cyan,[Math.sin(a)*.646,.771,Math.cos(a)*.646]);
  }
  for(let i=0;i<4;i++){
    const a=-.28+i*.185;
    part(chassis,new THREE.CylinderGeometry(.019,.022,.009,12),button,[Math.sin(a)*.625,.728,Math.cos(a)*.625],[Math.PI/2,a,0]);
  }
  bakePart(chassis);

  const clockUniform={value:0};
  const material=(color:number)=>new THREE.ShaderMaterial({
    uniforms:{tint:{value:new THREE.Color(color)},time:clockUniform},
    vertexShader:`varying vec3 n; varying vec3 p;
      void main(){n=normalize(normalMatrix*normal);p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform vec3 tint;uniform float time;varying vec3 n;varying vec3 p;
      void main(){float light=.58+.42*max(0.0,dot(normalize(n),normalize(vec3(-.3,.8,.6))));
        float scan=.92+.08*sin(p.y*650.0-time*2.0);
        vec3 color=mix(tint,vec3(.38,.8,1.0),.14)*light*scan;
        gl_FragColor=vec4(color,.81);
        #include <colorspace_fragment>
      }`,
    transparent:true,depthWrite:false,toneMapped:false,
  });
  const eyes = new THREE.MeshBasicMaterial({color:0xe5f9d4,transparent:true,opacity:.86,toneMapped:false,depthWrite:false});
  const figures:THREE.Group[]=[];
  const sphere=(g:THREE.Group,m:THREE.Material,r:number,at:XYZ,scale:XYZ=[1,1,1])=>{
    const mesh=part(g,new THREE.SphereGeometry(r,12,9),m,at);mesh.scale.set(...scale);return mesh;
  };
  const limb=(g:THREE.Group,m:THREE.Material,points:XYZ[],r=.01)=>pipe(g,points,r,m);
  const make=(name:string,color:number,build:(g:THREE.Group,m:THREE.Material)=>void)=>{
    const g=new THREE.Group();g.name=`dejarik-${name}`;
    build(g,material(color));bakePart(g);figures.push(g);group.add(g);return g;
  };
  const eyePair=(g:THREE.Group,y:number,z:number,x=.025)=>{
    for(const side of[-1,1])sphere(g,eyes,.006,[side*x,y,z],[1,.7,.7]);
  };
  // Kintan Strider: a squat yellow brawler, heavy fists and broad shoulders.
  make("kintan-strider",0xe7bd55,(g,m)=>{
    sphere(g,m,.068,[0,.122,0],[1.03,1.15,.77]);sphere(g,m,.045,[0,.215,.006],[1.08,.82,.86]);
    sphere(g,m,.033,[0,.202,.033],[1.2,.55,.65]);eyePair(g,.222,.041);
    for(const s of[-1,1]){
      sphere(g,m,.038,[s*.067,.168,0]);limb(g,m,[[s*.07,.17,0],[s*.095,.1,.012],[s*.1,.055,.03]],.021);
      sphere(g,m,.027,[s*.1,.053,.03]);limb(g,m,[[s*.035,.078,0],[s*.041,.024,.006]],.021);
      sphere(g,m,.022,[s*.043,.015,.022],[1,.45,1.5]);
    }
  });
  // Ghhhk: low, many-legged insect with antennae and a segmented, ridged shell.
  make("ghhhk",0x759956,(g,m)=>{
    sphere(g,m,.06,[0,.065,-.015],[.78,.7,1.35]);sphere(g,m,.033,[0,.07,.066],[1,.65,1]);
    for(let k=0;k<4;k++)sphere(g,m,.026,[0,.091,-.07+k*.034],[1.7,.42,.68]);
    for(const s of[-1,1]){
      for(let k=0;k<3;k++)limb(g,m,[[s*.028,.064,-.055+k*.045],[s*.078,.04,-.075+k*.05],[s*.092,.008,-.06+k*.055]],.006);
      limb(g,m,[[s*.015,.084,.083],[s*.032,.135,.112],[s*.043,.147,.099]],.004);
      sphere(g,eyes,.007,[s*.024,.079,.091]);
    }
  });
  // K'lor'slug: an upright scarlet worm, belly ribs and small hooked claws.
  make("klor-slug",0xcc7450,(g,m)=>{
    limb(g,m,[[0,.018,-.08],[0,.03,-.026],[0,.075,.015],[0,.15,.003],[0,.195,.045]],.026);
    sphere(g,m,.031,[0,.194,.043],[1,.95,.9]);
    for(let k=0;k<6;k++)sphere(g,m,.021,[0,.055+k*.022,.031],[1.15,.28,.58]);
    for(const s of[-1,1])limb(g,m,[[s*.019,.144,.015],[s*.05,.12,.043],[s*.055,.15,.066]],.005);
    eyePair(g,.204,.067,.013);
  });
  // Ng'ok: a hunched, long-armed brown brute with bent digitigrade legs.
  make("ngok",0xb69760,(g,m)=>{
    sphere(g,m,.035,[0,.143,0],[1,1.4,.77]);sphere(g,m,.031,[0,.198,.02],[.8,1.05,1.1]);eyePair(g,.205,.047,.015);
    for(const s of[-1,1]){
      limb(g,m,[[s*.028,.159,0],[s*.063,.105,.03],[s*.068,.054,.064]],.011);
      sphere(g,m,.015,[s*.068,.047,.066]);limb(g,m,[[s*.022,.107,0],[s*.04,.06,-.027],[s*.034,.012,.022]],.012);
      sphere(g,m,.018,[s*.034,.009,.03],[.8,.45,1.5]);
    }
  });
  // M'onnok: a tall pale figure with a narrow waist, long limbs and a forked crest.
  make("monnok",0xcbd4b0,(g,m)=>{
    sphere(g,m,.023,[0,.168,0],[1,1.7,.75]);sphere(g,m,.021,[0,.241,0],[.72,1.15,1]);
    eyePair(g,.247,.019,.01);
    for(const s of[-1,1]){
      limb(g,m,[[s*.012,.27,0],[s*.026,.294,-.008]],.004);
      limb(g,m,[[s*.022,.193,0],[s*.065,.162,.018],[s*.047,.208,.032]],.006);
      limb(g,m,[[s*.013,.133,0],[s*.032,.075,-.01],[s*.025,.009,.025]],.007);
      sphere(g,m,.014,[s*.025,.006,.035],[.65,.4,1.8]);
    }
  });
  // Grimtaash: purple batlike creature, curved neck and broad hooked wings.
  make("grimtaash",0xb58ad8,(g,m)=>{
    m.side=THREE.DoubleSide;
    sphere(g,m,.033,[0,.097,0],[.75,1.25,.78]);
    limb(g,m,[[0,.12,0],[.012,.172,-.008],[.02,.21,.02],[0,.223,.049]],.012);
    sphere(g,m,.019,[0,.22,.047],[1,.7,1.2]);eyePair(g,.227,.06,.01);
    for(const s of[-1,1]){
      limb(g,m,[[s*.018,.126,0],[s*.064,.178,-.01],[s*.11,.184,.013],[s*.082,.153,.03]],.007);
      const shape=new THREE.Shape();shape.moveTo(s*.018,.125);shape.lineTo(s*.064,.177);shape.lineTo(s*.108,.182);shape.quadraticCurveTo(s*.055,.15,s*.075,.09);shape.closePath();
      const wing=part(g,new THREE.ShapeGeometry(shape),m,[0,0,-.008]);wing.material=m; // two sides stay visible through the hologram
      limb(g,m,[[s*.014,.07,0],[s*.035,.01,.032]],.008);
    }
  });
  // Houjix: turquoise four-legged reptile, broad snout and a curling tail.
  make("houjix",0x6cbbc9,(g,m)=>{
    sphere(g,m,.042,[0,.071,-.005],[1.05,.72,1.8]);sphere(g,m,.03,[0,.096,.079],[1.2,.74,1.15]);
    sphere(g,m,.026,[0,.083,.103],[1.25,.55,1.1]);eyePair(g,.108,.094,.024);
    for(const s of[-1,1])for(const z of[-.05,.047])limb(g,m,[[s*.028,.073,z],[s*.052,.046,z-.011],[s*.052,.008,z+.025]],.009);
    limb(g,m,[[0,.066,-.07],[.026,.043,-.112],[.071,.034,-.125],[.095,.06,-.11]],.009);
    for(let i=0;i<4;i++)part(g,new THREE.ConeGeometry(.008,.025,5),m,[0,.102,-.055+i*.028]);
  });
  // Mantellian Savrip: the largest figure, with a swept-back horned head and massive arms.
  make("mantellian-savrip",0xa6a17a,(g,m)=>{
    sphere(g,m,.053,[0,.128,0],[1.12,1.25,.8]);sphere(g,m,.036,[0,.211,.011],[.85,.95,1.2]);
    sphere(g,m,.026,[0,.197,.038],[.9,.6,1.5]);eyePair(g,.22,.043,.018);
    for(const s of[-1,1]){
      limb(g,m,[[s*.021,.23,0],[s*.041,.26,-.018],[s*.052,.266,-.037]],.008);
      sphere(g,m,.031,[s*.06,.17,0]);limb(g,m,[[s*.064,.17,0],[s*.083,.103,.011],[s*.105,.065,.056]],.018);
      sphere(g,m,.022,[s*.108,.06,.06]);limb(g,m,[[s*.031,.084,0],[s*.047,.043,-.025],[s*.039,.011,.019]],.017);
      sphere(g,m,.021,[s*.04,.009,.03],[1,.45,1.6]);
    }
  });

  figures.forEach((figure,index)=>{
    const angle=index*TAU/8;
    figure.position.set(Math.sin(angle)*.375,TOP+.008,Math.cos(angle)*.375);
    figure.rotation.y=angle+Math.PI;
  });
  const traceMaterial=new THREE.LineBasicMaterial({color:0x66d7fa,transparent:true,opacity:.42,depthWrite:false,toneMapped:false});
  const trace = new THREE.Line(new THREE.BufferGeometry(),traceMaterial);trace.name="dejarik-move-trace";trace.visible=false;group.add(trace);
  const flash = new THREE.Mesh(new THREE.RingGeometry(.008,.037,24), new THREE.MeshBasicMaterial({color:0xd1f8ff,transparent:true,opacity:.7,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
  flash.name="dejarik-strike";flash.visible=false;group.add(flash);
  const objects:THREE.Object3D[]=[];group.traverse(o=>{if(o instanceof THREE.Mesh)objects.push(o);});
  let clock=0,turn=0,start=0,active=false;
  let attacker:THREE.Group=figures[0],defender:THREE.Group=figures[1];
  const origin=new THREE.Vector3(),destination=new THREE.Vector3(),midpoint=new THREE.Vector3(),side=new THREE.Vector3();
  const settle=()=>{
    attacker.position.copy(destination);defender.position.copy(origin);
    attacker.rotation.set(0,Math.atan2(-destination.x,-destination.z),0);
    defender.rotation.set(0,Math.atan2(-origin.x,-origin.z),0);
    active=false;trace.visible=false;flash.visible=false;
  };
  return {
    group,objects,
    activate:(reduced:boolean)=>{
      if(active)return;
      attacker=figures[turn%8];defender=figures[(turn+1)%8];turn++;
      origin.copy(attacker.position);destination.copy(defender.position);midpoint.copy(origin).add(destination).multiplyScalar(.5);
      side.copy(destination).sub(origin).setY(0).normalize();side.set(-side.z,0,side.x).multiplyScalar(.1);
      if(reduced){settle();return;}
      trace.geometry.dispose();trace.geometry=new THREE.BufferGeometry().setFromPoints([origin.clone().setY(TOP+.012),destination.clone().setY(TOP+.012)]);
      trace.visible=true;start=clock;active=true;
    },
    tick:(time:number,reduced:boolean)=>{
      clock=time;clockUniform.value=reduced?0:time;
      if(!active)return;
      if(reduced){settle();return;}
      const age=time-start;
      if(age>=2.7){settle();return;}
      if(age<1.1){
        const t=smooth(age/1.1);
        attacker.position.lerpVectors(origin,midpoint,t);attacker.position.y+=Math.sin(t*Math.PI)*.025;
        attacker.rotation.y=Math.atan2(destination.x-origin.x,destination.z-origin.z);
        attacker.rotation.z=Math.sin(t*Math.PI)*.14;
      }else{
        const t=smooth((age-1.1)/1.6);
        attacker.position.lerpVectors(midpoint,destination,t).addScaledVector(side,Math.sin(t*Math.PI));
        defender.position.lerpVectors(destination,origin,t).addScaledVector(side,-Math.sin(t*Math.PI));
        attacker.rotation.z=Math.sin(t*Math.PI)*-.1;defender.rotation.z=Math.sin(t*Math.PI)*.22;
        defender.position.y+=Math.sin(t*Math.PI)*.018;
      }
      flash.visible=age>1.04&&age<1.36;
      if(flash.visible){flash.position.copy(midpoint).add(new THREE.Vector3(0,.1,0));flash.scale.setScalar(.6+(age-1.04)*3);flash.rotation.y=time*2;}
    },
  };
}
