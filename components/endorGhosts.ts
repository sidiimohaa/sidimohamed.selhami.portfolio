import * as THREE from "three";
import { earGeometry } from "./groguModel";
import { glowTexture } from "./landingKit";
import { bakePart, part, pipe, rounded } from "./tatooineCharacters";

// The easter egg up in the village: Anakin, Yoda and Obi-Wan as Force ghosts, as at the end of
// Return of the Jedi. They shimmer into view only when the visitor comes close on the second
// platform, follow them with their eyes, and fade away again once they leave.

type XYZ = [number, number, number];
type Figure = { root: THREE.Group; head: THREE.Group; yaw: number; pitch: number; follow: number };
const DOWN = new THREE.Vector3(0, -1, 0);
const SKIN = 0xe0b394,
  TUNIC = 0xe2d6b8,
  SASH = 0xcbbd9c,
  UNDER = 0x3c2c22,
  LEATHER = 0x5a4230,
  BOOT = 0x2e241c,
  EYE = 0x2a2220;

const vertexShader = `varying vec3 vNormalView;varying vec3 vView;varying vec3 vWorld;
  void main(){
    vec4 world=modelMatrix*vec4(position,1.0);
    vWorld=world.xyz;
    vec4 view=viewMatrix*world;
    vView=-view.xyz;
    vNormalView=normalize(normalMatrix*normal);
    gl_Position=projectionMatrix*view;
  }`;
const fragmentShader = `uniform vec3 tint;uniform float fade;uniform float time;
  varying vec3 vNormalView;varying vec3 vView;varying vec3 vWorld;
  float hash(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
  void main(){
    vec3 n=normalize(vNormalView),v=normalize(vView);
    if(!gl_FrontFacing)n=-n;
    float rim=pow(1.0-abs(dot(n,v)),2.2);
    // Their own colours washed in blue, lit softly from the viewer's side so faces and folds still read.
    float light=0.55+0.45*max(dot(n,normalize(vec3(0.25,0.6,0.75))),0.0);
    vec3 color=mix(tint,vec3(0.55,0.75,1.0),0.3)*light+vec3(0.5,0.75,1.0)*rim*1.6;
    color*=0.94+0.06*sin(vWorld.y*40.0-time*2.5);
    // They materialise grain by grain as they fade in.
    float grain=hash(floor(vWorld*45.0));
    float reveal=smoothstep(grain-0.12,grain,fade*1.12);
    gl_FragColor=vec4(color,(0.66+rim*0.34)*reveal);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
// A slightly swollen shell drawn from the inside: a soft blue glow hugging each silhouette.
const shellVertex = `varying vec3 vNormalView;varying vec3 vView;
  void main(){
    vec4 view=modelViewMatrix*vec4(position+normal*0.035,1.0);
    vView=-view.xyz;
    vNormalView=normalize(normalMatrix*normal);
    gl_Position=projectionMatrix*view;
  }`;
const shellFragment = `uniform float fade;varying vec3 vNormalView;varying vec3 vView;
  void main(){
    float a=pow(abs(dot(normalize(vNormalView),normalize(vView))),2.0)*0.6*fade;
    gl_FragColor=vec4(0.35,0.6,1.0,a);
  }`;

export function createForceGhosts() {
  const group = new THREE.Group();
  group.name = "force-ghosts";
  const fade = { value: 0 },
    time = { value: 0 };
  const materials = new Map<number, THREE.ShaderMaterial>();
  const ghost = (color: number) => {
    let material = materials.get(color);
    if (!material) {
      material = new THREE.ShaderMaterial({ uniforms: { tint: { value: new THREE.Color(color) }, fade, time }, vertexShader, fragmentShader, transparent: true, depthWrite: false, side: THREE.DoubleSide });
      materials.set(color, material);
    }
    return material;
  };
  const sphere = (parent: THREE.Object3D, r: number, color: number, at: XYZ, scale: XYZ = [1, 1, 1]) => {
    const mesh = part(parent, new THREE.SphereGeometry(r, 18, 12), ghost(color), at);
    mesh.scale.set(...scale);
    return mesh;
  };
  // Loose folds round a robe, deeper towards the hem.
  const folded = (geometry: THREE.CylinderGeometry, count: number, depth: number) => {
    const p = geometry.getAttribute("position"),
      half = geometry.parameters.height / 2;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      const fold = 1 + Math.sin(Math.atan2(x, z) * count) * depth * (0.3 + (half - y) / (2 * half));
      p.setXYZ(i, x * fold, y, z * fold);
    }
    geometry.computeVertexNormals();
    return geometry;
  };

  // A Jedi in tunic and open cloak, facing +Z with the floor at Y=0.
  const jedi = (cloak: number, clasped: boolean, groom: (head: THREE.Group) => void, look: Omit<Figure, "root" | "head">): Figure => {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    for (const side of [-1, 1]) {
      part(body, new THREE.CylinderGeometry(0.068, 0.072, 0.5, 10), ghost(TUNIC), [side * 0.1, 0.5, 0]);
      part(body, new THREE.CylinderGeometry(0.074, 0.08, 0.3, 10), ghost(BOOT), [side * 0.1, 0.15, 0.005]);
      part(body, rounded(0.12, 0.07, 0.2, 0.03), ghost(BOOT), [side * 0.1, 0.035, 0.04]);
    }
    // Knee-length tunic and a crossed bodice, the dark undertunic showing at the neck.
    part(body, new THREE.CylinderGeometry(0.2, 0.25, 0.6, 22), ghost(TUNIC), [0, 0.74, 0]).scale.z = 0.8;
    part(body, new THREE.CylinderGeometry(0.22, 0.19, 0.5, 22), ghost(TUNIC), [0, 1.27, 0]).scale.z = 0.7;
    const neckline = new THREE.Shape();
    neckline.moveTo(-0.075, 0.21);
    neckline.lineTo(0.075, 0.21);
    neckline.lineTo(0, 0);
    neckline.closePath();
    part(body, new THREE.ShapeGeometry(neckline), ghost(UNDER), [0, 1.3, 0.158]);
    for (const side of [-1, 1]) part(body, rounded(0.04, 0.23, 0.012, 0.005), ghost(TUNIC), [side * 0.04, 1.41, 0.162], [0, 0, -side * 0.36]);
    part(body, new THREE.CylinderGeometry(0.2, 0.2, 0.15, 22), ghost(SASH), [0, 1.09, 0]).scale.z = 0.74;
    part(body, new THREE.CylinderGeometry(0.206, 0.206, 0.05, 22), ghost(LEATHER), [0, 1.03, 0]).scale.z = 0.75;
    part(body, rounded(0.07, 0.05, 0.02, 0.008), ghost(0x8c7c66), [0, 1.03, 0.155]);
    // The cloak hangs open from the shoulders to the ankles, its hood bunched behind the neck.
    part(body, folded(new THREE.CylinderGeometry(0.25, 0.43, 1.42, 32, 10, true, 0.55, Math.PI * 2 - 1.1), 9, 0.06), ghost(cloak), [0, 0.79, -0.01]).scale.z = 0.8;
    part(body, new THREE.SphereGeometry(0.29, 24, 8, Math.PI / 2 + 0.55, Math.PI * 2 - 1.1, 0, Math.PI * 0.34), ghost(cloak), [0, 1.38, -0.01]).scale.set(1, 0.6, 0.8);
    part(body, new THREE.TorusGeometry(0.12, 0.05, 8, 16, Math.PI), ghost(cloak), [0, 1.53, -0.04], [-Math.PI / 2, 0, 0]);
    part(body, new THREE.CylinderGeometry(0.048, 0.055, 0.14, 12), ghost(SKIN), [0, 1.58, 0]);
    // Arms in wide sleeves: hanging loose, or with the hands folded over the belt.
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Vector3(side * 0.25, 1.45, 0);
      const upper = new THREE.Group();
      upper.position.copy(shoulder);
      body.add(upper);
      part(upper, new THREE.CylinderGeometry(0.07, 0.085, 0.32, 12), ghost(cloak), [0, -0.15, 0]);
      const fore = new THREE.Group();
      fore.position.y = -0.3;
      upper.add(fore);
      part(fore, new THREE.CylinderGeometry(0.08, 0.13, 0.3, 14, 1, true), ghost(cloak), [0, -0.15, 0]);
      sphere(fore, 0.045, SKIN, [0, -0.31, 0], [0.8, 1.15, 0.9]);
      const reach = new THREE.Vector3(side * 0.12, -1, clasped ? 0.15 : 0.04).normalize();
      upper.quaternion.setFromUnitVectors(DOWN, reach);
      const elbow = shoulder.clone().addScaledVector(reach, 0.3);
      const hand = clasped ? new THREE.Vector3(side * 0.03, 1.0, 0.25) : elbow.clone().add(new THREE.Vector3(side * 0.03, -0.3, 0.09));
      fore.quaternion.setFromUnitVectors(DOWN, hand.sub(elbow).normalize().applyQuaternion(upper.quaternion.clone().invert()));
    }
    bakePart(body);

    const head = new THREE.Group();
    head.position.set(0, 1.69, 0.01);
    root.add(head);
    sphere(head, 0.1, SKIN, [0, 0, 0], [0.88, 1.1, 0.98]);
    sphere(head, 0.068, SKIN, [0, -0.07, 0.028], [0.95, 0.85, 0.9]);
    part(head, new THREE.ConeGeometry(0.016, 0.05, 8), ghost(SKIN), [0, -0.01, 0.1], [Math.PI / 2 + 0.25, 0, 0]);
    for (const side of [-1, 1]) {
      sphere(head, 0.011, EYE, [side * 0.033, 0.016, 0.088]);
      sphere(head, 0.024, SKIN, [side * 0.088, 0, 0], [0.45, 1, 0.75]);
    }
    // A quiet smile.
    pipe(head, [[-0.03, -0.05, 0.084], [0, -0.058, 0.093], [0.03, -0.05, 0.084]], 0.004, ghost(0x9a5f50));
    groom(head);
    bakePart(head);
    return { root, head, ...look };
  };

  const anakin = jedi(
    0x5a4636,
    false,
    (head) => {
      // Shoulder-length hair parted in the middle, falling in waves.
      const hair = 0x6b4a32;
      part(head, new THREE.SphereGeometry(0.108, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), ghost(hair), [0, 0.02, -0.01], [-0.25, 0, 0]).scale.set(0.95, 1.1, 1.05);
      sphere(head, 0.09, hair, [0, -0.05, -0.05], [1.12, 1.25, 0.7]);
      for (const side of [-1, 1]) {
        sphere(head, 0.06, hair, [side * 0.085, -0.045, -0.012], [0.45, 1.5, 0.95]);
        sphere(head, 0.04, hair, [side * 0.045, 0.075, 0.07], [1.25, 0.45, 0.6]).rotation.z = side * 0.35;
        for (let k = 0; k < 3; k++) sphere(head, 0.028, hair, [side * (0.03 + k * 0.035), -0.15 + k * 0.01, -0.06 + k * 0.03]);
      }
    },
    { yaw: 0, pitch: 0, follow: 0.9 },
  );
  const obiwan = jedi(
    0x4a3a2c,
    true,
    (head) => {
      // Short white hair receding at the brow, a trimmed full beard and moustache.
      const white = 0xefeae2;
      part(head, new THREE.SphereGeometry(0.106, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), ghost(white), [0, 0.015, -0.012], [-0.5, 0, 0]).scale.set(0.95, 1.08, 1.03);
      sphere(head, 0.085, white, [0, -0.02, -0.045], [1.1, 1, 0.7]);
      sphere(head, 0.07, white, [0, -0.085, 0.042], [1.05, 0.9, 0.8]);
      for (const side of [-1, 1]) {
        sphere(head, 0.045, white, [side * 0.062, -0.055, 0.028], [0.7, 1.25, 0.9]);
        part(head, rounded(0.045, 0.014, 0.016, 0.006), ghost(white), [side * 0.034, 0.038, 0.09], [0, 0, -side * 0.12]);
      }
      pipe(head, [[-0.036, -0.038, 0.093], [0, -0.034, 0.101], [0.036, -0.038, 0.093]], 0.011, ghost(white));
    },
    // Looking down at Yoda with a smile, now and then up at the visitor.
    { yaw: -0.5, pitch: 0.18, follow: 0.35 },
  );

  // Yoda, small and stooped in his robe, his ears from the same mould as Grogu's.
  const yoda = (): Figure => {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const skin = 0x8cab70,
      robe = 0xb4a582,
      cloak = 0x7e6c52;
    for (const side of [-1, 1]) sphere(body, 0.035, skin, [side * 0.05, 0.02, 0.07], [1, 0.55, 1.6]);
    part(body, new THREE.CylinderGeometry(0.1, 0.17, 0.34, 20), ghost(robe), [0, 0.19, 0]).scale.z = 0.9;
    part(body, folded(new THREE.CylinderGeometry(0.12, 0.2, 0.33, 24, 4, true, 0.6, Math.PI * 2 - 1.2), 7, 0.05), ghost(cloak), [0, 0.2, -0.005]);
    part(body, new THREE.TorusGeometry(0.085, 0.035, 10, 24), ghost(robe), [0, 0.37, 0], [Math.PI / 2, 0, 0]);
    // Small hands resting in front, half lost in the sleeves.
    for (const side of [-1, 1]) {
      const from = new THREE.Vector3(side * 0.11, 0.34, 0),
        to = new THREE.Vector3(side * 0.06, 0.2, 0.12);
      const sleeve = part(body, new THREE.CylinderGeometry(0.035, 0.05, from.distanceTo(to), 12), ghost(cloak));
      sleeve.position.copy(from).add(to).multiplyScalar(0.5);
      sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), from.clone().sub(to).normalize());
      sphere(body, 0.026, skin, [side * 0.055, 0.185, 0.14], [1, 0.75, 1]);
    }
    bakePart(body);

    const head = new THREE.Group();
    head.position.set(0, 0.47, 0.02);
    root.add(head);
    sphere(head, 0.11, skin, [0, 0, 0], [1.15, 0.92, 1]);
    sphere(head, 0.07, skin, [0, 0.03, 0.055], [1.35, 0.45, 0.75]);
    sphere(head, 0.055, skin, [0, -0.05, 0.045], [1.3, 0.6, 1]);
    sphere(head, 0.018, skin, [0, -0.022, 0.107], [1.2, 0.8, 1]);
    for (const side of [-1, 1]) {
      sphere(head, 0.022, 0x4a4628, [side * 0.045, 0.002, 0.094], [1.1, 0.85, 0.6]);
      pipe(head, [[side * 0.02, 0.026, 0.1], [side * 0.045, 0.034, 0.104], [side * 0.072, 0.024, 0.094]], 0.006, ghost(skin));
      part(head, earGeometry(side), ghost(skin));
      part(head, earGeometry(side, true), ghost(0xa8a080));
    }
    pipe(head, [[-0.035, -0.06, 0.085], [0, -0.066, 0.094], [0.035, -0.06, 0.085]], 0.004, ghost(0x55603e));
    for (let w = 0; w < 3; w++) {
      const y = 0.055 + w * 0.014,
        x = 0.055 - w * 0.01;
      pipe(head, [[-x, y, 0.085], [0, y + 0.007, 0.098], [x, y, 0.085]], 0.0025, ghost(skin));
    }
    // A few white wisps at the back of the head.
    for (let i = 0; i < 5; i++) pipe(head, [[-0.05 + i * 0.025, 0.06, -0.06], [-0.055 + i * 0.027, 0.07, -0.085], [-0.06 + i * 0.03, 0.05, -0.105]], 0.0015, ghost(0xeeeeee));
    bakePart(head);
    // He glances at Obi-Wan as much as at the visitor.
    return { root, head, yaw: 0.4, pitch: -0.1, follow: 0.6 };
  };
  const master = yoda();

  // As in the film: Anakin on the left, Yoda just in front between them, Obi-Wan on the right.
  anakin.root.position.set(-0.85, 0, 0);
  anakin.root.rotation.y = 0.15;
  master.root.position.set(0.05, 0, 0.45);
  master.root.scale.setScalar(1.12);
  obiwan.root.position.set(0.88, 0, -0.05);
  obiwan.root.rotation.y = -0.18;
  obiwan.root.scale.setScalar(0.97);
  const figures = [anakin, master, obiwan];
  figures.forEach((figure) => group.add(figure.root));

  // A depth-only pass first, so only the front surface of each figure glows, not every layer inside it.
  // Same vertex shader, nudged back a little, so the glowing pass never fights it for the same depth.
  const depthOnly = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: "void main(){gl_FragColor=vec4(0.0);}",
    colorWrite: false,
    transparent: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 4,
  });
  const meshes: THREE.Mesh[] = [];
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) meshes.push(o);
  });
  const shell = new THREE.ShaderMaterial({ uniforms: { fade }, vertexShader: shellVertex, fragmentShader: shellFragment, transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending });
  meshes.forEach((mesh) => {
    const depth = new THREE.Mesh(mesh.geometry, depthOnly);
    depth.renderOrder = 20;
    mesh.renderOrder = 21;
    const aura = new THREE.Mesh(mesh.geometry, shell);
    aura.renderOrder = 22;
    mesh.add(depth, aura);
  });

  // And a wider, fainter glow round each of them.
  const glow = glowTexture();
  const halos = (
    [
      [-0.85, 1.0, -0.3, 1.5, 2.5],
      [0.05, 0.38, 0.3, 0.9, 0.9],
      [0.88, 0.98, -0.35, 1.5, 2.4],
    ] as const
  ).map(([x, y, z, w, h]) => {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x5b8de6, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.set(x, y, z);
    halo.scale.set(w, h, 1);
    group.add(halo);
    return halo;
  });

  const local = new THREE.Vector3();
  let shown = 0,
    clock = 0;
  group.visible = false;
  return {
    group,
    tick: (dt: number, reduced: boolean, viewer: THREE.Vector3) => {
      if (!reduced) clock += dt;
      // In sight from the end of the bridge onwards, never from the ground or the first platform.
      const near = 1 - THREE.MathUtils.smoothstep(group.worldToLocal(local.copy(viewer)).length(), 6, 10);
      shown += (near - shown) * Math.min(1, dt * (near > shown ? 0.8 : 1.5));
      group.visible = shown > 0.004;
      if (!group.visible) return;
      fade.value = shown;
      time.value = clock;
      halos.forEach((halo, i) => (halo.material.opacity = shown * 0.3 * (reduced ? 1 : 0.85 + Math.sin(clock * 1.3 + i * 2) * 0.15)));
      const ease = Math.min(1, dt * 2.5);
      figures.forEach((figure, i) => {
        figure.root.worldToLocal(local.copy(viewer)).sub(figure.head.position);
        const yaw = THREE.MathUtils.lerp(figure.yaw, THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -0.9, 0.9), figure.follow);
        const pitch = THREE.MathUtils.lerp(figure.pitch, THREE.MathUtils.clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)), -0.4, 0.3), figure.follow);
        figure.head.rotation.y += (yaw + (reduced ? 0 : Math.sin(clock * 0.4 + i * 2) * 0.04) - figure.head.rotation.y) * ease;
        figure.head.rotation.x += (pitch - figure.head.rotation.x) * ease;
      });
    },
  };
}
