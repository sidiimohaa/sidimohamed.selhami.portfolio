import * as THREE from "three";

const noise = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
}
float fbm(vec2 p) { float v=0., a=.5; for(int i=0;i<4;i++){ v+=noise(p)*a; p=p*2.03+13.1; a*=.5; } return v; }
`;

export function createBlackHole(low: boolean) {
  const group = new THREE.Group();
  group.name = "event-horizon-singularity";
  group.visible = false;
  const uniforms = { time: { value: 0 }, strength: { value: 0 }, reduced: { value: 0 }, echo: { value: 0 } };
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, low ? 32 : 64, 32), new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false }));
  group.add(core);
  const diskMaterial = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 local; void main(){local=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: /* glsl */ `
      varying vec3 local; uniform float time; uniform float strength; uniform float reduced; uniform float echo;
      ${noise}
      void main(){
        float r=length(local.xy), a=atan(local.y,local.x);
        float flow=time*(1.-reduced)*.45/pow(r,.85);
        vec2 uv=vec2(a*3.-flow*3.+r*2.4,r*3.8);
        float cloud=fbm(uv), fine=fbm(uv*3.7+time*.02);
        float lanes=.55+.45*sin(r*52.+cloud*7.+sin(a*5.-flow)*1.3);
        float edge=smoothstep(1.12,1.5,r)*(1.-smoothstep(3.5,5.8,r));
        edge*=mix(1.,smoothstep(0.,.32,abs(local.y))*.46,echo);
        float heat=pow(1.3/r,1.75)*(0.55+cloud*.9+fine*.4);
        float doppler=.65+.8*pow(max(0.,cos(a+.4)),2.);
        vec3 color=mix(vec3(1.,.16,.025),vec3(1.,.62,.25),clamp(heat,0.,1.));
        color=mix(color,vec3(1.,.94,.79),smoothstep(.62,1.5,heat));
        float energy=(.5+lanes*.7+fine*.6)*heat*doppler;
        gl_FragColor=vec4(color*energy*2.8,edge*strength*.82);
      }`,
  });
  const disk = new THREE.Mesh(new THREE.RingGeometry(1.12, 5.8, low ? 96 : 192, 8), diskMaterial);
  disk.rotation.set(1.22, 0.12, -0.14);
  group.add(disk);
  // A second, lensed image of the far disk arches over the photon sphere.
  const echoMaterial = diskMaterial.clone();
  echoMaterial.uniforms = { ...uniforms, echo: { value: 1 } };
  const echo = new THREE.Mesh(new THREE.RingGeometry(1.04, 2.5, low ? 96 : 192, 4), echoMaterial);
  echo.scale.set(1.08, 0.83, 1);
  echo.position.z = -0.08;
  group.add(echo);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffe5b7, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.045, 0.018, 8, low ? 96 : 192), ringMaterial);
  group.add(ring);
  const count = low ? 320 : 1800;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3), seeds = new Float32Array(count * 4);
  let seed = 1977;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < count; i++) seeds.set([rand(), rand(), rand(), rand()], i * 4);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("seed", new THREE.BufferAttribute(seeds, 4));
  const particles = new THREE.Points(geometry, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec4 seed; uniform float time; uniform float strength; uniform float reduced;
      varying float fade; varying float heat;
      void main(){
        float life=fract(seed.x-time*(1.-reduced)*(.025+seed.w*.035));
        float r=1.18+life*7.5;
        float a=seed.y*6.28318+time*(1.-reduced)*1.4/pow(r,.7)+life*3.;
        vec3 p=vec3(cos(a)*r,sin(a)*r*.22+(seed.z-.5)*life*.55,sin(a)*r*.88);
        vec4 view=modelViewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*view;
        gl_PointSize=clamp(65./max(1.,-view.z)*(1.+seed.w*2.),1.,4.);
        fade=smoothstep(0.,.13,life)*(1.-smoothstep(.65,1.,life))*strength;
        heat=1.-life;
      }`,
    fragmentShader: `varying float fade; varying float heat; void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(mix(vec3(1.,.23,.04),vec3(1.,.89,.65),heat)*2.,(1.-smoothstep(.05,.5,d))*fade);}`,
  }));
  particles.frustumCulled = false;
  group.add(particles);
  return {
    group,
    update(time: number, strength: number, reduced: boolean) {
      uniforms.time.value = time;
      uniforms.strength.value = strength;
      uniforms.reduced.value = Number(reduced);
      ringMaterial.opacity = strength * 0.95;
    },
    dispose() {
      group.removeFromParent();
      core.geometry.dispose(); (core.material as THREE.Material).dispose();
      disk.geometry.dispose(); echo.geometry.dispose(); diskMaterial.dispose(); echoMaterial.dispose();
      ring.geometry.dispose(); ringMaterial.dispose();
      geometry.dispose(); (particles.material as THREE.Material).dispose();
    },
  };
}

export function createGravityPass() {
  // A copy of the finished frame, already tone mapped and in display colours.
  let copy: THREE.FramebufferTexture | null = null;
  const uniforms = {
    image: { value: null as THREE.Texture | null }, center: { value: new THREE.Vector2(0.5, 0.5) },
    aspect: { value: 1 }, radius: { value: 0 }, lens: { value: 0 },
    time: { value: 0 }, pull: { value: 0 }, anomaly: { value: 0 }, fade: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: `varying vec2 uvScreen;void main(){uvScreen=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: /* glsl */ `
      varying vec2 uvScreen; uniform sampler2D image; uniform vec2 center;
      uniform float aspect,radius,lens,time,pull,anomaly,fade;
      vec3 sampleSky(vec2 uv){return texture2D(image,clamp(uv,vec2(.001),vec2(.999))).rgb;}
      void main(){
        vec2 p=(uvScreen-center)*vec2(aspect,1.);
        float r=length(p), horizon=max(.0001,radius);
        float field=lens*horizon*horizon/max(r*r,.002);
        float twist=pull*.24*exp(-r*1.7);
        mat2 spin=mat2(cos(twist),-sin(twist),sin(twist),cos(twist));
        vec2 warped=spin*p*(1.-min(.42,field)*smoothstep(horizon*1.35,horizon*2.4,r));
        warped+=normalize(p+vec2(.0001))*sin(r*35.-time*2.)*anomaly*.0015;
        vec2 uv=center+warped/vec2(aspect,1.);
        vec2 aberration=p/max(r,.001)*field*.002/vec2(aspect,1.);
        vec3 color=vec3(sampleSky(uv+aberration).r,sampleSky(uv).g,sampleSky(uv-aberration).b);
        float photon=exp(-pow((r-horizon*1.065)/max(.0005,horizon*.022),2.));
        float halo=exp(-abs(r-horizon*1.1)/max(.001,horizon*.19));
        color+=vec3(1.,.76,.39)*(photon*2.5+halo*.13)*lens;
        color*=smoothstep(horizon*.97,horizon*1.005,r);
        color*=1.-fade;
        gl_FragColor=vec4(color,1.);
      }`,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geometry, material));
  const camera = new THREE.Camera();
  return {
    uniforms, scene, camera,
    /** The texture to copy the frame into, at the drawing buffer's size. */
    frame(width: number, height: number) {
      if (!copy || copy.image.width !== width || copy.image.height !== height) {
        copy?.dispose();
        copy = new THREE.FramebufferTexture(width, height);
        uniforms.image.value = copy;
      }
      return copy;
    },
    dispose() { copy?.dispose(); geometry.dispose(); material.dispose(); },
  };
}
