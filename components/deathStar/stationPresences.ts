import * as THREE from "three";
import { createDarthMaul, createCountDooku } from "./sithHumans";
import { createGeneralGrievous, createEmperorPalpatine, createRoyalGuard, type FigureRig } from "./imperialCourt";
import { IMPERIAL_PRESENCES, type ImperialPresenceId } from "./imperialRoster";
import type { RoomId } from "./stationWorld";

// What each presence does when the visitor interacts with it, before its record opens.
export type PerformanceKind = "lightning" | "spin" | "twirl" | "salute" | "choke";
export type Performance = { kind: PerformanceKind; duration: number; line: string };
export const PERFORMANCES: Record<ImperialPresenceId, Performance> = {
  palpatine: { kind: "lightning", duration: 3.2, line: "« Votre candidature m’intéresse… énormément. »" },
  grievous: { kind: "spin", duration: 3, line: "« Un dossier de cette qualité ferait une belle pièce de collection. »" },
  maul: { kind: "twirl", duration: 2.6, line: "Dark Maul fait tournoyer son sabre double, sans un mot." },
  dooku: { kind: "salute", duration: 2.4, line: "Le comte Dooku vous adresse le salut des duellistes." },
};

const smooth = (t: number, a: number, b: number) => THREE.MathUtils.smootherstep(t, a, b);

// Force lightning: jagged bolts drawn as ribbons turned towards the visitor, a bright core inside
// a wider blue glow, redrawn many times a second.
function createLightning() {
  const BOLTS = 10,
    SEGMENTS = 22;
  const layer = (width: number, color: number, opacity: number) => {
    const positions = new Float32Array(BOLTS * SEGMENTS * 6 * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    mesh.frustumCulled = false;
    return { mesh, positions, width };
  };
  const core = layer(0.012, 0xf2f8ff, 0.95),
    glow = layer(0.055, 0x6fb4ff, 0.24);
  const group = new THREE.Group();
  group.add(glow.mesh, core.mesh);
  group.visible = false;
  const points: THREE.Vector3[] = Array.from({ length: SEGMENTS + 1 }, () => new THREE.Vector3());
  const dir = new THREE.Vector3(),
    u = new THREE.Vector3(),
    v = new THREE.Vector3(),
    side = new THREE.Vector3(),
    view = new THREE.Vector3(),
    up = new THREE.Vector3(0, 1, 0);
  const write = (target: { positions: Float32Array; width: number }, bolt: number) => {
    for (let s = 0; s < SEGMENTS; s++) {
      const a = points[s],
        b = points[s + 1];
      dir.copy(b).sub(a);
      view.copy(eye).sub(a);
      // Thinner towards the visitor, so the end of the bolt does not fill the view.
      side.crossVectors(dir, view).normalize().multiplyScalar((target.width / 2) * (1 - 0.65 * (s / SEGMENTS)));
      const o = (bolt * SEGMENTS + s) * 18;
      const corners = [a.x - side.x, a.y - side.y, a.z - side.z, a.x + side.x, a.y + side.y, a.z + side.z, b.x + side.x, b.y + side.y, b.z + side.z, a.x - side.x, a.y - side.y, a.z - side.z, b.x + side.x, b.y + side.y, b.z + side.z, b.x - side.x, b.y - side.y, b.z - side.z];
      target.positions.set(corners, o);
    }
  };
  const eye = new THREE.Vector3();
  return {
    group,
    /** Redraws every bolt from the hands to just in front of the visitor's eyes. */
    strike: (hands: THREE.Vector3[], visitor: THREE.Vector3) => {
      eye.copy(visitor);
      for (let bolt = 0; bolt < BOLTS; bolt++) {
        const from = hands[bolt % hands.length];
        // Some bolts drop out at each redraw: the flicker of the discharge.
        if (Math.random() < 0.18) {
          core.positions.fill(0, bolt * SEGMENTS * 18, (bolt + 1) * SEGMENTS * 18);
          glow.positions.fill(0, bolt * SEGMENTS * 18, (bolt + 1) * SEGMENTS * 18);
          continue;
        }
        const to = view.copy(from).sub(visitor).setY(0).normalize().multiplyScalar(1.4).add(visitor);
        to.y -= 0.5;
        to.x += (Math.random() - 0.5) * 0.5;
        to.z += (Math.random() - 0.5) * 0.5;
        to.y += (Math.random() - 0.5) * 0.35;
        dir.copy(to).sub(from);
        u.crossVectors(dir, up).normalize();
        v.crossVectors(dir, u).normalize();
        const length = dir.length();
        for (let i = 0; i <= SEGMENTS; i++) {
          const t = i / SEGMENTS,
            amp = Math.sin(Math.PI * t) * length * 0.055 + 0.025;
          points[i].copy(from).lerp(to, t).addScaledVector(u, (Math.random() - 0.5) * 2 * amp).addScaledVector(v, (Math.random() - 0.5) * 2 * amp);
        }
        write(core, bolt);
        write(glow, bolt);
      }
      core.mesh.geometry.getAttribute("position").needsUpdate = true;
      glow.mesh.geometry.getAttribute("position").needsUpdate = true;
    },
    dispose: () => {
      for (const item of [core, glow]) {
        item.mesh.geometry.dispose();
        (item.mesh.material as THREE.Material).dispose();
      }
    },
  };
}

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
    // Rest poses, to return to after an easter egg.
    const weapon = model.rig?.weapon;
    const rest = { weaponPosition: weapon?.position.clone(), weaponRotation: weapon?.rotation.clone() };
    return { ...entry, placement, model, rest };
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
  const lightning = createLightning();
  group.add(lightning.group);
  const spark = new THREE.PointLight(0x8fc8ff, 0, 14, 1.6);
  group.add(spark);
  let lightMode = false;
  let show: { actor: (typeof actors)[number]; start: number; redraw: number } | null = null;
  const hands: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3()];

  // One frame of an easter egg; `t` runs from 0 to the performance's duration.
  const perform = (actor: (typeof actors)[number], t: number, time: number, reduced: boolean, visitor: THREE.Vector3) => {
    const rig: FigureRig | undefined = actor.model.rig;
    const { duration } = PERFORMANCES[actor.id];
    const on = smooth(t, 0, 0.35) * (1 - smooth(t, duration - 0.45, duration));
    if (actor.id === "palpatine" && rig) {
      // He leans in, lifts his face from the hood, and lightning pours from his hands.
      if (rig.body) rig.body.rotation.x = 0.07 * on;
      if (rig.head) rig.head.rotation.x = 0.06 - 0.14 * on;
      const live = t > 0.35 && t < duration - 0.35;
      lightning.group.visible = live;
      if (live && time >= show!.redraw) {
        show!.redraw = time + (reduced ? 0.25 : 0.05);
        actor.model.group.updateWorldMatrix(true, false);
        rig.hands!.forEach((hand, i) => actor.model.group.localToWorld(hands[i].copy(hand)));
        lightning.strike(hands, visitor);
      }
      spark.position.copy(hands[0]).lerp(hands[1], 0.5);
      spark.intensity = live ? (reduced ? 25 : 15 + Math.random() * 45) : 0;
    }
    if (actor.id === "grievous" && rig?.arms) {
      // The four arms whirl their blades like the blades of a fan, faster then slower.
      const turns = duration * 0.8 * smooth(t, 0, duration - 0.5) * (reduced ? 0.3 : 1);
      rig.arms.forEach((arm, i) => (arm.rotation.x = (i % 2 ? 1 : -1) * turns * Math.PI * 2 * 0.9));
      if (rig.head) rig.head.rotation.x = -0.055 + 0.12 * smooth(t, duration - 0.6, duration - 0.3) * (1 - smooth(t, duration - 0.2, duration));
    }
    if (actor.id === "maul" && rig?.weapon && actor.rest.weaponPosition) {
      // The double blade spins before him, lifted clear of the floor.
      const turns = 3.2 * smooth(t, 0, duration) * (reduced ? 0.25 : 1);
      rig.weapon.rotation.z = actor.rest.weaponRotation!.z + turns * Math.PI * 2;
      rig.weapon.position.y = actor.rest.weaponPosition.y + 0.18 * on;
    }
    if (actor.id === "dooku" && rig?.weapon && actor.rest.weaponPosition) {
      // The duellist's salute: blade up before the face, a bow, then a sweep down and back to rest.
      const raise = smooth(t, 0, 0.6) * (1 - smooth(t, 1.5, 2.0));
      const sweep = smooth(t, 1.5, 1.9) * (1 - smooth(t, 1.95, 2.4));
      const rest = actor.rest;
      rig.weapon.position.copy(rest.weaponPosition!).lerp(new THREE.Vector3(-0.06, 1.26, 0.3), raise).lerp(new THREE.Vector3(0.16, 0.92, 0.34), sweep);
      rig.weapon.rotation.set(rest.weaponRotation!.x * (1 - raise), 0, THREE.MathUtils.lerp(THREE.MathUtils.lerp(rest.weaponRotation!.z, 0, raise), -2.4, sweep));
      if (rig.upper) rig.upper.rotation.x = 0.1 * smooth(t, 0.6, 0.9) * (1 - smooth(t, 1.3, 1.6));
    }
  };
  const finish = (actor: (typeof actors)[number]) => {
    const rig: FigureRig | undefined = actor.model.rig;
    lightning.group.visible = false;
    spark.intensity = 0;
    rig?.arms?.forEach((arm) => (arm.rotation.x = 0));
    if (rig?.weapon && actor.rest.weaponPosition) {
      rig.weapon.position.copy(actor.rest.weaponPosition);
      rig.weapon.rotation.copy(actor.rest.weaponRotation!);
    }
    if (rig?.upper) rig.upper.rotation.x = 0;
    if (rig?.body) rig.body.rotation.x = 0;
  };

  return {
    group, actors, guards,
    setLight: (light: boolean) => { lightMode = light; },
    /** Starts a presence's easter egg; returns what to show and for how long. */
    perform: (id: ImperialPresenceId): Performance | null => {
      const actor = actors.find((entry) => entry.id === id);
      if (!actor) return null;
      if (show) finish(show.actor);
      show = { actor, start: -1, redraw: 0 };
      return PERFORMANCES[id];
    },
    tick: (time: number, reduced: boolean, player: THREE.Vector3, room: RoomId | null) => {
      const active = actors.find((entry) => entry.room === room);
      key.intensity = active ? (lightMode ? 9 : 15) : 0;
      if (active) key.position.copy(active.placement.position).add(lightOffset);
      for (const actor of actors) {
        actor.placement.visible = actor.room === room || Math.hypot(player.x - actor.position[0], player.z - actor.position[2]) < 27;
        if (actor.placement.visible) actor.model.tick(time, reduced);
      }
      guards.forEach((guard) => { guard.group.visible = room === "command" || player.distanceTo(guard.group.position) < 27; if (guard.group.visible) guard.tick(time, reduced); });
      if (show) {
        if (show.start < 0) show.start = time;
        const t = time - show.start;
        if (t >= PERFORMANCES[show.actor.id].duration) {
          finish(show.actor);
          show = null;
        } else perform(show.actor, t, time, reduced, player);
      }
    },
    dispose: () => lightning.dispose(),
  };
}
