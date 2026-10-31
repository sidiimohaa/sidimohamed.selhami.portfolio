"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Briefcase, Gauge, LogOut, Map as MapIcon } from "lucide-react";
import * as THREE from "three";
import { createStage } from "../jedi/stage";
import { LIFT_A, LIFT_B, SPAWN, createStation, roomNames, type RoomId, type Station } from "./stationWorld";
import { createStationAudio, type StationAudio } from "./stationAudio";
import RecruiterMode from "./RecruiterMode";
import StationPanel, { type PanelId } from "./StationPanels";
import { SECTIONS, identity, type Section } from "./cvData";
import { loadDossier as load, saveDossier as save } from "./dossierProgress";

// The Death Star, inside: a professional record to explore in the first person. The approach and
// landing in the hangar play first (skippable), then the visitor walks the station; the Recruiter
// mode gives every essential without walking anywhere, and is the whole experience without WebGL.

type Props = { start: "explore" | "recruiter"; reduced: boolean; sound: boolean; onClose: () => void };
// Where the plan takes the visitor, and what they turn to face on arrival.
type Destination = { id: string; label: string; short: string; room: RoomId; x: number; z: number; face: [number, number] };

const destinations: Destination[] = [
  { id: "hangar", label: "Hangar · Accueil", short: "Hangar", room: "hangar", x: 0, z: -19, face: [0, -26] },
  { id: "dossier", label: "Dossier CV complet", short: "CV", room: "dossier", x: -33, z: -38, face: [-35, -42.4] },
  { id: "archives", label: "Archives · Expériences", short: "Expériences", room: "archives", x: -49, z: -90, face: [-57.4, -90] },
  { id: "formation", label: "Centre de formation", short: "Formation", room: "formation", x: 42, z: -90, face: [48, -90] },
  { id: "skills", label: "Salle des compétences", short: "Compétences", room: "skills", x: 0, z: -130, face: [0, -140] },
  { id: "command", label: "Commandement · Projets", short: "Projets", room: "command", x: 102, z: -35, face: [102, -60] },
];
const upper = (room: RoomId | null) => room === "command" || room === "liftB";
function panelFor(id: string): { id: PanelId; focus?: string } | null {
  if (id === "accueil") return { id: "accueil" };
  if (id === "exp-bricoman") return { id: "experience", focus: "bricoman" };
  if (id === "exp-aldi") return { id: "experience", focus: "aldi" };
  if (id === "exp-all") return { id: "experiences" };
  if (id === "formation") return { id: "formation" };
  if (id.startsWith("edu-")) return { id: "formation", focus: id.slice(4) };
  if (id === "skills") return { id: "skills" };
  if (id.startsWith("skill:") || id.startsWith("cat:")) return { id: "skills", focus: id.split(":")[1] };
  if (id === "projects") return { id: "projects" };
  if (id === "proj-orbital") return { id: "projects", focus: "orbital" };
  if (id === "proj-passions") return { id: "projects", focus: "passions" };
  if (id === "restreint") return { id: "code" };
  if (id === "maintenance") return { id: "transmission" };
  if (id === "vader") return { id: "vader" };
  if (id === "mouse-droid") return { id: "droid" };
  return null;
}

export default function DeathStarStation({ start, reduced, sound, onClose }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"intro" | "explore">(start === "recruiter" || reduced ? "explore" : "intro");
  const [caption, setCaption] = useState(0);
  const [recruiter, setRecruiter] = useState<{ view: "sections" | "complete"; title: string } | null>(start === "recruiter" ? { view: "sections", title: "Mode Recruteur" } : null);
  const [panel, setPanel] = useState<{ id: PanelId; focus?: string } | null>(null);
  const [prompt, setPrompt] = useState<{ id: string; label: string } | null>(null);
  const [room, setRoom] = useState<RoomId>("hangar");
  const [menu, setMenu] = useState(false);
  const [quality, setQuality] = useState<"high" | "light">("high");
  const [fallback, setFallback] = useState(false);
  const [fade, setFade] = useState(false);
  const [touch, setTouch] = useState(false);
  const [plan, setPlan] = useState<{ x0: number; x1: number; z0: number; z1: number; room: RoomId }[]>([]);
  const [progress, setProgress] = useState(() => (typeof window === "undefined" ? { seen: [] as Section[], secret: false } : load()));
  const station = useRef<Station | null>(null);
  const renderer = useRef<THREE.WebGLRenderer | null>(null);
  const view = useRef<THREE.PerspectiveCamera | null>(null);
  const audio = useRef<StationAudio | null>(null);
  const player = useRef({ x: SPAWN.x, z: SPAWN.z, yaw: SPAWN.yaw, pitch: -0.04, walked: 0, step: 0 });
  const keys = useRef(new Set<string>());
  const stick = useRef({ x: 0, y: 0 });
  const route = useRef<{ points: THREE.Vector3[]; then?: () => void } | null>(null);
  const facing = useRef<[number, number] | null>(null);
  const ride = useRef<{ to: "A" | "B"; t: number; then?: () => void } | null>(null);
  const skip = useRef(false);
  const marker = useRef<SVGGElement>(null);
  const live = useRef({ phase, panel, recruiter, menu, reduced, prompt, fade });
  live.current = { phase, panel, recruiter, menu, reduced, prompt, fade };
  const roomRef = useRef<RoomId>("hangar");

  // Quality: lighter on phones and small screens, by default.
  useEffect(() => {
    if (window.innerWidth < 768 || matchMedia("(pointer: coarse)").matches) {
      setQuality("light");
      setTouch(matchMedia("(pointer: coarse)").matches);
    }
  }, []);

  const markSeen = useCallback((section: Section) => {
    setProgress((current) => {
      if (current.seen.includes(section)) return current;
      const next = { ...current, seen: [...current.seen, section] };
      save(next);
      return next;
    });
  }, []);
  // Every section consulted: the High Command has a last word, once.
  useEffect(() => {
    if (progress.secret || !SECTIONS.every((s) => progress.seen.includes(s))) return;
    const timer = window.setTimeout(() => {
      setProgress((current) => {
        const next = { ...current, secret: true };
        save(next);
        return next;
      });
      setRecruiter(null);
      setPanel({ id: "secret" });
      audio.current?.granted();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [progress]);

  const open = useCallback((id: string) => {
    if (id === "plan") {
      setMenu(true);
      audio.current?.open();
      return;
    }
    if (id === "dossier") {
      setRecruiter({ view: "complete", title: "Dossier CV" });
      audio.current?.open();
      return;
    }
    if (id === "lift-up" || id === "lift-down") {
      startRide(id === "lift-up" ? "B" : "A");
      return;
    }
    const target = panelFor(id);
    if (!target) return;
    if (id === "vader") audio.current?.breath();
    else if (id === "mouse-droid") audio.current?.droid();
    else audio.current?.open();
    setPanel(target);
    // A plain function of refs: stable enough for the handlers that call it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRide = (to: "A" | "B", then?: () => void) => {
    if (ride.current) return;
    route.current = null;
    ride.current = { to, t: 0, then };
    audio.current?.lift();
  };
  const walkTo = (x: number, z: number, then?: () => void) => {
    const s = station.current;
    if (!s) return;
    setHover(null);
    const from = new THREE.Vector3(player.current.x, 0, player.current.z);
    const points = s.navigate(from, new THREE.Vector3(x, 0, z));
    if (!points.length) return;
    route.current = { points, then };
  };
  const goTo = (target: Destination) => {
    setMenu(false);
    setPanel(null);
    const here = roomRef.current;
    const arrive = () => walkTo(target.x, target.z, () => (facing.current = target.face));
    if (upper(target.room) && !upper(here)) walkTo(LIFT_A.x, LIFT_A.z, () => startRide("B", arrive));
    else if (!upper(target.room) && upper(here)) walkTo(LIFT_B.x, LIFT_B.z, () => startRide("A", arrive));
    else arrive();
  };
  // Walk up to something then open it, or open it straight away when it is within reach.
  const approach = (id: string) => {
    const s = station.current;
    if (!s) return;
    const item = s.interactables.find((entry) => entry.id === id);
    const at = item?.position;
    const p = player.current;
    if (!item || !at) return open(id);
    const distance = Math.hypot(at.x - p.x, at.z - p.z);
    const insideRoom = s.roomAt(p.x, p.z) === item.room;
    if (distance <= Math.max(item.reach, 0.1) || (item.reach === 0 && insideRoom) || (id.startsWith("skill") && insideRoom)) return open(id);
    const k = Math.max(0, (distance - Math.max(1.4, item.reach * 0.7)) / distance);
    walkTo(p.x + (at.x - p.x) * k, p.z + (at.z - p.z) * k, () => open(id));
  };

  // The 3D station.
  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    let s: Station | null = null;
    const holder = new THREE.Group();
    const parked = new THREE.Vector3();
    const parkedQuat = new THREE.Quaternion();
    let path: THREE.CatmullRomCurve3 | null = null;
    let intro = 0,
      uiClock = 0,
      lastRoom: RoomId | null = null,
      lastPrompt = "";
    const eye = new THREE.Vector3(),
      look = new THREE.Vector3(),
      tmp = new THREE.Vector3(),
      tmp2 = new THREE.Vector3();
    const firstPerson = new THREE.Euler(0, 0, 0, "YXZ");
    const stage = createStage(
      el,
      (dt, time) => {
        if (!s) return;
        const camera = stage!.camera;
        const p = player.current;
        const { reduced } = live.current;
        // --- The approach: the ship flies into the bay and sets down, then the view drops to eye level.
        if (live.current.phase === "intro" && path) {
          intro += dt;
          if (skip.current) intro = 99;
          const fly = THREE.MathUtils.smootherstep(Math.min(1, intro / 7.2), 0, 1);
          const shipAt = path.getPointAt(fly);
          holder.position.copy(shipAt);
          if (fly < 0.995) {
            holder.lookAt(path.getPointAt(Math.min(1, fly + 0.01)));
            holder.rotateY(Math.PI);
            holder.quaternion.slerp(parkedQuat, THREE.MathUtils.smoothstep(fly, 0.9, 1));
          } else holder.quaternion.copy(parkedQuat);
          const camAt = path.getPointAt(Math.max(0, fly - 0.045)).add(tmp.set(0, 3 + (1 - fly) * 6, 0));
          const blend = THREE.MathUtils.smootherstep((intro - 7.0) / 2.4, 0, 1);
          eye.copy(camAt).lerp(tmp2.set(p.x, 1.7, p.z), blend);
          look.copy(shipAt).lerp(tmp.set(p.x - Math.sin(p.yaw) * 10, 1.7 + Math.sin(p.pitch) * 10, p.z - Math.cos(p.yaw) * 10), blend);
          camera.position.copy(eye);
          camera.lookAt(look);
          if (intro > 1.0 && intro < 8.6) setCaption(intro > 4.0 ? 2 : 1);
          if (intro >= 9.4) {
            holder.position.copy(parked);
            holder.quaternion.copy(parkedQuat);
            setCaption(0);
            setPhase("explore");
          }
        }
        // --- Walking: keys or the thumb stick, or a route to follow after a click.
        const exploring = live.current.phase === "explore";
        const busy = !!(live.current.panel || live.current.recruiter || live.current.menu);
        const held = keys.current;
        let forward = 0,
          strafe = 0,
          turn = 0;
        if (exploring && !busy && !ride.current) {
          if (held.has("z") || held.has("w") || held.has("ArrowUp")) forward += 1;
          if (held.has("s") || held.has("ArrowDown")) forward -= 1;
          if (held.has("q") || held.has("a")) strafe -= 1;
          if (held.has("d")) strafe += 1;
          if (held.has("ArrowLeft")) turn += 1;
          if (held.has("ArrowRight")) turn -= 1;
          forward += -stick.current.y;
          strafe += stick.current.x;
        }
        if (forward || strafe || turn) {
          route.current = null;
          facing.current = null;
        }
        p.yaw += turn * dt * 1.9;
        // After a trip from the plan, turn to face what the room is about.
        if (facing.current && !route.current) {
          const want = Math.atan2(-(facing.current[0] - p.x), -(facing.current[1] - p.z));
          const diff = Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw));
          p.yaw += diff * Math.min(1, dt * (reduced ? 30 : 3.5));
          if (Math.abs(diff) < 0.01) facing.current = null;
        }
        const run = held.has("Shift");
        const speed = run ? 6.4 : 3.9;
        let mx = 0,
          mz = 0;
        if (route.current && !busy) {
          const next = route.current.points[0];
          const dx = next.x - p.x,
            dz = next.z - p.z,
            d = Math.hypot(dx, dz);
          if (d < 0.3) {
            route.current.points.shift();
            if (!route.current.points.length) {
              const then = route.current.then;
              route.current = null;
              then?.();
            }
          } else {
            mx = (dx / d) * Math.min(d, 6.2 * dt);
            mz = (dz / d) * Math.min(d, 6.2 * dt);
            const want = Math.atan2(-dx, -dz);
            const diff = Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw));
            p.yaw += diff * Math.min(1, dt * (reduced ? 12 : 4));
            p.pitch = THREE.MathUtils.damp(p.pitch, -0.04, 3, dt);
          }
        } else if (forward || strafe) {
          const len = Math.min(1, Math.hypot(forward, strafe));
          const ang = Math.atan2(strafe, forward);
          const k = speed * dt * len;
          mx = (-Math.sin(p.yaw) * Math.cos(ang) + Math.cos(p.yaw) * Math.sin(ang)) * k;
          mz = (-Math.cos(p.yaw) * Math.cos(ang) - Math.sin(p.yaw) * Math.sin(ang)) * k;
        }
        if (mx || mz) {
          if (s.isFree(p.x + mx, p.z + mz)) {
            p.x += mx;
            p.z += mz;
          } else if (s.isFree(p.x + mx, p.z)) p.x += mx;
          else if (s.isFree(p.x, p.z + mz)) p.z += mz;
          const moved = Math.hypot(mx, mz);
          p.walked += moved;
          p.step += moved;
          if (p.step > (run ? 1.6 : 1.25)) {
            p.step = 0;
            audio.current?.step();
          }
        }
        // --- The lift: doors close, the cabin travels, doors open on the other level.
        let doors = { a: Math.hypot(p.x - LIFT_A.x, p.z - -100.3) < 4.2 ? 1 : 0, b: Math.hypot(p.x - LIFT_B.x, p.z - -29.7) < 4.2 ? 1 : 0 };
        const r = ride.current;
        if (r) {
          r.t += dt;
          const toB = r.to === "B";
          const arrived = r.t > 1.35;
          doors = toB ? { a: 0, b: arrived && r.t > 1.7 ? 1 : 0 } : { a: arrived && r.t > 1.7 ? 1 : 0, b: 0 };
          if (r.t > 0.55 && r.t < 1.6 && !live.current.fade) setFade(true);
          if (r.t >= 1.35 && r.t - dt < 1.35) {
            const at = toB ? LIFT_B : LIFT_A;
            p.x = at.x;
            p.z = at.z;
            p.yaw = toB ? 0 : Math.PI;
          }
          if (r.t > 1.7 && live.current.fade) setFade(false);
          if (r.t > 2.4) {
            ride.current = null;
            r.then?.();
          }
        }
        if (exploring) {
          const bob = reduced ? 0 : Math.sin(p.walked * 6.5) * 0.035;
          camera.position.set(p.x, 1.7 + bob, p.z);
          camera.quaternion.setFromEuler(firstPerson.set(p.pitch, p.yaw, 0));
        }
        const here = exploring ? s.roomAt(p.x, p.z) : "hangar";
        const events = s.tick(dt, time, exploring ? camera.position : tmp.set(0, 0, -200), here, reduced, doors);
        if (events.opened && exploring) audio.current?.door();
        if (marker.current) marker.current.setAttribute("transform", `translate(${p.x.toFixed(2)} ${p.z.toFixed(2)}) rotate(${((-p.yaw * 180) / Math.PI).toFixed(1)})`);
        if ((uiClock += dt) > 0.1) {
          uiClock = 0;
          if (here && here !== lastRoom) {
            lastRoom = here;
            roomRef.current = here;
            setRoom(here);
            setHover(null);
          }
          // The nearest console in reach, roughly in front.
          let best: { id: string; label: string } | null = null,
            bestDistance = Infinity;
          if (exploring && !ride.current)
            for (const item of s.interactables) {
              if (!item.reach) continue;
              const dx = item.position.x - p.x,
                dz = item.position.z - p.z,
                d = Math.hypot(dx, dz);
              if (d > item.reach) continue;
              const facing = (-Math.sin(p.yaw) * dx - Math.cos(p.yaw) * dz) / Math.max(d, 0.001);
              if (d > 1.8 && facing < 0.15) continue;
              if (d < bestDistance) {
                bestDistance = d;
                best = { id: item.id, label: item.label };
              }
            }
          const key = best?.id ?? "";
          if (key !== lastPrompt) {
            lastPrompt = key;
            setPrompt(best);
          }
        }
      },
      { fov: 62, exposure: 1.05 },
    );
    if (!stage) {
      setFallback(true);
      setRecruiter({ view: "sections", title: "Mode Recruteur" });
      return;
    }
    renderer.current = stage.renderer;
    view.current = stage.camera;
    stage.camera.far = 1600;
    stage.camera.near = 0.08;
    stage.camera.updateProjectionMatrix();
    stage.scene.background = new THREE.Color(0x010204);
    const light = window.innerWidth < 768 || matchMedia("(pointer: coarse)").matches;
    s = createStation(stage.scene, stage.renderer, { reduced, light });
    station.current = s;
    s.setLight(light);
    if (light) stage.renderer.setPixelRatio(1);
    setPlan(s.plan());
    // The visitor's X-wing: flown in during the approach, then parked by the console.
    s.root.add(holder);
    holder.add(s.xwing);
    s.xwing.rotation.set(-Math.PI / 2, 0, 0);
    holder.position.set(s.shipSpot.x, 0, s.shipSpot.z);
    holder.rotation.set(0, 0.55, 0);
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(s.xwing);
    parked.set(s.shipSpot.x, 0.3 - box.min.y, s.shipSpot.z);
    holder.position.copy(parked);
    parkedQuat.copy(holder.quaternion);
    path = new THREE.CatmullRomCurve3([new THREE.Vector3(60, 46, 360), new THREE.Vector3(22, 20, 170), new THREE.Vector3(2, 9, 48), new THREE.Vector3(0, 6.5, 2), new THREE.Vector3(3.5, 4.4, -7), parked.clone()]);
    const p = player.current;
    stage.camera.position.set(p.x, 1.7, p.z);
    stage.camera.quaternion.setFromEuler(firstPerson.set(p.pitch, p.yaw, 0));
    if (live.current.phase === "intro") audio.current?.intro();
    return () => {
      s?.dispose();
      station.current = null;
      renderer.current = null;
      view.current = null;
      stage.dispose();
    };
    // Built once; the latest state is read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sound.
  useEffect(() => {
    audio.current = createStationAudio();
    return () => {
      audio.current?.dispose();
      audio.current = null;
    };
  }, []);
  useEffect(() => {
    audio.current?.setEnabled(sound);
  }, [sound]);
  useEffect(() => {
    station.current?.setLight(quality === "light");
    renderer.current?.setPixelRatio(quality === "light" ? 1 : Math.min(window.devicePixelRatio, 2));
  }, [quality]);

  // Keyboard: walk, interact, map; Escape closes what is open, then leaves the station.
  useEffect(() => {
    shell.current?.focus();
    const down = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        const state = live.current;
        if (state.panel) setPanel(null);
        else if (state.menu) setMenu(false);
        else if (state.recruiter && !fallback) setRecruiter(null);
        else onClose();
        return;
      }
      if (typing) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const state = live.current;
      if (key === "e" && !event.repeat && state.phase === "explore" && !state.panel && !state.recruiter && !state.menu && state.prompt) {
        event.preventDefault();
        open(state.prompt.id);
        return;
      }
      if (key === "m" && !event.repeat && state.phase === "explore" && !state.recruiter) {
        setMenu((value) => !value);
        return;
      }
      if (["z", "q", "s", "d", "w", "a", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Shift"].includes(key)) {
        if (event.target instanceof HTMLButtonElement && key.startsWith("Arrow")) return;
        keys.current.add(key);
        if (key.startsWith("Arrow")) event.preventDefault();
      }
    };
    const up = (event: KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      keys.current.delete(key);
    };
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", blur);
    };
  }, [onClose, open, fallback]);

  // Pointer: drag to look (right half on a phone), thumb stick on the left half, click to go.
  const gesture = useRef<{ id: number; x: number; y: number; lx: number; ly: number; t: number; stick: boolean; moved: number } | null>(null);
  const [stickAt, setStickAt] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (live.current.phase !== "explore") return;
    const isTouch = event.pointerType !== "mouse";
    if (isTouch && !touch) setTouch(true);
    const bounds = event.currentTarget.getBoundingClientRect();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A pointer the browser no longer tracks: the gesture still works without capture.
    }
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, lx: event.clientX, ly: event.clientY, t: performance.now(), stick: isTouch && event.clientX - bounds.left < bounds.width * 0.45, moved: 0 };
    if (gesture.current.stick) setStickAt({ x: event.clientX - bounds.left, y: event.clientY - bounds.top, dx: 0, dy: 0 });
  };
  // With a mouse, hovering something clickable names it.
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const hoverClock = useRef(0);
  const findPick = (cx: number, cy: number, bounds: DOMRect) => {
    const s = station.current,
      cam = view.current;
    if (!s || !cam) return null;
    raycaster.current.setFromCamera(new THREE.Vector2(((cx - bounds.left) / bounds.width) * 2 - 1, -((cy - bounds.top) / bounds.height) * 2 + 1), cam);
    raycaster.current.far = 60;
    let object: THREE.Object3D | null = raycaster.current.intersectObjects(s.pickables, true)[0]?.object ?? null;
    while (object && !object.userData.interact && !object.userData.skill && !object.userData.category) object = object.parent;
    return object;
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g && event.pointerType === "mouse" && live.current.phase === "explore") {
      const now = performance.now();
      if (now - hoverClock.current < 80) return;
      hoverClock.current = now;
      const bounds = event.currentTarget.getBoundingClientRect();
      const object = findPick(event.clientX, event.clientY, bounds);
      const text = object ? ((object.userData.label as string | undefined) ?? station.current?.interactables.find((item) => item.id === object.userData.interact)?.label) : undefined;
      event.currentTarget.style.cursor = text ? "pointer" : "";
      setHover(text ? { x: event.clientX - bounds.left, y: event.clientY - bounds.top, text } : null);
      return;
    }
    if (!g || g.id !== event.pointerId) return;
    const dx = event.clientX - g.x,
      dy = event.clientY - g.y;
    g.moved = Math.max(g.moved, Math.hypot(dx, dy));
    facing.current = null;
    if (g.stick) {
      const len = Math.min(1, Math.hypot(dx, dy) / 55);
      const a = Math.atan2(dy, dx);
      stick.current = { x: Math.cos(a) * len, y: Math.sin(a) * len };
      setStickAt((value) => (value ? { ...value, dx: Math.cos(a) * len * 40, dy: Math.sin(a) * len * 40 } : value));
      return;
    }
    const p = player.current;
    const k = event.pointerType === "mouse" ? 0.0042 : 0.0065;
    p.yaw -= (event.clientX - g.lx) * k;
    p.pitch = THREE.MathUtils.clamp(p.pitch - (event.clientY - g.ly) * k * 0.8, -0.75, 0.6);
    g.lx = event.clientX;
    g.ly = event.clientY;
  };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    stick.current = { x: 0, y: 0 };
    setStickAt(null);
    if (!g || g.moved > 7 || performance.now() - g.t > 450) return;
    click(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
  };
  const raycaster = useRef(new THREE.Raycaster());
  const click = (cx: number, cy: number, bounds: DOMRect) => {
    const s = station.current;
    const el = mount.current;
    if (!s || !el) return;
    const object = findPick(cx, cy, bounds);
    if (object) {
      if (object.userData.skill) return approach(`skill:${object.userData.skill}`);
      if (object.userData.category) return approach(`skill:${object.userData.category}`);
      if (object.userData.interact) return approach(object.userData.interact);
    }
    // Otherwise, walk to the point of the floor that was clicked.
    const t = -raycaster.current.ray.origin.y / raycaster.current.ray.direction.y;
    if (t > 0 && t < 60) {
      const at = raycaster.current.ray.at(t, new THREE.Vector3());
      if (s.isFree(at.x, at.z)) walkTo(at.x, at.z);
    }
  };
  const skipIntro = () => {
    skip.current = true;
  };
  const bounds = plan.length
    ? plan.reduce((b, a) => ({ x0: Math.min(b.x0, a.x0), x1: Math.max(b.x1, a.x1), z0: Math.min(b.z0, a.z0), z1: Math.max(b.z1, a.z1) }), { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity })
    : null;

  return (
    <div ref={shell} className="death-star-station" role="dialog" aria-modal="true" aria-label={`Étoile de la Mort · dossier professionnel de ${identity.name}`} tabIndex={-1}>
      <div ref={mount} className="ds-canvas" onPointerLeave={() => setHover(null)} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onContextMenu={(event) => event.preventDefault()} />
      <div className="ds-vignette" aria-hidden="true" />
      {hover && !panel && !recruiter && (
        <span className="ds-tooltip mono" style={{ left: hover.x, top: hover.y }} aria-hidden="true">
          {hover.text}
        </span>
      )}

      <header className="ds-hud-top">
        <div className="ds-place">
          <span className="mono">ÉTOILE DE LA MORT · ARCHIVES IMPÉRIALES</span>
          <strong>{phase === "intro" ? "Approche de la station" : roomNames[room]}</strong>
        </div>
        <div className="ds-hud-actions">
          <button className="ds-recruiter-button" onClick={() => setRecruiter({ view: "sections", title: "Mode Recruteur" })}>
            <Briefcase size={15} /> Mode Recruteur
          </button>
          {phase === "explore" && !fallback && (
            <>
              <button onClick={() => setMenu((value) => !value)} aria-expanded={menu}>
                <MapIcon size={15} /> <span>Plan</span>
              </button>
              <button onClick={() => setQuality(quality === "high" ? "light" : "high")} aria-label={`Qualité graphique : ${quality === "high" ? "haute" : "légère"}`}>
                <Gauge size={15} /> <span>{quality === "high" ? "Qualité haute" : "Qualité légère"}</span>
              </button>
            </>
          )}
          <button onClick={onClose}>
            <LogOut size={15} /> <span>Retour à la galaxie</span>
          </button>
        </div>
      </header>

      {phase === "intro" && (
        <>
          <AnimatePresence>
            {caption > 0 && (
              <motion.div key={caption} className="ds-transmission" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} role="status">
                {caption === 1 ? (
                  <>
                    <span className="mono">TRANSMISSION HOLOGRAPHIQUE</span>
                    <strong>IMPERIAL ARCHIVES — Personnel File Access Granted</strong>
                  </>
                ) : (
                  <>
                    <span className="mono">ARCHIVES IMPÉRIALES</span>
                    <strong>Dossier professionnel : {identity.name}</strong>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <button className="ds-skip" onClick={skipIntro}>
            Passer l’introduction ›
          </button>
        </>
      )}

      {phase === "explore" && !fallback && (
        <>
          {bounds && !touch && (
            <svg className="ds-minimap" viewBox={`${bounds.x0 - 12} ${bounds.z0 - 8} ${bounds.x1 - bounds.x0 + 24} ${bounds.z1 - bounds.z0 + 16}`} aria-hidden="true">
              {plan.map((a, i) =>
                a.room === "skills" ? <circle key={i} cx={(a.x0 + a.x1) / 2} cy={(a.z0 + a.z1) / 2} r={(a.x1 - a.x0) / 2} data-on={room === a.room} /> : <rect key={i} x={a.x0} y={a.z0} width={a.x1 - a.x0} height={a.z1 - a.z0} data-on={room === a.room} />,
              )}
              {destinations.map((d) => (
                <text key={d.id} x={d.x} y={d.z - 6}>
                  {d.short}
                </text>
              ))}
              <g ref={marker}>
                <path d="M0 -5 L3.5 3.5 L0 1.5 L-3.5 3.5 Z" />
              </g>
            </svg>
          )}
          <AnimatePresence>
            {prompt && !panel && !recruiter && !menu && (
              <motion.button key={prompt.id} className="ds-prompt" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onClick={() => open(prompt.id)}>
                <kbd>E</kbd> {prompt.label}
              </motion.button>
            )}
          </AnimatePresence>
          {!touch && <p className="ds-help mono">ZQSD / WASD se déplacer · glisser pour regarder · clic pour aller · E interagir · M plan</p>}
          {touch && <p className="ds-help mono">Pouce gauche : avancer · glisser à droite : regarder · toucher : aller</p>}
          {stickAt && (
            <div className="ds-stick" style={{ left: stickAt.x, top: stickAt.y }} aria-hidden="true">
              <i style={{ transform: `translate(${stickAt.dx}px, ${stickAt.dy}px)` }} />
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {menu && (
          <motion.nav className="ds-menu" aria-label="Plan de la station" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <span className="mono">PLAN DE LA STATION · SE RENDRE À</span>
            {destinations.map((d) => (
              <button key={d.id} aria-current={room === d.room ? "true" : undefined} onClick={() => goTo(d)}>
                {d.label}
              </button>
            ))}
            <p className="mono">
              DOSSIER CONSULTÉ : {progress.seen.length}/{SECTIONS.length} SECTIONS
            </p>
          </motion.nav>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panel && (
          <div className="ds-holo-layer" key="panel" onPointerDown={() => setPanel(null)}>
            <StationPanel
              id={panel.id}
              focus={panel.focus}
              reduced={reduced}
              onClose={() => {
                setPanel(null);
                audio.current?.close();
                shell.current?.focus();
              }}
              onSeen={markSeen}
              onRecruiter={() => {
                setPanel(null);
                setRecruiter({ view: "sections", title: "Mode Recruteur" });
              }}
              onPlan={() => {
                setPanel(null);
                setMenu(true);
              }}
              onCode={(code) => {
                if (code !== "1138") {
                  audio.current?.denied();
                  return false;
                }
                audio.current?.granted();
                setPanel({ id: "bonus" });
                return true;
              }}
            />
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>{fade && <motion.div key="fade" className="ds-fade" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }} />}</AnimatePresence>

      {recruiter && (
        <RecruiterMode
          view={recruiter.view}
          title={recruiter.title}
          onSeen={markSeen}
          onClose={() => (fallback ? onClose() : setRecruiter(null))}
          onExit={onClose}
          onExplore={
            fallback
              ? undefined
              : () => {
                  setRecruiter(null);
                  if (phase === "intro") skipIntro();
                }
          }
        />
      )}
      {fallback && <p className="ds-fallback mono">LA STATION 3D N’EST PAS DISPONIBLE SUR CET APPAREIL · LE DOSSIER RESTE CONSULTABLE ICI</p>}
    </div>
  );
}
