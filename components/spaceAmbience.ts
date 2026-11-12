import * as THREE from "three";

function random(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// The galactic plane shared by the dense star band and the nebula glow.
const bandNormal = new THREE.Vector3(0.28, 0.9, -0.33).normalize();
const bandU = new THREE.Vector3()
  .crossVectors(bandNormal, new THREE.Vector3(0, 0, 1))
  .normalize();
const bandV = new THREE.Vector3().crossVectors(bandNormal, bandU);

const starTints = [
  { share: 0.16, color: [0.72, 0.82, 1] },
  { share: 0.38, color: [0.93, 0.95, 1] },
  { share: 0.26, color: [1, 0.96, 0.88] },
  { share: 0.14, color: [1, 0.88, 0.72] },
  { share: 0.06, color: [1, 0.74, 0.58] },
];

export function createStarfield(pixelRatio: number) {
  const rand = random(74);
  const count = 5600;
  const positions = new Float32Array(count * 3),
    tints = new Float32Array(count * 3),
    sizes = new Float32Array(count),
    phases = new Float32Array(count),
    flares = new Float32Array(count);
  const direction = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    if (i < count * 0.4) {
      // Gaussian spread around the galactic plane.
      const angle = rand() * Math.PI * 2,
        spread =
          Math.sqrt(-2 * Math.log(1 - rand())) *
          Math.cos(rand() * Math.PI * 2) *
          0.1;
      direction
        .copy(bandU)
        .multiplyScalar(Math.cos(angle))
        .addScaledVector(bandV, Math.sin(angle))
        .addScaledVector(bandNormal, spread)
        .normalize();
    } else {
      const z = rand() * 2 - 1,
        phi = rand() * Math.PI * 2,
        ring = Math.sqrt(1 - z * z);
      direction.set(ring * Math.cos(phi), z, ring * Math.sin(phi));
    }
    direction.multiplyScalar(170 + rand() * 90).toArray(positions, i * 3);
    const flare = i % 200 === 7 ? 1 : 0;
    const brightness = flare ? 0.95 : 0.3 + Math.pow(rand(), 2.2) * 0.7;
    let pick = rand(),
      tint = starTints[0].color;
    for (const option of starTints) {
      tint = option.color;
      if ((pick -= option.share) <= 0) break;
    }
    tints[i * 3] = tint[0] * brightness;
    tints[i * 3 + 1] = tint[1] * brightness;
    tints[i * 3 + 2] = tint[2] * brightness;
    sizes[i] = flare ? 13 + rand() * 9 : 1.15 + Math.pow(rand(), 7) * 2.9;
    phases[i] = rand();
    flares[i] = flare;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("tint", new THREE.BufferAttribute(tints, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("flare", new THREE.BufferAttribute(flares, 1));
  const uniforms = {
    time: { value: 0 },
    twinkle: { value: 1 },
    pixelRatio: { value: pixelRatio },
  };
  const points = new THREE.Points(
    geometry,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `attribute vec3 tint;attribute float size;attribute float phase;attribute float flare;
       uniform float time;uniform float twinkle;uniform float pixelRatio;
       varying vec3 vTint;varying float vFlare;
       void main(){
        float shimmer=sin(time*(.6+phase*2.2)+phase*40.0)*.3+sin(time*(2.7+phase*1.8)+phase*17.0)*.14;
        vTint=tint*max(.3,1.0+shimmer*twinkle*(1.0-flare*.65));
        vFlare=flare;
        gl_PointSize=size*pixelRatio;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
       }`,
      fragmentShader: `varying vec3 vTint;varying float vFlare;
       void main(){
        vec2 p=gl_PointCoord*2.0-1.0;float d=length(p);
        if(d>1.0)discard;
        float soft=smoothstep(1.0,.2,d);
        float spikes=(max(0.0,1.0-abs(p.x)*15.0)+max(0.0,1.0-abs(p.y)*15.0))*pow(1.0-d,2.2)*.5;
        float glow=exp(-d*d*42.0)+exp(-d*6.0)*.2+spikes;
        gl_FragColor=vec4(vTint,mix(soft,glow,vFlare));
       }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  points.frustumCulled = false;
  return {
    points,
    tick: (elapsed: number, reduced: boolean) => {
      uniforms.time.value = elapsed;
      uniforms.twinkle.value = reduced ? 0 : 1;
    },
  };
}

const skyNoise = `
 float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
 float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
 float fbm(vec3 p){float v=0.0,a=.5;for(int i=0;i<4;i++){v+=noise3(p)*a;p=p*2.03+vec3(1.7,9.2,4.1);a*=.5;}return v;}
`;

const skyVertex = `varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;

// The sky dome at infinity: the milky band with its dust lanes, four nebulae of ionised gas
// (magenta and violet, blue and cyan, a red emission cloud, a teal drift) and a few distant
// galaxies. The noise is baked once into a cube map, so each frame only samples it.
export function createNebula(renderer: THREE.WebGLRenderer, size = 768) {
  const bake = new THREE.Scene();
  const source = new THREE.Mesh(
    new THREE.SphereGeometry(10, 64, 32),
    new THREE.ShaderMaterial({
      uniforms: { bandNormal: { value: bandNormal } },
      vertexShader: skyVertex,
      fragmentShader: `${skyNoise}
       uniform vec3 bandNormal;varying vec3 direction;
       float fbm6(vec3 p){float v=0.0,a=.5;for(int i=0;i<6;i++){v+=noise3(p)*a;p=p*2.07+vec3(3.1,7.7,1.3);a*=.5;}return v;}
       // A cloud of gas around a direction: domain-warped noise, a bright core and dark filaments.
       vec3 cloud(vec3 n,vec3 center,float spread,vec3 rim,vec3 core,float seed){
        float reach=exp(-(1.0-dot(n,normalize(center)))/spread);
        vec3 warp=vec3(fbm(n*2.2+seed),fbm(n*2.2+seed+5.2),fbm(n*2.2+seed+9.7));
        float shape=fbm6(n*3.4+warp*1.6+seed);
        float gas=smoothstep(.3,.76,shape)*reach;
        float glow=pow(smoothstep(.48,.88,shape),2.0)*reach;
        float veins=smoothstep(.5,.72,fbm6(n*13.0+warp*2.0+seed*1.7));
        return (mix(rim,core,smoothstep(.2,.9,gas))*gas+core*glow*.8)*(1.0-veins*.6);
       }
       // A galaxy seen from far away: an inclined ellipse with a brighter bulge.
       float galaxy(vec3 n,vec3 center,vec3 axis,float majorAxis,float minorAxis){
        vec3 c=normalize(center);
        if(dot(n,c)<.99)return 0.0;
        vec3 u=normalize(cross(c,axis)),v=cross(c,u);
        vec3 d=n-c*dot(n,c);
        float x=dot(d,u)/majorAxis,y=dot(d,v)/minorAxis;
        float r=x*x+y*y;
        return exp(-r*3.0)*.5+exp(-r*40.0)*.9;
       }
       void main(){
        vec3 n=normalize(direction);
        float band=exp(-pow(dot(n,bandNormal)/.19,2.0));
        float wisps=fbm(n*5.1+vec3(1.0,9.0,3.0));
        float lanes=smoothstep(.46,.74,fbm6(n*8.0+vec3(7.0,2.0,5.0)));
        vec3 milk=vec3(.2,.2,.21)*band*(.32+wisps*.75)*(1.0-lanes*.82);
        vec3 sky=milk;
        vec3 gasClouds=vec3(0.0);
        gasClouds+=cloud(n,vec3(.62,.34,-.71),.16,vec3(.26,.07,.3),vec3(.62,.24,.5),1.0);
        gasClouds+=cloud(n,vec3(-.74,-.12,-.66),.14,vec3(.05,.13,.32),vec3(.18,.46,.62),4.0);
        gasClouds+=cloud(n,vec3(.24,-.58,.78),.12,vec3(.3,.05,.05),vec3(.7,.24,.18),8.0);
        gasClouds+=cloud(n,vec3(-.35,.82,.42),.2,vec3(.04,.16,.17),vec3(.14,.36,.36),12.0)*.8;
        // The backdrop of the system itself: a wide teal drift low behind the worlds, and an
        // ember cloud high to the left, so the first view has depth behind every planet.
        gasClouds+=cloud(n,vec3(.1,-.3,-.95),.24,vec3(.03,.12,.2),vec3(.1,.34,.44),17.0)*.75;
        gasClouds+=cloud(n,vec3(-.38,.5,-.78),.1,vec3(.28,.1,.05),vec3(.62,.3,.14),23.0)*.7;
        sky+=gasClouds*1.9;
        float far=galaxy(n,vec3(-.42,.36,-.83),vec3(.3,1.0,.1),.011,.0038)
          +galaxy(n,vec3(.81,.1,-.58),vec3(1.0,.4,.2),.007,.0045)
          +galaxy(n,vec3(-.1,-.86,-.5),vec3(.6,.2,1.0),.009,.003)
          +galaxy(n,vec3(.5,.62,.6),vec3(.1,.3,1.0),.006,.0022);
        sky+=vec3(.95,.85,.72)*far*.5;
        gl_FragColor=vec4(sky*.6,1.0);
       }`,
      side: THREE.BackSide,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  bake.add(source);
  const target = new THREE.WebGLCubeRenderTarget(size, {
    type: THREE.HalfFloatType,
  });
  new THREE.CubeCamera(1, 100, target).update(renderer, bake);
  source.geometry.dispose();
  source.material.dispose();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(320, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: { sky: { value: target.texture } },
      vertexShader: skyVertex,
      fragmentShader: `uniform samplerCube sky;varying vec3 direction;void main(){gl_FragColor=vec4(textureCube(sky,direction).rgb,1.0);}`,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  dome.renderOrder = -2;
  dome.frustumCulled = false;
  return { dome, texture: target.texture, dispose: () => target.dispose() };
}

// Nearer veils of gas, between the far sky and the worlds. Each is a shell that only partly
// follows the ship, so the veils slide against the stars and the sky as it travels: that slide is
// what gives the nebula a volume. The noise is baked once into a small cube map.
export function createNebulaVeils(renderer: THREE.WebGLRenderer, size = 256) {
  const bake = new THREE.Scene();
  const source = new THREE.Mesh(
    new THREE.SphereGeometry(10, 48, 24),
    new THREE.ShaderMaterial({
      vertexShader: skyVertex,
      fragmentShader: `${skyNoise}
       varying vec3 direction;
       float fbm5(vec3 p){float v=0.0,a=.5;for(int i=0;i<5;i++){v+=noise3(p)*a;p=p*2.11+vec3(4.1,2.7,8.3);a*=.5;}return v;}
       void main(){
        vec3 n=normalize(direction);
        vec3 warp=vec3(fbm(n*1.7+2.0),fbm(n*1.7+7.3),fbm(n*1.7+13.1));
        float shape=fbm5(n*2.3+warp*1.9);
        // Wisps with holes between them, thinner where a second, slower field is low.
        float density=smoothstep(.46,.82,shape)*smoothstep(.3,.62,fbm(n*1.1+21.0));
        float filaments=smoothstep(.52,.7,fbm5(n*9.0+warp*2.4));
        gl_FragColor=vec4(density*(1.0-filaments*.55),fbm(n*2.6+31.0),pow(smoothstep(.6,.92,shape),2.0),1.0);
       }`,
      side: THREE.BackSide,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  bake.add(source);
  const target = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType });
  new THREE.CubeCamera(1, 100, target).update(renderer, bake);
  source.geometry.dispose();
  source.material.dispose();
  const group = new THREE.Group();
  const layers = [
    // Teal and blue, the nearer and stronger of the two.
    { radius: 298, follow: 0.55, tilt: [0.3, 1.1, 0.2], low: [0.02, 0.1, 0.16], high: [0.1, 0.3, 0.42], core: [0.3, 0.55, 0.6], strength: 0.55, drift: 0.0021 },
    // Magenta turning to ember, further out.
    { radius: 308, follow: 0.78, tilt: [1.9, 0.4, 2.6], low: [0.14, 0.03, 0.14], high: [0.36, 0.12, 0.2], core: [0.6, 0.34, 0.24], strength: 0.42, drift: -0.0014 },
  ].map((layer) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(layer.radius, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: {
          veil: { value: target.texture },
          low: { value: new THREE.Vector3(...layer.low) },
          high: { value: new THREE.Vector3(...layer.high) },
          core: { value: new THREE.Vector3(...layer.core) },
          strength: { value: layer.strength },
        },
        vertexShader: skyVertex,
        fragmentShader: `uniform samplerCube veil;uniform vec3 low;uniform vec3 high;uniform vec3 core;uniform float strength;varying vec3 direction;
         void main(){
          vec3 v=textureCube(veil,direction).rgb;
          gl_FragColor=vec4((mix(low,high,v.g)*v.r+core*v.b*.35)*strength,1.0);
         }`,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        fog: false,
      }),
    );
    mesh.rotation.set(layer.tilt[0], layer.tilt[1], layer.tilt[2]);
    mesh.renderOrder = -1.5;
    mesh.frustumCulled = false;
    group.add(mesh);
    return { mesh, follow: layer.follow, drift: layer.drift, spin: layer.tilt[1] };
  });
  return {
    group,
    update: (camera: THREE.Camera, elapsed: number, reduced: boolean) => {
      layers.forEach((layer) => {
        layer.mesh.position.copy(camera.position).multiplyScalar(layer.follow);
        // The gas turns very slowly on itself.
        if (!reduced) layer.mesh.rotation.y = layer.spin + elapsed * layer.drift;
      });
    },
    dispose: () => {
      target.dispose();
      layers.forEach((layer) => {
        layer.mesh.geometry.dispose();
        layer.mesh.material.dispose();
      });
    },
  };
}

type Streak = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  head: THREE.Vector3;
  direction: THREE.Vector3;
  age: number;
  life: number;
  length: number;
  speed: number;
};

// Occasional meteors cross the upper sky, always spawned inside the current view.
export function createShootingStars() {
  const group = new THREE.Group();
  const streaks: Streak[] = Array.from({ length: 2 }, () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(12), 3),
    );
    geometry.setAttribute(
      "along",
      new THREE.Float32BufferAttribute([0, 0, 1, 1], 1),
    );
    geometry.setAttribute(
      "across",
      new THREE.Float32BufferAttribute([-1, 1, -1, 1], 1),
    );
    geometry.setIndex([0, 2, 1, 2, 3, 1]);
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: { fade: { value: 0 } },
        vertexShader: `attribute float along;attribute float across;varying float vAlong;varying float vAcross;void main(){vAlong=along;vAcross=across;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader: `uniform float fade;varying float vAlong;varying float vAcross;void main(){float a=pow(vAlong,2.4)*(1.0-abs(vAcross))*fade;gl_FragColor=vec4(vec3(1.0,.96,.86),a);}`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    mesh.frustumCulled = false;
    mesh.visible = false;
    group.add(mesh);
    return {
      mesh,
      head: new THREE.Vector3(),
      direction: new THREE.Vector3(),
      age: 0,
      life: 0,
      length: 0,
      speed: 0,
    };
  });
  const forward = new THREE.Vector3(),
    right = new THREE.Vector3(),
    up = new THREE.Vector3(),
    tail = new THREE.Vector3(),
    side = new THREE.Vector3(),
    corner = new THREE.Vector3();
  let wait = 5 + Math.random() * 6;
  const spawn = (camera: THREE.PerspectiveCamera) => {
    const streak = streaks.find((item) => !item.mesh.visible);
    if (!streak) return;
    forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const distance = 170,
      halfHeight = distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)),
      halfWidth = halfHeight * camera.aspect;
    streak.head
      .copy(camera.position)
      .addScaledVector(forward, distance)
      .addScaledVector(right, (Math.random() * 1.4 - 0.7) * halfWidth)
      .addScaledVector(up, (0.2 + Math.random() * 0.6) * halfHeight);
    streak.direction
      .copy(right)
      .multiplyScalar((Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.4))
      .addScaledVector(up, -(0.3 + Math.random() * 0.45))
      .normalize();
    streak.age = 0;
    streak.life = 0.6 + Math.random() * 0.45;
    streak.length = 14 + Math.random() * 12;
    streak.speed = 95 + Math.random() * 50;
    streak.mesh.visible = true;
  };
  return {
    group,
    tick: (dt: number, camera: THREE.PerspectiveCamera, active: boolean) => {
      if (active && (wait -= dt) <= 0) {
        spawn(camera);
        wait = 8 + Math.random() * 14;
      }
      streaks.forEach((streak) => {
        if (!streak.mesh.visible) return;
        streak.age += dt;
        if (streak.age >= streak.life) {
          streak.mesh.visible = false;
          return;
        }
        streak.head.addScaledVector(streak.direction, streak.speed * dt);
        const trail = Math.min(streak.length, streak.speed * streak.age);
        tail.copy(streak.head).addScaledVector(streak.direction, -trail);
        side
          .copy(streak.head)
          .sub(camera.position)
          .cross(streak.direction)
          .normalize()
          .multiplyScalar(0.24);
        const position = streak.mesh.geometry.getAttribute(
          "position",
        ) as THREE.BufferAttribute;
        corner.copy(tail).sub(side).toArray(position.array, 0);
        corner.copy(tail).add(side).toArray(position.array, 3);
        corner.copy(streak.head).sub(side).toArray(position.array, 6);
        corner.copy(streak.head).add(side).toArray(position.array, 9);
        position.needsUpdate = true;
        streak.mesh.material.uniforms.fade.value = Math.sin(
          (streak.age / streak.life) * Math.PI,
        );
      });
    },
    reset: () => {
      streaks.forEach((streak) => (streak.mesh.visible = false));
    },
  };
}
