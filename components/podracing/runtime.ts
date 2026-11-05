import * as THREE from "three";
import { createStage, type Stage } from "../jedi/stage";
import type { Tier } from "../render/pipeline";
import { createPodAudio } from "./audio";
import { createPodSimulation } from "./simulation";
import { createPodWorld } from "./world";
import { neutralInput, type GhostFrame, type PodInput, type PodRaceState, type PodResult, type PodStage, type PodStageOptions, type PodVehicle } from "./types";

type Callbacks = { onState: (state: PodRaceState) => void; onFinish: (result: PodResult) => void };

function snapshotVehicle(vehicle: PodVehicle): PodVehicle {
  return { ...vehicle, heat: [...vehicle.heat], health: [...vehicle.health] };
}

export function mountPodRace(mount: HTMLElement, options: PodStageOptions, callbacks: Callbacks): PodStage | null {
  const sim = createPodSimulation(options);
  const track = options.track;
  let disposed = false;
  let paused = false;
  let input: PodInput = neutralInput;
  let cameraMode: "chase" | "cockpit" = "chase";
  let quality: "auto" | "low" | "high" = "auto";
  const small = matchMedia("(pointer: coarse)").matches || mount.clientWidth < 650;
  let detail: "low" | "high" = small ? "low" : "high";
  let elapsed = 0;
  let slow = 0;
  let hudClock = 0;
  let announced = false;
  let initializedCamera = false;
  let audio: ReturnType<typeof createPodAudio> = null;
  let sound = options.sound;
  const eye = new THREE.Vector3();
  const focus = new THREE.Vector3();
  const smoothFocus = new THREE.Vector3();
  const pivot = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const replay = options.ghost ?? [];
  let replayIndex = 0;
  const ghost: GhostFrame = { time: 0, distance: 0, lane: 0 };
  let world: ReturnType<typeof createPodWorld> | null = null;

  const placeCamera = (camera: THREE.PerspectiveCamera, dt: number) => {
    const state = sim.state;
    const player = state.player;
    const frame = track.sample(player.distance);
    forward.set(Math.sin(frame.heading), 0, Math.cos(frame.heading));
    right.set(Math.cos(frame.heading), 0, -Math.sin(frame.heading));
    pivot.set(frame.x, frame.y + 2.4, frame.z).addScaledVector(right, player.lane);
    const speed = Math.min(1, player.speed / 155);
    const portrait = camera.aspect < .8;
    const cockpit = cameraMode === "cockpit";
    const end = state.phase === "finished" || state.phase === "wrecked";
    const cinematic = !options.reduced && !cockpit && state.phase === "countdown";
    eye.copy(pivot);
    if (cockpit) {
      eye.addScaledVector(forward, -1.15);
      eye.y += 1.16;
    } else {
      const pullback = (portrait ? 19 : 15) + speed * 3 + (player.boosting ? 3 : 0);
      eye.addScaledVector(forward, -pullback);
      eye.y += (portrait ? 8.4 : 6.3) + speed * 1.5;
      if (cinematic) {
        const slide = THREE.MathUtils.smoothstep(state.countdown / 3, 0, 1);
        eye.addScaledVector(right, -slide * 13);
        eye.addScaledVector(forward, slide * 5);
      }
      if (end && !options.reduced) eye.addScaledVector(right, Math.sin(elapsed * .65) * 4);
    }
    const ahead = track.sample(player.distance + (cockpit ? 36 : 27) + speed * 32);
    focus.set(ahead.x, ahead.y + (cockpit ? 2.6 : 3.1), ahead.z);
    focus.addScaledVector(right, player.lane * (cockpit ? .72 : .6));
    if (!options.reduced && player.hit > .02) {
      eye.y += Math.sin(elapsed * 71) * player.hit * .26;
      eye.addScaledVector(right, Math.sin(elapsed * 55) * player.hit * .32);
    }
    const blend = initializedCamera ? 1 - Math.exp(-(cockpit ? 18 : 10) * dt) : 1;
    camera.position.lerp(eye, blend);
    smoothFocus.lerp(focus, blend);
    camera.lookAt(smoothFocus);
    if (!options.reduced) camera.rotateZ(-player.roll * (cockpit ? .35 : .21));
    const baseFov = cockpit ? (portrait ? 85 : 72) : portrait ? 77 : 58;
    const fov = baseFov + (options.reduced ? 0 : speed * 7 + (player.boosting ? 7 : 0));
    camera.fov = THREE.MathUtils.damp(camera.fov, fov, 6, dt);
    camera.updateProjectionMatrix();
    initializedCamera = true;
  };

  const stage: Stage | null = createStage(mount, (dt) => {
    if (disposed || !world || !stage) return;
    const inactive = paused || document.hidden;
    const step = inactive ? 0 : dt;
    elapsed += step;
    if (step) {
      sim.step(step, input);
      const events = sim.drainEvents();
      for (const event of events) audio?.event(event);
    }
    const state = sim.state;
    let currentGhost: GhostFrame | undefined;
    if (replay.length > 1 && state.phase !== "countdown") {
      while (replayIndex + 1 < replay.length - 1 && replay[replayIndex + 1].time <= state.time) replayIndex++;
      const a = replay[replayIndex], b = replay[replayIndex + 1];
      const t = THREE.MathUtils.clamp((state.time - a.time) / Math.max(.001, b.time - a.time), 0, 1);
      ghost.distance = THREE.MathUtils.lerp(a.distance, b.distance, t);
      ghost.lane = THREE.MathUtils.lerp(a.lane, b.lane, t);
      ghost.time = state.time;
      currentGhost = ghost;
    }
    world.update(state, step, options.reduced, currentGhost);
    placeCamera(stage.camera, step);
    audio?.tick(state, inactive || state.phase === "finished" || state.phase === "wrecked");
    if (quality === "auto" && detail === "high" && state.phase === "racing" && step) {
      slow = Math.max(0, slow + (dt > .027 ? dt : -dt * .7));
      if (slow > 1.3) applyQuality("low");
    }
    hudClock += step;
    if (hudClock >= .075 || !announced && (state.phase === "finished" || state.phase === "wrecked")) {
      hudClock = 0;
      callbacks.onState({ ...state, player: snapshotVehicle(state.player), opponents: state.opponents.map(snapshotVehicle), standings: state.standings.map((entry) => ({ ...entry })) });
    }
    if (!announced && (state.phase === "finished" || state.phase === "wrecked")) {
      announced = true;
      const result = sim.result();
      queueMicrotask(() => { if (!disposed) callbacks.onFinish(result); });
    }
  }, { fov: 59, exposure: 1.05, look: track.light === "day" ? "podDay" : track.light === "sunset" ? "podSunset" : "podNight" });
  if (!stage) return null;
  stage.camera.far = 1900;
  // A race needs its frame rate: bloom at most, never ambient occlusion, and only the grade on Eco.
  const chosenTier = stage.pipeline?.tier() ?? 0;
  const applyQuality = (next: "low" | "high") => {
    detail = next;
    stage.pipeline?.setTier(Math.min(chosenTier, next === "high" ? 2 : 1) as Tier);
    stage.renderer.setPixelRatio(Math.min(window.devicePixelRatio, next === "high" ? 1.65 : 1));
    world?.setQuality(next);
  };
  try {
    world = createPodWorld(stage.scene, track, sim.state.opponents, replay.length > 1, options.pod);
    applyQuality(detail);
  } catch {
    stage.dispose();
    return null;
  }
  const enableAudio = () => {
    if (sound && !audio) audio = createPodAudio();
    audio?.setEnabled(sound);
  };
  enableAudio();
  callbacks.onState({ ...sim.state, player: snapshotVehicle(sim.state.player), opponents: sim.state.opponents.map(snapshotVehicle) });
  const release = () => { input = neutralInput; };
  window.addEventListener("blur", release);
  return {
    setInput(next) {
      audio?.resume();
      // Pods face +Z. In the chase view, the model’s local +X is screen left.
      input = { ...next, steer: -next.steer };
    },
    setPaused(next) { paused = next; if (next) release(); },
    setCamera(next) { cameraMode = next; initializedCamera = false; },
    setQuality(next) {
      quality = next;
      slow = 0;
      applyQuality(next === "auto" ? small ? "low" : "high" : next);
    },
    setSound(next) { sound = next; enableAudio(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      window.removeEventListener("blur", release);
      audio?.dispose();
      world?.dispose();
      world = null;
      stage.dispose();
    },
  };
}
