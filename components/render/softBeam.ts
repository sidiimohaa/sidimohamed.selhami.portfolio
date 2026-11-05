import * as THREE from "three";

// A shaft or cone of light drawn as an open tube shows a hard outline, like a pane of glass. This
// fades it where the surface turns edge-on to the viewer and towards both ends, so it reads as lit
// air. `near`, in metres, also fades it for a visitor walking through it.
export function softBeam<T extends THREE.Material>(material: T, near = 0): T {
  const shared = "varying vec3 beamNormal;varying vec3 beamView;varying float beamAlong;";
  const closeUp = near > 0 ? `*smoothstep(${(near * 0.25).toFixed(2)},${near.toFixed(2)},length(beamView))` : "";
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${shared}`)
      .replace("#include <project_vertex>", "#include <project_vertex>\nbeamNormal=normalMatrix*normal;beamView=-mvPosition.xyz;beamAlong=uv.y;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${shared}`)
      .replace(
        "#include <opaque_fragment>",
        `float beamFacing=abs(dot(normalize(beamNormal),normalize(beamView)));
        diffuseColor.a*=beamFacing*beamFacing*smoothstep(0.0,0.08,beamAlong)*smoothstep(1.0,0.75,beamAlong)${closeUp};
        #include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => `soft-beam-${near}`;
  return material;
}
