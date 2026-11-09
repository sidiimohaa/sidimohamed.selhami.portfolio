import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const screenVertex = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const screenFragment = `
 uniform float time;uniform float mode;uniform float target;uniform vec3 phosphor;
 varying vec2 vUv;
 float line(float d,float w){return 1.0-smoothstep(w,w+.008,abs(d));}
 void main(){
  vec2 p=(vUv-.5)*2.0;float r=length(p),a=atan(p.y,p.x);
  float grid=line(fract(vUv.x*12.0)-.5,.012)*.12+line(fract(vUv.y*8.0)-.5,.012)*.12;
  float signal=0.0;
  if(mode<.5){
   float rings=line(r-.3,.008)+line(r-.6,.008)+line(r-.9,.009);
   float sweep=pow(max(0.0,cos(a-time*.6)),48.0)*step(r,.92);
   vec2 blip=vec2(cos(target*1.4+1.0),sin(target*1.4+1.0))*(.35+target*.08);
   signal=rings*.36+(line(p.x,.006)+line(p.y,.006))*.15+sweep*.55+exp(-length(p-blip)*100.0);
  }else if(mode<1.5){
   float wave=sin(p.x*8.0-time*1.3)*.19+sin(p.x*17.0+time*.8)*.035;
   signal=line(p.y-wave,.008)*.8;
   for(int i=0;i<8;i++){float x=float(i)/8.0;float h=.12+.18*(.5+.5*sin(float(i)*1.7+time*.4));signal+=step(abs(vUv.x-x-.04),.025)*step(vUv.y,.18+h)*step(.18,vUv.y)*.5;}
  }else{
   float hull=line(p.x,.045)*step(abs(p.y),.64);
   float wings=line(abs(p.x)-abs(p.y)*1.65,.026)*step(.18,abs(p.y))*step(abs(p.y),.52);
   signal=hull+wings*.8+line(r-.9,.008)*.2;
   signal+=step(.92,vUv.x)*step(fract(vUv.y*11.0),.48)*(.35+.25*sin(time*.5+vUv.y*7.0));
  }
  float scan=.87+.13*sin(gl_FragCoord.y*1.6);
  vec3 color=vec3(.006,.017,.019)+(grid*.14+signal)*phosphor*scan;
  gl_FragColor=vec4(color,1.0);
  #include <colorspace_fragment>
 }`;

/** Practical cockpit fittings and low-frequency instrument animations. */
export function createCockpitSystems() {
  const group = new THREE.Group();
  group.name = "cockpit-practical-systems";
  const metal = new THREE.MeshStandardMaterial({
    color: 0x687278,
    metalness: 0.72,
    roughness: 0.54,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x182129,
    metalness: 0.52,
    roughness: 0.7,
  });
  const black = new THREE.MeshStandardMaterial({
    color: 0x090e12,
    roughness: 0.92,
  });
  const brass = new THREE.MeshStandardMaterial({
    color: 0x8d7250,
    metalness: 0.68,
    roughness: 0.65,
  });
  const leather = new THREE.MeshStandardMaterial({
    color: 0x3a2a22,
    roughness: 0.96,
  });
  const light = new THREE.MeshBasicMaterial({
    color: 0xb5c9c7,
    toneMapped: false,
  });
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const transform = new THREE.Matrix4(),
    rotation = new THREE.Quaternion(),
    location = new THREE.Vector3();
  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
  ) => {
    rotation.setFromEuler(new THREE.Euler(rx, ry, rz));
    transform.compose(
      location.set(x, y, z),
      rotation,
      new THREE.Vector3(1, 1, 1),
    );
    const baked = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    baked.applyMatrix4(transform);
    const parts = batches.get(material) ?? [];
    parts.push(baked);
    batches.set(material, parts);
  };
  const box = (
    material: THREE.Material,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
  ) =>
    add(
      new RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * 0.16),
      material,
      x,
      y,
      z,
      rx,
      ry,
      rz,
    );
  const bolt = (x: number, y: number, z: number) => {
    add(
      new THREE.CylinderGeometry(0.022, 0.022, 0.017, 8),
      metal,
      x,
      y,
      z,
      Math.PI / 2,
    );
    box(black, 0.025, 0.004, 0.003, x, y, z + 0.011);
  };
  const screens: { time: { value: number }; target: { value: number } }[] = [];
  function screen(
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    mode: number,
    rx = 0,
    ry = 0,
  ) {
    box(dark, w + 0.12, h + 0.12, 0.085, x, y, z - 0.025, rx, ry);
    box(black, w + 0.035, h + 0.035, 0.015, x, y, z + 0.028, rx, ry);
    const uniforms = {
      time: { value: 0 },
      target: { value: 0 },
      mode: { value: mode },
      phosphor: { value: new THREE.Color(mode === 1 ? 0xcba36b : 0x7bc5a8) },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: screenVertex,
      fragmentShader: screenFragment,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(x, y, z + 0.04);
    mesh.rotation.set(rx, ry, 0);
    group.add(mesh);
    screens.push(uniforms);
  }
  for (const sign of [-1, 1]) {
    // Raised instrument pods and curved handles, just below the holographic field.
    screen(
      0.64,
      0.39,
      sign * 1.63,
      0.9,
      -1.47,
      sign < 0 ? 0 : 1,
      -0.34,
      -sign * 0.12,
    );
    box(metal, 0.82, 0.075, 0.14, sign * 1.63, 1.15, -1.52);
    for (let i = 0; i < 5; i++) {
      box(dark, 0.115, 0.055, 0.08, sign * (1.35 + i * 0.14), 0.59, -1.38);
      add(
        new THREE.CylinderGeometry(0.019, 0.019, 0.1, 6),
        metal,
        sign * (1.35 + i * 0.14),
        0.67,
        -1.36,
        Math.PI * 0.15,
      );
    }
    // Layered service panels on the canopy pillars, with recessed fasteners.
    box(metal, 0.18, 0.66, 0.085, sign * 1.83, 2.02, -0.69, 0, 0, -sign * 0.2);
    box(dark, 0.105, 0.49, 0.018, sign * 1.83, 2.02, -0.637, 0, 0, -sign * 0.2);
    for (let i = 0; i < 6; i++)
      box(
        brass,
        0.064,
        0.014,
        0.018,
        sign * 1.83,
        1.84 + i * 0.065,
        -0.617,
        0,
        0,
        -sign * 0.2,
      );
    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      bolt(sign * (2.22 - 0.55 * t), 0.66 + 2.49 * t, -0.684);
    }
    // Aged padded side bolsters, stitched in separate ribs rather than a flat slab.
    box(black, 0.4, 0.6, 1.6, sign * 1.99, 0.66, 1.35);
    for (let rib = 0; rib < 7; rib++)
      box(
        leather,
        0.31,
        0.47,
        0.175,
        sign * 1.94,
        0.7,
        0.72 + rib * 0.19,
        0,
        0,
        -sign * 0.15,
      );
    // Service conduit carried by brass collars along the window sill.
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sign * 2.06, 0.94, 1.8),
      new THREE.Vector3(sign * 2.02, 1.01, 0.2),
      new THREE.Vector3(sign * 1.96, 1.05, -1.55),
    ]);
    add(new THREE.TubeGeometry(curve, 24, 0.028, 6, false), black, 0, 0, 0);
    for (let i = 0; i < 6; i++) {
      const p = curve.getPoint(i / 5);
      box(brass, 0.09, 0.073, 0.055, p.x, p.y, p.z);
    }
    // Small shoulder electrical bays give the top corners real depth.
    box(dark, 0.84, 0.28, 0.48, sign * 1.12, 2.99, -1.14, 0, 0, sign * 0.08);
    for (let i = 0; i < 8; i++) {
      box(
        metal,
        0.058,
        0.13,
        0.12,
        sign * (0.79 + i * 0.095),
        2.94,
        -0.88,
        0,
        0,
        sign * 0.08,
      );
      box(brass, 0.031, 0.04, 0.021, sign * (0.79 + i * 0.095), 2.91, -0.811);
    }
    for (const x of [sign * 0.75, sign * 1.49])
      for (const y of [2.89, 3.09]) bolt(x, y, -0.875);
    // A welded repair plate, retaining a trace of its older finish.
    box(brass, 0.19, 0.34, 0.022, sign * 2.19, 1.05, -0.65, 0, 0, -sign * 0.21);
    for (const dy of [-0.12, 0.12]) bolt(sign * 2.19, 1.05 + dy, -0.629);
  }
  // A wide overhead diagnostic display, high enough not to obscure the window or the planets.
  screen(1.5, 0.27, 0, 3.0, -1.13, 2, 0.05);
  // Small inspection lamps light their mounting recesses, not the entire cockpit.
  for (const sign of [-1, 1]) {
    box(black, 0.38, 0.11, 0.13, sign * 1.91, 1.22, -1.33);
    box(light, 0.26, 0.027, 0.035, sign * 1.91, 1.21, -1.25);
  }
  batches.forEach((parts, material) => {
    const geometry = mergeGeometries(parts, false);
    parts.forEach((part) => part.dispose());
    if (geometry) {
      geometry.computeBoundingSphere();
      group.add(new THREE.Mesh(geometry, material));
    }
  });
  // A faint windshield surface catches edge reflections and fine dust in the light.
  const glassGeometry = new THREE.BufferGeometry();
  glassGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        -2.03, 0.76, -4.88, 2.03, 0.76, -4.88, 1.43, 3.15, -4.88, -1.43, 3.15,
        -4.88,
      ],
      3,
    ),
  );
  glassGeometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2),
  );
  glassGeometry.setIndex([0, 1, 2, 0, 2, 3]);
  glassGeometry.computeVertexNormals();
  const glass = new THREE.Mesh(
    glassGeometry,
    new THREE.ShaderMaterial({
      vertexShader: screenVertex,
      fragmentShader: `varying vec2 vUv;void main(){vec2 uv=vUv;float edge=pow(abs(uv.x-.5)*2.0,9.0)+pow(abs(uv.y-.5)*2.0,12.0);float streak=exp(-pow((uv.x+uv.y*.42-.64)*160.0,2.0))*.012;float dust=step(.9985,fract(sin(dot(floor(uv*800.0),vec2(12.98,78.23)))*43758.5))*.04;gl_FragColor=vec4(.44,.64,.71,.009+edge*.035+streak+dust);}`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  group.add(glass);
  return {
    group,
    tick(elapsed: number, selected: number, reduced: boolean) {
      screens.forEach((values) => {
        values.time.value = reduced ? 0 : elapsed;
        values.target.value = selected;
      });
    },
  };
}
