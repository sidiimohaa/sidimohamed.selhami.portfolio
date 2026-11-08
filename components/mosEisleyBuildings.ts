import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// The town of Mos Eisley around the bay, in four kinds of building after the concept sheet:
//   twin    a block with a barrel-vaulted roof, a great arched window and two domes on drums;
//   tower   a tall drum under a dome with a rusted band, a buttressed wing and a tin awning;
//   hall    a squat battered hall with buttresses, two doors up short steps, an outside stair to
//           a roof hut and an aerial;
//   gate    a low block entered through a deep arch, beside a square tower with a dome and a pipe.
// Each is built once at unit size (about 1.1 m from its centre to its walls, front towards +z, on
// y = 0) and drawn as instances, one draw per kind and material, scaled up where it is placed.

export type BuildingKind = "twin" | "tower" | "hall" | "gate";
type XYZ = [number, number, number];
type Finish = "adobe" | "shade" | "rust" | "metal" | "glass" | "cloth";

const matrix = new THREE.Matrix4();
const euler = new THREE.Euler();
const quaternion = new THREE.Quaternion();

// Collects the pieces of one kind of building, by finish, ready to merge.
function builder() {
  const parts = new Map<Finish, THREE.BufferGeometry[]>();
  const add = (finish: Finish, geometry: THREE.BufferGeometry, at: XYZ = [0, 0, 0], turn: XYZ = [0, 0, 0], scale: XYZ = [1, 1, 1]) => {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    for (const name of Object.keys(flat.attributes)) if (!["position", "normal", "uv"].includes(name)) flat.deleteAttribute(name);
    matrix.compose(new THREE.Vector3(...at), quaternion.setFromEuler(euler.set(...turn)), new THREE.Vector3(...scale));
    flat.applyMatrix4(matrix);
    const list = parts.get(finish) ?? [];
    list.push(flat);
    parts.set(finish, list);
  };
  const merged = () => {
    const out = new Map<Finish, THREE.BufferGeometry>();
    parts.forEach((list, finish) => {
      const geometry = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (geometry) out.set(finish, geometry);
    });
    return out;
  };
  return { add, merged };
}

// An arch: a rectangle under a half circle, its foot at y = 0.
function arch(width: number, height: number) {
  const shape = new THREE.Shape();
  const spring = Math.max(0, height - width / 2);
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, spring);
  shape.absarc(0, spring, width / 2, 0, Math.PI, false);
  shape.lineTo(-width / 2, 0);
  return shape;
}
const archGeometry = (width: number, height: number) => new THREE.ShapeGeometry(arch(width, height), 8);
// A raised arch frame: the outer arch with the inner one cut out, given some depth.
function archFrame(width: number, height: number, thickness: number, depth: number) {
  const outer = arch(width + thickness * 2, height + thickness);
  outer.holes.push(new THREE.Path(arch(width, height).getPoints(16)));
  const geometry = new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: false, curveSegments: 10 });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}
// A buttress, seen side on: a wedge `out` deep at its foot, rising to `height` against the wall,
// `thick` across. Its back is at z = 0 and it leans out along +z.
function buttress(out: number, height: number, thick: number) {
  const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(out, 0), new THREE.Vector2(out * 0.25, height), new THREE.Vector2(0, height)]);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(thick / 2, 0, 0);
  return geometry;
}
const halfDome = (r: number) => new THREE.SphereGeometry(r, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
// Arched windows round a drum, facing out at the given angles.
function drumWindows(add: ReturnType<typeof builder>["add"], x: number, z: number, r: number, y: number, angles: number[], size = 0.12) {
  for (const angle of angles) add("shade", archGeometry(size, size * 1.6), [x + Math.sin(angle) * (r + 0.006), y, z + Math.cos(angle) * (r + 0.006)], [0, angle, 0]);
}

function twin() {
  const { add, merged } = builder();
  // The block, its battered ends and the barrel vault along its roof.
  add("adobe", new THREE.BoxGeometry(1.3, 0.9, 1.1), [-0.35, 0.45, 0]);
  add("adobe", buttress(0.22, 0.75, 1.0), [-1.0, 0, 0], [0, -Math.PI / 2, 0]);
  add("adobe", new THREE.CylinderGeometry(0.3, 0.3, 0.95, 16, 1, false, Math.PI / 2, Math.PI), [-0.5, 0.9, 0], [Math.PI / 2, 0, 0]);
  add("adobe", new THREE.BoxGeometry(1.32, 0.06, 1.12), [-0.35, 0.92, 0]);
  // The great arched window, in a deep frame, with its mullions.
  add("adobe", archFrame(0.55, 0.62, 0.06, 0.08), [-0.45, 0.06, 0.56]);
  add("glass", archGeometry(0.55, 0.62), [-0.45, 0.06, 0.552]);
  for (const x of [-0.6, -0.45, -0.3]) add("shade", new THREE.BoxGeometry(0.02, 0.5, 0.02), [x, 0.31, 0.56]);
  // A small dome on its own drum on the block, and the big drum and dome at the end.
  add("adobe", new THREE.CylinderGeometry(0.3, 0.3, 0.16, 20), [-0.1, 1.0, -0.1]);
  add("adobe", halfDome(0.3), [-0.1, 1.08, -0.1]);
  add("adobe", new THREE.CylinderGeometry(0.5, 0.52, 0.95, 24), [0.62, 0.475, 0.05]);
  add("adobe", new THREE.TorusGeometry(0.5, 0.025, 6, 24), [0.62, 0.95, 0.05], [Math.PI / 2, 0, 0]);
  add("adobe", halfDome(0.5), [0.62, 0.95, 0.05]);
  drumWindows(add, 0.62, 0.05, 0.5, 0.58, [-0.5, 0.15, 0.8]);
  add("shade", archGeometry(0.3, 0.55), [0.62, 0, 0.571], [0, 0, 0]);
  // A cloth awning on two poles before the drum's door, an aerial, two vents.
  add("cloth", new THREE.PlaneGeometry(0.6, 0.45, 4, 3), [0.62, 0.58, 0.78], [-1.05, 0, 0]);
  for (const x of [0.36, 0.88]) add("metal", new THREE.CylinderGeometry(0.012, 0.012, 0.62, 5), [x, 0.31, 0.95]);
  add("metal", new THREE.CylinderGeometry(0.012, 0.016, 0.7, 5), [-0.9, 1.25, -0.35]);
  add("metal", new THREE.BoxGeometry(0.16, 0.012, 0.012), [-0.9, 1.45, -0.35]);
  add("metal", new THREE.CylinderGeometry(0.008, 0.008, 0.5, 5), [-0.82, 1.15, -0.4]);
  for (const x of [0.02, 0.12]) add("rust", new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8, 1, false, 0, Math.PI), [x, 0.15, 0.56], [0, Math.PI / 2, 0]);
  return merged();
}

function tower() {
  const { add, merged } = builder();
  // The tall drum, its rusted band and ring, the dome, the windows round its top and its door.
  add("adobe", new THREE.CylinderGeometry(0.55, 0.6, 1.75, 24), [-0.35, 0.875, 0]);
  add("rust", new THREE.CylinderGeometry(0.565, 0.565, 0.13, 24, 1, true), [-0.35, 1.5, 0]);
  add("adobe", new THREE.TorusGeometry(0.56, 0.025, 6, 24), [-0.35, 1.66, 0], [Math.PI / 2, 0, 0]);
  add("adobe", halfDome(0.55), [-0.35, 1.75, 0]);
  add("adobe", new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16), [-0.35, 2.28, 0]);
  drumWindows(add, -0.35, 0, 0.58, 1.12, [-0.7, -0.25, 0.2, 0.65], 0.11);
  add("shade", archGeometry(0.26, 0.5), [-0.35, 0, 0.6]);
  // The wing beside it, buttressed along its face, with a little dome, a porthole and a door.
  add("adobe", new THREE.BoxGeometry(1.0, 1.05, 1.15), [0.5, 0.525, -0.02]);
  for (const x of [0.12, 0.5, 0.88]) add("adobe", buttress(0.28, 1.0, 0.13), [x, 0, 0.555]);
  add("adobe", halfDome(0.26), [0.6, 1.05, -0.2]);
  add("metal", new THREE.TorusGeometry(0.06, 0.018, 6, 14), [0.31, 0.62, 0.58]);
  add("shade", new THREE.CircleGeometry(0.055, 12), [0.31, 0.62, 0.578]);
  add("adobe", archFrame(0.2, 0.36, 0.04, 0.06), [0.69, 0, 0.6]);
  add("shade", archGeometry(0.2, 0.36), [0.69, 0, 0.572]);
  // The rusted wing of tin over the face, on struts.
  add("rust", new THREE.BoxGeometry(1.5, 0.025, 0.7), [0.35, 1.12, 0.86], [0.32, 0, 0.1]);
  for (const x of [-0.05, 0.75]) add("metal", new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5), [x, 0.92, 0.82], [0.75, 0, 0]);
  // Vents and an aerial on top.
  add("metal", new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8), [0.85, 1.16, -0.35]);
  add("metal", new THREE.CylinderGeometry(0.01, 0.014, 0.5, 5), [0.25, 1.3, -0.4]);
  add("metal", new THREE.BoxGeometry(0.12, 0.01, 0.01), [0.25, 1.48, -0.4]);
  return merged();
}

function hall() {
  const { add, merged } = builder();
  // A battered block, narrower at the top than at the foot.
  // A four-sided cylinder turned square, then stretched: the walls lean in by 0.09 over its height.
  add("adobe", new THREE.CylinderGeometry(0.62, 0.71, 1.25, 4, 1).rotateY(Math.PI / 4), [0, 0.625, -0.05], [0, 0, 0], [2.15, 1, 1.45]);
  add("adobe", new THREE.CylinderGeometry(0.64, 0.64, 0.05, 4, 1).rotateY(Math.PI / 4), [0, 1.25, -0.05], [0, 0, 0], [2.1, 1, 1.4]);
  // Buttresses along the front, the doors between them, short steps up to each.
  for (const x of [-0.98, -0.02, 0.98]) add("adobe", buttress(0.32, 1.12, 0.2), [x * 0.95, 0, 0.6]);
  // The face leans back, so what is set on it leans with it.
  const lean = -Math.atan2(0.093, 1.25);
  for (const x of [-0.5, 0.45]) {
    add("adobe", archFrame(0.26, 0.42, 0.04, 0.05), [x, 0.12, 0.682], [lean, 0, 0]);
    add("rust", archGeometry(0.26, 0.42), [x, 0.12, 0.676], [lean, 0, 0]);
    add("shade", new THREE.BoxGeometry(0.012, 0.3, 0.012), [x, 0.27, 0.67], [lean, 0, 0]);
    for (let step = 0; step < 3; step++) add("adobe", new THREE.BoxGeometry(0.36, 0.04, 0.14 - step * 0.035), [x, 0.02 + step * 0.04, 0.68 - step * 0.02]);
  }
  // Two faint emblems on the face.
  for (const x of [-0.5, 0.45]) add("shade", new THREE.CircleGeometry(0.06, 3), [x, 0.85, 0.625], [lean, 0, Math.PI]);
  // The outside stair up the right side to a hut on the roof, with its arched door.
  for (let step = 0; step < 12; step++) add("adobe", new THREE.BoxGeometry(0.22, 0.1 + step * 0.1, 0.1), [1.2, (0.1 + step * 0.1) / 2, 0.55 - step * 0.1]);
  add("adobe", new THREE.BoxGeometry(0.45, 0.5, 0.42), [0.72, 1.5, -0.45]);
  add("adobe", archFrame(0.2, 0.34, 0.04, 0.05), [0.72, 1.25, -0.23]);
  add("shade", archGeometry(0.2, 0.34), [0.72, 1.25, -0.235]);
  // An aerial of crossed bars with a small dish, and a water tank on legs at the side.
  add("metal", new THREE.CylinderGeometry(0.014, 0.02, 0.8, 5), [-0.6, 1.65, -0.35]);
  for (const y of [1.65, 1.82]) add("rust", new THREE.BoxGeometry(0.2, 0.03, 0.03), [-0.6, y, -0.35]);
  add("rust", new THREE.SphereGeometry(0.08, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.5), [-0.6, 1.98, -0.35], [Math.PI * 0.75, 0, 0]);
  add("rust", new THREE.CylinderGeometry(0.11, 0.11, 0.2, 12), [1.45, 0.55, -0.78]);
  for (const z of [-0.85, -0.71]) add("metal", new THREE.CylinderGeometry(0.01, 0.01, 0.46, 5), [1.45, 0.23, z]);
  return merged();
}

function gate() {
  const { add, merged } = builder();
  // The low block, battered at its corners, entered through a deep arched portal.
  add("adobe", new THREE.BoxGeometry(1.5, 0.85, 1.2), [-0.3, 0.425, -0.05]);
  for (const x of [-1.05, 0.45]) add("adobe", buttress(0.2, 0.75, 0.14), [x, 0, 0.55]);
  add("adobe", archFrame(0.5, 0.62, 0.12, 0.38), [-0.3, 0, 0.62]);
  add("shade", archGeometry(0.5, 0.62), [-0.3, 0, 0.552]);
  for (const x of [-0.85, -0.7, 0.15]) add("shade", new THREE.BoxGeometry(0.08, 0.035, 0.01), [x, 0.68, 0.556]);
  // Canvas shades stretched on poles over the roof.
  add("cloth", new THREE.PlaneGeometry(0.6, 0.4, 3, 2), [-0.5, 1.05, 0.05], [-1.2, 0.3, 0.2]);
  add("cloth", new THREE.PlaneGeometry(0.5, 0.35, 3, 2), [0.0, 1.0, -0.2], [-1.3, -0.4, -0.15]);
  for (const [x, z] of [[-0.75, 0.2], [-0.25, -0.1], [0.2, -0.35]] as [number, number][]) add("metal", new THREE.CylinderGeometry(0.01, 0.01, 0.35, 5), [x, 1.02, z]);
  add("metal", new THREE.CylinderGeometry(0.012, 0.018, 0.75, 5), [-0.85, 1.22, -0.4]);
  add("metal", new THREE.CylinderGeometry(0.05, 0.05, 0.03, 10), [-0.85, 1.45, -0.4]);
  // The square tower with its slot windows, the drum and the dome on top.
  add("adobe", new THREE.BoxGeometry(0.62, 1.45, 0.62), [0.75, 0.725, -0.05]);
  add("adobe", buttress(0.18, 1.2, 0.5), [0.75, 0, 0.26]);
  add("adobe", new THREE.CylinderGeometry(0.29, 0.3, 0.26, 20), [0.75, 1.58, -0.05]);
  add("adobe", halfDome(0.29), [0.75, 1.71, -0.05]);
  for (const y of [1.2, 1.32]) add("shade", new THREE.BoxGeometry(0.1, 0.03, 0.01), [0.82, y, 0.262]);
  add("metal", new THREE.BoxGeometry(0.03, 0.1, 0.03), [0.75, 1.86, -0.05]);
  // A pipe running down the tower's side in a dog-leg.
  add("rust", new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(1.07, 1.1, 0.1), new THREE.Vector3(1.1, 0.8, 0.12), new THREE.Vector3(1.08, 0.55, 0.3), new THREE.Vector3(1.1, 0.25, 0.3), new THREE.Vector3(1.05, 0.06, 0.45)]), 20, 0.035, 6, false));
  for (const y of [1.0, 0.3]) add("metal", new THREE.BoxGeometry(0.06, 0.05, 0.06), [1.07, y, 0.18]);
  return merged();
}

const BUILDERS: Record<BuildingKind, () => Map<Finish, THREE.BufferGeometry>> = { twin, tower, hall, gate };

/** The kit: places buildings by kind, then draws them all as instanced meshes. */
export function createBuildingKit(adobe: THREE.Material, shade: THREE.Material) {
  const finishes: Record<Finish, THREE.Material> = {
    adobe,
    shade,
    rust: new THREE.MeshStandardMaterial({ color: 0x8d5434, metalness: 0.45, roughness: 0.75 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x5f625e, metalness: 0.6, roughness: 0.55 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xc27a33, emissive: 0x5a2c0c, emissiveIntensity: 0.6, metalness: 0.2, roughness: 0.35 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x8f6a48, roughness: 1, side: THREE.DoubleSide }),
  };
  const placed: Record<BuildingKind, THREE.Matrix4[]> = { twin: [], tower: [], hall: [], gate: [] };
  const dummy = new THREE.Object3D();
  return {
    /** A building of this kind, `size` metres from its centre to its walls, its front turned by `yaw`. */
    place(kind: BuildingKind, x: number, z: number, size: number, height: number, yaw: number) {
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(size, size * height, size);
      dummy.updateMatrix();
      placed[kind].push(dummy.matrix.clone());
    },
    build() {
      const group = new THREE.Group();
      group.name = "mos-eisley-town";
      (Object.keys(placed) as BuildingKind[]).forEach((kind) => {
        const matrices = placed[kind];
        if (!matrices.length) return;
        BUILDERS[kind]().forEach((geometry, finish) => {
          const instances = new THREE.InstancedMesh(geometry, finishes[finish], matrices.length);
          instances.name = `town-${kind}-${finish}`;
          matrices.forEach((m, i) => instances.setMatrixAt(i, m));
          instances.computeBoundingSphere();
          group.add(instances);
        });
      });
      return group;
    },
  };
}
