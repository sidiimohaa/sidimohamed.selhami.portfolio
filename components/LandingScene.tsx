"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Rocket } from "lucide-react";
import { createCoruscantZone } from "./coruscantZone";
import { createHothZone } from "./hothZone";
import { landingArrival } from "./landingFlight";
import { createTatooineZone } from "./tatooineZone";
import AtmosphereEntry, { ENTRY_SECONDS } from "./AtmosphereEntry";
import BountyProjectPanel from "./BountyProjectPanel";
import PassionsViewer from "./PassionsViewer";
import { createEndorZone } from "./endorZone";
import type { PadEvent } from "./coruscantLife";
import type { Reveal, Zone, ZoneAction } from "./landingKit";
import type { MissionId } from "./jediProgression";
import type { Landing } from "./universe";

// Each world with a landing zone builds its own scene around the shared pad layout.
const zones: Record<string, (landing: Landing, notify: (event: PadEvent) => void, reveal: Reveal) => Zone> = {
  Coruscant: createCoruscantZone,
  Tatooine: createTatooineZone,
  Hoth: createHothZone,
  Endor: createEndorZone,
};

export type SurfaceCue = "terminal" | "takeoff" | "step" | "cantina-enter" | "cantina-leave" | PadEvent;
type Props = {
  planet: string;
  landing: Landing;
  reduced: boolean;
  paused: boolean;
  hidden: boolean;
  onCue: (cue: SurfaceCue) => void;
  // The zone's music level where the visitor stands, 0 to 1, and whether they are inside with it.
  onMusic?: (level: number, inside: boolean) => void;
  // A secret mission the visitor has just completed here, once per landing.
  onSecret?: (id: MissionId) => void;
  onTakeoff: () => void;
};
type Phase = "arrival" | "explore" | "takeoff";
const EYE = 1.7,
  ARRIVAL = 6.2,
  TAKEOFF = 3,
  WALK = 3.8,
  RUN = 7,
  RING = 9.6;
const ease = (t: number) => {
  const k = THREE.MathUtils.clamp(t, 0, 1);
  return k * k * (3 - 2 * k);
};
const easeOut = (t: number) =>
  1 - Math.pow(1 - THREE.MathUtils.clamp(t, 0, 1), 3);
const shortest = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle));

export default function LandingScene({
  planet,
  landing,
  reduced,
  paused,
  hidden,
  onCue,
  onMusic,
  onSecret,
  onTakeoff,
}: Props) {
  const mount = useRef<HTMLDivElement>(null),
    joystick = useRef<HTMLDivElement>(null),
    thumb = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<Phase>(reduced ? "explore" : "arrival");
  const [active, setActive] = useState<number | null>(null);
  const [hint, setHint] = useState(true);
  const [leaving, setLeaving] = useState(false);
  // The descent through the atmosphere plays over the start of the arrival, unless motion is reduced.
  const [entering, setEntering] = useState(!reduced);
  const [quietFade] = useState(!reduced);
  const [inDistrict,setInDistrict] = useState(false);
  const [inCantina,setInCantina] = useState(false);
  // Things to use in the scene (the bounty puck, Grogu), and the project a puck has opened.
  const [actions, setActions] = useState<{ id: string; label: string; hidden?: boolean }[]>([]);
  const [bounty, setBounty] = useState<number | null>(null);
  // The passions presentation opened from Endor, and the way up to its village.
  const [story, setStory] = useState<{ at?: number; title: string } | null>(null);
  const [climb, setClimb] = useState<{ up: string; down: string } | null>(null);
  const [aloft, setAloft] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [coarse] = useState(
    () => window.matchMedia("(pointer: coarse)").matches,
  );
  const live = useRef({ reduced, paused, hidden });
  live.current = { reduced, paused, hidden };
  const cue = useRef(onCue),
    music = useRef(onMusic),
    secret = useRef(onSecret),
    leave = useRef(onTakeoff);
  cue.current = onCue;
  music.current = onMusic;
  secret.current = onSecret;
  leave.current = onTakeoff;
  const controls = useRef<{
    walkTo: (index: number) => void;
    skip: () => void;
    takeoff: () => void;
    district: () => void;
    cantina: () => void;
    act: (id: string) => void;
    climb: () => void;
  } | null>(null);

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
      setFallback(true);
      return;
    }
    // Phones start lighter; quality then adapts to the frame rate (see adapt below).
    const ceiling = Math.min(window.devicePixelRatio, coarse ? 1.5 : 2);
    renderer.setPixelRatio(ceiling);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.className = "surface-canvas";
    el.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    let environment:THREE.WebGLRenderTarget|undefined;
    if(planet==="Tatooine"||planet==="Hoth"||planet==="Endor"){
      if(planet!=="Hoth"){renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;}
      const generator=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
      environment=generator.fromScene(room,.02);scene.environment=environment.texture;scene.environmentIntensity=.45;
      generator.dispose();room.dispose();
    }
    const build = zones[planet] ?? createCoruscantZone;
    const seen = new Set<MissionId>();
    const zone = build(landing, (event) => cue.current(event), (id) => {
      if (seen.has(id)) return;
      seen.add(id);
      secret.current?.(id);
    });
    renderer.toneMappingExposure = zone.exposure;
    let ratio = ceiling,
      quality = coarse ? 1 : 2;
    zone.setQuality?.(quality);
    scene.add(zone.group);
    scene.fog = zone.fog;
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2600);
    const viewer = new THREE.PerspectiveCamera();
    const { ship, shipRest, colliders } = zone;
    const pickable: THREE.Object3D[] = [];
    zone.group.traverse((object) => {
      if (object.userData.terminal !== undefined) pickable.push(object);
    });
    const actionOf = new Map<THREE.Object3D, ZoneAction>();
    zone.actions?.forEach((action) => action.objects.forEach((object) => actionOf.set(object, action)));
    const actionObjects = [...actionOf.keys()];
    // Secret actions only join the buttons once the visitor stands close to them.
    const listed = (near: string[]) => zone.actions?.filter((action) => !action.hidden || near.includes(action.id)).map(({ id, label, hidden }) => ({ id, label, hidden })) ?? [];
    const secretActions = zone.actions?.filter((action) => action.hidden) ?? [];
    let nearKey = "";
    setActions(listed([]));

    const walker = {
      x: zone.spawn.position.x,
      z: zone.spawn.position.z,
      yaw: zone.spawn.yaw,
      pitch: 0.04,
      stride: 0,
    };
    let actionFov: number | undefined;
    const setLens = (portrait?: number) => {
      actionFov = portrait;
      camera.fov = camera.aspect < .8 ? (portrait ?? 72) : 60;
      camera.updateProjectionMatrix();
    };
    const keys = new Set<string>(),
      steer = { x: 0, y: 0 };
    // Each pointer either walks, as a joystick under the finger, or looks around by grabbing the view.
    const grips = new Map<
      number,
      {
        look: boolean;
        x: number;
        y: number;
        startX: number;
        startY: number;
        at: number;
        travelled: number;
      }
    >();
    // Automatic walks check their progress, so a parked speeder or a bystander cannot stall them.
    const progress = { x: 0, z: 0, time: 0, detours: 0 };
    let route: THREE.Vector3[] = [],
      facing: number | null = null,
      // An action waiting for the visitor to reach it and turn towards it.
      pending: ZoneAction | null = null,
      bountyNext = 0,
      bountyTimer = 0,
      current: Phase = live.current.reduced ? "explore" : "arrival",
      clock = 0,
      nearest: number | null = null,
      walked = false,
      footfall = 0;
    // Stand far enough back for the whole hologram to fit, which needs more room in portrait.
    const standOff = () =>
      Math.max(
        3.3,
        1.75 /
          (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect),
      );
    const standFor = (index: number) => {
      const { position, stand } = zone.terminals[index];
      if (stand) return stand.clone();
      return position
        .clone()
        .multiplyScalar(1 - standOff() / position.length());
    };
    const begin = (next: Phase) => {
      current = next;
      clock = 0;
      setPhase(next);
    };
    const wideStart = zone.arrival?.from.clone() ?? new THREE.Vector3(30, 16, 46),
      wideEnd = zone.arrival?.to.clone() ?? new THREE.Vector3(14, 6, 26),
      eye = new THREE.Vector3(),
      look = new THREE.Quaternion(),
      fromPosition = new THREE.Vector3(),
      fromQuaternion = new THREE.Quaternion(),
      eyeRotation = new THREE.Euler(0, 0, 0, "YXZ");
    const eyeQuaternion = () =>
      look.setFromEuler(eyeRotation.set(walker.pitch, walker.yaw, 0, "YXZ"));
    const floor = () => zone.floorAt?.() ?? 0;
    const placeEye = () => {
      camera.position.set(walker.x, EYE + floor(), walker.z);
      camera.quaternion.copy(eyeQuaternion());
    };
    const settleShip = () => {
      ship.position.copy(shipRest);
      ship.rotation.set(0, Math.PI, 0);
      zone.setThrust(0);
    };
    if (current === "explore") {
      settleShip();
      placeEye();
    }

    let wasInDistrict=false,wasInCantina=false,wasAloft=false;
    setClimb(zone.climb ? { up: zone.climb.up, down: zone.climb.down } : null);
    const collide = () => {
      const reach = Math.hypot(walker.x, walker.z),
        limit = zone.walkRadius;
      if (reach > limit) {
        walker.x *= limit / reach;
        walker.z *= limit / reach;
      }
      [...colliders.circles, ...colliders.movers].forEach(({ x, z, r }) => {
        const dx = walker.x - x,
          dz = walker.z - z,
          distance = Math.hypot(dx, dz),
          minimum = r + 0.35;
        if (distance < minimum && distance > 0.001) {
          walker.x = x + (dx / distance) * minimum;
          walker.z = z + (dz / distance) * minimum;
        }
      });
      const box = colliders.footprint;
      if (
        walker.x > box.minX &&
        walker.x < box.maxX &&
        walker.z > box.minZ &&
        walker.z < box.maxZ
      ) {
        const exits = [
          walker.x - box.minX,
          box.maxX - walker.x,
          walker.z - box.minZ,
          box.maxZ - walker.z,
        ];
        const side = exits.indexOf(Math.min(...exits));
        if (side === 0) walker.x = box.minX;
        else if (side === 1) walker.x = box.maxX;
        else if (side === 2) walker.z = box.minZ;
        else walker.z = box.maxZ;
      }
      zone.constrainWalk?.(walker);
      if(zone.explorePoint){const next=Math.hypot(walker.x,walker.z)>20;if(next!==wasInDistrict){wasInDistrict=next;setInDistrict(next);}}
      if(zone.interior){const next=zone.interior.contains(walker.x,walker.z);if(next!==wasInCantina){wasInCantina=next;setInCantina(next);cue.current(next?"cantina-enter":"cantina-leave");}}
    };
    // Walk out to the ring around the ship, follow it, then step up to the terminal.
    const walkTo = (index: number) => {
      if (current !== "explore") return;
      setLens();
      const terminal = zone.terminals[index],
        stand = standFor(index);
      if (live.current.reduced) {
        walker.x = stand.x;
        walker.z = stand.z;
        walker.yaw = Math.atan2(
          -(terminal.position.x - walker.x),
          -(terminal.position.z - walker.z),
        );
        route = [];
        facing = null;
        return;
      }
      const from = Math.atan2(walker.z, walker.x),
        to = Math.atan2(stand.z, stand.x),
        turn = shortest(to - from);
      route = [];
      if(zone.routeTo){
        route=zone.routeTo(new THREE.Vector3(walker.x,0,walker.z),stand);
        facing=index;walked=true;setHint(false);return;
      }
      if (Math.hypot(walker.x, walker.z) < RING - 0.3)
        route.push(
          new THREE.Vector3(Math.cos(from) * RING, 0, Math.sin(from) * RING),
        );
      const steps = Math.ceil(Math.abs(turn) / 0.3);
      for (let step = 1; step <= steps; step++) {
        const angle = from + (turn * step) / steps;
        route.push(
          new THREE.Vector3(Math.cos(angle) * RING, 0, Math.sin(angle) * RING),
        );
      }
      route.push(stand);
      facing = index;
      walked = true;
      setHint(false);
    };
    const skip = () => {
      if (current !== "arrival") return;
      settleShip();
      placeEye();
      begin("explore");
    };
    const takeoff = () => {
      if (current === "takeoff") return;
      route = [];
      keys.clear();
      cue.current("takeoff");
      if (live.current.reduced) {
        leave.current();
        return;
      }
      fromPosition.copy(camera.position);
      fromQuaternion.copy(camera.quaternion);
      begin("takeoff");
    };
    const district=()=>{
      if(current!=="explore"||!zone.explorePoint||!zone.routeTo)return;
      setLens();
      const outside=Math.hypot(walker.x,walker.z)>20;
      const destination=outside?zone.spawn.position:zone.explorePoint;
      if(live.current.reduced){walker.x=destination.x;walker.z=destination.z;walker.yaw=outside?zone.spawn.yaw:Math.atan2(-destination.x,-destination.z);}
      else route=zone.routeTo(new THREE.Vector3(walker.x,0,walker.z),destination);
      facing=null;walked=true;setHint(false);
    };
    const cantina=()=>{
      if(current!=="explore"||!zone.interior||!zone.routeTo)return;
      setLens();
      const entering=!zone.interior.contains(walker.x,walker.z);
      const destination=entering?zone.interior.entry:zone.interior.exit;
      if(live.current.reduced){walker.x=destination.x;walker.z=destination.z;const look=zone.interior.entry.clone().sub(zone.interior.exit).multiplyScalar(entering?1:-1);walker.yaw=Math.atan2(-look.x,-look.z);}
      else route=zone.routeTo(new THREE.Vector3(walker.x,0,walker.z),destination);
      facing=null;walked=true;setHint(false);
    };
    // Use an action: walk to where it can be reached first if needed, then face it and trigger it.
    const perform = (action: ZoneAction) => {
      const still = live.current.reduced;
      if (action.story) {
        action.activate(still);
        cue.current("terminal");
        setStory(action.story);
      } else if (action.present) {
        const index = bountyNext++ % landing.terminals.length;
        action.present(landing.terminals[index], index, landing.terminals.length);
        action.activate(still);
        cue.current("terminal");
        // Let the hologram flicker up over the table before the dossier opens.
        window.clearTimeout(bountyTimer);
        if (still) setBounty(index);
        else bountyTimer = window.setTimeout(() => setBounty(index), 1500);
      } else action.activate(still);
    };
    const act = (id: string) => {
      const action = zone.actions?.find((item) => item.id === id);
      if (current !== "explore" || !action) return;
      setLens(action.portraitFov);
      const approach = action.approach ?? zone.actionApproach;
      const far = Math.hypot(action.position.x - walker.x, action.position.z - walker.z) > 3.2;
      facing = null;
      walked = true;
      setHint(false);
      if (far && approach && live.current.reduced) {
        walker.x = approach.position.x;
        walker.z = approach.position.z;
        walker.yaw = Math.atan2(-(approach.lookAt.x - walker.x), -(approach.lookAt.z - walker.z));
        walker.pitch = THREE.MathUtils.clamp(Math.atan2(approach.lookAt.y - EYE - floor(), Math.hypot(approach.lookAt.x - walker.x, approach.lookAt.z - walker.z)), -.6, .4);
        route = [];
        pending = null;
        perform(action);
        return;
      }
      route = far && approach && zone.routeTo ? zone.routeTo(new THREE.Vector3(walker.x, 0, walker.z), approach.position) : [];
      pending = action;
    };
    // Up the ramp to the village, or back down to the clearing.
    const goClimb = () => {
      const way = zone.climb;
      if (current !== "explore" || !way || !zone.routeTo) return;
      const up = !way.aloft(),
        destination = up ? way.top : way.bottom;
      facing = null;
      pending = null;
      walked = true;
      setHint(false);
      if (live.current.reduced) {
        walker.x = destination.x;
        walker.z = destination.z;
        way.place(up);
        route = [];
        return;
      }
      route = zone.routeTo(new THREE.Vector3(walker.x, 0, walker.z), destination);
    };
    controls.current = { walkTo, skip, takeoff, district, cantina, act, climb: goClimb };

    const outsideControls = (target: EventTarget | null) =>
      !(target as HTMLElement | null)?.closest?.(
        'button,a,[role="dialog"],.terminal-panel,.surface-bar,.surface-status',
      );
    const settleJoystick = () => {
      steer.x = steer.y = 0;
      joystick.current?.classList.remove("is-active");
      if (thumb.current) thumb.current.style.transform = "translate(0px,0px)";
    };
    const release = () => {
      grips.clear();
      settleJoystick();
    };
    const explored = () => {
      if (walked) return;
      walked = true;
      setHint(false);
    };
    const pointerDown = (event: PointerEvent) => {
      if (
        current !== "explore" ||
        live.current.paused ||
        !outsideControls(event.target)
      )
        return;
      // A mouse always looks; on touch the left half walks and the right half looks.
      const look =
        event.pointerType === "mouse" ||
        event.clientX > el.clientWidth / 2 ||
        [...grips.values()].some((grip) => !grip.look);
      grips.set(event.pointerId, {
        look,
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        at: performance.now(),
        travelled: 0,
      });
      if (!look && joystick.current) {
        joystick.current.style.transform = `translate(${event.clientX - 44}px,${event.clientY - 44}px)`;
        joystick.current.classList.add("is-active");
      }
    };
    const pointerMove = (event: PointerEvent) => {
      const grip = grips.get(event.pointerId);
      if (!grip) return;
      grip.travelled = Math.max(
        grip.travelled,
        Math.hypot(event.clientX - grip.startX, event.clientY - grip.startY),
      );
      if (grip.look) {
        // The view follows the finger: one screen height of drag turns about one field of view.
        const rate =
          THREE.MathUtils.degToRad(camera.fov) / Math.max(el.clientHeight, 1);
        walker.yaw += (event.clientX - grip.x) * rate;
        walker.pitch = THREE.MathUtils.clamp(
          walker.pitch + (event.clientY - grip.y) * rate,
          -0.6,
          0.9,
        );
        if (grip.travelled > 8) {
          if (actionFov !== undefined) setLens();
          route = [];
          facing = null;
          pending = null;
          explored();
        }
      } else {
        const reach = Math.min(el.clientWidth, el.clientHeight) * 0.2;
        steer.x = THREE.MathUtils.clamp(
          (event.clientX - grip.startX) / reach,
          -1,
          1,
        );
        steer.y = THREE.MathUtils.clamp(
          (grip.startY - event.clientY) / reach,
          -1,
          1,
        );
        if (thumb.current)
          thumb.current.style.transform = `translate(${steer.x * 26}px,${-steer.y * 26}px)`;
      }
      grip.x = event.clientX;
      grip.y = event.clientY;
    };
    const pointerCancel = (event: PointerEvent) => {
      const grip = grips.get(event.pointerId);
      grips.delete(event.pointerId);
      if (grip && !grip.look) settleJoystick();
    };
    const raycaster = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    const pointerUp = (event: PointerEvent) => {
      const grip = grips.get(event.pointerId);
      if (!grip) return;
      pointerCancel(event);
      if (grip.travelled >= 8 || performance.now() - grip.at > 350) return;
      const bounds = el.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickable, false)[0],
        used = actionObjects.length ? raycaster.intersectObjects(actionObjects, false)[0] : undefined;
      if (used && (!hit || used.distance < hit.distance)) act(actionOf.get(used.object)!.id);
      else if (hit) walkTo(hit.object.userData.terminal);
    };
    // A pointer cursor over things that can be used.
    let hoverAt = 0;
    const hover = (event: PointerEvent) => {
      if (!actionObjects.length || grips.size || event.timeStamp - hoverAt < 120) return;
      hoverAt = event.timeStamp;
      const bounds = el.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      el.style.cursor = raycaster.intersectObjects(actionObjects, false).length ? "pointer" : "";
    };
    el.addEventListener("pointermove", hover);
    const keyDown = (event: KeyboardEvent) => {
      if (current !== "explore" || live.current.paused) return;
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
      )
        event.preventDefault();
      keys.add(event.key.toLowerCase());
    };
    const keyUp = (event: KeyboardEvent) =>
      keys.delete(event.key.toLowerCase());
    const blur = () => {
      keys.clear();
      release();
    };
    window.addEventListener("pointerdown", pointerDown);
    window.addEventListener("pointermove", pointerMove);
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", pointerCancel);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", blur);

    const resize = () => {
      const w = el.clientWidth,
        h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.fov = w / h < 0.8 ? (actionFov ?? 72) : 60;
      camera.updateProjectionMatrix();
      zone.setViewport(h * renderer.getPixelRatio());
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();

    // The ship's approach waits until the descent has broken through the clouds.
    const entryHold = live.current.reduced ? 0 : ENTRY_SECONDS - 0.9;
    let frame = 0,
      last = performance.now(),
      elapsed = 0,
      hintTimer = 0;
    // Automatic quality: a device that keeps missing frames gives up resolution first, down to
    // one pixel per point, then shadow detail, then a last step below native resolution.
    let average = 1 / 60,
      sampled = 0,
      heardLevel = -1,
      heardInside = false;
    const adapt = (dt: number) => {
      average += (dt - average) * 0.05;
      if (elapsed < 3 || (sampled += dt) < 2.5) return;
      sampled = 0;
      if (average < 1 / 45) return;
      if (ratio > 1) ratio = Math.max(1, ratio - 0.25);
      else if (quality > 0 && zone.setQuality) zone.setQuality(--quality);
      else if (ratio > 0.75) ratio = 0.75;
      else return;
      renderer.setPixelRatio(ratio);
      resize();
    };
    const animate = (now: number) => {
      // The first frame's timestamp can precede the start time; never step backwards.
      const dt = THREE.MathUtils.clamp((now - last) / 1000, 0, 0.05);
      last = now;
      if (live.current.hidden) {
        keys.clear();
        grips.clear();
        steer.x = steer.y = 0;
        frame = requestAnimationFrame(animate);
        return;
      }
      elapsed += dt;
      adapt(dt);
      const { reduced: still, paused: frozen } = live.current;
      if (!frozen && !(current === "arrival" && elapsed < entryHold)) clock += dt;
      zone.tick(frozen ? 0 : dt, elapsed, still, walker);
      if (secretActions.length) {
        const near = secretActions.filter((action) => Math.hypot(action.position.x - walker.x, action.position.z - walker.z) < 4.5).map((action) => action.id);
        if (near.join() !== nearKey) {
          nearKey = near.join();
          setActions(listed(near));
        }
      }
      if (zone.music) {
        const heard = zone.music(walker);
        if (Math.abs(heard.level - heardLevel) > 0.02 || heard.inside !== heardInside) {
          heardLevel = heard.level;
          heardInside = heard.inside;
          music.current?.(heardLevel, heardInside);
        }
      }
      if (current === "arrival") {
        // The ship brakes in from beyond the pad, sinks onto its gear, then the pilot steps out.
        const arrival=landingArrival(clock,shipRest,zone.arrival?.shipFrom,zone.arrival?.shipYaw);
        ship.position.copy(arrival.position);
        ship.rotation.copy(arrival.rotation);
        zone.setThrust(clock < 4.4 ? 1 : Math.max(0, 1 - (clock - 4.4) / 0.8));
        if (clock < 4.6) {
          const reveal=zone.arrival?.reveal??0;
          camera.position.lerpVectors(wideStart, wideEnd, ease((clock-reveal)/(4.6-reveal)));
          camera.lookAt(
            ship.position.x,
            ship.position.y + 1.5,
            ship.position.z,
          );
        } else {
          const k = ease((clock - 4.6) / (ARRIVAL - 4.6));
          viewer.position.copy(wideEnd);
          viewer.lookAt(shipRest.x, shipRest.y + 1.5, shipRest.z);
          eye.set(walker.x, EYE + floor(), walker.z);
          camera.position.lerpVectors(wideEnd, eye, k);
          camera.quaternion.slerpQuaternions(
            viewer.quaternion,
            eyeQuaternion(),
            k,
          );
        }
        if (clock >= ARRIVAL) {
          settleShip();
          begin("explore");
        }
      } else if (current === "takeoff") {
        const k = ease(clock / 1.2);
        viewer.position.lerpVectors(fromPosition, wideEnd, k);
        viewer.lookAt(ship.position.x, ship.position.y + 1.5, ship.position.z);
        camera.position.copy(viewer.position);
        camera.quaternion.slerpQuaternions(
          fromQuaternion,
          viewer.quaternion,
          k,
        );
        const lift = Math.max(0, clock - 0.5);
        ship.position.set(
          shipRest.x,
          shipRest.y + lift * lift * 7,
          shipRest.z + lift * lift * lift * 12,
        );
        ship.rotation.set(-0.3 * Math.min(lift, 1), Math.PI, 0);
        zone.setThrust(1);
        if (clock > 2.1) setLeaving(true);
        if (clock >= TAKEOFF) {
          leave.current();
          return;
        }
      } else if (!frozen) {
        const fast = keys.has("shift");
        const turn = THREE.MathUtils.clamp(
          steer.x +
            (keys.has("arrowright") || keys.has("d") ? 1 : 0) -
            (keys.has("arrowleft") || keys.has("a") || keys.has("q") ? 1 : 0),
          -1,
          1,
        );
        const push = THREE.MathUtils.clamp(
          steer.y +
            (keys.has("arrowup") || keys.has("w") || keys.has("z") ? 1 : 0) -
            (keys.has("arrowdown") || keys.has("s") ? 1 : 0),
          -1,
          1,
        );
        let moving = Math.abs(push) > 0.05;
        if (Math.abs(turn) + Math.abs(push) > 0.05) {
          if (actionFov !== undefined) setLens();
          route = [];
          facing = null;
          pending = null;
          explored();
        }
        if (route.length) {
          const target = route[0],
            dx = target.x - walker.x,
            dz = target.z - walker.z,
            distance = Math.hypot(dx, dz);
          if (distance < 0.2) route.shift();
          else {
            const step = Math.min(distance, RUN * dt);
            walker.x += (dx / distance) * step;
            walker.z += (dz / distance) * step;
            walker.yaw +=
              shortest(Math.atan2(-dx, -dz) - walker.yaw) *
              (1 - Math.exp(-dt * 6));
            walker.pitch += (0.04 - walker.pitch) * (1 - Math.exp(-dt * 3));
            moving = true;
            if ((progress.time += dt) > 0.6) {
              const travelled = Math.hypot(walker.x - progress.x, walker.z - progress.z);
              if (travelled > 0.6) progress.detours = 0;
              else if (++progress.detours > 5) {
                // Still blocked after several sidesteps: stop rather than push forever.
                route = [];
                facing = null;
                pending = null;
              } else {
                // Step to the side away from the nearest obstacle, alternating if that fails.
                const sideX = -dz / distance,
                  sideZ = dx / distance;
                let nearest: { x: number; z: number } | null = null,
                  best = 3.2;
                [...colliders.circles, ...colliders.movers].forEach((spot) => {
                  const gap = Math.hypot(spot.x - walker.x, spot.z - walker.z) - spot.r;
                  if (gap < best) {
                    best = gap;
                    nearest = spot;
                  }
                });
                const away = nearest as { x: number; z: number } | null;
                let side = away
                  ? Math.sign((walker.x - away.x) * sideX + (walker.z - away.z) * sideZ) || 1
                  : 1;
                if (progress.detours % 2 === 0) side = -side;
                route.unshift(
                  new THREE.Vector3(
                    walker.x + sideX * side * 2.2 + (dx / distance) * 1.2,
                    0,
                    walker.z + sideZ * side * 2.2 + (dz / distance) * 1.2,
                  ),
                );
              }
              progress.x = walker.x;
              progress.z = walker.z;
              progress.time = 0;
            }
          }
        } else if (facing !== null) {
          // Turn to the terminal and raise the eyes to its hologram, then hand the view back.
          const terminal = zone.terminals[facing].position;
          const goal = Math.atan2(
            -(terminal.x - walker.x),
            -(terminal.z - walker.z),
          );
          const gap = shortest(goal - walker.yaw),
            tilt = Math.atan(1 / standOff()) - walker.pitch;
          walker.yaw += gap * (1 - Math.exp(-dt * 6));
          walker.pitch += tilt * (1 - Math.exp(-dt * 6));
          if (Math.abs(gap) < 0.01 && Math.abs(tilt) < 0.01) facing = null;
        } else if (pending) {
          // Face the object and lower the eyes to it, then use it.
          const target = pending.position;
          const goal = Math.atan2(-(target.x - walker.x), -(target.z - walker.z));
          const gap = shortest(goal - walker.yaw),
            tilt = THREE.MathUtils.clamp(Math.atan2(target.y - EYE - floor(), Math.hypot(target.x - walker.x, target.z - walker.z)), -0.6, 0.4) - walker.pitch;
          walker.yaw += gap * (1 - Math.exp(-dt * 6));
          walker.pitch += tilt * (1 - Math.exp(-dt * 6));
          if (Math.abs(gap) < 0.03 && Math.abs(tilt) < 0.03) {
            perform(pending);
            pending = null;
          }
        } else {
          walker.yaw -= turn * dt * 1.9;
          const speed = push * (fast ? RUN : WALK);
          walker.x -= Math.sin(walker.yaw) * speed * dt;
          walker.z -= Math.cos(walker.yaw) * speed * dt;
        }
        collide();
        if (moving && !still) {
          walker.stride += dt * (fast || route.length ? 11 : 8);
          const step = Math.floor(walker.stride / Math.PI);
          if (step !== footfall) {
            footfall = step;
            cue.current("step");
          }
        }
        let closest: number | null = null,
          best = standOff() + 0.9;
        // Terminals passed on the way to another one stay quiet.
        if (!route.length)
          zone.terminals.forEach((terminal, index) => {
            const distance = Math.hypot(
              terminal.position.x - walker.x,
              terminal.position.z - walker.z,
            );
            if (distance < best) {
              best = distance;
              closest = index;
            }
          });
        if (closest !== nearest) {
          nearest = closest;
          setActive(closest);
          if (closest !== null) cue.current("terminal");
        }
        camera.position.set(
          walker.x,
          EYE + floor() + (moving && !still ? Math.sin(walker.stride) * 0.035 : 0),
          walker.z,
        );
        if (zone.climb) {
          const up = zone.climb.aloft();
          if (up !== wasAloft) {
            wasAloft = up;
            setAloft(up);
          }
        }
        camera.quaternion.copy(eyeQuaternion());
        if (!walked && (hintTimer += dt) > 12) explored();
      }
      zone.terminals.forEach((terminal, index) => {
        terminal.focus +=
          ((index === nearest ? 1 : 0) - terminal.focus) *
          (1 - Math.exp(-dt * 5));
      });
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("pointermove", pointerMove);
      el.removeEventListener("pointermove", hover);
      window.clearTimeout(bountyTimer);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerCancel);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", blur);
      controls.current = null;
      if(zone.interior)cue.current("cantina-leave");
      if(zone.music)music.current?.(0,false);
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.Points ||
          object instanceof THREE.Sprite
        ) {
          if (!(object instanceof THREE.Sprite)) object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => {
            Object.values(material).forEach((value) => {
              if (value instanceof THREE.Texture) value.dispose();
            });
            material.dispose();
          });
        }
      });
      renderer.dispose();
      environment?.dispose();
      renderer.domElement.remove();
    };
  }, [landing, planet]);

  const terminal = active !== null ? landing.terminals[active] : null;
  if (fallback)
    return (
      <div className="surface surface-fallback" inert={hidden}>
        <p className="mono">{landing.pad}</p>
        <div className="surface-fallback-grid">
          {landing.terminals.map((item) => (
            <section key={item.id} className="terminal-panel is-static">
              <span className="mono">{item.label.toUpperCase()}</span>
              <h2>{item.heading}</h2>
              {item.meta && (
                <span className="terminal-meta mono">{item.meta}</span>
              )}
              <p>{item.body}</p>
              {item.links?.map((link) => (
                <a key={link.href} className="text-button" href={link.href}>
                  {link.label} <ArrowUpRight size={12} />
                </a>
              ))}
            </section>
          ))}
        </div>
        <button className="surface-takeoff mono" onClick={onTakeoff}>
          <Rocket size={13} /> DÉCOLLER
        </button>
      </div>
    );
  return (
    <div
      ref={mount}
      className="surface"
      data-planet={planet}
      inert={hidden}
      role="region"
      aria-label={`Zone d’atterrissage de ${planet}. ${landing.welcome}`}
    >
      <div ref={joystick} className="touch-joystick" aria-hidden="true">
        <i ref={thumb} />
      </div>
      <div
        className={`surface-fade ${leaving ? "is-leaving" : quietFade ? "is-quiet" : ""}`}
        aria-hidden="true"
      />
      {entering && phase === "arrival" && <AtmosphereEntry planet={planet} onDone={() => setEntering(false)} />}
      <AnimatePresence>
        {phase === "arrival" && (
          <motion.div
            className="surface-status mono"
            role="status"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <span>
              ATTERRISSAGE · {planet.toUpperCase()} · {landing.pad}
            </span>
            <button onClick={() => controls.current?.skip()}>PASSER</button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {phase === "explore" && hint && (
          <motion.p
            className="surface-hint mono"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {landing.welcome}
            <span>
              {coarse
                ? "GLISSEZ À GAUCHE POUR MARCHER · À DROITE POUR REGARDER"
                : "FLÈCHES OU ZQSD POUR MARCHER · GLISSER POUR REGARDER · MAJ POUR COURIR"}
            </span>
          </motion.p>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {phase === "explore" && terminal && (
          <motion.aside
            key={terminal.id}
            className="terminal-panel"
            role="region"
            aria-live="polite"
            aria-labelledby="terminal-title"
            initial={{ opacity: 0, y: reduced ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : 8 }}
          >
            <div className="orbit-card-top mono">
              <span>
                <i className="live-dot" /> TERMINAL 0{(active ?? 0) + 1} ·{" "}
                {terminal.label.toUpperCase()}
              </span>
            </div>
            <h2 id="terminal-title">{terminal.heading}</h2>
            {terminal.meta && (
              <span className="terminal-meta mono">{terminal.meta}</span>
            )}
            <p>{terminal.body}</p>
            {terminal.story !== undefined && (
              <button
                type="button"
                className="terminal-story mono"
                onClick={() => setStory({ at: terminal.story, title: terminal.heading })}
              >
                ▶ ÉCOUTER LE RÉCIT
              </button>
            )}
            {terminal.links && (
              <div className="terminal-links">
                {terminal.links.map((link) => (
                  <a
                    key={link.href}
                    className="text-button"
                    href={link.href}
                    target={link.href.startsWith("http") ? "_blank" : undefined}
                    rel={
                      link.href.startsWith("http") ? "noreferrer" : undefined
                    }
                  >
                    {link.label} <ArrowUpRight size={12} />
                  </a>
                ))}
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>
      {story && <PassionsViewer at={story.at} title={story.title} onClose={() => setStory(null)} />}
      {bounty !== null && landing.terminals[bounty] && (
        <BountyProjectPanel project={landing.terminals[bounty]} onClose={() => setBounty(null)} />
      )}
      {phase !== "arrival" && (
        <nav className={`surface-bar ${planet==="Tatooine"||planet==="Endor"?"with-district":""}`} aria-label="Navigation et terminaux">
          <span className="surface-place mono">
            {planet.toUpperCase()} · {inCantina?"CANTINA":inDistrict?"MOS EISLEY":landing.pad}
          </span>
          {planet==="Tatooine"&&<button className="surface-district mono" onClick={()=>controls.current?.district()} disabled={phase==="takeoff"}>{inDistrict?"← X-WING":"MOS EISLEY ↗"}</button>}
          {planet==="Tatooine"&&<button className="surface-district surface-cantina mono" onClick={()=>controls.current?.cantina()} disabled={phase==="takeoff"}>{inCantina?"← SORTIR":"CANTINA ↗"}</button>}
          {climb&&<button className="surface-district surface-climb mono" onClick={()=>controls.current?.climb()} disabled={phase==="takeoff"}>{aloft?climb.down:climb.up}</button>}
          {actions.filter((action)=>planet!=="Tatooine"||inCantina||action.hidden).map((action)=><button key={action.id} className="surface-district surface-action mono" onClick={()=>controls.current?.act(action.id)} disabled={phase==="takeoff"}>{action.label.toUpperCase()}</button>)}
          <div className="surface-terminals">
            {landing.terminals.map((item, index) => (
              <button
                key={item.id}
                className={`mono ${active === index ? "is-near" : ""}`}
                onClick={() => controls.current?.walkTo(index)}
              >
                0{index + 1} {item.label}
              </button>
            ))}
          </div>
          <button
            className="surface-takeoff mono"
            onClick={() => controls.current?.takeoff()}
            disabled={phase === "takeoff"}
          >
            <Rocket size={13} /> DÉCOLLER
          </button>
        </nav>
      )}
    </div>
  );
}
