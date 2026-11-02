"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createSandtrooper } from "../tatooineCharacters";
import { createStage } from "./stage";

// The scene behind the Imperial transmission: a hooded figure in a dark office, the lights of a
// city at night through the great window, and a commander's flickering blue hologram receiving
// the order.

function cityAtNight() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const c = canvas.getContext("2d")!;
  const sky = c.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, "#03060d");
  sky.addColorStop(0.6, "#0a1426");
  sky.addColorStop(1, "#1a2138");
  c.fillStyle = sky;
  c.fillRect(0, 0, 1024, 512);
  let seed = 66;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  // Towers in three depths, the nearest tallest and darkest, every one pricked with windows.
  for (const [count, tone, lit, low] of [
    [40, "#0c1220", 0.35, 0.25],
    [26, "#070b14", 0.5, 0.1],
    [14, "#04060b", 0.6, 0],
  ] as const) {
    for (let i = 0; i < count; i++) {
      const w = 18 + rand() * 50,
        x = rand() * 1024,
        top = 512 * (low + rand() * 0.55);
      c.fillStyle = tone;
      c.fillRect(x, top, w, 512 - top);
      for (let y = top + 6; y < 512; y += 7)
        for (let wx = x + 3; wx < x + w - 3; wx += 6)
          if (rand() < lit * 0.5) {
            c.fillStyle = rand() < 0.75 ? "rgba(255,214,150,.85)" : "rgba(190,220,255,.8)";
            c.fillRect(wx, y, 2, 3);
          }
    }
  }
  // Streams of air traffic.
  for (let lane = 0; lane < 5; lane++) {
    const y = 160 + lane * 55;
    for (let i = 0; i < 60; i++) {
      c.fillStyle = i % 3 ? "rgba(255,240,210,.7)" : "rgba(255,120,90,.7)";
      c.fillRect(rand() * 1024, y + Math.sin(i) * 4, 3, 1.5);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function hologramMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec3 vNormal;varying vec3 vView;varying float vHeight;
      void main(){vec4 world=modelMatrix*vec4(position,1.0);vHeight=world.y;vNormal=normalize(mat3(modelMatrix)*normal);vView=normalize(cameraPosition-world.xyz);gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader: `uniform float time;varying vec3 vNormal;varying vec3 vView;varying float vHeight;
      void main(){
        float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),1.5);
        float scan=.62+.38*sin(vHeight*140.0-time*7.0);
        float band=step(.985,fract(vHeight*1.7-time*.35));
        float flicker=.86+.14*sin(time*31.0)*sin(time*7.3);
        vec3 tint=vec3(.42,.72,1.0);
        gl_FragColor=vec4(tint*(.35+rim*1.25+band*.8)*scan,(.22+rim*.55+band*.3)*scan*flicker);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function hoodedFigure() {
  const group = new THREE.Group();
  const robe = new THREE.MeshStandardMaterial({ color: 0x15110f, roughness: 0.95 });
  const inner = new THREE.MeshStandardMaterial({ color: 0x060505, roughness: 1, side: THREE.BackSide });
  const skin = new THREE.MeshStandardMaterial({ color: 0xa89c92, roughness: 0.8 });
  // A heavy robe that widens to the floor, and a deep hood leaving the face in shadow.
  group.add(
    new THREE.Mesh(
      new THREE.LatheGeometry([new THREE.Vector2(0.05, 1.5), new THREE.Vector2(0.2, 1.45), new THREE.Vector2(0.26, 1.2), new THREE.Vector2(0.28, 0.8), new THREE.Vector2(0.36, 0.2), new THREE.Vector2(0.4, 0)], 32),
      robe,
    ),
  );
  // Open at the front (+z, where phi is a quarter turn).
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16, Math.PI / 2 + 0.6, Math.PI * 2 - 1.2), robe);
  hood.position.set(0, 1.64, -0.01);
  hood.scale.set(1, 1.15, 1.15);
  group.add(hood);
  const hollow = new THREE.Mesh(new THREE.SphereGeometry(0.155, 20, 14), inner);
  hollow.position.copy(hood.position);
  group.add(hollow);
  // Only the lower face catches any light: a sunken cheek, the chin.
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.1, 18, 12, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), skin);
  face.position.set(0, 1.61, 0.05);
  face.scale.set(0.95, 1.2, 0.85);
  group.add(face);
  for (const side of [-1, 1]) {
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.13, 0.5, 14, 1, true), robe);
    sleeve.position.set(side * 0.16, 1.12, 0.12);
    sleeve.rotation.x = -0.9;
    group.add(sleeve);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), skin);
    hand.position.set(side * 0.05, 0.98, 0.3);
    hand.scale.set(1, 0.8, 1.2);
    group.add(hand);
  }
  return group;
}

export function OrderSixtySixScene({ reduced }: { reduced: boolean }) {
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const holo = hologramMaterial();
    let built = false;
    const stage = createStage(
      el,
      (dt, time) => {
        if (!built) return;
        holo.uniforms.time.value = reduced ? 0 : time;
        const push = reduced ? 1 : THREE.MathUtils.smootherstep(time, 0, 6);
        stage!.camera.position.set(0.25 - push * 0.15, 1.5, 3.4 - push * 0.6);
        stage!.camera.lookAt(-0.1, 1.25, 0);
      },
      { fov: 40, exposure: 1.1 },
    );
    if (!stage) return;
    const { scene } = stage;
    scene.background = new THREE.Color(0x02040a);
    const city = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshBasicMaterial({ map: cityAtNight() }));
    city.position.set(0, 2, -3.2);
    scene.add(city);
    // The window's dark mullions.
    const frame = new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.6, metalness: 0.4 });
    for (let i = -3; i <= 3; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 4.5, 0.07), frame);
      bar.position.set(i * 1.3, 2, -3.1);
      scene.add(bar);
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 7), new THREE.MeshStandardMaterial({ color: 0x0b0a0c, roughness: 0.25, metalness: 0.5 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    // The chair's dark back, at the edge of the frame.
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.25), new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.35, metalness: 0.3 }));
    chair.position.set(-1.55, 0.9, -0.4);
    chair.rotation.y = 0.5;
    scene.add(chair);
    const lord = hoodedFigure();
    lord.position.set(0.45, 0, 0);
    lord.rotation.y = -0.35;
    scene.add(lord);
    // The commander's hologram, standing on its projector.
    const trooper = createSandtrooper().group;
    trooper.traverse((object) => {
      if (object instanceof THREE.Mesh) object.material = holo;
    });
    trooper.position.set(-0.7, 0.06, -0.5);
    trooper.rotation.y = 0.45;
    scene.add(trooper);
    const projector = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.06, 28), new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.4, metalness: 0.7 }));
    projector.position.set(-0.7, 0.03, -0.5);
    scene.add(projector);
    scene.add(new THREE.HemisphereLight(0x3a4a6a, 0x050407, 0.5));
    const windowLight = new THREE.DirectionalLight(0x8fb2e8, 1.4);
    windowLight.position.set(0.5, 2.5, -4);
    scene.add(windowLight);
    // A low, warm light catches the chin and hands under the hood.
    const under = new THREE.PointLight(0xd8c2aa, 1.6, 3, 2);
    under.position.set(0.7, 1.25, 0.9);
    scene.add(under);
    const glow = new THREE.PointLight(0x5aa8ff, 3, 4, 2);
    glow.position.set(-0.7, 1, -0.2);
    scene.add(glow);
    built = true;
    return () => stage.dispose();
  }, [reduced]);
  return <div ref={mount} className="order-sixtysix-scene" aria-hidden="true" />;
}
