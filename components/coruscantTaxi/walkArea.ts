import * as THREE from "three";

// Where a visitor may stand: a union of discs and rectangles in a local frame (origin and yaw
// in the world), with keep-out boxes. Points outside are pulled back to the nearest edge.

export type Shape = { kind: "disc"; x: number; z: number; r: number } | { kind: "rect"; x: number; z: number; hx: number; hz: number };

export function createWalkArea(origin: THREE.Vector3, yaw: number, shapes: Shape[]) {
  const cos = Math.cos(yaw),
    sin = Math.sin(yaw);
  const toLocal = (x: number, z: number) => {
    const dx = x - origin.x,
      dz = z - origin.z;
    return { x: dx * cos - dz * sin, z: dx * sin + dz * cos };
  };
  const toWorld = (x: number, z: number) => ({ x: origin.x + x * cos + z * sin, z: origin.z - x * sin + z * cos });
  const inside = (p: { x: number; z: number }, shape: Shape) =>
    shape.kind === "disc" ? Math.hypot(p.x - shape.x, p.z - shape.z) <= shape.r : Math.abs(p.x - shape.x) <= shape.hx && Math.abs(p.z - shape.z) <= shape.hz;
  const nearest = (p: { x: number; z: number }, shape: Shape) => {
    if (shape.kind === "disc") {
      const dx = p.x - shape.x,
        dz = p.z - shape.z,
        d = Math.hypot(dx, dz) || 1;
      const k = Math.min(1, shape.r / d);
      return { x: shape.x + dx * k, z: shape.z + dz * k };
    }
    return { x: THREE.MathUtils.clamp(p.x, shape.x - shape.hx, shape.x + shape.hx), z: THREE.MathUtils.clamp(p.z, shape.z - shape.hz, shape.z + shape.hz) };
  };
  let blocks: { x: number; z: number; hx: number; hz: number }[] = [];
  return {
    toLocal,
    toWorld,
    // Local position of a world point, and back.
    setBlocks: (next: typeof blocks) => (blocks = next),
    contains: (x: number, z: number) => {
      const p = toLocal(x, z);
      return shapes.some((shape) => inside(p, shape));
    },
    constrain: (walker: { x: number; z: number }) => {
      let p = toLocal(walker.x, walker.z);
      if (!shapes.some((shape) => inside(p, shape))) {
        let best = p,
          gap = Infinity;
        shapes.forEach((shape) => {
          const q = nearest(p, shape),
            d = Math.hypot(q.x - p.x, q.z - p.z);
          if (d < gap) {
            gap = d;
            best = q;
          }
        });
        p = best;
      }
      // Step out of a blocked box by its shortest side.
      blocks.forEach((box) => {
        const dx = p.x - box.x,
          dz = p.z - box.z;
        if (Math.abs(dx) < box.hx && Math.abs(dz) < box.hz) {
          if (box.hx - Math.abs(dx) < box.hz - Math.abs(dz)) p = { x: box.x + Math.sign(dx || 1) * box.hx, z: p.z };
          else p = { x: p.x, z: box.z + Math.sign(dz || 1) * box.hz };
        }
      });
      const w = toWorld(p.x, p.z);
      walker.x = w.x;
      walker.z = w.z;
    },
  };
}
