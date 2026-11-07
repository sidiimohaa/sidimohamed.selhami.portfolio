"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import * as THREE from "three";
import { glowTexture } from "../landingKit";
import { createAirTaxi } from "../coruscantTaxi/taxiModel";
import { createAnakin, createCloneTemplate, createPadawan, createSaber, instantiateClone, marchClone, poseClone, type CloneRig } from "./cloneTrooperModel";
import { ARCHIVES_FROM, BALCONY, FALLING_COLUMN_Z, GALLERY_Y, HALL_END, WAY_Y, burningSky, createDrift, createEscapeAudio, createTempleExterior, createTempleHall } from "./orderEscapeWorld";
import { createStage } from "./stage";

// Order 66, reached only from the Imperial transmission that the secret code opens. Clones march
// up to the Jedi Temple; the visitor runs its great hall beside a padawan with a saber in hand,
// turning the bolts back, then meets Anakin and his Legion in the far door, and leaves by the balcony
// in the air taxi that brought them to Coruscant.

type Phase = "opening" | "hall" | "push" | "archives" | "vision" | "flee" | "jump" | "away" | "end";
type Trooper = CloneRig & {
  x: number;
  y: number;
  z: number;
  alive: boolean;
  fall: number;
  thrown: number;
  squad: boolean;
  spin: number;
};
type Bolt = {
  mesh: THREE.Mesh;
  ring: THREE.Sprite;
  from: THREE.Vector3;
  offset: THREE.Vector2;
  age: number;
  shooter: Trooper | null;
  back: boolean;
  active: boolean;
};

const HEALTH = 5;
const TAXI_WAITING = 0;
const TAXI_AWAY = 0.6;
const FLIGHT = 1.25;
const RING_DEPTH = 2.4;
const SPOTS: [number, number, number?][] = [
  [-20, -3.5],
  [-23, 3.5],
  [-30, -5],
  [-31, 5],
  [-38, -2.5],
  [-41, 3],
  [-47, -5],
  [-49, 1.5],
  [-53, 5],
  [-78, -3],
  [-82, 4],
  [-84, -7.2, GALLERY_Y],
  [-88, -5],
  [-92, 2],
  [-95, 7.2, GALLERY_Y],
  [-100, -7.2, GALLERY_Y],
  [-101, 3.5],
];
const SQUAD: [number, number][] = [
  [-66, -5],
  [-65, -3],
  [-66.5, -1],
  [-65, 1],
  [-66, 3],
  [-65.5, 5],
];
const STOP_PUSH = -57;
const STOP_VISION = (BALCONY.from + BALCONY.to) / 2;
const SHADOW_FROM = HALL_END + 2.5;
const FOV = 62;
// The Legion behind him, in a V, as they came through the doors.
const ESCORT: [number, number][] = [
  [-1.25, -1],
  [1.25, -1],
  [-1.9, -2.3],
  [1.9, -2.3],
  [-2.55, -3.6],
  [2.55, -3.6],
];

const lines: Partial<Record<Phase, string>> = {
  opening: "Coruscant, le Temple Jedi. La 501e légion monte la Voie processionnelle.",
  hall: "« Maître ! Ils tirent sur nous ! » Placez le sabre sur les cercles pour renvoyer les tirs.",
  push: "Ils barrent tout le hall. Il n’y a qu’un seul moyen de passer.",
  archives: "Les Archives ! Encore un effort, le balcon n’est plus très loin.",
  vision: "« Maître Skywalker ?… Que devons-nous faire ? »",
  flee: "Ne vous retournez pas. Par le balcon, vite !",
  jump: "Le taxi ! Il vous attend, sautez !",
};

export default function OrderEscape({ reduced, sound, onClose }: { reduced: boolean; sound: boolean; onClose: () => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("opening");
  const [health, setHealth] = useState(HEALTH);
  const [note, setNote] = useState<string | null>(null);
  const [deflected, setDeflected] = useState(0);
  const [fallback, setFallback] = useState(false);
  const [run, setRun] = useState(0);
  const [hurt, setHurt] = useState(0);
  const action = useRef<() => void>(() => undefined);
  const skip = useRef<() => void>(() => undefined);
  const endButton = useRef<HTMLButtonElement>(null);
  const closing = useRef(onClose);
  closing.current = onClose;

  useEffect(() => {
    if (phase === "end") endButton.current?.focus();
  }, [phase]);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const audio = sound ? createEscapeAudio() : null;
    const glow = glowTexture();
    const stageTick = { current: (_dt: number, _time: number) => undefined as void };
    const stage = createStage(el, (dt, time) => stageTick.current(dt, time), { fov: FOV, exposure: 1.08, look: "coruscant", adaptive: true });
    if (!stage) {
      setFallback(true);
      audio?.close();
      return;
    }
    const { scene, camera } = stage;
    camera.far = 6000;
    camera.updateProjectionMatrix();
    scene.add(camera);
    scene.background = new THREE.Color(0x120808);
    const fogInside = new THREE.FogExp2(0x1d1410, 0.017),
      fogOutside = new THREE.FogExp2(0x3a1a12, 0.00045);
    const sky = burningSky(2600, 2400);
    sky.position.y = 500;
    scene.add(sky);

    // The two places.
    const exterior = createTempleExterior(glow);
    const hall = createTempleHall(glow);
    scene.add(exterior.group, hall.group);
    const outsideLight = new THREE.HemisphereLight(0xffa377, 0x1d0d0a, 0.55),
      outsideSun = new THREE.DirectionalLight(0xffb184, 0.8);
    outsideSun.position.set(-200, 300, 500);
    const insideLight = new THREE.HemisphereLight(0xe8d6c4, 0x20130d, 0.7),
      windowLight = new THREE.DirectionalLight(0xff9958, 1.5);
    windowLight.position.set(1, 1.2, 0.3);
    const fireLight = new THREE.PointLight(0xff8a3c, 80, 40, 2),
      saberLight = new THREE.PointLight(0x62ff8c, 1.6, 6, 2),
      alarm = new THREE.PointLight(0x4ea8ff, 0, 6, 2),
      faceLight = new THREE.PointLight(0xffd6b0, 0, 4, 2),
      hoodLight = new THREE.PointLight(0xffe2c2, 0, 7, 2);
    // A cool light from the visitor's side, so that white armour stays white against the fires.
    const armourLight = new THREE.DirectionalLight(0xe4ecff, 1.05);
    camera.add(armourLight, armourLight.target);
    armourLight.position.set(0.2, 0.6, 0.4);
    armourLight.target.position.set(0, 0, -6);
    scene.add(outsideLight, outsideSun, insideLight, windowLight, fireLight, saberLight, alarm, faceLight, hoodLight);
    const setPlace = (inside: boolean) => {
      hall.group.visible = insideLight.visible = windowLight.visible = fireLight.visible = saberLight.visible = alarm.visible = faceLight.visible = hoodLight.visible = armourLight.visible = inside;
      exterior.group.visible = outsideLight.visible = outsideSun.visible = !inside;
      scene.fog = inside ? fogInside : fogOutside;
    };

    // The people.
    const template = createCloneTemplate();
    const makeTrooper = ([z, x, y = 0]: [number, number, number?], squad: boolean): Trooper => {
      const rig = instantiateClone(template);
      rig.group.visible = false;
      poseClone(rig, "aim");
      hall.group.add(rig.group);
      return { ...rig, x, y, z, alive: true, fall: 0, thrown: 0, squad, spin: (x > 0 ? 1 : -1) * (1 + Math.abs(x) * 0.3) };
    };
    const troopers = [...SPOTS.map((spot) => makeTrooper(spot, false)), ...SQUAD.map(([z, x]) => makeTrooper([z, x], true))];
    const placeTrooper = (t: Trooper) => {
      t.alive = true;
      t.fall = 0;
      t.thrown = 0;
      t.group.position.set(t.x, t.y, t.z);
      t.group.rotation.set(0, 0, 0);
      t.group.visible = false;
    };
    troopers.forEach(placeTrooper);
    const padawan = createPadawan();
    hall.group.add(padawan.group);
    const anakin = createAnakin();
    anakin.group.position.set(0, 0, SHADOW_FROM);
    anakin.group.visible = false;
    hall.group.add(anakin.group);
    const escort = ESCORT.map(([x, z], i) => {
      const rig = instantiateClone(template);
      poseClone(rig, "port");
      rig.group.position.set(x, 0, SHADOW_FROM + z);
      rig.group.visible = false;
      hall.group.add(rig.group);
      return { rig, phase: i * 1.7 };
    });
    const taxi = createAirTaxi({ glow });
    taxi.group.visible = false;
    scene.add(taxi.group);

    // The visitor's blade, carried by the camera.
    const blade = createSaber(0x47ff7e, 1.25);
    blade.setExtended(0);
    camera.add(blade.group);
    const flash = new THREE.PointLight(0x9ad0ff, 0, 12, 2);
    scene.add(flash);

    // Bolts and the circles that show where they will arrive.
    const boltGeometry = new THREE.CapsuleGeometry(0.028, 0.72, 3, 8),
      boltMaterial = new THREE.MeshBasicMaterial({ color: 0x8fd0ff, toneMapped: false }),
      boltHalo = new THREE.SpriteMaterial({ map: glow, color: 0x3f9dff, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const bolts: Bolt[] = Array.from({ length: 6 }, () => {
      const mesh = new THREE.Mesh(boltGeometry, boltMaterial);
      const halo = new THREE.Sprite(boltHalo);
      halo.scale.set(0.5, 0.5, 1);
      mesh.add(halo);
      mesh.visible = false;
      scene.add(mesh);
      const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture(), transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
      ring.visible = false;
      ring.renderOrder = 8;
      camera.add(ring);
      return { mesh, ring, from: new THREE.Vector3(), offset: new THREE.Vector2(), age: 0, shooter: null, back: false, active: false };
    });

    // Sparks where bolts land, and the shockwave of the Force.
    const sparks = Array.from({ length: 14 }, () => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xbfe6ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      scene.add(sprite);
      return { sprite, age: 1 };
    });
    let sparkNext = 0;
    const spark = (at: THREE.Vector3, size: number, color = 0xbfe6ff) => {
      const item = sparks[sparkNext++ % sparks.length];
      item.age = 0;
      item.sprite.position.copy(at);
      item.sprite.scale.setScalar(size);
      item.sprite.material.color.set(color);
      item.sprite.userData.size = size;
    };
    const wave = new THREE.Mesh(new THREE.RingGeometry(0.72, 1, 48), new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }));
    scene.add(wave);
    let waveAge = 9;
    const dust = createDrift(glow, 22, 0x2a1d17, 0.42);
    const embers = createDrift(glow, 26, 0xff9a4c, 0.8, THREE.AdditiveBlending);
    hall.group.add(dust.group, embers.group);

    // State of the run.
    let current: Phase = "opening";
    let clock = 0,
      phaseAge = 0,
      rail = 0,
      sideways = 0,
      nextShot = 1.2,
      life = HEALTH,
      returned = 0,
      checkpoint = 0,
      pushed = false,
      columnFall = -1,
      columnBoomed = false,
      shake = 0,
      saberOut = 0,
      fleeX = 0,
      turn = 0,
      lastBlade = new THREE.Vector2();
    const pointer = new THREE.Vector2(0.15, -0.05),
      goal = new THREE.Vector2(0.15, -0.05);
    const keys = new Set<string>();
    const go = (next: Phase) => {
      if (current === next) return;
      current = next;
      phaseAge = 0;
      setPhase(next);
      if (next === "hall" || next === "archives" || next === "push" || next === "vision") setPlace(true);
      if (next === "away" || next === "end") setPlace(false);
      if (next !== "hall" && next !== "archives") clearBolts();
      if (next === "flee") {
        camera.fov = FOV;
        camera.updateProjectionMatrix();
      }
    };
    setPlace(false);

    const clearBolts = () =>
      bolts.forEach((bolt) => {
        bolt.active = bolt.back = false;
        bolt.mesh.visible = bolt.ring.visible = false;
      });
    const restart = () => {
      clearBolts();
      life = HEALTH;
      setHealth(HEALTH);
      rail = checkpoint;
      setNote("« Relevez-vous, maître ! » Le padawan vous tire à l’abri.");
      window.setTimeout(() => setNote(null), 3200);
      troopers.forEach((t) => {
        if (t.z < rail && (t.squad ? !pushed : true)) placeTrooper(t);
      });
      nextShot = clock + 2;
      go(pushed ? "archives" : "hall");
    };
    const dropTrooper = (t: Trooper | null) => {
      if (!t || !t.alive) return;
      t.alive = false;
      t.fall = 0.001;
    };
    const fire = () => {
      const bolt = bolts.find((item) => !item.active);
      if (!bolt) return;
      const nearest = troopers.filter((t) => t.alive && t.group.visible && t.z < rail - 7 && t.z > rail - 36 && t.fall === 0 && !t.squad);
      if (!nearest.length) return;
      const shooter = nearest[Math.floor(Math.random() * nearest.length)];
      shooter.muzzle.getWorldPosition(bolt.from);
      bolt.mesh.position.copy(bolt.from);
      bolt.shooter = shooter;
      bolt.age = 0;
      bolt.active = true;
      bolt.back = false;
      bolt.offset.set((Math.random() * 2 - 1) * 0.62, -0.4 + Math.random() * 0.85);
      bolt.mesh.visible = bolt.ring.visible = true;
      audio?.bolt();
      spark(bolt.from, 0.7, 0x8fd0ff);
    };
    const force = () => {
      if (current !== "push" || pushed || phaseAge < 0.5) return;
      pushed = true;
      checkpoint = STOP_PUSH;
      audio?.push();
      waveAge = 0;
      wave.position.set(camera.position.x, 1.5, rail - 2);
      shake = reduced ? 0 : 1;
      troopers.forEach((t) => {
        if (t.squad && t.alive) {
          t.alive = false;
          t.thrown = 0.001;
        }
      });
      columnFall = 0;
      go("archives");
    };
    const leap = () => {
      if (current !== "jump" || phaseAge < 0.4) return;
      audio?.jump();
      audio?.humOff();
      go("away");
    };
    action.current = () => {
      force();
      leap();
    };
    skip.current = () => {
      if (current === "opening") {
        go("hall");
        return;
      }
      go("away");
    };

    // Where the bolt's circle sits: in the camera's frame, at the plane it will arrive on.
    const halfHeight = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const toRing = (offset: THREE.Vector2, out: THREE.Vector3) => out.set(offset.x * halfHeight() * camera.aspect * RING_DEPTH, offset.y * halfHeight() * RING_DEPTH, -RING_DEPTH);
    const worldPoint = new THREE.Vector3(),
      direction = new THREE.Vector3(),
      tipLocal = new THREE.Vector3(),
      up = new THREE.Vector3(0, 1, 0),
      look = new THREE.Vector3(),
      from = new THREE.Vector3(),
      to = new THREE.Vector3();

    const tick = (dt: number, time: number) => {
      clock = time;
      phaseAge += dt;
      const still = reduced;
      if (exterior.group.visible) exterior.tick(dt, time, still);
      if (hall.group.visible) hall.tick(time, still);
      // The guard follows the pointer, or the arrow keys.
      const keyStep = dt * 1.5;
      if (keys.has("ArrowLeft")) goal.x -= keyStep;
      if (keys.has("ArrowRight")) goal.x += keyStep;
      if (keys.has("ArrowUp")) goal.y += keyStep;
      if (keys.has("ArrowDown")) goal.y -= keyStep;
      goal.clampScalar(-0.95, 0.95);
      pointer.x = THREE.MathUtils.damp(pointer.x, goal.x, 16, dt);
      pointer.y = THREE.MathUtils.damp(pointer.y, goal.y, 16, dt);

      if (current === "opening") {
        const k = still ? 1 : THREE.MathUtils.smootherstep(phaseAge, 0, 9.5);
        camera.position.set(THREE.MathUtils.lerp(70, 7, k), WAY_Y + THREE.MathUtils.lerp(72, 13, k), THREE.MathUtils.lerp(780, 292, k));
        look.set(0, THREE.MathUtils.lerp(70, WAY_Y + 3, k * k), THREE.MathUtils.lerp(0, 240, k * k));
        camera.lookAt(look);
        if (phaseAge > (still ? 2.5 : 10)) go("hall");
      } else if (current === "away" || current === "end") {
        // Away over the city, with the Temple burning behind.
        const k = still ? 1 : THREE.MathUtils.smootherstep(Math.min(phaseAge, 12), 0, 12);
        const x = THREE.MathUtils.lerp(300, 720, k),
          y = THREE.MathUtils.lerp(20, 190, k),
          z = THREE.MathUtils.lerp(430, 1040, k);
        taxi.group.visible = true;
        taxi.setDoor(0);
        taxi.setThrust(1);
        taxi.group.position.set(x, y + (still ? 0 : Math.sin(time * 2.3) * 0.15), z);
        // Nose towards the open sky, leaving the Temple behind; the camera flies just ahead of it.
        taxi.group.rotation.set(-0.06, TAXI_AWAY, still ? 0 : -0.12);
        camera.position.set(x + 13, y + 3.4, z + 17);
        camera.lookAt(x - 4, y + 3, z - 6);
        if (phaseAge > 7) go("end");
      } else {
        // Inside.
        let speed = 0;
        if (current === "hall") speed = 3.9;
        if (current === "archives") speed = phaseAge < 3.4 ? 5.4 : 4.1;
        if (current === "hall" && rail <= STOP_PUSH) {
          rail = STOP_PUSH;
          go("push");
        }
        if (current === "archives" && rail <= STOP_VISION) {
          rail = STOP_VISION;
          go("vision");
        }
        rail += -speed * dt;
        sideways = THREE.MathUtils.damp(sideways, pointer.x * 1.5, 2.4, dt);
        if (current === "push" && phaseAge > 7) force();
        if (current === "hall" && rail < -30 && checkpoint > -28) checkpoint = -28;
        if (current === "archives" && rail < ARCHIVES_FROM + 8 && checkpoint > ARCHIVES_FROM - 4) checkpoint = ARCHIVES_FROM - 4;
        if (current === "vision") {
          // The lights die, one by one; the shadow stands in the door and lights its blade.
          anakin.group.visible = true;
          escort.forEach(({ rig }) => (rig.group.visible = true));
          insideLight.intensity = THREE.MathUtils.damp(insideLight.intensity, 0.16, 1.6, dt);
          windowLight.intensity = THREE.MathUtils.damp(windowLight.intensity, 0.2, 1.6, dt);
          fireLight.intensity = THREE.MathUtils.damp(fireLight.intensity, 4, 1.6, dt);
          if (phaseAge > 1.5 && alarm.intensity === 0) {
            audio?.ignite();
            alarm.intensity = 4;
          }
          anakin.saber.setExtended(THREE.MathUtils.smoothstep(phaseAge, 1.5, 1.85));
          if (alarm.intensity) alarm.intensity = 4 + (still ? 0 : Math.sin(time * 23) * 0.5);
          faceLight.intensity = 0.55;
          hoodLight.intensity = 6.5;
          // The shot closes in on him as he walks out of the dark.
          camera.fov = THREE.MathUtils.damp(camera.fov, 17, still ? 8 : 0.75, dt);
          camera.updateProjectionMatrix();
          if (phaseAge > 6.8) go("flee");
        }
        if (current === "flee") {
          turn = THREE.MathUtils.damp(turn, 1, 3.4, dt);
          fleeX += dt * 7.4 * turn;
          if (fleeX > BALCONY.edge - 6 - sideways) go("jump");
        }
        if (current === "jump") {
          taxi.group.visible = true;
          const k = THREE.MathUtils.smoothstep(phaseAge, 0, 1.4);
          taxi.group.position.set(BALCONY.edge + 2.6, THREE.MathUtils.lerp(-16, -0.7, k) + (still ? 0 : Math.sin(time * 2.4) * 0.1), (BALCONY.from + BALCONY.to) / 2);
          taxi.group.rotation.set(0, TAXI_WAITING, 0);
          taxi.setDoor(k);
          taxi.setThrust(0.6);
          if (phaseAge > 4.5) leap();
        }
        // The camera: running on the rail, then turning to the balcony.
        const bob = still || speed + (current === "flee" ? 1 : 0) === 0 ? 0 : Math.sin(time * 9.5) * 0.045;
        const x = sideways * (1 - turn) + fleeX;
        camera.position.set(x, 1.62 + bob, rail);
        // Whoever walks out of the door keeps walking, until the visitor is gone.
        if (anakin.group.visible) {
          const walk = still ? 0 : dt * 0.62;
          anakin.group.position.z += walk;
          anakin.tick(time, !still, still);
          escort.forEach(({ rig, phase }, i) => {
            rig.group.position.z = anakin.group.position.z + ESCORT[i][1];
            if (!still) marchClone(rig, time, phase);
          });
          const z = anakin.group.position.z;
          alarm.position.set(-0.8, 0.8, z + 1);
          faceLight.position.set(0.1, 1.78, z + 1.15);
          hoodLight.position.set(0.5, 3.7, z + 1.1);
        }
        look.set(pointer.x * 3.2 * (1 - turn) + turn * (x + 12), 1.6 + pointer.y * 1.5, rail - 12 * (1 - turn));
        if (current === "vision") look.set(0, 1.25, anakin.group.position.z);
        camera.lookAt(look);
        if (shake > 0 && !still) {
          camera.position.x += (Math.random() - 0.5) * 0.12 * shake;
          camera.position.y += (Math.random() - 0.5) * 0.12 * shake;
          shake = Math.max(0, shake - dt * 1.5);
        }
        camera.updateMatrixWorld();
        fireLight.position.set(x + Math.sin(time * 1.3) * 3, 5, rail - 9);
        saberLight.position.copy(camera.position).add(worldPoint.set(pointer.x * 0.6, -0.15, -1).applyQuaternion(camera.quaternion));
        if (!still && current !== "vision" && current !== "flee" && current !== "jump") fireLight.intensity = 80 + Math.sin(time * 13) * 14;

        // The padawan runs ahead and to one side, and freezes before the shadow.
        const aspect = Math.min(camera.aspect, 1.4);
        const beside = 0.55 + aspect * 0.72;
        padawan.group.position.x = turn > 0.2 ? x + 2.2 : x + beside;
        padawan.group.position.z = turn > 0.2 ? rail - 0.9 : rail - 2.5;
        padawan.group.rotation.y = THREE.MathUtils.lerp(Math.PI, Math.PI / 2, turn);
        padawan.tick(time, speed > 0 || current === "flee", still);

        // The clones.
        troopers.forEach((t) => {
          const near = t.z < rail + 6 && t.z > rail - 48;
          t.group.visible = near && (t.alive || t.fall < 4 || t.thrown > 0);
          if (!t.group.visible) return;
          if (t.thrown > 0) {
            t.thrown += dt;
            const k = Math.min(1, t.thrown / 1.6);
            t.group.position.set(t.x + t.spin * k * 2.4, 3.6 * Math.sin(Math.min(k * 1.2, 1) * Math.PI) * (1 - k * 0.3), t.z - k * 24);
            t.group.rotation.x = -k * (7 + Math.abs(t.spin));
            t.group.rotation.z = k * t.spin * 1.8;
            return;
          }
          if (t.fall > 0) {
            t.fall += dt;
            t.group.rotation.x = -Math.min(1, t.fall * 2.4) * (Math.PI / 2);
            return;
          }
          t.group.lookAt(camera.position.x, t.y, camera.position.z);
          t.head.rotation.x = 0.04;
          if (!still) {
            const stride = time * 3 + t.z;
            t.group.position.y = t.y + Math.abs(Math.sin(stride)) * 0.012;
          }
        });
        if ((current === "hall" || current === "archives") && time > nextShot) {
          fire();
          const danger = Math.min(1, Math.abs(rail) / 100);
          nextShot = time + THREE.MathUtils.lerp(1.5, 1.02, danger) * (0.8 + Math.random() * 0.4);
        }
        // The falling column, and the dust where it lands.
        if (columnFall >= 0) {
          columnFall += dt;
          const k = THREE.MathUtils.clamp((columnFall - 0.5) / 2.4, 0, 1);
          hall.column.rotation.z = -(k * k) * (Math.PI / 2 - 0.05);
          if (k >= 1 && !columnBoomed) {
            columnBoomed = true;
            audio?.boom();
            shake = still ? 0 : 1.4;
            spark(worldPoint.set(2, 1.2, FALLING_COLUMN_Z), 16, 0xffbb7a);
          }
        }
      }

      // The blade: extends when the fight begins, then points from the hand to the pointer.
      const fighting = current === "hall" || current === "push" || current === "archives";
      const wanted = fighting ? 1 : 0;
      if (wanted && saberOut === 0) audio?.ignite();
      saberOut = THREE.MathUtils.damp(saberOut, wanted, 11, dt);
      if (saberOut < 0.003 && !wanted) saberOut = 0;
      blade.group.visible = saberOut > 0;
      saberLight.intensity = 1.6 * saberOut;
      if (blade.group.visible) {
        blade.setExtended(saberOut);
        const hh = halfHeight();
        tipLocal.set(pointer.x * hh * camera.aspect * 1.7, pointer.y * hh * 1.7, -1.7);
        const hand = worldPoint.set(Math.min(0.42, 0.2 * camera.aspect), -0.74, -0.78);
        blade.group.position.copy(hand);
        direction.copy(tipLocal).sub(hand).normalize();
        blade.group.quaternion.setFromUnitVectors(up, direction);
        if (audio) {
          const motion = lastBlade.distanceTo(pointer) / Math.max(dt, 0.001);
          lastBlade.copy(pointer);
          audio.setHum(motion * 0.7);
        }
      }

      // Bolts: they home on their circle in the camera's frame, so the circle never lies.
      for (const bolt of bolts) {
        if (!bolt.active) continue;
        bolt.age += dt;
        if (bolt.back) {
          // Thrown back along the way it came: its shooter goes down when it lands.
          const k = Math.min(1, bolt.age / 0.32);
          bolt.shooter?.group.getWorldPosition(to);
          to.y += 1.3;
          from.copy(bolt.from);
          bolt.mesh.position.lerpVectors(from, to, k);
          direction.copy(to).sub(from).normalize();
          bolt.mesh.quaternion.setFromUnitVectors(up, direction);
          if (k >= 1) {
            dropTrooper(bolt.shooter);
            spark(to, 1.6);
            bolt.active = false;
            bolt.mesh.visible = false;
          }
          continue;
        }
        toRing(bolt.offset, tipLocal);
        const k = Math.min(1, bolt.age / FLIGHT);
        bolt.ring.position.copy(tipLocal);
        const size = THREE.MathUtils.lerp(0.72, 0.26, k);
        bolt.ring.scale.set(size, size, 1);
        const gap = Math.hypot((bolt.offset.x - pointer.x) * Math.max(camera.aspect, 0.8), bolt.offset.y - pointer.y);
        const guarded = gap < 0.32;
        bolt.ring.material.color.set(guarded ? 0x7dffa4 : 0xffc35c);
        bolt.ring.material.opacity = 0.45 + k * 0.55;
        camera.localToWorld(worldPoint.copy(tipLocal));
        bolt.mesh.position.lerpVectors(bolt.from, worldPoint, k);
        direction.copy(worldPoint).sub(bolt.from).normalize();
        bolt.mesh.quaternion.setFromUnitVectors(up, direction);
        if (k >= 1) {
          bolt.ring.visible = false;
          if (guarded) {
            returned += 1;
            setDeflected(returned);
            audio?.deflect();
            spark(worldPoint, 1.1, 0xc9ffd8);
            flash.position.copy(worldPoint);
            flash.intensity = 14;
            bolt.from.copy(worldPoint);
            bolt.back = true;
            bolt.age = 0;
          } else {
            bolt.active = false;
            bolt.mesh.visible = false;
            life -= 1;
            setHealth(life);
            setHurt((value) => value + 1);
            audio?.hit();
            shake = still ? 0 : 0.8;
            if (life <= 0) restart();
          }
        }
      }
      flash.intensity = Math.max(0, flash.intensity - dt * 70);
      for (const item of sparks) {
        if (item.age >= 1) continue;
        item.age = Math.min(1, item.age + dt * 3.6);
        item.sprite.material.opacity = 1 - item.age;
        item.sprite.scale.setScalar((item.sprite.userData.size as number) * (1 + item.age));
      }
      waveAge += dt;
      const waveKey = Math.min(1, waveAge / 0.7);
      (wave.material as THREE.MeshBasicMaterial).opacity = waveAge < 0.7 ? (1 - waveKey) * 0.75 : 0;
      wave.scale.setScalar(1 + waveKey * 16);
      if (hall.group.visible) {
        dust.tick(dt, (out) => {
          out.set(camera.position.x + (Math.random() - 0.5) * 16, Math.random() * 2.4, rail - 4 - Math.random() * 24);
          return 2.6 + Math.random() * 4;
        });
        embers.tick(dt, (out) => {
          out.set(camera.position.x + (Math.random() - 0.5) * 12, 0.4 + Math.random() * 2, rail - 3 - Math.random() * 15);
          return 0.09 + Math.random() * 0.1;
        });
      }
    };
    stageTick.current = tick;
    camera.position.set(70, WAY_Y + 72, 780);

    // Input: nothing typed here may also fly the ship underneath.
    const move = (event: PointerEvent) => {
      const box = el.getBoundingClientRect();
      goal.set(((event.clientX - box.left) / box.width) * 2 - 1, -(((event.clientY - box.top) / box.height) * 2 - 1));
    };
    const keydown = (event: KeyboardEvent) => {
      event.stopImmediatePropagation();
      if (event.key === "Escape") closing.current();
      if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        keys.add(event.key);
      }
      if ((event.key === " " || event.key === "Enter") && (current === "push" || current === "jump")) {
        event.preventDefault();
        action.current();
      }
    };
    const keyup = (event: KeyboardEvent) => {
      event.stopImmediatePropagation();
      keys.delete(event.key);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", move);
    window.addEventListener("keydown", keydown, true);
    window.addEventListener("keyup", keyup, true);
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __orderEscape?: unknown }).__orderEscape = {
        advance: (seconds: number) => {
          for (let t = 0; t < seconds; t += 1 / 30) tick(1 / 30, clock + 1 / 30);
        },
        rail: (z: number) => (rail = z),
        go,
        look: (x: number, y: number) => goal.set(x, y),
        state: () => ({ current, rail, life, returned, fleeX, phaseAge, shown: troopers.filter((t) => t.group.visible).length, calls: stage.renderer.info.render.calls }),
        action: () => action.current(),
        scene,
        camera,
      };
    }
    return () => {
      stageTick.current = () => undefined;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", move);
      window.removeEventListener("keydown", keydown, true);
      window.removeEventListener("keyup", keyup, true);
      audio?.close();
      stage.dispose();
      glow.dispose();
    };
  }, [reduced, sound, run]);

  const again = () => {
    setPhase("opening");
    setHealth(HEALTH);
    setDeflected(0);
    setNote(null);
    setRun((value) => value + 1);
  };
  const line = note ?? lines[phase];
  const playing = phase === "hall" || phase === "push" || phase === "archives";
  return (
    <motion.div className={`reward-scene order-escape phase-${phase}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label="Ordre 66 : la fuite du Temple Jedi">
      <div key={run} ref={mount} className="reward-scene-canvas" data-fallback={fallback} />
      {!reduced && hurt > 0 && <i key={hurt} className="order-escape-hurt" aria-hidden="true" />}
      <header className="reward-scene-head">
        <p className="jedi-eyebrow">ORDRE 66 · TEMPLE JEDI</p>
        <button className="jedi-close" onClick={onClose} aria-label="Quitter la fuite du Temple">
          <X size={16} />
        </button>
      </header>
      {playing && (
        <div className="order-escape-force mono" role="status" aria-label={`Force : ${health} sur ${HEALTH}. Tirs renvoyés : ${deflected}.`}>
          <span>FORCE</span>
          <b aria-hidden="true">
            {Array.from({ length: HEALTH }, (_, index) => (
              <i key={index} data-on={index < health} />
            ))}
          </b>
          <span>TIRS RENVOYÉS {deflected}</span>
        </div>
      )}
      {line && phase !== "end" && !fallback && (
        <p key={line} className="order-escape-line" role="status">
          {line}
        </p>
      )}
      {phase === "push" && (
        <button className="order-escape-action" onClick={() => action.current()}>
          POUSSÉE DE FORCE
        </button>
      )}
      {phase === "jump" && (
        <button className="order-escape-action" onClick={() => action.current()}>
          SAUTER
        </button>
      )}
      {(phase === "opening" || playing) && !fallback && (
        <button className="rank-cinematic-skip" onClick={() => skip.current()}>
          {phase === "opening" ? "ENTRER DANS LE TEMPLE" : "PASSER LA FUITE"}
        </button>
      )}
      {(phase === "end" || fallback) && (
        <div className="vader-outcome order-escape-end">
          <h2>LE PADAWAN EST SAUF</h2>
          <p>Cette nuit-là, presque tous les Jedi sont tombés. Mais la balise du Temple a été reprogrammée : elle avertit désormais les survivants de rester cachés et de ne jamais revenir.</p>
          {!fallback && deflected > 0 && <p className="mono order-escape-score">TIRS RENVOYÉS : {deflected}</p>}
          <div>
            {!fallback && (
              <button className="jedi-link" onClick={again}>
                Recommencer
              </button>
            )}
            <button ref={endButton} className="jedi-button" onClick={onClose}>
              Retour à la galaxie
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

let ringMap: THREE.Texture | null = null;
function ringTexture() {
  if (ringMap) return ringMap;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const c = canvas.getContext("2d")!;
  c.strokeStyle = "#ffffff";
  c.lineWidth = 7;
  c.beginPath();
  c.arc(64, 64, 50, 0, Math.PI * 2);
  c.stroke();
  c.lineWidth = 3;
  c.beginPath();
  c.arc(64, 64, 34, 0, Math.PI * 2);
  c.stroke();
  ringMap = new THREE.CanvasTexture(canvas);
  return ringMap;
}
