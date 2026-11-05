import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { podModules, type PodModuleId } from "./modules";
import type { PodVehicle } from "./types";

type Point = [number, number, number];

function mesh(group: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, point: Point) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...point);
  group.add(object);
  return object;
}

function mergeStatic(group: THREE.Group) {
  const sets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const item of [...group.children]) {
    if (!(item instanceof THREE.Mesh) || Array.isArray(item.material)) continue;
    item.updateMatrix();
    const geometry = item.geometry.index ? item.geometry.toNonIndexed() : item.geometry.clone();
    geometry.applyMatrix4(item.matrix);
    const collection = sets.get(item.material) ?? [];
    collection.push(geometry);
    sets.set(item.material, collection);
    item.geometry.dispose();
    group.remove(item);
  }
  for (const [material, geometries] of sets) {
    const geometry = mergeGeometries(geometries);
    geometries.forEach((part) => part.dispose());
    if (geometry) group.add(new THREE.Mesh(geometry, material));
  }
}

const cylinder = (front: number, back: number, length: number, segments = 20) =>
  new THREE.CylinderGeometry(front, back, length, segments).rotateX(Math.PI / 2);
const ring = (radius: number, width: number, segments = 24) =>
  new THREE.TorusGeometry(radius, width, 6, segments);

function tube(points: Point[], radius: number) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point))), 14, radius, 5, false);
}

function fin(outline: [number, number][]) {
  const shape = new THREE.Shape();
  shape.moveTo(...outline[0]);
  outline.slice(1).forEach((point) => shape.lineTo(...point));
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false }).rotateX(Math.PI / 2);
}

/** Sections are [longitudinal position, half-width, height, vertical offset]. */
function fairing(sections: [number, number, number, number][]) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const sides = 12;
  for (let i = 0; i < sections.length; i++) {
    const [z, width, height, lift] = sections[i];
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      positions.push(Math.cos(a) * width, Math.max(-0.46, Math.sin(a)) * height + lift, z);
      uvs.push(j / sides, i / (sections.length - 1));
      if (i < sections.length - 1 && j < sides) {
        const v = i * (sides + 1) + j;
        indices.push(v, v + 1, v + sides + 1, v + 1, v + sides + 2, v + sides + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function arcMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { clock: { value: 0 }, power: { value: 0.65 } },
    vertexShader: `varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform float clock;uniform float power;varying vec2 p;
      void main(){
        float strand=.5+.14*sin(p.x*29.+clock*9.)+.07*sin(p.x*93.-clock*16.);
        float d=abs(p.y-strand);
        float core=1.-smoothstep(.012,.038,d);
        float glow=exp(-d*13.);
        float fork=exp(-abs(p.y-strand-.10*sin(p.x*22.-clock*6.))*29.)*.54;
        gl_FragColor=vec4(mix(vec3(.35,.08,.95),vec3(1.,.81,1.),core),clamp((glow*.41+core*.86+fork*.47)*power,0.,1.));
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
}

function exhaustMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { thrust: { value: 0.4 }, heat: { value: 0 }, clock: { value: 0 } },
    vertexShader: `varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform float thrust;uniform float heat;uniform float clock;varying vec2 p;
      void main(){
        float fade=pow(clamp(1.-p.y,0.,1.),1.9);
        float wave=.74+.26*sin(p.y*35.-clock*18.+sin(p.x*19.)*.28);
        vec3 hot=mix(vec3(.15,.54,1.),vec3(1.,.16,.035),heat);
        gl_FragColor=vec4(mix(hot,vec3(.95,.93,1.),fade*.62),fade*wave*thrust*.8);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
}

export function createPodModel(color: number, ghost = false, module: PodModuleId = "ulzer") {
  const root = new THREE.Group();
  root.scale.set(.62, 1, .73);
  const hull = new THREE.Group();
  root.add(hull);
  if (ghost) {
    const body = new THREE.MeshBasicMaterial({ color: 0x9ef0ff, transparent: true, opacity: .27, depthWrite: false });
    mesh(hull, fairing([[-3.1,.15,.11,.08],[-2.7,.7,.35,.14],[-1.7,.95,.40,.12],[-.3,.76,.29,.11],[.8,.12,.09,.10]]), body, [0,0,0]);
    for (const side of [-1, 1]) {
      mesh(hull, cylinder(.7,.51,3.9,12), body, [side*2.55,.34,4.5]);
      mesh(hull, tube([[side*.66,.22,-.6],[side*1.32,.08,1.3],[side*2.55,.33,2.55]], .034), body, [0,0,0]);
    }
    mergeStatic(hull);
    return { root, update: (_state: PodVehicle, _time: number, _reduced: boolean) => {} };
  }

  const shape = podModules[module].shape;
  hull.scale.set(shape.hullWidth, 1, shape.hullLength);
  // The aft end of every engine stays where the cables arrive, however long the engine is.
  const engineZ = 2.4 + 2.07 * shape.length;
  const paint = new THREE.MeshStandardMaterial({ color, metalness: .31, roughness: .44 });
  const darkPaint = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(.43), metalness: .45, roughness: .58 });
  const ivory = new THREE.MeshStandardMaterial({ color: 0xe2d7ba, metalness: .27, roughness: .47 });
  const alloy = new THREE.MeshStandardMaterial({ color: 0x8d9291, metalness: .64, roughness: .41 });
  const frame = new THREE.MeshStandardMaterial({ color: 0x25292b, metalness: .5, roughness: .72 });
  const gunmetal = new THREE.MeshStandardMaterial({ color: 0x444645, metalness: .54, roughness: .56 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xbe7544, metalness: .49, roughness: .51 });
  const meters = new THREE.MeshBasicMaterial({ color: 0x78e7fd, toneMapped: false });

  mesh(hull, fairing([[-3.15,.10,.13,.11],[-2.80,.68,.36,.16],[-1.96,.98,.43,.13],[-.78,.91,.39,.11],[.17,.68,.28,.13],[1.03,.12,.07,.13]]), paint, [0,0,0]);
  mesh(hull, fairing([[-2.78,.49,.18,-.03],[-1.93,.83,.2,-.09],[-.7,.76,.16,-.1],[.57,.28,.05,-.03]]), darkPaint, [0,0,0]);
  const tub = mesh(hull, new THREE.BoxGeometry(.92,.29,1.34), frame, [0,.54,-1.32]);
  tub.rotation.x = -.09;
  const seat = mesh(hull, new THREE.BoxGeometry(.6,.55,.24), gunmetal, [0,.76,-1.9]);
  seat.rotation.x = .15;
  mesh(hull, new THREE.BoxGeometry(.84,.18,.36), gunmetal, [0,.66,-.65]);
  for (let i=0;i<5;i++) mesh(hull, new THREE.BoxGeometry(.075,.02,.053), meters, [-.25+i*.125,.76,-.64]);
  for (const side of [-1,1]) {
    mesh(hull, tube([[side*.51,.64,-1.95],[side*.59,.72,-1.26],[side*.44,.69,-.63]],.055), alloy, [0,0,0]);
    mesh(hull, fin([[side*.52,-2.3],[side*1.18,-2.61],[side*1.15,-1.2],[side*.72,-.7]]), darkPaint, [0,.1,0]);
    const stripe = mesh(hull, new THREE.BoxGeometry(.074,.026,1.14), ivory, [side*.47,.47,-2.32]);
    stripe.rotation.set(-.25,side*.13,side*.22);
    mesh(hull, tube([[side*.66,.23,-.56],[side*.97,.02,.25],[side*(shape.spread*.64),.03,1.68],[side*(shape.spread-.07),.3,2.61]],.057), alloy, [0,0,0]);
    mesh(hull, tube([[side*.62,.13,-.59],[side*.89,-.09,.38],[side*(shape.spread*.65),.01,1.59],[side*(shape.spread-.17),.26,2.59]],.025), frame, [0,0,0]);
    mesh(hull, new THREE.BoxGeometry(.33,.18,.1), gunmetal, [side*.43,.34,-2.74]);
  }
  mergeStatic(hull);

  // Four engines are two stacked pairs; both of a pair answer to the same heat and health.
  const mounts = shape.engines === 4
    ? [[-1,.72,0],[-1,-.28,0],[1,.72,1],[1,-.28,1]]
    : [[-1,.34,0],[1,.34,1]];
  const engines = mounts.map(([side,height,index]) => {
    const engine = new THREE.Group();
    engine.position.set(side*shape.spread,height,engineZ);
    engine.scale.set(shape.radial*shape.widen,shape.radial*shape.flat,shape.length);
    root.add(engine);
    mesh(engine,cylinder(.75,.58,2.92),frame,[0,0,0]);
    mesh(engine,cylinder(.82,.69,1.42),paint,[0,0,.37]);
    mesh(engine,cylinder(.78,.82,.22),alloy,[0,0,1.19]);
    mesh(engine,cylinder(.68,.78,.22),ivory,[0,0,1.41]);
    mesh(engine,ring(.66,.075),alloy,[0,0,1.56]);
    mesh(engine,cylinder(.58,.61,.14,24),frame,[0,0,1.52]);
    mesh(engine,cylinder(.69,.48,.63),gunmetal,[0,0,-1.29]);
    mesh(engine,cylinder(.46,.62,.40),trim,[0,0,-1.78]);
    mesh(engine,ring(.48,.066),alloy,[0,0,-1.98]);
    mesh(engine,cylinder(.47,.46,.11),frame,[0,0,-2.01]);
    for (let i=0;i<10;i++) {
      const a = i*Math.PI/5;
      const rib = mesh(engine,new THREE.BoxGeometry(.092,.098,1.22),i%2===0?ivory:gunmetal,[Math.cos(a)*.78,Math.sin(a)*.78,.32]);
      rib.rotation.z=a;
      const collar = mesh(engine,new THREE.BoxGeometry(.092,.098,.31),gunmetal,[Math.cos(a)*.66,Math.sin(a)*.66,-1.03]);
      collar.rotation.z=a;
      mesh(engine, new THREE.SphereGeometry(.039,6,4), trim,[Math.cos(a)*.73,Math.sin(a)*.73,1.4]);
    }
    for (const finSide of [-1,1]) {
      const blade = mesh(engine,fin([[finSide*.49,-1.22],[finSide*1.05,-1.55],[finSide*1.26,.14],[finSide*.66,.74]]),darkPaint,[0,.18,0]);
      blade.rotation.z=finSide*.37;
      mesh(engine,tube([[finSide*.34,-.5,-1.42],[finSide*.55,-.71,-.8],[finSide*.48,-.72,.53],[finSide*.34,-.56,1.17]],.044),alloy,[0,0,0]);
    }
    if (shape.fins === "split") {
      // The Mammoth's X: four tall plates around the casing.
      for (let i=0;i<4;i++) {
        const a = Math.PI/4+i*Math.PI/2;
        const plate = mesh(engine,new THREE.BoxGeometry(.07,.72,2.2),i%2?darkPaint:paint,[Math.cos(a)*1.12,Math.sin(a)*1.12,.15]);
        plate.rotation.z=a-Math.PI/2;
      }
    } else if (shape.fins === "tail") {
      mesh(engine,new THREE.BoxGeometry(.07,1.25,1.5),darkPaint,[0,1.35,-.75]);
      mesh(engine,new THREE.BoxGeometry(.07,.8,1),paint,[0,-1.1,-.9]);
    } else if (shape.fins === "boom") {
      for (const boom of [-1,1]) {
        mesh(engine,tube([[boom*.5,.1,-1.6],[boom*.42,.22,-3],[boom*.3,.3,-4.6]],.06),alloy,[0,0,0]);
        mesh(engine,new THREE.BoxGeometry(.5,.05,.7),darkPaint,[boom*.3,.3,-4.6]);
      }
    } else if (shape.fins === "wing") {
      mesh(engine,new THREE.BoxGeometry(2.7,.1,2.5),paint,[0,0,-.1]);
      mesh(engine,new THREE.BoxGeometry(2.1,.12,.5),ivory,[0,.04,.95]);
    } else if (shape.fins === "ring") {
      mesh(engine,ring(1.12,.11,28),trim,[0,0,1.42]);
      for (let i=0;i<4;i++) {
        const a = Math.PI/4+i*Math.PI/2;
        const strut = mesh(engine,new THREE.BoxGeometry(.06,.36,.12),alloy,[Math.cos(a)*.93,Math.sin(a)*.93,1.42]);
        strut.rotation.z=a-Math.PI/2;
      }
    }
    mergeStatic(engine);
    const fan = new THREE.Group();
    fan.position.z=1.604;
    engine.add(fan);
    for(let blade=0;blade<9;blade++){
      const a=blade*2*Math.PI/9;
      const vane=mesh(fan,new THREE.BoxGeometry(.12,.39,.09),alloy,[Math.sin(a)*.3,Math.cos(a)*.3,0]);
      vane.rotation.set(.36,0,-a+.37);
    }
    mesh(fan,cylinder(.142,.2,.29,14),trim,[0,0,.11]);
    mergeStatic(fan);
    const hot = new THREE.MeshBasicMaterial({color:0xf9a56d,toneMapped:false});
    mesh(engine,ring(.35,.056,18),hot,[0,0,-2.085]);
    const flame = mesh(engine,new THREE.ConeGeometry(.33,2.7,14,1,true).rotateX(-Math.PI/2),exhaustMaterial(),[0,0,-3.42]);
    return { engine, fan, flame, hot, index };
  });
  const link = mesh(root,new THREE.PlaneGeometry(4.18,.68),arcMaterial(),[0,.33,engineZ+.17]);
  // The energy binder spans the gap between the engine casings.
  link.scale.x = Math.max(.35,(shape.spread*2-1.64*shape.radial*shape.widen)/4.18*1.28);

  return {
    root,
    update(state: PodVehicle,time: number,reduced: boolean) {
      const spin = reduced ? 0 : time;
      engines.forEach(({engine,fan,flame,hot,index},i)=>{
        const heat = state.heat[index];
        const power = (state.boosting ? .97 : .22+state.speed/365) * (.25+state.health[index]*.75);
        engine.rotation.z = reduced ? 0 : state.roll*.25+Math.sin(spin*3+i)*.014;
        engine.rotation.x = reduced ? 0 : (state.drifting ? -.063 : 0)+Math.sin(spin*4+i)*.009;
        fan.rotation.z = spin*(11+state.speed*.038);
        flame.scale.z = state.boosting ? 1.85 : .48+Math.min(.6,state.speed/130);
        flame.position.z = -2.07-1.35*flame.scale.z;
        const uniforms = (flame.material as THREE.ShaderMaterial).uniforms;
        uniforms.clock.value=spin;
        uniforms.thrust.value=power;
        uniforms.heat.value=heat;
        hot.color.setRGB(1,.42-.23*heat,.19-.14*heat);
      });
      const uniforms=(link.material as THREE.ShaderMaterial).uniforms;
      uniforms.clock.value=spin;
      uniforms.power.value=state.repairing?.36:state.boosting?.94:.68;
    },
  };
}
