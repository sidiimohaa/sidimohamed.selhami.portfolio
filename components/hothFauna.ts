import * as THREE from "three";
import { createStandingHuman } from "./humanFigure";
import { bakePart } from "./tatooineCharacters";
import { createTauntaun } from "./tauntaunModel";
import { createWampa } from "./wampaModel";

// Life out on the snow beyond the hangar's mouth: a pair of riders patrolling on tauntauns, in and
// out of the storm, and now and then a wampa that comes to look at the base from the plain.

type Height = (x: number, z: number) => number;
type Walker = { x: number; z: number; yaw: number };

// A Rebel in a padded parka, sitting a saddle: posed once, then baked, since nothing moves apart
// from the animal under them.
function createRider(seed: number) {
  const parka = 0x9a9c92 + seed * 0x040404;
  const human = createStandingHuman(
    { name: `hoth-rider-${seed}`, skin: seed ? 0x8d5f43 : 0xd9b49a, hair: 0x241a12, iris: 0x3a2c20, hairStyle: "short", tunic: parka, trousers: 0x6e7068, boots: 0x2a2826, belt: 0x37322a, gloves: 0x2b2926 },
    ({ body, head }, { box, ball }) => {
      const padded = new THREE.MeshStandardMaterial({ color: parka, roughness: 0.95 });
      const lens = new THREE.MeshStandardMaterial({ color: 0x1b2730, roughness: 0.25, metalness: 0.6 });
      // A hood over a thick collar, snow goggles, and a pack on the back.
      ball(body, [0, 1.42, -0.01], [0.17, 0.09, 0.15], padded);
      box(body, [0, 1.2, -0.17], [0.3, 0.42, 0.13], padded, 0.04);
      ball(head, [0, 0.13, -0.03], [0.14, 0.135, 0.145], padded);
      box(head, [0, 0.1, 0.105], [0.17, 0.05, 0.03], lens, 0.012);
    },
  );
  human.legs.forEach((leg, i) => {
    leg.root.rotation.set(-1, 0, (i ? 1 : -1) * 0.42);
    leg.joint.rotation.x = 1.1;
  });
  human.arms.forEach((arm) => {
    arm.root.rotation.x = -0.75;
    arm.joint.rotation.x = -0.65;
  });
  bakePart(human.group);
  human.group.position.set(0, 1.42, -0.34);
  return human.group;
}

export function createHothFauna(ground: Height) {
  const group = new THREE.Group();
  group.name = "hoth-fauna";

  // Riders come in from the far plain, pass in front of the mouth and ride off the other way.
  const route = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-210, 0, 196),
      new THREE.Vector3(-112, 0, 112),
      new THREE.Vector3(-46, 0, 68),
      new THREE.Vector3(-8, 0, 67),
      new THREE.Vector3(32, 0, 74),
      new THREE.Vector3(84, 0, 104),
      new THREE.Vector3(200, 0, 214),
    ],
    false,
    "catmullrom",
    0.4,
  );
  const length = route.getLength();
  const patrol = [0, 1].map((seed) => {
    const animal = createTauntaun(seed + 3);
    animal.root.name = "hoth-patrol";
    animal.root.add(createRider(seed));
    animal.root.visible = false;
    group.add(animal.root);
    return { ...animal, seed };
  });
  const SPEED = 5.2;
  const PAUSE = 24;
  let travelled = -18;
  let backwards = false;
  const at = new THREE.Vector3(),
    tangent = new THREE.Vector3();

  // The wampa walks in from behind a drift to a spot it can see the mouth from, then goes back.
  const wampa = createWampa();
  wampa.group.name = "hoth-wampa-far";
  wampa.group.scale.setScalar(1.3);
  wampa.group.visible = false;
  group.add(wampa.group);
  const FAR_SPOT = new THREE.Vector3(-82, 0, 96),
    WATCH_SPOT = new THREE.Vector3(-29, 0, 63);
  const reach = FAR_SPOT.distanceTo(WATCH_SPOT);
  const STRIDE = 3.1;
  const WATCH = 7;
  let stage: "wait" | "come" | "watch" | "leave" = "wait";
  let timer = 35;
  let clock = 0;
  const wampaAt = new THREE.Vector3();

  return {
    group,
    tick(dt: number, reduced: boolean, walker: Walker) {
      if (reduced) {
        // No wandering for those who asked the scene to keep still.
        patrol.forEach((rider) => (rider.root.visible = false));
        wampa.group.visible = false;
        return;
      }
      clock += dt;
      travelled += SPEED * dt;
      const riding = travelled >= 0 && travelled <= length + 9;
      patrol.forEach((rider, i) => {
        const along = travelled - i * 8.5;
        const shown = riding && along >= 0 && along <= length;
        rider.root.visible = shown;
        if (!shown) return;
        const t = (backwards ? length - along : along) / length;
        route.getPointAt(t, at);
        route.getTangentAt(t, tangent);
        if (backwards) tangent.negate();
        // Side by side rather than nose to tail when the path allows it.
        const offset = i ? 2.1 : -1.4;
        at.x += -tangent.z * offset;
        at.z += tangent.x * offset;
        rider.root.position.set(at.x, ground(at.x, at.z), at.z);
        rider.root.rotation.y = Math.atan2(tangent.x, tangent.z);
        rider.tick(clock, false);
        rider.walk(clock * 5.4 + i * 1.3, 1);
      });
      if (travelled > length + 9 + PAUSE * SPEED) {
        travelled = -9;
        backwards = !backwards;
      }

      timer -= dt;
      if (stage === "wait") {
        wampa.group.visible = false;
        // It only shows itself to someone looking out over the plain.
        if (timer <= 0) {
          if (walker.z > 20 && -Math.cos(walker.yaw) > 0.25) {
            stage = "come";
            timer = reach / STRIDE;
          } else timer = 4;
        }
        return;
      }
      wampa.group.visible = true;
      const k = stage === "come" ? 1 - timer / (reach / STRIDE) : stage === "leave" ? timer / (reach / STRIDE) : 1;
      wampaAt.lerpVectors(FAR_SPOT, WATCH_SPOT, THREE.MathUtils.clamp(k, 0, 1));
      const moving = stage !== "watch";
      const sway = clock * 3.2;
      wampa.group.position.set(wampaAt.x, ground(wampaAt.x, wampaAt.z) + (moving ? Math.abs(Math.sin(sway)) * 0.12 : 0), wampaAt.z);
      const heading = stage === "leave" ? Math.atan2(FAR_SPOT.x - WATCH_SPOT.x, FAR_SPOT.z - WATCH_SPOT.z) : stage === "come" ? Math.atan2(WATCH_SPOT.x - FAR_SPOT.x, WATCH_SPOT.z - FAR_SPOT.z) : Math.atan2(walker.x - wampaAt.x, walker.z - wampaAt.z);
      const gap = Math.atan2(Math.sin(heading - wampa.group.rotation.y), Math.cos(heading - wampa.group.rotation.y));
      wampa.group.rotation.y += gap * Math.min(1, dt * 2.4);
      wampa.group.rotation.z = moving ? Math.sin(sway) * 0.07 : 0;
      // A long look at the base, a roar, and it turns away.
      const roar = stage === "watch" ? Math.max(0, Math.sin(((WATCH - timer) / WATCH) * Math.PI)) : 0;
      wampa.pose(clock, roar, 0, false);
      if (timer <= 0) {
        if (stage === "come") {
          stage = "watch";
          timer = WATCH;
        } else if (stage === "watch") {
          stage = "leave";
          timer = reach / STRIDE;
        } else {
          stage = "wait";
          timer = 70 + Math.random() * 50;
        }
      }
    },
  };
}
