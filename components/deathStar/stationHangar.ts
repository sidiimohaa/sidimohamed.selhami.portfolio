import * as THREE from "three";
import { softBeam } from "../render/softBeam";

// What gives docking bay 327 its scale, as in the Imperial hangars of the films: TIE fighters hung
// in racks under the roof, a travelling crane with its load, painted markings on the deck, fuel
// lines run out to the parked ships, cones of light falling from the floodlights and the faint
// shimmer of the magnetic field across the bay. The view of space through the bay is untouched.

type Kit = {
  box: (material: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, ry?: number, size?: number, rx?: number, rz?: number) => void;
  plane: (material: THREE.Material, w: number, h: number, x: number, y: number, z: number, rx?: number, ry?: number, size?: number) => void;
  cylinder: (material: THREE.Material, top: number, bottom: number, h: number, x: number, y: number, z: number, segments?: number, open?: boolean) => void;
  geometry: (material: THREE.Material, geometry: THREE.BufferGeometry, x: number, y: number, z: number, rx?: number, ry?: number, rz?: number) => void;
};

export type HangarContext = {
  root: THREE.Group;
  decor: THREE.Group;
  kit: Kit;
  materials: { dark: THREE.Material; trim: THREE.Material; strip: THREE.Material; red: THREE.Material };
  tie: { hull: THREE.BufferGeometry; panels: THREE.BufferGeometry; glass: THREE.BufferGeometry };
  tieMaterials: { hull: THREE.Material; panels: THREE.Material; glass: THREE.Material };
  owned: THREE.Material[];
  keep: <T extends THREE.Texture>(texture: T) => T;
  block: (x: number, z: number, r: number, decorOnly?: boolean) => void;
};

// The deck's paint, seen from above: x runs across the canvas, z down it (the bay at the bottom).
function deckTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1408;
  canvas.height = 1600;
  const c = canvas.getContext("2d")!;
  // 32 pixels to the metre: the hangar is 44 m wide and 50 m deep.
  const S = 32,
    X = (x: number) => (x + 22) * S,
    Z = (z: number) => (z + 50) * S;
  const white = "rgba(214,222,230,.86)",
    faint = "rgba(214,222,230,.4)",
    red = "rgba(214,54,48,.85)";
  c.lineCap = "butt";
  // The bay threshold: a broad broken band, then the red line no ship crosses unguided.
  c.fillStyle = white;
  for (let x = -16; x < 16; x += 2) c.fillRect(X(x) + 6, Z(-2.3), S * 2 - 12, S * 0.7);
  c.fillStyle = red;
  c.fillRect(X(-16.5), Z(-3.4), S * 33, S * 0.16);
  // A stand for each parked TIE: a cornered box with its number facing the lane.
  c.font = `600 ${S * 1.15}px Arial, Helvetica, sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  [-10, -22, -34].forEach((z, row) =>
    [-15.5, 15.5].forEach((x, side) => {
      c.strokeStyle = white;
      c.lineWidth = 5;
      const half = 4.4;
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        c.beginPath();
        c.moveTo(X(x + sx * half), Z(z + sz * (half - 1.6)));
        c.lineTo(X(x + sx * half), Z(z + sz * half));
        c.lineTo(X(x + sx * (half - 1.6)), Z(z + sz * half));
        c.stroke();
      }
      c.save();
      c.translate(X(x + (side ? -1 : 1) * 5.6), Z(z));
      c.rotate(side ? -Math.PI / 2 : Math.PI / 2);
      c.fillStyle = faint;
      c.fillText(`T-${String(row * 2 + side + 1).padStart(2, "0")}`, 0, 0);
      c.restore();
    }),
  );
  // The visitor's pad: a circle with a cross, where the tractor beam sets ships down.
  c.strokeStyle = white;
  c.lineWidth = 6;
  c.beginPath();
  c.arc(X(7.5), Z(-12), S * 6.6, 0, Math.PI * 2);
  c.stroke();
  c.setLineDash([S * 0.9, S * 0.6]);
  c.lineWidth = 3;
  c.strokeStyle = faint;
  c.beginPath();
  c.arc(X(7.5), Z(-12), S * 5.4, 0, Math.PI * 2);
  c.stroke();
  c.setLineDash([]);
  c.fillStyle = faint;
  c.font = `600 ${S * 1.5}px Arial, Helvetica, sans-serif`;
  c.fillText("327", X(7.5), Z(-19.6));
  // The deck lift between the lanes, outlined in red chevrons as on every Imperial flight deck.
  c.strokeStyle = red;
  c.lineWidth = 5;
  c.strokeRect(X(-4.2), Z(-42.5), S * 8.4, S * 6.4);
  c.lineWidth = 4;
  for (let i = 0; i < 9; i++) {
    const x = -3.8 + i * 0.95;
    c.beginPath();
    c.moveTo(X(x), Z(-42.5));
    c.lineTo(X(x + 0.55), Z(-41.9));
    c.moveTo(X(x), Z(-36.1));
    c.lineTo(X(x + 0.55), Z(-36.7));
    c.stroke();
  }
  // Guide arrows along both lanes, pointing into the station.
  c.fillStyle = faint;
  for (const x of [-8, 8])
    for (let z = -8; z > -46; z -= 9) {
      c.beginPath();
      c.moveTo(X(x), Z(z - 1.3));
      c.lineTo(X(x - 0.7), Z(z));
      c.lineTo(X(x - 0.22), Z(z));
      c.lineTo(X(x - 0.22), Z(z + 1.2));
      c.lineTo(X(x + 0.22), Z(z + 1.2));
      c.lineTo(X(x + 0.22), Z(z));
      c.lineTo(X(x + 0.7), Z(z));
      c.closePath();
      c.fill();
    }
  // Wear: the paint is scuffed where ships and carts have rolled over it.
  c.globalCompositeOperation = "destination-out";
  let seed = 327;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = `rgba(0,0,0,${0.12 + rand() * 0.35})`;
    c.fillRect(rand() * canvas.width, rand() * canvas.height, 2 + rand() * 26, 1 + rand() * 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function dressHangar(ctx: HangarContext) {
  const { root, decor, kit, materials, owned } = ctx;
  const { dark, trim, strip, red } = materials;

  // --- Deck markings: one painted sheet just above the plating.
  const paint = new THREE.MeshStandardMaterial({ map: ctx.keep(deckTexture()), transparent: true, roughness: 0.55, metalness: 0.05, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  paint.userData.skipSurfaceDetail = true;
  owned.push(paint);
  const markings = new THREE.Mesh(new THREE.PlaneGeometry(44, 50).rotateX(-Math.PI / 2), paint);
  markings.position.set(0, 0.008, -25);
  markings.renderOrder = 1;
  root.add(markings);

  // --- The travelling crane: rails along both walls, a bridge across, a trolley and its load.
  for (const x of [-18.4, 18.4]) {
    kit.box(trim, 0.5, 0.7, 49, x, 15.2, -25);
    for (let z = -4; z > -50; z -= 7.6) kit.box(dark, 0.36, 1.2, 0.36, x, 16, z);
  }
  // Between two racks, clear of the fighters hanging on either side.
  const BRIDGE = -28;
  kit.box(dark, 37.4, 1.0, 0.5, 0, 14.6, BRIDGE - 0.75);
  kit.box(dark, 37.4, 1.0, 0.5, 0, 14.6, BRIDGE + 0.75);
  for (const x of [-18.4, 18.4]) kit.box(trim, 1.1, 1.3, 2.6, x, 14.7, BRIDGE);
  for (let x = -15; x <= 15; x += 5) kit.box(trim, 0.12, 0.5, 1.2, x, 14.6, BRIDGE);
  const TROLLEY = -9;
  kit.box(trim, 2.6, 0.7, 2.1, TROLLEY, 14.2, BRIDGE);
  kit.box(dark, 1.5, 0.55, 1.2, TROLLEY, 13.6, BRIDGE);
  for (const [dx, dz] of [
    [-0.9, -0.55],
    [0.9, -0.55],
    [-0.9, 0.55],
    [0.9, 0.55],
  ])
    kit.cylinder(trim, 0.025, 0.025, 4.2, TROLLEY + dx, 11.3, BRIDGE + dz, 5);
  kit.box(trim, 2.5, 0.22, 1.5, TROLLEY, 9.15, BRIDGE);
  // The load: a sealed container, with the red band of Imperial ordnance.
  kit.box(dark, 2.3, 1.5, 1.35, TROLLEY, 8.3, BRIDGE);
  kit.box(trim, 2.36, 0.12, 1.41, TROLLEY, 9.0, BRIDGE);
  kit.box(trim, 2.36, 0.12, 1.41, TROLLEY, 7.6, BRIDGE);
  kit.box(red, 2.32, 0.16, 0.02, TROLLEY, 8.3, BRIDGE + 0.69);

  // --- TIE fighters hung in racks under the roof, five to a side, above the wall galleries.
  const racks: [number, number][] = [];
  for (const x of [-14.2, 14.2]) for (let z = -6.5; z > -48; z -= 8.6) racks.push([x, z]);
  const RACK_Y = 12.1;
  const dummy = new THREE.Object3D();
  (["hull", "panels", "glass"] as const).forEach((piece) => {
    const mesh = new THREE.InstancedMesh(ctx.tie[piece], ctx.tieMaterials[piece], racks.length);
    racks.forEach(([x, z], index) => {
      dummy.position.set(x, RACK_Y, z);
      dummy.rotation.set(0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.frustumCulled = false;
    decor.add(mesh);
  });
  // Each hangs from a clamp on an arm reaching out from the gantry line.
  racks.forEach(([x, z]) => {
    kit.box(trim, 0.34, 2.3, 0.34, x, 15.25, z);
    kit.box(dark, 1.5, 0.3, 1.5, x, 14.1, z);
    for (const dz of [-0.6, 0.6]) kit.box(trim, 0.16, 0.7, 0.16, x, 13.75, z + dz);
    kit.box(trim, Math.abs(18.4 - Math.abs(x)), 0.26, 0.26, x + Math.sign(x) * (18.4 - Math.abs(x)) * 0.5, 15.9, z);
    kit.box(red, 0.12, 0.12, 0.36, x, 13.96, z);
  });

  // --- Fuel lines from the wall hydrants to the ships, and a service cart by the visitor's craft.
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.82, metalness: 0.1 });
  owned.push(rubber);
  const hose = (points: [number, number][]) => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, z], index) => new THREE.Vector3(x, index === 0 ? 0.55 : 0.07, z)));
    decor.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.07, 6), rubber));
  };
  for (const [x, z] of [
    [-21.6, -16],
    [21.6, -16],
    [21.6, -28],
    [-21.6, -28],
  ]) {
    kit.box(dark, 0.5, 1.1, 0.9, x, 0.55, z);
    kit.box(red, 0.06, 0.2, 0.2, x - Math.sign(x) * 0.26, 0.85, z);
  }
  hose([
    [-21.4, -16],
    [-20.3, -15.2],
    [-19.6, -12.4],
    [-17.8, -11.2],
    [-16.4, -10.6],
  ]);
  hose([
    [21.4, -16],
    [20.2, -17.4],
    [18.6, -15.2],
    [16.4, -15.6],
    [13.2, -13.4],
    [10.6, -12.6],
  ]);
  hose([
    [21.4, -28],
    [20.4, -26.6],
    [19.4, -24.4],
    [17.6, -22.9],
    [16.4, -22.6],
  ]);
  hose([
    [-21.4, -28],
    [-20.2, -29.6],
    [-19.2, -32.2],
    [-17.6, -33.4],
    [-16.4, -33.6],
  ]);
  // The cart: a low tank on a chassis, with its control post.
  const CART = { x: 12.6, z: -5.6 };
  kit.box(trim, 2.1, 0.3, 1.2, CART.x, 0.32, CART.z, 0.4);
  kit.box(dark, 1.5, 0.7, 0.9, CART.x, 0.8, CART.z, 0.4);
  kit.box(trim, 0.2, 0.9, 0.2, CART.x + 0.95, 1.0, CART.z - 0.4, 0.4);
  kit.box(red, 0.14, 0.1, 0.05, CART.x + 0.95, 1.4, CART.z - 0.5, 0.4);
  ctx.block(CART.x, CART.z, 1.5);

  // --- Light: cones falling from the floodlights, and the magnetic field across the bay.
  const cones = new THREE.Group();
  const coneMaterial = softBeam(new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }), 4);
  owned.push(coneMaterial);
  const cone = new THREE.CylinderGeometry(0.4, 4.6, 19.6, 20, 1, true);
  for (const x of [-7.5, 7.5])
    for (const z of [-9, -25, -41]) {
      const beam = new THREE.Mesh(cone, coneMaterial);
      beam.position.set(x, 10, z);
      beam.renderOrder = 4;
      cones.add(beam);
    }
  root.add(cones);

  const fieldUniforms = { time: { value: 0 } };
  const field = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 13),
    new THREE.ShaderMaterial({
      uniforms: fieldUniforms,
      vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
      // Almost nothing in the middle, so space stays as it was; the field gathers at the frame
      // and a slow ripple crosses it now and then.
      fragmentShader: `uniform float time;varying vec2 vUv;
       void main(){
        float edge=min(min(vUv.x,1.0-vUv.x)*2.6,min(vUv.y,1.0-vUv.y));
        float rim=pow(1.0-smoothstep(0.0,.11,edge),2.0);
        float ripple=pow(.5+.5*sin(vUv.y*46.0-time*1.3+sin(vUv.x*9.0+time*.4)*1.6),14.0);
        float shimmer=.5+.5*sin(vUv.x*210.0+time*2.1)*sin(vUv.y*170.0-time*1.7);
        gl_FragColor=vec4(vec3(.42,.72,1.0)*(rim*(.2+shimmer*.1)+ripple*.022+.012),1.0);
       }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  owned.push(field.material as THREE.Material);
  field.position.set(0, 6.5, -0.1);
  field.renderOrder = 3;
  root.add(field);
  // The field's glow on the first metres of deck.
  const spill = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 9).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
      fragmentShader: "varying vec2 vUv;void main(){float along=pow(1.0-vUv.y,2.4)*smoothstep(0.0,.12,vUv.x)*smoothstep(1.0,.88,vUv.x);gl_FragColor=vec4(vec3(.36,.6,1.0)*along*.16,1.0);}",
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  owned.push(spill.material as THREE.Material);
  spill.position.set(0, 0.014, -4.6);
  spill.rotation.y = Math.PI;
  spill.renderOrder = 2;
  root.add(spill);

  // Warning lights on the crane's trucks: the only things that blink up there.
  const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false });
  owned.push(beaconMaterial);
  for (const x of [-18.4, 18.4]) {
    const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.22), beaconMaterial);
    beacon.position.set(x, 13.98, BRIDGE);
    root.add(beacon);
  }

  return {
    /** What is painted or glowing on the deck: kept out of the floor's reflection. */
    onDeck: [markings, spill] as THREE.Object3D[],
    setLight(light: boolean) {
      cones.visible = !light;
    },
    tick(time: number, reduced: boolean) {
      fieldUniforms.time.value = reduced ? 0 : time;
      beaconMaterial.color.setRGB(reduced ? 1 : 0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(time * 2.4)), 6), 0.04, 0.04);
    },
  };
}
