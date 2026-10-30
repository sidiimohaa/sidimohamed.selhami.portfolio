import * as THREE from "three";

// Weather added to existing materials in their shaders, so a whole set of props changes at once
// without new geometry: snow settling on Hoth's equipment, sand banked against Tatooine's walls.

const worldVaryings = (shader: { vertexShader: string }, name: string) => {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\nvarying vec3 v${name}World;\nvarying vec3 v${name}Normal;`)
    .replace(
      "#include <fog_vertex>",
      `#include <fog_vertex>
      vec4 ${name}Position = vec4(transformed, 1.0);
      vec3 ${name}Up = objectNormal;
      #ifdef USE_INSTANCING
        ${name}Position = instanceMatrix * ${name}Position;
        ${name}Up = mat3(instanceMatrix) * ${name}Up;
      #endif
      v${name}World = (modelMatrix * ${name}Position).xyz;
      v${name}Normal = normalize(mat3(modelMatrix) * ${name}Up);`,
    );
};
const declare = (shader: { fragmentShader: string }, name: string) => {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <common>",
    `#include <common>\nvarying vec3 v${name}World;\nvarying vec3 v${name}Normal;
    float ${name}Hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}`,
  );
};

/** Snow on every upward face, in drifts rather than an even coat, plus a dusting at the foot. */
export function snowCover(material: THREE.MeshStandardMaterial, amount = 1) {
  material.onBeforeCompile = (shader) => {
    worldVaryings(shader, "Snow");
    declare(shader, "Snow");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float snowUp = smoothstep(0.3, 0.85, normalize(vSnowNormal).y);
        float snowPatch = 0.55 + 0.45 * sin(vSnowWorld.x * 2.3 + sin(vSnowWorld.z * 1.7) * 2.0) * sin(vSnowWorld.z * 2.9 + vSnowWorld.y);
        float snowFoot = (1.0 - smoothstep(0.0, 0.25 + 0.25 * snowPatch, vSnowWorld.y)) * 0.6;
        float snow = clamp((snowUp * (0.5 + 0.5 * snowPatch) + snowFoot) * ${amount.toFixed(2)} + (SnowHash(floor(vSnowWorld.xz * 18.0)) - 0.5) * 0.18 * snowUp, 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.94, 0.98), snow);`,
      )
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.8, snow);")
      .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.0, snow);");
  };
  material.customProgramCacheKey = () => `snow-${amount}`;
  return material;
}

/** Sand blown against the foot of the walls: a pale, rippled band whose top rises and falls. */
export function sandBanked(material: THREE.MeshStandardMaterial, ground = 0) {
  material.onBeforeCompile = (shader) => {
    worldVaryings(shader, "Sand");
    declare(shader, "Sand");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float sandH = vSandWorld.y - ${ground.toFixed(2)};
        float sandTop = 0.28 + 0.32 * (0.5 + 0.5 * sin(vSandWorld.x * 0.9 + sin(vSandWorld.z * 0.7) * 2.2)) * (0.5 + 0.5 * sin(vSandWorld.z * 1.3 + vSandWorld.x * 0.4));
        float sandBand = 1.0 - smoothstep(sandTop - 0.12, sandTop + 0.05, sandH);
        float sandRipple = 0.92 + 0.08 * sin((vSandWorld.x + vSandWorld.z) * 22.0 + SandHash(floor(vSandWorld.xz * 6.0)) * 3.0);
        float sandSide = 1.0 - abs(normalize(vSandNormal).y);
        float sand = sandBand * mix(0.6, 1.0, sandSide);
        // A faint shadow just above the bank gives it some thickness against the wall.
        float sandLip = smoothstep(sandTop - 0.02, sandTop + 0.06, sandH) * (1.0 - smoothstep(sandTop + 0.06, sandTop + 0.22, sandH));
        diffuseColor.rgb *= 1.0 - sandLip * 0.18 * sandSide;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.74, 0.57, 0.37) * sandRipple, sand * 0.9);`,
      )
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 1.0, sand);");
  };
  material.customProgramCacheKey = () => `sand-${ground}`;
  return material;
}
