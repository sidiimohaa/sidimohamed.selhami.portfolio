import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createDroidModel } from "./droidModel";

// R-X7's small stage: its own tiny canvas, at most thirty frames a second, stopped whenever it is
// hidden. Everything moves procedurally from a handful of states, blended, with slow noise so no two
// idles are the same. With reduced motion it holds still and only its lights change.

export type DroidState = "idle" | "greeting" | "thinking" | "talking" | "happy" | "confused" | "scanning" | "sleeping" | "waking";

const SHORT: Partial<Record<DroidState, number>> = { greeting: 2.4, happy: 1.9, confused: 1.7, scanning: 3.2, waking: 1.3 };
const shortest = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

export function createDroidStage(canvas: HTMLCanvasElement, options: { reduced: boolean; onContextLost?: () => void }) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const generator = new THREE.PMREMGenerator(renderer),
    room = new RoomEnvironment();
  const environment = generator.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.55;
  generator.dispose();
  room.dispose();
  const key = new THREE.DirectionalLight(0xe8f4ff, 1.5);
  key.position.set(1.6, 2.6, 2.4);
  const rim = new THREE.DirectionalLight(0x58c8ff, 2.2);
  rim.position.set(-2.2, 1.4, -1.8);
  const warm = new THREE.DirectionalLight(0xffa860, 0.5);
  warm.position.set(2.4, 0.2, -0.4);
  scene.add(key, rim, warm);
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 20);
  camera.position.set(-0.25, 1.15, 4.1);
  camera.lookAt(0, 0.66, 0);

  const droid = createDroidModel();
  // Three-quarters on, turned towards the middle of the screen from the right-hand corner.
  droid.root.rotation.y = -0.42;
  scene.add(droid.root);

  const resize = () => {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
  observer?.observe(canvas);

  // Where the pointer is, in the droid's own turning angles.
  const pointer = { yaw: 0, pitch: 0, at: 0 };
  const onPointer = (event: PointerEvent) => {
    const box = canvas.getBoundingClientRect();
    pointer.yaw = Math.atan2(event.clientX - (box.left + box.width / 2), 700) - droid.root.rotation.y;
    pointer.pitch = THREE.MathUtils.clamp((event.clientY - (box.top + box.height / 2)) / 1400, -0.16, 0.2);
    pointer.at = performance.now();
  };
  window.addEventListener("pointermove", onPointer, { passive: true });

  let state: DroidState = "idle",
    age = 0,
    clock = Math.random() * 40,
    glanceAt = 3,
    glance = 0,
    blinkAt = 2,
    active = true,
    frame = 0,
    last = performance.now(),
    drawn = 0,
    dirty = true;
  const pose = { yaw: 0, pitch: 0.06, tilt: 0, lift: 0, lean: 0, roll: 0, eye: 1, sway: 0, sleep: 0 };
  const eyeBase = new THREE.Color(0x7fe6ff),
    eyeTone = new THREE.Color();

  const animate = (now: number) => {
    frame = requestAnimationFrame(animate);
    if (!active || document.hidden) {
      last = now;
      return;
    }
    // Thirty frames a second at most, and far fewer asleep or with reduced motion.
    const budget = options.reduced ? 250 : state === "sleeping" ? 100 : 33;
    if (now - drawn < budget && !dirty) return;
    drawn = now;
    dirty = false;
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    clock += dt;
    age += dt;
    const limit = SHORT[state];
    if (limit && age > limit) {
      state = "idle";
      age = 0;
    }

    let yaw = 0,
      pitch = 0.05,
      tilt = 0,
      lift = 0,
      lean = 0,
      roll = 0,
      eye = 0.78 + Math.sin(clock * 0.9) * 0.08,
      sway = 0.3,
      sleep = 0;
    // Idle: the cursor if it has moved lately, otherwise a look around every few seconds.
    const looking = now - pointer.at < 5000;
    if (clock > glanceAt) {
      glance = (Math.random() - 0.5) * 2.1;
      glanceAt = clock + 2.5 + Math.random() * 6;
    }
    yaw = looking ? THREE.MathUtils.clamp(shortest(pointer.yaw), -1.1, 1.1) : glance;
    if (looking) pitch = pointer.pitch;
    roll = Math.sin(clock * 0.53) * 0.006 + Math.sin(clock * 1.7) * 0.002;
    lift = Math.sin(clock * 1.25) * 0.004;

    if (state === "greeting") {
      const bow = Math.sin(Math.min(age / 1.6, 1) * Math.PI);
      yaw = Math.sin(age * 4.2) * 0.32;
      pitch = -0.04 + bow * 0.16;
      lift = Math.abs(Math.sin(age * 6)) * 0.035 * (1 - age / 2.4);
      eye = 1 + Math.sin(age * 12) * 0.25;
      sway = 1.4;
    } else if (state === "thinking") {
      yaw = Math.sin(clock * 0.8) * 0.3;
      pitch = -0.12;
      tilt = 0.17;
      eye = 0.55 + Math.abs(Math.sin(clock * 5.5)) * 0.65;
      sway = 0.6;
    } else if (state === "talking") {
      yaw *= 0.35;
      yaw += Math.sin(clock * 2.3) * 0.12;
      pitch = 0.02 + Math.sin(clock * 3.1) * 0.025;
      eye = 0.72 + Math.abs(Math.sin(clock * 9) * Math.sin(clock * 3.7)) * 0.6;
      sway = 0.8;
    } else if (state === "happy") {
      yaw = (age / 1.9) * Math.PI * 2 * THREE.MathUtils.smootherstep(age, 0, 1.5);
      lift = Math.abs(Math.sin(age * 8)) * 0.05 * (1 - age / 1.9);
      roll = Math.sin(age * 8) * 0.04;
      eye = 1.25;
      sway = 2;
    } else if (state === "confused") {
      yaw = Math.sin(age * 6.5) * 0.42 * (1 - age / 1.9);
      tilt = -0.2;
      pitch = 0.1;
      eye = Math.sin(age * 13) > 0.2 ? 0.95 : 0.35;
      lean = -0.02;
    } else if (state === "scanning") {
      yaw = Math.sin(age * 1.9) * 0.85;
      pitch = 0.1;
      eye = 1.35;
      sway = 0.5;
    } else if (state === "sleeping") {
      yaw = 0.15;
      pitch = 0.3;
      tilt = 0.07;
      lift = -0.022 + Math.sin(clock * 0.7) * 0.005;
      roll = 0;
      eye = 0.05 + Math.max(0, Math.sin(clock * 0.8)) * 0.14;
      sway = 0;
      sleep = 1;
    } else if (state === "waking") {
      const up = THREE.MathUtils.smoothstep(age, 0, 0.6);
      pitch = 0.3 * (1 - up);
      yaw = Math.sin(age * 7) * 0.2 * (1 - age / 1.3);
      eye = up * (Math.sin(age * 24) > -0.3 ? 1.25 : 0.2);
      sway = 1.2;
    }

    const rate = options.reduced ? 1 : 1 - Math.exp(-dt * (state === "happy" ? 14 : 5.5));
    if (options.reduced) yaw = pitch = tilt = lift = lean = roll = 0;
    pose.yaw += shortest(yaw - pose.yaw) * rate;
    pose.pitch += (pitch - pose.pitch) * rate;
    pose.tilt += (tilt - pose.tilt) * rate;
    pose.lift += (lift - pose.lift) * rate;
    pose.lean += (lean - pose.lean) * rate;
    pose.roll += (roll - pose.roll) * rate;
    pose.eye += (eye - pose.eye) * (1 - Math.exp(-dt * 16));
    pose.sway += (sway - pose.sway) * rate;
    pose.sleep += (sleep - pose.sleep) * (1 - Math.exp(-dt * 2));

    droid.head.rotation.set(pose.pitch, pose.yaw, pose.tilt, "YXZ");
    droid.body.position.y = 0.3 + pose.lift;
    droid.body.rotation.set(pose.lean, 0, pose.roll);
    // The antennas lag behind the head and settle on their own.
    droid.antennas.forEach((antenna, i) => {
      if (options.reduced) return;
      antenna.rotation.z = Math.sin(clock * (3.4 + i) + i) * 0.05 * pose.sway + shortest(yaw - pose.yaw) * 0.25;
      antenna.rotation.x = Math.sin(clock * (2.7 + i * 0.7)) * 0.04 * pose.sway + (pitch - pose.pitch) * 0.6;
    });
    // A blink now and then: the optic narrows for an instant.
    if (clock > blinkAt) blinkAt = clock + 2.4 + Math.random() * 5;
    const blink = !options.reduced && blinkAt - clock > 0 && clock - (blinkAt - (blinkAt - clock)) < 0 ? 1 : Math.abs(blinkAt - clock) < 0.07 ? 0.25 : 1;
    const lit = pose.eye * blink;
    droid.eyeMaterial.color.copy(eyeTone.copy(eyeBase).multiplyScalar(Math.max(lit, 0.06) * (state === "confused" ? 0.8 : 1)));
    droid.eyeGlow.material.opacity = Math.min(0.75, lit * 0.45);
    droid.eyeGlow.scale.setScalar(0.24 + lit * 0.1);
    droid.sensorMaterial.color.setRGB(1, 0.6, 0.23).multiplyScalar(state === "sleeping" ? 0.12 : 0.5 + Math.max(0, Math.sin(clock * 2.1)) * 0.6);
    droid.ledMaterials.forEach((material, i) => {
      const on = Math.sin(clock * (state === "talking" || state === "thinking" ? 11 : 2.2) + i * 2.1) > 0 ? 1 : 0.18;
      material.color.setRGB(0.5 * on, 0.9 * on, 1 * on).multiplyScalar(1 - pose.sleep * 0.9);
    });
    droid.beam.visible = state === "scanning" && !options.reduced;
    droid.beamMaterial.opacity = droid.beam.visible ? Math.min(age * 2, 1) * Math.min((3.2 - age) * 2, 1) * 0.34 : 0;
    (droid.pad.material as THREE.MeshBasicMaterial).opacity = (0.36 + Math.sin(clock * 1.3) * 0.05 + (state === "talking" ? 0.14 : 0)) * (1 - pose.sleep * 0.75);
    (droid.ring.material as THREE.MeshBasicMaterial).opacity = (0.5 + Math.sin(clock * 2.2) * 0.1) * (1 - pose.sleep * 0.8);
    droid.ring.rotation.y = clock * 0.2;
    renderer.render(scene, camera);
  };
  frame = requestAnimationFrame(animate);
  // Development only: to check the stage by hand.
  if (process.env.NODE_ENV !== "production") (window as unknown as { __droidStage?: object }).__droidStage = { renderer, scene, camera, droid, pose, state: () => state };

  const lost = (event: Event) => {
    event.preventDefault();
    options.onContextLost?.();
  };
  canvas.addEventListener("webglcontextlost", lost);

  return {
    setState(next: DroidState) {
      if (next === state && !SHORT[next]) return;
      state = next;
      age = 0;
      dirty = true;
    },
    state: () => state,
    setActive(on: boolean) {
      active = on;
      dirty = true;
    },
    dispose() {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("webglcontextlost", lost);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        (Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []).forEach((material) => {
          (material as THREE.MeshStandardMaterial).map?.dispose();
          material.dispose();
        });
      });
      environment.dispose();
      renderer.dispose();
    },
  };
}
export type DroidStage = ReturnType<typeof createDroidStage>;
