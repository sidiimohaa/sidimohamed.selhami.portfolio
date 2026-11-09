import * as THREE from "three";
import type { FlightState } from "../SpaceScene";
import { createKonami, isTextEntry } from "./konami";
import { horizonFrame, smooth } from "./timeline";
import { createBlackHole, createGravityPass } from "./blackHole";
import { createHorizonAudio } from "./audio";
import { captureInterface } from "./domGravity";
import { captureWorld } from "./worldGravity";
import styles from "./EventHorizon.module.css";

type Options = {
  scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer;
  host: HTMLElement; state: () => FlightState; onActive: (active: boolean) => void;
  releaseControls: () => void;
};
const phaseNames = { anomaly: "01 / L’ANOMALIE", birth: "02 / THE SINGULARITY", infall: "03 / POINT OF NO RETURN", void: "04 / LE NÉANT", rebirth: "05 / LA RENAISSANCE" };

export function createEventHorizon({ scene, camera, renderer, host, state, onActive, releaseControls }: Options) {
  const root = host.closest<HTMLElement>(".experience") ?? host;
  const overlay = document.createElement("div");
  overlay.className = `${styles.overlay} ${styles.letterbox}`;
  overlay.dataset.eventHorizon = "true";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Event Horizon — cinématique secrète");
  overlay.innerHTML = `<div class="${styles.shade}" data-shade></div><div class="${styles.flash}" data-flash></div>
    <div class="${styles.top}"><p class="${styles.eyebrow}">ORBITAL / EVENT HORIZON<span>CLASSIFIED DEEP SPACE PHENOMENON</span></p><button type="button" class="${styles.skip}" data-skip>PASSER <span aria-hidden="true">[ ÉCHAP ]</span></button></div>
    <div class="${styles.caption}"><p class="${styles.phase}" data-phase-label></p><h2 class="${styles.message}" data-message aria-live="polite" aria-atomic="true"></h2><p class="${styles.readout}" data-readout></p></div>
    <div class="${styles.progress}" aria-hidden="true"><i data-progress></i></div>`;
  root.appendChild(overlay);
  const skip = overlay.querySelector<HTMLButtonElement>("[data-skip]")!;
  const shade = overlay.querySelector<HTMLElement>("[data-shade]")!;
  const flash = overlay.querySelector<HTMLElement>("[data-flash]")!;
  const message = overlay.querySelector<HTMLElement>("[data-message]")!;
  const phaseLabel = overlay.querySelector<HTMLElement>("[data-phase-label]")!;
  const readout = overlay.querySelector<HTMLElement>("[data-readout]")!;
  const progress = overlay.querySelector<HTMLElement>("[data-progress]")!;
  const hole = createBlackHole(state().quality === "lite" || state().quality === "eco");
  scene.add(hole.group);
  const pass = createGravityPass();
  const konami = createKonami();
  const center = new THREE.Vector3(), axis = new THREE.Vector3(), projected = new THREE.Vector3(), size = new THREE.Vector2();
  const dolly = new THREE.Vector3(), roll = new THREE.Quaternion();
  let running = false, disposed = false, began = 0, lastDraw = -Infinity, lastMessage = "";
  let reduced = false;
  let previousFocus: HTMLElement | null = null;
  let interfaceSnapshot: ReturnType<typeof captureInterface> | null = null;
  let worldSnapshot: ReturnType<typeof captureWorld> | null = null;
  let audio: ReturnType<typeof createHorizonAudio> = null;
  let cameraSnapshot: { position: THREE.Vector3; rotation: THREE.Quaternion; fov: number; zoom: number } | null = null;
  const eligible = () => {
    const s = state();
    return !disposed && !running && s.singularityEligible && s.flying && !s.hidden && !s.paused && !s.travel && !document.hidden && host.isConnected && !renderer.getContext().isContextLost()
      && !document.querySelector('[role="dialog"]:not([data-event-horizon]), .rank-cinematic, .holo-transmission, .reward-scene, .arcade-game, .arcade, .death-star-station, .coruscant-taxi, .droid-conversation');
  };
  const finish = () => {
    if (!running) return;
    running = false;
    konami.reset();
    // Teardown is shared by completion, Skip, visibility loss, context loss and unmount.
    // Restore first, then hand control back to React and the existing flight loop.
    audio?.dispose(); audio = null;
    worldSnapshot?.restore(); worldSnapshot = null;
    interfaceSnapshot?.restore(); interfaceSnapshot = null;
    if (cameraSnapshot) {
      camera.position.copy(cameraSnapshot.position); camera.quaternion.copy(cameraSnapshot.rotation);
      camera.fov = cameraSnapshot.fov; camera.zoom = cameraSnapshot.zoom;
      camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    }
    cameraSnapshot = null;
    hole.group.visible = false;
    renderer.setRenderTarget(null);
    overlay.hidden = true;
    root.removeAttribute("data-singularity");
    releaseControls();
    onActive(false);
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
  };
  const start = () => {
    if (!eligible()) return false;
    running = true;
    reduced = state().reduced;
    began = performance.now(); lastDraw = -Infinity; lastMessage = "";
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cameraSnapshot = { position: camera.position.clone(), rotation: camera.quaternion.clone(), fov: camera.fov, zoom: camera.zoom };
    center.set(0, 1.5, -95).applyQuaternion(cameraSnapshot.rotation).add(cameraSnapshot.position);
    axis.set(0, 0, 1).applyQuaternion(cameraSnapshot.rotation);
    hole.group.position.copy(center);
    hole.group.quaternion.copy(cameraSnapshot.rotation);
    hole.group.scale.setScalar(0.0001);
    worldSnapshot = captureWorld(scene, hole.group);
    try {
      interfaceSnapshot = captureInterface(root, overlay);
      if (state().singularitySound) {
        try { audio = createHorizonAudio(); } catch { audio = null; }
      }
      root.dataset.singularity = "active";
      overlay.dataset.reduced = String(reduced);
      overlay.hidden = false;
      releaseControls();
      onActive(true);
      skip.focus({ preventScroll: true });
      return true;
    } catch (error) {
      finish();
      console.error("Event Horizon: restoration after initialization failure", error);
      return false;
    }
  };
  const keydown = (event: KeyboardEvent) => {
    if (running) {
      event.stopImmediatePropagation();
      if (event.key === "Escape") { event.preventDefault(); finish(); }
      else if (event.key === "Tab") { event.preventDefault(); skip.focus({ preventScroll: true }); }
      else if (!["Enter", " "].includes(event.key) && !event.ctrlKey && !event.metaKey) event.preventDefault();
      return;
    }
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.composedPath().some(isTextEntry)) { konami.reset(); return; }
    if (event.repeat) return;
    if (konami.feed(event.key, performance.now(), eligible()) && start()) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  };
  const interrupt = () => { if (document.hidden) finish(); konami.reset(); };
  const blur = () => konami.reset();
  const contextLost = () => finish();
  skip.addEventListener("click", finish);
  window.addEventListener("keydown", keydown, true);
  window.addEventListener("blur", blur);
  window.addEventListener("pagehide", finish);
  document.addEventListener("visibilitychange", interrupt);
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  return {
    get active() { return running; },
    observeEligibility() { if (!running && !eligible()) konami.reset(); },
    prepare() {
      if (disposed) return;
      hole.group.visible = true;
      const compilation = renderer.compileAsync(scene, camera);
      hole.group.visible = false;
      void compilation.catch(() => undefined);
      void renderer.compileAsync(pass.scene, pass.camera).catch(() => undefined);
    },
    tick(now: number) {
      if (!running || !cameraSnapshot) return;
      const s = state();
      if (s.hidden || s.travel || !s.flying || (!reduced && s.reduced)) { finish(); return; }
      const seconds = (now - began) / 1000;
      const frame = horizonFrame(seconds, reduced);
      if (frame.done) { finish(); return; }
      if (now - lastDraw < (s.quality === "lite" ? 66 : s.quality === "eco" ? 33 : 0)) return;
      lastDraw = now;
      try {
        const { collapse, birth, rebuild } = frame;
        camera.position.copy(cameraSnapshot.position);
        camera.quaternion.copy(cameraSnapshot.rotation);
        camera.fov = cameraSnapshot.fov;
        if (!reduced) {
          const dive = smooth(0.28, 1, frame.pull) * (frame.phase === "rebirth" ? 1 - rebuild : 1);
          dolly.copy(center).sub(cameraSnapshot.position).multiplyScalar(dive * 0.985);
          camera.position.add(dolly);
          camera.position.x += Math.sin(seconds * 7.1) * frame.pressure * 0.025 * (1 - frame.pull);
          camera.position.y += Math.sin(seconds * 8.3) * frame.pressure * 0.018 * (1 - frame.pull);
          roll.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(seconds * 0.38) * 0.025 * frame.pressure + dive * 0.16);
          camera.quaternion.multiply(roll);
          camera.fov += (Math.sin(frame.pull * Math.PI) * 17 - dive * 12) * (1 - rebuild);
        }
        camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
        worldSnapshot!.update(collapse, center, axis, seconds, reduced);
        const holeSize = (5.2 * birth + frame.pull * 6.5) * (1 - rebuild);
        hole.group.scale.setScalar(Math.max(0.0001, holeSize));
        hole.group.visible = birth > 0 && frame.phase !== "void" && rebuild < 0.999;
        hole.update(seconds, birth * (1 - rebuild), reduced);
        projected.copy(center).project(camera);
        const cx = projected.x * 0.5 + 0.5, cy = -projected.y * 0.5 + 0.5;
        interfaceSnapshot!.update(collapse, cx, cy, reduced ? 0 : seconds, reduced);
        renderer.getSize(size);
        const ratio = Math.min(renderer.getPixelRatio(), s.quality === "lite" ? 0.65 : s.quality === "eco" ? 1 : 1.5, 1920 / size.x, 1200 / size.y);
        const w = Math.max(1, Math.round(size.x * ratio)), h = Math.max(1, Math.round(size.y * ratio));
        if (pass.target.width !== w || pass.target.height !== h) pass.target.setSize(w, h);
        const u = pass.uniforms;
        u.center.value.set(cx, 1 - cy); u.aspect.value = camera.aspect;
        u.radius.value = holeSize / Math.max(0.2, camera.position.distanceTo(center)) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
        u.lens.value = birth * (1 - rebuild); u.time.value = seconds;
        u.pull.value = reduced ? 0 : collapse;
        u.anomaly.value = reduced ? 0 : frame.pressure;
        u.fade.value = reduced ? collapse : frame.blackout;
        renderer.setRenderTarget(pass.target); renderer.render(scene, camera);
        renderer.setRenderTarget(null); renderer.render(pass.scene, pass.camera);
        overlay.dataset.phase = frame.phase;
        overlay.style.setProperty("--horizon-bars", String(smooth(0, 1.8, seconds) * (1 - smooth(frame.duration - 1.2, frame.duration, seconds))));
        phaseLabel.textContent = phaseNames[frame.phase];
        if (lastMessage !== frame.message) { message.textContent = frame.message; lastMessage = frame.message; }
        readout.textContent = frame.phase === "rebirth" ? "SIGNAL RESTORED · FLIGHT RECORD INTACT"
          : `GRAVITY ${(1 + frame.pressure * 8 + frame.pull * 990).toFixed(2)} G  /  HULL ${Math.max(0, 100 - collapse * 100).toFixed(0)}%  /  T+${seconds.toFixed(1).padStart(4, "0")}`;
        shade.style.opacity = String(frame.blackout);
        flash.style.opacity = String(frame.flash);
        progress.style.transform = `scaleX(${seconds / frame.duration})`;
        audio?.update(frame);
      } catch (error) {
        finish();
        console.error("Event Horizon: restored after rendering failure", error);
      }
    },
    dispose() {
      finish(); disposed = true;
      window.removeEventListener("keydown", keydown, true);
      window.removeEventListener("blur", blur);
      window.removeEventListener("pagehide", finish);
      document.removeEventListener("visibilitychange", interrupt);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      skip.removeEventListener("click", finish);
      overlay.remove(); hole.dispose(); pass.dispose();
    },
  };
}
