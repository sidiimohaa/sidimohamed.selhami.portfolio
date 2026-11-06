import * as THREE from "three";
import { chosenTier, createPipeline, type Pipeline } from "../render/pipeline";
import { looks, type LookId } from "../render/looks";

// A self-contained Three.js stage for the full-screen reward scenes: renderer, camera, resize,
// frame loop and full disposal. Returns null when WebGL is unavailable.

export type Stage = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  // The post-processing chain, for stages given a look (see render/pipeline).
  pipeline: Pipeline | null;
  // While paused nothing runs or is drawn: for a scene still being built or fully covered.
  pause: (paused: boolean) => void;
  dispose: () => void;
};

export function createStage(mount: HTMLElement, tick: (dt: number, time: number) => void, options: { fov?: number; exposure?: number; look?: LookId; adaptive?: boolean } = {}): Stage | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 700 ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = options.exposure ?? 1;
  renderer.domElement.setAttribute("aria-hidden", "true");
  mount.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(options.fov ?? 50, 1, 0.05, 200);
  const pipeline = options.look ? createPipeline(renderer, scene, camera, looks[options.look].grade, chosenTier()) : null;
  const resize = () => {
    const w = mount.clientWidth || window.innerWidth,
      h = mount.clientHeight || window.innerHeight;
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    pipeline?.setSize(w, h);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(mount);
  resize();
  let frame = 0,
    last = performance.now(),
    time = 0,
    paused = false,
    average = 1 / 60,
    sampled = 0;
  // Automatic quality: a device that keeps missing frames gives up resolution, then post-processing.
  const adapt = (dt: number) => {
    average += (dt - average) * 0.05;
    if (time < 3 || (sampled += dt) < 2.5) return;
    sampled = 0;
    if (average < 1 / 45) return;
    const ratio = renderer.getPixelRatio();
    if (ratio > 1) {
      renderer.setPixelRatio(Math.max(1, ratio - 0.25));
      resize();
    } else if (pipeline && pipeline.tier() > 1) pipeline.setTier(pipeline.tier() === 3 ? 2 : 1);
  };
  const loop = (now: number) => {
    const raw = (now - last) / 1000;
    const dt = Math.min(raw, 0.05);
    last = now;
    if (paused) {
      frame = requestAnimationFrame(loop);
      return;
    }
    time += dt;
    // A single long frame (a panel opening, a shader) says nothing about the device.
    if (options.adaptive && raw < 0.25) adapt(dt);
    tick(dt, time);
    if (pipeline) pipeline.render();
    else renderer.render(scene, camera);
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
  return {
    scene,
    camera,
    renderer,
    pipeline,
    pause: (value) => {
      paused = value;
    },
    dispose: () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      const textures = new Set<THREE.Texture>();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.geometry) return;
        mesh.geometry.dispose();
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => {
          Object.values(material).forEach((value) => value instanceof THREE.Texture && textures.add(value));
          material.dispose();
        });
      });
      textures.forEach((texture) => texture.dispose());
      pipeline?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
