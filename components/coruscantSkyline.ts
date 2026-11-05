import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type TowerShape = "shoulder" | "needle" | "terraces" | "dome";
type Tower = {
  x: number;
  z: number;
  r: number;
  top: number;
  shape: TowerShape;
};

// Sculpted silhouettes sit between the platform and the carpet of distant blocks.
const towers: Tower[] = [
  { x: -62, z: -135, r: 14, top: 96, shape: "shoulder" },
  { x: 25, z: -205, r: 11, top: 138, shape: "needle" },
  { x: 80, z: -118, r: 16, top: 79, shape: "terraces" },
  { x: -132, z: -96, r: 17, top: 55, shape: "dome" },
  { x: -105, z: -200, r: 12, top: 131, shape: "shoulder" },
  { x: 116, z: -179, r: 10, top: 118, shape: "needle" },
  { x: -122, z: 80, r: 13, top: 95, shape: "shoulder" },
  { x: 104, z: 101, r: 16, top: 74, shape: "terraces" },
  { x: -5, z: 173, r: 11, top: 136, shape: "needle" },
  { x: 157, z: 9, r: 17, top: 54, shape: "dome" },
];

export const CORUSCANT_LANDMARKS = towers.map(({ x, z, r, top }) => ({
  x,
  z,
  top,
  r: r * 1.3 + 3,
}));

function profileFor(tower: Tower) {
  const { r, top: h, shape } = tower;
  const profile: [number, number][] =
    shape === "needle"
      ? [
          [0.9, -240],
          [1, -75],
          [0.9, -20],
          [0.78, 0],
          [0.71, h * 0.2],
          [0.58, h * 0.42],
          [0.32, h * 0.68],
          [0.23, h * 0.9],
          [0.1, h],
          [0, h + 3],
        ]
      : shape === "terraces"
        ? [
            [1, -240],
            [1, -20],
            [1.06, -17],
            [1.06, 3],
            [0.89, 3],
            [0.89, h * 0.26],
            [0.71, h * 0.26],
            [0.71, h * 0.5],
            [0.52, h * 0.5],
            [0.52, h * 0.73],
            [0.28, h * 0.73],
            [0.28, h],
            [0, h],
          ]
        : shape === "dome"
          ? [
              [0.9, -240],
              [0.86, -55],
              [0.9, -12],
              [1, 0],
              [0.91, h * 0.36],
              [0.9, h * 0.54],
              [1.12, h * 0.57],
              [1.12, h * 0.66],
              [1.04, h * 0.74],
              [0.85, h * 0.87],
              [0.51, h * 0.96],
              [0, h],
            ]
          : [
              [0.88, -240],
              [1, -80],
              [0.87, -24],
              [0.91, 0],
              [1.02, h * 0.19],
              [0.98, h * 0.31],
              [0.76, h * 0.46],
              [0.47, h * 0.59],
              [0.36, h * 0.75],
              [0.34, h * 0.9],
              [0.27, h * 0.97],
              [0.12, h + 1],
              [0, h + 3],
            ];
  return profile.map(
    ([radius, height]) => new THREE.Vector2(radius * r, height),
  );
}

export function createCoruscantSkyline(material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = "coruscant-landmarks";
  const graphite = new THREE.MeshStandardMaterial({
    color: 0x333744,
    roughness: 0.57,
    metalness: 0.65,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: 0x56566b,
    roughness: 0.43,
    metalness: 0.7,
  });
  const blue = new THREE.MeshBasicMaterial({ color: 0x829fc9 });
  const amber = new THREE.MeshBasicMaterial({ color: 0xc69b67 });
  const beacon = new THREE.MeshBasicMaterial({ color: 0xbd6f74 });
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const transform = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const location = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  const add = (
    geometry: THREE.BufferGeometry,
    appearance: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
  ) => {
    euler.set(rx, ry, rz);
    rotation.setFromEuler(euler);
    transform.compose(location.set(x, y, z), rotation, scale);
    geometry.applyMatrix4(transform);
    const parts = batches.get(appearance) ?? [];
    parts.push(geometry);
    batches.set(appearance, parts);
  };
  const band = (
    tower: Tower,
    height: number,
    radius: number,
    appearance: THREE.Material,
    thickness = 0.16,
  ) => {
    add(
      new THREE.TorusGeometry(radius, thickness, 4, 40),
      appearance,
      tower.x,
      height,
      tower.z,
      Math.PI / 2,
    );
  };

  towers.forEach((tower, index) => {
    const profile = profileFor(tower);
    const segments = tower.shape === "terraces" ? 8 : 32;
    const facade = new THREE.Mesh(
      new THREE.LatheGeometry(profile, segments),
      material,
    );
    facade.name = `landmark-${tower.shape}-${index + 1}`;
    facade.position.set(tower.x, 0, tower.z);
    group.add(facade);

    if (tower.shape === "shoulder" || tower.shape === "needle") {
      // Narrow raised ribs follow the shoulder instead of hiding it in a cylinder.
      const ribProfile = profile.filter(
        (point) => point.y >= -24 && point.x > tower.r * 0.2,
      );
      for (let rib = 0; rib < 12; rib++) {
        const angle = (rib / 12) * Math.PI * 2;
        const points = ribProfile.map(
          (point) =>
            new THREE.Vector3(
              tower.x + Math.sin(angle) * (point.x + 0.12),
              point.y,
              tower.z + Math.cos(angle) * (point.x + 0.12),
            ),
        );
        const curve = new THREE.CatmullRomCurve3(points);
        add(
          new THREE.TubeGeometry(curve, 12, 0.16, 4, false),
          graphite,
          0,
          0,
          0,
        );
      }
      const crown = tower.shape === "shoulder" ? 0.9 : 0.68;
      const crownRadius = tower.r * (tower.shape === "shoulder" ? 0.35 : 0.33);
      band(tower, tower.top * crown, crownRadius + 0.2, trim, 0.28);
      band(tower, tower.top * crown - 1.25, crownRadius + 0.21, blue, 0.12);
      band(
        tower,
        tower.top * 0.2,
        tower.r * (tower.shape === "shoulder" ? 1.025 : 0.72),
        graphite,
        0.24,
      );
    } else if (tower.shape === "dome") {
      band(tower, tower.top * 0.6, tower.r * 1.125, trim, 0.28);
      band(tower, tower.top * 0.56, tower.r * 0.93, blue, 0.13);
      band(tower, tower.top * 0.66, tower.r * 1.125, graphite, 0.3);
      // Dome ribs read as a crown against the warm horizon.
      for (let rib = 0; rib < 12; rib++) {
        const angle = (rib / 12) * Math.PI * 2;
        const points = profile
          .filter((point) => point.y >= tower.top * 0.66)
          .map(
            (point) =>
              new THREE.Vector3(
                tower.x + Math.sin(angle) * (point.x + 0.1),
                point.y + 0.05,
                tower.z + Math.cos(angle) * (point.x + 0.1),
              ),
          );
        add(
          new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(points),
            10,
            0.15,
            4,
            false,
          ),
          graphite,
          0,
          0,
          0,
        );
      }
    } else {
      [0.26, 0.5, 0.73].forEach((level, step) => {
        const radius = tower.r * [0.9, 0.72, 0.53][step];
        add(
          new THREE.CylinderGeometry(radius + 0.3, radius + 0.3, 0.65, 8),
          trim,
          tower.x,
          tower.top * level,
          tower.z,
        );
        band(tower, tower.top * level - 1, radius, amber, 0.12);
      });
    }

    const antennaHeight =
      tower.shape === "needle" ? 17 : tower.shape === "shoulder" ? 10 : 6;
    add(
      new THREE.CylinderGeometry(0.1, 0.28, antennaHeight, 6),
      graphite,
      tower.x,
      tower.top + antennaHeight / 2 + 2,
      tower.z,
    );
    add(
      new THREE.SphereGeometry(0.28, 6, 4),
      beacon,
      tower.x,
      tower.top + antennaHeight + 2,
      tower.z,
    );
    if (tower.shape === "needle") {
      // A small illuminated collar, not a bloom halo, defines the needle's crown.
      band(tower, tower.top - 2, tower.r * 0.12, blue, 0.2);
    }
  });

  const bridge = (from: Tower, to: Tower, height: number) => {
    const dx = to.x - from.x,
      dz = to.z - from.z;
    const length = Math.hypot(dx, dz),
      yaw = Math.atan2(dx, dz);
    const x = (from.x + to.x) / 2,
      z = (from.z + to.z) / 2;
    const sideX = Math.cos(yaw),
      sideZ = -Math.sin(yaw);
    add(new THREE.BoxGeometry(4, 1.2, length), graphite, x, height, z, 0, yaw);
    for (const sign of [-1, 1]) {
      add(
        new THREE.BoxGeometry(0.22, 1.7, length),
        trim,
        x + sideX * sign * 1.85,
        height + 1.35,
        z + sideZ * sign * 1.85,
        0,
        yaw,
      );
      add(
        new THREE.BoxGeometry(0.11, 0.1, length),
        blue,
        x + sideX * sign * 1.86,
        height + 2.15,
        z + sideZ * sign * 1.86,
        0,
        yaw,
      );
      // A shallow arch and hangers make the link feel suspended, rather than a floating slab.
      const points = Array.from({ length: 13 }, (_, step) => {
        const t = step / 12;
        return new THREE.Vector3(
          from.x + dx * t + sideX * sign * 1.85,
          height + 2.2 + Math.sin(t * Math.PI) * 8,
          from.z + dz * t + sideZ * sign * 1.85,
        );
      });
      add(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(points),
          20,
          0.2,
          5,
          false,
        ),
        graphite,
        0,
        0,
        0,
      );
      for (let step = 1; step < 8; step++) {
        const t = step / 8,
          rise = 0.8 + Math.sin(t * Math.PI) * 8;
        add(
          new THREE.CylinderGeometry(0.07, 0.07, rise, 4),
          trim,
          from.x + dx * t + sideX * sign * 1.85,
          height + 1.4 + rise / 2,
          from.z + dz * t + sideZ * sign * 1.85,
        );
      }
    }
  };
  bridge(towers[0], towers[1], 27);
  bridge(towers[3], towers[0], 9);
  bridge(towers[2], towers[5], 24);

  // Each family of metal or small lights is one static draw, despite the many details.
  batches.forEach((parts, appearance) => {
    const geometry = mergeGeometries(parts, false);
    parts.forEach((part) => part.dispose());
    if (!geometry) return;
    geometry.computeBoundingSphere();
    const details = new THREE.Mesh(geometry, appearance);
    details.name = "skyline-details";
    group.add(details);
  });
  group.userData.landmarkCount = towers.length;
  group.userData.bridgeCount = 3;
  return group;
}
