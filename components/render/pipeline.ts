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
  uniform sampler2D tDiffuse; uniform vec2 texel; uniform float threshold; uniform float keep; varying vec2 vUv;
  // Values are display-referred (0 to 1), so "bright" means close to white: a smooth ramp from the
  // threshold up to full brightness, weighted by the brightest channel so coloured lamps count.
  // With keep at 1 the whole frame passes: the same shrink then feeds the out-of-focus copy.
  vec3 bright(vec3 c){float l=max(c.r,max(c.g,c.b));return c*mix(smoothstep(threshold,1.0,l),1.0,keep);}
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

// Open space only: shafts of light from the sun. The blurred bright pass is smeared along the
// line to the sun's place on screen, so a world crossing the sun cuts its own shadow in the light.
const raysShader = /* glsl */ `
  uniform sampler2D tDiffuse; uniform vec2 sun; uniform float aspect; varying vec2 vUv;
  void main(){
    vec2 stride = (vUv - sun) / 22.0;
    vec2 uv = vUv; float decay = 1.0; vec3 sum = vec3(0.0);
    for (int i = 0; i < 22; i++) {
      vec2 q = uv - sun; q.x *= aspect;
      // Only light from around the sun itself is carried: engines and city lights cast no shafts.
      float mask = smoothstep(0.3, 0.03, length(q)) * step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
      sum += texture2D(tDiffuse, uv).rgb * mask * decay;
      decay *= 0.94;
      uv -= stride;
    }
    gl_FragColor = vec4(sum / 22.0, 1.0);
  }`;

/** What open space adds to the grade, frame by frame. Every strength is 0 for "off". */
export type SpaceFx = {
  time: number;
  // Film grain amplitude, in display units.
  grain: number;
  // Lateral colour fringing toward the corners.
  aberration: number;
  // Radial smear from the centre of the frame under boost, 0..1.
  speed: number;
  // The sun's place on screen (0..1) and how much of it counts (0 when behind or far off frame).
  sunX: number;
  sunY: number;
  sun: number;
  rays: number;
  flare: number;
  // Depth of field for the strong moments: everything away from the focus point (0..1 on
  // screen) goes soft, by `dof` (0..1). In space the craft is the only near subject, so a focus
  // disc around it reads as a shallow lens.
  dof: number;
  focusX: number;
  focusY: number;
  focusRadius: number;
};

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
    time: { value: 0 },
    grain: { value: 0 },
    aberration: { value: 0 },
    speed: { value: 0 },
    sun: { value: new THREE.Vector2(0.5, 0.5) },
    sunOn: { value: 0 },
    tRays: { value: null as THREE.Texture | null },
    rays: { value: 0 },
    flare: { value: 0 },
    tSoft: { value: null as THREE.Texture | null },
    dof: { value: 0 },
    focus: { value: new THREE.Vector3(0.5, 0.5, 0.2) },
  },
  vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse, bloomNear, bloomFar;
    uniform float bloomStrength, bloomRadius;
    uniform vec3 lift, gamma, gain, shadowTint, highlightTint;
    uniform float contrast, saturation, vignette, aspect;
    varying vec2 vUv;
    #ifdef SPACE
      uniform sampler2D tRays, tSoft;
      uniform float time, grain, aberration, speed, sunOn, rays, flare, dof;
      uniform vec2 sun;
      uniform vec3 focus;
      // One reflection inside the lens: a soft disc or a thin ring on the line through the centre.
      float ghost(vec2 at, float radius, float ring){
        vec2 q = vUv - at; q.x *= aspect;
        float d = length(q) / radius;
        return mix(smoothstep(1.0, 0.55, d), smoothstep(1.0, 0.86, d) * smoothstep(0.62, 0.86, d), ring);
      }
    #endif
    const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
    void main(){
      #ifdef SPACE
        // Colour fringing grows toward the corners; under boost the frame smears outward.
        vec2 fromCentre = vUv - 0.5;
        float reach = dot(fromCentre, fromCentre);
        vec2 fringe = fromCentre * reach * aberration;
        vec3 c = vec3(texture2D(tDiffuse, vUv + fringe).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - fringe).b);
        if (speed > 0.002) {
          // Four more taps toward the centre: seven fetches in all at full burn.
          vec2 pull = fromCentre * (speed * reach * 0.25);
          c = (c + texture2D(tDiffuse, vUv - pull).rgb + texture2D(tDiffuse, vUv - pull * 2.0).rgb
            + texture2D(tDiffuse, vUv - pull * 3.0).rgb + texture2D(tDiffuse, vUv - pull * 4.0).rgb) * 0.2;
        }
        if (dof > 0.003) {
          vec2 away = vUv - focus.xy; away.x *= aspect;
          c = mix(c, texture2D(tSoft, vUv).rgb, smoothstep(focus.z, focus.z * 2.6, length(away)) * dof);
        }
      #else
        vec3 c = texture2D(tDiffuse, vUv).rgb;
      #endif
      #ifdef BLOOM
        vec3 glow = mix(texture2D(bloomNear, vUv).rgb, texture2D(bloomFar, vUv).rgb, bloomRadius);
        // Screen blend: the glow brightens without ever clipping what is already white.
        c = 1.0 - (1.0 - c) * (1.0 - glow * bloomStrength * 2.0);
        #ifdef SPACE
          if (sunOn > 0.001) {
            // How much of the sun actually shows, read from the wide glow at its own position:
            // a world passing in front dims the shafts and the lens reflections together.
            float seen = sunOn * smoothstep(0.015, 0.16, dot(texture2D(bloomFar, clamp(sun, 0.0, 1.0)).rgb, vec3(0.3333)));
            vec3 light = texture2D(tRays, vUv).rgb * rays * sunOn;
            vec2 axis = vec2(0.5) - sun;
            vec3 lens = vec3(0.45, 0.72, 1.0) * ghost(sun + axis * 0.62, 0.03, 0.0) * 0.1
              + vec3(0.72, 0.52, 1.0) * ghost(sun + axis * 1.32, 0.05, 1.0) * 0.13
              + vec3(0.4, 0.9, 1.0) * ghost(sun + axis * 1.72, 0.02, 0.0) * 0.1
              + vec3(1.0, 0.74, 0.5) * ghost(sun + axis * 2.2, 0.085, 1.0) * 0.1;
            // The anamorphic streak across the sun.
            vec2 q = vUv - sun;
            lens += vec3(0.5, 0.7, 1.0) * exp(-q.y * q.y * 30000.0) * exp(-abs(q.x) * 6.5) * 0.36;
            light += lens * flare * seen;
            c = 1.0 - (1.0 - c) * (1.0 - min(light, 1.0));
          }
        #endif
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
      #ifdef SPACE
        // Film grain: alive in the shadows, almost gone in the highlights.
        float g = fract(sin(dot(gl_FragCoord.xy + fract(time * 0.37) * vec2(311.0, 173.0), vec2(12.9898, 78.233))) * 43758.5453);
        c += (g - 0.5) * grain * (1.0 - 0.7 * dot(c, LUMA));
      #endif
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
  /** Open space only (the `space` option): the per-frame extras. Ignored elsewhere. */
  setFx: (fx: SpaceFx) => void;
  render: () => void;
  dispose: () => void;
};

export function createPipeline(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, grade: Grade, initial: Tier, options: { space?: boolean } = {}): Pipeline {
  const space = !!options.space;
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
  // Open space is mostly sky: two samples smooth the limb of a world as well as four, for half
  // the bandwidth on a full-resolution target.
  const sceneTarget = makeTarget(capable ? (space ? 2 : 4) : 0);
  const spare = makeTarget(0);
  // Small buffers for the bloom: a quarter and an eighth of the frame, two of each for the blur.
  const glowTarget = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  const near = [glowTarget(), glowTarget()],
    far = [glowTarget(), glowTarget()];
  const material = new THREE.ShaderMaterial({ ...gradeShader, uniforms: THREE.UniformsUtils.clone(gradeShader.uniforms), depthTest: false, depthWrite: false });
  if (space) material.defines.SPACE = "";
  // The sun's shafts, at a quarter of the frame like the glow they are drawn from.
  const raysTarget = space ? glowTarget() : null;
  const raysMaterial = space
    ? new THREE.ShaderMaterial({
        uniforms: { tDiffuse: { value: null }, sun: { value: new THREE.Vector2(0.5, 0.5) }, aspect: { value: 1 } },
        vertexShader,
        fragmentShader: raysShader,
        depthTest: false,
        depthWrite: false,
      })
    : null;
  // The out-of-focus copy of the frame: shrunk to a quarter, blurred at an eighth.
  const softQuarter = space ? glowTarget() : null,
    softFar = space ? [glowTarget(), glowTarget()] : null;
  let fx: SpaceFx | null = null;
  const prefilter = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: 0.9 }, keep: { value: 0 } },
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
    raysTarget?.setSize(Math.max(1, Math.ceil(w / 4)), Math.max(1, Math.ceil(h / 4)));
    softQuarter?.setSize(Math.max(1, Math.ceil(w / 4)), Math.max(1, Math.ceil(h / 4)));
    softFar?.forEach((target) => target.setSize(Math.max(1, Math.ceil(w / 8)), Math.max(1, Math.ceil(h / 8))));
    if (raysMaterial) raysMaterial.uniforms.aspect.value = w / Math.max(h, 1);
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
    setFx: (next) => {
      if (!space) return;
      fx = next;
      const u = material.uniforms;
      u.time.value = next.time;
      u.grain.value = next.grain;
      u.aberration.value = next.aberration;
      u.speed.value = next.speed;
      u.sun.value.set(next.sunX, next.sunY);
      u.sunOn.value = next.sun;
      u.rays.value = next.rays;
      u.flare.value = next.flare;
      u.dof.value = next.dof;
      u.focus.value.set(next.focusX, next.focusY, next.focusRadius);
    },
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
      if (softQuarter && softFar) {
        material.uniforms.tSoft.value = softFar[0].texture;
        if (fx && fx.dof > 0.003) {
          prefilter.uniforms.tDiffuse.value = read.texture;
          prefilter.uniforms.texel.value.set(1 / w, 1 / h);
          prefilter.uniforms.keep.value = 1;
          pass(prefilter, softQuarter);
          prefilter.uniforms.keep.value = 0;
          blurInto(softFar, softQuarter.texture);
        }
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
        if (raysTarget && raysMaterial) {
          material.uniforms.tRays.value = raysTarget.texture;
          if (fx && fx.sun > 0.001 && fx.rays > 0) {
            raysMaterial.uniforms.tDiffuse.value = near[0].texture;
            raysMaterial.uniforms.sun.value.set(fx.sunX, fx.sunY);
            pass(raysMaterial, raysTarget);
          }
        }
      }
      material.uniforms.tDiffuse.value = read.texture;
      pass(material, null);
    },
    dispose: () => {
      sceneTarget.dispose();
      spare.dispose();
      [...near, ...far].forEach((target) => target.dispose());
      raysTarget?.dispose();
      raysMaterial?.dispose();
      softQuarter?.dispose();
      softFar?.forEach((target) => target.dispose());
      ao?.dispose();
      material.dispose();
      prefilter.dispose();
      blur.dispose();
      quad.dispose();
    },
  };
}
