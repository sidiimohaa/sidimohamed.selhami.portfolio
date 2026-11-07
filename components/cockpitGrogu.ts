import * as THREE from "three";
import { createSeatedGrogu } from "./groguModel";

// The stowaway: after a long, quiet while in the cockpit Grogu's ears rise behind the dashboard. He
// climbs up, looks at the pilot, and pulls the ball off the lever beside him. Take it back and he
// sulks, then tries again; take it back a second time and he slips away for the rest of the visit.

const SEAT = new THREE.Vector3(-1.3, 0.98, -1.62);
const SCALE = 1.35;
const WAIT = 45;
type State = "waiting" | "peek" | "climb" | "watch" | "reach" | "holding" | "scolded" | "leaving" | "gone";
const LENGTHS: Partial<Record<State, number>> = { peek: 2.8, climb: 1.1, watch: 3.2, reach: 1.7, scolded: 6, leaving: 1.3 };

let goneForThisVisit = false;

export function createCockpitGrogu() {
  const grogu = createSeatedGrogu(0);
  grogu.group.name = "cockpit-grogu";
  grogu.group.scale.setScalar(SCALE);
  grogu.group.visible = false;
  const group = new THREE.Group();
  group.add(grogu.group);
  // The lever and its polished ball, on the dashboard to his side.
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.26, 10), new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.45, metalness: 0.7 }));
  stem.position.set(SEAT.x + 0.42, SEAT.y + 0.1, SEAT.z + 0.14);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.058, 22, 16), new THREE.MeshStandardMaterial({ color: 0xc9ced3, roughness: 0.16, metalness: 0.95 }));
  const lever = new THREE.Vector3(stem.position.x, stem.position.y + 0.15, stem.position.z);
  ball.position.copy(lever);
  group.add(stem, ball);
  const anchor = new THREE.Object3D();
  anchor.position.set(SEAT.x, SEAT.y + 1.06, SEAT.z);
  group.add(anchor);

  let state: State = goneForThisVisit ? "gone" : "waiting",
    age = 0,
    quiet = 0,
    taken = 0,
    time = 0;
  const hand = new THREE.Vector3(SEAT.x + 0.02, SEAT.y + 0.36, SEAT.z + 0.33);
  const go = (next: State) => {
    state = next;
    age = 0;
    grogu.group.visible = next !== "waiting" && next !== "gone";
    if (next === "gone") goneForThisVisit = true;
  };
  const place = (y: number, z = SEAT.z) => grogu.group.position.set(SEAT.x, y, z);
  return {
    group,
    anchor,
    // calm: nothing else is open. Returns "pulled" on the frame the ball comes away.
    tick(dt: number, reduced: boolean, calm: boolean): "pulled" | null {
      time += dt;
      if (state === "gone") return null;
      if (state === "waiting") {
        quiet = calm ? quiet + dt : quiet;
        if (quiet >= WAIT) go("peek");
        return null;
      }
      age += dt;
      grogu.tick(time, reduced);
      const length = LENGTHS[state] ?? 0;
      const k = length ? THREE.MathUtils.clamp(age / length, 0, 1) : 1;
      let event: "pulled" | null = null;
      if (state === "peek") {
        // Only the ears and the top of the head, behind the dashboard.
        place(SEAT.y - 0.54 + (reduced ? 0.2 : THREE.MathUtils.smoothstep(k, 0, 0.4) * 0.14 + (k > 0.7 ? (k - 0.7) * 0.25 : 0)), SEAT.z - 0.28);
        grogu.head.rotation.y += Math.sin(age * 2.2) * 0.3;
        if (k >= 1) go("climb");
      } else if (state === "climb") {
        place(THREE.MathUtils.lerp(SEAT.y - 0.3, SEAT.y, k) + (reduced ? 0 : Math.sin(k * Math.PI) * 0.16), THREE.MathUtils.lerp(SEAT.z - 0.28, SEAT.z, k));
        if (k >= 1) go("watch");
      } else if (state === "watch") {
        place(SEAT.y);
        // He tilts his head at the pilot, then sees the shiny thing beside him.
        grogu.head.rotation.z += 0.16;
        grogu.head.rotation.y = k > 0.65 ? -0.75 : 0.1;
        if (k >= 1) go("reach");
      } else if (state === "reach") {
        place(SEAT.y);
        grogu.head.rotation.y = -0.55;
        grogu.group.rotation.y = -k * 0.4;
        grogu.arms[0].rotation.x = -k * 1.25;
        grogu.arms[1].rotation.x = -k * 1.25;
        ball.position.copy(lever);
        if (!reduced && k > 0.5) ball.position.x += Math.sin(age * 34) * 0.012 * k;
        if (k >= 1) {
          event = "pulled";
          go("holding");
        }
      } else if (state === "holding") {
        place(SEAT.y);
        grogu.group.rotation.y = THREE.MathUtils.damp(grogu.group.rotation.y, 0, 3, dt);
        grogu.head.rotation.y = 0;
        grogu.head.rotation.x = 0.16;
        grogu.head.rotation.z = reduced ? 0.1 : Math.sin(time * 1.1) * 0.12;
        grogu.arms[0].rotation.x = grogu.arms[1].rotation.x = -1.25;
        ball.position.lerp(hand, 1 - Math.exp(-dt * 10));
      } else if (state === "scolded") {
        place(SEAT.y);
        // Ears down, eyes on the floor, and already looking at the ball again.
        grogu.head.rotation.x = k < 0.7 ? 0.42 : 0.15;
        grogu.head.rotation.y = k < 0.7 ? 0.3 : -0.7;
        ball.position.lerp(lever, 1 - Math.exp(-dt * 12));
        if (k >= 1) go("reach");
      } else if (state === "leaving") {
        place(THREE.MathUtils.lerp(SEAT.y, SEAT.y - 0.75, k) + (reduced ? 0 : Math.sin(k * Math.PI) * 0.1), THREE.MathUtils.lerp(SEAT.z, SEAT.z - 0.3, k));
        ball.position.lerp(lever, 1 - Math.exp(-dt * 12));
        if (k >= 1) {
          ball.position.copy(lever);
          go("gone");
        }
      }
      return event;
    },
    take() {
      if (state !== "holding") return;
      taken += 1;
      go(taken >= 2 ? "leaving" : "scolded");
    },
    // Development only, to see him without waiting.
    hurry: () => {
      if (state === "waiting") quiet = WAIT;
    },
    state: () => state,
  };
}
