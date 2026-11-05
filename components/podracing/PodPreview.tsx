"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createPodModel } from "./podModel";
import type { PodModuleId } from "./modules";
import type { PodVehicle } from "./types";

const idle: PodVehicle = {
  id: "preview", name: "", color: 0, module: "ulzer", distance: 0, lane: 0, speed: 45, lateral: 0, roll: 0, heat: [.1, .1], health: [1, 1], boost: 1,
  boosting: false, repairing: false, drifting: false, driftCharge: 0, miniTurbo: 0, slipstream: 0, hit: 0, branch: -1, finishedAt: null,
};

function release(object: THREE.Object3D) {
  object.traverse((item) => {
    const mesh = item as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => material.dispose());
  });
}

/** The pod being fitted out, turning slowly on its stand. */
export default function PodPreview({ module, color, reduced, className }: { module: PodModuleId; color: number; reduced: boolean; className?: string }) {
  const mount = useRef<HTMLDivElement>(null);
  const holder = useRef<THREE.Group | null>(null);
  const model = useRef<ReturnType<typeof createPodModel> | null>(null);

  useEffect(() => {
    const element = mount.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    element.append(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffe8d0, 0x5a4638, 1.9));
    const sun = new THREE.DirectionalLight(0xffe6be, 2.8);
    sun.position.set(-6, 10, 5);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
    const turn = new THREE.Group();
    scene.add(turn);
    holder.current = turn;
    const resize = () => {
      const width = element.clientWidth || 320, height = element.clientHeight || 200;
      camera.aspect = width / height;
      // Stand further back when the frame is narrow, so the longest modules still fit.
      camera.position.set(0, 5.5, 15 / Math.min(1, camera.aspect / 1.5));
      camera.lookAt(0, .3, 0);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    let frame = 0;
    const draw = (now: number) => {
      const time = now / 1000;
      turn.rotation.y = reduced ? 2.5 : 2.5 + time * .35;
      if (model.current) model.current.update(idle, time, reduced);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      release(turn);
      model.current = null;
      holder.current = null;
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [reduced]);

  useEffect(() => {
    const turn = holder.current;
    if (!turn) return;
    const next = createPodModel(color, false, module);
    // Centre the pod on its stand: the engines sit well behind the cabin.
    next.root.position.z = -new THREE.Box3().setFromObject(next.root).getCenter(new THREE.Vector3()).z;
    turn.add(next.root);
    model.current = next;
    return () => {
      turn.remove(next.root);
      release(next.root);
      if (model.current === next) model.current = null;
    };
  }, [module, color, reduced]);

  return <div ref={mount} className={className} aria-hidden="true" />;
}
