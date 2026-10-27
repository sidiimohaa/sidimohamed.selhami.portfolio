import * as THREE from "three";
import type { PlanetReference } from "./universe";

export function referencePlanetMaterial(
  texture: THREE.Texture,
  framing: PlanetReference,
) {
  return new THREE.ShaderMaterial({
    uniforms: {
      referenceImage: { value: texture },
      imageCenter: {
        value: new THREE.Vector2(
          framing.centerX / framing.width,
          1 - framing.centerY / framing.height,
        ),
      },
      imageRadius: {
        value: new THREE.Vector2(
          framing.radius / framing.width,
          framing.radius / framing.height,
        ),
      },
      texel: {
        value: new THREE.Vector2(1 / framing.width, 1 / framing.height),
      },
    },
    vertexShader: `
      varying vec3 surfaceNormal;
      varying vec3 globeCenter;
      void main() {
        surfaceNormal = normalMatrix * normal;
        globeCenter = (modelViewMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D referenceImage;
      uniform vec2 imageCenter;
      uniform vec2 imageRadius;
      uniform vec2 texel;
      varying vec3 surfaceNormal;
      varying vec3 globeCenter;
      void main() {
        // Project the photographed hemisphere onto actual spherical geometry.
        // This preserves its painted lighting and avoids stretching a globe into a UV map.
        vec3 facing = normalize(-globeCenter);
        vec3 right = normalize(cross(vec3(0.0,1.0,0.0),facing));
        vec3 up = cross(facing,right);
        vec3 n = normalize(surfaceNormal);
        vec2 disk = vec2(dot(n,right),dot(n,up));
        vec2 uv = imageCenter + disk * imageRadius;
        vec3 color = texture2D(referenceImage,uv).rgb;
        vec2 offset = texel * 1.25;
        vec3 nearby = (
          texture2D(referenceImage,uv+vec2(offset.x,0.0)).rgb +
          texture2D(referenceImage,uv-vec2(offset.x,0.0)).rgb +
          texture2D(referenceImage,uv+vec2(0.0,offset.y)).rgb +
          texture2D(referenceImage,uv-vec2(0.0,offset.y)).rgb
        ) * 0.25;
        color = clamp(color+(color-nearby)*0.2,0.0,1.0);
        gl_FragColor = vec4(color,1.0);
        #include <colorspace_fragment>
      }
    `,
    // The source images already contain light, atmosphere and city illumination.
    toneMapped: false,
    fog: false,
  });
}
