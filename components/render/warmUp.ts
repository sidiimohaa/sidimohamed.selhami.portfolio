import * as THREE from "three";

// Getting a heavy scene ready without freezing the page: its shaders compile in the background, and
// its textures reach the GPU a few at a time, so the first real frame has almost nothing left to do.

/** Hands the main thread back so the browser can draw a frame; never hangs in a hidden tab. */
export const breathe = () =>
  new Promise<void>((resolve) => {
    const go = () => resolve();
    const timer = window.setTimeout(go, 100);
    requestAnimationFrame(() => {
      window.clearTimeout(timer);
      go();
    });
  });

export async function warmUp(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  await Promise.race([renderer.compileAsync(scene, camera).catch(() => undefined), new Promise((resolve) => window.setTimeout(resolve, 5000))]);
  const textures = new Set<THREE.Texture>();
  scene.traverse((object) => {
    const material = (object as THREE.Mesh).material;
    if (!material) return;
    (Array.isArray(material) ? material : [material]).forEach((item) => {
      Object.values(item).forEach((value) => {
        if (value instanceof THREE.Texture && !value.isRenderTargetTexture && !(value as THREE.CubeTexture).isCubeTexture) textures.add(value);
      });
    });
  });
  let sliceStart = performance.now();
  for (const texture of textures) {
    renderer.initTexture(texture);
    if (performance.now() - sliceStart > 10) {
      await breathe();
      sliceStart = performance.now();
    }
  }
}
