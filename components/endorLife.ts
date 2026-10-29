import * as THREE from "three";
import type { PadEvent } from "./coruscantLife";
import { glowTexture, random } from "./landingKit";
import { bakePart, createSandtrooper, part, rounded } from "./tatooineCharacters";
import { CLEARING } from "./endorForest";

// Life in the forest round the clearing: a pair of speeder bikes racing between the trunks now
// and then, birds wheeling under the canopy, motes of pollen in the light and butterflies.

// The bikes' run: in from the deep forest, round the clearing behind the first ring of trunks, and out.
export const BIKE_PATH = new THREE.CatmullRomCurve3(
  [
    [-150, -70],
    [-80, -48],
    [-44, -28],
    [-40, -2],
    [-41, 26],
    [-26, 43],
    [-4, 47],
    [20, 44],
    [39, 30],
    [44, 4],
    [40, -24],
    [70, -58],
    [150, -84],
  ].map(([x, z]) => new THREE.Vector3(x, 1.5, z)),
  false,
  "catmullrom",
  0.5,
);

export function speederBike(withRider = true) {
  const root = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0x5f6458, roughness: 0.6, metalness: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x24272a, roughness: 0.6, metalness: 0.5 });
  part(root, rounded(0.5, 0.38, 1.9, 0.12), hull, [0, 0, -0.1]);
  part(root, rounded(0.56, 0.5, 0.75, 0.1), dark, [0, 0.02, -1.05]);
  part(root, rounded(0.34, 0.12, 0.6, 0.05), dark, [0, 0.26, -0.3]);
  part(root, new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), dark, [0, 0.32, 0.45], [0, 0, Math.PI / 2]);
  // Two long steering vanes reaching forward, each ending in a pair of flaps.
  for (const side of [-1, 1]) {
    part(root, new THREE.BoxGeometry(0.06, 0.06, 1.8), dark, [side * 0.16, -0.1, 1.7]);
    part(root, rounded(0.36, 0.03, 0.42, 0.01), hull, [side * 0.3, -0.1, 2.5]);
  }
  bakePart(root);
  const exhaust = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff9a5c, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  exhaust.position.set(0, 0.02, -1.5);
  exhaust.scale.setScalar(0.6);
  root.add(exhaust);
  // A scout trooper astride it, leaning into the handlebars.
  const rider = createSandtrooper();
  rider.group.position.set(0, -0.5, -0.35);
  rider.group.rotation.x = 0.28;
  if (withRider) root.add(rider.group);
  return { root, rider };
}

function bird() {
  const root = new THREE.Group();
  const feathers = new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 1, side: THREE.DoubleSide });
  part(root, new THREE.SphereGeometry(0.12, 8, 6), feathers).scale.set(0.8, 0.7, 2);
  const wing = new THREE.Shape();
  wing.moveTo(0, 0);
  wing.lineTo(0.9, 0.15);
  wing.lineTo(0.75, -0.2);
  wing.lineTo(0, -0.15);
  wing.closePath();
  const wings = [-1, 1].map((side) => {
    const hinge = new THREE.Group();
    const mesh = part(hinge, new THREE.ShapeGeometry(wing), feathers, [0, 0, 0], [-Math.PI / 2, 0, 0]);
    mesh.scale.x = side;
    root.add(hinge);
    return hinge;
  });
  return { root, wings };
}

export function createEndorLife(notify: (event: PadEvent) => void) {
  const group = new THREE.Group();
  group.name = "endor-life";
  const rand = random(1985);
  const bikes = [speederBike(), speederBike()];
  bikes.forEach(({ root }) => {
    root.visible = false;
    group.add(root);
  });
  const length = BIKE_PATH.getLength();
  let race = -1,
    next = 18;
  const at = new THREE.Vector3(),
    ahead = new THREE.Vector3();

  const birds = Array.from({ length: 7 }, (_, i) => {
    const b = bird();
    group.add(b.root);
    return { ...b, radius: 16 + rand() * 14, height: 30 + rand() * 12, speed: 0.12 + rand() * 0.08, phase: i * 0.9, flap: rand() * 10 };
  });

  // Pollen and fireflies drifting in the light over the clearing.
  const motes = 260;
  const seeds = new Float32Array(motes * 3);
  for (let i = 0; i < motes; i++) {
    const a = rand() * Math.PI * 2,
      r = Math.sqrt(rand()) * (CLEARING - 2);
    seeds.set([Math.cos(a) * r, 0.4 + rand() * 9, Math.sin(a) * r], i * 3);
  }
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute("position", new THREE.BufferAttribute(seeds, 3));
  const moteMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, scale: { value: 1 } },
    vertexShader: `uniform float time;uniform float scale;varying float vGlow;
      void main(){
        vec3 p=position+vec3(sin(time*.21+position.y*1.7),sin(time*.33+position.x)*.4,cos(time*.17+position.z*1.3))*.8;
        vGlow=.45+.55*sin(time*1.3+position.x*3.1+position.z*2.3);
        vec4 view=modelViewMatrix*vec4(p,1.0);
        gl_Position=projectionMatrix*view;
        gl_PointSize=scale*min(9.0,26.0/-view.z);
      }`,
    fragmentShader: `varying float vGlow;void main(){vec2 c=gl_PointCoord-.5;float d=dot(c,c);if(d>.25)discard;gl_FragColor=vec4(1.0,.86,.55,(1.0-d*4.0)*vGlow*.8);}`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pollen = new THREE.Points(moteGeometry, moteMaterial);
  pollen.frustumCulled = false;
  group.add(pollen);

  const butterflies = Array.from({ length: 6 }, (_, i) => {
    const root = new THREE.Group();
    const wingMaterial = new THREE.MeshBasicMaterial({ color: [0xf2e6a0, 0xffffff, 0x9fc8ff][i % 3], side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    const wings = [-1, 1].map((side) => {
      const hinge = new THREE.Group();
      part(hinge, new THREE.CircleGeometry(0.09, 10), wingMaterial, [side * 0.08, 0, 0], [-Math.PI / 2, 0, 0]);
      root.add(hinge);
      return hinge;
    });
    group.add(root);
    return { root, wings, centre: new THREE.Vector2((rand() - 0.5) * 30, (rand() - 0.5) * 24), phase: i * 2.1 };
  });

  let clock = 0;
  return {
    group,
    setViewport: (height: number) => (moteMaterial.uniforms.scale.value = height / 900),
    tick: (dt: number, reduced: boolean) => {
      if (!reduced) clock += dt;
      const t = clock;
      // A race every minute or so: leader in front, chaser a second behind.
      if (!reduced && race < 0 && t > next) {
        race = t;
        notify("speeder-arrive");
      }
      bikes.forEach(({ root, rider }, i) => {
        const run = race < 0 ? -1 : ((t - race - i * 1.1) * 30) / length;
        root.visible = run > 0 && run < 1;
        if (!root.visible) return;
        BIKE_PATH.getPointAt(run, at);
        BIKE_PATH.getPointAt(Math.min(1, run + 0.004), ahead);
        root.position.copy(at).setY(1.4 + Math.sin(t * 9 + i) * 0.05);
        const heading = Math.atan2(ahead.x - at.x, ahead.z - at.z);
        const turn = Math.atan2(Math.sin(heading - root.rotation.y), Math.cos(heading - root.rotation.y));
        root.rotation.set(0, heading, THREE.MathUtils.clamp(-turn * 14, -0.6, 0.6));
        rider.tick(t, false, reduced);
        rider.legs.forEach((leg, side) => leg.rotation.set(-1.25, 0, side ? 0.3 : -0.3));
        rider.arms.forEach((arm) => (arm.rotation.x = -1.2));
      });
      if (race >= 0 && ((t - race - 1.1) * 30) / length > 1) {
        race = -1;
        next = t + 45 + Math.random() * 35;
      }
      birds.forEach((b) => {
        const a = t * b.speed + b.phase;
        b.root.position.set(Math.cos(a) * b.radius, b.height + Math.sin(a * 2.3) * 1.5, 6 + Math.sin(a) * b.radius);
        b.root.rotation.set(0, -a, 0.35);
        const flapping = Math.sin(t * 0.7 + b.flap) > 0.2;
        b.wings.forEach((w, side) => (w.rotation.z = (side ? -1 : 1) * (flapping && !reduced ? Math.sin(t * 14 + b.flap) * 0.6 : 0.08)));
      });
      moteMaterial.uniforms.time.value = t;
      pollen.visible = !reduced;
      butterflies.forEach((f) => {
        const k = t * 0.6 + f.phase;
        f.root.position.set(f.centre.x + Math.sin(k) * 2.4 + Math.sin(k * 2.7) * 0.8, 0.7 + Math.sin(k * 1.9) * 0.4, f.centre.y + Math.cos(k * 0.8) * 2.2);
        f.root.rotation.y = k;
        f.wings.forEach((w, side) => (w.rotation.z = (side ? -1 : 1) * (reduced ? 0.4 : Math.abs(Math.sin(t * 16 + f.phase)) * 1.2)));
      });
    },
  };
}
