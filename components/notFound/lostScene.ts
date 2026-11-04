import * as THREE from "three";
import { createCockpitModel } from "../cockpitModel";
import { createCockpitSystems } from "../cockpitSystems";
import { createStarfield } from "../spaceAmbience";
import { equippedValue, getArcade, type GameResult } from "../arcade/arcadeStore";
import type { ArcadeAudio } from "../arcade/arcadeAudio";
import type { CockpitGameRuntime, CockpitGameView } from "../arcade/cockpitGames";

// The 404's cockpit and starfield, in a module of its own so that three.js loads only on that
// page, once its interface is already on screen.

type Hooks = {
  runtime: { current: CockpitGameRuntime | null };
  audio: { current: ArcadeAudio | null };
  reduced: () => boolean;
  onView: (view: CockpitGameView | null) => void;
  onFinish: (result: GameResult) => void;
};

export type LostScene = { start: () => Promise<void>; stop: () => void; dispose: () => void };

export function createLostScene(el: HTMLElement, hooks: Hooks): LostScene | null {
  const { runtime } = hooks;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 600 ? 1.75 : 2));
  renderer.setClearColor(0x03080e, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.setAttribute("aria-hidden", "true");
  el.append(renderer.domElement);
  const world = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.05, 600);
  const cockpit = createCockpitModel();
  const systems = createCockpitSystems();
  cockpit.add(systems.group);
  const stars = createStarfield(renderer.getPixelRatio());
  world.add(cockpit, stars.points);
  world.add(new THREE.HemisphereLight(0x8da9c9, 0x151b26, 1.5));
  const key = new THREE.DirectionalLight(0xd3c4ad, 2.6);
  key.position.set(-2, 4, 4);
  world.add(key);
  // Warning lights: the cabin glows red until the visitor takes the controls.
  const alert = new THREE.PointLight(0xff4a3a, 4, 7, 2);
  alert.position.set(0, 2.2, 1.2);
  world.add(alert);
  const fill = new THREE.PointLight(0x709cc6, 4, 7, 2);
  fill.position.set(1.6, 2.2, 1.4);
  world.add(fill);
  const eye = new THREE.Vector3(0, 1.55, 2.9),
    look = new THREE.Vector3(0, 1.35, -3.4);
  const resize = () => {
    const w = el.clientWidth || window.innerWidth,
      h = el.clientHeight || window.innerHeight;
    camera.aspect = w / Math.max(h, 1);
    if (!runtime.current) camera.fov = camera.aspect < 0.8 ? 58 : 52;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(el);
  resize();
  let generation = 0,
    removed = false;
  let frame = 0,
    last = performance.now(),
    age = 0;
  const animate = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    age += dt;
    const still = hooks.reduced();
    // At rest the cockpit drifts a little; in the game the runtime moves the ship.
    camera.position.set(still || runtime.current ? 0 : Math.sin(age * 0.4) * 0.03, eye.y, eye.z);
    camera.lookAt(look);
    camera.updateMatrixWorld();
    alert.intensity = runtime.current ? 0 : still ? 2 : 2 + Math.max(0, Math.sin(age * 4)) * 4;
    systems.tick(age, 0, still);
    stars.tick(age, still);
    runtime.current?.tick(dt, still);
    renderer.render(world, camera);
    frame = requestAnimationFrame(animate);
  };
  frame = requestAnimationFrame(animate);
  return {
    start: async () => {
      const token = ++generation;
      const module = await import("../arcade/cockpitGames");
      if (removed || token !== generation) return;
      runtime.current?.dispose();
      runtime.current = module.createCockpitGame({
        kind: "asteroid-survival",
        scene: world,
        camera,
        reduced: hooks.reduced(),
        audio: hooks.audio.current,
        trail: equippedValue(getArcade(), "engine"),
        onView: hooks.onView,
        onFinish: hooks.onFinish,
      });
    },
    stop: () => {
      generation++;
      runtime.current?.dispose();
      runtime.current = null;
      hooks.onView(null);
      resize();
    },
    dispose: () => {
      removed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      runtime.current?.dispose();
      runtime.current = null;
      world.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material;
        if (material) (Array.isArray(material) ? material : [material]).forEach((item) => item.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
