import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { getBridgeSettings, guessQuality, softwareRendering, type QualityId } from "../graphicsQuality";
import type { Grade } from "./looks";

// The surface scenes' render pipeline. The scene is drawn into an off-screen target exactly as it
// was drawn on screen (tone mapped and encoded, so the many hand-written shaders that output final
// colours look the same), then:
//   tier 1 (Moyen)  multisampled target, colour grade, vignette and dithering;
//   tier 2 (Élevé)  + a soft bloom on what is truly bright (lamps, screens, sun glints);
//   tier 3 (Ultra)  + ground-truth ambient occlusion, at half resolution.
// Tier 0 (Économie, Minimal) draws straight to the screen, as before.
// Interfaces are HTML above the canvas and are never touched by any of this.

export type Tier = 0 | 1 | 2 | 3;

export const tierOf = (quality: QualityId): Tier =>
  quality === "ultra" ? 3 : quality === "high" ? 2 : quality === "medium" ? 1 : 0;

/** The tier the visitor's graphics setting asks for; ?fx=off draws the scene as it was before. */
export function chosenTier(): Tier {
  if (typeof window === "undefined") return 0;
  try {
    const fx = new URLSearchParams(window.location.search).get("fx");
    if (fx === "off") return 0;
    if (fx && /^[0-3]$/.test(fx)) return Number(fx) as Tier;
  } catch {
    // No address to read: use the setting.
  }
  if (softwareRendering()) return 0;
  const { quality } = getBridgeSettings();
  return tierOf(quality === "auto" ? guessQuality() : quality);
}

const vertexShader = /* glsl */ `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;

// Bloom, in three small passes: keep only what is brighter than the threshold while shrinking the
// frame to a quarter, blur it there, then once more at an eighth for a wider halo.
const prefilterShader = /* glsl */ `
  uniform sampler2D tDiffuse; uniform vec2 texel; uniform float threshold; varying vec2 vUv;
  // Values are display-referred (0 to 1), so "bright" means close to white: a smooth ramp from the
  // threshold up to full brightness, weighted by the brightest channel so coloured lamps count.
  vec3 bright(vec3 c){float l=max(c.r,max(c.g,c.b));return c*smoothstep(threshold,1.0,l);}
  void main(){
    vec3 c=bright(texture2D(tDiffuse,vUv+texel*vec2(-1.0,-1.0)).rgb)+bright(texture2D(tDiffuse,vUv+texel*vec2(1.0,-1.0)).rgb)
          +bright(texture2D(tDiffuse,vUv+texel*vec2(-1.0,1.0)).rgb)+bright(texture2D(tDiffuse,vUv+texel*vec2(1.0,1.0)).rgb);
    gl_FragColor=vec4(c*0.25,1.0);
  }`;
const blurShader = /* glsl */ `
  uniform sampler2D tDiffuse; uniform vec2 direction; varying vec2 vUv;
  void main(){
    // Nine-tap Gaussian in five bilinear fetches.
    vec3 c=texture2D(tDiffuse,vUv).rgb*0.2270270270;
    c+=texture2D(tDiffuse,vUv+direction*1.3846153846).rgb*0.3162162162;
    c+=texture2D(tDiffuse,vUv-direction*1.3846153846).rgb*0.3162162162;
    c+=texture2D(tDiffuse,vUv+direction*3.2307692308).rgb*0.0702702703;
    c+=texture2D(tDiffuse,vUv-direction*3.2307692308).rgb*0.0702702703;
    gl_FragColor=vec4(c,1.0);
  }`;

const gradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    bloomNear: { value: null as THREE.Texture | null },
    bloomFar: { value: null as THREE.Texture | null },
    bloomStrength: { value: 0 },
    bloomRadius: { value: 0.4 },
    lift: { value: new THREE.Vector3() },
    gamma: { value: new THREE.Vector3(1, 1, 1) },
    gain: { value: new THREE.Vector3(1, 1, 1) },
    shadowTint: { value: new THREE.Vector3() },
    highlightTint: { value: new THREE.Vector3() },
    contrast: { value: 1 },
    saturation: { value: 1 },
    vignette: { value: 0 },
    aspect: { value: 1 },
  },
  vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse, bloomNear, bloomFar;
    uniform float bloomStrength, bloomRadius;
    uniform vec3 lift, gamma, gain, shadowTint, highlightTint;
    uniform float contrast, saturation, vignette, aspect;
    varying vec2 vUv;
    const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      #ifdef BLOOM
        vec3 glow = mix(texture2D(bloomNear, vUv).rgb, texture2D(bloomFar, vUv).rgb, bloomRadius);
        // Screen blend: the glow brightens without ever clipping what is already white.
        c = 1.0 - (1.0 - c) * (1.0 - glow * bloomStrength * 2.0);
      #endif
      float l = dot(c, LUMA);
      // Split toning: one colour into the shadows, another into the highlights.
      c += shadowTint * (1.0 - smoothstep(0.0, 0.5, l)) + highlightTint * smoothstep(0.45, 1.0, l);
      // Contrast around middle grey, then lift / gamma / gain.
      c = (c - 0.5) * contrast + 0.5;
      c = gain * (c + lift * (1.0 - c));
      c = pow(max(c, 0.0), 1.0 / gamma);
      l = dot(c, LUMA);
      c = mix(vec3(l), c, saturation);
      vec2 d = vUv - 0.5;
      d.x *= aspect;
      c *= 1.0 - vignette * smoothstep(0.35, 1.0, length(d));
      // Dithering hides banding in fog and sky gradients.
      float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      c += (n - 0.5) / 255.0;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export type Pipeline = {
  tier: () => Tier;
  setTier: (tier: Tier) => void;
  setSize: (width: number, height: number) => void;
  setGrade: (grade: Grade) => void;
  render: () => void;
  dispose: () => void;
};

export function createPipeline(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, grade: Grade, initial: Tier): Pipeline {
  let tier: Tier = initial,
    width = 1,
    height = 1;
  // A target the renderer treats like the screen: tone mapping and sRGB encoding are applied as
  // they are for the canvas, and the 8-bit storage keeps the encoded values unchanged.
  const makeTarget = (samples: number) => {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType, samples, depthBuffer: true });
    target.texture.colorSpace = THREE.SRGBColorSpace;
    // Plain 8-bit storage for the texture and its multisampled buffer alike: the values written
    // are already encoded, and an sRGB format would encode them a second time.
    target.texture.internalFormat = "RGBA8";
    (target as THREE.WebGLRenderTarget & { isXRRenderTarget: boolean }).isXRRenderTarget = true;
    return target;
  };
  const capable = renderer.capabilities.isWebGL2;
  const sceneTarget = makeTarget(capable ? 4 : 0);
  const spare = makeTarget(0);
  // Small buffers for the bloom: a quarter and an eighth of the frame, two of each for the blur.
  const glowTarget = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  const near = [glowTarget(), glowTarget()],
    far = [glowTarget(), glowTarget()];
  const material = new THREE.ShaderMaterial({ ...gradeShader, uniforms: THREE.UniformsUtils.clone(gradeShader.uniforms), depthTest: false, depthWrite: false });
  const prefilter = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: 0.9 } },
    vertexShader,
    fragmentShader: prefilterShader,
    depthTest: false,
    depthWrite: false,
  });
  const blur = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, direction: { value: new THREE.Vector2() } },
    vertexShader,
    fragmentShader: blurShader,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new FullScreenQuad(material);
  let ao: GTAOPass | null = null;
  // The occlusion pass redraws everything as plain opaque surfaces: a glow sprite, a shaft of light
  // or a leaf cut out of a card would become a solid black quad. Only what fills its shape takes part.
  const seeThrough = (surface: THREE.Material) =>
    surface.transparent || !surface.depthWrite || surface.alphaTest > 0 || surface.blending !== THREE.NormalBlending;
  // Small props darken nothing that can be seen at half resolution, and each one is another draw.
  const tooSmall = (mesh: THREE.Mesh) => {
    if (mesh instanceof THREE.InstancedMesh) return false;
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    return mesh.geometry.boundingSphere!.radius * mesh.matrixWorld.getMaxScaleOnAxis() < 0.18;
  };
  const leftOut: THREE.Object3D[] = [];
  const renderOcclusion = (pass: GTAOPass, into: THREE.WebGLRenderTarget, from: THREE.WebGLRenderTarget) => {
    scene.traverseVisible((object) => {
      const surface = (object as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (object instanceof THREE.Sprite || (surface && (Array.isArray(surface) ? surface.some(seeThrough) : seeThrough(surface))) || ((object as THREE.Mesh).isMesh && tooSmall(object as THREE.Mesh))) {
        object.visible = false;
        leftOut.push(object);
      }
    });
    pass.render(renderer, into, from, 0, false);
    leftOut.forEach((object) => (object.visible = true));
    leftOut.length = 0;
  };
  const sizeOf = () => {
    const ratio = renderer.getPixelRatio();
    return [Math.max(1, Math.floor(width * ratio)), Math.max(1, Math.floor(height * ratio))] as const;
  };
  const setGrade = (next: Grade) => {
    grade = next;
    const u = material.uniforms;
    u.lift.value.set(...next.lift);
    u.gamma.value.set(...next.gamma);
    u.gain.value.set(...next.gain);
    u.shadowTint.value.set(...next.shadowTint);
    u.highlightTint.value.set(...next.highlightTint);
    u.contrast.value = next.contrast;
    u.saturation.value = next.saturation;
    u.vignette.value = next.vignette;
    u.bloomStrength.value = next.bloomStrength;
    u.bloomRadius.value = next.bloomRadius;
    prefilter.uniforms.threshold.value = next.bloomThreshold;
    ao?.updateGtaoMaterial({ radius: next.aoRadius, distanceExponent: 1.4, thickness: 1, scale: 1, samples: 8 });
    if (ao) ao.blendIntensity = next.aoStrength;
  };
  // Effects are built when a tier first needs them and released when it no longer does.
  const build = () => {
    const [w, h] = sizeOf();
    const bloom = tier >= 2;
    if (!!material.defines.BLOOM !== bloom) {
      if (bloom) material.defines.BLOOM = "";
      else delete material.defines.BLOOM;
      material.needsUpdate = true;
    }
    if (tier >= 3 && !ao && camera instanceof THREE.PerspectiveCamera) {
      ao = new GTAOPass(scene, camera, Math.ceil(w / 2), Math.ceil(h / 2));
      ao.output = GTAOPass.OUTPUT.Default;
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 8 });
    }
    if (tier < 3 && ao) {
      ao.dispose();
      ao = null;
    }
    setGrade(grade);
  };
  const resize = () => {
    const [w, h] = sizeOf();
    sceneTarget.setSize(w, h);
    spare.setSize(w, h);
    near.forEach((target) => target.setSize(Math.max(1, Math.ceil(w / 4)), Math.max(1, Math.ceil(h / 4))));
    far.forEach((target) => target.setSize(Math.max(1, Math.ceil(w / 8)), Math.max(1, Math.ceil(h / 8))));
    ao?.setSize(Math.ceil(w / 2), Math.ceil(h / 2));
    material.uniforms.aspect.value = w / Math.max(h, 1);
  };
  const pass = (shader: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
    quad.material = shader;
    renderer.setRenderTarget(target);
    quad.render(renderer);
  };
  const blurInto = (pair: THREE.WebGLRenderTarget[], source: THREE.Texture) => {
    const [a, b] = pair;
    blur.uniforms.tDiffuse.value = source;
    blur.uniforms.direction.value.set(1 / a.width, 0);
    pass(blur, b);
    blur.uniforms.tDiffuse.value = b.texture;
    blur.uniforms.direction.value.set(0, 1 / a.height);
    pass(blur, a);
  };
  build();
  return {
    tier: () => tier,
    setTier: (next) => {
      if (next === tier) return;
      tier = next;
      build();
      resize();
    },
    setSize: (w, h) => {
      width = w;
      height = h;
      resize();
    },
    setGrade,
    render: () => {
      if (tier === 0) {
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
        return;
      }
      // The pixel ratio may have changed under adaptive quality.
      const [w, h] = sizeOf();
      if (sceneTarget.width !== w || sceneTarget.height !== h) resize();
      renderer.setRenderTarget(sceneTarget);
      renderer.render(scene, camera);
      let read: THREE.WebGLRenderTarget = sceneTarget;
      if (ao) {
        renderOcclusion(ao, spare, read);
        read = spare;
      }
      if (tier >= 2) {
        prefilter.uniforms.tDiffuse.value = read.texture;
        prefilter.uniforms.texel.value.set(1 / w, 1 / h);
        // Into near[0]: blurInto draws its first pass into near[1], which must not be its source.
        pass(prefilter, near[0]);
        blurInto(near, near[0].texture);
        blurInto(far, near[0].texture);
        material.uniforms.bloomNear.value = near[0].texture;
        material.uniforms.bloomFar.value = far[0].texture;
      }
      material.uniforms.tDiffuse.value = read.texture;
      pass(material, null);
    },
    dispose: () => {
      sceneTarget.dispose();
      spare.dispose();
      [...near, ...far].forEach((target) => target.dispose());
      ao?.dispose();
      material.dispose();
      prefilter.dispose();
      blur.dispose();
      quad.dispose();
    },
  };
}
