import * as THREE from "three";

// What sets two of the destinations apart from orbit: a ring of ice around Hoth, in which the
// planet casts its shadow, and the lanes of traffic that never stop circling Coruscant.

/** A banded ring of ice and dust, lying in a tilted plane around a world of the given radius. */
export function createIceRing(radius: number, sunDirection: THREE.Vector3) {
  const inner = radius * 1.42,
    outer = radius * 2.25;
  const uniforms = {
    inner: { value: inner },
    outer: { value: outer },
    planetRadius: { value: radius },
    sunDirection: { value: sunDirection.clone().normalize() },
    time: { value: 0 },
  };
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, 160, 1),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `uniform float inner;uniform float outer;
       varying float vRadial;varying float vAngle;varying vec3 vFromCentre;
       void main(){
        vRadial=(length(position.xy)-inner)/(outer-inner);
        vAngle=atan(position.y,position.x);
        // The ring is centred on its world, so the rotated position is the offset from it.
        vFromCentre=mat3(modelMatrix)*position;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
       }`,
      fragmentShader: `uniform float planetRadius;uniform vec3 sunDirection;uniform float time;
       varying float vRadial;varying float vAngle;varying vec3 vFromCentre;
       float hash(float n){return fract(sin(n*127.1)*43758.5453);}
       float bands(float x){float i=floor(x),f=fract(x);return mix(hash(i),hash(i+1.0),f*f*(3.0-2.0*f));}
       void main(){
        // Ringlets of unequal density, with two clear gaps.
        float density=bands(vRadial*9.0)*.5+bands(vRadial*31.0+4.0)*.32+bands(vRadial*97.0+9.0)*.18;
        density*=smoothstep(.0,.06,vRadial)*smoothstep(1.0,.82,vRadial);
        density*=1.0-smoothstep(.02,.0,abs(vRadial-.38))*.85;
        density*=1.0-smoothstep(.012,.0,abs(vRadial-.71))*.7;
        // Grains of ice catch the light as the ring turns.
        float sparkle=pow(hash(floor(vAngle*420.0+time*3.0)+floor(vRadial*90.0)*17.0),24.0);
        // The world's shadow falls across the ring, away from the sun.
        float along=dot(vFromCentre,sunDirection);
        float off=length(vFromCentre-sunDirection*along);
        float shade=along<0.0?smoothstep(planetRadius*.92,planetRadius*1.04,off):1.0;
        vec3 ice=mix(vec3(.58,.7,.82),vec3(.93,.97,1.0),bands(vRadial*23.0+2.0));
        gl_FragColor=vec4((ice+sparkle*.9)*(.16+.84*shade),density*.62);
       }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    }),
  );
  mesh.rotation.set(Math.PI / 2 - 0.36, 0.22, 0.12);
  mesh.renderOrder = 2;
  return {
    mesh,
    update: (elapsed: number, reduced: boolean) => (uniforms.time.value = reduced ? 0 : elapsed),
  };
}

/** Points of light circling a world in a few inclined lanes: the air traffic of a city planet. */
export function createOrbitalTraffic(radius: number, pixelRatio: number, count = 280) {
  let seed = 3007;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const lanes = [
    { tilt: new THREE.Euler(0.42, 0.2, 0.1), reach: 1.2, speed: 0.11 },
    { tilt: new THREE.Euler(-0.75, 1.1, 0.3), reach: 1.33, speed: -0.085 },
    { tilt: new THREE.Euler(1.25, -0.5, 0.2), reach: 1.48, speed: 0.065 },
  ].map((lane) => {
    const rotation = new THREE.Quaternion().setFromEuler(lane.tilt);
    return { ...lane, u: new THREE.Vector3(1, 0, 0).applyQuaternion(rotation), v: new THREE.Vector3(0, 0, 1).applyQuaternion(rotation) };
  });
  const position = new Float32Array(count * 3),
    axisU = new Float32Array(count * 3),
    axisV = new Float32Array(count * 3),
    orbit = new Float32Array(count * 3),
    tone = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const lane = lanes[i % lanes.length];
    lane.u.toArray(axisU, i * 3);
    lane.v.toArray(axisV, i * 3);
    // Ships bunch into convoys along each lane, with a little spread across it.
    const convoy = Math.floor(rand() * 9) / 9 + rand() * 0.035;
    orbit[i * 3] = convoy * Math.PI * 2;
    orbit[i * 3 + 1] = radius * (lane.reach + (rand() - 0.5) * 0.035);
    orbit[i * 3 + 2] = lane.speed * (0.9 + rand() * 0.2);
    tone[i] = rand();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("axisU", new THREE.BufferAttribute(axisU, 3));
  geometry.setAttribute("axisV", new THREE.BufferAttribute(axisV, 3));
  geometry.setAttribute("orbit", new THREE.BufferAttribute(orbit, 3));
  geometry.setAttribute("tone", new THREE.BufferAttribute(tone, 1));
  const uniforms = { time: { value: 0 }, pixelRatio: { value: pixelRatio } };
  const points = new THREE.Points(
    geometry,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `attribute vec3 axisU;attribute vec3 axisV;attribute vec3 orbit;attribute float tone;
       uniform float time;uniform float pixelRatio;
       varying float vTone;varying float vBlink;
       void main(){
        float angle=orbit.x+time*orbit.z;
        vec3 place=(axisU*cos(angle)+axisV*sin(angle))*orbit.y;
        vTone=tone;
        vBlink=.72+.28*sin(time*(2.0+tone*5.0)+tone*40.0);
        vec4 view=modelViewMatrix*vec4(place,1.0);
        gl_PointSize=clamp((1.1+tone*.9)*pixelRatio*(70.0/max(1.0,-view.z)),1.0*pixelRatio,3.4*pixelRatio);
        gl_Position=projectionMatrix*view;
       }`,
      fragmentShader: `varying float vTone;varying float vBlink;
       void main(){
        float d=length(gl_PointCoord*2.0-1.0);
        if(d>1.0)discard;
        // Mostly warm running lights, a few cold ones.
        vec3 color=vTone>.82?vec3(.62,.86,1.0):mix(vec3(1.0,.74,.42),vec3(1.0,.93,.8),vTone);
        gl_FragColor=vec4(color*vBlink,smoothstep(1.0,.2,d)*.9);
       }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    }),
  );
  points.frustumCulled = false;
  return {
    points,
    update: (elapsed: number, reduced: boolean) => (uniforms.time.value = reduced ? 0 : elapsed),
    setPixelRatio: (ratio: number) => (uniforms.pixelRatio.value = ratio),
  };
}
