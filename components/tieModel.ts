import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const baked = (parts: [THREE.BufferGeometry, THREE.Matrix4][]) =>
  mergeGeometries(parts.map(([geometry, matrix]) => {
    const copy = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    return copy.applyMatrix4(matrix);
  }));
const at = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));

// A TIE fighter: ball cockpit with its octagonal window, two pylons and the hexagonal solar wings,
// pointing up and down, with their six struts. Baked into three meshes shared by the whole squadron.
export function tieGeometry() {
  const hex = (radius: number, depth: number) => {
    const shape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 3;
      if (i) shape.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
      else shape.moveTo(Math.cos(a) * radius, Math.sin(a) * radius);
    }
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2).rotateY(Math.PI / 2);
  };
  const ball = new THREE.SphereGeometry(1, 22, 16),
    collar = new THREE.CylinderGeometry(0.6, 0.66, 0.34, 8).rotateX(Math.PI / 2),
    ring = new THREE.TorusGeometry(0.58, 0.05, 6, 8),
    spoke = new THREE.BoxGeometry(0.045, 0.56, 0.04),
    pylon = new THREE.CylinderGeometry(0.2, 0.32, 1.9, 10).rotateZ(Math.PI / 2),
    hub = new THREE.CylinderGeometry(0.48, 0.48, 0.3, 12).rotateZ(Math.PI / 2),
    frame = hex(3.1, 0.1),
    panel = hex(2.86, 0.16),
    strut = new THREE.BoxGeometry(0.2, 3.0, 0.14),
    engine = new THREE.CylinderGeometry(0.17, 0.2, 0.42, 10).rotateX(Math.PI / 2);
  const hull: [THREE.BufferGeometry, THREE.Matrix4][] = [
    [ball, at(0, 0, 0)],
    [collar, at(0, 0, 0.92)],
    [ring, at(0, 0, 1.1)],
    // The twin ion engines at the back of the ball.
    [engine, at(-0.3, 0.1, -1)],
    [engine, at(0.3, 0.1, -1)],
  ];
  for (let i = 0; i < 8; i++) hull.push([spoke, at(Math.cos((i * Math.PI) / 4) * 0.28, Math.sin((i * Math.PI) / 4) * 0.28, 1.1, 0, 0, (i * Math.PI) / 4 - Math.PI / 2)]);
  for (const side of [-1, 1]) {
    hull.push([pylon, at(side * 1.7, 0, 0)], [frame, at(side * 2.7, 0, 0)], [hub, at(side * 2.7, 0, 0)]);
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 3;
      hull.push([strut, at(side * 2.7, Math.sin(a) * 1.5, -Math.cos(a) * 1.5, a - Math.PI / 2)]);
    }
    // Ribs across the solar panel, proud of it on both faces.
    for (const z of [-1.9, -1, 1, 1.9]) {
      const rib = new THREE.BoxGeometry(0.2, 2 * (2.86 - Math.abs(z) * 0.577), 0.035);
      hull.push([rib, at(side * 2.7, 0, z)]);
    }
  }
  const panels = baked([
    [panel, at(-2.7, 0, 0)],
    [panel, at(2.7, 0, 0)],
  ]);
  const glass = new THREE.CircleGeometry(0.58, 8).translate(0, 0, 1.095);
  [ball, collar, ring, spoke, pylon, hub, frame, panel, strut, engine].forEach((g) => g.dispose());
  return { hull: baked(hull), panels, glass };
}
