import * as THREE from "three";
import { softBeam } from "../render/softBeam";

// The whole battle station seen from afar, for the arrival and the flight out, and the hold of the
// tractor beam. Lit in its own colours, it costs no scene light and is hidden while inside.

const SUN = new THREE.Vector3(-0.55, 0.45, 0.7).normalize();

const globeVertex = `varying vec3 vN;void main(){vN=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const globeFragment = `
varying vec3 vN;uniform vec3 sun;uniform vec3 dish;uniform float charge;
float line(float x,float width){float d=abs(fract(x)-0.5);float w=fwidth(x)*1.2;return 1.0-smoothstep(width,width+w,d);}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  vec3 n=normalize(vN);
  float lat=asin(n.y),lon=atan(n.x,n.z);
  // Plating: blocks of grey with lit windows in the dark half.
  vec2 cell=vec2(lon*38.0,lat*38.0);
  vec2 id=floor(cell*3.0);
  float plate=.46+.16*hash(id);
  float seams=line(cell.x,.012)*.5+line(cell.y,.012)*.5;
  float meridian=line(lon*5.09,.0035),parallel=line(lat*9.0,.0035);
  float trench=1.0-smoothstep(.009,.013,abs(lat));
  float albedo=plate*(1.0-seams*.25)*(1.0-max(meridian,parallel)*.55)*(1.0-trench*.86);
  // The great dish of the superlaser, in the northern hemisphere.
  float a=acos(clamp(dot(n,dish),-1.0,1.0));
  float bowl=1.0-smoothstep(.27,.285,a);
  vec3 toCentre=normalize(dish-n*dot(dish,n)+1e-4);
  vec3 bent=normalize(mix(n,normalize(n+toCentre*.85*(a/.28)),bowl));
  albedo=mix(albedo,.34+.06*sin(a*150.0),bowl);
  float rim=(1.0-smoothstep(0.0,.006,abs(a-.28)));
  float light=max(dot(bent,sun),0.0);
  float wrap=smoothstep(-.12,.18,dot(n,sun));
  vec3 color=vec3(.62,.66,.72)*albedo*(light*1.25+.05)+vec3(.8)*rim*.25*wrap;
  // City lights where the sun does not reach.
  float windows=step(.93,hash(floor(cell*7.0)))*(1.0-wrap)*(1.0-bowl);
  color+=vec3(1.0,.86,.62)*windows*.5;
  // The focus of the dish.
  float focus=1.0-smoothstep(.0,.03,a);
  color+=vec3(.25,1.0,.4)*(focus*(.35+charge*3.0)+(1.0-smoothstep(.0,.26,a))*charge*.3);
  gl_FragColor=vec4(color,1.0);
}`;

export function createStationExterior() {
  // The whole station, for the far view.
  const globeMaterial = new THREE.ShaderMaterial({
    vertexShader: globeVertex,
    fragmentShader: globeFragment,
    uniforms: { sun: { value: SUN }, dish: { value: new THREE.Vector3(0.46, 0.5, 0.74).normalize() }, charge: { value: 0 } },
  });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(420, 128, 96), globeMaterial);
  globe.name = "death-star-globe";
  globe.visible = false;
  // The invisible hold of the tractor beam, made faintly visible only for the arrival.
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 1, 24, 1, true),
    softBeam(new THREE.MeshBasicMaterial({ color: 0x7fc4ff, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), 6),
  );
  beam.visible = false;
  const up = new THREE.Vector3(0, 1, 0),
    span = new THREE.Vector3();
  return {
    globe,
    beam,
    /** Stretches the beam from a point of the hull to the ship it holds. */
    holdBeam: (from: THREE.Vector3, to: THREE.Vector3) => {
      span.copy(to).sub(from);
      const length = span.length();
      beam.position.copy(from).addScaledVector(span, 0.5);
      beam.quaternion.setFromUnitVectors(up, span.normalize());
      beam.scale.set(16, length, 16);
    },
    charge: (value: number) => (globeMaterial.uniforms.charge.value = value),
  };
}
