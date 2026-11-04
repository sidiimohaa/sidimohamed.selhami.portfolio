import * as THREE from "three";
import type { Sky } from "./looks";

// Bakes a world's sky into a prefiltered environment map: a gradient from ground to horizon to
// zenith with a soft sun. Cheap to build once per landing, and lights every standard material.
export function skyEnvironment(renderer: THREE.WebGLRenderer, sky: Sky) {
  const scene = new THREE.Scene();
  const sun = new THREE.Vector3(...sky.sunDir).normalize();
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(sky.top) },
      horizon: { value: new THREE.Color(sky.horizon) },
      ground: { value: new THREE.Color(sky.ground) },
      sunColor: { value: new THREE.Color(sky.sun) },
      sunDir: { value: sun },
    },
    vertexShader: `varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform vec3 top,horizon,ground,sunColor,sunDir;varying vec3 vDir;
      void main(){vec3 d=normalize(vDir);float h=d.y;
        vec3 c=h>0.0?mix(horizon,top,pow(smoothstep(0.0,1.0,h),0.6)):mix(horizon,ground,smoothstep(0.0,0.25,-h));
        float s=max(dot(d,sunDir),0.0);
        c+=sunColor*(pow(s,600.0)*30.0+pow(s,24.0)*0.6);
        gl_FragColor=vec4(c,1.0);}`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), material));
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(scene, 0.01);
  generator.dispose();
  material.dispose();
  scene.traverse((object) => (object as THREE.Mesh).geometry?.dispose());
  return target;
}
