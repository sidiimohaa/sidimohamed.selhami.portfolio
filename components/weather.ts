import * as THREE from "three";
import { random } from "./landingKit";

// Weather that comes and goes around the visitor: sand squalls over Mos Eisley and a low mist
// drifting between Endor's trunks. Gusts follow a slow cycle so they never feel scripted.

/** 0 most of the time, rising to 1 for `length` seconds once every `period` seconds. */
export function gustCycle(period: number, length: number, offset = 0) {
  return (time: number) => {
    const t = (((time + offset) % period) + period) % period;
    if (t > length) return 0;
    const k = t / length;
    // Builds quickly, lingers, then dies away; a faster ripple makes it gusty.
    return Math.sin(Math.PI * Math.pow(k, 0.6)) * (0.82 + 0.18 * Math.sin(time * 2.7));
  };
}

const softDisc = () => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const c = canvas.getContext("2d")!,
    g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,.9)");
  g.addColorStop(0.5, "rgba(255,255,255,.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
};

/** Blown sand: fine grains streaming low across the ground, and dust veils sweeping past. */
export function createSandstorm(wind: THREE.Vector2, count = 2600) {
  const group = new THREE.Group();
  group.name = "tatooine-sandstorm";
  const rand = random(4021);
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) seeds[i] = rand();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(seeds, 3));
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, origin: { value: new THREE.Vector3() }, gust: { value: 0 }, wind: { value: wind.clone().normalize() }, scale: { value: 1 } },
    vertexShader: `uniform float time;uniform vec3 origin;uniform float gust;uniform vec2 wind;uniform float scale;varying float vAlpha;
      const vec3 box=vec3(70.0,7.0,70.0);
      void main(){
        float speed=6.0+gust*14.0;
        vec3 drift=vec3(wind.x,0.0,wind.y)*time*speed+vec3(0.0,sin(time*1.3+position.x*30.0)*0.4,0.0);
        vec3 p=mod(position*box+drift-origin+box*.5,box)-box*.5+origin;
        p.y=position.y*position.y*box.y+0.05;
        vAlpha=gust*(1.0-position.y)*0.7;
        vec4 view=modelViewMatrix*vec4(p,1.0);
        gl_Position=projectionMatrix*view;
        gl_PointSize=min(10.0,scale*(1.4+fract(position.z*57.0)*1.6)*(22.0/-view.z));
      }`,
    fragmentShader: `varying float vAlpha;void main(){vec2 c=gl_PointCoord-.5;float d=dot(c,c);if(d>.25)discard;gl_FragColor=vec4(.86,.68,.47,vAlpha*(1.0-d*4.0));}`,
    transparent: true,
    depthWrite: false,
  });
  const grains = new THREE.Points(geometry, material);
  grains.frustumCulled = false;
  group.add(grains);
  const disc = softDisc();
  const veils = Array.from({ length: 10 }, (_, i) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: disc, color: 0xd9b48a, transparent: true, opacity: 0, depthWrite: false }));
    group.add(sprite);
    return { sprite, age: i * 0.9, life: 7, x: 0, z: 0, size: 10 };
  });
  const across = new THREE.Vector2(-wind.y, wind.x).normalize(),
    along = wind.clone().normalize();
  return {
    group,
    setViewport: (height: number) => (material.uniforms.scale.value = height / 900),
    tick: (dt: number, time: number, gust: number, reduced: boolean, walker: { x: number; z: number }, ground: (x: number, z: number) => number) => {
      const shown = reduced ? 0 : gust;
      grains.visible = shown > 0.01;
      material.uniforms.time.value = time;
      material.uniforms.gust.value = shown;
      material.uniforms.origin.value.set(walker.x, ground(walker.x, walker.z), walker.z);
      veils.forEach((veil) => {
        veil.age += dt;
        if (veil.age > veil.life) {
          // A new veil starts upwind of the visitor and sweeps across.
          veil.age = 0;
          veil.life = 5 + Math.random() * 4;
          const offset = (Math.random() - 0.5) * 50;
          veil.x = walker.x - along.x * 30 + across.x * offset;
          veil.z = walker.z - along.y * 30 + across.y * offset;
          veil.size = 9 + Math.random() * 10;
        }
        const t = veil.age / veil.life,
          x = veil.x + along.x * veil.age * 11,
          z = veil.z + along.y * veil.age * 11;
        veil.sprite.visible = shown > 0.01;
        veil.sprite.position.set(x, ground(x, z) + 1.2 + t * 1.5, z);
        veil.sprite.scale.set(veil.size * (1 + t * 0.6), veil.size * 0.38, 1);
        veil.sprite.material.opacity = Math.sin(t * Math.PI) * 0.32 * shown;
      });
    },
  };
}

/** Low mist: broad, faint banks lying about a metre off the ground that drift and breathe. They
 *  face the camera, since flat sheets would vanish into thin lines seen from eye height. */
export function createGroundMist(color: number, count = 22, reach = 36) {
  const group = new THREE.Group();
  group.name = "ground-mist";
  const disc = softDisc();
  const rand = random(8812);
  const banks = Array.from({ length: count }, (_, i) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: disc, color, transparent: true, opacity: 0, depthWrite: false, fog: true }));
    sprite.renderOrder = 2;
    group.add(sprite);
    const angle = rand() * Math.PI * 2,
      distance = 7 + rand() * reach;
    return { sprite, x: Math.cos(angle) * distance, z: Math.sin(angle) * distance, size: 10 + rand() * 12, y: 0.45 + rand() * 0.5, phase: i * 1.7, drift: 0.2 + rand() * 0.35 };
  });
  return {
    group,
    tick: (dt: number, time: number, reduced: boolean, walker: { x: number; z: number }, floor = 0) => {
      banks.forEach((bank) => {
        if (!reduced) {
          bank.x += bank.drift * dt;
          bank.z += Math.sin(time * 0.05 + bank.phase) * 0.08 * dt;
        }
        // Banks that drift too far from the visitor reappear on the other side.
        const dx = bank.x - walker.x,
          dz = bank.z - walker.z;
        if (Math.hypot(dx, dz) > reach + 8) {
          bank.x = walker.x - dx * 0.9;
          bank.z = walker.z - dz * 0.9;
        }
        bank.sprite.position.set(bank.x, floor + bank.y + (reduced ? 0 : Math.sin(time * 0.3 + bank.phase) * 0.1), bank.z);
        bank.sprite.scale.set(bank.size, bank.size * 0.16, 1);
        // Thinner near the visitor, so it never fogs the view right in front of the eyes.
        const near = THREE.MathUtils.smoothstep(Math.hypot(dx, dz), 4, 12);
        bank.sprite.material.opacity = (0.3 + 0.1 * Math.sin(time * 0.2 + bank.phase)) * near;
      });
    },
  };
}
