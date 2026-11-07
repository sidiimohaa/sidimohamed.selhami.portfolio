import * as THREE from "three";

type Obstacle = { position: THREE.Vector3; radius: number };
type Options = {
  camera: THREE.PerspectiveCamera;
  ship: THREE.Object3D;
  destination: THREE.Vector3;
  radius: number;
  shipDistance: number;
  shipHeight: number;
  reduced: boolean;
  obstacles: Obstacle[];
};

// The craft flies a route; the chase camera follows it rather than carrying it.
export function createApproachFlight(options: Options) {
  const {
    camera,
    ship,
    destination,
    radius,
    shipDistance,
    shipHeight,
    reduced,
  } = options;
  const baseFov = camera.aspect < 0.8 ? 52 : 50;
  const portrait = camera.aspect < 0.8;
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(baseFov / 2));
  const share = portrait ? Math.min(0.36, camera.aspect * 0.45) : 0.36;
  const range = Math.max(radius / (tanHalf * share), radius + shipDistance + 3);
  const goalCamera = destination
    .clone()
    .add(
      new THREE.Vector3(0, -(portrait ? -0.08 : 0.2) * range * tanHalf, range),
    );
  const goalShip = goalCamera
    .clone()
    .add(new THREE.Vector3(0, -shipHeight, -shipDistance));
  const start = ship.position.clone();
  const initialRotation = ship.quaternion.clone();
  const distance = start.distanceTo(goalShip);
  const duration = reduced
    ? 0.65
    : THREE.MathUtils.clamp(4.8 + distance / 40, 5.2, 8);
  const departure = new THREE.Vector3(0, 0, -1).applyQuaternion(
    camera.quaternion,
  );
  const displacement = goalShip.clone().sub(start);
  // A destination behind the pilot needs a broad turn rather than a tight reversal.
  const sideArc =
    displacement.z > -distance * 0.2 ||
    departure.dot(displacement.clone().normalize()) < 0.1
      ? (Math.sign(displacement.x) || 1) * distance * 0.4
      : 0;
  const handle = Math.max(2, distance * 0.32);
  const curve = new THREE.CubicBezierCurve3(
    start,
    start.clone().addScaledVector(departure, handle),
    goalShip.clone().add(new THREE.Vector3(0, 0, handle)),
    goalShip,
  );
  let bow = 0;
  const point = new THREE.Vector3();
  const pointAt = (u: number, out: THREE.Vector3) => {
    curve.getPoint(u, out);
    out.x += sideArc * 16 * u * u * (1 - u) * (1 - u);
    // This detour preserves the departure and arrival tangents.
    out.y += bow * 16 * u * u * (1 - u) * (1 - u);
    return out;
  };
  const routeAhead = new THREE.Vector3(), routeBehind = new THREE.Vector3();
  const routeCamera = new THREE.Vector3(), routeDirection = new THREE.Vector3();
  const routeRotation = new THREE.Quaternion();
  const routeAttitude = new THREE.Euler(0, 0, 0, "YXZ");
  const obstructed = () => {
    for (let sample = 2; sample <= 100; sample++) {
      const u = sample / 100;
      pointAt(u, point);
      pointAt(Math.min(1, u + 0.001), routeAhead);
      pointAt(Math.max(0, u - 0.001), routeBehind);
      routeDirection.copy(routeAhead).sub(routeBehind).normalize();
      routeAttitude.set(Math.asin(THREE.MathUtils.clamp(routeDirection.y, -1, 1)), Math.atan2(-routeDirection.x, -routeDirection.z), 0, "YXZ");
      routeRotation.setFromEuler(routeAttitude);
      routeCamera.set(0, shipHeight, shipDistance).applyQuaternion(routeRotation).add(point);
      if (
        options.obstacles.some(
          (obstacle) =>
            point.distanceTo(obstacle.position) < obstacle.radius + 1.25 ||
            routeCamera.distanceTo(obstacle.position) < obstacle.radius + 2,
        )
      )
        return true;
    }
    return false;
  };
  // Favor the shortest arc, adding clearance only if another world blocks it.
  for (let attempt = 0; attempt < 12 && obstructed(); attempt++) {
    bow =
      (attempt % 2 ? -1 : 1) *
      (Math.floor(attempt / 2) + 1) *
      Math.max(5, distance * 0.16);
  }
  const ahead = new THREE.Vector3(),
    behind = new THREE.Vector3();
  const tangent = new THREE.Vector3(),
    previousPosition = start.clone();
  const chasePosition = new THREE.Vector3(),
    chaseOffset = new THREE.Vector3();
  const clearanceOffset = new THREE.Vector3();
  const facing = new THREE.Quaternion(),
    cameraFacing = new THREE.Quaternion();
  const identity = new THREE.Quaternion();
  const lookTarget = new THREE.Vector3(),
    cameraUp = new THREE.Vector3();
  const aim = new THREE.Quaternion(),
    lookMatrix = new THREE.Matrix4();
  const attitude = new THREE.Euler(0, 0, 0, "YXZ");
  const bodyBase = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-1.04, 0, 0),
  );
  const cameraAttitude = new THREE.Euler(0, 0, 0, "YXZ");
  let age = 0,
    previousYaw = 0,
    first = true,
    bank = 0;
  const flight = {
    progress: 0,
    power: 0,
    completed: false,
    update(dt: number) {
      if (flight.completed) return;
      age = Math.min(duration, age + dt);
      const t = age / duration;
      const u = THREE.MathUtils.smootherstep(t, 0, 1);
      flight.progress = t;
      if (reduced) {
        camera.position.copy(goalCamera);
        camera.quaternion.identity();
        ship.position.copy(goalShip);
        ship.quaternion.copy(bodyBase);
      } else {
        pointAt(u, ship.position);
        pointAt(Math.min(1, u + 0.0005), ahead);
        pointAt(Math.max(0, u - 0.0005), behind);
        tangent.copy(ahead).sub(behind).normalize();
        const yaw = Math.atan2(-tangent.x, -tangent.z);
        const pitch = Math.asin(THREE.MathUtils.clamp(tangent.y, -1, 1));
        const turn = first
          ? 0
          : Math.atan2(
              Math.sin(yaw - previousYaw),
              Math.cos(yaw - previousYaw),
            ) / Math.max(dt, 0.001);
        const envelope =
          THREE.MathUtils.smoothstep(t, 0, 0.12) *
          (1 - THREE.MathUtils.smoothstep(t, 0.78, 1));
        bank = THREE.MathUtils.damp(
          bank,
          THREE.MathUtils.clamp(turn * 0.65, -0.38, 0.38) * envelope,
          7,
          dt,
        );
        previousYaw = yaw;
        first = false;
        const speed =
          ship.position.distanceTo(previousPosition) / Math.max(dt, 0.001);
        flight.power = THREE.MathUtils.clamp(speed / 18, 0, 1);
        previousPosition.copy(ship.position);
        attitude.set(pitch, yaw, bank, "YXZ");
        facing.setFromEuler(attitude).multiply(bodyBase);
        ship.quaternion
          .copy(initialRotation)
          .slerp(facing, THREE.MathUtils.smoothstep(t, 0, 0.12));
        cameraAttitude.set(pitch, yaw, bank * 0.08, "YXZ");
        cameraFacing.setFromEuler(cameraAttitude);
        // A little lag lets the craft pull ahead under thrust and catch up while braking.
        chaseOffset
          .set(0, shipHeight, shipDistance)
          .applyQuaternion(cameraFacing);
        chasePosition.copy(ship.position).add(chaseOffset);
        camera.position.lerp(chasePosition, 1 - Math.exp(-dt * 7));
        const settle = THREE.MathUtils.smoothstep(t, 0.84, 1);
        camera.position.lerp(goalCamera, settle * settle);
        clearanceOffset.copy(camera.position).sub(ship.position);
        const minimumFollowDistance =
          Math.hypot(shipHeight, shipDistance) * 0.95;
        if (clearanceOffset.length() < minimumFollowDistance) {
          camera.position
            .copy(ship.position)
            .addScaledVector(
              clearanceOffset.normalize(),
              minimumFollowDistance,
            );
        }
        // The lagging chase view has its own volume. Keep it outside a world even after
        // a sharp departure turn or a long frame, where it can cut inside the planned arc.
        for (const obstacle of options.obstacles) {
          clearanceOffset.copy(camera.position).sub(obstacle.position);
          const clearance = obstacle.radius + 0.8;
          if (clearanceOffset.lengthSq() < clearance * clearance) {
            if (clearanceOffset.lengthSq() < 0.000001) clearanceOffset.set(0, 1, 0);
            camera.position.copy(obstacle.position).addScaledVector(clearanceOffset.normalize(), clearance);
          }
        }
        // Track just ahead of the craft, keeping the whole X-wing in a narrow viewport.
        cameraUp.set(0, 1, 0).applyQuaternion(cameraFacing);
        lookTarget
          .copy(ship.position)
          .addScaledVector(cameraUp, shipHeight)
          .addScaledVector(
            tangent,
            shipDistance * Math.min(0.15, camera.aspect * 0.2),
          );
        lookMatrix.lookAt(camera.position, lookTarget, cameraUp);
        aim.setFromRotationMatrix(lookMatrix);
        camera.quaternion.copy(aim);
        camera.quaternion.slerp(identity, settle * settle);
        const fov = baseFov + flight.power * 2.5 * (1 - settle);
        if (Math.abs(camera.fov - fov) > 0.001) {
          camera.fov = fov;
          camera.updateProjectionMatrix();
        }
      }
      if (t >= 1) {
        camera.position.copy(goalCamera);
        camera.quaternion.identity();
        camera.fov = baseFov;
        camera.updateProjectionMatrix();
        ship.position.copy(goalShip);
        ship.quaternion.copy(bodyBase);
        flight.power = 0;
        flight.completed = true;
      }
    },
  };
  return flight;
}
