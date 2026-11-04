import * as THREE from "three";
import type { PlanetReference } from "./universe";

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
const referenceSampling = `
 uniform sampler2D referenceImage;
 uniform vec2 imageCenter;
 uniform vec2 imageRadius;
 uniform vec2 texel;
 uniform vec3 referenceRight;
 uniform vec3 referenceUp;
 uniform vec3 sunDirection;
 varying vec3 localNormal;
 varying vec3 worldNormal;
 varying vec3 viewNormal;
 varying vec3 viewPosition;
 varying vec3 worldPosition;
 vec3 sampleSurface(){
  vec3 n=normalize(localNormal);
  vec2 disk=vec2(dot(n,referenceRight),dot(n,referenceUp));
  vec2 uv=imageCenter+disk*imageRadius;
  vec3 color=texture2D(referenceImage,uv).rgb;
  vec2 offset=texel*1.25;
  vec3 nearby=(texture2D(referenceImage,uv+vec2(offset.x,0.0)).rgb+texture2D(referenceImage,uv-vec2(offset.x,0.0)).rgb+texture2D(referenceImage,uv+vec2(0.0,offset.y)).rgb+texture2D(referenceImage,uv-vec2(0.0,offset.y)).rgb)*.25;
  return clamp(color+(color-nearby)*.2,0.0,1.0);
 }
`;
const noise = `
 float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
 float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
 float clouds(vec3 p){return noise3(p)*.55+noise3(p*2.1)*.28+noise3(p*4.3)*.14;}
`;

export function createPlanetLayers(
  texture: THREE.Texture,
  framing: PlanetReference,
  radius: number,
  index: number,
  initialFacing: THREE.Vector3,
) {
  const facing = initialFacing.clone().normalize();
  const right = new THREE.Vector3()
    .crossVectors(new THREE.Vector3(0, 1, 0), facing)
    .normalize();
  const up = new THREE.Vector3().crossVectors(facing, right);
  const light = new THREE.Vector3(index === 3 ? 1 : -1, 0.55, 1).normalize();
  const uniforms = {
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
    texel: { value: new THREE.Vector2(1 / framing.width, 1 / framing.height) },
    referenceRight: { value: right },
    referenceUp: { value: up },
    sunDirection: { value: light },
  };
  const surfaceMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vertex,
    fragmentShader: `${referenceSampling}
   void main(){
    vec3 color=sampleSurface();
    float day=smoothstep(-.3,.55,dot(normalize(worldNormal),sunDirection));
    float contrast=${index === 2 ? ".55" : ".34"};
    color*=mix(1.0-contrast,1.06,day);
    // Sunlight glints on Hoth's ice fields and on Endor's oceans, never on dust or city.
    vec3 n=normalize(worldNormal),toEye=normalize(cameraPosition-worldPosition);
    float glint=pow(max(0.0,dot(n,normalize(sunDirection+toEye))),${index === 4 ? "38.0" : "70.0"});
    float shine=${index === 4 ? "smoothstep(.55,.9,dot(color,vec3(.3,.4,.3)))*.32" : index === 1 ? "smoothstep(.02,.12,color.b-color.g*.85)*.45" : "0.0"};
    color+=vec3(.92,.96,1.0)*glint*shine*day;
    // A faint warm band along the terminator, where the light grazes the atmosphere.
    float dusk=exp(-pow(dot(n,sunDirection)/.16,2.0));
    color+=${index === 3 ? "vec3(0.0)" : "vec3(.16,.07,.03)*dusk*.35"};
    gl_FragColor=vec4(color,1.0);
    #include <colorspace_fragment>
   }`,
    toneMapped: false,
    fog: false,
  });
  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 128, 96),
    surfaceMaterial,
  );
  surface.name = "reference-globe";
  const layers: THREE.Mesh[] = [surface];
  let cloudLayer: THREE.Mesh | undefined;
  if (index !== 3) {
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.026, 64, 48),
      new THREE.ShaderMaterial({
        uniforms: {
          sunDirection: { value: light },
          color: {
            value: new THREE.Color(
              index === 0 ? 0xd6bf8d : index === 1 ? 0x71b6d6 : index === 4 ? 0xbfdcf0 : 0x9f9ed5,
            ),
          },
        },
        vertexShader: vertex,
        fragmentShader: `uniform vec3 sunDirection;uniform vec3 color;varying vec3 worldNormal;varying vec3 viewNormal;varying vec3 viewPosition;
       void main(){
        float rim=pow(1.0-max(0.0,dot(normalize(viewNormal),normalize(-viewPosition))),4.0);
        float light=dot(normalize(worldNormal),sunDirection);
        float day=.2+.8*max(0.0,light);
        // The limb reddens where it crosses the terminator, as sunlight scatters through thick air.
        vec3 tint=mix(color,vec3(1.0,.55,.34),exp(-pow(light/.22,2.0))*.45);
        gl_FragColor=vec4(tint,rim*day*.2);
       }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    atmosphere.name = "atmosphere";
    layers.push(atmosphere);
  }
  if (index === 0 || index === 1 || index === 4) {
    cloudLayer = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.013, 64, 48),
      new THREE.ShaderMaterial({
        uniforms: {
          sunDirection: { value: light },
          cloudColor: {
            value: new THREE.Color(index === 1 ? 0xe7f1ef : index === 4 ? 0xf4f8fb : 0xd9bd8f),
          },
          density: { value: index === 1 ? 0.13 : index === 4 ? 0.1 : 0.035 },
        },
        vertexShader: vertex,
        fragmentShader: `${noise}
       uniform vec3 sunDirection;uniform vec3 cloudColor;uniform float density;
       varying vec3 localNormal;varying vec3 worldNormal;varying vec3 viewNormal;varying vec3 viewPosition;
       void main(){vec3 n=normalize(localNormal);float wisps=smoothstep(.47,.7,clouds(n*8.0+vec3(2,0,1)));float day=.3+.7*max(0.0,dot(normalize(worldNormal),sunDirection));float edge=smoothstep(.0,.25,dot(normalize(viewNormal),normalize(-viewPosition)));gl_FragColor=vec4(cloudColor*day,wisps*density*edge);}`,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    cloudLayer.name = index === 1 ? "independent-clouds" : index === 4 ? "snow-storms" : "dust-veil";
    layers.push(cloudLayer);
  }
  if (index === 2) {
    const lights = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.0015, 96, 64),
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: vertex,
        fragmentShader: `${referenceSampling}
       void main(){vec3 color=sampleSurface();float night=1.0-smoothstep(-.25,.7,dot(normalize(worldNormal),sunDirection));float gold=smoothstep(.035,.19,color.r)*smoothstep(1.15,2.4,color.r/(color.b+.015));gl_FragColor=vec4(color*vec3(1.1,.85,.65),gold*(.12+night*.65));
       #include <colorspace_fragment>
       }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    lights.name = "city-night-lights";
    layers.push(lights);
  }
  return {
    layers,
    // The references are photographs of a disk, not equirectangular maps. Keep
    // their projection aligned with the viewer so the photographed limb never
    // runs through the middle of the globe when flying around it.
    faceViewer: (direction: THREE.Vector3) => {
      facing.copy(direction).normalize();
      right.crossVectors(Math.abs(facing.y) > .999 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0), facing).normalize();
      up.crossVectors(facing, right).normalize();
    },
    tick: (dt: number, reduced: boolean) => {
      if (!reduced && cloudLayer)
        cloudLayer.rotation.y += dt * (index === 1 ? 0.018 : 0.008);
    },
  };
}
