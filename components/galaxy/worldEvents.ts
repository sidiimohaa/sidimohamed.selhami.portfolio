import * as THREE from "three";
import type { EventPlace } from "./catalog";
import { galaxy } from "./store";

// Small helpers for the events of the other worlds, which mostly push the weather and props those
// zones already have. `level` eases in and out, so nothing starts or stops with a jump.

export function eventLevels(place: EventPlace) {
  const levels = new Map<string, number>();
  return (id: string, dt: number, rate = 0.5) => {
    const on = galaxy().activeAt(place).some((run) => run.id === id);
    const level = (levels.get(id) ?? 0) + ((on ? 1 : 0) - (levels.get(id) ?? 0)) * (1 - Math.exp(-dt * rate));
    levels.set(id, level);
    return level;
  };
}

/** Something that crosses the scene along a path while its event runs, and then stays away. */
export function createFlyby(object: THREE.Object3D, path: THREE.Vector3[], seconds: number) {
  const curve = new THREE.CatmullRomCurve3(path);
  const ahead = new THREE.Vector3();
  object.visible = false;
  object.name = "event-flyby";
  let t = 1;
  let wanted = false;
  let wait = 0;
  return {
    /** Moves it; `on` is whether its event is running. Passes repeat with a short rest. */
    tick(dt: number, on: boolean) {
      wanted = on;
      if (t >= 1) {
        object.visible = false;
        if (!wanted) return;
        if ((wait -= dt) > 0) return;
        t = 0;
        wait = 2 + Math.random() * 2;
      }
      t = Math.min(1, t + dt / seconds);
      object.visible = true;
      curve.getPointAt(t, object.position);
      curve.getPointAt(Math.min(1, t + 0.01), ahead);
      object.lookAt(ahead);
    },
  };
}
