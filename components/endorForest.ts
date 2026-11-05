import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { glowTexture, random, type Spot } from "./landingKit";
import { softBeam } from "./render/softBeam";

// Endor's forest around the clearing: giant redwoods, a canopy with a gap over the clearing,
// ferns and fallen logs, and shafts of late-afternoon light. The ship's approach (from -z),
// its take-off (towards +z) and the arrival camera keep clear corridors through the trunks.
export const CLEARING = 25;
type Tree = { x: number; z: number; radius: number; height: number };

function canvasTexture(width: number, height: number, paint: (c: CanvasRenderingContext2D) => void, repeat: [number, number] = [1, 1]) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext("2d")!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = 8;
  return texture;
}
// Deeply furrowed red-brown bark: long ridges with dark fissures between them. The relief is drawn
// once and read back into a normal map, so the furrows catch the light. Moss is added by the
// material, by height, so it does not repeat up the trunk with the texture.
function barkSet() {
  const rand = random(83);
  const map = canvasTexture(512, 1024, (c) => {
    c.fillStyle = "#5e4030";
    c.fillRect(0, 0, 512, 1024);
    for (let i = 0; i < 150; i++) {
      // A ridge that wanders slightly as it climbs.
      let x = rand() * 512;
      const w = 5 + rand() * 20;
      c.fillStyle = rand() < 0.5 ? "rgba(146,106,80,.38)" : "rgba(96,68,50,.42)";
      for (let y = 0; y < 1024; y += 16) {
        c.fillRect(x, y, w, 17);
        x += (rand() - 0.5) * 4;
      }
    }
    for (let i = 0; i < 340; i++) {
      let x = rand() * 512;
      c.fillStyle = "rgba(14,8,5,.68)";
      const top = rand() * 1024,
        length = 60 + rand() * 420;
      for (let y = top; y < top + length; y += 10) {
        c.fillRect(x, y % 1024, 1.5 + rand() * 3.5, 11);
        x += (rand() - 0.5) * 2.4;
      }
    }
    // Flakes of lighter bark standing proud of the ridges.
    for (let i = 0; i < 420; i++) {
      c.fillStyle = rand() < 0.5 ? "rgba(170,132,104,.22)" : "rgba(40,26,18,.26)";
      c.fillRect(rand() * 512, rand() * 1024, 2 + rand() * 7, 8 + rand() * 30);
    }
  });
  const relief = map.image as HTMLCanvasElement;
  const source = relief.getContext("2d")?.getImageData(0, 0, relief.width, relief.height)?.data;
  let normal: THREE.Texture | null = null;
  if (source) {
    const w = relief.width,
      h = relief.height,
      out = new Uint8Array(w * h * 4);
    const height = (x: number, y: number) => source[(((y + h) % h) * w + ((x + w) % w)) * 4 + 1];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = (height(x + 1, y) - height(x - 1, y)) / 255,
          dy = (height(x, y + 1) - height(x, y - 1)) / 255,
          k = 1 / Math.hypot(dx * 3, dy * 3, 1),
          at = (y * w + x) * 4;
        out[at] = (-dx * 3 * k * 0.5 + 0.5) * 255;
        out[at + 1] = (dy * 3 * k * 0.5 + 0.5) * 255;
        out[at + 2] = (k * 0.5 + 0.5) * 255;
        out[at + 3] = 255;
      }
    const data = new THREE.DataTexture(out, w, h);
    data.wrapS = data.wrapT = THREE.RepeatWrapping;
    data.flipY = true;
    data.generateMipmaps = true;
    data.minFilter = THREE.LinearMipmapLinearFilter;
    data.magFilter = THREE.LinearFilter;
    data.anisotropy = 8;
    data.needsUpdate = true;
    normal = data;
  }
  const set = (repeat: [number, number]) => {
    const color = map.clone(),
      bump = normal?.clone() ?? null;
    color.repeat.set(...repeat);
    color.needsUpdate = true;
    if (bump) {
      bump.repeat.set(...repeat);
      bump.needsUpdate = true;
    }
    return { map: color, normalMap: bump, normalScale: new THREE.Vector2(0.9, 0.9) };
  };
  return set;
}
// Moss on trunks and roots, thick near the ground and in patches higher up.
function mossy(material: THREE.MeshStandardMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vMossWorld;")
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
        vec4 mossAt = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mossAt = instanceMatrix * mossAt;
        #endif
        vMossWorld = (modelMatrix * mossAt).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vMossWorld;
        float mossHash(vec3 p){p=fract(p*.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
        float mossNoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);
          return mix(mix(mix(mossHash(i),mossHash(i+vec3(1,0,0)),f.x),mix(mossHash(i+vec3(0,1,0)),mossHash(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(mossHash(i+vec3(0,0,1)),mossHash(i+vec3(1,0,1)),f.x),mix(mossHash(i+vec3(0,1,1)),mossHash(i+vec3(1,1,1)),f.x),f.y),f.z);}`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        vec3 m = vMossWorld;
        if (m.y < 30.0) {
          float broad = mossNoise(m * vec3(.3, .1, .3)), mid = mossNoise(m * vec3(1.3, .55, 1.3)), fine = mossNoise(m * 6.5);
          float low = 1.0 - smoothstep(.5, 16.0, m.y);
          // It takes hold in the furrows first, and thins out with height.
          float furrow = 1.0 - smoothstep(.06, .3, dot(diffuseColor.rgb, vec3(.33)));
          float moss = smoothstep(.6, .72, broad * .45 + mid * .3 + fine * .25 + low * .1 + furrow * .08) * smoothstep(30.0, 8.0, m.y);
          // The bark's own relief shows through, so the moss is not a flat coat of paint.
          float relief = .55 + dot(diffuseColor.rgb, vec3(.33)) * 2.6;
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(.035, .07, .022), vec3(.1, .16, .05), fine * .6 + mid * .4) * relief, moss * .9);
        }`,
      );
  };
  return material;
}
function forestFloor() {
  const rand = random(19);
  return canvasTexture(512, 512, (c) => {
    c.fillStyle = "#3d3a22";
    c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) {
      const tone = rand();
      c.fillStyle = tone < 0.4 ? "rgba(92,70,40,.5)" : tone < 0.75 ? "rgba(60,86,38,.45)" : "rgba(28,24,14,.5)";
      c.save();
      c.translate(rand() * 512, rand() * 512);
      c.rotate(rand() * Math.PI);
      c.fillRect(-4, -0.8, 6 + rand() * 10, 1.6);
      c.restore();
    }
  }, [120, 120]);
}
function grass() {
  const rand = random(7);
  return canvasTexture(256, 256, (c) => {
    c.fillStyle = "#4e6a2c";
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3200; i++) {
      c.fillStyle = rand() < 0.5 ? "rgba(120,150,60,.4)" : "rgba(40,58,22,.45)";
      c.fillRect(rand() * 256, rand() * 256, 1, 3 + rand() * 5);
    }
  }, [14, 14]);
}
// A single fern frond with leaflets, cut out by its alpha.
function frond() {
  return canvasTexture(128, 512, (c) => {
    c.clearRect(0, 0, 128, 512);
    c.strokeStyle = "#5d7a2c";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(64, 512);
    c.lineTo(64, 8);
    c.stroke();
    c.fillStyle = "#6f9236";
    for (let y = 30; y < 500; y += 18) {
      const reach = 54 * Math.sin((y / 512) * Math.PI) + 6;
      for (const side of [-1, 1]) {
        c.beginPath();
        c.ellipse(64 + side * reach * 0.5, y, reach * 0.5, 6, side * 0.25, 0, Math.PI * 2);
        c.fill();
      }
    }
  });
}
function fernGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.PlaneGeometry(0.45, 1.5, 1, 6);
    const p = leaf.getAttribute("position");
    for (let v = 0; v < p.count; v++) {
      const y = p.getY(v) + 0.75;
      // Arch the frond outwards and down towards its tip.
      p.setXYZ(v, p.getX(v), y * 0.75 - y * y * 0.22, y * 0.75);
    }
    leaf.rotateY((i / 7) * Math.PI * 2 + (i % 2) * 0.2);
    parts.push(leaf);
  }
  const merged = new THREE.BufferGeometry();
  const positions: number[] = [],
    uvs: number[] = [],
    index: number[] = [];
  let offset = 0;
  for (const part of parts) {
    const p = part.getAttribute("position"),
      uv = part.getAttribute("uv"),
      ix = part.getIndex()!;
    for (let v = 0; v < p.count; v++) {
      positions.push(p.getX(v), p.getY(v), p.getZ(v));
      uvs.push(uv.getX(v), uv.getY(v));
    }
    for (let k = 0; k < ix.count; k++) index.push(ix.getX(k) + offset);
    offset += p.count;
    part.dispose();
  }
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  merged.setIndex(index);
  merged.computeVertexNormals();
  return merged;
}

// A spray of conifer needles on a transparent card, ragged at the edges.
function needles() {
  const rand = random(29);
  return canvasTexture(256, 256, (c) => {
    c.clearRect(0, 0, 256, 256);
    for (let i = 0; i < 1500; i++) {
      // Points inside a ragged ellipse, each a short needle angled off the branch.
      const a = rand() * Math.PI * 2,
        r = Math.sqrt(rand()) * (0.8 + Math.sin(a * 5) * 0.12 + Math.sin(a * 11) * 0.06);
      const x = 128 + Math.cos(a) * r * 120,
        y = 128 + Math.sin(a) * r * 64;
      const tone = rand();
      c.strokeStyle = tone < 0.4 ? "#2f4d22" : tone < 0.75 ? "#44662c" : "#5d7f36";
      c.lineWidth = 1.5 + rand() * 1.5;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + (rand() - 0.5) * 18, y + 6 + rand() * 10);
      c.stroke();
    }
  });
}
// Two crossed vertical cards and a flat one: a spray that reads from any side.
function sprayGeometry() {
  const parts = [0, Math.PI / 2].map((turn) => new THREE.PlaneGeometry(1, 0.55).rotateY(turn));
  parts.push(new THREE.PlaneGeometry(1, 0.55).rotateX(-Math.PI / 2));
  const positions: number[] = [],
    uvs: number[] = [],
    index: number[] = [];
  let offset = 0;
  for (const part of parts) {
    const p = part.getAttribute("position"),
      uv = part.getAttribute("uv"),
      ix = part.getIndex()!;
    for (let v = 0; v < p.count; v++) {
      positions.push(p.getX(v), p.getY(v), p.getZ(v));
      uvs.push(uv.getX(v), uv.getY(v));
    }
    for (let k = 0; k < ix.count; k++) index.push(ix.getX(k) + offset);
    offset += p.count;
    part.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  merged.setIndex(index);
  merged.computeVertexNormals();
  return merged;
}
// The direction of the battle station in the sky, kept free of treetops so it shows through.
export const SKY_WINDOW = { azimuth: Math.atan2(-60, 760), spread: 0.24 };

export function createEndorForest(options: { village: Tree[]; keepClear: THREE.Vector3[] }) {
  const group = new THREE.Group();
  group.name = "endor-forest";
  const rand = random(1983);
  const colliders: Spot[] = [];
  const near = (x: number, z: number, points: THREE.Vector3[], gap: number) => points.some((p) => Math.hypot(p.x - x, p.z - z) < gap);
  // Clear corridors: the approach from -z, the take-off towards +z, the arrival camera's path.
  const camera = { from: new THREE.Vector2(30, 46), to: new THREE.Vector2(14, 26) };
  const offCameraPath = (x: number, z: number) => {
    const d = camera.to.clone().sub(camera.from),
      t = THREE.MathUtils.clamp(new THREE.Vector2(x, z).sub(camera.from).dot(d) / d.lengthSq(), 0, 1);
    return new THREE.Vector2(x, z).distanceTo(camera.from.clone().addScaledVector(d, t)) > 8;
  };
  const trees: Tree[] = [...options.village];
  for (let gx = -270; gx <= 270; gx += 15)
    for (let gz = -270; gz <= 270; gz += 15) {
      const x = gx + (rand() - 0.5) * 11,
        z = gz + (rand() - 0.5) * 11,
        reach = Math.hypot(x, z);
      if (reach < CLEARING + 4 || reach > 280) continue;
      if (Math.abs(x) < 15 && z < -6 && z > -170) continue;
      if (Math.abs(x) < 14 && z > 8 && z < 180) continue;
      if (!offCameraPath(x, z)) continue;
      if (options.village.some((t) => Math.hypot(t.x - x, t.z - z) < t.radius + 13)) continue;
      if (near(x, z, options.keepClear, 7)) continue;
      trees.push({ x, z, radius: 1.5 + rand() * 2.6, height: 70 + rand() * 30 });
    }
  // Trunks, root flares and canopy crowns are each one instanced mesh.
  const trunkGeometry = new THREE.CylinderGeometry(0.82, 1, 1, 18, 1, true).translate(0, 0.5, 0);
  // Root flares with buttresses: the base swells out in irregular lobes that run into the ground.
  const flareOf = (radial: number, rows: number, sharp: number) => {
    const geometry = new THREE.CylinderGeometry(1, 2.1, 1, radial, rows, true).translate(0, 0.5, 0);
    const p = geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i),
        a = Math.atan2(z, x);
      const ridge = Math.pow(Math.max(0, Math.cos(a * 5 + Math.sin(a * 2 + 1) * 0.9)), sharp),
        fold = Math.pow(Math.max(0, Math.cos(a * 11 + 1.7)), 3) * 0.22;
      const lobe = 1 + (ridge * 0.8 + fold) * Math.pow(1 - y, 1.5);
      p.setXYZ(i, x * lobe, y, z * lobe);
    }
    geometry.computeVertexNormals();
    return geometry;
  };
  const crownGeometry = sprayGeometry();
  const barks = barkSet();
  const barkMaterial = mossy(new THREE.MeshStandardMaterial({ ...barks([2, 9]), color: 0xc8ab96, roughness: 0.95 }));
  const crownMaterial = new THREE.MeshStandardMaterial({ map: needles(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 });
  // The roots get their own copy of the bark, tiled to their short height so it is not squashed.
  const rootMaterial = mossy(new THREE.MeshStandardMaterial({ ...barks([3, 1]), color: 0xb9a28e, roughness: 0.95 }));
  // Close to the clearing the buttresses are modelled in detail; far off they are only a silhouette.
  const closeUp = trees.filter((tree) => Math.hypot(tree.x, tree.z) < 72),
    distant = trees.filter((tree) => Math.hypot(tree.x, tree.z) >= 72);
  const trunks = new THREE.InstancedMesh(trunkGeometry, barkMaterial, trees.length),
    flares = new THREE.InstancedMesh(flareOf(30, 3, 1.4), rootMaterial, distant.length),
    nearFlares = new THREE.InstancedMesh(flareOf(84, 10, 2.2), rootMaterial, closeUp.length);
  // No treetops in the direction of the battle station, so it shows through a gap in the canopy.
  const inWindow = (t: Tree) => Math.abs(Math.atan2(Math.sin(Math.atan2(t.x, t.z) - SKY_WINDOW.azimuth), Math.cos(Math.atan2(t.x, t.z) - SKY_WINDOW.azimuth))) < SKY_WINDOW.spread;
  const crownSpots = trees.filter((t) => Math.hypot(t.x, t.z) > CLEARING + 2 && !inWindow(t));
  const crowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, crownSpots.length * 4);
  const dummy = new THREE.Object3D();
  trees.forEach((tree, i) => {
    dummy.position.set(tree.x, 0, tree.z);
    dummy.rotation.set(0, rand() * Math.PI, 0);
    dummy.scale.set(tree.radius, tree.height, tree.radius);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.scale.set(tree.radius, 3.5 + tree.radius, tree.radius);
    dummy.updateMatrix();
    const closeIndex = closeUp.indexOf(tree);
    if (closeIndex >= 0) nearFlares.setMatrixAt(closeIndex, dummy.matrix);
    else flares.setMatrixAt(distant.indexOf(tree), dummy.matrix);
    // Village trees keep a tight collider so their platforms stay walkable round the trunk.
    if (Math.hypot(tree.x, tree.z) < 60) colliders.push({ x: tree.x, z: tree.z, r: tree.radius * (options.village.includes(tree) ? 1.08 : 1.25) });
  });
  const tint = new THREE.Color();
  crownSpots.forEach((tree, i) => {
    for (let k = 0; k < 4; k++) {
      const spread = 8 + rand() * 9;
      dummy.position.set(tree.x + (rand() - 0.5) * 9, tree.height * (0.58 + k * 0.08), tree.z + (rand() - 0.5) * 9);
      dummy.rotation.set((rand() - 0.5) * 0.4, rand() * Math.PI, (rand() - 0.5) * 0.4);
      dummy.scale.set(spread, spread * 0.6, spread);
      dummy.updateMatrix();
      crowns.setMatrixAt(i * 4 + k, dummy.matrix);
      crowns.setColorAt(i * 4 + k, tint.setHSL(0.25 + rand() * 0.06, 0.25, 0.55 + rand() * 0.25));
    }
  });
  // Branches laden with foliage at mid height, so the forest has layers receding into the haze.
  const sprays = trees.filter((t) => Math.hypot(t.x, t.z) > CLEARING + 6 && !options.village.includes(t) && !inWindow(t));
  const branchGeometry = new THREE.CylinderGeometry(0.12, 0.3, 1, 6).translate(0, 0.5, 0).rotateZ(-Math.PI / 2);
  const branches = new THREE.InstancedMesh(branchGeometry, barkMaterial, sprays.length * 3),
    leaves = new THREE.InstancedMesh(crownGeometry, crownMaterial, sprays.length * 3);
  sprays.forEach((tree, i) => {
    for (let k = 0; k < 3; k++) {
      const angle = rand() * Math.PI * 2,
        reach = 4 + rand() * 5,
        y = 18 + rand() * 30;
      dummy.position.set(tree.x + Math.cos(angle) * tree.radius * 0.8, y, tree.z + Math.sin(angle) * tree.radius * 0.8);
      dummy.rotation.set(0, -angle, 0.25);
      dummy.scale.set(reach, 1, 1);
      dummy.updateMatrix();
      branches.setMatrixAt(i * 3 + k, dummy.matrix);
      dummy.position.set(tree.x + Math.cos(angle) * (tree.radius + reach * 0.85), y + reach * 0.3, tree.z + Math.sin(angle) * (tree.radius + reach * 0.85));
      dummy.rotation.set((rand() - 0.5) * 0.3, -angle, (rand() - 0.5) * 0.3);
      dummy.scale.set(reach * 1.6, reach * 0.9, reach * 1.6);
      dummy.updateMatrix();
      leaves.setMatrixAt(i * 3 + k, dummy.matrix);
      leaves.setColorAt(i * 3 + k, tint.setHSL(0.24 + rand() * 0.07, 0.3, 0.5 + rand() * 0.3));
    }
  });
  group.add(trunks, flares, nearFlares, crowns, branches, leaves);
  // Roots snaking out from the near trees across the ground, tapering as they go.
  const rootPath = new THREE.CatmullRomCurve3([new THREE.Vector3(0.45, 0.62, 0), new THREE.Vector3(0.62, 0.3, 0.03), new THREE.Vector3(0.82, 0.09, -0.04), new THREE.Vector3(1, 0, 0.03)]);
  const rootGeometry = new THREE.TubeGeometry(rootPath, 10, 0.075, 7, false);
  {
    const p = rootGeometry.getAttribute("position"),
      uv = rootGeometry.getAttribute("uv"),
      centre = new THREE.Vector3(),
      point = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      rootPath.getPointAt(uv.getX(i), centre);
      point.fromBufferAttribute(p, i).sub(centre).multiplyScalar(1 - uv.getX(i) * 0.82).add(centre);
      p.setXYZ(i, point.x, point.y, point.z);
    }
    rootGeometry.computeVertexNormals();
  }
  const roots = new THREE.InstancedMesh(rootGeometry, rootMaterial, closeUp.length * 7);
  closeUp.forEach((tree, i) => {
    for (let k = 0; k < 7; k++) {
      const turn = (k / 7) * Math.PI * 2 + rand() * 0.7,
        reach = tree.radius * (2.6 + rand() * 1.5);
      dummy.position.set(tree.x, 0, tree.z);
      dummy.rotation.set(0, turn, 0);
      dummy.scale.set(reach, 2.2 + tree.radius * 0.5, tree.radius * (2.4 + rand() * 1.4));
      dummy.updateMatrix();
      roots.setMatrixAt(i * 7 + k, dummy.matrix);
    }
  });
  roots.castShadow = roots.receiveShadow = true;
  group.add(roots);
  leaves.castShadow = branches.castShadow = true;

  // The forest floor, the clearing's grass and the sky behind the canopy.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: forestFloor(), roughness: 1 }));
  ground.position.y = -0.02;
  group.add(ground);
  const meadow = new THREE.Mesh(
    new THREE.CircleGeometry(CLEARING + 3, 72).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: { map: { value: grass() } },
      vertexShader: `varying vec2 vUv;varying vec2 vPos;void main(){vUv=uv*14.0;vPos=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform sampler2D map;varying vec2 vUv;varying vec2 vPos;
        void main(){float edge=1.0-smoothstep(${CLEARING - 6}.0,${CLEARING + 3}.0,length(vPos));vec3 c=texture2D(map,vUv).rgb;gl_FragColor=vec4(c*.9,edge);
        #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
    }),
  );
  meadow.position.y = 0.005;
  group.add(meadow);
  group.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(1300, 32, 16),
      new THREE.ShaderMaterial({
        vertexShader: `varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader: `varying vec3 vDirection;void main(){float h=normalize(vDirection).y;vec3 c=mix(vec3(.74,.74,.58),vec3(.55,.68,.74),smoothstep(0.0,.6,h));gl_FragColor=vec4(c,1.0);}`,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    ),
  );

  // Ferns in drifts beyond the clearing and a few inside its edge, thickest round the foot of trees.
  const fernMaterial = new THREE.MeshStandardMaterial({ map: frond(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, color: 0xbfd99a, emissive: 0x24351a, emissiveIntensity: 1 });
  const ferns: THREE.Matrix4[] = [];
  const undergrowthClear = (x: number, z: number, gap: number) =>
    !trees.some((t) => Math.hypot(t.x - x, t.z - z) < t.radius + gap) && !near(x, z, options.keepClear, 2.5) && Math.hypot(x, z - 20) >= 8;
  for (let i = 0; i < 2400 && ferns.length < 1500; i++) {
    let x: number, z: number;
    if (i % 5 < 2) {
      const tree = closeUp[Math.floor(rand() * closeUp.length)],
        turn = rand() * Math.PI * 2,
        out = tree.radius * 2.1 + rand() * 4;
      x = tree.x + Math.cos(turn) * out;
      z = tree.z + Math.sin(turn) * out;
      if (Math.hypot(x, z) < CLEARING - 5) continue;
    } else {
      const angle = rand() * Math.PI * 2,
        reach = CLEARING - 5 + Math.pow(rand(), 0.7) * 70;
      x = Math.cos(angle) * reach;
      z = Math.sin(angle) * reach;
    }
    if (!undergrowthClear(x, z, 0.6)) continue;
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.setScalar(0.7 + rand() * 0.9);
    dummy.updateMatrix();
    ferns.push(dummy.matrix.clone());
  }
  const fernMesh = new THREE.InstancedMesh(fernGeometry(), fernMaterial, ferns.length);
  ferns.forEach((m, i) => fernMesh.setMatrixAt(i, m));
  group.add(fernMesh);

  // Shrubs and saplings fill the layer between the ferns and the canopy, beyond the clearing's edge.
  const shrubSpots: { x: number; z: number; size: number }[] = [];
  for (let i = 0; i < 1100 && shrubSpots.length < 340; i++) {
    const angle = rand() * Math.PI * 2,
      reach = CLEARING + 4 + Math.pow(rand(), 0.8) * 62,
      x = Math.cos(angle) * reach,
      z = Math.sin(angle) * reach;
    if (undergrowthClear(x, z, 0.8) && offCameraPath(x, z)) shrubSpots.push({ x, z, size: 1.6 + rand() * 2.4 });
  }
  // Foliage down here is seen from below as often as from above: the air lights its undersides.
  const understory = crownMaterial.clone();
  understory.emissive.setHex(0x1b2a14);
  const shrubs = new THREE.InstancedMesh(crownGeometry, understory, shrubSpots.length * 2);
  shrubSpots.forEach(({ x, z, size }, i) => {
    for (let k = 0; k < 2; k++) {
      dummy.position.set(x + (k ? 0.5 : -0.3) * size * 0.4, size * (0.26 + k * 0.2), z + (k ? -0.3 : 0.4) * size * 0.4);
      dummy.rotation.set((rand() - 0.5) * 0.3, rand() * Math.PI, (rand() - 0.5) * 0.3);
      dummy.scale.set(size * (1.3 - k * 0.3), size * (0.95 - k * 0.2), size * (1.3 - k * 0.3));
      dummy.updateMatrix();
      shrubs.setMatrixAt(i * 2 + k, dummy.matrix);
      shrubs.setColorAt(i * 2 + k, tint.setHSL(0.24 + rand() * 0.06, 0.34, 0.5 + rand() * 0.26));
    }
  });
  shrubs.receiveShadow = true;
  group.add(shrubs);

  const saplingSpots: { x: number; z: number; height: number }[] = [];
  for (let i = 0; i < 500 && saplingSpots.length < 90; i++) {
    const angle = rand() * Math.PI * 2,
      reach = CLEARING + 5 + rand() * 58,
      x = Math.cos(angle) * reach,
      z = Math.sin(angle) * reach;
    if (undergrowthClear(x, z, 1.4) && offCameraPath(x, z)) saplingSpots.push({ x, z, height: 3.5 + rand() * 5 });
  }
  const saplingStems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.14, 1, 7).translate(0, 0.5, 0), barkMaterial, saplingSpots.length),
    saplingTops = new THREE.InstancedMesh(crownGeometry, understory, saplingSpots.length * 3);
  saplingSpots.forEach(({ x, z, height }, i) => {
    dummy.position.set(x, 0, z);
    dummy.rotation.set((rand() - 0.5) * 0.08, rand() * Math.PI, (rand() - 0.5) * 0.08);
    dummy.scale.set(1, height, 1);
    dummy.updateMatrix();
    saplingStems.setMatrixAt(i, dummy.matrix);
    for (let k = 0; k < 3; k++) {
      const spread = height * (0.62 - k * 0.14);
      dummy.position.set(x, height * (0.62 + k * 0.17), z);
      dummy.rotation.set((rand() - 0.5) * 0.25, rand() * Math.PI, (rand() - 0.5) * 0.25);
      dummy.scale.set(spread, spread * 0.62, spread);
      dummy.updateMatrix();
      saplingTops.setMatrixAt(i * 3 + k, dummy.matrix);
      saplingTops.setColorAt(i * 3 + k, tint.setHSL(0.25 + rand() * 0.05, 0.3, 0.52 + rand() * 0.22));
    }
    if (Math.hypot(x, z) < 60) colliders.push({ x, z, r: 0.28 });
  });
  saplingStems.castShadow = true;
  group.add(saplingStems, saplingTops);

  // Tall grass where the meadow meets the forest, and pale mushrooms at the foot of the near trees.
  const blades = canvasTexture(256, 256, (c) => {
    c.clearRect(0, 0, 256, 256);
    for (let i = 0; i < 90; i++) {
      const x = 14 + rand() * 228,
        lean = (rand() - 0.5) * 60,
        top = 8 + Math.pow(rand(), 0.55) * 210,
        width = 1.6 + rand() * 2.6,
        tone = rand();
      c.fillStyle = tone < 0.4 ? "#5a7a30" : tone < 0.75 ? "#47652a" : "#74913c";
      // A blade narrowing to a point, bending as it rises.
      c.beginPath();
      c.moveTo(x - width, 256);
      c.quadraticCurveTo(x - width * 0.6 + lean * 0.15, (256 + top) / 2, x + lean, top);
      c.quadraticCurveTo(x + width * 0.6 + lean * 0.15, (256 + top) / 2, x + width, 256);
      c.closePath();
      c.fill();
    }
  });
  const tuftParts = [0, Math.PI / 3, (2 * Math.PI) / 3].map((turn) => new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateY(turn));
  const tuftGeometry = mergeGeometries(tuftParts, false)!;
  tuftParts.forEach((part) => part.dispose());
  const tuftSpots: { x: number; z: number; size: number }[] = [];
  for (let i = 0; i < 3000 && tuftSpots.length < 620; i++) {
    const angle = rand() * Math.PI * 2,
      reach = CLEARING - 9 + Math.pow(rand(), 0.8) * 20,
      x = Math.cos(angle) * reach,
      z = Math.sin(angle) * reach,
      // Clumps with bare ground between them, rather than an even hedge round the meadow.
      clump = Math.sin(x * 0.55 + Math.sin(z * 0.37) * 1.8) + Math.sin(z * 0.61 + Math.sin(x * 0.29) * 1.6);
    if (clump > 0.35 && undergrowthClear(x, z, 0.3)) tuftSpots.push({ x, z, size: 0.32 + rand() * rand() * 0.75 });
  }
  const tufts = new THREE.InstancedMesh(tuftGeometry, new THREE.MeshStandardMaterial({ map: blades, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.95 }), tuftSpots.length);
  tuftSpots.forEach(({ x, z, size }, i) => {
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, rand() * Math.PI, 0);
    dummy.scale.set(size * 1.1, size, size * 1.1);
    dummy.updateMatrix();
    tufts.setMatrixAt(i, dummy.matrix);
    tufts.setColorAt(i, tint.setHSL(0.23 + rand() * 0.05, 0.3, 0.62 + rand() * 0.2));
  });
  tufts.receiveShadow = true;
  group.add(tufts);

  const capGeometry = new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1).translate(0, 0.12, 0),
    stalkGeometry = new THREE.CylinderGeometry(0.022, 0.032, 0.13, 6).translate(0, 0.065, 0);
  const mushroomGeometry = mergeGeometries([capGeometry.toNonIndexed(), stalkGeometry.toNonIndexed()], false)!;
  capGeometry.dispose();
  stalkGeometry.dispose();
  const mushrooms = new THREE.InstancedMesh(mushroomGeometry, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), closeUp.length * 6);
  closeUp.forEach((tree, i) => {
    const turn = rand() * Math.PI * 2;
    for (let k = 0; k < 6; k++) {
      const a = turn + k * 0.16 + rand() * 0.1,
        out = tree.radius * (2.2 + rand() * 0.8);
      dummy.position.set(tree.x + Math.cos(a) * out, 0, tree.z + Math.sin(a) * out);
      dummy.rotation.set((rand() - 0.5) * 0.3, rand() * Math.PI, (rand() - 0.5) * 0.3);
      dummy.scale.setScalar(0.7 + rand() * 1.5);
      dummy.updateMatrix();
      mushrooms.setMatrixAt(i * 6 + k, dummy.matrix);
      mushrooms.setColorAt(i * 6 + k, tint.setHSL(0.09 + rand() * 0.04, 0.32, 0.58 + rand() * 0.2));
    }
  });
  group.add(mushrooms);

  // Fallen, mossy logs at the clearing's edge.
  const logMaterial = mossy(new THREE.MeshStandardMaterial({ ...barks([2, 3]), color: 0x9f8a6a, roughness: 1 }));
  for (const [x, z, turn, length, radius] of [
    [-17, -6, 0.4, 9, 0.8],
    [18.5, 4, -1.1, 8, 0.7],
    [-9, 21.5, 1.6, 6, 0.6],
  ]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.1, length, 14), logMaterial);
    log.position.set(x, radius * 0.8, z);
    log.rotation.set(0, turn, Math.PI / 2);
    group.add(log);
    for (let s = -0.5; s <= 0.5; s += 0.25)
      colliders.push({ x: x + Math.cos(turn) * s * length, z: z - Math.sin(turn) * s * length, r: radius + 0.15 });
  }

  // Shafts of light falling through the canopy gap into the clearing.
  const glow = glowTexture();
  const shafts = [
    [-6, 4, 3.4],
    [5, -8, 2.6],
    [10, 14, 3],
    [-14, 12, 2.2],
    [2, 22, 2.4],
    [-20, -14, 2],
    [16, -18, 2.8],
    [-2, -30, 3.2],
    [24, 8, 2.2],
  ].map(([x, z, radius], i) => {
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.7, radius, 64, 24, 1, true),
      softBeam(new THREE.MeshBasicMaterial({ color: 0xffe3a8, transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }), 12),
    );
    shaft.position.set(x - 10, 32, z - 6);
    shaft.rotation.set(-0.16, 0, 0.3);
    group.add(shaft);
    const pool = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffe3a8, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.position.set(x, 0.3, z);
    pool.scale.set(radius * 3, radius * 1.2, 1);
    group.add(pool);
    return { shaft, phase: i * 1.7 };
  });
  trunks.castShadow = flares.castShadow = nearFlares.castShadow = crowns.castShadow = true;
  trunks.receiveShadow = flares.receiveShadow = nearFlares.receiveShadow = ground.receiveShadow = fernMesh.receiveShadow = true;
  return {
    group,
    colliders,
    trees,
    tick: (time: number, reduced: boolean) => {
      shafts.forEach(({ shaft, phase }) => (shaft.material.opacity = reduced ? 0.05 : 0.045 + Math.sin(time * 0.3 + phase) * 0.018));
    },
  };
}
