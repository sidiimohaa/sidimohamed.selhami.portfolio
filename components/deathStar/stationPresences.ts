import * as THREE from "three";
import { createDarthMaul, createCountDooku } from "./sithHumans";
import { createGeneralGrievous, createEmperorPalpatine, createRoyalGuard } from "./imperialCourt";
import { IMPERIAL_PRESENCES } from "./imperialRoster";
import type { RoomId } from "./stationWorld";

/** The figures stay separate from architecture batches so their joints can move. */
export function createStationPresences() {
  const group = new THREE.Group();
  group.name = "imperial-presences";
  const makers = { maul: createDarthMaul, dooku: createCountDooku, grievous: createGeneralGrievous, palpatine: createEmperorPalpatine };
  const actors = IMPERIAL_PRESENCES.map((entry) => {
    const model = makers[entry.id]();
    const placement = new THREE.Group();
    placement.name = `presence-${entry.id}`;
    placement.position.set(...entry.position); placement.rotation.y = entry.yaw;
    placement.add(model.group); group.add(placement);

    const shadow = new THREE.Mesh(new THREE.CircleGeometry(entry.radius * .82, 32), new THREE.MeshBasicMaterial({ color: 0x040508, transparent: true, opacity: .4, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.scale.y = .65; shadow.position.y = .014; placement.add(shadow);
    model.tick(0, true);
    return { ...entry, placement, model };
  });

  // The Emperor is accompanied by the red-robed Royal Guard from the reference images.
  const guards = [-1, 1].map((side) => {
    const model = createRoyalGuard();
    model.group.position.set(102 + side * 2.65, .18, -55.2);
    model.group.rotation.y = -side * .12;
    model.group.name = `royal-guard-${side < 0 ? "left" : "right"}`;
    group.add(model.group); model.tick(0, true);
    return model;
  });

  const metal = new THREE.MeshStandardMaterial({ color: 0x1a1d24, metalness: .65, roughness: .32 });
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.75, .18, 48), metal);
  dais.position.set(102, .09, -56.2); group.add(dais);
  // The raised seat stands behind the Emperor, its angular silhouette framing the hood.
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.25, .35, .8), metal); seat.position.set(102, .7, -57.25); group.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.45, 2.3, .22), metal); back.position.set(102, 1.48, -57.8); back.rotation.x = -.08; group.add(back);
  const key = new THREE.PointLight(0xdee8ff, 0, 8, 2); group.add(key);
  const lightOffset = new THREE.Vector3(.85, 2.65, 1.65);
  let lightMode = false;
  return {
    group, actors, guards,
    setLight: (light: boolean) => { lightMode = light; },
    tick: (time: number, reduced: boolean, player: THREE.Vector3, room: RoomId | null) => {
      const active = actors.find((entry) => entry.room === room);
      key.intensity = active ? (lightMode ? 9 : 15) : 0;
      if (active) key.position.copy(active.placement.position).add(lightOffset);
      for (const actor of actors) {
        actor.placement.visible = actor.room === room || Math.hypot(player.x - actor.position[0], player.z - actor.position[2]) < 27;
        if (actor.placement.visible) actor.model.tick(time, reduced);
      }
      guards.forEach((guard) => { guard.group.visible = room === "command" || player.distanceTo(guard.group.position) < 27; if (guard.group.visible) guard.tick(time, reduced); });
    },
  };
}
