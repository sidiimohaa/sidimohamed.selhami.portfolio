import * as THREE from "three";

// What the engines leave behind in open space: a plume of ionised gas at each nozzle that
// lengthens with thrust, and a ribbon of light along the path each engine has just flown.

const plumeVertex = /* glsl */ `
  varying vec2 vUv; varying float vFacing;
  void main(){
    vUv = uv;
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    // Soft edges: the sheath fades where it turns away from the eye.
    vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-view.xyz)));
    gl_Position = projectionMatrix * view;
  }`;
const plumeFragment = /* glsl */ `
  uniform vec3 tint; uniform float power, boost, time, seed;
  varying vec2 vUv; varying float vFacing;
  void main(){
    // uv.y runs from the tail (0) to the nozzle (1).
    float along = vUv.y;
    float body = pow(along, mix(2.4, 1.3, boost));
    // Shock diamonds stand in the jet under boost.
    float diamonds = 1.0 + boost * 0.55 * sin((1.0 - along) * 26.0 - time * 34.0 + seed);
    float flicker = 0.88 + 0.12 * sin(time * 47.0 + seed * 3.0 + along * 9.0);
    float edge = pow(vFacing, 1.4);
    vec3 color = mix(tint, vec3(1.0, 0.97, 0.94), pow(along, 3.0) * 0.85);
    gl_FragColor = vec4(color * body * diamonds * flicker * edge * power * 1.5, 1.0);
  }`;

const trailVertex = /* glsl */ `
  attribute float age; varying float vAge; varying float vSide;
  void main(){ vAge = age; vSide = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const trailFragment = /* glsl */ `
  uniform vec3 tint; uniform float power;
  varying float vAge; varying float vSide;
  void main(){
    float fresh = 1.0 - vAge;
    float across = 1.0 - abs(vSide * 2.0 - 1.0);
    vec3 color = mix(tint, vec3(1.0, 0.96, 0.92), pow(fresh, 5.0) * 0.7);
    gl_FragColor = vec4(color * pow(fresh, 2.8) * pow(across, 1.6) * power, 1.0);
  }`;

const SAMPLES = 44;

type Trail = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  points: THREE.Vector3[];
  born: number[];
  count: number;
};

export function createEngineFx(nozzles: THREE.Object3D[], color: THREE.ColorRepresentation) {
  const tint = new THREE.Color(color);
  // The baked model carries its fitting scale on each glow sprite: plumes take the same.
  const unit = nozzles[0] ? nozzles[0].scale.x / 0.32 : 1;
  const plumes = nozzles.map((nozzle, index) => {
    // A tapering sheath pointing aft (the craft's nose is +Y), its mouth on the nozzle.
    const geometry = new THREE.CylinderGeometry(0.062, 0.006, 1, 14, 1, true);
    geometry.translate(0, -0.5, 0);
    const material = new THREE.ShaderMaterial({
      uniforms: { tint: { value: tint }, power: { value: 0 }, boost: { value: 0 }, time: { value: 0 }, seed: { value: index * 1.7 } },
      vertexShader: plumeVertex,
      fragmentShader: plumeFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(nozzle.position);
    mesh.position.y += 0.02 * unit;
    mesh.frustumCulled = false;
    nozzle.parent?.add(mesh);
    return mesh;
  });
  const group = new THREE.Group();
  const trails: Trail[] = nozzles.map(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SAMPLES * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute("age", new THREE.BufferAttribute(new Float32Array(SAMPLES * 2), 1).setUsage(THREE.DynamicDrawUsage));
    const uv = new Float32Array(SAMPLES * 2 * 2);
    const index: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      uv[i * 4] = 0;
      uv[i * 4 + 2] = 1;
      if (i < SAMPLES - 1) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geometry.setIndex(index);
    geometry.setDrawRange(0, 0);
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: { tint: { value: tint }, power: { value: 0 } },
        vertexShader: trailVertex,
        fragmentShader: trailFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    mesh.frustumCulled = false;
    group.add(mesh);
    return { mesh, points: Array.from({ length: SAMPLES }, () => new THREE.Vector3()), born: new Array<number>(SAMPLES).fill(0), count: 0 };
  });
  const head = new THREE.Vector3(),
    along = new THREE.Vector3(),
    toEye = new THREE.Vector3(),
    side = new THREE.Vector3();
  let clock = 0;
  const clear = () =>
    trails.forEach((trail) => {
      trail.count = 0;
      trail.mesh.geometry.setDrawRange(0, 0);
    });
  return {
    /** The ribbons live in world space: add this to the scene, not to the craft. */
    group,
    setColor: (next: THREE.ColorRepresentation) => tint.set(next),
    clear,
    /**
     * `power` is the thrust (0..1), `boost` how far into the afterburner (0..1), `speed` the
     * craft's speed in scene units per second. With `still`, plumes hold steady and ribbons hide.
     */
    update(dt: number, camera: THREE.Camera, power: number, boost: number, speed: number, still: boolean) {
      clock += dt;
      const length = 0.16 + power * (0.5 + boost * 0.95);
      plumes.forEach((plume) => {
        plume.scale.set(unit * (1 + boost * 0.25), unit * length, unit * (1 + boost * 0.25));
        const u = plume.material.uniforms;
        u.power.value = 0.25 + power * 0.75;
        u.boost.value = boost;
        u.time.value = still ? 0 : clock;
      });
      // A ribbon lasts longer under boost, and nothing is drawn at a standstill.
      const life = 0.36 + boost * 0.26;
      const glow = still ? 0 : THREE.MathUtils.smoothstep(speed, 1.2, 7) * (0.5 + boost * 0.45);
      const width = 0.036 + boost * 0.016;
      trails.forEach((trail, index) => {
        nozzles[index].getWorldPosition(head);
        // A jump of the craft (a reset, a skipped trip) starts the ribbon afresh.
        if (trail.count && head.distanceToSquared(trail.points[0]) > 36) trail.count = 0;
        // Newest first: shift the history down and drop what has aged out.
        if (!trail.count || head.distanceToSquared(trail.points[0]) > 0.0025) {
          for (let i = Math.min(trail.count, SAMPLES - 1); i > 0; i--) {
            trail.points[i].copy(trail.points[i - 1]);
            trail.born[i] = trail.born[i - 1];
          }
          trail.points[0].copy(head);
          trail.born[0] = clock;
          trail.count = Math.min(SAMPLES, trail.count + 1);
        } else trail.points[0].copy(head);
        while (trail.count > 1 && clock - trail.born[trail.count - 1] > life) trail.count--;
        const visible = glow > 0.01 && trail.count > 1;
        trail.mesh.visible = visible;
        if (!visible) return;
        const position = trail.mesh.geometry.attributes.position as THREE.BufferAttribute,
          age = trail.mesh.geometry.attributes.age as THREE.BufferAttribute;
        for (let i = 0; i < trail.count; i++) {
          const point = trail.points[i];
          along.copy(trail.points[Math.max(0, i - 1)]).sub(trail.points[Math.min(trail.count - 1, i + 1)]);
          toEye.copy(camera.position).sub(point);
          side.crossVectors(along, toEye);
          if (side.lengthSq() < 1e-10) side.set(1, 0, 0);
          const old = Math.min(1, (clock - trail.born[i]) / life);
          side.normalize().multiplyScalar(width * (1 - old * 0.6));
          position.setXYZ(i * 2, point.x + side.x, point.y + side.y, point.z + side.z);
          position.setXYZ(i * 2 + 1, point.x - side.x, point.y - side.y, point.z - side.z);
          age.setX(i * 2, old);
          age.setX(i * 2 + 1, old);
        }
        position.needsUpdate = true;
        age.needsUpdate = true;
        trail.mesh.geometry.setDrawRange(0, (trail.count - 1) * 6);
        trail.mesh.material.uniforms.power.value = glow;
      });
    },
    dispose() {
      plumes.forEach((plume) => {
        plume.removeFromParent();
        plume.geometry.dispose();
        plume.material.dispose();
      });
      trails.forEach((trail) => {
        trail.mesh.geometry.dispose();
        trail.mesh.material.dispose();
      });
    },
  };
}
