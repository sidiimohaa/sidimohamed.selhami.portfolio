import * as THREE from "three";

type Vec3 = [number, number, number];

function piece(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: Vec3 = [0, 0, 0],
  rotation: Vec3 = [0, 0, 0],
) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  return mesh;
}
// A rod between two points, for necks and antennas that are not axis-aligned.
function rod(from: Vec3, to: Vec3, radius: number, material: THREE.Material) {
  const start = new THREE.Vector3(...from),
    span = new THREE.Vector3(...to).sub(start);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, span.length(), 8),
    material,
  );
  mesh.position.copy(start).addScaledVector(span, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), span.normalize());
  return mesh;
}
// A flat detail laid on a cylinder of the given radius, facing out at an angle from the front.
function onBody(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  radius: number,
  angle: number,
  y: number,
) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
  mesh.rotation.y = angle;
  return mesh;
}
// A detail on a dome, placed by its angle around and its elevation above the rim.
function onDome(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  radius: number,
  angle: number,
  elevation: number,
) {
  const mesh = new THREE.Mesh(geometry, material);
  const ring = Math.cos(elevation) * radius;
  mesh.position.set(Math.sin(angle) * ring, Math.sin(elevation) * radius, Math.cos(angle) * ring);
  mesh.rotation.set(-elevation, angle, 0, "YXZ");
  return mesh;
}
function lathe(profile: [number, number][], segments: number) {
  return new THREE.LatheGeometry(
    profile.map(([radius, height]) => new THREE.Vector2(radius, height)),
    segments,
  );
}

// Droids for the landing pad, all facing +Z. One kit shares its materials between copies.
export function createDroidKit() {
  const shell = new THREE.MeshStandardMaterial({ color: 0xdcd7cb, roughness: 0.55, metalness: 0.2 }),
    crimson = new THREE.MeshStandardMaterial({ color: 0x8c3528, roughness: 0.62, metalness: 0.25 }),
    steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a3, roughness: 0.4, metalness: 0.7 }),
    dark = new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.5, metalness: 0.6 }),
    copper = new THREE.MeshStandardMaterial({ color: 0xa8692f, roughness: 0.45, metalness: 0.65 }),
    lens = new THREE.MeshStandardMaterial({
      color: 0x0c1418,
      roughness: 0.08,
      metalness: 0.9,
      emissive: 0x0a1a22,
    }),
    bronze = new THREE.MeshStandardMaterial({ color: 0x7c5434, roughness: 0.65, metalness: 0.45 }),
    cap = new THREE.MeshStandardMaterial({ color: 0x936446, roughness: 0.6, metalness: 0.4 }),
    plate = new THREE.MeshStandardMaterial({ color: 0x7a3a26, roughness: 0.7, metalness: 0.3 }),
    tan = new THREE.MeshStandardMaterial({ color: 0xc9ab7e, roughness: 0.72, metalness: 0.15 }),
    joint = new THREE.MeshStandardMaterial({ color: 0x5b554a, roughness: 0.5, metalness: 0.55 });

  // White and red astromech: weathered red dome, radar eye, three legs with heavy feet.
  const astromech = () => {
    const droid = new THREE.Group(),
      body = 0.272;
    droid.add(
      piece(new THREE.CylinderGeometry(0.27, 0.27, 0.56, 28), shell, [0, 0.6, 0]),
      piece(new THREE.CylinderGeometry(0.27, 0.2, 0.1, 28), shell, [0, 0.27, 0]),
      piece(new THREE.CylinderGeometry(0.205, 0.205, 0.04, 24), dark, [0, 0.2, 0]),
      piece(new THREE.CylinderGeometry(0.279, 0.279, 0.03, 28), steel, [0, 0.885, 0]),
      // Red trim on the front of the body, from the top slots down to the vents.
      onBody(new THREE.BoxGeometry(0.2, 0.03, 0.015), crimson, body, 0.1, 0.835),
      onBody(new THREE.BoxGeometry(0.14, 0.03, 0.015), crimson, body, 0.05, 0.795),
      ...[-0.95, 0.95].map((angle) =>
        onBody(new THREE.BoxGeometry(0.03, 0.42, 0.015), crimson, body, angle, 0.6),
      ),
      ...[0.68, 0.54].flatMap((y) => [
        onBody(new THREE.BoxGeometry(0.075, 0.12, 0.015), crimson, body, 0.28, y),
        onBody(new THREE.BoxGeometry(0.05, 0.095, 0.016), dark, body + 0.002, 0.28, y),
      ]),
      onBody(new THREE.BoxGeometry(0.1, 0.1, 0.015), crimson, body, -0.5, 0.42),
      ...[0.39, 0.42, 0.45].map((y) =>
        onBody(new THREE.BoxGeometry(0.09, 0.008, 0.016), dark, body + 0.002, -0.5, y),
      ),
      onBody(new THREE.BoxGeometry(0.06, 0.06, 0.015), crimson, body, 0.32, 0.4),
      ...[0.6, 0.62, 0.64].map((y) =>
        onBody(new THREE.BoxGeometry(0.06, 0.012, 0.015), crimson, body, -0.55, y),
      ),
      onBody(new THREE.BoxGeometry(0.07, 0.05, 0.012), steel, body, 0.62, 0.72),
      onBody(new THREE.BoxGeometry(0.08, 0.06, 0.012), steel, body, -0.2, 0.47),
      onBody(new THREE.BoxGeometry(0.06, 0.08, 0.012), steel, body, 0.55, 0.5),
      // The short centre leg tucked under the body.
      piece(new THREE.BoxGeometry(0.1, 0.14, 0.1), dark, [0, 0.15, 0]),
      piece(new THREE.BoxGeometry(0.13, 0.08, 0.22), shell, [0, 0.04, 0.03]),
    );
    [-1, 1].forEach((side) =>
      droid.add(
        piece(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 20), shell, [side * 0.3, 0.78, 0], [
          0,
          0,
          Math.PI / 2,
        ]),
        piece(new THREE.TorusGeometry(0.06, 0.012, 6, 20), crimson, [side * 0.333, 0.78, 0], [
          0,
          Math.PI / 2,
          0,
        ]),
        piece(new THREE.BoxGeometry(0.1, 0.26, 0.2), shell, [side * 0.355, 0.74, 0]),
        piece(new THREE.BoxGeometry(0.02, 0.24, 0.03), crimson, [side * 0.41, 0.74, 0.07]),
        piece(new THREE.BoxGeometry(0.08, 0.5, 0.13), shell, [side * 0.355, 0.38, 0]),
        piece(new THREE.BoxGeometry(0.085, 0.06, 0.135), crimson, [side * 0.355, 0.5, 0]),
        piece(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 12), dark, [side * 0.355, 0.12, 0], [
          0,
          0,
          Math.PI / 2,
        ]),
        piece(new THREE.BoxGeometry(0.14, 0.1, 0.3), shell, [side * 0.355, 0.05, 0.02]),
        piece(new THREE.BoxGeometry(0.1, 0.03, 0.06), dark, [side * 0.355, 0.09, 0.13]),
        piece(new THREE.TorusGeometry(0.05, 0.007, 6, 16, Math.PI), copper, [
          side * 0.43,
          0.07,
          0.04,
        ], [0, Math.PI / 2, 0]),
      ),
    );
    const dome = new THREE.Group();
    dome.position.y = 0.9;
    const eye = new THREE.MeshBasicMaterial({ color: 0xbfe6ff });
    const radar = onDome(new THREE.BoxGeometry(0.11, 0.08, 0.07), dark, 0.25, 0.25, 0.75);
    radar.add(
      piece(new THREE.CylinderGeometry(0.026, 0.026, 0.02, 14), lens, [0, 0, 0.04], [Math.PI / 2, 0, 0]),
    );
    dome.add(
      piece(new THREE.SphereGeometry(0.27, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), crimson),
      radar,
      onDome(new THREE.SphereGeometry(0.03, 12, 8), eye, 0.265, 0.12, 0.38),
      onDome(new THREE.CylinderGeometry(0.025, 0.025, 0.04, 12).rotateX(Math.PI / 2), dark, 0.26, 0.58, 0.36),
      onDome(new THREE.BoxGeometry(0.07, 0.03, 0.012), steel, 0.27, -0.3, 0.45),
      onDome(new THREE.BoxGeometry(0.07, 0.03, 0.012), steel, 0.27, -0.3, 0.32),
      ...Array.from({ length: 10 }, (_, i) =>
        onDome(new THREE.BoxGeometry(0.08, 0.04, 0.01), steel, 0.27, (i / 10) * Math.PI * 2 + 0.9, 0.14),
      ),
      piece(new THREE.CylinderGeometry(0.07, 0.07, 0.016, 18), steel, [0, 0.264, 0]),
    );
    droid.add(dome);
    return { droid, dome, eye };
  };

  // Spindly pit droid: a wide cap with one big lens, thin limbs and a ball joint for a waist.
  const pitDroid = () => {
    const droid = new THREE.Group();
    const legs = [-1, 1].map((side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.08, 0.55, 0);
      hip.add(
        piece(new THREE.CylinderGeometry(0.022, 0.02, 0.26, 8), bronze, [0, -0.13, 0]),
        piece(new THREE.SphereGeometry(0.03, 10, 8), steel, [0, -0.27, 0]),
        piece(new THREE.CylinderGeometry(0.019, 0.016, 0.25, 8), bronze, [0, -0.4, 0]),
        piece(new THREE.BoxGeometry(0.07, 0.035, 0.12), dark, [0, -0.535, 0.03]),
      );
      droid.add(hip);
      return hip;
    });
    const arms = [-1, 1].map((side) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.1, 0.88, 0);
      const elbow = new THREE.Group();
      elbow.position.y = -0.2;
      elbow.add(
        piece(new THREE.SphereGeometry(0.02, 8, 6), steel),
        piece(new THREE.CylinderGeometry(0.013, 0.012, 0.17, 6), bronze, [0, -0.085, 0]),
        piece(new THREE.BoxGeometry(0.03, 0.05, 0.015), dark, [0.012, -0.19, 0.01]),
        piece(new THREE.BoxGeometry(0.03, 0.05, 0.015), dark, [-0.012, -0.19, -0.01]),
      );
      shoulder.add(
        piece(new THREE.SphereGeometry(0.025, 8, 6), steel),
        piece(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 6), bronze, [0, -0.1, 0]),
        elbow,
      );
      droid.add(shoulder);
      return { shoulder, elbow };
    });
    droid.add(
      piece(new THREE.SphereGeometry(0.065, 14, 10), bronze, [0, 0.6, 0]),
      piece(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8), dark, [0, 0.66, 0]),
      piece(new THREE.BoxGeometry(0.16, 0.22, 0.1), bronze, [0, 0.8, 0]),
      piece(new THREE.BoxGeometry(0.1, 0.13, 0.012), plate, [0, 0.79, 0.056]),
      piece(new THREE.BoxGeometry(0.12, 0.03, 0.105), dark, [0, 0.9, 0]),
      piece(new THREE.CylinderGeometry(0.014, 0.014, 0.24, 6), dark, [0, 1.03, 0]),
    );
    const head = new THREE.Group();
    head.position.set(0, 1.15, 0.02);
    // Turn first, then tilt, so a nodding head can also look around.
    head.rotation.order = "YXZ";
    head.rotation.x = 0.22;
    head.add(
      piece(
        lathe(
          [
            [0.001, 0.055],
            [0.1, 0.05],
            [0.18, 0.03],
            [0.215, 0.008],
            [0.22, -0.004],
            [0.19, -0.012],
            [0.06, -0.02],
            [0.001, -0.02],
          ],
          28,
        ),
        cap,
      ),
      piece(new THREE.CylinderGeometry(0.075, 0.082, 0.06, 22), steel, [0, -0.02, 0.15], [
        Math.PI / 2,
        0,
        0,
      ]),
      piece(new THREE.CylinderGeometry(0.063, 0.063, 0.012, 22), lens, [0, -0.02, 0.182], [
        Math.PI / 2,
        0,
        0,
      ]),
      ...[-1, 1].map((side) =>
        rod([side * 0.05, 0.04, -0.06], [side * 0.065, 0.17, -0.1], 0.004, dark),
      ),
    );
    droid.add(head);
    return { droid, head, legs, arms };
  };

  // Lanky battle droid: drooping elongated head on a thin neck, backpack, skeletal limbs.
  const sentry = () => {
    const droid = new THREE.Group();
    const legs = [-1, 1].map((side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.1, 1, 0);
      const knee = new THREE.Group();
      knee.position.y = -0.48;
      knee.add(
        piece(new THREE.CylinderGeometry(0.048, 0.048, 0.05, 14), joint, [0, 0, 0], [0, 0, Math.PI / 2]),
        piece(new THREE.BoxGeometry(0.075, 0.42, 0.1), tan, [0, -0.24, 0]),
        piece(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 10), joint, [0, -0.47, 0], [0, 0, Math.PI / 2]),
        piece(new THREE.BoxGeometry(0.1, 0.05, 0.24), tan, [0, -0.5, 0.05]),
      );
      hip.add(piece(new THREE.BoxGeometry(0.07, 0.42, 0.09), tan, [0, -0.22, 0.01]), knee);
      droid.add(hip);
      return { hip, knee };
    });
    const arms = [-1, 1].map((side) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.19, 1.55, -0.02);
      const elbow = new THREE.Group();
      elbow.position.y = -0.31;
      elbow.rotation.x = -0.25;
      elbow.add(
        piece(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 10), joint, [0, 0, 0], [0, 0, Math.PI / 2]),
        piece(new THREE.BoxGeometry(0.055, 0.27, 0.065), tan, [0, -0.15, 0]),
        piece(new THREE.BoxGeometry(0.05, 0.07, 0.035), joint, [0, -0.32, 0]),
        ...[-1, 0, 1].map((finger) =>
          piece(new THREE.BoxGeometry(0.012, 0.07, 0.012), joint, [finger * 0.016, -0.39, 0.01]),
        ),
      );
      shoulder.add(
        piece(new THREE.SphereGeometry(0.045, 12, 10), joint),
        piece(new THREE.CylinderGeometry(0.022, 0.022, 0.28, 8), joint, [0, -0.15, 0]),
        piece(new THREE.BoxGeometry(0.06, 0.16, 0.07), tan, [0, -0.12, 0]),
        elbow,
      );
      droid.add(shoulder);
      return { shoulder, elbow };
    });
    droid.add(
      piece(new THREE.BoxGeometry(0.26, 0.1, 0.12), tan, [0, 1.03, 0]),
      ...[-1, 1].map((side) =>
        piece(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16), joint, [side * 0.16, 1, 0], [
          0,
          0,
          Math.PI / 2,
        ]),
      ),
      piece(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 8), joint, [0, 1.22, -0.02]),
      piece(new THREE.BoxGeometry(0.24, 0.26, 0.14), tan, [0, 1.46, 0]),
      piece(new THREE.BoxGeometry(0.1, 0.12, 0.03), tan, [0, 1.3, 0.05]),
      piece(new THREE.BoxGeometry(0.3, 0.42, 0.18), tan, [0, 1.52, -0.17]),
      rod([0, 1.66, -0.08], [0, 1.86, 0.04], 0.018, joint),
      rod([0.1, 1.72, -0.22], [0.11, 2.08, -0.22], 0.006, joint),
      rod([0.03, 1.72, -0.24], [0.04, 1.98, -0.24], 0.006, joint),
    );
    const head = new THREE.Group();
    head.position.set(0, 1.87, 0.05);
    head.rotation.order = "YXZ";
    head.rotation.x = 0.4;
    const skull = piece(
      lathe(
        [
          [0.001, -0.07],
          [0.055, -0.06],
          [0.07, -0.01],
          [0.062, 0.08],
          [0.045, 0.18],
          [0.03, 0.27],
          [0.02, 0.31],
          [0.001, 0.325],
        ],
        16,
      ).rotateX(Math.PI / 2),
      tan,
    );
    skull.scale.set(1, 0.75, 1);
    head.add(
      skull,
      piece(new THREE.BoxGeometry(0.05, 0.03, 0.12), tan, [0, 0.055, -0.02]),
      ...[-1, 1].map((side) =>
        piece(new THREE.SphereGeometry(0.014, 8, 6), dark, [side * 0.058, 0.005, 0.04]),
      ),
    );
    droid.add(head);
    return { droid, head, legs, arms };
  };

  return { astromech, pitDroid, sentry };
}
