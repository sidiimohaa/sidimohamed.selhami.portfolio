"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  MapPin,
  Navigation,
  Orbit,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createCockpitModel } from "./cockpitModel";
import { createCockpitSystems } from "./cockpitSystems";
import { createCockpitProjection } from "./cockpitProjection";
import { createStarfield } from "./spaceAmbience";
import { destinations, landings, planetReferenceStyle } from "./universe";

type Props = {
  initialSelection: number;
  reduced: boolean;
  sound: boolean;
  onToggleSound: () => void;
  onSelectionCue: () => void;
  onClose: () => void;
  onLaunch: (index: number) => void;
};

export default function CockpitMap({
  initialSelection,
  reduced,
  sound,
  onToggleSound,
  onSelectionCue,
  onClose,
  onLaunch,
}: Props) {
  const [selected, setSelected] = useState(initialSelection);
  const [graphics, setGraphics] = useState(false);
  const mount = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const markers = useRef<(HTMLButtonElement | null)[]>([]);
  const live = useRef({ selected, reduced, onClose });
  live.current = { selected, reduced, onClose };
  const current = destinations[selected];
  const accessibleSurface = !!landings[current.name];

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        live.current.onClose();
      }
      if (event.key !== "Tab") return;
      const elements = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([tabindex="-1"]),a[href],[tabindex="0"]',
        ) ?? [],
      );
      const first = elements[0],
        last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => {
      window.removeEventListener("keydown", keyboard);
      const target =
        previous?.isConnected &&
        previous !== document.body &&
        !previous.closest("[inert]")
          ? previous
          : document.querySelector<HTMLButtonElement>(".map-trigger");
      target?.focus();
    };
  }, []);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, window.innerWidth < 600 ? 1.75 : 2),
    );
    renderer.setClearColor(0x03080e, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.setAttribute("aria-hidden", "true");
    el.append(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, 1, 0.05, 600);
    const cockpit = createCockpitModel();
    const systems = createCockpitSystems();
    cockpit.add(systems.group);
    const projection = createCockpitProjection();
    const stars = createStarfield(renderer.getPixelRatio());
    scene.add(cockpit, projection.group, stars.points);
    const studio = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(studio, 0.015, 0.1, 50);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.32;
    studio.dispose();
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0x8da9c9, 0x151b26, 1.5));
    const key = new THREE.DirectionalLight(0xd3c4ad, 2.6);
    key.position.set(-2, 4, 4);
    scene.add(key);
    const projectorLight = new THREE.PointLight(0x47ccff, 8, 8, 2);
    projectorLight.position.set(0, 1.1, -2.03);
    scene.add(projectorLight);
    const amber = new THREE.PointLight(0xff7b35, 2.5, 5, 2);
    amber.position.set(-1.6, 0.8, 0.3);
    scene.add(amber);
    const fill = new THREE.PointLight(0x709cc6, 5, 7, 2);
    fill.position.set(1.6, 2.2, 1.4);
    scene.add(fill);
    const look = new THREE.Vector3(0, 1.35, -3.4);
    const head = { x: 0, y: 0 },
      lean = { x: 0, y: 0 };
    const shell = dialog.current;
    const pointerMove = (event: PointerEvent) => {
      if (
        event.pointerType !== "mouse" ||
        (event.target as HTMLElement).closest("button,a")
      )
        return;
      const bounds = el.getBoundingClientRect();
      head.x = THREE.MathUtils.clamp(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -1,
        1,
      );
      head.y = THREE.MathUtils.clamp(
        1 - ((event.clientY - bounds.top) / bounds.height) * 2,
        -1,
        1,
      );
    };
    const pointerLeave = () => {
      head.x = 0;
      head.y = 0;
    };
    shell?.addEventListener("pointermove", pointerMove, { passive: true });
    shell?.addEventListener("pointerleave", pointerLeave);
    const projected = new THREE.Vector3();
    let width = 1,
      height = 1;
    const resize = () => {
      width = el.clientWidth;
      height = el.clientHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.fov = camera.aspect < 0.8 ? 58 : 52;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      projection.setCompact(camera.aspect < 0.8);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    let frame = 0,
      age = 0,
      last = performance.now(),
      activated = false;
    const animate = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      age += dt;
      const enter = live.current.reduced
        ? 1
        : THREE.MathUtils.smootherstep(age / 1.2, 0, 1);
      lean.x = THREE.MathUtils.damp(
        lean.x,
        live.current.reduced ? 0 : head.x,
        5,
        dt,
      );
      lean.y = THREE.MathUtils.damp(
        lean.y,
        live.current.reduced ? 0 : head.y,
        5,
        dt,
      );
      camera.position.set(
        lean.x * 0.028 * enter,
        THREE.MathUtils.lerp(2.3, 1.55, enter),
        THREE.MathUtils.lerp(6.5, 2.9, enter),
      );
      look.x = lean.x * 0.14 * enter;
      look.y = 1.35 + lean.y * 0.06 * enter;
      camera.lookAt(look);
      camera.updateMatrixWorld();
      projection.tick(age, live.current.selected, live.current.reduced);
      systems.tick(age, live.current.selected, live.current.reduced);
      projectorLight.intensity = live.current.reduced
        ? 8
        : 8 + Math.sin(age * 0.9) * 0.25;
      stars.tick(age, true);
      projection.group.updateMatrixWorld(true);
      projection.planets.forEach((planet, index) => {
        const marker = markers.current[index];
        if (!marker) return;
        planet.getWorldPosition(projected);
        const distance = camera.position.distanceTo(projected);
        projected.project(camera);
        const radius = Number(planet.userData.radius ?? 0.4);
        const diameter = THREE.MathUtils.clamp(
          (radius * height) /
            (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance),
          42,
          180,
        );
        marker.style.width = `${diameter}px`;
        marker.style.height = `${diameter}px`;
        marker.style.transform = `translate(${(projected.x * 0.5 + 0.5) * width - diameter / 2}px,${(-projected.y * 0.5 + 0.5) * height - diameter / 2}px)`;
      });
      renderer.render(scene, camera);
      if (!activated) {
        activated = true;
        setGraphics(true);
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      shell?.removeEventListener("pointermove", pointerMove);
      shell?.removeEventListener("pointerleave", pointerLeave);
      projection.dispose();
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.Points ||
          object instanceof THREE.Line
        ) {
          geometries.add(object.geometry);
          const items = Array.isArray(object.material)
            ? object.material
            : [object.material];
          items.forEach((material) => materials.add(material));
        }
      });
      materials.forEach((material) => {
        Object.values(material).forEach((value) => {
          if (value instanceof THREE.Texture) textures.add(value);
        });
        material.dispose();
      });
      textures.forEach((texture) => texture.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  const choose = (index: number, focus = false) => {
    setSelected(index);
    if (index !== selected) onSelectionCue();
    if (focus) markers.current[index]?.focus();
  };

  return (
    <motion.section
      ref={dialog}
      className="cockpit-map"
      data-graphics={graphics}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cockpit-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.15 : 0.5 }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="cockpit-fallback" aria-hidden="true" />
      <div ref={mount} className="cockpit-canvas" />
      <div className="cockpit-vignette" aria-hidden="true" />
      <header className="cockpit-titlebar">
        <div>
          <p className="cockpit-eyebrow">X-WING / ASTRONAVIGATION</p>
          <h2 id="cockpit-title">Carte stellaire</h2>
        </div>
        <div className="cockpit-controls">
          <button
            className="cockpit-audio"
            onClick={onToggleSound}
            aria-pressed={sound}
            aria-label={
              sound ? "Couper l’ambiance sonore" : "Activer l’ambiance sonore"
            }
          >
            {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            ref={close}
            className="cockpit-close"
            onClick={onClose}
            aria-label="Fermer la carte stellaire"
          >
            <X size={17} />
            <span>RETOUR</span>
            <kbd>ÉCHAP</kbd>
          </button>
        </div>
      </header>
      <motion.div
        className="cockpit-targets"
        role="group"
        aria-label="Destinations holographiques"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduced ? 0 : 0.55, duration: 0.35 }}
      >
        {destinations.map((planet, index) => (
          <button
            key={planet.name}
            ref={(element) => {
              markers.current[index] = element;
            }}
            className="holo-destination"
            aria-label={`Sélectionner ${planet.name}`}
            aria-pressed={selected === index}
            aria-controls="cockpit-planet-details"
            tabIndex={selected === index ? 0 : -1}
            onClick={() => choose(index)}
            onKeyDown={(event) => {
              const step =
                event.key === "ArrowRight" || event.key === "ArrowDown"
                  ? 1
                  : event.key === "ArrowLeft" || event.key === "ArrowUp"
                    ? -1
                    : 0;
              if (step) {
                event.preventDefault();
                choose(
                  (index + step + destinations.length) % destinations.length,
                  true,
                );
              }
              if (event.key === "Home" || event.key === "End") {
                event.preventDefault();
                choose(
                  event.key === "Home" ? 0 : destinations.length - 1,
                  true,
                );
              }
            }}
          >
            <span
              className="holo-fallback-globe"
              style={planetReferenceStyle(planet)}
              aria-hidden="true"
            />
            <span className="holo-name">
              {index === 3 ? "Étoile de la Mort" : planet.name}
            </span>
          </button>
        ))}
      </motion.div>
      <div className="cockpit-readout-shell">
        <motion.section
          className="cockpit-readout"
          id="cockpit-planet-details"
          aria-live="polite"
          aria-atomic="true"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : 0.7, duration: 0.4 }}
        >
          <motion.div
            key={current.name}
            className="cockpit-preview"
            role="img"
            aria-label={`Vue en couleur : ${current.name}`}
            style={planetReferenceStyle(current)}
            initial={{ opacity: 0.3 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduced ? 0 : 0.25 }}
          />
          <div className="cockpit-planet-copy">
            <p className="cockpit-eyebrow">
              {current.number} / {current.category}
            </p>
            <h3>{current.name}</h3>
            <p className="cockpit-description">{current.description}</p>
            <span className="cockpit-access">
              {accessibleSurface ? <MapPin size={11} /> : <Orbit size={11} />}{" "}
              {accessibleSurface
                ? "Zone d’atterrissage accessible"
                : "Exploration en orbite"}
            </span>
          </div>
          <button className="cockpit-launch" onClick={() => onLaunch(selected)}>
            <Navigation size={14} />
            <span>REJOINDRE L’ORBITE</span>
            <ArrowUpRight size={15} />
          </button>
        </motion.section>
      </div>
    </motion.section>
  );
}
