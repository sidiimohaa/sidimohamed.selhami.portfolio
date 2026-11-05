import * as THREE from "three";
import type { Detail } from "./looks";

// Surface detail added to the existing standard materials in their shaders, without textures or
// new geometry: fine grain in the relief, roughness that varies across a surface, panel joints on
// large metal walls, dirt at the foot of walls and in vertical streaks, and a deposit (sand, frost,
// leaf litter) on upward faces. Architecture uses world coordinates; character detail stays
// attached to each articulated part and never receives the surrounding terrain deposits.
//
// Tier 1 adds colour and roughness variation; tiers 2 and 3 add the relief, with more noise octaves.

const DONE = "detailApplied";

const shaderCommon = /* glsl */ `
varying vec3 vDetailWorld;
varying vec3 vDetailLocal;
varying vec3 vDetailNormal;
uniform vec3 detailGrime;
uniform vec3 detailTop;
float detailHash(vec3 p){p=fract(p*0.3183099+0.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float detailNoise(vec3 x){vec3 i=floor(x);vec3 f=fract(x);f=f*f*(3.0-2.0*f);
  return mix(mix(mix(detailHash(i),detailHash(i+vec3(1,0,0)),f.x),mix(detailHash(i+vec3(0,1,0)),detailHash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(detailHash(i+vec3(0,0,1)),detailHash(i+vec3(1,0,1)),f.x),mix(detailHash(i+vec3(0,1,1)),detailHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float detailFbm(vec3 p){float a=0.5,s=0.0;for(int i=0;i<DETAIL_OCTAVES;i++){s+=a*detailNoise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=0.5;}return s;}
`;

type SurfaceKind = "skin" | "cloth" | "fur" | "leather" | "metal";
const surfaces: Record<SurfaceKind, { grain: number; bump: number; roughVar: number; albedoVar: number }> = {
  skin: { grain: 72, bump: .0007, roughVar: .12, albedoVar: .035 },
  cloth: { grain: 95, bump: .0018, roughVar: .18, albedoVar: .045 },
  fur: { grain: 38, bump: .0025, roughVar: .12, albedoVar: .065 },
  leather: { grain: 48, bump: .0016, roughVar: .22, albedoVar: .045 },
  metal: { grain: 65, bump: .00035, roughVar: .16, albedoVar: .02 },
};

function inject(shader: THREE.WebGLProgramParametersWithUniforms, detail: Detail, tier: number, options: { seams: boolean; textured: boolean; metal: boolean; large: boolean; attached: boolean; surface: string }) {
  const f = (value: number) => value.toFixed(4);
  shader.uniforms.detailGrime = { value: new THREE.Vector3(...detail.grime) };
  shader.uniforms.detailTop = { value: new THREE.Vector3(...detail.top) };
  shader.defines = { ...(shader.defines ?? {}), DETAIL_OCTAVES: tier >= 2 ? 3 : 2 };
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vDetailWorld;\nvarying vec3 vDetailLocal;\nvarying vec3 vDetailNormal;")
    .replace(
      "#include <fog_vertex>",
      `#include <fog_vertex>
      vec4 detailAt = vec4(transformed, 1.0);
      vDetailLocal = position;
      #ifdef USE_INSTANCING
        detailAt = instanceMatrix * detailAt;
      #endif
      vDetailWorld = (modelMatrix * detailAt).xyz;
      vDetailNormal = inverseTransformDirection(transformedNormal, viewMatrix);`,
    );
  const panelW = f(detail.panel[0]),
    panelH = f(detail.panel[1]);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>\n${shaderCommon}`)
    .replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      vec3 dW = vDetailWorld;
      vec3 dN = normalize(vDetailNormal);
      vec3 dA = abs(dN);
      float dDist = length(vViewPosition);
      vec3 dSurface = ${options.attached ? "vDetailLocal" : "dW"};
      float dLarge = detailNoise(dSurface * ${options.attached ? "7.0" : "0.23"});
      vec3 dGrain = dSurface * ${f(detail.grain)};
      // Filter the smallest detail before it becomes narrower than a pixel.
      float dDetailFade = 1.0 - smoothstep(0.35, 1.2, length(fwidth(dGrain)));
      float dFine = mix(0.5, detailFbm(dGrain), dDetailFade);
      ${options.surface === "cloth" ? "float dWeave = sin(dGrain.x * 6.28318) * sin(dGrain.y * 6.28318); dFine += dWeave * 0.12 * dDetailFade;" : ""}
      ${options.surface === "fur" ? "dFine = mix(dFine, detailNoise(dGrain * vec3(1.8, 0.15, 1.8)), 0.3 * dDetailFade);" : ""}
      // Panels on the dominant plane of the face, in staggered rows.
      vec2 dPlane = dA.y > 0.6 ? dW.xz : (dA.x > dA.z ? dW.zy : dW.xy);
      vec2 dSize = vec2(${panelW}, ${panelH});
      vec2 dCellPos = dPlane / dSize;
      dCellPos.x += floor(dCellPos.y) * 0.5;
      vec2 dCell = floor(dCellPos);
      vec2 dEdge = (0.5 - abs(fract(dCellPos) - 0.5)) * dSize;
      float dSeamFade = 1.0 - smoothstep(0.015, 0.06, fwidth(dPlane.x) + fwidth(dPlane.y));
      float dSeam = ${options.seams ? "(1.0 - smoothstep(0.0, 0.022, min(dEdge.x, dEdge.y))) * dSeamFade" : "0.0"};
      float dPanel = ${options.seams ? "detailHash(vec3(dCell, floor(dW.y * 0.01) + 7.0))" : "0.5"};
      // Dirt: at the foot of walls (a contact shadow), in vertical streaks, and in the joints.
      float dFoot = ${options.large ? "1.0" : "0.0"} * (1.0 - smoothstep(0.0, ${f(Math.max(detail.contactHeight, 0.001))}, dW.y - ${f(detail.groundY)})) * (1.0 - smoothstep(0.55, 0.85, dA.y));
      float dStreak = ${options.large ? "1.0" : "0.0"} * smoothstep(0.55, 0.85, detailNoise(vec3(dW.x * 2.6, dW.y * 0.22, dW.z * 2.6))) * (1.0 - dA.y) * ${f(detail.streaks)};
      float dTone = 1.0 + (dLarge - 0.5) * ${f(detail.albedoVar * (options.textured ? 0.5 : 1))} * 2.0 + (dPanel - 0.5) * 0.08 + (dFine - 0.5) * ${f(detail.albedoVar * 0.5)};
      diffuseColor.rgb *= dTone;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * detailGrime * 2.2, clamp(dStreak * 0.5 + dSeam * 0.55, 0.0, 1.0));
      diffuseColor.rgb *= 1.0 - dFoot * ${f(detail.contactStrength)};
      // Deposit on upward faces, in drifts rather than an even coat.
      float dTop = smoothstep(0.65, 0.95, dN.y) * smoothstep(0.35, 0.75, dLarge * 0.6 + dFine * 0.6) * ${f(detail.topAmount)};
      diffuseColor.rgb = mix(diffuseColor.rgb, detailTop, dTop);`,
    )
    .replace(
      "#include <roughnessmap_fragment>",
      `#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor * (1.0 + (dFine - 0.5) * ${f(detail.roughVar * 2)} + (dPanel - 0.5) * ${f(options.metal ? 0.35 : 0.12)}) + dStreak * 0.15 + dTop * 0.3 + dSeam * 0.2, 0.04, 1.0);`,
    )
    .replace(
      "#include <metalnessmap_fragment>",
      `#include <metalnessmap_fragment>
      metalnessFactor *= 1.0 - dTop;`,
    );
  if (tier >= 2)
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
      {
        // Relief from the grain and the joints, by screen-space derivatives (bump mapping without
        // a texture), faded out with distance where it would only shimmer.
        float dHeight = dFine * ${f(detail.bump)} - dSeam * 0.01;
        vec3 dP = -vViewPosition;
        vec3 dPx = dFdx(dP), dPy = dFdy(dP);
        float dHx = dFdx(dHeight), dHy = dFdy(dHeight);
        vec3 dR1 = cross(dPy, normal), dR2 = cross(normal, dPx);
        float dDet = dot(dPx, dR1);
        vec3 dGrad = sign(dDet) * (dHx * dR1 + dHy * dR2);
        float dNear = 1.0 - smoothstep(18.0, 60.0, dDist);
        normal = normalize(mix(normal, abs(dDet) * normal - dGrad, dNear * step(1e-9, abs(dDet))));
      }`,
    );
}

/** Adds surface detail to every suitable standard material under root. */
export function enrichMaterials(root: THREE.Object3D, detail: Detail, tier: number, skip: THREE.Object3D[] = []) {
  if (tier <= 0) return 0;
  root.updateMatrixWorld(true);
  const skipped = new Set<THREE.Object3D>();
  skip.forEach((object) => object.traverse((child) => skipped.add(child)));
  // Size of the largest mesh using each material decides whether it gets panel joints.
  const size = new Map<THREE.MeshStandardMaterial, number>();
  const characterMaterials = new Set<THREE.MeshStandardMaterial>();
  const characters = new Set<THREE.Object3D>();
  root.traverse((object) => {
    if (object.userData.character === true) object.traverse((child) => characters.add(child));
  });
  const scale = new THREE.Vector3();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || skipped.has(mesh) || (mesh as unknown as THREE.SkinnedMesh).isSkinnedMesh) return;
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    mesh.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
    const radius = (mesh.geometry.boundingSphere?.radius ?? 0) * Math.max(scale.x, scale.y, scale.z);
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => {
      const standard = material as THREE.MeshStandardMaterial;
      if (standard.userData.indoors && !characters.has(mesh) && !standard.userData.surfaceKind) return;
      if (!standard.isMeshStandardMaterial || standard.transparent || standard.userData[DONE] || standard.userData.skipSurfaceDetail || standard.wireframe) return;
      if (characters.has(mesh)) characterMaterials.add(standard);
      size.set(standard, Math.max(size.get(standard) ?? 0, radius));
    });
  });
  size.forEach((radius, material) => {
    const textured = !!material.map;
    const metal = material.metalness > 0.3;
    // Characters and small props keep their grain but not the dirt of buildings and walls.
    const kind = material.userData.surfaceKind as SurfaceKind | undefined;
    const surface = kind && Object.hasOwn(surfaces, kind) ? kind : undefined;
    const attached = characterMaterials.has(material) || !!surface || radius < 1.6;
    const character = characterMaterials.has(material) || !!surface;
    const treatment = character ? {
      ...detail,
      ...(surfaces[surface ?? "metal"]),
      topAmount: 0, contactStrength: 0, streaks: 0, seams: false,
    } : detail;
    const large = radius > 1.6 && !character;
    const seams = !character && detail.seams && !textured && radius > 2.2 && material.metalness > 0.15;
    const previous = material.onBeforeCompile;
    // A material without its own cache key is keyed by its hook's source; keep that distinction.
    const ownKey = material.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey;
    const previousKey = ownKey ? material.customProgramCacheKey.bind(material) : () => previous.toString();
    material.onBeforeCompile = (shader, renderer) => {
      previous.call(material, shader, renderer);
      inject(shader, treatment, tier, { seams, textured, metal, large, attached, surface: surface ?? "" });
    };
    const key = JSON.stringify({ tier, large, seams, textured, metal, attached, surface, treatment });
    material.customProgramCacheKey = () => `${previousKey()}|${key}`;
    material.userData[DONE] = true;
    material.needsUpdate = true;
  });
  return size.size;
}
