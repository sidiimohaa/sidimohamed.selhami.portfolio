import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { softBeam } from "./render/softBeam";
import { cityUniforms } from "./galaxy/cityEnv";

// What the towers of the city-planet wear on their roofs: stepped terraces, spires, domes, twin
// blades and rooftop plant with its antennas, so the skyline is a line of silhouettes and no longer
// a row of boxes. Each crown stands on top of its tower: the walls below are untouched, so the neon
// hung on them stays where it was. Red obstacle lights blink on the tips, and searchlights sweep
// the sky from a few of the tallest roofs.

export type CrownTower = { x: number; z: number; w: number; d: number; top: number };

type Kind = "terraces" | "spire" | "plant" | "dome" | "blades";

// A stable number in 0..1 for a place, so crowns never depend on the order towers were drawn in.
const hash = (x: number, z: number, salt = 0) => {
  const value = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
  return value - Math.floor(value);
};

// Every part of a crown lives in a unit footprint (-0.5..0.5) and a unit height (0..1): the tower's
// own width, depth and crown height scale it. `plain` parts (masts, ducts, parapets) carry no windows.
function part(geometry: THREE.BufferGeometry, plain: boolean, x = 0, y = 0, z = 0) {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  flat.translate(x, y, z);
  flat.deleteAttribute("uv");
  flat.setAttribute("plain", new THREE.BufferAttribute(new Float32Array(flat.getAttribute("position").count).fill(plain ? 1 : 0), 1));
  return flat;
}
const box = (w: number, h: number, d: number, y: number, plain = false, x = 0, z = 0) => part(new THREE.BoxGeometry(w, h, d), plain, x, y, z);
const tube = (top: number, bottom: number, h: number, y: number, sides: number, plain = false, x = 0, z = 0, open = true) =>
  part(new THREE.CylinderGeometry(top, bottom, h, sides, 1, open), plain, x, y, z);

const shapes: Record<Kind, () => THREE.BufferGeometry> = {
  // Three setbacks and a mast.
  terraces: () => mergeGeometries([box(0.88, 0.36, 0.88, 0.18), box(0.66, 0.3, 0.66, 0.51), box(0.44, 0.2, 0.44, 0.76), box(0.2, 0.06, 0.2, 0.89, true), tube(0.012, 0.022, 0.1, 0.95, 5, true)])!,
  // An eight-sided spire drawn out to a needle.
  spire: () => mergeGeometries([tube(0.36, 0.5, 0.28, 0.14, 8), tube(0.2, 0.36, 0.3, 0.43, 8), tube(0.07, 0.2, 0.24, 0.7, 8), tube(0.006, 0.05, 0.18, 0.91, 6, true)])!,
  // Rooftop plant: a parapet, a penthouse, two cooling stacks and a small forest of antennas.
  plant: () =>
    mergeGeometries([
      box(1, 0.1, 1, 0.05, true),
      box(0.56, 0.3, 0.5, 0.25, false, -0.1, 0.05),
      tube(0.1, 0.11, 0.34, 0.27, 8, true, 0.3, -0.25, false),
      tube(0.1, 0.11, 0.34, 0.27, 8, true, 0.3, 0.22, false),
      tube(0.008, 0.014, 0.8, 0.5, 5, true, -0.3, -0.3),
      tube(0.007, 0.012, 0.55, 0.375, 5, true, 0.05, 0.36),
      tube(0.008, 0.016, 0.9, 0.55, 5, true, 0.36, 0),
    ])!,
  // A drum under a dome, with a lantern and a needle.
  dome: () => {
    const cap = new THREE.SphereGeometry(0.44, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.scale(1, 0.36 / 0.44, 1);
    return mergeGeometries([tube(0.47, 0.47, 0.3, 0.15, 12), tube(0.52, 0.52, 0.04, 0.32, 12, true, 0, 0, false), part(cap, false, 0, 0.34, 0), tube(0.07, 0.09, 0.12, 0.76, 8), tube(0.006, 0.014, 0.18, 0.91, 5, true)])!;
  },
  // Two blades of unequal height joined by a bridge.
  blades: () => mergeGeometries([box(0.3, 0.92, 0.86, 0.46, false, -0.24), box(0.3, 0.62, 0.86, 0.31, false, 0.24), box(0.2, 0.08, 0.4, 0.4, true), tube(0.008, 0.014, 0.08, 0.96, 5, true, -0.24)])!,
};
// Where the obstacle light sits on each shape, in the unit footprint.
const tips: Record<Kind, number> = { terraces: 0, spire: 0, plant: 0.36, dome: 0, blades: -0.24 };

/** The crown a tower wears, if any, and how tall it stands above the roof. */
export function crownFor(tower: CrownTower): { kind: Kind; height: number } | null {
  const pick = hash(tower.x, tower.z),
    size = hash(tower.x, tower.z, 1);
  // The slim secondary towers only ever carry a needle.
  if (tower.w < 6) return pick < 0.32 ? { kind: "spire", height: 7 + size * 11 } : null;
  if (tower.top > 55) return pick < 0.55 ? { kind: "spire", height: 44 + size * 46 } : { kind: "terraces", height: 34 + size * 30 };
  // Spires are the rarest: a skyline of nothing but needles reads as a pincushion.
  if (pick < 0.26) return { kind: "terraces", height: 12 + size * 22 };
  if (pick < 0.35) return { kind: "spire", height: 18 + size * 26 };
  if (pick < 0.6) return { kind: "plant", height: 5 + size * 7 };
  if (pick < 0.73) return { kind: "dome", height: 10 + size * 12 };
  if (pick < 0.86) return { kind: "blades", height: 14 + size * 22 };
  return null;
}

export function createCityCrowns(options: {
  towers: CrownTower[];
  material: THREE.Material;
  fogDensity: number;
  pixelRatio: number;
  // Roofs further than this from the platform are lost in the haze and stay bare.
  reach?: number;
}) {
  const { towers, material, fogDensity, reach = 560 } = options;
  const group = new THREE.Group();
  group.name = "city-crowns";
  // Some towers already carry a slim second tower on their roof: those keep it as their crown.
  const topped = new Set(towers.filter((tower) => tower.w < 6).map((tower) => `${tower.x}|${tower.z}`));
  const crowned = towers
    .filter((tower) => Math.hypot(tower.x, tower.z) < reach && (tower.w < 6 || !topped.has(`${tower.x}|${tower.z}`)))
    .map((tower) => ({ tower, crown: crownFor(tower) }))
    .filter((entry): entry is { tower: CrownTower; crown: { kind: Kind; height: number } } => entry.crown !== null);
  const dummy = new THREE.Object3D();
  (Object.keys(shapes) as Kind[]).forEach((kind) => {
    const wearers = crowned.filter((entry) => entry.crown.kind === kind);
    if (!wearers.length) return;
    const mesh = new THREE.InstancedMesh(shapes[kind](), material, wearers.length);
    wearers.forEach(({ tower, crown }, index) => {
      dummy.position.set(tower.x, tower.top, tower.z);
      dummy.scale.set(tower.w, crown.height, tower.d);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.frustumCulled = false;
    mesh.name = `crown-${kind}`;
    group.add(mesh);
  });

  // Obstacle lights on the tips that stand clear of the haze: most blink red, a few burn white.
  const lit = crowned.filter(({ tower, crown }) => tower.top + crown.height > -95);
  const positions = new Float32Array(lit.length * 3),
    phases = new Float32Array(lit.length);
  lit.forEach(({ tower, crown }, index) => {
    positions[index * 3] = tower.x + tips[crown.kind] * tower.w;
    positions[index * 3 + 1] = tower.top + crown.height + 0.4;
    positions[index * 3 + 2] = tower.z;
    phases[index] = hash(tower.x, tower.z, 2);
  });
  const beaconGeometry = new THREE.BufferGeometry();
  beaconGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  beaconGeometry.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
  const beaconUniforms = {
    time: { value: 0 },
    steady: { value: 0 },
    pixelRatio: { value: options.pixelRatio },
    fogDensity: { value: fogDensity },
    cityDay: cityUniforms.cityDay,
    cityNight: cityUniforms.cityNight,
    cityOutage: cityUniforms.cityOutage,
  };
  const beacons = new THREE.Points(
    beaconGeometry,
    new THREE.ShaderMaterial({
      uniforms: beaconUniforms,
      vertexShader: `attribute float phase;
       uniform float time,steady,pixelRatio,fogDensity,cityDay,cityNight;uniform vec4 cityOutage;
       varying float vGlow;varying float vTone;
       void main(){
        vec4 view=modelViewMatrix*vec4(position,1.0);
        float reach=length(view.xyz);
        // A short flash, each light on its own beat; the white ones never go out.
        float beat=fract(time*(.42+phase*.3)+phase*7.0);
        float blink=phase>.84?1.0:mix(smoothstep(0.0,.03,beat)*smoothstep(.24,.1,beat)*.75+.3,.75,steady);
        float cut=step(.001,cityOutage.w)*step(distance(position.xz,cityOutage.xy),cityOutage.z)*step(phase,cityOutage.w*1.05);
        vGlow=blink*exp(-fogDensity*fogDensity*reach*reach)*(.5+.5*cityNight)*(1.0-cityDay*.65)*(1.0-cut);
        vTone=phase;
        gl_PointSize=clamp(pixelRatio*460.0/max(1.0,reach),3.4*pixelRatio,11.0*pixelRatio);
        gl_Position=projectionMatrix*view;
       }`,
      fragmentShader: `varying float vGlow;varying float vTone;
       void main(){
        float d=length(gl_PointCoord*2.0-1.0);
        if(d>1.0)discard;
        vec3 tone=vTone>.84?vec3(1.0,.93,.82):vec3(1.0,.15,.09);
        // A hot point with a soft halo round it.
        gl_FragColor=vec4(tone*vGlow*(exp(-d*d*9.0)*2.4+exp(-d*d*2.2)*.7),1.0);
       }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    }),
  );
  beacons.frustumCulled = false;
  beacons.name = "obstacle-lights";
  group.add(beacons);

  // Searchlights on the tallest crowned roofs within sight: slow cones of light sweeping the sky.
  const beamMaterial = softBeam(
    new THREE.MeshBasicMaterial({ color: 0xbcd2ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }),
  );
  const LENGTH = 460;
  const cone = new THREE.CylinderGeometry(13, 0.5, LENGTH, 20, 1, true);
  cone.translate(0, LENGTH / 2, 0);
  const sources = crowned
    .filter(({ tower }) => {
      const far = Math.hypot(tower.x, tower.z);
      return far > 150 && far < 430;
    })
    .sort((a, b) => b.tower.top + b.crown.height - (a.tower.top + a.crown.height))
    .slice(0, 7);
  const beams = sources.map(({ tower, crown }, index) => {
    const beam = new THREE.Mesh(cone, beamMaterial);
    beam.position.set(tower.x, tower.top + crown.height * (crown.kind === "plant" ? 0.4 : 0.92), tower.z);
    beam.rotation.order = "YXZ";
    beam.frustumCulled = false;
    beam.renderOrder = 3;
    group.add(beam);
    return { beam, turn: (index % 2 ? -1 : 1) * (0.05 + hash(tower.x, tower.z, 3) * 0.05), offset: hash(tower.x, tower.z, 4) * 6.283, lean: 0.34 + hash(tower.x, tower.z, 5) * 0.22 };
  });

  return {
    group,
    tick(elapsed: number, reduced: boolean) {
      beaconUniforms.time.value = elapsed;
      beaconUniforms.steady.value = reduced ? 1 : 0;
      const { cityDay, cityNight, cityStorm } = cityUniforms;
      // The beams belong to the dark hours, and show best in the wet air of a storm.
      beamMaterial.opacity = 0.2 * (1 - cityDay.value) * (0.5 + 0.5 * cityNight.value) * (1 + cityStorm.value * 0.6);
      const time = reduced ? 0 : elapsed;
      beams.forEach(({ beam, turn, offset, lean }) => {
        beam.visible = beamMaterial.opacity > 0.002;
        beam.rotation.y = offset + time * turn;
        beam.rotation.z = lean + Math.sin(time * 0.11 + offset) * 0.14;
      });
    },
    // The lights keep their size on screen whatever the resolution: `height` is in device pixels.
    setViewport: (height: number) => (beaconUniforms.pixelRatio.value = Math.max(0.6, height / 760)),
    dispose() {
      cone.dispose();
      beamMaterial.dispose();
    },
  };
}
