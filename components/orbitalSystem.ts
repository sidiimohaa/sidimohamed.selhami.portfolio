// A deliberately compressed navigation system, not a scale model of Star Wars geography.
// Keep destinations stationary: changing their positions during a flight would move its endpoint.
export type SpacePoint = [number, number, number];
export const SYSTEM_CENTER: SpacePoint = [0, 12, -90];
export const SYSTEM_TILT = 0.32;
export const HOME_CAMERA_Z = 44;
export const FLIGHT_SPEED = { cruise: 8, boost: 24 };

export function orbitalPoint(reach: number, angle: number, lift = 0): SpacePoint {
  const depth = Math.sin(angle) * reach;
  return [
    SYSTEM_CENTER[0] + Math.cos(angle) * reach,
    SYSTEM_CENTER[1] + depth * Math.sin(SYSTEM_TILT) + lift,
    SYSTEM_CENTER[2] + depth * Math.cos(SYSTEM_TILT),
  ];
}

const world = (radius: number, orbit: number, degrees: number) => ({
  radius, orbit, position: orbitalPoint(orbit, degrees * Math.PI / 180),
});
// Larger worlds establish their scale against the foreground X-wing.
const endor = world(8.4, 78, 205);
// Indices match destinations: Tatooine, Endor, Coruscant, station, Hoth.
export const ORBITAL_BODIES = [
  world(10.8, 56, 25),
  endor,
  world(14.4, 32, 120),
  { radius: 3.15, orbit: null, position: [endor.position[0] + 22, endor.position[1] + 20, endor.position[2] + 10] as SpacePoint },
  world(9.6, 108, 300),
];
export const DEBRIS_ORBIT = 66;

// Fit both axes with breathing room for labels, without changing the ship's foreground scale.
export function homeCameraZ(aspect: number, fov: number) {
  const halfHeight = Math.tan(fov * Math.PI / 360);
  const halfWidth = halfHeight * Math.max(0.2, aspect);
  return Math.max(HOME_CAMERA_Z, ...ORBITAL_BODIES.map(({ position: [x, y, z], radius }) =>
    Math.max(z + (Math.abs(x) + radius + 5) / (halfWidth * 0.86),
      z + (Math.abs(y) + radius + 5) / (halfHeight * 0.78))));
}
