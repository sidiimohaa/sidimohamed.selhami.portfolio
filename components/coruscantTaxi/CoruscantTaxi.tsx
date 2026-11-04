"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Clapperboard, DoorOpen, Eye, FastForward, LogOut, MessageSquare, MessageSquareOff, Navigation, Sunset } from "lucide-react";
import * as THREE from "three";
import { chosenTier, createPipeline } from "../render/pipeline";
import { enrichMaterials } from "../render/materialDetail";
import { looks, skies } from "../render/looks";
import { skyEnvironment } from "../render/skyLight";
import { glowTexture } from "../landingKit";
import { createAirTaxi } from "./taxiModel";
import { COUNCIL_FLOOR, PLAZA, SENATE, SENATE_FACING, SENATE_STOP, TRIP_KEYS, places, tripBetween, type PlaceId, type Trip } from "./taxiPlaces";
import { buildLanes, createTraffic } from "./taxiTraffic";
import { createTaxiCity, SUN } from "./taxiCity";
import { createJediTemple, createSenate } from "./taxiMonuments";
import { COUNCIL_TOPICS, createCouncilChamber, type CouncilTopic } from "./councilChamber";
import { createSenateHall } from "./senateHall";
import { createTaxiAudio, type TaxiAudio } from "./taxiAudio";
import { createWalkArea } from "./walkArea";
import { SENATE_TOPICS, TaxiPanel, topicLabel, type SenateTopic, type TaxiTopic } from "./TaxiPanels";

// The air taxi of Coruscant: board at pad 3-7, pick a destination on the holo dashboard, then
// cross the city in the cabin or through the cinematic cameras. At the Jedi Temple the visitor
// walks from the platform into the Council chamber; at the Senate, along the plaza into the
// rotunda, where their pod takes the floor. The taxi waits to go on or bring them back.

type Props = { reduced: boolean; sound: boolean; onClose: () => void };
type Mode = "seated" | "flight" | "out" | "hall";
type View = "cabin" | "cinema";
type Hud = { mode: Mode; place: PlaceId; to: PlaceId | null; inside: boolean; podOut: boolean; view: View; progress: number };
type Controls = {
  go: (to: PlaceId) => void;
  skip: () => void;
  toggleView: () => void;
  disembark: () => void;
  board: () => void;
  enter: () => void;
  topic: (id: TaxiTopic) => void;
  leaveHall: () => void;
  contemplate: () => void;
  leave: () => void;
};

const EYE = 1.7,
  WALK = 3.2,
  RUN = 5.6;
const ease = (t: number) => {
  const k = THREE.MathUtils.clamp(t, 0, 1);
  return k * k * (3 - 2 * k);
};
const shortest = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const others = (place: PlaceId) => (["temple", "senate", "pad"] as PlaceId[]).filter((id) => id !== place);
const blurb: Record<PlaceId, string> = {
  temple: "Le Conseil Jedi · vision et orientation",
  senate: "L’hémicycle · expériences et compétences",
  pad: "Retour au X-wing",
};

export default function CoruscantTaxi({ reduced, sound, onClose }: Props) {
  const mount = useRef<HTMLDivElement>(null),
    tipRef = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);
  const [hud, setHud] = useState<Hud>({ mode: "seated", place: "pad", to: null, inside: false, podOut: false, view: "cabin", progress: 0 });
  const [caption, setCaption] = useState<{ id: number; text: string } | null>(null);
  const [panel, setPanel] = useState<TaxiTopic | null>(null);
  const [fade, setFade] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tip, setTip] = useState<string | null>(null);
  const [voice, setVoice] = useState(true);
  const live = useRef({ reduced, panel, sound, voice });
  live.current = { reduced, panel, sound, voice };
  const audio = useRef<TaxiAudio | null>(null);
  const controls = useRef<Controls | null>(null);
  const leaveRef = useRef(onClose);
  leaveRef.current = onClose;

  useEffect(() => {
    audio.current?.setEnabled(sound);
  }, [sound]);
  useEffect(() => {
    audio.current?.setVoice(voice);
  }, [voice]);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      setFallback(true);
      return;
    }
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const quality = coarse || window.innerWidth < 760 ? 1 : 2;
    let ratio = Math.min(window.devicePixelRatio, quality >= 2 ? 1.75 : 1.4);
    renderer.setPixelRatio(ratio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.className = "taxi-canvas";
    renderer.domElement.setAttribute("aria-hidden", "true");
    el.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07070c);
    scene.fog = new THREE.FogExp2(new THREE.Color(0.135, 0.12, 0.22).lerp(new THREE.Color(0.44, 0.2, 0.105), 0.4), 0.00085);
    const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 4600);
    const sfx = createTaxiAudio();
    audio.current = sfx;
    sfx.setEnabled(live.current.sound);
    sfx.setVoice(live.current.voice);

    // The world.
    const glow = glowTexture();
    const trips = new Map<string, Trip>(TRIP_KEYS.map(([a, b]) => [`${a}>${b}`, tripBetween(a, b)]));
    const lanes = buildLanes([...trips.values()]);
    const city = createTaxiCity([...trips.values()], lanes, glow, quality);
    const temple = createJediTemple(glow);
    const senate = createSenate(glow);
    const traffic = createTraffic(lanes, glow, quality);
    const chamber = createCouncilChamber(glow);
    const hall = createSenateHall(glow, quality);
    const taxi = createAirTaxi({ glow, holo: true });
    const world = [city.group, temple.group, senate.group, traffic.group, chamber.group, taxi.group];
    scene.add(...world, hall.group);
    // Art direction: dusk sky as image-based light (polished stone and glass of the Council and
    // the Senate reflect it), surface detail on the architecture, and the city's colour grade.
    const tier = chosenTier();
    const environment = tier > 0 ? skyEnvironment(renderer, { ...skies.coruscant, intensity: 0.32 }) : null;
    if (environment) {
      scene.environment = environment.texture;
      scene.environmentIntensity = 0.32;
    }
    enrichMaterials(scene, looks.taxi.detail, tier);
    const pipeline = createPipeline(renderer, scene, camera, looks.taxi.grade, tier);
    // The plaza, from the portal of the rotunda out to its far edge.
    const plaza = createWalkArea(SENATE, Math.atan2(SENATE_FACING.x, SENATE_FACING.z), [{ kind: "rect", x: 0, z: (PLAZA.from + PLAZA.to) / 2, hx: PLAZA.half - 1, hz: (PLAZA.to - PLAZA.from) / 2 - 2 }]);
    plaza.setBlocks([{ x: 0, z: SENATE_STOP, hx: 1.5, hz: 3.4 }]);
    const resize = () => {
      const w = el.clientWidth || window.innerWidth,
        h = el.clientHeight || window.innerHeight;
      camera.aspect = w / Math.max(h, 1);
      camera.fov = camera.aspect < 0.8 ? 74 : 62;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      pipeline.setSize(w, h);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();

    // State of the ride, the eyes and the walk.
    let mode: Mode = "seated",
      view: View = "cabin",
      inside = false,
      podOut = false;
    const ride = { place: "pad" as PlaceId, trip: null as Trip | null, s: 0, v: 0, yaw: places.pad.yaw, pitch: 0, roll: 0, cue: 0, turn: 0 };
    const look = { yaw: 0.08, pitch: -0.1, input: -99, guide: null as THREE.Vector3 | null, guideUntil: 0 };
    const walker = { x: 0, z: 0, yaw: 0, pitch: 0, floor: 0, stride: 0 };
    let route: THREE.Vector3[] = [],
      arrived: (() => void) | null = null,
      facing: THREE.Vector3 | null = null,
      contemplating = 0;
    let door = 1,
      doorTarget = 1,
      headTurn = 0,
      talkUntil = 0;
    const glide = { active: false, clock: 0, duration: 1, from: new THREE.Vector3(), fromQ: new THREE.Quaternion(), to: () => ({ position: new THREE.Vector3(), quaternion: new THREE.Quaternion() }), done: null as (() => void) | null };
    const cinema = { shot: -1, clock: 0, fixed: new THREE.Vector3(), position: new THREE.Vector3(), reveal: false };
    const timers: number[] = [];
    const later = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms));
    let elapsed = 0,
      captionId = 0;
    const publish = (patch: Partial<Hud>) => setHud((current) => ({ ...current, ...patch }));
    const say = (line: string) => {
      captionId += 1;
      const id = captionId;
      setCaption({ id, text: line });
      sfx.droid();
      later(320, () => sfx.speak(line));
      talkUntil = elapsed + Math.max(3, line.length * 0.06);
      later(Math.max(5200, line.length * 75), () => setCaption((current) => (current?.id === id ? null : current)));
    };

    // The taxi at rest or on its trip.
    const tmp = new THREE.Vector3(),
      tangent = new THREE.Vector3(),
      euler = new THREE.Euler(0, 0, 0, "YXZ"),
      quat = new THREE.Quaternion();
    const parkTaxi = (place: PlaceId) => {
      ride.place = place;
      ride.yaw = places[place].yaw;
      ride.pitch = ride.roll = 0;
      taxi.group.position.copy(places[place].rest);
      taxi.group.rotation.set(0, ride.yaw, 0);
    };
    parkTaxi("pad");
    taxi.setDoor(1);
    const sceneFor = (place: PlaceId) => (place === "temple" ? "temple" : place === "senate" ? "senate" : "pad");

    // Poses for the camera.
    const seatPose = (yaw = look.yaw, pitch = look.pitch) => {
      taxi.group.updateMatrixWorld();
      const position = taxi.eye.clone().applyMatrix4(taxi.group.matrixWorld);
      const quaternion = taxi.group.quaternion.clone().multiply(quat.setFromEuler(euler.set(pitch, yaw + Math.PI, 0, "YXZ")));
      return { position, quaternion };
    };
    const walkerPose = () => ({
      position: new THREE.Vector3(walker.x, walker.floor + EYE, walker.z),
      quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(walker.pitch, walker.yaw, 0, "YXZ")),
    });
    const exitPoint = () => new THREE.Vector3(-2.5, 0, -0.6).applyMatrix4(taxi.group.matrixWorld).setY(walker.floor);
    const startGlide = (to: typeof glide.to, duration: number, done: () => void) => {
      if (live.current.reduced) {
        const pose = to();
        camera.position.copy(pose.position);
        camera.quaternion.copy(pose.quaternion);
        done();
        return;
      }
      glide.active = true;
      glide.clock = 0;
      glide.duration = duration;
      glide.from.copy(camera.position);
      glide.fromQ.copy(camera.quaternion);
      glide.to = to;
      glide.done = done;
    };
    const fadeThrough = (run: () => void, hold = 520) => {
      setFade(true);
      later(hold, () => {
        run();
        later(120, () => setFade(false));
      });
    };

    // The dashboard hologram: destinations when parked, the route when flying.
    const holo = taxi.holo!;
    const hc = holo.canvas.getContext("2d")!;
    const cards: [number, number, number, number][] = [
      [52, 200, 444, 300],
      [528, 200, 444, 300],
    ];
    let holoKey = "",
      hoverCard = -1;
    const routeMaps = new Map<string, { points: [number, number][] }>();
    trips.forEach((trip, key) => {
      const raw = Array.from({ length: 80 }, (_, i) => trip.curve.getPointAt(i / 79));
      const xs = raw.map((p) => p.x),
        zs = raw.map((p) => p.z);
      const minX = Math.min(...xs),
        maxX = Math.max(...xs),
        minZ = Math.min(...zs),
        maxZ = Math.max(...zs);
      const scale = Math.min(820 / Math.max(1, maxX - minX), 250 / Math.max(1, maxZ - minZ));
      routeMaps.set(key, { points: raw.map((p) => [512 + (p.x - (minX + maxX) / 2) * scale, 330 + (p.z - (minZ + maxZ) / 2) * scale]) });
    });
    const frame = (title: string) => {
      hc.clearRect(0, 0, 1024, 600);
      const g = hc.createLinearGradient(0, 0, 0, 600);
      g.addColorStop(0, "rgba(40,150,220,.22)");
      g.addColorStop(1, "rgba(40,150,220,.06)");
      hc.fillStyle = g;
      hc.fillRect(0, 0, 1024, 600);
      hc.strokeStyle = "#8fe4ff";
      hc.lineWidth = 4;
      hc.strokeRect(14, 14, 996, 572);
      hc.fillStyle = "#8fe4ff";
      hc.font = "30px SFMono-Regular, Consolas, monospace";
      hc.textAlign = "left";
      hc.fillText(title, 52, 74);
    };
    const drawHolo = () => {
      if (mode === "flight" && ride.trip) {
        const trip = ride.trip,
          key = `${trip.from}>${trip.to}`;
        const k = ride.s / trip.length;
        const next = `f${key}${Math.round(k * 200)}${Math.round(ride.v)}`;
        if (next === holoKey) return;
        holoKey = next;
        frame(`EN ROUTE · ${places[trip.to].name.toUpperCase()}`);
        const map = routeMaps.get(key)!;
        hc.lineWidth = 6;
        hc.strokeStyle = "rgba(143,228,255,.35)";
        hc.beginPath();
        map.points.forEach(([x, y], i) => (i ? hc.lineTo(x, y) : hc.moveTo(x, y)));
        hc.stroke();
        const reached = Math.max(1, Math.floor(k * (map.points.length - 1)));
        hc.strokeStyle = "#ffcf8a";
        hc.beginPath();
        map.points.slice(0, reached + 1).forEach(([x, y], i) => (i ? hc.lineTo(x, y) : hc.moveTo(x, y)));
        hc.stroke();
        const [dx, dy] = map.points[reached];
        hc.fillStyle = "#fff4dc";
        hc.beginPath();
        hc.arc(dx, dy, 13, 0, Math.PI * 2);
        hc.fill();
        const [ex, ey] = map.points[map.points.length - 1];
        hc.strokeStyle = "#7dffb0";
        hc.lineWidth = 5;
        hc.beginPath();
        hc.arc(ex, ey, 18, 0, Math.PI * 2);
        hc.stroke();
        hc.fillStyle = "#e9f9ff";
        hc.font = "bold 46px Arial, Helvetica, sans-serif";
        hc.fillText(`${Math.round((ride.v * 3.6) / 5) * 5} km/h`, 52, 548);
        hc.textAlign = "right";
        hc.fillText(`${Math.max(0, Math.round((trip.length - ride.s) / 10) * 10)} m`, 972, 548);
      } else {
        const options = others(ride.place);
        const next = `p${ride.place}${hoverCard}${mode}`;
        if (next === holoKey) return;
        holoKey = next;
        frame(ride.place === "pad" ? "TAXI AÉRIEN · LIGNE PREMIUM" : `ARRIVÉE · ${places[ride.place].name.toUpperCase()}`);
        hc.fillStyle = "#e9f9ff";
        hc.font = "bold 46px Arial, Helvetica, sans-serif";
        hc.fillText(ride.place === "pad" ? "Où souhaitez-vous aller ?" : "Descendre, ou repartir ?", 52, 150);
        options.forEach((id, i) => {
          const [x, y, w, h] = cards[i];
          const hot = hoverCard === i;
          hc.fillStyle = hot ? "rgba(255,207,138,.28)" : "rgba(143,228,255,.1)";
          hc.fillRect(x, y, w, h);
          hc.strokeStyle = hot ? "#ffcf8a" : "#8fe4ff";
          hc.lineWidth = hot ? 6 : 3;
          hc.strokeRect(x, y, w, h);
          hc.fillStyle = hot ? "#fff1d6" : "#e9f9ff";
          hc.font = "bold 44px Arial, Helvetica, sans-serif";
          hc.textAlign = "left";
          hc.fillText(places[id].name, x + 28, y + 80, w - 56);
          hc.font = "26px Arial, Helvetica, sans-serif";
          hc.fillStyle = "#bfeeff";
          const words = blurb[id].split(" · ");
          words.forEach((line, k) => hc.fillText(line, x + 28, y + 136 + k * 36, w - 56));
          const trip = trips.get(`${ride.place}>${id}`)!;
          hc.font = "26px SFMono-Regular, Consolas, monospace";
          hc.fillStyle = hot ? "#ffcf8a" : "#8fe4ff";
          hc.fillText(`≈ ${Math.round(trip.length / 31 / 5) * 5} s · ${(trip.length / 1000).toFixed(1).replace(".", ",")} km`, x + 28, y + h - 34);
        });
      }
      holo.texture.needsUpdate = true;
    };

    const hudPlace = () => publish({ mode, place: ride.place, to: ride.trip?.to ?? null, inside, podOut, view });

    // Flights.
    const arrive = () => {
      const trip = ride.trip!;
      ride.trip = null;
      ride.v = 0;
      mode = "seated";
      parkTaxi(trip.to);
      look.guide = null;
      sfx.setScene(sceneFor(trip.to));
      sfx.chime("arrive");
      say(places[trip.to].welcome);
      doorTarget = 0;
      look.yaw = 0.08;
      look.pitch = -0.1;
      hudPlace();
      publish({ progress: 1 });
    };
    const go = (to: PlaceId) => {
      if (mode !== "seated" || to === ride.place || glide.active) return;
      const trip = trips.get(`${ride.place}>${to}`)!;
      sfx.chime("confirm");
      doorTarget = 0;
      hoverCard = -1;
      if (live.current.reduced) {
        fadeThrough(() => {
          ride.trip = trip;
          ride.s = trip.length;
          arrive();
        }, 700);
        return;
      }
      ride.trip = trip;
      ride.s = 0;
      ride.v = 0;
      ride.cue = 0;
      ride.turn = 0;
      cinema.shot = -1;
      cinema.reveal = false;
      mode = "flight";
      sfx.setScene("flight");
      look.yaw = 0;
      look.pitch = -0.05;
      hudPlace();
      publish({ progress: 0 });
    };
    const skip = () => {
      if (mode !== "flight" || !ride.trip) return;
      fadeThrough(() => {
        ride.s = ride.trip!.length;
        arrive();
      }, 500);
    };
    const toggleView = () => {
      view = view === "cabin" ? "cinema" : "cabin";
      cinema.shot = -1;
      publish({ view });
    };

    // On foot.
    const isTemple = () => ride.place === "temple";
    const area = () => (isTemple() ? chamber.walk : plaza);
    const local = (x: number, z: number) => {
      const p = area().toWorld(x, z);
      return new THREE.Vector3(p.x, 0, p.z);
    };
    const faceTowards = (target: THREE.Vector3) => {
      walker.yaw = Math.atan2(-(target.x - walker.x), -(target.z - walker.z));
    };
    const walkTo = (points: THREE.Vector3[], then?: () => void) => {
      contemplating = 0;
      facing = null;
      if (live.current.reduced) {
        const last = points[points.length - 1];
        const before = points[points.length - 2] ?? new THREE.Vector3(walker.x, 0, walker.z);
        walker.x = last.x;
        walker.z = last.z;
        if (last.distanceTo(before) > 0.1) faceTowards(last.clone().multiplyScalar(2).sub(before));
        route = [];
        then?.();
        return;
      }
      route = points;
      arrived = then ?? null;
    };
    const disembark = () => {
      if (mode !== "seated" || ride.place === "pad" || glide.active) return;
      setBusy(true);
      doorTarget = 1;
      sfx.door(true);
      walker.floor = isTemple() ? COUNCIL_FLOOR : PLAZA.top;
      later(live.current.reduced ? 0 : 650, () => {
        const exit = exitPoint();
        walker.x = exit.x;
        walker.z = exit.z;
        walker.pitch = isTemple() ? 0.02 : 0.08;
        faceTowards(isTemple() ? local(0, 14) : local(0, PLAZA.from));
        startGlide(walkerPose, 1.5, () => {
          mode = "out";
          setBusy(false);
          hudPlace();
          if (!isTemple()) say("La Grande Place du Sénat. L’entrée de la Rotonde est droit devant.");
          else say("Le Conseil siège au bout de la passerelle.");
        });
      });
    };
    const board = () => {
      if (mode !== "out" || glide.active) return;
      setPanel(null);
      chamber.focus(null);
      const exit = exitPoint();
      // From the room or the bridge, out through the door and along the bridge first.
      const here = chamber.walk.toLocal(walker.x, walker.z);
      const path = isTemple()
        ? [
            ...(Math.hypot(here.x, here.z) < 8 ? [local(0, 6.5)] : []),
            ...(
              [
                [0, 11],
                [0, 17],
                [1.4, 21.5],
              ] as const
            )
              .filter(([, z]) => z > here.z + 0.5)
              .map(([x, z]) => local(x, z)),
            exit,
          ]
        : [exit];
      setBusy(true);
      walkTo(path, () => {
        faceTowards(taxi.group.position);
        startGlide(() => seatPose(0.08, -0.1), 1.4, () => {
          mode = "seated";
          look.yaw = 0.08;
          look.pitch = -0.1;
          doorTarget = 0;
          sfx.door(false);
          setBusy(false);
          if (inside) {
            inside = false;
            chamber.setPresence(false);
          }
          hudPlace();
        });
      });
    };
    const enter = () => {
      if (mode !== "out") return;
      if (isTemple()) {
        const here = chamber.walk.toLocal(walker.x, walker.z);
        walkTo(
          (
            [
              [1.4, 21.5],
              [0, 17],
              [0, 11],
              [0, 2.4],
            ] as const
          )
            .filter(([, z]) => z < here.z - 0.5)
            .map(([x, z]) => local(x, z)),
        );
      } else walkTo([local(0, SENATE_STOP - 12), local(0, PLAZA.from + 3)]);
    };
    const enterHall = () => {
      if (mode !== "out") return;
      route = [];
      fadeThrough(() => {
        mode = "hall";
        world.forEach((item) => (item.visible = false));
        hall.group.visible = true;
        hall.setFloor(false);
        look.yaw = 0;
        look.pitch = -0.12;
        sfx.setScene("senate");
        hudPlace();
        say("Délégation ORBITAL, vous avez la parole. Choisissez votre intervention.");
      }, 700);
    };
    const leaveHall = () => {
      if (mode !== "hall") return;
      setPanel(null);
      fadeThrough(() => {
        mode = "out";
        podOut = false;
        hall.setFloor(false);
        hall.group.visible = false;
        world.forEach((item) => (item.visible = true));
        const p = local(0, PLAZA.from + 13);
        walker.x = p.x;
        walker.z = p.z;
        walker.floor = PLAZA.top;
        walker.pitch = 0.05;
        faceTowards(local(0, 200));
        hudPlace();
      }, 700);
    };
    let panelTimer = 0;
    const topic = (id: TaxiTopic) => {
      window.clearTimeout(panelTimer);
      if (mode === "hall") {
        const open = () => {
          if (id === "motion") {
            hall.vote();
            sfx.vote();
            say("Le vote est ouvert… La motion est adoptée.");
            panelTimer = window.setTimeout(() => setPanel(id), live.current.reduced ? 300 : 2600);
          } else {
            sfx.chime("select");
            setPanel(id);
          }
        };
        if (!podOut) {
          podOut = true;
          hall.setFloor(true);
          hudPlace();
          sfx.chime("confirm");
          const wait = () => (hall.floorOut() ? open() : (panelTimer = window.setTimeout(wait, 200)));
          wait();
        } else open();
        return;
      }
      if (mode !== "out" || !isTemple()) return;
      const council = id as CouncilTopic;
      const seat = chamber.seatWorld(council);
      const show = () => {
        facing = seat;
        chamber.focus(council);
        sfx.chime("holocron");
        panelTimer = window.setTimeout(() => setPanel(id), live.current.reduced ? 0 : 900);
      };
      const at = chamber.walk.toLocal(walker.x, walker.z);
      if (Math.hypot(at.x, at.z) > 3) {
        setPanel(null);
        const path = at.z > 7.5 ? [local(0, 11), local(0, 1.4)] : [local(0, 1.4)];
        walkTo(path, show);
      } else show();
    };
    const contemplate = () => {
      if (mode !== "out" || !inside) return;
      setPanel(null);
      chamber.focus(null);
      facing = null;
      // Walk to the window that faces the sun, then let the eyes drift along the skyline.
      const sunLocal = chamber.walk.toLocal(walker.x + SUN.x * 100, walker.z + SUN.z * 100);
      const here = chamber.walk.toLocal(walker.x, walker.z);
      const angle = Math.atan2(sunLocal.x - here.x, sunLocal.z - here.z);
      const spot = local(Math.sin(angle) * 5.6, Math.cos(angle) * 5.6);
      walkTo([spot], () => {
        faceTowards(tmp.set(walker.x + SUN.x, 0, walker.z + SUN.z));
        walker.pitch = -0.08;
        contemplating = elapsed;
        say("Contemplez. Le Conseil se tait quand la ville s’allume.");
      });
    };
    const leave = () => {
      setBusy(true);
      doorTarget = 1;
      fadeThrough(() => leaveRef.current(), 600);
    };
    controls.current = { go, skip, toggleView, disembark, board, enter, topic, leaveHall, contemplate, leave };

    // Boarding: the door closes behind the visitor, the droid greets them.
    const startPose = seatPose();
    camera.position.copy(startPose.position);
    camera.quaternion.copy(startPose.quaternion);
    later(live.current.reduced ? 0 : 700, () => {
      doorTarget = 0;
      sfx.door(false);
    });
    later(live.current.reduced ? 200 : 1500, () => say("Bienvenue à bord du taxi aérien. Où souhaitez-vous aller ?"));
    sfx.setScene("pad");

    // Input.
    const keys = new Set<string>();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let drag: { id: number; x: number; y: number; startX: number; startY: number; at: number; moved: number } | null = null;
    let hoverLabel: string | null = null;
    const pick = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      if (mode === "seated" && !glide.active) {
        const hit = raycaster.intersectObject(holo.mesh)[0];
        if (hit?.uv) {
          const x = hit.uv.x * 1024,
            y = (1 - hit.uv.y) * 600;
          const index = cards.findIndex(([cx, cy, w, h]) => x > cx && x < cx + w && y > cy && y < cy + h);
          if (index >= 0) return { kind: "card" as const, index, label: `Aller : ${places[others(ride.place)[index]].name}` };
        }
      }
      if (mode === "out" && isTemple()) {
        const hit = raycaster.intersectObjects(chamber.pickables)[0];
        if (hit && hit.distance < 30) {
          const id = hit.object.userData.topic as CouncilTopic;
          return { kind: "topic" as const, id, label: `Holocron · ${topicLabel[id]}` };
        }
      }
      return null;
    };
    const setHover = (label: string | null, x = 0, y = 0) => {
      if (tipRef.current && label) tipRef.current.style.transform = `translate(${x + 16}px, ${y + 14}px)`;
      if (label === hoverLabel) return;
      hoverLabel = label;
      setTip(label);
      if (label) sfx.chime("hover");
      renderer.domElement.style.cursor = label ? "pointer" : "";
    };
    const onDown = (event: PointerEvent) => {
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, at: performance.now(), moved: 0 };
      try {
        renderer.domElement.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic pointers cannot be captured.
      }
    };
    const onMove = (event: PointerEvent) => {
      if (drag && drag.id === event.pointerId) {
        const dx = event.clientX - drag.x,
          dy = event.clientY - drag.y;
        drag.x = event.clientX;
        drag.y = event.clientY;
        drag.moved = Math.max(drag.moved, Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY));
        if (drag.moved > 6) {
          const rate = THREE.MathUtils.degToRad(camera.fov) / Math.max(el.clientHeight, 1);
          if (mode === "out") {
            walker.yaw += dx * rate;
            walker.pitch = THREE.MathUtils.clamp(walker.pitch + dy * rate, -0.9, 0.9);
            facing = null;
            contemplating = 0;
          } else {
            look.yaw = THREE.MathUtils.clamp(look.yaw + dx * rate, mode === "hall" ? -1.5 : -2.3, mode === "hall" ? 1.5 : 2.3);
            look.pitch = THREE.MathUtils.clamp(look.pitch + dy * rate, -0.85, 0.7);
            look.input = elapsed;
          }
          setHover(null);
          return;
        }
      }
      if (event.pointerType === "mouse" && !drag) {
        const found = pick(event.clientX, event.clientY);
        if (found?.kind === "card" && hoverCard !== found.index) hoverCard = found.index;
        else if (found?.kind !== "card" && hoverCard !== -1) hoverCard = -1;
        setHover(found?.label ?? null, event.clientX, event.clientY);
      }
    };
    const onUp = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      const click = drag.moved < 7 && performance.now() - drag.at < 500;
      drag = null;
      if (!click) return;
      const found = pick(event.clientX, event.clientY);
      if (found?.kind === "card") go(others(ride.place)[found.index]);
      else if (found?.kind === "topic") topic(found.id);
    };
    const canvas = renderer.domElement;
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", () => (drag = null));
    canvas.addEventListener("pointerleave", () => setHover(null));
    const typing = (event: KeyboardEvent) => (event.target as HTMLElement | null)?.closest?.("input,textarea");
    const onKey = (event: KeyboardEvent) => {
      if (typing(event)) return;
      const key = event.key.toLowerCase();
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (live.current.panel) {
          setPanel(null);
          chamber.focus(null);
        } else leave();
        return;
      }
      if (key === "v" && mode === "flight") toggleView();
      keys.add(key);
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
    const onBlur = () => keys.clear();
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    // Cinematic shots around the taxi.
    const fwd = new THREE.Vector3(),
      right = new THREE.Vector3(),
      up = new THREE.Vector3(0, 1, 0),
      aim = new THREE.Vector3(),
      want = new THREE.Vector3();
    const SHOTS = ["chase", "side", "flyby", "high", "front", "flyby", "side", "chase"] as const;
    const cinemaPose = (dt: number) => {
      const trip = ride.trip!;
      const T = taxi.group.position;
      fwd.set(Math.sin(ride.yaw), 0, Math.cos(ride.yaw));
      right.set(-fwd.z, 0, fwd.x);
      const remaining = 1 - ride.s / trip.length;
      let cut = false;
      if (remaining < 0.2 && !cinema.reveal) {
        cinema.reveal = true;
        cut = true;
      } else if (!cinema.reveal && (cinema.shot < 0 || (cinema.clock += dt) > 6.5)) {
        cinema.shot = (cinema.shot + 1) % SHOTS.length;
        cinema.clock = 0;
        cut = true;
        if (SHOTS[cinema.shot] === "flyby") {
          const u = Math.min(1, (ride.s + Math.max(90, ride.v * 3.4)) / trip.length);
          trip.curve.getPointAt(u, cinema.fixed);
          trip.curve.getTangentAt(u, tangent);
          cinema.fixed.addScaledVector(tmp.crossVectors(tangent, up).normalize(), 15).addScaledVector(up, 4.5);
        }
      }
      const shot = cinema.reveal ? "reveal" : SHOTS[cinema.shot];
      if (shot === "chase") {
        want.copy(T).addScaledVector(fwd, -13).addScaledVector(up, 3.6).addScaledVector(right, 1.4);
        aim.copy(T).addScaledVector(fwd, 25).addScaledVector(up, 1);
      } else if (shot === "side") {
        want.copy(T).addScaledVector(right, 8.5).addScaledVector(up, 1.4).addScaledVector(fwd, -1.5);
        aim.copy(T).addScaledVector(fwd, 3).addScaledVector(up, 1);
      } else if (shot === "flyby") {
        want.copy(cinema.fixed);
        aim.copy(T).addScaledVector(up, 1);
      } else if (shot === "high") {
        want.copy(T).addScaledVector(up, 17).addScaledVector(fwd, -17).addScaledVector(right, 8);
        aim.copy(T).addScaledVector(fwd, 30);
      } else if (shot === "front") {
        want.copy(T).addScaledVector(fwd, 11).addScaledVector(up, 2.2).addScaledVector(right, 2.5);
        aim.copy(T).addScaledVector(up, 1.2);
      } else {
        want.copy(T).addScaledVector(fwd, -15).addScaledVector(up, 5.5).addScaledVector(right, -3);
        aim.copy(places[trip.to].landmark).lerp(T, 0.35);
      }
      if (cut || shot === "flyby") cinema.position.copy(want);
      else cinema.position.lerp(want, 1 - Math.exp(-dt * 7));
      camera.position.copy(cinema.position);
      camera.lookAt(aim);
    };

    // The loop.
    let raf = 0,
      last = performance.now(),
      average = 1 / 60,
      sampled = 0,
      holoClock = 0,
      progressClock = 0;
    const adapt = (dt: number) => {
      average += (dt - average) * 0.05;
      if (elapsed < 4 || (sampled += dt) < 2.5) return;
      sampled = 0;
      if (average < 1 / 45) return;
      // Bloom and ambient occlusion go before resolution does.
      if (pipeline.tier() > 1) {
        pipeline.setTier(pipeline.tier() === 3 ? 2 : 1);
        return;
      }
      if (ratio <= 0.75) return;
      ratio = Math.max(0.75, ratio - 0.25);
      renderer.setPixelRatio(ratio);
      resize();
    };
    const animate = (now: number) => {
      const dt = THREE.MathUtils.clamp((now - last) / 1000, 0, 0.05);
      last = now;
      elapsed += dt;
      adapt(dt);
      const still = live.current.reduced;

      // The taxi.
      if (mode === "flight" && ride.trip) {
        const trip = ride.trip;
        const remaining = trip.length - ride.s;
        const target = Math.min(40, Math.sqrt(2 * 2.6 * remaining) + 0.8);
        ride.v += THREE.MathUtils.clamp(target - ride.v, -6 * dt, 4.2 * dt);
        ride.s = Math.min(trip.length, ride.s + ride.v * dt);
        const u = ride.s / trip.length;
        trip.curve.getPointAt(u, taxi.group.position);
        trip.curve.getTangentAt(u, tangent);
        const flat = Math.hypot(tangent.x, tangent.z);
        const was = ride.yaw;
        if (flat > 0.3) ride.yaw += shortest(Math.atan2(tangent.x, tangent.z) - ride.yaw) * (1 - Math.exp(-dt * 3.2));
        const turnRate = shortest(ride.yaw - was) / Math.max(dt, 0.001);
        ride.turn += (turnRate - ride.turn) * (1 - Math.exp(-dt * 4));
        const speedFactor = Math.min(1, ride.v / 14);
        ride.pitch += (THREE.MathUtils.clamp(-Math.asin(THREE.MathUtils.clamp(tangent.y, -1, 1)) * 0.6, -0.3, 0.3) * speedFactor - ride.pitch) * (1 - Math.exp(-dt * 3));
        ride.roll = THREE.MathUtils.clamp(-ride.turn * ride.v * 0.02, -0.3, 0.3) * speedFactor;
        taxi.group.rotation.set(ride.pitch, ride.yaw, ride.roll, "YXZ");
        if (!still) taxi.group.position.y += Math.sin(elapsed * 2.3) * 0.05 * speedFactor;
        // Announcements along the way.
        const cue = trip.cues[ride.cue];
        if (cue && u >= cue.at) {
          ride.cue += 1;
          say(cue.line);
          if (cue.look) {
            look.guide = cue.look;
            look.guideUntil = elapsed + 7;
          }
        }
        if (remaining < 0.15 && ride.v < 2) arrive();
        if ((progressClock += dt) > 0.25) {
          progressClock = 0;
          publish({ progress: u });
        }
      } else {
        const rest = places[ride.place].rest;
        taxi.group.position.set(rest.x, rest.y + (still ? 0 : Math.sin(elapsed * 1.6) * 0.035), rest.z);
        ride.yaw += shortest(places[ride.place].yaw - ride.yaw) * (1 - Math.exp(-dt * 2));
        ride.pitch *= 1 - Math.min(1, dt * 3);
        ride.roll *= 1 - Math.min(1, dt * 3);
        taxi.group.rotation.set(ride.pitch, ride.yaw, ride.roll, "YXZ");
      }
      const thrust = mode === "flight" ? 0.35 + Math.min(1, ride.v / 40) * 0.65 : 0.25;
      taxi.setThrust(thrust);
      sfx.setEngine(mode === "hall" ? 0 : mode === "out" ? 0.12 : thrust, mode === "flight" ? Math.min(1, ride.v / 40) : 0);
      door += THREE.MathUtils.clamp(doorTarget - door, -dt / 0.9, dt / 0.9);
      taxi.setDoor(still ? doorTarget : door);
      // The pilot droid turns to the passenger while it speaks.
      headTurn += ((elapsed < talkUntil ? 1 : 0) - headTurn) * (1 - Math.exp(-dt * 5));
      taxi.head.rotation.y = -headTurn * 2.0 + (still ? 0 : Math.sin(elapsed * 0.7) * 0.06);
      taxi.head.rotation.x = headTurn * 0.15;
      // The holo leans out of the way during the flight.
      holo.mesh.scale.setScalar(THREE.MathUtils.damp(holo.mesh.scale.x, mode === "flight" ? 0.62 : 1, 4, dt));
      holo.mesh.position.y = THREE.MathUtils.damp(holo.mesh.position.y, mode === "flight" ? 1.62 : 1.74, 4, dt);
      if ((holoClock += dt) > 0.2 || mode !== "flight") {
        holoClock = 0;
        drawHolo();
      }

      // The camera.
      if (glide.active) {
        glide.clock += dt;
        const k = ease(glide.clock / glide.duration);
        const pose = glide.to();
        camera.position.lerpVectors(glide.from, pose.position, k);
        // A small lift in the middle, as one steps in or out.
        camera.position.y += Math.sin(k * Math.PI) * 0.35;
        camera.quaternion.slerpQuaternions(glide.fromQ, pose.quaternion, k);
        if (glide.clock >= glide.duration) {
          glide.active = false;
          glide.done?.();
        }
      } else if (mode === "seated" || (mode === "flight" && view === "cabin")) {
        if (mode === "flight" && elapsed - look.input > 2.5) {
          let goalYaw = 0,
            goalPitch = -0.05;
          if (look.guide && elapsed < look.guideUntil) {
            const eye = taxi.eye.clone().applyMatrix4(taxi.group.matrixWorld);
            const dir = tmp.copy(look.guide).sub(eye).applyQuaternion(quat.copy(taxi.group.quaternion).invert());
            goalYaw = THREE.MathUtils.clamp(Math.atan2(dir.x, dir.z), -1.6, 1.6);
            goalPitch = THREE.MathUtils.clamp(Math.atan2(dir.y, Math.hypot(dir.x, dir.z)), -0.5, 0.5);
          }
          look.yaw += shortest(goalYaw - look.yaw) * (1 - Math.exp(-dt * 1.4));
          look.pitch += (goalPitch - look.pitch) * (1 - Math.exp(-dt * 1.4));
        }
        let shakeYaw = 0,
          shakePitch = 0;
        if (mode === "flight" && !still) {
          const level = Math.min(1, ride.v / 40);
          shakeYaw = Math.sin(elapsed * 17.3) * 0.0016 * level + Math.sin(elapsed * 5.1) * 0.002 * level;
          shakePitch = Math.sin(elapsed * 23.1) * 0.0018 * level + Math.sin(elapsed * 3.7) * 0.0025 * level;
        }
        const pose = seatPose(look.yaw + shakeYaw, look.pitch + shakePitch);
        camera.position.copy(pose.position);
        camera.quaternion.copy(pose.quaternion);
      } else if (mode === "flight") cinemaPose(dt);
      else if (mode === "out") {
        const panelOpen = Boolean(live.current.panel);
        const push = panelOpen ? 0 : (keys.has("arrowup") || keys.has("w") || keys.has("z") ? 1 : 0) - (keys.has("arrowdown") || keys.has("s") ? 1 : 0);
        const turn = panelOpen ? 0 : (keys.has("arrowright") || keys.has("d") ? 1 : 0) - (keys.has("arrowleft") || keys.has("a") || keys.has("q") ? 1 : 0);
        let moving = false;
        if (push || turn) {
          route = [];
          arrived = null;
          facing = null;
          contemplating = 0;
          walker.yaw -= turn * dt * 1.9;
          const speed = push * (keys.has("shift") ? RUN : WALK);
          walker.x -= Math.sin(walker.yaw) * speed * dt;
          walker.z -= Math.cos(walker.yaw) * speed * dt;
          moving = push !== 0;
        } else if (route.length) {
          const target = route[0],
            dx = target.x - walker.x,
            dz = target.z - walker.z,
            distance = Math.hypot(dx, dz);
          if (distance < 0.25) {
            route.shift();
            if (!route.length) {
              const then = arrived;
              arrived = null;
              then?.();
            }
          } else {
            const step = Math.min(distance, (still ? 99 : RUN * 0.8) * dt);
            walker.x += (dx / distance) * step;
            walker.z += (dz / distance) * step;
            walker.yaw += shortest(Math.atan2(-dx, -dz) - walker.yaw) * (1 - Math.exp(-dt * 6));
            walker.pitch += (0.02 - walker.pitch) * (1 - Math.exp(-dt * 3));
            moving = true;
          }
        } else if (facing) {
          // With a panel open on the right, the speaker stays in the left part of a wide screen.
          const aside = live.current.panel && camera.aspect > 1.2 ? -0.32 : 0;
          const goal = Math.atan2(-(facing.x - walker.x), -(facing.z - walker.z)) + aside;
          const tilt = THREE.MathUtils.clamp(Math.atan2(facing.y - walker.floor - EYE, Math.hypot(facing.x - walker.x, facing.z - walker.z)), -0.5, 0.5);
          walker.yaw += shortest(goal - walker.yaw) * (1 - Math.exp(-dt * 5));
          walker.pitch += (tilt - walker.pitch) * (1 - Math.exp(-dt * 5));
        } else if (contemplating && !still) {
          walker.yaw += Math.sin((elapsed - contemplating) * 0.12) * dt * 0.09;
        }
        area().constrain(walker);
        if (moving && !still) walker.stride += dt * 8;
        const bob = moving && !still ? Math.sin(walker.stride) * 0.03 : 0;
        camera.position.set(walker.x, walker.floor + EYE + bob, walker.z);
        camera.quaternion.setFromEuler(euler.set(walker.pitch, walker.yaw, 0, "YXZ"));
        if (isTemple()) {
          const p = chamber.walk.toLocal(walker.x, walker.z);
          const now = Math.hypot(p.x, p.z) < 8;
          if (now !== inside) {
            inside = now;
            chamber.setPresence(now);
            if (now) {
              sfx.chime("holocron");
              say("Le Conseil vous reçoit. Approchez un holocron pour l’entendre.");
            } else chamber.focus(null);
            hudPlace();
          }
        } else {
          const p = plaza.toLocal(walker.x, walker.z);
          if (p.z < PLAZA.from + 6 && Math.abs(p.x) < 7) enterHall();
        }
      } else if (mode === "hall") {
        const eye = hall.eye();
        const toPodium = hall.podium().sub(eye);
        const baseYaw = Math.atan2(-toPodium.x, -toPodium.z);
        camera.position.copy(eye);
        camera.quaternion.setFromEuler(euler.set(look.pitch, baseYaw + look.yaw, 0, "YXZ"));
        if (elapsed - look.input > 4) {
          look.yaw *= 1 - Math.min(1, dt * 0.6);
        }
      }

      // The world around.
      if (mode === "hall") hall.tick(dt, elapsed, still);
      else {
        traffic.tick(dt, still, { trip: mode === "flight" ? ride.trip : null, s: ride.s, speed: ride.v, camera }, (pan, level) => sfx.whoosh(pan, level));
        city.tick(dt, elapsed, still, camera);
        temple.tick(dt, still);
        if (ride.place === "temple" || mode === "flight") chamber.tick(dt, elapsed, still);
      }
      camera.updateMatrixWorld();
      pipeline.render();
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
      window.clearTimeout(panelTimer);
      observer.disconnect();
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      controls.current = null;
      sfx.dispose();
      audio.current = null;
      const textures = new Set<THREE.Texture>();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = (object as THREE.Mesh).material;
        if (!material) return;
        (Array.isArray(material) ? material : [material]).forEach((item) => {
          Object.values(item).forEach((value) => value instanceof THREE.Texture && textures.add(value));
          item.dispose();
        });
      });
      textures.forEach((texture) => texture.dispose());
      pipeline.dispose();
      environment?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  const act = (run: (controls: Controls) => void) => () => controls.current && run(controls.current);
  const placeName = places[hud.place].name;
  const status =
    hud.mode === "flight" && hud.to
      ? `En route vers ${places[hud.to].name === "Plateforme 3-7" ? "la plateforme 3-7" : `le ${places[hud.to].name}`}`
      : hud.mode === "hall"
        ? "Sénat galactique · la Rotonde"
        : hud.mode === "out"
          ? hud.place === "temple"
            ? hud.inside
              ? "Temple Jedi · salle du Conseil"
              : "Temple Jedi · plateforme du Conseil"
            : "Sénat galactique · Grande Place"
          : `${placeName} · à bord`;

  if (fallback)
    return (
      <div className="coruscant-taxi taxi-fallback" role="dialog" aria-label="Taxi aérien de Coruscant">
        <h2>Taxi aérien</h2>
        <p>La 3D n’est pas disponible sur cet appareil. Voici ce que le Conseil Jedi et le Sénat présentent.</p>
        <div className="taxi-fallback-list">
          {[...COUNCIL_TOPICS, ...SENATE_TOPICS.filter((id) => id !== "motion")].map((id) => (
            <button key={id} onClick={() => setPanel(id)}>
              {topicLabel[id]}
            </button>
          ))}
        </div>
        <button className="taxi-quit" onClick={onClose}>
          <LogOut size={15} /> Revenir à la plateforme
        </button>
        {panel && <TaxiPanel topic={panel} onClose={() => setPanel(null)} />}
      </div>
    );

  return (
    <div className="coruscant-taxi" data-mode={hud.mode} role="dialog" aria-label="Taxi aérien de Coruscant">
      <div ref={mount} className="taxi-stage" />
      <div className="taxi-vignette" aria-hidden="true" />
      <header className="taxi-head">
        <div className="taxi-badge">
          <span className="mono">TAXI AÉRIEN · CORUSCANT</span>
          <strong>{status}</strong>
        </div>
        <div className="taxi-head-actions">
          <button className="taxi-chip" onClick={() => setVoice((on) => !on)} aria-pressed={voice} title={voice ? "Couper la voix du droïde" : "Rétablir la voix du droïde"}>
            {voice ? <MessageSquare size={15} /> : <MessageSquareOff size={15} />}
            <span>VOIX</span>
          </button>
          {hud.mode === "flight" && (
            <button className="taxi-chip" onClick={act((k) => k.toggleView())} aria-pressed={hud.view === "cinema"} title="Changer de vue (V)">
              {hud.view === "cabin" ? <Clapperboard size={15} /> : <Eye size={15} />}
              <span>{hud.view === "cabin" ? "VUE CINÉMA" : "VUE CABINE"}</span>
            </button>
          )}
          <button className="taxi-chip taxi-quit" onClick={act((k) => k.leave())} title="Revenir à la plateforme 3-7 (Échap)">
            <LogOut size={15} />
            <span>QUITTER</span>
          </button>
        </div>
      </header>
      {hud.mode === "flight" && (
        <div className="taxi-progress" aria-hidden="true">
          <i style={{ transform: `scaleX(${hud.progress})` }} />
        </div>
      )}

      <AnimatePresence>
        {caption && (
          <motion.div
            key={caption.id}
            className="taxi-caption"
            role="status"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.01 : 0.3 }}
          >
            <span className="mono">DROÏDE PILOTE</span>
            <p>{caption.text}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="taxi-actions" aria-label="Commandes du taxi">
        {hud.mode === "seated" &&
          others(hud.place).map((id) => (
            <button key={id} className={id === "pad" ? "" : "is-primary"} onClick={act((k) => k.go(id))} disabled={busy}>
              {id === "pad" ? <ArrowLeft size={15} /> : <Navigation size={15} />}
              {id === "pad" ? "Retour plateforme 3-7" : `Aller au ${places[id].name.replace(" galactique", "")}`}
            </button>
          ))}
        {hud.mode === "seated" && hud.place !== "pad" && (
          <button className="is-accent" onClick={act((k) => k.disembark())} disabled={busy}>
            <DoorOpen size={15} /> Descendre du taxi
          </button>
        )}
        {hud.mode === "seated" && hud.place === "pad" && (
          <button onClick={act((k) => k.leave())} disabled={busy}>
            <DoorOpen size={15} /> Descendre sur la plateforme
          </button>
        )}
        {hud.mode === "flight" && (
          <button onClick={act((k) => k.skip())}>
            <FastForward size={15} /> Arriver maintenant
          </button>
        )}
        {hud.mode === "out" && hud.place === "temple" && !hud.inside && (
          <button className="is-accent" onClick={act((k) => k.enter())} disabled={busy}>
            <DoorOpen size={15} /> Entrer dans la salle du Conseil
          </button>
        )}
        {hud.mode === "out" &&
          hud.place === "temple" &&
          hud.inside &&
          COUNCIL_TOPICS.map((id) => (
            <button key={id} className={panel === id ? "is-active" : ""} onClick={act((k) => k.topic(id))}>
              {topicLabel[id]}
            </button>
          ))}
        {hud.mode === "out" && hud.place === "temple" && hud.inside && (
          <button onClick={act((k) => k.contemplate())}>
            <Sunset size={15} /> Contempler
          </button>
        )}
        {hud.mode === "out" && hud.place === "senate" && (
          <button className="is-accent" onClick={act((k) => k.enter())} disabled={busy}>
            <DoorOpen size={15} /> Entrer dans la Rotonde
          </button>
        )}
        {hud.mode === "hall" &&
          SENATE_TOPICS.map((id: SenateTopic) => (
            <button key={id} className={`${panel === id ? "is-active" : ""} ${id === "motion" ? "is-accent" : ""}`} onClick={act((k) => k.topic(id))}>
              {topicLabel[id]}
            </button>
          ))}
        {hud.mode === "hall" && (
          <button onClick={act((k) => k.leaveHall())}>
            <ArrowLeft size={15} /> Quitter la Rotonde
          </button>
        )}
        {hud.mode === "out" && (
          <button onClick={act((k) => k.board())} disabled={busy}>
            <ArrowLeft size={15} /> Remonter dans le taxi
          </button>
        )}
      </nav>
      <p className="taxi-help mono" aria-hidden="true">
        {hud.mode === "out"
          ? "ZQSD / FLÈCHES · GLISSER POUR REGARDER"
          : hud.mode === "flight"
            ? "GLISSER POUR REGARDER · V : CHANGER DE VUE"
            : hud.mode === "hall"
              ? "GLISSER POUR REGARDER · CHOISISSEZ VOTRE INTERVENTION"
              : "GLISSER POUR REGARDER · TOUCHER LE TABLEAU DE BORD"}
      </p>

      <div ref={tipRef} className={`taxi-tip ${tip ? "is-on" : ""}`} aria-hidden="true">
        {tip}
      </div>
      <AnimatePresence>
        {panel && (
          <motion.div
            key={panel}
            className="taxi-panel-wrap"
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.01 : 0.35 }}
          >
            <TaxiPanel topic={panel} onClose={() => setPanel(null)} />
          </motion.div>
        )}
      </AnimatePresence>
      <div className={`taxi-fade ${fade ? "is-on" : ""}`} aria-hidden="true" />
    </div>
  );
}
