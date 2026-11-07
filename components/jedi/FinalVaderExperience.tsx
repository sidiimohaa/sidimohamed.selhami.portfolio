"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, RotateCcw, X } from "lucide-react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createForceGhosts } from "../endorGhosts";
import { choosePath, type Path } from "../jediProgression";
import { glowTexture } from "../landingKit";
import { createSaber } from "./cloneTrooperModel";
import { createEscapeAudio, ringTexture } from "./orderEscapeWorld";
import { createStage } from "./stage";
import { createVaderChamber } from "./vaderChamber";
import { createDarkLord } from "./vaderModel";

// The Chosen One's reward: Vader's fortress on Mustafar. His medical chamber opens, the helmet comes
// down on to the scarred head, the seat turns, he stands, lights his blade and walks out to offer his hand.
// Then the choice. To refuse him is to fight him: parry each blow with the blade under the pointer, and
// every parry drives him back towards his chamber. Beaten, he can be spared, which brings the dawn and
// the Force ghosts, or replaced, which brings the banners and the lightning, as does kneeling at once. The choice is remembered but never costs any XP or mission; the
// scene can be replayed from the rewards.

type Phase = "reveal" | "choice" | "duel" | "spare" | "fallen" | "jedi" | "sith";

// A synthesised respirator: filtered noise swelling in and out, nothing sampled.
function startBreathing() {
  if (typeof AudioContext === "undefined") return () => {};
  const context = new AudioContext();
  const length = context.sampleRate * 2;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const noise = context.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  const band = context.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 1.4;
  const valve = context.createBiquadFilter();
  valve.type = "peaking";
  valve.frequency.value = 340;
  valve.gain.value = 9;
  const gain = context.createGain();
  gain.gain.value = 0;
  noise.connect(band).connect(valve).connect(gain).connect(context.destination);
  noise.start();
  const cycle = 4.2;
  const schedule = (from: number) => {
    for (let n = 0; n < 12; n++) {
      const t = from + n * cycle;
      // In: a rising hiss. Out: a lower, rougher exhale.
      band.frequency.setValueAtTime(900, t);
      band.frequency.linearRampToValueAtTime(1500, t + 1.5);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.5);
      gain.gain.linearRampToValueAtTime(0.16, t + 1.4);
      gain.gain.linearRampToValueAtTime(0, t + 1.75);
      band.frequency.setValueAtTime(520, t + 2);
      band.frequency.linearRampToValueAtTime(380, t + 3.6);
      gain.gain.setValueAtTime(0, t + 2);
      gain.gain.linearRampToValueAtTime(0.26, t + 2.4);
      gain.gain.linearRampToValueAtTime(0.12, t + 3.4);
      gain.gain.linearRampToValueAtTime(0, t + 3.8);
    }
  };
  schedule(context.currentTime + 0.6);
  return () => {
    gain.gain.cancelScheduledValues(context.currentTime);
    gain.gain.setTargetAtTime(0, context.currentTime, 0.1);
    window.setTimeout(() => context.close(), 400);
  };
}


// When each beat of the reveal happens, in seconds.
const OPEN = [1.4, 4.4] as const;
const HELMET = [4.6, 7] as const;
const TURN = [7.7, 9.1] as const;
const RISE = [9.2, 10.3] as const;
const IGNITE = 10.5;
const WALK = [11.1, 14.2] as const;
const REACH = [13.9, 15.1] as const;
const END = 15.5;
const SEATED_DROP = 0.4;
const POD_Z = -4;
const STOP_Z = -1.2;
const HEAD_Y = 1.86;
const captions: [number, string][] = [
  [0.4, "Mustafar. La forteresse de Dark Vador."],
  [4.6, ""],
  [14, "« Rejoignez-moi. Ensemble, nous gouvernerons la galaxie. »"],
];
const DUEL_LIFE = 5;
const DUEL_HITS = 10;
const PUSH = 0.13;
const RING_DEPTH = 2.4;
const CHOKE_SECONDS = 3.4;
const CHOKE_MASHES = 7;
const span = (t: number, [from, to]: readonly [number, number]) => THREE.MathUtils.smootherstep(t, from, to);

export default function FinalVaderExperience({ reduced, sound, onClose }: { reduced: boolean; sound: boolean; onClose: () => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("reveal");
  const [caption, setCaption] = useState("");
  const [run, setRun] = useState(0);
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const choiceRef = useRef<HTMLButtonElement>(null);
  const [duel, setDuel] = useState({ life: DUEL_LIFE, hits: 0 });
  const [hurt, setHurt] = useState(0);
  const [choke, setChoke] = useState(false);
  const resist = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (phase === "choice" || phase === "spare" || phase === "fallen") choiceRef.current?.focus();
  }, [phase]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  useEffect(() => {
    if (!sound) return;
    return startBreathing();
  }, [sound, run]);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const audio = sound ? createEscapeAudio() : null;
    const glow = glowTexture();
    let beat = reduced ? END : 0,
      since = 0,
      lastPhase: Phase = "reveal",
      said = "",
      hissed = false,
      lit = false,
      rumbled = false,
      crackle = 0,
      kneeled = 0,
      lordZ = POD_Z,
      fallenView = 0,
      duelPush = 0,
      duelLife = DUEL_LIFE,
      duelHits = 0,
      nextBlow = 0,
      blowAge = -1,
      blowLength = 1,
      blows = 0,
      chokeLeft = 0,
      mashes = 0,
      shake = 0,
      clashAge = 1;
    const guardX = { value: -1.0 },
      guardZ = { value: 0.12 },
      guardElbow = { value: -0.8 };
    const blow = new THREE.Vector2();
    const pointer = new THREE.Vector2(0.1, 0),
      goal = new THREE.Vector2(0.1, 0);
    const heldKeys = new Set<string>();
    const tipLocal = new THREE.Vector3(),
      direction = new THREE.Vector3(),
      upAxis = new THREE.Vector3(0, 1, 0);
    const eye = new THREE.Vector3(),
      gaze = new THREE.Vector3(),
      farAway = new THREE.Vector3(0, 0, 9999),
      local = new THREE.Vector3();
    const tickRef = { current: (_dt: number, _time: number) => undefined as void };
    const stage = createStage(el, (dt, time) => tickRef.current(dt, time), { fov: 45, exposure: 1, look: "deathstar", adaptive: true });
    if (!stage) return;
    const { scene, camera, renderer } = stage;
    camera.far = 1500;
    camera.updateProjectionMatrix();
    scene.add(camera);
    scene.background = new THREE.Color(0x030102);
    scene.fog = new THREE.FogExp2(0x0a0304, 0.022);
    // A faint studio reflection so the helmet and armour read glossy, not flat black.
    const pmrem = new THREE.PMREMGenerator(renderer),
      room = new RoomEnvironment();
    const reflections = pmrem.fromScene(room, 0.04);
    scene.environment = reflections.texture;
    scene.environmentIntensity = 0.42;
    pmrem.dispose();
    room.dispose();

    const chamber = createVaderChamber(glow);
    scene.add(chamber.group);
    const lord = createDarkLord();
    lord.setBlade(0);
    lord.group.position.set(0, 0, POD_Z);
    lord.group.rotation.y = Math.PI;
    lord.arms.left.root.rotation.set(0, 0, -0.1);
    lord.arms.left.elbow.rotation.x = -0.2;
    scene.add(lord.group);
    // The head under the helmet, scarred and pale, seen only from behind and only for a moment.
    const bare = chamber.scarredHead();
    bare.position.y = HEAD_Y - 0.07;
    lord.group.add(bare);
    const reach = { x: -1.25, y: 0.25, z: -0.12, elbow: -0.25 };
    const hold = { x: -0.15, z: 0.12, elbow: -0.55 };
    lord.head.position.y = HEAD_Y + 1.15;

    // The visitor's own blade, for the one who refuses him.
    const answer = createSaber(0x4aa6ff, 1.05);
    answer.setExtended(0);
    answer.group.position.set(Math.min(0.72, 0.42 * camera.aspect), -0.74, -1.25);
    answer.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-0.06, 0.8, -0.6).normalize());
    camera.add(answer.group);
    const restingBlade = { position: answer.group.position.clone(), quaternion: answer.group.quaternion.clone() };
    // Where each blow will land, and the flash of the blades meeting.
    const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture(), transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    ring.visible = false;
    ring.renderOrder = 8;
    camera.add(ring);
    const clash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    clash.renderOrder = 9;
    camera.add(clash);
    const ghosts = createForceGhosts();
    ghosts.group.position.set(2.15, 0, -1.7);
    ghosts.group.rotation.y = -0.34;
    scene.add(ghosts.group);

    // The lights that follow the story.
    const saberLight = new THREE.PointLight(0xff2a2a, 0, 6.5, 1.8);
    const answerLight = new THREE.PointLight(0x62b4ff, 0, 7, 1.8);
    const glint = new THREE.PointLight(0xa8bcff, 2.6, 4, 2);
    const key = new THREE.DirectionalLight(0xc8d4ff, 0.32);
    key.position.set(1.2, 3, 5);
    scene.add(saberLight, answerLight, glint, key);

    const tick = (dt: number, time: number) => {
      const current = phaseRef.current;
      if (current !== "reveal" && beat < END) beat = END;
      if (current !== lastPhase) {
        lastPhase = current;
        since = 0;
        if (current === "jedi") {
          audio?.ignite();
          audio?.boom();
        }
        if (current === "sith") audio?.boom();
        if (current === "duel") {
          // A fresh fight, from wherever he now stands, whenever the visitor gets back up.
          audio?.ignite();
          duelLife = DUEL_LIFE;
          duelHits = 0;
          duelPush = 0;
          blowAge = -1;
          blows = 0;
          nextBlow = 1.3;
          chokeLeft = 0;
          setDuel({ life: DUEL_LIFE, hits: 0 });
          setChoke(false);
        } else {
          ring.visible = false;
          chokeLeft = 0;
          setChoke(false);
        }
        if (current === "jedi" || current === "sith" || current === "choice") {
          answer.group.position.copy(restingBlade.position);
          answer.group.quaternion.copy(restingBlade.quaternion);
        }
      }
      since += dt;
      beat += dt;
      if (current === "reveal" && beat >= END) setPhase("choice");
      for (const [at, line] of captions)
        if (beat >= at && beat < at + dt + 0.001 && line !== said && current === "reveal") {
          said = line;
          setCaption(line);
        }
      if (current !== "reveal" && said) {
        said = "";
        setCaption("");
      }
      const still = reduced;
      const jedi = current === "jedi" ? THREE.MathUtils.smoothstep(since, 0, 2.6) : 0;
      const sith = current === "sith" ? THREE.MathUtils.smoothstep(since, 0, 1.8) : 0;

      // The meditation chamber opens; the helmet comes down; he turns and walks out.
      const open = span(beat, OPEN);
      const helmet = span(beat, HELMET);
      const turn = span(beat, TURN);
      const walk = THREE.MathUtils.clamp((beat - WALK[0]) / (WALK[1] - WALK[0]), 0, 1);
      const fighting = current === "duel";
      const reaching = span(beat, REACH) * (current === "reveal" || current === "choice" ? 1 : 0);
      // On one knee once beaten, and still there if he is spared.
      kneeled = THREE.MathUtils.damp(kneeled, current === "spare" || current === "jedi" ? 1 : 0, 2.6, dt);
      const seated = 1 - span(beat, RISE);
      chamber.setPod(open, span(beat, [TURN[0] - 0.6, TURN[1]]), Math.PI * (1 - turn), span(beat, [HELMET[1] + 0.1, HELMET[1] + 1.2]));
      chamber.setHelmetArm(HEAD_Y - SEATED_DROP + 1.15 * (1 - helmet) + 0.42, span(beat, [HELMET[1] + 0.1, HELMET[1] + 1.4]));
      lord.head.position.y = HEAD_Y + 1.15 * (1 - helmet);
      bare.visible = helmet < 0.995;
      if (helmet > 0.98 && !hissed) {
        hissed = true;
        audio?.jump();
      }
      lord.group.rotation.y = Math.PI * (1 - turn);
      lordZ = THREE.MathUtils.lerp(POD_Z, STOP_Z, THREE.MathUtils.smoothstep(walk, 0, 1)) + duelPush;
      lord.group.position.z = lordZ;
      const walking = walk > 0 && walk < 1 && !still;
      const stride = walking ? Math.sin(walk * Math.PI * 6) : 0;
      lord.legs[0].leg.rotation.x = -stride * 0.3 - seated * 1.4;
      lord.legs[1].leg.rotation.x = stride * 0.3 - seated * 1.4;
      lord.legs[0].shin.rotation.x = Math.max(0, stride) * 0.34 + seated * 1.4;
      lord.legs[1].shin.rotation.x = Math.max(0, -stride) * 0.34 + seated * 1.4;
      lord.cape.rotation.x = walking ? -0.05 + Math.abs(stride) * 0.018 : 0;
      lord.group.position.y = (walking ? -Math.abs(stride) * 0.012 : 0) - seated * SEATED_DROP;
      // Lit in the dark, the moment he has turned to face the visitor.
      if (beat >= IGNITE && !lit) {
        lit = true;
        audio?.ignite();
      }
      const blade = THREE.MathUtils.smoothstep(beat, IGNITE, IGNITE + 0.32) * (1 - kneeled);
      lord.setBlade(blade);
      lord.blade.material.opacity = 0.5 + (still ? 0 : Math.sin(time * 40) * 0.05);
      const left = lord.arms.left,
        right = lord.arms.right;
      // Seated, the forearms lie along the arms of the seat.
      left.root.rotation.set(reach.x * reaching - seated * 0.5, reach.y * reaching, -0.1 + (reach.z + 0.1) * reaching);
      left.elbow.rotation.x = -0.2 + (reach.elbow + 0.2) * reaching - seated * 0.75;
      // In the duel he holds his guard, then swings towards the circle as the blow comes down.
      const duelWeight = fighting || current === "fallen" ? 1 : 0;
      let wantX = -1.0,
        wantZ = 0.1,
        wantElbow = -0.85;
      if (blowAge >= 0) {
        const k = blowAge / blowLength;
        const wind = k < 0.7 ? THREE.MathUtils.smoothstep(k, 0, 0.7) : 1;
        const strike = THREE.MathUtils.smoothstep(k, 0.72, 1);
        wantX = THREE.MathUtils.lerp(-1.0, -2.5 - blow.y * 0.5, wind) + strike * (1.25 - blow.y * 0.8);
        wantZ = 0.1 + blow.x * 0.75 * wind;
        wantElbow = -0.85 + wind * 0.45 - strike * 0.35;
      }
      const rate = blowAge >= 0 ? 16 : 7;
      guardX.value = THREE.MathUtils.damp(guardX.value, wantX, rate, dt);
      guardZ.value = THREE.MathUtils.damp(guardZ.value, wantZ, rate, dt);
      guardElbow.value = THREE.MathUtils.damp(guardElbow.value, wantElbow, rate, dt);
      // Sith: the blade held high in salute. Spared: the arm falls.
      const baseX = THREE.MathUtils.lerp(hold.x, -2.7, sith) + kneeled * 0.15 - seated * 0.35,
        baseElbow = THREE.MathUtils.lerp(hold.elbow, -0.25, sith) * (1 - kneeled * 0.7) - seated * 0.4;
      right.root.rotation.set(THREE.MathUtils.lerp(baseX, guardX.value, duelWeight), 0, THREE.MathUtils.lerp(hold.z, guardZ.value, duelWeight));
      right.elbow.rotation.x = THREE.MathUtils.lerp(baseElbow, guardElbow.value, duelWeight);
      // The hand that strangles, held out towards the visitor.
      if (chokeLeft > 0) {
        left.root.rotation.set(-1.45, 0.2, -0.12);
        left.elbow.rotation.x = -0.12;
      }
      // Beaten, he goes down on one knee and bows his head.
      if (kneeled > 0.002) {
        lord.group.position.y = -kneeled * 0.46;
        lord.legs[0].leg.rotation.x = -kneeled * 1.05;
        lord.legs[0].shin.rotation.x = kneeled * 1.5;
        lord.legs[1].leg.rotation.x = kneeled * 0.32;
        lord.legs[1].shin.rotation.x = kneeled * 1.0;
        lord.head.rotation.x = kneeled * 0.42;
      } else lord.head.rotation.x = reaching * 0.05;

      // The camera: from the far end of the hall to behind his shoulder, then back as he comes on.
      const inward = still ? 1 : span(beat, [0, 6.6]);
      const away = still ? 1 : span(beat, [7.4, 13.6]);
      eye.set(THREE.MathUtils.lerp(-4.5, -1.15, inward), THREE.MathUtils.lerp(1.45, 1.72, inward), THREE.MathUtils.lerp(10.5, -1.15, inward));
      gaze.set(0, THREE.MathUtils.lerp(1.5, 1.72, inward), POD_Z);
      // Once out of his chamber the camera keeps its distance from him, wherever the fight takes him.
      eye.lerp(local.set(0, 1.5, Math.max(lordZ, STOP_Z - 3) + 4.25), away);
      gaze.lerp(local.set(0, 1.42, lordZ), away);
      if (!still) eye.x += Math.sin(time * 0.17) * 0.09;
      // Sith: on one knee before him, looking up. Jedi: standing, facing him. Beaten: on the floor.
      eye.lerp(local.set(0, 0.72, lordZ + 3.9), sith);
      gaze.lerp(local.set(0, 1.78, lordZ), sith);
      eye.lerp(local.set(-0.25, 1.45, lordZ + 4.8), jedi);
      gaze.lerp(local.set(0.45, 1.2, lordZ), jedi);
      fallenView = THREE.MathUtils.damp(fallenView, current === "fallen" ? 1 : 0, 3, dt);
      eye.lerp(local.set(0.2, 0.42, lordZ + 2.2), fallenView);
      gaze.lerp(local.set(0, 1.5, lordZ), fallenView);
      camera.position.copy(eye);
      if (sith > 0 && !still) {
        camera.position.x += (Math.random() - 0.5) * 0.012;
        camera.position.y += (Math.random() - 0.5) * 0.012;
      }
      if (shake > 0 && !still) {
        camera.position.x += (Math.random() - 0.5) * 0.1 * shake;
        camera.position.y += (Math.random() - 0.5) * 0.1 * shake;
        shake = Math.max(0, shake - dt * 2.6);
      }
      camera.lookAt(gaze);

      // The visitor's blade follows the pointer, or the arrow keys, for as long as the fight lasts.
      const keyStep = dt * 1.5;
      if (heldKeys.has("ArrowLeft")) goal.x -= keyStep;
      if (heldKeys.has("ArrowRight")) goal.x += keyStep;
      if (heldKeys.has("ArrowUp")) goal.y += keyStep;
      if (heldKeys.has("ArrowDown")) goal.y -= keyStep;
      goal.clampScalar(-0.95, 0.95);
      pointer.x = THREE.MathUtils.damp(pointer.x, goal.x, 18, dt);
      pointer.y = THREE.MathUtils.damp(pointer.y, goal.y, 18, dt);
      const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      if (fighting || current === "spare") {
        const hand = local.set(Math.min(0.42, 0.22 * camera.aspect), -0.62, -1.05);
        answer.group.position.copy(hand);
        tipLocal.set(pointer.x * half * camera.aspect * 2.2, pointer.y * half * 2.2, -2.2);
        direction.copy(tipLocal).sub(hand).normalize();
        answer.group.quaternion.setFromUnitVectors(upAxis, direction);
      }
      if (fighting) {
        // Force choke: twice in the fight he stops swinging and closes his hand.
        if (chokeLeft > 0) {
          chokeLeft -= dt;
          if (mashes >= CHOKE_MASHES) {
            chokeLeft = 0;
            setChoke(false);
            duelPush -= PUSH;
            shake = 0.7;
            audio?.push();
            nextBlow = since + 0.9;
          } else if (chokeLeft <= 0) {
            chokeLeft = 0;
            setChoke(false);
            duelLife -= 1;
            setDuel({ life: duelLife, hits: duelHits });
            setHurt((value) => value + 1);
            audio?.hit();
            nextBlow = since + 1.1;
            if (duelLife <= 0) setPhase("fallen");
          }
        } else if (blowAge < 0 && since > nextBlow) {
          if (blows === 3 || blows === 7) {
            blows += 1;
            chokeLeft = CHOKE_SECONDS;
            mashes = 0;
            setChoke(true);
            ring.visible = false;
          } else {
            blows += 1;
            blow.set((Math.random() * 2 - 1) * 0.6, -0.28 + Math.random() * 0.74);
            blowAge = 0;
            blowLength = THREE.MathUtils.lerp(1.2, 0.72, duelHits / DUEL_HITS);
            audio?.setHum(0.4);
          }
        }
        if (blowAge >= 0) {
          blowAge += dt;
          const k = Math.min(1, blowAge / blowLength);
          ring.visible = true;
          ring.position.set(blow.x * half * camera.aspect * RING_DEPTH, blow.y * half * RING_DEPTH, -RING_DEPTH);
          const size = THREE.MathUtils.lerp(0.95, 0.34, k);
          ring.scale.set(size, size, 1);
          const gap = Math.hypot((blow.x - pointer.x) * Math.max(camera.aspect, 0.8), blow.y - pointer.y);
          const guarded = gap < 0.33;
          ring.material.color.set(guarded ? 0x7dd8ff : 0xff5a4a);
          ring.material.opacity = 0.5 + k * 0.5;
          if (k >= 1) {
            ring.visible = false;
            blowAge = -1;
            clashAge = 0;
            clash.position.copy(ring.position);
            clash.material.color.set(guarded ? 0xd8f0ff : 0xff5a4a);
            shake = guarded ? 0.5 : 1;
            nextBlow = since + THREE.MathUtils.lerp(0.75, 0.32, duelHits / DUEL_HITS);
            if (guarded) {
              duelHits += 1;
              duelPush -= PUSH;
              audio?.deflect();
              if (duelHits >= DUEL_HITS) {
                audio?.boom();
                setPhase("spare");
              }
            } else {
              duelLife -= 1;
              setHurt((value) => value + 1);
              audio?.hit();
              if (duelLife <= 0) setPhase("fallen");
            }
            setDuel({ life: duelLife, hits: duelHits });
          }
        }
      }
      clashAge += dt * 4;
      clash.material.opacity = Math.max(0, 1 - clashAge);
      clash.scale.setScalar(0.3 + clashAge * 1.1);

      // Lights.
      saberLight.position.set(0.5, fighting ? 1.5 : 0.75, lord.group.position.z + 0.7);
      if (sith > 0) saberLight.position.set(0.6, 2.7, lordZ + 0.3);
      saberLight.intensity = blade * (5.2 + (still ? 0 : Math.sin(time * 31) * 0.5)) * (1 + sith * 0.6);
      answer.setExtended(current === "jedi" || fighting || current === "spare" ? (current === "spare" ? 1 : THREE.MathUtils.smoothstep(since, 0, 0.3)) : 0);
      answerLight.position.copy(camera.position).add(local.set(0.1, -0.1, -1.1).applyQuaternion(camera.quaternion));
      answerLight.intensity = Math.max(jedi, fighting || current === "spare" ? 0.6 : 0) * 7;
      glint.position.set(0.45, 2.2, lord.group.position.z + 0.85);
      chamber.tick(dt, time, still, { jedi, sith, reveal: Math.max(0.18, span(beat, [0.2, 3])), open, steam: beat > OPEN[0] && beat < TURN[1] + 2, camera: camera.position, lash: sith });
      if (sith > 0.2 && !still) {
        crackle -= dt;
        if (crackle <= 0) {
          crackle = 0.32 + Math.random() * 0.5;
          audio?.hit();
        }
      }
      if (sith > 0.5 && !rumbled) {
        rumbled = true;
        audio?.push();
      }
      ghosts.tick(dt, still, current === "jedi" && since > 1.2 ? camera.position : farAway);
    };
    tickRef.current = tick;
    resist.current = () => {
      if (chokeLeft > 0) mashes += 1;
    };
    const move = (event: PointerEvent) => {
      const box = el.getBoundingClientRect();
      goal.set(((event.clientX - box.left) / box.width) * 2 - 1, -(((event.clientY - box.top) / box.height) * 2 - 1));
    };
    const keydown = (event: KeyboardEvent) => {
      if (phaseRef.current !== "duel") return;
      if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        heldKeys.add(event.key);
      }
      if (event.key === " " && !event.repeat) {
        event.preventDefault();
        event.stopImmediatePropagation();
        resist.current();
      }
    };
    const keyup = (event: KeyboardEvent) => heldKeys.delete(event.key);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", move);
    window.addEventListener("keydown", keydown, true);
    window.addEventListener("keyup", keyup);
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __vaderRoom?: unknown }).__vaderRoom = {
        seek: (t: number) => (beat = t),
        beat: () => beat,
        go: (p: Phase) => setPhase(p),
        duel: () => ({ duelLife, duelHits, blowAge, chokeLeft, mashes, lordZ }),
        aim: (x: number, y: number) => goal.set(x, y),
        blowAt: () => [blow.x, blow.y],
        camera,
        scene,
        calls: () => renderer.info.render.calls,
      };
    }
    return () => {
      tickRef.current = () => undefined;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", move);
      window.removeEventListener("keydown", keydown, true);
      window.removeEventListener("keyup", keyup);
      audio?.close();
      reflections.dispose();
      chamber.dispose();
      stage.dispose();
      glow.dispose();
    };
  }, [reduced, sound, run]);

  const choose = useCallback((path: Path) => {
    choosePath(path);
    setPhase(path);
  }, []);
  const replay = () => {
    setPhase("reveal");
    setCaption("");
    setDuel({ life: DUEL_LIFE, hits: 0 });
    setChoke(false);
    setRun((value) => value + 1);
  };

  return (
    <motion.div className={`reward-scene vader-scene phase-${phase}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0.15 : 1.2 }} role="dialog" aria-modal="true" aria-label="La rencontre avec Dark Vador">
      <div key={run} ref={mount} className="reward-scene-canvas" />
      {phase === "jedi" && !reduced && <i className="vader-fx vader-fx-light" aria-hidden="true" />}
      {phase === "sith" && !reduced && <i className="vader-fx vader-fx-dark" aria-hidden="true" />}
      <header className="reward-scene-head">
        <p className="jedi-eyebrow">LA DESTINÉE · RENCONTRE AVEC DARK VADOR</p>
        <button className="jedi-close" onClick={onClose} aria-label="Quitter la scène finale">
          <X size={16} />
          <span>QUITTER</span>
        </button>
      </header>
      {!reduced && hurt > 0 && phase === "duel" && <i key={hurt} className="duel-hurt" aria-hidden="true" />}
      {choke && <i className="duel-choke" aria-hidden="true" />}
      {phase === "duel" && (
        <div className="duel-hud mono" role="status" aria-label={`Votre Force : ${duel.life} sur ${DUEL_LIFE}. Vador recule : ${duel.hits} sur ${DUEL_HITS}.`}>
          <div className="you">
            <span>VOUS</span>
            <b aria-hidden="true">
              <i style={{ width: `${(duel.life / DUEL_LIFE) * 100}%` }} />
            </b>
          </div>
          <div className="him">
            <span>VADOR</span>
            <b aria-hidden="true">
              <i style={{ width: `${(1 - duel.hits / DUEL_HITS) * 100}%` }} />
            </b>
          </div>
        </div>
      )}
      {phase === "duel" && !choke && duel.hits === 0 && <p className="duel-line">Placez votre sabre sur les cercles pour parer ses coups.</p>}
      {choke && (
        <>
          <p className="duel-line">Il referme la main sur votre gorge. Résistez !</p>
          <button className="duel-resist" onClick={() => resist.current()}>
            RÉSISTER (ESPACE)
          </button>
        </>
      )}
      {caption && phase === "reveal" && (
        <p key={caption} className="vader-caption" role="status">
          {caption}
        </p>
      )}
      <AnimatePresence mode="wait">
        {phase === "reveal" && (
          <motion.button key="skip" className="rank-cinematic-skip" onClick={() => setPhase("choice")} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            PASSER <ChevronRight size={13} aria-hidden="true" />
          </motion.button>
        )}
        {phase === "choice" && (
          <motion.div key="choice" className="vader-choice" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
            <h2>QUEL CHEMIN CHOISIREZ‑VOUS&nbsp;?</h2>
            <div>
              <button ref={choiceRef} className="vader-path jedi" onClick={() => setPhase("duel")}>
                REFUSER SA MAIN
              </button>
              <button className="vader-path sith" onClick={() => choose("sith")}>
                REJOINDRE LES SITH
              </button>
            </div>
          </motion.div>
        )}
        {phase === "spare" && (
          <motion.div key="spare" className="vader-choice" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, delay: reduced ? 0 : 1.2 }}>
            <h2>IL EST À VOTRE MERCI</h2>
            <div>
              <button ref={choiceRef} className="vader-path jedi" onClick={() => choose("jedi")}>
                L’ÉPARGNER
              </button>
              <button className="vader-path sith" onClick={() => choose("sith")}>
                PRENDRE SA PLACE
              </button>
            </div>
          </motion.div>
        )}
        {phase === "fallen" && (
          <motion.div key="fallen" className="vader-choice" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, delay: reduced ? 0 : 0.8 }}>
            <h2>« VOUS NE CONNAISSEZ PAS LA PUISSANCE DU CÔTÉ OBSCUR. »</h2>
            <div>
              <button ref={choiceRef} className="vader-path jedi" onClick={() => setPhase("duel")}>
                SE RELEVER
              </button>
              <button className="vader-path sith" onClick={() => choose("sith")}>
                CÉDER
              </button>
            </div>
          </motion.div>
        )}
        {(phase === "jedi" || phase === "sith") && (
          <motion.div key="outcome" className="vader-outcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? 0 : 0.8, duration: 1 }} role="status">
            <h2>{phase === "jedi" ? "LA LUMIÈRE VOUS GUIDE" : "LE CÔTÉ OBSCUR VOUS ACCUEILLE"}</h2>
            <p>
              {phase === "jedi"
                ? "Vous l’avez vaincu, et vous l’avez épargné. Votre maîtrise de la Force éclaire désormais toute la galaxie, et ceux qui vous ont précédé veillent sur vous. Que la Force soit avec vous."
                : "Vous avez embrassé la colère et la puissance. Rien, désormais, ne résiste à votre volonté. L’Empire a un nouveau seigneur."}
            </p>
            <div>
              <button className="jedi-link" onClick={replay}>
                <RotateCcw size={11} aria-hidden="true" /> REVOIR LA SCÈNE
              </button>
              <button className="jedi-button" onClick={onClose}>
                REVENIR AU VAISSEAU
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
