import * as THREE from "three";
import { clamp, smooth } from "./timeline";

export function captureWorld(scene: THREE.Scene, excluded: THREE.Object3D) {
  const roots = scene.children.filter((object) => object !== excluded && !(object instanceof THREE.Light) && !(object instanceof THREE.Camera));
  const bodies = roots.map((object, i) => ({
    object, position: object.position.clone(), rotation: object.quaternion.clone(),
    scale: object.scale.clone(), visible: object.visible, seed: ((i * 31 + 17) % 97) / 97,
  }));
  const instances: { object: THREE.InstancedMesh; matrices: Float32Array }[] = [];
  const lights: { object: THREE.Light; intensity: number }[] = [];
  const emissives = new Map<THREE.MeshStandardMaterial, number>();
  scene.traverse((object) => {
    if (object instanceof THREE.InstancedMesh) instances.push({ object, matrices: new Float32Array(object.instanceMatrix.array) });
    if (object instanceof THREE.Light) lights.push({ object, intensity: object.intensity });
    if (object instanceof THREE.Mesh) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) if (material instanceof THREE.MeshStandardMaterial && !emissives.has(material)) emissives.set(material, material.emissiveIntensity);
    }
  });
  const offset = new THREE.Vector3(), spin = new THREE.Quaternion(), tumble = new THREE.Quaternion();
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
  return {
    update(collapse: number, center: THREE.Vector3, axis: THREE.Vector3, time: number, reduced: boolean) {
      const flicker = reduced ? 1 : 1 - (0.08 + Math.sin(time * 7.5) * 0.06) * (1 - collapse);
      lights.forEach(({ object, intensity }) => { object.intensity = intensity * flicker; });
      emissives.forEach((intensity, material) => { material.emissiveIntensity = intensity * flicker; });
      for (const body of bodies) {
        const p = reduced ? 0 : clamp((collapse - body.seed * 0.12) / (1 - body.seed * 0.12));
        spin.setFromAxisAngle(axis, p * p * (2.8 + body.seed * 3));
        offset.copy(body.position).sub(center).applyQuaternion(spin).multiplyScalar(Math.pow(1 - p, 2.35));
        body.object.position.copy(center).add(offset);
        tumble.setFromAxisAngle(axis, p * (1 + body.seed * 2));
        body.object.quaternion.copy(spin).multiply(body.rotation).multiply(tumble);
        const size = Math.max(0.000001, Math.pow(1 - p, 1.4));
        body.object.scale.copy(body.scale).multiplyScalar(size);
        body.object.scale.z *= 1 + Math.sin(p * Math.PI) * 3.5;
        // Thin lines (the orbit traces) would stretch into white threads round the hole: hidden.
        body.object.visible = body.visible && !(body.object instanceof THREE.Line) && (reduced ? collapse < 0.99 : p < 0.999);
      }
      // Instanced debris uses local matrices as well: every asteroid follows its own
      // shrinking orbit, without allocating meshes or breaking the original instance buffer.
      if (!reduced) for (const { object, matrices } of instances) {
        for (let i = 0; i < object.count; i++) {
          matrix.fromArray(matrices, i * 16).decompose(position, rotation, scale);
          const p = smooth((i % 11) * 0.012, 1, collapse);
          spin.setFromAxisAngle(axis, p * p * (2 + (i % 5)));
          position.applyQuaternion(spin).multiplyScalar(Math.pow(1 - p, 1.5));
          scale.multiplyScalar(Math.max(0.00001, 1 - p));
          matrix.compose(position, rotation, scale);
          object.setMatrixAt(i, matrix);
        }
        object.instanceMatrix.needsUpdate = true;
      }
    },
    restore() {
      for (const body of bodies) {
        body.object.position.copy(body.position); body.object.quaternion.copy(body.rotation);
        body.object.scale.copy(body.scale); body.object.visible = body.visible;
      }
      for (const { object, matrices } of instances) {
        object.instanceMatrix.array.set(matrices); object.instanceMatrix.needsUpdate = true;
      }
      lights.forEach(({ object, intensity }) => { object.intensity = intensity; });
      emissives.forEach((intensity, material) => { material.emissiveIntensity = intensity; });
      scene.updateMatrixWorld(true);
    },
  };
}
