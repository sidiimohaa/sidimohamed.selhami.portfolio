import * as THREE from "three";

// Where things may be set out in open space, and how a signal is pointed at on screen. Pure maths,
// so that it can be tested without a scene.

export type Obstacle = { position: THREE.Vector3; radius: number };

/** Moves `point` out of any world it would stand inside, with `margin` to spare. */
export function clearOf(point: THREE.Vector3, obstacles: Obstacle[], margin: number) {
  for (const obstacle of obstacles) {
    const offset = point.clone().sub(obstacle.position);
    const distance = offset.length();
    const limit = obstacle.radius + margin;
    if (distance >= limit) continue;
    if (distance < 1e-6) offset.set(0, 1, 0);
    point.copy(obstacle.position).addScaledVector(offset.normalize(), limit);
  }
  return point;
}

export type MarkerSpot = { x: number; y: number; angle: number; onScreen: boolean };

/**
 * Screen position of a point from normalised device coordinates: where it is when it is in view,
 * otherwise on an ellipse near the edge, in its direction, with the angle of the arrow.
 */
export function markerSpot(ndcX: number, ndcY: number, behind: boolean, width: number, height: number, edge = 0.86): MarkerSpot {
  // A point behind the camera projects mirrored.
  const x = behind ? -ndcX : ndcX,
    y = behind ? -ndcY : ndcY;
  const onScreen = !behind && Math.abs(x) < edge && Math.abs(y) < edge;
  const reach = Math.hypot(x, y) || 1;
  const k = onScreen ? 1 : edge / Math.max(Math.abs(x), Math.abs(y), 1e-3);
  const px = (x * k + 1) * 0.5 * width,
    py = (1 - y * k) * 0.5 * height;
  return { x: px, y: py, angle: Math.atan2(-y / reach, x / reach), onScreen };
}
