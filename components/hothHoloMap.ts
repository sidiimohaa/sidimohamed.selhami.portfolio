import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createATAT } from "./atatModel";
import { createSnowspeeder } from "./hothBattle";
import { createShipModel } from "./shipModel";
import { createStarDestroyer } from "./deathStar/stationShips";
import { tieGeometry } from "./tieModel";

// The tactical hologram over the table: the plain of Hoth in lines of light, the base, its shield and
// the trench, and on it, in miniature, what is really happening out there. The walkers and the
// snowspeeders are those of the battle outside; above them, ships hold over the base. The miniatures
// are the very models seen elsewhere in the site, baked into shells of light.

export type MapData = {
  walkers: { x: number; y: number; z: number; fade: number; tilt: number; yaw: number }[];
  speeders: { x: number; y: number; z: number; quaternion: THREE.Quaternion }[];
  generator: THREE.Vector3;
};

const vertex = `varying vec3 vN;varying vec3 vV;varying float vY;
void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);
vec4 w=modelMatrix*vec4(position,1.0);vY=w.y;gl_Position=projectionMatrix*mv;}`;
const fragment = `uniform float time;uniform vec3 color;uniform float opacity;varying vec3 vN;varying vec3 vV;varying float vY;
void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.4);
float scan=.72+.28*sin(vY*190.0-time*4.0);
float flick=.92+.08*sin(time*31.0+vY*7.0);
gl_FragColor=vec4(color*(.75+f*1.1),(.2+f*.85)*scan*flick*opacity);}`;

/** Bakes every mesh of a model into one geometry, centred, of length 1 along its longest side. */
function shell(model: THREE.Object3D) {
  model.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  model.traverse((item) => {
    const mesh = item as THREE.Mesh;
    if (!mesh.isMesh || (mesh as unknown as THREE.Sprite).isSprite) return;
    const base = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(mesh.matrixWorld);
    const flat = new THREE.BufferGeometry();
    flat.setAttribute("position", base.getAttribute("position"));
    if (base.getAttribute("normal")) flat.setAttribute("normal", base.getAttribute("normal"));
    else flat.computeVertexNormals();
    parts.push(flat);
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value) => value instanceof THREE.Texture && textures.add(value));
    });
    mesh.geometry.dispose();
  });
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
  const merged = mergeGeometries(parts)!;
  merged.computeBoundingBox();
  const box = merged.boundingBox!,
    size = box.getSize(new THREE.Vector3()),
    middle = box.getCenter(new THREE.Vector3());
  merged.translate(-middle.x, -middle.y, -middle.z);
  const k = 1 / Math.max(size.x, size.y, size.z);
  merged.scale(k, k, k);
  return merged;
}

// A Rebel GR-75 transport: a long ribbed spine with its open cargo shell.
function transportShape() {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, x = 0, y = 0, z = 0) => {
    const flat = g.index ? g.toNonIndexed() : g;
    flat.deleteAttribute("uv");
    flat.translate(x, y, z);
    parts.push(flat);
  };
  const body = new THREE.SphereGeometry(1, 16, 10);
  body.scale(0.42, 0.26, 1.5);
  add(body);
  const belly = new THREE.BoxGeometry(0.62, 0.2, 1.8);
  add(belly, 0, -0.22, 0.05);
  for (let i = 0; i < 7; i++) add(new THREE.BoxGeometry(0.74, 0.14, 0.14), 0, -0.2, -0.75 + i * 0.25);
  add(new THREE.BoxGeometry(0.24, 0.2, 0.7), 0, 0.26, -0.55);
  [-0.26, 0, 0.26].forEach((x) => add(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 10).rotateX(Math.PI / 2), x, 0, -1.55));
  const merged = mergeGeometries(parts)!;
  merged.scale(1 / 3.2, 1 / 3.2, 1 / 3.2);
  return merged;
}

const label = (text: string, color: string) => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 64;
  const c = canvas.getContext("2d")!;
  c.font = "bold 34px SFMono-Regular, Consolas, monospace";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = color;
  c.fillText(text, 256, 32);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
  sprite.scale.set(0.64, 0.08, 1);
  return sprite;
};

export function createHoloMap(options: { heightAt: (x: number, z: number) => number; data: () => MapData; centre: THREE.Vector3 }) {
  const { heightAt, data, centre } = options;
  const group = new THREE.Group();
  group.name = "echo-holomap";
  group.position.copy(centre);
  group.visible = false;
  // From the plain to the table: uniform across the ground, with the relief drawn up for legibility.
  const SCALE = 0.0062,
    ORIGIN_Z = 195,
    RELIEF = 2.4;
  const mapX = (x: number) => x * SCALE,
    mapZ = (z: number) => (ORIGIN_Z - z) * SCALE * -1;
  const mapY = (y: number) => y * SCALE * RELIEF;
  const material = (color: number) =>
    new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { time: { value: 0 }, color: { value: new THREE.Color(color) }, opacity: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  const rebel = material(0x7fd8ff),
    imperial = material(0xff6a52);
  const materials = [rebel, imperial];
  const faded = [0, 1, 2].map(() => {
    const m = imperial.clone();
    m.uniforms.color.value = new THREE.Color(0xff6a52);
    materials.push(m);
    return m;
  });

  // The ground, in a grid that fades towards its edges.
  const X = 56,
    Z = 62,
    half = 180,
    from = -12,
    to = 402;
  const point = (i: number, j: number) => {
    const x = -half + (i / X) * half * 2,
      z = from + (j / Z) * (to - from);
    return [mapX(x), mapY(heightAt(x, z)), mapZ(z)] as const;
  };
  const line: number[] = [],
    tone: number[] = [];
  const fadeAt = (i: number, j: number) => Math.min(1, Math.min(i, X - i) / 6) * Math.min(1, Math.min(j, Z - j) / 6);
  const push = (a: readonly number[], k: number) => {
    line.push(a[0], a[1], a[2]);
    tone.push(0.2 * k, 0.72 * k, 0.95 * k);
  };
  for (let i = 0; i <= X; i++)
    for (let j = 0; j <= Z; j++) {
      if (i < X) (push(point(i, j), fadeAt(i, j)), push(point(i + 1, j), fadeAt(i + 1, j)));
      if (j < Z) (push(point(i, j), fadeAt(i, j)), push(point(i, j + 1), fadeAt(i, j + 1)));
    }
  const groundGeometry = new THREE.BufferGeometry();
  groundGeometry.setAttribute("position", new THREE.Float32BufferAttribute(line, 3));
  groundGeometry.setAttribute("color", new THREE.Float32BufferAttribute(tone, 3));
  const lineMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
  group.add(new THREE.LineSegments(groundGeometry, lineMaterial));

  // The hangar's mouth, the trench line and its guns, the shield generator and the shield.
  const stroke = (points: [number, number, number][], color: number, opacity = 0.9) => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...p)));
    const mesh = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
    group.add(mesh);
    return mesh;
  };
  const arch: [number, number, number][] = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI - (i / 24) * Math.PI;
    arch.push([mapX(Math.cos(a) * 26), mapY(heightAt(0, 34)) + Math.sin(a) * 0.1 + 0.005, mapZ(34)]);
  }
  stroke(arch, 0x7fffc0);
  const trench: [number, number, number][] = [];
  for (let x = -130; x <= 130; x += 6) trench.push([mapX(x), mapY(heightAt(x, 150)) + 0.012, mapZ(150)]);
  stroke(trench, 0xffc27a);
  [-90, -45, 0, 45, 90].forEach((x) => {
    const y = mapY(heightAt(x, 148));
    stroke([[mapX(x), y, mapZ(148)], [mapX(x), y + 0.05, mapZ(148)], [mapX(x), y + 0.05, mapZ(160)]], 0x7fd8ff);
  });
  const shieldGeometry = new THREE.SphereGeometry(205 * SCALE, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  shieldGeometry.scale(1, 0.62, 1);
  const shield = new THREE.LineSegments(new THREE.WireframeGeometry(shieldGeometry), new THREE.LineBasicMaterial({ color: 0x6fc8ff, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
  shield.position.set(mapX(-95), mapY(heightAt(-95, 112)), mapZ(112));
  group.add(shield);
  const generator = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.14, 12), rebel);
  generator.position.set(mapX(-95), mapY(heightAt(-95, 112)) + 0.07, mapZ(112));
  group.add(generator);
  const tags: [THREE.Sprite, number, number, number][] = [
    [label("BASE ÉCHO", "#a8ffd8"), mapX(0), 0.2, mapZ(34)],
    [label("BOUCLIER", "#8fd8ff"), mapX(-95), 0.26, mapZ(112)],
    [label("TRANCHÉE NORD", "#ffc27a"), mapX(90), 0.1, mapZ(150)],
  ];
  tags.forEach(([sprite, x, y, z]) => {
    sprite.position.set(x, y, z);
    group.add(sprite);
  });

  // The miniatures: built the first time the room is entered, while the screen is dark.
  let built = false;
  let walkers: { mesh: THREE.Mesh; tag: THREE.Sprite }[] = [];
  let speeders: THREE.Mesh[] = [];
  let wings: { mesh: THREE.Mesh; phase: number; radius: number; height: number }[] = [];
  let ties: { mesh: THREE.Mesh; phase: number }[] = [];
  let transport: THREE.Mesh | null = null;
  let destroyers: THREE.Mesh[] = [];
  const build = () => {
    if (built) return;
    built = true;
    const walkerShape = (() => {
      const model = createATAT();
      return shell(model.root);
    })();
    walkers = faded.map((m, i) => {
      const mesh = new THREE.Mesh(walkerShape, m);
      mesh.scale.setScalar(0.3);
      group.add(mesh);
      const tag = label(`TB-TT ${i + 1}`, "#ff9a84");
      tag.scale.set(0.42, 0.052, 1);
      group.add(tag);
      return { mesh, tag };
    });
    const speederShape = shell(createSnowspeeder());
    speeders = [0, 1].map(() => {
      const mesh = new THREE.Mesh(speederShape, rebel);
      mesh.scale.setScalar(0.17);
      group.add(mesh);
      return mesh;
    });
    const xwing = createShipModel();
    xwing.rotation.set(-Math.PI / 2, 0, 0);
    const wrapper = new THREE.Group();
    wrapper.add(xwing);
    const wingShape = shell(wrapper);
    wings = [
      { phase: 0, radius: 0.95, height: 0.72 },
      { phase: 0.55, radius: 1.02, height: 0.78 },
      { phase: 3.4, radius: 0.7, height: 0.92 },
    ].map((spec) => {
      const mesh = new THREE.Mesh(wingShape, rebel);
      mesh.scale.setScalar(0.17);
      group.add(mesh);
      return { mesh, ...spec };
    });
    const parts = tieGeometry();
    const tieShape = mergeGeometries(
      [parts.hull, parts.panels, parts.glass].map((g) => {
        const flat = g.index ? g.toNonIndexed() : g.clone();
        flat.deleteAttribute("uv");
        return flat;
      }),
    )!;
    tieShape.scale(0.02, 0.02, 0.02);
    ties = [0, 1, 2].map((i) => {
      const mesh = new THREE.Mesh(tieShape, imperial);
      group.add(mesh);
      return { mesh, phase: i * 2.1 };
    });
    transport = new THREE.Mesh(transportShape(), rebel);
    transport.scale.setScalar(0.3);
    group.add(transport);
    const destroyerShape = shell(createStarDestroyer().group);
    destroyers = [
      [-0.75, 1.42, -0.55, 0.32],
      [0.72, 1.5, -0.1, -0.4],
    ].map(([x, y, z, yaw]) => {
      const mesh = new THREE.Mesh(destroyerShape, imperial);
      mesh.position.set(x, y, z);
      mesh.rotation.y = Math.PI / 2 + yaw;
      mesh.scale.setScalar(0.62);
      group.add(mesh);
      return mesh;
    });
  };

  const up = new THREE.Vector3(0, 1, 0);
  const look = new THREE.Vector3();
  const place = (mesh: THREE.Object3D, x: number, y: number, z: number, nx: number, ny: number, nz: number) => {
    mesh.position.set(x, y, z);
    look.set(nx, ny, nz);
    mesh.up.copy(up);
    mesh.lookAt(look.add(group.position));
  };
  return {
    group,
    build,
    tick(dt: number, time: number, reduced: boolean, inside: boolean) {
      group.visible = inside;
      if (!inside || !built) return;
      materials.forEach((m) => (m.uniforms.time.value = reduced ? 0 : time));
      const scene = data();
      lineMaterial.opacity = reduced ? 0.5 : 0.46 + Math.sin(time * 1.3) * 0.05;
      (shield.material as THREE.LineBasicMaterial).opacity = reduced ? 0.14 : 0.12 + Math.sin(time * 0.9) * 0.04;
      walkers.forEach(({ mesh, tag }, i) => {
        const walker = scene.walkers[i];
        const visible = !!walker && walker.fade > 0.02;
        mesh.visible = tag.visible = visible;
        if (!visible) return;
        const x = mapX(walker.x),
          y = mapY(walker.y) + 0.13,
          z = mapZ(walker.z);
        mesh.position.set(x, y, z);
        // A fallen walker lies on its side, in the map too.
        mesh.rotation.set(0, walker.yaw, walker.tilt);
        faded[i].uniforms.opacity.value = walker.fade;
        tag.position.set(x, y + 0.2, z);
        tag.material.opacity = walker.fade;
      });
      speeders.forEach((mesh, i) => {
        const speeder = scene.speeders[i];
        mesh.visible = !!speeder;
        if (!speeder) return;
        mesh.position.set(mapX(speeder.x), mapY(speeder.y) + 0.06, mapZ(speeder.z));
        mesh.quaternion.copy(speeder.quaternion);
      });
      // Above the plain: an X-wing patrol, TIE fighters coming down, a transport climbing out.
      const t = reduced ? 1 : time;
      wings.forEach((wing) => {
        const a = t * 0.34 + wing.phase;
        const x = Math.cos(a) * wing.radius,
          z = Math.sin(a) * wing.radius * 0.62;
        place(wing.mesh, x, wing.height, z, Math.cos(a + 0.1) * wing.radius, wing.height, Math.sin(a + 0.1) * wing.radius * 0.62);
        wing.mesh.rotateZ(-0.5);
      });
      ties.forEach((tie) => {
        const a = -t * 0.5 + tie.phase;
        place(tie.mesh, -0.5 + Math.cos(a) * 0.55, 1.1 + Math.sin(a * 2) * 0.08, -0.2 + Math.sin(a) * 0.4, -0.5 + Math.cos(a - 0.1) * 0.55, 1.1, -0.2 + Math.sin(a - 0.1) * 0.4);
      });
      if (transport) {
        const k = (t * 0.045) % 1;
        const fade = Math.min(1, k * 8) * Math.min(1, (1 - k) * 8);
        transport.visible = fade > 0.02;
        const x = 0.05 + k * 0.28,
          y = mapY(heightAt(0, 34)) + 0.06 + k * 1.35,
          z = mapZ(34) + k * 1.1;
        place(transport, x, y, z, x + 0.05, y + 0.2, z + 0.2);
      }
      destroyers.forEach((mesh, i) => {
        if (!reduced) mesh.position.y = [1.42, 1.5][i] + Math.sin(t * 0.3 + i) * 0.015;
      });
      void dt;
    },
  };
}
