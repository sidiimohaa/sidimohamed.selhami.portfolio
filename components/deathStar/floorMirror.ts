import * as THREE from "three";

// The polished deck of the station as a true mirror: the scene is drawn a second time from below
// the floor, at half resolution, and the floor's own material lays that picture over its shading.
// Light panels, holograms, ships and troopers all stand on their reflections, sharper at grazing
// angles and softened by the floor's roughness, as on the black decks of the films.

export function createFloorMirror(renderer: THREE.WebGLRenderer, scene: THREE.Scene, floor: THREE.MeshStandardMaterial, level = 0) {
  const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true });
  const uniforms = {
    mirrorMap: { value: target.texture },
    mirrorMatrix: { value: new THREE.Matrix4() },
    mirrorStrength: { value: 0 },
    mirrorTexel: { value: new THREE.Vector2(1 / 4, 1 / 4) },
  };
  // Added to whatever the material already does; later hooks (surface detail) chain onto this one.
  const previous = floor.onBeforeCompile;
  floor.onBeforeCompile = (shader, renderer_) => {
    previous.call(floor, shader, renderer_);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform mat4 mirrorMatrix;varying vec4 vMirror;varying float vMirrorLevel;varying float vMirrorUp;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vec4 mirrorWorld = modelMatrix * vec4(transformed, 1.0);
        vMirror = mirrorMatrix * mirrorWorld;
        vMirrorLevel = mirrorWorld.y;
        vMirrorUp = normal.y;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D mirrorMap;uniform float mirrorStrength;uniform vec2 mirrorTexel;varying vec4 vMirror;varying float vMirrorLevel;varying float vMirrorUp;")
      .replace(
        "#include <opaque_fragment>",
        `// Only the walking surface mirrors: the top face of the deck, at its own level.
        if (mirrorStrength > 0.0 && vMirrorUp > 0.9 && abs(vMirrorLevel - ${level.toFixed(3)}) < 0.08) {
          vec2 mirrorAt = vMirror.xy / vMirror.w;
          // Polished, not perfect: the picture spreads a little with the roughness of the plate.
          vec2 spread = mirrorTexel * (1.2 + roughnessFactor * 9.0);
          vec3 mirrored = texture2D(mirrorMap, mirrorAt).rgb * 0.36
            + (texture2D(mirrorMap, mirrorAt + vec2(spread.x, 0.0)).rgb + texture2D(mirrorMap, mirrorAt - vec2(spread.x, 0.0)).rgb
            + texture2D(mirrorMap, mirrorAt + vec2(0.0, spread.y * 2.0)).rgb + texture2D(mirrorMap, mirrorAt - vec2(0.0, spread.y * 2.0)).rgb) * 0.16;
          float grazing = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 3.0);
          // The deck stays black: it shows what shines (lights, holograms, pale hulls) and keeps
          // the dark of the room, a little more of everything at a grazing angle.
          outgoingLight += mirrored * mirrorStrength * (1.0 - roughnessFactor) * mix(0.16, 0.5, grazing);
        }
        #include <opaque_fragment>`,
      );
  };
  floor.customProgramCacheKey = () => `floor-mirror-${level}`;
  floor.needsUpdate = true;

  const virtual = new THREE.PerspectiveCamera();
  const normal = new THREE.Vector3(0, 1, 0),
    origin = new THREE.Vector3(0, level, 0);
  const eye = new THREE.Vector3(),
    view = new THREE.Vector3(),
    ahead = new THREE.Vector3(),
    goal = new THREE.Vector3(),
    rotation = new THREE.Matrix4(),
    plane = new THREE.Plane(),
    clip = new THREE.Vector4(),
    q = new THREE.Vector4(),
    size = new THREE.Vector2();
  // The deck itself is hidden while its reflection is drawn: seen from below it would hide everything.
  let decks: THREE.Object3D[] | null = null;
  const hidden: THREE.Object3D[] = [];
  let enabled = true;
  const envIntensity = floor.envMapIntensity;

  return {
    /** Objects that must not appear in the reflection (glows painted on the floor, for one). */
    hide: (...objects: THREE.Object3D[]) => hidden.push(...objects),
    setEnabled(value: boolean) {
      enabled = value;
      uniforms.mirrorStrength.value = value ? 1 : 0;
      // With a true reflection the studio highlights would count twice.
      floor.envMapIntensity = value ? envIntensity * 0.3 : envIntensity;
    },
    /** Draws the reflection for this frame. Call after the camera has moved, before the scene is drawn. */
    update(camera: THREE.PerspectiveCamera) {
      if (!enabled) return;
      eye.setFromMatrixPosition(camera.matrixWorld);
      // Below the deck there is nothing to mirror.
      if (eye.y <= level + 0.02) return;
      renderer.getDrawingBufferSize(size);
      const width = Math.max(2, Math.round(size.x * 0.5)),
        height = Math.max(2, Math.round(size.y * 0.5));
      if (target.width !== width || target.height !== height) {
        target.setSize(width, height);
        uniforms.mirrorTexel.value.set(1 / width, 1 / height);
      }
      view.subVectors(origin, eye).reflect(normal).negate().add(origin);
      rotation.extractRotation(camera.matrixWorld);
      ahead.set(0, 0, -1).applyMatrix4(rotation).add(eye);
      goal.subVectors(origin, ahead).reflect(normal).negate().add(origin);
      virtual.position.copy(view);
      virtual.up.set(0, 1, 0).applyMatrix4(rotation).reflect(normal);
      virtual.lookAt(goal);
      virtual.far = camera.far;
      virtual.near = camera.near;
      virtual.updateMatrixWorld();
      virtual.projectionMatrix.copy(camera.projectionMatrix);
      uniforms.mirrorMatrix.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(virtual.projectionMatrix).multiply(virtual.matrixWorldInverse);
      // An oblique near plane on the deck: nothing below it is drawn into the reflection.
      plane.setFromNormalAndCoplanarPoint(normal, origin).applyMatrix4(virtual.matrixWorldInverse);
      clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
      const p = virtual.projectionMatrix.elements;
      q.set((Math.sign(clip.x) + p[8]) / p[0], (Math.sign(clip.y) + p[9]) / p[5], -1, (1 + p[10]) / p[14]);
      clip.multiplyScalar(2 / clip.dot(q));
      p[2] = clip.x;
      p[6] = clip.y;
      p[10] = clip.z + 1 - 0.003;
      p[14] = clip.w;

      decks ??= (() => {
        const found: THREE.Object3D[] = [];
        scene.traverse((object) => {
          const material = (object as THREE.Mesh).material;
          if (material === floor || (Array.isArray(material) && material.includes(floor))) found.push(object);
        });
        return found;
      })();
      const shown = [...decks, ...hidden].map((object) => [object, object.visible] as const);
      shown.forEach(([object]) => (object.visible = false));
      const before = renderer.getRenderTarget();
      // The reflection is laid over the floor: it must not also read itself while being drawn.
      uniforms.mirrorStrength.value = 0;
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, virtual);
      renderer.setRenderTarget(before);
      uniforms.mirrorStrength.value = 1;
      shown.forEach(([object, visible]) => (object.visible = visible));
    },
    /** The decks are looked up again (after geometry was merged, or a profile hid part of the decor). */
    refresh: () => (decks = null),
    dispose: () => target.dispose(),
  };
}
