import * as THREE from "three";

// Coruscant seen from orbit, built in 3D instead of projected from a painted disk: a planet-wide
// city made of districts (circular, ringed, with a dark plaza at the centre), avenue networks along
// their borders and blocks at three scales that fade out with distance. By day it is a metallic
// grey-and-copper crust under smog; by night it lights up from within.

const vertex = `
 varying vec3 localNormal;
 varying vec3 worldNormal;
 varying vec3 viewNormal;
 varying vec3 viewPosition;
 varying vec3 worldPosition;
 void main(){
  localNormal=normal;
  worldNormal=normalize(mat3(modelMatrix)*normal);
  worldPosition=(modelMatrix*vec4(position,1.0)).xyz;
  viewNormal=normalize(normalMatrix*normal);
  vec4 positionInView=modelViewMatrix*vec4(position,1.0);
  viewPosition=positionInView.xyz;
  gl_Position=projectionMatrix*positionInView;
 }
`;

const noise = `
 float h13(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}
 vec3 h33(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.xxy+p.yxx)*p.zyx);}
 float vn(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h13(i),h13(i+vec3(1,0,0)),f.x),mix(h13(i+vec3(0,1,0)),h13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h13(i+vec3(0,0,1)),h13(i+vec3(1,0,1)),f.x),mix(h13(i+vec3(0,1,1)),h13(i+vec3(1,1,1)),f.x),f.y),f.z);
 }
 float fbm(vec3 p){float a=.5,s=0.0;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}
`;

const surfaceFragment = `${noise}
 uniform vec3 sunDirection;
 varying vec3 localNormal;
 varying vec3 worldNormal;
 varying vec3 worldPosition;

 // Nearest feature point of a 3D cellular pattern: x = distance to it, y = how far the second
 // nearest is beyond it (small on the borders between cells), z = a random id for the cell.
 vec3 cell(vec3 p){
  vec3 i=floor(p),f=fract(p);
  float d1=9.0,d2=9.0,id=0.0;
  for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
   vec3 g=vec3(float(x),float(y),float(z));
   vec3 r=g+h33(i+g)-f;
   float d=dot(r,r);
   if(d<d1){d2=d1;d1=d;id=h13(i+g+17.0);}
   else if(d<d2){d2=d;}
  }
  d1=sqrt(d1);d2=sqrt(d2);
  return vec3(d1,d2-d1,id);
 }

 // One layer of city blocks on a plane: x = street (1 on the street), y and z = random per block.
 vec3 blocks(vec2 uv,float seed,float aa,out float ao){
  vec2 f=fract(uv),i=floor(uv),e=min(f,1.0-f);
  float m=min(e.x,e.y);
  ao=smoothstep(.02,.3,m);
  float street=1.0-smoothstep(.035,.075+aa,m);
  return vec3(street,h13(vec3(i,seed)),h13(vec3(i+7.0,seed+3.0)));
 }
 // The same layer wrapped on the sphere through its three dominant planes, faded when a block
 // becomes smaller than a pixel.
 vec3 grid(vec3 n,vec3 w,float scale,float px,out float ao){
  float aa=px*scale;
  float ax,ay,az;
  vec3 a=blocks(n.yz*scale,1.0,aa,ax),b=blocks(n.zx*scale,2.0,aa,ay),c=blocks(n.xy*scale,3.0,aa,az);
  vec3 r=a*w.x+b*w.y+c*w.z;
  float fade=1.0-smoothstep(.16,.46,aa);
  ao=mix(1.0,ax*w.x+ay*w.y+az*w.z,fade);
  return vec3(r.x*fade,mix(.5,r.y,fade),mix(.5,r.z,fade));
 }

 void main(){
  vec3 n=normalize(localNormal);
  vec3 N=normalize(worldNormal);
  vec3 V=normalize(cameraPosition-worldPosition);
  float ndl=dot(N,sunDirection);
  // How much of the planet one pixel covers: decides which scales of detail are worth drawing.
  float px=length(fwidth(n));

  // Districts: rings around a dark plaza, avenues along the borders between neighbours.
  // The borders wander a little, like districts that grew into each other rather than a lattice.
  vec3 wob=vec3(fbm(n*2.0+1.0),fbm(n*2.0+5.0),fbm(n*2.0+9.0))-.5;
  vec3 cl=cell(n*3.4+wob*1.1);
  float d=cl.x,edge=cl.y,id=cl.z;
  float ringFreq=mix(6.5,13.0,id);
  float ringAa=px*3.4*ringFreq;
  float ringFade=1.0-smoothstep(.2,.6,ringAa);
  float rr=abs(fract(d*ringFreq+id*7.0)-.5);
  float arc=smoothstep(.22,.5,vn(n*22.0+id*13.0));
  float ring=(1.0-smoothstep(.05,.11+ringAa,rr))*arc*smoothstep(.13,.2,d)*(1.0-smoothstep(.4,.5,d))*ringFade;
  float pit=1.0-smoothstep(.07,.14,d);
  float avenue=(1.0-smoothstep(.0,.026+px*3.4,edge))*smoothstep(.3,.62,vn(n*17.0+id*9.0));

  // Blocks at three scales.
  vec3 w=pow(abs(n),vec3(5.0));w/=(w.x+w.y+w.z);
  float aoC,aoM,aoF=1.0;
  vec3 gC=grid(n,w,9.0,px,aoC);
  vec3 gM=grid(n,w,26.0,px,aoM);
  float fadeM=1.0-smoothstep(.16,.46,px*26.0);
  #ifdef FINE
  vec3 gF=grid(n,w,64.0,px,aoF);
  float fadeF=1.0-smoothstep(.16,.46,px*64.0);
  #else
  vec3 gF=vec3(0.0,.5,.5);
  float fadeF=0.0;
  #endif
  float street=max(gC.x*.25*smoothstep(.3,.7,gC.z),max(gM.x*.5,gF.x*.4));
  float occlusion=mix(.5,1.0,aoC)*mix(.55,1.0,aoM)*mix(.65,1.0,aoF);
  float blockTone=gC.y*.45+gM.y*.4+gF.y*.15;

  // Daytime colour: duracrete and steel with copper-roofed quarters.
  float macro=fbm(n*2.2+vec3(3.0,1.0,7.0));
  float quarter=fbm(n*6.5+vec3(4.0));
  vec3 base=mix(vec3(.014,.012,.011),vec3(.21,.165,.125),smoothstep(.3,.72,macro));
  base=mix(base,vec3(.3,.12,.05),smoothstep(.42,.74,quarter)*.7);
  base=mix(base,vec3(.06,.075,.1),smoothstep(.6,.9,fbm(n*3.0+vec3(9.0)))*.55);
  vec3 albedo=base*(.3+1.4*blockTone*blockTone+.2*blockTone);
  albedo*=(1.0-street*.7)*occlusion;
  albedo=mix(albedo,base*2.4+vec3(.03,.016,.008),ring*.55);
  albedo=mix(albedo,base*1.5,avenue*.25);
  albedo*=1.0-pit*.75;

  float lambert=max(ndl,0.0);
  vec3 lit=albedo*(vec3(1.0,.95,.86)*lambert*1.85+vec3(.55,.62,.8)*.02);
  // The smog scatters a little warm light past the terminator.
  float dusk=exp(-pow(ndl/.2,2.0));
  lit+=albedo*vec3(.9,.42,.18)*dusk*.5;
  // Glints on the metal of the towers, never on the streets.
  float spec=pow(max(dot(N,normalize(sunDirection+V)),0.0),46.0)*(.12+.6*gM.y*gM.y)*(1.0-street)*(1.0-pit);
  lit+=vec3(1.0,.9,.78)*spec*lambert*.5;

  // Night: the city lights itself, in clusters, brightest along rings and avenues.
  float night=1.0-smoothstep(-.1,.3,ndl);
  float core=smoothstep(.62,.12,d)*(.45+.9*id);
  float act=smoothstep(.4,.72,fbm(n*3.2+vec3(11.0,4.0,2.0))*.7+core*.45)*(1.0-pit*.85);
  float lamps=step(.68,gM.z)*(.4+.6*gM.y)*fadeM*(1.0-gM.x)+step(.7,gF.z)*(.4+.6*gF.y)*fadeF*(1.0-gF.x);
  float lanes=gC.x*(.3+.4*gC.z)+gM.x*fadeM*.3+gF.x*fadeF*.2;
  float far=(1.0-fadeM)*.22*(.4+.6*quarter);
  float L=(lamps*.9+lanes*.55+far)*act+ring*(.3+.3*id)*(.3+.7*act)+avenue*.55*(.25+.75*act);
  L+=pit*(.06+.14*h13(floor(n*40.0)));
  vec3 warm=mix(vec3(1.0,.5,.17),vec3(1.0,.8,.5),gM.z);
  vec3 cool=vec3(.55,.8,1.0);
  vec3 lightColour=mix(warm,cool,step(.93,h13(vec3(floor(n*90.0)+3.0)))*.7);
  vec3 emissive=lightColour*L*night*1.25;

  gl_FragColor=vec4(lit+emissive,1.0);
  #include <colorspace_fragment>
 }
`;

const smogFragment = `${noise}
 uniform vec3 sunDirection;
 varying vec3 localNormal;
 varying vec3 worldNormal;
 varying vec3 viewNormal;
 varying vec3 viewPosition;
 void main(){
  vec3 n=normalize(localNormal);
  vec3 N=normalize(worldNormal);
  float ndl=dot(N,sunDirection);
  // Streaks stretched along the latitudes, warped so they curl like pollution drifting on the wind.
  vec3 q=vec3(n.x*2.2,n.y*5.5,n.z*2.2);
  vec3 warp=vec3(fbm(q*1.6+3.0),fbm(q*1.6+8.0),fbm(q*1.6+14.0))-.5;
  float body=fbm(q*1.5+warp*2.4);
  float wisps=smoothstep(.43,.7,body);
  float thin=smoothstep(.3,.62,fbm(q*3.4+warp*3.0+vec3(5.0)))*.35;
  float cover=clamp(wisps+thin,0.0,1.0);
  float day=smoothstep(-.15,.5,ndl);
  float facing=clamp(dot(normalize(viewNormal),normalize(-viewPosition)),0.0,1.0);
  float edge=(.12+.88*pow(1.0-facing,1.4))*smoothstep(.0,.08,facing);
  vec3 smog=vec3(.36,.28,.21)*(.03+.9*max(ndl,0.0));
  // On the night side the smog glows from the city underneath.
  vec3 glow=vec3(.5,.2,.07)*(1.0-day)*(.35+.65*fbm(n*5.0+vec3(2.0)))*.55;
  float dusk=exp(-pow(ndl/.22,2.0));
  smog+=vec3(.5,.22,.09)*dusk*.45;
  gl_FragColor=vec4(smog+glow,cover*.7*edge);
  #include <colorspace_fragment>
 }
`;

export function createCoruscantLayers(radius: number, light: THREE.Vector3, detail: number) {
  const uniforms = { sunDirection: { value: light } };
  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 160, 112),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vertex,
      fragmentShader: surfaceFragment,
      defines: detail >= 0.7 ? { FINE: "" } : {},
      toneMapped: false,
      fog: false,
    }),
  );
  surface.name = "coruscant-surface";
  const smog = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.011, 96, 64),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vertex,
      fragmentShader: smogFragment,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  smog.name = "coruscant-smog";
  // The axis leans a little, like a real planet's; the smog drifts slower than the crust turns.
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.32);
  const spin = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 1, 0);
  let crust = 2.1,
    veil = 0.6;
  const apply = () => {
    surface.quaternion.copy(tilt).multiply(spin.setFromAxisAngle(axis, crust));
    smog.quaternion.copy(tilt).multiply(spin.setFromAxisAngle(axis, veil));
  };
  apply();
  return {
    layers: [surface, smog] as THREE.Mesh[],
    tick: (dt: number, reduced: boolean) => {
      if (reduced) return;
      crust += dt * 0.012;
      veil += dt * 0.02;
      apply();
    },
    // Test and preview hook: put a given longitude of the crust in front of the viewer.
    setTurn: (turn: number) => {
      crust = turn;
      veil = turn * 0.3;
      apply();
    },
  };
}
