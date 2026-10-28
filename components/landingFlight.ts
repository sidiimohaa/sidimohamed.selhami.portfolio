import * as THREE from "three";

/** The optional entry point lets a cavern receive the craft through its open mouth. */
export function landingArrival(clock:number,rest:THREE.Vector3,from?:THREE.Vector3,entryYaw=Math.PI){
  const clamp=(t:number)=>THREE.MathUtils.clamp(t,0,1);
  const ease=(t:number)=>{const k=clamp(t);return k*k*(3-2*k);};
  const glide=1-Math.pow(1-clamp(clock/3.6),3),sink=ease(clock/4.4);
  const origin=from??new THREE.Vector3(rest.x,rest.y+40,rest.z-112);
  const position=new THREE.Vector3(THREE.MathUtils.lerp(origin.x,rest.x,glide),THREE.MathUtils.lerp(origin.y,rest.y,sink),THREE.MathUtils.lerp(origin.z,rest.z,glide));
  const turn=from?ease((clock-2)/1.5):1;
  const yaw=THREE.MathUtils.lerp(entryYaw,Math.PI,turn);
  const rotation=new THREE.Euler(-.25*(1-glide),yaw,from?Math.sin(turn*Math.PI)*.07:Math.sin(sink*Math.PI)*.06);
  return {position,rotation};
}
